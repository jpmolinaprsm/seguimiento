// Nexo con PAUTADOR (lado Seguimiento) · mandar solicitudes y seguir su estado.
// Contrato: orquestacion/CONTRATOS/cambios-seguimiento-a-pautador.md. Variables (PLAN-RAILWAY, sección 5): NEXO_MODO, NEXO_URL, NEXO_CLAVE.
//
// Modo:
//   - 'simulado' por defecto, y SIEMPRE que falte NEXO_URL: habla con el PAUTADOR de mentira (nexo/simulador.js).
//   - 'real' solo con todos los candados (nexo/transporte-real.js): NEXO_MODO=real, NEXO_URL, NEXO_CLAVE, Railway y NODE_ENV=production.
//     Desde local nunca es real. Es HTTPS servidor a servidor con NEXO_CLAVE en el encabezado x-pautador-servicio.
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
const { crearAlmacen } = require('../base/almacen');
const { crearClienteAccesos, modoAccesos } = require('./accesos');
const { crearTransporteReal, candadosReal, enRailway } = require('./transporte-real');

// Estados que agrega Seguimiento (no vienen de PAUTADOR): 'por_enviar' (guardada, todavía sin respuesta) y 'sin_respuesta' (se
// intentó mandar y no contestó). Con cualquiera de los dos se puede reintentar.
const ESTADOS_LOCALES = ['por_enviar', 'sin_respuesta'];
// El contrato todavía nombra "pendiente de aprobación" (si algún día pide otro rol) y "rechazada por una persona". Seguimiento no los
// provoca (solo manda pedidos de quien puede aprobar) y el simulador no los produce; si PAUTADOR los devolviera, se guardan igual.
const ESTADOS_SIN_USO = ['pendiente_aprobacion', 'rechazada_persona'];

// Real SOLO con todos los candados (nexo/transporte-real.js): NEXO_MODO=real, NEXO_URL, NEXO_CLAVE, Railway y NODE_ENV=production.
// Desde una compu local, siempre simulado, aunque alguien ponga NEXO_MODO=real.
function modoEfectivo(env = process.env) {
  return candadosReal(env).ok ? 'real' : 'simulado';
}

// Se envian los pedidos? Local: el simulador siempre. En Railway (real o simulado): solo con NEXO_ENVIO=1, que se prende cuando
// Auditoria aprueba y Juan Pablo prende NEXO_CAMBIOS en PAUTADOR. Mientras tanto la app muestra los pedidos en "solo ver".
function envioHabilitado(env = process.env) {
  if (!enRailway(env)) return true;
  return String(env.NEXO_ENVIO || '').trim() === '1';
}

const MOTIVO_ENVIO_APAGADO = 'Todavía no se envían los pedidos a PAUTADOR: el envío se prende cuando Auditoría lo apruebe. Por ahora es solo para ver.';

// opciones: { env, repositorio, transporte, reloj, accesos, conjuntosPorId }. En pruebas se pasan repositorio, transporte y accesos;
// si no, los de siempre. accesos: función async (mail) → accesos de esa persona según PAUTADOR (ver revisarPermiso en
// nexo/solicitud.js). Por defecto (1/10): en modo real con NEXO_CLAVE, la consulta a PAUTADOR con memoria de 5 minutos
// (nexo/accesos.js; fetch se puede pasar para las pruebas). En simulado no hay una por defecto: se pasa la lista de mentira
// (accesosDeLista) y, sin ella, no sale ninguna solicitud. El nexo devuelve la función en .accesos (con .vaciar() si es la real).
// conjuntosPorId (N7, 1/10): las filas por id de conjunto que baja Extracción, o una función que las devuelve. Sirven para elegir el
// conjunto cuando un nombre tiene varios ids; sin ellas, ese conjunto queda a mano. Si aceptar() recibe ctx.conjuntosPorId, vale ese.
function crearNexo({ env = process.env, repositorio, transporte, reloj = () => new Date(), accesos = null, conjuntosPorId = null, fetch = undefined } = {}) {
  const modo = modoEfectivo(env);
  if (accesos == null && modoAccesos(env) === 'real') accesos = crearClienteAccesos({ env, ...(fetch ? { fetch } : {}) });
  // Registro de pedidos: el que se pase; si no, el almacen de Seguimiento (base Supabase con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY,
  // archivo en local). Todos los metodos se esperan con await, asi sirve el repositorio de archivo (sincrono) y el de la base (con promesa).
  const repo = repositorio || crearAlmacen({ env, reloj }).nexo;
  const t = transporte || (modo === 'real' ? crearTransporteReal({ env, ...(fetch ? { fetch } : {}) }) : crearSimulador({ reloj, accesos }));
  const envioOk = envioHabilitado(env);
  const enVuelo = new Map();   // id -> envio en curso: dos toques seguidos no mandan dos veces
  if (modo === 'simulado' && t.modo !== 'simulado') throw new Error('nexo: en modo simulado solo se acepta el simulador');

  const guardarSiCambia = async (id, r) => {
    const u = await repo.ultimoEstado(id);
    const e = { estado: r.estado, motivo: r.motivo || null, error: r.error || null, valores: r.valores || null, aprobada_por: r.aprobada_por || null, modo: t.modo };
    if (!u || u.estado !== e.estado || JSON.stringify(u.valores || null) !== JSON.stringify(e.valores)) { await repo.guardarEstado(id, e); return e; }
    return u;
  };

  const sinPermiso = (id, p) => ({ id, estado: 'no_enviada', codigo: p.codigo, motivo: p.motivo, enviada: false });

  // permiso: si ya se revisó en aceptar(), se pasa para no preguntar dos veces. Si no, se revisa acá (también en cada reintento: una
  // persona dada de baja entre medio ya no puede mandar).
  async function enviar(solicitud, permiso) {
    if (!envioOk) return { id: solicitud && solicitud.id, estado: 'no_enviada', codigo: 'envio_apagado', motivo: MOTIVO_ENVIO_APAGADO, enviada: false };
    const id = solicitud && solicitud.id;
    if (id && enVuelo.has(id)) return enVuelo.get(id);
    const prom = enviarUna(solicitud, permiso);
    if (id) { enVuelo.set(id, prom); prom.then(() => enVuelo.delete(id), () => enVuelo.delete(id)); }
    return prom;
  }

  async function enviarUna(solicitud, permiso) {
    const p = permiso || await revisarPermiso(accesos, solicitud && solicitud.pedida_por, solicitud && solicitud.proyecto, solicitud && solicitud.canal);
    if (!p.ok) return sinPermiso(solicitud && solicitud.id, p);
    const previa = await repo.leerSolicitud(solicitud.id);
    const u = previa ? await repo.ultimoEstado(solicitud.id) : null;
    if (u && !ESTADOS_LOCALES.includes(u.estado)) return { id: solicitud.id, ...u, duplicada: true, enviada: false };
    let nueva = false;
    // Id unico en la base: guardarSolicitud devuelve false si otro ya la habia guardado (por ejemplo, otra copia del servidor).
    // Entonces no se manda: se devuelve lo que ya tiene ese id.
    if (!previa) {
      nueva = (await repo.guardarSolicitud(solicitud)) !== false;
      if (nueva) await repo.guardarEstado(solicitud.id, { estado: 'por_enviar', modo: t.modo });
      else {
        const otro = await repo.ultimoEstado(solicitud.id);
        if (!otro || !ESTADOS_LOCALES.includes(otro.estado)) return { id: solicitud.id, ...(otro || {}), duplicada: true, enviada: false };
      }
    }
    const s = previa || solicitud;   // si se reintenta, va exactamente la misma que quedó guardada
    let r;
    try { r = await t.recibir(s); } catch (e) {
      const est = { estado: 'sin_respuesta', error: e.message, modo: t.modo };
      await repo.guardarEstado(s.id, est);
      return { id: s.id, ...est, enviada: false };
    }
    const est = await guardarSiCambia(s.id, r);
    return { id: s.id, ...est, duplicada: !!r.duplicada, enviada: true };
  }

  async function consultar(id) {
    if (!(await repo.leerSolicitud(id))) return null;
    let r;
    try { r = await t.consultar(id); } catch (e) { return { id, ...(await repo.ultimoEstado(id)), error_consulta: e.message }; }
    if (!r || !r.estado) return { id, ...(await repo.ultimoEstado(id)), error_consulta: (r && r.motivo) || 'PAUTADOR no devolvió estado.' };
    return { id, ...(await guardarSiCambia(id, r)) };
  }

  // Todo junto: quién pide → la recomendación aceptada → solicitud (o tarea manual / bloqueada) → envío.
  //   { tipo: 'sin_permiso', codigo, motivo } si quien pide no es implementador o administrador del proyecto, está inactivo o no se
  //   pudo saber su rol. No se arma ni se guarda nada.
  async function aceptar(rec, ctx = {}) {
    const permiso = await revisarPermiso(accesos, ctx.pedidaPor, ctx.proyecto, ctx.canal);
    if (!permiso.ok) return { tipo: 'sin_permiso', codigo: permiso.codigo, motivo: permiso.motivo };
    const porId = ctx.conjuntosPorId != null ? ctx.conjuntosPorId : (typeof conjuntosPorId === 'function' ? conjuntosPorId() : conjuntosPorId);
    const r = aSolicitud(rec, { ...ctx, ahora: ctx.ahora || reloj(), historial: await repo.historial(), conjuntosPorId: porId });
    if (r.tipo !== 'solicitud') return r;
    return { tipo: 'solicitud', solicitud: r.solicitud, manuales: r.manuales || [], elegidos: r.elegidos || [], envio: await enviar(r.solicitud, permiso) };
  }

  return { modo, envioHabilitado: envioOk, transporte: t, repositorio: repo, accesos, enviar, consultar, aceptar };
}

module.exports = { crearNexo, modoEfectivo, envioHabilitado, MOTIVO_ENVIO_APAGADO, ESTADOS_LOCALES, ESTADOS_SIN_USO };
