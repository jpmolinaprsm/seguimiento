// accesosDe(email): qué puede ver cada persona. Orden:
//   1. consulta a PAUTADOR (nexo/accesos.js), solo si NEXO_MODO=real con NEXO_URL y NEXO_CLAVE;
//   2. si está apagada o FALLA (no contesta, 401, 429, 5xx, formato raro): lista provisoria (nexo/accesos-lista.js);
//   3. si tampoco hay lista: nadie ve nada.
// Una respuesta válida de PAUTADOR que dice "no habilitado" NO cae a la lista: una baja es una baja.
// permisosDe() convierte la respuesta en lo que el servidor necesita: { global, rol, proyectos: [{ proyecto, canales }] }.
const { crearClienteAccesos } = require('../nexo/accesos');
const { crearAccesosDeLista } = require('../nexo/accesos-lista');

const normal = (x) => String(x == null ? '' : x).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const ROLES_QUE_ENTRAN = ['implementador', 'administrador'];   // PM/Cuentas todavía no entra (contrato consulta-accesos)

function crearAccesosDe({ env = process.env, fetch, registrar = () => {}, cliente, lista } = {}) {
  const real = cliente !== undefined ? cliente : crearClienteAccesos({ env, ...(fetch ? { fetch } : {}) });
  let plan = lista;
  if (plan === undefined) {
    try { plan = crearAccesosDeLista({ env }); } catch (e) { registrar('lista provisoria de accesos inválida: ' + e.message); plan = null; }
  }
  async function accesosDe(email) {
    if (real) {
      try { return await real(email); } catch (e) { registrar('consulta de accesos a PAUTADOR falló (' + e.message + '): se usa la lista provisoria'); }
    }
    if (plan) return plan(email);
    return null;   // sin fuente: nadie ve nada
  }
  accesosDe.vaciar = (m) => { if (real && real.vaciar) real.vaciar(m); };
  accesosDe.fuente = real ? (plan ? 'pautador+lista' : 'pautador') : (plan ? 'lista' : 'ninguna');
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

module.exports = { crearAccesosDe, permisosDe, normal };
