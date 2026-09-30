// Presupuestos pedidos (planilla "Presupuestos pedidos por proyecto") → presupuesto vigente por mes.
// Reglas de lectura:
//   - Canal: Grupo "(INF)" = Informativo; el resto = Oficial.
//   - En Informativo las cuentas son de "Intelia · Informativos Varios": el cliente/proyecto real está en
//     "Cliente solicitud" / "Proyecto solicitud" / "Código solicitud".
//   - Mes de ejecución = columna "Mes" (1-12). El año sale de "Año"; si falta, de la fecha de solicitud
//     (+1 si se pidió en diciembre para enero).
//   - Por cuenta y mes, en orden de solicitud: "Cargar como presupuesto total" fija el monto; "Sumar al presupuesto
//     actual" lo aumenta. Solo cuentan los pedidos en estado "Aplicado" (los "Pedido"/"Procesando" se informan aparte).
const fs = require('fs');
const path = require('path');

const SHEET_ID = '1kPv5TDe4TLPRq4nVZioQyVio0y8NmSNRr26evwuLPWM';
const PAUTADOR = path.resolve(__dirname, '..', '..', 'pautador');

async function leerPlanilla() {
  require(path.join(PAUTADOR, 'node_modules', 'dotenv')).config({ path: path.join(PAUTADOR, '.env'), quiet: true });
  const { google } = require(path.join(PAUTADOR, 'node_modules', 'googleapis'));
  const keyFile = path.resolve(PAUTADOR, process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH);
  const auth = new google.auth.GoogleAuth({ keyFile, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const v = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "'Hoja 1'!A1:U", valueRenderOption: 'FORMATTED_VALUE' });
  const [cab, ...filas] = v.data.values;
  return filas.filter((r) => r.some(Boolean)).map((r) => Object.fromEntries(cab.map((c, i) => [c, (r[i] ?? '').trim()])));
}

// Meses sin valores fijos (30/09/2026). Hora de Argentina (UTC-3, sin horario de verano).
// mesDeAyer(): el mes del último día que DataJunta puede tener completo (se carga a las 8:00 con el día anterior):
// el 1/10 todavía es septiembre, el 2/10 ya es octubre. Es el mismo criterio que usa la app para su mes en curso.
const hoyAR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const sumarDias = (f, n) => new Date(Date.parse(f + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const mesDeAyer = () => sumarDias(hoyAR(), -1).slice(0, 7);
const mesMas = (per, k) => new Date(Date.UTC(Number(per.slice(0, 4)), Number(per.slice(5, 7)) - 1 + k, 1)).toISOString().slice(0, 7);

const monto = (s) => Number(String(s).replace(/[^0-9,-]/g, '').replace(',', '.')) || 0;
function fechaSolicitud(s) {
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
}

function normalizar(r) {
  const inf = r.Grupo === '(INF)';
  const fs_ = fechaSolicitud(r['Fecha solicitud']);
  const mes = Number(r.Mes);
  let anio = Number(r['Año']) || (fs_ ? fs_.getFullYear() : null);
  if (!Number(r['Año']) && fs_ && mes < fs_.getMonth() + 1 - 6) anio += 1; // pedido de diciembre para enero
  const real = inf && r['Cliente solicitud'] ? { codigo: r['Código solicitud'], cliente: r['Cliente solicitud'], proyecto: r['Proyecto solicitud'] }
    : { codigo: r['Código'], cliente: r.Cliente, proyecto: r.Proyecto };
  return {
    canal: inf ? 'Informativo' : 'Oficial', grupo: r.Grupo, plataforma: r.Plataforma,
    cuenta: r['ID Cuenta'] || r.Cuenta, titularCuenta: `${r.Cliente} · ${r.Proyecto}`,
    ...real, sinAsignar: inf && !r['Cliente solicitud'],
    periodo: anio && mes ? `${anio}-${String(mes).padStart(2, '0')}` : null,
    monto: monto(r.Presupuesto), tipo: /total/i.test(r['Tipo de asignación']) ? 'total' : 'suma',
    estado: r.Estado, fecha: fs_, notas: r.Notas,
  };
}

// Presupuesto vigente por cuenta × período × proyecto real (en Informativo una misma cuenta sirve a varios clientes:
// el "total" y las "sumas" se aplican por cuenta + proyecto de la solicitud).
function vigentes(pedidos) {
  const grupos = new Map();
  for (const p of pedidos) {
    if (!p.periodo) continue;
    const k = [p.periodo, p.canal, p.plataforma, p.cuenta, p.codigo || p.cliente].join('|');
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(p);
  }
  const out = [];
  for (const [, ps] of grupos) {
    ps.sort((a, b) => (a.fecha || 0) - (b.fecha || 0));
    let aplicado = 0, pendiente = 0, cambios = 0;
    for (const p of ps) {
      if (p.estado === 'Aplicado') { aplicado = p.tipo === 'total' ? p.monto : aplicado + p.monto; cambios += 1; }
      else pendiente += p.monto;
    }
    const b = ps[ps.length - 1];
    out.push({ periodo: b.periodo, canal: b.canal, plataforma: b.plataforma, cuenta: b.cuenta, titularCuenta: b.titularCuenta, codigo: b.codigo, cliente: b.cliente, proyecto: b.proyecto,
      sinAsignar: b.sinAsignar, presupuesto: aplicado, pendiente, pedidos: ps.length, cambios, ultimoPedido: b.fecha });
  }
  return out;
}

module.exports = { leerPlanilla, normalizar, vigentes, SHEET_ID, hoyAR, sumarDias, mesDeAyer, mesMas };

if (require.main === module) {
  (async () => {
    const crudo = await leerPlanilla();
    const pedidos = crudo.map(normalizar);
    const v = vigentes(pedidos);
    fs.writeFileSync(path.join(__dirname, '_vigentes.json'), JSON.stringify(v, null, 1));
    const periodo = process.argv[2] || mesDeAyer();
    const suma = (xs, k) => xs.reduce((a, x) => a + x[k], 0);
    const M = (n) => '$' + (n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' M';
    console.log(`pedidos: ${pedidos.length} | sin período: ${pedidos.filter((p) => !p.periodo).length} | INF sin cliente real: ${pedidos.filter((p) => p.sinAsignar).length}`);
    const mesSel = v.filter((x) => x.periodo === periodo);
    console.log(`\n=== ${periodo}: por cliente × canal (todas las plataformas) ===`);
    const porCli = new Map();
    for (const x of mesSel) { const k = x.cliente || '(sin cliente)'; if (!porCli.has(k)) porCli.set(k, { Oficial: 0, Informativo: 0, pend: 0 }); porCli.get(k)[x.canal] += x.presupuesto; porCli.get(k).pend += x.pendiente; }
    for (const [cli, o] of [...porCli].sort((a, b) => (b[1].Oficial + b[1].Informativo) - (a[1].Oficial + a[1].Informativo))) {
      const tot = o.Oficial + o.Informativo;
      console.log(`${cli.padEnd(30)} | Oficial ${M(o.Oficial).padStart(10)} (${Math.round(o.Oficial / tot * 100)} %) | Informativo ${M(o.Informativo).padStart(9)} (${Math.round(o.Informativo / tot * 100)} %) | pendiente ${M(o.pend)}`);
    }
    console.log(`\n=== ${periodo}: Meta por proyecto × canal (para comparar con PresupuestoMensual de DataJunta) ===`);
    const meta = new Map();
    for (const x of mesSel.filter((y) => y.plataforma === 'Meta')) { const k = `${x.cliente} · ${x.proyecto} · ${x.canal}`; meta.set(k, (meta.get(k) || 0) + x.presupuesto); }
    for (const [k, val] of [...meta].sort()) console.log(`${k.padEnd(75)} ${M(val)}`);
    console.log('\n=== totales por mes y canal (todas las plataformas) ===');
    const porMes = new Map();
    for (const x of v) { if (!porMes.has(x.periodo)) porMes.set(x.periodo, { Oficial: 0, Informativo: 0 }); porMes.get(x.periodo)[x.canal] += x.presupuesto; }
    for (const [p, o] of [...porMes].sort()) console.log(`${p} | Oficial ${M(o.Oficial).padStart(10)} | Informativo ${M(o.Informativo).padStart(9)} | % Inf ${Math.round(o.Informativo / (o.Oficial + o.Informativo) * 100)} %`);
  })().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
}
