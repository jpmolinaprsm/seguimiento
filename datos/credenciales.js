// De dónde sale la cuenta de servicio de Google para cada uso. Nunca guardar claves acá ni imprimirlas.
//
// En Railway, cada clave es una variable de entorno con el TEXTO del JSON de la cuenta de servicio:
//   BQ_CREDENTIALS_JSON      → BigQuery (la cuenta de servicio de BigQuery de PAUTADOR, decisión D7 del 30/09/2026).
//   SHEETS_CREDENTIALS_JSON  → lectura de la planilla de presupuestos pedidos (la cuenta de Sheets de PAUTADOR: la de
//                              BigQuery no puede, su proyecto de Google no tiene habilitada la API de Sheets).
// En esta computadora, si la variable no está, se usa el archivo de siempre (se le pasa la RUTA a la librería de Google;
// este código nunca abre el archivo). Se puede cambiar la ruta con BQ_CREDENTIALS_PATH / SHEETS_CREDENTIALS_PATH.
const path = require('path');

const AUTOMATIZACIONES = path.resolve(__dirname, '..', '..');
const ARCHIVO_LOCAL = {
  bq: path.join(AUTOMATIZACIONES, 'GCP', 'prsm-bq-media-6a154f90fdb5.json'),
  sheets: path.join(AUTOMATIZACIONES, 'pautador', 'credentials', 'service-account-json.json'),
};
const VARIABLE = { bq: 'BQ_CREDENTIALS_JSON', sheets: 'SHEETS_CREDENTIALS_JSON' };
const VARIABLE_RUTA = { bq: 'BQ_CREDENTIALS_PATH', sheets: 'SHEETS_CREDENTIALS_PATH' };

// Opciones para `new google.auth.GoogleAuth(...)`: { credentials } si está la variable, { keyFile } si no.
function opcionesAuth(uso, scopes) {
  if (!VARIABLE[uso]) throw new Error(`Uso de credenciales desconocido: ${uso}`);
  const texto = process.env[VARIABLE[uso]];
  if (texto && texto.trim()) {
    let credentials;
    try { credentials = JSON.parse(texto); } catch (e) {
      // El mensaje no incluye el contenido de la variable, para no filtrar la clave a los registros.
      throw new Error(`${VARIABLE[uso]} no es un JSON válido (se esperaba el texto completo de la cuenta de servicio).`);
    }
    return { credentials, scopes };
  }
  // En Railway (o con NODE_ENV=production) no hay archivo local: si falta la variable, decirlo claro en vez de buscar
  // un archivo de la compu de Juan Pablo (15/10/2026: faltaba SHEETS_CREDENTIALS_JSON y el error hablaba de /pautador/credentials).
  const enServidor = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT || !!process.env.RAILWAY_ENVIRONMENT_NAME;
  if (enServidor && !process.env[VARIABLE_RUTA[uso]]) {
    throw new Error(`Falta la variable ${VARIABLE[uso]} en Railway (o está vacía): cargarla con el texto completo del JSON de la cuenta de servicio y volver a desplegar.`);
  }
  const keyFile = process.env[VARIABLE_RUTA[uso]] ? path.resolve(process.env[VARIABLE_RUTA[uso]]) : ARCHIVO_LOCAL[uso];
  return { keyFile, scopes };
}

// De dónde se tomó la clave, sin mostrarla (para mensajes y pruebas).
function origen(uso) {
  if ((process.env[VARIABLE[uso]] || '').trim()) return `variable ${VARIABLE[uso]}`;
  return process.env[VARIABLE_RUTA[uso]] ? `archivo de ${VARIABLE_RUTA[uso]}` : 'archivo local';
}

module.exports = { opcionesAuth, origen };
