// Resumen de la tabla eficacia_anuncios por canal y cliente (solo lectura).
const { google } = require('googleapis');
const { opcionesAuth } = require('../datos/credenciales'); // BQ_CREDENTIALS_JSON o, en local, el archivo de GCP/
const T = [['prsm-bq-media', 'us-central1'], ['bq-project-450514', 'us']];
(async () => {
  const auth = new google.auth.GoogleAuth(opcionesAuth('bq', ['https://www.googleapis.com/auth/bigquery']));
  const bq = google.bigquery({ version: 'v2', auth: await auth.getClient() });
  for (const [p, loc] of T) {
    const q = `SELECT Cliente, COUNT(*) anuncios, COUNTIF(Es_Semaforo) semaforo,
      COUNTIF(Nivel_Referencia='Proyecto') ref_proy, COUNTIF(Nivel_Referencia='General') ref_gen, COUNTIF(Es_Semaforo AND Nivel_Referencia IS NULL) sin_ref,
      ROUND(COUNTIF(Semaforo_CPR='Rojo')/NULLIF(COUNTIF(Semaforo_CPR IS NOT NULL),0)*100,1) pct_rojos,
      ROUND(SUM(IF(Semaforo_CPR='Rojo',Gasto_Total,0))/NULLIF(SUM(IF(Semaforo_CPR IS NOT NULL,Gasto_Total,0)),0)*100,1) pct_gasto_rojo,
      ROUND(SUM(IF(Semaforo_CPR='Verde',Gasto_Total,0))/NULLIF(SUM(IF(Semaforo_CPR IS NOT NULL,Gasto_Total,0)),0)*100,1) pct_gasto_verde
      FROM \`${p}.automatizado.eficacia_anuncios\` GROUP BY Cliente HAVING semaforo > 200 ORDER BY semaforo DESC`;
    const r = await bq.jobs.query({ projectId: 'prsm-bq-media', requestBody: { query: q, useLegacySql: false, location: loc } });
    console.log(`\n${p}`);
    console.log(r.data.schema.fields.map((f) => f.name).join(' | '));
    for (const row of r.data.rows || []) console.log(row.f.map((x) => x.v).join(' | '));
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
