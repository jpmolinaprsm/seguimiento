// Medidor de la actualización diaria (Extracción, 13/10/2026). Se carga con `node -r ./infra/medir-bq.js script.js` desde actualizar.js.
// No cambia lo que hace ninguna consulta: antes de cada una pide el dry run (gratis) para sumar los bytes que procesa, y al terminar el
// proceso anota cuánta memoria llegó a usar. Escribe líneas JSON en el archivo de MEDIR_BQ_ARCHIVO; sin la variable, no hace nada.
// No toca datos/bq.js: reemplaza `query` en la copia del módulo que carga este proceso.
const fs = require('fs');
const path = require('path');
const archivo = process.env.MEDIR_BQ_ARCHIVO;
if (archivo) {
  const anotar = (o) => { try { fs.appendFileSync(archivo, JSON.stringify(o) + '\n'); } catch (e) { /* medir nunca rompe nada */ } };
  const bq = require('../datos/bq');
  const original = bq.query;
  bq.query = async function query(sql, opciones) {
    let bytes = null;
    try { bytes = await bq.dryRun(sql); } catch (e) { /* si el dry run falla, la consulta real lo vuelve a decir */ }
    const filas = await original.call(this, sql, opciones);
    anotar({ t: 'consulta', bytes, filas: Array.isArray(filas) ? filas.length : null });
    return filas;
  };
  process.on('exit', () => anotar({ t: 'fin', script: path.basename(process.argv[1] || ''), maxRssMb: Math.round(process.resourceUsage().maxRSS / 1024) }));
}
