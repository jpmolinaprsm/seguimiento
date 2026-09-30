// Extrae de BigQuery (solo lectura, Meta) los datos del borrador. Córdoba entra en los dos canales (desde el 30/09/2026; antes solo Informativo).
//   cruce   → copia diaria de 180 días (automatizado.datajunta_meta_180d): canal × cliente × mes × activo × comunicación × contenido × audiencia × placement
//   diaria  → idem, canal × cliente × activo × comunicación × día
//   eficacia → automatizado.eficacia_anuncios (semáforo de costo por reacción compartido con Looker): anuncio × placement con gasto en 180 días
//   plataformas → DataJunta completa desde 01/06/2026, TODAS las plataformas: canal × cliente × proyecto × plataforma × red × objetivo × activo × día
//                 (picos y apagones, costo por objetivo, impacto comparado, consumo proyectado)
//   presupuesto → PresupuestoMensual vigente de cada proyecto en el mes del último día completo (el último cargado; ver mesPresupuesto)
//   conjuntos → Meta 180 d: canal × cliente × comunicación × contenido × conjunto de anuncios × mes (la unidad sobre la que se actúa);
//               `ads` = ids de anuncio de Meta del conjunto en ese mes, separados por coma (para las solicitudes del Nexo)
//               `conjuntoId` = id del conjunto en Meta (ID_Conjunto); si el mismo nombre tuvo más de un id en el mes, van todos separados por coma
//   todas → DataJunta completa 180 d, TODAS las plataformas, por día: canal × cliente × comunicación × contenido × plataforma × red × objetivo
//   audDia → Meta 180 d por día: canal × cliente × comunicación × audiencia (períodos de 7/30/90 días en Audiencias)
//   alcance → alcance por día de Meta (FBADS_TABLERO_META, cruza con DataJunta por ID_del_Anuncio + fecha) y TikTok (TIK_TABLERO_TIK_TOK):
//             canal × cliente × comunicación × contenido × plataforma × día. Es alcance DIARIO (una persona cuenta cada día que la alcanzan).
//   alcanceMeta / alcanceCorridas → lectura diaria de alcance de Meta de PAUTADOR (automatizado.meta_alcance_diario / _corridas),
//             solo fecha_lectura = hoy en Argentina; si la tabla no existe, lista vacía y alcanceEstado.disponible = false
//   semanal → DataJunta completa, desde 01/2024 (para detectar temporadas hace falta ver 2+ años): canal × cliente × comunicación × semana × objetivo × formato (luz "Propia" y estacionales)
// Métricas: gasto, impresiones, reacciones, clicks, engagement, comentarios, compartidas, reproducciones y retención (25/50/75/100 %).
// Guarda _proyectos.json. Uso: node _extraer.js
const fs = require('fs');
const path = require('path');
const bq = require('../datos/bq');

const DESDE_SEMANAL = '2024-01-01';
// Mes del presupuesto (30/09/2026): el del último día completo de DataJunta (carga a las 8:00 con el día anterior), en hora de
// Argentina (UTC-3, sin horario de verano), con tope al fin de ese mes. El 1/10 todavía es septiembre; el 2/10 ya es octubre.
// Mismo criterio que presupuestos/pedidos.js (mesDeAyer) y que el mes en curso de la app.
function mesPresupuesto(ahora = Date.now()) {
  const ayer = new Date(ahora - 3 * 3600000 - 86400000);
  const y = ayer.getUTCFullYear(), m = ayer.getUTCMonth();
  const iso = (d) => d.toISOString().slice(0, 10);
  return { desde: iso(new Date(Date.UTC(y, m, 1))), hasta: iso(new Date(Date.UTC(y, m + 1, 0))) };
}
// Hoy en Argentina (UTC-3, sin horario de verano), como 'AAAA-MM-DD'. Es la partición `fecha_lectura` de la lectura de alcance.
function hoyAR(ahora = Date.now()) {
  return new Date(ahora - 3 * 3600000).toISOString().slice(0, 10);
}
// Lectura diaria de alcance de Meta que deja PAUTADOR (contrato orquestacion/CONTRATOS/lectura-alcance-meta.md, 30/09/2026).
// Informativo en bq-project-450514; Oficial y "Ambos" en prsm-bq-media (cada fila trae su `canal`). Se prende el 14/10/2026:
// hasta entonces las tablas no existen y la extracción sigue igual, con lista vacía y la marca `disponible: false`.
const TALC = { Oficial: 'prsm-bq-media.automatizado', Informativo: 'bq-project-450514.automatizado' };
const sqlAlcanceMeta = (c, fecha) => `SELECT * FROM \`${TALC[c]}.meta_alcance_diario\` WHERE fecha_lectura = DATE '${fecha}'`;
const sqlAlcanceCorridas = (c, fecha) => `SELECT * FROM \`${TALC[c]}.meta_alcance_corridas\` WHERE fecha_lectura = DATE '${fecha}'`;
// Corre una consulta que puede no tener tabla todavía: nunca corta la extracción. Devuelve { filas, estado }.
async function leerOpcional(consultar, sql) {
  try {
    const filas = await consultar(sql);
    return { filas, estado: { disponible: true, filas: filas.length } };
  } catch (e) {
    const msg = String((e && e.message) || e);
    const motivo = /not found/i.test(msg) ? 'tabla inexistente' : 'error de consulta';
    return { filas: [], estado: { disponible: false, motivo, detalle: msg.slice(0, 200) } };
  }
}
const T180 = { Oficial: 'prsm-bq-media.automatizado.datajunta_meta_180d', Informativo: 'bq-project-450514.automatizado.datajunta_meta_180d' };
const TEFI = { Oficial: 'prsm-bq-media.automatizado.eficacia_anuncios', Informativo: 'bq-project-450514.automatizado.eficacia_anuncios' };
const TFULL = { Oficial: 'prsm-bq-media.prsm_media_tableros.DataJunta', Informativo: 'bq-project-450514.informativo.DataJunta' };
const CLIENTES = ['Gobierno de Santa Fe', 'Gobierno del Chaco', 'Gobierno del Chubut', 'Gobierno de Corrientes', 'Catamarca Provincia', 'Catamarca Ciudad', 'Gobierno de Córdoba'];
const filtro = (c) => `Plataforma = 'META'
  AND Cliente IN (${bq.lista(CLIENTES)})
  AND NOT REGEXP_CONTAINS(IFNULL(Activo, ''), r'^Pulso (Dos|Argentina|Nacional)')`;
const COM = `IFNULL(NULLIF(TRIM(REGEXP_REPLACE(Comunicacion, r'\\s*[“"].*$', '')), ''), '(sin comunicación)')`;
const MET = `SUM(IFNULL(Gasto,0)) AS gasto, SUM(IFNULL(Impresiones,0)) AS imp, SUM(IFNULL(Reacciones,0)) AS rea, SUM(IFNULL(Clicks,0)) AS clk,
  SUM(IFNULL(Engagement,0)) AS eng, SUM(IFNULL(Comentarios,0)) AS com, SUM(IFNULL(Compartidas,0)) AS sha,
  SUM(IFNULL(Views,0)) AS vw, SUM(IFNULL(View_25,0)) AS v25, SUM(IFNULL(View_50,0)) AS v50, SUM(IFNULL(View_75,0)) AS v75, SUM(IFNULL(View_100,0)) AS v100`;
// Formato en SQL (mismo criterio que normalizar_formato: primero la columna Formato, después el nombre del contenido)
const FMT = `CASE
  WHEN REGEXP_CONTAINS(LOWER(IFNULL(Formato,'')), r'video|vídeo|spot|reel') THEN 'Video'
  WHEN REGEXP_CONTAINS(LOWER(IFNULL(Formato,'')), r'carrusel|carousel') THEN 'Carrusel'
  WHEN REGEXP_CONTAINS(LOWER(IFNULL(Formato,'')), r'placa|imagen|flyer|banner|foto') THEN 'Placa Fija'
  WHEN REGEXP_CONTAINS(LOWER(IFNULL(Contenido,'')), r'\\((video|vídeo|reel|spot)') THEN 'Video'
  WHEN REGEXP_CONTAINS(LOWER(IFNULL(Contenido,'')), r'\\((carrusel|carousel)') THEN 'Carrusel'
  WHEN REGEXP_CONTAINS(LOWER(IFNULL(Contenido,'')), r'\\((placa|imagen|flyer)') THEN 'Placa Fija'
  ELSE '(otro)' END`;

const MES_PRESU = mesPresupuesto();
const HOY = hoyAR();

async function canal(c) {
  const cruce = await bq.query(`
    SELECT '${c}' AS canal, Cliente AS cliente, FORMAT_DATE('%Y-%m', Fecha) AS mes, Activo AS activo, ${COM} AS comunic,
      IFNULL(Codigo_Contenido,'') AS cod, ANY_VALUE(Contenido) AS contenido, ANY_VALUE(Formato) AS formato_raw,
      IFNULL(Audiencia,'(sin audiencia)') AS audiencia, IFNULL(Placement,'Sin dato') AS placement,
      ANY_VALUE(Objetivo) AS objetivo, ANY_VALUE(Eje) AS eje, ${MET},
      MIN(IF(Gasto>0,Fecha,NULL)) AS desde, MAX(IF(Gasto>0,Fecha,NULL)) AS hasta, CAST(MAX(DATE(Fin)) AS STRING) AS fin,
      MAX(Link_FB) AS link_fb, MAX(Link_IG) AS link_ig, MAX(Link) AS link
    FROM \`${T180[c]}\` WHERE ${filtro(c)}
    GROUP BY cliente, mes, activo, comunic, cod, audiencia, placement HAVING gasto > 0`);
  const diaria = await bq.query(`
    SELECT '${c}' AS canal, Cliente AS cliente, Activo AS activo, ${COM} AS comunic, CAST(Fecha AS STRING) AS fecha,
      SUM(IFNULL(Gasto,0)) AS gasto, SUM(IFNULL(Impresiones,0)) AS imp, SUM(IFNULL(Reacciones,0)) AS rea
    FROM \`${T180[c]}\` WHERE ${filtro(c)} GROUP BY cliente, activo, comunic, fecha HAVING gasto > 0`);
  const semanal = await bq.query(`
    SELECT '${c}' AS canal, Cliente AS cliente, ${COM} AS comunic, CAST(DATE_TRUNC(Fecha, WEEK(MONDAY)) AS STRING) AS semana,
      IFNULL(Objetivo,'(null)') AS objetivo, ${FMT} AS fmt, ${MET}, COUNT(DISTINCT IF(Gasto > 0, Fecha, NULL)) AS dias
    FROM \`${TFULL[c]}\` WHERE ${filtro(c)} AND Fecha >= '${DESDE_SEMANAL}'
    GROUP BY cliente, comunic, semana, objetivo, fmt HAVING gasto > 0`);
  const eficacia = await bq.query(`
    SELECT '${c}' AS canal, Cliente AS cliente, ${COM} AS comunic, IFNULL(Codigo_Contenido, '') AS cod, Contenido AS contenido,
      IFNULL(Audiencia, '(sin audiencia)') AS audiencia, Eje AS eje, Formato AS formato, Placement AS placement, Activo AS activo,
      Semaforo_CPR AS sem, Nivel_Referencia AS nivel, Banda_Impresiones AS banda, Gasto_Total AS gasto, Reacciones_Total AS rea,
      CAST(Hasta AS STRING) AS hasta, Link AS link
    FROM \`${TEFI[c]}\`
    WHERE Cliente IN (${bq.lista(CLIENTES)})
      AND Semaforo_CPR IS NOT NULL AND Hasta >= DATE_SUB(CURRENT_DATE('America/Argentina/Buenos_Aires'), INTERVAL 180 DAY)`);
  const plataformas = await bq.query(`
    SELECT '${c}' AS canal, Cliente AS cliente, IFNULL(Proyecto, '(sin proyecto)') AS proyecto, Plataforma AS plataforma,
      IFNULL(Red, Plataforma) AS red, IFNULL(Objetivo, '(sin objetivo)') AS objetivo, IFNULL(Activo, '(sin activo)') AS activo, CAST(Fecha AS STRING) AS fecha,
      SUM(IFNULL(Gasto,0)) AS gasto, SUM(IFNULL(Impresiones,0)) AS imp, SUM(IFNULL(Reacciones,0)) AS rea, SUM(IFNULL(Clicks,0)) AS clk,
      SUM(IFNULL(Views,0)) AS vw, SUM(IFNULL(Engagement,0)) AS eng, SUM(IFNULL(View_100,0)) AS v100
    FROM \`${TFULL[c]}\`
    WHERE Cliente IN (${bq.lista(CLIENTES)})
      AND NOT REGEXP_CONTAINS(IFNULL(Activo, ''), r'^Pulso (Dos|Argentina|Nacional)') AND NOT REGEXP_CONTAINS(UPPER(IFNULL(Campana, '')), 'PULSO')
      AND Fecha >= '2026-06-01'
    GROUP BY cliente, proyecto, plataforma, red, objetivo, activo, fecha HAVING gasto > 0`);
  const presupuesto = await bq.query(`
    SELECT '${c}' AS canal, Cliente AS cliente, Proyecto AS proyecto,
      ARRAY_AGG(SAFE_CAST(PresupuestoMensual AS FLOAT64) IGNORE NULLS ORDER BY Fecha DESC LIMIT 1)[SAFE_OFFSET(0)] AS presu
    FROM \`${TFULL[c]}\`
    WHERE Cliente IN (${bq.lista(CLIENTES)})
      AND Fecha BETWEEN '${MES_PRESU.desde}' AND '${MES_PRESU.hasta}' AND PresupuestoMensual IS NOT NULL
    GROUP BY cliente, proyecto`);
  const conjuntos = await bq.query(`
    SELECT '${c}' AS canal, Cliente AS cliente, FORMAT_DATE('%Y-%m', Fecha) AS mes, ${COM} AS comunic, IFNULL(Codigo_Contenido,'') AS cod,
      Conjunto_de_Anuncios AS conjunto, ANY_VALUE(Contenido) AS contenido, ANY_VALUE(Objetivo) AS objetivo, ANY_VALUE(Audiencia) AS audiencia,
      ANY_VALUE(Placement) AS placement, ANY_VALUE(Activo) AS activo, SUM(IFNULL(Gasto,0)) AS gasto, SUM(IFNULL(Impresiones,0)) AS imp,
      SUM(IFNULL(Reacciones,0)) AS rea, SUM(IFNULL(Clicks,0)) AS clk, MIN(IF(Gasto>0,Fecha,NULL)) AS desde, MAX(IF(Gasto>0,Fecha,NULL)) AS hasta,
      SUM(IF(Fecha >= DATE_SUB(CURRENT_DATE('America/Argentina/Buenos_Aires'), INTERVAL 14 DAY), IFNULL(Gasto,0), 0)) AS g14,
      SUM(IF(Fecha >= DATE_SUB(CURRENT_DATE('America/Argentina/Buenos_Aires'), INTERVAL 14 DAY), IFNULL(Impresiones,0), 0)) AS i14,
      SUM(IF(Fecha >= DATE_SUB(CURRENT_DATE('America/Argentina/Buenos_Aires'), INTERVAL 14 DAY), IFNULL(Reacciones,0), 0)) AS r14,
      STRING_AGG(DISTINCT CAST(ID_del_Anuncio AS STRING), ',' ORDER BY CAST(ID_del_Anuncio AS STRING)) AS ads,
      STRING_AGG(DISTINCT CAST(ID_Conjunto AS STRING), ',' ORDER BY CAST(ID_Conjunto AS STRING)) AS conjuntoId
    FROM \`${T180[c]}\` WHERE ${filtro(c)} AND Conjunto_de_Anuncios IS NOT NULL
    GROUP BY cliente, mes, comunic, cod, conjunto HAVING gasto > 0`);
  const todas = await bq.query(`
    SELECT '${c}' AS canal, Cliente AS cliente, ${COM} AS comunic, IFNULL(Codigo_Contenido,'') AS cod, Plataforma AS plataforma, IFNULL(Red, Plataforma) AS red,
      IFNULL(Objetivo,'(sin objetivo)') AS objetivo, CAST(Fecha AS STRING) AS fecha, ANY_VALUE(Contenido) AS contenido, ANY_VALUE(Formato) AS formato_raw, ANY_VALUE(Eje) AS eje,
      ANY_VALUE(Link) AS link, ANY_VALUE(Link_Youtube) AS link_yt, ANY_VALUE(Activo) AS activo,
      SUM(IFNULL(Gasto,0)) AS gasto, SUM(IFNULL(Impresiones,0)) AS imp, SUM(IFNULL(Reacciones,0)) AS rea, SUM(IFNULL(Clicks,0)) AS clk,
      SUM(IFNULL(Views,0)) AS vw, SUM(IFNULL(View_25,0)) AS v25, SUM(IFNULL(View_100,0)) AS v100, SUM(IFNULL(Engagement,0)) AS eng,
      SUM(IFNULL(Compartidas,0)) AS sha, SUM(IFNULL(Comentarios,0)) AS com
    FROM \`${TFULL[c]}\`
    WHERE Cliente IN (${bq.lista(CLIENTES)})
      AND NOT REGEXP_CONTAINS(IFNULL(Activo, ''), r'^Pulso (Dos|Argentina|Nacional)') AND NOT REGEXP_CONTAINS(UPPER(IFNULL(Campana, '')), 'PULSO')
      AND Fecha >= DATE_SUB(CURRENT_DATE('America/Argentina/Buenos_Aires'), INTERVAL 180 DAY)
    GROUP BY cliente, comunic, cod, plataforma, red, objetivo, fecha HAVING gasto > 0`);
  const audDia = await bq.query(`
    SELECT '${c}' AS canal, Cliente AS cliente, ${COM} AS comunic, IFNULL(Audiencia,'(sin audiencia)') AS audiencia, CAST(Fecha AS STRING) AS fecha,
      SUM(IFNULL(Gasto,0)) AS gasto, SUM(IFNULL(Impresiones,0)) AS imp, SUM(IFNULL(Reacciones,0)) AS rea, SUM(IFNULL(Clicks,0)) AS clk
    FROM \`${T180[c]}\` WHERE ${filtro(c)} GROUP BY cliente, comunic, audiencia, fecha HAVING gasto > 0`);
  const proj = c === 'Informativo' ? 'bq-project-450514.informativo' : 'prsm-bq-media.prsm_media_tableros';
  const cteTikTok = c === 'Informativo' ? 'SELECT CAST(NULL AS STRING) AS ad, CAST(NULL AS DATE) AS fecha, CAST(NULL AS INT64) AS reach'
    : 'SELECT CAST(AD_ID AS STRING) AS ad, DATE AS fecha, SUM(REACH) AS reach FROM `' + proj + ".TIK_TABLERO_TIK_TOK` WHERE DATE >= DATE_SUB(CURRENT_DATE('America/Argentina/Buenos_Aires'), INTERVAL 180 DAY) GROUP BY ad, fecha";
  const alcance = await bq.query(`
    WITH dj AS (
      SELECT ID_del_Anuncio AS ad, Fecha, Cliente AS cliente, ${COM} AS comunic, IFNULL(Codigo_Contenido,'') AS cod, Plataforma AS plataforma
      FROM \`${TFULL[c]}\` WHERE ${filtro(c)} AND Plataforma IN ('META', 'TikTok Ads') AND ID_del_Anuncio IS NOT NULL
        AND Fecha >= DATE_SUB(CURRENT_DATE('America/Argentina/Buenos_Aires'), INTERVAL 180 DAY)
      GROUP BY ad, Fecha, cliente, comunic, cod, plataforma),
    m AS (SELECT AD_ID AS ad, DATE AS fecha, SUM(REACH) AS reach FROM \`${proj}.FBADS_TABLERO_META\`
          WHERE DATE >= DATE_SUB(CURRENT_DATE('America/Argentina/Buenos_Aires'), INTERVAL 180 DAY) GROUP BY ad, fecha),
    t AS (${cteTikTok})
    SELECT '${c}' AS canal, dj.cliente, dj.comunic, dj.cod, dj.plataforma, CAST(dj.Fecha AS STRING) AS fecha, SUM(IFNULL(m.reach, t.reach)) AS reach
    FROM dj LEFT JOIN m ON m.ad = dj.ad AND m.fecha = dj.Fecha LEFT JOIN t ON t.ad = dj.ad AND t.fecha = dj.Fecha
    GROUP BY canal, cliente, comunic, cod, plataforma, fecha HAVING reach > 0`).catch((e) => { console.error(c, 'alcance:', e.message.slice(0, 200)); return []; });
  const aMeta = await leerOpcional(bq.query, sqlAlcanceMeta(c, HOY));
  const aCorr = await leerOpcional(bq.query, sqlAlcanceCorridas(c, HOY));
  if (!aMeta.estado.disponible) console.error(c, 'alcanceMeta no disponible:', aMeta.estado.motivo);
  if (!aCorr.estado.disponible) console.error(c, 'alcanceCorridas no disponible:', aCorr.estado.motivo);
  return { cruce, diaria, semanal, eficacia, plataformas, presupuesto, conjuntos, todas, audDia, alcance,
    alcanceMeta: aMeta.filas, alcanceCorridas: aCorr.filas, alcanceEstado: { alcanceMeta: aMeta.estado, alcanceCorridas: aCorr.estado } };
}

if (require.main !== module) { module.exports = { hoyAR, leerOpcional, sqlAlcanceMeta, sqlAlcanceCorridas, TALC }; return; }

(async () => {
  const of = await canal('Oficial');
  const inf = await canal('Informativo');
  const out = { dias: 180, desdeSemanal: DESDE_SEMANAL, cruce: [...of.cruce, ...inf.cruce], diaria: [...of.diaria, ...inf.diaria], semanal: [...of.semanal, ...inf.semanal], eficacia: [...of.eficacia, ...inf.eficacia],
    plataformas: [...of.plataformas, ...inf.plataformas], presupuesto: [...of.presupuesto, ...inf.presupuesto],
    conjuntos: [...of.conjuntos, ...inf.conjuntos], todas: [...of.todas, ...inf.todas], audDia: [...of.audDia, ...inf.audDia], alcance: [...of.alcance, ...inf.alcance],
    // Lectura de alcance de Meta de PAUTADOR, solo la partición de hoy. alcanceEstado dice, por canal y tabla, si se pudo leer
    // (disponible false = tabla inexistente o error: el Nexo lo muestra como "sin dato de hoy").
    alcanceFecha: HOY, alcanceMeta: [...of.alcanceMeta, ...inf.alcanceMeta], alcanceCorridas: [...of.alcanceCorridas, ...inf.alcanceCorridas],
    alcanceEstado: { Oficial: of.alcanceEstado, Informativo: inf.alcanceEstado } };
  fs.writeFileSync(path.join(__dirname, '_proyectos.json'), JSON.stringify(out));
  console.log('cruce', out.cruce.length, 'diaria', out.diaria.length, 'semanal', out.semanal.length, 'eficacia', out.eficacia.length, 'plataformas', out.plataformas.length, 'presupuesto', out.presupuesto.length, 'conjuntos', out.conjuntos.length, 'todas', out.todas.length, 'audDia', out.audDia.length, 'alcance', out.alcance.length, 'alcanceMeta', out.alcanceMeta.length, 'alcanceCorridas', out.alcanceCorridas.length);
})().catch((e) => { console.error(e.message); process.exit(1); });
