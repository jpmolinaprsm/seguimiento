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

const { DATA, fuente, BG, BP, valor, candG, candP, eficaciaPor, efi, luz, r2, percentil, dias, voz, formato, nombreCont, objetivo, num, M, Mk, fmtCosto, vx, corto,
  hashId, dmy, MESES_TXT, RED_NOMBRE, OBJ_PLAT, AUTOMATIZADOS, TERMINAN, datosHasta, MES, plataformasPor } = B;

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
    if (r.obj === 'Alcance') { r.xg = g50 && r.i ? r.i * g50 / 1000 : 0; r.pg = p50 && r.i ? r.i * p50 / 1000 : 0; continue; }
  } else {
    g50 = (bandasPlat.G[`${r.plat}|${r.obj}`] || [])[1] || null;
    p50 = (bandasPlat.P[`${r.cli}|${r.canal}|${r.plat}|${r.obj}`] || [])[1] || null;
  }
  r.xg = g50 && res ? res * g50 : 0;
  r.pg = p50 && res ? res * p50 : 0;
}
const sumaT = (rs) => rs.reduce((o, r) => { for (const k of ['g', 'i', 'r', 'c', 'vw', 'v25', 'v100', 'e', 'sh', 'co', 'xg', 'pg', 'xr']) o[k] += r[k] || 0; return o; }, { g: 0, i: 0, r: 0, c: 0, vw: 0, v25: 0, v100: 0, e: 0, sh: 0, co: 0, xg: 0, pg: 0, xr: 0 });
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

// ---------- alcance diario (Meta): por canal|cliente|comunicación|contenido|fecha ----------
const ALC = (fuente.alcance || []).map((r) => ({ canal: r.canal, cli: r.cliente, com: r.comunic, cod: r.cod || '', f: r.fecha, reach: num(r.reach) }));
const alcanceDe = (rs) => rs.reduce((s, r) => s + r.reach, 0);

// ---------- alcance real de Meta (regla A3): lo lee PAUTADOR cada mañana, lo baja Datos, lo valida el Nexo ----------
// Por cliente (mes en curso, 7 y 30 días), campaña de la app = Comunicación (desde el inicio, 7 y 30) y contenido (desde el
// inicio y 7). Cada período: { ex, a, amin, amax, f, fmin, fmax, d, h } (ex = false: varias cuentas, rango) o { sin: motivo }.
// Mientras no haya dato de hoy la app sigue mostrando el alcance diario acumulado, marcado como aproximado.
const NEXO_ALC = require('../nexo/alcance.js');
const ALCM = NEXO_ALC.alcanceDeExtraccion(fuente);
const alcMeta = (consulta, periodos) => Object.fromEntries(periodos.map((periodo) => {
  const r = NEXO_ALC.datoDeHoy(ALCM, { ...consulta, periodo });
  if (r.estado !== 'ok') { const cn = ALCM.canales && ALCM.canales[consulta.canal]; return [periodo, { sin: cn && !cn.disponible ? cn.motivo : r.motivo }]; }
  const d = r.dato;
  return [periodo, { ex: d.exacto, a: d.alcance, amin: d.alcance_min, amax: d.alcance_max, f: d.frecuencia, fmin: d.frecuencia_min, fmax: d.frecuencia_max, d: d.fecha_desde, h: d.fecha_hasta }];
}));

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
  const alcRows = ALC.filter((r) => r.cli === cli && r.canal === canal);
  const cruceRows = B.filas.filter((r) => r.cli === cli && r.canal === canal);

  const sugDe = (pr) => (!pr ? '' : pr.constante ? 'constante' : pr.tipo === 'temporada' ? 'estacional' : '');
  const filaCamp = (com, rs, per) => {
    const d = campD[com]; const o = sumaT(rs), obj = d ? d.obj : objDominante(rs), ix = idxDe(o);
    const propia = d && d.propia && per.mes && per.id === MES ? (d.propia.tipo === 'temporada' ? d.propia.idxTemporada : d.propia.idxPropio) : undefined;
    const desde = rs.reduce((m, r) => (r.f < m ? r.f : m), '9999'), hasta = rs.reduce((m, r) => (r.f > m ? r.f : m), '');
    const estado = per.id === MES && d ? d.estado : (hasta >= addDias(per.hasta, -2) && per.hasta === datosHasta) ? 'Activa' : 'Terminó';
    const deMas = per.id === MES ? Math.max(0, Math.round(o.g - o.pg)) : 0;
    return { id: com, name: com, obj, eje: rs.slice().sort((a, b) => b.g - a.g)[0]?.eje || '', fechas: `${dmy(d ? d.desde : desde)} – ${dmy(d && d.fin ? d.fin : hasta)}`,
      tag: d && d.propia ? (d.propia.tipo === 'temporada' ? 'estacional' : 'larga') : '', demas: deMas > 100000 ? M(deMas) : '', deMasN: deMas, estado,
      ec: estado === 'Por vencer' ? 'y' : estado === 'Sin entrega' ? 'r' : '', gasto: M(o.g), gastoN: o.g, ...kpiDe(o, obj, rs),
      l: [ix.g, ix.p, ...(propia !== undefined ? [propia ?? 'e'] : [])], estac: d && d.propia && d.propia.tipo === 'temporada', ef: efV(efiEn(eCom[com], per)),
      plats: plats(rs), nAct: nAct(com), act: ['Activa', 'Por vencer', 'Sin entrega'].includes(estado), detalle: !!d,
      // tipo sugerido (lo confirma el usuario en Insights) y las dos luces propias posibles, para que la lógica elija según el tipo
      sug: sugDe(d && d.propia), larga: !!(d && d.propia && d.propia.span >= 30), ...(propia !== undefined ? { lp: d.propia.idxPropio ?? 'e', ...(d.propia.tipo === 'temporada' ? { lt: d.propia.idxTemporada ?? 'e' } : {}) } : {}),
      imp: o.i, vw: o.vw, rea: o.r, xr: o.xr, xg: o.xg, alc: alcanceDe(alcRows.filter((a) => a.com === com && a.f >= per.desde && a.f <= per.hasta)),
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
    const porPub = {}; for (const r of rs) (porPub[`${r.cod}|${r.red}`] = porPub[`${r.cod}|${r.red}`] || []).push(r);
    const pubs = Object.values(porPub).map((xs) => filaPub(xs, per)).filter((p) => (p.gasto >= 20000 || p.imp >= 20000) && !/^Sin C[oó]digo/i.test(p.name)).sort((a, b) => b.gasto - a.gasto).slice(0, 100);
    // audiencia → campaña → pieza (Meta, del cruce mensual): meses del período
    const mesesPer = [...new Set(rs.map((r) => r.f.slice(0, 7)))];
    const audCods = Object.values(cruceRows.filter((r) => mesesPer.includes(r.mes)).reduce((m, r) => { const k = `${r.aud}|${r.com}|${r.cod}`; const o = m[k] = m[k] || { aud: r.aud, com: r.com, cod: r.cod, name: limpio(nombreCont(r.cont), r.com), codes: {}, g: 0, i: 0, r: 0, vw: 0, xr: 0, xg: 0 }; o.g += r.g; o.i += r.i; o.r += r.r; o.vw += r.vw; o.xr += r.xr; o.xg += r.xg; o.codes[codPlac(r.pl)] = (o.codes[codPlac(r.pl)] || 0) + r.g; return m; }, {}))
      .filter((x) => x.g >= 15000).map((x) => ({ ...x, g: Math.round(x.g), xr: Math.round(x.xr), xg: Math.round(x.xg), codes: Object.entries(x.codes).sort((a, b) => b[1] - a[1]).map(([c]) => c), pieza: { ...(piezas[x.cod] || {}), nombre: x.name } }));
    // activo → campaña → audiencia: Meta con sus audiencias (cruce mensual); el resto de plataformas, una fila por red
    const actAud = {};
    for (const r of cruceRows.filter((r) => mesesPer.includes(r.mes))) { const k = `${r.voz}|${r.com}|${r.aud}`; const o = actAud[k] = actAud[k] || { voz: r.voz, com: r.com, cod: r.aud, name: r.aud, codes: {}, g: 0, i: 0, r: 0, vw: 0, xr: 0, xg: 0 }; o.g += r.g; o.i += r.i; o.r += r.r; o.vw += r.vw; o.xr += r.xr; o.xg += r.xg; o.codes[codPlac(r.pl)] = (o.codes[codPlac(r.pl)] || 0) + r.g; }
    for (const r of rs.filter((r) => !esMeta(r))) { const red = RED_NOMBRE[r.red] || r.red, k = `${r.voz}|${r.com}|${red}`; const o = actAud[k] = actAud[k] || { voz: r.voz, com: r.com, cod: red, name: red + ' (sin audiencia)', codes: {}, g: 0, i: 0, r: 0, vw: 0, xr: 0, xg: 0 }; o.g += r.g; o.i += r.i; o.r += r.r; o.vw += r.vw; o.xr += r.xr || 0; o.xg += r.xg || 0; o.codes[r.code] = (o.codes[r.code] || 0) + r.g; }
    const actCods = Object.values(actAud).filter((x) => x.g >= 15000).map((x) => ({ ...x, g: Math.round(x.g), xr: Math.round(x.xr), xg: Math.round(x.xg), codes: Object.entries(x.codes).sort((a, b) => b[1] - a[1]).map(([c]) => c) }));
    // cuántos contenidos distintos publicó cada activo en el período: por activo y por activo × campaña (columnas de la pestaña Activos)
    const contSet = {};
    for (const r of rs) { if (!r.cod || /^Sin C[oó]digo/i.test(r.cont || '')) continue; (contSet[r.voz] = contSet[r.voz] || new Set()).add(r.cod); (contSet[`${r.voz}|${r.com}`] = contSet[`${r.voz}|${r.com}`] || new Set()).add(r.cod); }
    const actN = Object.fromEntries(Object.entries(contSet).map(([k, v]) => [k, v.size]));
    porPeriodo[per.id] = { campRows, pubs, audCods, actCods, actN };

  }

  // campañas con detalle (pantalla de campaña): desde el borrador
  const campanas = {};
  for (const c of b.campanas) {
    const rs = rowsAll.filter((r) => r.com === c.id && r.f >= addDias(datosHasta, -179));
    const o = sumaT(rs), ix = idxDe(o), obj = c.obj || objDominante(rs.length ? rs : [{ obj: 'Alcance', g: 1 }]);
    const pr = c.propia;
    const prop = pr ? (pr.tipo === 'temporada' ? pr.idxTemporada : pr.idxPropio) ?? 'e' : undefined;
    const kv = (x) => (x == null ? null : r2(x));
    const kp = (m) => { const i = m.i || 0; return { cpm: i ? m.g / i * 1000 : null, cr: m.r ? m.g / m.r : null, treac: i ? m.r / i * 100 : null, tcomp: i ? m.sh / i * 100 : null, etr: i ? m.e / i * 100 : null, ctr: i ? m.c / i * 100 : null }; };
    const k = kp(c.m), G = c.m, ixM = (num_, den) => (den ? kv(num_ / den) : null);
    // lv = valor numérico de la métrica contra la que se comparan las luces de la tarjeta (la lógica arma "27 % más barato que lo normal ($52)")
    const tiles = [
      { label: 'Impresiones', val: fmtN(G.i), lv: k.cpm, l: [ixM(G.xg, G.g), ixM(G.pg, G.g)], small: `${M(G.g)} en Meta · 180 días` },
      ...(() => { const alc = alcanceDe(alcRows.filter((a) => a.com === c.id)); return [{ label: 'Alcance diario acumulado', val: alc ? fmtN(alc) : '—', l: [null, null], small: alc ? `frecuencia diaria ${(G.i / alc).toLocaleString('es-AR', { maximumFractionDigits: 1 })}` : 'sin dato de alcance',
        alcM: alcMeta({ nivel: 'comunicacion', cliente: cli, canal, comunicacion: c.id }, ['desde_inicio', 'ultimos_7', 'ultimos_30']) }]; })(),
      { label: 'Costo por reacción', val: fmtCosto(k.cr), lv: k.cr, kpi: obj === 'Interacción', l: [ixM(G.r / (G.xr || 1) * (G.xg || 0), G.g), ixM(G.r / (G.pr || 1) * (G.pg || 0), G.g), ...(obj === 'Interacción' && prop !== undefined ? [prop] : [])], small: `${fmtN(G.r)} reacciones` },
      { label: 'CPM', val: fmtCosto(k.cpm), lv: k.cpm, kpi: obj === 'Alcance', l: [ixM(G.xg, G.g), ixM(G.pg, G.g), ...(obj === 'Alcance' && prop !== undefined ? [prop] : [])], small: 'costo cada mil impresiones' },
      { label: 'Tasa de reacción', val: pctT(k.treac, 2), lv: k.treac, l: [ixM(G.r, G.xr), ixM(G.r, G.pr)], small: `${fmtN(G.r)} reacciones` },
      { label: 'Tasa de compartido', val: pctT(k.tcomp, 3), lv: k.tcomp, l: [ixM(G.sh, G.xsh), ixM(G.sh, G.psh)], small: `${fmtN(G.sh)} compartidas` },
      { label: 'CTR', val: pctT(k.ctr, 2), lv: k.ctr, kpi: obj === 'Tráfico', l: [ixM(G.c, G.xc), ixM(G.c, G.pc), ...(obj === 'Tráfico' && prop !== undefined ? [prop] : [])], small: `${fmtN(G.c)} clicks` },
    ];
    const conts = (c.contenidos || []).slice().sort((a, b) => (b.hasta || '').localeCompare(a.hasta || '') || b.g - a.g).map((x) => { const kx = kp(x); const sh = x.r >= 300 ? x.sh / x.r * 100 : 0, co = x.r >= 300 ? x.co / x.r * 100 : 0;
      return { cod: x.k, name: limpio(x.nombre, c.id), formato: fmtCorto(x.fmt), fechas: `${dmy(x.desde)} – ${dmy(x.hasta)}`, sen: [...(sh >= 10.2 ? ['c'] : []), ...(co >= 13.4 ? ['k'] : [])], gasto: x.g, dias: dias(x.desde, x.hasta) + 1,
        cxr: x.soloStories ? null : kx.cr, cxrT: x.soloStories ? 'Stories: sin reacciones' : fmtCR(kx.cr), g: x.crG, ef: efV(x.efi), comp: kx.tcomp, ret: x.vw >= 500 ? Math.round(x.v25 / x.vw * 100) : null, alc: alcanceDe(alcRows.filter((a) => a.com === c.id && a.cod === x.k)), alcM: alcMeta({ nivel: 'contenido', cliente: cli, canal, codigo: x.k }, ['desde_inicio', 'ultimos_7']), pieza: { ...piezaDe(x.k), nombre: limpio(x.nombre, c.id) } }; });
    const auds = (c.audiencias || []).map((a) => ({ name: a.k, kpi: kpiDe(a, obj, []).kpi, l: [a.idxG, a.idxP], ef: efV(a.efi), cxr: a.r ? fmtCR(a.g / a.r) : '—', cob: '—' }));
    const voces = c.voces.map((v) => ({ name: v.k, gasto: M(v.g), auto: v.auto }));
    const plc = (c.porPl || []); const totPl = plc.reduce((s, p) => s + p.g, 0) || 1;
    campanas[c.id] = { id: c.id, name: c.nombre, obj, eje: c.eje || '', fechas: `${dmy(c.desde)} – ${dmy(c.fin || c.hasta)}`, estado: c.estado, ec: c.estado === 'Por vencer' ? 'y' : c.estado === 'Sin entrega' ? 'r' : '',
      tag: pr ? (pr.tipo === 'temporada' ? 'estacional' : 'campaña larga') : '', plats: plats(rs), spark: c.serie || [], ...kpiDe(o, obj, rs), tiles,
      ef: efV(c.efi), demas: c.deMas > 100000 ? M(c.deMas) : '',
      hist: pr ? { semanas: pr.semanas, ref: pr.ref || null, idx: prop, span: pr.span, tendencia: pr.tendencia ?? null, presion: pr.presion ?? null, presionAcum: pr.presionAcum ?? null, temporada: pr.tipo === 'temporada', previa: pr.previa || null, idxPropio: pr.idxPropio ?? null, idxTemporada: pr.idxTemporada ?? null, sug: sugDe(pr), sem52: pr.sem52 || 0 } : null,
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
  const deJuegos = (c) => c.voces.filter((v) => TERMINAN.includes(v.k)).reduce((s, v) => s + v.g, 0) >= (c.m.g || 1) * 0.5;
  const conPresu = b.plat && b.plat.proyectos.length ? b.plat.proyectos : null;
  return { canal, alcM: alcMeta({ nivel: 'cliente', cliente: cli, canal }, ['mes_en_curso', 'ultimos_7', 'ultimos_30']), tarjeta: { g: t.luzG, p: t.luzP, gastado: conPresu ? conPresu.reduce((s, x) => s + x.gastado, 0) : t.gastado, presu: t.presu, cierre: t.cierre, vivas: t.vivas, porVencer: t.porVencer, pedidoCargado: t.pedidoCargado !== false,
      demas: b.campanas.filter((c) => ['Activa', 'Por vencer'].includes(c.estado) && !deJuegos(c)).reduce((s, c) => s + (c.deMas > 0 ? c.deMas : 0), 0), nAcc: acciones.length },
    budgets: (b.plat ? b.plat.proyectos : []).map((x) => ({ name: x.proy, presu: x.presu, gastado: x.gastado, ritmo: x.ritmo, proyeccion: x.proyeccion, acum: x.acum, imp: impAcum(b, x.proy) })),
    diaAct: b.plat ? b.plat.diaAct : Number(datosHasta.slice(8, 10)), diasMes: b.plat ? b.plat.diasMes : 30, mesAnt: b.plat ? MESES_TXT[b.plat.meses[1].slice(5)] : '',
    bad: b.campanas.filter((c) => ['Activa', 'Por vencer'].includes(c.estado) && !deJuegos(c) && (c.luzG === 'rojo' || c.luzP === 'rojo' || (c.propia && luz(c.propia.idx, c.obj) === 'rojo'))).sort((x, y) => (y.deMas || 0) - (x.deMas || 0)).slice(0, 5)
      .map((c) => { const cd = campanas[c.id]; const acc = pend.find((a) => a.camp === c.id); return { id: c.id, name: c.nombre, meta: `${cd.obj} · Eje ${c.eje || '—'} · ${M(c.g7)} en 7 días`, demas: c.deMas > 0 ? M(c.deMas) : '', ef: efV(c.efi), kpiLabel: cd.kpiL, kpi: cd.kpi, l: [c.idxG, c.idxP, ...(c.propia ? [(c.propia.tipo === 'temporada' ? c.propia.idxTemporada : c.propia.idxPropio) ?? 'e'] : [])], accion: acc ? acc.hacer : 'Sin acción sugerida', plats: cd.plats }; }),
    periodos: porPeriodo, campanas, anuncios,
    activos: b.activos.map((a) => { const pl = (plataformasPor[`${canal}|${cli}`] || []).filter((r) => r.voz === a.nombre && r.f >= MES + '-01'); const m = {}; for (const r of pl) { const code = COD_NOMBRE[r.red] || codigoRed(r.red); if (code !== 'OT') m[code] = (m[code] || 0) + r.g; }
      const codes = Object.entries(m).sort((x, y) => y[1] - x[1]).map(([code]) => chip(code));
      const camps = a.vivas.map((n) => campanas[n]).filter(Boolean);
      const pk = a.pico; const ritmo = !pk || pk.idx == null ? ['Sin gasto reciente', ''] : [`${pk.estado ? pk.estado + ': gasta' : 'Gasta'} ${Math.round(pk.idx * 100)} % de lo habitual`, pk.estado === 'Apagón' ? 'r' : pk.estado ? 'y' : ''];
      return { name: a.nombre, plats: codes, auto: a.auto, pedidoCargado: a.pedidoCargado !== false, pedido: a.pedidoCargado !== false && a.pedido ? a.pedido / 1e6 : null, gastado: a.gastado / 1e6, camps: a.vivas.slice(0, 3).join(', ') + (a.vivas.length > 3 ? '…' : ''), campIds: a.vivas, n: a.vivas.length, g7: M(a.g7), ritmo, l: [a.idxG, a.idxP] }; }),
    acciones, insights: { vs: b.insights.cruces.map((c) => ({ c: c.alerta ? 'y' : 'g', a: c.aprendizaje, b: c.ahora })),
      ef: b.insights.eficacia ? [{ title: 'Por eje', rows: b.insights.eficacia.ejes.map((x) => [x.k, x.pctGastoRojo, x.rojos, x.n, M(x.g)]) }, { title: 'Por formato', rows: b.insights.eficacia.formatos.map((x) => [x.k, x.pctGastoRojo, x.rojos, x.n, M(x.g)]) }, { title: 'Por audiencia', rows: b.insights.eficacia.audiencias.map((x) => [corto(x.k, 40), x.pctGastoRojo, x.rojos, x.n, M(x.g)]) }] : [],
      // campañas a categorizar: constantes (activas la mitad del año o más) y estacionales (misma época del año anterior)
      season: b.campanas.filter((c) => c.propia && (c.propia.constante || c.propia.tipo === 'temporada')).sort((x, y) => (y.propia.sem52 || 0) - (x.propia.sem52 || 0))
        .map((c) => ({ id: c.id, name: c.id, sug: c.propia.constante ? 'constante' : 'estacional', sem52: c.propia.sem52 || 0, larga: c.propia.span >= 30,
          previa: c.propia.previa ? `temporada anterior desde el ${dmy(c.propia.previa.desde)}/${c.propia.previa.desde.slice(2, 4)} (${c.propia.previa.semanasComparadas} ${c.propia.previa.semanasComparadas === 1 ? 'semana comparada' : 'semanas comparadas'})` : '' })),
      propios: b.insights.proyecto.map((i) => [i.titulo + '. ' + i.texto, 'Último año']) } };
}
const fmtN = (n) => { n = n || 0; return n >= 1e6 ? (n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' M' : n >= 1e4 ? Math.round(n / 1e3).toLocaleString('es-AR') + ' K' : Math.round(n).toLocaleString('es-AR'); };
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
const APP = { nombres: NOMBRE_COD, logos: LOGOS, lookers: LOOKERS, datosHasta, mes: MES, mesTxt: MESES_TXT[MES.slice(5)], periodos: PERIODOS.map(({ id, label, txt, mes }) => ({ id, label, txt, mes: !!mes })), proyectos, generales: GEN,
  bandasPlat: Object.fromEntries(Object.entries(bandasPlat.G).map(([k, v]) => [k, v.map((x) => r2(x))])), umbralesLlegada: DATA.umbralesLlegada, reglas: REGLAS,
  // pedidoCargado = false: la planilla de presupuestos no tiene pedidos del mes → "Sin pedido cargado" en gris, sin restante ni alerta
  pedidoCargado: DATA.pedidoCargado !== false,
  // lectura de alcance de Meta de hoy: estado (ok / parcial / sin_dato_de_hoy), fecha y motivo (regla A3)
  alcanceMeta: { estado: ALCM.estado, fecha: ALCM.fecha, motivo: ALCM.motivo || null } };

// ---------- inyectar en el bundle del diseño ----------
const html = fs.readFileSync(DISENO, 'utf8');
const m = html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/);
let template = JSON.parse(m[1]);
const logica = fs.readFileSync(path.join(__dirname, 'logica.js'), 'utf8');
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
  template = template.replace(desde, () => hasta); n++; // función: así los "$" del reemplazo no se interpretan como patrones
}
// el template va como JSON adentro de un <script>: los "</script>" internos se escapan como "<\/script>" (JSON válido) para no cortar el HTML
const salida = html.replace(m[0], () => `<script type="__bundler/template">${JSON.stringify(template).replace(/<\//g, '<\\/')}</script>`).replace('<title>Bundled Page</title>', '<title>Seguimiento y Optimización</title>');
fs.writeFileSync(SALIDA, salida);
// repositorio de recomendaciones (lo guarda redaccion.js)
redaccion.guardarRepositorio(proyectos, datosHasta);
for (const p of proyectos) for (const [c, b] of Object.entries(p.canales)) console.log(`${p.nombre.padEnd(20)} ${c.padEnd(11)} campañas ${Object.keys(b.campanas).length} · períodos ${Object.keys(b.periodos).length} · activos ${b.activos.length} · acciones ${b.acciones.length} (con conjuntos ${b.acciones.filter((a) => a.afectado.conjuntos.length).length})`);
console.log(`reglas vigentes ${REGLAS.reglas.length} · en observación ${REGLAS.observacion.length} (${REGLAS.observacion.map((o) => o.nombre).join(', ')})`);
console.log(`alcance de Meta (${ALCM.fecha}): ${ALCM.estado}${ALCM.motivo ? ' · ' + ALCM.motivo : ''} · filas válidas ${Object.values(ALCM.niveles || {}).reduce((s, x) => s + x.length, 0)} · descartadas ${(ALCM.descartadas || []).length}`);
console.log(`bandas por plataforma: ${Object.keys(bandasPlat.G).join(', ')}`);
console.log(`parches aplicados ${n}/${parches.length} · ${Math.round(salida.length / 1024)} KB → ${SALIDA}`);
