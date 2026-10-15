// Disparador de la actualización diaria, dentro del servidor web (Railway: el volumen es de este servicio).
// A las 10:30 de Argentina (13:30 UTC), si estado.json dice que hoy no hubo una corrida buena, lanza `node actualizar.js` como proceso
// aparte (spawn, sin esperar: no frena al servidor). Si esa corrida dio "sin dato de hoy", reintenta a las 12:00 y a las 14:00.
// actualizar.js trae su propio candado (dos corridas a la vez, o una repetida del mismo día, se saltean solas).
// Si el servidor estaba apagado a las 10:30, lanza la corrida al arrancar (hasta las 18:00 de Argentina).
// Se apaga con ACTUALIZACION_AUTOMATICA=0. Sin la variable: prendido solo en producción (NODE_ENV=production); en la compu no corre solo.
// Todo queda en el registro del servidor y en <carpeta del estado>/disparador.jsonl.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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
function crearDisparador({ rutaEstado, raiz = path.join(__dirname, '..'), reloj = () => Date.now(), lanzar, log = () => {}, env = process.env, cadaMs = 60000 } = {}) {
  const lanzarProceso = lanzar || (() => spawn(process.execPath, ['actualizar.js'], { cwd: raiz, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }));
  const disparados = new Set();   // "AAAA-MM-DD|h:m": cada horario se intenta una sola vez por día
  let hijo = null, timer = null;

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
    hijo = proc;
    registrar({ evento: 'lanzada', horario: `${String(slot.h).padStart(2, '0')}:${String(slot.m).padStart(2, '0')} AR`, reintento: slot.reintento });
    const fin = (cod, extra) => { if (hijo === proc) hijo = null; registrar({ evento: 'termino', codigo: cod, ...extra }); };
    let ultimo = '';
    const juntar = (d) => { ultimo = (ultimo + String(d)).slice(-400); };
    if (proc.stdout && proc.stdout.on) proc.stdout.on('data', juntar);
    if (proc.stderr && proc.stderr.on) proc.stderr.on('data', juntar);
    proc.on('error', (e) => fin(null, { error: e.message }));
    proc.on('close', (cod) => fin(cod, cod ? { ultimas_lineas: ultimo.trim().split('\n').slice(-3) } : {}));
    return { lanzo: true, motivo: 'lanzada' };
  }

  return {
    activo: activo(env),
    revisar,
    corriendo: () => !!hijo,
    iniciar() {
      if (!activo(env) || timer) return false;
      timer = setInterval(() => { try { revisar(); } catch (e) { registrar({ evento: 'error', error: e.message }); } }, cadaMs);
      timer.unref();
      try { revisar(); } catch (e) { /* se reintenta al minuto */ }
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
