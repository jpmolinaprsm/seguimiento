// Copia estática de la app para publicarla como página privada en claude.ai (pedido del 02/10: dos compañeros la recorren y comentan).
// Uso: node publicar.js   (después de node armar.js). Lee "Seguimiento y Optimizacion.html" y escribe en publicar/:
//   index.html     la app sin los datos (el armado del diseño, la lógica y los recursos embebidos)
//   datos-1.js …   los datos, repartidos por proyecto en archivos de menos de 16 MB, que se cargan con <script> antes de abrir la app
// No toca la app local ni la salida de armar.js. Límites de la plataforma: index.html y cada archivo hasta 16 MB, todo hasta 64 MB.
// Sin servidor: lo que hoy va a servir.js (repositorio de respuestas y comentarios a las reglas) no se manda; la app lo dice en simple y
// guarda en este navegador (localStorage) lo que ya guardaba ahí. Arriba, una franja chica: "Tablero de optimización · Copia para comentarios · datos al DD/MM".
const fs = require('fs');
const path = require('path');

const ENTRADA = path.join(__dirname, 'Seguimiento y Optimizacion.html');
const SALIDA = path.join(__dirname, 'publicar');
const MB = 1024 * 1024, TOPE_ARCHIVO = 15.5 * MB, TOPE_TOTAL = 63 * MB;
const PROYECTOS_POR_ARCHIVO_MAX = 11 * MB;   // se juntan proyectos hasta ~11 MB por archivo (holgura contra el tope de 16 MB)

const html = fs.readFileSync(ENTRADA, 'utf8');
const mT = html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/);
if (!mT) throw new Error('No encontré el template en el HTML armado: corré node armar.js');
let template = JSON.parse(mT[1]);

// ---- los datos: fuera del template ----
const mL = template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
const logica = mL[1];
const iD = logica.indexOf('const DATA = '), fD = logica.indexOf(';\n', iD);
if (iD < 0 || fD < 0) throw new Error('No encontré "const DATA = " en la lógica');
const DATA = JSON.parse(logica.slice(iD + 'const DATA = '.length, fD));
let nueva = logica.slice(0, iD) + 'const DATA = window.__SYO_DATA;' + logica.slice(fD + 1);

// ---- sin servidor: textos y llamadas ----
const cambios = [
  // no hay servidor: nada va a /api/… (el repositorio de respuestas y los comentarios a las reglas)
  [/const enLinea = \(\) => [^\n]*;/, 'const enLinea = () => false;   // copia para comentarios: sin servidor'],
  // Creatividades (06/10): la copia no puede abrir su plataforma local (localhost:4340): el botón no va
  ["const CREA_LINK = 'http://localhost:4340';", "const CREA_LINK = '';   // copia publicada: sin el link a Creatividades"],
  ["this.say('Sin servidor local: abrí la app por http://localhost:4330 para comentar')", "this.say('En esta copia no se envían comentarios: usá «Comentar esta pantalla» y «Exportar comentarios»')"],
  ["this.say(status === 'sent' ? 'Enviada a PAUTADOR'", "this.say(status === 'sent' ? 'En esta copia no se envían pedidos: quedó marcada solo en este navegador'"],
];
for (const [a, b] of cambios) {
  const antes = nueva;
  nueva = typeof a === 'string' ? nueva.split(a).join(b) : nueva.replace(a, b);
  if (nueva === antes) throw new Error(`No encontré en la lógica: ${String(a).slice(0, 80)}`);
}
template = template.replace(mL[1], () => nueva);
const textoOffline = 'Para comentar hay que abrir la app desde el servidor local (http://localhost:4330): abierta con doble clic, los comentarios no se guardan.';
if (!template.includes(textoOffline)) throw new Error('No encontré el aviso de comentarios sin servidor en el markup');
template = template.split(textoOffline).join('En esta copia los comentarios a las reglas no se envían. Usá «Comentar esta pantalla» y «Exportar comentarios».');

// ---- repartir los proyectos en archivos ----
const base = { ...DATA, proyectos: [] };
const grupos = [];
let actual = [], tam = 0;
for (const p of DATA.proyectos) {
  const t = Buffer.byteLength(JSON.stringify(p));
  if (actual.length && tam + t > PROYECTOS_POR_ARCHIVO_MAX) { grupos.push(actual); actual = []; tam = 0; }
  actual.push(p); tam += t;
}
if (actual.length) grupos.push(actual);

fs.rmSync(SALIDA, { recursive: true, force: true });
fs.mkdirSync(SALIDA, { recursive: true });
const archivos = [];
grupos.forEach((g, i) => {
  const nombre = `datos-${i + 1}.js`;
  const txt = `// Tablero de optimización · datos de ${g.map((p) => p.nombre).join(', ')}\nwindow.__SYO_DATA.proyectos.push(...${JSON.stringify(g)});\n`;
  fs.writeFileSync(path.join(SALIDA, nombre), txt);
  archivos.push(nombre);
});

// ---- index.html: el HTML armado, con los datos afuera, la carga de los archivos y la franja ----
const dmy = (iso) => `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}`;
const franja = `Tablero de optimización · Copia para comentarios · datos al ${dmy(DATA.datosHasta)}`;
const cabeza = `<script>window.__SYO_DATA = ${JSON.stringify(base).replace(/<\//g, '<\\/')};</script>\n`
  + archivos.map((a) => `<script src="${a}"></script>`).join('\n') + '\n'
  // la franja: el armado del diseño reemplaza la página entera al abrir, así que se agrega (y se repone) después
  + `<script>(function(){var t=${JSON.stringify(franja)},n=0;var iv=setInterval(function(){n++;if(n>120)clearInterval(iv);var b=document.body;if(!b||document.getElementById('syo-copia'))return;`
  + `if(!document.querySelector('x-dc'))return;var d=document.createElement('div');d.id='syo-copia';d.textContent=t;`
  + `d.style.cssText='position:relative;z-index:100000;background:#F4F4F4;color:#3C3C3C;border-bottom:1px solid #E4E4E4;font:500 11.5px/1.6 Poppins,-apple-system,BlinkMacSystemFont,sans-serif;text-align:center;padding:2px 12px';`
  + `b.insertBefore(d,b.firstChild);},500);})();</script>\n`;
let salida = html.replace(mT[0], () => `<script type="__bundler/template">${JSON.stringify(template).replace(/<\//g, '<\\/')}</script>`);
salida = salida.replace('</head>', () => cabeza + '</head>');
fs.writeFileSync(path.join(SALIDA, 'index.html'), salida);

// ---- control de tamaños ----
let total = 0, mal = 0;
for (const f of ['index.html', ...archivos]) {
  const t = fs.statSync(path.join(SALIDA, f)).size; total += t;
  if (t > TOPE_ARCHIVO) { mal++; console.log(`DEMASIADO GRANDE: ${f}`); }
  console.log(`${f.padEnd(12)} ${(t / MB).toFixed(1).padStart(5)} MB`);
}
console.log(`total        ${(total / MB).toFixed(1).padStart(5)} MB · ${franja}`);
if (total > TOPE_TOTAL) { mal++; console.log('EL TOTAL PASA EL TOPE DE 64 MB'); }
if (mal) process.exitCode = 1;
