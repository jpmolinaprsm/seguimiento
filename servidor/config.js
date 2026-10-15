// Servidor de producción · configuración. Todo sale de variables de entorno; ningún valor vive en el código.
//   PORT                   puerto (Railway lo pone solo)
//   NODE_ENV               'production' en Railway. Con otro valor se permite el modo prueba (MODO_PRUEBA_USUARIO)
//   URL_BASE               dirección pública, ej. https://tablero.ejemplo.com (arma el redirect de Google y decide cookie Secure)
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET   cliente OAuth de Google
//   AUTH_DOMINIO           dominio de la empresa; solo entran mails de ese dominio
//   SESSION_SECRET         firma de la cookie (mínimo 32 caracteres)
//   DATOS_DIR              carpeta del volumen (respuestas, solicitudes); por defecto app/repositorio
//   HTML_ARMADO            ruta del HTML armado del día; por defecto app/Seguimiento y Optimizacion.html
//   NEXO_MODO / NEXO_URL / NEXO_CLAVE          consulta de accesos y nexo con PAUTADOR (ver nexo/accesos.js)
//   NEXO_ACCESOS_JSON / NEXO_ACCESOS_ARCHIVO   plan B: lista provisoria de accesos (ver nexo/accesos-lista.js)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   base de Seguimiento (todavía sin uso en este servidor)
//   ACTUALIZACION_AUTOMATICA  0 = no lanzar solo la actualización diaria; 1 = lanzarla; sin la variable: solo en producción
//   MODO_PRUEBA_USUARIO    SOLO si NODE_ENV != production: mail de un usuario falso que entra sin Google (ruta /prueba/entrar)
const path = require('path');
const limpio = (x) => String(x == null ? '' : x).trim();

function leerConfig(env = process.env) {
  const produccion = limpio(env.NODE_ENV).toLowerCase() === 'production';
  const urlBase = limpio(env.URL_BASE).replace(/\/+$/, '');
  const datos = limpio(env.DATOS_DIR) || path.join(__dirname, '..', 'app', 'repositorio');
  const cfg = {
    produccion,
    puerto: Number(env.PORT) || 4330,
    urlBase,
    seguro: produccion || urlBase.startsWith('https://'),   // cookie Secure
    clientId: limpio(env.GOOGLE_CLIENT_ID),
    clientSecret: limpio(env.GOOGLE_CLIENT_SECRET),
    dominio: limpio(env.AUTH_DOMINIO).toLowerCase().replace(/^@/, ''),
    sesionSecreto: limpio(env.SESSION_SECRET),
    datosDir: datos,
    // dónde deja actualizar.js el estado de la última corrida (la misma regla que usa él)
    estadoActualizacion: limpio(env.HTML_ARMADO) ? path.join(path.dirname(path.resolve(limpio(env.HTML_ARMADO))), 'actualizacion', 'estado.json') : path.join(__dirname, '..', 'infra', 'registro', 'estado.json'),
    // los datos guardados con los que actualizar.js arma (junto al HTML en el volumen; en local, borrador/)
    proyectosGuardados: limpio(env.HTML_ARMADO) ? path.join(path.dirname(path.resolve(limpio(env.HTML_ARMADO))), '_proyectos.json') : path.join(__dirname, '..', 'borrador', '_proyectos.json'),
    htmlArmado: limpio(env.HTML_ARMADO) || path.join(__dirname, '..', 'app', 'Seguimiento y Optimizacion.html'),
    // el modo prueba NUNCA existe en producción, aunque la variable esté puesta
    usuarioPrueba: produccion ? '' : limpio(env.MODO_PRUEBA_USUARIO).toLowerCase(),
  };
  cfg.redirectUri = urlBase ? urlBase + '/auth/google/callback' : '';
  return cfg;
}

// Lista de lo que falta para poder arrancar. En producción, faltar algo es un error que impide arrancar.
function faltantes(cfg) {
  const f = [];
  if (!cfg.sesionSecreto || cfg.sesionSecreto.length < 32) f.push('SESSION_SECRET (mínimo 32 caracteres)');
  if (!cfg.usuarioPrueba) {
    if (!cfg.clientId) f.push('GOOGLE_CLIENT_ID');
    if (!cfg.clientSecret) f.push('GOOGLE_CLIENT_SECRET');
    if (!cfg.dominio) f.push('AUTH_DOMINIO');
    if (!cfg.urlBase) f.push('URL_BASE');
  }
  if (cfg.produccion && !cfg.urlBase.startsWith('https://')) f.push('URL_BASE con https://');
  return f;
}

module.exports = { leerConfig, faltantes };
