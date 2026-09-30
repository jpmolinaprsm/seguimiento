// Salud y presupuesto de cada activo (cuenta publicitaria): pedido en la planilla vs gasto en DataJunta.
//   node activos.js ["Gobierno de Santa Fe"]
// Unión cuenta → activo:
//   - Meta: PROFILE_ID → PROFILE de FBADS_TABLERO_META (los dos canales). DV360: ADVERTISER_ID → ADVERTISER.
//   - Google, TikTok y el resto (sin número de cuenta en BigQuery): por plataforma + código de proyecto + grupo
//     ("GSFOFI … (ADS)"); en Informativo, por el código del cliente de la solicitud.
//   - Si una cuenta puede ser varios activos (o un activo recibe varias cuentas), se agrupan en una sola unidad.
// El nombre del activo es el ActivoLargo de DataJunta ("Gaceta Santafesina (INF)", "GSFOFI Gobierno Santa Fe (SMC)").
const fs = require('fs');
const path = require('path');
const { leerPlanilla, normalizar, vigentes, hoyAR, sumarDias, mesMas } = require('./pedidos');

const PLAT_DJ = { Meta: 'META', Google: 'Google Ads', DV360: 'Google Display & Video 360', TikTok: 'TikTok Ads' };
const PLAT_PLANILLA = Object.fromEntries(Object.entries(PLAT_DJ).map(([k, v]) => [v, k]));
const MAPA = path.join(__dirname, '_mapa_cuentas.json');
// Equivalencias a mano para las cuentas que BigQuery no identifica (Google, TikTok, Twitter, Illumin):
// { "Google|553-945-7456": "Gaceta Santafesina * (INF)" } — el nombre es el ActivoLargo de DataJunta.
const MANUAL = path.join(__dirname, 'cuentas_manual.json');
const DIA = 86400000;
const digitos = (s) => String(s || '').replace(/\D/g, '');
const limpio = (s) => String(s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const grupoDe = (nombre) => ((String(nombre).match(/\(([A-Z&]{2,4})\)\s*(?:\(SUSPENDED\))?\s*$/) || [])[1] || '');
const codigoDe = (nombre) => ((String(nombre).match(/^([A-Z0-9]{5,6})[\s ]/) || [])[1] || '');

function bq() {
  const PAUTADOR = path.resolve(__dirname, '..', '..', 'pautador');
  process.env.BQ_SERVICE_ACCOUNT_KEY_PATH = process.env.BQ_SERVICE_ACCOUNT_KEY_PATH || path.resolve(__dirname, '..', '..', 'GCP', 'prsm-bq-media-6a154f90fdb5.json');
  const cwd = process.cwd();
  process.chdir(PAUTADOR);
  const m = require(path.join(PAUTADOR, 'src', 'services', 'bqDatajunta.js'));
  process.chdir(cwd);
  return m;
}

const TABLAS = { Oficial: 'prsm-bq-media.prsm_media_tableros', Informativo: 'bq-project-450514.informativo' };

// Número de cuenta → nombre del activo (Meta y DV360). Se guarda en disco y se refresca una vez por día.
async function mapaCuentas() {
  try {
    const m = JSON.parse(fs.readFileSync(MAPA, 'utf8'));
    if (m.ts && Date.now() - m.ts < DIA && m.ids) return m.ids;
  } catch (e) { /* se reconstruye */ }
  const { query } = bq();
  const ids = {};
  for (const base of Object.values(TABLAS)) {
    const meta = await query(`SELECT CAST(PROFILE_ID AS STRING) AS id, ANY_VALUE(PROFILE) AS nombre FROM \`${base}.FBADS_TABLERO_META\` WHERE DATE >= DATE_SUB(CURRENT_DATE(), INTERVAL 400 DAY) GROUP BY 1`);
    for (const x of meta) ids[`Meta|${digitos(x.id)}`] = x.nombre;
    const dv = await query(`SELECT CAST(ADVERTISER_ID AS STRING) AS id, ANY_VALUE(ADVERTISER) AS nombre FROM \`${base}.GGLDV360BM_DV360_TABLERO_2\` WHERE DATE >= DATE_SUB(CURRENT_DATE(), INTERVAL 400 DAY) GROUP BY 1`);
    for (const x of dv) ids[`DV360|${digitos(x.id)}`] = x.nombre;
  }
  fs.writeFileSync(MAPA, JSON.stringify({ ts: Date.now(), ids }, null, 1));
  return ids;
}

// Gasto por activo: mes × canal × plataforma × ActivoLargo, con el cliente y el código de lo que se pautó ahí.
// Solo días completos: hasta `hasta` inclusive (el día de hoy viene casi vacío y no se cuenta).
async function gastos(desde, hasta) {
  const { query } = bq();
  const sql = (base, canal) => `
    DECLARE ult DATE DEFAULT (SELECT MAX(Fecha) FROM \`${base}.DataJunta\` WHERE Fecha BETWEEN '${desde}' AND '${hasta}');
    SELECT '${canal}' AS canal, FORMAT_DATE('%Y-%m', Fecha) AS periodo, Plataforma AS plataforma, TRIM(ActivoLargo) AS activo,
      IFNULL(Codigo_Proyecto, '') AS codigo, ANY_VALUE(Cliente) AS cliente, ANY_VALUE(Proyecto) AS proyecto,
      SUM(IFNULL(Gasto, 0)) AS gastado,
      SUM(IF(Fecha > DATE_SUB(ult, INTERVAL 7 DAY), IFNULL(Gasto, 0), 0)) AS gasto_7d,
      CAST(MAX(IF(Gasto > 0, Fecha, NULL)) AS STRING) AS ultimo_gasto, CAST(ult AS STRING) AS datos_hasta
    FROM \`${base}.DataJunta\`
    WHERE Fecha BETWEEN '${desde}' AND '${hasta}' AND ActivoLargo IS NOT NULL
    GROUP BY 1, 2, 3, 4, 5
    HAVING gastado > 0`;
  const [of, inf] = await Promise.all([query(sql(TABLAS.Oficial, 'Oficial')), query(sql(TABLAS.Informativo, 'Informativo'))]);
  return of.concat(inf).filter((g) => PLAT_PLANILLA[g.plataforma]).map((g) => ({ ...g, activo: limpio(g.activo), plataforma: PLAT_PLANILLA[g.plataforma] || g.plataforma, gastado: Number(g.gastado) || 0, gasto_7d: Number(g.gasto_7d) || 0 }));
}

// Unidades: componentes conexos del grafo cuenta ↔ activo (por plataforma).
function armarUnidades(cuentas, activos, ids) {
  const padre = new Map();
  const raiz = (x) => { while (padre.get(x) !== x) { padre.set(x, padre.get(padre.get(x))); x = padre.get(x); } return x; };
  const unir = (a, b) => { for (const x of [a, b]) if (!padre.has(x)) padre.set(x, x); padre.set(raiz(a), raiz(b)); };
  const nodoA = (plat, nombre) => `A|${plat}|${nombre}`;
  for (const a of activos) unir(nodoA(a.plataforma, a.activo), nodoA(a.plataforma, a.activo));
  for (const c of cuentas) {
    const nc = `C|${c.plataforma}|${c.cuenta}`;
    unir(nc, nc);
    const directo = ids[`${c.plataforma}|${digitos(c.cuenta)}`];
    let candidatos = [];
    if (directo) candidatos = [limpio(directo)];
    else if (c.canal === 'Oficial') {
      candidatos = activos.filter((a) => a.plataforma === c.plataforma && a.canal === 'Oficial' && codigoDe(a.activo) === c.codigo && grupoDe(a.activo) === c.grupo.replace(/[()]/g, '')).map((a) => a.activo);
      if (!candidatos.length) candidatos = activos.filter((a) => a.plataforma === c.plataforma && a.canal === 'Oficial' && codigoDe(a.activo) === c.codigo).map((a) => a.activo);
    } else {
      // Informativo: una cuenta sin número conocido solo se une si hay un único medio posible para sus clientes
      candidatos = activos.filter((a) => a.plataforma === c.plataforma && a.canal === 'Informativo' && c.codigos.some((k) => a.codigos.has(k))).map((a) => a.activo);
      if (candidatos.length !== 1) candidatos = [];
    }
    c.union = directo ? 'número de cuenta' : candidatos.length ? 'código y grupo' : 'sin unir';
    for (const n of new Set(candidatos)) unir(nc, nodoA(c.plataforma, n));
  }
  const grupos = new Map();
  for (const x of padre.keys()) { const r = raiz(x); if (!grupos.has(r)) grupos.set(r, []); grupos.get(r).push(x); }
  return [...grupos.values()];
}

// Último día COMPLETO de DataJunta (los dos canales juntos), con el mismo criterio que la app (borrador/armar.js):
// si el último día cargado gastó menos del 30 % de la mediana de los 7 anteriores, todavía se está cargando y se toma el previo.
async function ultimoDiaCompleto() {
  const { query } = bq();
  const sql = (base) => `SELECT CAST(Fecha AS STRING) AS fecha, SUM(IFNULL(Gasto, 0)) AS gasto FROM \`${base}.DataJunta\`
    WHERE Fecha BETWEEN DATE_SUB(CURRENT_DATE('America/Argentina/Buenos_Aires'), INTERVAL 12 DAY) AND CURRENT_DATE('America/Argentina/Buenos_Aires')
    GROUP BY 1`;
  const filas = (await Promise.all(Object.values(TABLAS).map((b) => query(sql(b))))).flat();
  const tot = {};
  for (const r of filas) tot[r.fecha] = (tot[r.fecha] || 0) + (Number(r.gasto) || 0);
  return diaCompleto(tot);
}
function diaCompleto(tot) {
  const ds = Object.keys(tot).filter((f) => tot[f] > 0).sort();
  if (!ds.length) return sumarDias(hoyAR(), -1);
  const prev = ds.slice(-8, -1).map((f) => tot[f]).sort((a, b) => a - b);
  const med = prev.length ? prev[Math.floor(prev.length / 2)] : 0;
  return ds.length > 1 && tot[ds[ds.length - 1]] < med * 0.3 ? ds[ds.length - 2] : ds[ds.length - 1];
}

// Meses de trabajo (desde el 30/09/2026 salen de la fecha, sin valores fijos): el mes del último día completo (el "mes en
// curso" de la app), el anterior, y el mes de hoy si ya empezó (el 1.º de cada mes: septiembre cerrando + octubre recién
// empezado). Antes era fijo ['2026-08', '2026-09'] (pedido del usuario del 28/09: mes en curso y el anterior).
function ventana(hasta, hoy = hoyAR()) {
  const periodo = hasta.slice(0, 7);
  const periodos = [mesMas(periodo, -1), periodo];
  for (let m = mesMas(periodo, 1); m <= hoy.slice(0, 7); m = mesMas(m, 1)) periodos.push(m);
  return { periodo, periodos };
}

async function calcular({ hasta } = {}) {
  hasta = hasta || await ultimoDiaCompleto();
  const { periodo, periodos: PERIODOS } = ventana(hasta);
  const pedidos = (await leerPlanilla()).map(normalizar).filter((p) => PERIODOS.includes(p.periodo));
  // meses que todavía no tienen ningún pedido en la planilla: se informan como "Sin pedido cargado", nunca con el de otro mes
  const cargados = new Set(pedidos.map((p) => p.periodo));
  const vig = vigentes(pedidos);
  const desde = `${PERIODOS[0]}-01`;
  const [idsBq, gas] = await Promise.all([mapaCuentas(), gastos(desde, hasta)]);
  let manual = {};
  try { manual = JSON.parse(fs.readFileSync(MANUAL, 'utf8')); } catch (e) { /* sin equivalencias manuales */ }
  const ids = { ...idsBq };
  for (const [k, v] of Object.entries(manual)) { const [plat, num] = k.split('|'); if (plat && num && v) ids[`${plat}|${digitos(num)}`] = v; }

  // cuentas de la planilla (por plataforma + número), con sus clientes
  const cuentas = new Map();
  for (const p of pedidos) {
    const k = `${p.plataforma}|${p.cuenta}`;
    if (!cuentas.has(k)) cuentas.set(k, { plataforma: p.plataforma, cuenta: p.cuenta, canal: p.canal, grupo: p.grupo, codigo: p.codigo, titular: p.titularCuenta, codigos: [], clientes: new Set() });
    const c = cuentas.get(k);
    if (p.codigo && !c.codigos.includes(p.codigo)) c.codigos.push(p.codigo);
    if (p.cliente) c.clientes.add(p.cliente);
  }
  // activos con gasto en DataJunta
  const activos = new Map();
  for (const g of gas) {
    const k = `${g.plataforma}|${g.activo}`;
    if (!activos.has(k)) activos.set(k, { plataforma: g.plataforma, activo: g.activo, canal: g.canal, codigos: new Set(), clientes: new Set() });
    const a = activos.get(k);
    if (g.codigo) a.codigos.add(g.codigo);
    if (g.cliente) a.clientes.add(g.cliente);
  }
  const comps = armarUnidades([...cuentas.values()], [...activos.values()], ids);

  // último día con datos de cada mes (para los activos sin gasto, que no traen fecha propia)
  const hastaDe = (per) => {
    const [a, m] = per.split('-').map(Number);
    const fin = `${per}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`;
    return hasta < fin ? hasta : fin;
  };
  const unidades = comps.map((nodos) => {
    const ctas = nodos.filter((n) => n.startsWith('C|')).map((n) => cuentas.get(n.slice(2)));
    // un activo puede venir solo del mapa de cuentas (sin gasto en DataJunta desde diciembre)
    const acts = nodos.filter((n) => n.startsWith('A|')).map((n) => activos.get(n.slice(2)) || { plataforma: n.split('|')[1], activo: n.split('|').slice(2).join('|'), canal: (ctas[0] || {}).canal || 'Oficial', codigos: new Set(), clientes: new Set() });
    const plataforma = (ctas[0] || acts[0]).plataforma;
    const canal = (ctas[0] || acts[0]).canal;
    const nombres = acts.map((a) => a.activo);
    const numeros = ctas.map((c) => c.cuenta);
    const clientes = new Set([...ctas.flatMap((c) => [...c.clientes]), ...acts.flatMap((a) => [...a.clientes])]);
    const setCtas = new Set(ctas.map((c) => c.cuenta)), setActs = new Set(nombres);
    const porMes = new Map();
    const fila = (per) => { if (!porMes.has(per)) porMes.set(per, { periodo: per, pedido: 0, pendiente: 0, gastado: 0, gasto7d: 0, ultimoGasto: null, datosHasta: null, pedidoPorCliente: {}, gastoPorCliente: {} }); return porMes.get(per); };
    for (const v of vig) {
      if (v.plataforma !== plataforma || !setCtas.has(v.cuenta)) continue;
      const f = fila(v.periodo);
      f.pedido += v.presupuesto; f.pendiente += v.pendiente;
      const cli = v.cliente || '(sin cliente)';
      f.pedidoPorCliente[cli] = (f.pedidoPorCliente[cli] || 0) + v.presupuesto;
    }
    for (const g of gas) {
      if (g.plataforma !== plataforma || !setActs.has(g.activo)) continue;
      const f = fila(g.periodo);
      f.gastado += g.gastado; f.gasto7d += g.gasto_7d;
      if (g.ultimo_gasto && (!f.ultimoGasto || g.ultimo_gasto > f.ultimoGasto)) f.ultimoGasto = g.ultimo_gasto;
      const cli = g.cliente || '(sin cliente)';
      f.gastoPorCliente[cli] = (f.gastoPorCliente[cli] || 0) + g.gastado;
    }
    const historial = [...porMes.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));
    // clientes del activo: los que tienen al menos el 15 % de la plata (pedida + gastada) de la ventana
    const peso = {};
    for (const h of historial) for (const o of [h.pedidoPorCliente, h.gastoPorCliente]) for (const [cli, v] of Object.entries(o)) peso[cli] = (peso[cli] || 0) + v;
    const totPeso = Object.values(peso).reduce((t, v) => t + v, 0);
    const clientesPeso = Object.keys(peso).filter((cli) => cli !== '(sin cliente)' && totPeso && peso[cli] / totPeso >= 0.15);
    const union = [...new Set(ctas.map((c) => c.union))];
    return {
      id: `${plataforma}|${(nombres[0] || numeros[0])}`, plataforma, canal,
      nombre: nombres.length ? nombres.join(' + ') : `Cuenta ${numeros.join(', ')} (${ctas[0] ? ctas[0].titular : ''})`,
      activos: nombres, cuentas: numeros, clientes: clientesPeso.length ? clientesPeso : [...clientes], union: union.join(', ') || (acts.length ? 'sin pedido' : ''),
      agrupada: nombres.length > 1 || numeros.length > 1, historial,
      meses: Object.fromEntries(PERIODOS.map((p) => [p, salud(porMes.get(p), p, hastaDe(p), cargados.has(p))])),
    };
  }).filter((u) => PERIODOS.some((p) => u.meses[p].pedido || u.meses[p].gastado));
  // `mes` = el mes del último día completo, el mismo que la app toma como mes en curso. Si la app se arma con datos de
  // otro día, lo seguro es que lea u.meses[MES] (ver bitácora de Datos, 30/09).
  for (const u of unidades) { u.periodo = periodo; u.datosHasta = hasta; u.mes = u.meses[periodo]; }
  return { periodo, periodos: PERIODOS, hasta, cargados: [...cargados].sort(), unidades, pedidos };
}

// Salud de una unidad en un mes. Si el mes ya cerró (hay datos hasta su último día), se lee como balance final.
// Si el mes no tiene ningún pedido en la planilla (pedidoCargado = false), no se juzga contra lo pedido: "Sin pedido cargado".
function salud(f, periodo, hasta, pedidoCargado = true) {
  const [a, m] = periodo.split('-').map(Number);
  const diasMes = new Date(a, m, 0).getDate();
  if (!f) return { estado: pedidoCargado ? 'Sin movimiento' : 'Sin pedido cargado', nivel: -1, pedidoCargado, pedido: 0, pendiente: 0, gastado: 0, restante: 0, cerrado: false };
  const diaDatos = hasta && hasta.startsWith(periodo) ? Number(hasta.slice(8, 10)) : diasMes;
  const cerrado = diaDatos >= diasMes;
  const diasRest = Math.max(0, diasMes - diaDatos);
  const diario = f.gasto7d / 7;
  const restante = f.pedido - f.gastado;
  const proy = cerrado ? f.gastado : f.gastado + diario * diasRest;
  const pctMes = diaDatos / diasMes;
  const pctEjec = f.pedido ? f.gastado / f.pedido : null;
  const diasPlata = !cerrado && diario > 0 && restante > 0 ? restante / diario : null;
  const agota = diasPlata != null && diasPlata < diasRest ? new Date(a, m - 1, diaDatos + Math.floor(diasPlata)) : null;
  const sinGasto = f.ultimoGasto && hasta ? Math.round((new Date(hasta) - new Date(f.ultimoGasto)) / DIA) : null;
  let estado, nivel;
  if (!pedidoCargado) { estado = 'Sin pedido cargado'; nivel = -1; }
  else if (!f.pedido && f.gastado > 0) { estado = 'Gasto sin pedido'; nivel = 3; }
  else if (f.pedido && f.gastado > f.pedido * 1.02) { estado = 'Por encima de lo pedido'; nivel = 3; }
  else if (cerrado) {
    if (f.pedido && f.gastado === 0) { estado = 'No gastó'; nivel = 2; }
    else if (f.pedido && f.gastado < f.pedido * 0.85) { estado = 'Sobró'; nivel = sinGasto != null && sinGasto >= 3 ? 2 : 1; }
    else { estado = 'Ejecutado'; nivel = 0; }
  }
  else if (agota && diasRest - diasPlata >= 2) { estado = 'Se agota antes de fin de mes'; nivel = 2; }
  else if (f.pedido && (f.gastado === 0 || (sinGasto != null && sinGasto >= 3))) { estado = 'Sin gasto reciente'; nivel = 2; }
  else if (f.pedido && proy < f.pedido * 0.85) { estado = 'Va a sobrar'; nivel = 1; }
  else { estado = 'En ritmo'; nivel = 0; }
  return {
    estado, nivel, pedidoCargado, cerrado, pedido: f.pedido, pendiente: f.pendiente, gastado: f.gastado, restante, pctEjec, pctMes, diario, proy,
    diasPlata, agota: agota ? agota.toISOString().slice(0, 10) : null, ultimoGasto: f.ultimoGasto, diasSinGasto: sinGasto, diaDatos, diasMes,
    pedidoPorCliente: f.pedidoPorCliente, gastoPorCliente: f.gastoPorCliente,
  };
}

module.exports = { calcular, ventana, diaCompleto, salud };

if (require.main === module) {
  (async () => {
    const cliente = process.argv[2] || 'Gobierno de Santa Fe';
    const { periodo, periodos, hasta, cargados, unidades } = await calcular();
    console.log(`datos al ${hasta} · mes ${periodo} · meses ${periodos.join(', ')} · con pedidos en la planilla: ${cargados.join(', ') || 'ninguno'}`);
    fs.writeFileSync(path.join(__dirname, '_activos.json'), JSON.stringify(unidades, null, 1));
    const M = (n) => (n < 0 ? '-' : '') + '$' + (Math.abs(n || 0) / 1e6).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' M';
    const us = unidades.filter((u) => u.clientes.includes(cliente) && (u.mes.pedido || u.mes.gastado)).sort((x, y) => y.mes.nivel - x.mes.nivel || y.mes.pedido - x.mes.pedido);
    console.log(`\n=== ${cliente} · ${periodo} · ${us.length} activos con pedido o gasto ===`);
    for (const u of us) {
      const s = u.mes;
      console.log(`[${s.estado.padEnd(28)}] ${u.plataforma.padEnd(6)} ${u.canal.padEnd(11)} ${u.nombre.slice(0, 50).padEnd(50)} pedido ${M(s.pedido).padStart(8)} gastado ${M(s.gastado).padStart(8)} restante ${M(s.restante).padStart(8)} ${s.agota ? 'se agota ' + s.agota.slice(8, 10) + '/' + s.agota.slice(5, 7) : ''} ${u.agrupada ? '(agrupada)' : ''} · ${u.union}`);
    }
    const tot = unidades.length, sinUnir = unidades.filter((u) => !u.activos.length && u.mes.pedido > 0).length;
    console.log(`\nunidades: ${tot} · con pedido este mes y sin activo identificado: ${sinUnir}`);
  })().catch((e) => { console.error('ERROR', e.stack || e.message); process.exit(1); });
}
