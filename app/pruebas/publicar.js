// Prueba de la copia para publicar (node publicar.js → publicar/). Uso: node pruebas/publicar.js. Termina en "problemas 0".
// 1) Tamaños: index.html y cada archivo hasta 16 MB, todo hasta 64 MB.
// 2) Todo lo que carga index.html existe en publicar/ (rutas relativas) y no hay scripts ni estilos de otros sitios fuera de los permitidos.
// 3) Carga los datos como lo haría el navegador (los <script> de la cabeza, en orden) y compara con los de la app armada: tienen que ser iguales.
// 4) Recorre con la lógica de la copia todas las pantallas de cada proyecto y canal (pestañas, primer período y cada campaña en sus dos
//    opciones de Rendimiento) y compara cada pantalla con la de la app local: iguales, salvo los textos de "sin servidor".
// 5) Sin servidor: la copia nunca llama a /api/… y "Enviar a PAUTADOR" dice que en esta copia no se envían pedidos.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = path.join(__dirname, '..', 'publicar');
const MB = 1024 * 1024;
const problemas = [];
const ok = (c, t) => { if (!c) problemas.push(t); };

// ---- 1) tamaños ----
const archivos = fs.readdirSync(DIR);
let total = 0;
for (const f of archivos) { const t = fs.statSync(path.join(DIR, f)).size; total += t; ok(t <= 16 * MB, `${f} pasa los 16 MB`); }
ok(total <= 64 * MB, `el total pasa los 64 MB (${(total / MB).toFixed(1)})`);

// ---- 2) referencias ----
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const exterior = html.replace(/<script type="__bundler\/[^"]+">[\s\S]*?<\/script>/g, '');
const srcs = [...exterior.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
for (const s of srcs) ok(fs.existsSync(path.join(DIR, s)), `index.html carga ${s}, que no existe`);
ok(srcs.length === archivos.filter((f) => /^datos-\d+\.js$/.test(f)).length, `index.html no carga todos los datos-N.js (${srcs.join(', ')})`);
const template = JSON.parse(html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
const PERMITIDOS = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net\/npm|unpkg\.com|cdn\.tailwindcss\.com|code\.jquery\.com)\//;
for (const m of template.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) ok(!/^https?:/.test(m[1]) || PERMITIDOS.test(m[1]), `script de otro sitio: ${m[1]}`);
for (const m of template.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)) ok(!/^https?:/.test(m[1]) || /^https:\/\/fonts\.googleapis\.com\//.test(m[1]), `hoja de estilo de otro sitio: ${m[1]}`);
const ext = JSON.parse((html.match(/<script type="__bundler\/ext_resources">([\s\S]*?)<\/script>/) || [, '[]'])[1]);
for (const e of ext) ok(PERMITIDOS.test(e.id), `recurso externo no permitido: ${e.id}`);

// ---- 3) datos ----
const ctx = { window: {} }; vm.createContext(ctx);
for (const m of exterior.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
  const src = (m[1].match(/\ssrc="([^"]+)"/) || [])[1];
  if (src) vm.runInContext(fs.readFileSync(path.join(DIR, src), 'utf8'), ctx, { filename: src });
  else if (/__SYO_DATA =/.test(m[2])) vm.runInContext(m[2], ctx);
}
const DCOPIA = ctx.window.__SYO_DATA;
const original = fs.readFileSync(path.join(__dirname, '..', 'Seguimiento y Optimizacion.html'), 'utf8');
const tOrig = JSON.parse(original.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
const lOrig = tOrig.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
const DORIG = new Function(lOrig.match(/const DATA = [\s\S]*?;\n/)[0] + '; return DATA;')();
ok(DCOPIA && JSON.stringify(DCOPIA) === JSON.stringify(DORIG), 'los datos de la copia no son iguales a los de la app armada');

// ---- 4) pantallas ----
const lCopia = template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
ok(/const DATA = window\.__SYO_DATA;/.test(lCopia), 'la lógica de la copia no toma los datos de los archivos');
const llamadas = [];
global.fetch = (u) => { llamadas.push(String(u)); return Promise.reject(new Error('sin servidor')); };
global.location = { protocol: 'https:' };
global.localStorage = { getItem: () => null, setItem() {} };
global.sessionStorage = { getItem: () => null, setItem() {} };
global.window = { innerWidth: 1600, innerHeight: 900, addEventListener() {}, removeEventListener() {}, open() {}, __SYO_DATA: DCOPIA };
global.document = { createElement: () => ({ click() {} }), addEventListener() {}, removeEventListener() {} };
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
global.Blob = class { constructor(p) { this.txt = p.join(''); } };
global.prompt = () => 'prueba';
class DCLogic { constructor() { this.props = {}; } setState(u) { const p = typeof u === 'function' ? u(this.state) : u; Object.assign(this.state, p); } }
const CCopia = new Function('DCLogic', lCopia + '; return Component;')(DCLogic);
const COrig = new Function('DCLogic', lOrig + '; return Component;')(DCLogic);
const cc = new CCopia(), co = new COrig();
const SIN_SERVIDOR = /En esta copia|Para comentar hay que abrir|Sin servidor local|reglasOffline/;
const plano = (v) => JSON.stringify(v, (k, x) => (typeof x === 'function' ? 'fn' : x));
let vistas = 0, distintas = 0;
const comparar = (estado, donde) => {
  Object.assign(cc.state, estado); Object.assign(co.state, estado);
  let a, b;
  try { a = cc.renderVals(); } catch (e) { ok(false, `la copia se rompe en ${donde}: ${e.message}`); return; }
  try { b = co.renderVals(); } catch (e) { return; }
  vistas++;
  // 06/10: sin la clave reglasOffline (antes quedaba su nombre en el texto y SIN_SERVIDOR daba toda pantalla por buena) y sin el link a
  // Creatividades, que en la copia no va (la copia no puede abrir localhost)
  if ((a.vistas || []).some((x) => /Creatividades/.test(x.label))) ok(false, `la copia tiene el botón Creatividades: ${donde}`);
  if (b.isProyecto && !(b.vistas || []).some((x) => x.label === 'Creatividades ↗')) ok(false, `la app local no tiene el link a Creatividades: ${donde}`);
  const limpia = (v) => { const x = { ...v, vistas: (v.vistas || []).filter((y) => y.label !== 'Creatividades ↗') }; delete x.reglasOffline; return x; };
  const sa = plano(limpia(a)), sb = plano(limpia(b));
  if (sa !== sb && !SIN_SERVIDOR.test(sa)) { distintas++; if (distintas < 4) ok(false, `pantalla distinta de la app local: ${donde}`); }
};
for (const canal of ['Oficial', 'Informativo', 'General']) {
  comparar({ canal, screen: 'portada', pid: null }, `portada ${canal}`);
  for (const p of DCOPIA.proyectos) {
    const b = canal === 'General' ? p.general : p.canales[canal]; if (!b) continue;
    for (const tab of ['resumen', 'activos', 'ejes', 'campañas', 'audiencias', 'insights', 'looker']) {
      comparar({ screen: 'proyecto', pid: p.id, tab, period: Object.keys(b.periodos)[0], panel: tab === 'resumen', abierto: {}, busca: '', kpiSel: 'obj' }, `${p.nombre} ${canal} ${tab}`);
    }
    if (canal === 'General') continue;
    for (const id of Object.keys(b.campanas)) for (const rendPer of ['mes', 'hist']) comparar({ screen: 'campana', campId: id, campTab: 'Contenidos', panel: false, panelCamp: null, modal: null, rendPer }, `${p.nombre} ${canal} ${id} ${rendPer}`);
  }
}
ok(distintas === 0, `${distintas} pantallas distintas de la app local`);

// ---- 5) sin servidor ----
const p0 = DCOPIA.proyectos.find((p) => p.canales.Informativo && p.canales.Informativo.acciones.length);
let toast = null;
if (p0) {
  Object.assign(cc.state, { canal: 'Informativo', screen: 'proyecto', pid: p0.id, tab: 'resumen', panel: true, panelCamp: null, period: Object.keys(p0.canales.Informativo.periodos)[0] });
  cc.say = (m) => { toast = m; };
  const id = p0.canales.Informativo.acciones[0].id;
  try { cc.resolve(id, 'sent', ''); } catch (e) { ok(false, `"Enviar a PAUTADOR" se rompe en la copia: ${e.message}`); }
  ok(/En esta copia no se envían pedidos/.test(toast || ''), `"Enviar a PAUTADOR" no avisa que en la copia no se envían pedidos: "${toast}"`);
}
cc.cargarRespuestas && cc.cargarRespuestas();
ok(!llamadas.length, `la copia llamó al servidor: ${llamadas.join(', ')}`);

console.log(`archivos ${archivos.length} · ${(total / MB).toFixed(1)} MB · cargados por index.html: ${srcs.join(', ')} · pantallas comparadas con la app local ${vistas} · "Enviar a PAUTADOR": "${toast}"`);
console.log('problemas', problemas.length);
for (const p of problemas.slice(0, 20)) console.log(' -', p);
if (problemas.length) process.exitCode = 1;
