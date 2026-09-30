// Prueba del alcance real de Meta en la app (regla A3), con filas de mentira EN MEMORIA.
// Arma la app entera (armar.js) sin escribir nada: no toca _proyectos.json, ni la salida, ni el repositorio. Le agrega a los datos
// ya cargados filas de meta_alcance_diario y meta_alcance_corridas inventadas (como las escribe PAUTADOR) y revisa lo que muestra
// la tarjeta de alcance de la campaña en tres casos: con dato exacto, cliente con varias cuentas (rango) y sin dato de hoy.
// Uso: node pruebas/alcance-meta.js   (desde Seguimiento/app/; tarda lo mismo que armar.js). Termina en "problemas 0".
const fs = require('fs');
const path = require('path');
const B = require('../../borrador/armar.js');
const NX = require('../../nexo/alcance.js');

const problemas = [];
const ok = (cond, txt) => { if (!cond) problemas.push(txt); };

// ---------- elegir campañas reales para colgar las filas de mentira ----------
const RE_COD = /^[A-Z0-9]{14}$/;
const elegibles = [];
for (const P of B.DATA.proyectos) for (const [canal, b] of Object.entries(P.canales)) {
  const camps = (b.campanas || []).filter((c) => (c.contenidos || []).some((x) => RE_COD.test(String(x.k || '').toUpperCase())));
  if (camps.length >= 2) elegibles.push({ P, canal, camps });
}
if (elegibles.length < 3) { console.log('no hay tres proyectos con campañas y contenidos para probar'); process.exit(1); }
const [A, R, S] = elegibles;  // A: con dato exacto · R: cliente con varias cuentas (rango) · S: sin dato de hoy (una cuenta falló)
const cA = A.camps[0], cA2 = A.camps[1], cR = R.camps[0], cS = S.camps[0];
const contA = cA.contenidos.find((x) => RE_COD.test(String(x.k).toUpperCase()));

const { fecha: hoy } = NX.enArgentina(new Date());
const ayer = new Date(new Date(hoy + 'T12:00:00Z').getTime() - 864e5).toISOString().slice(0, 10);
const desde = { desde_inicio: '2026-06-01', ultimos_7: new Date(new Date(ayer + 'T12:00:00Z').getTime() - 6 * 864e5).toISOString().slice(0, 10),
  ultimos_30: new Date(new Date(ayer + 'T12:00:00Z').getTime() - 29 * 864e5).toISOString().slice(0, 10), mes_en_curso: ayer.slice(0, 8) + '01' };
const base = (nivel, periodo, canal, cliente, cuentas) => ({ fecha_lectura: hoy, leido_en: hoy + 'T09:10:00Z', canal, nivel, periodo, fecha_desde: desde[periodo], fecha_hasta: ayer,
  cliente, cuenta_id: cuentas.length === 1 ? cuentas[0] : null, cuentas: cuentas.join(','), n_cuentas: cuentas.length, gasto: 100000 });
const exacta = (nivel, periodo, canal, cliente, cuenta, alcance, impresiones, extra = {}) => ({ ...base(nivel, periodo, canal, cliente, [cuenta]), exacto: true, alcance, alcance_min: alcance, alcance_max: alcance,
  impresiones, frecuencia: Math.round(impresiones / alcance * 1e4) / 1e4, frecuencia_min: Math.round(impresiones / alcance * 1e4) / 1e4, frecuencia_max: Math.round(impresiones / alcance * 1e4) / 1e4, ...extra });
const rango = (nivel, periodo, canal, cliente, cuentas, min, max, impresiones, extra = {}) => ({ ...base(nivel, periodo, canal, cliente, cuentas), exacto: false, alcance: null, alcance_min: min, alcance_max: max,
  impresiones, frecuencia: null, frecuencia_min: Math.round(impresiones / max * 1e4) / 1e4, frecuencia_max: Math.round(impresiones / min * 1e4) / 1e4, ...extra });

const cliA = A.P.cliente, cliR = R.P.cliente, cliS = S.P.cliente;
const filas = [
  // A: una sola cuenta → exacto
  exacta('cliente', 'mes_en_curso', A.canal, cliA, 'act_111', 300000, 900000),
  exacta('cliente', 'ultimos_7', A.canal, cliA, 'act_111', 150000, 400000),
  exacta('cliente', 'ultimos_30', A.canal, cliA, 'act_111', 320000, 1000000),
  exacta('comunicacion', 'desde_inicio', A.canal, cliA, 'act_111', 120000, 384000, { comunicacion: cA.id }),
  exacta('comunicacion', 'ultimos_7', A.canal, cliA, 'act_111', 45000, 81000, { comunicacion: cA.id }),
  exacta('comunicacion', 'ultimos_30', A.canal, cliA, 'act_111', 100000, 250000, { comunicacion: cA.id }),
  exacta('contenido', 'desde_inicio', A.canal, cliA, 'act_111', 60000, 150000, { codigo: String(contA.k).toUpperCase(), comunicacion: cA.id }),
  exacta('contenido', 'ultimos_7', A.canal, cliA, 'act_111', 20000, 30000, { codigo: String(contA.k).toUpperCase(), comunicacion: cA.id }),
  // R: dos cuentas → rango (la cuenta más grande … la suma)
  rango('cliente', 'mes_en_curso', R.canal, cliR, ['act_221', 'act_222'], 200000, 350000, 1400000),
  rango('cliente', 'ultimos_7', R.canal, cliR, ['act_221', 'act_222'], 90000, 150000, 450000),
  rango('cliente', 'ultimos_30', R.canal, cliR, ['act_221', 'act_222'], 210000, 360000, 1500000),
  rango('comunicacion', 'desde_inicio', R.canal, cliR, ['act_221', 'act_222'], 90000, 150000, 450000, { comunicacion: cR.id }),
  // S: una de sus cuentas dio error → PAUTADOR no escribe cliente ni comunicación; si viniera una fila igual, el Nexo la descarta
  exacta('comunicacion', 'desde_inicio', S.canal, cliS, 'act_331', 50000, 100000, { comunicacion: cS.id }),
];
const corridas = [
  { fecha_lectura: hoy, cuenta_id: 'act_111', canal: A.canal, cliente: cliA, estado: 'ok' },
  { fecha_lectura: hoy, cuenta_id: 'act_221', canal: R.canal, cliente: cliR, estado: 'ok' },
  { fecha_lectura: hoy, cuenta_id: 'act_222', canal: R.canal, cliente: cliR, estado: 'ok' },
  { fecha_lectura: hoy, cuenta_id: 'act_331', canal: S.canal, cliente: cliS, estado: 'ok' },
  { fecha_lectura: hoy, cuenta_id: 'act_332', canal: S.canal, cliente: cliS, estado: 'error', motivo: 'prueba' },
];
// se agregan a los datos ya cargados en memoria (el archivo no se toca)
const disp = { disponible: true };
Object.assign(B.fuente, { alcanceFecha: hoy, alcanceMeta: filas, alcanceCorridas: corridas,
  alcanceEstado: { Oficial: { alcanceMeta: disp, alcanceCorridas: disp }, Informativo: { alcanceMeta: disp, alcanceCorridas: disp } } });

// ---------- armar la app sin escribir nada ----------
const redaccion = require('../redaccion.js');
redaccion.guardarRepositorio = () => {};
const escribir = fs.writeFileSync, escritos = {};
fs.writeFileSync = (f, datos) => { escritos[path.resolve(String(f))] = String(datos); };
const log = console.log; console.log = () => {};
try { require('../armar.js'); } finally { fs.writeFileSync = escribir; console.log = log; }
const html = escritos[path.resolve(path.join(__dirname, '..', 'Seguimiento y Optimizacion.html'))];
ok(!!html, 'armar.js no generó la app');
ok(Object.keys(escritos).length === 1, `armar.js intentó escribir otros archivos: ${Object.keys(escritos).join(', ')}`);

// ---------- correr la lógica de la app sobre lo armado ----------
const template = JSON.parse(html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
const logic = template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
global.localStorage = { getItem: () => null, setItem() {} };
global.window = { innerWidth: 1400, innerHeight: 900, addEventListener() {}, removeEventListener() {}, open() {} };
global.document = { createElement: () => ({ click() {} }) };
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
global.Blob = class { constructor(p) { this.txt = p.join(''); } };
class DCLogic { constructor() { this.props = {}; } setState(u) { const p = typeof u === 'function' ? u(this.state) : u; Object.assign(this.state, p); } }
const Component = new Function('DCLogic', logic + '; return Component;')(DCLogic);
const D = new Function(logic.match(/const DATA = [\s\S]*?;\n/)[0] + '; return DATA;')();
const comp = new Component();
const bloque = (E) => D.proyectos.find((p) => p.id === E.P.id).canales[E.canal];
const tarjeta = (E, campId) => {
  Object.assign(comp.state, { canal: E.canal, screen: 'campana', pid: E.P.id, tab: 'resumen', period: Object.keys(bloque(E).periodos)[0], abierto: {}, busca: '', campId, campTab: 'Contenidos', panel: false, panelCamp: null, modal: null });
  return comp.renderVals().cTiles.find((t) => t.alcM);
};

ok(D.alcanceMeta && D.alcanceMeta.estado === 'parcial' && D.alcanceMeta.fecha === hoy, `estado general esperado "parcial" de hoy: ${JSON.stringify(D.alcanceMeta)}`);

// A · con dato exacto
{
  const t = tarjeta(A, cA.id);
  ok(t && t.label === 'Personas alcanzadas (Meta)', `A: etiqueta ${t && t.label}`);
  ok(t && t.val === '120 K', `A: valor ${t && t.val}`);
  ok(t && t.delta === 'Llegó a 120.000 personas desde que empezó, que la vieron 3,2 veces en promedio.', `A: frase ${t && t.delta}`);
  ok(t && t.small.startsWith('Últimos 7 días: 45.000 personas, 1,8 veces cada una.') && t.small.includes(`Dato de Meta leído el ${hoy.slice(8, 10)}/${hoy.slice(5, 7)}`), `A: renglón chico ${t && t.small}`);
  const b = bloque(A);
  ok(b.alcM && b.alcM.ultimos_7 && b.alcM.ultimos_7.ex === true && b.alcM.ultimos_7.a === 150000 && Math.abs(b.alcM.ultimos_7.f - 2.6667) < 1e-3, `A: cliente 7 días ${JSON.stringify(b.alcM)}`);
  const cont = b.campanas[cA.id].contenidos.find((x) => x.cod === contA.k);
  ok(cont && cont.alcM && cont.alcM.desde_inicio.a === 60000 && cont.alcM.ultimos_7.a === 20000, `A: contenido ${JSON.stringify(cont && cont.alcM)}`);
  const otro = b.campanas[cA2.id].contenidos.find((x) => x.cod !== contA.k);
  ok(!otro || (otro.alcM && otro.alcM.desde_inicio.sin), 'A: un contenido sin filas tiene que decir sin dato');
  const t2 = tarjeta(A, cA2.id);
  ok(t2 && t2.delta.startsWith('Sin dato de hoy: no hay dato de hoy para esto'), `A: campaña sin filas ${t2 && t2.delta}`);
  log('A con dato   ·', t.label, '·', t.val, '·', t.delta, '·', t.small);
  log('A sin filas  ·', t2.label, '·', t2.val, '·', t2.delta, '·', t2.small);
}
// R · cliente con varias cuentas: rango
{
  const b = bloque(R);
  ok(b.alcM.mes_en_curso.ex === false && b.alcM.mes_en_curso.amin === 200000 && b.alcM.mes_en_curso.amax === 350000 && b.alcM.mes_en_curso.a == null, `R: cliente mes ${JSON.stringify(b.alcM.mes_en_curso)}`);
  const t = tarjeta(R, cR.id);
  ok(t && t.label === 'Personas alcanzadas (Meta, varias cuentas)', `R: etiqueta ${t && t.label}`);
  ok(t && t.val === '90 K a 150 K', `R: valor ${t && t.val}`);
  ok(t && t.delta === 'Llegó a entre 90.000 y 150.000 personas desde que empezó (varias cuentas: puede contar de más), que la vieron entre 3,0 y 5,0 veces en promedio.', `R: frase ${t && t.delta}`);
  log('R rango      ·', t.label, '·', t.val, '·', t.delta, '·', t.small);
}
// S · sin dato de hoy (le falta una cuenta al cliente)
{
  const b = bloque(S);
  for (const p of ['mes_en_curso', 'ultimos_7', 'ultimos_30']) ok(b.alcM[p] && /^Falta la lectura de hoy de una de sus cuentas \(act_332\)/.test(b.alcM[p].sin || ''), `S: cliente ${p} ${JSON.stringify(b.alcM[p])}`);
  const t = tarjeta(S, cS.id);
  ok(t && t.delta.startsWith('Sin dato de hoy: falta la lectura de hoy de una de sus cuentas (act_332)'), `S: frase ${t && t.delta}`);
  ok(t && (t.label === 'Alcance diario acumulado (aproximado)' ? /^Aproximado, sumado desde BigQuery/.test(t.small) : t.label === 'Alcance' && t.val === '—'), `S: aproximado ${t && t.label} · ${t && t.small}`);
  log('S sin dato   ·', t.label, '·', t.val, '·', t.delta, '·', t.small);
}
// y nada roto en ninguna tarjeta de alcance de ninguna campaña
for (const p of D.proyectos) for (const [canal, b] of Object.entries(p.canales)) for (const id of Object.keys(b.campanas)) {
  const t = tarjeta({ P: p, canal }, id);
  if (!t) { ok(false, `sin tarjeta de alcance: ${p.nombre} ${canal} ${id}`); continue; }
  for (const k of ['label', 'val', 'delta', 'small']) ok(typeof t[k] === 'string' && !/NaN|undefined|null/.test(t[k]), `texto roto ${k}="${t[k]}" ${p.nombre} ${canal} ${id}`);
}

log('problemas', problemas.length);
for (const p of problemas.slice(0, 30)) log(' -', p);
if (problemas.length) process.exitCode = 1;
