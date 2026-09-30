// Lista las vistas de eficacia de Looker (prsm-bq-media.VistasTableros) y las tablas fuente por proyecto. Solo lectura.
const path = require('path');
const { google } = require(path.join(__dirname, '..', '..', 'pautador', 'node_modules', 'googleapis'));
const CLAVE = path.resolve(__dirname, '..', '..', 'GCP', 'prsm-bq-media-6a154f90fdb5.json');
(async () => {
  const auth = new google.auth.GoogleAuth({ keyFile: CLAVE, scopes: ['https://www.googleapis.com/auth/bigquery'] });
  const bq = google.bigquery({ version: 'v2', auth: await auth.getClient() });
  for (const ds of ['VistasTableros', 'prsm_media_tableros']) {
    try {
      const r = await bq.tables.list({ projectId: 'prsm-bq-media', datasetId: ds, maxResults: 200 });
      console.log(`\n${ds}:`, (r.data.tables || []).map((t) => `${t.tableReference.tableId} (${t.type})`).join(' | '));
    } catch (e) { console.log(ds, 'ERROR', e.message); }
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
