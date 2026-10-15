// Disparador de la actualización diaria, dentro del servidor web (Railway: el volumen es de este servicio).
// A las 10:30 de Argentina (13:30 UTC), si estado.json dice que hoy no hubo una corrida buena, lanza `node actualizar.js` como proceso
// aparte (spawn, sin esperar: no frena al servidor). Si esa corrida dio "sin dato de hoy", reintenta a las 12:00 y a las 14:00.
// actualizar.js trae su propio candado (dos corridas a la vez, o una repetida del mismo día, se saltean solas).
// Si el servidor estaba apagado a las 10:30, lanza la corrida al arrancar (hasta las 18:00 de Argentina).
// Al arrancar, si ya hay HTML armado y datos guardados pero el código es otro que el del último armado (estado.json.codigo_version), lanza
// `node actualizar.js --solo-armar`: rearma con los datos guardados (sin BigQuery) mientras se sigue sirviendo la versión anterior.
// Se apaga con ACTUALIZACION_AUTOMATICA=0. Sin la variable: prendido solo en producción (NODE_ENV=production); en la compu no corre solo.
// Todo queda en el registro del servidor y en <carpeta del estado>/disparador.jsonl.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { codigoVersion } = require('./codigo-version');

const HORARIOS_AR = [{ h: 10, m: 30, reintento: false }, { h: 12, m: 0, reintento: true }, { h: 14, m: 0, reintento: true }];
const LIMITE_AR_MIN = 18 * 60;      // pasada esta hora ya no se lanza nada ese día
const AR_MS = 3 * 3600000;

const arDe = (ms) => { const d = new Date(ms - AR_MS); return { dia: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() }; };

function activo(env = process.env) {
  const v = String(env.ACTUALIZACION_AUTOMATICA == null ? '' : env.ACTUALIZACION_AUTOMATICA).trim();
  if (v === '0') return false;
  if (v === '1') return true;
  return String(env.NODE_ENV || '').trim().toLowerCase() === 'production';
}

function leerEstado(ruta) { try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch (e) { return null; } }

// opciones: { rutaEstado, raiz, reloj, lanzar() → proceso, log, env, cadaMs }. Todo inyectable para las pruebas.
// rutaHtml y rutaProyectos: el HTML armado y los datos guardados (para decidir si hay algo que rearmar). codigo: función que da la versión del código.
function crearDisparador({ rutaEstado, rutaHtml, rutaProyectos, codigo = () => codigoVersion(), raiz = path.join(__dirname, '..'), reloj = () => Date.now(), lanzar, lanzarSoloArmar, log = () => {}, env = process.env, cadaMs = 60000 } = {}) {
  const lanzarProceso = lanzar || (() => spawn(process.execPath, ['actualizar.js'], { cwd: raiz, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }));
  const lanzarRearmado = lanzarSoloArmar || (() => spawn(process.execPath, ['actualizar.js', '--solo-armar'], { cwd: raiz, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }));
  const disparados = new Set();   // "AAAA-MM-DD|h:m": cada horario se intenta una sola vez por día
  let hijo = null, timer = null, desde = null, tipoHijo = null, rearmadoIntentado = false;

  const registrar = (obj) => {
    log('actualización: ' + JSON.stringify(obj));
    try { fs.appendFileSync(path.join(path.dirname(rutaEstado), 'disparador.jsonl'), JSON.stringify({ cuando: new Date(reloj()).toISOString(), ...obj }) + '\n'); } catch (e) { /* sin carpeta: queda en el registro del servidor */ }
  };

  // → { lanzo, motivo }; lo llama el temporizador cada minuto
  function revisar() {
    const { dia, min } = arDe(reloj());
    if (hijo) return { lanzo: false, motivo: 'ya_corre' };
    if (min >= LIMITE_AR_MIN) return { lanzo: false, motivo: 'fuera_de_hora' };
    const estado = leerEstado(rutaEstado);
    if (estado && estado.ultimo_ok_dia === dia) return { lanzo: false, motivo: 'ya_hay_corrida_buena' };
    const alcanzados = HORARIOS_AR.filter((x) => min >= x.h * 60 + x.m);
    const slot = alcanzados[alcanzados.length - 1];
    if (!slot) return { lanzo: false, motivo: 'antes_de_hora' };
    const clave = `${dia}|${slot.h}:${slot.m}`;
    if (disparados.has(clave)) return { lanzo: false, motivo: 'ya_intentado' };
    // los reintentos (12:00 y 14:00) solo si el intento anterior de hoy dio "sin dato de hoy"
    if (slot.reintento) {
      const u = estado && estado.ultima_corrida;
      const deHoy = u && u.termino && arDe(Date.parse(u.termino)).dia === dia;
      // si hoy todavía no corrió nada (servidor prendido después de las 10:30), este horario hace de primera corrida
      if (deHoy && u.sin_dato_de_hoy !== true) { disparados.add(clave); return { lanzo: false, motivo: 'sin_reintento' }; }
    }
    disparados.add(clave);
    let proc;
    try { proc = lanzarProceso(); } catch (e) { registrar({ evento: 'no_se_pudo_lanzar', error: e.message }); return { lanzo: false, motivo: 'error' }; }
    vigilar(proc, 'completa');
    registrar({ evento: 'lanzada', horario: `${String(slot.h).padStart(2, '0')}:${String(slot.m).padStart(2, '0')} AR`, reintento: slot.reintento });
    return { lanzo: true, motivo: 'lanzada' };
  }

  // Deja asentado que hay un proceso corriendo y registra cuando termina (sin esperar: no frena al servidor).
  function vigilar(proc, tipo) {
    hijo = proc; desde = reloj(); tipoHijo = tipo;
    const fin = (cod, extra) => { if (hijo === proc) { hijo = null; tipoHijo = null; } registrar({ evento: 'termino', tipo, codigo: cod, ...extra }); };
    let ultimo = '';
    const juntar = (d) => { ultimo = (ultimo + String(d)).slice(-400); };
    if (proc.stdout && proc.stdout.on) proc.stdout.on('data', juntar);
    if (proc.stderr && proc.stderr.on) proc.stderr.on('data', juntar);
    proc.on('error', (e) => fin(null, { error: e.message }));
    proc.on('close', (cod) => fin(cod, cod ? { ultimas_lineas: ultimo.trim().split('\n').slice(-3) } : {}));
  }

  // Rearmado al arrancar con código nuevo: hay HTML armado y datos guardados, y estado.json.codigo_version no es la del código actual.
  // Una vez por arranque. No si ya corre algo. No si el mismo código ya falló (se mira a mano; no se repite en cada reinicio).
  // → { lanzo, motivo }
  let motivoRearmado = null;   // último motivo de la decisión de rearmar (para /salud)
  function rearmarSiCambioElCodigo() { const r = decidirRearmado(); motivoRearmado = r.motivo; return r; }
  function decidirRearmado() {
    if (rearmadoIntentado) return { lanzo: false, motivo: 'ya_intentado' };
    rearmadoIntentado = true;
    if (hijo) return { lanzo: false, motivo: 'ya_corre' };
    if (!rutaHtml || !rutaProyectos || !fs.existsSync(rutaHtml) || !fs.existsSync(rutaProyectos)) return { lanzo: false, motivo: 'sin_datos_guardados' };
    let actual;
    try { actual = codigo(); } catch (e) { registrar({ evento: 'sin_version_de_codigo', error: e.message }); return { lanzo: false, motivo: 'error' }; }
    const estado = leerEstado(rutaEstado) || {};
    if (estado.codigo_version === actual) return { lanzo: false, motivo: 'codigo_al_dia' };
    const u = estado.ultimo_solo_armar;
    if (u && u.resultado === 'fallo' && u.codigo_version === actual) return { lanzo: false, motivo: 'ya_fallo_con_este_codigo' };
    let proc;
    try { proc = lanzarRearmado(); } catch (e) { registrar({ evento: 'no_se_pudo_lanzar', tipo: 'solo-armar', error: e.message }); return { lanzo: false, motivo: 'error' }; }
    vigilar(proc, 'solo-armar');
    registrar({ evento: 'lanzada', tipo: 'solo-armar', codigo_anterior: estado.codigo_version || null, codigo_nuevo: actual });
    return { lanzo: true, motivo: 'lanzada' };
  }

  // Para /salud y para la pantalla de espera: sin datos sensibles (nada de errores ni de rutas).
  function resumen() {
    const e = leerEstado(rutaEstado) || {};
    const u = e.ultima_corrida;
    return {
      corriendo: !!hijo,
      ...(hijo ? { tipo: tipoHijo, desde: new Date(desde).toISOString() } : {}),
      ultima: { resultado: u ? (u.sin_dato_de_hoy === true ? 'sin_dato_de_hoy' : (u.resultado || null)) : null, termino: u ? u.termino || null : null, datos_hasta: e.datos_hasta || null },
      rearmado: { decision: motivoRearmado, ultimo: e.ultimo_solo_armar ? { resultado: e.ultimo_solo_armar.resultado || null, termino: e.ultimo_solo_armar.termino || null } : null },
    };
  }

  return {
    activo: activo(env),
    revisar,
    corriendo: () => !!hijo,
    resumen,
    rearmarSiCambioElCodigo,
    iniciar() {
      if (!activo(env) || timer) return false;
      timer = setInterval(() => { try { revisar(); } catch (e) { registrar({ evento: 'error', error: e.message }); } }, cadaMs);
      timer.unref();
      // Al arrancar: si toca la actualización completa, sale esa (ya rearma todo); si no, y el código cambió, el rearmado con los datos guardados.
      try { const r = revisar(); if (!r.lanzo) rearmarSiCambioElCodigo(); } catch (e) { registrar({ evento: 'error', error: e.message }); }
      return true;
    },
    detener() { if (timer) clearInterval(timer); timer = null; },
  };
}

// Aviso para mostrar arriba: el campo aviso de estado.json cuando sin_dato_de_hoy es true. Se lee con memoria de 30 s.
function crearAviso({ rutaEstado, reloj = () => Date.now() }) {
  let memo = null, hasta = 0;
  return () => {
    if (reloj() < hasta) return memo;
    const e = leerEstado(rutaEstado);
    memo = e && e.sin_dato_de_hoy === true && typeof e.aviso === 'string' && e.aviso ? e.aviso : null;
    hasta = reloj() + 30000;
    return memo;
  };
}

module.exports = { crearDisparador, crearAviso, activo, arDe, HORARIOS_AR };
