// Crea la copia diaria de DataJunta (solo META, últimos 180 días) para Seguimiento y Optimización, en los dos datasets automatizado,
// como consulta programada de BigQuery Data Transfer (copia del patrón de "Refresco datajunta_meta_90d", que NO se toca: la usa PAUTADOR).
// Pedido del usuario 2026-09-28. Idempotente: si ya existe una con el mismo nombre, no crea otra.
// Uso: node crear_180d.js [--correr]   (--correr dispara la primera corrida al crearlas)
const path = require('path');
const PAUTADOR = path.resolve(__dirname, '..', '..', 'pautador');
const { google } = require(path.join(PAUTADOR, 'node_modules', 'googleapis'));
const CLAVE = path.resolve(__dirname, '..', '..', 'GCP', 'prsm-bq-media-6a154f90fdb5.json');

const CANALES = [
  { nombre: 'Oficial', loc: 'us-central1', origen: 'prsm-bq-media.prsm_media_tableros.DataJunta', dest: 'prsm-bq-media.automatizado.datajunta_meta_180d' },
  { nombre: 'Informativo', loc: 'us', origen: 'bq-project-450514.informativo.DataJunta', dest: 'bq-project-450514.automatizado.datajunta_meta_180d' },
];
const sql = (c) => `CREATE OR REPLACE TABLE \`${c.dest}\`
PARTITION BY Fecha CLUSTER BY Proyecto, Activo, Comunicacion
OPTIONS (description = 'DataJunta solo META, ultimos 180 dias (ventana movil), grano original. Para Seguimiento y Optimizacion. Particionada por Fecha, clusterizada por Proyecto, Activo, Comunicacion. Se regenera con CREATE OR REPLACE. Historico: usar DataJunta.')
AS SELECT * FROM \`${c.origen}\`
WHERE Plataforma = 'META' AND Fecha >= DATE_SUB(CURRENT_DATE('America/Argentina/Buenos_Aires'), INTERVAL 180 DAY)`;

(async () => {
  const auth = new google.auth.GoogleAuth({ keyFile: CLAVE, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const cli = await auth.getClient();
  const dt = google.bigquerydatatransfer({ version: 'v1', auth: cli });
  const bq = google.bigquery({ version: 'v2', auth: cli });
  for (const c of CANALES) {
    const parent = `projects/prsm-bq-media/locations/${c.loc}`;
    const display = `Refresco datajunta_meta_180d (${c.nombre})`;
    // costo: dry run del SELECT
    const dry = await bq.jobs.query({ projectId: 'prsm-bq-media', requestBody: { query: sql(c).replace(/^[\s\S]*?AS SELECT/, 'SELECT'), useLegacySql: false, dryRun: true, location: c.loc } });
    console.log(`${display}: lee ${(Number(dry.data.totalBytesProcessed) / 1e9).toFixed(2)} GB por corrida`);
    const existentes = (await dt.projects.locations.transferConfigs.list({ parent, dataSourceIds: ['scheduled_query'] })).data.transferConfigs || [];
    let cfg = existentes.find((x) => x.displayName === display);
    if (cfg) { console.log('   ya existe:', cfg.name); }
    else {
      cfg = (await dt.projects.locations.transferConfigs.create({ parent, requestBody: {
        displayName: display, dataSourceId: 'scheduled_query', schedule: 'every day 12:10', params: { query: sql(c) },
      } })).data;
      console.log('   creada:', cfg.name, '|', cfg.schedule);
    }
    if (process.argv.includes('--correr')) {
      const r = await dt.projects.locations.transferConfigs.startManualRuns({ parent: cfg.name, requestBody: { requestedRunTime: new Date().toISOString() } });
      console.log('   corrida manual:', (r.data.runs || []).map((x) => x.state).join(', '));
    }
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
