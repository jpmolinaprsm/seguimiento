// Prueba del alcance real de Meta en la app (regla A3), con filas de mentira EN MEMORIA.
// Arma la app entera (armar.js) sin escribir nada: no toca _proyectos.json, ni la salida, ni el repositorio. Le agrega a los datos
// ya cargados filas de meta_alcance_diario y meta_alcance_corridas inventadas (como las escribe PAUTADOR) y revisa lo que muestra
// la tarjeta "Personas alcanzadas" y el CPM de Alcance en estos casos: una cuenta (dato exacto), varias cuentas (una línea por cuenta,
// sin total), varias cuentas sin dato por cuenta todavía, sin dato de hoy, y la General de una campaña que corre en los dos canales.
// Regla de Juan Pablo del 02/10: el alcance NUNCA se suma (ni entre días, ni entre anuncios, ni entre cuentas o canales). La prueba
// falla si aparece cualquier rango, suma o alcance "acumulado", en los datos o en pantalla.
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
const [A, R, S] = elegibles;  // A: una cuenta · R: varias cuentas (por cuenta y sin dato por cuenta) · S: sin dato de hoy (una cuenta falló)
const cA = A.camps[0], cA2 = A.camps[1], cR = R.camps[0], cR2 = R.camps[1], cS = S.camps[0];
const contA = cA.contenidos.find((x) => RE_COD.test(String(x.k).toUpperCase()));
// G: una campaña con Meta en los dos canales en los últimos 7 días, de un cliente distinto de A, R y S (para la General)
const desde7 = new Date(new Date(B.datosHasta + 'T12:00:00Z').getTime() - 6 * 864e5).toISOString().slice(0, 10);
const enCanales = {};
for (const r of B.fuente.todas || []) {
  if (r.plataforma !== 'META' || r.fecha < desde7 || r.fecha > B.datosHasta || !(Number(r.gasto) > 0)) continue;
  (enCanales[`${r.cliente}|${r.comunic}`] = enCanales[`${r.cliente}|${r.comunic}`] || new Set()).add(r.canal);
}
const usados = new Set([A.P.cliente, R.P.cliente, S.P.cliente]);
const parG = Object.entries(enCanales).filter(([k, s]) => s.has('Oficial') && s.has('Informativo') && B.DATA.proyectos.some((p) => p.cliente === k.split('|')[0]))
  .map(([k]) => k.split('|')).sort((x, y) => Number(usados.has(x[0])) - Number(usados.has(y[0])));
const [cliG, comG] = parG[0] || [];
const [, comG2] = parG.find(([cl, cm]) => cl === cliG && cm !== comG) || [];

const { fecha: hoy } = NX.enArgentina(new Date());
const ayer = new Date(new Date(hoy + 'T12:00:00Z').getTime() - 864e5).toISOString().slice(0, 10);
const desde = { desde_inicio: '2026-06-01', ultimos_7: new Date(new Date(ayer + 'T12:00:00Z').getTime() - 6 * 864e5).toISOString().slice(0, 10),
  ultimos_30: new Date(new Date(ayer + 'T12:00:00Z').getTime() - 29 * 864e5).toISOString().slice(0, 10), mes_en_curso: ayer.slice(0, 8) + '01' };
// filas como las escribe PAUTADOR (el formato de la tabla todavía trae mínimo y máximo: los usa el Nexo, nunca la app)
const base = (nivel, periodo, canal, cliente, cuentas, activo) => ({ fecha_lectura: hoy, leido_en: hoy + 'T09:10:00Z', canal, nivel, periodo, fecha_desde: desde[periodo], fecha_hasta: ayer,
  cliente, cuenta_id: cuentas.length === 1 ? cuentas[0] : null, activo: cuentas.length === 1 ? activo || null : null, cuentas: cuentas.join(','), n_cuentas: cuentas.length });
const fr = (alcance, impresiones) => Math.round(impresiones / alcance * 1e4) / 1e4;
const exacta = (nivel, periodo, canal, cliente, cuenta, alcance, impresiones, extra = {}, activo = null, gasto = 100000) => ({ ...base(nivel, periodo, canal, cliente, [cuenta], activo), exacto: true,
  alcance, alcance_min: alcance, alcance_max: alcance, impresiones, frecuencia: fr(alcance, impresiones), frecuencia_min: fr(alcance, impresiones), frecuencia_max: fr(alcance, impresiones), gasto, ...extra });
const varias = (nivel, periodo, canal, cliente, cuentas, min, max, impresiones, extra = {}) => ({ ...base(nivel, periodo, canal, cliente, cuentas), exacto: false, alcance: null, alcance_min: min, alcance_max: max,
  impresiones, frecuencia: null, frecuencia_min: fr(max, impresiones), frecuencia_max: fr(min, impresiones), gasto: 200000, ...extra });

const cliA = A.P.cliente, cliR = R.P.cliente, cliS = S.P.cliente;
const GACETA = 'Gaceta Santafesina', CALLE = 'La Calle Hoy';
const filas = [
  // A: una sola cuenta → exacto
  exacta('cliente', 'mes_en_curso', A.canal, cliA, 'act_111', 300000, 900000, {}, 'Cuenta A'),
  exacta('cliente', 'ultimos_7', A.canal, cliA, 'act_111', 150000, 400000, {}, 'Cuenta A'),
  exacta('cliente', 'ultimos_30', A.canal, cliA, 'act_111', 320000, 1000000, {}, 'Cuenta A'),
  exacta('comunicacion', 'desde_inicio', A.canal, cliA, 'act_111', 120000, 384000, { comunicacion: cA.id }, 'Cuenta A'),
  exacta('comunicacion', 'ultimos_7', A.canal, cliA, 'act_111', 45000, 81000, { comunicacion: cA.id }, 'Cuenta A'),
  exacta('comunicacion', 'ultimos_30', A.canal, cliA, 'act_111', 100000, 250000, { comunicacion: cA.id }, 'Cuenta A'),
  exacta('contenido', 'desde_inicio', A.canal, cliA, 'act_111', 60000, 150000, { codigo: String(contA.k).toUpperCase(), comunicacion: cA.id }, 'Cuenta A'),
  exacta('contenido', 'ultimos_7', A.canal, cliA, 'act_111', 20000, 30000, { codigo: String(contA.k).toUpperCase(), comunicacion: cA.id }, 'Cuenta A'),
  // R: dos cuentas. El alcance de toda la cuenta (nivel cuenta) es enorme a propósito (777.000 y 555.000): no puede aparecer en ninguna
  // campaña, porque no es el alcance de la campaña
  exacta('cuenta', 'mes_en_curso', R.canal, cliR, 'act_221', 777000, 2000000, {}, GACETA),
  exacta('cuenta', 'mes_en_curso', R.canal, cliR, 'act_222', 555000, 1500000, {}, CALLE),
  exacta('cuenta', 'ultimos_7', R.canal, cliR, 'act_221', 777000, 2000000, {}, GACETA),
  exacta('cuenta', 'ultimos_7', R.canal, cliR, 'act_222', 555000, 1500000, {}, CALLE),
  exacta('cuenta', 'ultimos_30', R.canal, cliR, 'act_221', 777000, 2000000, {}, GACETA),
  exacta('cuenta', 'ultimos_30', R.canal, cliR, 'act_222', 555000, 1500000, {}, CALLE),
  varias('cliente', 'mes_en_curso', R.canal, cliR, ['act_221', 'act_222'], 777000, 1332000, 3500000),
  // cR: en las dos cuentas, con el alcance dentro de cada una (desde el inicio y 7 días)
  varias('comunicacion', 'desde_inicio', R.canal, cliR, ['act_221', 'act_222'], 120000, 205000, 405000, { comunicacion: cR.id }),
  exacta('comunicacion_cuenta', 'desde_inicio', R.canal, cliR, 'act_221', 120000, 252000, { comunicacion: cR.id }, GACETA),
  exacta('comunicacion_cuenta', 'desde_inicio', R.canal, cliR, 'act_222', 85000, 153000, { comunicacion: cR.id }, CALLE),
  varias('comunicacion', 'ultimos_7', R.canal, cliR, ['act_221', 'act_222'], 45000, 75000, 135000, { comunicacion: cR.id }),
  exacta('comunicacion_cuenta', 'ultimos_7', R.canal, cliR, 'act_221', 45000, 90000, { comunicacion: cR.id }, GACETA, 90000),
  exacta('comunicacion_cuenta', 'ultimos_7', R.canal, cliR, 'act_222', 30000, 45000, { comunicacion: cR.id }, CALLE, 45000),
  // cR2: en las dos cuentas, con el dato dentro de una sola → sin dato por cuenta todavía (con la que sí tiene dato)
  varias('comunicacion', 'desde_inicio', R.canal, cliR, ['act_221', 'act_222'], 70000, 110000, 300000, { comunicacion: cR2.id }),
  exacta('comunicacion_cuenta', 'desde_inicio', R.canal, cliR, 'act_221', 70000, 140000, { comunicacion: cR2.id }, GACETA),
  varias('comunicacion', 'ultimos_7', R.canal, cliR, ['act_221', 'act_222'], 30000, 50000, 100000, { comunicacion: cR2.id }),
  // S: una de sus cuentas dio error → PAUTADOR no escribe cliente ni comunicación; si viniera una fila igual, el Nexo la descarta
  exacta('comunicacion', 'desde_inicio', S.canal, cliS, 'act_331', 50000, 100000, { comunicacion: cS.id }, 'Cuenta S'),
  // G: la misma campaña en Oficial y en Informativo, una cuenta en cada canal (7 días): en la General, un CPM por cuenta
  ...(comG ? [exacta('comunicacion', 'ultimos_7', 'Oficial', cliG, 'act_551', 40000, 80000, { comunicacion: comG }, 'Cuenta Oficial G', 80000),
    exacta('comunicacion', 'ultimos_7', 'Informativo', cliG, 'act_552', 25000, 50000, { comunicacion: comG }, 'Cuenta Informativo G', 25000)] : []),
  // G2: otra campaña en los dos canales con lectura solo en Oficial → en la General, sin dato por cuenta todavía
  ...(comG2 ? [exacta('comunicacion', 'ultimos_7', 'Oficial', cliG, 'act_551', 10000, 20000, { comunicacion: comG2 }, 'Cuenta Oficial G', 30000)] : []),
];
const corridas = [
  { fecha_lectura: hoy, cuenta_id: 'act_111', canal: A.canal, cliente: cliA, estado: 'ok' },
  { fecha_lectura: hoy, cuenta_id: 'act_221', canal: R.canal, cliente: cliR, estado: 'ok' },
  { fecha_lectura: hoy, cuenta_id: 'act_222', canal: R.canal, cliente: cliR, estado: 'ok' },
  { fecha_lectura: hoy, cuenta_id: 'act_331', canal: S.canal, cliente: cliS, estado: 'ok' },
  { fecha_lectura: hoy, cuenta_id: 'act_332', canal: S.canal, cliente: cliS, estado: 'error', motivo: 'prueba' },
  ...(comG ? [{ fecha_lectura: hoy, cuenta_id: 'act_551', canal: 'Oficial', cliente: cliG, estado: 'ok' }, { fecha_lectura: hoy, cuenta_id: 'act_552', canal: 'Informativo', cliente: cliG, estado: 'ok' }] : []),
];
// Cuentas donde corre cada campaña según el gasto de DataJunta (02/10): la app compara la lectura con las cuentas que gastaron en la
// ventana. Para que los casos de arriba sean de verdad "una cuenta" o "dos cuentas", el gasto de esas campañas pasa (en memoria) a las
// cuentas de mentira. Dos casos nuevos:
//   N (cA3): la lectura trae una cuenta, pero la campaña también gastó en los últimos 7 días en otra que no se lee → nunca se muestra el
//            dato de una cuenta como el de la campaña: "sin dato por cuenta todavía", con la cuenta que sí tiene dato
//   M (cA4): sin ninguna fila y con gasto en los últimos 30 días en una cuenta que no se lee → el motivo nombra esa cuenta
const renombrar = (canal, cliente, com, nombres) => { let i = 0;
  for (const r of B.fuente.diaria || []) if (r.canal === canal && r.cliente === cliente && r.comunic === com) r.activo = nombres[i++ % nombres.length];
  for (const r of B.fuente.cruce || []) if (r.canal === canal && r.cliente === cliente && r.comunic === com) r.activo = nombres[i++ % nombres.length]; };
renombrar(A.canal, cliA, cA.id, ['Cuenta A']);
renombrar(R.canal, cliR, cR.id, [GACETA, CALLE]);
renombrar(R.canal, cliR, cR2.id, [GACETA, CALLE]);
if (comG) { renombrar('Oficial', cliG, comG, ['Cuenta Oficial G']); renombrar('Informativo', cliG, comG, ['Cuenta Informativo G']); }
const cA3 = A.camps[2], cA4 = A.camps[3];
const gastoFalso = (com, activo) => B.fuente.diaria.push({ canal: A.canal, cliente: cliA, activo, comunic: com, fecha: ayer, gasto: '5000', imp: '1000', rea: '0' });
if (cA3) { renombrar(A.canal, cliA, cA3.id, ['Cuenta A']); gastoFalso(cA3.id, 'Cuenta sin leer');
  filas.push(exacta('comunicacion', 'ultimos_7', A.canal, cliA, 'act_111', 30000, 60000, { comunicacion: cA3.id }, 'Cuenta A'),
    exacta('comunicacion', 'desde_inicio', A.canal, cliA, 'act_111', 30000, 60000, { comunicacion: cA3.id }, 'Cuenta A')); }
if (cA4) { renombrar(A.canal, cliA, cA4.id, ['Cuenta A']); gastoFalso(cA4.id, 'Cuenta Z sin leer'); }
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
global.sessionStorage = { getItem: () => null, setItem() {} };
global.window = { innerWidth: 1400, innerHeight: 900, addEventListener() {}, removeEventListener() {}, open() {} };
global.document = { createElement: () => ({ click() {} }) };
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
global.Blob = class { constructor(p) { this.txt = p.join(''); } };
class DCLogic { constructor() { this.props = {}; } setState(u) { const p = typeof u === 'function' ? u(this.state) : u; Object.assign(this.state, p); } }
const Component = new Function('DCLogic', logic + '; return Component;')(DCLogic);
const D = new Function(logic.match(/const DATA = [\s\S]*?;\n/)[0] + '; return DATA;')();
const comp = new Component();
const bloque = (E) => D.proyectos.find((p) => p.id === E.P.id).canales[E.canal];
// rendPer (02/10): el panel tiene "Este mes" e "Histórica"; los casos de abajo son de "Histórica" (desde que empezó), salvo que se pida el mes
const tarjeta = (E, campId, rendPer = 'hist') => {
  Object.assign(comp.state, { canal: E.canal, screen: 'campana', pid: E.P.id, tab: 'resumen', period: Object.keys(bloque(E).periodos)[0], abierto: {}, busca: '', campId, campTab: 'Contenidos', panel: false, panelCamp: null, modal: null, rendPer });
  return comp.renderVals().cTiles.find((t) => t.alcM);
};
// 06/10: la lista de Campañas de Detalle va siempre según objetivo (sin selector), así que el CPM de Alcance de una campaña ya no se ve
// ahí. La celda se arma igual con la función de la app (la misma que usan Contenidos y Audiencias de cada campaña) sobre la fila de datos,
// y aparte se controla que la lista nunca muestre CPM de Alcance aunque esté elegido en el selector.
const { celdaKpi, KPI_COLS } = new Function('DCLogic', logic + '; return { celdaKpi, KPI_COLS };')(DCLogic);
const COL_CA = KPI_COLS.find((x) => x.k === 'ca');
const celdaCa = (E, per, id) => {
  const fila = ((E.canal === 'General' ? E.P.general : bloque(E)).periodos[per] || { campRows: [] }).campRows.find((x) => x.id === id || x.name === id);
  if (!fila) return null;
  Object.assign(comp.state, { canal: E.canal, screen: 'proyecto', paso: 'explora', pid: E.P.id, tab: 'campañas', period: per, kpiSel: 'ca', campFilter: 'Todas', abierto: {}, busca: '' });
  const r = comp.renderVals().campRows.find((x) => x.id === fila.id);
  ok(!r || (r.kpi && r.kpi.k !== 'ca'), `la lista de Campañas muestra CPM de Alcance (tiene que ir según objetivo): ${id}`);
  return celdaKpi(fila, COL_CA, '', E.P.nombre, false, null, null);
};
// el alcance nunca se suma: textos que delatan un rango, una suma o un alcance acumulado
const SUMA_ALC = /entre [\d.]+ y [\d.]+ personas|[\d.,]+ ?[KM]? a [\d.,]+ ?[KM]?( personas|$)|\$[\d.,]+ a \$|alcance (diario )?acumulado|acumulad[oa]s?[^.]{0,40}\balcance|\balcance[^.]{0,40}acumulad|puede contar de más|la suma de todas|frecuencia diaria/i;
const textos = (o) => (o == null ? [] : typeof o === 'string' ? [o] : Array.isArray(o) ? o.flatMap(textos) : typeof o === 'object' ? Object.entries(o).filter(([k]) => k !== 'alcM').flatMap(([, x]) => textos(x)) : []);
const sinSuma = (o, donde) => { for (const t of textos(o)) ok(!SUMA_ALC.test(t) && !/toda la cuenta/i.test(t), `${donde}: alcance sumado, en rango, acumulado o de toda la cuenta: "${t.slice(0, 120)}"`); };

ok(D.alcanceMeta && D.alcanceMeta.estado === 'parcial' && D.alcanceMeta.fecha === hoy, `estado general esperado "parcial" de hoy: ${JSON.stringify(D.alcanceMeta)}`);

// A · una cuenta: dato exacto
{
  const t = tarjeta(A, cA.id);
  // tarjeta chica (01/10): nombre, valor, una línea corta; la frase completa al pasar el mouse (title)
  ok(t && t.label === 'Personas alcanzadas', `A: etiqueta ${t && t.label}`);
  ok(t && t.val === '120 mil', `A: valor ${t && t.val}`);
  ok(t && t.lineas.length === 1 && t.lineas[0].txt === '3,2 veces por persona', `A: línea ${t && JSON.stringify(t.lineas)}`);
  ok(t && t.title.startsWith('Llegó a 120.000 personas desde que empezó, que la vieron 3,2 veces en promedio.') && t.title.includes('Últimos 7 días: 45.000 personas, 1,8 veces cada una.') && t.title.includes(`Dato de Meta leído el ${hoy.slice(8, 10)}/${hoy.slice(5, 7)}`), `A: frase al pasar el mouse ${t && t.title}`);
  sinSuma(t, 'A tarjeta');
  const b = bloque(A);
  ok(b.alcM && b.alcM.ultimos_7 && b.alcM.ultimos_7.a === 150000 && Math.abs(b.alcM.ultimos_7.f - 2.6667) < 1e-3 && !b.alcM.ultimos_7.pc, `A: cliente 7 días ${JSON.stringify(b.alcM)}`);
  const cont = b.campanas[cA.id].contenidos.find((x) => x.cod === contA.k);
  ok(cont && cont.alcM && cont.alcM.desde_inicio.a === 60000 && cont.alcM.ultimos_7.a === 20000, `A: contenido ${JSON.stringify(cont && cont.alcM)}`);
  const otro = b.campanas[cA2.id].contenidos.find((x) => x.cod !== contA.k);
  ok(!otro || (otro.alcM && otro.alcM.desde_inicio.sin), 'A: un contenido sin filas tiene que decir sin dato');
  const t2 = tarjeta(A, cA2.id);
  ok(t2 && t2.val === '—' && t2.lineas[0].txt === 'sin dato de Meta' && !/BigQuery|tabla|prendió/.test(t2.lineas[0].title), `A: campaña sin filas ${t2 && JSON.stringify(t2.lineas)}`);
  log('A una cuenta ·', t.label, '·', t.val, '·', t.lineas[0].txt, '·', t.title);
  // "Este mes": la lectura de Meta del período que corresponde al mes (desde que empezó si arrancó este mes; si no, 7 o 30 días), dicho en la línea
  const alcP = (b.campanas[cA.id].rp.mes.tiles.find((x) => x.alcR) || {}).alcP;
  const esp = { desde_inicio: ['120 mil', '3,2 veces por persona'], ultimos_7: ['45 mil', '1,8 veces · últ. 7 días'], ultimos_30: ['100 mil', '2,5 veces · últ. 30 días'] }[alcP];
  const tm = tarjeta(A, cA.id, 'mes');
  ok(esp && tm && tm.val === esp[0] && tm.lineas.length === 1 && tm.lineas[0].txt === esp[1], `A: Este mes (${alcP}) ${tm && tm.val} ${tm && JSON.stringify(tm.lineas)}`);
  sinSuma(tm, 'A tarjeta Este mes');
  log('A este mes   ·', alcP, '·', tm.val, '·', tm.lineas[0].txt);
  log('A sin filas  ·', t2.label, '·', t2.val, '·', t2.lineas[0].txt, '·', t2.lineas[0].title);
}
// R · varias cuentas: una línea por cuenta, de mayor a menor, sin total
{
  const b = bloque(R);
  const m = b.alcM.mes_en_curso;
  ok(m && Array.isArray(m.pc) && m.pc.length === 2 && m.pc[0].c === GACETA && m.pc[0].a === 777000 && m.pc[1].c === CALLE && m.pc[1].a === 555000 && !('a' in m), `R: cliente mes por cuenta ${JSON.stringify(m)}`);
  const t = tarjeta(R, cR.id);
  ok(t && t.label === 'Personas alcanzadas' && t.val === '2 cuentas', `R: valor ${t && t.val}`);
  const ls = t ? t.lineas.map((l) => l.txt) : [];
  ok(ls[0] === 'Gaceta Santafesina: 120.000 personas · 2,1 veces' && ls[1] === 'La Calle Hoy: 85.000 personas · 1,8 veces', `R: líneas por cuenta ${JSON.stringify(ls)}`);
  ok(ls[2] === 'Corre en 2 cuentas: Meta no junta a las personas entre cuentas, por eso no se suma.' && ls.length === 3, `R: nota de por qué no se suma ${JSON.stringify(ls)}`);
  ok(t && !/205\.000|205 mil/.test(t.val + t.title + ls.join()), 'R: aparece la suma de las dos cuentas (205.000)');
  ok(t && t.title.startsWith('Corre en 2 cuentas desde que empezó: Gaceta Santafesina llegó a 120.000 personas'), `R: frase ${t && t.title}`);
  ok(t && t.title.includes('Últimos 7 días, por cuenta: Gaceta Santafesina, 45.000 personas') && !/75\.000/.test(t.title), `R: 7 días por cuenta ${t && t.title}`);
  sinSuma(t, 'R tarjeta');
  log('R por cuenta ·', t.val, '·', ls.join(' | '), '·', t.title);
  // CPM de Alcance de 7 días: uno por cuenta (Gaceta $90.000 / 45.000 = $2.000; La Calle $45.000 / 30.000 = $1.500), nunca combinado
  const k = celdaCa(R, '7d', cR.id);
  if (k) {
    const cs = k.cs.map((l) => l.txt);
    ok(k.val === 'por cuenta' && k.linea === 'CPM de Alcance: por cuenta' && cs[0] === `${GACETA}: $2.000` && cs[1] === `${CALLE}: $1.500` && /^Corre en 2 cuentas/.test(cs[2] || '') && !k.hasP, `R: CPM de Alcance por cuenta ${JSON.stringify(k)}`);
    ok(!/\$1\.800|\$1\.778/.test(JSON.stringify(k)), 'R: aparece un CPM combinado de las dos cuentas');
    sinSuma(k, 'R CPM de Alcance');
    log('R CPM 7 días ·', k.linea, '·', cs.join(' | '));
  } else ok((bloque(R).periodos['7d'] || { campRows: [] }).campRows.every((r) => r.id !== cR.id), `R: la campaña ${cR.id} está en la lista de 7 días pero sin celda`);
  // cR2: sin dato por cuenta todavía, con la cuenta que sí tiene dato; nunca el alcance de toda la cuenta (777.000)
  const t2 = tarjeta(R, cR2.id), ls2 = t2 ? t2.lineas.map((l) => l.txt) : [];
  ok(t2 && t2.val === '—' && ls2[0] === 'sin dato por cuenta todavía' && ls2[1] === 'falta La Calle Hoy' && ls2[2] === 'Gaceta Santafesina: 70.000 personas · 2,0 veces' && ls2.length === 3, `R2: sin dato por cuenta ${JSON.stringify(ls2)}`);
  ok(t2 && /corre en 2 cuentas \(Gaceta Santafesina y La Calle Hoy\)/.test(t2.lineas[0].title) && /no se suma/.test(t2.lineas[0].title), `R2: motivo ${t2 && t2.lineas[0].title}`);
  ok(t2 && !/777|555/.test(t2.title + JSON.stringify(t2.lineas)), 'R2: aparece el alcance de toda la cuenta');
  const c2 = b.campanas[cR2.id].tiles.find((x) => x.alcM).alcM;
  ok(c2.desde_inicio.spc && c2.desde_inicio.cc.length === 1 && !JSON.stringify(c2).includes('777'), `R2: datos ${JSON.stringify(c2.desde_inicio)}`);
  ok(c2.ultimos_7.spc && c2.ultimos_7.cc.length === 0 && !JSON.stringify(c2.ultimos_7).includes('777'), `R2: 7 días sin la referencia de toda la cuenta ${JSON.stringify(c2.ultimos_7)}`);
  const k2 = celdaCa(R, '7d', cR2.id);
  if (k2) { ok(k2.val === 'sin dato por cuenta todavía' && !k2.hasP && !/777|555/.test(JSON.stringify(k2)), `R2: CPM de Alcance ${JSON.stringify(k2)}`); log('R2 CPM 7 días ·', k2.linea, '·', k2.title); }
  sinSuma(t2, 'R2 tarjeta');
  log('R2 sin dato por cuenta ·', t2.val, '·', ls2.join(' | '), '·', t2.lineas[0].title);
}
// S · sin dato de hoy (le falta una cuenta al cliente)
{
  const b = bloque(S);
  for (const p of ['mes_en_curso', 'ultimos_7', 'ultimos_30']) ok(b.alcM[p] && /^Falta la lectura de hoy de una de sus cuentas \(act_332\)/.test(b.alcM[p].sin || ''), `S: cliente ${p} ${JSON.stringify(b.alcM[p])}`);
  const t = tarjeta(S, cS.id);
  // sin dato (01/10): solo "—" y "sin dato de Meta"; el motivo al pasar el mouse, en lenguaje de usuario (sin códigos de cuenta ni tablas)
  ok(t && t.val === '—' && t.lineas[0].txt === 'sin dato de Meta' && t.lineas[0].title === 'Falta el alcance de hoy de una de las cuentas de la campaña en Meta.', `S: sin dato ${t && JSON.stringify(t.lineas)}`);
  log('S sin dato   ·', t.label, '·', t.val, '·', t.lineas[0].txt, '·', t.lineas[0].title);
}
// N y M · la campaña corre también en una cuenta que la lectura no trae (02/10)
if (!cA3 || !cA4) ok(false, `${A.P.nombre} ${A.canal} tiene menos de 4 campañas: no se pudieron probar las cuentas que no se leen`);
else {
  const n7 = bloque(A).campanas[cA3.id].tiles.find((x) => x.alcM).alcM.ultimos_7;
  ok(n7 && n7.spc && !('a' in n7) && n7.cc.length === 1 && n7.cc[0].c === 'Cuenta A' && n7.cc[0].a === 30000 && JSON.stringify(n7.nl) === '["Cuenta sin leer"]', `N: 7 días ${JSON.stringify(n7)}`);
  const t = tarjeta(A, cA3.id), ls = t ? t.lineas.map((l) => l.txt) : [];
  ok(t && t.val === '—' && ls[0] === 'sin dato por cuenta todavía' && ls[1] === 'falta Cuenta sin leer' && ls[2] === 'Cuenta A: 30.000 personas · 2,0 veces' && ls.length === 3, `N: tarjeta ${JSON.stringify(ls)} ${t && t.val}`);
  ok(t && /falta el alcance de Meta de Cuenta sin leer/.test(t.lineas[0].title) && /no se suma/.test(t.lineas[0].title), `N: motivo ${t && t.lineas[0].title}`);
  ok(t && !/30 mil|^30\.000/.test(t.val), 'N: el alcance de una cuenta aparece como el de la campaña');
  sinSuma(t, 'N tarjeta');
  log('N cuenta sin leer ·', t.val, '·', ls.join(' | '), '·', t.lineas[0].title);
  const m = bloque(A).campanas[cA4.id].tiles.find((x) => x.alcM).alcM;
  for (const p of ['ultimos_7', 'ultimos_30', 'desde_inicio']) ok(m[p] && m[p].sin === 'Todavía no se lee el alcance de Meta de Cuenta Z sin leer, donde corre esta campaña.', `M: ${p} ${JSON.stringify(m[p])}`);
  const t2 = tarjeta(A, cA4.id);
  ok(t2 && t2.val === '—' && t2.lineas[0].txt === 'sin dato de Meta' && (t2.lineas[1] || {}).txt === 'falta Cuenta Z sin leer' && t2.lineas[0].title === 'Todavía no se lee el alcance de Meta de Cuenta Z sin leer, donde corre esta campaña.', `M: tarjeta ${t2 && JSON.stringify(t2.lineas)}`);
  log('M sin filas, cuenta sin leer ·', t2.val, '·', t2.lineas[0].txt, '·', t2.lineas[0].title);
}
// CPM de Alcance de una cuenta en la lista de Campañas (01/10): gasto ÷ personas alcanzadas × 1.000 con la lectura de Meta de la misma
// ventana (A: 7 días 45.000 personas y 30 días 100.000, con $100.000 → $2.222 y $1.000)
{
  let vistos = 0;
  for (const [per, esperado] of [['7d', '$2.222'], ['30d', '$1.000']]) {
    const fila = (bloque(A).periodos[per] || { campRows: [] }).campRows.find((r) => r.id === cA.id);
    if (!fila) continue;
    const k = celdaCa(A, per, cA.id); vistos++;
    ok(k && k.val === esperado && k.hasP && k.p.txt === 'sin referencia todavía' && !k.hasS && !k.hasC, `A: CPM de Alcance ${per} ${k && JSON.stringify(k)}`);
    log(`A CPM de Alcance ${per} ·`, k.val, '·', k.p.txt, '·', k.title);
  }
  ok(vistos > 0, `A: la campaña ${cA.id} no está en la lista de 7 ni de 30 días: no se pudo probar el CPM de Alcance`);
  comp.state.kpiSel = 'obj';
}
// G · General (Oficial + Informativo): un CPM de Alcance por cuenta, nunca combinado entre canales
if (!comG) ok(false, 'no hay ninguna campaña con Meta en los dos canales en los últimos 7 días: no se pudo probar la General');
else {
  const P = D.proyectos.find((p) => p.cliente === cliG);
  const filaG = P.general && (P.general.periodos['7d'] || { campRows: [] }).campRows.find((r) => r.id === comG);
  ok(filaG && filaG.kc && filaG.kc.ca && Array.isArray(filaG.kc.ca.pc), `G: datos de la General ${JSON.stringify(filaG && filaG.kc && filaG.kc.ca)}`);
  if (filaG) {
    const ca = filaG.kc.ca;
    ok(ca.pc && ca.pc.length === 2 && ca.pc[0].c === 'Cuenta Oficial G' && ca.pc[0].v === 2000 && ca.pc[1].c === 'Cuenta Informativo G' && ca.pc[1].v === 1000, `G: un CPM por cuenta ${JSON.stringify(ca)}`);
    ok(!JSON.stringify(ca).includes('65000') && !JSON.stringify(ca).includes('1615'), 'G: aparece la suma de los dos canales');
    const r = { kpi: celdaCa({ P, canal: 'General' }, '7d', comG) }, cs = r.kpi ? r.kpi.cs.map((l) => l.txt) : [];
    ok(r && r.kpi.val === 'por cuenta' && cs[0] === 'Cuenta Oficial G: $2.000' && cs[1] === 'Cuenta Informativo G: $1.000' && /^Corre en 2 cuentas/.test(cs[2] || ''), `G: celda de la General ${JSON.stringify(r && r.kpi)}`);
    sinSuma(r && r.kpi, 'G CPM de Alcance');
    log('G General    ·', r && r.kpi.linea, '·', cs.join(' | '));
  }
  if (comG2) {
    const f2 = (P.general.periodos['7d'] || { campRows: [] }).campRows.find((r) => r.id === comG2);
    ok(f2 && f2.kc.ca.spc && f2.kc.ca.cc.length === 1 && f2.kc.ca.cc[0].c === 'Cuenta Oficial G', `G2: General con un solo canal leído ${JSON.stringify(f2 && f2.kc.ca)}`);
    const r2 = { kpi: celdaCa({ P, canal: 'General' }, '7d', comG2) };
    ok(r2 && r2.kpi.val === 'sin dato por cuenta todavía' && r2.kpi.cs.length === 1 && r2.kpi.cs[0].txt === 'Cuenta Oficial G: $3.000', `G2: celda ${JSON.stringify(r2 && r2.kpi)}`);
    log('G2 General   ·', r2 && r2.kpi.linea, '·', r2 && r2.kpi.cs.map((l) => l.txt).join(' | '), '·', r2 && r2.kpi.title);
  }
  comp.state.kpiSel = 'obj';
}
// y nada roto en ninguna tarjeta de alcance de ninguna campaña, sin sumas ni rangos
for (const p of D.proyectos) for (const [canal, b] of Object.entries(p.canales)) for (const id of Object.keys(b.campanas)) {
  const t = tarjeta({ P: p, canal }, id);
  if (!t) { ok(false, `sin tarjeta de alcance: ${p.nombre} ${canal} ${id}`); continue; }
  for (const k of ['label', 'val', 'title']) ok(typeof t[k] === 'string' && !/NaN|undefined|null/.test(t[k]), `texto roto ${k}="${t[k]}" ${p.nombre} ${canal} ${id}`);
  for (const l of t.lineas || []) ok(typeof l.txt === 'string' && l.txt && !/NaN|undefined|null|BigQuery|tabla|prendió/.test(l.txt + l.title), `línea rota "${l.txt}" ${p.nombre} ${canal} ${id}`);
  sinSuma(t, `tarjeta ${p.nombre} ${canal} ${id}`);
}
// en los datos: ninguna clave de rango, mínimo, máximo, "puede contar de más" ni alcance acumulado (alc), en ningún nivel
const CLAVES = new Set(['amin', 'amax', 'fmin', 'fmax', 'vmin', 'vmax', 'alcance_min', 'alcance_max', 'frecuencia_min', 'frecuencia_max', 'puede_contar_de_mas', 'alc', 'ex']);
let claves = 0;
const buscar = (v, prof) => { if (!v || typeof v !== 'object' || prof > 14) return; if (Array.isArray(v)) { for (const x of v) buscar(x, prof + 1); return; }
  for (const [k, x] of Object.entries(v)) { if (CLAVES.has(k)) { claves++; if (claves < 4) ok(false, `clave de rango o suma de alcance en los datos: ${k}`); } buscar(x, prof + 1); } };
buscar(D, 0);
ok(!claves, `claves de rango o suma de alcance en los datos: ${claves}`);

log('problemas', problemas.length);
for (const p of problemas.slice(0, 30)) log(' -', p);
if (problemas.length) process.exitCode = 1;
