// Nexo con PAUTADOR (lado Seguimiento) · mandar solicitudes y seguir su estado.
// Contrato: orquestacion/CONTRATOS/cambios-seguimiento-a-pautador.md. Variables (PLAN-RAILWAY, sección 5): NEXO_MODO, NEXO_URL, NEXO_CLAVE.
//
// Modo:
//   - 'simulado' por defecto, y SIEMPRE que falte NEXO_URL: habla con el PAUTADOR de mentira (nexo/simulador.js).
//   - 'real' solo con NEXO_MODO=real y NEXO_URL: todavía NO está construido. Hasta Railway (~14/10) no hay envío real: el transporte
//     real se niega sin abrir ninguna conexión. Cuando se construya: HTTPS servidor a servidor con NEXO_CLAVE en un encabezado.
//
// Reglas del contrato que cumple este archivo:
//   - Cada solicitud se guarda ANTES de mandarse, con su id.
//   - Un mismo id no se manda dos veces: si PAUTADOR ya respondió, se devuelve lo guardado sin volver a mandar. Si la vez anterior
//     no hubo respuesta (se cortó), se reintenta con el MISMO id; PAUTADOR ignora el repetido.
//   - Solo pide el implementador del proyecto (o un administrador), activo, según el sistema de usuarios de PAUTADOR. Su pedido cuenta
//     como la aprobación (decisión del 30/9). Si no se puede saber el rol, no se manda ni se guarda nada.
//
// Recorrido de estados: por_enviar → (sin_respuesta →) recibida → rechazada_validacion | aplicada | fallo.
const { aSolicitud, revisarPermiso } = require('./solicitud');
const { crearSimulador } = require('./simulador');
const { crearRepositorioArchivo } = require('./repositorio');
const { crearClienteAccesos } = require('./accesos');

// Estados que agrega Seguimiento (no vienen de PAUTADOR): 'por_enviar' (guardada, todavía sin respuesta) y 'sin_respuesta' (se
// intentó mandar y no contestó). Con cualquiera de los dos se puede reintentar.
const ESTADOS_LOCALES = ['por_enviar', 'sin_respuesta'];
// El contrato todavía nombra "pendiente de aprobación" (si algún día pide otro rol) y "rechazada por una persona". Seguimiento no los
// provoca (solo manda pedidos de quien puede aprobar) y el simulador no los produce; si PAUTADOR los devolviera, se guardan igual.
const ESTADOS_SIN_USO = ['pendiente_aprobacion', 'rechazada_persona'];

function modoEfectivo(env = process.env) {
  const pedido = String(env.NEXO_MODO || 'simulado').trim().toLowerCase();
  return pedido === 'real' && String(env.NEXO_URL || '').trim() ? 'real' : 'simulado';
}

// Transporte real: pendiente hasta que Seguimiento esté en Railway. No abre conexiones.
function transporteRealPendiente() {
  const no = async () => { throw new Error('El envío real a PAUTADOR todavía no está construido (se prende con Seguimiento en Railway).'); };
  return { modo: 'real', recibir: no, consultar: no };
}

// opciones: { env, repositorio, transporte, reloj, accesos, conjuntosPorId }. En pruebas se pasan repositorio, transporte y accesos;
// si no, los de siempre. accesos: función async (mail) → accesos de esa persona según PAUTADOR (ver revisarPermiso en
// nexo/solicitud.js). Por defecto (1/10): en modo real con NEXO_CLAVE, la consulta a PAUTADOR con memoria de 5 minutos
// (nexo/accesos.js; fetch se puede pasar para las pruebas). En simulado no hay una por defecto: se pasa la lista de mentira
// (accesosDeLista) y, sin ella, no sale ninguna solicitud. El nexo devuelve la función en .accesos (con .vaciar() si es la real).
// conjuntosPorId (N7, 1/10): las filas por id de conjunto que baja Extracción, o una función que las devuelve. Sirven para elegir el
// conjunto cuando un nombre tiene varios ids; sin ellas, ese conjunto queda a mano. Si aceptar() recibe ctx.conjuntosPorId, vale ese.
function crearNexo({ env = process.env, repositorio, transporte, reloj = () => new Date(), accesos = null, conjuntosPorId = null, fetch = undefined } = {}) {
  const modo = modoEfectivo(env);
  if (accesos == null && modo === 'real') accesos = crearClienteAccesos({ env, ...(fetch ? { fetch } : {}) });
  const repo = repositorio || crearRepositorioArchivo({ reloj });
  const t = transporte || (modo === 'real' ? transporteRealPendiente() : crearSimulador({ reloj, accesos }));
  if (modo === 'simulado' && t.modo !== 'simulado') throw new Error('nexo: en modo simulado solo se acepta el simulador');

  const guardarSiCambia = (id, r) => {
    const u = repo.ultimoEstado(id);
    const e = { estado: r.estado, motivo: r.motivo || null, error: r.error || null, valores: r.valores || null, aprobada_por: r.aprobada_por || null, modo: t.modo };
    if (!u || u.estado !== e.estado || JSON.stringify(u.valores || null) !== JSON.stringify(e.valores)) { repo.guardarEstado(id, e); return e; }
    return u;
  };

  const sinPermiso = (id, p) => ({ id, estado: 'no_enviada', codigo: p.codigo, motivo: p.motivo, enviada: false });

  // permiso: si ya se revisó en aceptar(), se pasa para no preguntar dos veces. Si no, se revisa acá (también en cada reintento: una
  // persona dada de baja entre medio ya no puede mandar).
  async function enviar(solicitud, permiso) {
    const p = permiso || await revisarPermiso(accesos, solicitud && solicitud.pedida_por, solicitud && solicitud.proyecto, solicitud && solicitud.canal);
    if (!p.ok) return sinPermiso(solicitud && solicitud.id, p);
    const previa = repo.leerSolicitud(solicitud.id);
    const u = previa ? repo.ultimoEstado(solicitud.id) : null;
    if (u && !ESTADOS_LOCALES.includes(u.estado)) return { id: solicitud.id, ...u, duplicada: true, enviada: false };
    if (!previa) { repo.guardarSolicitud(solicitud); repo.guardarEstado(solicitud.id, { estado: 'por_enviar', modo: t.modo }); }
    const s = previa || solicitud;   // si se reintenta, va exactamente la misma que quedó guardada
    let r;
    try { r = await t.recibir(s); } catch (e) {
      const est = { estado: 'sin_respuesta', error: e.message, modo: t.modo };
      repo.guardarEstado(s.id, est);
      return { id: s.id, ...est, enviada: false };
    }
    const est = guardarSiCambia(s.id, r);
    return { id: s.id, ...est, duplicada: !!r.duplicada, enviada: true };
  }

  async function consultar(id) {
    if (!repo.leerSolicitud(id)) return null;
    let r;
    try { r = await t.consultar(id); } catch (e) { return { id, ...repo.ultimoEstado(id), error_consulta: e.message }; }
    if (!r || !r.estado) return { id, ...repo.ultimoEstado(id), error_consulta: (r && r.motivo) || 'PAUTADOR no devolvió estado.' };
    return { id, ...guardarSiCambia(id, r) };
  }

  // Todo junto: quién pide → la recomendación aceptada → solicitud (o tarea manual / bloqueada) → envío.
  //   { tipo: 'sin_permiso', codigo, motivo } si quien pide no es implementador o administrador del proyecto, está inactivo o no se
  //   pudo saber su rol. No se arma ni se guarda nada.
  async function aceptar(rec, ctx = {}) {
    const permiso = await revisarPermiso(accesos, ctx.pedidaPor, ctx.proyecto, ctx.canal);
    if (!permiso.ok) return { tipo: 'sin_permiso', codigo: permiso.codigo, motivo: permiso.motivo };
    const porId = ctx.conjuntosPorId != null ? ctx.conjuntosPorId : (typeof conjuntosPorId === 'function' ? conjuntosPorId() : conjuntosPorId);
    const r = aSolicitud(rec, { ...ctx, ahora: ctx.ahora || reloj(), historial: repo.historial(), conjuntosPorId: porId });
    if (r.tipo !== 'solicitud') return r;
    return { tipo: 'solicitud', solicitud: r.solicitud, manuales: r.manuales || [], elegidos: r.elegidos || [], envio: await enviar(r.solicitud, permiso) };
  }

  return { modo, transporte: t, repositorio: repo, accesos, enviar, consultar, aceptar };
}

module.exports = { crearNexo, modoEfectivo, ESTADOS_LOCALES, ESTADOS_SIN_USO };
