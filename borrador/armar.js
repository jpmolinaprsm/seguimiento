// Arma borrador-interfaz.html: Portada de proyectos → Proyecto (Resumen · Campañas · Activos · Insights · Acciones) → Campaña.
// Fuentes locales (ya extraídas, no consulta BigQuery):
//   _proyectos.json                                          → Meta: cruce y diaria de 180 días + semanal de 400 días (_extraer.js)
//   ../presupuestos/_activos.json                            → pedido / gastado por cuenta publicitaria (planilla de pedidos + DataJunta)
//   ../datos-fijos/t6_bandas_general.csv                     → referencias generales de cada métrica (todos los gobiernos, 365 días)
//   ../datos-fijos/t6_bandas_proyecto.csv                    → referencias de cada proyecto × canal (365 días)
//   ../datos-fijos/t6_bandas_juntas.csv                      → lo mismo juntando canales ("General") y los siete proyectos ("Todos")
//   ../datos-fijos/poblacion.json                            → población por proyecto (presión por habitante)
//   datos-fijos/ es una copia fija de analisis-datajunta/ que Referencias actualiza a mano una vez por mes (ver su LEEME.md)
// Tres luces: General · Proyecto · Propia (campañas de 30+ días contra su propia historia; estacionales contra la temporada anterior).
// Uso: node armar.js
const fs = require('fs');
const path = require('path');

const PROYECTOS = [
  { id: 'santa-fe', cliente: 'Gobierno de Santa Fe', nombre: 'Santa Fe' },
  { id: 'chaco', cliente: 'Gobierno del Chaco', nombre: 'Chaco' },
  { id: 'chubut', cliente: 'Gobierno del Chubut', nombre: 'Chubut' },
  { id: 'corrientes', cliente: 'Gobierno de Corrientes', nombre: 'Corrientes' },
  { id: 'catamarca-provincia', cliente: 'Catamarca Provincia', nombre: 'Catamarca Provincia' },
  { id: 'catamarca-ciudad', cliente: 'Catamarca Ciudad', nombre: 'Catamarca Ciudad' },
  { id: 'cordoba', cliente: 'Gobierno de Córdoba', nombre: 'Córdoba' },
];
const AUTOMATIZADOS = ['Contexto Noreste', 'La Calle Hoy', 'Actualidad Cordobesa', 'El Sol Informativo', 'Nodo Chaco', 'La Voz Litoral',
  'Tiempo Chubut', 'Somos Chubut', 'Informe Norte', 'Conexión Catamarca', 'Radar Catamarca',
  'Gaceta Santafesina', 'Gaceta Patagónica', 'Noticia Franca', 'El Norte Ahora'];
// umbrales de las reglas de Meta: viven en reglas/meta.js (se usan también en los insights)
const recomendaciones = require('./recomendaciones');
const { PLACEMENTS_DEBILES, solapamientoAudiencias } = require('./reglas/meta');
// Juegos Suramericanos termina esta semana (con presupuesto de Gobierno de Santa Fe): no genera acciones
const TERMINAN = ['Juegos Suramericanos', 'Suramericanos Esports', 'Suramericanos Fan Fest'];
// Comunicaciones que en realidad son un placement o no tienen nombre: no se les sugiere cambiar placements
const COM_GENERICA = /^(stories|ig\/fb feed|feed|\(sin comunicación\))$/i;
const CONSTANTE_SEMANAS = 20;      // campaña constante: con gasto en 20 o más de las últimas 52 semanas (sugerencia; la confirma el usuario)
const CONSTANTE_SEMANAS_SIN_TEMPORADA = 16; // …o en 16 o más si no tiene una temporada anterior detectada (ej.: Chubut Avanza, 18 seguidas)
const LARGA_DIAS = 30;             // campaña larga (decisión del usuario 28/09)
const INFLACION_MES = { Alcance: 0, Interacción: 0.02, Tráfico: 0.02 }; // tanda 5: CPM de Alcance plano, Interacción +2 % por mes

// SEGUIMIENTO_PROYECTOS: ruta de otro archivo de datos (lo usa actualizar.js para armar la versión nueva antes de cambiarla). Sin la variable, igual que siempre.
const fuente = require(process.env.SEGUIMIENTO_PROYECTOS ? path.resolve(process.env.SEGUIMIENTO_PROYECTOS) : './_proyectos.json');
// nombre oficial de cada campaña (pedido 033, 13/10): la comunicación de DataJunta pasa al nombre de la lista única de PAUTADOR
// (datos-fijos/campanas-oficiales.json) acá, antes de todo, así todo se agrupa por ese nombre. Sin el archivo, todo queda como antes.
const NOMBRES_OFICIALES = require('./nombres-oficiales.js').aplicar(fuente);
const unidades = require('../presupuestos/_activos.json');
const RES = path.join(__dirname, '../datos-fijos');
const poblacion = require(path.join(RES, 'poblacion.json')).poblacion;

const num = (x) => Number(x) || 0;
const OBJ = { OUTCOME_TRAFFIC: 'Tráfico', OUTCOME_ENGAGEMENT: 'Interacción', OUTCOME_AWARENESS: 'Alcance' };
const objetivo = (o) => OBJ[o] || o || 'Sin objetivo';

// ---------- referencias ----------
const METRICAS = ['ETR', 'tasa_reac', 'CTR', 'tasa_comp', 'tasa_coment', 'tasa_repro', 'ret25', 'ret50', 'ret75', 'ret100', 'VTR', 'CPM', 'costo_reac', 'CPC', 'costo_comp'];
function leerCsv(p) {
  const [cab, ...filas] = fs.readFileSync(p, 'utf8').trim().split(/\r?\n/);
  const cols = cab.split(',');
  return filas.map((l) => { const v = l.split(','); return Object.fromEntries(cols.map((c, i) => [c, v[i]])); });
}
function banda(b) {
  const m = { n: Number(b.n) };
  for (const met of METRICAS) {
    const t = [b[`${met}_p25`], b[`${met}_p50`], b[`${met}_p75`]].map(Number);
    if (t.every((x) => Number.isFinite(x) && x > 0)) m[met] = t.map((x) => Math.round(x * 10000) / 10000);
  }
  return m;
}
const BG = {}, BP = {};
for (const b of leerCsv(path.join(RES, 't6_bandas_general.csv'))) BG[[b.objetivo, b.formato, b.pgrp].filter(Boolean).join('|')] = banda(b);
for (const b of leerCsv(path.join(RES, 't6_bandas_proyecto.csv'))) BP[[b.cliente, b.canal, b.objetivo, b.formato].filter(Boolean).join('|')] = banda(b);
// vistas que juntan de la app (01/10, mismo criterio): canal "General" = el proyecto con los dos canales; cliente "Todos" = los siete proyectos
// obligatorio: sin este archivo la vista General y los paneles de todos los proyectos se quedan sin referencias
if (!fs.existsSync(path.join(RES, 't6_bandas_juntas.csv'))) throw new Error('Falta datos-fijos/t6_bandas_juntas.csv (ver datos-fijos/LEEME.md)');
for (const b of leerCsv(path.join(RES, 't6_bandas_juntas.csv'))) BP[[b.cliente, b.canal, b.objetivo, b.formato].filter(Boolean).join('|')] = banda(b);
// busca la métrica en el nivel más fino que la tenga
const valor = (cands, met, q = 1) => { for (const b of cands) if (b && b[met]) return b[met][q]; return null; };
const candG = (obj, fmt, pl) => [BG[`${obj}|${fmt}|${pl}`], BG[`${obj}|${fmt}`], BG[obj]];
const candP = (cli, can, obj, fmt) => [BP[`${cli}|${can}|${obj}|${fmt}`], BP[`${cli}|${can}|${obj}`]];

// ---------- normalizaciones ----------
function voz(nombre) {
  let n = String(nombre || '');
  if (/^Cuenta /.test(n)) return 'Cuentas sin identificar';
  if (/Lot(er[ií]a)? Santa Fe/i.test(n)) return 'Lotería Santa Fe';
  n = n.replace(/^[A-Z0-9]{6} /, '').replace(/\s*\*?\s*\([^)]*\)\s*$/, '').replace(/\s*\*$/, '').trim();
  if (/^Diario de actualidad$/i.test(n)) return 'Diario de Actualidad';
  return n;
}
// Mismo criterio que normalizar_formato de analisis-datajunta/10_perfil_campana.py
function normFormato(f) {
  const u = String(f || '').toLowerCase();
  if (/video|vídeo|spot|reel/.test(u) || ['vid', 'bumper', 'yt shorts', 'testimonio', 'testimonios'].includes(u)) return 'Video';
  if (/carrusel|carousel/.test(u)) return 'Carrusel';
  if (/placa|plca|palca|flyer|imagen|banner|foto/.test(u) || ['pf', 'display'].includes(u)) return 'Placa Fija';
  if (/stor/.test(u)) return 'Stories';
  return ['', '(null)', 'nan', 'none', 'sin formato'].includes(u) ? '(sin formato)' : '(otro)';
}
function formato(raw, contenido) {
  const f = normFormato(raw);
  if (f === '(sin formato)' || f === '(otro)') {
    for (const m of String(contenido || '').matchAll(/\(([^()]*)\)/g)) {
      const g = normFormato(m[1]);
      if (g !== '(sin formato)' && g !== '(otro)') return g;
    }
  }
  return f;
}
const PLS = ['Facebook Feed', 'Instagram Feed', 'Instagram Reels', 'Facebook Reels', 'Instagram Stories', 'Facebook Stories', 'Facebook Instream Video', 'Threads Feed'];
const pgrp = (p) => PLS.includes(p) ? p : /^Instagram Explore/.test(p) ? 'Instagram Explore' : 'Otros';
const nombreCont = (c) => String(c || '').replace(/\s*\([^()]*\)\s*$/, '').trim() || c;

// ---------- esperado por fila (x = general, p = proyecto) ----------
// Para cada métrica, lo que habría dado la fila con la mediana de su referencia. Permite comparar agregados con mezcla de formatos y placements.
function esperado(x, cands, pre) {
  const stories = /Stories/.test(x.pl || '');
  const v = (met) => valor(cands, met);
  x[pre + 'r'] = stories ? 0 : x.i * (v('tasa_reac') || 0) / 100;
  x[pre + 'sh'] = stories ? 0 : x.i * (v('tasa_comp') || 0) / 100;
  x[pre + 'co'] = stories ? 0 : x.i * (v('tasa_coment') || 0) / 100;
  x[pre + 'e'] = x.i * (v('ETR') || 0) / 100;
  x[pre + 'c'] = x.i * (v('CTR') || 0) / 100;
  x[pre + 'g'] = x.i * (v('CPM') || 0) / 1000;
  x[pre + 'vw'] = x.vi * (v('tasa_repro') || 0) / 100;
  x[pre + '25'] = x.vw * (v('ret25') || 0) / 100;
  x[pre + '100'] = x.vw * (v('ret100') || 0) / 100;
}
const filas = fuente.cruce.map((r) => {
  const obj = objetivo(r.objetivo);
  const fmt = formato(r.formato_raw, r.contenido);
  const pl = pgrp(r.placement);
  const esVideo = fmt === 'Video';
  const x = { canal: r.canal, cli: r.cliente, mes: r.mes, voz: voz(r.activo), com: r.comunic, cod: r.cod || r.contenido, cont: r.contenido || r.cod, fmt, obj, pl,
    eje: r.eje, aud: r.audiencia, g: num(r.gasto), i: num(r.imp), r: num(r.rea), c: num(r.clk), e: num(r.eng), co: num(r.com), sh: num(r.sha),
    vi: esVideo ? num(r.imp) : 0, vw: esVideo ? num(r.vw) : 0, v25: esVideo ? num(r.v25) : 0, v50: esVideo ? num(r.v50) : 0, v75: esVideo ? num(r.v75) : 0, v100: esVideo ? num(r.v100) : 0,
    desde: r.desde, hasta: r.hasta, fin: r.fin, lfb: r.link_fb || null, lig: r.link_ig || null, lnk: r.link || null };
  esperado(x, candG(obj, fmt, pl), 'x');
  esperado(x, candP(r.cliente, r.canal, obj, fmt), 'p');
  return x;
});
// último día COMPLETO: DataJunta se carga a las 8:00 con el día anterior, el día de hoy viene casi vacío (mismo criterio que el tablero de Dirección)
const datosHasta = (() => {
  const tot = {};
  for (const r of fuente.plataformas || fuente.diaria) tot[r.fecha] = (tot[r.fecha] || 0) + num(r.gasto);
  const ds = Object.keys(tot).sort();
  const prev = ds.slice(-8, -1).map((f) => tot[f]).sort((a, b) => a - b);
  const med = prev.length ? prev[Math.floor(prev.length / 2)] : 0;
  return tot[ds[ds.length - 1]] < med * 0.3 ? ds[ds.length - 2] : ds[ds.length - 1];
})();
// mes en curso: el del último día completo (el 1.º de cada mes todavía es el mes anterior, porque ese día no está completo)
const MES = datosHasta.slice(0, 7);
// planilla de presupuestos del mes de la app (u.meses[MES], no u.mes: si los presupuestos se armaron otro día, u.mes puede ser otro
// mes). Mes que no está en _activos.json o sin pedidos cargados en la planilla → "sin pedido cargado": no se muestra pedido ni restante.
const mesPlanilla = (u) => (u.meses || {})[MES] || null;
const pedidoCargado = unidades.some((u) => { const m = mesPlanilla(u); return !!(m && m.pedidoCargado); });
// el mes de la app está en la planilla (alguna cuenta lo tiene). Si no está, el gastado de cada activo sale de DataJunta (gasto del
// mes del activo en todas las plataformas), no 0 (decisión de Juan Pablo 1/10, D-d). Cada activo dice de dónde salió (gastadoFuente).
const mesEnPlanilla = unidades.some((u) => !!mesPlanilla(u));
// parte de la cuenta que le toca a un proyecto. Si la cuenta sirve a más de un proyecto de la app (Informe Norte: Chaco y
// Corrientes), solo lo pedido y gastado de ese cliente (pedidoPorCliente / gastoPorCliente); la proyección, en proporción a su
// gasto. Mismo criterio que presupuestos/resumen-activos.js (una sola verdad entre la app y el resumen para Activos).
const CLIENTES_APP = new Set(PROYECTOS.map((p) => p.cliente));
function parteDe(u, cliente) {
  const m = mesPlanilla(u);
  if (u.clientes.filter((x) => CLIENTES_APP.has(x)).length > 1) {
    const gC = (m.gastoPorCliente || {})[cliente] || 0, pC = (m.pedidoPorCliente || {})[cliente] || 0;
    return { pedido: pedidoCargado ? pC : 0, gastado: gC, proy: m.gastado ? (m.proy || m.gastado) * gC / m.gastado : 0, compartida: true };
  }
  return { pedido: pedidoCargado ? m.pedido || 0 : 0, gastado: m.gastado || 0, proy: m.proy || m.gastado || 0, compartida: false };
}
const dias = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const BASE = ['g', 'i', 'r', 'c', 'e', 'co', 'sh', 'vi', 'vw', 'v25', 'v50', 'v75', 'v100'];
const ESP = ['r', 'sh', 'co', 'e', 'c', 'g', 'vw', '25', '100'];
const SUMAS = [...BASE, ...ESP.map((k) => 'x' + k), ...ESP.map((k) => 'p' + k)];
function suma(rows) {
  const o = Object.fromEntries(SUMAS.map((k) => [k, 0]));
  for (const r of rows) for (const k of SUMAS) o[k] += r[k] || 0;
  for (const k of SUMAS) o[k] = Math.round(o[k] * 100) / 100;
  return o;
}
function agrupar(rows, clave, extra) {
  const m = new Map();
  for (const r of rows) { const k = clave(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return [...m.entries()].map(([k, rs]) => ({ k, ...suma(rs), ...(extra ? extra(rs) : {}) })).sort((a, b) => b.g - a.g);
}
const dominante = (rows, campo) => agrupar(rows, (r) => r[campo])[0]?.k;
const minFecha = (rs, c) => rs.reduce((m, r) => (r[c] && r[c] < m ? r[c] : m), '9999');
const maxFecha = (rs, c) => rs.reduce((m, r) => (r[c] && r[c] > m ? r[c] : m), '');

// Índice del KPI principal (1 = igual a la referencia, >1 = mejor), pre = 'x' general / 'p' proyecto
function idxPrincipal(o, obj, pre) {
  const eg = o[pre + 'g'], er = o[pre + 'r'], ec = o[pre + 'c'];
  if (obj === 'Interacción') return er && o.r && eg && o.g ? (o.r / er) * (eg / o.g) : null;
  if (obj === 'Tráfico') return ec ? o.c / ec : null;
  return eg && o.g ? eg / o.g : null;
}
// costo por reacción: la medida de efectividad de los contenidos
const idxCostoReac = (o, pre) => (o[pre + 'r'] && o.r && o[pre + 'g'] && o.g ? (o.r / o[pre + 'r']) * (o[pre + 'g'] / o.g) : null);
// ±20 % contra la referencia (decisión del usuario 29/09, igual que el tablero de Dirección):
// verde = 20 % o más mejor · amarillo = dentro de ±20 % · rojo = 20 % o más peor (costo 1,2× → índice 0,83)
const UMBRAL_20 = [1 / 1.2, 1.2];
const UMBRAL = { Alcance: UMBRAL_20, Interacción: UMBRAL_20, Tráfico: UMBRAL_20 };
function luz(idx, obj) {
  if (idx == null || !isFinite(idx)) return 'gris';
  const [rojo, amarillo] = UMBRAL[obj] || UMBRAL.Interacción;
  return idx < rojo ? 'rojo' : idx < amarillo ? 'amarillo' : 'verde';
}
const r2 = (x) => (x == null || !isFinite(x) ? null : Math.round(x * 100) / 100);
const percentil = (xs, q) => { const s = xs.slice().sort((a, b) => a - b); if (!s.length) return null; const p = (s.length - 1) * q, lo = Math.floor(p); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (p - lo); };

// ---------- diaria indexada ----------
const diariaCom = {}, diariaVoz = {};
for (const r of fuente.diaria) {
  const kc = `${r.canal}|${r.cliente}|${r.comunic}`, kv = `${r.canal}|${r.cliente}|${voz(r.activo)}`;
  (diariaCom[kc] = diariaCom[kc] || {})[r.fecha] = ((diariaCom[kc] || {})[r.fecha] || 0) + num(r.gasto);
  (diariaVoz[kv] = diariaVoz[kv] || {})[r.fecha] = ((diariaVoz[kv] || {})[r.fecha] || 0) + num(r.gasto);
}
const fechas = [...new Set(fuente.diaria.map((r) => r.fecha))].sort();
const ult45 = fechas.slice(-45), ult7 = fechas.slice(-7);

// ---------- historia semanal (400 días) → luz "Propia" ----------
const semanal = {};
for (const r of fuente.semanal) {
  const obj = objetivo(r.objetivo);
  const x = { s: r.semana, obj, fmt: r.fmt, g: num(r.gasto), i: num(r.imp), r: num(r.rea), c: num(r.clk), sh: num(r.sha), dias: num(r.dias) };
  const b = candG(obj, x.fmt === '(otro)' ? '(otro)' : x.fmt, null);
  x.xr = x.i * (valor(b, 'tasa_reac') || 0) / 100; x.xc = x.i * (valor(b, 'CTR') || 0) / 100;
  x.xsh = x.i * (valor(b, 'tasa_comp') || 0) / 100; x.xg = x.i * (valor(b, 'CPM') || 0) / 1000;
  (semanal[`${r.canal}|${r.cliente}|${r.comunic}`] = semanal[`${r.canal}|${r.cliente}|${r.comunic}`] || []).push(x);
}
const SEM = 7 * 864e5;
const sumaSem = (ws, deflactar = 1) => ws.reduce((o, w) => { o.g += w.g * deflactar; o.i += w.i; o.r += w.r; o.c += w.c; o.sh += w.sh; o.xr += w.xr; o.xc += w.xc; o.xsh += w.xsh; o.xg += w.xg; return o; },
  { g: 0, i: 0, r: 0, c: 0, sh: 0, xr: 0, xc: 0, xsh: 0, xg: 0 });
// índice semanal del KPI principal (contra la mediana general, para neutralizar cambios de formato)
function ratioSem(o, obj) {
  if (obj === 'Interacción') return o.xr && o.r && o.xg && o.g ? (o.r / o.xr) * (o.xg / o.g) : null;
  if (obj === 'Tráfico') return o.xc ? o.c / o.xc : null;
  return o.xg && o.g ? o.xg / o.g : null;
}
// valor crudo del mismo KPI que compara la luz propia, para que la app muestre la referencia en plata o en clicks cada 100
// (pedido de Interfaz del 01/10): Interacción costo por reacción, Tráfico CTR (%), el resto CPM
function valorSem(o, obj) {
  if (obj === 'Interacción') return o.r ? r2(o.g / o.r) : null;
  if (obj === 'Tráfico') return o.i ? r2(o.c / o.i * 100) : null;
  return o.i ? r2(o.g / o.i * 1000) : null;
}
const semanaCompleta = (s) => new Date(s).getTime() + 6 * 864e5 <= new Date(datosHasta).getTime();
function propia(clave, obj, pob, nombre) {
  const todas = (semanal[clave] || []).filter((w) => w.obj === obj);
  if (!todas.length) return null;
  const porSem = agruparSemanas(todas);
  // tandas de actividad: se corta cuando pasan más de 8 semanas sin gasto
  const tandas = [];
  for (const w of porSem) {
    const ult = tandas[tandas.length - 1];
    if (ult && (new Date(w.s) - new Date(ult[ult.length - 1].s)) / SEM <= 8) ult.push(w); else tandas.push([w]);
  }
  const actual = tandas[tandas.length - 1];
  const inicio = actual[0].s, finT = actual[actual.length - 1].s;
  const span = dias(inicio, finT) + 7;
  const compl = actual.filter((w) => semanaCompleta(w.s));
  // estacional: una tanda anterior de 2+ semanas que arrancó en la misma época (±6 semanas) hace 1 o 2 años, separada por 16+ semanas
  let temporada = null;
  if (!COM_GENERICA.test(nombre) && compl.length) {
    for (let t = tandas.length - 2; t >= 0 && !temporada; t--) {
      const T = tandas[t];
      if (T.length < 2 || (new Date(inicio) - new Date(T[T.length - 1].s)) / SEM < 16) continue;
      const desfase = (new Date(inicio) - new Date(T[0].s)) / SEM;
      if (Math.abs(desfase - 52) <= 6 || Math.abs(desfase - 104) <= 6) {
        // misma altura de la temporada: las primeras k semanas de cada tanda
        const k = (new Date(compl[compl.length - 1].s) - new Date(inicio)) / SEM + 1;
        const alineadas = T.filter((w) => (new Date(w.s) - new Date(T[0].s)) / SEM < k);
        const meses = desfase * 7 / 30.4;
        const rPrev = ratioSem(sumaSem(alineadas, Math.pow(1 + (INFLACION_MES[obj] || 0), meses)), obj);
        const rCur = ratioSem(sumaSem(compl), obj);
        if (rPrev && rCur) temporada = { desde: T[0].s, hasta: T[T.length - 1].s, semanasComparadas: alineadas.length, g: Math.round(sumaSem(alineadas).g), idx: r2(rCur / rPrev), valorAct: valorSem(sumaSem(compl), obj) };
      }
    }
  }
  // constante: se comunica todo el año (con o sin pausas) → semanas con gasto en las últimas 52
  const sem52 = porSem.filter((w) => w.g > 0 && dias(w.s, datosHasta) <= 364).length;
  const constante = !COM_GENERICA.test(nombre) && sem52 >= (temporada ? CONSTANTE_SEMANAS : CONSTANTE_SEMANAS_SIN_TEMPORADA);
  if (span < LARGA_DIAS && !temporada && !constante) return null;
  const medianaGasto = percentil(compl.map((w) => w.g), 0.5) || 0;
  const utiles = compl.filter((w) => w.g >= medianaGasto * 0.15);
  const out = { inicio, span, tipo: temporada ? 'temporada' : 'propia', semanas: utiles.map((w) => ({ s: w.s, x: r2(ratioSem(w, obj)), g: Math.round(w.g) })) };
  if (temporada) { out.previa = temporada; out.idxTemporada = temporada.idx; }
  out.sem52 = sem52; out.constante = constante;
  const ult2 = utiles.slice(-2), ref = utiles.slice(0, -2);
  const rAct = ratioSem(sumaSem(ult2), obj);
  const refR = ref.map((w) => ratioSem(w, obj)).filter((x) => x != null && isFinite(x));
  if (ref.length >= 2 && rAct != null && refR.length >= 2) {
    const p25 = percentil(refR, 0.25), p50 = percentil(refR, 0.5), p75 = percentil(refR, 0.75);
    out.ref = { p25: r2(p25), p50: r2(p50), p75: r2(p75), semanas: refR.length };
    out.idxPropio = r2(rAct / p50);
    out.valorAct = valorSem(sumaSem(ult2), obj);
    const u2 = ult2.map((w) => ratioSem(w, obj));
    out.debajo = refR.length >= 3 && u2.length === 2 && u2.every((x) => x != null && x < p25);
    out.arriba = refR.length >= 3 && u2.length === 2 && u2.every((x) => x != null && x > p75);
  }
  // la luz "Propia": las estacionales contra su temporada anterior; el resto contra su propia historia
  out.idx = temporada ? temporada.idx : out.idxPropio ?? null;
  out.estado = out.idx == null ? 'poca historia' : 'ok';
  out.luz = luz(out.idx, obj);
  if (utiles.length >= 10) {
    const r4 = ratioSem(sumaSem(utiles.slice(-4)), obj), r8 = ratioSem(sumaSem(utiles.slice(-12, -4)), obj);
    out.tendencia = r4 && r8 ? r2(r4 / r8) : null;
  }
  if (pob) {
    out.presion = r2(utiles.slice(-4).reduce((s, w) => s + w.i, 0) / pob * 30 / 28);
    out.presionAcum = r2(utiles.reduce((s, w) => s + w.i, 0) / pob);
  }
  return out;
}
function agruparSemanas(ws) {
  const m = new Map();
  for (const w of ws) {
    const o = m.get(w.s) || { s: w.s, g: 0, i: 0, r: 0, c: 0, sh: 0, xr: 0, xc: 0, xsh: 0, xg: 0 };
    for (const k of ['g', 'i', 'r', 'c', 'sh', 'xr', 'xc', 'xsh', 'xg']) o[k] += w[k];
    m.set(w.s, o);
  }
  return [...m.values()].sort((a, b) => a.s.localeCompare(b.s));
}

// ---------- hasta dónde llega la campaña (ex "piso simulado", spec v0.4 7.3; pedido de Juan Pablo 30/09) ----------
// DataJunta no trae el presupuesto de cada campaña: la plata se estima con el ritmo de gasto de los últimos 7 días hasta la
// fecha de fin (Fin de DataJunta; casi siempre fin de mes, porque PAUTADOR parte las pautas por mes). Solo Meta.
// Período: el tramo del mes en curso (desde el día 1 del mes o desde que arrancó, si arrancó después).
// "Fin" es exclusivo: el último día con gasto es el anterior (en el 65 % de las filas la pauta termina el día antes del Fin).
// Umbrales (decididos por Juan Pablo 1/10, P1): llega = 100 % o más de lo esperado; en riesgo = dentro del 20 % por debajo
// (83 %–100 %); no llega = 20 % o más por debajo (igual que la luz roja).
// Lo normal se mide SOLO contra el proyecto (decisión 1/10, P2 / L-4): sin referencia del proyecto (Córdoba Oficial, por ejemplo)
// queda "sin referencia en <proyecto>", sin etiqueta ni comparación. Ya no se usa la General de todos los gobiernos.
const UMBRAL_LLEGADA = { llega: 1, riesgo: 1 / 1.2 };
// Antes del día 5 del mes (según datosHasta, el último día completo; no el reloj) no se proyecta (decisión 2/10; día 5 desde el 05/10): pocos días
// para un ritmo confiable. Se devuelve sinDato con el motivo y lo que lleva la campaña (sin proyección, etiqueta ni comparación).
const DIA_MINIMO_LLEGADA = 5;
const METRICA_LLEGADA = { Alcance: ['i', 'impresiones'], Interacción: ['r', 'reacciones'], Tráfico: ['c', 'clicks'], Conversión: ['c', 'clicks'] };
const metaDia = {};
for (const r of fuente.todas || []) {
  if (r.plataforma !== 'META') continue;
  const porFecha = metaDia[`${r.canal}|${r.cliente}|${r.comunic}`] = metaDia[`${r.canal}|${r.cliente}|${r.comunic}`] || {};
  const o = porFecha[r.fecha] = porFecha[r.fecha] || { g: 0, i: 0, r: 0, c: 0 };
  o.g += num(r.gasto); o.i += num(r.imp); o.r += num(r.rea); o.c += num(r.clk);
}
const masDias = (f, n) => new Date(new Date(f).getTime() + n * 864e5).toISOString().slice(0, 10);
function llegada(c, clave, proyecto) {
  const [campo, metrica] = METRICA_LLEGADA[c.obj] || [];
  if (!campo) return { sinDato: `objetivo ${c.obj}: no tiene métrica de volumen definida` };
  const inicio = [c.desde, datosHasta.slice(0, 8) + '01'].sort()[1];
  const dia = metaDia[clave] || {};
  const tramo = (a, b) => Object.entries(dia).filter(([f]) => f >= a && f <= b).reduce((o, [, x]) => { o.g += x.g; o.i += x.i; o.r += x.r; o.c += x.c; return o; }, { g: 0, i: 0, r: 0, c: 0 });
  const hecho = tramo(inicio, datosHasta);
  if (!hecho.g) return { sinDato: 'sin gasto en Meta en el mes' };
  if (Number(datosHasta.slice(8, 10)) < DIA_MINIMO_LLEGADA) return { sinDato: `Todavía pocos días del mes para proyectar: se calcula desde el ${DIA_MINIMO_LLEGADA}/${Number(datosHasta.slice(5, 7))}`,
    pocosDias: true, metrica, desde: inicio, datosHasta, gastado: Math.round(hecho.g), lleva: Math.round(hecho[campo]) };
  const desde7 = [inicio, masDias(datosHasta, -6)].sort()[1], d7 = dias(desde7, datosHasta) + 1, u7 = tramo(desde7, datosHasta);
  const diasRestantes = c.fin ? Math.max(0, dias(datosHasta, c.fin) - 1) : null;
  if (diasRestantes == null) return { sinDato: 'sin fecha de fin en DataJunta' };
  // lo normal: resultado por peso con la mediana de la referencia del PROYECTO (misma cuenta que las luces), sobre la mezcla de
  // formatos y placements del mes. Sin referencia del proyecto no se compara (ni contra la General).
  const m = c.mMes && c.mMes.g ? c.mMes : c.m;
  const porPeso = (pre) => { const den = m[pre + 'g'], nu = campo === 'i' ? m.i : m[pre + campo]; return den > 0 && nu > 0 ? nu / den : null; };
  const [referencia, normalPorPeso] = porPeso('p') ? ['Proyecto', porPeso('p')] : [null, null];
  const out = { metrica, desde: inicio, datosHasta, fin: c.fin, diasRestantes, gastado: Math.round(hecho.g), gastoDiario: Math.round(u7.g / d7),
    plataEstimada: Math.round(hecho.g + u7.g / d7 * diasRestantes), plataFuente: 'gastado más el ritmo de gasto de los últimos 7 días hasta la fecha de fin',
    logrado: Math.round(hecho[campo]), ritmoDiario: Math.round(u7[campo] / d7), proyeccion: Math.round(hecho[campo] + u7[campo] / d7 * diasRestantes) };
  if (!normalPorPeso) return { ...out, sinReferencia: true, sinDato: `sin referencia en ${proyecto}` };
  out.referencia = referencia;
  out.costoNormal = r2(campo === 'i' ? 1000 / normalPorPeso : 1 / normalPorPeso); // CPM en Alcance; costo por reacción o por click en el resto
  out.esperado = Math.round(out.plataEstimada * normalPorPeso);
  out.pctEsperado = out.esperado ? r2(out.proyeccion / out.esperado) : null;
  out.etiqueta = out.pctEsperado == null ? null : out.pctEsperado >= UMBRAL_LLEGADA.llega ? 'va a llegar' : out.pctEsperado >= UMBRAL_LLEGADA.riesgo ? 'en riesgo' : 'no va a llegar';
  return out;
}

// ---------- eficacia (automatizado.eficacia_anuncios, regla compartida con Looker) ----------
const eficaciaPor = {};
for (const r of fuente.eficacia || []) (eficaciaPor[`${r.canal}|${r.cliente}`] = eficaciaPor[`${r.canal}|${r.cliente}`] || []).push({
  com: r.comunic, cod: r.cod || r.contenido, aud: r.audiencia, eje: r.eje, fmt: r.formato, sem: r.sem, g: num(r.gasto), link: r.link, hasta: r.hasta, banda: r.banda });
// color de categoría con la escala de Looker (<25 % verde, <50 % amarillo, <75 % naranja, resto rojo), sobre el % del GASTO en rojo
const colorCategoria = (pct) => (pct == null ? 'gris' : pct < 25 ? 'verde' : pct < 50 ? 'amarillo' : pct < 75 ? 'naranja' : 'rojo');
function efi(rs) {
  if (!rs || !rs.length) return null;
  const g = rs.reduce((a, r) => a + r.g, 0), rojos = rs.filter((r) => r.sem === 'Rojo'), gRojo = rojos.reduce((a, r) => a + r.g, 0);
  const verdes = rs.filter((r) => r.sem === 'Verde').length;
  const pctGastoRojo = g ? gRojo / g * 100 : null;
  return { n: rs.length, rojos: rojos.length, verdes, pctRojos: Math.round(rojos.length / rs.length * 100), pctGastoRojo: pctGastoRojo == null ? null : Math.round(pctGastoRojo),
    gastoRojo: Math.round(gRojo), color: colorCategoria(pctGastoRojo) };
}
const linkDe = (rs) => (rs || []).filter((r) => r.link).sort((a, b) => b.g - a.g)[0]?.link || null;
// pesos gastados de más contra la referencia del PROYECTO en el KPI principal ("pautas caras" del tablero de Dirección)
function deMas(o, obj) {
  let esperado = null;
  if (obj === 'Interacción') esperado = o.r && o.pr ? o.r * (o.pg / o.pr) : null;
  else if (obj === 'Tráfico') esperado = o.c && o.pc ? o.c * (o.pg / o.pc) : null;
  else esperado = o.pg || null;
  return esperado == null ? null : Math.round(o.g - esperado);
}

const M = (n) => '$' + (Math.abs(n) / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' M';
const Mk = (n) => (Math.abs(n) >= 1e6 ? M(n) : '$' + Math.round(n / 1e3).toLocaleString('es-AR') + ' k');
const MESES_TXT = { '01': 'enero', '02': 'febrero', '03': 'marzo', '04': 'abril', '05': 'mayo', '06': 'junio', '07': 'julio', '08': 'agosto', '09': 'septiembre', '10': 'octubre', '11': 'noviembre', '12': 'diciembre' };
const fmtCosto = (v) => (v == null ? '—' : v >= 100 ? '$' + Math.round(v).toLocaleString('es-AR') : '$' + v.toLocaleString('es-AR', { maximumFractionDigits: 2 }));
const vx = (x) => (x == null || !isFinite(x) ? '—' : x.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '×');
const corto = (t, n = 60) => (t.length > n ? t.slice(0, n - 2) + '…' : t);
const hashId = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h.toString(36); };
const dmy = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
const pctTxt = (x) => `${x.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`;

// ---------- piezas (links de Facebook / Instagram para la vista previa) ----------
const piezaDe = (rs) => ({ fb: rs.find((x) => x.lfb)?.lfb || null, ig: rs.find((x) => x.lig)?.lig || null, otro: rs.find((x) => x.lnk)?.lnk || null });
const pz = (x, rol) => ({ nombre: x.nombre, rol, ...(x.pieza || {}) });

// ---------- todas las plataformas (DataJunta completa desde 01/06) ----------
const OBJ_PLAT = { Views: 'Reproducciones', FIXED_CPM: 'Alcance', 'Maximize clicks': 'Tráfico', OUTCOME_TRAFFIC: 'Tráfico', OUTCOME_ENGAGEMENT: 'Interacción', OUTCOME_AWARENESS: 'Alcance', Impresiones: 'Alcance' };
const RED_NOMBRE = { facebook: 'Facebook', instagram: 'Instagram', threads: 'Threads', whatsapp: 'WhatsApp', 'Tik Tok': 'TikTok', DV360: 'DV360', YouTube: 'YouTube',
  'Display Network': 'Google Display', 'Search Network': 'Google Search', Gmail: 'Gmail', Discover: 'Google Discover', SMS: 'SMS' };
const plataformasPor = {}, presupuestoPor = {};
// plataformas que cuenta la planilla de presupuestos (Meta, Google Ads, DV360, TikTok), con el nombre de DataJunta: el gastado
// desde DataJunta de los activos solo suma estas (SMS y el resto quedan afuera, Orquestador 1/10). La lista es la de
// presupuestos/activos.js (PLAT_DJ); si ese archivo la exporta se toma de ahí, si no, esta copia (hay que mantenerlas iguales).
const PLAT_DJ_PLANILLA = new Set(Object.values(require('../presupuestos/activos').PLAT_DJ ||
  { Meta: 'META', Google: 'Google Ads', DV360: 'Google Display & Video 360', TikTok: 'TikTok Ads' }));
for (const r of fuente.plataformas || []) {
  const k = `${r.canal}|${r.cliente}`;
  (plataformasPor[k] = plataformasPor[k] || []).push({ proy: r.proyecto, plat: r.plataforma, red: RED_NOMBRE[r.red] || r.red, obj: OBJ_PLAT[r.objetivo] || r.objetivo,
    voz: voz(r.activo), f: r.fecha, g: num(r.gasto), i: num(r.imp), r: num(r.rea), c: num(r.clk), vw: num(r.vw), e: num(r.eng) });
}
for (const r of fuente.presupuesto || []) if (num(r.presu) > 0) (presupuestoPor[`${r.canal}|${r.cliente}`] = presupuestoPor[`${r.canal}|${r.cliente}`] || []).push({ proy: r.proyecto, presu: num(r.presu) });
const fechaDe = (mes, d) => `${mes}-${String(d).padStart(2, '0')}`;
const diasDelMes = (mes) => new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate();
const sumarP = (rs) => rs.reduce((o, r) => { o.g += r.g; o.i += r.i; o.r += r.r; o.c += r.c; o.vw += r.vw; o.e += r.e; return o; }, { g: 0, i: 0, r: 0, c: 0, vw: 0, e: 0 });
const porDiaP = (rs, mes) => { const m = {}; for (const r of rs) if (r.f.startsWith(mes)) m[r.f] = (m[r.f] || 0) + r.g; return m; };
function panelPlataformas(P, canal) {
  const R = (plataformasPor[`${canal}|${P.cliente}`] || []).filter((r) => r.f <= datosHasta);
  if (!R.length) return null;
  const mesAct = datosHasta.slice(0, 7), diaAct = Number(datosHasta.slice(8, 10)), diasMes = diasDelMes(mesAct);
  const mesMenos = (k) => new Date(Date.UTC(Number(mesAct.slice(0, 4)), Number(mesAct.slice(5, 7)) - 1 - k, 1)).toISOString().slice(0, 7);
  const m1 = mesMenos(1), m2 = mesMenos(2), m3 = mesMenos(3);
  // consumo proyectado por proyecto (PresupuestoMensual de DataJunta; proyección = promedio de los últimos 2 días completos, como el tablero de Dirección)
  const proyectos = (presupuestoPor[`${canal}|${P.cliente}`] || []).map((p) => {
    const dia = porDiaP(R.filter((r) => r.proy === p.proy), mesAct);
    const acum = []; let s = 0;
    for (let d = 1; d <= diaAct; d++) { s += dia[fechaDe(mesAct, d)] || 0; acum.push(Math.round(s)); }
    const ritmo = ((dia[fechaDe(mesAct, diaAct - 1)] || 0) + (dia[fechaDe(mesAct, diaAct)] || 0)) / 2;
    const proy = s + ritmo * (diasMes - diaAct);
    return { proy: p.proy, presu: p.presu, gastado: Math.round(s), proyeccion: Math.round(proy), ritmo: Math.round(ritmo), acum,
      pctInv: r2(s / p.presu), pctTiempo: r2(diaAct / diasMes), pctCierre: r2(proy / p.presu) };
  }).sort((a, b) => b.presu - a.presu);
  // impacto comparado: mes en curso contra los dos anteriores, día a día
  const impacto = {};
  for (const [campo, lab] of [['i', 'Impresiones'], ['vw', 'Reproducciones'], ['r', 'Reacciones'], ['g', 'Gasto']]) {
    impacto[campo] = { lab, meses: [m2, m1, mesAct].map((mes) => {
      const out = Array(mes === mesAct ? diaAct : diasDelMes(mes)).fill(0);
      for (const r of R) if (r.f.startsWith(mes)) { const d = Number(r.f.slice(8, 10)) - 1; if (d < out.length) out[d] += r[campo]; }
      return { mes, dias: out.map(Math.round) };
    }) };
  }
  // picos y apagones: gasto diario de cada red contra su día típico del mes anterior (mediana)
  const picos = [...new Set(R.map((r) => r.red))].map((red) => {
    const rs = R.filter((r) => r.red === red);
    const tipico = percentil(Object.values(porDiaP(rs, m1)), 0.5) || 0;
    const act = porDiaP(rs, mesAct);
    const serie = []; for (let d = 1; d <= diaAct; d++) serie.push(tipico ? r2((act[fechaDe(mesAct, d)] || 0) / tipico) : null);
    const u2 = tipico ? ((act[fechaDe(mesAct, diaAct - 1)] || 0) + (act[fechaDe(mesAct, diaAct)] || 0)) / 2 / tipico : null;
    return { red, tipico: Math.round(tipico), serie, ultimo: r2(u2), gMes: Math.round(Object.values(act).reduce((a, b) => a + b, 0)) };
  }).filter((x) => x.tipico >= 20000 || x.gMes >= 500000).sort((a, b) => b.gMes - a.gMes);
  // lo mismo por activo (Estado de los activos)
  const vozPicos = {};
  for (const v of [...new Set(R.map((r) => r.voz))]) {
    const rs = R.filter((r) => r.voz === v);
    const tipico = percentil(Object.values(porDiaP(rs, m1)), 0.5) || 0;
    const act = porDiaP(rs, mesAct);
    const idx = tipico ? ((act[fechaDe(mesAct, diaAct - 1)] || 0) + (act[fechaDe(mesAct, diaAct)] || 0)) / 2 / tipico : null;
    // apagón = corte abrupto: venía gastando 5 de los 7 días anteriores; los sondeos por SMS no son pauta
    const previos = [2, 3, 4, 5, 6, 7, 8].filter((k) => (act[fechaDe(mesAct, diaAct - k)] || 0) > 0).length;
    const estado = idx == null || /sondeo|sms/i.test(v) ? null : idx < 0.5 && tipico >= 50000 && previos >= 5 ? 'Apagón' : idx > 2 && tipico >= 30000 ? 'Pico' : null;
    vozPicos[v] = { tipico: Math.round(tipico), idx: r2(idx), estado };
  }
  // costo por objetivo (red × objetivo) contra los 3 meses anteriores; verde 20 % o más barato, rojo 20 % o más caro
  const metrica = (obj) => (obj === 'Alcance' ? { lab: 'CPM', f: (o) => (o.i ? o.g / o.i * 1000 : null) }
    : obj === 'Interacción' ? { lab: 'Costo por reacción', f: (o) => (o.r ? o.g / o.r : null) }
      : obj === 'Reproducciones' ? { lab: 'Costo por reproducción', f: (o) => (o.vw ? o.g / o.vw : null) }
        : { lab: 'Costo por click', f: (o) => (o.c ? o.g / o.c : null) });
  const act = R.filter((r) => r.f.startsWith(mesAct)), ref = R.filter((r) => [m1, m2, m3].some((m) => r.f.startsWith(m)));
  const gTot = act.reduce((s, r) => s + r.g, 0) || 1;
  const costoObjetivo = [...new Set(act.map((r) => `${r.red}|${r.obj}`))].map((k) => {
    const [red, obj] = k.split('|'), me = metrica(obj);
    const a1 = sumarP(act.filter((r) => r.red === red && r.obj === obj)), r1 = sumarP(ref.filter((r) => r.red === red && r.obj === obj));
    const va = me.f(a1), vr = me.f(r1), delta = va != null && vr ? va / vr - 1 : null;
    return { red, obj, metrica: me.lab, peso: r2(a1.g / gTot), gasto: Math.round(a1.g), valor: va, ref: vr, delta: r2(delta),
      deMas: delta != null && delta > 0 ? Math.round(a1.g - a1.g / (1 + delta)) : 0,
      color: delta == null ? 'gris' : delta <= -0.2 ? 'verde' : delta >= 0.2 ? 'rojo' : 'amarillo' };
  }).filter((x) => x.peso >= 0.01).sort((a, b) => b.peso - a.peso);
  // variación contra el mismo tramo del mes anterior (Meta, para los números del Resumen)
  const tramo = (mes) => sumarP(R.filter((r) => r.plat === 'META' && r.f.startsWith(mes) && Number(r.f.slice(8, 10)) <= diaAct));
  const A = tramo(mesAct), B = tramo(m1);
  const v = (fa, fb) => (fa != null && fb ? r2(fa / fb - 1) : null);
  const deltas = { i: v(A.i, B.i), r: v(A.r, B.r), g: v(A.g, B.g), c: v(A.c, B.c), e: v(A.e, B.e),
    cr: v(A.r ? A.g / A.r : null, B.r ? B.g / B.r : null), cpm: v(A.i ? A.g / A.i : null, B.i ? B.g / B.i : null),
    treac: v(A.i ? A.r / A.i : null, B.i ? B.r / B.i : null), etr: v(A.i ? A.e / A.i : null, B.i ? B.e / B.i : null), ctr: v(A.i ? A.c / A.i : null, B.i ? B.c / B.i : null) };
  return { mesAct, diaAct, diasMes, meses: [m2, m1, mesAct], ref: [m3, m1], proyectos, impacto, picos, vozPicos, costoObjetivo, deltas, gastoMes: Math.round(sumarP(act).g) };
}

// ---------- un proyecto × canal ----------
// conjuntos agrupados por campaña de la app, para la marca de audiencias que se pisan
const conjuntosPor = {};
for (const r of fuente.conjuntos || []) (conjuntosPor[`${r.canal}|${r.cliente}|${r.comunic}`] = conjuntosPor[`${r.canal}|${r.cliente}|${r.comunic}`] || []).push(r);

function bloque(P, canal) {
  const rows = filas.filter((r) => r.cli === P.cliente && r.canal === canal);
  if (!rows.length) return null;
  const rowsMes = rows.filter((r) => r.mes === MES);
  const auto = (v) => canal === 'Informativo' && AUTOMATIZADOS.includes(v);
  const pob = poblacion[P.cliente] || null;
  const bandaVideo = (obj) => ({ ret25: valor(candG(obj, 'Video', null), 'ret25', 0), ret25p50: valor(candG(obj, 'Video', null), 'ret25') });

  // campañas
  const E = eficaciaPor[`${canal}|${P.cliente}`] || [];
  const agruparE = (clave) => { const m = {}; for (const r of E) (m[clave(r)] = m[clave(r)] || []).push(r); return m; };
  const pp = panelPlataformas(P, canal);
  const eCom = agruparE((r) => r.com), eCont = agruparE((r) => `${r.com}|${r.cod}`), eAud = agruparE((r) => `${r.com}|${r.aud}`);
  const deJuegos = (c) => c.voces.filter((v) => TERMINAN.includes(v.k)).reduce((a, v) => a + v.g, 0) >= c.m.g * 0.5;
  const campanas = agrupar(rows, (r) => r.com, (rs) => ({
    obj: dominante(rs, 'obj'), eje: dominante(rs, 'eje'), desde: minFecha(rs, 'desde'), hasta: maxFecha(rs, 'hasta'), fin: maxFecha(rs, 'fin'),
  })).map((c) => {
    const rs = rows.filter((r) => r.com === c.k);
    const viva = dias(c.hasta, datosHasta) <= 2;
    const finD = c.fin ? dias(datosHasta, c.fin) : null;
    const estado = viva ? (finD != null && finD <= 7 ? 'Por vencer' : 'Activa') : finD != null && finD > 0 ? 'Sin entrega' : 'Terminada';
    const m = suma(rs), mm = suma(rs.filter((r) => r.mes === MES));
    const gP = r2(idxPrincipal(m, c.obj, 'x')), pP = r2(idxPrincipal(m, c.obj, 'p'));
    const serie = diariaCom[`${canal}|${P.cliente}|${c.k}`] || {};
    const reciente = dias(c.hasta, datosHasta) <= 60;
    const out = { id: c.k, uid: `${P.id}|${canal}|${c.k}`, nombre: c.k, obj: c.obj, eje: c.eje, desde: c.desde, hasta: c.hasta, fin: c.fin, estado, m, mMes: mm,
      g7: Math.round(ult7.reduce((s, f) => s + (serie[f] || 0), 0)),
      idxG: gP, idxP: pP, luzG: luz(gP, c.obj), luzP: luz(pP, c.obj), deMas: deMas(m, c.obj), efi: efi(eCom[c.k]),
      voces: agrupar(rs, (r) => r.voz).map((v) => ({ k: v.k, g: Math.round(v.g), auto: auto(v.k) })) };
    if (['Activa', 'Por vencer'].includes(estado)) out.llegada = llegada(out, `${canal}|${P.cliente}|${c.k}`, P.nombre);
    // marca "solapan público" (solo marca, sin recomendación; decisión de Juan Pablo del 30/09). La detección es de Meta (reglas/meta.js)
    if (['Activa', 'Por vencer'].includes(estado)) {
      const sol = solapamientoAudiencias(conjuntosPor[`${canal}|${P.cliente}|${c.k}`] || [], { cliente: P.cliente, datosHasta });
      if (sol.length) out.solapamientos = sol;
    }
    if (reciente) {
      out.propia = propia(`${canal}|${P.cliente}|${c.k}`, c.obj, pob, c.k);
      out.serie = ult45.map((f) => Math.round(serie[f] || 0));
      out.porPl = agrupar(rs, (r) => r.pl).map((p) => ({ k: p.k, g: Math.round(p.g), i: p.i, r: p.r, c: p.c, sh: p.sh }));
      out.contenidos = agrupar(rs, (r) => r.cod, (cs) => ({ nombre: nombreCont(cs[0].cont), fmt: cs[0].fmt, obj: dominante(cs, 'obj'), desde: minFecha(cs, 'desde'), hasta: maxFecha(cs, 'hasta'),
        soloStories: cs.every((x) => /Stories/.test(x.pl)), pieza: piezaDe(cs) }))
        .slice(0, 20).map((x) => ({ ...x, crG: r2(idxCostoReac(x, 'x')), crP: r2(idxCostoReac(x, 'p')), deMas: deMas(x, 'Interacción'),
          efi: efi(eCont[`${c.k}|${x.k}`]), link: linkDe(eCont[`${c.k}|${x.k}`]) }));
      out.audiencias = agrupar(rs, (r) => r.aud).slice(0, 12).map((x) => ({ ...x, idxG: r2(idxPrincipal(x, c.obj, 'x')), idxP: r2(idxPrincipal(x, c.obj, 'p')), efi: efi(eAud[`${c.k}|${x.k}`]) }));
    }
    return out;
  }).filter((c) => c.m.g > 20000);

  // activos: presupuesto restante (planilla: el mes de la app, u.meses[MES]) + campañas activas
  const cuentas = unidades.filter((u) => { const m = mesPlanilla(u); return u.canal === canal && u.clientes.includes(P.cliente) && m && (m.pedido || m.gastado); });
  const voces = {};
  for (const u of cuentas) {
    const v = voz(u.nombre), p = parteDe(u, P.cliente);
    (voces[v] = voces[v] || { cuentas: [] }).cuentas.push({ cuenta: u.nombre, plataforma: u.plataforma, pedido: p.pedido, gastado: p.gastado, proy: p.proy, compartida: p.compartida });
  }
  for (const r of rows) voces[r.voz] = voces[r.voz] || { cuentas: [] };
  // gasto del mes de cada activo en DataJunta (solo las plataformas de la planilla, hasta el último día completo): el gastado cuando el mes no está en la planilla
  const gastoDJ = {};
  for (const r of plataformasPor[`${canal}|${P.cliente}`] || []) if (PLAT_DJ_PLANILLA.has(r.plat) && r.f.startsWith(MES) && r.f <= datosHasta) gastoDJ[r.voz] = (gastoDJ[r.voz] || 0) + r.g;
  // también un activo sin cuenta en la planilla en un mes que sí está cargado (Orquestador 1/10, mismo criterio D-d: nunca 0 si hay gasto real)
  for (const v of Object.keys(gastoDJ)) voces[v] = voces[v] || { cuentas: [] };
  const activos = Object.entries(voces).map(([nombre, v]) => {
    const rs = rowsMes.filter((r) => r.voz === nombre);
    const dePlanilla = mesEnPlanilla && v.cuentas.length > 0;
    const pedido = dePlanilla ? v.cuentas.reduce((s, c) => s + c.pedido, 0) : mesEnPlanilla ? null : 0, proy = v.cuentas.reduce((s, c) => s + c.proy, 0);
    const gastado = dePlanilla ? v.cuentas.reduce((s, c) => s + c.gastado, 0) : Math.round(gastoDJ[nombre] || 0);
    const serie = diariaVoz[`${canal}|${P.cliente}|${nombre}`] || {};
    const vivas = campanas.filter((c) => ['Activa', 'Por vencer'].includes(c.estado) && c.voces.some((x) => x.k === nombre));
    const m = suma(rs);
    const obj = dominante(rs, 'obj');
    return { nombre, auto: auto(nombre), cuentas: v.cuentas, pedido, gastado, gastadoFuente: dePlanilla ? 'planilla' : 'DataJunta',
      restante: pedidoCargado && pedido != null ? pedido - gastado : null, proy, pedidoCargado,
      g7: Math.round(ult7.reduce((s, f) => s + (serie[f] || 0), 0)),
      vivas: vivas.map((c) => c.nombre), pico: pp ? pp.vozPicos[nombre] || null : null, m, obj, idxG: r2(idxPrincipal(m, obj, 'x')), idxP: r2(idxPrincipal(m, obj, 'p')) };
  }).filter((a) => a.pedido || a.gastado || a.m.g || a.vivas.length).sort((a, b) => b.vivas.length - a.vivas.length || b.gastado - a.gastado);

  const gastado = activos.reduce((s, a) => s + a.gastado, 0); // planilla por cuenta + DataJunta de los activos sin cuenta (o todos, si el mes no está)
  const proy = cuentas.reduce((s, u) => s + parteDe(u, P.cliente).proy, 0);
  const pedido = pedidoCargado ? cuentas.reduce((s, u) => s + parteDe(u, P.cliente).pedido, 0) : null;

  // semáforo del proyecto: índice del KPI principal de cada campaña del mes, ponderado por gasto
  const pond = (pre) => {
    let s = 0, w = 0;
    for (const c of campanas) {
      if (!c.mMes.g) continue;
      const ix = idxPrincipal(c.mMes, c.obj, pre);
      if (ix == null || !isFinite(ix)) continue;
      s += c.mMes.g * Math.min(2, ix); w += c.mMes.g;
    }
    return w ? s / w : null;
  };
  const luzScore = (s) => luz(s, 'Interacción');

  // ---------- acciones ----------
  const vivas = campanas.filter((c) => ['Activa', 'Por vencer'].includes(c.estado) && !deJuegos(c));
  // recomendaciones: las arma recomendaciones.js con las reglas de cada plataforma (reglas/)
  // rows, fuenteSemanal y objetivo: para "Peor que la temporada anterior", que usa temporada() de app/marcas.js (02/10)
  const acciones = recomendaciones.generar({ P, canal, vivas, campanas, pp, deJuegos, bandaVideo, datosHasta, dias, luz, pz, corto, vx, Mk, dmy, pctTxt, hashId, fmtCosto, MESES_TXT, TERMINAN, COM_GENERICA,
    rows, fuenteSemanal: fuente.semanal, objetivo });

  // ---------- insights ----------
  const insights = { proyecto: [], cruces: [], estacionales: [] };
  const cli = P.cliente;
  const compara = (obj, fmt, met, nombre, fmtVal) => {
    const bp = BP[`${cli}|${canal}|${obj}|${fmt}`], bg = BG[`${obj}|${fmt}`];
    if (!bp || !bg || !bp[met] || !bg[met]) return;
    const ratio = bp[met][1] / bg[met][1];
    const costo = met.startsWith('costo');
    const bueno = costo ? ratio <= 0.77 : ratio >= 1.3, malo = costo ? ratio >= 1.3 : ratio <= 0.77;
    if (!bueno && !malo) return;
    insights.proyecto.push({ signo: bueno ? 'mas' : 'menos', peso: Math.abs(Math.log(ratio)),
      titulo: `${fmt} en ${obj}: ${nombre} ${vx(ratio)} la referencia general`,
      texto: `${fmtVal(bp[met][1])} contra ${fmtVal(bg[met][1])} en todos los gobiernos (${bp.n} contenidos, 365 días).${costo ? (bueno ? ' Más barato.' : ' Más caro.') : ''}` });
  };
  for (const obj of ['Alcance', 'Interacción']) {
    for (const fmt of ['Video', 'Placa Fija', 'Carrusel']) {
      compara(obj, fmt, 'costo_reac', 'costo por reacción', (v) => '$' + Math.round(v).toLocaleString('es-AR'));
      compara(obj, fmt, 'tasa_comp', 'tasa de compartido', (v) => pctTxt(v));
    }
    compara(obj, 'Video', 'ret25', 'retención al 25 %', (v) => pctTxt(v));
  }
  const ejes = agrupar(rows.filter((r) => r.eje && r.eje !== 'Sin codigo de Eje'), (r) => r.eje).filter((e) => e.g > 1000000 && e.pr > 0);
  if (ejes.length >= 3) {
    const conIdx = ejes.map((e) => ({ ...e, ix: e.r / e.pr })).sort((a, b) => b.ix - a.ix);
    const top = conIdx[0], bot = conIdx[conIdx.length - 1];
    insights.proyecto.push({ signo: 'mas', peso: 0.5, titulo: `El eje que más reacciona es ${top.k}`,
      texto: `${vx(top.ix)} lo esperable para el proyecto en 180 días; el que menos, ${bot.k} (${vx(bot.ix)}).` });
  }
  const auds = agrupar(rows, (r) => r.aud).filter((a) => a.g > 800000 && a.xr > 0).map((a) => ({ ...a, ix: a.r / a.xr })).sort((a, b) => b.ix - a.ix);
  if (auds.length >= 3) {
    insights.proyecto.push({ signo: 'mas', peso: 0.4, titulo: `Audiencia que mejor responde: ${corto(auds[0].k, 50)}`,
      texto: `${vx(auds[0].ix)} la referencia general en reacciones (${M(auds[0].g)} en 180 días). La que peor: ${corto(auds[auds.length - 1].k, 50)} (${vx(auds[auds.length - 1].ix)}).` });
  }
  insights.proyecto.sort((a, b) => b.peso - a.peso);

  const alc = rowsMes.filter((r) => r.obj === 'Alcance'), inter = rowsMes.filter((r) => r.obj === 'Interacción');
  const gAl = alc.reduce((s, r) => s + r.g, 0), gIn = inter.reduce((s, r) => s + r.g, 0);
  if (gAl > 300000) {
    const fbr = alc.filter((r) => r.pl === 'Facebook Reels').reduce((s, r) => s + r.g, 0) / gAl;
    insights.cruces.push({ aprendizaje: 'En Alcance, el mismo contenido saca 1,8× reacciones en Facebook Reels.', ahora: `Este mes Facebook Reels se lleva el ${Math.round(fbr * 100)} % del gasto de Alcance.`, alerta: fbr < 0.1 });
    const sto = alc.filter((r) => /Stories/.test(r.pl)).reduce((s, r) => s + r.g, 0) / gAl;
    insights.cruces.push({ aprendizaje: 'Stories no registra reacciones: su resultado se mide en impresiones, no en respuesta.', ahora: `${Math.round(sto * 100)} % del gasto de Alcance va a Stories.`, alerta: false });
  }
  if (gIn > 300000) {
    const deb = inter.filter((r) => PLACEMENTS_DEBILES.includes(r.pl)).reduce((s, r) => s + r.g, 0) / gIn;
    insights.cruces.push({ aprendizaje: 'En Interacción, Instream, Threads y Explore rinden entre 0,01 y 0,57 veces.', ahora: `${Math.round(deb * 100)} % del gasto de Interacción va a esos placements.`, alerta: deb >= 0.05 });
    const vid = inter.filter((r) => r.fmt === 'Video').reduce((s, r) => s + r.g, 0) / gIn;
    insights.cruces.push({ aprendizaje: 'En Interacción la placa es la más barata por reacción ($123) y el video el más caro ($196).', ahora: `El video se lleva el ${Math.round(vid * 100)} % del gasto de Interacción.`, alerta: vid > 0.6 });
    const arranques = campanas.filter((c) => c.obj === 'Interacción' && c.desde >= MES);
    const finde = arranques.filter((c) => [0, 5, 6].includes(new Date(c.desde + 'T12:00:00').getDay()));
    if (arranques.length >= 3) insights.cruces.push({ aprendizaje: 'El primer día de Interacción es el más barato y el domingo el peor día (0,91×).', ahora: `${finde.length} de ${arranques.length} campañas de Interacción de este mes arrancaron viernes, sábado o domingo.`, alerta: finde.length / arranques.length > 0.4 });
  }
  const largas = vivas.filter((c) => c.propia && c.propia.idxPropio != null);
  if (largas.length >= 2) {
    const desg = largas.filter((c) => luz(c.propia.idxPropio, c.obj) === 'rojo');
    insights.cruces.push({ aprendizaje: 'Las campañas largas se comparan contra su propia historia: cuando caen dos semanas debajo de su rango, se desgastaron.', ahora: `${desg.length} de ${largas.length} campañas largas vivas están debajo de su propio rango.`, alerta: desg.length / largas.length > 0.3 });
  }
  if (pob) {
    const imp = rowsMes.reduce((s, r) => s + r.i, 0);
    const porHab = imp / pob / Number(datosHasta.slice(8, 10)) * 30;
    insights.cruces.push({ aprendizaje: 'Por encima de 60–70 impresiones por habitante por mes aparece saturación (Chubut, Catamarca: la respuesta cae hasta 43 %).',
      ahora: `${canal} va a ${porHab.toFixed(0)} impresiones por habitante en el mes (proyectado).`, alerta: porHab > 60 });
  }
  // eficacia por categoría (lectura de "Ejes, Campañas y Audiencias" de Looker, con % del gasto en rojo): últimos 30 días
  const desde30 = new Date(new Date(datosHasta).getTime() - 30 * 864e5).toISOString().slice(0, 10);
  const E30 = E.filter((r) => r.hasta >= desde30);
  const porCat = (clave, min = 5) => { const m = {}; for (const r of E30) (m[clave(r) || '(sin dato)'] = m[clave(r) || '(sin dato)'] || []).push(r);
    return Object.entries(m).map(([k, rs]) => ({ k, g: Math.round(rs.reduce((a, r) => a + r.g, 0)), ...efi(rs) })).filter((x) => x.n >= min).sort((a, b) => b.g - a.g); };
  insights.eficacia = { ejes: porCat((r) => r.eje).slice(0, 12), formatos: porCat((r) => r.fmt, 1), audiencias: porCat((r) => r.aud).slice(0, 10), total: efi(E30) };
  insights.estacionales = campanas.filter((c) => c.propia && c.propia.tipo === 'temporada')
    .map((c) => ({ campana: c.id, uid: c.uid, obj: c.obj, previa: c.propia.previa, idx: c.propia.idx, luz: c.propia.luz }));

  const eContAll = agruparE((r) => r.cod);
  const topPiezas = agrupar(rowsMes, (r) => r.cod, (cs) => ({ nombre: nombreCont(cs[0].cont), com: cs[0].com, fmt: cs[0].fmt, pieza: piezaDe(cs) }))
    .filter((x) => (x.pieza.fb || x.pieza.ig) && !/^Sin C[oó]digo/i.test(x.nombre)).sort((a, b) => b.i - a.i).slice(0, 3)
    .map((x) => ({ k: x.k, nombre: x.nombre, com: x.com, fmt: x.fmt, pieza: x.pieza, i: x.i, r: x.r, g: Math.round(x.g), efi: efi(eContAll[x.k]) }));
  const vivasN = campanas.filter((c) => ['Activa', 'Por vencer'].includes(c.estado));
  return {
    canal, datosHasta,
    tarjeta: { luzG: luzScore(pond('x')), luzP: luzScore(pond('p')), gastado: pp ? pp.gastoMes : gastado, proy, pedido, pedidoCargado,
      presu: pp && pp.proyectos.length ? pp.proyectos.reduce((s, x) => s + x.presu, 0) : null,
      cierre: pp && pp.proyectos.length ? r2(pp.proyectos.reduce((s, x) => s + x.proyeccion, 0) / pp.proyectos.reduce((s, x) => s + x.presu, 0)) : null,
      vivas: vivasN.length, porVencer: campanas.filter((c) => c.estado === 'Por vencer').length, malas: vivasN.filter((c) => c.luzG === 'rojo' && c.luzP === 'rojo').length },
    kpis: suma(rowsMes), pob, campanas, activos, acciones, insights, plat: pp, topPiezas,
  };
}

const proyectos = PROYECTOS.map((P) => ({ ...P, canales: Object.fromEntries(['Oficial', 'Informativo'].filter((c) => !(P.soloInformativo && c === 'Oficial'))
  .map((c) => [c, bloque(P, c)]).filter(([, b]) => b)) }));

const GENERALES = [
  { titulo: 'El costo por reacción mide la efectividad del contenido', texto: 'Depende casi todo de la respuesta y poco del precio: correlación −0,92 con la tasa de reacción y apenas 0,11–0,15 con el CPM. Mejorar la pieza baja el costo más que cualquier ajuste de puja.', fuente: '18.733 contenidos × placement, 365 días' },
  { titulo: 'El objetivo es la decisión que más pesa', texto: 'El mismo contenido en Interacción paga 3,3× el CPM que en Alcance, pero cada reacción sale 7× más barata. A una campaña de Alcance no se la juzga por costo por reacción, ni a una de Interacción por CPM.', fuente: '1.246 contenidos que corrieron en los dos objetivos el mismo mes' },
  { titulo: 'Facebook Reels es el mejor lugar para reacciones', texto: 'En Alcance el mismo contenido saca 1,8× reacciones en Facebook Reels (placas 2,0×) al mismo CPM. Instagram Reels, 1,1–1,2×.', fuente: '2.190 contenidos en más de un placement' },
  { titulo: 'Los clicks salen de Facebook', texto: 'Facebook Feed da 1,8× el CTR del mismo contenido; Instagram, entre 0,2 y 0,4×. Para Tráfico, Instagram tira el promedio para abajo.', fuente: '365 días, todos los gobiernos' },
  { titulo: 'La retención mide la calidad del video', texto: 'En Alcance, 1 de cada 4 reproducciones llega al 25 % y 3 % al final; en Interacción, 31 % y 5 %. Los videos que se ven completos también juntan más reacciones (0,59).', fuente: '7.920 videos' },
  { titulo: 'Qué se comparte y qué se discute', texto: 'La información útil se comparte (Expo Empleo, inscripciones, boleto educativo). Los temas en conflicto se comentan (paritarias, jubilaciones). Las placas generan 3× más comentarios por reacción que el video.', fuente: '4.460 contenidos con 300+ reacciones' },
  { titulo: 'El día 5 ya dice cómo termina', texto: 'Una campaña en el peor cuartil al día 5 termina ahí el 82 % de las veces; solo el 3 % se recupera por encima de la mediana.', fuente: '2.791 campañas de 8+ días' },
  { titulo: 'La fatiga llega entre el día 12 y el 15', texto: 'La tasa de reacción cae 45 % contra la primera semana. Las campañas largas se comparan contra su propia historia para ver cuándo se desgastan.', fuente: 'Tanda 3' },
  { titulo: 'Lo abierto y amplio rinde', texto: 'Audiencias abiertas de provincia: 0,92× la referencia. Custom (núcleo duro): 1,4×. Listas de localidades: 1,8×. El núcleo duro se compara solo contra núcleo duro.', fuente: 'Tanda 4' },
  { titulo: 'Qué mide el ETR', texto: 'Engagement ÷ impresiones. En video el 98 % del engagement son reproducciones; en placas, el 86 % son clicks: se compara dentro del mismo formato.', fuente: 'Composición del engagement, 365 días' },
];

const DATA = { mes: MES, datosHasta, pedidoCargado, mesEnPlanilla, proyectos, generales: GENERALES, umbrales: UMBRAL, umbralesLlegada: UMBRAL_LLEGADA };

// Reutilizable desde Seguimiento/app/armar.js (diseño curado): datos calculados + helpers.
module.exports = { DATA, fuente, NOMBRES_OFICIALES, filas, BG, BP, valor, candG, candP, eficaciaPor, efi, colorCategoria, idxPrincipal, idxCostoReac, luz, UMBRAL, r2, percentil,
  dias, suma, agrupar, dominante, minFecha, maxFecha, voz, formato, pgrp, nombreCont, objetivo, num, deMas, piezaDe, pz, linkDe, M, Mk, fmtCosto, vx, corto, hashId, dmy,
  MESES_TXT, RED_NOMBRE, OBJ_PLAT, AUTOMATIZADOS, TERMINAN, PROYECTOS, datosHasta, MES, poblacion, fechas, diariaCom, diariaVoz, plataformasPor, presupuestoPor, fechaDe, diasDelMes, INFLACION_MES };

if (require.main === module) {
const plantilla = fs.readFileSync(path.join(__dirname, 'plantilla.html'), 'utf8');
const html = plantilla.replace('/*__DATA__*/null', JSON.stringify(DATA).replace(/</g, '\u003c'));
fs.writeFileSync(path.join(__dirname, 'borrador-interfaz.html'), html);
for (const p of proyectos) for (const [c, b] of Object.entries(p.canales)) {
  const conPropia = b.campanas.filter((x) => x.propia).length, est = b.insights.estacionales.length;
  console.log(`${p.nombre.padEnd(20)} ${c.padEnd(11)} campañas ${String(b.campanas.length).padStart(3)} (vivas ${b.tarjeta.vivas}) · largas ${conPropia} (estacionales ${est}) · acciones ${b.acciones.length} · luz ${b.tarjeta.luzG}/${b.tarjeta.luzP}`);
}
console.log(`
${Math.round(html.length / 1024)} KB · datos al ${datosHasta}`);
}
