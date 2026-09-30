// Motor de reglas: convierte las filas de BigQuery en lo que muestra la interfaz
// (panel, detalle de campaña, recomendaciones). Reglas en ../../documentos/reglas-recomendador.md (v0.2).
const crypto = require('crypto');

const DIA = 24 * 60 * 60 * 1000;
const GEO_TXT = { provincia: 'provincia', ciudad: 'ciudad', departamento: 'departamento', sin_geo: 'sin geografía', multi_localidad: 'lista de localidades', custom: 'personalizada', nacional: 'nacional', barrio: 'barrio', zona: 'zona', codigo: 'código', otro: 'otra geografía' };
const geoTxt = (g) => GEO_TXT[g] || g || 'sin dato';
function nombreContenido(c, comunic) {
  let n = String(c.contenido_n || c.conjunto || '').replace(/\s*\([^()]*\)\s*$/, '').trim();
  if (comunic && n.toLowerCase().startsWith(String(comunic).toLowerCase())) n = n.slice(comunic.length).trim();
  n = n.replace(/^[\s"“”]+|[\s"“”]+$/g, '').trim();
  return n || String(c.contenido_n || c.conjunto || '');
}
const PISO_PCT = 0.8;
const MIN_IMPRESIONES = 5000;   // piso de volumen para rankings
const MIN_IMPR_RECO = 10000;    // piso para recomendar sobre rendimiento
const MIN_DIAS_LECTURA = 5;     // lectura temprana: nada antes del día 5
const UMBRAL_VALOR = 100000;    // no recomendar por menos de $100 mil
const FATIGA_DIAS = { 'Placa Fija': 12, Carrusel: 12, Video: 15, Stories: 12, otro: 14 };
const PRESION_AVISO = 60, PRESION_ALERTA = 80;
const ORDEN_ESTADO = ['Activa', 'Por vencer', 'Sin entrega', 'Programada', 'Agotada', 'Terminada'];

// ---------- formato es-AR ----------
const fmtInt = (n) => Math.round(Number(n) || 0).toLocaleString('es-AR');
const money = (n) => '$' + fmtInt(n);
const moneyM = (n) => Math.abs(n) >= 1e6 ? '$' + (n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' M' : money(n);
const fx = (v) => (v == null || !isFinite(v)) ? '—' : (v < 0.1 ? v.toFixed(2) : v.toFixed(1)).replace('.', ',');
const pct = (v) => Math.round(v);
const fechaCorta = (iso) => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—';
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const hash = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 10);
const num = (v) => (v == null || v === '' ? null : Number(v));
const diasEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / DIA);
const sumBy = (xs, f) => xs.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const wmean = (xs, fv, fw) => { let s = 0, w = 0; for (const x of xs) { const v = fv(x), p = fw(x); if (v != null && isFinite(v) && p > 0) { s += v * p; w += p; } } return w > 0 ? s / w : null; };

const UNIDAD = {
  'Interacción': { res: 'reacciones', costo: 'por reacción', metrica: 'Reacciones por mil impresiones' },
  'Tráfico': { res: 'clics', costo: 'por clic', metrica: 'Costo por clic' },
  'Alcance': { res: 'impresiones', costo: 'CPM', metrica: 'CPM' },
  'Impresiones': { res: 'impresiones', costo: 'CPM', metrica: 'CPM' },
};
const unidad = (obj) => UNIDAD[obj] || UNIDAD.Alcance;

function normalizarFormato(raw, contenido) {
  let f = raw && raw !== 'Sin Formato' ? raw : ((contenido || '').match(/\(([^()]+)\)\s*$/) || [])[1] || '';
  const u = f.toLowerCase();
  if (/video|v[ií]deo|spot|reel|bumper|shorts|testimonio/.test(u)) return 'Video';
  if (/carrusel|carousel/.test(u)) return 'Carrusel';
  if (/placa|plca|palca|flyer|imagen|banner|foto|^pf$|display/.test(u)) return 'Placa Fija';
  if (/stor/.test(u)) return 'Stories';
  return 'otro';
}

function ubicacion(c) {
  const p = `${c.placement_n || ''} ${c.conjunto || ''}`.toLowerCase();
  const red = (c.red_n || '').toLowerCase();
  if (/reel/.test(p)) return 'IG Reels';
  if (/stor/.test(p)) return 'Stories';
  if (red.includes('instagram') || red === 'ig') return 'IG Feed';
  if (red.includes('facebook') || red === 'fb') return 'FB Feed';
  return 'FB/IG Feed';
}

function geoAudiencia(nombre) {
  const x = (nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/army|votantes|base de|lookalike|similar|seguidores|retarget|remarketing|lista|\bau_/.test(x)) return 'custom';
  if (/\bciudad\b|\bcapital\b|localidad|municipalidad|rosario/.test(x)) return 'ciudad';
  if (/departamento|depto/.test(x)) return 'departamento';
  if (/provincia|\bprov\b|pcia|open|^(santa fe|catamarca|chaco|chubut|corrientes|tierra del fuego)\b/.test(x)) return 'provincia';
  if (x.includes(',') || x.split(' ').length >= 6) return 'multi_localidad';
  return 'otro';
}

// ---------- conjuntos ----------
function estadoConjunto(c, hoy) {
  if (c.inicio_d && c.inicio_d > hoy) return 'Programada';
  const quedan = c.fin_d ? diasEntre(hoy, c.fin_d) : null;
  if (c.gasto_2d > 0) return quedan != null && quedan <= 3 ? 'Por vencer' : 'Activa';
  if (c.presupuesto_n > 0 && c.gastado >= 0.98 * c.presupuesto_n) return 'Agotada';
  if (c.fin_d && c.fin_d >= hoy && c.presupuesto_n > 0) return 'Sin entrega';
  return 'Terminada';
}

const FORMATO_G = { Video: 'video', 'Placa Fija': 'placa_fija', Carrusel: 'carrusel', Stories: 'sin_formato', otro: 'sin_formato' };
const MIN_BENCH = 8;

// Comparable del benchmark semanal: nivel 4 (objetivo+formato+geo+seg) con el formato propio, después con 'sin_formato'
// (el benchmark clasifica por la columna Formato, que viene vacía en el 80 % del gasto), después nivel 2 y nivel 1.
function comparable(c, bench) {
  if (!bench || !bench.length) return null;
  const obj = c.objetivo_n, fg = FORMATO_G[c.formato] || 'sin_formato';
  const buscar = (f) => bench.find((b) => Number(b.n_ads_ok) >= MIN_BENCH && b.objetivo === obj && b.nivel == 4 && b.formato_g === fg && b.aud_geo === c.aud_geo && b.aud_seg === c.aud_seg && f(b));
  const cand = [
    buscar(() => true), bench.find((b) => Number(b.n_ads_ok) >= MIN_BENCH && b.objetivo === obj && b.nivel == 4 && b.formato_g === 'sin_formato' && b.aud_geo === c.aud_geo && b.aud_seg === c.aud_seg),
    bench.find((b) => Number(b.n_ads_ok) >= MIN_BENCH && b.objetivo === obj && b.nivel == 2 && b.formato_g === fg),
    bench.find((b) => Number(b.n_ads_ok) >= MIN_BENCH && b.objetivo === obj && b.nivel == 1),
  ].filter(Boolean);
  if (!cand.length) return null;
  const b = cand[0];
  return { n: Number(b.n_ads_ok), nivel: Number(b.nivel), cpm_p50: num(b.cpm_p50), rea_p50: num(b.rea_p50), cpc_p50: num(b.cpc_p50) };
}

function prepararConjuntos(filas, alertas, canal, hoy, cuentas, bench) {
  // alertas: nivel anuncio → por conjunto (ponderado por gasto de 7 días)
  const porConjunto = new Map();
  for (const a of alertas) {
    const k = a.conjunto;
    if (!porConjunto.has(k)) porConjunto.set(k, []);
    porConjunto.get(k).push(a);
  }
  return filas.map((f) => {
    const c = { ...f, canal };
    for (const k of ['presupuesto_n', 'gastado', 'impresiones_tot', 'reacciones_tot', 'clicks_tot', 'dias_activos', 'gasto_2d', 'gasto_7d', 'impresiones_7d', 'clicks_7d', 'reacciones_7d']) c[k] = Number(c[k]) || 0;
    c.formato = normalizarFormato(c.formato_raw, c.contenido_n);
    c.ubicacion = ubicacion(c);
    c.estado = estadoConjunto(c, hoy);
    c.dias_restantes = c.fin_d ? Math.max(0, diasEntre(hoy, c.fin_d)) : null;
    c.restante = c.presupuesto_n > 0 ? Math.max(0, c.presupuesto_n - c.gastado) : null;
    const al = porConjunto.get(c.conjunto) || [];
    c.x_cpm = wmean(al, (a) => num(a.x_mediana_cpm), (a) => Number(a.gasto_7d) || 1);
    c.x_rea = wmean(al, (a) => num(a.x_mediana_reacciones), (a) => Number(a.gasto_7d) || 1);
    c.bench_n = al.length ? Math.max(...al.map((a) => Number(a.benchmark_muestra) || 0)) : 0;
    c.bench_nivel = al.length ? al[0].benchmark_nivel : null;
    c.aud_geo = al.length && al[0].aud_geo ? al[0].aud_geo : geoAudiencia(c.audiencia_n);
    c.aud_seg = al.length && al[0].aud_seg ? al[0].aud_seg : (geoAudiencia(c.audiencia_n) === 'custom' ? 'custom' : 'abierta');
    const cpm7 = c.impresiones_7d > 0 ? c.gasto_7d / c.impresiones_7d * 1000 : null;
    const rea7 = c.impresiones_7d > 0 ? c.reacciones_7d / c.impresiones_7d * 1000 : null;
    c.cpm_p50 = cpm7 && c.x_cpm ? cpm7 / c.x_cpm : null;
    c.rea_p50 = rea7 && c.x_rea ? rea7 / c.x_rea : null;
    // sin alerta diaria (la mayoría: el chequeo solo mira conjuntos con $40 mil/semana), el comparable sale del benchmark semanal
    if (!al.length) {
      const cmp = comparable(c, bench);
      if (cmp) {
        c.cpm_p50 = cmp.cpm_p50; c.rea_p50 = cmp.rea_p50; c.bench_n = cmp.n; c.bench_nivel = `nivel ${cmp.nivel}`;
        c.x_cpm = cpm7 && cmp.cpm_p50 ? cpm7 / cmp.cpm_p50 : null;
        c.x_rea = rea7 != null && cmp.rea_p50 ? rea7 / cmp.rea_p50 : null;
      }
    }
    // eficiencia contra la mediana (>1 = mejor): reacciones por mil en Interacción, CPM invertido en el resto
    c.veces = c.objetivo_n === 'Interacción' ? c.x_rea : (c.x_cpm ? 1 / c.x_cpm : null);
    c.costo_p50 = c.objetivo_n === 'Interacción' ? (c.cpm_p50 && c.rea_p50 ? c.cpm_p50 / c.rea_p50 : null) : c.cpm_p50;
    c.via = cuentas && cuentas[c.activo_n] === 'app' ? 'api' : 'manual';
    c.alertas_txt = al.map((a) => a.alertas).filter(Boolean).join(', ');
    return c;
  });
}

function resultadoDe(c, objetivo, suf) {
  const o = objetivo || c.objetivo_n;
  return o === 'Interacción' ? c[`reacciones_${suf}`] : o === 'Tráfico' ? c[`clicks_${suf}`] : c[`impresiones_${suf}`];
}
function costoTxt(gasto, resultado, objetivo) {
  if (!resultado) return '—';
  const u = unidad(objetivo);
  return u.costo === 'CPM' ? `${money(gasto / resultado * 1000)} CPM` : `${money(gasto / resultado)} ${u.costo}`;
}

// ---------- campañas ----------
function armarCampana(comunic, conjs, series, hoy, ctx) {
  const vivos = conjs.filter((c) => ['Activa', 'Por vencer', 'Sin entrega'].includes(c.estado));
  const canales = [...new Set(conjs.map((c) => c.canal))].sort((a, b) => (a === 'Oficial' ? -1 : 1));
  const top = (f) => { const m = new Map(); for (const c of conjs) { const k = f(c) || ''; m.set(k, (m.get(k) || 0) + c.gastado); } return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || ''; };
  const objetivo = top((c) => c.objetivo_n) || 'Alcance';
  const u = unidad(objetivo);
  const estado = ORDEN_ESTADO.find((e) => conjs.some((c) => c.estado === e)) || 'Terminada';
  const conPresu = conjs.filter((c) => c.presupuesto_n > 0);
  const presupuesto = sumBy(conPresu, (c) => c.presupuesto_n);
  const gastado = sumBy(conjs, (c) => c.gastado);
  const gasto7 = sumBy(conjs, (c) => c.gasto_7d);
  const inicio = conjs.map((c) => c.inicio_d || c.primer_dia).filter(Boolean).sort()[0] || null;
  const fin = conjs.map((c) => c.fin_d).filter(Boolean).sort().slice(-1)[0] || null;
  const diasRest = fin ? Math.max(0, diasEntre(hoy, fin)) : null;
  const plazoTot = inicio && fin ? Math.max(1, diasEntre(inicio, fin) + 1) : null;
  const plazoPct = plazoTot ? Math.min(100, Math.max(0, (diasEntre(inicio, hoy) + 1) / plazoTot * 100)) : null;
  const gastPct = presupuesto > 0 ? gastado / presupuesto * 100 : null;
  const res7 = sumBy(conjs, (c) => resultadoDe(c, objetivo, '7d'));
  const resTot = sumBy(conjs, (c) => resultadoDe(c, objetivo, 'tot'));
  const veces = wmean(conjs, (c) => c.veces, (c) => c.gasto_7d || c.gastado);
  const costoP50 = wmean(conjs, (c) => c.costo_p50, (c) => c.gasto_7d || c.gastado);
  const benchN = Math.max(0, ...conjs.map((c) => c.bench_n));

  // ritmo
  let ritmo = 'En ritmo', proyeccion = '';
  if (gastPct != null && plazoPct != null && plazoPct >= 15 && plazoPct <= 95) {
    const r = gastPct / plazoPct;
    ritmo = r < 0.5 ? 'Subejecutada' : r > 1.15 ? 'Sobreejecutada' : 'En ritmo';
  }
  if (presupuesto > 0 && diasRest != null) {
    const diario = gasto7 / 7;
    const proyectado = gastado + diario * diasRest;
    if (estado === 'Sin entrega') proyeccion = `Sin entrega no hay proyección: ${money(presupuesto - gastado)} detenidos.`;
    else if (proyectado < presupuesto * 0.97) proyeccion = `${pct(gastPct)} % gastado con ${pct(plazoPct || 0)} % del plazo; termina con ${moneyM(presupuesto - proyectado)} sin gastar.`;
    else if (diario > 0 && (presupuesto - gastado) / diario < diasRest - 1) proyeccion = `Agota el presupuesto ${Math.round(diasRest - (presupuesto - gastado) / diario)} días antes del cierre (${fechaCorta(fin)}).`;
    else proyeccion = 'Termina con el presupuesto usado.';
  }

  // piso simulado (7.3)
  let piso = '—', pisoPct = null, esperadoFecha = null, esperadoTot = null;
  if (presupuesto > 0 && costoP50 && plazoPct != null) {
    esperadoTot = u.costo === 'CPM' ? presupuesto / costoP50 * 1000 : presupuesto / costoP50;
    const pisoTot = esperadoTot * PISO_PCT;
    esperadoFecha = pisoTot * plazoPct / 100;
    const proy = resTot + (res7 / 7) * (diasRest || 0);
    pisoPct = esperadoFecha > 0 ? resTot / esperadoFecha * 100 : null;
    piso = pisoPct == null ? '—' : pisoPct >= 100 && proy >= pisoTot ? 'En camino' : pisoPct >= 70 ? 'En riesgo' : 'No llega';
    if (pisoPct >= 100 && proy < pisoTot) piso = 'En riesgo';
  }

  // serie diaria (últimos 30 días)
  const dias = [];
  const porDia = new Map();
  for (const s of series) { const k = s.fecha; if (!porDia.has(k)) porDia.set(k, { gasto: 0, impresiones: 0, reacciones: 0, clicks: 0 }); const d = porDia.get(k); d.gasto += Number(s.gasto) || 0; d.impresiones += Number(s.impresiones) || 0; d.reacciones += Number(s.reacciones) || 0; d.clicks += Number(s.clicks) || 0; }
  const fechas = [...porDia.keys()].sort();
  const desdeSerie = fechas.length ? fechas[Math.max(0, fechas.length - 30)] : null;
  let gastoDiarioProm = 0;
  if (desdeSerie) {
    const ultimo = fechas[fechas.length - 1];
    for (let t = new Date(desdeSerie); t <= new Date(ultimo); t = new Date(t.getTime() + DIA)) {
      const k = t.toISOString().slice(0, 10);
      const d = porDia.get(k) || { gasto: 0, impresiones: 0, reacciones: 0, clicks: 0 };
      const res = objetivo === 'Interacción' ? d.reacciones : objetivo === 'Tráfico' ? d.clicks : d.impresiones;
      const cost = res > 0 ? (u.costo === 'CPM' ? d.gasto / res * 1000 : d.gasto / res) : 0;
      dias.push({ fecha: k, d: fechaCorta(k), res, cost, gasto: d.gasto });
    }
    gastoDiarioProm = sumBy(dias, (x) => x.gasto) / dias.length;
  }
  const medRes = costoP50 ? (u.costo === 'CPM' ? gastoDiarioProm / costoP50 * 1000 : gastoDiarioProm / costoP50) : null;

  // rankings
  const porCont = new Map();
  for (const c of conjs) { const k = c.codigo_cont || c.contenido_n || c.conjunto; if (!porCont.has(k)) porCont.set(k, []); porCont.get(k).push(c); }
  const cont = [...porCont.entries()].map(([k, cs]) => {
    const g7 = sumBy(cs, (c) => c.gasto_7d), i7 = sumBy(cs, (c) => c.impresiones_7d), r7 = sumBy(cs, (c) => resultadoDe(c, objetivo, '7d'));
    const v = wmean(cs, (c) => c.veces, (c) => c.gasto_7d || c.gastado);
    return { cod: cs[0].codigo_cont || '(sin código)', nombre: nombreContenido(cs[0], comunic), formato: cs[0].formato, i7, g7, r7, v, gastado: sumBy(cs, (c) => c.gastado), cs };
  });
  const contOk = cont.filter((x) => x.i7 >= MIN_IMPRESIONES && x.v != null);
  const contUI = contOk.map((x) => [x.cod, x.nombre, x.formato, `${fmtInt(x.r7)} ${u.res}`, costoTxt(x.g7, x.r7, objetivo), Number(x.v.toFixed(2)), money(x.gastado)]);
  const audOk = conjs.filter((c) => c.impresiones_7d >= MIN_IMPRESIONES && c.veces != null);
  const audUI = audOk.map((c) => [c.codigo_cont || '(sin código)', c.ubicacion, c.audiencia_n || '(sin audiencia)', (c.contenido_n || '').replace(/\s*\([^()]*\)\s*$/, ''), `${fmtInt(resultadoDe(c, objetivo, '7d'))} ${u.res}`, costoTxt(c.gasto_7d, resultadoDe(c, objetivo, '7d'), objetivo), Number(c.veces.toFixed(2)), c.via]);

  // insights
  const insights = [];
  if (canales.length === 2) {
    const porCanal = canales.map((ca) => { const cs = conjs.filter((c) => c.canal === ca); const g = sumBy(cs, (c) => c.gasto_7d), i = sumBy(cs, (c) => c.impresiones_7d), r = sumBy(cs, (c) => c.reacciones_7d); return { ca, g, cpm: i ? g / i * 1000 : 0, rm: i ? r / i * 1000 : 0 }; });
    const [a, b] = porCanal;
    if (a.g > 0 && b.g > 0) {
      const mejor = a.rm >= b.rm ? a : b, otro = mejor === a ? b : a;
      const barato = a.cpm <= b.cpm ? a : b;
      const texto = otro.rm > 0 ? `${mejor.ca} genera ${fx(mejor.rm / otro.rm)} veces las reacciones por mil de ${otro.ca}; ${barato.ca} tiene el CPM más barato (${money(barato.cpm)}).` : `${mejor.ca} concentra la respuesta; ${barato.ca} tiene el CPM más barato.`;
      insights.push({ tag: 'Cruce de canales', texto, rows: porCanal.map((x) => [x.ca, money(x.g), money(x.cpm), fx(x.rm)]) });
    }
  }
  // fatiga: por calendario (12/15 días según formato) y medida (tasa 7d vs primera semana); un solo insight por campaña
  const fatigados = [];
  for (const x of cont) {
    const umbral = FATIGA_DIAS[x.formato] || FATIGA_DIAS.otro;
    const diasAct = Math.max(...x.cs.map((c) => c.dias_activos));
    const vivo = x.cs.some((c) => ['Activa', 'Por vencer'].includes(c.estado));
    if (!vivo) continue;
    const med = fatigaMedida(series.filter((s) => s.codigo_cont === x.cod));
    if (med && med.cae) fatigados.push({ medida: true, txt: `"${x.nombre}" (${x.cod}): tasa de reacción ${pct(med.caida * 100)} % abajo de su primera semana (${fx(med.base)} → ${fx(med.actual)} por mil)` });
    else if (diasAct >= umbral) fatigados.push({ medida: false, txt: `"${x.nombre}" (${x.cod}): ${diasAct} días activo (${x.formato.toLowerCase()}, umbral ${umbral})` });
  }
  if (fatigados.length) {
    const medidos = fatigados.filter((f) => f.medida), porCal = fatigados.filter((f) => !f.medida);
    const partes = [];
    if (medidos.length) partes.push(`Fatiga medida en ${medidos.length} contenido${medidos.length > 1 ? 's' : ''}: ${medidos.slice(0, 3).map((f) => f.txt).join('; ')}${medidos.length > 3 ? ` y ${medidos.length - 3} más` : ''}.`);
    if (porCal.length) partes.push(`Por calendario, ${porCal.length} contenido${porCal.length > 1 ? 's' : ''} ya pasó el día en que la mitad fatiga: ${porCal.slice(0, 3).map((f) => f.txt).join('; ')}${porCal.length > 3 ? ` y ${porCal.length - 3} más` : ''}.`);
    insights.push({ tag: 'Fatiga de creativo', texto: partes.join(' '), nota: 'Medida = la tasa de reacción móvil de 7 días cae 35 % contra la primera semana. Calendario = placa fija y carrusel 12 días, video 15.' });
  }
  // solapamiento geográfico (heurística)
  const prov = conjs.find((c) => c.aud_geo === 'provincia'), ciu = conjs.find((c) => c.aud_geo === 'ciudad');
  if (prov && ciu && prov.conjunto !== ciu.conjunto) insights.push({ tag: 'Posible solapamiento', texto: `"${prov.audiencia_n}" (${prov.codigo_cont || prov.conjunto}) y "${ciu.audiencia_n}" (${ciu.codigo_cont || ciu.conjunto}) compiten por parte del mismo público. Revisar antes de reforzar ambos a la vez.`, nota: 'Heurística por geografía: no mide superposición real de personas.' });
  // audiencias con historia en el proyecto (perfil_audiencia)
  const etiquetadas = [];
  for (const c of conjs) {
    const p = ctx.audienciasPerfil.find((a) => a.audiencia === c.audiencia_n && a.canal === c.canal && a.etiqueta !== 'normal');
    if (p && !etiquetadas.some((e) => e.audiencia === p.audiencia)) etiquetadas.push(p);
  }
  if (etiquetadas.length) insights.push({ tag: 'Audiencias con historia', texto: etiquetadas.slice(0, 3).map((p) => `"${p.audiencia}" es ${p.etiqueta} en este proyecto (${p.campanas} campañas, ${fx(Number(p.cpr_ratio))}× el costo mediano en ${p.eje}).`).join(' '), nota: 'Sale del perfil histórico del proyecto (perfil_audiencia).' });
  // sesgo del proyecto
  const sesgo = ctx.sesgo.filter((s) => canales.includes(s.canal));
  if (sesgo.length) {
    const p = wmean(sesgo, (s) => Number(s.pct_mediano) * 100, (s) => Number(s.campanas));
    if (p != null) insights.push({ tag: 'Perfil del proyecto', texto: `En los últimos 6 meses, las campañas de este proyecto quedaron en el percentil ${pct(p)} de sus comparables (50 = la mediana; más alto = más caro). Leer las "veces la mediana" de esta campaña con ese piso.`, nota: `${sumBy(sesgo, (s) => s.campanas)} campañas cerradas en perfil_campana.` });
  }
  // calidad
  const sinCod = conjs.filter((c) => !c.codigo_cont).length, sinPres = vivos.filter((c) => !(c.presupuesto_n > 0)).length, sinEje = conjs.filter((c) => !c.eje_n || /sin codigo/i.test(c.eje_n)).length;
  const calidad = [];
  if (sinCod) calidad.push(`${sinCod} conjunto${sinCod > 1 ? 's' : ''} sin código de contenido: no entra${sinCod > 1 ? 'n' : ''} al ranking de contenidos.`);
  if (sinPres) calidad.push(`${sinPres} conjunto${sinPres > 1 ? 's' : ''} sin presupuesto asignado: no se puede calcular el ritmo.`);
  if (sinEje) calidad.push(`${sinEje} conjunto${sinEje > 1 ? 's' : ''} sin eje.`);
  if (!costoP50 && vivos.length) calidad.push('Sin benchmark comparable todavía: el piso y las "veces la mediana" no se calculan.');
  if (calidad.length) insights.push({ tag: 'Calidad de datos', texto: calidad.join(' ') });
  if (['Alcance'].includes(objetivo)) insights.push({ tag: 'Calidad de datos', texto: 'Alcance y frecuencia todavía no llegan desde Meta: esta campaña se compara por impresiones.', nota: 'Pendiente de la API de Meta.' });

  // resumen del agente
  const peores = contOk.filter((x) => x.v < 0.5).length;
  let resumen;
  if (estado === 'Programada') resumen = `Empieza el ${fechaCorta(inicio)}. Todavía no hay datos para seguir.`;
  else if (estado === 'Sin entrega') resumen = `Dejó de entregar con ${money(presupuesto - gastado)} vigentes${veces ? `; hasta entonces rendía ${fx(veces)} veces la mediana` : ''}.`;
  else if (estado === 'Agotada' || estado === 'Terminada') resumen = `Usó el ${pct(gastPct || 100)} % del presupuesto y paró el ${fechaCorta(conjs.map((c) => c.ultimo_dia).sort().slice(-1)[0])}${pisoPct != null ? `; cerró con ${fx(pisoPct / 100)} veces el piso` : ''}.`;
  else {
    const partes = [];
    partes.push(ritmo === 'En ritmo' ? 'Gasta en ritmo' : ritmo === 'Subejecutada' ? 'Gasta más lento que el plazo' : 'Gasta más rápido que el plazo');
    if (pisoPct != null) partes.push(pisoPct >= 100 ? 'y va por encima del piso' : pisoPct >= 70 ? `y llega al ${pct(pisoPct)} % de lo esperado` : `pero genera ${pct(pisoPct)} % de lo esperado a la fecha`);
    else if (veces != null) partes.push(veces >= 1 ? `y rinde ${fx(veces)} veces la mediana` : `pero rinde ${fx(veces)} veces la mediana`);
    if (peores) partes.push(`; el problema está en ${peores} de sus ${contOk.length} contenidos`);
    resumen = partes.join(' ').replace(' ;', ';') + '.';
  }

  const kpi = estado === 'Programada' ? null : {
    resultado: fmtInt(res7), costo: costoTxt(gasto7, res7, objetivo), veces: veces != null ? Number(veces.toFixed(2)) : 0,
    pisoPct: pisoPct != null ? pct(pisoPct) : 0, acum: fmtInt(resTot), esp: esperadoFecha != null ? fmtInt(esperadoFecha) : '—',
    ritmo, gastPct: gastPct != null ? pct(gastPct) : 0, plazoPct: plazoPct != null ? pct(plazoPct) : 0, proyeccion: proyeccion || 'Sin presupuesto asignado: no hay proyección.',
    presu: presupuesto > 0 ? money(presupuesto) : '—', gastado: money(gastado), restante: presupuesto > 0 ? money(Math.max(0, presupuesto - gastado)) : '—', dias: diasRest != null ? String(diasRest) : '—',
  };
  const compCount = benchN || 0;
  const geo = top((c) => c.aud_geo), seg = top((c) => c.aud_seg), fmt = top((c) => c.formato);
  const bench = {
    veces: veces != null ? Number(veces.toFixed(2)) : 0,
    metrica: veces == null ? 'Sin comparable todavía.' : objetivo === 'Interacción'
      ? `Reacciones por mil impresiones: ${fx(sumBy(conjs, (c) => c.reacciones_7d) / Math.max(1, sumBy(conjs, (c) => c.impresiones_7d)) * 1000)} contra ${fx(wmean(conjs, (c) => c.rea_p50, (c) => c.gasto_7d || 1))} de la mediana. Costo por reacción: ${costoTxt(gasto7, res7, objetivo).replace(' por reacción', '')} contra ${money(costoP50 || 0)}.`
      : `CPM: ${money(sumBy(conjs, (c) => c.impresiones_7d) ? gasto7 / sumBy(conjs, (c) => c.impresiones_7d) * 1000 : 0)} contra ${money(costoP50 || 0)} de la mediana.`,
    comparable: compCount ? `${compCount} anuncios de ${objetivo}, ${fmt.toLowerCase()}, ${geoTxt(geo)}, audiencia ${seg}, últimas 13 semanas` : 'sin comparable con volumen suficiente',
  };

  return {
    id: slug(comunic), nombre: comunic, eje: top((c) => c.eje_n) || 'Sin eje', canales, estado: estado === 'Terminada' ? 'Agotada' : estado, piso, objetivo, gasto7,
    metaCamp: top((c) => c.campana_meta) || '—', resumen, kpi, bench,
    serie: { dias, medRes, medCost: costoP50 || null, unit: u }, cont: contUI, aud: audUI, insights,
    _conjs: conjs, _contOk: contOk, _presupuesto: presupuesto, _gastado: gastado, _diasRest: diasRest, _fin: fin, _ritmo: ritmo, _gastPct: gastPct, _plazoPct: plazoPct, _veces: veces, _costoP50: costoP50, _u: u, _inicio: inicio, _calidad: calidad,
  };
}

function fatigaMedida(serieCont) {
  const porDia = new Map();
  for (const s of serieCont) { const d = porDia.get(s.fecha) || { i: 0, r: 0 }; d.i += Number(s.impresiones) || 0; d.r += Number(s.reacciones) || 0; porDia.set(s.fecha, d); }
  const dias = [...porDia.entries()].filter(([, d]) => d.i > 0).sort((a, b) => a[0].localeCompare(b[0])).map(([, d]) => d);
  if (dias.length < 14) return null;
  const t = (xs) => { const i = sumBy(xs, (d) => d.i), r = sumBy(xs, (d) => d.r); return i ? r / i * 1000 : 0; };
  const base = t(dias.slice(0, 7)), actual = t(dias.slice(-7));
  if (!base || sumBy(dias, (d) => d.r) < 50) return null;
  return { base, actual, caida: 1 - actual / base, cae: actual < 0.65 * base };
}

// ---------- recomendaciones ----------
function recomendaciones(camp, hoy, ctx) {
  const out = [];
  const u = camp._u;
  const vivos = camp._conjs.filter((c) => ['Activa', 'Por vencer', 'Sin entrega'].includes(c.estado));
  const mejor = camp._conjs.filter((c) => c.veces != null && c.veces >= 1 && ['Activa', 'Por vencer'].includes(c.estado)).sort((a, b) => b.veces - a.veces)[0];
  const contNombre = (c) => `"${nombreContenido(c, camp.nombre)}" (${c.formato})`;
  const conjTxt = (c) => `${c.ubicacion} · ${c.audiencia_n || 'sin audiencia'}`;
  const conf = (c) => (c.bench_n >= 20 && c.dias_activos >= 5 ? 'Alta' : c.bench_n >= 8 && c.dias_activos >= 3 ? 'Media' : 'Baja');
  const vence = camp._fin ? fechaCorta(camp._fin) : fechaCorta(new Date(Date.now() + 14 * DIA).toISOString());
  const plata = (c) => (c.restante != null ? c.restante : c.gasto_7d * 2);
  const urgencia = (c) => 1 + Math.min(1, Math.max(0, 14 - (c.dias_restantes ?? 14)) / 14);
  const compTxt = (c) => c.bench_n ? `${c.bench_n} anuncios comparables de ${c.objetivo_n}, ${c.formato.toLowerCase()}, ${geoTxt(c.aud_geo)}, audiencia ${c.aud_seg}` : 'comparable general del objetivo';
  const guardia20 = 'Limitado a ±20 % para no reiniciar el aprendizaje de Meta';
  const push = (c, r) => {
    const valor = r.plata != null ? r.plata : plata(c);
    if (valor < UMBRAL_VALOR) return;
    const id = hash(`${ctx.proyectoId}|${camp.id}|${c.conjunto}|${r.tipo}`);
    out.push({ id, camp: camp.id, campNombre: camp.nombre, canal: c.canal, conjuntoKey: c.conjunto, activo: c.activo_n, contenidoCod: c.codigo_cont,
      _score: valor * (r.gravedad || 1) * urgencia(c), tipo: r.tipo, que: r.que, contenido: contNombre(c), conjuntos: r.conjuntos || [conjTxt(c)],
      porque: r.porque, gana: r.gana, via: r.via || c.via, pasos: r.pasos, seguridad: r.seguridad, confianza: r.confianza || conf(c), vence });
  };

  for (const c of vivos) {
    const res7 = resultadoDe(c, camp.objetivo, '7d');
    const diario = c.dias_activos ? c.gastado / c.dias_activos : c.gasto_7d / 7;
    // 1) entrega
    if (c.estado === 'Sin entrega') {
      push(c, { tipo: 'Revisar entrega', que: 'Revisar la entrega del conjunto', gravedad: 2, plata: c.restante || c.gasto_7d,
        porque: `No gastó en las últimas 48 h con ${money(c.restante || 0)} de presupuesto vigente y ${c.dias_restantes ?? '?'} días por delante.`,
        gana: `Recupera la entrega de ${money(c.restante || 0)} que hoy no se están gastando.`, via: 'manual',
        pasos: [`En el administrador de anuncios → conjunto ${c.conjunto} → revisar si el anuncio fue rechazado, está en revisión o tiene entrega limitada.`, 'Si fue rechazado, pedir el ajuste de la pieza en PAUTADOR.'],
        seguridad: ['Sin cambios de presupuesto hasta confirmar la causa', 'El estado de entrega todavía no llega desde la API de Meta'], confianza: 'Alta' });
      continue;
    }
    const lecturaOk = c.dias_activos >= MIN_DIAS_LECTURA && c.impresiones_7d >= MIN_IMPR_RECO && c.veces != null;
    const restan = c.dias_restantes == null || c.dias_restantes > 2;
    // 2) rendimiento (lectura temprana desde el día 5)
    if (lecturaOk && restan && c.veces <= 0.25) {
      const destino = mejor && mejor.conjunto !== c.conjunto ? mejor : null;
      const ganancia = destino && destino.costo_p50 ? Math.round((c.restante || c.gasto_7d) / (camp._costoP50 || 1) * (u.costo === 'CPM' ? 1000 : 1) * Math.min(3, destino.veces)) : null;
      push(c, { tipo: 'Pausar y mover el restante', que: 'Pausar el conjunto y mover el restante', gravedad: 3,
        porque: `Rinde ${fx(c.veces)} veces la mediana de ${compTxt(c)}, con ${c.dias_activos} días de vuelo: al día 5 el rango ya predice el final (solo el 3 % de los peores se recupera).`,
        gana: destino ? `Mover ${money(c.restante || c.gasto_7d)} a "${nombreContenido(destino, camp.nombre)}", que rinde ${fx(destino.veces)} veces la mediana${ganancia ? `, suma ~${fmtInt(ganancia)} ${u.res}` : ''} en los ${c.dias_restantes ?? '?'} días que quedan.` : `Deja de gastar ${money(c.restante || c.gasto_7d)} en un conjunto que rinde ${fx(c.veces)} veces la mediana.`,
        pasos: [`En el administrador de anuncios, pausar el conjunto ${c.conjunto}.`].concat(destino ? [`Subir el presupuesto diario de ${destino.conjunto} en 20 % (el resto del restante queda para el próximo ajuste, dentro de 3 días).`] : []),
        seguridad: [guardia20.replace('±', '+') + ' en el conjunto que recibe', 'El restante se mueve dentro de la misma campaña'] });
      continue;
    }
    if (lecturaOk && restan && c.veces <= 0.5) {
      push(c, { tipo: 'Bajar presupuesto', que: 'Bajar 20 % el presupuesto diario', gravedad: 2,
        porque: `Rinde ${fx(c.veces)} veces la mediana (${compTxt(c)}).`,
        gana: `Evita que sobren ${money(diario * 0.2 * (c.dias_restantes || 7))} en un conjunto que rinde por debajo.`,
        pasos: [`Presupuesto diario del conjunto: ${money(diario)} → ${money(diario * 0.8)} (-20 %)`], seguridad: [guardia20, 'Por encima del mínimo diario de Meta'] });
      continue;
    }
    if (lecturaOk && c.veces >= 2 && (c.dias_restantes == null || c.dias_restantes > 3) && camp._ritmo !== 'Sobreejecutada') {
      push(c, { tipo: 'Reforzar', que: 'Subir 20 % el presupuesto diario', gravedad: 1.5,
        porque: `Rinde ${fx(c.veces)} veces la mediana y le quedan ${c.dias_restantes ?? 'varios'} días (${compTxt(c)}).`,
        gana: `+${fmtInt(res7 / 7 * 0.2 * (c.dias_restantes || 7))} ${u.res} con +${money(diario * 0.2 * (c.dias_restantes || 7))} dentro del presupuesto de la campaña.`,
        pasos: [`Presupuesto diario del conjunto: ${money(diario)} → ${money(diario * 1.2)} (+20 %)`], seguridad: [guardia20] });
      continue;
    }
    // 3) audiencia: CPM caro (2×) o audiencia chica con fatiga temprana
    if (c.x_cpm && c.x_cpm >= 2 && c.impresiones_7d >= MIN_IMPR_RECO) {
      const chica = ['ciudad', 'departamento', 'multi_localidad', 'custom', 'barrio', 'zona'].includes(c.aud_geo) || c.aud_seg === 'custom';
      push(c, { tipo: 'Revisar audiencia', que: chica ? 'Ampliar la audiencia' : 'Revisar la audiencia', gravedad: 1.2,
        porque: `CPM ${money(c.gasto_7d / c.impresiones_7d * 1000)}, ${fx(c.x_cpm)} veces la mediana (${compTxt(c)}).${chica ? ' Típico de audiencias chicas: en el histórico, las abiertas de provincia rinden 0,9 y las listas de localidades 1,8 veces el costo mediano.' : ''}`,
        gana: `Con un CPM en la mediana, las mismas impresiones cuestan ~${money(c.gasto_7d * (1 - 1 / c.x_cpm))} menos por semana.`,
        pasos: [`En el administrador de anuncios → conjunto ${c.conjunto} → audiencia → ${chica ? 'sumar la audiencia abierta de la provincia o ampliar el radio.' : 'revisar exclusiones y ubicaciones.'}`],
        seguridad: ['Cambiar la audiencia reinicia el aprendizaje: hacerlo una sola vez'], confianza: c.bench_n >= 20 ? 'Media' : 'Baja' });
      continue;
    }
    // 4) rotar creativo: fatiga medida o calendario (12 placa/carrusel, 15 video)
    const umbral = FATIGA_DIAS[c.formato] || FATIGA_DIAS.otro;
    const med = fatigaMedida(ctx.seriesCampana.filter((s) => s.codigo_cont === c.codigo_cont && c.codigo_cont));
    if ((med && med.cae) || (c.dias_activos >= umbral && camp.objetivo === 'Interacción' && (c.veces == null || c.veces < 1))) {
      push(c, { tipo: 'Rotar creativo', que: 'Rotar el creativo', gravedad: 1.2, via: 'pautador',
        porque: med && med.cae ? `La tasa de reacción cayó ${pct(med.caida * 100)} % respecto de su primera semana (${fx(med.base)} → ${fx(med.actual)} por mil): es fatiga medida.` : `Lleva ${c.dias_activos} días activo en ${c.formato.toLowerCase()}; la mitad de los contenidos de ese formato fatiga antes del día ${umbral + 1}.`,
        gana: `Recupera la tasa de reacción de una pieza nueva en los ${c.dias_restantes ?? '?'} días que quedan.`,
        pasos: ['Pedir una pieza nueva en PAUTADOR para la misma campaña y audiencia.'], seguridad: ['Rotar creativo no se aplica solo: genera un pedido de pieza en PAUTADOR'], confianza: med && med.cae ? 'Alta' : 'Media' });
    }
  }
  // 5) ritmo de la campaña: frenar / acelerar sobre el conjunto más grande o el mejor
  if (camp._presupuesto > 0 && camp._plazoPct != null && camp._plazoPct >= 15 && camp._plazoPct <= 95 && vivos.length) {
    const r = camp._gastPct / camp._plazoPct;
    const grande = vivos.slice().sort((a, b) => b.gasto_7d - a.gasto_7d)[0];
    if (r > 1.15 && grande && !out.some((x) => x.conjuntoKey === grande.conjunto)) {
      const diario = grande.gasto_7d / 7;
      push(grande, { tipo: 'Frenar', que: 'Bajar 15 % el presupuesto diario', gravedad: 1.3, plata: camp._presupuesto - camp._gastado,
        porque: `La campaña gastó ${fx(r)} veces lo que corresponde al plazo: ${pct(camp._gastPct)} % del presupuesto con ${pct(camp._plazoPct)} % del plazo.`,
        gana: `Evita agotar el presupuesto antes del cierre y mantiene la entrega hasta el ${fechaCorta(camp._fin)}.`,
        pasos: [`Presupuesto diario, ${grande.ubicacion} · ${grande.audiencia_n}: ${money(diario)} → ${money(diario * 0.85)} (-15 %)`], seguridad: ['Dentro del tope de ±20 % por cambio', `Quedan ${camp._diasRest} días`] });
    }
    if (r < 0.5 && grande && camp._diasRest > 3) {
      // acelerar sobre el mejor conjunto entre los que ya mueven plata (al menos el 15 % del gasto semanal de la campaña)
      const conPlata = vivos.filter((x) => x.gasto_7d >= 0.15 * camp.gasto7 && x.veces != null).sort((a, b) => b.veces - a.veces);
      const c = conPlata[0] || grande;
      const faltaDiario = Math.max(0, (camp._presupuesto - camp._gastado) / camp._diasRest - camp.gasto7 / 7);
      if (!out.some((x) => x.conjuntoKey === c.conjunto) && faltaDiario > 0) {
        const diario = Math.max(c.gasto_7d / 7, faltaDiario);
        push(c, { tipo: 'Acelerar', que: 'Subir 20 % el presupuesto diario', gravedad: 1.2, plata: camp._presupuesto - camp._gastado,
          porque: `La campaña gastó ${pct(camp._gastPct)} % con ${pct(camp._plazoPct)} % del plazo.${c.veces ? ` Este conjunto rinde ${fx(c.veces)} veces la mediana.` : ''}`,
          gana: `Reduce en ${money(diario * 0.2 * camp._diasRest)} lo que termina sin gastar${c.veces ? ` y suma ~${fmtInt(resultadoDe(c, camp.objetivo, '7d') / 7 * 0.2 * camp._diasRest)} ${u.res}` : ''} en los ${camp._diasRest} días que quedan.`,
          pasos: [`Presupuesto diario del conjunto: ${money(diario)} → ${money(diario * 1.2)} (+20 %)`], seguridad: [guardia20] });
      }
    }
  }
  return agruparPorContenido(out);
}

function agruparPorContenido(recs) {
  const m = new Map();
  for (const r of recs) {
    const k = `${r.camp}|${r.contenidoCod || r.contenido}|${r.tipo}`;
    if (!m.has(k)) { m.set(k, { ...r, conjuntos: [...r.conjuntos], pasos: [...r.pasos], _n: 1 }); continue; }
    const g = m.get(k);
    g._score += r._score;
    for (const c of r.conjuntos) if (!g.conjuntos.includes(c)) g.conjuntos.push(c);
    for (const p of r.pasos) if (!g.pasos.includes(p)) g.pasos.push(p);
    if (r.confianza === 'Alta') g.confianza = 'Alta';
    g._n += 1;
  }
  return [...m.values()].map((g) => { if (g._n > 1) g.que = g.que.replace('el conjunto', `los ${g._n} conjuntos`); delete g._n; return g; });
}

function prioridades(recs) {
  const max = Math.max(1, ...recs.map((r) => r._score));
  for (const r of recs) {
    let s = Math.round(r._score / max * 100);
    if (r.confianza === 'Baja') s = Math.min(s, 60);
    r.score = s;
    r.prioridad = s >= 66 ? 'Alta' : s >= 33 ? 'Media' : 'Baja';
  }
  return recs.sort((a, b) => b.score - a.score);
}

function silenciar(recs, decisiones) {
  // 3 declinaciones "es intencional" / "pedido del cliente" en la misma campaña y tipo → propone silenciar (lo confirma una persona)
  const cuenta = new Map();
  for (const d of Object.values(decisiones)) {
    if (d.tipo !== 'decl' || !/intencional|cliente/i.test(d.motivo || '') || !d.foto) continue;
    const k = `${d.foto.camp}|${d.foto.tipo}`; cuenta.set(k, (cuenta.get(k) || 0) + 1);
  }
  const avisos = [];
  for (const r of recs) {
    const n = cuenta.get(`${r.camp}|${r.tipo}`) || 0;
    if (n >= 3) { r.silenced = true; if (!avisos.some((a) => a.camp === r.camp && a.tipo === r.tipo)) avisos.push({ camp: r.camp, campNombre: r.campNombre, tipo: r.tipo, n }); }
  }
  return avisos;
}

// ---------- proyecto ----------
function armarProyecto({ id, nombre, cfg, hoy, porCanal, perfil, poblacion, calendario, decisiones, cuentas }) {
  const ctx = { proyectoId: id, sesgo: perfil.sesgo || [], audienciasPerfil: perfil.audiencias || [] };
  const todos = [];
  const seriesPorCom = new Map();
  for (const canal of Object.keys(porCanal)) {
    const d = porCanal[canal];
    todos.push(...prepararConjuntos(d.conjuntos, d.alertas, canal, hoy, cuentas, d.benchmark || []));
    for (const s of d.serie) { if (!seriesPorCom.has(s.comunic)) seriesPorCom.set(s.comunic, []); seriesPorCom.get(s.comunic).push({ ...s, canal }); }
  }
  const porCom = new Map();
  for (const c of todos) { if (!porCom.has(c.comunic)) porCom.set(c.comunic, []); porCom.get(c.comunic).push(c); }
  const campanas = [], recs = [];
  for (const [comunic, conjs] of porCom) {
    if (comunic === '(sin comunicación)') continue;
    const series = seriesPorCom.get(comunic) || [];
    const camp = armarCampana(comunic, conjs, series, hoy, ctx);
    if (camp.estado === 'Agotada' && !conjs.some((c) => c.ultimo_dia && diasEntre(c.ultimo_dia, hoy) <= 7)) continue;
    recs.push(...recomendaciones(camp, hoy, { ...ctx, seriesCampana: series }));
    campanas.push(camp);
  }
  prioridades(recs);
  const avisosSilencio = silenciar(recs, decisiones);

  // encabezado del proyecto: el presupuesto mensual es por proyecto y por canal (Oficial e Informativo tienen el suyo)
  const meses = Object.values(porCanal).flatMap((d) => d.mes);
  const impresionesMes = sumBy(meses, (m) => m.impresiones_mes);
  const h = new Date(hoy);
  const diasMes = new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate();
  const diaMes = h.getDate();
  const presupuestos = Object.keys(porCanal).map((canal) => {
    const ms = porCanal[canal].mes.map((m) => ({ ...m, presupuesto_mensual: num(m.presupuesto_mensual), presupuesto_inicio_mes: num(m.presupuesto_inicio_mes), gasto_mes: Number(m.gasto_mes) || 0, gasto_7d: Number(m.gasto_7d) || 0 }));
    if (!ms.length) return null;
    const conPresu = ms.filter((m) => m.presupuesto_mensual > 0);
    const presu = sumBy(conPresu, (m) => m.presupuesto_mensual);
    const gast = sumBy(ms, (m) => m.gasto_mes);
    const gasto7 = sumBy(ms, (m) => m.gasto_7d);
    const hasta = ms.map((m) => m.datos_hasta).filter(Boolean).sort().slice(-1)[0] || hoy;
    const diaDatos = Math.min(diasMes, Number(hasta.slice(8, 10)));
    const proj = gast + gasto7 / 7 * Math.max(0, diasMes - diaDatos);
    // sobre qué gasto se compara el presupuesto: solo el de los proyectos que declaran presupuesto
    const gastConPresu = sumBy(conPresu, (m) => m.gasto_mes);
    const projConPresu = gastConPresu + sumBy(conPresu, (m) => m.gasto_7d) / 7 * Math.max(0, diasMes - diaDatos);
    const avisos = [];
    if (presu > 0 && projConPresu > presu) avisos.push(`Al ritmo de los últimos 7 días, ${canal} cierra el mes ${moneyM(projConPresu - presu)} por encima de su presupuesto (${pct(projConPresu / presu * 100)} %).`);
    else if (presu > 0 && projConPresu < presu * 0.85) avisos.push(`Al ritmo de los últimos 7 días, ${canal} cierra el mes con ${moneyM(presu - projConPresu)} sin usar (${pct((1 - projConPresu / presu) * 100)} % de su presupuesto).`);
    for (const m of conPresu) {
      if (m.presupuesto_inicio_mes && Math.abs(m.presupuesto_inicio_mes - m.presupuesto_mensual) > 1) avisos.push(`El presupuesto mensual de ${m.proyecto_bq} cambió este mes: de ${moneyM(m.presupuesto_inicio_mes)} a ${moneyM(m.presupuesto_mensual)}. Se usa el vigente.`);
    }
    const sinPresu = ms.filter((m) => !(m.presupuesto_mensual > 0) && m.gasto_mes > 0);
    if (!conPresu.length) avisos.push(`${canal} no tiene presupuesto mensual cargado en DataJunta: se muestra solo el gasto.`);
    else if (sinPresu.length) avisos.push(`Sin presupuesto mensual cargado: ${sinPresu.map((m) => `${m.proyecto_bq} (${moneyM(m.gasto_mes)} gastados)`).join(', ')}. Su gasto no entra en la comparación.`);
    return {
      canal, presu, gast, gastConPresu, proj, projConPresu, gasto7, conjuntos: sumBy(ms, (m) => m.conjuntos_vivos),
      datosHasta: hasta, diaDatos, diasMes, tienePresu: conPresu.length > 0, aviso: avisos.join(' '),
      proyectos: ms.map((m) => ({ nombre: m.proyecto_bq, presu: m.presupuesto_mensual, presuInicio: m.presupuesto_inicio_mes, gast: m.gasto_mes })),
    };
  }).filter(Boolean).sort((a, b) => (a.canal === 'Oficial' ? -1 : 1));
  const avisos = [];
  const pob = poblacion && poblacion[nombre];
  let presion = null;
  if (pob && impresionesMes) {
    const ih = impresionesMes / pob / (diaMes / diasMes);
    presion = { impr_hab: Math.round(ih), nivel: ih >= PRESION_ALERTA ? 'alerta' : ih >= PRESION_AVISO ? 'aviso' : 'normal' };
    if (presion.nivel !== 'normal') avisos.push(`Presión por habitante: ${Math.round(ih)} impresiones por habitante por mes (${presion.nivel === 'alerta' ? 'alerta desde 80' : 'aviso desde 60'}). Con esa presión la tasa de reacción cae y el costo por resultado sube: revisar audiencias y frecuencia.`);
  }
  const periodo = periodoElectoral(nombre, hoy, calendario);
  if (periodo && periodo !== 'normal') avisos.push(`Período electoral: ${periodo}. Las comparaciones se leen contra comparables del mismo período (en campaña el costo sube 1,2–1,4 veces; en veda 2,6–4).`);
  const calidad = [];
  for (const c of campanas) for (const q of c._calidad) calidad.push(`${c.nombre}: ${q}`);
  const sinCom = todos.filter((c) => c.comunic === '(sin comunicación)').length;
  if (sinCom) calidad.push(`${sinCom} conjuntos sin comunicación: no se pueden seguir por campaña.`);
  const datosHasta = meses.map((m) => m.datos_hasta).filter(Boolean).sort().slice(-1)[0];
  const calculadoEn = Object.values(porCanal).flatMap((d) => d.alertas).map((a) => a.calculado_en).filter(Boolean).sort().slice(-1)[0];

  const P = {
    nombre, presupuestos, aviso: avisos.join(' '),
    calidadAviso: calidad.length ? `${calidad.length} observaciones de carga.` : '', calidad, diaMes, diasMes, presion, periodo,
  };
  const ejes = [...new Set(campanas.map((c) => c.eje))].sort();
  const limpiar = (c) => { const o = { ...c }; for (const k of Object.keys(o)) if (k.startsWith('_')) delete o[k]; return o; };
  return {
    proyecto: { id, nombre }, P, ejes, campanas: campanas.map(limpiar),
    recs: recs.map((r) => { const o = { ...r }; delete o._score; return o; }),
    avisosSilencio, frescura: { datosHasta, calculadoEn },
  };
}

function periodoElectoral(cliente, hoy, cal) {
  if (!cal) return null;
  if ((cal.sin_calendario || []).includes(cliente)) return 'normal';
  const v = cal.ventana;
  const els = (cal.elecciones || []).filter((e) => e.cliente === '*' || e.cliente === cliente).map((e) => e.fecha);
  const h = new Date(hoy);
  let out = 'normal';
  for (const f of els) {
    const e = new Date(f), d = Math.round((e - h) / DIA);
    if (d >= 0 && d <= v.veda_dias_antes) return 'veda';
    if (d > v.veda_dias_antes && d <= v.campana_dias_antes) out = 'campaña';
    if (d < 0 && -d <= v.post_dias_despues && out === 'normal') out = 'post';
  }
  return out;
}

module.exports = { armarProyecto, fmtInt, money, fx, fechaCorta };
