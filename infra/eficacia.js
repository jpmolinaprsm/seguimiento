// Tabla de EFICACIA (semáforo de costo por reacción) compartida por Looker y Seguimiento y Optimización.
// Versión ajustada (opción "b", decidida por el usuario 2026-09-29) de las vistas VistasTableros / VistaTableros:
//   - misma unidad (anuncio × placement), mismo universo del semáforo (META sin Stories / Audience Network / Rewarded Video / Status, con reacciones)
//     y mismos cortes (Verde ≤ P25 · Amarillo P25–P75 · Rojo > P75 del costo por reacción, por Objetivo × Placement dentro del cliente);
//   - ventana móvil de 365 días en lugar de "año 2026";
//   - cada anuncio se compara contra los anuncios de SU MISMA ÉPOCA (los que terminaron en los 3 meses que cierran en su último mes activo),
//     así la inflación de costos no pinta de rojo lo reciente;
//   - mínimo 12 anuncios en la referencia del cliente; si no llega, referencia de todos los gobiernos del canal (Nivel_Referencia = 'General');
//   - Gasto_Total por anuncio para poder calcular "% del gasto en rojo" (además del % de anuncios).
// Se escribe en <proyecto>.automatizado.eficacia_anuncios (Oficial en prsm-bq-media, Informativo en bq-project-450514).
// Uso: node eficacia.js            → dry run + crea/actualiza las dos tablas
//      node eficacia.js --programar → además crea la consulta programada diaria (12:20 UTC, después del refresco de 180 días)
const path = require('path');
const { google } = require(path.join(__dirname, '..', '..', 'pautador', 'node_modules', 'googleapis'));
const CLAVE = path.resolve(__dirname, '..', '..', 'GCP', 'prsm-bq-media-6a154f90fdb5.json');

const CANALES = [
  { nombre: 'Oficial', loc: 'us-central1', origen: 'prsm-bq-media.prsm_media_tableros.DataJunta', dest: 'prsm-bq-media.automatizado.eficacia_anuncios' },
  { nombre: 'Informativo', loc: 'us', origen: 'bq-project-450514.informativo.DataJunta', dest: 'bq-project-450514.automatizado.eficacia_anuncios' },
];
const MIN_N = 12;
// referencia General: sin cuentas de campaña electoral ni internas (mismo criterio que la investigación de perfiles)
const NO_GENERAL = ['Nuevos Aires', 'Campaña Santa Fe 2025', 'Graciela Ocaña', 'Fuerza Patria Catamarca', 'Campaña Río Grande 2025', 'Campaña Chubut 2025',
  'Provincias Unidas', 'Campaña Chaco 2025', 'Guillermo Michel', 'Prosumia', 'Intelia', 'Chaco Zdero', 'Santa Fe Pullaro'];
const lista = (xs) => xs.map((x) => `'${x.replace(/'/g, "\\'")}'`).join(', ');

const sql = (c) => `CREATE OR REPLACE TABLE \`${c.dest}\`
CLUSTER BY Cliente, Objetivo, Placement
OPTIONS (description = 'Eficacia por anuncio x placement (semaforo de costo por reaccion: Verde <= P25, Amarillo P25-P75, Rojo > P75 por Objetivo x Placement dentro del cliente; referencia = anuncios de la misma epoca, 3 meses; minimo ${MIN_N}, si no referencia General del canal). Ventana movil 365 dias. Se regenera todos los dias. Compartida por Looker y Seguimiento y Optimizacion.')
AS
WITH base AS (
  SELECT
    IFNULL(Cliente, '(sin cliente)') AS Cliente, ID_del_Anuncio, Plataforma, Placement,
    MAX(Proyecto) AS Proyecto, MAX(Campana) AS Campana, MAX(Anuncio) AS Nombre_Anuncio,
    CASE MAX(Objetivo) WHEN 'OUTCOME_TRAFFIC' THEN 'Tráfico' WHEN 'OUTCOME_ENGAGEMENT' THEN 'Interacción' WHEN 'OUTCOME_AWARENESS' THEN 'Alcance' ELSE MAX(Objetivo) END AS Objetivo,
    MAX(Red) AS Red,
    IF(LOWER(IFNULL(Placement, '')) LIKE '%reels%' OR COALESCE(SUM(Views), 0) > 0, 'Video', 'Imagen') AS Formato,
    MAX(Eje) AS Eje, MAX(Comunicacion) AS Comunicacion, MAX(Gobernador) AS Gobernador, NULLIF(TRIM(MAX(Audiencia)), '') AS Audiencia,
    MAX(Contenido) AS Contenido, MAX(Codigo_Contenido) AS Codigo_Contenido, MAX(Activo) AS Activo, MAX(Tipo) AS Tipo, MAX(Link) AS Link,
    MIN(IF(Gasto > 0, Fecha, NULL)) AS Desde, MAX(IF(Gasto > 0, Fecha, NULL)) AS Hasta,
    SUM(Gasto) AS Gasto_Total, SUM(Reacciones) AS Reacciones_Total, SUM(Impresiones) AS Impresiones_Total,
    COALESCE(SUM(Clicks), 0) AS Clicks_Total, COALESCE(SUM(Views), 0) AS Views_Total, COALESCE(SUM(Engagement), 0) AS Engagement_Total,
    COALESCE(SUM(View_25), 0) AS View25_Total, COALESCE(SUM(View_50), 0) AS View50_Total, COALESCE(SUM(View_75), 0) AS View75_Total, COALESCE(SUM(View_100), 0) AS View100_Total,
    COALESCE(SUM(Compartidas), 0) AS Compartidas_Total, COALESCE(SUM(Comentarios), 0) AS Comentarios_Total,
    IFNULL(Plataforma = 'META' AND LOWER(IFNULL(Placement, '')) NOT LIKE '%stories%'
      AND IFNULL(Placement, '') NOT IN ('Meta Audience Network', 'Rewarded Video', 'Status') AND IFNULL(SUM(Reacciones), 0) > 0, FALSE) AS Es_Semaforo
  FROM \`${c.origen}\`
  WHERE Fecha >= DATE_SUB(CURRENT_DATE('America/Argentina/Buenos_Aires'), INTERVAL 365 DAY)
    AND ID_del_Anuncio IS NOT NULL
    AND NOT REGEXP_CONTAINS(UPPER(COALESCE(Campana, '')), 'PULSO')
    AND NOT REGEXP_CONTAINS(IFNULL(Activo, ''), r'^Pulso (Dos|Argentina|Nacional)')
  GROUP BY Cliente, ID_del_Anuncio, Plataforma, Placement
  HAVING SUM(Gasto) > 0
),
ads AS (
  SELECT *, IF(Es_Semaforo, SAFE_DIVIDE(Gasto_Total, Reacciones_Total), NULL) AS CPR, DATE_TRUNC(Hasta, MONTH) AS Mes_Ref FROM base
),
meses AS (SELECT DISTINCT Mes_Ref AS Mes FROM ads),
ref_cliente AS (
  SELECT m.Mes, a.Cliente, a.Objetivo, a.Placement, COUNT(*) AS n,
    APPROX_QUANTILES(a.CPR, 100)[OFFSET(25)] AS p25, APPROX_QUANTILES(a.CPR, 100)[OFFSET(75)] AS p75
  FROM meses m JOIN ads a ON a.Mes_Ref BETWEEN DATE_SUB(m.Mes, INTERVAL 2 MONTH) AND m.Mes
  WHERE a.Es_Semaforo
  GROUP BY 1, 2, 3, 4
),
ref_general AS (
  SELECT m.Mes, a.Objetivo, a.Placement, COUNT(*) AS n,
    APPROX_QUANTILES(a.CPR, 100)[OFFSET(25)] AS p25, APPROX_QUANTILES(a.CPR, 100)[OFFSET(75)] AS p75
  FROM meses m JOIN ads a ON a.Mes_Ref BETWEEN DATE_SUB(m.Mes, INTERVAL 2 MONTH) AND m.Mes
  WHERE a.Es_Semaforo AND a.Cliente NOT IN (${lista(NO_GENERAL)})
  GROUP BY 1, 2, 3
),
clasificados AS (
  SELECT a.*,
    CASE WHEN NOT a.Es_Semaforo THEN NULL WHEN rc.n >= ${MIN_N} THEN 'Proyecto' WHEN rg.n >= ${MIN_N} THEN 'General' END AS Nivel_Referencia,
    CASE WHEN NOT a.Es_Semaforo THEN NULL WHEN rc.n >= ${MIN_N} THEN rc.n WHEN rg.n >= ${MIN_N} THEN rg.n END AS N_Referencia,
    CASE WHEN NOT a.Es_Semaforo THEN NULL WHEN rc.n >= ${MIN_N} THEN rc.p25 WHEN rg.n >= ${MIN_N} THEN rg.p25 END AS P25_CPR,
    CASE WHEN NOT a.Es_Semaforo THEN NULL WHEN rc.n >= ${MIN_N} THEN rc.p75 WHEN rg.n >= ${MIN_N} THEN rg.p75 END AS P75_CPR
  FROM ads a
  LEFT JOIN ref_cliente rc ON rc.Mes = a.Mes_Ref AND rc.Cliente = a.Cliente AND COALESCE(rc.Objetivo, '∅') = COALESCE(a.Objetivo, '∅') AND COALESCE(rc.Placement, '∅') = COALESCE(a.Placement, '∅')
  LEFT JOIN ref_general rg ON rg.Mes = a.Mes_Ref AND COALESCE(rg.Objetivo, '∅') = COALESCE(a.Objetivo, '∅') AND COALESCE(rg.Placement, '∅') = COALESCE(a.Placement, '∅')
)
SELECT *,
  CASE WHEN P25_CPR IS NULL OR CPR IS NULL THEN NULL WHEN CPR <= P25_CPR THEN 'Verde' WHEN CPR <= P75_CPR THEN 'Amarillo' ELSE 'Rojo' END AS Semaforo_CPR,
  CASE WHEN P25_CPR IS NULL OR CPR IS NULL THEN NULL WHEN P75_CPR = P25_CPR THEN 0.5
    ELSE GREATEST(0, LEAST(1, 0.25 + 0.5 * SAFE_DIVIDE(CPR - P25_CPR, P75_CPR - P25_CPR))) END AS Indice_CPR,
  CASE WHEN NOT Es_Semaforo THEN NULL
    WHEN Impresiones_Total <= PERCENTILE_CONT(IF(Es_Semaforo, Impresiones_Total, NULL), 0.25) OVER (PARTITION BY Cliente) THEN 'Q1 — Bajo'
    WHEN Impresiones_Total <= PERCENTILE_CONT(IF(Es_Semaforo, Impresiones_Total, NULL), 0.50) OVER (PARTITION BY Cliente) THEN 'Q2 — Medio-Bajo'
    WHEN Impresiones_Total <= PERCENTILE_CONT(IF(Es_Semaforo, Impresiones_Total, NULL), 0.75) OVER (PARTITION BY Cliente) THEN 'Q3 — Medio-Alto'
    ELSE 'Q4 — Alto' END AS Banda_Impresiones,
  IF(P25_CPR IS NOT NULL AND CPR IS NOT NULL, CONCAT(ID_del_Anuncio, '_', IFNULL(Placement, '')), NULL) AS ID_Placement,
  CURRENT_DATE('America/Argentina/Buenos_Aires') AS Fecha_Calculo
FROM clasificados`;

(async () => {
  const auth = new google.auth.GoogleAuth({ keyFile: CLAVE, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const cli = await auth.getClient();
  const bq = google.bigquery({ version: 'v2', auth: cli });
  const dt = google.bigquerydatatransfer({ version: 'v1', auth: cli });
  for (const c of CANALES) {
    const q = sql(c);
    const dry = await bq.jobs.query({ projectId: 'prsm-bq-media', requestBody: { query: q, useLegacySql: false, dryRun: true, location: c.loc } });
    const gb = Number(dry.data.totalBytesProcessed) / 1e9;
    console.log(`${c.nombre}: dry run ${gb.toFixed(2)} GB`);
    if (gb > 6) throw new Error('Más de 6 GB: no se corre sin avisar');
    const job = await bq.jobs.insert({ projectId: 'prsm-bq-media', requestBody: { configuration: { query: { query: q, useLegacySql: false } }, jobReference: { location: c.loc } } });
    const id = job.data.jobReference.jobId;
    for (;;) {
      const st = await bq.jobs.get({ projectId: 'prsm-bq-media', jobId: id, location: c.loc });
      if (st.data.status.state === 'DONE') {
        if (st.data.status.errorResult) throw new Error(`${c.nombre}: ${st.data.status.errorResult.message}`);
        console.log(`   tabla ${c.dest} lista (${(Number(st.data.statistics.totalBytesBilled || 0) / 1e9).toFixed(2)} GB facturados)`);
        break;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    if (process.argv.includes('--programar')) {
      const parent = `projects/prsm-bq-media/locations/${c.loc}`;
      const display = `Eficacia de anuncios (${c.nombre})`;
      const existentes = (await dt.projects.locations.transferConfigs.list({ parent, dataSourceIds: ['scheduled_query'] })).data.transferConfigs || [];
      const ya = existentes.find((x) => x.displayName === display);
      if (ya) {
        await dt.projects.locations.transferConfigs.patch({ name: ya.name, updateMask: 'params,schedule', requestBody: { params: { query: q }, schedule: 'every day 12:20' } });
        console.log('   consulta programada actualizada:', ya.name);
      } else {
        const cfg = (await dt.projects.locations.transferConfigs.create({ parent, requestBody: { displayName: display, dataSourceId: 'scheduled_query', schedule: 'every day 12:20', params: { query: q } } })).data;
        console.log('   consulta programada creada:', cfg.name, '|', cfg.schedule);
      }
    }
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
