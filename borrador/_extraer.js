// Extrae de BigQuery (solo lectura, Meta) los datos del borrador. Córdoba entra en los dos canales (desde el 30/09/2026; antes solo Informativo).
//   cruce   → DataJunta completa (Meta) desde el 01/01/2026 (DESDE_CRUCE; antes, la copia de 180 días): canal × cliente × mes × activo × comunicación × contenido × audiencia × placement
//   diaria  → idem, canal × cliente × activo × comunicación × día
//   eficacia → automatizado.eficacia_anuncios (semáforo de costo por reacción compartido con Looker): anuncio × placement con gasto en 180 días
//   plataformas → DataJunta completa de los últimos cuatro meses (ver desdePlataformas), TODAS las plataformas: canal × cliente × proyecto × plataforma × red × objetivo × activo × día
//                 (picos y apagones, costo por objetivo, impacto comparado, consumo proyectado)
//   presupuesto → PresupuestoMensual vigente de cada proyecto en el mes del último día completo (el último cargado; ver mesPresupuesto)
//   conjuntos → Meta 180 d: canal × cliente × comunicación × contenido × conjunto de anuncios × mes (la unidad sobre la que se actúa);
//               `ads` = ids de anuncio de Meta del conjunto en ese mes, separados por coma (para las solicitudes del Nexo)
//               `conjuntoId` = id del conjunto en Meta (ID_Conjunto); si el mismo nombre tuvo más de un id en el mes, van todos separados por coma
//   conjuntosPorId → Meta 180 d, una fila por id de conjunto (ID_Conjunto): nombre, activo, primer y último día con gasto, gasto, g14 e ids de anuncio
//   todas → DataJunta completa 180 d, TODAS las plataformas, por día: canal × cliente × comunicación × contenido × plataforma × red × objetivo
//   googleAnio → DataJunta completa 365 d, solo Google (Google Ads y DV360), SIN día: canal × cliente × contenido × plataforma × red × objetivo
//               (para la referencia de CTR de Google, reglas/google.js referenciasCtrGoogle; `fecha` = último día con gasto)
//   audDia → Meta 180 d por día: canal × cliente × comunicación × audiencia (períodos de 7/30/90 días en Audiencias)
//   (sin `alcance` desde el 2/10/2026: NUNCA SE SUMA ALCANCE, ni días, ni anuncios, ni cuentas. Ninguna consulta suma REACH.)
//   alcanceMeta / alcanceCorridas → lectura diaria de alcance de Meta de PAUTADOR (automatizado.meta_alcance_diario / _corridas),
//             la ÚLTIMA lectura disponible (decisión de Juan Pablo, 3/10/2026): por canal, la partición con la fecha_lectura más
//             reciente que no pase de hoy en Argentina (subconsulta MAX); las corridas, de esa misma fecha. alcanceFecha = la fecha
//             de esa lectura (la más nueva de los dos canales; alcanceFechas, la de cada uno; null si no hay ninguna).
//             Si la tabla no existe, lista vacía y alcanceEstado.disponible = false
//   activosEquivalencia → automatizado.activos_equivalencia de PAUTADOR (bq-project-450514, una sola tabla para los dos canales):
//             una fila por par activo_key ↔ nombre en DataJunta (pedido 018). Si no existe, lista vacía y activosEquivalenciaEstado.disponible = false
//   semanal → DataJunta completa, desde 01/2024 (para detectar temporadas hace falta ver 2+ años): canal × cliente × comunicación × semana × objetivo × formato (luz "Propia" y estacionales)
// Métricas: gasto, impresiones, reacciones, clicks, engagement, comentarios, compartidas, reproducciones y retención (25/50/75/100 %).
// Guarda _proyectos.json. Uso: node _extraer.js
// Otra salida (para no pisar el archivo de la app mientras se trabaja): node _extraer.js --salida=_proyectos.nuevo.json
// o la variable EXTRAER_SALIDA=_proyectos.nuevo.json. Solo un nombre de archivo, siempre dentro de borrador/.
const fs = require('fs');
const path = require('path');
const bq = require('../datos/bq');

const DESDE_SEMANAL = '2024-01-01';
// Inicio del bloque `cruce` (decisión de Juan Pablo, 2/10/2026, rediseño de Referencias): los cuartiles Bueno / Normal / Malo usan
// todo 2026, como Eficacia de Looker. Por eso el cruce sale de DataJunta completa y no de la copia de 180 días (que es la misma
// tabla con Plataforma = 'META' y los últimos 180 días: desde abril, lo que trae es idéntico).
const DESDE_CRUCE = '2026-01-01';
// Archivo de salida: _proyectos.json salvo que se pida otro con --salida=NOMBRE o EXTRAER_SALIDA=NOMBRE.
function archivoSalida(argv = process.argv, env = process.env) {
  const arg = argv.find((a) => a.startsWith('--salida='));
  const nombre = (arg ? arg.slice('--salida='.length) : env.EXTRAER_SALIDA) || '_proyectos.json';
  if (!/^[\w.-]+\.json$/.test(nombre)) throw new Error(`Salida inválida: "${nombre}" (solo un nombre de archivo .json, sin carpetas).`);
  return path.join(__dirname, nombre);
}
// Mes del presupuesto (30/09/2026): el del último día completo de DataJunta (carga a las 8:00 con el día anterior), en hora de
// Argentina (UTC-3, sin horario de verano), con tope al fin de ese mes. El 1/10 todavía es septiembre; el 2/10 ya es octubre.
// Mismo criterio que presupuestos/pedidos.js (mesDeAyer) y que el mes en curso de la app.
function mesPresupuesto(ahora = Date.now()) {
  const ayer = new Date(ahora - 3 * 3600000 - 86400000);
  const y = ayer.getUTCFullYear(), m = ayer.getUTCMonth();
  const iso = (d) => d.toISOString().slice(0, 10);
  return { desde: iso(new Date(Date.UTC(y, m, 1))), hasta: iso(new Date(Date.UTC(y, m + 1, 0))) };
}
// Inicio del bloque `plataformas` (decisión D-a de Juan Pablo, 1/10/2026): ventana móvil de cuatro meses, desde el día 1 del mes
// que está tres meses antes del mes en curso. "Mes en curso" es el del último día completo de DataJunta (el mismo de
// mesPresupuesto y de la app): el 1/10 todavía es septiembre, así que arranca el 01/06 (lo mismo que la fecha fija anterior);
// el 2/10 ya es octubre y arranca el 01/07. Así _proyectos.json deja de crecer mes a mes.
function desdePlataformas(ahora = Date.now()) {
  const ayer = new Date(ahora - 3 * 3600000 - 86400000);
  return new Date(Date.UTC(ayer.getUTCFullYear(), ayer.getUTCMonth() - 3, 1)).toISOString().slice(0, 10);
}
// Hoy en Argentina (UTC-3, sin horario de verano), como 'AAAA-MM-DD'. Es la partición `fecha_lectura` de la lectura de alcance.
function hoyAR(ahora = Date.now()) {
  return new Date(ahora - 3 * 3600000).toISOString().slice(0, 10);
}
// Lectura diaria de alcance de Meta que deja PAUTADOR (contrato orquestacion/CONTRATOS/lectura-alcance-meta.md, 30/09/2026).
// Informativo en bq-project-450514; Oficial y "Ambos" en prsm-bq-media (cada fila trae su `canal`). Se prende el 14/10/2026:
// hasta entonces las tablas no existen y la extracción sigue igual, con lista vacía y la marca `disponible: false`.
const TALC = { Oficial: 'prsm-bq-media.automatizado', Informativo: 'bq-project-450514.automatizado' };
// Última lectura (decisión de Juan Pablo, 3/10/2026): la partición más reciente de meta_alcance_diario que no pase de `fecha` (hoy
// en Argentina), por canal. Las corridas se piden para esa misma fecha: una lectura que hoy falló entera (corridas sin filas de
// alcance) no reemplaza a la última que sí dejó datos.
const sqlUltimaLectura = (c, fecha) => `(SELECT MAX(fecha_lectura) FROM \`${TALC[c]}.meta_alcance_diario\` WHERE fecha_lectura <= DATE '${fecha}')`;
const sqlAlcanceMeta = (c, fecha) => `SELECT * FROM \`${TALC[c]}.meta_alcance_diario\` WHERE fecha_lectura = ${sqlUltimaLectura(c, fecha)}`;
const sqlAlcanceCorridas = (c, fecha) => `SELECT * FROM \`${TALC[c]}.meta_alcance_corridas\` WHERE fecha_lectura = ${sqlUltimaLectura(c, fecha)}`;
// Fecha de lectura (AAAA-MM-DD) de las filas bajadas (BigQuery devuelve DATE como texto o { value }): la más nueva, o null.
const fechaLecturaDe = (filas) => (filas || []).map((f) => String((f && f.fecha_lectura && f.fecha_lectura.value) || (f && f.fecha_lectura) || '').slice(0, 10))
  .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort().pop() || null;
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
// Equivalencia activo_key de PAUTADOR ↔ nombre en DataJunta (pedido 018, exportada el 1/10/2026; después se actualiza junto con la
// lectura diaria de alcance). Una sola tabla para los dos canales (columna canal). Chica (77 filas), sin ids ni mails: se lee entera.
const TEQ = 'bq-project-450514.automatizado.activos_equivalencia';
const sqlActivosEquivalencia = () => `SELECT activo_key, activo, nombre_datajunta, proyecto, cliente, canal, habilitado, emparejado,
  CAST(actualizado_en AS STRING) AS actualizado_en FROM \`${TEQ}\``;
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

// G3 (decisión de Juan Pablo, 1/10/2026): un año de Google (Google Ads y DV360) para la referencia de CTR (reglas/google.js,
// referenciasCtrGoogle). Misma forma de fila que `todas` (canal, cliente, cod, contenido, plataforma, red, objetivo, fecha, gasto,
// imp, clk) pero sumando los 365 días: una fila = contenido × red × objetivo. `fecha` = último día con gasto (la función la usa
// para su ventana). Si el contenido no tiene código, se separa por nombre de contenido. Mismos filtros que `todas` (Pulso afuera).
function sqlGoogleAnio(c) {
  return `
    SELECT '${c}' AS canal, cliente, cod, COALESCE(NULLIF(sinCod, ''), ANY_VALUE(contenido)) AS contenido, plataforma, red, objetivo,
      CAST(MAX(IF(gasto > 0, fecha, NULL)) AS STRING) AS fecha,
      SUM(gasto) AS gasto, SUM(imp) AS imp, SUM(clk) AS clk
    FROM (
      SELECT Cliente AS cliente, IFNULL(Codigo_Contenido, '') AS cod, Contenido AS contenido,
        IF(IFNULL(Codigo_Contenido, '') = '', IFNULL(Contenido, '(sin contenido)'), '') AS sinCod,
        Plataforma AS plataforma, IFNULL(Red, Plataforma) AS red, IFNULL(Objetivo, '(sin objetivo)') AS objetivo, Fecha AS fecha,
        IFNULL(Gasto, 0) AS gasto, IFNULL(Impresiones, 0) AS imp, IFNULL(Clicks, 0) AS clk
      FROM \`${TFULL[c]}\`
      WHERE Cliente IN (${bq.lista(CLIENTES)}) AND Plataforma IN ('Google Ads', 'Google Display & Video 360')
        AND NOT REGEXP_CONTAINS(IFNULL(Activo, ''), r'^Pulso (Dos|Argentina|Nacional)') AND NOT REGEXP_CONTAINS(UPPER(IFNULL(Campana, '')), 'PULSO')
        AND Fecha >= DATE_SUB(CURRENT_DATE('America/Argentina/Buenos_Aires'), INTERVAL 365 DAY))
    GROUP BY cliente, cod, sinCod, plataforma, red, objetivo HAVING gasto > 0`;
}

const MES_PRESU = mesPresupuesto();
const HOY = hoyAR();
const DESDE_PLATAFORMAS = desdePlataformas();

async function canal(c) {
  const cruce = await bq.query(`
    SELECT '${c}' AS canal, Cliente AS cliente, FORMAT_DATE('%Y-%m', Fecha) AS mes, Activo AS activo, ${COM} AS comunic,
      IFNULL(Codigo_Contenido,'') AS cod, ANY_VALUE(Contenido) AS contenido, ANY_VALUE(Formato) AS formato_raw,
      IFNULL(Audiencia,'(sin audiencia)') AS audiencia, IFNULL(Placement,'Sin dato') AS placement,
      Objetivo AS objetivo, Eje AS eje, ${MET},
      MIN(IF(Gasto>0,Fecha,NULL)) AS desde, MAX(IF(Gasto>0,Fecha,NULL)) AS hasta, CAST(MAX(DATE(Fin)) AS STRING) AS fin,
      MAX(Link_FB) AS link_fb, MAX(Link_IG) AS link_ig, MAX(Link) AS link
    FROM \`${TFULL[c]}\` WHERE ${filtro(c)} AND Fecha >= '${DESDE_CRUCE}'
    -- objetivo agrupado (no ANY_VALUE) desde el 5/10/2026: una pieza con anuncios de varios objetivos en el mismo placement y mes
    -- quedaba con cualquiera de ellos y cambiaba entre extracciones (hallazgo de Referencias). El eje también, desde el 5/10/2026
    -- (decisión de Juan Pablo: los ejes son categorías transversales para medir creatividades).
    GROUP BY cliente, mes, activo, comunic, cod, audiencia, placement, objetivo, eje HAVING gasto > 0`,
    // Oficial lee ~1,24 GB (DataJunta no se poda por fecha): tope de 2 GB autorizado por Juan Pablo el 2/10/2026, solo para esta consulta.
    c === 'Oficial' ? { maxBytes: bq.MAX_BYTES_AUTORIZABLE } : undefined);
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
      AND Fecha >= '${DESDE_PLATAFORMAS}'
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
  // N7 (1/10/2026, para el Nexo): una fila por id de conjunto de Meta (ID_Conjunto) en los 180 días, para elegir el conjunto activo
  // cuando un mismo nombre tuvo varios ids. `ultimoGasto` = última fecha con gasto; `ads` = ids de anuncio de ese id, separados por coma.
  const conjuntosPorId = await bq.query(`
    SELECT '${c}' AS canal, Cliente AS cliente, CAST(ID_Conjunto AS STRING) AS conjuntoId,
      ARRAY_AGG(Conjunto_de_Anuncios IGNORE NULLS ORDER BY Fecha DESC LIMIT 1)[SAFE_OFFSET(0)] AS nombre,
      ARRAY_AGG(Activo IGNORE NULLS ORDER BY Fecha DESC LIMIT 1)[SAFE_OFFSET(0)] AS activo,
      CAST(MIN(IF(Gasto>0,Fecha,NULL)) AS STRING) AS primerGasto, CAST(MAX(IF(Gasto>0,Fecha,NULL)) AS STRING) AS ultimoGasto,
      SUM(IFNULL(Gasto,0)) AS gasto,
      SUM(IF(Fecha >= DATE_SUB(CURRENT_DATE('America/Argentina/Buenos_Aires'), INTERVAL 14 DAY), IFNULL(Gasto,0), 0)) AS g14,
      STRING_AGG(DISTINCT CAST(ID_del_Anuncio AS STRING), ',' ORDER BY CAST(ID_del_Anuncio AS STRING)) AS ads
    FROM \`${T180[c]}\` WHERE ${filtro(c)} AND ID_Conjunto IS NOT NULL
    GROUP BY cliente, conjuntoId HAVING gasto > 0`);
  const todas = await bq.query(`
    SELECT '${c}' AS canal, Cliente AS cliente, ${COM} AS comunic, IFNULL(Codigo_Contenido,'') AS cod, Plataforma AS plataforma, IFNULL(Red, Plataforma) AS red,
      IFNULL(Objetivo,'(sin objetivo)') AS objetivo, CAST(Fecha AS STRING) AS fecha, ANY_VALUE(Contenido) AS contenido, ANY_VALUE(Formato) AS formato_raw, Eje AS eje,
      ANY_VALUE(Link) AS link, ANY_VALUE(Link_Youtube) AS link_yt, ANY_VALUE(Activo) AS activo,
      SUM(IFNULL(Gasto,0)) AS gasto, SUM(IFNULL(Impresiones,0)) AS imp, SUM(IFNULL(Reacciones,0)) AS rea, SUM(IFNULL(Clicks,0)) AS clk,
      SUM(IFNULL(Views,0)) AS vw, SUM(IFNULL(View_25,0)) AS v25, SUM(IFNULL(View_100,0)) AS v100, SUM(IFNULL(Engagement,0)) AS eng,
      SUM(IFNULL(Compartidas,0)) AS sha, SUM(IFNULL(Comentarios,0)) AS com
    FROM \`${TFULL[c]}\`
    WHERE Cliente IN (${bq.lista(CLIENTES)})
      AND NOT REGEXP_CONTAINS(IFNULL(Activo, ''), r'^Pulso (Dos|Argentina|Nacional)') AND NOT REGEXP_CONTAINS(UPPER(IFNULL(Campana, '')), 'PULSO')
      AND Fecha >= DATE_SUB(CURRENT_DATE('America/Argentina/Buenos_Aires'), INTERVAL 180 DAY)
    -- eje agrupado (no ANY_VALUE) desde el 5/10/2026, igual que en el cruce: "Por eje" de la app y el cruce dicen lo mismo.
    GROUP BY cliente, comunic, cod, plataforma, red, objetivo, fecha, eje HAVING gasto > 0`);
  // G3 (decisión de Juan Pablo, 1/10/2026): un año de Google para la referencia de CTR (reglas/google.js, referenciasCtrGoogle).
  // Misma forma de fila que `todas` (canal, cliente, cod, contenido, plataforma, red, objetivo, fecha, gasto, imp, clk) pero sumando
  // los 365 días: un caso = contenido × red × objetivo. `fecha` = último día con gasto (la función la usa para su ventana).
  // Si el contenido no tiene código, se separa por nombre de contenido (en `todas` quedarían juntos bajo cod vacío).
  const googleAnio = await bq.query(sqlGoogleAnio(c));
  const audDia = await bq.query(`
    SELECT '${c}' AS canal, Cliente AS cliente, ${COM} AS comunic, IFNULL(Audiencia,'(sin audiencia)') AS audiencia, CAST(Fecha AS STRING) AS fecha,
      SUM(IFNULL(Gasto,0)) AS gasto, SUM(IFNULL(Impresiones,0)) AS imp, SUM(IFNULL(Reacciones,0)) AS rea, SUM(IFNULL(Clicks,0)) AS clk
    FROM \`${T180[c]}\` WHERE ${filtro(c)} GROUP BY cliente, comunic, audiencia, fecha HAVING gasto > 0`);
  // Sin bloque `alcance` desde el 2/10/2026 (regla de Juan Pablo: NUNCA SE SUMA ALCANCE). Antes sumaba REACH por anuncio y día
  // (FBADS_TABLERO_META / TIK_TABLERO_TIK_TOK) y después entre anuncios. El alcance sale solo de la lectura de Meta de PAUTADOR.
  const aMeta = await leerOpcional(bq.query, sqlAlcanceMeta(c, HOY));
  const aCorr = await leerOpcional(bq.query, sqlAlcanceCorridas(c, HOY));
  if (!aMeta.estado.disponible) console.error(c, 'alcanceMeta no disponible:', aMeta.estado.motivo);
  if (!aCorr.estado.disponible) console.error(c, 'alcanceCorridas no disponible:', aCorr.estado.motivo);
  return { cruce, diaria, semanal, eficacia, plataformas, presupuesto, conjuntos, conjuntosPorId, todas, googleAnio, audDia,
    alcanceFecha: fechaLecturaDe(aMeta.filas), alcanceMeta: aMeta.filas, alcanceCorridas: aCorr.filas, alcanceEstado: { alcanceMeta: aMeta.estado, alcanceCorridas: aCorr.estado } };
}

if (require.main !== module) { module.exports = { archivoSalida, DESDE_CRUCE, hoyAR, desdePlataformas, mesPresupuesto, leerOpcional, sqlAlcanceMeta, sqlAlcanceCorridas, sqlUltimaLectura, fechaLecturaDe,sqlGoogleAnio, sqlActivosEquivalencia, TALC, TEQ }; return; }

(async () => {
  const SALIDA = archivoSalida();
  const of = await canal('Oficial');
  const inf = await canal('Informativo');
  const eq = await leerOpcional(bq.query, sqlActivosEquivalencia());
  if (!eq.estado.disponible) console.error('activosEquivalencia no disponible:', eq.estado.motivo);
  const out = { dias: 180, desdeCruce: DESDE_CRUCE, desdeSemanal: DESDE_SEMANAL, cruce: [...of.cruce, ...inf.cruce], diaria: [...of.diaria, ...inf.diaria], semanal: [...of.semanal, ...inf.semanal], eficacia: [...of.eficacia, ...inf.eficacia],
    plataformas: [...of.plataformas, ...inf.plataformas], presupuesto: [...of.presupuesto, ...inf.presupuesto],
    conjuntos: [...of.conjuntos, ...inf.conjuntos], conjuntosPorId: [...of.conjuntosPorId, ...inf.conjuntosPorId], todas: [...of.todas, ...inf.todas], googleAnio: [...of.googleAnio, ...inf.googleAnio], diasGoogleAnio: 365, audDia: [...of.audDia, ...inf.audDia],
    // Lectura de alcance de Meta de PAUTADOR: la última disponible de cada canal (3/10/2026). alcanceFecha = la fecha de lectura
    // más nueva de los dos canales (null si no hay ninguna); alcanceFechas, la de cada canal; alcanceHoy, el día en que se bajó.
    // alcanceEstado dice, por canal y tabla, si se pudo leer (disponible false = tabla inexistente o error: "sin dato de Meta").
    alcanceFecha: [of.alcanceFecha, inf.alcanceFecha].filter(Boolean).sort().pop() || null,
    alcanceFechas: { Oficial: of.alcanceFecha, Informativo: inf.alcanceFecha }, alcanceHoy: HOY, alcanceMeta: [...of.alcanceMeta, ...inf.alcanceMeta], alcanceCorridas: [...of.alcanceCorridas, ...inf.alcanceCorridas],
    alcanceEstado: { Oficial: of.alcanceEstado, Informativo: inf.alcanceEstado },
    // Equivalencia activo_key ↔ nombre en DataJunta (PAUTADOR, pedido 018). La usa presupuestos/resumen-activos.js.
    activosEquivalencia: eq.filas, activosEquivalenciaEstado: eq.estado };
  fs.writeFileSync(SALIDA, JSON.stringify(out));
  console.log('guardado en', path.basename(SALIDA));
  console.log('cruce', out.cruce.length, 'diaria', out.diaria.length, 'semanal', out.semanal.length, 'eficacia', out.eficacia.length, 'plataformas', out.plataformas.length, 'presupuesto', out.presupuesto.length, 'conjuntos', out.conjuntos.length, 'conjuntosPorId', out.conjuntosPorId.length, 'todas', out.todas.length, 'googleAnio', out.googleAnio.length, 'audDia', out.audDia.length, 'alcanceMeta', out.alcanceMeta.length, 'alcanceCorridas', out.alcanceCorridas.length, 'activosEquivalencia', out.activosEquivalencia.length);
})().catch((e) => { console.error(e.message); process.exit(1); });
