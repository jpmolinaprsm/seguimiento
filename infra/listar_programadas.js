// Lista las consultas programadas (BigQuery Data Transfer) del proyecto prsm-bq-media. Solo lectura.
const path = require('path');
const PAUTADOR = path.resolve(__dirname, '..', '..', 'pautador');
const { google } = require(path.join(PAUTADOR, 'node_modules', 'googleapis'));
const CLAVE = path.resolve(__dirname, '..', '..', 'GCP', 'prsm-bq-media-6a154f90fdb5.json');

(async () => {
  const auth = new google.auth.GoogleAuth({ keyFile: CLAVE, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const dt = google.bigquerydatatransfer({ version: 'v1', auth: await auth.getClient() });
  for (const loc of ['us-central1', 'us']) {
    const r = await dt.projects.locations.transferConfigs.list({ parent: `projects/prsm-bq-media/locations/${loc}`, dataSourceIds: ['scheduled_query'] });
    for (const c of r.data.transferConfigs || []) {
      console.log(`[${loc}] ${c.displayName} | ${c.schedule} | ${c.state} | ${c.name}`);
      console.log('   ', JSON.stringify(c.params).slice(0, 400));
    }
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
