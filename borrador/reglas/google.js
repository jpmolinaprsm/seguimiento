// Reglas de Google (YouTube, DV360, Display, Search). Dueño: especialista de Google.
// Todavía no hay reglas propias: en estas plataformas solo corren las generales (reglas/generales.js). El primer trabajo del
// especialista es escribirlas y documentarlas en Seguimiento/documentos/reglas-recomendador-v0.3.md.
// Datos disponibles por fila (borrador/_extraer.js, consulta "todas"): gasto, impresiones, clicks, reproducciones (YouTube y
// Display), retención al 25 y al 100 %, objetivo y red. DV360 trae solo impresiones y clicks. No hay reacciones.

function reglasGoogle(ctx) { // eslint-disable-line no-unused-vars
}

// ---------- Lo normal de CTR para Tráfico en Google (decisión de Juan Pablo L-3, 01/10) ----------
// Mismo criterio que las referencias de Meta (analisis-datajunta/19_bandas_metricas.py): un caso es un contenido en una red con
// 20 mil impresiones o más; lo normal es la mediana del CTR de los casos de la ventana (365 días).
// Mínimos (decisión G1 = B de Juan Pablo, 01/10): 6 casos para la referencia propia del proyecto y 12 para la de todos los
// proyectos. Si el proyecto no llega a 6, vale la de todos los proyectos para esa misma red y objetivo; si esa no llega a 12, no hay
// referencia. Display y YouTube quedan sin referencia mientras no lleguen (G2 = A): no se juntan redes para llegar al mínimo.
// Cada red por separado y nunca mezcladas: en Search el anuncio aparece cuando alguien busca algo y su CTR no se compara con el
// de Display, YouTube, DV360, Gmail ni Discover. Tráfico y Conversión también van separados (como en Meta).
// NO está conectada: la conecta Interfaz en app/armar.js.
const OBJ_GOOGLE = { 'Maximize clicks': 'Tráfico', TARGET_CPC: 'Tráfico', OUTCOME_TRAFFIC: 'Tráfico', Tráfico: 'Tráfico', Conversión: 'Conversión' };
const PLAT_GOOGLE = /^(Google Ads|Google Display & Video 360)$/;

const percentilG = (xs, q) => { const s = xs.slice().sort((a, b) => a - b); if (!s.length) return null; const p = (s.length - 1) * q, lo = Math.floor(p); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (p - lo); };
const r4 = (x) => Math.round(x * 1e4) / 1e4;

// filas: un arreglo con las de fuente.todas (canal, cliente, cod, contenido, plataforma, red, objetivo, fecha, imp, clk), las filas
//   T de app/armar.js (canal, cli, cod, plat, red, obj, f, i, c) o las del bloque de un año de Google que agrega Extracción en
//   _extraer.js (decisión G3). También se puede pasar el objeto fuente entero: se usa el bloque de un año si existe y, si no,
//   fuente.todas (ver filasCtrGoogle). Las filas de ese bloque pueden venir ya sumadas por contenido, sin fecha: en ese caso no se
//   recorta ventana (la ventana ya la puso la consulta). Las de Meta y las que no son Tráfico ni Conversión se ignoran.
// opciones: dias (365), minCasosProyecto (6), minCasosTodos (12), minImp (20000), hasta (fecha 'AAAA-MM-DD'; por defecto la última
//   fecha de las filas). minCasos, si viene, vale para los dos niveles (compatibilidad).
// Devuelve:
//   { proyecto: { 'canal|cliente|red|objetivo': banda }, todos: { 'red|objetivo': banda }, casos: { misma clave: n, de todo lo que
//     hay aunque no llegue al mínimo }, desde, hasta, minCasosProyecto, minCasosTodos, origen }
//   banda = { p25, p50, p75, n } con el CTR en % (p50 es "lo normal"). origen dice de qué bloque salieron las filas.
const BLOQUES_ANIO_GOOGLE = ['googleAnio', 'google365', 'googleCtr', 'google'];
function filasCtrGoogle(fuente) {
  if (!fuente || Array.isArray(fuente)) return { filas: fuente || [], origen: 'filas' };
  for (const k of BLOQUES_ANIO_GOOGLE) if (Array.isArray(fuente[k]) && fuente[k].length) return { filas: fuente[k], origen: k };
  return { filas: fuente.todas || [], origen: 'todas' };
}
function referenciasCtrGoogle(entrada, opciones = {}) {
  const { dias = 365, minImp = 20000 } = opciones;
  const minCasosProyecto = opciones.minCasosProyecto ?? opciones.minCasos ?? 6;
  const minCasosTodos = opciones.minCasosTodos ?? opciones.minCasos ?? 12;
  const { filas, origen } = filasCtrGoogle(entrada);
  const norm = [];
  for (const r of filas) {
    const plat = r.plataforma || r.plat;
    if (!PLAT_GOOGLE.test(plat || '')) continue;
    const obj = OBJ_GOOGLE[r.objetivo] || OBJ_GOOGLE[r.obj];
    if (!obj) continue;
    norm.push({ canal: r.canal, cli: r.cliente || r.cli, cont: r.cod || r.contenido || r.cont || '(sin contenido)', red: r.red, obj,
      f: r.fecha || r.f, i: Number(r.imp ?? r.impresiones ?? r.i) || 0, c: Number(r.clk ?? r.clicks ?? r.c) || 0 });
  }
  const hasta = opciones.hasta || norm.reduce((m, r) => (r.f > m ? r.f : m), '');
  const d = new Date(`${hasta}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - dias);
  const desde = hasta ? d.toISOString().slice(0, 10) : '';
  // un caso = contenido × red × objetivo dentro del proyecto, sumando la ventana
  const u = {};
  for (const r of norm) {
    if (r.f && (r.f < desde || r.f > hasta)) continue;
    const k = [r.canal, r.cli, r.red, r.obj, r.cont].join('|');
    const o = u[k] = u[k] || { canal: r.canal, cli: r.cli, red: r.red, obj: r.obj, i: 0, c: 0 };
    o.i += r.i; o.c += r.c;
  }
  const grupos = { P: {}, G: {} };
  for (const o of Object.values(u)) {
    if (o.i < minImp) continue;
    const ctr = o.c / o.i * 100;
    (grupos.P[`${o.canal}|${o.cli}|${o.red}|${o.obj}`] = grupos.P[`${o.canal}|${o.cli}|${o.red}|${o.obj}`] || []).push(ctr);
    (grupos.G[`${o.red}|${o.obj}`] = grupos.G[`${o.red}|${o.obj}`] || []).push(ctr);
  }
  const banda = (xs) => ({ p25: r4(percentilG(xs, 0.25)), p50: r4(percentilG(xs, 0.5)), p75: r4(percentilG(xs, 0.75)), n: xs.length });
  const out = { proyecto: {}, todos: {}, casos: {}, desde, hasta, minCasosProyecto, minCasosTodos, origen };
  for (const [nivel, dest, min] of [['P', 'proyecto', minCasosProyecto], ['G', 'todos', minCasosTodos]]) {
    for (const [k, xs] of Object.entries(grupos[nivel])) {
      out.casos[k] = xs.length;
      if (xs.length >= min) out[dest][k] = banda(xs);
    }
  }
  return out;
}

// Lo normal de CTR para una campaña (o una parte de ella) de Google en una red:
//   ctrNormalGoogle(refs, canal, cliente, red, objetivo) → { ctr, p25, p75, n, nivel: 'proyecto' | 'todos', red } o null.
// red es el nombre crudo de DataJunta ('Search Network', 'Display Network', 'YouTube', 'DV360', 'Gmail', 'Discover').
function ctrNormalGoogle(refs, canal, cliente, red, objetivo) {
  if (!refs) return null;
  const obj = OBJ_GOOGLE[objetivo] || objetivo;
  const p = refs.proyecto[`${canal}|${cliente}|${red}|${obj}`];
  if (p) return { ctr: p.p50, p25: p.p25, p75: p.p75, n: p.n, nivel: 'proyecto', red };
  const g = refs.todos[`${red}|${obj}`];
  if (g) return { ctr: g.p50, p25: g.p25, p75: g.p75, n: g.n, nivel: 'todos', red };
  return null;
}

// Frase para la tabla (propuesta; la conecta Interfaz en app/armar.js). ref = lo que devuelve ctrNormalGoogle.
//   proyecto: "vs. lo normal de Search en este gobierno (4,6 %)"
//   todos:    "vs. lo normal de Search en todos los gobiernos (4,6 %)"
//   sin ref:  "sin referencia: todavía hay pocos casos de Display para comparar"
const NOMBRE_RED_GOOGLE = { 'Search Network': 'Search', 'Display Network': 'Display', YouTube: 'YouTube', DV360: 'DV360', Gmail: 'Gmail', Discover: 'Discover' };
const pctG = (x) => `${(Math.round(x * 10) / 10).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
function fraseCtrGoogle(ref, red) {
  const nombre = NOMBRE_RED_GOOGLE[(ref && ref.red) || red] || (ref && ref.red) || red || 'esta red';
  if (!ref) return `sin referencia: todavía hay pocos casos de ${nombre} para comparar`;
  const donde = ref.nivel === 'proyecto' ? 'en este gobierno' : 'en todos los gobiernos';
  return `vs. lo normal de ${nombre} ${donde} (${pctG(ref.ctr)})`;
}

module.exports = reglasGoogle;
module.exports.referenciasCtrGoogle = referenciasCtrGoogle;
module.exports.ctrNormalGoogle = ctrNormalGoogle;
module.exports.filasCtrGoogle = filasCtrGoogle;
module.exports.fraseCtrGoogle = fraseCtrGoogle;
