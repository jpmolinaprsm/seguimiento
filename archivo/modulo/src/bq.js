// Acceso a BigQuery reutilizando el cliente de PAUTADOR (googleapis + clave de GCP/).
// El módulo corre aparte de PAUTADOR, pero comparte su .env y su clave hasta que se conecte de verdad.
const path = require('path');

const PAUTADOR = path.resolve(__dirname, '..', '..', '..', 'pautador');
process.env.BQ_SERVICE_ACCOUNT_KEY_PATH = process.env.BQ_SERVICE_ACCOUNT_KEY_PATH
  || path.resolve(__dirname, '..', '..', '..', 'GCP', 'prsm-bq-media-6a154f90fdb5.json');
process.chdir(PAUTADOR); // config/env.js de PAUTADOR lee su .env relativo al cwd

const bq = require(path.join(PAUTADOR, 'src', 'services', 'bqDatajunta.js'));

const PROYECTO_PERFILES = 'prsm-bq-media'; // las tablas perfil_* viven solo en el proyecto Oficial

const sqlStr = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const lista = (xs) => xs.map(sqlStr).join(', ');

module.exports = {
  query: bq.query,
  tabla90d: bq.tablaDatajunta90d,
  tablaAlertas: (canal) => bq.tablaDatajunta90d(canal).replace(/\.[^.]+$/, '.alertas_diarias'),
  tablaPerfil: (nombre) => `${PROYECTO_PERFILES}.automatizado.${nombre}`,
  sqlStr,
  lista,
  PAUTADOR,
};
