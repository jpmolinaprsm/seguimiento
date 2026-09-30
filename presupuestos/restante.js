// Presupuesto pedido (planilla) vs gastado (DataJunta) por mes × cliente × proyecto × canal × plataforma.
//   node restante.js [AAAA-MM]   → imprime el resumen del mes (por defecto, el de ayer en Argentina) y guarda _restante.json
// El cruce es por código de proyecto (Oficial: "Código"; Informativo: "Código solicitud") y plataforma.
const fs = require('fs');
const path = require('path');
const { leerPlanilla, normalizar, vigentes, mesDeAyer } = require('./pedidos');

const PLATAFORMA_DJ = { Meta: 'META', Google: 'Google Ads', DV360: 'Google Display & Video 360', TikTok: 'TikTok Ads', Twitter: 'Twitter', Illumin: 'Illumin' };
const PLATAFORMA_PLANILLA = Object.fromEntries(Object.entries(PLATAFORMA_DJ).map(([k, v]) => [v, k]));

function bq() {
  const PAUTADOR = path.resolve(__dirname, '..', '..', 'pautador');
  process.env.BQ_SERVICE_ACCOUNT_KEY_PATH = process.env.BQ_SERVICE_ACCOUNT_KEY_PATH || path.resolve(__dirname, '..', '..', 'GCP', 'prsm-bq-media-6a154f90fdb5.json');
  const cwd = process.cwd();
  process.chdir(PAUTADOR);
  const m = require(path.join(PAUTADOR, 'src', 'services', 'bqDatajunta.js'));
  process.chdir(cwd);
  return m;
}

// Gasto mensual por canal × plataforma × código de proyecto, desde enero del año del primer pedido.
async function gastos(desde) {
  const { query } = bq();
  const sql = (tabla, canal) => `
    SELECT '${canal}' AS canal, FORMAT_DATE('%Y-%m', Fecha) AS periodo, Plataforma AS plataforma,
      IFNULL(Codigo_Proyecto, '') AS codigo, ANY_VALUE(Proyecto) AS proyecto, ANY_VALUE(Cliente) AS cliente,
      SUM(IFNULL(Gasto, 0)) AS gastado, CAST(MAX(Fecha) AS STRING) AS hasta
    FROM \`${tabla}\`
    WHERE Fecha >= '${desde}'
    GROUP BY 1, 2, 3, 4
    HAVING gastado > 0`;
  const [of, inf] = await Promise.all([
    query(sql('prsm-bq-media.prsm_media_tableros.DataJunta', 'Oficial')),
    query(sql('bq-project-450514.informativo.DataJunta', 'Informativo')),
  ]);
  return of.concat(inf).map((g) => ({ ...g, gastado: Number(g.gastado) || 0, plataforma: PLATAFORMA_PLANILLA[g.plataforma] || g.plataforma }));
}

// Une pedidos vigentes y gastos. Llave: período × canal × plataforma × código de proyecto.
function cruzar(vig, gas) {
  const filas = new Map();
  const llave = (x) => [x.periodo, x.canal, x.plataforma, x.codigo].join('|');
  for (const v of vig) {
    const k = llave(v);
    if (!filas.has(k)) filas.set(k, { periodo: v.periodo, canal: v.canal, plataforma: v.plataforma, codigo: v.codigo, cliente: v.cliente, proyecto: v.proyecto, pedido: 0, pendiente: 0, gastado: 0, cuentas: [], hasta: null });
    const f = filas.get(k);
    f.pedido += v.presupuesto; f.pendiente += v.pendiente;
    if (!f.cuentas.includes(v.cuenta)) f.cuentas.push(v.cuenta);
  }
  for (const g of gas) {
    const k = llave(g);
    if (!filas.has(k)) filas.set(k, { periodo: g.periodo, canal: g.canal, plataforma: g.plataforma, codigo: g.codigo, cliente: g.cliente, proyecto: g.proyecto, pedido: 0, pendiente: 0, gastado: 0, cuentas: [], hasta: null });
    const f = filas.get(k);
    f.gastado += g.gastado; f.hasta = g.hasta;
    if (!f.cliente) { f.cliente = g.cliente; f.proyecto = g.proyecto; }
  }
  return [...filas.values()].map((f) => ({ ...f, restante: f.pedido - f.gastado, sinPedido: f.pedido === 0 && f.gastado > 0 }));
}

// Resumen del mes por cliente: reparto Oficial / Informativo del pedido y restante por canal.
function resumenMes(filas, periodo) {
  const delMes = filas.filter((f) => f.periodo === periodo);
  const porCliente = new Map();
  for (const f of delMes) {
    const cli = f.cliente || '(sin cliente)';
    if (!porCliente.has(cli)) porCliente.set(cli, { cliente: cli, Oficial: { pedido: 0, gastado: 0 }, Informativo: { pedido: 0, gastado: 0 }, proyectos: [] });
    const c = porCliente.get(cli);
    c[f.canal].pedido += f.pedido; c[f.canal].gastado += f.gastado;
    c.proyectos.push(f);
  }
  return [...porCliente.values()].map((c) => {
    const tot = c.Oficial.pedido + c.Informativo.pedido;
    for (const k of ['Oficial', 'Informativo']) { c[k].restante = c[k].pedido - c[k].gastado; c[k].pctEjecutado = c[k].pedido ? c[k].gastado / c[k].pedido : null; }
    c.pctInformativo = tot ? c.Informativo.pedido / tot : null;
    c.pedido = tot; c.gastado = c.Oficial.gastado + c.Informativo.gastado; c.restante = tot - c.gastado;
    return c;
  }).sort((a, b) => b.pedido - a.pedido);
}

async function calcular() {
  const pedidos = (await leerPlanilla()).map(normalizar);
  const vig = vigentes(pedidos);
  const desde = vig.map((v) => v.periodo).filter(Boolean).sort()[0] + '-01';
  const gas = await gastos(desde);
  return { filas: cruzar(vig, gas), pedidos };
}

module.exports = { calcular, resumenMes, PLATAFORMA_DJ };

if (require.main === module) {
  (async () => {
    const periodo = process.argv[2] || mesDeAyer();
    const { filas, pedidos } = await calcular();
    fs.writeFileSync(path.join(__dirname, '_restante.json'), JSON.stringify(filas, null, 1));
    const M = (n) => (n < 0 ? '-' : '') + '$' + (Math.abs(n) / 1e6).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' M';
    const P = (x) => (x == null ? '—' : Math.round(x * 100) + ' %');
    const res = resumenMes(filas, periodo);
    console.log(`\n=== ${periodo} · por cliente: pedido, reparto y restante ===`);
    for (const c of res) {
      console.log(`${c.cliente.padEnd(28)} pedido ${M(c.pedido).padStart(9)} · Oficial ${P(1 - (c.pctInformativo ?? 0)).padStart(5)} / Informativo ${P(c.pctInformativo).padStart(5)} · restante Of ${M(c.Oficial.restante).padStart(9)} (${P(c.Oficial.pctEjecutado)} ejec.) · Inf ${M(c.Informativo.restante).padStart(9)} (${P(c.Informativo.pctEjecutado)} ejec.)`);
    }
    console.log(`\n=== ${periodo} · por proyecto × canal × plataforma (Santa Fe, Chubut, Chaco) ===`);
    for (const f of filas.filter((x) => x.periodo === periodo && /Santa Fe|Chubut|Chaco/.test(x.cliente || '')).sort((a, b) => (a.cliente + a.proyecto + a.canal + a.plataforma).localeCompare(b.cliente + b.proyecto + b.canal + b.plataforma))) {
      console.log(`${(f.cliente || '').padEnd(22)} ${(f.proyecto || '').slice(0, 30).padEnd(30)} ${f.canal.padEnd(11)} ${f.plataforma.padEnd(8)} pedido ${M(f.pedido).padStart(9)} gastado ${M(f.gastado).padStart(9)} restante ${M(f.restante).padStart(9)}${f.sinPedido ? '  ← gasto sin pedido' : ''}`);
    }
    const sinPed = filas.filter((f) => f.periodo === periodo && f.sinPedido && f.gastado > 50000);
    console.log(`\ngasto sin pedido en la planilla (${periodo}, > $50 mil): ${sinPed.length} · ${M(sinPed.reduce((a, f) => a + f.gastado, 0))}`);
    for (const f of sinPed.sort((a, b) => b.gastado - a.gastado).slice(0, 12)) console.log(`  ${f.canal} ${f.plataforma} ${f.codigo} ${f.proyecto} ${M(f.gastado)}`);
    console.log(`\npedidos de Informativo sin cliente real ("Cliente solicitud" vacío): ${pedidos.filter((p) => p.sinAsignar).length}`);
  })().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
}
