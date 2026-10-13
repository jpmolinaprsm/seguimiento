// Serie diaria por pieza para Creatividades (pedido 058, medir desgaste). Consulta BigQuery (solo lectura, dry run y tope de 1 GB del cliente
// datos/bq.js) y escribe salidas/serie-diaria/serie-<canal>-<año>.csv + LEEME.json.
//   node salidas/serie-diaria-piezas.js            (desde Seguimiento/)
// Una fila por código de pieza × día × objetivo × eje × grupo de ubicación × cliente, solo Meta, desde 2025-01-01, hasta el último día completo.
// Mismos filtros que la extracción (siete clientes, sin Pulso; "Campaña Santa Fe 2025" queda afuera). Sin alcance (nunca se suma).
// Códigos: solo los que son código (8 a 20 letras o números, igual que rendimiento-piezas.js). Se descartan las filas con menos de 100 impresiones en el día.
const fs = require('fs');
const path = require('path');
const bq = require('../datos/bq.js');

const DESDE = '2025-01-01';
const SALIDA = path.join(__dirname, 'serie-diaria');
const T = { Oficial: 'prsm-bq-media.prsm_media_tableros.DataJunta', Informativo: 'bq-project-450514.informativo.DataJunta' };
const CLIENTES = ['Gobierno de Santa Fe', 'Gobierno del Chaco', 'Gobierno del Chubut', 'Gobierno de Corrientes', 'Catamarca Provincia', 'Catamarca Ciudad', 'Gobierno de Córdoba'];
// Misma lista que app/marcas.js (SIN_REACCIONES, línea 28); se copia acá porque ese archivo no la exporta. Si cambia allá, hay que cambiarla acá.
const SIN_REACCIONES_SQL = 'Stories|Audience Network|Rewarded|Status';
const PLS = ['Facebook Feed', 'Instagram Feed', 'Instagram Reels', 'Facebook Reels', 'Instagram Stories', 'Facebook Stories', 'Facebook Instream Video', 'Threads Feed'];
const CODIGO_OK = /^[A-Z0-9]{8,20}$/;
const OBJ = { OUTCOME_TRAFFIC: 'Tráfico', OUTCOME_ENGAGEMENT: 'Interacción', OUTCOME_AWARENESS: 'Alcance' };
const COLS = ['codigo_pieza', 'fecha', 'canal', 'proyecto', 'plataforma', 'red', 'objetivo', 'eje', 'placement_grupo',
  'gasto', 'impresiones', 'reacciones', 'clicks', 'engagement', 'vistas', 'v25', 'v100'];
const num = (x) => Number(x) || 0;
const r2 = (x) => Math.round(x * 100) / 100;
const csv = (v) => { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

function sql(c) {
  const pl = PLS.map((p) => `'${p}'`).join(',');
  return `SELECT CAST(Fecha AS STRING) AS fecha, Cliente AS cliente, IFNULL(Codigo_Contenido,'') AS cod, IFNULL(Objetivo,'') AS objetivo, IFNULL(Eje,'') AS eje,
    IF(Placement IN (${pl}), Placement, IF(STARTS_WITH(IFNULL(Placement,''),'Instagram Explore'), 'Instagram Explore', 'Otros')) AS pgrp,
    MIN(IFNULL(Red,'')) AS red_min, MAX(IFNULL(Red,'')) AS red_max,
    SUM(IFNULL(Gasto,0)) AS gasto, SUM(IFNULL(Impresiones,0)) AS imp,
    SUM(IF(REGEXP_CONTAINS(IFNULL(Placement,''), r'${SIN_REACCIONES_SQL}'), 0, IFNULL(Reacciones,0))) AS rea,
    SUM(IFNULL(Clicks,0)) AS clk, SUM(IFNULL(Engagement,0)) AS eng, SUM(IFNULL(Views,0)) AS vw, SUM(IFNULL(View_25,0)) AS v25, SUM(IFNULL(View_100,0)) AS v100
  FROM \`${T[c]}\`
  WHERE Plataforma = 'META' AND Cliente IN (${bq.lista(CLIENTES)}) AND NOT REGEXP_CONTAINS(IFNULL(Activo,''), r'^Pulso (Dos|Argentina|Nacional)')
    AND Fecha >= '${DESDE}'
  GROUP BY fecha, cliente, cod, objetivo, eje, pgrp HAVING gasto > 0`;
}

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const corte = new Date().toISOString();
  const resumen = { gb_procesados: {}, archivos: {}, descartes: {}, gasto_por_mes: {} };
  let hasta = '';
  for (const c of ['Oficial', 'Informativo']) {
    const s = sql(c);
    const bytes = await bq.dryRun(s);
    console.log(`${c}: dry run ${(bytes / 1e9).toFixed(3)} GB`);
    resumen.gb_procesados[c] = +(bytes / 1e9).toFixed(3);
    const filas = await bq.query(s); // tope normal de 1 GB (lo verifica el cliente)
    const dias = {};
    for (const f of filas) dias[f.fecha] = (dias[f.fecha] || 0) + num(f.gasto);
    const ds = Object.keys(dias).sort();
    const prev = ds.slice(-8, -1).map((d) => dias[d]).sort((a, b) => a - b);
    const med = prev.length ? prev[Math.floor(prev.length / 2)] : 0;
    const ultimo = dias[ds[ds.length - 1]] < med * 0.3 ? ds[ds.length - 2] : ds[ds.length - 1]; // último día completo
    if (ultimo > hasta) hasta = ultimo;
    const porAnio = {};
    const desc = { sin_codigo: 0, codigo_invalido: 0, menos_de_100_imp: 0, dia_incompleto: 0 };
    const gDesc = { sin_codigo: 0, codigo_invalido: 0, menos_de_100_imp: 0, dia_incompleto: 0 };
    const gMes = {}, gMesTotal = {};
    for (const f of filas) {
      const mes = f.fecha.slice(0, 7), g = num(f.gasto);
      gMesTotal[mes] = (gMesTotal[mes] || 0) + g;
      const motivo = f.fecha > ultimo ? 'dia_incompleto' : !f.cod ? 'sin_codigo' : !CODIGO_OK.test(f.cod) ? 'codigo_invalido' : num(f.imp) < 100 ? 'menos_de_100_imp' : null;
      if (motivo) { desc[motivo]++; gDesc[motivo] += g; continue; }
      gMes[mes] = (gMes[mes] || 0) + g;
      const red = f.red_min === f.red_max ? f.red_min : 'Varias';
      const fila = [f.cod, f.fecha, c, f.cliente, 'Meta', red, OBJ[f.objetivo] || f.objetivo || 'Sin objetivo', f.eje, f.pgrp,
        r2(g), num(f.imp), num(f.rea), num(f.clk), num(f.eng), num(f.vw), num(f.v25), num(f.v100)];
      (porAnio[f.fecha.slice(0, 4)] = porAnio[f.fecha.slice(0, 4)] || []).push(fila);
    }
    for (const [anio, rows] of Object.entries(porAnio)) {
      rows.sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      const arch = `serie-${c.toLowerCase()}-${anio}.csv`;
      fs.writeFileSync(path.join(SALIDA, arch), '﻿' + COLS.join(',') + '\n' + rows.map((r) => r.map(csv).join(',')).join('\n') + '\n');
      resumen.archivos[arch] = { filas: rows.length, mb: +(fs.statSync(path.join(SALIDA, arch)).size / 1e6).toFixed(1) };
      console.log(arch, rows.length, 'filas', resumen.archivos[arch].mb, 'MB');
    }
    resumen.descartes[c] = { filas: desc, gasto: Object.fromEntries(Object.entries(gDesc).map(([k, v]) => [k, r2(v)])) };
    resumen.gasto_por_mes[c] = { en_archivos: Object.fromEntries(Object.entries(gMes).sort().map(([k, v]) => [k, r2(v)])),
      total_meta_con_gasto: Object.fromEntries(Object.entries(gMesTotal).sort().map(([k, v]) => [k, r2(v)])) };
  }
  const leeme = {
    pedido: '058 (Creatividades, medir desgaste por pieza)',
    fecha_de_corte: corte, datos_hasta: hasta, desde: DESDE,
    que_es: 'Una fila por código de pieza, día, objetivo, eje, grupo de ubicación y proyecto, solo Meta, de Oficial e Informativo. Archivos CSV por canal y año (UTF-8 con marca BOM, coma como separador, punto decimal).',
    columnas: {
      codigo_pieza: 'Código de contenido de DataJunta (8 a 20 letras o números).', fecha: 'Día (AAAA-MM-DD).', canal: 'Oficial o Informativo.',
      proyecto: 'Cliente de DataJunta (Gobierno de Santa Fe, etc.).', plataforma: 'Siempre Meta.', red: 'Red de DataJunta (Facebook, Instagram…); "Varias" si el grupo mezcla redes.',
      objetivo: 'Tráfico, Interacción, Alcance u otro tal como viene.', eje: 'Eje de DataJunta (vacío si no tiene).',
      placement_grupo: 'Ubicación agrupada igual que la app: Facebook Feed, Instagram Feed, Instagram Reels, Facebook Reels, Instagram Stories, Facebook Stories, Facebook Instream Video, Threads Feed, Instagram Explore u Otros.',
      gasto: 'Gasto en pesos del día.', impresiones: 'Impresiones del día.', reacciones: 'Reacciones del día, en cero en las ubicaciones sin reacciones (ver abajo).',
      clicks: 'Clicks del día.', engagement: 'Engagement del día (columna Engagement de DataJunta).',
      vistas: 'Vistas de video (columna Views de DataJunta: vista de 3 segundos en Meta).', v25: 'Reproducciones al 25 % (View_25).', v100: 'Reproducciones al 100 % (View_100).',
    },
    filtros: [
      'Solo Meta. Siete clientes de la extracción (Santa Fe, Chaco, Chubut, Corrientes, Catamarca Provincia, Catamarca Ciudad, Córdoba). Sin Pulso. "Campaña Santa Fe 2025" queda afuera.',
      'Solo filas con 100 impresiones o más en el día (por pieza, objetivo, eje, ubicación y proyecto).',
      'Solo códigos válidos (8 a 20 letras o números); sin código o con un texto que no es código se descartan.',
      'Hasta el último día completo (DataJunta carga el día anterior a las 8:00).',
      'Sin alcance: no se suma nunca y no existe por pieza y día.',
    ],
    ubicaciones_sin_reacciones: {
      lista: SIN_REACCIONES_SQL.split('|'), regla: 'Las reacciones de las ubicaciones cuyo nombre contiene alguna de esas palabras se ponen en cero (mismo criterio que SIN_REACCIONES de app/marcas.js, el universo de Looker). Los demás campos no se tocan.',
      nota: 'La lista final la confirma el especialista de Métricas.',
    },
    ...resumen,
  };
  fs.writeFileSync(path.join(SALIDA, 'LEEME.json'), JSON.stringify(leeme, null, 1));
  console.log('listo, datos hasta', hasta);
})().catch((e) => { console.error(e.message); process.exit(1); });
