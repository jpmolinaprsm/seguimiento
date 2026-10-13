// accesosDe(email): qué puede ver cada persona.
//   1. Consulta a PAUTADOR (nexo/accesos.js), si NEXO_MODO=real con NEXO_URL y NEXO_CLAVE.
//      - Respuesta válida (incluida una baja explícita "no habilitado"): vale, y la lista provisoria NO la pisa.
//      - 401 o 403 (clave rotada o rechazada): se CIERRA. Nadie entra, no se usa la lista. Queda un error claro en el registro y
//        /salud lo muestra como "degradado" (sin datos sensibles).
//      - 429 (demasiadas consultas): se reintenta una vez; si sigue, se trata como un 5xx.
//      - Timeout, sin conexión, 5xx o formato raro: lista provisoria, pero SOLO si su "generada_el" es de hace 7 días o menos.
//        Sin fecha o vencida, nadie entra.
//   2. Consulta apagada (sin NEXO_MODO=real): lista provisoria, con la misma regla de los 7 días.
//   3. Sin consulta ni lista válida: nadie ve nada.
// permisosDe() convierte la respuesta en lo que el servidor necesita: { global, rol, proyectos: [{ proyecto, canales }] }.
const { crearClienteAccesos } = require('../nexo/accesos');
const { crearAccesosDeLista } = require('../nexo/accesos-lista');

const normal = (x) => String(x == null ? '' : x).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const ROLES_QUE_ENTRAN = ['implementador', 'administrador'];   // PM/Cuentas todavía no entra (contrato consulta-accesos)
const VIGENCIA_LISTA_MS = 7 * 24 * 3600 * 1000;

// El cliente de nexo/accesos.js dice "PAUTADOR respondió 401 (…)" cuando contesta con error: de ahí sale el código.
const estadoHttp = (e) => { const m = /respondi[oó] (\d{3})/.exec(String(e && e.message)); return m ? Number(m[1]) : null; };

function crearAccesosDe({ env = process.env, fetch, registrar = () => {}, cliente, lista, reloj = () => Date.now(), esperar = (ms) => new Promise((r) => setTimeout(r, ms)), reintentoMs = 1000 } = {}) {
  const real = cliente !== undefined ? cliente : crearClienteAccesos({ env, ...(fetch ? { fetch } : {}) });
  let plan = lista;
  if (plan === undefined) {
    try { plan = crearAccesosDeLista({ env }); } catch (e) { registrar('lista provisoria de accesos inválida: ' + e.message); plan = null; }
  }
  const salud = { degradado: false, motivo: null };
  const ultimoLog = new Map();
  const avisar = (clave, texto) => { const t = reloj(); if (!ultimoLog.has(clave) || t - ultimoLog.get(clave) > 60000) { ultimoLog.set(clave, t); registrar(texto); } };

  // ¿se puede confiar en la lista provisoria hoy? (generada hace 7 días o menos)
  function listaVigente() {
    if (!plan) return { ok: false, porque: 'no hay lista provisoria' };
    const g = plan.generada_el;
    if (g === undefined) return { ok: true };   // función de lista pasada a mano (pruebas): sin control de fecha
    const t = Date.parse(g || '');
    if (!t) return { ok: false, porque: 'la lista provisoria no tiene fecha de generación (generada_el)' };
    if (reloj() - t > VIGENCIA_LISTA_MS) return { ok: false, porque: 'la lista provisoria tiene más de 7 días' };
    if (t - reloj() > 24 * 3600 * 1000) return { ok: false, porque: 'la fecha de la lista provisoria es futura' };
    return { ok: true };
  }
  const conLista = async (email, motivoCaida) => {
    const v = listaVigente();
    if (!v.ok) { salud.degradado = true; salud.motivo = 'sin_acceso_alternativo'; avisar('lista', `ERROR accesos: ${motivoCaida}; ${v.porque}: nadie entra hasta que PAUTADOR vuelva o se renueve la lista`); return null; }
    if (motivoCaida) { salud.degradado = true; salud.motivo = 'pautador_sin_respuesta'; avisar('caida', `AVISO accesos: ${motivoCaida}: se usa la lista provisoria`); }
    return plan(email);
  };

  async function accesosDe(email) {
    if (!real) return conLista(email, null);
    let intento = 0;
    for (;;) {
      try {
        const r = await real(email);
        salud.degradado = false; salud.motivo = null;
        return r;
      } catch (e) {
        const st = estadoHttp(e);
        if (st === 401 || st === 403) {
          salud.degradado = true; salud.motivo = 'clave_rechazada';
          avisar('clave', `ERROR accesos: PAUTADOR rechazó la clave del servicio (${st}). Revisar NEXO_CLAVE y SERVICIO_CLAVE_SEGUIMIENTO. Nadie entra hasta corregirla (no se usa la lista provisoria).`);
          const x = new Error(`PAUTADOR rechazó la clave del servicio (${st})`); x.codigo = 'clave_rechazada'; throw x;
        }
        if (st === 429 && intento === 0) { intento++; await esperar(reintentoMs); continue; }
        return conLista(email, 'PAUTADOR no contestó bien (' + (st ? 'código ' + st : String(e && e.message).slice(0, 80)) + ')');
      }
    }
  }
  accesosDe.vaciar = (m) => { if (real && real.vaciar) real.vaciar(m); };
  accesosDe.fuente = real ? (plan ? 'pautador+lista' : 'pautador') : (plan ? 'lista' : 'ninguna');
  accesosDe.salud = () => ({ degradado: salud.degradado, motivo: salud.motivo });
  return accesosDe;
}

// → { ok:false, motivo } | { ok:true, email, nombre, rol, global, proyectos:[{proyecto, canales[]}] }  (canales vacío = todos)
function permisosDe(r) {
  if (!r || typeof r !== 'object' || r.habilitado !== true) return { ok: false, motivo: 'sin_acceso' };
  const general = normal(r.rol);
  const base = { ok: true, email: r.email, nombre: r.nombre || '', rol: general };
  if (r.administradorGlobal === true && general === 'administrador') return { ...base, global: true, proyectos: [] };
  const filas = (Array.isArray(r.accesos) ? r.accesos : []).filter((a) => a && normal(a.proyecto))
    .filter((a) => ROLES_QUE_ENTRAN.includes(normal(a.rol) || general));
  if (!filas.length) return { ok: false, motivo: 'sin_acceso' };
  const por = new Map();
  for (const a of filas) {
    const k = normal(a.proyecto);
    const cans = (Array.isArray(a.canales) ? a.canales : []).map(normal).filter(Boolean);
    const previo = por.get(k);
    if (!previo) por.set(k, { proyecto: a.proyecto, canales: new Set(cans), todos: !cans.length });
    else { if (!cans.length) previo.todos = true; cans.forEach((c) => previo.canales.add(c)); }
  }
  return { ...base, global: false, proyectos: [...por.values()].map((x) => ({ proyecto: x.proyecto, canales: x.todos ? [] : [...x.canales].sort() })) };
}

module.exports = { crearAccesosDe, permisosDe, normal, estadoHttp, VIGENCIA_LISTA_MS };
