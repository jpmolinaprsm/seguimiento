// Prueba aislada del nexo con PAUTADOR (lado Seguimiento): Seguimiento/nexo/.
// No lee BigQuery, no arma la app, no llama a Meta ni a PAUTADOR: recomendaciones, anuncios y filas de alcance de mentira.
// Uso: node pruebas/nexo.js   (desde Seguimiento/app/). Termina en "problemas 0".
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const net = require('net');

// Candado: si algo intenta abrir una conexión de red, la prueba falla.
let conexiones = 0;
const bloquear = (obj, fn) => { const orig = obj[fn]; obj[fn] = function () { conexiones++; throw new Error(`red bloqueada en la prueba (${fn})`); }; return () => { obj[fn] = orig; }; };
const desbloquear = [bloquear(http, 'request'), bloquear(http, 'get'), bloquear(https, 'request'), bloquear(https, 'get'), bloquear(net, 'connect'), bloquear(net, 'createConnection')];
const fetchOriginal = globalThis.fetch;
globalThis.fetch = async () => { conexiones++; throw new Error('red bloqueada en la prueba (fetch)'); };

const N = require('../../nexo');

let problemas = 0, casos = 0;
const ok = (cond, texto) => { casos++; if (!cond) { problemas++; console.log('MAL  ' + texto); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexo-prueba-'));
let nTmp = 0;
const repoNuevo = () => N.crearRepositorioArchivo({ carpeta: path.join(tmp, 'r' + (nTmp++)) });

const AHORA = new Date('2026-10-01T14:00:00Z');   // 11:00 en Argentina
// Lista provisoria de mentira del sistema de usuarios (ningún mail real).
// Formato acordado con PAUTADOR (consulta-accesos.md, "Formato acordado").
const usuario = (email, rol, accesos, extra = {}) => ({ email, nombre: email.split('@')[0], habilitado: true, rol, administradorGlobal: false, superadministrador: false, accesos, ...extra });
const acc = (proyecto, extra = {}) => ({ proyecto, activo: null, rol: null, canales: [], ...extra });
const LISTA = [
  usuario('implementador@ejemplo.invalid', 'implementador', [acc('Santa Fe', { canales: ['Oficial', 'Informativo'] })]),
  usuario('a@ejemplo.invalid', 'implementador', [acc('Santa Fe')]),
  usuario('otro@ejemplo.invalid', 'implementador', [acc('Córdoba', { canales: ['Oficial'] })]),
  usuario('pm@ejemplo.invalid', 'pm_cuentas', [acc('Santa Fe', { canales: ['Oficial'] })]),
  usuario('baja@ejemplo.invalid', 'implementador', [acc('Santa Fe', { canales: ['Oficial'] })], { habilitado: false }),
  usuario('admin@ejemplo.invalid', 'administrador', [], { administradorGlobal: true }),
  usuario('soloinf@ejemplo.invalid', 'implementador', [acc('Santa Fe', { canales: ['Informativo'] })]),
];
const CTX = { pedidaPor: 'implementador@ejemplo.invalid', proyecto: 'Santa Fe', canal: 'Oficial', ahora: AHORA };
const conj = (nombre, anuncios, extra = {}) => ({ nombre, cod: nombre.split(' - ')[1] || null, anuncios, ...extra });
const C_A = 'GSFOFIBOB10983 - SFEOQQNQSK - Obras - Obras que Sí "Recorrida" (Video) - IG Reels - Interacciones - C/D';
const C_B = 'GSFOFIBOB10983 - SFEOQQNQSK - Obras - Obras que Sí "Recorrida" (Video) - FB Reels - Interacciones - C/D';
const C_C = 'GSFOFIBOB10947 - SFEMYQWAND - Obras - Obras que Sí "Norte" (Video) - FB Reels - Impresiones - C/D';
const C_D = 'GSFOFIBOB10950 - SFEAAAAAAA - Obras - Prueba D - FB Feed - Alcance - C/D';
const C_E = 'GSFOFIBOB10951 - SFEBBBBBBB - Obras - Prueba E - FB Feed - Alcance - C/D';
const C_F = 'GSFOFIBOB10952 - SFECCCCCCC - Obras - Prueba F - FB Feed - Alcance - C/D';
const tarjeta = (tipo, conjuntos, extra = {}) => ({ id: tipo.slice(0, 3) + '-prueba', tipo, title: `Obras que Sí: ${tipo}`, problema: `Problema de prueba (${tipo}).`,
  afectado: { campana: 'Obras que Sí', contenidos: [], conjuntos }, ...extra });

async function main() {
  // ---------- 1. Qué encaja y qué no ----------
  const c1 = tarjeta('Rinde por debajo', [conj(C_A, ['900000000000001'], { rol: 'pausar' }), conj(C_B, ['900000000000002'], { rol: 'pausar' }), conj(C_C, ['900000000000004'], { rol: 'reforzar' })]);
  const r1 = N.aSolicitud(c1, CTX);
  ok(r1.tipo === 'solicitud' && r1.solicitud.accion === 'Pausar' && r1.solicitud.regla === 'C1', 'C1 con pieza peor tiene que ser Pausar');
  ok(r1.tipo === 'solicitud' && r1.solicitud.objetivos.length === 2 && !r1.solicitud.objetivos.some((o) => o.conjunto === C_C), 'C1 pausa solo la peor pieza, no la que se refuerza');
  ok(N.aSolicitud(tarjeta('Rinde por debajo', [conj(C_A, ['900000000000001'])]), CTX).tipo === 'manual', 'C1 sin pieza peor tiene que ser tarea manual');
  for (const [tipo, regla, accion, pct] of [['Se desgastó', 'C3', 'Pausar', null], ['Presión acumulada alta', 'C7', 'Pausar', null], ['Mejor momento', 'C6', 'Cambiar presupuesto', 20], ['Se comparte', 'C10', 'Cambiar presupuesto', 20]]) {
    const r = N.aSolicitud(tarjeta(tipo, [conj(C_A, ['900000000000001']), conj(C_B, ['900000000000002'])]), CTX);
    ok(r.tipo === 'solicitud' && r.solicitud.regla === regla && r.solicitud.accion === accion && r.solicitud.cambio_pct === pct, `${regla} (${tipo}) tiene que ser ${accion}${pct ? ' +' + pct + ' %' : ''}`);
  }
  for (const tipo of ['Peor que la temporada anterior', 'Sin entrega', 'Apagón', 'Pico', 'Placements débiles', 'Sumar Facebook Reels', 'Genera conversación', 'Costo por objetivo', 'Se abandona temprano', 'Rotar contenidos', 'Una regla que todavía no existe']) {
    const r = N.aSolicitud(tarjeta(tipo, [conj(C_A, ['900000000000001'])]), CTX);
    ok(r.tipo === 'manual' && typeof r.motivo === 'string' && r.motivo.length > 10, `${tipo} tiene que ser tarea manual con motivo`);
  }
  ok(N.aSolicitud(tarjeta('Mejor momento', [conj(C_A, ['900000000000001'])], { plataforma: 'YouTube' }), CTX).tipo === 'manual', 'fuera de Meta tiene que ser tarea manual');
  ok(N.aSolicitud(tarjeta('Mejor momento', [conj(C_A, [])]), CTX).tipo === 'manual', 'sin ids de anuncio tiene que ser tarea manual');
  ok(N.aSolicitud(tarjeta('Mejor momento', []), CTX).tipo === 'manual', 'sin conjuntos tiene que ser tarea manual');
  let tiro = false; try { N.aSolicitud(c1, { ...CTX, pedidaPor: 'nadie' }); } catch (e) { tiro = true; }
  ok(tiro, 'sin mail de quien acepta no se arma la solicitud');

  // ---------- 2. Formato ----------
  const s = r1.solicitud;
  for (const k of ['id', 'recomendacion', 'pedida_por', 'proyecto', 'canal', 'plataforma', 'campana', 'accion', 'objetivos', 'motivo', 'creada']) ok(s[k] != null && s[k] !== '', `la solicitud tiene que traer ${k}`);
  ok(s.plataforma === 'Meta' && s.recomendacion === c1.id && s.pedida_por === CTX.pedidaPor && s.proyecto === 'Santa Fe' && s.canal === 'Oficial', 'datos de la solicitud');
  ok(s.objetivos[0].codigo === 'GSFOFIBOB10983' && s.objetivos[0].codigo_contenido === 'SFEOQQNQSK' && s.objetivos[0].anuncios[0] === '900000000000001', 'códigos e ids de anuncio');
  ok(s.valores === null && s.cambio_pct === null, 'Pausar no lleva porcentaje y los valores antes/después los completa PAUTADOR');
  ok(N.validarForma(s) === null, 'la solicitud armada pasa la revisión de forma');
  ok(/^sol-[0-9a-f]{16}$/.test(s.id) && s.id === N.aSolicitud(c1, CTX).solicitud.id, 'el id es estable para la misma recomendación el mismo día');
  ok(s.id !== N.aSolicitud(c1, { ...CTX, ahora: new Date('2026-10-02T14:00:00Z') }).solicitud.id, 'otro día, otro id');

  // ---------- 3. Tope de ±20 % y demás controles ----------
  const mm = tarjeta('Mejor momento', [conj(C_A, ['900000000000001'])]);
  ok(N.aSolicitud(mm, { ...CTX, cambioPct: 20 }).tipo === 'solicitud', '+20 % se permite');
  ok(N.aSolicitud(mm, { ...CTX, cambioPct: -20 }).tipo === 'solicitud', '−20 % se permite');
  for (const p of [21, -25, 50, 0, 'veinte']) { const r = N.aSolicitud(mm, { ...CTX, cambioPct: p }); ok(r.tipo === 'bloqueada' && r.control === 'D1', `${p} % tiene que quedar bloqueado`); }
  ok(N.validarForma({ ...N.aSolicitud(mm, CTX).solicitud, cambio_pct: 30 }) !== null, 'la revisión de forma rechaza más de 20 %');
  const fin = N.aSolicitud({ ...mm, fin: '2026-10-02' }, CTX);
  ok(fin.tipo === 'bloqueada' && fin.control === 'D3', 'en los últimos 2 días de la campaña queda bloqueada');
  ok(N.aSolicitud({ ...mm, fin: '2026-10-20' }, CTX).tipo === 'solicitud', 'lejos del fin se permite');

  // ---------- 4. Quién puede pedir ----------
  const ACCESOS = N.accesosDeLista(LISTA);
  const permiso = (mail, proyecto = 'Santa Fe', canal = 'Oficial', acc = ACCESOS) => N.revisarPermiso(acc, mail, proyecto, canal, { esperaMs: 200 });
  const p1 = await permiso('implementador@ejemplo.invalid');
  ok(p1.ok && p1.rol === 'implementador', 'el implementador del proyecto puede pedir');
  ok((await permiso('IMPLEMENTADOR@Ejemplo.invalid')).ok, 'el mail se compara sin mayúsculas');
  ok((await permiso('a@ejemplo.invalid', 'santa fe', 'Informativo')).ok, 'asignación sin canales vale para todos los canales; proyecto sin mayúsculas');
  const pAdm = await permiso('admin@ejemplo.invalid');
  ok(pAdm.ok && pAdm.rol === 'administrador', 'un administrador del proyecto puede pedir');
  const p2 = await permiso('otro@ejemplo.invalid');
  ok(!p2.ok && p2.codigo === 'otro_proyecto', 'el implementador de otro proyecto no puede pedir');
  const p2b = await permiso('soloinf@ejemplo.invalid');
  ok(!p2b.ok && p2b.codigo === 'otro_proyecto', 'el implementador de otro canal del mismo proyecto no puede pedir');
  const p3 = await permiso('pm@ejemplo.invalid');
  ok(!p3.ok && p3.codigo === 'rol_sin_permiso' && /solo el implementador/.test(p3.motivo), 'un PM del proyecto no puede pedir');
  const p4 = await permiso('baja@ejemplo.invalid');
  ok(!p4.ok && p4.codigo === 'inactivo', 'un implementador inactivo no puede pedir');
  const p5 = await permiso('nadie@ejemplo.invalid');
  ok(!p5.ok && p5.codigo === 'no_existe', 'un mail que no está en el sistema de usuarios no puede pedir');
  const p6 = await permiso('implementador@ejemplo.invalid', 'Santa Fe', 'Oficial', null);
  ok(!p6.ok && p6.codigo === 'sin_accesos', 'sin consulta de accesos no se puede pedir');
  const p7 = await permiso('implementador@ejemplo.invalid', 'Santa Fe', 'Oficial', async () => { throw new Error('PAUTADOR caído'); });
  ok(!p7.ok && p7.codigo === 'sin_respuesta', 'si la consulta de accesos falla, no se puede pedir');
  const p8 = await permiso('implementador@ejemplo.invalid', 'Santa Fe', 'Oficial', () => new Promise(() => {}));
  ok(!p8.ok && p8.codigo === 'sin_respuesta' && /tardó/.test(p8.motivo), 'si la consulta de accesos no contesta, no se puede pedir');
  const p9 = await permiso('implementador@ejemplo.invalid', 'Santa Fe', 'Oficial', async () => undefined);
  ok(!p9.ok && p9.codigo === 'sin_respuesta', 'si la consulta de accesos devuelve vacío, no se puede pedir');
  const p10 = await permiso('implementador@ejemplo.invalid', 'Santa Fe', 'Oficial', async () => ({ ...LISTA[0], email: 'otra@ejemplo.invalid' }));
  ok(!p10.ok, 'si la respuesta es de otro mail, no se puede pedir');

  // ---------- 4b. Formato acordado con PAUTADOR (consulta-accesos.md, "Formato acordado", 30/9) ----------
  const F = N.accesosDeLista([
    usuario('f.impl@ejemplo.invalid', 'implementador', [acc('Santa Fe')]),
    usuario('f.canal@ejemplo.invalid', 'implementador', [acc('Santa Fe', { canales: ['Oficial'] }), acc('Córdoba')]),
    usuario('f.pm@ejemplo.invalid', 'pm_cuentas', [acc('Santa Fe')]),
    usuario('f.admin@ejemplo.invalid', 'administrador', [], { administradorGlobal: true }),
    usuario('f.adminbaja@ejemplo.invalid', 'administrador', [], { administradorGlobal: true, habilitado: false }),
    usuario('f.adminnoglobal@ejemplo.invalid', 'administrador', [], { administradorGlobal: false }),
    usuario('f.adminsindato@ejemplo.invalid', 'administrador', []),
    usuario('f.adminfila@ejemplo.invalid', 'administrador', [acc('Santa Fe')], { administradorGlobal: false }),
    usuario('f.impl_global@ejemplo.invalid', 'implementador', [], { administradorGlobal: true }),
    usuario('f.pm_global@ejemplo.invalid', 'pm_cuentas', [], { administradorGlobal: true }),
    usuario('f.vacio@ejemplo.invalid', 'implementador', []),
    usuario('f.baja@ejemplo.invalid', 'implementador', [acc('Santa Fe')], { habilitado: false }),
    usuario('f.sinhab@ejemplo.invalid', 'implementador', [acc('Santa Fe')], { habilitado: undefined }),
    usuario('f.habtexto@ejemplo.invalid', 'implementador', [acc('Santa Fe')], { habilitado: 'true' }),
    usuario('f.activo@ejemplo.invalid', 'implementador', [acc('Santa Fe', { activo: 'gob_santa_fe' })]),
    usuario('f.mixto@ejemplo.invalid', 'implementador', [acc('Santa Fe', { rol: 'pm_cuentas' }), acc('Córdoba', { rol: 'implementador' })]),
    usuario('f.pmsube@ejemplo.invalid', 'pm_cuentas', [acc('Santa Fe', { rol: 'implementador' }), acc('Córdoba')]),
    usuario('f.dos@ejemplo.invalid', 'pm_cuentas', [acc('Santa Fe', { canales: ['Informativo'], rol: 'implementador' }), acc('Santa Fe', { canales: ['Oficial'] })]),
    usuario('f.sinrol@ejemplo.invalid', null, [acc('Santa Fe')]),
    usuario('f.raro@ejemplo.invalid', 'visitante', [acc('Santa Fe')]),
    usuario('f.sinonimo@ejemplo.invalid', 'admin', [], { administradorGlobal: true }),
    usuario('f.pm_sinonimo@ejemplo.invalid', 'implementador', [acc('Santa Fe', { rol: 'PM' })]),
    usuario('f.super_impl@ejemplo.invalid', 'implementador', [], { superadministrador: true }),
    usuario('f.super_pm@ejemplo.invalid', 'pm_cuentas', [acc('Santa Fe')], { superadministrador: true }),
    usuario('f.super_admin@ejemplo.invalid', 'administrador', [], { superadministrador: true, administradorGlobal: true }),
    usuario('f.super_baja@ejemplo.invalid', 'administrador', [], { superadministrador: true, administradorGlobal: true, habilitado: false }),
    // Nombres viejos que ya no se leen: "activo" como estado de la persona, "proyectos" en vez de "accesos", "admin_global", "mail".
    { email: 'f.viejo_activo@ejemplo.invalid', nombre: 'x', activo: true, rol: 'implementador', accesos: [acc('Santa Fe')] },
    { email: 'f.viejo_proyectos@ejemplo.invalid', nombre: 'x', habilitado: true, rol: 'implementador', proyectos: [{ proyecto: 'Santa Fe' }] },
    { email: 'f.viejo_global@ejemplo.invalid', nombre: 'x', habilitado: true, rol: 'administrador', admin_global: true, accesos: [] },
    { email: 'f.viejo_admin_sinfilas@ejemplo.invalid', nombre: 'x', habilitado: true, rol: 'administrador' },
    { email: 'f.accesos_raros@ejemplo.invalid', nombre: 'x', habilitado: true, rol: 'implementador', accesos: 'Santa Fe' },
  ]);
  const pf = (mail, proyecto = 'Santa Fe', canal = 'Oficial', opc = {}) => N.revisarPermiso(F, mail, proyecto, canal, { esperaMs: 200, ...opc });
  // Implementador
  const fa1 = await pf('f.impl@ejemplo.invalid');
  ok(fa1.ok && fa1.rol === 'implementador' && fa1.alcance === 'proyecto', 'acordado: el implementador de su proyecto puede pedir');
  ok((await pf('f.impl@ejemplo.invalid', 'Santa Fe', 'Informativo')).ok, 'acordado: canales [] = todos los canales');
  ok((await pf('f.impl@ejemplo.invalid', 'Córdoba')).codigo === 'otro_proyecto', 'acordado: el implementador no pide en un proyecto que no tiene');
  ok((await pf('f.canal@ejemplo.invalid')).ok, 'acordado: con canales cargados, pide en su canal');
  ok((await pf('f.canal@ejemplo.invalid', 'Santa Fe', 'Informativo')).codigo === 'otro_proyecto', 'acordado: con canales cargados, otro canal no pide');
  ok((await pf('f.canal@ejemplo.invalid', 'Córdoba', 'Informativo')).ok, 'acordado: la otra fila con canales [] vale para todos');
  // pm_cuentas nunca
  const fa2 = await pf('f.pm@ejemplo.invalid');
  ok(!fa2.ok && fa2.codigo === 'rol_sin_permiso' && /PM\/Cuentas/.test(fa2.motivo), 'acordado: pm_cuentas nunca pide');
  ok((await pf('f.pm_global@ejemplo.invalid', 'Mendoza')).codigo === 'otro_proyecto', 'acordado: pm_cuentas con administradorGlobal en verdadero no pide (no es administrador)');
  ok((await pf('f.impl_global@ejemplo.invalid', 'Mendoza')).codigo === 'otro_proyecto', 'acordado: administradorGlobal en verdadero no sirve si el rol general no es administrador');
  // Administrador global
  const fa3 = await pf('f.admin@ejemplo.invalid', 'Mendoza', 'Informativo');
  ok(fa3.ok && fa3.rol === 'administrador' && fa3.alcance === 'global', 'acordado: administrador global con accesos vacío pide en cualquier proyecto');
  ok((await pf('f.admin@ejemplo.invalid', 'Córdoba', '')).ok, 'acordado: administrador global, sin canal conocido');
  ok(!(await pf('f.admin@ejemplo.invalid', 'Córdoba', '')).aviso, 'acordado: administrador global sin canal: sin aviso');
  ok((await pf('f.adminbaja@ejemplo.invalid')).codigo === 'inactivo', 'acordado: administrador global con habilitado en falso no pide');
  ok((await pf('f.adminnoglobal@ejemplo.invalid')).codigo === 'otro_proyecto', 'acordado: administrador con administradorGlobal en falso y accesos vacío no pide');
  ok((await pf('f.adminsindato@ejemplo.invalid')).codigo === 'otro_proyecto', 'acordado: administrador sin administradorGlobal y accesos vacío no pide (ya no se deduce "global")');
  const fa4 = await pf('f.adminfila@ejemplo.invalid');
  ok(fa4.ok && fa4.rol === 'administrador' && fa4.alcance === 'proyecto', 'acordado: administrador no global pide donde tiene fila (rol null = el general)');
  ok((await pf('f.adminfila@ejemplo.invalid', 'Córdoba')).codigo === 'otro_proyecto', 'acordado: administrador no global no pide donde no tiene fila');
  // accesos vacío sin administradorGlobal
  ok((await pf('f.vacio@ejemplo.invalid')).codigo === 'otro_proyecto', 'acordado: accesos vacío sin administradorGlobal no habilita nada');
  // habilitado
  ok((await pf('f.baja@ejemplo.invalid')).codigo === 'inactivo', 'acordado: habilitado en falso no pide');
  ok((await pf('f.sinhab@ejemplo.invalid')).codigo === 'inactivo', 'acordado: sin dato de habilitado, no se da por habilitado');
  ok((await pf('f.habtexto@ejemplo.invalid')).codigo === 'inactivo', 'acordado: habilitado tiene que ser verdadero, no el texto "true"');
  // activo null / clave
  ok((await pf('f.activo@ejemplo.invalid', 'Santa Fe', 'Oficial', { activo: 'gob_santa_fe' })).ok, 'acordado: acceso a un activo: pide sobre ese activo');
  ok((await pf('f.activo@ejemplo.invalid', 'Santa Fe', 'Oficial', { activo: 'otro_activo' })).codigo === 'otro_proyecto', 'acordado: acceso a un activo: no pide sobre otro');
  ok((await pf('f.activo@ejemplo.invalid')).codigo === 'otro_proyecto', 'acordado: acceso a un activo: si no se sabe el activo del cambio, no pide');
  ok((await pf('f.impl@ejemplo.invalid', 'Santa Fe', 'Oficial', { activo: 'cualquiera' })).ok, 'acordado: activo null = todos los activos del proyecto');
  // rol null / rol por acceso
  ok((await pf('f.mixto@ejemplo.invalid')).codigo === 'rol_sin_permiso', 'acordado: el rol del acceso manda sobre el general (PM en ese proyecto no pide)');
  ok((await pf('f.mixto@ejemplo.invalid', 'Córdoba')).ok, 'acordado: la misma persona pide donde el acceso dice implementador');
  ok((await pf('f.pmsube@ejemplo.invalid')).ok, 'acordado: rol general pm_cuentas pero implementador en ese acceso: pide ahí');
  ok((await pf('f.pmsube@ejemplo.invalid', 'Córdoba')).codigo === 'rol_sin_permiso', 'acordado: rol null hereda pm_cuentas y no pide');
  ok((await pf('f.dos@ejemplo.invalid', 'Santa Fe', 'Informativo')).ok, 'acordado: dos filas del mismo proyecto, pide en el canal donde es implementador');
  ok((await pf('f.dos@ejemplo.invalid')).codigo === 'rol_sin_permiso', 'acordado: dos filas del mismo proyecto, en el canal donde es PM no pide');
  // Roles fuera de los tres acordados
  ok((await pf('f.sinrol@ejemplo.invalid')).codigo === 'rol_sin_permiso', 'acordado: sin rol general ni rol en el acceso, no pide');
  ok((await pf('f.raro@ejemplo.invalid')).codigo === 'rol_sin_permiso', 'acordado: un rol que no es uno de los tres no pide');
  ok((await pf('f.sinonimo@ejemplo.invalid', 'Mendoza')).codigo === 'otro_proyecto', 'acordado: "admin" ya no se toma como administrador');
  ok((await pf('f.pm_sinonimo@ejemplo.invalid')).codigo === 'rol_sin_permiso', 'acordado: "PM" en el acceso no es un rol acordado y no pide');
  // superadministrador: se lee, no da permisos
  ok((await pf('f.super_impl@ejemplo.invalid', 'Mendoza')).codigo === 'otro_proyecto', 'acordado: superadministrador no da permiso de pedir por sí solo');
  ok((await pf('f.super_pm@ejemplo.invalid')).codigo === 'rol_sin_permiso', 'acordado: superadministrador con rol pm_cuentas no pide');
  ok((await pf('f.super_admin@ejemplo.invalid', 'Mendoza')).ok, 'acordado: superadministrador que es administrador global pide por administradorGlobal');
  ok((await pf('f.super_baja@ejemplo.invalid')).codigo === 'inactivo', 'acordado: superadministrador con habilitado en falso no pide');
  // Nombres viejos ya no se leen
  ok((await pf('f.viejo_activo@ejemplo.invalid')).codigo === 'inactivo', 'acordado: "activo" como estado de la persona ya no cuenta, hace falta "habilitado"');
  ok((await pf('f.viejo_proyectos@ejemplo.invalid')).codigo === 'otro_proyecto', 'acordado: "proyectos" ya no se lee, solo "accesos"');
  ok((await pf('f.viejo_global@ejemplo.invalid', 'Mendoza')).codigo === 'otro_proyecto', 'acordado: "admin_global" ya no se lee, solo "administradorGlobal"');
  ok((await pf('f.viejo_admin_sinfilas@ejemplo.invalid', 'Mendoza')).codigo === 'otro_proyecto', 'acordado: administrador sin filas ni administradorGlobal ya no es global');
  ok((await pf('f.accesos_raros@ejemplo.invalid')).codigo === 'respuesta_invalida', 'acordado: accesos que no es una lista, no sale');
  ok((await pf('f.impl@ejemplo.invalid', 'Santa Fe', 'Oficial')).ok && (await N.revisarPermiso(async () => ({ ...usuario('f.impl@ejemplo.invalid', 'implementador', [acc('Santa Fe')]), email: undefined, mail: 'f.impl@ejemplo.invalid' }), 'f.impl@ejemplo.invalid', 'Santa Fe', 'Oficial', { esperaMs: 200 })).codigo === 'respuesta_invalida', 'acordado: respuesta con "mail" en vez de "email" no sale');
  ok((await pf('f.impl@ejemplo.invalid', '')).codigo === 'otro_proyecto', 'sin proyecto en el pedido, no pide');

  // Activo sin canal cargado (Valle 24, El Norte Ahora, Noticia Franca): no se bloquea por canal, pero queda aviso.
  const sc1 = await pf('f.canal@ejemplo.invalid', 'Santa Fe', '');
  ok(sc1.ok && /no se sabe el canal/i.test(sc1.aviso || ''), 'canal desconocido: no bloquea por canal y avisa');
  ok((await pf('f.canal@ejemplo.invalid', 'Santa Fe', null)).ok, 'canal nulo: tampoco bloquea');
  ok((await pf('f.mixto@ejemplo.invalid', 'Santa Fe', '')).codigo === 'rol_sin_permiso', 'canal desconocido no le da permiso a un PM');
  ok((await pf('f.pm@ejemplo.invalid', 'Santa Fe', '')).codigo === 'rol_sin_permiso', 'canal desconocido: pm_cuentas sigue sin pedir');
  ok(!(await pf('f.impl@ejemplo.invalid', 'Santa Fe', '')).aviso, 'canal desconocido con acceso a todos los canales: sin aviso');

  // De punta a punta: el administrador global pide y el simulador (que también revisa) lo aplica; el PM no sale; otro canal no sale.
  const nexoF = N.crearNexo({ env: {}, repositorio: repoNuevo(), reloj: () => AHORA, accesos: F });
  const recH = (id) => tarjeta('Se desgastó', [conj(C_A, ['900000000000001'])], { id });
  const ef1 = await nexoF.aceptar(recH('Seg-f-admin'), { ...CTX, pedidaPor: 'f.admin@ejemplo.invalid' });
  ok(ef1.tipo === 'solicitud' && ef1.envio.estado === 'aplicada', 'de punta a punta: el pedido del administrador global sale y se aplica');
  const ef2 = await nexoF.aceptar(recH('Seg-f-pm'), { ...CTX, pedidaPor: 'f.pm@ejemplo.invalid' });
  ok(ef2.tipo === 'sin_permiso' && ef2.codigo === 'rol_sin_permiso', 'de punta a punta: el pedido de un PM no sale');
  const nexoF2 = N.crearNexo({ env: {}, repositorio: repoNuevo(), reloj: () => AHORA, accesos: F });
  const ef3 = await nexoF2.aceptar(recH('Seg-f-canal'), { ...CTX, pedidaPor: 'f.canal@ejemplo.invalid' });
  ok(ef3.tipo === 'solicitud' && ef3.envio.estado === 'aplicada', 'de punta a punta: el implementador del canal pide y se aplica');
  const ef4 = await nexoF2.aceptar(recH('Seg-f-otrocanal'), { ...CTX, canal: 'Informativo', pedidaPor: 'f.canal@ejemplo.invalid' });
  ok(ef4.tipo === 'sin_permiso' && ef4.codigo === 'otro_proyecto', 'de punta a punta: en un canal que no tiene, no sale');
  const ef5 = await nexoF.aceptar(recH('Seg-f-vacio'), { ...CTX, pedidaPor: 'f.vacio@ejemplo.invalid' });
  ok(ef5.tipo === 'sin_permiso' && ef5.codigo === 'otro_proyecto', 'de punta a punta: accesos vacío sin administradorGlobal no sale ni se guarda');

  // aceptar() con cada rol: solo sale la del implementador (o administrador)
  const nexoP = N.crearNexo({ env: {}, repositorio: repoNuevo(), reloj: () => AHORA, accesos: ACCESOS });
  const recP = (id) => tarjeta('Se desgastó', [conj(C_A, ['900000000000001'])], { id });
  for (const [mail, codigo] of [['otro@ejemplo.invalid', 'otro_proyecto'], ['pm@ejemplo.invalid', 'rol_sin_permiso'], ['baja@ejemplo.invalid', 'inactivo'], ['nadie@ejemplo.invalid', 'no_existe']]) {
    const r = await nexoP.aceptar(recP('Seg-' + codigo), { ...CTX, pedidaPor: mail });
    ok(r.tipo === 'sin_permiso' && r.codigo === codigo && typeof r.motivo === 'string', `${mail}: no sale (${codigo})`);
  }
  ok(nexoP.repositorio.historial().length === 0, 'lo que no tiene permiso no se guarda ni se manda');
  const nexoSinAcc = N.crearNexo({ env: {}, repositorio: repoNuevo(), reloj: () => AHORA });
  const rsa = await nexoSinAcc.aceptar(recP('Seg-sinacc'), CTX);
  ok(rsa.tipo === 'sin_permiso' && rsa.codigo === 'sin_accesos' && nexoSinAcc.repositorio.historial().length === 0, 'sin función de accesos no sale ninguna solicitud');
  const eSinAcc = await nexoSinAcc.enviar(N.aSolicitud(recP('Seg-sinacc2'), CTX).solicitud);
  ok(eSinAcc.estado === 'no_enviada' && !eSinAcc.enviada && nexoSinAcc.repositorio.historial().length === 0, 'enviar() directo también revisa el permiso');
  const radm = await nexoP.aceptar(recP('Seg-admin'), { ...CTX, pedidaPor: 'admin@ejemplo.invalid' });
  ok(radm.tipo === 'solicitud' && radm.envio.estado === 'aplicada' && radm.envio.aprobada_por === 'admin@ejemplo.invalid', 'el administrador puede pedir y su pedido cuenta como la aprobación');
  // PAUTADOR (simulado) también revisa quién pide, aunque le llegue directo
  const simAcc = N.crearSimulador({ accesos: ACCESOS });
  const rPm = await simAcc.recibir(N.aSolicitud(recP('Seg-pm-directo'), { ...CTX, pedidaPor: 'pm@ejemplo.invalid' }).solicitud);
  ok(rPm.estado === 'rechazada_validacion' && /solo el implementador/.test(rPm.motivo), 'PAUTADOR (simulado) rechaza por validación el pedido de un PM que le llega directo');

  // ---------- 5. Envío simulado: estados y sin duplicados ----------
  const nexo = N.crearNexo({ env: {}, repositorio: repoNuevo(), reloj: () => AHORA, accesos: ACCESOS });
  ok(nexo.modo === 'simulado', 'sin configuración el modo es simulado');
  const sim = nexo.transporte;
  ok(sim.ejecucion === 'inmediata', 'el simulador por defecto ejecuta en el momento');
  ok(!N.ESTADOS.includes('pendiente_aprobacion') && !N.ESTADOS.includes('rechazada_persona') && !N.ESTADOS.includes('aprobada'), 'no hay paso de aprobación en el simulador');
  ok(typeof sim.aprobar === 'undefined' && typeof sim.rechazar === 'undefined', 'el simulador ya no tiene bandeja de aprobación');
  const e1 = await nexo.enviar(s);
  ok(e1.estado === 'aplicada' && e1.enviada, 'una solicitud válida del implementador se aplica sin segundo paso');
  ok(Array.isArray(e1.valores) && e1.valores.length === 2 && e1.valores.every((v) => v.antes === 'ACTIVE' && v.despues === 'PAUSED'), 'Pausar aplicada con antes y después');
  ok(e1.aprobada_por === s.pedida_por, 'quien pidió queda como quien aprobó');
  const est1 = nexo.repositorio.leerEstados(s.id).map((x) => x.estado);
  ok(est1[0] === 'por_enviar' && est1[est1.length - 1] === 'aplicada', 'se guarda antes de mandarse y después el estado');
  const hist1 = (await sim.consultar(s.id)).historial.map((h) => h.estado);
  ok(hist1.join(',') === 'recibida,aplicada', 'PAUTADOR (simulado) pasa por "recibida" y después "aplicada", sin aprobación en el medio');
  const e2 = await nexo.enviar(s);
  ok(e2.duplicada && !e2.enviada, 'la segunda vez no se manda de nuevo');
  const direct = await sim.recibir(s);
  ok(direct.duplicada && direct.estado === 'aplicada', 'si llega repetida a PAUTADOR, la ignora');
  ok((await sim.consultar(s.id)).historial.filter((h) => h.estado === 'aplicada').length === 1, 'se aplicó una sola vez');
  ok(nexo.repositorio.historial().length === 1, 'queda una sola solicitud guardada');
  const nLineas = nexo.repositorio.leerEstados(s.id).length;
  const ap = await nexo.consultar(s.id);
  ok(ap.estado === 'aplicada' && nexo.repositorio.leerEstados(s.id).length === nLineas, 'consultar sin cambios no agrega líneas');
  ok(nexo.repositorio.porRecomendacion(c1.id).length === 1 && nexo.repositorio.porRecomendacion(c1.id)[0].ultimo.estado === 'aplicada', 'Interfaz puede leer el estado por recomendación');

  // presupuesto: +20 % con antes y después
  const D5 = { ...CTX, ahora: new Date('2026-10-05T14:00:00Z') };
  const rp = await nexo.aceptar(tarjeta('Se comparte', [conj(C_C, ['900000000000002'])]), D5);
  const vp = rp.envio && rp.envio.valores;
  ok(rp.envio.estado === 'aplicada' && vp && vp[0].antes === 15000 && vp[0].despues === 18000 && vp[0].campo === 'presupuesto_diario', 'Cambiar presupuesto aplicada: 15.000 → 18.000');

  // control D2 con lo ya mandado: el mismo conjunto no se toca otra vez dentro de 3 días
  const d2 = await nexo.aceptar(tarjeta('Mejor momento', [conj(C_C, ['900000000000002'])], { id: 'Mej-otra' }), D5);
  ok(d2.tipo === 'bloqueada' && d2.control === 'D2', 'un cambio por conjunto cada 3 días');
  const d2b = await nexo.aceptar(tarjeta('Mejor momento', [conj(C_C, ['900000000000002'])], { id: 'Mej-otra' }), { ...CTX, ahora: new Date('2026-10-09T14:00:00Z') });
  ok(d2b.tipo === 'solicitud', 'pasados 3 días se permite');

  // rechazada por validación (cuenta no habilitada) y anuncio desconocido
  const rv = await nexo.aceptar(tarjeta('Presión acumulada alta', [conj(C_D, ['900000000000003'])], { id: 'Pre-val' }), CTX);
  ok(rv.envio.estado === 'rechazada_validacion' && /no está habilitada/.test(rv.envio.motivo), 'rechazada por validación: cuenta no habilitada');
  const rv2 = await nexo.aceptar(tarjeta('Presión acumulada alta', [conj(C_E, ['123'])], { id: 'Pre-val2' }), CTX);
  ok(rv2.envio.estado === 'rechazada_validacion' && /No se encontró/.test(rv2.envio.motivo), 'rechazada por validación: anuncio desconocido');
  const rv3 = await sim.recibir({ ...s, id: 'sol-a-mano', cambio_pct: null, accion: 'Cambiar presupuesto' });
  ok(rv3.estado === 'rechazada_validacion', 'PAUTADOR (simulado) también rechaza un cambio de presupuesto sin porcentaje válido');
  // una rechazada por validación no cuenta para el control D2
  ok((await nexo.aceptar(tarjeta('Se desgastó', [conj(C_D, ['900000000000003'])], { id: 'Seg-tras-val' }), CTX)).tipo === 'solicitud', 'lo rechazado por validación no bloquea otro pedido sobre el mismo conjunto');

  // falló (error de Meta)
  const rf = await nexo.aceptar(tarjeta('Se desgastó', [conj(C_F, ['900000000000004'])], { id: 'Seg-falla' }), CTX);
  ok(rf.envio.estado === 'fallo' && /revisión/.test(rf.envio.error), 'estado falló, con el error de Meta');

  // todos los estados del simulador aparecieron, y ninguno de aprobación
  const vistos = new Set();
  for (const h of nexo.repositorio.historial()) for (const x of (await sim.consultar(h.solicitud.id)).historial || []) vistos.add(x.estado);
  for (const e of N.ESTADOS) ok(vistos.has(e), `el simulador tiene que haber pasado por "${e}"`);
  for (const e of N.ESTADOS_SIN_USO) ok(!vistos.has(e), `el simulador no tiene que producir "${e}"`);

  // ejecución diferida: PAUTADOR contesta "recibida" y aplica después; Seguimiento lo ve al consultar
  const simD = N.crearSimulador({ ejecucion: 'diferida', accesos: ACCESOS });
  const nexoD = N.crearNexo({ env: {}, repositorio: repoNuevo(), transporte: simD, reloj: () => AHORA, accesos: ACCESOS });
  const eD = await nexoD.enviar(s);
  ok(eD.estado === 'recibida' && eD.enviada, 'con ejecución diferida queda "recibida"');
  ok((await nexoD.consultar(s.id)).estado === 'recibida', 'consultar mientras espera devuelve "recibida"');
  ok((await nexoD.enviar(s)).duplicada, 'mientras espera, no se vuelve a mandar');
  simD.ejecutar(s.id);
  const eD2 = await nexoD.consultar(s.id);
  ok(eD2.estado === 'aplicada' && eD2.valores.length === 2, 'después de ejecutar, consultar trae "aplicada" con antes y después');
  ok(nexoD.repositorio.leerEstados(s.id).map((x) => x.estado).join(',') === 'por_enviar,recibida,aplicada', 'en Seguimiento queda por enviar, recibida y aplicada');
  let tiroEj = false; try { simD.ejecutar(s.id); } catch (e) { tiroEj = true; }
  ok(tiroEj, 'no se puede ejecutar dos veces');
  // si PAUTADOR devolviera un estado que el contrato nombra pero Seguimiento no provoca, se guarda igual
  const simRaro = { modo: 'simulado', recibir: async (x) => ({ id: x.id, estado: 'rechazada_persona', motivo: 'Caso futuro.' }), consultar: async (id) => ({ id, estado: 'rechazada_persona', motivo: 'Caso futuro.' }) };
  const nexoRaro = N.crearNexo({ env: {}, repositorio: repoNuevo(), transporte: simRaro, reloj: () => AHORA, accesos: ACCESOS });
  ok((await nexoRaro.enviar(s)).estado === 'rechazada_persona', 'un estado del contrato fuera del recorrido se guarda tal cual');

  // reintento: si PAUTADOR no contestó, se vuelve a mandar con el MISMO id y sin duplicar
  let caido = true;
  const simB = N.crearSimulador();
  const flojo = { modo: 'simulado', recibir: async (x) => { if (caido) throw new Error('se cortó'); return simB.recibir(x); }, consultar: (id) => simB.consultar(id) };
  const nexoB = N.crearNexo({ env: {}, repositorio: repoNuevo(), transporte: flojo, reloj: () => AHORA, accesos: ACCESOS });
  const f1 = await nexoB.enviar(s);
  ok(f1.estado === 'sin_respuesta' && !f1.enviada, 'sin respuesta queda para reintentar');
  caido = false;
  const f2 = await nexoB.enviar({ ...s, motivo: 'otro texto' });
  ok(f2.estado === 'aplicada' && f2.id === s.id, 'el reintento usa el mismo id');
  ok((await simB.consultar(s.id)).historial.filter((h) => h.estado === 'recibida').length === 1, 'PAUTADOR la recibió una sola vez');
  ok(nexoB.repositorio.leerSolicitud(s.id).motivo === s.motivo, 'el reintento manda exactamente la solicitud guardada');
  // reintento de alguien que entre medio quedó sin permiso: no se manda
  let habilitado = true, caidoC = true;
  const accCambia = async () => ({ ...LISTA[0], habilitado });
  const simC = N.crearSimulador();
  const flojoC = { modo: 'simulado', recibir: async (x) => { if (caidoC) throw new Error('se cortó'); return simC.recibir(x); }, consultar: (id) => simC.consultar(id) };
  const nexoC = N.crearNexo({ env: {}, repositorio: repoNuevo(), transporte: flojoC, reloj: () => AHORA, accesos: accCambia });
  await nexoC.enviar(s);
  caidoC = false; habilitado = false;
  const fc = await nexoC.enviar(s);
  ok(fc.estado === 'no_enviada' && fc.codigo === 'inactivo' && (await simC.consultar(s.id)).estado === null, 'si quien pidió quedó inactivo antes del reintento, no se manda');

  // ---------- 6. Sin configuración nunca se manda nada real ----------
  ok(N.modoEfectivo({}) === 'simulado', 'sin variables: simulado');
  ok(N.modoEfectivo({ NEXO_MODO: 'real' }) === 'simulado', 'NEXO_MODO=real sin NEXO_URL: simulado');
  ok(N.modoEfectivo({ NEXO_URL: 'https://pautador.ejemplo.invalid' }) === 'simulado', 'con NEXO_URL pero sin NEXO_MODO=real: simulado');
  ok(N.modoEfectivo({ NEXO_MODO: 'real', NEXO_URL: '   ' }) === 'simulado', 'NEXO_URL vacía: simulado');
  let tiroSim = false; try { N.crearNexo({ env: {}, repositorio: repoNuevo(), transporte: { modo: 'real', recibir: async () => ({}) } }); } catch (e) { tiroSim = true; }
  ok(tiroSim, 'en modo simulado no se acepta otro transporte que el simulador');
  // aun con las dos variables, el envío real todavía no existe: se niega sin abrir conexiones
  const nexoR = N.crearNexo({ env: { NEXO_MODO: 'real', NEXO_URL: 'https://pautador.ejemplo.invalid' }, repositorio: repoNuevo(), reloj: () => AHORA, accesos: ACCESOS });
  ok(nexoR.modo === 'real', 'con NEXO_MODO=real y NEXO_URL el modo es real');
  const fr = await nexoR.enviar(s);
  ok(fr.estado === 'sin_respuesta' && !fr.enviada && /todavía no está construido/.test(fr.error), 'el envío real se niega (todavía no existe)');
  ok(conexiones === 0, `no se abrió ninguna conexión de red (se intentaron ${conexiones})`);

  // ---------- 7. Alcance: dato de hoy o "sin dato de hoy" (meta_alcance_diario + meta_alcance_corridas) ----------
  // Formato: contrato lectura-alcance-meta.md, "Cómo quedó construido". Filas de mentira, como las escribe PAUTADOR.
  const hoyAR = '2026-10-01', ayer = '2026-09-30', antesDeAyer = '2026-09-29';
  const desdeDe = { ultimos_7: '2026-09-24', ultimos_30: '2026-09-01', mes_en_curso: '2026-10-01', desde_inicio: '2023-10-01' };
  const ex = (alcance, impresiones) => ({ exacto: true, alcance, alcance_min: alcance, alcance_max: alcance, impresiones, frecuencia: alcance ? Math.round(impresiones / alcance * 1e4) / 1e4 : null,
    frecuencia_min: alcance ? Math.round(impresiones / alcance * 1e4) / 1e4 : null, frecuencia_max: alcance ? Math.round(impresiones / alcance * 1e4) / 1e4 : null, gasto: 1000 });
  const rango = (min, max, impresiones) => ({ exacto: false, alcance: null, alcance_min: min, alcance_max: max, impresiones, frecuencia: null,
    frecuencia_min: Math.round(impresiones / max * 1e4) / 1e4, frecuencia_max: Math.round(impresiones / min * 1e4) / 1e4, gasto: 2000 });
  const alc = (nivel, periodo, ids, valores, fecha = hoyAR) => ({ fecha_lectura: fecha, leido_en: fecha + 'T09:10:00Z', canal: 'Informativo', nivel, periodo,
    fecha_desde: fecha === hoyAR ? desdeDe[periodo] : '2026-09-23', fecha_hasta: fecha === hoyAR ? ayer : antesDeAyer, n_anuncios: null, ...ids, ...valores });
  const deCuenta = (cuenta, cliente, extra = {}) => ({ cliente, proyecto: 'Catamarca', activo_key: 'k-' + cuenta, activo: 'Activo ' + cuenta, cuenta_id: cuenta, cuentas: cuenta, n_cuentas: 1, ...extra });
  const entre = (cliente, cuentas, extra = {}) => ({ cliente, proyecto: 'Catamarca', activo_key: null, activo: null, cuenta_id: null, cuentas: cuentas.join(','), n_cuentas: cuentas.length, ...extra });
  const corrida = (cuenta, cliente, estado, fecha = hoyAR, extra = {}) => ({ fecha_lectura: fecha, leido_en: fecha + 'T09:10:00Z', canal: 'Informativo', cliente, activo_key: 'k-' + cuenta, cuenta_id: cuenta, estado, motivo: estado === 'ok' ? '' : 'detalle técnico', filas: 10, llamadas: 5, uso_max_pct: 12, ...extra });
  const COD = 'GSFOFIBOB10983';
  const CAT = 'Catamarca Provincia', SAL = 'Salta';
  const CORRIDAS = [
    corrida('act_1', CAT, 'ok'), corrida('act_2', CAT, 'ok'),
    corrida('act_3', SAL, 'ok'), corrida('act_4', SAL, 'error'),
    corrida('act_5', CAT, 'ok', ayer),   // corrida de ayer: no cuenta para hoy
  ];
  const FILAS = [
    alc('cuenta', 'ultimos_7', deCuenta('act_1', CAT), ex(1000, 2500)),
    alc('cuenta', 'ultimos_30', deCuenta('act_1', CAT), ex(0, 0)),                       // sin gasto en 30 días: 0 y 0 vale
    alc('cuenta', 'ultimos_7', deCuenta('act_2', CAT), ex(1500, 3500)),
    alc('cuenta', 'ultimos_30', deCuenta('act_2', CAT), ex(9999, 20000), ayer),            // de ayer: nunca se devuelve
    alc('campana', 'desde_inicio', deCuenta('act_1', CAT, { campana_id: 'c-1', campana_nombre: 'Campaña 1' }), ex(800, 2000)),
    alc('conjunto', 'ultimos_7', deCuenta('act_1', CAT, { campana_id: 'c-1', conjunto_id: 'cj-1', conjunto_nombre: 'Conjunto 1' }), ex(500, 1200)),
    alc('anuncio', 'ultimos_7', deCuenta('act_1', CAT, { campana_id: 'c-1', conjunto_id: 'cj-1', anuncio_id: 'ad-1', anuncio_nombre: COD + ' - pieza', codigo: COD }), ex(400, 900)),
    alc('cliente', 'ultimos_7', entre(CAT, ['act_1', 'act_2']), rango(1500, 2500, 6000)),
    alc('contenido', 'desde_inicio', entre(CAT, ['act_1', 'act_2'], { codigo: COD, comunicacion: 'Obras', n_anuncios: 3 }), rango(700, 1100, 3000)),
    alc('comunicacion', 'ultimos_30', entre(CAT, ['act_1'], { cuenta_id: 'act_1', activo_key: 'k-act_1', comunicacion: 'Obras', n_anuncios: 3 }), ex(900, 2700)),
    alc('cuenta', 'ultimos_7', deCuenta('act_3', SAL), ex(300, 600)),
    alc('cliente', 'ultimos_7', entre(SAL, ['act_3']), ex(300, 600)),                          // Salta perdió act_4: esta fila no vale
    alc('campana', 'ultimos_7', deCuenta('act_4', SAL, { campana_id: 'c-4' }), ex(100, 200)),   // cuenta con error: no vale
    alc('cuenta', 'ultimos_7', deCuenta('act_5', CAT), ex(100, 200)),                          // cuenta sin corrida de hoy: no vale
  ];
  const R = N.alcanceDeHoy({ alcance: FILAS, corridas: CORRIDAS }, { ahora: AHORA });
  ok(R.estado === 'parcial' && R.fecha === hoyAR, 'con una cuenta con error la lectura de hoy es parcial');
  ok(R.niveles.cuenta.length === 4 && R.niveles.campana.length === 1 && R.niveles.conjunto.length === 1 && R.niveles.anuncio.length === 1, 'niveles de cuenta: quedan solo las filas de cuentas leídas bien hoy');
  ok(R.niveles.cliente.length === 1 && R.niveles.contenido.length === 1 && R.niveles.comunicacion.length === 1, 'niveles entre cuentas: queda solo el cliente completo');
  ok(Object.values(R.niveles).flat().every((d) => d.fecha_lectura === hoyAR), 'ningún dato devuelto es de otro día');
  const dC = N.datoDeHoy(R, { nivel: 'cuenta', periodo: 'ultimos_7', cuenta_id: 'act_1' });
  ok(dC.estado === 'ok' && dC.dato.exacto === true && dC.dato.alcance === 1000 && dC.dato.frecuencia === 2.5 && !dC.dato.puede_contar_de_mas, 'cuenta: dato exacto de hoy');
  ok(N.datoDeHoy(R, { nivel: 'cuenta', periodo: 'ultimos_30', cuenta_id: 'act_1' }).dato.alcance === 0, 'alcance 0 con impresiones 0 es un dato válido');
  const dAyer = N.datoDeHoy(R, { nivel: 'cuenta', periodo: 'ultimos_30', cuenta_id: 'act_2' });
  ok(dAyer.estado === 'sin_dato_de_hoy' && !dAyer.dato, 'si solo hay dato de ayer: "sin dato de hoy", nunca el de ayer');
  const dCli = N.datoDeHoy(R, { nivel: 'cliente', periodo: 'ultimos_7', cliente: CAT, canal: 'Informativo' });
  ok(dCli.estado === 'ok' && dCli.dato.exacto === false && dCli.dato.puede_contar_de_mas === true && dCli.dato.alcance === null
    && dCli.dato.alcance_min === 1500 && dCli.dato.alcance_max === 2500 && dCli.dato.n_cuentas === 2, 'cliente con dos cuentas: rango entre la más grande y la suma, marcado no exacto');
  ok(dCli.dato.frecuencia === null && dCli.dato.frecuencia_min === 2.4 && dCli.dato.frecuencia_max === 4, 'cliente con dos cuentas: frecuencia como rango');
  ok(N.datoDeHoy(R, { nivel: 'cliente', periodo: 'ultimos_7', cliente: CAT }).estado === 'ok', 'cliente: sin canal alcanza si hay uno solo');
  const dCont = N.datoDeHoy(R, { nivel: 'contenido', periodo: 'desde_inicio', cliente: CAT, codigo: COD.toLowerCase() });
  ok(dCont.estado === 'ok' && dCont.dato.codigo === COD && dCont.dato.comunicacion === 'Obras' && !dCont.dato.exacto, 'contenido entre cuentas: rango, código sin importar mayúsculas');
  ok(N.datoDeHoy(R, { nivel: 'comunicacion', periodo: 'ultimos_30', cliente: CAT, comunicacion: 'Obras' }).dato.exacto === true, 'comunicación de una sola cuenta: exacta');
  const dSal = N.datoDeHoy(R, { nivel: 'cliente', periodo: 'ultimos_7', cliente: SAL, canal: 'Informativo' });
  ok(dSal.estado === 'sin_dato_de_hoy' && /act_4/.test(dSal.motivo), 'cliente al que le falta una cuenta: "sin dato de hoy" con el motivo');
  ok(N.datoDeHoy(R, { nivel: 'contenido', periodo: 'ultimos_7', cliente: SAL, codigo: COD }).estado === 'sin_dato_de_hoy', 'cliente incompleto: sin contenido');
  ok(R.clientes_sin_dato.length === 1 && R.clientes_sin_dato[0].cliente === SAL, 'lista de clientes sin dato de hoy');
  ok(R.descartadas.some((d) => d.fila.cliente === SAL && d.fila.nivel === 'cliente'), 'la fila de cliente incompleto se descarta aunque venga');
  const dAct4 = N.datoDeHoy(R, { nivel: 'campana', periodo: 'ultimos_7', campana_id: 'c-4', cuenta_id: 'act_4' });
  ok(dAct4.estado === 'sin_dato_de_hoy' && /dio error/.test(dAct4.motivo), 'campaña de una cuenta con error: "sin dato de hoy" con el motivo de la corrida');
  ok(R.cuentas.act_4 && R.cuentas.act_4.ok === false && R.cuentas.act_4.estado_lectura === 'error', 'estado por cuenta desde las corridas');
  ok(R.descartadas.some((d) => d.fila.cuenta_id === 'act_5' && /no tiene corrida de hoy/.test(d.motivo)), 'fila de una cuenta sin corrida de hoy: descartada');
  ok(N.datoDeHoy(R, { nivel: 'cuenta', periodo: 'ultimos_7', cuenta_id: 'act_5' }).estado === 'sin_dato_de_hoy', 'cuenta con corrida solo de ayer: "sin dato de hoy"');
  ok(!R.cuentas.act_5, 'la corrida de ayer no cuenta para hoy');
  ok(N.datoDeHoy(R, { nivel: 'conjunto', periodo: 'ultimos_30', conjunto_id: 'cj-1' }).estado === 'sin_dato_de_hoy', 'período que no se lee para ese nivel: "sin dato de hoy"');
  ok(N.datoDeHoy(R, { nivel: 'campana', periodo: 'ultimos_7', campana_id: 'c-99', cuenta_id: 'act_1' }).estado === 'sin_dato_de_hoy', 'campaña sin fila hoy: "sin dato de hoy"');

  // Todo leído y válido: estado ok
  const soloCat = N.alcanceDeHoy({ alcance: FILAS.filter((f) => f.cliente === CAT && f.cuenta_id !== 'act_5' && f.fecha_lectura === hoyAR), corridas: CORRIDAS.filter((c) => c.cliente === CAT) }, { ahora: AHORA });
  ok(soloCat.estado === 'ok' && !soloCat.descartadas.length, 'todas las cuentas leídas y filas válidas: estado ok');

  // "Sin dato de hoy" general
  ok(N.alcanceDeHoy({ alcance: FILAS.filter((f) => f.fecha_lectura === ayer), corridas: [corrida('act_2', CAT, 'ok', ayer)] }, { ahora: AHORA }).estado === 'sin_dato_de_hoy', 'solo lectura de ayer: "sin dato de hoy"');
  const sinCorr = N.alcanceDeHoy({ alcance: FILAS, corridas: [] }, { ahora: AHORA });
  ok(sinCorr.estado === 'sin_dato_de_hoy' && /estado de las cuentas/.test(sinCorr.motivo) && !Object.values(sinCorr.niveles).flat().length, 'filas de hoy sin corridas: "sin dato de hoy", sin números');
  ok(N.alcanceDeHoy(FILAS, { ahora: AHORA }).estado === 'sin_dato_de_hoy', 'si llegan solo las filas de alcance (sin corridas): "sin dato de hoy"');
  ok(N.alcanceDeHoy({ alcance: [], corridas: [] }, { ahora: AHORA }).estado === 'sin_dato_de_hoy', 'tablas vacías: "sin dato de hoy"');
  ok(N.alcanceDeHoy(null, { ahora: AHORA }).estado === 'sin_dato_de_hoy', 'lectura fallida: "sin dato de hoy"');
  const temprano = N.alcanceDeHoy({ alcance: [], corridas: [corrida('act_1', CAT, 'ok', ayer)] }, { ahora: new Date('2026-10-01T07:30:00Z') });   // 4:30 en Argentina
  ok(temprano.estado === 'sin_dato_de_hoy' && /6:00/.test(temprano.motivo), 'antes de las 6:00 todavía no hay lectura de hoy');
  const enCurso = N.alcanceDeHoy({ alcance: [], corridas: [corrida('act_1', CAT, 'ok', ayer)] }, { ahora: new Date('2026-10-01T10:30:00Z') });   // 7:30 en Argentina
  ok(enCurso.estado === 'sin_dato_de_hoy' && /9:00/.test(enCurso.motivo), 'entre las 6:00 y las 9:00 sin corridas: la lectura todavía no terminó');
  const todasMal = N.alcanceDeHoy({ alcance: [], corridas: [corrida('act_1', CAT, 'frenada'), corrida('act_2', CAT, 'saltada_por_publicacion')] }, { ahora: AHORA });
  ok(todasMal.estado === 'sin_dato_de_hoy' && /ninguna cuenta/.test(todasMal.motivo) && todasMal.cuentas.act_2.ok === false && /publicando/.test(todasMal.cuentas.act_2.motivo), 'ninguna cuenta leída: "sin dato de hoy", con el motivo por cuenta');
  // 01:00 UTC del 2 de octubre es 22:00 del 1 en Argentina: "hoy" es el 1
  ok(N.alcanceDeHoy({ alcance: FILAS, corridas: CORRIDAS }, { ahora: new Date('2026-10-02T01:00:00Z') }).fecha === hoyAR, 'el día se cuenta en hora argentina');
  const primero = N.alcanceDeHoy({ alcance: [alc('cuenta', 'ultimos_7', deCuenta('act_1', CAT), ex(1, 1))], corridas: [corrida('act_1', CAT, 'ok')] }, { ahora: AHORA });
  ok(/primer día del mes/.test(N.datoDeHoy(primero, { nivel: 'cuenta', periodo: 'mes_en_curso', cuenta_id: 'act_1' }).motivo), 'el día 1 no hay mes en curso y se explica');

  // Corridas raras
  const corrRep = N.alcanceDeHoy({ alcance: [alc('cuenta', 'ultimos_7', deCuenta('act_1', CAT), ex(1000, 2500))], corridas: [corrida('act_1', CAT, 'ok'), corrida('act_1', CAT, 'error')] }, { ahora: AHORA });
  ok(corrRep.estado === 'sin_dato_de_hoy' && corrRep.corridas_con_problemas.length === 1, 'corrida repetida con un error: la cuenta queda sin dato');
  const corrRara = N.alcanceDeHoy({ alcance: [alc('cuenta', 'ultimos_7', deCuenta('act_1', CAT), ex(1000, 2500))], corridas: [corrida('act_1', CAT, 'rarisimo')] }, { ahora: AHORA });
  ok(corrRara.estado === 'sin_dato_de_hoy' && corrRara.cuentas.act_1.ok === false, 'estado de corrida desconocido: no cuenta como ok');

  // Validaciones fila por fila
  const base = (extra = {}) => ({ ...alc('cuenta', 'ultimos_7', deCuenta('act_1', CAT), ex(1000, 2500)), ...extra });
  const baseRango = (extra = {}) => ({ ...alc('cliente', 'ultimos_7', entre(CAT, ['act_1', 'act_2']), rango(1500, 2500, 6000)), ...extra });
  ok(N.problemaDeFila(base()) === null && N.problemaDeFila(baseRango()) === null, 'las filas de mentira base son válidas');
  const malas = [
    ['alcance mayor que impresiones', base({ alcance: 3000, alcance_min: 3000, alcance_max: 3000, frecuencia: 0.8333, frecuencia_min: 0.8333, frecuencia_max: 0.8333 }), /mayor que las impresiones/],
    ['frecuencia que no cierra', base({ frecuencia: 9, frecuencia_min: 9, frecuencia_max: 9 }), /frecuencia no cierra/],
    ['frecuencia faltante con alcance', base({ frecuencia: null }), /sin frecuencia/],
    ['frecuencia mínima distinta en fila exacta', base({ frecuencia_min: 2 }), /frecuencia mínima y máxima/],
    ['impresiones sin alcance', base({ alcance: 0, alcance_min: 0, alcance_max: 0, frecuencia: null, frecuencia_min: null, frecuencia_max: null }), /impresiones sin alcance/],
    ['rango distinto del alcance en fila exacta', base({ alcance_max: 1200 }), /rango tiene que ser igual/],
    ['rango con mínimo mayor que máximo', baseRango({ alcance_min: 3000, alcance_max: 2500, frecuencia_max: 2 }), /mínimo es mayor que el máximo/],
    ['rango con máximo mayor que impresiones', baseRango({ alcance_max: 7000, frecuencia_min: 0.8571 }), /máximo es mayor que las impresiones/],
    ['rango con frecuencia mínima incoherente', baseRango({ frecuencia_min: 1.5 }), /frecuencia mínima no cierra/],
    ['rango con frecuencia máxima incoherente', baseRango({ frecuencia_max: 9 }), /frecuencia máxima no cierra/],
    ['rango sin mínimo', baseRango({ alcance_min: null }), /rango de alcance incompleto/],
    ['rango con alcance exacto', baseRango({ alcance: 2000 }), /no puede traer alcance exacto/],
    ['rango con frecuencia exacta', baseRango({ frecuencia: 3 }), /no puede traer frecuencia exacta/],
    ['exacta con dos cuentas', baseRango({ ...ex(2000, 6000) }), /exacta pero junta varias cuentas/],
    ['rango de una sola cuenta', { ...alc('cliente', 'ultimos_7', entre(CAT, ['act_1']), rango(1500, 2500, 6000)) }, /rango pero es de una sola cuenta/],
    ['nivel de cuenta como rango', base({ ...rango(1500, 2500, 6000), cuentas: 'act_1,act_2', n_cuentas: 2 }), /tiene que ser exacta/],
    ['sin marca exacto', base({ exacto: null }), /sin la marca exacto/],
    ['n_cuentas que no coincide', baseRango({ n_cuentas: 3 }), /cantidad de cuentas/],
    ['nivel desconocido', base({ nivel: 'otro' }), /nivel desconocido/],
    ['período que no va con el nivel', base({ nivel: 'conjunto', campana_id: 'c-1', conjunto_id: 'cj-1', periodo: 'ultimos_30', fecha_desde: '2026-09-01' }), /no corresponde al nivel/],
    ['período que no termina ayer', base({ fecha_hasta: '2026-10-01' }), /no termina el día anterior/],
    ['período al revés', base({ fecha_desde: '2026-10-05' }), /empieza después de terminar/],
    ['canal desconocido', base({ canal: 'Otro' }), /canal desconocido/],
    ['"Ambos" fuera del nivel cliente', base({ canal: 'Ambos' }), /solo existe en el nivel cliente/],
    ['cuenta sin id', base({ cuenta_id: '', cuentas: '' }), /sin cuenta/],
    ['anuncio sin id', { ...alc('anuncio', 'ultimos_7', deCuenta('act_1', CAT, { campana_id: 'c-1', conjunto_id: 'cj-1' }), ex(400, 900)) }, /sin anuncio/],
    ['contenido con código mal', { ...alc('contenido', 'ultimos_7', entre(CAT, ['act_1', 'act_2'], { codigo: 'CORTO' }), rango(700, 1100, 3000)) }, /código de contenido/],
    ['comunicación vacía', { ...alc('comunicacion', 'ultimos_7', entre(CAT, ['act_1', 'act_2']), rango(700, 1100, 3000)) }, /sin comunicación/],
    ['cliente vacío', baseRango({ cliente: '' }), /sin cliente/],
    ['impresiones que no son número', base({ impresiones: 'x' }), /impresiones no es/],
    ['gasto negativo', base({ gasto: -5 }), /gasto no es/],
    ['sin fecha de lectura', base({ fecha_lectura: null }), /sin fecha de lectura/],
  ];
  for (const [nombre, f, re] of malas) { const p = N.problemaDeFila(f); ok(p && re.test(p), `validación: ${nombre} (dio: ${p})`); }
  const conMalas = N.alcanceDeHoy({ alcance: malas.map((m) => m[1]).filter((f) => f.fecha_lectura), corridas: [corrida('act_1', CAT, 'ok'), corrida('act_2', CAT, 'ok')] }, { ahora: AHORA });
  ok(conMalas.estado === 'sin_dato_de_hoy' && conMalas.descartadas.length === malas.length - 1 && /errores en todas/.test(conMalas.motivo), 'si todas las filas de hoy vienen mal: "sin dato de hoy" con el detalle');

  // Repetidas por (fecha_lectura, nivel, período, id): se descartan todas las copias
  const rep = N.alcanceDeHoy({ alcance: [base(), base({ alcance: 900, alcance_min: 900, alcance_max: 900, frecuencia: 2.7778, frecuencia_min: 2.7778, frecuencia_max: 2.7778 }), base({ periodo: 'ultimos_30', fecha_desde: '2026-09-01' }),
    baseRango(), baseRango({ canal: 'Ambos' })], corridas: [corrida('act_1', CAT, 'ok'), corrida('act_2', CAT, 'ok')] }, { ahora: AHORA });
  ok(rep.estado === 'parcial' && rep.descartadas.length === 2 && rep.descartadas.every((d) => /repetida/.test(d.motivo)), 'fila repetida: se descartan las dos copias');
  ok(N.datoDeHoy(rep, { nivel: 'cuenta', periodo: 'ultimos_7', cuenta_id: 'act_1' }).estado === 'sin_dato_de_hoy', 'fila repetida: "sin dato de hoy" para esa cuenta y período');
  ok(N.datoDeHoy(rep, { nivel: 'cuenta', periodo: 'ultimos_30', cuenta_id: 'act_1' }).estado === 'ok', 'mismo id en otro período no es repetida');
  ok(rep.niveles.cliente.length === 2, 'mismo cliente en otro canal ("Ambos") no es repetida');
  ok(/canal/.test(N.datoDeHoy(rep, { nivel: 'cliente', periodo: 'ultimos_7', cliente: CAT }).motivo), 'cliente en dos canales sin indicar canal: pide el canal');

  // "Ambos": si el cliente perdió una cuenta en cualquier canal, no hay dato "Ambos"
  const ambos = N.alcanceDeHoy({ alcance: [{ ...alc('cliente', 'ultimos_7', entre(SAL, ['act_3']), ex(300, 600)), canal: 'Ambos' }], corridas: [corrida('act_3', SAL, 'ok'), corrida('act_9', SAL, 'error', hoyAR, { canal: 'Oficial' })] }, { ahora: AHORA });
  ok(ambos.estado === 'sin_dato_de_hoy' && N.datoDeHoy(ambos, { nivel: 'cliente', periodo: 'ultimos_7', cliente: SAL, canal: 'Ambos' }).estado === 'sin_dato_de_hoy', '"Ambos" con una cuenta caída en otro canal: sin dato');

  // Formatos como los devuelve BigQuery
  const bqFila = { ...baseRango(), fecha_lectura: { value: hoyAR }, exacto: 'false', alcance_min: '1500', alcance_max: '2500', impresiones: '6000', frecuencia_min: '2.4', frecuencia_max: '4', n_cuentas: '2', fecha_hasta: { value: ayer } };
  const bq = N.alcanceDeHoy({ alcance: [bqFila, { ...base(), exacto: 'true', alcance: '1000', impresiones: '2500', frecuencia: '2.5', alcance_min: '1000', alcance_max: '1000', frecuencia_min: '2.5', frecuencia_max: '2.5' }],
    corridas: [{ ...corrida('act_1', CAT, 'ok'), fecha_lectura: { value: hoyAR } }, corrida('act_2', CAT, 'ok')] }, { ahora: AHORA });
  ok(bq.estado === 'ok' && bq.niveles.cliente[0].alcance_max === 2500 && bq.niveles.cliente[0].exacto === false && bq.niveles.cuenta[0].impresiones === 2500 && bq.niveles.cuenta[0].exacto === true,
    'acepta números como texto, verdadero/falso como texto y fechas como { value }');

  // ---------- 7b. Alcance desde lo que baja Datos (alcanceMeta + alcanceCorridas + alcanceFecha + alcanceEstado) ----------
  const disp = (filas) => ({ disponible: true, filas });
  const noDisp = (motivo) => ({ disponible: false, motivo, detalle: 'Not found: Table ... (de mentira)' });
  const estadoCanal = (m, c) => ({ alcanceMeta: m, alcanceCorridas: c });
  const OF = (f) => ({ ...f, canal: 'Oficial' });
  const FILAS_OF = [OF(alc('cuenta', 'ultimos_7', deCuenta('act_7', 'Gobierno de Santa Fe'), ex(2000, 5000)))];
  const CORR_OF = [corrida('act_7', 'Gobierno de Santa Fe', 'ok', hoyAR, { canal: 'Oficial' })];
  const extraccion = (extra = {}) => ({ alcanceFecha: hoyAR, alcanceMeta: [...FILAS, ...FILAS_OF], alcanceCorridas: [...CORRIDAS, ...CORR_OF],
    alcanceEstado: { Oficial: estadoCanal(disp(1), disp(1)), Informativo: estadoCanal(disp(FILAS.length), disp(CORRIDAS.length)) }, ...extra });

  // Los dos canales leídos: da lo mismo que alcanceDeHoy con las dos tablas juntas
  const X1 = N.alcanceDeExtraccion(extraccion(), { ahora: AHORA });
  const R1 = N.alcanceDeHoy({ alcance: [...FILAS, ...FILAS_OF], corridas: [...CORRIDAS, ...CORR_OF] }, { ahora: AHORA });
  ok(X1.estado === R1.estado && JSON.stringify(X1.niveles) === JSON.stringify(R1.niveles) && X1.descartadas.length === R1.descartadas.length, 'extracción con los dos canales: mismo resultado que alcanceDeHoy');
  ok(X1.canales.Oficial.disponible && X1.canales.Informativo.disponible && X1.canales_sin_dato.length === 0, 'extracción con los dos canales: los dos disponibles');
  ok(N.datoDeHoy(X1, { nivel: 'cuenta', periodo: 'ultimos_7', cuenta_id: 'act_7' }).dato.alcance === 2000, 'extracción: el dato de Oficial llega');
  const limpia = { alcanceFecha: hoyAR, alcanceMeta: [alc('cuenta', 'ultimos_7', deCuenta('act_1', CAT), ex(1000, 2500)), ...FILAS_OF], alcanceCorridas: [corrida('act_1', CAT, 'ok'), ...CORR_OF],
    alcanceEstado: { Oficial: estadoCanal(disp(1), disp(1)), Informativo: estadoCanal(disp(1), disp(1)) } };
  ok(N.alcanceDeExtraccion(limpia, { ahora: AHORA }).estado === 'ok', 'extracción sin problemas: estado ok');

  // Oficial todavía sin tabla (hasta el 14/10): Informativo sigue, Oficial "sin dato de hoy" con su motivo
  const X2 = N.alcanceDeExtraccion({ ...limpia, alcanceMeta: limpia.alcanceMeta.filter((f) => f.canal !== 'Oficial'), alcanceCorridas: limpia.alcanceCorridas.filter((c) => c.canal !== 'Oficial'),
    alcanceEstado: { Oficial: estadoCanal(noDisp('tabla inexistente'), noDisp('tabla inexistente')), Informativo: estadoCanal(disp(1), disp(1)) } }, { ahora: AHORA });
  ok(X2.estado === 'parcial' && X2.niveles.cuenta.length === 1 && X2.niveles.cuenta[0].cuenta_id === 'act_1', 'un canal sin tabla: el otro canal sigue, estado parcial');
  ok(X2.canales.Oficial.disponible === false && /Todavía no existe/.test(X2.canales.Oficial.motivo) && X2.canales_sin_dato.length === 1 && X2.canales_sin_dato[0].canal === 'Oficial', 'un canal sin tabla: queda marcado con su motivo');
  const dOf = N.datoDeHoy(X2, { nivel: 'cliente', periodo: 'ultimos_7', cliente: 'Gobierno de Santa Fe', canal: 'Oficial' });
  ok(dOf.estado === 'sin_dato_de_hoy' && /Oficial/.test(dOf.motivo) && /Todavía no existe/.test(dOf.motivo), 'preguntar por el canal sin tabla da "sin dato de hoy" con el motivo del canal');
  ok(N.datoDeHoy(X2, { nivel: 'cliente', periodo: 'ultimos_7', cliente: CAT, canal: 'Ambos' }).estado === 'sin_dato_de_hoy', '"Ambos" con un canal sin tabla: sin dato');

  // Los dos sin tabla: "sin dato de hoy" y el motivo nombra los dos canales
  const X3 = N.alcanceDeExtraccion({ alcanceFecha: hoyAR, alcanceMeta: [], alcanceCorridas: [],
    alcanceEstado: { Oficial: estadoCanal(noDisp('tabla inexistente'), noDisp('tabla inexistente')), Informativo: estadoCanal(noDisp('tabla inexistente'), noDisp('tabla inexistente')) } }, { ahora: AHORA });
  ok(X3.estado === 'sin_dato_de_hoy' && /Oficial/.test(X3.motivo) && /Informativo/.test(X3.motivo) && Object.values(X3.niveles).every((l) => !l.length), 'los dos canales sin tabla: sin dato de hoy, con los dos motivos');

  // Una tabla leída y la otra con error: ese canal no aporta nada (no se sabe si lo leído está completo)
  const X4 = N.alcanceDeExtraccion(extraccion({ alcanceEstado: { Oficial: estadoCanal(disp(1), disp(1)), Informativo: estadoCanal(disp(FILAS.length), noDisp('error de consulta')) } }), { ahora: AHORA });
  ok(X4.canales.Informativo.disponible === false && /error de consulta/.test(X4.canales.Informativo.motivo) && /corridas/.test(X4.canales.Informativo.motivo), 'corridas con error: el canal queda sin dato, con el motivo de la tabla que falló');
  ok(X4.estado === 'parcial' && X4.niveles.cuenta.length === 1 && X4.niveles.cuenta[0].canal === 'Oficial' && !X4.niveles.cliente.length, 'corridas con error: no queda ninguna fila de ese canal');
  ok(X4.descartadas.filter((x) => /error de consulta/.test(x.motivo)).length === FILAS.length, 'corridas con error: las filas de ese canal quedan como descartadas con el motivo');
  ok(N.datoDeHoy(X4, { nivel: 'cuenta', periodo: 'ultimos_7', cuenta_id: 'act_1', canal: 'Informativo' }).motivo === X4.canales.Informativo.motivo, 'dato de una cuenta del canal caído: el motivo es el del canal');

  // "Ambos" se saca si falta cualquiera de los dos canales
  const filaAmbos = { ...alc('cliente', 'ultimos_7', entre(CAT, ['act_1', 'act_7']), rango(2000, 3000, 7500)), canal: 'Ambos' };
  const X5 = N.alcanceDeExtraccion({ ...limpia, alcanceMeta: [...limpia.alcanceMeta, filaAmbos],
    alcanceEstado: { Oficial: estadoCanal(disp(2), disp(1)), Informativo: estadoCanal(noDisp('error de consulta'), noDisp('error de consulta')) } }, { ahora: AHORA });
  ok(!X5.niveles.cliente.length && X5.descartadas.some((x) => x.fila === filaAmbos && /Informativo/.test(x.motivo)), '"Ambos" con Informativo caído: se descarta con motivo');
  ok(N.alcanceDeExtraccion({ ...limpia, alcanceMeta: [...limpia.alcanceMeta, filaAmbos] }, { ahora: AHORA }).niveles.cliente.length === 1, '"Ambos" con los dos canales leídos: vale');

  // Datos de otro día, extracción vieja o incompleta
  const X6 = N.alcanceDeExtraccion({ ...limpia, alcanceFecha: ayer }, { ahora: AHORA });
  ok(X6.estado === 'sin_dato_de_hoy' && /se bajaron el 2026-09-30/.test(X6.motivo) && Object.values(X6.niveles).every((l) => !l.length), 'datos bajados otro día: sin dato de hoy, aunque las filas digan hoy');
  const X7 = N.alcanceDeExtraccion({ alcanceFecha: hoyAR, alcanceMeta: limpia.alcanceMeta, alcanceCorridas: limpia.alcanceCorridas }, { ahora: AHORA });
  ok(X7.estado === 'sin_dato_de_hoy' && /no trae el estado/.test(X7.motivo), 'extracción sin alcanceEstado: sin dato de hoy');
  const X8 = N.alcanceDeExtraccion({ ...limpia, alcanceEstado: { Informativo: estadoCanal(disp(1), disp(1)) } }, { ahora: AHORA });
  ok(X8.canales.Oficial.disponible === false && /no dice/.test(X8.canales.Oficial.motivo) && X8.niveles.cuenta.length === 1 && X8.niveles.cuenta[0].canal === 'Informativo', 'canal que falta en alcanceEstado: se toma como sin dato');
  const X9 = N.alcanceDeExtraccion({ ...limpia, alcanceEstado: { Oficial: estadoCanal({ disponible: 'true' }, disp(1)), Informativo: estadoCanal(disp(1), disp(1)) } }, { ahora: AHORA });
  ok(X9.canales.Oficial.disponible === false, 'disponible tiene que ser exactamente verdadero');
  for (const raro of [null, undefined, 'x', []]) {
    let r9, tiro9 = false; try { r9 = N.alcanceDeExtraccion(raro, { ahora: AHORA }); } catch (e) { tiro9 = true; }
    ok(!tiro9 && r9.estado === 'sin_dato_de_hoy', `entrada ${JSON.stringify(raro)}: sin dato de hoy, sin romperse`);
  }
  // Antes de las 6:00: aunque las tablas existan, todavía no hay lectura de hoy
  const X10 = N.alcanceDeExtraccion({ alcanceFecha: hoyAR, alcanceMeta: [], alcanceCorridas: [], alcanceEstado: { Oficial: estadoCanal(disp(0), disp(0)), Informativo: estadoCanal(disp(0), disp(0)) } }, { ahora: new Date('2026-10-01T07:00:00Z') });
  ok(X10.estado === 'sin_dato_de_hoy' && /6:00/.test(X10.motivo), 'tablas vacías antes de las 6:00: sin dato de hoy, todavía no se leyó');
  ok(/no trajo nada/.test(N.alcanceDeHoy({ alcance: [], corridas: [] }, { ahora: AHORA }).motivo), 'tablas vacías después de las 9:00: la lectura no trajo nada');
  ok(/todavía no terminó/.test(N.alcanceDeHoy({ alcance: [], corridas: [] }, { ahora: new Date('2026-10-01T10:00:00Z') }).motivo), 'tablas vacías entre las 6:00 y las 9:00: la lectura todavía no terminó');
  // No cambia lo que recibe
  const antes = JSON.stringify(extraccion());
  const entradaX = extraccion(); N.alcanceDeExtraccion(entradaX, { ahora: AHORA });
  ok(JSON.stringify(entradaX) === antes, 'no modifica los datos que recibe');

  // ---------- 1b. Id del conjunto de Meta (conjuntoId) e ids de anuncio (ads), como los baja Datos ----------
  // Anuncios del simulador: 900000000000001 → cj-1, 900000000000002 → cj-2 (nexo/simulador.js).
  const cj = (nombre, ads, conjuntoId, extra = {}) => ({ nombre, cod: nombre.split(' - ')[1] || null, ads, conjuntoId, ...extra });
  const b1 = N.aSolicitud(tarjeta('Mejor momento', [cj(C_A, '900000000000001', 'cj-1'), cj(C_B, '900000000000002', 'cj-2')], { id: 'cj-b1' }), CTX);
  ok(b1.tipo === 'solicitud' && b1.solicitud.objetivos.map((o) => o.conjunto_id).join() === 'cj-1,cj-2' && b1.manuales.length === 0, 'un solo id de conjunto: va en la solicitud');
  ok(b1.solicitud.objetivos[0].anuncios.join() === '900000000000001' && N.validarForma(b1.solicitud) === null, 'ids de anuncio como texto (ads): se leen y la solicitud pasa la forma');
  const b2 = N.aSolicitud(tarjeta('Mejor momento', [cj(C_A, '900000000000001,900000000000005', 'cj-1,cj-9'), cj(C_B, '900000000000002', 'cj-2')], { id: 'cj-b2' }), CTX);
  ok(b2.tipo === 'solicitud' && b2.solicitud.objetivos.length === 1 && b2.solicitud.objetivos[0].conjunto === C_B, 'varios ids para un conjunto: ese conjunto no va en la solicitud');
  ok(b2.manuales.length === 1 && b2.manuales[0].conjunto === C_A && b2.manuales[0].conjunto_ids.join() === 'cj-1,cj-9' && /más de un conjunto con este nombre en Meta/.test(b2.manuales[0].motivo), 'varios ids: el conjunto queda como tarea manual con el motivo');
  ok(!b2.solicitud.objetivos.some((o) => o.anuncios.includes('900000000000001')), 'varios ids: sus anuncios tampoco van');
  const b3 = N.aSolicitud(tarjeta('Se desgastó', [cj(C_A, '900000000000001', 'cj-1, cj-9'), cj(C_B, '900000000000002', ['cj-2', 'cj-8'])], { id: 'cj-b3' }), CTX);
  ok(b3.tipo === 'manual' && /más de un conjunto con el mismo nombre/.test(b3.motivo) && b3.manuales.length === 2, 'todos con varios ids: la recomendación entera es tarea manual');
  const b4 = N.aSolicitud(tarjeta('Rinde por debajo', [cj(C_A, '900000000000001', 'cj-1,cj-9', { rol: 'pausar' }), cj(C_C, '900000000000004', 'cj-4,cj-7', { rol: 'reforzar' })], { id: 'cj-b4' }), CTX);
  ok(b4.tipo === 'manual' && /cj-1, cj-9/.test(b4.motivo), 'C1 con la pieza a pausar en varios conjuntos: tarea manual con los ids');
  const b5 = N.aSolicitud(tarjeta('Rinde por debajo', [cj(C_A, '900000000000001', 'cj-1', { rol: 'pausar' }), cj(C_C, '900000000000004', 'cj-4,cj-7', { rol: 'reforzar' })], { id: 'cj-b5' }), CTX);
  ok(b5.tipo === 'solicitud' && b5.manuales.length === 0, 'C1: un conjunto a reforzar con varios ids no molesta (no se toca)');
  const b6 = N.aSolicitud(tarjeta('Mejor momento', [conj(C_A, ['900000000000001'])], { id: 'cj-b6' }), CTX);
  ok(b6.tipo === 'solicitud' && b6.solicitud.objetivos[0].conjunto_id === null && N.validarForma(b6.solicitud) === null, 'sin conjuntoId (tarjeta de antes): se manda igual, sin id de conjunto');
  const b7 = N.aSolicitud(tarjeta('Mejor momento', [{ nombre: C_A, anuncios: [' 900000000000001', '', '900000000000001', 900000000000002], conjunto_id: ['cj-1'] }], { id: 'cj-b7' }), CTX);
  ok(b7.tipo === 'solicitud' && b7.solicitud.objetivos[0].anuncios.join() === '900000000000001,900000000000002' && b7.solicitud.objetivos[0].conjunto_id === 'cj-1', 'listas: sin vacíos, sin repetidos, todo como texto');
  const b8 = N.aSolicitud(tarjeta('Mejor momento', [cj(C_A, ' , ', 'cj-1')], { id: 'cj-b8' }), CTX);
  ok(b8.tipo === 'manual' && /Faltan los ids de anuncio/.test(b8.motivo), 'con id de conjunto pero sin ids de anuncio: tarea manual');
  const b9 = N.aSolicitud(tarjeta('Mejor momento', [cj(C_A, '900000000000001', ' , ')], { id: 'cj-b9' }), CTX);
  ok(b9.tipo === 'solicitud' && b9.solicitud.objetivos[0].conjunto_id === null, 'conjuntoId vacío: como si no viniera');
  ok(/un solo id de conjunto/.test(N.validarForma({ ...b1.solicitud, objetivos: [{ ...b1.solicitud.objetivos[0], conjunto_id: 'cj-1,cj-9' }] }) || ''), 'la revisión de forma no deja pasar varios ids de conjunto');
  // D2 también se cruza por id de conjunto (mismo conjunto de Meta con otro nombre en la tarjeta)
  const histCj = [{ solicitud: { id: 'sol-viejo', creada: new Date(AHORA - 864e5).toISOString(), objetivos: [{ conjunto: 'otro nombre', conjunto_id: 'cj-1', anuncios: ['999'] }] }, ultimo: { estado: 'aplicada' } }];
  const b10 = N.aSolicitud(tarjeta('Mejor momento', [cj(C_A, '900000000000001', 'cj-1')], { id: 'cj-b10' }), { ...CTX, historial: histCj });
  ok(b10.tipo === 'bloqueada' && b10.control === 'D2', 'un cambio por conjunto cada 3 días: se reconoce el conjunto por su id');
  // De punta a punta con el simulador
  const nexoCj = N.crearNexo({ env: {}, repositorio: repoNuevo(), reloj: () => AHORA, accesos: ACCESOS });
  const ec1 = await nexoCj.aceptar(tarjeta('Mejor momento', [cj(C_A, '900000000000001,900000000000005', 'cj-1,cj-9'), cj(C_B, '900000000000002', 'cj-2')], { id: 'cj-e1' }), CTX);
  ok(ec1.tipo === 'solicitud' && ec1.envio.estado === 'aplicada' && ec1.envio.valores.length === 1 && ec1.envio.valores[0].conjunto_id === 'cj-2', 'de punta a punta: se aplica solo el conjunto con un id');
  ok(ec1.manuales.length === 1 && ec1.manuales[0].conjunto === C_A, 'de punta a punta: aceptar devuelve el conjunto que queda a mano');
  const nexoCj2 = N.crearNexo({ env: {}, repositorio: repoNuevo(), reloj: () => AHORA, accesos: ACCESOS });
  const ec2 = await nexoCj2.aceptar(tarjeta('Se desgastó', [cj(C_A, '900000000000001', 'cj-2')], { id: 'cj-e2' }), CTX);
  ok(ec2.envio.estado === 'rechazada_validacion' && /no es del conjunto cj-2/.test(ec2.envio.motivo), 'PAUTADOR (simulado) rechaza si el anuncio no es del conjunto indicado');

  // ---------- 8. Rutas para servir.js (sin levantar servidor) ----------
  const { manejar } = N.crearRutas({ nexo: N.crearNexo({ env: {}, repositorio: repoNuevo(), reloj: () => AHORA, accesos: ACCESOS }) });
  const resFalsa = () => { const r = { codigo: 0, cuerpo: null, writeHead(c) { r.codigo = c; }, end(t) { r.cuerpo = JSON.parse(t); r.listo(); } }; r.hecho = new Promise((ok2) => { r.listo = ok2; }); return r; };
  const reqFalso = (method, url, cuerpo) => { const EE = require('events'); const q = new EE(); Object.assign(q, { method, url, destroy() {} }); setImmediate(() => { if (cuerpo) q.emit('data', JSON.stringify(cuerpo)); q.emit('end'); }); return q; };
  const res1 = resFalsa();
  ok(manejar(reqFalso('POST', '/api/nexo/solicitud', { recomendacion: tarjeta('Mejor momento', [conj(C_A, ['900000000000001'])]), pedida_por: 'a@ejemplo.invalid', proyecto: 'Santa Fe', canal: 'Oficial' }), res1, '/api/nexo/solicitud'), 'la ruta de envío se atiende');
  await res1.hecho;
  ok(res1.codigo === 200 && res1.cuerpo.modo === 'simulado' && res1.cuerpo.envio.estado === 'aplicada', 'la ruta de envío responde el estado');
  const res2 = resFalsa();
  manejar(reqFalso('GET', '/api/nexo/estado?id=' + res1.cuerpo.solicitud.id), res2, '/api/nexo/estado');
  await res2.hecho;
  ok(res2.codigo === 200 && res2.cuerpo.estado === 'aplicada', 'la ruta de estado responde');
  const res3 = resFalsa();
  manejar(reqFalso('POST', '/api/nexo/solicitud', { recomendacion: tarjeta('Se comparte', [conj(C_A, ['900000000000001'])]), pedida_por: 'pm@ejemplo.invalid', proyecto: 'Santa Fe', canal: 'Oficial' }), res3, '/api/nexo/solicitud');
  await res3.hecho;
  ok(res3.codigo === 200 && res3.cuerpo.tipo === 'sin_permiso' && !res3.cuerpo.envio, 'la ruta de envío no manda el pedido de un PM');
  ok(manejar(reqFalso('GET', '/api/otra'), resFalsa(), '/api/otra') === false, 'las rutas que no son del nexo no se tocan');
  ok(conexiones === 0, 'al final, ninguna conexión de red');
}

main().catch((e) => { problemas++; console.log('MAL  la prueba se cortó: ' + (e.stack || e.message)); }).finally(() => {
  desbloquear.forEach((f) => f()); globalThis.fetch = fetchOriginal;
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`casos ${casos} · problemas ${problemas}`);
  process.exitCode = problemas ? 1 : 0;
});
