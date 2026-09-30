// Lectura temprana al día 5 · EN OBSERVACIÓN (no acciona nada).
// Decisión de Juan Pablo (30/09/2026): "Agreguemos una regla para corroborar esto, todavía no para accionar".
// Dueño: agente de Recomendaciones. Detalle: Seguimiento/documentos/reglas-recomendador-v0.3.md (sección F, Lectura temprana).
//
// Qué hace:
//   1. Cada vez que se arma la app, toma las piezas de Meta (canal × cliente × comunicación × contenido) que cumplieron su día 5
//      (día 1 = primer día con gasto) y registra en qué cuartil quedaron según la métrica principal de su objetivo (v0.3, B2):
//      Alcance → CPM, Interacción → costo por reacción, Tráfico → CTR, Reproducciones → costo por reproducción.
//      Se guarda en app/repositorio/lectura-temprana/predicciones.jsonl (una línea por pieza; no se reescribe).
//   2. Cuando la pieza terminó, compara con su resultado final y calcula el % de acierto con los criterios de la v0.2
//      (analisis-datajunta/13_tanda3_profundo.py): app/repositorio/lectura-temprana/resumen.json.
//   3. Mide lo mismo hacia atrás con los datos que ya tiene la app (sin bajar nada nuevo): también en resumen.json.
// NO genera recomendaciones, NO entra en la bandeja ni en las tarjetas: no la llama recomendaciones.generar().
//
// Criterios tomados de la v0.2 (sin inventar umbrales):
//   - Pieza en el peor cuartil: percentil de "lo mal que rinde" > 75 %; en el mejor: ≤ 25 % (rank promedio, como pandas).
//   - Resultado final: la pieza terminó (3 días o más sin gasto), duró 8 días o más, tuvo 10.000 impresiones o más y menos de
//     120 días (las permanentes no entran). Se compara contra las piezas terminadas del mismo canal × objetivo × formato × mes
//     de inicio, con 8 o más casos.
//   - Al día 5 solo entra la pieza con resultado (reacciones, clicks o impresiones) mayor que cero en esos 5 días.
// Lo único agregado para poder correr en vivo (en la v0.2 todo era retrospectivo): el día 5 de una pieza se compara contra el
// día 5 de las piezas del mismo canal × objetivo × formato que cumplieron su día 5 en los 60 días anteriores (8 o más; si no,
// canal × objetivo). En la v0.2 se comparaba contra las del mismo mes de inicio, que en vivo todavía no existen.
const fs = require('fs');
const path = require('path');

const DIA_LECTURA = 5;
const DIAS_CIERRE = 3;        // v0.2: terminada = sin gasto hace 3 días o más
const MIN_DIAS_FINAL = 8;     // v0.2: campañas de 8+ días
const MIN_IMP_FINAL = 10000;  // v0.2: MIN_IMPRESIONES
const MAX_DIAS = 120;         // v0.2: las permanentes (120+ días) no entran
const MIN_COMPARABLES = 8;    // v0.2: mínimo 8 en el comparable
const VENTANA_REF = 60;       // en vivo: día 5 de las piezas de los 60 días anteriores
const PONERSE_AL_DIA = 7;     // si la app no se armó algún día, registra las piezas que cumplieron el día 5 en la última semana
const MARGEN_INICIO = 7;      // retrospectiva: piezas que arrancaron 7+ días después del primer dato (si no, el día 1 no es el real)

// Métrica principal por objetivo (v0.3, B2). menorEsMejor: los costos; el CTR es al revés.
const METRICA = {
  Alcance: { nombre: 'CPM', menorEsMejor: true, v: (s) => (s.i > 0 ? (s.g / s.i) * 1000 : null) },
  Interacción: { nombre: 'Costo por reacción', menorEsMejor: true, v: (s) => (s.r > 0 ? s.g / s.r : null) },
  Tráfico: { nombre: 'CTR', menorEsMejor: false, v: (s) => (s.i > 0 && s.c > 0 ? s.c / s.i : null) },
  Reproducciones: { nombre: 'Costo por reproducción', menorEsMejor: true, v: (s) => (s.vw > 0 ? s.g / s.vw : null) },
};

const DIA = 864e5;
const diasEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / DIA);
const masDias = (f, n) => new Date(new Date(f).getTime() + n * DIA).toISOString().slice(0, 10);
const idDe = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return 'lt-' + h.toString(36); };
const r4 = (x) => (x == null ? null : Math.round(x * 10000) / 10000);
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);

// ---------- piezas de Meta con su serie diaria ----------
function armarPiezas(B) {
  const { fuente, datosHasta, objetivo, formato, num } = B;
  const P = new Map();
  for (const r of fuente.todas) {
    if (r.plataforma !== 'META' || r.fecha > datosHasta) continue;
    const cod = r.cod || r.contenido || '';
    const k = [r.canal, r.cliente, r.comunic, cod].join('|');
    let p = P.get(k);
    if (!p) P.set(k, (p = { k, canal: r.canal, cliente: r.cliente, comunicacion: r.comunic, cod, contenido: r.contenido || cod, fmtRaw: r.formato_raw, dias: new Map(), objG: {} }));
    const o = objetivo(r.objetivo), g = num(r.gasto);
    p.objG[o] = (p.objG[o] || 0) + g;
    const d = p.dias.get(r.fecha) || { g: 0, i: 0, r: 0, c: 0, vw: 0 };
    d.g += g; d.i += num(r.imp); d.r += num(r.rea); d.c += num(r.clk); d.vw += num(r.vw);
    p.dias.set(r.fecha, d);
  }
  const out = [];
  for (const p of P.values()) {
    const conGasto = [...p.dias.entries()].filter(([, d]) => d.g > 0).map(([f]) => f).sort();
    if (!conGasto.length) continue;
    p.obj = Object.entries(p.objG).sort((a, b) => b[1] - a[1])[0][0];
    p.met = METRICA[p.obj];
    if (!p.met) continue; // Conversión y otros: sin métrica principal en B2
    p.fmt = formato(p.fmtRaw, p.contenido);
    p.desde = conGasto[0]; p.hasta = conGasto[conGasto.length - 1];
    p.duracion = diasEntre(p.desde, p.hasta) + 1;
    p.mesInicio = p.desde.slice(0, 7);
    p.dia5 = masDias(p.desde, DIA_LECTURA - 1);
    const suma = (hasta) => { const s = { g: 0, i: 0, r: 0, c: 0, vw: 0 }; for (const [f, d] of p.dias) if (!hasta || f <= hasta) for (const x in s) s[x] += d[x]; return s; };
    p.s5 = p.dia5 <= datosHasta ? suma(p.dia5) : null;
    p.v5 = p.s5 ? p.met.v(p.s5) : null;
    p.sF = suma(null);
    p.vF = p.met.v(p.sF);
    // "lo mal que rinde": sube cuando la pieza rinde peor (así el peor cuartil siempre es el percentil alto, como en la v0.2)
    p.malo5 = p.v5 == null ? null : p.met.menorEsMejor ? p.v5 : -p.v5;
    p.maloF = p.vF == null ? null : p.met.menorEsMejor ? p.vF : -p.vF;
    p.terminada = diasEntre(p.hasta, datosHasta) >= DIAS_CIERRE;
    p.juzgable = p.terminada && p.duracion >= MIN_DIAS_FINAL && p.duracion < MAX_DIAS && p.sF.i >= MIN_IMP_FINAL && p.maloF != null;
    delete p.dias; delete p.objG; delete p.fmtRaw;
    out.push(p);
  }
  return out;
}

// percentil con rank promedio (igual que pandas rank(pct=True)): x dentro de xs (xs incluye a x)
function percentilDe(x, xs) {
  let menos = 0, iguales = 0;
  for (const y of xs) { if (y < x) menos++; else if (y === x) iguales++; }
  return (menos + (iguales + 1) / 2) / xs.length;
}
const cuartilDe = (q) => (q == null ? null : q > 0.75 ? 'peor' : q <= 0.25 ? 'mejor' : 'medio');

// Día 5 en vivo: contra el día 5 de las piezas comparables de los 60 días anteriores.
function lecturaDia5(p, piezas) {
  const enVentana = (y) => y.malo5 != null && y.canal === p.canal && y.obj === p.obj && y.dia5 <= p.dia5 && diasEntre(y.dia5, p.dia5) <= VENTANA_REF;
  let ref = piezas.filter((y) => enVentana(y) && y.fmt === p.fmt), nivel = 'canal × objetivo × formato';
  if (ref.length < MIN_COMPARABLES) { ref = piezas.filter(enVentana); nivel = 'canal × objetivo'; }
  if (ref.length < MIN_COMPARABLES) return { q: null, n: ref.length, nivel: 'sin referencia' };
  return { q: percentilDe(p.malo5, ref.map((y) => y.malo5)), n: ref.length, nivel };
}

// Final: contra las piezas terminadas del mismo canal × objetivo × formato × mes de inicio (v0.2), mínimo 8.
function gruposFinales(piezas) {
  const G = new Map();
  for (const p of piezas) if (p.juzgable) { const k = [p.canal, p.obj, p.fmt, p.mesInicio].join('|'); (G.get(k) || G.set(k, []).get(k)).push(p); }
  for (const [k, xs] of G) if (xs.length < MIN_COMPARABLES) G.delete(k);
  return G;
}
function finalDe(p, G) {
  if (!p.terminada) return { estado: 'sigue al aire' };
  if (!p.juzgable) return { estado: 'no se juzga', motivo: p.duracion < MIN_DIAS_FINAL ? 'duró menos de 8 días' : p.duracion >= MAX_DIAS ? 'permanente (120 días o más)' : p.sF.i < MIN_IMP_FINAL ? 'menos de 10.000 impresiones' : 'sin resultado' };
  const xs = G.get([p.canal, p.obj, p.fmt, p.mesInicio].join('|'));
  if (!xs) return { estado: 'no se juzga', motivo: 'menos de 8 piezas comparables terminadas' };
  return { estado: 'juzgada', q: percentilDe(p.maloF, xs.map((y) => y.maloF)), n: xs.length };
}

// Spearman sobre pares (a, b)
function spearman(pares) {
  if (pares.length < 3) return null;
  const rango = (vs) => { const o = vs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); const r = new Array(vs.length); let i = 0;
    while (i < o.length) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; for (let t = i; t <= j; t++) r[o[t][1]] = (i + j) / 2 + 1; i = j + 1; } return r; };
  const a = rango(pares.map((x) => x[0])), b = rango(pares.map((x) => x[1])), n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? Math.round((num / Math.sqrt(da * db)) * 1000) / 1000 : null;
}
// Acierto con los mismos indicadores de la v0.2
function acierto(pares) {
  const peor = pares.filter((x) => x.q5 > 0.75), mejor = pares.filter((x) => x.q5 <= 0.25);
  return {
    piezas: pares.length,
    spearman: spearman(pares.map((x) => [x.q5, x.qF])),
    peor_cuartil_al_dia5: peor.length,
    peor_termina_en_peor_cuartil_pct: pct(peor.filter((x) => x.qF > 0.75).length, peor.length),
    peor_termina_arriba_de_la_mediana_pct: pct(peor.filter((x) => x.qF <= 0.5).length, peor.length),
    mejor_cuartil_al_dia5: mejor.length,
    mejor_termina_en_mejor_cuartil_pct: pct(mejor.filter((x) => x.qF <= 0.25).length, mejor.length),
  };
}
const porObjetivo = (pares) => Object.fromEntries([...new Set(pares.map((x) => x.obj))].sort().map((o) => [o, acierto(pares.filter((x) => x.obj === o))]));

// Retrospectiva con los datos de la app (180 días de DataJunta ya bajados).
function retrospectiva(piezas, G, primerDato) {
  const validas = piezas.filter((p) => diasEntre(primerDato, p.desde) >= MARGEN_INICIO);
  // a) igual que la v0.2: día 5 y final rankeados dentro del mismo grupo de terminadas (canal × objetivo × formato × mes)
  const igual = [];
  for (const xs of G.values()) {
    const cc = xs.filter((p) => p.malo5 != null && diasEntre(primerDato, p.desde) >= MARGEN_INICIO);
    for (const p of cc) igual.push({ obj: p.obj, q5: percentilDe(p.malo5, cc.map((y) => y.malo5)), qF: percentilDe(p.maloF, cc.map((y) => y.maloF)) });
  }
  // b) como corre en vivo: día 5 contra la ventana de 60 días; final como en a)
  const vivo = [];
  for (const p of validas) {
    if (p.malo5 == null) continue;
    const l = lecturaDia5(p, piezas), f = finalDe(p, G);
    if (l.q == null || f.estado !== 'juzgada') continue;
    vivo.push({ obj: p.obj, q5: l.q, qF: f.q });
  }
  return {
    como_la_v02: { total: acierto(igual), por_objetivo: porObjetivo(igual) },
    como_corre_en_vivo: { total: acierto(vivo), por_objetivo: porObjetivo(vivo) },
  };
}

// Punto de entrada: B = exports de borrador/armar.js; dir = app/repositorio/lectura-temprana
function observar(B, dir) {
  const { datosHasta, fuente } = B;
  fs.mkdirSync(dir, { recursive: true });
  const piezas = armarPiezas(B);
  const G = gruposFinales(piezas);
  const primerDato = fuente.todas.reduce((m, r) => (r.plataforma === 'META' && r.fecha < m ? r.fecha : m), '9999');

  // 1. predicciones nuevas: piezas que cumplieron el día 5 en la última semana y todavía no están registradas
  const ARCH = path.join(dir, 'predicciones.jsonl');
  const previas = fs.existsSync(ARCH) ? fs.readFileSync(ARCH, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean) : [];
  const ya = new Set(previas.map((x) => x.id));
  const nuevas = [];
  for (const p of piezas) {
    if (p.malo5 == null || p.dia5 > datosHasta || diasEntre(p.dia5, datosHasta) >= PONERSE_AL_DIA) continue;
    const id = idDe([p.canal, p.cliente, p.comunicacion, p.cod, p.desde].join('|'));
    if (ya.has(id)) continue;
    const l = lecturaDia5(p, piezas);
    nuevas.push({ id, registrado: new Date().toISOString(), datos_al: datosHasta, dia5: p.dia5, canal: p.canal, cliente: p.cliente, campana: p.comunicacion,
      cod: p.cod, contenido: p.contenido, objetivo: p.obj, formato: p.fmt, desde: p.desde, metrica: p.met.nombre, valor_dia5: r4(p.v5),
      gasto_dia5: Math.round(p.s5.g), impresiones_dia5: p.s5.i, percentil_dia5: r4(l.q), cuartil_dia5: cuartilDe(l.q), comparables: l.n, referencia: l.nivel });
  }
  if (nuevas.length) fs.appendFileSync(ARCH, nuevas.map((x) => JSON.stringify(x)).join('\n') + '\n');

  // 2. verificación de las predicciones registradas (se recalcula entera cada vez)
  const porId = new Map(piezas.map((p) => [idDe([p.canal, p.cliente, p.comunicacion, p.cod, p.desde].join('|')), p]));
  const todas = [...previas, ...nuevas];
  const estado = { 'sigue al aire': 0, 'no se juzga': 0, juzgada: 0, 'fuera de los datos': 0 };
  const pares = [], detalle = [];
  for (const x of todas) {
    const p = porId.get(x.id);
    const f = p ? finalDe(p, G) : { estado: 'fuera de los datos' };
    estado[f.estado]++;
    if (f.estado === 'juzgada' && x.percentil_dia5 != null) {
      pares.push({ obj: x.objetivo, q5: x.percentil_dia5, qF: f.q });
      if (x.cuartil_dia5 !== 'medio') detalle.push({ id: x.id, cliente: x.cliente, canal: x.canal, campana: x.campana, contenido: x.contenido, objetivo: x.objetivo,
        cuartil_dia5: x.cuartil_dia5, percentil_final: r4(f.q), cuartil_final: cuartilDe(f.q), acerto: x.cuartil_dia5 === cuartilDe(f.q) });
    }
  }
  const resumen = {
    regla: 'Lectura temprana al día 5 · en observación (no genera recomendaciones)',
    datos_al: datosHasta, generado: new Date().toISOString(),
    criterios: { dia_lectura: DIA_LECTURA, peor_cuartil: 'percentil > 75 %', mejor_cuartil: 'percentil ≤ 25 %', terminada: `${DIAS_CIERRE} días o más sin gasto`,
      se_juzga_si: `duró ${MIN_DIAS_FINAL} días o más, menos de ${MAX_DIAS}, y tuvo ${MIN_IMP_FINAL} impresiones o más`,
      comparable_final: `canal × objetivo × formato × mes de inicio, ${MIN_COMPARABLES} o más terminadas`,
      comparable_dia5: `canal × objetivo × formato, día 5 en los ${VENTANA_REF} días anteriores, ${MIN_COMPARABLES} o más (si no, canal × objetivo)`,
      metrica: Object.fromEntries(Object.entries(METRICA).map(([o, m]) => [o, m.nombre])),
      evidencia_v02: 'Campañas de 8+ días, 2.791 casos: el 82 % de las que están en el peor cuartil al día 5 terminan en el peor; el 3 % termina arriba de la mediana; el 79 % de las del mejor cuartil terminan en el mejor.' },
    en_vivo: { predicciones: todas.length, nuevas_hoy: nuevas.length, estado, acierto: acierto(pares), por_objetivo: porObjetivo(pares), casos: detalle },
    retrospectiva: retrospectiva(piezas, G, primerDato),
  };
  fs.writeFileSync(path.join(dir, 'resumen.json'), JSON.stringify(resumen, null, 1));
  const a = resumen.en_vivo.acierto, rv = resumen.retrospectiva.como_corre_en_vivo.total;
  console.log(`lectura temprana (observación): ${nuevas.length} predicciones nuevas, ${todas.length} registradas, ${a.piezas} ya juzgadas · hacia atrás: peor→peor ${rv.peor_termina_en_peor_cuartil_pct} % de ${rv.peor_cuartil_al_dia5}`);
  return resumen;
}

module.exports = { observar, armarPiezas, lecturaDia5, gruposFinales, finalDe, retrospectiva, METRICA };
