// Vista por persona. El HTML armado trae TODOS los proyectos; acá se parte una vez al cargar y, para cada combinación de accesos,
// se arma (y se guarda comprimido) un HTML que trae SOLO esos proyectos y canales. Lo que no le corresponde no sale del servidor.
//   - proyectos: solo los permitidos; en cada uno solo los canales permitidos. Si falta algún canal, se saca también la pestaña
//     "General" del proyecto (mezcla los canales).
//   - cuartiles (referencias): se sacan las de otros proyectos (la clave lleva el nombre del cliente).
//   - lookers: solo los de sus proyectos y canales.
//   - todos.ef (eficacia de "todos los proyectos", sumada): solo si ve todo; si no, se saca.
//   - La vista "Todos los proyectos" de la app se calcula en el navegador con los proyectos que llegan: ya queda recortada.
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
const { normal } = require('./accesos');

// Franja de aviso arriba ("Sin dato de hoy: ..."): el navegador pregunta a /api/aviso y, si hay texto, lo muestra (con textContent).
const AVISO_SCRIPT = '<script>(function(){function pedir(){fetch("/api/aviso",{credentials:"same-origin"}).then(function(r){return r.ok?r.json():null}).then(function(j){var d=document.getElementById("syo-aviso");'
  + 'if(!j||!j.aviso){if(d)d.remove();return}if(!document.querySelector("x-dc")||!document.body)return;if(!d){d=document.createElement("div");d.id="syo-aviso";'
  + 'd.style.cssText="position:relative;z-index:100000;background:#FFF4D6;color:#3C3C3C;border-bottom:1px solid #E8D9A8;font:500 12px/1.6 Poppins,-apple-system,BlinkMacSystemFont,sans-serif;text-align:center;padding:3px 12px";document.body.insertBefore(d,document.body.firstChild)}'
  + 'd.textContent=j.aviso}).catch(function(){})}var n=0,iv=setInterval(function(){n++;pedir();if(n>40)clearInterval(iv)},1500);setInterval(pedir,600000)})();</script>\n';

function cargarArmado(ruta) {
  const html = fs.readFileSync(ruta, 'utf8');
  const mT = html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/);
  if (!mT) throw new Error('No encontré el template en el HTML armado');
  const template = JSON.parse(mT[1]);
  const mL = template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  if (!mL) throw new Error('No encontré la lógica en el template');
  const logica = mL[1];
  const iD = logica.indexOf('const DATA = '), fD = logica.indexOf(';\n', iD);
  if (iD < 0 || fD < 0) throw new Error('No encontré "const DATA = " en la lógica');
  const iL = template.indexOf(logica);
  const DATA = JSON.parse(logica.slice(iD + 'const DATA = '.length, fD));
  const iH = html.indexOf(mT[0]);
  return {
    DATA,
    htmlAntes: html.slice(0, iH).replace('</head>', () => AVISO_SCRIPT + '</head>'), htmlDespues: html.slice(iH + mT[0].length),
    tplAntes: template.slice(0, iL) + logica.slice(0, iD) + 'const DATA = ',
    tplDespues: logica.slice(fD) + template.slice(iL + logica.length),
  };
}

const armarHtml = (a, data) => a.htmlAntes + '<script type="__bundler/template">'
  + JSON.stringify(a.tplAntes + JSON.stringify(data).replace(/<\//g, '<\\/') + a.tplDespues).replace(/<\//g, '<\\/') + '</script>' + a.htmlDespues;

// ¿Este proyecto del HTML es el que nombra PAUTADOR? Por nombre, cliente o id.
const esProyecto = (p, nombre) => [p.nombre, p.cliente, p.id].some((x) => normal(x) === normal(nombre));

// permisos (de permisosDe) → { proyectos: [{ id, canales[] }], total } sobre los proyectos que hay en DATA
function alcanceDe(DATA, permisos) {
  if (!permisos || !permisos.ok) return { proyectos: [], total: false };
  if (permisos.global) return { proyectos: DATA.proyectos.map((p) => ({ id: p.id, canales: Object.keys(p.canales) })), total: true };
  const salida = [];
  for (const p of DATA.proyectos) {
    const f = permisos.proyectos.find((x) => esProyecto(p, x.proyecto));
    if (!f) continue;
    const propios = Object.keys(p.canales);
    const canales = f.canales.length ? propios.filter((c) => f.canales.includes(normal(c))) : propios;
    if (canales.length) salida.push({ id: p.id, canales });
  }
  const total = salida.length === DATA.proyectos.length
    && salida.every((s) => s.canales.length === Object.keys(DATA.proyectos.find((p) => p.id === s.id).canales).length);
  return { proyectos: salida, total };
}

// → DATA recortado (no toca el original)
function recortar(DATA, alcance) {
  if (alcance.total) return DATA;
  const ids = new Set(alcance.proyectos.map((x) => x.id));
  const permitido = (pid, canal) => { const x = alcance.proyectos.find((y) => y.id === pid); return !!x && x.canales.includes(canal); };
  const prohibidos = DATA.proyectos.filter((p) => !ids.has(p.id));
  const nombresProhibidos = new Set(prohibidos.flatMap((p) => [p.nombre, p.cliente].map(normal)));
  const proyectos = DATA.proyectos.filter((p) => ids.has(p.id)).map((p) => {
    const x = alcance.proyectos.find((y) => y.id === p.id);
    const canales = Object.fromEntries(Object.entries(p.canales).filter(([c]) => x.canales.includes(c)));
    const completo = Object.keys(canales).length === Object.keys(p.canales).length;
    return { ...p, canales, general: completo ? p.general : null };
  });
  const sinProhibidos = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !k.split('|').some((parte) => nombresProhibidos.has(normal(parte)))));
  const cuartiles = DATA.cuartiles
    ? { ...DATA.cuartiles, ...(DATA.cuartiles.pl ? { pl: sinProhibidos(DATA.cuartiles.pl) } : {}), ...(DATA.cuartiles.ob ? { ob: sinProhibidos(DATA.cuartiles.ob) } : {}) }
    : DATA.cuartiles;
  const lookers = Object.fromEntries(Object.entries(DATA.lookers || {}).filter(([k]) => { const [pid, canal] = k.split('|'); return permitido(pid, canal); }));
  return { ...DATA, proyectos, cuartiles, lookers, todos: {} };
}

function crearVistas({ ruta, maxEntradas = 24 }) {
  let armado = null, mtime = 0;      // se carga al primer pedido (y de nuevo si el archivo cambia): el servidor arranca aunque todavía no haya HTML armado
  const cache = new Map();    // firma → { buf (gzip), etag }
  const enCurso = new Map();

  function recargarSiCambio() {
    let m; try { m = fs.statSync(ruta).mtimeMs; } catch (e) { if (!armado) { const x = new Error('todavía no hay HTML armado'); x.codigo = 'sin_armado'; throw x; } return; }
    if (m !== mtime || !armado) { armado = cargarArmado(ruta); mtime = m; cache.clear(); }
  }
  const firmaDe = (alcance) => mtime + '|' + (alcance.total ? 'TODO' : JSON.stringify(alcance.proyectos.map((x) => [x.id, [...x.canales].sort()]).sort()));

  // → { alcance, buf, etag } ; sin nada que ver → null (no se arma HTML)
  async function paraPermisos(permisos) {
    recargarSiCambio();
    const alcance = alcanceDe(armado.DATA, permisos);
    if (!alcance.proyectos.length) return null;
    const firma = firmaDe(alcance);
    if (cache.has(firma)) { const c = cache.get(firma); cache.delete(firma); cache.set(firma, c); return { alcance, ...c }; }
    if (!enCurso.has(firma)) {
      const a = armado;
      const p = new Promise((ok, mal) => {
        try {
          const html = armarHtml(a, recortar(a.DATA, alcance));
          zlib.gzip(Buffer.from(html, 'utf8'), { level: 6 }, (err, buf) => (err ? mal(err) : ok({ buf, etag: '"' + crypto.createHash('sha1').update(buf).digest('hex') + '"' })));
        } catch (e) { mal(e); }
      }).then((c) => { cache.set(firma, c); while (cache.size > maxEntradas) cache.delete(cache.keys().next().value); return c; })
        .finally(() => enCurso.delete(firma));
      enCurso.set(firma, p);
    }
    return { alcance, ...(await enCurso.get(firma)) };
  }
  return { paraPermisos, datos: () => { recargarSiCambio(); return armado.DATA; }, htmlCompleto: () => { recargarSiCambio(); return armarHtml(armado, armado.DATA); }, tamanoCache: () => cache.size };
}

module.exports = { AVISO_SCRIPT, crearVistas, alcanceDe, recortar, cargarArmado, armarHtml, esProyecto };
