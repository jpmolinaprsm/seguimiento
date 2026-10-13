// Nexo con PAUTADOR (lado Seguimiento) · consulta de accesos: qué tiene cada mail en el sistema de usuarios de PAUTADOR.
// Contrato: orquestacion/CONTRATOS/consulta-accesos.md, "Ruta construida (1/10)". Variables: NEXO_MODO, NEXO_URL, NEXO_CLAVE.
//
//   POST <NEXO_URL>/api/servicio/accesos   cuerpo JSON { "email": … }   header x-pautador-servicio: <NEXO_CLAVE>
//   200 → { email, nombre, habilitado, rol, administradorGlobal, superadministrador, accesos: [...] }
//         (un mail que no existe y uno deshabilitado responden igual: habilitado false, accesos [])
//   400 · 401 · 429 · 500 · 503 → error: se trata como "sin acceso" (revisarPermiso lo devuelve como sin_respuesta).
//
// Modo:
//   - Real SOLO con NEXO_MODO=real, NEXO_URL y NEXO_CLAVE. Si falta cualquiera, no hay cliente (crearClienteAccesos devuelve null)
//     y nunca se abre una conexión.
//   - NEXO_URL tiene que ser https (http solo para localhost): la clave no viaja sin cifrar.
//
// Memoria (pedido de PAUTADOR, tope 120 consultas por minuto): la respuesta de cada mail se guarda 5 minutos. Solo se guardan
// respuestas válidas; un error no se guarda. Tope de entradas: al pasarlo se descarta la más vieja. vaciar(mail) o vaciar() la
// borra a mano (por ejemplo, cuando le cambian los permisos a alguien en PAUTADOR). Dos consultas simultáneas del mismo mail
// comparten una sola llamada.
//
// La clave nunca se escribe en un mensaje de error ni en un registro.
const RUTA_ACCESOS = '/api/servicio/accesos';
const HEADER_CLAVE = 'x-pautador-servicio';
const ESPERA_MS = 5000;
const MEMORIA_MS = 5 * 60 * 1000;
const MAX_ENTRADAS = 500;

const limpio = (x) => String(x == null ? '' : x).trim();
const claveMail = (m) => limpio(m).toLowerCase();

function modoAccesos(env = process.env) {
  const pedido = limpio(env.NEXO_MODO || 'simulado').toLowerCase();
  return pedido === 'real' && limpio(env.NEXO_URL) && limpio(env.NEXO_CLAVE) ? 'real' : 'simulado';
}

// NEXO_URL (base de PAUTADOR) → URL completa de la ruta, o null si no es https (o http a localhost).
function urlAccesos(base) {
  let u;
  try { u = new URL(limpio(base)); } catch (e) { return null; }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return null;
  if (u.username || u.password) return null;   // nada de credenciales en la URL
  return u.origin + u.pathname.replace(/\/+$/, '') + RUTA_ACCESOS;
}

// Respuesta 200 con la forma acordada y del mismo mail. Si no, no se usa ni se guarda.
function respuestaValida(r, mail) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
  if (claveMail(r.email) !== claveMail(mail)) return false;
  if (typeof r.habilitado !== 'boolean') return false;
  if (!Array.isArray(r.accesos)) return false;
  return true;
}

// opciones: { env, fetch, esperaMs, memoriaMs, maxEntradas, reloj }. En pruebas se pasa fetch de mentira.
// → función async (mail) → respuesta de PAUTADOR (lanza error si no se pudo saber), con .vaciar(mail?), .tamano(), .modo
//   o null si el modo no es real.
function crearClienteAccesos({ env = process.env, fetch: pedir = globalThis.fetch, esperaMs = ESPERA_MS, memoriaMs = MEMORIA_MS, maxEntradas = MAX_ENTRADAS, reloj = () => Date.now() } = {}) {
  if (modoAccesos(env) !== 'real') return null;
  const url = urlAccesos(env.NEXO_URL);
  const clave = limpio(env.NEXO_CLAVE);
  const memoria = new Map();      // mail → { respuesta, vence }
  const enCurso = new Map();      // mail → promesa de la llamada que ya salió

  const copia = (x) => JSON.parse(JSON.stringify(x));

  async function llamar(mail) {
    if (!url) throw new Error('NEXO_URL no es una dirección https válida: no se consulta a PAUTADOR');
    if (typeof pedir !== 'function') throw new Error('no hay forma de hacer la consulta a PAUTADOR');
    const corte = new AbortController();
    const timer = setTimeout(() => corte.abort(), esperaMs);
    let res;
    try {
      res = await pedir(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', [HEADER_CLAVE]: clave },
        body: JSON.stringify({ email: mail }),
        signal: corte.signal,
        redirect: 'error',   // la clave no se reenvía a otra dirección
      });
    } catch (e) {
      throw new Error(corte.signal.aborted ? `PAUTADOR no contestó en ${Math.round(esperaMs / 1000)} segundos` : 'no se pudo conectar con PAUTADOR');
    } finally { clearTimeout(timer); }
    if (!res || res.status !== 200) {
      const st = res && res.status;
      const porque = st === 401 ? ' (clave no aceptada: revisar NEXO_CLAVE)' : st === 429 ? ' (demasiadas consultas)' : st === 503 ? ' (PAUTADOR no tiene la clave cargada)' : '';
      throw new Error(`PAUTADOR respondió ${st || 'sin código'}${porque}`);
    }
    let r;
    try { r = await res.json(); } catch (e) { throw new Error('PAUTADOR respondió algo que no es JSON'); }
    if (!respuestaValida(r, mail)) throw new Error('la respuesta de PAUTADOR no tiene el formato acordado');
    return r;
  }

  async function accesos(mail) {
    const k = claveMail(mail);
    const ahora = reloj();
    const m = memoria.get(k);
    if (m && m.vence > ahora) return copia(m.respuesta);
    if (m) memoria.delete(k);
    if (!enCurso.has(k)) {
      const p = llamar(limpio(mail)).then((r) => {
        memoria.delete(k);
        memoria.set(k, { respuesta: copia(r), vence: reloj() + memoriaMs });
        while (memoria.size > maxEntradas) memoria.delete(memoria.keys().next().value);
        return r;
      }).finally(() => enCurso.delete(k));
      enCurso.set(k, p);
    }
    return copia(await enCurso.get(k));
  }

  accesos.vaciar = (mail) => { if (mail == null) memoria.clear(); else memoria.delete(claveMail(mail)); };
  accesos.tamano = () => memoria.size;
  accesos.modo = 'real';
  return accesos;
}

module.exports = { crearClienteAccesos, modoAccesos, urlAccesos, RUTA_ACCESOS, HEADER_CLAVE, ESPERA_ACCESOS_HTTP_MS: ESPERA_MS, MEMORIA_ACCESOS_MS: MEMORIA_MS, MAX_ENTRADAS_ACCESOS: MAX_ENTRADAS };
