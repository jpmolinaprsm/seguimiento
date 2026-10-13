// Arma "Seguimiento y Optimizacion.html" (diseño curado en Claude Design) con datos reales.
//   1. Reusa los cálculos del borrador (../borrador/armar.js: campañas, acciones, luz propia, eficacia, plataformas, presupuesto).
//   2. Suma lo que el diseño necesita: períodos (meses y 7/30/90 días) para Campañas · Publicaciones · Ejes · Audiencias,
//      todas las plataformas (chips, KPI por plataforma y referencias propias de cada una), conjuntos de anuncios en las acciones
//      (Problema → Solución · Afectado · Qué revisar) y links de las piezas.
//   3. Inyecta la lógica (logica.js) y los datos en el bundle del diseño (../Seguimiento y Optimizacion.html) sin tocar su markup,
//      salvo tres parches acordados: la tarjeta de acción, el encabezado de la campaña y la vista previa de pieza.
// Salida: Seguimiento/app/Seguimiento y Optimizacion.html (autocontenido, se abre con doble clic).
// Uso: node armar.js   (antes: node ../borrador/_extraer.js para refrescar los datos de BigQuery)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const B = require('../borrador/armar.js');
const LOGOS = require('./logos.js');
const redaccion = require('./redaccion.js');
const GOOGLE = require('../borrador/reglas/google.js');

const { DATA, fuente, BG, BP, valor, candG, candP, eficaciaPor, efi, luz, r2, percentil, dias, voz, formato, nombreCont, objetivo, num, M, Mk, fmtCosto, vx, corto,
  hashId, dmy, MESES_TXT, RED_NOMBRE, OBJ_PLAT, AUTOMATIZADOS, TERMINAN, datosHasta, MES, plataformasPor, INFLACION_MES } = B;

const DISENO = path.join(__dirname, '..', 'Seguimiento y Optimizacion.html');
const SALIDA = path.join(__dirname, 'Seguimiento y Optimizacion.html');

// ---------- plataformas ----------
const CODIGO = { facebook: 'FB', instagram: 'IG', threads: 'TH', whatsapp: 'WA', 'Tik Tok': 'TT', DV360: 'DV', YouTube: 'YT', 'Display Network': 'GG', 'Search Network': 'GG', Gmail: 'GG', Discover: 'GG', SMS: 'SMS' };
const NOMBRE_COD = { FB: 'Facebook', IG: 'Instagram', TH: 'Threads', WA: 'WhatsApp', TT: 'TikTok', DV: 'DV360', YT: 'YouTube', GG: 'Google', SMS: 'SMS' };
const codigoRed = (red) => CODIGO[red] || 'OT';
const COD_NOMBRE = Object.fromEntries(Object.entries(NOMBRE_COD).map(([k, v]) => [v, k]));
Object.assign(COD_NOMBRE, { 'Google Display': 'GG', 'Google Search': 'GG', Gmail: 'GG', 'Google Discover': 'GG' });
const codPlac = (p) => (/^Instagram/i.test(p || '') ? 'IG' : /Threads/i.test(p || '') ? 'TH' : /Status|WhatsApp/i.test(p || '') ? 'WA' : 'FB');
const esMeta = (r) => (r.plat || r.plataforma) === 'META';
const objTodas = (r) => (esMeta(r) ? objetivo(r.objetivo) : OBJ_PLAT[r.objetivo] || r.objetivo);
// métrica con la que se compra cada objetivo
const METRICA = { Alcance: 'CPM', Interacción: 'Costo por reacción', Tráfico: 'Costo por click', Reproducciones: 'Costo por reproducción', Conversión: 'Costo por click' };
const resultadoDe = (o, r) => (o === 'Interacción' ? r.r : o === 'Tráfico' || o === 'Conversión' ? r.c : o === 'Reproducciones' ? r.vw : r.i / 1000);
const metricaTxt = (o, g, res) => (res ? (o === 'Alcance' ? 'CPM ' : '') + fmtCosto(g / res) + (o === 'Reproducciones' ? ' por reproducción' : o === 'Tráfico' || o === 'Conversión' ? ' por click' : o === 'Interacción' ? ' por reacción' : '') : '—');

// filas de todas las plataformas (180 días, por día) con el gasto ESPERADO al costo normal (xg = general, pg = proyecto)
const T = fuente.todas.map((r) => ({
  canal: r.canal, cli: r.cliente, com: r.comunic, cod: r.cod || r.contenido, cont: r.contenido || r.cod, plat: r.plataforma, red: r.red, code: codigoRed(r.red),
  obj: objTodas(r), fmt: formato(r.formato_raw, r.contenido), eje: r.eje, f: r.fecha, voz: voz(r.activo), link: r.link || null, lyt: r.link_yt || null,
  g: num(r.gasto), i: num(r.imp), r: num(r.rea), c: num(r.clk), vw: num(r.vw), v25: num(r.v25), v100: num(r.v100), e: num(r.eng), sh: num(r.sha), co: num(r.com),
}));
// referencias propias de cada plataforma (fuera de Meta): p25/p50/p75 del costo por resultado, por plataforma × objetivo; General y por proyecto (mínimo 12)
const bandasPlat = { G: {}, P: {} };
(() => {
  const u = {};
  for (const r of T) {
    if (esMeta(r)) continue;
    const k = [r.canal, r.cli, r.com, r.cod, r.plat, r.red, r.obj].join('|');
    const o = u[k] = u[k] || { cli: r.cli, canal: r.canal, plat: r.plat, obj: r.obj, g: 0, i: 0, r: 0, c: 0, vw: 0 };
    o.g += r.g; o.i += r.i; o.r += r.r; o.c += r.c; o.vw += r.vw;
  }
  const grupos = { G: {}, P: {} };
  for (const o of Object.values(u)) {
    if (o.i < 20000) continue;
    const res = resultadoDe(o.obj, o);
    if (!res) continue;
    const v = o.g / res;
    (grupos.G[`${o.plat}|${o.obj}`] = grupos.G[`${o.plat}|${o.obj}`] || []).push(v);
    (grupos.P[`${o.cli}|${o.canal}|${o.plat}|${o.obj}`] = grupos.P[`${o.cli}|${o.canal}|${o.plat}|${o.obj}`] || []).push(v);
  }
  for (const [k, xs] of Object.entries(grupos.G)) if (xs.length >= 12) bandasPlat.G[k] = [0.25, 0.5, 0.75].map((q) => percentil(xs, q));
  for (const [k, xs] of Object.entries(grupos.P)) if (xs.length >= 12) bandasPlat.P[k] = [0.25, 0.5, 0.75].map((q) => percentil(xs, q));
})();
const METRICA_BANDA = { Alcance: 'CPM', Interacción: 'costo_reac', Tráfico: 'CPC', Conversión: 'CPC' };
for (const r of T) {
  const res = resultadoDe(r.obj, r);
  let g50 = null, p50 = null;
  if (esMeta(r)) {
    const met = METRICA_BANDA[r.obj];
    if (met) { g50 = valor(candG(r.obj, r.fmt, null), met); p50 = valor(candP(r.cli, r.canal, r.obj, r.fmt), met); }
    const tr = valor(candG(r.obj, r.fmt, null), 'tasa_reac');
    r.xr = tr && r.i ? r.i * tr / 100 : 0;
    // Tráfico y Conversión se miden por CTR (decisión de Juan Pablo del 01/10): clicks esperados al CTR normal del proyecto (pc), con las
    // impresiones (pi) y los clicks (pcc) de las filas que tienen esa referencia. Igual que el borrador: cada fila con la referencia de su
    // objetivo y formato. Solo Meta: el resto de plataformas no tiene referencia de CTR
    { const ctrP = valor(candP(r.cli, r.canal, r.obj, r.fmt), 'CTR'); if (ctrP && r.i) { r.pc = r.i * ctrP / 100; r.pi = r.i; r.pcc = r.c; } }
    if (r.obj === 'Alcance') { r.xg = g50 && r.i ? r.i * g50 / 1000 : 0; r.pg = p50 && r.i ? r.i * p50 / 1000 : 0; continue; }
  } else {
    g50 = (bandasPlat.G[`${r.plat}|${r.obj}`] || [])[1] || null;
    p50 = (bandasPlat.P[`${r.cli}|${r.canal}|${r.plat}|${r.obj}`] || [])[1] || null;
  }
  r.xg = g50 && res ? res * g50 : 0;
  r.pg = p50 && res ? res * p50 : 0;
}
// ---------- lista de Campañas: una columna por KPI (decisión de Juan Pablo del 01/10) ----------
// Costo por reacción · CPM · CTR · ETR Videos · ETR Imágenes · CPM de Alcance. Cada celda: el valor de la campaña en el período y
// dos comparaciones con su valor de referencia: lo normal del proyecto y la misma campaña (semanas anteriores o temporada pasada).
// Referencia del proyecto: las bandas por proyecto × canal × objetivo × formato (borrador, BP), fila por fila, así sale de la mezcla de
// formatos de la campaña (mismo criterio que "pagó $X más que lo habitual"). ETR: solo la banda de ese mismo formato.
const r4 = (x) => (x == null || !isFinite(x) ? null : Math.round(x * 1e4) / 1e4);
const FMT_SEM = (f) => (f === 'Video' || f === 'Placa Fija' || f === 'Carrusel' ? f : '(otro)');
// cada KPI: numerador / denominador × k; fmts = solo esos formatos (ETR: videos por un lado, placas y carruseles por el otro);
// bp = qué banda del proyecto usa; costo = más alto es peor (y se ajusta por inflación contra la temporada pasada)
const KPI5 = {
  cr: { num: 'g', den: 'r', k: 1, bp: 'cr', costo: true },
  cpm: { num: 'g', den: 'i', k: 1000, bp: 'cpm', costo: true },
  ctr: { num: 'c', den: 'i', k: 100, bp: 'ctr' },
  etrV: { num: 'e', den: 'i', k: 100, bp: 'etr', fmts: ['Video'] },
  etrI: { num: 'e', den: 'i', k: 100, bp: 'etr', fmts: ['Placa Fija', 'Carrusel'] },
};
for (const r of T) {
  if (!esMeta(r)) continue;
  const cands = candP(r.cli, r.canal, r.obj, r.fmt);
  r.bp = { cr: valor(cands, 'costo_reac'), cpm: valor(cands, 'CPM'), ctr: valor(cands, 'CTR'), etr: valor([BP[`${r.cli}|${r.canal}|${r.obj}|${r.fmt}`]], 'ETR') };
}
// Costo por reproducción (01/10): gasto ÷ reproducciones, en todas las plataformas que registran reproducciones (videos de Meta,
// YouTube, TikTok…), solo con las filas que tienen reproducciones. Referencia del proyecto con el mismo criterio que las referencias
// propias de cada plataforma (bandasPlat): mediana del costo por reproducción de cada pieza (20.000 impresiones o más) por proyecto ×
// canal × plataforma × objetivo, con 12 casos o más; cada fila con la de su plataforma y objetivo, ponderada por sus reproducciones
const KCV = { num: 'g', den: 'vw', k: 1, bp: 'cv', costo: true };
const bandaCV = {};
(() => {
  const u = {};
  for (const r of T) {
    if (!(r.vw > 0)) continue;
    const k = [r.canal, r.cli, r.com, r.cod, r.plat, r.red, r.obj].join('|');
    const o = u[k] = u[k] || { cli: r.cli, canal: r.canal, plat: r.plat, obj: r.obj, g: 0, i: 0, vw: 0 };
    o.g += r.g; o.i += r.i; o.vw += r.vw;
  }
  const grupos = {};
  for (const o of Object.values(u)) if (o.i >= 20000 && o.vw > 0) (grupos[`${o.cli}|${o.canal}|${o.plat}|${o.obj}`] = grupos[`${o.cli}|${o.canal}|${o.plat}|${o.obj}`] || []).push(o.g / o.vw);
  for (const [k, xs] of Object.entries(grupos)) if (xs.length >= 12) bandaCV[k] = percentil(xs, 0.5);
})();
for (const r of T) if (r.vw > 0) { const b = bandaCV[`${r.cli}|${r.canal}|${r.plat}|${r.obj}`]; if (b) r.bp = { ...(r.bp || {}), cv: b }; }
// Vistas que juntan (01/10): canal General (Oficial e Informativo del mismo proyecto) y "Todos los proyectos" de cada canal (Oficial,
// Informativo y General). Su "lo normal" es el del proyecto con los dos canales juntos (bpG), el de todos los proyectos del canal (bpT)
// o el de todos los proyectos con los dos canales juntos (bpTG). Las bandas de
// Costo por reacción, CPM, CTR y ETR vienen de Referencias (t6_bandas_proyecto, por proyecto × canal) y no existen juntando canales ni
// proyectos: quedan "sin referencia" hasta que Referencias las calcule. La de Costo por reproducción se arma acá con las filas, con el
// mismo criterio que bandaCV (mediana por pieza con 20.000 impresiones o más, 12 casos o más), juntando los dos canales o los proyectos.
const bandaCVG = {}, bandaCVT = {}; // bandaCVT: clave canal|plataforma|objetivo; canal = Oficial, Informativo o General (los dos)
(() => {
  const u = {};
  for (const r of T) {
    if (!(r.vw > 0)) continue;
    const k = [r.canal, r.cli, r.com, r.cod, r.plat, r.red, r.obj].join('|');
    const o = u[k] = u[k] || { cli: r.cli, canal: r.canal, plat: r.plat, obj: r.obj, g: 0, i: 0, vw: 0 };
    o.g += r.g; o.i += r.i; o.vw += r.vw;
  }
  const gG = {}, gT = {};
  for (const o of Object.values(u)) if (o.i >= 20000 && o.vw > 0) {
    (gG[`${o.cli}|${o.plat}|${o.obj}`] = gG[`${o.cli}|${o.plat}|${o.obj}`] || []).push(o.g / o.vw);
    (gT[`${o.canal}|${o.plat}|${o.obj}`] = gT[`${o.canal}|${o.plat}|${o.obj}`] || []).push(o.g / o.vw);
    (gT[`General|${o.plat}|${o.obj}`] = gT[`General|${o.plat}|${o.obj}`] || []).push(o.g / o.vw);
  }
  for (const [k, xs] of Object.entries(gG)) if (xs.length >= 12) bandaCVG[k] = percentil(xs, 0.5);
  for (const [k, xs] of Object.entries(gT)) if (xs.length >= 12) bandaCVT[k] = percentil(xs, 0.5);
})();
// Costo por reacción, CPM, CTR y ETR de las vistas que juntan (01/10): las mismas bandas de Referencias, calculadas con el mismo criterio
// (t6_bandas_juntas.csv: canal "General" = el proyecto con los dos canales; cliente "Todos" = los siete proyectos), con el mismo candP
const bandasDe = (cli, canal, r) => { const cands = candP(cli, canal, r.obj, r.fmt);
  return { cr: valor(cands, 'costo_reac'), cpm: valor(cands, 'CPM'), ctr: valor(cands, 'CTR'), etr: valor([BP[`${cli}|${canal}|${r.obj}|${r.fmt}`]], 'ETR') }; };
for (const r of T) {
  const m = esMeta(r);
  r.bpG = m ? bandasDe(r.cli, 'General', r) : {}; r.bpT = m ? bandasDe('Todos', r.canal, r) : {}; r.bpTG = m ? bandasDe('Todos', 'General', r) : {};
  if (!(r.vw > 0)) continue;
  const g = bandaCVG[`${r.cli}|${r.plat}|${r.obj}`], t = bandaCVT[`${r.canal}|${r.plat}|${r.obj}`], tg = bandaCVT[`General|${r.plat}|${r.obj}`];
  if (g) r.bpG.cv = g; if (t) r.bpT.cv = t; if (tg) r.bpTG.cv = tg;
}
// ---------- CTR de la parte de Google de una campaña de Tráfico (decisiones L-3, G1, G2 y G3 de Juan Pablo; encargo del 02/10) ----------
// Lo normal de CTR lo calcula Google (borrador/reglas/google.js): cada red por separado (Search nunca con Display ni con YouTube),
// 6 casos para el proyecto y 12 para todos los proyectos, con el bloque de un año de Google si la extracción lo trae (googleAnio) y si
// no con las filas de 180 días. "Todos los proyectos" es siempre el del mismo canal que la vista, como en Meta: en cada canal, los siete
// proyectos de ese canal; en la General de un proyecto (canal "General") y en el panel General, los dos canales juntos.
// La red sale de r.red (Search Network, Display Network, YouTube…), nunca del código GG, que junta Search, Display, Gmail y Discover.
const GG_FILAS = GOOGLE.filasCtrGoogle(fuente);
const REFGG = {
  Oficial: GOOGLE.referenciasCtrGoogle(GG_FILAS.filas.filter((r) => r.canal === 'Oficial'), { hasta: datosHasta }),
  Informativo: GOOGLE.referenciasCtrGoogle(GG_FILAS.filas.filter((r) => r.canal === 'Informativo'), { hasta: datosHasta }),
  General: GOOGLE.referenciasCtrGoogle(GG_FILAS.filas.map((r) => ({ ...r, canal: 'General' })), { hasta: datosHasta }),
};
const PLAT_GG = /^(Google Ads|Google Display & Video 360)$/, OBJ_TRAF_GG = new Set(['Tráfico', 'Maximize clicks', 'TARGET_CPC']);
// gg = una entrada por red de la parte de Google de Tráfico de la campaña en el período, de la que tiene más impresiones a la que menos:
//   { red (Search), redL (Google Search), v (CTR de esa parte), r (lo normal), n ('p' del proyecto, 't' de todos los proyectos), rT (lo
//   normal de todos los proyectos del canal, para el panel), u (1 = es toda la campaña: solo Google, una red, todo Tráfico) }
const ctrGoogleDe = (rs, canalRef, cli) => {
  const refs = REFGG[canalRef], m = {}; let iTot = 0;
  for (const r of rs) { iTot += r.i; if (PLAT_GG.test(r.plat || '') && OBJ_TRAF_GG.has(r.obj)) { const o = m[r.red] = m[r.red] || { i: 0, c: 0 }; o.i += r.i; o.c += r.c; } }
  const xs = Object.entries(m).filter(([, o]) => o.i > 0).sort((a, b) => b[1].i - a[1].i);
  if (!xs.length) return null;
  return xs.map(([red, o]) => {
    const ref = GOOGLE.ctrNormalGoogle(refs, canalRef, cli, red, 'Tráfico'), t = refs.todos[`${red}|Tráfico`], redL = RED_NOMBRE[red] || red;
    return { red: redL.replace(/^Google /, ''), redL, v: r4(o.c / o.i * 100), ...(ref ? { r: r4(ref.ctr), n: ref.nivel === 'proyecto' ? 'p' : 't' } : {}), ...(t ? { rT: r4(t.p50) } : {}),
      ...(xs.length === 1 && o.i >= iTot ? { u: 1 } : {}) };
  });
};
// filas del cruce mensual del borrador (Meta, pieza × audiencia × placement): la misma banda del proyecto que las filas por día de Meta,
// para la columna de KPI de Contenidos y Audiencias de cada campaña (01/10). Se agrega r.bp a cada fila (el borrador no lo usa)
for (const r of B.filas) {
  const cands = candP(r.cli, r.canal, r.obj, r.fmt), cv = r.vw > 0 ? bandaCV[`${r.cli}|${r.canal}|META|${r.obj}`] : null;
  r.bp = { cr: valor(cands, 'costo_reac'), cpm: valor(cands, 'CPM'), ctr: valor(cands, 'CTR'), etr: valor([BP[`${r.cli}|${r.canal}|${r.obj}|${r.fmt}`]], 'ETR'), ...(cv ? { cv } : {}) };
}
// historia por día de cada comunicación en todas las plataformas (para el costo por reproducción contra sus semanas anteriores)
const lunesDe = (f) => { const d = new Date(f + 'T00:00:00Z'), w = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - w); return d.toISOString().slice(0, 10); };
const TCOM = {};
for (const r of T) if (r.vw > 0) (TCOM[`${r.canal}|${r.cli}|${r.com}`] = TCOM[`${r.canal}|${r.cli}|${r.com}`] || []).push({ s: lunesDe(r.f), k: `${r.plat}|${r.obj}|${r.fmt}`, g: r.g, vw: r.vw });
const porPlat = (rows) => rows.reduce((m, r) => { const o = m[r.k] = m[r.k] || { g: 0, vw: 0 }; o.g += r.g; o.vw += r.vw; return m; }, {});
// historia semanal de cada comunicación (Meta), con engagement, para comparar contra la misma campaña formato por formato
const SEMK = {};
for (const r of fuente.semanal || []) (SEMK[`${r.canal}|${r.cliente}|${r.comunic}`] = SEMK[`${r.canal}|${r.cliente}|${r.comunic}`] || [])
  .push({ s: r.semana, obj: objetivo(r.objetivo), fmt: FMT_SEM(r.fmt), g: num(r.gasto), i: num(r.imp), r: num(r.rea), c: num(r.clk), e: num(r.eng), sh: num(r.sha) });
const porFmt = (rows) => rows.reduce((m, r) => { const f = FMT_SEM(r.fmt), o = m[f] = m[f] || { g: 0, i: 0, r: 0, c: 0, e: 0 }; o.g += r.g; o.i += r.i; o.r += r.r; o.c += r.c; o.e += r.e; return m; }, {});
// contra lo normal del proyecto: cada fila de Meta con la banda de su objetivo y formato, ponderada por su denominador
// campo = qué banda de la fila se usa: bp (proyecto × canal), bpG (proyecto con los dos canales), bpT (todos los proyectos del canal),
// bpTG (todos los proyectos con los dos canales)
const contraProyecto = (meta, def, campo = 'bp') => { let n = 0, d = 0, nr = 0;
  for (const r of meta) { if (def.fmts && !def.fmts.includes(r.fmt)) continue; const b = r[campo] && r[campo][def.bp]; if (!b || !r[def.den]) continue; n += r[def.num]; d += r[def.den]; nr += r[def.den] * b; }
  return d && nr ? { d, r: r4(nr / d) } : null; };
// contra la misma campaña: formato por formato (cada formato del período con el valor que tuvo ese formato en la referencia)
const contraFmt = (cur, ref, def, infl) => { let n = 0, d = 0, nr = 0;
  for (const [f, a] of Object.entries(cur)) { if (def.fmts && !def.fmts.includes(f.split('|').pop())) continue; const b = ref[f]; if (!b || !b[def.den] || !b[def.num] || !a[def.den]) continue; n += a[def.num]; d += a[def.den]; nr += a[def.den] * b[def.num] / b[def.den]; }
  return d && nr ? { d, r: r4(nr / d * def.k * (def.costo ? infl : 1)) } : null; };
const valorDe = (rows, def) => { let n = 0, d = 0; for (const r of rows) { if (def.fmts && !def.fmts.includes(r.fmt)) continue; n += r[def.num]; d += r[def.den]; } return { v: d ? r4(n / d * def.k) : null, d }; };
// la referencia vale para el valor de la celda si cubre al menos el 80 % de su denominador (impresiones o reacciones): si no, se dice
// "sin referencia" (por ejemplo, formatos sin historia). Así el porcentaje es siempre valor de la celda contra referencia.
const COBERTURA_REF = 0.8;
// "Esta temporada" contra la temporada pasada (pedido de Juan Pablo del 02/10): el número grande es toda esta temporada, y se compara
// con la misma cantidad de semanas desde el inicio de la temporada pasada (si la pasada fue más corta, con toda la pasada). Así el
// valor y su comparación hablan de lo mismo. Objetivo por objetivo y formato por formato (una temporada puede mezclar Alcance e
// Interacción); los costos de la pasada, llevados a hoy con la inflación de cada objetivo. Si por formato la pasada no cubre el 80 %
// del denominador (muchas temporadas viejas tienen el formato sin identificar), se compara solo objetivo por objetivo (nivel 'o');
// si tampoco cubre (objetivos nuevos), sin comparación. cur = filas del cruce de esta temporada (las del número grande).
const KPI_TEMP = { cr: KPI5.cr, cpm: KPI5.cpm, ctr: KPI5.ctr, treac: { num: 'r', den: 'i', k: 100 }, tcomp: { num: 'sh', den: 'i', k: 100 } };
const porObjFmt = (rows, clave) => rows.reduce((m, r) => { const f = clave(r), o = m[f] = m[f] || { g: 0, i: 0, r: 0, c: 0, sh: 0, vw: 0 }; o.g += r.g; o.i += r.i || 0; o.r += r.r || 0; o.c += r.c || 0; o.sh += r.sh || 0; o.vw += r.vw || 0; return m; }, {});
function contraTemporada(pr, crT, curV, semk, tcom) {
  if (!pr || !pr.previa || !pr.inicio) return null;
  const n = Math.round((new Date(lunesDe(datosHasta)) - new Date(lunesDe(pr.inicio))) / (7 * 864e5)) + 1;
  const tope = addDias(pr.previa.desde, 7 * n - 1), hasta = tope < pr.previa.hasta ? tope : pr.previa.hasta;
  const enPas = (w) => w.s >= pr.previa.desde && w.s <= hasta;
  const pas = semk.filter(enPas), semPas = new Set(pas.map((w) => w.s)).size;
  const meses = dias(pr.previa.desde, pr.inicio) / 30.4, infl = (obj) => Math.pow(1 + (INFLACION_MES[obj] || 0), meses);
  const info = { n: semPas, d: pr.previa.desde, toda: hasta === pr.previa.hasta };
  const compara1 = (c, ref, def, objDe) => { let d = 0, nr = 0, tot = 0;
    for (const [f, a] of Object.entries(c)) { tot += a[def.den]; const b = ref[f]; if (!b || !b[def.den] || !b[def.num] || !a[def.den]) continue; d += a[def.den]; nr += a[def.den] * b[def.num] / b[def.den] * (def.costo ? infl(objDe(f)) : 1); }
    return d && nr && d >= tot * COBERTURA_REF ? r4(nr / d * def.k) : null; };
  const compara = (niveles, def, objDe) => { for (const [nivel, c, ref] of niveles) { const r = compara1(c, ref, def, objDe); if (r != null) return { r, nivel, ...info }; } return { sin: 1, ...info }; };
  const porF = (r) => `${r.obj}|${FMT_SEM(r.fmt)}`, porO = (r) => r.obj, obj0 = (f) => f.split('|')[0];
  // la mezcla de objetivos y formatos de esta temporada, de las semanas (agrupan por objetivo) y no del cruce, que toma el objetivo con
  // ANY_VALUE y lo cambia entre extracciones (05/10, Super Niño: $478 → $782). Igual que temporada() de marcas.js
  const semAct = semk.filter((w) => w.s >= lunesDe(pr.inicio) && w.s <= datosHasta), mezcla = semAct.length ? semAct : crT;
  const niveles = [['f', porObjFmt(mezcla, porF), porObjFmt(pas, porF)], ['o', porObjFmt(mezcla, porO), porObjFmt(pas, porO)]];
  const out = Object.fromEntries(Object.entries(KPI_TEMP).map(([k, def]) => [k, compara(niveles, def, obj0)]));
  // costo por reproducción: todas las plataformas, plataforma × objetivo × formato (la historia diaria llega hasta 180 días atrás)
  out.cv = compara([['f', curV, porObjFmt(tcom.filter(enPas), (w) => w.k)]], KCV, (f) => f.split('|')[1]);
  return out;
}
// Contenidos y Audiencias de una campaña (01/10): la misma columna de KPI que la lista de Campañas, sobre las filas del cruce mensual
// (Meta, los meses que trae el borrador). Primera comparación: lo normal del proyecto (fila por fila, como en Campañas). Segunda: una
// pieza o una audiencia no tiene "semanas anteriores" propias; se compara contra toda la campaña en los mismos meses, objetivo por
// objetivo y formato por formato (¿esta pieza o esta audiencia rinde mejor o peor que el resto de la campaña?). Salida compacta: { v, p, s } con p y s = el
// valor de referencia (o sin la clave si no hay). Costo por reproducción: solo las filas con reproducciones.
// clave objetivo × formato: una campaña puede tener piezas en más de un objetivo y cada objetivo cuesta distinto
const porFmtV = (rows) => rows.reduce((m, r) => { const f = `${r.obj}|${FMT_SEM(r.fmt)}`, o = m[f] = m[f] || { g: 0, i: 0, r: 0, c: 0, e: 0, vw: 0 }; o.g += r.g; o.i += r.i; o.r += r.r; o.c += r.c; o.e += r.e; o.vw += r.vw || 0; return m; }, {});
const kpisFilas = (rows, todas) => {
  const kc = {};
  for (const [k, def] of [...Object.entries(KPI5), ['cv', KCV]]) {
    const xs = k === 'cv' ? rows.filter((r) => r.vw > 0) : rows, ts = k === 'cv' ? todas.filter((r) => r.vw > 0) : todas;
    const { v, d: den } = valorDe(xs, def), vale = (x) => (x && v != null && den && x.d >= den * COBERTURA_REF ? x.r : null);
    const p = vale(contraProyecto(xs, def)), s = vale(contraFmt(porFmtV(xs), porFmtV(ts), def, 1));
    kc[k] = { v, ...(p != null ? { p } : {}), ...(s != null ? { s } : {}) };
  }
  return kc;
};
const sumaT = (rs) => rs.reduce((o, r) => { for (const k of ['g', 'i', 'r', 'c', 'vw', 'v25', 'v100', 'e', 'sh', 'co', 'xg', 'pg', 'xr', 'pc', 'pi', 'pcc']) o[k] += r[k] || 0; return o; }, { g: 0, i: 0, r: 0, c: 0, vw: 0, v25: 0, v100: 0, e: 0, sh: 0, co: 0, xg: 0, pg: 0, xr: 0, pc: 0, pi: 0, pcc: 0 });
const idxDe = (o) => ({ g: o.xg && o.g ? r2(o.xg / o.g) : null, p: o.pg && o.g ? r2(o.pg / o.g) : null });
const objDominante = (rs) => { const m = {}; for (const r of rs) m[r.obj] = (m[r.obj] || 0) + r.g; return Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Alcance'; };
// el logo (data URI) lo agrega la lógica al renderizar (DATA.logos), así no se repite en cada fila
const chip = (code) => ({ code, name: NOMBRE_COD[code] || code });
const plats = (rs) => { const m = {}; for (const r of rs) m[r.code] = (m[r.code] || 0) + r.g; return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([code]) => chip(code)); };
const kpiDe = (o, obj, rs) => {
  if (obj === 'Interacción') return { kpiL: 'Costo por reacción', kpi: o.r ? fmtCR(o.g / o.r) : '—' };
  if (obj === 'Tráfico' || obj === 'Conversión') return { kpiL: 'CTR', kpi: o.i ? (o.c / o.i * 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %' : '—' };
  if (obj === 'Reproducciones') return { kpiL: 'Costo por reproducción', kpi: o.vw ? fmtCosto(o.g / o.vw) : '—' };
  return { kpiL: 'CPM', kpi: o.i ? fmtCosto(o.g / o.i * 1000) : '—' };
};
// "Obras que Sí "Recorrida por el sur"" → "Recorrida por el sur" (el nombre del contenido repite la comunicación)
const limpio = (nombre, com) => { let n = String(nombre || '').trim(); if (com && n.toLowerCase().startsWith(String(com).toLowerCase())) n = n.slice(String(com).length).trim(); n = n.replace(/^[\s:·-]+/, '').replace(/^["“]+|["”]+$/g, '').trim(); return n || nombre; };
const fmtCR = (v) => (v == null || !isFinite(v) ? '—' : v >= 10 ? '$' + Math.round(v).toLocaleString('es-AR') : fmtCosto(v));
const fmtCorto = (f) => ({ 'Placa Fija': 'Placa', '(otro)': 'Otro', '(sin formato)': 'Sin formato' }[f] || f);

// links de cada pieza: Meta (FB / IG) desde el cruce, YouTube / TikTok desde todas
const piezas = {};
for (const r of B.filas) { const p = piezas[r.cod] = piezas[r.cod] || {}; if (r.lfb && !p.fb) p.fb = r.lfb; if (r.lig && !p.ig) p.ig = r.lig; }
for (const r of T) { const p = piezas[r.cod] = piezas[r.cod] || {}; if (r.lyt && !p.yt) p.yt = r.lyt; if (r.link && r.code === 'TT' && !p.tt) p.tt = r.link; if (r.link && !p.otro) p.otro = r.link; }
const piezaDe = (cod) => piezas[cod] || {};

// ---------- alcance real de Meta (regla A3): lo lee PAUTADOR cada mañana, lo baja Extracción, lo valida el Nexo ----------
// El alcance NUNCA se suma (regla de Juan Pablo del 02/10): ni entre días, ni entre anuncios, ni entre cuentas o canales. Si la campaña
// corre en varias cuentas, el alcance va de cada cuenta por separado.
// Por cliente (mes en curso, 7 y 30 días), campaña de la app = Comunicación (desde el inicio, 7 y 30) y contenido (desde el inicio y 7).
// Cada período, en el formato de la app:
//   { a, f, d, h, g }                    una sola cuenta: alcance, frecuencia, desde, hasta y gasto exactos
//   { pc: [{ c, a, f, d, h, g, cn }] }   varias cuentas: una entrada por cuenta (c = nombre, cn = canal), de mayor a menor; sin total
//   { sin, spc: true, ci, cc }           varias cuentas y Meta no informa todavía el alcance dentro de cada una: ci = las cuentas,
//                                        cc = las que sí tienen dato (lista por cuenta). Nunca la referencia de toda la cuenta
//   { sin }                              sin dato de hoy, con el motivo
const NEXO_ALC = require('../nexo/alcance.js');
const ALCM = NEXO_ALC.alcanceDeExtraccion(fuente);
const itemAlc = (x) => ({ c: x.cuenta, a: x.alcance, f: x.frecuencia, d: x.desde, h: x.hasta, g: x.gasto, cn: x.canal, ...(x.fecha_lectura ? { fl: String(x.fecha_lectura).slice(0, 10) } : {}) });
const lecturaAlc = (q, canal) => {
  if (q.estado === 'ok') { const d = q.dato; return { a: d.alcance, f: d.frecuencia, d: d.fecha_desde, h: d.fecha_hasta, g: d.gasto, cn: d.canal, c: d.activo || null, ...(d.fecha_lectura ? { fl: String(d.fecha_lectura).slice(0, 10) } : {}) }; }
  if (q.estado === 'por_cuenta') return { pc: q.cuentas.map(itemAlc) };
  if (q.estado === 'sin_dato_por_cuenta') return { sin: q.motivo, spc: true, ci: q.cuentas_involucradas, cc: q.cuentas_con_dato.map(itemAlc) };
  const cn = ALCM.canales && ALCM.canales[canal];
  return { sin: cn && !cn.disponible ? cn.motivo : q.motivo, ...(q.caso ? { caso: q.caso } : {}) };
};
// Cuentas donde corrió la campaña (o la pieza) en la ventana de la lectura, según el gasto de Meta de DataJunta (02/10). Si alguna no
// está en la lectura (PAUTADOR todavía no lee esa cuenta, o no trajo esa comunicación en ella), el dato de las otras no es el de la
// campaña: queda "sin dato por cuenta todavía" con las cuentas que sí tienen dato (nl = las que faltan). Nunca se muestra el alcance de
// una cuenta como si fuera el de toda la campaña. Los nombres se comparan sin mayúsculas, tildes ni espacios de más.
const normCta = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const GASTO_COM = {}, GASTO_COD = {};
for (const r of fuente.diaria || []) if (num(r.gasto) > 0) (GASTO_COM[`${r.canal}|${r.cliente}|${r.comunic}`] = GASTO_COM[`${r.canal}|${r.cliente}|${r.comunic}`] || []).push({ c: r.activo, d: r.fecha, h: r.fecha });
for (const r of fuente.cruce || []) { const cod = String(r.cod || r.contenido || '').toUpperCase(); if (cod && num(r.gasto) > 0) (GASTO_COD[`${r.canal}|${r.cliente}|${cod}`] = GASTO_COD[`${r.canal}|${r.cliente}|${cod}`] || []).push({ c: r.activo, d: r.desde, h: r.hasta }); }
const gastosAlc = (q) => {
  const cans = q.canal === 'Ambos' ? ['Oficial', 'Informativo'] : [q.canal];
  if (q.nivel === 'comunicacion') return cans.flatMap((c) => GASTO_COM[`${c}|${q.cliente}|${q.comunicacion}`] || []);
  if (q.nivel === 'contenido') return cans.flatMap((c) => GASTO_COD[`${c}|${q.cliente}|${String(q.codigo || '').toUpperCase()}`] || []);
  return null;
};
// cuentas que la lectura de hoy trae (por el nombre del activo en sus filas o en la equivalencia de activos de PAUTADOR)
const LEIDAS = new Set([...Object.values(ALCM.niveles || {}).flat().map((d) => normCta(d.activo)).filter(Boolean),
  ...(fuente.activosEquivalencia || []).filter((e) => ALCM.cuentas && Object.values(ALCM.cuentas).some((c) => c.activo_key === e.activo_key)).map((e) => normCta(e.activo))]);
// ventana de la lectura cuando no hay dato: hasta el día anterior a la lectura
const VENTANA_ALC = { ultimos_7: 6, ultimos_30: 29 };
const cuentasCompletas = (L, q) => {
  const gastos = gastosAlc(q);
  if (!gastos || !gastos.length || !ALCM.fecha) return L;
  const items = L.pc || (L.spc ? L.cc : null) || (!L.sin ? [L] : []);
  if (items.some((x) => !x.c)) return L;   // sin nombre de cuenta no se puede comparar
  const hasta = items.map((x) => x.h).filter(Boolean).sort().pop() || addDias(ALCM.fecha, -1);
  const desde = items.length ? items.map((x) => x.d).filter(Boolean).sort()[0] || '0000' : VENTANA_ALC[q.periodo] != null ? addDias(hasta, -VENTANA_ALC[q.periodo]) : '0000';
  const conDato = new Set([...items.map((x) => normCta(x.c)), ...(L.ci || []).map(normCta)]);
  const faltan = [...new Set(gastos.filter((x) => x.h >= desde && x.d <= hasta && !conDato.has(normCta(x.c))).map((x) => x.c))].sort((a, b) => a.localeCompare(b, 'es'));
  if (!faltan.length) return L;
  if (L.sin && !L.spc) {   // sin ninguna fila: se nombran solo las cuentas que hoy no se leen y donde gastó en los últimos 30 días
    // (PAUTADOR lee solo lo que tuvo gasto en los últimos 30 días: lo que terminó antes queda con el motivo del Nexo)
    const d30 = addDias(hasta, -29);
    const noLeidas = [...new Set(gastos.filter((x) => x.h >= d30 && x.d <= hasta && !LEIDAS.has(normCta(x.c))).map((x) => x.c))].sort((a, b) => a.localeCompare(b, 'es'));
    return noLeidas.length && L.caso === 'sin_fila' ? { sin: `Todavía no se lee el alcance de Meta de ${noLeidas.length > 1 ? noLeidas.slice(0, -1).join(', ') + ' y ' + noLeidas[noLeidas.length - 1] : noLeidas[0]}, donde corre esta campaña.`, nl: noLeidas } : L;
  }
  const ci = [...new Set([...(L.ci || []), ...items.map((x) => x.c), ...faltan])].sort((a, b) => a.localeCompare(b, 'es'));
  return { sin: `Sin dato por cuenta todavía: corre en ${ci.length} cuentas y falta el alcance de ${faltan.join(', ')}. El alcance no se suma entre cuentas.`, spc: true, ci, cc: items.map((x) => ({ c: x.c, a: x.a, f: x.f, d: x.d, h: x.h, g: x.g, cn: x.cn })), nl: faltan };
};
const leerAlc = (q) => cuentasCompletas(lecturaAlc(NEXO_ALC.datoDeHoy(ALCM, q), q.canal), q);
const alcMeta = (consulta, periodos) => Object.fromEntries(periodos.map((periodo) => [periodo, leerAlc({ ...consulta, periodo })]));

// ---------- períodos ----------
const addDias = (f, n) => new Date(new Date(f + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
const meses = [...new Set(T.map((r) => r.f.slice(0, 7)))].sort().reverse().slice(0, 4);
const PERIODOS = [
  ...meses.map((m) => ({ id: m, label: `${MESES_TXT[m.slice(5)][0].toUpperCase() + MESES_TXT[m.slice(5)].slice(1)} ${m.slice(0, 4)}` + (m === MES ? ' (en curso)' : ''), desde: m + '-01', hasta: m === MES ? datosHasta : m + '-31', txt: m === MES ? `${MESES_TXT[m.slice(5)][0].toUpperCase() + MESES_TXT[m.slice(5)].slice(1)} ${m.slice(0, 4)} · datos al ${dmy(datosHasta)}` : `${MESES_TXT[m.slice(5)][0].toUpperCase() + MESES_TXT[m.slice(5)].slice(1)} ${m.slice(0, 4)} · mes cerrado`, mes: true })),
  { id: '7d', label: 'Últimos 7 días', desde: addDias(datosHasta, -6), hasta: datosHasta }, { id: '30d', label: 'Últimos 30 días', desde: addDias(datosHasta, -29), hasta: datosHasta }, { id: '90d', label: 'Últimos 90 días', desde: addDias(datosHasta, -89), hasta: datosHasta },
].map((p) => ({ ...p, txt: p.txt || `${dmy(p.desde)} al ${dmy(p.hasta)}` }));

// ---------- eficacia (regla de Looker) filtrada por período ----------
const efiEn = (rs, per) => efi((rs || []).filter((r) => r.hasta >= per.desde && r.hasta <= per.hasta));
const efV = (e) => (e ? { p: e.pctGastoRojo, n: e.rojos, N: e.n, color: e.color, gr: e.gastoRojo, gt: e.pctGastoRojo ? Math.round(e.gastoRojo / e.pctGastoRojo * 100) : 0 } : null);

// ---------- solapan público (marca, sin recomendación; decisión de Juan Pablo del 30/09) ----------
// De los pares que detecta Meta (borrador/reglas/meta.js) pasan el total y los primeros SOLAPA_MAX por gasto de 14 días de los dos lados.
const SOLAPA_MAX = 3;
const solapanDe = (sol) => (sol && sol.length ? { n: sol.length, pares: sol.map((p) => ({ tipo: p.tipo, texto: p.texto, mismoContenido: !!p.mismoContenido, gasto14: (p.a.gasto14 || 0) + (p.b.gasto14 || 0) }))
  .sort((x, y) => y.gasto14 - x.gasto14).slice(0, SOLAPA_MAX) } : null);

// ---------- CPM de Alcance y celda de KPI (compartidos por la vista de cada canal y la General) ----------
// CPM de Alcance: gasto ÷ personas alcanzadas × 1.000, con la lectura de alcance de Meta de hoy (la que deja PAUTADOR y valida el Nexo).
// Solo cuando la ventana de la lectura coincide con el período: 7 días, 30 días, y el mes en curso si la campaña empezó este mes
// ("desde que empezó" = el mes). El gasto es el que trae la misma lectura de Meta. Varias cuentas: un CPM por cuenta, cada uno con
// el gasto y el alcance de esa cuenta; nunca uno combinado (el alcance no se suma entre cuentas).
// Devuelve { v, a, g, d, h } (una cuenta), { pc: [{ c, v, a, g, d, h }] } (por cuenta), { sin, spc, ci, cc: [{ c, v, a, g, d, h }] }
// (sin dato por cuenta todavía, con las cuentas que sí tienen dato) o { sin }.
const ALC_PER = { '7d': 'ultimos_7', '30d': 'ultimos_30', [MES]: 'desde_inicio' };
const ANTES_DEL_MES = 'la campaña empezó antes de este mes: el alcance de Meta está para los últimos 7 o 30 días';
const cpmCuenta = (x) => ({ c: x.c, v: x.g > 0 && x.a > 0 ? r4(x.g / x.a * 1000) : null, a: x.a, g: Math.round(x.g || 0), d: x.d, h: x.h });
// L = una lectura en el formato de la app (lecturaAlc); periodo = el de la lectura; canales = los canales donde la campaña tiene Meta en el
// período (General): cada uno tiene que tener al menos una cuenta en la lectura, si no, queda sin dato por cuenta con las que hay
const cpmDeLectura = (L, periodo, canales, sinTxt) => {
  if (L.sin && !L.spc) return { sin: L.sin };
  const items = L.pc || L.cc || [L];
  if (periodo === 'desde_inicio' && items.some((x) => x.d && x.d < MES + '-01')) return { sin: ANTES_DEL_MES };
  const faltan = (canales || []).filter((cn) => !items.some((x) => x.cn === cn));
  if (L.spc || faltan.length) {
    const cc = (L.spc ? L.cc : items).map((x) => ({ ...x, c: x.c || 'Cuenta sin nombre' }));
    return { sin: L.sin || `la campaña también corre en ${faltan.join(' y ')} y Meta todavía no informa el alcance de esas cuentas`, spc: true,
      ci: L.ci || cc.map((x) => x.c), ...(faltan.length ? { fc: faltan } : {}), ...(L.nl ? { nl: L.nl } : {}), cc: cc.map(cpmCuenta) };
  }
  if (L.pc) return { pc: L.pc.map(cpmCuenta) };
  if (!L.g || !L.a) return { sin: sinTxt };
  return cpmCuenta(L);
};
const lecturaCom = (cli, canal, com, periodo) => leerAlc({ nivel: 'comunicacion', cliente: cli, canal, comunicacion: com, periodo });
const periodoAlc = (per) => (per.hasta === datosHasta ? ALC_PER[per.id] : null);
const SIN_PERIODO = { sin: 'la lectura de alcance de Meta es de los últimos 7 o 30 días o desde que empezó la campaña: elegí uno de esos períodos' };
const cpmAlcanceDe = (cli, canal, com, per) => { const periodo = periodoAlc(per); return periodo ? cpmDeLectura(lecturaCom(cli, canal, com, periodo), periodo, null, 'Meta no informó gasto o alcance para este período') : SIN_PERIODO; };
// General: la campaña en los dos canales corre en cuentas distintas y Meta no junta a las personas entre cuentas: un CPM por cuenta
// (la lectura de "Ambos" del Nexo trae la lista por cuenta de los dos canales), nunca combinado. Si un canal no tiene lectura, sin dato.
const cpmAlcanceVarios = (cli, canales, com, per) => {
  if (!canales.length) return { sin: 'la campaña no tiene Meta en este período' };
  if (canales.length === 1) return cpmAlcanceDe(cli, canales[0], com, per);
  const periodo = periodoAlc(per);
  return periodo ? cpmDeLectura(lecturaCom(cli, 'Ambos', com, periodo), periodo, canales, 'Meta no informó gasto o alcance para este período') : SIN_PERIODO;
};
// CPM de Alcance de una pieza (Contenidos de la campaña): la lectura de Meta de la pieza desde que empezó, que es la ventana de esa tabla
const cpmAlcanceContDe = (cli, canal, cod) => cpmDeLectura(leerAlc({ nivel: 'contenido', cliente: cli, canal, codigo: cod, periodo: 'desde_inicio' }), null, null, 'Meta no informó gasto o alcance para esta pieza');
// solo Stories (cruce mensual por placement, meses del período): no registra reacciones
const soloStories = (cruce, com, rs) => { let gm = 0, gs = 0; const meses = new Set(rs.map((r) => r.f.slice(0, 7)));
  for (const r of cruce) if (r.com === com && meses.has(r.mes)) { gm += r.g; if (/Stories/.test(r.pl || '')) gs += r.g; }
  return gm > 0 && gs >= gm * 0.999; };
// la columna de KPI de una fila de Campañas: kc[k] = { v (valor del período), p (contra lo normal), s (semanas anteriores), t (temporada
// pasada) }. banda = qué "lo normal" (bp, bpG). conT = banda de todos los proyectos (bpT o bpTG): suma kc.cv.pT, el costo por
// reproducción contra todos los proyectos del canal (panel "Todos los proyectos")
// gg = la parte de Google de Tráfico, red por red (ctrGoogleDe), en kc.ctr.gg
function kpisDe(rs, meta, conV, prop, st, ca, banda, conT, gg) {
  const kc = {};
  for (const [k, def] of Object.entries(KPI5)) {
    // todo sobre Meta, que es lo que tiene referencias (así el valor y sus dos comparaciones hablan de lo mismo). Una campaña sin
    // Meta: CPM y CTR con todas sus plataformas y sin comparaciones; Costo por reacción y ETR no aplican
    const conMeta = meta.some((r) => r.i > 0), base = conMeta ? meta : k === 'cpm' || k === 'ctr' ? rs : [];
    const { v, d: den } = valorDe(base, def), vale = (x) => (conMeta && x && v != null && den && x.d >= den * COBERTURA_REF ? { v, r: x.r } : null);
    kc[k] = { v, p: vale(contraProyecto(meta, def, banda)), ...(prop.s ? { s: vale(prop.s[k]) } : {}), ...(prop.tp && prop.t ? { t: vale(prop.t[k]) } : {}) };
    if (conT) { const pT = vale(contraProyecto(meta, def, conT)); if (pT) kc[k].pT = pT.r; }
  }
  if (gg) kc.ctr.gg = gg;
  kc.ca = ca;
  // costo por reproducción: todas las plataformas con reproducciones (el valor y sus comparaciones hablan de lo mismo)
  { const { v, d: den } = valorDe(conV, KCV), vale = (x) => (x && v != null && den && x.d >= den * COBERTURA_REF ? { v, r: x.r } : null);
    kc.cv = { v, p: vale(contraProyecto(conV, KCV, banda)), ...(prop.s ? { s: vale(prop.s.cv) } : {}), ...(prop.tp && prop.t ? { t: vale(prop.t.cv) } : {}) };
    if (conT) { const pT = vale(contraProyecto(conV, KCV, conT)); if (pT) kc.cv.pT = pT.r; } }
  return { kc, sp: prop.sp, tp: !!prop.tp, nm: rs.some((r) => !esMeta(r) && r.i > 0), sm: meta.some((r) => r.i > 0), st };
}
// eficacia por categoría para Insights (mismo cálculo que el borrador: últimos 30 días, % del gasto en rojo), sobre las filas que se le pasen
function efCategorias(E) {
  const desde30 = new Date(new Date(datosHasta).getTime() - 30 * 864e5).toISOString().slice(0, 10);
  const E30 = E.filter((r) => r.hasta >= desde30);
  const porCat = (clave, min = 5) => { const m = {}; for (const r of E30) (m[clave(r) || '(sin dato)'] = m[clave(r) || '(sin dato)'] || []).push(r);
    return Object.entries(m).map(([k, rs]) => ({ k, g: Math.round(rs.reduce((a, r) => a + r.g, 0)), ...efi(rs) })).filter((x) => x.n >= min).sort((a, b) => b.g - a.g); };
  if (!E30.length) return [];
  const fila = (x) => [x.k, x.pctGastoRojo, x.rojos, x.n, M(x.g)];
  return [{ title: 'Por eje', rows: porCat((r) => r.eje).slice(0, 12).map(fila) }, { title: 'Por formato', rows: porCat((r) => r.fmt, 1).map(fila) }, { title: 'Por audiencia', rows: porCat((r) => r.aud).slice(0, 10).map((x) => [corto(x.k, 40), x.pctGastoRojo, x.rojos, x.n, M(x.g)]) }];
}
// "Le costó $X más que si hubiera pagado el CPM normal de Santa Fe ($414)" (pedido de Juan Pablo del 01/10: solo cambia el texto).
// dm = { m: métrica con la que se compra el objetivo, v: su valor normal }. En la lista de Campañas lo de más es gasto menos lo que habría
// costado cada fila a su costo normal (pg): el valor normal es pg ÷ resultado en las filas del objetivo de la campaña. En la campaña y en
// Revisar sale del borrador (deMas): Interacción pg ÷ pr, Tráfico pg ÷ pc, el resto CPM (pg ÷ impresiones × 1.000)
const RES_OBJ = { Alcance: (r) => r.i / 1000, Interacción: (r) => r.r, Tráfico: (r) => r.c, Conversión: (r) => r.c, Reproducciones: (r) => r.vw };
const MET_DM = { Alcance: 'cpm', Interacción: 'cr', Tráfico: 'cpc', Conversión: 'cpc', Reproducciones: 'cv' };
const dmFilas = (rs, obj) => { const f = RES_OBJ[obj] || RES_OBJ.Alcance; let pg = 0, res = 0; for (const r of rs) if (r.obj === obj && r.pg > 0) { pg += r.pg; res += f(r); } return res > 0 ? { m: MET_DM[obj] || 'cpm', v: r4(pg / res) } : null; };
const dmBorr = (m, obj) => (!m ? null : obj === 'Interacción' ? (m.pr ? { m: 'cr', v: r4(m.pg / m.pr) } : null) : obj === 'Tráfico' ? (m.pc ? { m: 'cpc', v: r4(m.pg / m.pc) } : null) : m.i ? { m: 'cpm', v: r4(m.pg / m.i * 1000) } : null);
// valor de cada semana de la historia propia (gráfico de la campaña, 01/10): el KPI con el que la compara Referencias (Interacción costo por
// reacción, Tráfico CTR, el resto CPM), con las filas de Meta de esa semana y del objetivo de la campaña. La altura de la barra sigue siendo
// el índice (rinde mejor o peor que su rango normal); arriba de cada barra va este valor
const semanasConValor = (semanas, ws, obj) => { const m = {}; for (const w of (ws || []).filter((x) => x.obj === obj)) { const o = m[w.s] = m[w.s] || { g: 0, i: 0, r: 0, c: 0 }; o.g += w.g; o.i += w.i; o.r += w.r; o.c += w.c; }
  return (semanas || []).map((w) => { const o = m[w.s]; const v = !o ? null : obj === 'Interacción' ? (o.r ? o.g / o.r : null) : obj === 'Tráfico' ? (o.i ? o.c / o.i * 100 : null) : (o.i ? o.g / o.i * 1000 : null); return { ...w, v: v == null ? null : r4(v) }; }); };
const deJuegos = (c) => c.voces.filter((v) => TERMINAN.includes(v.k)).reduce((s, v) => s + v.g, 0) >= (c.m.g || 1) * 0.5;
const PER_PROPIA = [MES, '7d', '30d'];
// desde cuándo hay datos de Meta en la extracción (el cruce mensual de 180 días): "Histórica" no puede ir más atrás
const DESDE_DATOS = B.filas.reduce((m, r) => (r.mes < m ? r.mes : m), '9999') + '-01';
const sugDe = (pr) => (!pr ? '' : pr.constante ? 'constante' : pr.tipo === 'temporada' ? 'estacional' : '');

// ---------- marcas Bueno / Normal / Malo, ritmo y proyección (marcas.js de Referencias, rediseño del 02/10) ----------
// Cuartiles P25/P75 dentro del proyecto por objetivo × placement (2026); la marca de una campaña es la del KPI de su objetivo. En la app
// van solo letras: mk = B | N | M | S (sin referencia) en cada fila de campaña; rt = R | N | L en cada activo; proy = la proyección del mes.
const MARCAS_M = require('./marcas.js');
const MARCAS = MARCAS_M.crearMarcas(B.filas);
const LETRA = { bueno: 'B', normal: 'N', malo: 'M', sin_ref: 'S' };
const RITMO_L = { rapido: 'R', normal: 'N', lento: 'L' };
// mks (05/10, la marca sale del KPI elegido): una letra por KPI en el orden de MARCAS_M.KPI_ORDEN (cr, cpm, ctr, etrV, etrI, cv, treac,
// tcomp), con la mezcla de placements de la fila. La app toma mks[KPI_ORDEN.indexOf(kpi)]; "Según objetivo" sigue siendo mk. Las tablas de
// cuartiles (P25/P50/P75 por proyecto × canal × objetivo × placement y por objetivo) van una sola vez en DATA.cuartiles.
const mksDe = (filas, proyecto, canal) => MARCAS.letras(filas, { proyecto, canal });
const porCodDe = (filas) => { const m = {}; for (const r of filas) (m[r.cod] = m[r.cod] || []).push(r); return m; };
const mkDe = (filas, obj, proyecto, canal) => { if (!filas.length) return 'S'; const x = MARCAS.marcaCampana(filas, obj, { proyecto, canal }); return LETRA[x && x.estado] || 'S'; };
const porComDe = (filas) => { const m = {}; for (const r of filas) (m[r.com] = m[r.com] || []).push(r); return m; };
const enMeses = (filas, per) => filas.filter((r) => r.mes >= per.desde.slice(0, 7) && r.mes <= per.hasta.slice(0, 7));
// proyección del mes: solo lo que dice marcas.js (estado, ritmo, lo que lleva, presupuesto); nunca alcance
const proyCorta = (x) => (!x ? null : { estado: x.estado, desde: x.desde || null, ritmo: x.ritmo || null, lleva: x.lleva ? { gasto: Math.round(x.lleva.gasto || 0) } : null, presupuesto: x.presupuesto ? Math.round(x.presupuesto) : null });
const TODAS_POR = {};
for (const r of fuente.todas || []) { const k = `${r.canal}|${r.cliente}`; (TODAS_POR[k] = TODAS_POR[k] || []).push(r); }

// ---------- por proyecto × canal ----------
const cliDe = (id) => B.PROYECTOS.find((p) => p.id === id).cliente;
function bloqueApp(P, canal, b) {
  const cli = P.cliente;
  const rowsAll = T.filter((r) => r.cli === cli && r.canal === canal);
  const E = eficaciaPor[`${canal}|${cli}`] || [];
  const eCom = {}, eCod = {}, eAud = {};
  for (const r of E) { (eCom[r.com] = eCom[r.com] || []).push(r); (eCod[r.cod] = eCod[r.cod] || []).push(r); (eAud[r.aud] = eAud[r.aud] || []).push(r); }
  const campD = Object.fromEntries(b.campanas.map((c) => [c.id, c]));
  const auto = (v) => canal === 'Informativo' && AUTOMATIZADOS.includes(v);
  const pend = b.acciones;
  const nAct = (campId) => pend.filter((a) => a.camp === campId || (a.campanas || []).includes(campId)).length;
  const cruceRows = B.filas.filter((r) => r.cli === cli && r.canal === canal);
  const cruceCom = porComDe(cruceRows);

  // ---- celdas de la lista de Campañas (una columna por KPI, 01/10) ----
  // Contra la misma campaña: solo en los períodos que llegan al último dato y no pisan demasiado la referencia (mes en curso, 7 y
  // 30 días); en el resto, 'per'. Semanas anteriores = las semanas útiles antes de las dos últimas (las mismas que usa la luz
  // propia del borrador). Temporada pasada = las mismas semanas de la temporada anterior, con la plata llevada a hoy por inflación.
  const comparaPropia = (d, com, metaRows, per, conV) => {
    if (!d || !d.propia) return { sp: 0 };
    if (per.hasta !== datosHasta || !PER_PROPIA.includes(per.id)) return { sp: 'per', tp: !!d.propia.previa };
    const pr = d.propia, ws = (SEMK[`${canal}|${cli}|${com}`] || []).filter((w) => w.obj === d.obj), cur = porFmt(metaRows.filter((r) => r.obj === d.obj));
    const out = { sp: pr.ref ? 1 : 'e', tp: !!pr.previa, s: {}, t: {} };
    if (pr.ref) { const refS = new Set((pr.semanas || []).slice(0, -2).map((w) => w.s)), ref = porFmt(ws.filter((w) => refS.has(w.s))); for (const [k, def] of Object.entries(KPI5)) out.s[k] = contraFmt(cur, ref, def, 1); }
    if (pr.previa) {
      const sems = [...new Set(ws.filter((w) => w.s >= pr.previa.desde && w.s <= pr.previa.hasta).map((w) => w.s))].sort().slice(0, pr.previa.semanasComparadas);
      const infl = Math.pow(1 + (INFLACION_MES[d.obj] || 0), dias(pr.previa.desde, pr.inicio) / 30.4), ref = porFmt(ws.filter((w) => sems.includes(w.s)));
      for (const [k, def] of Object.entries(KPI5)) out.t[k] = contraFmt(cur, ref, def, infl);
    }
    // costo por reproducción: las mismas semanas, en todas las plataformas, plataforma por plataforma (plataforma × objetivo × formato)
    const hist = TCOM[`${canal}|${cli}|${com}`] || [], curV = porPlat(conV.map((r) => ({ k: `${r.plat}|${r.obj}|${r.fmt}`, g: r.g, vw: r.vw })));
    if (pr.ref) { const refS = new Set((pr.semanas || []).slice(0, -2).map((w) => w.s)); out.s.cv = contraFmt(curV, porPlat(hist.filter((w) => refS.has(w.s))), KCV, 1); }
    if (pr.previa) {
      const sems = [...new Set(ws.filter((w) => w.s >= pr.previa.desde && w.s <= pr.previa.hasta).map((w) => w.s))].sort().slice(0, pr.previa.semanasComparadas);
      const infl = Math.pow(1 + (INFLACION_MES[d.obj] || 0), dias(pr.previa.desde, pr.inicio) / 30.4);
      out.t.cv = contraFmt(curV, porPlat(hist.filter((w) => sems.includes(w.s))), KCV, infl);
    }
    return out;
  };
  const cpmAlcance = (com, per) => cpmAlcanceDe(cli, canal, com, per);
  const cpmAlcanceCont = (cod) => cpmAlcanceContDe(cli, canal, cod);
  const kpisCampana = (d, com, rs, per) => {
    const meta = rs.filter(esMeta), conV = rs.filter((r) => r.vw > 0), prop = comparaPropia(d, com, meta, per, conV);
    // además, el costo por reproducción contra todos los proyectos del canal (panel "Todos los proyectos", 01/10)
    return kpisDe(rs, meta, conV, prop, soloStories(cruceRows, com, rs), cpmAlcance(com, per), 'bp', 'bpT', ctrGoogleDe(rs, canal, cli));
  };
  const filaCamp = (com, rs, per) => {
    const d = campD[com]; const o = sumaT(rs), obj = d ? d.obj : objDominante(rs);
    const desde = rs.reduce((m, r) => (r.f < m ? r.f : m), '9999'), hasta = rs.reduce((m, r) => (r.f > m ? r.f : m), '');
    const estado = per.id === MES && d ? d.estado : (hasta >= addDias(per.hasta, -2) && per.hasta === datosHasta) ? 'Activa' : 'Terminó';
    const deMas = per.id === MES ? Math.max(0, Math.round(o.g - o.pg)) : 0;
    return { id: com, name: com, obj, eje: rs.slice().sort((a, b) => b.g - a.g)[0]?.eje || '', fechas: `${dmy(d ? d.desde : desde)} – ${dmy(d && d.fin ? d.fin : hasta)}`,
      tag: d && d.propia ? (d.propia.tipo === 'temporada' ? 'estacional' : 'larga') : '', demas: deMas > 100000 ? M(deMas) : '', ...(deMas > 100000 ? { dm: dmFilas(rs, obj) } : {}), deMasN: deMas, estado,
      ec: estado === 'Por vencer' ? 'y' : estado === 'Sin entrega' ? 'r' : '', gasto: M(o.g), gastoN: o.g,
      estac: d && d.propia && d.propia.tipo === 'temporada', ef: efV(efiEn(eCom[com], per)),
      // una columna por KPI: kc[k] = { v (valor del período), p (contra el proyecto), s (semanas anteriores), t (temporada pasada) }
      ...kpisCampana(d, com, rs, per),
      plats: plats(rs), nAct: nAct(com), act: ['Activa', 'Por vencer', 'Sin entrega'].includes(estado), detalle: !!d,
      // tipo sugerido (lo confirma el usuario en Insights): la lógica elige semanas anteriores o temporada pasada según el tipo
      sug: sugDe(d && d.propia), larga: !!(d && d.propia && d.propia.span >= 30),
      imp: o.i, vw: o.vw, rea: o.r, xr: o.xr, xg: o.xg,
      // "hasta dónde va a llegar" y "solapan público" son del presente: solo en los períodos que llegan a hoy
      lleg: d && d.llegada && d.llegada.etiqueta && per.hasta === datosHasta ? d.llegada.etiqueta : '', sol: d && d.solapamientos && per.hasta === datosHasta ? d.solapamientos.length : 0 };
  };
  const filaPub = (rs, per) => {
    const r0 = rs.slice().sort((a, b) => b.g - a.g)[0], o = sumaT(rs), obj = objDominante(rs), ix = idxDe(o);
    const desde = rs.reduce((m, r) => (r.f < m ? r.f : m), '9999'), hasta = rs.reduce((m, r) => (r.f > m ? r.f : m), '');
    const meta = r0.plat === 'META', stories = false;
    const ef = meta ? efV(efiEn(eCod[r0.cod], per)) : null;
    const res = resultadoDe(obj, o);
    return { id: `${r0.cod}|${r0.red}`, cod: r0.cod, name: limpio(nombreCont(r0.cont), r0.com), camp: r0.com, eje: r0.eje || '', formato: fmtCorto(r0.fmt), red: RED_NOMBRE[r0.red] || r0.red, code: r0.code, xr: o.xr, xg: o.xg, vw: o.vw, rea: o.r,
      fechas: `${dmy(desde)} – ${dmy(hasta)}`, gasto: o.g, dias: dias(desde, hasta) + 1, imp: o.i,
      cxr: meta ? (o.r ? o.g / o.r : null) : null, cxrT: meta ? (o.r ? fmtCR(o.g / o.r) : 'Sin reacciones') : metricaTxt(obj, o.g, res),
      g: ix.g, ef, comp: o.i ? o.sh / o.i * 100 : null, com: o.i ? o.co / o.i * 100 : null, ret: o.vw >= 500 ? Math.round(o.v25 / o.vw * 100) : null,
      sen: [...(o.r >= 300 && o.sh / o.r * 100 >= 10.2 ? ['c'] : []), ...(o.r >= 300 && o.co / o.r * 100 >= 13.4 ? ['k'] : [])], pieza: { ...piezaDe(r0.cod), nombre: nombreCont(r0.cont) } };
  };
  const porPeriodo = {};
  for (const per of PERIODOS) {
    const rs = rowsAll.filter((r) => r.f >= per.desde && r.f <= per.hasta);
    if (!rs.length) continue;
    const gTot = rs.reduce((s, r) => s + r.g, 0) || 1;
    const porCom = {}; for (const r of rs) (porCom[r.com] = porCom[r.com] || []).push(r);
    const campRows = Object.entries(porCom).map(([com, xs]) => filaCamp(com, xs, per)).filter((c) => c.gastoN > 20000).sort((a, b) => b.gastoN - a.gastoN);
    for (const c of campRows) { const fm = enMeses(cruceCom[c.id] || [], per); c.mk = mkDe(fm, c.obj, cli, canal); c.mks = mksDe(fm, cli, canal); }
    const porPub = {}; for (const r of rs) (porPub[`${r.cod}|${r.red}`] = porPub[`${r.cod}|${r.red}`] || []).push(r);
    const pubs = Object.values(porPub).map((xs) => filaPub(xs, per)).filter((p) => (p.gasto >= 20000 || p.imp >= 20000) && !/^Sin C[oó]digo/i.test(p.name)).sort((a, b) => b.gasto - a.gasto).slice(0, 100);
    { const pc = porCodDe(enMeses(cruceRows, per)); for (const p of pubs) if (p.cod && pc[p.cod]) p.mks = mksDe(pc[p.cod], cli, canal); }
    // audiencia → campaña → pieza (Meta, del cruce mensual): meses del período
    const mesesPer = [...new Set(rs.map((r) => r.f.slice(0, 7)))];
    const audCods = Object.values(cruceRows.filter((r) => mesesPer.includes(r.mes)).reduce((m, r) => { const k = `${r.aud}|${r.com}|${r.cod}`; const o = m[k] = m[k] || { aud: r.aud, com: r.com, cod: r.cod, name: limpio(nombreCont(r.cont), r.com), codes: {}, g: 0, i: 0, r: 0, vw: 0, xr: 0, xg: 0 }; o.g += r.g; o.i += r.i; o.r += r.r; o.vw += r.vw; o.xr += r.xr; o.xg += r.xg; o.codes[codPlac(r.pl)] = (o.codes[codPlac(r.pl)] || 0) + r.g; return m; }, {}))
      .filter((x) => x.g >= 15000).map((x) => ({ ...x, g: Math.round(x.g), xr: Math.round(x.xr), xg: Math.round(x.xg), codes: Object.entries(x.codes).sort((a, b) => b[1] - a[1]).map(([c]) => c), pieza: { ...(piezas[x.cod] || {}), nombre: x.name } }));
    // activo → campaña → audiencia: Meta con sus audiencias (cruce mensual); el resto de plataformas, una fila por red
    const actAud = {};
    for (const r of cruceRows.filter((r) => mesesPer.includes(r.mes))) { const k = `${r.voz}|${r.com}|${r.aud}`; const o = actAud[k] = actAud[k] || { voz: r.voz, com: r.com, cod: r.aud, name: r.aud, codes: {}, g: 0, i: 0, r: 0, vw: 0, xr: 0, xg: 0 }; o.g += r.g; o.i += r.i; o.r += r.r; o.vw += r.vw; o.xr += r.xr; o.xg += r.xg; o.codes[codPlac(r.pl)] = (o.codes[codPlac(r.pl)] || 0) + r.g; }
    for (const r of rs.filter((r) => !esMeta(r))) { const red = RED_NOMBRE[r.red] || r.red, k = `${r.voz}|${r.com}|${red}`; const o = actAud[k] = actAud[k] || { voz: r.voz, com: r.com, cod: red, name: red + ' (sin audiencia)', codes: {}, g: 0, i: 0, r: 0, vw: 0, xr: 0, xg: 0 }; o.g += r.g; o.i += r.i; o.r += r.r; o.vw += r.vw; o.xr += r.xr || 0; o.xg += r.xg || 0; o.codes[r.code] = (o.codes[r.code] || 0) + r.g; }
    // activo → campaña → contenido (05/10): las piezas de cada campaña que corrieron en ESE activo (Meta del cruce mensual; el resto, de las
    // filas diarias); debajo, la lógica cuelga los conjuntos de ese activo. actAud sigue para los totales (% del proyecto y de la campaña)
    const actCont = {};
    for (const r of cruceRows.filter((r) => mesesPer.includes(r.mes))) { const k = `${r.voz}|${r.com}|${r.cod}`; const o = actCont[k] = actCont[k] || { voz: r.voz, com: r.com, cod: r.cod, name: limpio(nombreCont(r.cont), r.com), codes: {}, g: 0, i: 0, r: 0, vw: 0, xr: 0, xg: 0 }; o.g += r.g; o.i += r.i; o.r += r.r; o.vw += r.vw; o.xr += r.xr; o.xg += r.xg; o.codes[codPlac(r.pl)] = (o.codes[codPlac(r.pl)] || 0) + r.g; }
    for (const r of rs.filter((r) => !esMeta(r))) { const k = `${r.voz}|${r.com}|${r.cod}`; const o = actCont[k] = actCont[k] || { voz: r.voz, com: r.com, cod: r.cod, name: limpio(nombreCont(r.cont), r.com), codes: {}, g: 0, i: 0, r: 0, vw: 0, xr: 0, xg: 0 }; o.g += r.g; o.i += r.i; o.r += r.r; o.vw += r.vw; o.xr += r.xr || 0; o.xg += r.xg || 0; o.codes[r.code] = (o.codes[r.code] || 0) + r.g; }
    const actCods = Object.values(actCont).filter((x) => x.g >= 15000 && x.cod && !/^Sin C[oó]digo/i.test(x.name || '')).map((x) => ({ ...x, g: Math.round(x.g), xr: Math.round(x.xr), xg: Math.round(x.xg), codes: Object.entries(x.codes).sort((a, b) => b[1] - a[1]).map(([c]) => c), pieza: { ...(piezas[x.cod] || {}), nombre: x.name } }));
    // cuántos contenidos distintos publicó cada activo en el período: por activo y por activo × campaña (columnas de la pestaña Activos)
    const contSet = {};
    for (const r of rs) { if (!r.cod || /^Sin C[oó]digo/i.test(r.cont || '')) continue; (contSet[r.voz] = contSet[r.voz] || new Set()).add(r.cod); (contSet[`${r.voz}|${r.com}`] = contSet[`${r.voz}|${r.com}`] || new Set()).add(r.cod); }
    const actN = Object.fromEntries(Object.entries(contSet).map(([k, v]) => [k, v.size]));
    // totales para el "% del total" de la pestaña Activos (01/10), con las mismas filas que la tabla (antes de sacar lo chico):
    // p = todo el proyecto en el canal y el período; c[campaña] = toda la campaña, sumando todos sus activos. k = contenidos distintos
    const totAct = (xs) => xs.reduce((o, x) => { o.g += x.g; o.i += x.i; o.r += x.r; o.vw += x.vw; return o; }, { g: 0, i: 0, r: 0, vw: 0 });
    const redondo = (o, k) => ({ g: Math.round(o.g), i: Math.round(o.i), r: Math.round(o.r), vw: Math.round(o.vw), k });
    const contTot = new Set(), contCom = {};
    for (const r of rs) { if (!r.cod || /^Sin C[oó]digo/i.test(r.cont || '')) continue; contTot.add(r.cod); (contCom[r.com] = contCom[r.com] || new Set()).add(r.cod); }
    const porComAct = {}; for (const x of Object.values(actAud)) (porComAct[x.com] = porComAct[x.com] || []).push(x);
    const actTot = { p: redondo(totAct(Object.values(actAud)), contTot.size), c: Object.fromEntries(Object.entries(porComAct).map(([com, xs]) => [com, redondo(totAct(xs), contCom[com] ? contCom[com].size : 0)])) };
    porPeriodo[per.id] = { campRows, pubs, audCods, actCods, actN, actTot };

  }

  // campañas con detalle (pantalla de campaña): desde el borrador
  const campanas = {};
  for (const c of b.campanas) {
    const rs = rowsAll.filter((r) => r.com === c.id && r.f >= addDias(datosHasta, -179));
    const o = sumaT(rs), ix = idxDe(o), obj = c.obj || objDominante(rs.length ? rs : [{ obj: 'Alcance', g: 1 }]);
    // estacionales: la luz Propia y idxTemporada salen de temporada() de marcas.js (el mismo cálculo que la regla C2 y la tarjeta
    // "Esta temporada", 02/10): toda esta temporada contra la misma cantidad de semanas de la pasada, con la plata llevada a hoy
    const prT = c.propia && c.propia.tipo === 'temporada' && c.propia.previa ? MARCAS_M.temporada({ actual: (cruceCom[c.id] || []).filter((r) => r.mes >= c.propia.inicio.slice(0, 7)),
      pasada: MARCAS_M.semanasDe(fuente.semanal || [], { canal, cliente: cli, comunic: c.id }, objetivo), inicio: c.propia.inicio, previa: c.propia.previa, datosHasta, objetivo: c.obj }) : null;
    const pr = prT ? { ...c.propia, idxTemporada: prT.idx, previa: { ...c.propia.previa, valorAct: (prT.kpis[prT.kpi] || {}).valor ?? c.propia.previa.valorAct, semanasComparadas: prT.semanas || c.propia.previa.semanasComparadas } } : c.propia;
    const prop = pr ? (pr.tipo === 'temporada' ? pr.idxTemporada : pr.idxPropio) ?? 'e' : undefined;
    const kv = (x) => (x == null ? null : r2(x));
    const kp = (m) => { const i = m.i || 0; return { cpm: i ? m.g / i * 1000 : null, cr: m.r ? m.g / m.r : null, treac: i ? m.r / i * 100 : null, tcomp: i ? m.sh / i * 100 : null, etr: i ? m.e / i * 100 : null, ctr: i ? m.c / i * 100 : null }; };
    const ixM = (num_, den) => (den ? kv(num_ / den) : null);
    // Rendimiento con período elegible (pedido de Juan Pablo del 02/10): "Este mes" (por defecto) e "Histórica" (en las estacionales,
    // "Esta temporada", desde que volvieron a correr). Las mismas tarjetas, armadas sobre la ventana de cada opción:
    //   G = las filas mensuales del cruce de la campaña (las del borrador, con lo esperado al costo normal → "vs. <Proyecto>")
    //   rsW = las filas diarias de todas las plataformas (Costo por reproducción)
    //   pm = la comparación con la misma campaña, solo en "Este mes": el mes contra sus semanas anteriores (s) o contra la temporada
    //        pasada (t), igual que la columna de KPI de la lista de Campañas en el mes; en Histórica y Esta temporada, la historia de siempre
    //   alcP = el período de la lectura de Meta para Personas alcanzadas
    // lv = valor numérico de la métrica contra la que se comparan las luces de la tarjeta (la lógica arma "27 % más barato que lo normal ($52)")
    // pt = la comparación de "Esta temporada" con la temporada pasada (contraTemporada), una por métrica
    const tilesDe = (G, rsW, pm, alcP, conCs, pt) => { const k = kp(G); return [
      { label: 'Impresiones', val: fmtN(G.i), lv: k.cpm, l: [ixM(G.xg, G.g), ixM(G.pg, G.g)], small: `${M(G.g)} en Meta` },
      // Personas alcanzadas: solo la lectura de Meta de hoy (una cuenta o por cuenta); nunca sumada entre días ni entre cuentas
      { label: 'Personas alcanzadas', val: '—', ...(conCs ? { alcM } : { alcR: 1 }), alcP },   // alcR: la misma lectura que la de Histórica (no se repite)
      { label: 'Costo por reacción', val: fmtCosto(k.cr), lv: k.cr, kpi: obj === 'Interacción', l: [ixM(G.r / (G.xr || 1) * (G.xg || 0), G.g), ixM(G.r / (G.pr || 1) * (G.pg || 0), G.g), ...(obj === 'Interacción' && prop !== undefined ? [prop] : [])], small: `${fmtN(G.r)} reacciones`, ...(pm ? { pm: pm.cr } : {}), ...(pt ? { pt: pt.cr } : {}) },
      { label: 'CPM', val: fmtCosto(k.cpm), lv: k.cpm, kpi: obj === 'Alcance', l: [ixM(G.xg, G.g), ixM(G.pg, G.g), ...(obj === 'Alcance' && prop !== undefined ? [prop] : [])], small: 'costo cada mil impresiones', ...(pm ? { pm: pm.cpm } : {}), ...(pt ? { pt: pt.cpm } : {}) },
      { label: 'Tasa de reacción', val: pctT(k.treac, 2), lv: k.treac, l: [ixM(G.r, G.xr), ixM(G.r, G.pr)], small: `${fmtN(G.r)} reacciones`, ...(pt ? { pt: pt.treac } : {}) },
      { label: 'Tasa de compartido', val: pctT(k.tcomp, 3), lv: k.tcomp, l: [ixM(G.sh, G.xsh), ixM(G.sh, G.psh)], small: `${fmtN(G.sh)} compartidas`, ...(pt ? { pt: pt.tcomp } : {}) },
      { label: 'CTR', val: pctT(k.ctr, 2), lv: k.ctr, kpi: obj === 'Tráfico', l: [ixM(G.c, G.xc), ixM(G.c, G.pc), ...(obj === 'Tráfico' && prop !== undefined ? [prop] : [])], small: `${fmtN(G.c)} clicks`, ...(pm ? { pm: pm.ctr } : {}), ...(pt ? { pt: pt.ctr } : {}) },
      // Reproducciones (01/10): tarjeta de Costo por reproducción, todas las plataformas con reproducciones (la ventana elegida). cp = contra
      // lo normal del proyecto (misma plataforma y objetivo); cs = las dos últimas semanas contra sus semanas anteriores, plataforma por
      // plataforma (Histórica); en "Este mes", pm = el mes contra sus semanas anteriores o la temporada pasada
      ...(obj === 'Reproducciones' ? (() => {
        const conV = rsW.filter((r) => r.vw > 0), { v, d: den } = valorDe(conV, KCV), vale = (x) => (x && v != null && den && x.d >= den * COBERTURA_REF ? x.r : null);
        let cs = null;
        const ws = (pr && pr.semanas || []).map((w) => w.s);
        if (conCs && ws.length >= 4) {
          const hist = TCOM[`${canal}|${cli}|${c.id}`] || [], ult = new Set(ws.slice(-2)), ref = new Set(ws.slice(0, -2));
          const cur = porPlat(hist.filter((w) => ult.has(w.s))), x = contraFmt(cur, porPlat(hist.filter((w) => ref.has(w.s))), KCV, 1), v2 = valorDe(Object.values(cur), KCV);
          if (x && v2.v != null && x.d >= v2.d * COBERTURA_REF) cs = { v: v2.v, r: x.r };
        }
        return [{ label: 'Costo por reproducción', val: v != null ? fmtCosto(v) : '—', lv: v, kpi: true, cp: vale(contraProyecto(conV, KCV)), cs, small: `${fmtN(conV.reduce((s, r) => s + r.vw, 0))} reproducciones`, ...(pm ? { pm: pm.cv } : {}), ...(pt ? { pt: pt.cv } : {}) }];
      })() : []),
    ]; };
    const alcM = alcMeta({ nivel: 'comunicacion', cliente: cli, canal, comunicacion: c.id }, ['desde_inicio', 'ultimos_7', 'ultimos_30']);
    // Histórica: los 180 días que trae la extracción (lo de siempre). Si la campaña empezó antes, se dice desde cuándo hay datos
    const tiles = tilesDe(c.m, rs, null, 'desde_inicio', true);
    // Este mes: desde el 1 o desde que arrancó en el mes, hasta el último día con datos
    const rsMes = rowsAll.filter((r) => r.com === c.id && r.f >= MES + '-01' && r.f <= datosHasta);
    const dMes = rsMes.filter((r) => r.g > 0).reduce((m, r) => (r.f < m ? r.f : m), '9999');
    const conDatoMes = dMes !== '9999', desdeMes = conDatoMes ? dMes : MES + '-01', nMes = dias(desdeMes, datosHasta) + 1;
    const kcMes = kpisCampana(c, c.id, rsMes, PERIODOS.find((x) => x.id === MES)).kc;
    const pmDe = (x) => (!x ? null : { v: x.v, ...(x.s ? { s: x.s.r } : {}), ...(x.t ? { t: x.t.r } : {}) });
    const pmMes = { cr: pmDe(kcMes.cr), cpm: pmDe(kcMes.cpm), ctr: pmDe(kcMes.ctr), cv: pmDe(kcMes.cv) };
    // Personas alcanzadas en "Este mes": desde el inicio si la campaña arrancó este mes (es el mes); si no, la lectura de Meta de largo
    // más parecido a lo que va del mes (7 días hasta el día 18; después, 30 días)
    const alcPMes = c.desde >= MES + '-01' ? 'desde_inicio' : nMes <= 18 ? 'ultimos_7' : 'ultimos_30';
    const tilesMes = tilesDe(B.suma(cruceRows.filter((r) => r.com === c.id && r.mes === MES)), rsMes, pmMes, alcPMes, false);
    // Esta temporada (estacionales): desde el primer día con gasto de esta temporada. El cruce es mensual: se toma desde el mes en que
    // volvió a correr (antes de volver no tenía gasto, por eso no se mezcla con la temporada pasada)
    let temp = null;
    if (pr && pr.tipo === 'temporada' && pr.inicio) {
      const rsT = rowsAll.filter((r) => r.com === c.id && r.f >= pr.inicio && r.f <= datosHasta), dT = rsT.filter((r) => r.g > 0).reduce((m, r) => (r.f < m ? r.f : m), '9999');
      const crT = cruceRows.filter((r) => r.com === c.id && r.mes >= pr.inicio.slice(0, 7));
      const ptT = contraTemporada(pr, crT, porObjFmt(rsT.filter((r) => r.vw > 0), (r) => `${r.plat}|${r.obj}|${r.fmt}`),
        SEMK[`${canal}|${cli}|${c.id}`] || [], TCOM[`${canal}|${cli}|${c.id}`] || []);
      temp = { d: dT === '9999' ? pr.inicio : dT, tiles: tilesDe(B.suma(crT), rsT, null, 'desde_inicio', false, ptT) };
    }
    const rp = { mes: { d: desdeMes, h: datosHasta, n: nMes, sin: !conDatoMes, tiles: tilesMes }, hist: { d: [c.desde, DESDE_DATOS].sort()[1], h: datosHasta, antes: c.desde < DESDE_DATOS ? c.desde : null },
      ...(temp ? { temp: { d: temp.d, h: datosHasta, tiles: temp.tiles } } : {}) };
    const cr = cruceRows.filter((r) => r.com === c.id);
    const conts = (c.contenidos || []).slice().sort((a, b) => (b.hasta || '').localeCompare(a.hasta || '') || b.g - a.g).map((x) => { const kx = kp(x); const sh = x.r >= 300 ? x.sh / x.r * 100 : 0, co = x.r >= 300 ? x.co / x.r * 100 : 0;
      return { cod: x.k, name: limpio(x.nombre, c.id), formato: fmtCorto(x.fmt), fechas: `${dmy(x.desde)} – ${dmy(x.hasta)}`, sen: [...(sh >= 10.2 ? ['c'] : []), ...(co >= 13.4 ? ['k'] : [])], gasto: x.g, dias: dias(x.desde, x.hasta) + 1,
        // columna de KPI (01/10, reemplaza la luz contra lo normal y la columna de costo por reacción): kc = { v, p, s } por KPI
        kc: { ...kpisFilas(cr.filter((r) => r.cod === x.k), cr), ca: cpmAlcanceCont(x.k) }, mks: mksDe(cr.filter((r) => r.cod === x.k), cli, canal), st: !!x.soloStories, imp: x.i, rea: x.r, ef: efV(x.efi), comp: kx.tcomp, ret: x.vw >= 500 ? Math.round(x.v25 / x.vw * 100) : null, alcM: alcMeta({ nivel: 'contenido', cliente: cli, canal, codigo: x.k }, ['desde_inicio', 'ultimos_7']), pieza: { ...piezaDe(x.k), nombre: limpio(x.nombre, c.id) } }; });
    // audiencias: la misma columna de KPI (01/10, reemplaza el KPI y la luz); Meta no lee el alcance por audiencia
    const auds = (c.audiencias || []).map((a) => { const fa = cr.filter((r) => r.aud === a.k), gs = fa.reduce((s, r) => s + (/Stories/.test(r.pl || '') ? r.g : 0), 0);
      return { name: a.k, kc: { ...kpisFilas(fa, cr), ca: { sin: 'Meta no informa el alcance por audiencia (solo por cliente, campaña y pieza)' } }, st: a.g > 0 && gs >= a.g * 0.999, imp: a.i, rea: a.r,
        ef: efV(a.efi), cxr: a.r ? fmtCR(a.g / a.r) : '—', cob: '—' }; });
    const voces = c.voces.map((v) => ({ name: v.k, gasto: M(v.g), auto: v.auto }));
    const plc = (c.porPl || []); const totPl = plc.reduce((s, p) => s + p.g, 0) || 1;
    campanas[c.id] = { id: c.id, name: c.nombre, obj, mk: mkDe(enMeses(cruceCom[c.id] || [], PERIODOS.find((x) => x.id === '30d')), obj, cli, canal), mks: mksDe(enMeses(cruceCom[c.id] || [], PERIODOS.find((x) => x.id === '30d')), cli, canal), eje: c.eje || '', fechas: `${dmy(c.desde)} – ${dmy(c.fin || c.hasta)}`, estado: c.estado, ec: c.estado === 'Por vencer' ? 'y' : c.estado === 'Sin entrega' ? 'r' : '',
      tag: pr ? (pr.tipo === 'temporada' ? 'estacional' : 'campaña larga') : '', plats: plats(rs), spark: c.serie || [], ...kpiDe(o, obj, rs), tiles, rp,
      ef: efV(c.efi), demas: c.deMas > 100000 ? M(c.deMas) : '', dm: c.deMas > 100000 ? dmBorr(c.m, c.obj) : null,
      hist: pr ? { semanas: semanasConValor(pr.semanas, SEMK[`${canal}|${cli}|${c.id}`], c.obj), ref: pr.ref || null, idx: prop, span: pr.span, tendencia: pr.tendencia ?? null, presion: pr.presion ?? null, presionAcum: pr.presionAcum ?? null, temporada: pr.tipo === 'temporada', previa: pr.previa || null, idxPropio: pr.idxPropio ?? null, valorAct: pr.valorAct ?? null, idxTemporada: pr.idxTemporada ?? null, sug: sugDe(pr), sem52: pr.sem52 || 0 } : null,
      ef: efV(c.efi), deMas: c.deMas > 0 ? M(c.deMas) : '', contenidos: conts, audiencias: auds, voces,
      placements: plc.map((p) => ({ name: p.k, pct: Math.round(p.g / totPl * 100), note: /Stories/.test(p.k) })),
      llegada: c.llegada || null, solapan: solapanDe(c.solapamientos) };
  }

  // acciones en formato Problema → Solución · Afectado · Qué revisar, con conjuntos de anuncios
  const conjuntosCamp = fuente.conjuntos.filter((r) => r.cliente === cli && r.canal === canal && r.mes === MES);
  const acciones = redaccion.redactar(pend, { campD, conjuntosCamp, limpio, kpiDe, Mk, dias, datosHasta, objetivo, num, fmtCosto, nombreCont, voz });

  const PLAC_COD = (p) => (/^Facebook/i.test(p || '') ? 'FB' : /^Instagram/i.test(p || '') ? 'IG' : /Threads/i.test(p || '') ? 'TH' : /Status|WhatsApp/i.test(p || '') ? 'WA' : 'FB');
  const anuncios = conjuntosCamp.filter((r) => num(r.gasto) >= 5000).map((r) => ({ com: r.comunic, cod: r.cod || r.contenido, corto: [r.cod, r.audiencia, r.placement].filter(Boolean).join(' · '), nombre: r.conjunto, voz: voz(r.activo), code: PLAC_COD(r.placement),
    g: Math.round(num(r.gasto)), i: num(r.imp), r: num(r.rea), obj: objetivo(r.objetivo) })).sort((a, b) => b.g - a.g).slice(0, 600);
  const t = b.tarjeta;
  const conPresu = b.plat && b.plat.proyectos.length ? b.plat.proyectos : null;
  const todasB = TODAS_POR[`${canal}|${cli}`] || [];
  const presuAct = (a) => (a.pedidoCargado !== false && a.pedido ? a.pedido : null);
  const proyAct = {};
  for (const a of b.activos) proyAct[a.nombre] = MARCAS_M.proyectar({ serie: MARCAS_M.serieDe(todasB, (r) => voz(r.activo) === a.nombre), presupuesto: presuAct(a), datosHasta });
  const presuTot = t.presu || b.activos.reduce((x, a) => x + (presuAct(a) || 0), 0) || null;
  const proy = { p: proyCorta(MARCAS_M.proyectar({ serie: MARCAS_M.serieDe(todasB, () => true), presupuesto: presuTot, datosHasta })),
    act: Object.fromEntries(Object.entries(proyAct).map(([k, x]) => [k, proyCorta(x)])) };
  return { canal, alcM: alcMeta({ nivel: 'cliente', cliente: cli, canal }, ['mes_en_curso', 'ultimos_7', 'ultimos_30']), tarjeta: { g: t.luzG, p: t.luzP, gastado: conPresu ? conPresu.reduce((s, x) => s + x.gastado, 0) : t.gastado, presu: t.presu, cierre: t.cierre, vivas: t.vivas, porVencer: t.porVencer, pedidoCargado: t.pedidoCargado !== false,
      demas: b.campanas.filter((c) => ['Activa', 'Por vencer'].includes(c.estado) && !deJuegos(c)).reduce((s, c) => s + (c.deMas > 0 ? c.deMas : 0), 0), nAcc: acciones.length },
    budgets: (b.plat ? b.plat.proyectos : []).map((x) => ({ name: x.proy, presu: x.presu, gastado: x.gastado, ritmo: x.ritmo, proyeccion: x.proyeccion, acum: x.acum, imp: impAcum(b, x.proy) })),
    diaAct: b.plat ? b.plat.diaAct : Number(datosHasta.slice(8, 10)), diasMes: b.plat ? b.plat.diasMes : 30, mesAnt: b.plat ? MESES_TXT[b.plat.meses[1].slice(5)] : '',
    // Revisar campañas (decisión de Juan Pablo del 01/10, reemplaza a L-1): entran solo las que muestran "peor" en su celda de KPI del
    // mes en curso (rojo contra lo normal o contra la misma campaña). Acá van las candidatas (al aire y no de los Juegos); la lógica arma
    // la celda con su fila de Campañas del mes, se queda con las que dicen "peor", las ordena por lo que pagaron de más y muestra cinco
    bad: b.campanas.filter((c) => ['Activa', 'Por vencer'].includes(c.estado) && !deJuegos(c)).sort((x, y) => (y.deMas || 0) - (x.deMas || 0))
      .map((c) => { const cd = campanas[c.id]; const acc = pend.find((a) => a.camp === c.id); return { id: c.id, name: c.nombre, obj: cd.obj, eje: c.eje || '—', g7: Math.round(c.g7 || 0), meta: `${cd.obj} · Eje ${c.eje || '—'} · ${M(c.g7)} en 7 días`, deMasN: c.deMas > 0 ? Math.round(c.deMas) : 0, demas: c.deMas > 0 ? M(c.deMas) : '', dm: c.deMas > 0 ? dmBorr(c.m, c.obj) : null, ef: efV(c.efi), accion: acc ? acc.hacer : 'Sin acción sugerida', plats: cd.plats }; }),
    periodos: porPeriodo, campanas, anuncios, proy,
    activos: b.activos.map((a) => { const pl = (plataformasPor[`${canal}|${cli}`] || []).filter((r) => r.voz === a.nombre && r.f >= MES + '-01'); const m = {}; for (const r of pl) { const code = COD_NOMBRE[r.red] || codigoRed(r.red); if (code !== 'OT') m[code] = (m[code] || 0) + r.g; }
      const codes = Object.entries(m).sort((x, y) => y[1] - x[1]).map(([code]) => chip(code));
      const camps = a.vivas.map((n) => campanas[n]).filter(Boolean);
      const pk = a.pico; const ritmo = !pk || pk.idx == null ? ['Sin gasto reciente', ''] : [`${pk.estado ? pk.estado + ': gasta' : 'Gasta'} ${Math.round(pk.idx * 100)} % de lo habitual`, pk.estado === 'Apagón' ? 'r' : pk.estado ? 'y' : ''];
      return { name: a.nombre, rt: RITMO_L[(proyAct[a.nombre] || {}).ritmo] || undefined, plats: codes, auto: a.auto, pedidoCargado: a.pedidoCargado !== false, pedido: a.pedidoCargado !== false && a.pedido ? a.pedido / 1e6 : null, gastado: a.gastado / 1e6, camps: a.vivas.slice(0, 3).join(', ') + (a.vivas.length > 3 ? '…' : ''), campIds: a.vivas, n: a.vivas.length, g7: M(a.g7), ritmo, l: [a.idxG, a.idxP] }; }),
    acciones, insights: { vs: b.insights.cruces.map((c) => ({ c: c.alerta ? 'y' : 'g', a: c.aprendizaje, b: c.ahora })),
      ef: b.insights.eficacia ? [{ title: 'Por eje', rows: b.insights.eficacia.ejes.map((x) => [x.k, x.pctGastoRojo, x.rojos, x.n, M(x.g)]) }, { title: 'Por formato', rows: b.insights.eficacia.formatos.map((x) => [x.k, x.pctGastoRojo, x.rojos, x.n, M(x.g)]) }, { title: 'Por audiencia', rows: b.insights.eficacia.audiencias.map((x) => [corto(x.k, 40), x.pctGastoRojo, x.rojos, x.n, M(x.g)]) }] : [],
      // campañas a categorizar: constantes (activas la mitad del año o más) y estacionales (misma época del año anterior)
      season: b.campanas.filter((c) => c.propia && (c.propia.constante || c.propia.tipo === 'temporada')).sort((x, y) => (y.propia.sem52 || 0) - (x.propia.sem52 || 0))
        .map((c) => ({ id: c.id, name: c.id, sug: c.propia.constante ? 'constante' : 'estacional', sem52: c.propia.sem52 || 0, larga: c.propia.span >= 30,
          previa: c.propia.previa ? `temporada anterior desde el ${dmy(c.propia.previa.desde)}/${c.propia.previa.desde.slice(2, 4)} (${c.propia.previa.semanasComparadas} ${c.propia.previa.semanasComparadas === 1 ? 'semana comparada' : 'semanas comparadas'})` : '' })),
      propios: b.insights.proyecto.map((i) => [i.titulo + '. ' + i.texto, 'Último año']) } };
}
// ---------- canal General (01/10): el proyecto con Oficial e Informativo juntos ----------
// Solo se arma acá lo que no se puede sumar en la página: la lista de Campañas (una campaña con el mismo nombre en los dos canales va
// una sola vez, sumada, con su columna de KPI recalculada), los contenidos distintos por activo (Activos) y la eficacia por categoría
// (Insights). Pubs, audiencias, activos, acciones, presupuestos y lo demás lo junta logica.js con los bloques de cada canal (así la app
// no pesa el doble). Por ahora se agrupa por el nombre tal como está; cuando exista la lista única de campañas (pedido 033), por el
// nombre oficial. El detalle de una campaña sigue siendo el de cada canal.
const CANALES = ['Oficial', 'Informativo'];
const PRIO_ESTADO = ['Activa', 'Por vencer', 'Sin entrega'];
function generalApp(P, apps) {
  const cli = P.cliente, cans = CANALES.filter((c) => P.canales[c] && apps[c]);
  if (cans.length < 2) return null;
  const rowsAll = T.filter((r) => r.cli === cli && cans.includes(r.canal));
  const campD = Object.fromEntries(cans.map((c) => [c, Object.fromEntries(P.canales[c].campanas.map((x) => [x.id, x]))]));
  const E = cans.flatMap((c) => eficaciaPor[`${c}|${cli}`] || []), eCom = {};
  for (const r of E) (eCom[r.com] = eCom[r.com] || []).push(r);
  const cruce = B.filas.filter((r) => r.cli === cli && cans.includes(r.canal));
  const cruceComG = porComDe(cruce);
  const nAct = (com) => cans.reduce((s, c) => s + P.canales[c].acciones.filter((a) => a.camp === com || (a.campanas || []).includes(com)).length, 0);
  // el canal del detalle de cada campaña: el que más gastó en sus 180 días (si está en los dos)
  const cdet = {};
  for (const c of cans) for (const [id, x] of Object.entries(apps[c].campanas)) {
    const g = rowsAll.filter((r) => r.canal === c && r.com === id).reduce((s, r) => s + r.g, 0);
    if (!cdet[id] || g > cdet[id].g) cdet[id] = { c, g };
  }
  // contra la misma campaña con los dos canales juntos: la historia semanal de los dos canales, con las semanas de referencia de cada
  // canal (las útiles menos las dos últimas) juntas; la temporada pasada, con las semanas alineadas de cada canal y su inflación
  const comparaPropiaG = (ds, com, obj, meta, per, conV) => {
    const conP = ds.filter(([, d]) => d && d.propia);
    if (!conP.length) return { sp: 0 };
    const tp = conP.some(([, d]) => d.propia.previa);
    if (per.hasta !== datosHasta || !PER_PROPIA.includes(per.id)) return { sp: 'per', tp };
    const conRef = conP.filter(([, d]) => d.propia.ref);
    const ws = cans.flatMap((c) => (SEMK[`${c}|${cli}|${com}`] || []).filter((w) => w.obj === obj)), cur = porFmt(meta.filter((r) => r.obj === obj));
    const hist = cans.flatMap((c) => TCOM[`${c}|${cli}|${com}`] || []), curV = porPlat(conV.map((r) => ({ k: `${r.plat}|${r.obj}|${r.fmt}`, g: r.g, vw: r.vw })));
    const out = { sp: conRef.length ? 1 : 'e', tp, s: {}, t: {} };
    if (conRef.length) {
      const refS = new Set(conRef.flatMap(([, d]) => (d.propia.semanas || []).slice(0, -2).map((w) => w.s))), ref = porFmt(ws.filter((w) => refS.has(w.s)));
      for (const [k, def] of Object.entries(KPI5)) out.s[k] = contraFmt(cur, ref, def, 1);
      out.s.cv = contraFmt(curV, porPlat(hist.filter((w) => refS.has(w.s))), KCV, 1);
    }
    const conPrev = conP.filter(([, d]) => d.propia.previa);
    if (conPrev.length) {
      const sems = new Set(conPrev.flatMap(([c, d]) => { const pv = d.propia.previa; return [...new Set((SEMK[`${c}|${cli}|${com}`] || []).filter((w) => w.obj === d.obj && w.s >= pv.desde && w.s <= pv.hasta).map((w) => w.s))].sort().slice(0, pv.semanasComparadas); }));
      const [, d0] = conPrev[0], infl = Math.pow(1 + (INFLACION_MES[obj] || 0), dias(d0.propia.previa.desde, d0.propia.inicio) / 30.4);
      const ref = porFmt(ws.filter((w) => sems.has(w.s)));
      for (const [k, def] of Object.entries(KPI5)) out.t[k] = contraFmt(cur, ref, def, infl);
      out.t.cv = contraFmt(curV, porPlat(hist.filter((w) => sems.has(w.s))), KCV, infl);
    }
    return out;
  };
  const filaG = (com, rs, per) => {
    const o = sumaT(rs), porCanal = {};
    for (const r of rs) porCanal[r.canal] = (porCanal[r.canal] || 0) + r.g;
    const cn = Object.entries(porCanal).sort((a, b) => b[1] - a[1]).map(([c]) => c);
    const ds = cn.map((c) => [c, campD[c][com]]).filter(([, d]) => d), dm = ds[0] ? ds[0][1] : null;
    const obj = dm ? dm.obj : objDominante(rs);
    const desde = rs.reduce((m, r) => (r.f < m ? r.f : m), '9999'), hasta = rs.reduce((m, r) => (r.f > m ? r.f : m), '');
    const dDesde = ds.length ? ds.map(([, d]) => d.desde).sort()[0] : desde, dFin = ds.length ? ds.map(([, d]) => d.fin || d.hasta).sort().pop() : hasta;
    const estado = per.id === MES && ds.length ? (PRIO_ESTADO.find((e) => ds.some(([, d]) => d.estado === e)) || dm.estado) : (hasta >= addDias(per.hasta, -2) && per.hasta === datosHasta) ? 'Activa' : 'Terminó';
    const deMas = per.id === MES ? Math.max(0, Math.round(o.g - o.pg)) : 0;
    const meta = rs.filter(esMeta), conV = rs.filter((r) => r.vw > 0);
    const prop = comparaPropiaG(ds, com, obj, meta, per, conV);
    const pr = dm && dm.propia, solo = ds.length === 1 ? ds[0][1] : null;
    return { id: com, name: com, obj, eje: rs.slice().sort((a, b) => b.g - a.g)[0]?.eje || '', fechas: `${dmy(dDesde)} – ${dmy(dFin)}`,
      tag: pr ? (pr.tipo === 'temporada' ? 'estacional' : 'larga') : '', demas: deMas > 100000 ? M(deMas) : '', ...(deMas > 100000 ? { dm: dmFilas(rs, obj) } : {}), deMasN: deMas, estado,
      ec: estado === 'Por vencer' ? 'y' : estado === 'Sin entrega' ? 'r' : '', gasto: M(o.g), gastoN: Math.round(o.g), ef: efV(efiEn(eCom[com], per)),
      ...kpisDe(rs, meta, conV, prop, soloStories(cruce, com, rs), cpmAlcanceVarios(cli, cn.filter((c) => meta.some((r) => r.canal === c)), com, per), 'bpG', 'bpTG', ctrGoogleDe(rs, 'General', cli)),
      plats: plats(rs), nAct: nAct(com), act: PRIO_ESTADO.includes(estado), detalle: !!cdet[com],
      // cn = canales donde corrió en el período (el que más gastó primero); cd = canal del detalle y del tipo de campaña
      cn, cd: cdet[com] ? cdet[com].c : cn[0],
      sug: sugDe(pr), larga: ds.some(([, d]) => d.propia && d.propia.span >= 30),
      // (sin xr, xg ni estac, que la página no usa en la lista: así la General pesa menos)
      imp: o.i, vw: o.vw, rea: o.r,
      // "hasta dónde va a llegar" no se suma entre canales (es una proyección de cada uno): solo si la campaña está en un solo canal
      lleg: solo && solo.llegada && solo.llegada.etiqueta && per.hasta === datosHasta ? solo.llegada.etiqueta : '',
      sol: per.hasta === datosHasta ? ds.reduce((s, [, d]) => s + (d.solapamientos ? d.solapamientos.length : 0), 0) : 0 };
  };
  const periodos = {};
  for (const per of PERIODOS) {
    const rs = rowsAll.filter((r) => r.f >= per.desde && r.f <= per.hasta);
    if (!rs.length) continue;
    const porCom = {}; for (const r of rs) (porCom[r.com] = porCom[r.com] || []).push(r);
    const campRows = Object.entries(porCom).map(([com, xs]) => filaG(com, xs, per)).filter((c) => c.gastoN > 20000).sort((a, b) => b.gastoN - a.gastoN);
    for (const c of campRows) { const fm = enMeses(cruceComG[c.id] || [], per); c.mk = mkDe(fm, c.obj, cli, MARCAS_M.CANAL_AMBAS); c.mks = mksDe(fm, cli, MARCAS_M.CANAL_AMBAS); }
    // contenidos distintos por activo y por activo × campaña, juntando los dos canales (una pieza puede estar en los dos)
    const contSet = {}, contTot = new Set(), contCom = {};
    for (const r of rs) { if (!r.cod || /^Sin C[oó]digo/i.test(r.cont || '')) continue; (contSet[r.voz] = contSet[r.voz] || new Set()).add(r.cod); (contSet[`${r.voz}|${r.com}`] = contSet[`${r.voz}|${r.com}`] || new Set()).add(r.cod); contTot.add(r.cod); (contCom[r.com] = contCom[r.com] || new Set()).add(r.cod); }
    const actN = Object.fromEntries(Object.entries(contSet).map(([k, v]) => [k, v.size]));
    // totales del "% del total" de Activos: la suma de los dos canales (las mismas filas que la tabla) y los contenidos distintos
    const tots = cans.map((c) => (apps[c].periodos[per.id] || {}).actTot).filter(Boolean), suma = (xs) => xs.reduce((o, x) => ({ g: o.g + x.g, i: o.i + x.i, r: o.r + x.r, vw: o.vw + x.vw }), { g: 0, i: 0, r: 0, vw: 0 });
    const coms = [...new Set(tots.flatMap((t) => Object.keys(t.c)))];
    const actTot = { p: { ...suma(tots.map((t) => t.p)), k: contTot.size }, c: Object.fromEntries(coms.map((com) => [com, { ...suma(tots.map((t) => t.c[com]).filter(Boolean)), k: contCom[com] ? contCom[com].size : 0 }])) };
    periodos[per.id] = { campRows, actN, actTot };
  }
  return { periodos, cdet: Object.fromEntries(Object.entries(cdet).map(([k, v]) => [k, v.c])), ef: efCategorias(E) };
}
// "mil" y "M", como en las tablas (02/10: antes "K")
const fmtN = (n) => { n = n || 0; return n >= 1e6 ? (n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' M' : n >= 1e4 ? Math.round(n / 1e3).toLocaleString('es-AR') + ' mil' : Math.round(n).toLocaleString('es-AR'); };
const pctT = (x, d) => (x == null || !isFinite(x) ? '—' : x.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %');
function impAcum(b, proy) {
  // impresiones acumuladas del mes por proyecto (todas las plataformas) y las del mes anterior, para el gráfico de Gasto del mes
  const rs = (plataformasPor[`${b.canal}|${cliDe(b.pid)}`] || []).filter((r) => r.proy === proy);
  const acum = (mes, n) => { const out = []; let s = 0; for (let d = 1; d <= n; d++) { s += rs.filter((r) => r.f === `${mes}-${String(d).padStart(2, '0')}`).reduce((a, r) => a + r.i, 0); out.push(Math.round(s)); } return out; };
  const p = b.plat; if (!p) return null;
  return { actual: acum(p.mesAct, p.diaAct), previo: acum(p.meses[1], B.diasDelMes(p.meses[1])), mesPrevio: MESES_TXT[p.meses[1].slice(5)] };
}
// catálogo de reglas y redacción de las recomendaciones: redaccion.js

// ---------- armar DATA para el diseño ----------
const proyectos = DATA.proyectos.map((P) => ({ id: P.id, nombre: P.nombre, cliente: P.cliente, canales: Object.fromEntries(Object.entries(P.canales).map(([canal, b]) => [canal, bloqueApp(P, canal, { ...b, pid: P.id })])) }));
// canal General de cada proyecto (lo que no se puede sumar en la página) y panel "Todos los proyectos" de cada canal (eficacia por
// categoría: Oficial, Informativo y General = los dos canales juntos)
for (const p of proyectos) { const g = generalApp(DATA.proyectos.find((P) => P.id === p.id), p.canales); if (g) p.general = g; }
const efDeCanales = (cans) => efCategorias(DATA.proyectos.flatMap((P) => cans.flatMap((c) => (P.canales[c] ? eficaciaPor[`${c}|${P.cliente}`] || [] : []))));
const TODOS = { ef: { Oficial: efDeCanales(['Oficial']), Informativo: efDeCanales(['Informativo']), General: efDeCanales(['Oficial', 'Informativo']) } };
const GEN = DATA.generales.map((g) => [g.titulo + '. ' + g.texto, g.fuente]);
// reglas vigentes (sección "Reglas vigentes" de Cómo leer): una sola fuente, borrador/reglas-vigentes.js (Recomendaciones), que lee
// la tabla C del documento de reglas. Van ordenadas por prioridad (sin el número) y solo las que funcionan. Aparte, lo que está
// "en observación": si reglas-vigentes.js no lo trae (hoy no), se toma de la sección F del mismo documento.
const REGLAS = (() => {
  const rv = require('../borrador/reglas-vigentes.js').reglasVigentes();
  const nro = (id) => Number(String(id).replace(/\D/g, '')) || 0;
  const reglas = rv.reglas.filter((r) => r.estado === 'Funciona').sort((a, b) => b.prioridad - a.prioridad || nro(a.id) - nro(b.id))
    .map((r) => ({ id: r.id, nombre: r.nombre, cuando: r.cuando, propone: r.propone, plataformas: r.plataformas, estado: r.estado, como: r.como_lo_detectamos || '', pautador: r.pautador }));
  let observacion = rv.en_observacion;
  if (!observacion) {
    const doc = fs.readFileSync(path.join(__dirname, '..', 'documentos', 'reglas-recomendador-v0.3.md'), 'utf8');
    const ini = doc.indexOf('## F.'), fin = doc.indexOf('\n## ', ini + 5);
    observacion = ini < 0 ? [] : doc.slice(ini, fin < 0 ? undefined : fin).split('\n').map((l) => l.match(/^\|([^|]+)\|([^|]+)\|\s*\*\*En observación\*\*/)).filter(Boolean)
      .map((m) => ({ nombre: m[1].trim(), regla: m[2].trim().replace(/\*\*|`/g, '') }));
  }
  return { version: rv.version, fecha: rv.fecha, reglas, notas: rv.notas, observacion };
})();
// tableros de Looker Studio embebidos (link de inserción), por proyecto|canal; el resto se pega desde la pestaña
const LK = (id) => `https://datastudio.google.com/embed/reporting/${id}/page/p_ntm2r8672d`;
const LOOKERS = {
  'santa-fe|Oficial': LK('af2398f4-9b6a-4585-aece-ebb8728c387f'),
  'chaco|Oficial': LK('2f6533bb-089e-42e1-bb3b-e43199ca7c33'),
  'chubut|Oficial': LK('3afb177d-e25e-433a-a62b-ce29fe66f29a'),
  'corrientes|Oficial': LK('ba452d73-59e2-4934-be51-77b017928f34'),
  'catamarca-provincia|Oficial': LK('b2e10ae3-5621-4a34-84f3-bdcf3ad6009c'),
  'catamarca-ciudad|Oficial': LK('ec629fb9-b6f1-49ac-b99f-ce72abab7df8'),
  'cordoba|Oficial': LK('47c308e5-9e4b-4a33-9ae2-a546f6166e9e'),
  'santa-fe|Informativo': LK('d074ec19-3682-4c03-832f-c60ab3a9ef3b'),
  'chaco|Informativo': LK('cbcbd383-4667-49fa-91ba-87a7f23a32d3'),
  'chubut|Informativo': LK('0691c642-a586-4e07-be17-ebd7f91101b9'),
  'corrientes|Informativo': LK('f868bbbd-eed2-4ef1-8d7c-0ecfe6bd8c83'),
  'catamarca-provincia|Informativo': LK('cf44e0e1-a481-4140-ab26-7a3f6871f97f'),
  'catamarca-ciudad|Informativo': LK('cbf04a88-2af9-4b9c-ae7a-4876924da9b9'),
  'cordoba|Informativo': LK('217dcca9-5c4e-47ea-b912-a9d2af51a694'),
  // tableros que todavía no son proyectos de la app: 'turismo-chubut|Oficial' f6e58c56-aa28-429a-beae-a1dc1874b578 · 'argentinos-x-israel|Oficial' 904f71c1-8685-41bb-a63d-76e502eb2a1c
};
const APP = { cuartiles: MARCAS.tablas(), nombres: NOMBRE_COD, logos: LOGOS, lookers: LOOKERS, datosHasta, mes: MES, mesTxt: MESES_TXT[MES.slice(5)], periodos: PERIODOS.map(({ id, label, txt, mes }) => ({ id, label, txt, mes: !!mes })), proyectos, generales: GEN,
  bandasPlat: Object.fromEntries(Object.entries(bandasPlat.G).map(([k, v]) => [k, v.map((x) => r2(x))])), umbralesLlegada: DATA.umbralesLlegada, reglas: REGLAS,
  // pedidoCargado = false: la planilla de presupuestos no tiene pedidos del mes → "Sin pedido cargado" en gris, sin restante ni alerta
  pedidoCargado: DATA.pedidoCargado !== false,
  // lectura de alcance de Meta de hoy: estado (ok / parcial / sin_dato_de_hoy), fecha y motivo (regla A3)
  // fecha = la de la lectura que se usa; deHoy = false → la app dice "al dd/mm" (Nexo, 03/10: vale la última lectura, con su fecha)
  alcanceMeta: { estado: ALCM.estado, fecha: ALCM.fechaLectura || ALCM.fecha, motivo: ALCM.motivo || null, fechaLectura: ALCM.fechaLectura || null, deHoy: ALCM.deHoy !== false, aviso: ALCM.aviso || null }, todos: TODOS };

// ---------- inyectar en el bundle del diseño ----------
const html = fs.readFileSync(DISENO, 'utf8');
const m = html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/);
let template = JSON.parse(m[1]);
// el Mapa de Estructura (mapa.js) va pegado antes de la lógica: usa sus funciones y constantes
const logica = fs.readFileSync(path.join(__dirname, 'mapa.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'logica.js'), 'utf8');
const datosJs = 'const DATA = ' + JSON.stringify(APP).replace(/<\//g, '<\\/') + ';\n';
// 1) lógica: reemplaza el script text/x-dc entero (conserva el tag con sus data-props)
template = template.replace(/(<script type="text\/x-dc"[^>]*>)([\s\S]*?)(<\/script>)/, (all, a, _b, c) => a + '\n' + datosJs + logica + '\n' + c);
// 2) secciones enteras: se busca el <sc-if value="{{ isX }}"> y su cierre (contando anidamiento) y se reemplaza por el markup propio
const seccion = (tpl, flag, nuevo) => {
  const ini = tpl.indexOf(`<sc-if value="{{ ${flag} }}">`);
  if (ini < 0) { console.error('SECCIÓN NO ENCONTRADA:', flag); return tpl; }
  const re = /<sc-if\s|<\/sc-if>/g; re.lastIndex = ini; let prof = 0, m2;
  while ((m2 = re.exec(tpl))) { prof += m2[0] === '</sc-if>' ? -1 : 1; if (prof === 0) return tpl.slice(0, ini) + nuevo + tpl.slice(m2.index + m2[0].length); }
  console.error('SECCIÓN SIN CIERRE:', flag); return tpl;
};
const arbol = require('./arbol.js');
for (const [flag, nuevo] of [['isEjes', arbol.ejes], ['isAud', arbol.auds], ['isActivos', arbol.activos], ['isPubs', ''], ['isCmpTab', '']]) template = seccion(template, flag, nuevo);
// 3) parches de markup acordados
const parches = require('./parches.js');
let n = 0;
for (const [desde, hasta] of parches) {
  const hay = desde instanceof RegExp ? desde.test(template) : template.includes(desde);
  if (!hay) { console.error('PARCHE NO ENCONTRADO:', String(desde).slice(0, 100)); continue; }
  template = typeof hasta === 'function' ? template.replace(desde, hasta) : template.replace(desde, () => hasta); n++; // función: así los "$" del reemplazo no se interpretan como patrones
}
// el template va como JSON adentro de un <script>: los "</script>" internos se escapan como "<\/script>" (JSON válido) para no cortar el HTML
const salida = html.replace(m[0], () => `<script type="__bundler/template">${JSON.stringify(template).replace(/<\//g, '<\\/')}</script>`).replace('<title>Bundled Page</title>', '<title>Tablero de optimización</title>');
fs.writeFileSync(SALIDA, salida);
// repositorio de recomendaciones (lo guarda redaccion.js)
redaccion.guardarRepositorio(proyectos, datosHasta);
for (const p of proyectos) for (const [c, b] of Object.entries(p.canales)) console.log(`${p.nombre.padEnd(20)} ${c.padEnd(11)} campañas ${Object.keys(b.campanas).length} · períodos ${Object.keys(b.periodos).length} · activos ${b.activos.length} · acciones ${b.acciones.length} (con conjuntos ${b.acciones.filter((a) => a.afectado.conjuntos.length).length})`);
console.log(`reglas vigentes ${REGLAS.reglas.length} · en observación ${REGLAS.observacion.length} (${REGLAS.observacion.map((o) => o.nombre).join(', ')})`);
console.log(`alcance de Meta (${ALCM.fecha}): ${ALCM.estado}${ALCM.motivo ? ' · ' + ALCM.motivo : ''} · filas válidas ${Object.values(ALCM.niveles || {}).reduce((s, x) => s + x.length, 0)} · descartadas ${(ALCM.descartadas || []).length}`);
console.log(`bandas por plataforma: ${Object.keys(bandasPlat.G).join(', ')}`);
console.log(`parches aplicados ${n}/${parches.length} · ${Math.round(salida.length / 1024)} KB → ${SALIDA}`);
