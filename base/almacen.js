// Seguimiento y Optimización · dónde se guarda lo del equipo y lo que genera el agente (2/10/2026, agente Recomendaciones).
// Interfaz chica para que app/redaccion.js, borrador/lectura-temprana.js, app/servir.js (/api/respuesta) y el Nexo pasen de
// archivo a base sin tocar lo demás (PLAN-RAILWAY, sección 3). Dos implementaciones con los mismos métodos:
//   archivo   lo de hoy: app/repositorio/ (mismos archivos y mismo formato de línea)        → base/almacen-archivo.js
//   supabase  la base propia de Seguimiento (base/migraciones/)                              → base/almacen-supabase.js
//
// Uso:
//   const { crearAlmacen } = require('../base/almacen.js');
//   const almacen = crearAlmacen();                       // supabase si están SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY; si no, archivo
//   await almacen.guardarRespuesta(reg, { autor: 'mail@dominio', autorNombre: 'Nombre' });
//
// TODOS los métodos devuelven una promesa (la base es asíncrona; el de archivo también, para que el código que lo usa sea el mismo).
//
// Recomendaciones del día (redaccion.guardarRepositorio)
//   guardarRecomendaciones(datosAl, filas)          reemplaza las del día; filas = las líneas de hoy (datos_al, generado, id, proyecto...)
//   leerRecomendaciones({ desde, hasta, proyecto, canal })   mismas líneas
// Respuestas del equipo (servir.js /api/respuesta)
//   guardarRespuesta(reg, quien)                    reg = lo que manda la app ({ clase, ... }); quien = { autor, autorNombre } de la
//                                                   SESIÓN (pisa lo que diga el navegador). clases: recomendacion · regla ·
//                                                   tipo_campana · pantalla. Devuelve { ok: true } o { ok: false, error } sin escribir.
//   leerRespuestas({ proyecto, canal, desde })      líneas con la forma de hoy de respuestas.jsonl (GET /api/respuestas)
//   leerEstados({ proyecto, canal })                { [id de recomendación]: { decision, motivo, sirve, comentario, autor, actualizado } }
//   leerComentarios({ proyecto, canal, objeto, referencia })   [{ objeto, referencia, proyecto, canal, texto, autor, creado }]
//   leerTiposCampana({ proyecto, canal })           { [campaña]: { tipo, sugerido, autor, cambiado } }
// Looker
//   guardarLooker({ proyecto, canal, url }, quien)  { ok } o { ok: false, error }
//   leerLookers({ proyectos })                      { 'proyecto|canal': url }
// Lectura temprana (borrador/lectura-temprana.js, observar)
//   leerPredicciones()                              todas, en el orden en que se anotaron
//   agregarPredicciones(nuevas)                     solo agrega; devuelve cuántas quedaron (las de id repetido se ignoran)
//   guardarResumenLectura(resumen) · leerResumenLectura()
// Registro de actualizaciones
//   empezarActualizacion({ tipo, referencia })      devuelve el id
//   terminarActualizacion(id, { resultado, datos_hasta, version, duracion_ms, filas, gb_bigquery, memoria_mb, error, detalle })
//   ultimaActualizacion({ tipo, resultado })        la última fila (o null)
// Nexo con PAUTADOR
//   nexo                                            mismos métodos que nexo/repositorio.js, pero con promesa:
//                                                   guardarSolicitud, guardarEstado, leerSolicitud, leerEstados, ultimoEstado,
//                                                   historial, porRecomendacion

const CLASES = ['recomendacion', 'regla', 'tipo_campana', 'pantalla'];
const DECISIONES = ['pendiente', 'enviada a PAUTADOR', 'hecha a mano', 'descartada'];
const CON_MOTIVO = ['hecha a mano', 'descartada'];
const TIPOS = ['constante', 'estacional', 'larga', 'puntual', 'ninguna'];
const MAIL = /^[^@\s]+@[^@\s]+$/;
const vacio = (x) => x == null || !String(x).trim();

// Controles comunes a las dos implementaciones. Devuelve el texto del error o null. exigirMail: en Railway el autor tiene que ser el
// mail de la sesión; en local (archivo) se acepta "sin identificar" como hoy.
function validarRespuesta(reg, { exigirMail = false } = {}) {
  if (!reg || typeof reg !== 'object' || Array.isArray(reg)) return 'Se espera un objeto';
  if (!CLASES.includes(reg.clase)) return `Clase desconocida: ${reg.clase}`;
  if (exigirMail && !MAIL.test(String(reg.autor || ''))) return 'Falta el autor (mail de la sesión)';
  if (reg.clase !== 'regla' && vacio(reg.proyecto)) return 'Falta el proyecto';
  if (reg.clase === 'recomendacion') {
    if (vacio(reg.id)) return 'Falta el id de la recomendación';
    if (vacio(reg.canal)) return 'Falta el canal';
    if (!DECISIONES.includes(reg.decision)) return `Decisión desconocida: ${reg.decision}`;
    if (CON_MOTIVO.includes(reg.decision) && vacio(reg.motivo)) return `"${reg.decision}" necesita un motivo`;
  }
  if (reg.clase === 'regla' && (vacio(reg.regla) || vacio(reg.comentario))) return 'El comentario a una regla necesita la regla y el texto';
  if (reg.clase === 'tipo_campana') {
    if (vacio(reg.campana) || vacio(reg.canal)) return 'El tipo de campaña necesita campaña y canal';
    if (!TIPOS.includes(reg.tipo)) return `Tipo de campaña desconocido: ${reg.tipo}`;
  }
  if (reg.clase === 'pantalla' && vacio(reg.pantalla)) return 'El comentario de pantalla necesita la pantalla';
  return null;
}

// El autor sale de la sesión, nunca del navegador. Sin sesión (local) queda lo que vino, como hoy.
function conAutor(reg, quien) {
  if (!quien || !quien.autor) return { ...reg };
  return { ...reg, autor: String(quien.autor).trim().toLowerCase(), autor_nombre: quien.autorNombre || reg.autor_nombre || null };
}

function validarLooker(url) {
  return /^https:\/\/lookerstudio\.google\.com\//.test(String(url || '')) ? null : 'No parece un link de Looker Studio';
}

function crearAlmacen(opciones = {}) {
  const env = opciones.env || process.env;
  const tipo = opciones.tipo || (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'archivo');
  if (tipo === 'supabase') return require('./almacen-supabase.js').crearAlmacenSupabase({ ...opciones, env });
  if (tipo === 'archivo') return require('./almacen-archivo.js').crearAlmacenArchivo(opciones);
  throw new Error(`almacén desconocido: ${tipo}`);
}

module.exports = { crearAlmacen, validarRespuesta, conAutor, validarLooker, CLASES, DECISIONES, CON_MOTIVO, TIPOS, MAIL };
