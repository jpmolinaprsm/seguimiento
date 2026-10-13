// Nexo con PAUTADOR (lado Seguimiento) · transporte REAL de los pedidos de cambio (camino 2).
// Contrato: orquestacion/CONTRATOS/cambios-seguimiento-a-pautador.md ("Entradas construidas (2/10)").
//   POST <NEXO_URL>/api/servicio/cambios          cuerpo = la solicitud   → estado (200) · 202 en proceso · 503 frenado o sin clave
//   POST <NEXO_URL>/api/servicio/cambios/estado   cuerpo { id }           → estado (200) · 404 sin esa solicitud
//   Encabezado x-pautador-servicio: NEXO_CLAVE (la misma que SERVICIO_CLAVE_SEGUIMIENTO en PAUTADOR).
//
// CANDADOS (todos juntos; si falta uno, el modo es simulado y no se abre ninguna conexión):
//   NEXO_MODO=real, NEXO_URL https, NEXO_CLAVE, correr en Railway (RAILWAY_ENVIRONMENT o RAILWAY_ENVIRONMENT_NAME) y NODE_ENV=production.
//   Desde una compu local NUNCA es real, aunque alguien ponga NEXO_MODO=real.
// Idempotencia: el mismo id viaja siempre igual; PAUTADOR ignora el repetido (duplicada: true) y cliente.js no reenvía un id con estado final.
// Reintento corto: solo ante cortes de red o falta de respuesta (hasta 2 reintentos, a 1 y 2 segundos), con el MISMO id. Una respuesta
// con código (400, 401, 429, 503...) NO se reintenta: se informa y queda "sin_respuesta" para reintentar a mano.
// La clave nunca se escribe en un mensaje de error ni en un registro.
const RUTA_CAMBIOS = '/api/servicio/cambios';
const RUTA_ESTADO = '/api/servicio/cambios/estado';
const HEADER_CLAVE = 'x-pautador-servicio';
const ESPERA_MS = 25000;   // PAUTADOR espera hasta 15 s a que termine antes de contestar 202
const ESTADOS_PAUTADOR = ['recibida', 'rechazada_validacion', 'aplicada', 'fallo', 'pendiente_aprobacion', 'rechazada_persona'];

const limpio = (x) => String(x == null ? '' : x).trim();

function enRailway(env = process.env) {
  return !!(limpio(env.RAILWAY_ENVIRONMENT) || limpio(env.RAILWAY_ENVIRONMENT_NAME));
}

// Los candados del modo real. → { ok, falta: [..] }
function candadosReal(env = process.env) {
  const falta = [];
  if (limpio(env.NEXO_MODO).toLowerCase() !== 'real') falta.push('NEXO_MODO=real');
  if (!limpio(env.NEXO_URL)) falta.push('NEXO_URL');
  if (!limpio(env.NEXO_CLAVE)) falta.push('NEXO_CLAVE');
  if (!enRailway(env)) falta.push('correr en Railway');
  if (limpio(env.NODE_ENV).toLowerCase() !== 'production') falta.push('NODE_ENV=production');
  return { ok: falta.length === 0, falta };
}

function urlDe(base, ruta) {
  let u;
  try { u = new URL(limpio(base)); } catch (e) { return null; }
  if (u.protocol !== 'https:' || u.username || u.password) return null;   // la clave solo viaja por https y sin credenciales en la URL
  return u.origin + u.pathname.replace(/\/+$/, '') + ruta;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// opciones: { env, fetch, esperaMs, reintentosMs, dormir }. → { modo:'real', recibir(solicitud), consultar(id) }; lanza si faltan los candados.
function crearTransporteReal({ env = process.env, fetch: pedir = globalThis.fetch, esperaMs = ESPERA_MS, reintentosMs = [1000, 2000], dormir: esperar = dormir } = {}) {
  const c = candadosReal(env);
  if (!c.ok) throw new Error('transporte real apagado: falta ' + c.falta.join(', '));
  const clave = limpio(env.NEXO_CLAVE);
  const urlCambios = urlDe(env.NEXO_URL, RUTA_CAMBIOS);
  const urlEstado = urlDe(env.NEXO_URL, RUTA_ESTADO);
  if (!urlCambios) throw new Error('transporte real apagado: NEXO_URL no es una dirección https válida');
  if (typeof pedir !== 'function') throw new Error('transporte real apagado: no hay forma de hacer la consulta');

  async function unaVez(url, cuerpo) {
    const corte = new AbortController();
    const timer = setTimeout(() => corte.abort(), esperaMs);
    try {
      return await pedir(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', [HEADER_CLAVE]: clave },
        body: JSON.stringify(cuerpo),
        signal: corte.signal,
        redirect: 'error',   // la clave no se reenvía a otra dirección
      });
    } catch (e) {
      throw new Error(corte.signal.aborted ? 'PAUTADOR no contestó en ' + Math.round(esperaMs / 1000) + ' segundos' : 'no se pudo conectar con PAUTADOR');
    } finally { clearTimeout(timer); }
  }

  // Reintento corto solo si no hubo respuesta (corte de red o silencio). Mismo cuerpo, mismo id: PAUTADOR ignora el repetido.
  async function enviar(url, cuerpo) {
    let ultimo;
    for (let i = 0; i <= reintentosMs.length; i++) {
      try { return await unaVez(url, cuerpo); } catch (e) {
        ultimo = e;
        if (i < reintentosMs.length) await esperar(reintentosMs[i]);
      }
    }
    throw ultimo;
  }

  async function leer(res, id) {
    const st = res && res.status;
    if (st === 404) {
      let b = {};
      try { b = await res.json(); } catch (e) { /* sin cuerpo */ }
      return { id, estado: null, motivo: limpio(b && b.motivo) || 'PAUTADOR no tiene una solicitud con ese id.' };
    }
    if (st !== 200 && st !== 202) {
      const porque = st === 401 ? ' (clave no aceptada: revisar NEXO_CLAVE)'
        : st === 429 ? ' (demasiados pedidos por minuto)'
          : st === 503 ? ' (PAUTADOR no puede recibir ahora: nexo frenado o sin clave; no quedó registrada, se puede reenviar con el mismo id)'
            : st === 400 ? ' (pedido mal formado)' : '';
      throw new Error('PAUTADOR respondió ' + (st || 'sin código') + porque);
    }
    let b;
    try { b = await res.json(); } catch (e) { throw new Error('PAUTADOR respondió algo que no es JSON'); }
    if (!b || typeof b !== 'object' || Array.isArray(b) || String(b.id) !== String(id) || !ESTADOS_PAUTADOR.includes(b.estado)) {
      throw new Error('la respuesta de PAUTADOR no tiene el formato acordado');
    }
    return {
      id: b.id, estado: b.estado, etapa: b.etapa || null, control: b.control || null, motivo: b.motivo || null, error: b.error || null,
      valores: Array.isArray(b.valores) ? b.valores : null, aprobada_por: b.aprobada_por || null, duplicada: b.duplicada === true,
      historial: Array.isArray(b.historial) ? b.historial : [],
    };
  }

  return {
    modo: 'real',
    async recibir(solicitud) {
      if (!solicitud || !solicitud.id) throw new Error('la solicitud no trae id: no se manda');
      return leer(await enviar(urlCambios, solicitud), solicitud.id);
    },
    async consultar(id) {
      if (!id) throw new Error('falta el id');
      return leer(await enviar(urlEstado, { id }), id);
    },
  };
}

module.exports = { crearTransporteReal, candadosReal, enRailway, RUTA_CAMBIOS, RUTA_ESTADO };
