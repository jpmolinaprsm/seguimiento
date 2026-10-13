// Cliente de BigQuery propio de Seguimiento (solo lectura, salvo los datasets `automatizado`). No guardar claves ni tokens acá.
// Historia: estaba en modulo/src/bq.js y se mudó a datos/ el 30/09/2026. Hasta el 2/10/2026 usaba el cliente de PAUTADOR
// (`pautador/src/services/bqDatajunta.js`, con chdir a esa carpeta y su .env). Desde el 2/10 es una copia propia, para que
// Seguimiento corra en Railway sin la carpeta de PAUTADOR. Conserva lo importante del original:
//   - dry run antes de cada consulta y corte si procesaría más de 1 GB (tope de facturación 1,5 GB);
//   - espera a que termine el trabajo y recorre TODAS las páginas (sin esto las consultas grandes volvían truncadas).
// La clave sale de BQ_CREDENTIALS_JSON o, en local, del archivo de GCP/ (ver datos/credenciales.js).
const { opcionesAuth } = require('./credenciales');

// Los trabajos SIEMPRE se facturan en el proyecto Oficial: la cuenta de servicio no puede crear trabajos en
// bq-project-450514 (Informativo); las tablas de ese proyecto se leen con su nombre completo `proyecto.dataset.tabla`.
const PROYECTO_OFICIAL = 'prsm-bq-media';
const PROYECTO_INFORMATIVO = 'bq-project-450514';
const DATASET_AUTOMATIZADO = 'automatizado';
const TABLA_90D = 'datajunta_meta_90d';
const PROYECTO_PERFILES = PROYECTO_OFICIAL; // las tablas perfil_* viven solo en el proyecto Oficial

const MAX_BYTES_SIN_AVISO = 1024 * 1024 * 1024; // 1 GB: regla del usuario, avisar antes de una consulta más pesada
const TOPE_FACTURACION = '1500000000'; // 1,5 GB: BigQuery rechaza el trabajo si fuera a facturar más

let clientePromesa = null;
function cliente() {
  if (!clientePromesa) {
    clientePromesa = (async () => {
      const { google } = require('googleapis');
      const auth = new google.auth.GoogleAuth(opcionesAuth('bq', ['https://www.googleapis.com/auth/bigquery']));
      return google.bigquery({ version: 'v2', auth: await auth.getClient() });
    })();
    clientePromesa.catch(() => { clientePromesa = null; }); // si falla la autenticación, el próximo intento vuelve a probar
  }
  return clientePromesa;
}

// Reintento corto solo ante cortes de red (no ante errores de la consulta): sin esto un ECONNRESET en una de las ~25
// consultas de la extracción tiraba la corrida entera (2-3/10/2026).
const ERRORES_DE_RED = /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|socket hang up|network/i;
async function conReintento(fn, intentos = 3) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= intentos || !ERRORES_DE_RED.test(String((e && (e.code || e.message)) || e))) throw e;
      await new Promise((r) => setTimeout(r, 5000 * i));
    }
  }
}

function filaAObjeto(fields, fila) {
  const o = {};
  (fila.f || []).forEach((celda, i) => { o[fields[i].name] = celda.v; });
  return o;
}

// Bytes que procesaría la consulta (dry run, no cuesta nada).
async function dryRun(sql) {
  const bq = await cliente();
  const dry = await conReintento(() => bq.jobs.query({
    projectId: PROYECTO_OFICIAL,
    requestBody: { query: sql, useLegacySql: false, dryRun: true },
  }));
  return Number(dry.data.totalBytesProcessed || 0);
}

// Tope por consulta: por defecto 1 GB. Solo una consulta autorizada por el usuario puede pedir más (maxBytes), y nunca
// más de 2 GB. Autorizado el 2/10/2026: el cruce de Oficial desde el 01/01 (~1,24 GB), opción (a).
const MAX_BYTES_AUTORIZABLE = 2 * 1024 * 1024 * 1024;

async function query(sql, { maximumBytesBilled = TOPE_FACTURACION, maxBytes = MAX_BYTES_SIN_AVISO } = {}) {
  const tope = Math.min(maxBytes, MAX_BYTES_AUTORIZABLE);
  if (tope > MAX_BYTES_SIN_AVISO && maximumBytesBilled === TOPE_FACTURACION) maximumBytesBilled = String(Math.ceil(tope * 1.25));
  const bq = await cliente();
  const bytes = await dryRun(sql);
  if (bytes > tope) {
    throw new Error(`La consulta a BigQuery procesaría ${(bytes / 1e9).toFixed(2)} GB — pasa el tope de ${(tope / 1e9).toFixed(2)} GB y se corta (regla: avisar antes de > 1 GB).`);
  }

  // jobs.query devuelve UNA página (y puede volver con jobComplete=false si tarda más de timeoutMs): se espera al trabajo
  // y se recorren todas las páginas con pageToken.
  const PAGINA = 50000, ESPERA_MS = 60000;
  const res = await conReintento(() => bq.jobs.query({
    projectId: PROYECTO_OFICIAL,
    requestBody: { query: sql, useLegacySql: false, maximumBytesBilled, timeoutMs: ESPERA_MS, maxResults: PAGINA },
  }));
  let data = res.data;
  const ref = data.jobReference || {};
  const pagina = (extra) => conReintento(() => bq.jobs.getQueryResults({ projectId: ref.projectId || PROYECTO_OFICIAL, jobId: ref.jobId, location: ref.location, timeoutMs: ESPERA_MS, maxResults: PAGINA, ...extra }));
  while (!data.jobComplete) data = (await pagina({})).data;
  const fields = (data.schema && data.schema.fields) || [];
  const filas = (data.rows || []).map((r) => filaAObjeto(fields, r));
  let token = data.pageToken;
  while (token) {
    const sig = (await pagina({ pageToken: token })).data;
    for (const r of sig.rows || []) filas.push(filaAObjeto(fields, r));
    token = sig.pageToken;
  }
  return filas;
}

// 'proyecto.dataset.tabla' de datajunta_meta_90d para el canal pedido.
const tabla90d = (canal) => `${canal === 'Oficial' ? PROYECTO_OFICIAL : PROYECTO_INFORMATIVO}.${DATASET_AUTOMATIZADO}.${TABLA_90D}`;

const sqlStr = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const lista = (xs) => xs.map(sqlStr).join(', ');

module.exports = {
  query,
  dryRun,
  tabla90d,
  tablaAlertas: (canal) => tabla90d(canal).replace(/\.[^.]+$/, '.alertas_diarias'),
  tablaPerfil: (nombre) => `${PROYECTO_PERFILES}.automatizado.${nombre}`,
  sqlStr,
  lista,
  MAX_BYTES_SIN_AVISO,
  TOPE_FACTURACION,
  MAX_BYTES_AUTORIZABLE,
};
