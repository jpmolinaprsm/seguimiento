// Marcas, proyección y temporada para el rediseño "recorrido v1" (encargo del 02/10, agente Referencias e Insights).
// Funciones puras: no leen archivos ni BigQuery. Las llama Interfaz desde app/armar.js con los datos que ya trae _proyectos.json.
//
//   const M = require('./marcas.js');
//   const marcas = M.crearMarcas(B.filas);                    // una vez: arma las tablas de cuartiles
//   marcas.marcar({ valor, kpi, proyecto, canal, objetivo, placement })   → { estado, p25, p50, p75, base, n }
//   marcas.marcarFilas(filas, kpi, { proyecto, canal })       → la marca de un grupo de filas (campaña, pieza…), con su mezcla de placements
//   marcas.marcaCampana(filas, objetivo, { proyecto, canal }) → la marca del KPI de su objetivo
//   marcas.marcasPorMetrica(filas, { proyecto, canal })       → { cr, cpm, ctr, treac, tcomp, etrV, etrI, cv } (Exploración)
//   M.combinar([{ estado, gasto }])                           → la marca de un eje, un activo o un proyecto
//   M.proyectar({ serie, presupuesto, datosHasta, fin })      → gasto e impresiones al cierre, llega / se pasa / no llega, ritmo
//   M.temporada({ actual, pasada, inicio, previa, datosHasta, objetivo }) → luz contra la temporada pasada y "peor que la temporada anterior"
//
// Filas (forma de B.filas del borrador): { cli, canal, mes, obj, fmt, pl, cod, g, i, r, c, e, sh, vw }. pl es el placement agrupado del
// borrador (los ocho principales, Instagram Explore y Otros). Nunca se usa ni se suma alcance.

// ---------- 1. Marca Bueno / Normal / Malo por cuartiles (como Eficacia de Looker) ----------
// Canal: 'Oficial', 'Informativo' o 'Ambas' (los dos juntos; antes se llamaba General).
// Unidad: pieza × placement (el código de contenido en ese placement, sumando meses y audiencias), como Looker usa anuncio × placement.
// Cortes: P25, P50 y P75 del KPI de las piezas del proyecto, por Objetivo × Placement, canal por separado (en Ambas, los dos juntos).
// Si la celda tiene menos de MIN_N piezas, Objetivo solo dentro del proyecto; si tampoco, sin referencia.
// Costos: Bueno ≤ P25, Malo > P75. Tasas: Bueno ≥ P75, Malo < P25 (igual que el semáforo de Looker, dado vuelta en las tasas).
const MIN_N = 12;                 // como Eficacia
const CANAL_AMBAS = 'Ambas';
const MIN_IMP = 1000;             // una pieza con menos de mil impresiones en ese placement no entra en los cortes (ruido)
const DESDE = '2026-01-01';       // 2026 en lo que va del año (hoy el cruce de _proyectos.json trae desde abril; cuando Extracción traiga el
                                  // cruce desde el 01/01 en su archivo, se le pasa a crearMarcas y los cuartiles se recalculan solos)
const SIN_REACCIONES = /Stories|Audience Network|Rewarded|Status/;   // el universo de Looker: sin reacciones medibles
// Registro de KPIs (05/10). Para agregar un KPI propio alcanza con sumar una línea acá: num y den = campos de la fila (g gasto, i impresiones,
// r reacciones, c clicks, e engagement, sh compartidas, vw reproducciones), k = factor, costo = más bajo es mejor, fmts = solo esos formatos,
// excluirPl = placements que no entran. Los cuartiles, las letras para la app y las tablas para el navegador lo toman solos. Un KPI sin num
// ni den (por ejemplo, CPM de Alcance, que no tiene dato por pieza y placement) queda siempre "sin referencia".
const KPIS = {
  cr: { num: 'g', den: 'r', k: 1, costo: true, excluirPl: SIN_REACCIONES, nombre: 'Costo por reacción' },
  cpm: { num: 'g', den: 'i', k: 1000, costo: true, nombre: 'CPM' },
  ctr: { num: 'c', den: 'i', k: 100, nombre: 'CTR' },
  etrV: { num: 'e', den: 'i', k: 100, fmts: ['Video'], nombre: 'ETR Videos' },
  etrI: { num: 'e', den: 'i', k: 100, fmts: ['Placa Fija', 'Carrusel'], nombre: 'ETR Imágenes' },
  cv: { num: 'g', den: 'vw', k: 1, costo: true, nombre: 'Costo por reproducción' },
  treac: { num: 'r', den: 'i', k: 100, excluirPl: SIN_REACCIONES, nombre: 'Tasa de reacción' },
  tcomp: { num: 'sh', den: 'i', k: 100, nombre: 'Tasa de compartido' },
  ca: { costo: true, nombre: 'CPM de Alcance' },   // gasto ÷ personas alcanzadas: Meta no da el alcance por pieza y placement
};
// los KPIs con cuartiles, en un orden fijo: el de las letras de cada fila (mks) y el de las tablas del navegador
const KPI_ORDEN = Object.keys(KPIS).filter((k) => KPIS[k].num && KPIS[k].den);
// el KPI de cada objetivo (el mismo que usa hoy la app)
const KPI_OBJETIVO = { Interacción: 'cr', Alcance: 'cpm', Tráfico: 'ctr', Conversión: 'ctr', Reproducciones: 'cv', Views: 'cv' };
const COBERTURA = 0.8;
const LETRA = { bueno: 'B', normal: 'N', malo: 'M', sin_ref: 'S' };            // la referencia tiene que cubrir el 80 % del denominador (como la columna de KPI)

const r4 = (x) => (x == null || !isFinite(x) ? null : Math.round(x * 1e4) / 1e4);
function percentil(xs, q) {
  const s = xs.slice().sort((a, b) => a - b); if (!s.length) return null;
  const p = (s.length - 1) * q, lo = Math.floor(p); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (p - lo);
}
const entra = (r, def) => (!def.fmts || def.fmts.includes(r.fmt)) && !(def.excluirPl && def.excluirPl.test(r.pl || ''));
const valorDe = (rows, def) => { let n = 0, d = 0; for (const r of rows) { if (!entra(r, def)) continue; n += r[def.num] || 0; d += r[def.den] || 0; } return { v: d ? r4(n / d * def.k) : null, d }; };
// decil de un valor dentro de una lista ordenada: la posición con la misma interpolación que percentil() (así el decil y los cuartiles
// de la marca salen de la misma cuenta: Bueno ⇔ posición ≤ 25 % ⇔ decil 1 a 3; Malo ⇔ posición > 75 % ⇔ decil 8 a 10). En costos, más bajo
// es mejor; en tasas, al revés. 1 = el 10 % mejor, 10 = el 10 % peor.
function posicionDe(s, v) {
  const n = s.length; if (!n) return null; if (n === 1 || v <= s[0]) return 0; if (v >= s[n - 1]) return 1;
  let i = 0; while (i < n - 2 && s[i + 1] <= v) i++;
  const tramo = s[i + 1] - s[i];
  return (i + (tramo > 0 ? (v - s[i]) / tramo : 0)) / (n - 1);
}
function decilDe(ordenados, valor, costo) {
  const p = posicionDe(ordenados, valor); if (p == null || valor == null) return null;
  const q = costo ? p : 1 - p;
  return Math.min(10, Math.max(1, Math.ceil(q * 10)));
}
// deciles con celdas propias (07/10, plataformas que no son Meta): unidades = [{ claves: [celda, celda más amplia, …], valor, i }].
// Una unidad entra si tiene minImp impresiones o más y un valor; una celda vale con minN unidades o más. decil(claves, valor, costo) usa
// la primera celda con base y devuelve { decil, nivel (índice de la celda usada), n }; si ninguna alcanza, decil null.
function tablaDeciles(unidades, { minN = MIN_N, minImp = MIN_IMP } = {}) {
  const xs = {};
  for (const u of unidades) {
    if (!(u.i >= minImp) || u.valor == null || !isFinite(u.valor)) continue;
    for (const k of u.claves) if (k != null) (xs[k] = xs[k] || []).push(u.valor);
  }
  const ord = Object.fromEntries(Object.entries(xs).filter(([, v]) => v.length >= minN).map(([k, v]) => [k, v.sort((a, b) => a - b)]));
  const decil = (claves, valor, costo) => {
    if (valor == null || !isFinite(valor)) return { decil: null, nivel: null, n: null };
    for (let j = 0; j < claves.length; j++) { const s = claves[j] != null && ord[claves[j]]; if (s) return { decil: decilDe(s, valor, costo), nivel: j, n: s.length }; }
    return { decil: null, nivel: null, n: null };
  };
  return { decil, celdas: ord };
}
function estadoDe(valor, p25, p75, costo) {
  if (valor == null || p25 == null || p75 == null) return 'sin_ref';
  if (costo) return valor <= p25 ? 'bueno' : valor > p75 ? 'malo' : 'normal';
  return valor >= p75 ? 'bueno' : valor < p25 ? 'malo' : 'normal';
}

function crearMarcas(filas, { desde = DESDE, minN = MIN_N, minImp = MIN_IMP } = {}) {
  // unidades: canal × proyecto × objetivo × placement × pieza (y la misma unidad en "Ambas", con los dos canales juntos)
  const u = new Map();
  for (const r of filas) {
    if (!r.mes || r.mes + '-01' < desde.slice(0, 7) + '-01' || !(r.g > 0)) continue;
    for (const canal of [r.canal, CANAL_AMBAS]) {
      const k = [canal, r.cli, r.obj, r.pl, r.fmt, r.cod].join('|');
      let o = u.get(k);
      if (!o) u.set(k, (o = { canal, cli: r.cli, obj: r.obj, pl: r.pl, fmt: r.fmt, g: 0, i: 0, r: 0, c: 0, e: 0, sh: 0, vw: 0 }));
      for (const m of ['g', 'i', 'r', 'c', 'e', 'sh', 'vw']) o[m] += r[m] || 0;
    }
  }
  // cortes por celda: kpi → clave → { p25, p50, p75, n }
  const celdas = {}, objetivo = {}, valoresP = {}, valoresO = {};
  for (const kpi of KPI_ORDEN) {
    const def = KPIS[kpi], xp = {}, xo = {};
    for (const o of u.values()) {
      if (o.i < minImp || !entra(o, def) || !(o[def.den] > 0) || (def.costo && !(o[def.num] > 0))) continue;
      const x = o[def.num] / o[def.den] * def.k;
      (xp[`${o.canal}|${o.cli}|${o.obj}|${o.pl}`] = xp[`${o.canal}|${o.cli}|${o.obj}|${o.pl}`] || []).push(x);
      (xo[`${o.canal}|${o.cli}|${o.obj}`] = xo[`${o.canal}|${o.cli}|${o.obj}`] || []).push(x);
    }
    const cortes = (m) => Object.fromEntries(Object.entries(m).filter(([, xs]) => xs.length >= minN)
      .map(([k, xs]) => [k, { p25: r4(percentil(xs, 0.25)), p50: r4(percentil(xs, 0.5)), p75: r4(percentil(xs, 0.75)), n: xs.length }]));
    celdas[kpi] = cortes(xp); objetivo[kpi] = cortes(xo);
    // los valores ordenados de cada celda con base (para los deciles de Creatividades, pedido 053)
    const orden = (m) => Object.fromEntries(Object.entries(m).filter(([, xs]) => xs.length >= minN).map(([k, xs]) => [k, xs.slice().sort((a, b) => a - b)]));
    valoresP[kpi] = orden(xp); valoresO[kpi] = orden(xo);
  }
  const corteDe = (kpi, proyecto, canal, obj, pl) => {
    const a = pl != null && celdas[kpi] && celdas[kpi][`${canal}|${proyecto}|${obj}|${pl}`];
    if (a) return { ...a, base: 'objetivo×placement' };
    const b = objetivo[kpi] && objetivo[kpi][`${canal}|${proyecto}|${obj}`];
    return b ? { ...b, base: 'objetivo' } : null;
  };

  // un valor suelto contra su celda
  function marcar({ valor, kpi, proyecto, canal, objetivo: obj, placement }) {
    const def = KPIS[kpi];
    if (!def) throw new Error(`KPI desconocido: ${kpi}`);
    const c = corteDe(kpi, proyecto, canal, obj, placement);
    if (!c || valor == null) return { estado: 'sin_ref', p25: c ? c.p25 : null, p50: c ? c.p50 : null, p75: c ? c.p75 : null, base: c ? c.base : null, n: c ? c.n : 0 };
    return { estado: estadoDe(valor, c.p25, c.p75, def.costo), p25: c.p25, p50: c.p50, p75: c.p75, base: c.base, n: c.n };
  }

  // un grupo de filas (campaña, pieza, audiencia…): el valor del grupo contra los cortes de su mezcla. Cada objetivo × placement del
  // grupo aporta sus cortes, ponderados por su denominador (impresiones, reacciones o reproducciones). Si los cortes por objetivo ×
  // placement cubren el 80 % del denominador, base 'objetivo×placement'; si no, los de objetivo solo; si tampoco, sin referencia.
  function marcarFilas(rows, kpi, { proyecto, canal }) {
    const def = KPIS[kpi];
    if (!def) throw new Error(`KPI desconocido: ${kpi}`);
    if (!def.num || !def.den) return { estado: 'sin_ref', valor: null, p25: null, p50: null, p75: null, base: null };
    const { v, d } = valorDe(rows, def);
    if (v == null || !d) return { estado: 'sin_ref', valor: v, p25: null, p50: null, p75: null, base: null };
    const grupos = {};
    for (const r of rows) { if (!entra(r, def) || !(r[def.den] > 0)) continue; const k = `${r.obj}|${r.pl}`; grupos[k] = grupos[k] || { obj: r.obj, pl: r.pl, d: 0 }; grupos[k].d += r[def.den]; }
    for (const base of ['objetivo×placement', 'objetivo']) {
      let w = 0; const s = { p25: 0, p50: 0, p75: 0 };
      for (const gr of Object.values(grupos)) {
        const c = base === 'objetivo' ? corteDe(kpi, proyecto, canal, gr.obj, null) : (celdas[kpi][`${canal}|${proyecto}|${gr.obj}|${gr.pl}`] || null);
        if (!c) continue;
        w += gr.d; s.p25 += c.p25 * gr.d; s.p50 += c.p50 * gr.d; s.p75 += c.p75 * gr.d;
      }
      if (w && w >= d * COBERTURA) {
        const p25 = r4(s.p25 / w), p50 = r4(s.p50 / w), p75 = r4(s.p75 / w);
        return { estado: estadoDe(v, p25, p75, def.costo), valor: v, p25, p50, p75, base };
      }
    }
    return { estado: 'sin_ref', valor: v, p25: null, p50: null, p75: null, base: null };
  }
  const marcaCampana = (rows, obj, ctx) => { const kpi = KPI_OBJETIVO[obj]; return kpi ? { kpi, ...marcarFilas(rows, kpi, ctx) } : { kpi: null, estado: 'sin_ref' }; };
  const marcasPorMetrica = (rows, ctx) => Object.fromEntries(Object.keys(KPIS).map((k) => [k, marcarFilas(rows, k, ctx)]));
  // letras para la app (05/10): una por KPI de KPI_ORDEN (B bueno, N normal, M malo, S sin referencia), con la mezcla de placements de las
  // filas. Ej.: 'NBMSNNBN'. La app toma la del KPI elegido en el selector: mks[KPI_ORDEN.indexOf(kpi)].
  const letras = (rows, ctx) => (rows.length ? KPI_ORDEN.map((k) => LETRA[marcarFilas(rows, k, ctx).estado] || 'S').join('') : 'S'.repeat(KPI_ORDEN.length));
  // tablas para el navegador (05/10): los cortes de cada celda con 4 cifras significativas. pl = canal|proyecto|objetivo|placement y
  // ob = canal|proyecto|objetivo; cada valor es una lista en el orden de KPI_ORDEN con [p25, p50, p75] o 0 si esa celda no tiene base.
  // En el navegador: estadoDe(valor, p25, p75, costo[i]); primero la celda del placement y, si es 0, la del objetivo.
  const tablas = () => {
    const c4 = (x) => (x == null ? null : Number(x.toPrecision(4)));
    const juntar = (fuente) => { const out = {};
      KPI_ORDEN.forEach((kpi, i) => { for (const [k, v] of Object.entries(fuente[kpi] || {})) { (out[k] = out[k] || KPI_ORDEN.map(() => 0))[i] = [c4(v.p25), c4(v.p50), c4(v.p75)]; } });
      return out; };
    return { orden: KPI_ORDEN, costo: KPI_ORDEN.map((k) => !!KPIS[k].costo), pl: juntar(celdas), ob: juntar(objetivo) };
  };
  // decil de un grupo de filas de UNA sola celda (objetivo × placement), contra la misma referencia que su marca (pedido 053, Creatividades):
  // misma celda, misma caída a objetivo, mismo valor. 1 = el 10 % mejor, 10 = el 10 % peor. Si las filas tocan más de una celda, null.
  function decilFilas(rows, kpi, { proyecto, canal }) {
    const def = KPIS[kpi], m = def && marcarFilas(rows, kpi, { proyecto, canal });
    const nada = { decil: null, base: null, n: null, estado: m ? m.estado : 'sin_ref', valor: m ? m.valor : null };
    if (!m || !m.base || m.valor == null) return nada;
    const celdasF = new Set(rows.filter((r) => entra(r, def) && r[def.den] > 0).map((r) => `${r.obj}|${r.pl}`));
    if (celdasF.size !== 1) return nada;
    const [obj, pl] = [...celdasF][0].split('|');
    const xs = m.base === 'objetivo×placement' ? valoresP[kpi][`${canal}|${proyecto}|${obj}|${pl}`] : valoresO[kpi][`${canal}|${proyecto}|${obj}`];
    if (!xs) return nada;
    return { decil: decilDe(xs, m.valor, def.costo), base: m.base, n: xs.length, estado: m.estado, valor: m.valor };
  }
  return { marcar, marcarFilas, marcaCampana, marcasPorMetrica, letras, tablas, decilFilas, cortes: { celdas, objetivo } };
}

// la marca de un eje, un activo o un proyecto (decisión de Juan Pablo del 02/10): la más repetida entre sus campañas, ponderada por
// gasto (la marca que junta más gasto). Sin referencia también compite: si es la que más gasto junta, la marca es sin_ref. En un empate
// gana Normal; si Normal no está en el empate, Malo, después Bueno. Devuelve el reparto del gasto en % enteros.
// Para un activo conviene marcar cada campaña con sus filas en ese activo.
const DESEMPATE = ['normal', 'malo', 'bueno', 'sin_ref'];
function combinar(items) {
  let gT = 0; const reparto = { bueno: 0, normal: 0, malo: 0, sin_ref: 0 };
  for (const it of items) { const g = Math.max(0, it.gasto || 0); gT += g; reparto[it.estado in reparto ? it.estado : 'sin_ref'] += g; }
  const pct = (x) => (gT ? Math.round(x / gT * 100) : 0);
  const out = { reparto: { bueno: pct(reparto.bueno), normal: pct(reparto.normal), malo: pct(reparto.malo), sin_ref: pct(reparto.sin_ref) }, campanas: items.length };
  if (!gT) return { estado: 'sin_ref', ...out };
  const max = Math.max(...Object.values(reparto));
  return { estado: DESEMPATE.find((e) => reparto[e] === max), ...out };
}

// ---------- 2. Proyección: gasto e impresiones al cierre del mes ----------
// serie = [{ f: 'AAAA-MM-DD', g, i }] por día (todas las plataformas); presupuesto del mes (o null); datosHasta = último día completo;
// fin = Fin de la campaña (exclusivo, como DataJunta), si termina antes de fin de mes.
// Ritmo de gasto = promedio de los últimos 7 días. Cierre = lo que lleva + ritmo × días que faltan.
//   llega: el cierre queda dentro de ±10 % del presupuesto; se_pasa: más de 10 % arriba; no_llega: más de 10 % abajo.
//   Ritmo con presupuesto: el de los últimos 7 días contra el que haría falta para llegar justo (±10 %).
//   Ritmo sin presupuesto: los últimos 7 días contra los 21 anteriores (±20 %, el corte de las luces).
// Antes del día 5 (regla H1; desde el 05/10, antes el 10): estado 'antes_dia_10' (se dejó el nombre) y solo lo que lleva (y el ritmo, si ya es el día 3). El alcance nunca se proyecta ni
// se suma. El ritmo arranca el día 3 del mes (decisión de Juan Pablo del 03/10): antes, ritmo null y ritmoDesde = 'AAAA-MM-03'.
const DIA_MINIMO = 5, DIA_RITMO = 3, TOLERANCIA = 0.10, TOLERANCIA_RITMO = 0.20;
const addDias = (f, n) => new Date(new Date(f + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);
const finDeMes = (f) => { const d = new Date(f.slice(0, 7) + '-01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.toISOString().slice(0, 10); };
function proyectar({ serie, presupuesto = null, datosHasta, fin = null, tolerancia = TOLERANCIA, diaMinimo = DIA_MINIMO, diaRitmo = DIA_RITMO }) {
  const mes = datosHasta.slice(0, 7), desde = mes + '-01';
  const porDia = {};
  for (const x of serie || []) { if (x.f > datosHasta) continue; const o = porDia[x.f] = porDia[x.f] || { g: 0, i: 0 }; o.g += x.g || 0; o.i += x.i || 0; }
  const suma = (a, b) => { let g = 0, i = 0; for (let f = a; f <= b; f = addDias(f, 1)) { const o = porDia[f]; if (o) { g += o.g; i += o.i; } } return { g, i }; };
  const lleva = suma(desde, datosHasta), pres = presupuesto > 0 ? presupuesto : null;
  const base = { mes, datosHasta, lleva: { gasto: Math.round(lleva.g), impresiones: Math.round(lleva.i) }, presupuesto: pres, usado: pres ? r4(lleva.g / pres) : null };
  const dia = Number(datosHasta.slice(8, 10)), ritmoDesde = dia < diaRitmo ? `${mes}-${String(diaRitmo).padStart(2, '0')}` : null;
  // último día con gasto posible: fin de mes, o el día anterior al Fin de la campaña
  let ultimo = finDeMes(datosHasta);
  if (fin && addDias(fin, -1) < ultimo) ultimo = addDias(fin, -1);
  const faltan = Math.max(0, diasEntre(datosHasta, ultimo));
  const u7 = suma(addDias(datosHasta, -6), datosHasta), ritmoG = u7.g / 7, ritmoI = u7.i / 7;
  let ritmo = null, necesario = null;
  if (!ritmoDesde) {
    if (pres) { if (faltan > 0) { necesario = Math.max(0, (pres - lleva.g) / faltan); ritmo = !necesario ? 'rapido' : ritmoG > necesario * (1 + tolerancia) ? 'rapido' : ritmoG < necesario * (1 - tolerancia) ? 'lento' : 'normal'; } }
    else { const p21 = suma(addDias(datosHasta, -27), addDias(datosHasta, -7)).g / 21; if (p21 > 0) ritmo = ritmoG > p21 * (1 + TOLERANCIA_RITMO) ? 'rapido' : ritmoG < p21 / (1 + TOLERANCIA_RITMO) ? 'lento' : 'normal'; }
  }
  const conRitmo = { ritmo, ...(ritmoDesde ? { ritmoDesde } : {}), ...(necesario != null ? { ritmoNecesario: Math.round(necesario) } : {}) };
  if (dia < diaMinimo) return { estado: 'antes_dia_10', desde: `${mes}-${String(diaMinimo).padStart(2, '0')}`, ...conRitmo, ...base };
  const cierre = { gasto: Math.round(lleva.g + ritmoG * faltan), impresiones: Math.round(lleva.i + ritmoI * faltan) };
  let estado = 'sin_presupuesto';
  if (pres) { const x = cierre.gasto / pres; estado = x > 1 + tolerancia ? 'se_pasa' : x < 1 - tolerancia ? 'no_llega' : 'llega'; }
  return { estado, ritmo, cierre, faltanDias: faltan, ritmoDiario: Math.round(ritmoG), ...(necesario != null ? { ritmoNecesario: Math.round(necesario) } : {}), ...base };
}
// serie diaria a partir de las filas de fuente.todas (todas las plataformas) con el filtro que se quiera (proyecto, eje, campaña, activo)
const serieDe = (todas, filtro) => todas.filter(filtro).map((r) => ({ f: r.fecha, g: +r.gasto || 0, i: +r.imp || 0 }));

// ---------- 3. Temporada: luz y "peor que la temporada anterior" ----------
// El mismo criterio que la tarjeta "Esta temporada" del panel Rendimiento (02/10): toda esta temporada (actual = filas del cruce desde
// el mes en que volvió a correr, las del número grande) contra la misma cantidad de semanas desde el inicio de la temporada pasada (si la
// pasada fue más corta, toda la pasada). Objetivo por objetivo y formato por formato; si por formato no cubre el 80 %, objetivo por
// objetivo; si tampoco, sin comparación. Costos de la pasada llevados a hoy con la inflación de cada objetivo.
// pasada = semanas [{ s (lunes), obj, fmt, g, i, r, c, sh }] (semanasDe, todas las de la comunicación: de ahí sale también la mezcla de
// objetivos y formatos de esta temporada); inicio = primer lunes de esta temporada; previa = { desde, hasta }.
// Luz: verde 20 % o más mejor, rojo 20 % o más peor, amarillo en el medio (como la luz Propia). Disparador: la luz del KPI del objetivo en rojo.
const INFLACION_MES = { Alcance: 0, Interacción: 0.02, Tráfico: 0.02 };
const KPI_TEMP = ['cr', 'cpm', 'ctr', 'treac', 'tcomp'];
const UMBRAL = 1.2;
const FMT_SEM = (f) => (f === 'Video' || f === 'Placa Fija' || f === 'Carrusel' ? f : '(otro)');
const lunesDe = (f) => { const d = new Date(f + 'T00:00:00Z'), w = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - w); return d.toISOString().slice(0, 10); };
const agrupar = (rows, clave) => rows.reduce((m, r) => { const f = clave(r), o = m[f] = m[f] || { g: 0, i: 0, r: 0, c: 0, sh: 0 }; o.g += r.g || 0; o.i += r.i || 0; o.r += r.r || 0; o.c += r.c || 0; o.sh += r.sh || 0; return m; }, {});
const luzDe = (idx) => (idx == null ? 'gris' : idx < 1 / UMBRAL ? 'rojo' : idx < UMBRAL ? 'amarillo' : 'verde');
function temporada({ actual, pasada, inicio, previa, datosHasta, objetivo, inflacion = INFLACION_MES, cobertura = COBERTURA }) {
  if (!previa || !inicio || !actual || !pasada) return null;
  const n = Math.round((new Date(lunesDe(datosHasta)) - new Date(lunesDe(inicio))) / (7 * 864e5)) + 1;
  const tope = addDias(previa.desde, 7 * n - 1), hasta = tope < previa.hasta ? tope : previa.hasta;
  const pas = pasada.filter((w) => w.s >= previa.desde && w.s <= hasta);
  const meses = diasEntre(previa.desde, inicio) / 30.4, infl = (obj) => Math.pow(1 + (inflacion[obj] || 0), meses);
  const info = { semanas: new Set(pas.map((w) => w.s)).size, desde: previa.desde, toda: hasta === previa.hasta };
  const porF = (r) => `${r.obj}|${FMT_SEM(r.fmt)}`, porO = (r) => r.obj;
  // la mezcla de objetivos y formatos de esta temporada sale de las semanas (fuente.semanal agrupa por objetivo), no del cruce: el cruce
  // toma el objetivo con ANY_VALUE (no lo agrupa) y una pieza con anuncios de Alcance e Interacción en el mismo placement y mes queda con
  // uno cualquiera, distinto en cada extracción (05/10: Super Niño pasó de $478 a $782 sin cambiar la temporada pasada). El valor
  // (el número grande) sigue saliendo de actual: el total no depende del objetivo.
  const sem = pasada.filter((w) => w.s >= lunesDe(inicio) && w.s <= datosHasta), mezcla = sem.length ? sem : actual;
  const niveles = [['f', agrupar(mezcla, porF), agrupar(pas, porF)], ['o', agrupar(mezcla, porO), agrupar(pas, porO)]];
  const tot = agrupar(actual, () => 't').t || { g: 0, i: 0, r: 0, c: 0, sh: 0 };
  const kpis = {};
  for (const k of KPI_TEMP) {
    const def = KPIS[k], v = tot[def.den] ? r4(tot[def.num] / tot[def.den] * def.k) : null;
    let ref = null, nivel = null;
    for (const [nv, cur, rf] of niveles) {
      let d = 0, nr = 0, t = 0;
      for (const [f, a] of Object.entries(cur)) { t += a[def.den]; const b = rf[f]; if (!b || !b[def.den] || !b[def.num] || !a[def.den]) continue; d += a[def.den]; nr += a[def.den] * b[def.num] / b[def.den] * (def.costo ? infl(f.split('|')[0]) : 1); }
      if (d && nr && d >= t * cobertura) { ref = r4(nr / d * def.k); nivel = nv; break; }
    }
    const idx = v > 0 && ref > 0 ? r4(def.costo ? ref / v : v / ref) : null;
    kpis[k] = { valor: v, ref, nivel, idx, dif: v > 0 && ref > 0 ? Math.round((v / ref - 1) * 100) : null, luz: luzDe(idx) };
  }
  const kObj = KPI_OBJETIVO[objetivo] && KPI_TEMP.includes(KPI_OBJETIVO[objetivo]) ? KPI_OBJETIVO[objetivo] : 'cpm';
  const o = kpis[kObj];
  return { ...info, kpis, kpi: kObj, luz: o.luz, idx: o.idx, peor: o.luz === 'rojo' };
}
// semanas de la temporada pasada a partir de fuente.semanal (Meta): canal × cliente × comunicación; objetivo = B.objetivo
const semanasDe = (semanal, { canal, cliente, comunic }, objetivo) => semanal.filter((r) => r.canal === canal && r.cliente === cliente && r.comunic === comunic)
  .map((r) => ({ s: r.semana, obj: objetivo ? objetivo(r.objetivo) : r.objetivo, fmt: FMT_SEM(r.fmt), g: +r.gasto || 0, i: +r.imp || 0, r: +r.rea || 0, c: +r.clk || 0, sh: +r.sha || 0 }));

module.exports = { CANAL_AMBAS, KPI_ORDEN, LETRA, crearMarcas, combinar, proyectar, serieDe, temporada, semanasDe, KPIS, KPI_OBJETIVO, MIN_N, MIN_IMP, DESDE, TOLERANCIA, TOLERANCIA_RITMO, DIA_MINIMO, DIA_RITMO, estadoDe, percentil, decilDe, posicionDe, tablaDeciles };
