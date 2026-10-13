// Verifica las tablas datajunta_meta_180d (filas, rango de fechas, última modificación). Solo lectura.
const { google } = require('googleapis');
const { opcionesAuth } = require('../datos/credenciales'); // BQ_CREDENTIALS_JSON o, en local, el archivo de GCP/
const TABLAS = [['prsm-bq-media', 'us-central1'], ['bq-project-450514', 'us']];

(async () => {
  const auth = new google.auth.GoogleAuth(opcionesAuth('bq', ['https://www.googleapis.com/auth/bigquery']));
  const bq = google.bigquery({ version: 'v2', auth: await auth.getClient() });
  for (let intento = 0; intento < 18; intento++) {
    const estados = [];
    for (const [p] of TABLAS) {
      try {
        const t = (await bq.tables.get({ projectId: p, datasetId: 'automatizado', tableId: 'datajunta_meta_180d' })).data;
        estados.push({ p, filas: t.numRows, modificada: new Date(Number(t.lastModifiedTime)).toISOString() });
      } catch (e) { estados.push({ p, error: e.code }); }
    }
    if (estados.every((e) => !e.error)) {
      for (const [p, loc] of TABLAS) {
        const r = await bq.jobs.query({ projectId: 'prsm-bq-media', requestBody: { useLegacySql: false, location: loc,
          query: `SELECT MIN(Fecha) desde, MAX(Fecha) hasta, COUNT(*) filas, ROUND(SUM(Gasto)/1e6) gasto_M FROM \`${p}.automatizado.datajunta_meta_180d\`` } });
        console.log(p, JSON.stringify(r.data.rows[0].f.map((x) => x.v)), '| modificada', estados.find((e) => e.p === p).modificada);
      }
      return;
    }
    await new Promise((r) => setTimeout(r, 10000));
  }
  console.log('Todavía no están las dos tablas (la corrida sigue en curso).');
})().catch((e) => { console.error(e.message); process.exit(1); });
