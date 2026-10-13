// Prueba de app/marcas.js (marcas por cuartiles, proyección y temporada). Uso: node pruebas/marcas.js (desde app/).
// Primero casos armados a mano (sin datos); después los datos reales del borrador, con ejemplos de Chaco.
const assert = require('assert');
const M = require('../marcas.js');
let ok = 0;
const caso = (nombre, fn) => { fn(); ok++; };

// ---------- casos a mano ----------
caso('cuartiles: costo y tasa, y caída a objetivo', () => {
  const filas = [];
  for (let k = 0; k < 20; k++) filas.push({ cli: 'P', canal: 'Oficial', mes: '2026-05', obj: 'Alcance', fmt: 'Video', pl: 'Facebook Feed', cod: 'A' + k, g: 1000 * (k + 1), i: 10000, r: 10 * (k + 1), c: 50, e: 0, sh: 0, vw: 0 });
  for (let k = 0; k < 5; k++) filas.push({ cli: 'P', canal: 'Oficial', mes: '2026-05', obj: 'Alcance', fmt: 'Video', pl: 'Threads Feed', cod: 'T' + k, g: 5000, i: 10000, r: 0, c: 0, e: 0, sh: 0, vw: 0 });
  const m = M.crearMarcas(filas);
  const a = m.marcar({ valor: 50, kpi: 'cpm', proyecto: 'P', canal: 'Oficial', objetivo: 'Alcance', placement: 'Facebook Feed' });
  assert.strictEqual(a.base, 'objetivo×placement'); assert.strictEqual(a.estado, 'bueno');
  assert.strictEqual(m.marcar({ valor: 1900, kpi: 'cpm', proyecto: 'P', canal: 'Oficial', objetivo: 'Alcance', placement: 'Facebook Feed' }).estado, 'malo');
  assert.strictEqual(m.marcar({ valor: 1000, kpi: 'cpm', proyecto: 'P', canal: 'Oficial', objetivo: 'Alcance', placement: 'Facebook Feed' }).estado, 'normal');
  // Threads tiene 5 piezas: cae a objetivo solo (25 piezas)
  const t = m.marcar({ valor: 500, kpi: 'cpm', proyecto: 'P', canal: 'Oficial', objetivo: 'Alcance', placement: 'Threads Feed' });
  assert.strictEqual(t.base, 'objetivo'); assert.strictEqual(t.n, 25);
  // tasa: más alto es mejor
  assert.strictEqual(m.marcar({ valor: 1.9, kpi: 'treac', proyecto: 'P', canal: 'Oficial', objetivo: 'Alcance', placement: 'Facebook Feed' }).estado, 'bueno');
  assert.strictEqual(m.marcar({ valor: 0.01, kpi: 'treac', proyecto: 'P', canal: 'Oficial', objetivo: 'Alcance', placement: 'Facebook Feed' }).estado, 'malo');
  // otro proyecto u objetivo: sin referencia
  assert.strictEqual(m.marcar({ valor: 500, kpi: 'cpm', proyecto: 'Q', canal: 'Oficial', objetivo: 'Alcance', placement: 'Facebook Feed' }).estado, 'sin_ref');
  // Ambas junta los dos canales
  assert.strictEqual(m.marcar({ valor: 500, kpi: 'cpm', proyecto: 'P', canal: 'Ambas', objetivo: 'Alcance', placement: 'Facebook Feed' }).base, 'objetivo×placement');
  // un grupo de filas con su mezcla
  const g = m.marcarFilas(filas.slice(0, 3), 'cpm', { proyecto: 'P', canal: 'Oficial' });
  assert.strictEqual(g.estado, 'bueno'); assert.strictEqual(g.base, 'objetivo×placement');
  assert.strictEqual(m.marcaCampana(filas.slice(0, 3), 'Alcance', { proyecto: 'P', canal: 'Oficial' }).kpi, 'cpm');
});
caso('KPI elegido: letras por KPI, tablas para el navegador y registro extensible (05/10)', () => {
  const filas = [];
  for (let k = 0; k < 20; k++) filas.push({ cli: 'P', canal: 'Oficial', mes: '2026-05', obj: 'Alcance', fmt: 'Video', pl: 'Facebook Feed', cod: 'A' + k, g: 1000 * (k + 1), i: 10000, r: 10 * (k + 1), c: 50 + k, e: 100 * (k + 1), sh: k, vw: 500 });
  const m = M.crearMarcas(filas), ctx = { proyecto: 'P', canal: 'Oficial' };
  // la pieza más barata: CPM bueno; con el mismo gasto saca menos reacciones por peso → la tasa de reacción no es la mejor
  const L = m.letras([filas[0]], ctx);
  assert.strictEqual(L.length, M.KPI_ORDEN.length); assert.strictEqual(L[M.KPI_ORDEN.indexOf('cpm')], 'B'); assert.strictEqual(L[M.KPI_ORDEN.indexOf('etrI')], 'S');
  assert.strictEqual(L[M.KPI_ORDEN.indexOf('cpm')], { bueno: 'B', normal: 'N', malo: 'M', sin_ref: 'S' }[m.marcarFilas([filas[0]], 'cpm', ctx).estado]);
  assert.strictEqual(m.letras([], ctx), 'S'.repeat(M.KPI_ORDEN.length));
  // CPM de Alcance: está en el registro pero sin cuartiles → siempre sin referencia
  assert.ok(M.KPIS.ca && !M.KPI_ORDEN.includes('ca')); assert.strictEqual(m.marcarFilas(filas, 'ca', ctx).estado, 'sin_ref');
  // tablas: la marca del navegador con estadoDe sobre la celda da lo mismo que marcar()
  const T = m.tablas(), i = T.orden.indexOf('cpm'), celda = T.pl['Oficial|P|Alcance|Facebook Feed'][i];
  for (const v of [500, 1000, 1900]) assert.strictEqual(M.estadoDe(v, celda[0], celda[2], T.costo[i]), m.marcar({ valor: v, kpi: 'cpm', ...ctx, objetivo: 'Alcance', placement: 'Facebook Feed' }).estado);
  assert.strictEqual(T.pl['Oficial|P|Alcance|Facebook Feed'][T.orden.indexOf('etrI')], 0);
  // registro: todo KPI con numerador y denominador entra solo en el orden de las letras y de las tablas
  assert.deepStrictEqual(M.KPI_ORDEN, Object.keys(M.KPIS).filter((k) => M.KPIS[k].num && M.KPIS[k].den));
  for (const k of M.KPI_ORDEN) assert.ok(M.KPIS[k].nombre && M.KPIS[k].k > 0, `KPI ${k} incompleto`);
});
caso('deciles (pedido 053): 1 el mejor, 10 el peor, y nunca contra la marca', () => {
  const xs = Array.from({ length: 101 }, (_, k) => k);   // 0..100
  assert.strictEqual(M.decilDe(xs, 0, true), 1); assert.strictEqual(M.decilDe(xs, 5, true), 1); assert.strictEqual(M.decilDe(xs, 15, true), 2);
  assert.strictEqual(M.decilDe(xs, 100, true), 10); assert.strictEqual(M.decilDe(xs, 100, false), 1); assert.strictEqual(M.decilDe(xs, 0, false), 10);
  assert.strictEqual(M.decilDe(xs, -5, true), 1); assert.strictEqual(M.decilDe(xs, 500, true), 10);
  // misma celda que la marca; Bueno ⇔ decil 1 a 3, Malo ⇔ decil 8 a 10, Normal ⇔ 3 a 8
  const filas = [];
  for (let k = 0; k < 40; k++) filas.push({ cli: 'P', canal: 'Oficial', mes: '2026-05', obj: 'Interacción', fmt: 'Video', pl: 'Facebook Feed', cod: 'A' + k, g: 1000 + 37 * k * k, i: 10000, r: 10 + k, c: 50, e: 0, sh: 0, vw: 0 });
  filas.push({ cli: 'P', canal: 'Oficial', mes: '2026-05', obj: 'Interacción', fmt: 'Video', pl: 'Instagram Stories', cod: 'S1', g: 1000, i: 10000, r: 0, c: 5, e: 0, sh: 0, vw: 0 });
  const m = M.crearMarcas(filas), ctx = { proyecto: 'P', canal: 'Oficial' };
  for (const f of filas.slice(0, 40)) {
    const d = m.decilFilas([f], 'cr', ctx);
    assert.strictEqual(d.base, 'objetivo×placement'); assert.strictEqual(d.n, 40);
    assert.ok(d.estado === 'bueno' ? d.decil <= 3 : d.estado === 'malo' ? d.decil >= 8 : d.decil >= 3 && d.decil <= 8, `${f.cod}: ${d.estado} con decil ${d.decil}`);
  }
  assert.strictEqual(m.decilFilas([filas[0]], 'cr', ctx).decil, 1);
  // costo por reacción en Stories: sin referencia, sin decil
  assert.strictEqual(m.decilFilas([filas[40]], 'cr', ctx).decil, null);
  // filas de dos celdas: sin decil
  assert.strictEqual(m.decilFilas([filas[0], { ...filas[1], pl: 'Instagram Feed' }], 'cr', ctx).decil, null);
});
caso('deciles fuera de Meta (07/10): celda del proyecto, caída a la plataforma, mínimos', () => {
  const u = [];
  // proyecto P: 15 piezas de YouTube con vistas; proyecto Q: 5 (no alcanza) → cae a toda la plataforma (20)
  for (let k = 0; k < 15; k++) u.push({ claves: ['Oficial|P|Google Ads|YouTube|Views|cv', 'Oficial|Google Ads|YouTube|Views|cv'], valor: 1 + k, i: 5000 });
  for (let k = 0; k < 5; k++) u.push({ claves: ['Oficial|Q|Google Ads|YouTube|Views|cv', 'Oficial|Google Ads|YouTube|Views|cv'], valor: 100 + k, i: 5000 });
  u.push({ claves: ['Oficial|P|Google Ads|YouTube|Views|cv', 'Oficial|Google Ads|YouTube|Views|cv'], valor: 0.01, i: 500 });   // menos de 1.000 impresiones: no entra
  const T = M.tablaDeciles(u);
  const p = T.decil(['Oficial|P|Google Ads|YouTube|Views|cv', 'Oficial|Google Ads|YouTube|Views|cv'], 1, true);
  assert.deepStrictEqual(p, { decil: 1, nivel: 0, n: 15 });
  const q = T.decil(['Oficial|Q|Google Ads|YouTube|Views|cv', 'Oficial|Google Ads|YouTube|Views|cv'], 104, true);
  assert.strictEqual(q.nivel, 1); assert.strictEqual(q.n, 20); assert.strictEqual(q.decil, 10);
  // otra plataforma u otro canal: nunca se mezcla
  assert.strictEqual(T.decil(['Oficial|P|TikTok Ads|Tik Tok|Views|cv', 'Oficial|TikTok Ads|Tik Tok|Views|cv'], 1, true).decil, null);
  assert.strictEqual(T.decil(['Informativo|P|Google Ads|YouTube|Views|cv', 'Informativo|Google Ads|YouTube|Views|cv'], 1, true).decil, null);
  assert.strictEqual(T.decil(['Oficial|P|Google Ads|YouTube|Views|cv'], null, true).decil, null);
});
caso('combinar por gasto', () => {
  assert.strictEqual(M.combinar([{ estado: 'malo', gasto: 70 }, { estado: 'bueno', gasto: 30 }]).estado, 'malo');
  // la que más gasto junta, aunque no sea mayoría absoluta: 40 bueno contra 35 normal y 25 malo
  const x = M.combinar([{ estado: 'bueno', gasto: 40 }, { estado: 'normal', gasto: 20 }, { estado: 'normal', gasto: 15 }, { estado: 'malo', gasto: 25 }]);
  assert.strictEqual(x.estado, 'bueno'); assert.deepStrictEqual(x.reparto, { bueno: 40, normal: 35, malo: 25, sin_ref: 0 });
  // empates: gana Normal; sin Normal, Malo
  assert.strictEqual(M.combinar([{ estado: 'normal', gasto: 50 }, { estado: 'bueno', gasto: 50 }]).estado, 'normal');
  assert.strictEqual(M.combinar([{ estado: 'malo', gasto: 50 }, { estado: 'bueno', gasto: 50 }]).estado, 'malo');
  assert.strictEqual(M.combinar([{ estado: 'sin_ref', gasto: 60 }, { estado: 'bueno', gasto: 40 }]).estado, 'sin_ref');
  assert.strictEqual(M.combinar([]).estado, 'sin_ref');
});
caso('proyección', () => {
  const serie = []; for (let d = 1; d <= 20; d++) serie.push({ f: `2026-09-${String(d).padStart(2, '0')}`, g: 100, i: 1000, alcance: 999 });
  const p = M.proyectar({ serie, presupuesto: 3000, datosHasta: '2026-09-20' });
  assert.strictEqual(p.cierre.gasto, 3000); assert.strictEqual(p.estado, 'llega'); assert.strictEqual(p.ritmo, 'normal'); assert.strictEqual(p.cierre.impresiones, 30000);
  assert.strictEqual(M.proyectar({ serie, presupuesto: 2000, datosHasta: '2026-09-20' }).estado, 'se_pasa');
  assert.strictEqual(M.proyectar({ serie, presupuesto: 5000, datosHasta: '2026-09-20' }).estado, 'no_llega');
  assert.strictEqual(M.proyectar({ serie, presupuesto: 5000, datosHasta: '2026-09-20' }).ritmo, 'lento');
  assert.strictEqual(M.proyectar({ serie, datosHasta: '2026-09-20' }).estado, 'sin_presupuesto');
  // campaña que termina el 25 (Fin exclusivo): gasta hasta el 24
  assert.strictEqual(M.proyectar({ serie, datosHasta: '2026-09-20', fin: '2026-09-25' }).cierre.gasto, 2400);
  // la proyección arranca el día 5 (05/10): el 4 todavía no, el 5 sí; el ritmo, desde el 3
  const a = M.proyectar({ serie, presupuesto: 3000, datosHasta: '2026-09-04' });
  assert.strictEqual(a.estado, 'antes_dia_10'); assert.ok(!a.cierre); assert.ok(a.ritmo, 'el día 4 ya hay ritmo (arranca el día 3)'); assert.strictEqual(a.desde, '2026-09-05');
  const a5 = M.proyectar({ serie, presupuesto: 3000, datosHasta: '2026-09-05' });
  assert.ok(a5.estado !== 'antes_dia_10' && a5.cierre, 'el día 5 ya se proyecta'); assert.strictEqual(a5.lleva.gasto, 500);
  // antes del día 3 no hay ritmo: ritmoDesde = el día 3 (decisión del 03/10)
  const a2 = M.proyectar({ serie, presupuesto: 3000, datosHasta: '2026-09-02' });
  assert.strictEqual(a2.estado, 'antes_dia_10'); assert.strictEqual(a2.ritmo, null); assert.strictEqual(a2.ritmoDesde, '2026-09-03');
  const a3 = M.proyectar({ serie, presupuesto: 3000, datosHasta: '2026-09-03' });
  assert.ok(a3.ritmo && !a3.ritmoDesde, 'el día 3 ya hay ritmo');
  // nunca alcance
  assert.ok(!/alcance|personas/i.test(JSON.stringify(p)));
});
caso('temporada', () => {
  const actual = [{ obj: 'Alcance', fmt: 'Video', g: 1100, i: 1000, r: 0, c: 0, sh: 0 }];
  const pasada = [{ s: '2025-06-02', obj: 'Alcance', fmt: 'Video', g: 1000, i: 1000, r: 0, c: 0, sh: 0 }];
  const t = M.temporada({ actual, pasada, inicio: '2026-06-01', previa: { desde: '2025-06-02', hasta: '2025-06-02' }, datosHasta: '2026-06-20', objetivo: 'Alcance' });
  assert.strictEqual(t.kpis.cpm.ref, 1000); assert.strictEqual(t.kpis.cpm.dif, 10); assert.strictEqual(t.luz, 'amarillo'); assert.strictEqual(t.peor, false);
  const t2 = M.temporada({ actual: [{ ...actual[0], g: 1200 }], pasada, inicio: '2026-06-01', previa: { desde: '2025-06-02', hasta: '2025-06-02' }, datosHasta: '2026-06-20', objetivo: 'Alcance' });
  assert.strictEqual(t2.peor, true);   // 20 % más caro ya es rojo, como la luz Propia
  // Interacción: la plata de la pasada se lleva a hoy (2 % por mes, 12 meses)
  const t3 = M.temporada({ actual: [{ obj: 'Interacción', fmt: 'Video', g: 1000, i: 1000, r: 10, c: 0, sh: 0 }], pasada: [{ s: '2025-06-02', obj: 'Interacción', fmt: 'Video', g: 1000, i: 1000, r: 10, c: 0, sh: 0 }],
    inicio: '2026-06-01', previa: { desde: '2025-06-02', hasta: '2025-06-02' }, datosHasta: '2026-06-20', objetivo: 'Interacción' });
  // la mezcla de esta temporada sale de las semanas, no del objetivo del cruce (ANY_VALUE): cambiar el objetivo de las filas de actual
  // no mueve la referencia (05/10, Super Niño)
  const pasT = [{ s: '2025-06-02', obj: 'Alcance', fmt: 'Video', g: 1000, i: 1000, r: 0, c: 0, sh: 0 }, { s: '2025-06-02', obj: 'Interacción', fmt: 'Video', g: 3000, i: 1000, r: 10, c: 0, sh: 0 },
    { s: '2026-06-01', obj: 'Alcance', fmt: 'Video', g: 1000, i: 1000, r: 0, c: 0, sh: 0 }, { s: '2026-06-01', obj: 'Interacción', fmt: 'Video', g: 3000, i: 1000, r: 10, c: 0, sh: 0 }];
  const base = { pasada: pasT, inicio: '2026-06-01', previa: { desde: '2025-06-02', hasta: '2025-06-02' }, datosHasta: '2026-06-20', objetivo: 'Alcance' };
  const ra = M.temporada({ ...base, actual: [{ obj: 'Alcance', fmt: 'Video', g: 4000, i: 2000, r: 10, c: 0, sh: 0 }] });
  const rb = M.temporada({ ...base, actual: [{ obj: 'Interacción', fmt: 'Video', g: 4000, i: 2000, r: 10, c: 0, sh: 0 }] });
  assert.strictEqual(ra.kpis.cpm.ref, rb.kpis.cpm.ref); assert.strictEqual(ra.kpis.cpm.valor, 2000);
  assert.strictEqual(t3.kpi, 'cr'); assert.ok(t3.kpis.cr.ref > 125 && t3.kpis.cr.ref < 128); assert.strictEqual(t3.luz, 'verde');
});


// ---------- datos reales (borrador, _proyectos.json) ----------
process.chdir(require('path').join(__dirname, '..', '..', 'borrador'));
const log = console.log; console.log = () => {};
const B = require('../../borrador/armar.js');
console.log = log;
const t0 = Date.now(), marcas = M.crearMarcas(B.filas);
const nP = Object.values(marcas.cortes.celdas).reduce((s, x) => s + Object.keys(x).length, 0), nO = Object.values(marcas.cortes.objetivo).reduce((s, x) => s + Object.keys(x).length, 0);
log(`cuartiles: ${nP} celdas objetivo × placement y ${nO} por objetivo, con 12+ piezas (${Date.now() - t0} ms; cruce desde ${B.filas.reduce((m, r) => (r.mes < m ? r.mes : m), '9')})`);
const fmt = (x) => (x == null ? '—' : x >= 10 ? '$' + Math.round(x).toLocaleString('es-AR') : x.toFixed(2) + ' %');
const pesos = (x) => '$' + Math.round(x || 0).toLocaleString('es-AR');
const CLI = 'Gobierno del Chaco', P = B.DATA.proyectos.find((p) => p.cliente === CLI), MES = '2026-09';
const ESTADOS = ['bueno', 'normal', 'malo', 'sin_ref'];
// todas las campañas de todos los proyectos, en el mes de la app: la marca es una de las cuatro, con cortes ordenados, y casi todas con referencia
let vistas = 0, sinRef = 0;
for (const p of B.DATA.proyectos) for (const [canal, b] of Object.entries(p.canales)) for (const c of b.campanas) {
  const rs = B.filas.filter((r) => r.cli === p.cliente && r.canal === canal && r.com === c.id && r.mes === B.MES); if (!rs.length) continue;
  const m = marcas.marcaCampana(rs, c.obj, { proyecto: p.cliente, canal }); vistas++; if (m.estado === 'sin_ref') sinRef++;
  assert.ok(ESTADOS.includes(m.estado), `${c.id}: ${m.estado}`);
  if (m.estado !== 'sin_ref') { assert.ok(m.p25 <= m.p50 && m.p50 <= m.p75, `${c.id}: cortes desordenados`); assert.ok(['objetivo×placement', 'objetivo'].includes(m.base)); }
}
assert.ok(sinRef <= vistas * 0.05, `demasiadas campañas sin referencia: ${sinRef} de ${vistas}`);
log(`campañas con gasto en ${B.MES}: ${vistas} marcadas, ${sinRef} sin referencia`);
// Ambas: la misma campaña con los dos canales juntos
{ const rs = B.filas.filter((r) => r.cli === CLI && r.com === 'Super Niño' && r.mes === MES), m = marcas.marcaCampana(rs, 'Alcance', { proyecto: CLI, canal: 'Ambas' });
  assert.ok(m.estado !== 'sin_ref'); log(`Ambas · Super Niño (${MES}): CPM ${fmt(m.valor)} · P25 ${fmt(m.p25)} P75 ${fmt(m.p75)} → ${m.estado}`); }
for (const canal of ['Informativo', 'Oficial']) {
  const b = P.canales[canal], fil = (f) => B.filas.filter((r) => r.cli === CLI && r.canal === canal && r.mes === MES && f(r));
  const mc = b.campanas.map((c) => { const rs = fil((r) => r.com === c.id); return { c, rs, g: rs.reduce((s, r) => s + r.g, 0), m: marcas.marcaCampana(rs, c.obj, { proyecto: CLI, canal }) }; }).filter((x) => x.g > 0);
  for (const id of ['Chaco Invierte', 'Super Niño']) {
    const x = mc.find((y) => y.c.id === id); if (!x) continue;
    const pm = marcas.marcasPorMetrica(x.rs, { proyecto: CLI, canal });
    log(`${canal} · ${id} (${x.c.obj}, ${MES}): ${x.m.kpi} ${fmt(x.m.valor)} · P25 ${fmt(x.m.p25)} P50 ${fmt(x.m.p50)} P75 ${fmt(x.m.p75)} → ${x.m.estado} (${x.m.base})`);
    log(`   por métrica: ${Object.entries(pm).map(([k, v]) => `${k} ${v.estado}`).join(' · ')}`);
  }
  const ejes = {}; for (const x of mc) (ejes[x.c.eje] = ejes[x.c.eje] || []).push({ estado: x.m.estado, gasto: x.g });
  const e = M.combinar(ejes['Desarrollo económico'] || []);
  log(`${canal} · eje Desarrollo económico (${MES}): ${e.estado} · gasto ${e.reparto.bueno} % bueno, ${e.reparto.normal} % normal, ${e.reparto.malo} % malo, ${e.reparto.sin_ref} % sin referencia (${e.campanas} campañas)`);
  const pr = M.combinar(mc.map((x) => ({ estado: x.m.estado, gasto: x.g })));
  log(`${canal} · proyecto (${MES}): ${pr.estado} · gasto ${pr.reparto.bueno} % bueno, ${pr.reparto.normal} % normal, ${pr.reparto.malo} % malo, ${pr.reparto.sin_ref} % sin referencia`);
  if (canal === 'Informativo') {
    const todas = B.fuente.todas.filter((r) => r.cliente === CLI && r.canal === canal);
    const act = 'Contexto Noreste', a = b.activos.find((x) => x.nombre === act);
    const it = b.campanas.map((c) => { const rs = fil((r) => r.com === c.id && r.voz === act); return { estado: marcas.marcaCampana(rs, c.obj, { proyecto: CLI, canal }).estado, gasto: rs.reduce((s, r) => s + r.g, 0) }; }).filter((x) => x.gasto > 0);
    const ma = M.combinar(it);
    log(`${canal} · activo ${act} (${MES}): ${ma.estado} · gasto ${ma.reparto.bueno} % bueno, ${ma.reparto.normal} % normal, ${ma.reparto.malo} % malo (${ma.campanas} campañas)`);
    const hoy = M.proyectar({ serie: M.serieDe(todas, (r) => r.activo === act), presupuesto: a.pedido, datosHasta: B.datosHasta });
    if (Number(B.datosHasta.slice(8)) < 5) assert.strictEqual(hoy.estado, 'antes_dia_10');
    log(`   proyección hoy (${B.datosHasta}): ${hoy.estado}, lleva ${pesos(hoy.lleva.gasto)} de ${pesos(a.pedido)}${hoy.cierre ? `, cierre ${pesos(hoy.cierre.gasto)}` : ''}`);
    const s20 = M.proyectar({ serie: M.serieDe(todas, (r) => r.activo === act), presupuesto: 6000000, datosHasta: '2026-09-20' });
    log(`   proyección al 20/09 con $6 M: ${s20.estado}, cierre ${pesos(s20.cierre.gasto)} y ${s20.cierre.impresiones.toLocaleString('es-AR')} impresiones, ritmo ${s20.ritmo} (${pesos(s20.ritmoDiario)} por día, hacían falta ${pesos(s20.ritmoNecesario)})`);
    assert.ok(!/alcance|personas/i.test(JSON.stringify([hoy, s20])));
    const pp = M.proyectar({ serie: M.serieDe(todas, () => true), presupuesto: b.tarjeta.pedido, datosHasta: B.datosHasta });
    log(`   proyecto Chaco Informativo hoy: ${pp.estado}, lleva ${pesos(pp.lleva.gasto)} de ${pesos(pp.presupuesto)}`);
    const ej = M.proyectar({ serie: M.serieDe(todas, (r) => r.eje === 'Desarrollo económico'), datosHasta: '2026-09-20' });
    log(`   eje Desarrollo económico al 20/09: ${ej.estado}, cierre ${pesos(ej.cierre.gasto)}, ritmo ${ej.ritmo}`);
  }
}
// temporada: Super Niño (Oficial) tiene que dar lo mismo que la tarjeta "Esta temporada" del panel (CPM $731 contra $478 con datos al 01/10)
{
  const c = P.canales.Oficial.campanas.find((x) => x.id === 'Super Niño'), pr = c.propia;
  const actual = B.filas.filter((r) => r.cli === CLI && r.canal === 'Oficial' && r.com === c.id && r.mes >= pr.inicio.slice(0, 7));
  const t = M.temporada({ actual, pasada: M.semanasDe(B.fuente.semanal, { canal: 'Oficial', cliente: CLI, comunic: c.id }, B.objetivo), inicio: pr.inicio, previa: pr.previa, datosHasta: B.datosHasta, objetivo: c.obj });
  log(`Oficial · Super Niño, temporada: CPM ${fmt(t.kpis.cpm.valor)} contra ${fmt(t.kpis.cpm.ref)} (${t.kpis.cpm.dif > 0 ? '+' : ''}${t.kpis.cpm.dif} %), luz ${t.luz}, peor que la temporada anterior: ${t.peor ? 'sí' : 'no'} · ${t.semanas} semanas de la pasada desde el ${t.desde}`);
  // con datos al 04/10: $725 contra $593 (22 % más caro, rojo). El 02/10 daba $478 y el 05/10, antes del arreglo, $782: la mezcla salía del
  // objetivo del cruce, que cambia entre extracciones
  if (B.datosHasta === '2026-10-04') { assert.strictEqual(Math.round(t.kpis.cpm.valor), 725); assert.strictEqual(Math.round(t.kpis.cpm.ref), 593); assert.strictEqual(t.peor, true); }
}
log(`casos a mano ${ok} · problemas 0`);
