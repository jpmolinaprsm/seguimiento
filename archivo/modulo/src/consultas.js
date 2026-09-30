// Consultas a BigQuery del módulo (todas de lectura). Cada función devuelve filas planas.
const fs = require('fs');
const path = require('path');
const bq = require('./bq');

const DATOS_ANALISIS = path.resolve(__dirname, '..', '..', '..', 'analisis-datajunta', 'data');
const DIAS_VENTANA = 14;   // una campaña entra al panel si gastó en los últimos 14 días o sigue vigente
const DIAS_SERIE = 35;

// Mismo filtro que el chequeo diario y que PAUTADOR: sin encuestas ni observatorios.
const FILTRO_ENCUESTAS = `
  NOT REGEXP_CONTAINS(IFNULL(Activo, ''), r'^Pulso (Dos|Argentina|Nacional)')
  AND NOT (Activo = 'Vibes Argentina' OR ENDS_WITH(UPPER(IFNULL(Codigo_Proyecto, '')), 'OBS')
           OR REGEXP_CONTAINS(LOWER(IFNULL(Proyecto, '')), r'observatorio|objservatorio|analytics|tracking'))`;

const OBJETIVO_SQL = `CASE Objetivo WHEN 'OUTCOME_TRAFFIC' THEN 'Tráfico' WHEN 'OUTCOME_ENGAGEMENT' THEN 'Interacción'
  WHEN 'OUTCOME_AWARENESS' THEN 'Alcance' ELSE IFNULL(Objetivo, 'sin_dato') END`;
const COM_SQL = `IFNULL(NULLIF(TRIM(REGEXP_REPLACE(Comunicacion, r'\\s*[“"].*$', '')), ''), '(sin comunicación)')`;

function filtroProyecto(cfg) {
  const partes = [
    cfg.codigos && cfg.codigos.length ? `Codigo_Proyecto IN (${bq.lista(cfg.codigos)})` : null,
    cfg.nombres && cfg.nombres.length ? `Proyecto IN (${bq.lista(cfg.nombres)})` : null,
  ].filter(Boolean);
  return partes.length ? `(${partes.join(' OR ')})` : '(FALSE)';
}

// Columnas de la copia de 90 días por canal (DataJunta cambia: el 25/09 Informativo perdió Presupuesto_Asignado).
const columnasCache = new Map();
async function columnas(canal) {
  if (columnasCache.has(canal)) return columnasCache.get(canal);
  const [proyecto, dataset, tabla] = bq.tabla90d(canal).split('.');
  const filas = await bq.query(`SELECT column_name FROM \`${proyecto}.${dataset}.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = '${tabla}'`);
  const set = new Set(filas.map((f) => f.column_name));
  columnasCache.set(canal, set);
  return set;
}

// 1) Conjuntos vivos o recientes: comunicación × contenido × conjunto.
async function conjuntos(canal, cfg) {
  const cols = await columnas(canal);
  const presuConjunto = cols.has('Presupuesto_Asignado') ? 'MAX(SAFE_CAST(Presupuesto_Asignado AS FLOAT64))' : 'CAST(NULL AS FLOAT64)';
  const sql = `
    DECLARE hoy DATE DEFAULT CURRENT_DATE('America/Argentina/Buenos_Aires');
    WITH base AS (
      SELECT * FROM \`${bq.tabla90d(canal)}\`
      WHERE ${filtroProyecto(cfg)} AND ${FILTRO_ENCUESTAS} AND Conjunto_de_Anuncios IS NOT NULL
    )
    SELECT
      ${COM_SQL} AS comunic,
      IFNULL(Codigo_Contenido, '') AS codigo_cont,
      Conjunto_de_Anuncios AS conjunto,
      ANY_VALUE(Proyecto) AS proyecto_bq, ANY_VALUE(Contenido) AS contenido_n, ANY_VALUE(Campana) AS campana_meta,
      ANY_VALUE(${OBJETIVO_SQL}) AS objetivo_n, ANY_VALUE(Formato) AS formato_raw, ANY_VALUE(Eje) AS eje_n,
      ANY_VALUE(Audiencia) AS audiencia_n, ANY_VALUE(Tipo) AS tipo_n, ANY_VALUE(Placement) AS placement_n, ANY_VALUE(Red) AS red_n,
      ANY_VALUE(Activo) AS activo_n,
      MIN(DATE(Inicio)) AS inicio_d, MAX(DATE(Fin)) AS fin_d,
      ${presuConjunto} AS presupuesto_n,
      SUM(IFNULL(Gasto, 0)) AS gastado,
      SUM(IFNULL(Impresiones, 0)) AS impresiones_tot, SUM(IFNULL(Reacciones, 0)) AS reacciones_tot, SUM(IFNULL(Clicks, 0)) AS clicks_tot,
      MIN(IF(Gasto > 0, Fecha, NULL)) AS primer_dia, MAX(IF(Gasto > 0, Fecha, NULL)) AS ultimo_dia,
      COUNT(DISTINCT IF(Gasto > 0, Fecha, NULL)) AS dias_activos,
      SUM(IF(Fecha >= DATE_SUB(hoy, INTERVAL 2 DAY), IFNULL(Gasto, 0), 0)) AS gasto_2d,
      SUM(IF(Fecha >= DATE_SUB(hoy, INTERVAL 7 DAY), IFNULL(Gasto, 0), 0)) AS gasto_7d,
      SUM(IF(Fecha >= DATE_SUB(hoy, INTERVAL 7 DAY), IFNULL(Impresiones, 0), 0)) AS impresiones_7d,
      SUM(IF(Fecha >= DATE_SUB(hoy, INTERVAL 7 DAY), IFNULL(Clicks, 0), 0)) AS clicks_7d,
      SUM(IF(Fecha >= DATE_SUB(hoy, INTERVAL 7 DAY), IFNULL(Reacciones, 0), 0)) AS reacciones_7d
    FROM base
    GROUP BY comunic, codigo_cont, conjunto
    HAVING ultimo_dia >= DATE_SUB(hoy, INTERVAL ${DIAS_VENTANA} DAY) OR (fin_d >= hoy AND presupuesto_n > 0)
  `;
  return bq.query(sql);
}

// 2) Serie diaria: comunicación × contenido × día (últimos 35 días).
async function serie(canal, cfg) {
  const sql = `
    DECLARE hoy DATE DEFAULT CURRENT_DATE('America/Argentina/Buenos_Aires');
    SELECT ${COM_SQL} AS comunic, IFNULL(Codigo_Contenido, '') AS codigo_cont, CAST(Fecha AS STRING) AS fecha,
      SUM(IFNULL(Gasto, 0)) AS gasto, SUM(IFNULL(Impresiones, 0)) AS impresiones,
      SUM(IFNULL(Reacciones, 0)) AS reacciones, SUM(IFNULL(Clicks, 0)) AS clicks
    FROM \`${bq.tabla90d(canal)}\`
    WHERE ${filtroProyecto(cfg)} AND ${FILTRO_ENCUESTAS} AND Fecha >= DATE_SUB(hoy, INTERVAL ${DIAS_SERIE} DAY)
    GROUP BY 1, 2, 3
  `;
  return bq.query(sql);
}

// 3) Alertas del día contra el benchmark (nivel anuncio; se agregan por conjunto en el motor).
async function alertas(canal, cfg) {
  if (!cfg.nombres || !cfg.nombres.length) return [];
  const sql = `
    SELECT conjunto_de_anuncios AS conjunto, ${COM_SQL.replace(/Comunicacion/g, 'comunicacion')} AS comunic,
      codigo_contenido, objetivo, formato_g, aud_geo, aud_seg,
      x_mediana_cpm, x_mediana_reacciones, benchmark_muestra, benchmark_nivel, cpm_7d, reacciones_por_mil_7d, gasto_7d, alertas,
      CAST(calculado_en AS STRING) AS calculado_en
    FROM \`${bq.tablaAlertas(canal)}\`
    WHERE proyecto IN (${bq.lista(cfg.nombres)})
  `;
  return bq.query(sql);
}

// 4) El mes en curso por proyecto (y por canal, porque cada canal tiene su tabla): presupuesto mensual vigente
// (el del último día con dato del mes: puede cambiar a mitad de mes), el del primer día, gasto e impresiones del mes,
// gasto de los últimos 7 días con datos y último día con datos.
async function mes(canal, cfg) {
  const PM = `SAFE_CAST(NULLIF(REGEXP_REPLACE(IFNULL(PresupuestoMensual, ''), r'[^0-9.]', ''), '') AS FLOAT64)`;
  const sql = `
    DECLARE hoy DATE DEFAULT CURRENT_DATE('America/Argentina/Buenos_Aires');
    DECLARE ini DATE DEFAULT DATE_TRUNC(hoy, MONTH);
    WITH base AS (
      SELECT * FROM \`${bq.tabla90d(canal)}\`
      WHERE ${filtroProyecto(cfg)} AND ${FILTRO_ENCUESTAS} AND Fecha >= DATE_SUB(ini, INTERVAL 7 DAY)
    ),
    ult AS (SELECT MAX(Fecha) AS f FROM base)
    SELECT Proyecto AS proyecto_bq,
      ARRAY_AGG(IF(Fecha >= ini, ${PM}, NULL) IGNORE NULLS ORDER BY Fecha DESC LIMIT 1)[SAFE_OFFSET(0)] AS presupuesto_mensual,
      ARRAY_AGG(IF(Fecha >= ini, ${PM}, NULL) IGNORE NULLS ORDER BY Fecha ASC LIMIT 1)[SAFE_OFFSET(0)] AS presupuesto_inicio_mes,
      SUM(IF(Fecha >= ini, IFNULL(Gasto, 0), 0)) AS gasto_mes,
      SUM(IF(Fecha >= ini, IFNULL(Impresiones, 0), 0)) AS impresiones_mes,
      SUM(IF(Fecha > DATE_SUB((SELECT f FROM ult), INTERVAL 7 DAY), IFNULL(Gasto, 0), 0)) AS gasto_7d,
      CAST(MAX(Fecha) AS STRING) AS datos_hasta,
      COUNT(DISTINCT IF(Fecha > DATE_SUB((SELECT f FROM ult), INTERVAL 2 DAY) AND Gasto > 0, Conjunto_de_Anuncios, NULL)) AS conjuntos_vivos
    FROM base
    GROUP BY 1
    HAVING gasto_mes > 0 OR presupuesto_mensual IS NOT NULL
  `;
  return bq.query(sql);
}

// 5) Perfil del proyecto (tablas perfil_* de la investigación): sesgo histórico y audiencias etiquetadas.
async function perfil(cfg) {
  if (!cfg.nombres || !cfg.nombres.length) return { sesgo: [], audiencias: [] };
  const sesgo = await bq.query(`
    SELECT Proyecto AS proyecto_bq, canal,
      COUNT(*) AS campanas,
      APPROX_QUANTILES(costo_resultado_pct, 100)[OFFSET(50)] AS pct_mediano,
      AVG(IF(tamano = 'chica', 1, NULL)) AS _x
    FROM \`${bq.tablaPerfil('perfil_campana')}\`
    WHERE Proyecto IN (${bq.lista(cfg.nombres)}) AND cerrada AND costo_resultado_pct IS NOT NULL
      AND mes_inicio >= FORMAT_DATE('%Y-%m', DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH))
    GROUP BY 1, 2
  `);
  const audiencias = await bq.query(`
    SELECT Proyecto AS proyecto_bq, canal, eje, audiencia, aud_geo, aud_seg, campanas, cpr_ratio, cpm_ratio, etiqueta
    FROM \`${bq.tablaPerfil('perfil_audiencia')}\`
    WHERE Proyecto IN (${bq.lista(cfg.nombres)}) AND campanas >= 3
  `);
  return { sesgo, audiencias };
}

function leerJson(nombre) {
  try { return JSON.parse(fs.readFileSync(path.join(DATOS_ANALISIS, nombre), 'utf8')); } catch (e) { return null; }
}

// 6) Benchmark semanal (mediana de conjuntos comparables): niveles 4 (objetivo+formato+geo+seg), 2 (objetivo+formato) y 1 (objetivo).
async function benchmark(canal) {
  const sql = `
    SELECT nivel, objetivo, formato_g, aud_geo, aud_seg, n_ads_ok, cpm_p50, rea_p50, cpc_p50, CAST(semana_hasta AS STRING) AS semana_hasta
    FROM \`${bq.tabla90d(canal).replace(/\.[^.]+$/, '.benchmark_meta')}\`
    WHERE nivel IN (1, 2, 4) AND n_ads_ok > 0
  `;
  return bq.query(sql);
}

module.exports = { conjuntos, serie, alertas, mes, perfil, benchmark, leerJson, olvidarColumnas: () => columnasCache.clear() };
