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
  ok(R.niveles.cliente.length === 0 && R.niveles.contenido.length === 0 && R.niveles.comunicacion.length === 1, 'niveles entre cuentas: solo filas exactas (la comunicación de una cuenta); las de varias cuentas no entran');
  ok(R.entre_cuentas.length === 2 && R.entre_cuentas.every((x) => x.cliente === CAT && x.cuenta_ids.length === 2 && !('alcance' in x) && !('alcance_max' in x) && !('impresiones' in x)),
    'lo que corre en varias cuentas queda en entre_cuentas, sin ningún número');
  ok(Object.values(R.niveles).flat().every((d) => d.fecha_lectura === hoyAR), 'ningún dato devuelto es de otro día');
  const dC = N.datoDeHoy(R, { nivel: 'cuenta', periodo: 'ultimos_7', cuenta_id: 'act_1' });
  ok(dC.estado === 'ok' && dC.dato.exacto === true && dC.dato.alcance === 1000 && dC.dato.frecuencia === 2.5 && !('puede_contar_de_mas' in dC.dato) && !('alcance_min' in dC.dato) && !('alcance_max' in dC.dato),
    'cuenta: dato exacto de hoy, sin campos de rango');
  ok(N.datoDeHoy(R, { nivel: 'cuenta', periodo: 'ultimos_30', cuenta_id: 'act_1' }).dato.alcance === 0, 'alcance 0 con impresiones 0 es un dato válido');
  const dAyer = N.datoDeHoy(R, { nivel: 'cuenta', periodo: 'ultimos_30', cuenta_id: 'act_2' });
  ok(dAyer.estado === 'sin_dato' && !dAyer.dato, 'si solo hay dato de ayer: "sin dato de hoy", nunca el de ayer');
  const dCli = N.datoDeHoy(R, { nivel: 'cliente', periodo: 'ultimos_7', cliente: CAT, canal: 'Informativo' });
  ok(dCli.estado === 'por_cuenta' && !dCli.dato && dCli.cuentas.length === 2, 'cliente con dos cuentas: lista por cuenta, sin dato combinado');
  ok(JSON.stringify(dCli.cuentas) === JSON.stringify([
    { cuenta: 'Activo act_2', alcance: 1500, impresiones: 3500, frecuencia: 2.3333, periodo: 'ultimos_7', desde: '2026-09-24', hasta: ayer, gasto: 1000, canal: 'Informativo', fecha_lectura: hoyAR },
    { cuenta: 'Activo act_1', alcance: 1000, impresiones: 2500, frecuencia: 2.5, periodo: 'ultimos_7', desde: '2026-09-24', hasta: ayer, gasto: 1000, canal: 'Informativo', fecha_lectura: hoyAR },
  ]), 'cliente con dos cuentas: cada cuenta con su nombre legible y su alcance exacto, de mayor a menor (dio ' + JSON.stringify(dCli.cuentas) + ')');
  ok(dCli.cuentas.every((c) => !/act_/.test(c.cuenta.replace('Activo act_', ''))) && !JSON.stringify(dCli.cuentas).includes('"act_'), 'la lista por cuenta nunca muestra el id de la cuenta');
  ok(/2 cuentas/.test(dCli.motivo) && /no se suma/.test(dCli.motivo), 'por cuenta: el motivo explica que el alcance no se suma');
  ok(N.datoDeHoy(R, { nivel: 'cliente', periodo: 'ultimos_7', cliente: CAT }).estado === 'por_cuenta', 'cliente sin canal: también por cuenta');
  const dCont = N.datoDeHoy(R, { nivel: 'contenido', periodo: 'desde_inicio', cliente: CAT, codigo: COD.toLowerCase() });
  ok(dCont.estado === 'sin_dato_por_cuenta' && dCont.cuentas_involucradas.join() === 'Activo act_1,Activo act_2' && dCont.cuentas_con_dato.length === 0 && dCont.referencia === null
    && /Sin dato por cuenta todavía/.test(dCont.motivo) && !dCont.dato, 'contenido en dos cuentas sin filas por cuenta: "sin dato por cuenta todavía" (código sin importar mayúsculas)');
  ok(N.datoDeHoy(R, { nivel: 'comunicacion', periodo: 'ultimos_30', cliente: CAT, comunicacion: 'Obras' }).dato.exacto === true, 'comunicación de una sola cuenta: exacta');
  const dSal = N.datoDeHoy(R, { nivel: 'cliente', periodo: 'ultimos_7', cliente: SAL, canal: 'Informativo' });
  ok(dSal.estado === 'sin_dato' && /act_4/.test(dSal.motivo), 'cliente al que le falta una cuenta: "sin dato de hoy" con el motivo');
  ok(N.datoDeHoy(R, { nivel: 'contenido', periodo: 'ultimos_7', cliente: SAL, codigo: COD }).estado === 'sin_dato', 'cliente incompleto: sin contenido');
  ok(R.clientes_sin_dato.length === 1 && R.clientes_sin_dato[0].cliente === SAL, 'lista de clientes sin dato de hoy');
  ok(R.descartadas.some((d) => d.fila.cliente === SAL && d.fila.nivel === 'cliente'), 'la fila de cliente incompleto se descarta aunque venga');
  const dAct4 = N.datoDeHoy(R, { nivel: 'campana', periodo: 'ultimos_7', campana_id: 'c-4', cuenta_id: 'act_4' });
  ok(dAct4.estado === 'sin_dato' && /dio error/.test(dAct4.motivo), 'campaña de una cuenta con error: "sin dato de hoy" con el motivo de la corrida');
  ok(R.cuentas.act_4 && R.cuentas.act_4.ok === false && R.cuentas.act_4.estado_lectura === 'error', 'estado por cuenta desde las corridas');
  ok(R.descartadas.some((d) => d.fila.cuenta_id === 'act_5' && /no tiene corrida en la lectura de hoy/.test(d.motivo)), 'fila de una cuenta sin corrida de hoy: descartada');
  ok(N.datoDeHoy(R, { nivel: 'cuenta', periodo: 'ultimos_7', cuenta_id: 'act_5' }).estado === 'sin_dato', 'cuenta con corrida solo de ayer: "sin dato de hoy"');
  ok(!R.cuentas.act_5, 'la corrida de ayer no cuenta para hoy');
  ok(N.datoDeHoy(R, { nivel: 'conjunto', periodo: 'ultimos_30', conjunto_id: 'cj-1' }).estado === 'sin_dato', 'período que no se lee para ese nivel: "sin dato de hoy"');
  ok(N.datoDeHoy(R, { nivel: 'campana', periodo: 'ultimos_7', campana_id: 'c-99', cuenta_id: 'act_1' }).estado === 'sin_dato', 'campaña sin fila hoy: "sin dato de hoy"');

  // Todo leído y válido: estado ok
  const soloCat = N.alcanceDeHoy({ alcance: FILAS.filter((f) => f.cliente === CAT && f.cuenta_id !== 'act_5' && f.fecha_lectura === hoyAR), corridas: CORRIDAS.filter((c) => c.cliente === CAT) }, { ahora: AHORA });
  ok(soloCat.estado === 'ok' && !soloCat.descartadas.length, 'todas las cuentas leídas y filas válidas: estado ok');

  // "Sin dato de hoy" general
  // Solo lectura de ayer: desde el 3/10 vale, marcada con su fecha (casos completos en 7d)
  const soloAyer = N.alcanceDeHoy({ alcance: FILAS.filter((f) => f.fecha_lectura === ayer), corridas: [corrida('act_2', CAT, 'ok', ayer)] }, { ahora: AHORA });
  ok(soloAyer.estado === 'ok' && soloAyer.fechaLectura === ayer && soloAyer.deHoy === false, 'solo lectura de ayer: se usa la de ayer, con su fecha y deHoy = false');
  const sinCorr = N.alcanceDeHoy({ alcance: FILAS, corridas: [] }, { ahora: AHORA });
  ok(sinCorr.estado === 'sin_dato' && /estado de las cuentas/.test(sinCorr.motivo) && !Object.values(sinCorr.niveles).flat().length, 'filas de hoy sin corridas: "sin dato de hoy", sin números');
  ok(N.alcanceDeHoy(FILAS, { ahora: AHORA }).estado === 'sin_dato', 'si llegan solo las filas de alcance (sin corridas): "sin dato de hoy"');
  ok(N.alcanceDeHoy({ alcance: [], corridas: [] }, { ahora: AHORA }).estado === 'sin_dato', 'tablas vacías: "sin dato de hoy"');
  ok(N.alcanceDeHoy(null, { ahora: AHORA }).estado === 'sin_dato', 'lectura fallida: "sin dato de hoy"');
  const temprano = N.alcanceDeHoy({ alcance: [], corridas: [corrida('act_1', CAT, 'ok', ayer)] }, { ahora: new Date('2026-10-01T07:30:00Z') });   // 4:30 en Argentina
  ok(temprano.estado === 'sin_dato' && /6:00/.test(temprano.motivo), 'antes de las 6:00 todavía no hay lectura de hoy');
  const enCurso = N.alcanceDeHoy({ alcance: [], corridas: [corrida('act_1', CAT, 'ok', ayer)] }, { ahora: new Date('2026-10-01T10:30:00Z') });   // 7:30 en Argentina
  ok(enCurso.estado === 'sin_dato' && /9:00/.test(enCurso.motivo), 'entre las 6:00 y las 9:00 sin corridas: la lectura todavía no terminó');
  const todasMal = N.alcanceDeHoy({ alcance: [], corridas: [corrida('act_1', CAT, 'frenada'), corrida('act_2', CAT, 'saltada_por_publicacion')] }, { ahora: AHORA });
  ok(todasMal.estado === 'sin_dato' && /ninguna cuenta/.test(todasMal.motivo) && todasMal.cuentas.act_2.ok === false && /publicando/.test(todasMal.cuentas.act_2.motivo), 'ninguna cuenta leída: "sin dato de hoy", con el motivo por cuenta');
  // 01:00 UTC del 2 de octubre es 22:00 del 1 en Argentina: "hoy" es el 1
  ok(N.alcanceDeHoy({ alcance: FILAS, corridas: CORRIDAS }, { ahora: new Date('2026-10-02T01:00:00Z') }).fecha === hoyAR, 'el día se cuenta en hora argentina');
  const primero = N.alcanceDeHoy({ alcance: [alc('cuenta', 'ultimos_7', deCuenta('act_1', CAT), ex(1, 1))], corridas: [corrida('act_1', CAT, 'ok')] }, { ahora: AHORA });
  ok(/primer día del mes/.test(N.datoDeHoy(primero, { nivel: 'cuenta', periodo: 'mes_en_curso', cuenta_id: 'act_1' }).motivo), 'el día 1 no hay mes en curso y se explica');

  // Corridas raras
  const corrRep = N.alcanceDeHoy({ alcance: [alc('cuenta', 'ultimos_7', deCuenta('act_1', CAT), ex(1000, 2500))], corridas: [corrida('act_1', CAT, 'ok'), corrida('act_1', CAT, 'error')] }, { ahora: AHORA });
  ok(corrRep.estado === 'sin_dato' && corrRep.corridas_con_problemas.length === 1, 'corrida repetida con un error: la cuenta queda sin dato');
  const corrRara = N.alcanceDeHoy({ alcance: [alc('cuenta', 'ultimos_7', deCuenta('act_1', CAT), ex(1000, 2500))], corridas: [corrida('act_1', CAT, 'rarisimo')] }, { ahora: AHORA });
  ok(corrRara.estado === 'sin_dato' && corrRara.cuentas.act_1.ok === false, 'estado de corrida desconocido: no cuenta como ok');

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
    ['contenido por cuenta como rango', { ...alc('contenido_cuenta', 'ultimos_7', entre(CAT, ['act_1', 'act_2'], { codigo: COD }), rango(700, 1100, 3000)) }, /sin cuenta|tiene que ser exacta/],
    ['comunicación por cuenta sin cuenta', { ...alc('comunicacion_cuenta', 'ultimos_7', { ...deCuenta('act_1', CAT, { comunicacion: 'Obras' }), cuenta_id: '' }, ex(400, 900)) }, /sin cuenta/],
    ['contenido por cuenta sin código', { ...alc('contenido_cuenta', 'ultimos_7', deCuenta('act_1', CAT), ex(400, 900)) }, /código de contenido/],
    ['comunicación por cuenta sin cliente', { ...alc('comunicacion_cuenta', 'ultimos_7', deCuenta('act_1', '', { comunicacion: 'Obras' }), ex(400, 900)) }, /sin cliente/],
    ['contenido por cuenta con período de cuenta', { ...alc('contenido_cuenta', 'mes_en_curso', deCuenta('act_1', CAT, { codigo: COD }), ex(400, 900)) }, /no corresponde al nivel/],
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
  // Las filas de varias cuentas ya no se validan por sus números (nunca se usan): con números raros siguen diciendo en qué cuentas corre
  ok(N.problemaDeFila(baseRango({ alcance_min: 3000, alcance_max: 2500, frecuencia_min: null, frecuencia_max: null })) === null, 'fila de varias cuentas: sus números no se validan porque no se usan');
  ok(N.problemaDeFila({ ...alc('contenido_cuenta', 'desde_inicio', deCuenta('act_1', CAT, { codigo: COD, comunicacion: 'Obras' }), ex(400, 900)) }) === null
    && N.problemaDeFila({ ...alc('comunicacion_cuenta', 'ultimos_30', deCuenta('act_1', CAT, { comunicacion: 'Obras' }), ex(400, 900)) }) === null, 'filas por cuenta propuestas (contenido_cuenta, comunicacion_cuenta): válidas');
  const conMalas = N.alcanceDeHoy({ alcance: malas.map((m) => m[1]).filter((f) => f.fecha_lectura), corridas: [corrida('act_1', CAT, 'ok'), corrida('act_2', CAT, 'ok')] }, { ahora: AHORA });
  ok(conMalas.estado === 'sin_dato' && conMalas.descartadas.length === malas.length - 1 && /errores en todas/.test(conMalas.motivo), 'si todas las filas de hoy vienen mal: "sin dato de hoy" con el detalle');

  // Repetidas por (fecha_lectura, nivel, período, id): se descartan todas las copias
  const rep = N.alcanceDeHoy({ alcance: [base(), base({ alcance: 900, alcance_min: 900, alcance_max: 900, frecuencia: 2.7778, frecuencia_min: 2.7778, frecuencia_max: 2.7778 }), base({ periodo: 'ultimos_30', fecha_desde: '2026-09-01' }),
    baseRango(), baseRango({ canal: 'Ambos' })], corridas: [corrida('act_1', CAT, 'ok'), corrida('act_2', CAT, 'ok')] }, { ahora: AHORA });
  ok(rep.estado === 'parcial' && rep.descartadas.length === 2 && rep.descartadas.every((d) => /repetida/.test(d.motivo)), 'fila repetida: se descartan las dos copias');
  ok(N.datoDeHoy(rep, { nivel: 'cuenta', periodo: 'ultimos_7', cuenta_id: 'act_1' }).estado === 'sin_dato', 'fila repetida: "sin dato de hoy" para esa cuenta y período');
  ok(N.datoDeHoy(rep, { nivel: 'cuenta', periodo: 'ultimos_30', cuenta_id: 'act_1' }).estado === 'ok', 'mismo id en otro período no es repetida');
  ok(rep.entre_cuentas.length === 2, 'mismo cliente en otro canal ("Ambos") no es repetida');
  const dRep = N.datoDeHoy(rep, { nivel: 'cliente', periodo: 'ultimos_7', cliente: CAT });
  ok(dRep.estado === 'sin_dato_por_cuenta' && dRep.cuentas_con_dato.length === 0 && dRep.cuentas_involucradas.length === 2, 'cliente cuyas cuentas no tienen dato propio (fila repetida y sin fila): sin dato por cuenta, nunca el rango');

  // "Ambos": si el cliente perdió una cuenta en cualquier canal, no hay dato "Ambos"
  const ambos = N.alcanceDeHoy({ alcance: [{ ...alc('cliente', 'ultimos_7', entre(SAL, ['act_3']), ex(300, 600)), canal: 'Ambos' }], corridas: [corrida('act_3', SAL, 'ok'), corrida('act_9', SAL, 'error', hoyAR, { canal: 'Oficial' })] }, { ahora: AHORA });
  ok(ambos.estado === 'sin_dato' && N.datoDeHoy(ambos, { nivel: 'cliente', periodo: 'ultimos_7', cliente: SAL, canal: 'Ambos' }).estado === 'sin_dato', '"Ambos" con una cuenta caída en otro canal: sin dato');

  // Formatos como los devuelve BigQuery
  const bqFila = { ...baseRango(), fecha_lectura: { value: hoyAR }, exacto: 'false', alcance_min: '1500', alcance_max: '2500', impresiones: '6000', frecuencia_min: '2.4', frecuencia_max: '4', n_cuentas: '2', fecha_hasta: { value: ayer } };
  const bq = N.alcanceDeHoy({ alcance: [bqFila, { ...base(), exacto: 'true', alcance: '1000', impresiones: '2500', frecuencia: '2.5', alcance_min: '1000', alcance_max: '1000', frecuencia_min: '2.5', frecuencia_max: '2.5' }],
    corridas: [{ ...corrida('act_1', CAT, 'ok'), fecha_lectura: { value: hoyAR } }, corrida('act_2', CAT, 'ok')] }, { ahora: AHORA });
  ok(bq.estado === 'ok' && bq.entre_cuentas.length === 1 && bq.entre_cuentas[0].cuenta_ids.join() === 'act_1,act_2' && bq.entre_cuentas[0].con_dato_por_cuenta === false
    && bq.niveles.cuenta[0].impresiones === 2500 && bq.niveles.cuenta[0].exacto === true,
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
  ok(dOf.estado === 'sin_dato' && /Oficial/.test(dOf.motivo) && /Todavía no existe/.test(dOf.motivo), 'preguntar por el canal sin tabla da "sin dato de hoy" con el motivo del canal');
  ok(N.datoDeHoy(X2, { nivel: 'cliente', periodo: 'ultimos_7', cliente: CAT, canal: 'Ambos' }).estado === 'sin_dato', '"Ambos" con un canal sin tabla: sin dato');

  // Los dos sin tabla: "sin dato de hoy" y el motivo nombra los dos canales
  const X3 = N.alcanceDeExtraccion({ alcanceFecha: hoyAR, alcanceMeta: [], alcanceCorridas: [],
    alcanceEstado: { Oficial: estadoCanal(noDisp('tabla inexistente'), noDisp('tabla inexistente')), Informativo: estadoCanal(noDisp('tabla inexistente'), noDisp('tabla inexistente')) } }, { ahora: AHORA });
  ok(X3.estado === 'sin_dato' && /Oficial/.test(X3.motivo) && /Informativo/.test(X3.motivo) && Object.values(X3.niveles).every((l) => !l.length), 'los dos canales sin tabla: sin dato de hoy, con los dos motivos');

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
  const dX5 = X5.descartadas.find((x) => x.fila.canal === 'Ambos' && x.fila.nivel === 'cliente');
  ok(!X5.niveles.cliente.length && !X5.entre_cuentas.length && dX5 && /Informativo/.test(dX5.motivo), '"Ambos" con Informativo caído: se descarta con motivo');
  ok(!('alcance_max' in dX5.fila) && !('alcance_min' in dX5.fila) && !('impresiones' in dX5.fila) && !('gasto' in dX5.fila), 'la fila de varias cuentas descartada queda sin sus números');
  const X5b = N.alcanceDeExtraccion({ ...limpia, alcanceMeta: [...limpia.alcanceMeta, filaAmbos] }, { ahora: AHORA });
  ok(X5b.entre_cuentas.length === 1 && X5b.entre_cuentas[0].canal === 'Ambos', '"Ambos" con los dos canales leídos: vale (como lista de cuentas, sin números)');

  // Datos de otro día, extracción vieja o incompleta
  // Desde el 3/10 la fecha que manda es la de las filas (alcanceFecha es solo informativa): nunca se tira lo bajado por la fecha
  const X6 = N.alcanceDeExtraccion({ ...limpia, alcanceFecha: ayer }, { ahora: AHORA });
  ok(X6.estado === 'ok' && X6.fechaLectura === hoyAR && X6.deHoy === true, 'alcanceFecha distinta de las filas: manda la fecha de las filas');
  const X7 = N.alcanceDeExtraccion({ alcanceFecha: hoyAR, alcanceMeta: limpia.alcanceMeta, alcanceCorridas: limpia.alcanceCorridas }, { ahora: AHORA });
  ok(X7.estado === 'sin_dato' && /no trae el estado/.test(X7.motivo), 'extracción sin alcanceEstado: sin dato de hoy');
  const X8 = N.alcanceDeExtraccion({ ...limpia, alcanceEstado: { Informativo: estadoCanal(disp(1), disp(1)) } }, { ahora: AHORA });
  ok(X8.canales.Oficial.disponible === false && /no dice/.test(X8.canales.Oficial.motivo) && X8.niveles.cuenta.length === 1 && X8.niveles.cuenta[0].canal === 'Informativo', 'canal que falta en alcanceEstado: se toma como sin dato');
  const X9 = N.alcanceDeExtraccion({ ...limpia, alcanceEstado: { Oficial: estadoCanal({ disponible: 'true' }, disp(1)), Informativo: estadoCanal(disp(1), disp(1)) } }, { ahora: AHORA });
  ok(X9.canales.Oficial.disponible === false, 'disponible tiene que ser exactamente verdadero');
  for (const raro of [null, undefined, 'x', []]) {
    let r9, tiro9 = false; try { r9 = N.alcanceDeExtraccion(raro, { ahora: AHORA }); } catch (e) { tiro9 = true; }
    ok(!tiro9 && r9.estado === 'sin_dato', `entrada ${JSON.stringify(raro)}: sin dato de hoy, sin romperse`);
  }
  // Antes de las 6:00: aunque las tablas existan, todavía no hay lectura de hoy
  const X10 = N.alcanceDeExtraccion({ alcanceFecha: hoyAR, alcanceMeta: [], alcanceCorridas: [], alcanceEstado: { Oficial: estadoCanal(disp(0), disp(0)), Informativo: estadoCanal(disp(0), disp(0)) } }, { ahora: new Date('2026-10-01T07:00:00Z') });
  ok(X10.estado === 'sin_dato' && /6:00/.test(X10.motivo), 'tablas vacías antes de las 6:00: sin dato de hoy, todavía no se leyó');
  ok(/no trajo nada/.test(N.alcanceDeHoy({ alcance: [], corridas: [] }, { ahora: AHORA }).motivo), 'tablas vacías después de las 9:00: la lectura no trajo nada');
  ok(/todavía no terminó/.test(N.alcanceDeHoy({ alcance: [], corridas: [] }, { ahora: new Date('2026-10-01T10:00:00Z') }).motivo), 'tablas vacías entre las 6:00 y las 9:00: la lectura todavía no terminó');
  // No cambia lo que recibe
  const antes = JSON.stringify(extraccion());
  const entradaX = extraccion(); N.alcanceDeExtraccion(entradaX, { ahora: AHORA });
  ok(JSON.stringify(entradaX) === antes, 'no modifica los datos que recibe');

  // ---------- 7c. El alcance nunca se suma entre cuentas (decisión de Juan Pablo, 2/10) ----------
  // Una cuenta: dato exacto. Varias: lista por cuenta. Sin dato por cuenta: "sin dato por cuenta todavía" + lo que haya.
  const OFI = (f) => ({ ...f, canal: 'Oficial' });
  const cc = (nivel, periodo, cuenta, cliente, extra, valores) => alc(nivel, periodo, deCuenta(cuenta, cliente, extra), valores);
  const P_CORR = [corrida('act_1', CAT, 'ok'), corrida('act_2', CAT, 'ok'), corrida('act_8', CAT, 'ok', hoyAR, { canal: 'Oficial' }), corrida('act_3', SAL, 'ok')];
  const P_FILAS = [
    cc('cuenta', 'ultimos_7', 'act_1', CAT, {}, ex(1100, 2750)),
    cc('cuenta', 'ultimos_7', 'act_2', CAT, {}, ex(1300, 3900)),
    OFI(cc('cuenta', 'ultimos_7', 'act_8', CAT, {}, ex(700, 1750))),
    cc('cuenta', 'ultimos_7', 'act_3', SAL, {}, ex(300, 600)),
    cc('cuenta', 'ultimos_30', 'act_1', CAT, {}, ex(2100, 6300)),
    cc('cuenta', 'ultimos_30', 'act_2', CAT, {}, ex(2900, 8700)),
    alc('cliente', 'ultimos_7', entre(CAT, ['act_1', 'act_2']), rango(1300, 2400, 6650)),
    { ...alc('cliente', 'ultimos_7', entre(CAT, ['act_1', 'act_2', 'act_8']), rango(1300, 3100, 8400)), canal: 'Ambos' },
    alc('cliente', 'ultimos_7', entre(SAL, ['act_3'], { cuenta_id: 'act_3', activo: 'Activo act_3' }), ex(300, 600)),
    // contenido desde el inicio: en dos cuentas, con fila por cuenta de las dos
    alc('contenido', 'desde_inicio', entre(CAT, ['act_1', 'act_2'], { codigo: COD, comunicacion: 'Obras' }), rango(500, 900, 2190)),
    cc('contenido_cuenta', 'desde_inicio', 'act_1', CAT, { codigo: COD, comunicacion: 'Obras' }, ex(400, 1040)),
    cc('contenido_cuenta', 'desde_inicio', 'act_2', CAT, { codigo: COD, comunicacion: 'Obras' }, ex(500, 1150)),
    // contenido últimos 7: en dos cuentas, fila por cuenta solo de una
    alc('contenido', 'ultimos_7', entre(CAT, ['act_1', 'act_2'], { codigo: COD, comunicacion: 'Obras' }), rango(250, 450, 900)),
    cc('contenido_cuenta', 'ultimos_7', 'act_1', CAT, { codigo: COD, comunicacion: 'Obras' }, ex(200, 400)),
    // comunicación últimos 30: en dos cuentas, sin filas por cuenta (como hoy)
    alc('comunicacion', 'ultimos_30', entre(CAT, ['act_1', 'act_2'], { comunicacion: 'Obras' }), rango(1700, 3000, 7000)),
    // comunicación últimos 7: en dos cuentas, con fila por cuenta de las dos
    alc('comunicacion', 'ultimos_7', entre(CAT, ['act_1', 'act_2'], { comunicacion: 'Obras' }), rango(800, 1400, 3300)),
    cc('comunicacion_cuenta', 'ultimos_7', 'act_1', CAT, { comunicacion: 'Obras' }, ex(600, 1500)),
    cc('comunicacion_cuenta', 'ultimos_7', 'act_2', CAT, { comunicacion: 'Obras' }, ex(800, 1800)),
    // una sola cuenta
    alc('comunicacion', 'desde_inicio', entre(SAL, ['act_3'], { cuenta_id: 'act_3', activo: 'Activo act_3', comunicacion: 'Salud' }), ex(250, 500)),
  ];
  const P = N.alcanceDeHoy({ alcance: P_FILAS, corridas: P_CORR }, { ahora: AHORA });
  ok(P.estado === 'ok' && !P.descartadas.length, 'escenario por cuenta: todo leído y válido (dio ' + P.estado + ' ' + JSON.stringify(P.descartadas.map((d) => d.motivo)) + ')');
  const qc = (nivel, periodo, extra) => N.datoDeHoy(P, { nivel, periodo, cliente: CAT, ...extra });
  const nombresYAlcance = (r) => (r.cuentas || []).map((c) => `${c.cuenta}:${c.alcance}`).join();

  // Una cuenta: exacto
  const pc1 = N.datoDeHoy(P, { nivel: 'cliente', periodo: 'ultimos_7', cliente: SAL, canal: 'Informativo' });
  ok(pc1.estado === 'ok' && pc1.dato.alcance === 300 && pc1.dato.exacto === true && pc1.dato.frecuencia === 2, 'cliente de una sola cuenta: dato exacto');
  const pc2 = N.datoDeHoy(P, { nivel: 'comunicacion', periodo: 'desde_inicio', cliente: SAL, comunicacion: 'Salud' });
  ok(pc2.estado === 'ok' && pc2.dato.alcance === 250, 'comunicación de una sola cuenta: dato exacto');
  const pc3 = qc('cliente', 'ultimos_7', { canal: 'Oficial' });
  ok(pc3.estado === 'ok' && pc3.dato.alcance === 700 && pc3.dato.cuenta_id === 'act_8', 'cliente con una sola cuenta en ese canal: dato exacto de esa cuenta');

  // Varias cuentas: lista por cuenta
  const pc4 = qc('cliente', 'ultimos_7', { canal: 'Informativo' });
  ok(pc4.estado === 'por_cuenta' && nombresYAlcance(pc4) === 'Activo act_2:1300,Activo act_1:1100', 'cliente en dos cuentas: cada una con su alcance (dio ' + nombresYAlcance(pc4) + ')');
  const pc5 = qc('cliente', 'ultimos_7', { canal: 'Ambos' });
  ok(pc5.estado === 'por_cuenta' && nombresYAlcance(pc5) === 'Activo act_2:1300,Activo act_1:1100,Activo act_8:700' && pc5.cuentas[2].canal === 'Oficial', 'cliente en los dos canales ("Ambos"): una entrada por cuenta, de los dos canales');
  ok(qc('cliente', 'ultimos_7', {}).estado === 'por_cuenta' && qc('cliente', 'ultimos_7', {}).cuentas.length === 3, 'cliente sin canal: todas sus cuentas');
  const pc6 = qc('cliente', 'ultimos_30', { canal: 'Informativo' });
  ok(pc6.estado === 'por_cuenta' && nombresYAlcance(pc6) === 'Activo act_2:2900,Activo act_1:2100', 'cliente en dos cuentas, sin fila de cliente para ese período: igual por cuenta');
  const pc7 = qc('contenido', 'desde_inicio', { codigo: COD });
  ok(pc7.estado === 'por_cuenta' && nombresYAlcance(pc7) === 'Activo act_2:500,Activo act_1:400', 'contenido en dos cuentas con fila por cuenta: lista por cuenta');
  const pc8 = qc('comunicacion', 'ultimos_7', { comunicacion: 'Obras' });
  ok(pc8.estado === 'por_cuenta' && nombresYAlcance(pc8) === 'Activo act_2:800,Activo act_1:600' && pc8.cuentas[0].frecuencia === 2.25, 'comunicación en dos cuentas con fila por cuenta: lista por cuenta, frecuencia de cada cuenta');
  ok([pc4, pc5, pc7, pc8].every((r) => r.cuentas.every((c) => JSON.stringify(Object.keys(c)) === JSON.stringify(['cuenta', 'alcance', 'impresiones', 'frecuencia', 'periodo', 'desde', 'hasta', 'gasto', 'canal', 'fecha_lectura']))),
    'cada entrada de la lista por cuenta tiene el formato acordado');

  // Falta el dato por cuenta
  const pc9 = qc('comunicacion', 'ultimos_30', { comunicacion: 'Obras' });
  ok(pc9.estado === 'sin_dato_por_cuenta' && /Sin dato por cuenta todavía/.test(pc9.motivo) && /2 cuentas/.test(pc9.motivo) && pc9.cuentas_con_dato.length === 0, 'comunicación en dos cuentas sin filas por cuenta: "sin dato por cuenta todavía"');
  ok(pc9.referencia && pc9.referencia.alcance_de === 'toda la cuenta' && nombresYAlcance(pc9.referencia) === 'Activo act_2:2900,Activo act_1:2100' && /toda la cuenta/.test(pc9.referencia.aviso),
    'sin dato por cuenta: se ofrece el alcance de toda la cuenta del mismo período, marcado como tal');
  const pc10 = qc('contenido', 'ultimos_7', { codigo: COD });
  ok(pc10.estado === 'sin_dato_por_cuenta' && pc10.cuentas_con_dato.length === 1 && pc10.cuentas_con_dato[0].alcance === 200 && /Hay dato de 1/.test(pc10.motivo), 'contenido con fila por cuenta de solo una de sus cuentas: sin dato por cuenta, con la que sí hay');
  ok(pc10.referencia && pc10.referencia.cuentas.length === 2, 'contenido de 7 días: referencia de toda la cuenta de 7 días');
  ok(P.entre_cuentas.filter((x) => x.con_dato_por_cuenta).length === 4 && P.entre_cuentas.filter((x) => !x.con_dato_por_cuenta).length === 2, 'entre_cuentas marca qué tiene dato por cuenta y qué no');
  ok(P.entre_cuentas.every((x) => x.cuentas.every((n) => !/^act_/.test(n))), 'entre_cuentas trae los nombres legibles de las cuentas');

  // Cliente incompleto: tampoco se muestran sus filas por cuenta
  const inc = N.alcanceDeHoy({ alcance: [cc('cuenta', 'ultimos_7', 'act_3', SAL, {}, ex(300, 600)), cc('comunicacion_cuenta', 'ultimos_7', 'act_3', SAL, { comunicacion: 'Salud' }, ex(200, 400))],
    corridas: [corrida('act_3', SAL, 'ok'), corrida('act_4', SAL, 'error')] }, { ahora: AHORA });
  ok(!inc.niveles.comunicacion_cuenta.length && inc.descartadas.some((d) => d.fila.nivel === 'comunicacion_cuenta' && /le falta una cuenta/.test(d.motivo)), 'cliente al que le falta una cuenta: sus filas por cuenta se descartan');
  ok(N.datoDeHoy(inc, { nivel: 'comunicacion', periodo: 'ultimos_7', cliente: SAL, comunicacion: 'Salud' }).estado === 'sin_dato', 'cliente incompleto: sin dato, ni por cuenta');

  // Ningún resultado trae una suma ni un rango entre cuentas
  const PROHIBIDAS = ['alcance_min', 'alcance_max', 'frecuencia_min', 'frecuencia_max', 'puede_contar_de_mas'];
  const malasSumas = [];
  const recorrer = (o, ruta) => {
    if (Array.isArray(o)) { o.forEach((x, i) => recorrer(x, `${ruta}[${i}]`)); return; }
    if (!o || typeof o !== 'object') return;
    for (const k of PROHIBIDAS) if (k in o) malasSumas.push(`${ruta}.${k}`);
    const nCuentas = Array.isArray(o.cuentas) && o.cuentas.every((x) => typeof x === 'string') ? o.cuentas.length : (typeof o.cuentas === 'string' ? o.cuentas.split(',').filter(Boolean).length : 0);
    const variasCuentas = o.exacto === false || o.exacto === 'false' || nCuentas > 1 || Number(o.n_cuentas) > 1;
    if (variasCuentas) for (const k of ['alcance', 'impresiones', 'frecuencia', 'gasto']) if (k in o) malasSumas.push(`${ruta}.${k} (junta ${nCuentas || o.n_cuentas} cuentas)`);
    for (const [k, v] of Object.entries(o)) recorrer(v, `${ruta}.${k}`);
  };
  const consultas = [];
  for (const res of [P, R, rep, bq, conMalas, X1, X4, X5, X5b, inc]) {
    for (const nivel of ['cliente', 'contenido', 'comunicacion']) {
      for (const periodo of N.PERIODOS_POR_NIVEL[nivel]) {
        for (const cliente of [CAT, SAL, 'Gobierno de Santa Fe']) {
          for (const canal of [undefined, 'Informativo', 'Oficial', 'Ambos']) consultas.push(N.datoDeHoy(res, { nivel, periodo, cliente, canal, codigo: COD, comunicacion: nivel === 'comunicacion' ? 'Obras' : undefined }));
        }
      }
    }
  }
  [P, R, rep, bq, conMalas, X1, X4, X5, X5b, inc].forEach((res, i) => recorrer(res, `resultado${i}`));
  consultas.forEach((c, i) => recorrer(c, `consulta${i}`));
  ok(!malasSumas.length, 'ningún resultado trae rango ni números que junten cuentas (encontrados: ' + malasSumas.slice(0, 5).join('; ') + ')');
  const largoAntes = malasSumas.length; recorrer({ x: baseRango() }, 'control'); ok(malasSumas.length > largoAntes, 'el control de sumas sí detecta una fila de rango (para que la prueba anterior valga)');
  malasSumas.length = largoAntes;
  ok(N.datoDeHoy(X2, { nivel: 'cliente', periodo: 'ultimos_7', cliente: CAT }).estado === 'sin_dato', 'cliente sin canal con un canal sin tabla: sin dato (la lista de cuentas quedaría incompleta)');
  ok(N.datoDeHoy(X2, { nivel: 'cuenta', periodo: 'ultimos_7', cuenta_id: 'act_1' }).estado === 'ok', 'el nivel cuenta no depende del otro canal');
  const sumas = [2400, 3100, 6650, 8400, 5000, 15000, 900, 2190, 1400, 3300, 7000];   // las sumas entre cuentas del escenario P
  const textoP = JSON.stringify([P, pc4, pc5, pc6, pc7, pc8, pc9, pc10]);
  ok(!sumas.some((s) => new RegExp(`:${s}[,}]`).test(textoP)), 'en el escenario por cuenta no aparece ningún total entre cuentas');
  ok(consultas.every((c) => ['ok', 'por_cuenta', 'sin_dato_por_cuenta', 'sin_dato'].includes(c.estado)) && consultas.filter((c) => c.estado === 'ok').every((c) => c.dato.exacto === true && c.dato.n_cuentas === 1),
    'todo dato "ok" es exacto y de una sola cuenta');

  // ---------- 7d. Siempre la última lectura, con su fecha (decisión de Juan Pablo, 3/10) ----------
  // Lectura de hoy, de ayer (hoy todavía no hay) y sin ninguna. Nunca se suma alcance; por cuenta como siempre.
  {
    const MANANA = new Date('2026-10-02T14:00:00Z');        // 11:00 del 2/10 en Argentina: la última lectura es la del 1/10
    const MANANA_TEMPRANO = new Date('2026-10-02T08:00:00Z'); // 5:00 del 2/10
    const MANANA_7 = new Date('2026-10-02T10:30:00Z');        // 7:30 del 2/10
    const filasHoy = [
      alc('cuenta', 'ultimos_7', deCuenta('act_1', CAT), ex(1000, 2500)),
      alc('cuenta', 'ultimos_7', deCuenta('act_2', CAT), ex(1500, 3500)),
      alc('contenido_cuenta', 'desde_inicio', deCuenta('act_1', CAT, { codigo: COD, comunicacion: 'Obras' }), ex(400, 900)),
      alc('contenido_cuenta', 'desde_inicio', deCuenta('act_2', CAT, { codigo: COD, comunicacion: 'Obras' }), ex(500, 1000)),
      alc('campana', 'ultimos_7', deCuenta('act_1', CAT, { campana_id: 'c-1' }), ex(800, 2000)),
    ];
    const corrHoy = [corrida('act_1', CAT, 'ok'), corrida('act_2', CAT, 'ok')];

    // a) Lectura de hoy
    const H = N.alcanceDeHoy({ alcance: filasHoy, corridas: corrHoy }, { ahora: AHORA });
    ok(H.estado === 'ok' && H.fechaLectura === hoyAR && H.deHoy === true && H.fecha === hoyAR && H.hoy === hoyAR && H.aviso === null, 'lectura de hoy: fechaLectura = hoy, deHoy = true, sin aviso');
    const hC = N.datoDeHoy(H, { nivel: 'cuenta', periodo: 'ultimos_7', cuenta_id: 'act_1' });
    ok(hC.estado === 'ok' && hC.fechaLectura === hoyAR && hC.deHoy === true && hC.dato.fecha_lectura === hoyAR, 'lectura de hoy: el dato trae fechaLectura y deHoy = true');
    const hP = N.datoDeHoy(H, { nivel: 'contenido', periodo: 'desde_inicio', cliente: CAT, codigo: COD });
    ok(hP.estado === 'por_cuenta' && hP.deHoy === true && hP.fechaLectura === hoyAR && hP.cuentas.length === 2 && hP.cuentas.every((c) => c.fecha_lectura === hoyAR), 'lectura de hoy, varias cuentas: lista por cuenta con la fecha');

    // b) Lectura de ayer: el 2/10 la última es la del 1/10. Se usa, marcada con su fecha
    const A = N.alcanceDeHoy({ alcance: filasHoy, corridas: corrHoy }, { ahora: MANANA });
    ok(A.estado === 'ok' && A.fechaLectura === hoyAR && A.deHoy === false && A.hoy === '2026-10-02' && A.fecha === hoyAR, 'lectura de ayer: se usa, fechaLectura = 01/10 y deHoy = false');
    ok(/No hay lectura de hoy: se muestra la lectura del 01\/10/.test(A.aviso), 'lectura de ayer: aviso con la fecha (dio ' + A.aviso + ')');
    const aC = N.datoDeHoy(A, { nivel: 'cuenta', periodo: 'ultimos_7', cuenta_id: 'act_2' });
    ok(aC.estado === 'ok' && aC.dato.alcance === 1500 && aC.fechaLectura === hoyAR && aC.deHoy === false, 'lectura de ayer: el dato de una cuenta, con fechaLectura del 01/10 y deHoy = false');
    const aP = N.datoDeHoy(A, { nivel: 'contenido', periodo: 'desde_inicio', cliente: CAT, codigo: COD });
    ok(aP.estado === 'por_cuenta' && aP.deHoy === false && aP.fechaLectura === hoyAR && aP.cuentas.map((c) => c.alcance).join() === '500,400', 'lectura de ayer, varias cuentas: lista por cuenta, nunca un total');
    const aSin = N.datoDeHoy(A, { nivel: 'campana', periodo: 'ultimos_7', campana_id: 'c-99', cuenta_id: 'act_1' });
    ok(aSin.estado === 'sin_dato' && aSin.caso === 'sin_fila' && /lectura del 01\/10/.test(aSin.motivo) && !/de hoy/.test(aSin.motivo), 'lectura de ayer sin fila para eso: el motivo nombra la fecha, no "hoy"');
    ok(N.datoDeHoy(H, { nivel: 'campana', periodo: 'ultimos_7', campana_id: 'c-99', cuenta_id: 'act_1' }).motivo.startsWith('No hay dato de hoy para esto'), 'lectura de hoy sin fila: el texto de siempre (lo reconoce armar.js)');
    ok(/Todavía no se leyó hoy/.test(N.alcanceDeHoy({ alcance: filasHoy, corridas: corrHoy }, { ahora: MANANA_TEMPRANO }).aviso), 'antes de las 6:00: se usa la de ayer y el aviso dice que todavía no se leyó');
    ok(/todavía no terminó/.test(N.alcanceDeHoy({ alcance: filasHoy, corridas: corrHoy }, { ahora: MANANA_7 }).aviso), 'entre las 6:00 y las 9:00: se usa la de ayer y el aviso dice que la de hoy no terminó');
    // Hay de ayer y de hoy: siempre la más nueva
    const filasManana = filasHoy.map((f) => ({ ...f, fecha_lectura: '2026-10-02', fecha_hasta: hoyAR, alcance: f.alcance + 1, alcance_min: f.alcance + 1, alcance_max: f.alcance + 1, frecuencia: Math.round(f.impresiones / (f.alcance + 1) * 1e4) / 1e4, frecuencia_min: null, frecuencia_max: null }));
    const dos = N.alcanceDeHoy({ alcance: [...filasHoy, ...filasManana], corridas: [...corrHoy, ...corrHoy.map((c) => ({ ...c, fecha_lectura: '2026-10-02' }))] }, { ahora: MANANA });
    ok(dos.deHoy === true && dos.fechaLectura === '2026-10-02' && N.datoDeHoy(dos, { nivel: 'cuenta', periodo: 'ultimos_7', cuenta_id: 'act_1' }).dato.alcance === 1001, 'con lectura de ayer y de hoy: se usa la de hoy');
    // Hoy la lectura falló entera (corridas con error y sin filas): queda la de ayer, con el aviso
    const fallo = N.alcanceDeHoy({ alcance: filasHoy, corridas: [...corrHoy, corrida('act_1', CAT, 'error', '2026-10-02'), corrida('act_2', CAT, 'error', '2026-10-02')] }, { ahora: MANANA });
    ok(fallo.estado === 'ok' && fallo.fechaLectura === hoyAR && fallo.deHoy === false && /La lectura de hoy no dejó datos/.test(fallo.aviso), 'la lectura de hoy falló entera: se usa la de ayer y se avisa');
    // Lectura futura: no se usa
    const futura = N.alcanceDeHoy({ alcance: filasManana, corridas: corrHoy.map((c) => ({ ...c, fecha_lectura: '2026-10-02' })) }, { ahora: AHORA });
    ok(futura.estado === 'sin_dato' && /fecha futura/.test(futura.motivo), 'una lectura con fecha futura no se usa');

    // c) Sin ninguna lectura: "sin dato de Meta"
    const S = N.alcanceDeHoy({ alcance: [], corridas: [] }, { ahora: MANANA });
    ok(S.estado === 'sin_dato' && S.fechaLectura === null && S.deHoy === false && !Object.values(S.niveles).flat().length && S.motivo, 'sin ninguna lectura: sin dato, fechaLectura null, sin números y con motivo');
    const sD = N.datoDeHoy(S, { nivel: 'cuenta', periodo: 'ultimos_7', cuenta_id: 'act_1' });
    ok(sD.estado === 'sin_dato' && !sD.dato && !('fechaLectura' in sD), 'sin ninguna lectura: el dato también es "sin dato"');
    ok(N.alcanceDeHoy({ alcance: [], corridas: [] }, { ahora: MANANA_TEMPRANO }).motivo.includes('6:00'), 'sin ninguna lectura antes de las 6:00: lo explica por el horario');

    // Por canal: cada canal con su última lectura (Oficial al 1/10, Informativo al 2/10)
    const ofAyer = [OF(alc('cuenta', 'ultimos_7', deCuenta('act_7', 'Gobierno de Santa Fe'), ex(2000, 5000)))];
    const corrOfAyer = [corrida('act_7', 'Gobierno de Santa Fe', 'ok', hoyAR, { canal: 'Oficial' })];
    const mix = N.alcanceDeHoy({ alcance: [...filasManana, ...ofAyer], corridas: [...corrHoy.map((c) => ({ ...c, fecha_lectura: '2026-10-02' })), ...corrOfAyer] }, { ahora: MANANA });
    ok(mix.fechas_por_canal.Informativo === '2026-10-02' && mix.fechas_por_canal.Oficial === hoyAR && mix.fechaLectura === '2026-10-02' && mix.deHoy === false, 'cada canal con su propia última lectura');
    const mOf = N.datoDeHoy(mix, { nivel: 'cuenta', periodo: 'ultimos_7', cuenta_id: 'act_7' });
    const mInf = N.datoDeHoy(mix, { nivel: 'cuenta', periodo: 'ultimos_7', cuenta_id: 'act_1' });
    ok(mOf.estado === 'ok' && mOf.fechaLectura === hoyAR && mOf.deHoy === false && mInf.fechaLectura === '2026-10-02' && mInf.deHoy === true, 'cada dato trae la fecha de la lectura de su canal');

    // Desde la extracción: alcanceFecha del 1/10 bajada el 2/10 → se usa, con su fecha
    const est = { Oficial: estadoCanal(noDisp('tabla inexistente'), noDisp('tabla inexistente')), Informativo: estadoCanal(disp(filasHoy.length), disp(corrHoy.length)) };
    const XA = N.alcanceDeExtraccion({ alcanceFecha: hoyAR, alcanceFechas: { Oficial: null, Informativo: hoyAR }, alcanceHoy: '2026-10-02', alcanceMeta: filasHoy, alcanceCorridas: corrHoy, alcanceEstado: est }, { ahora: MANANA });
    ok(XA.estado === 'parcial' && XA.fechaLectura === hoyAR && XA.deHoy === false && N.datoDeHoy(XA, { nivel: 'cuenta', periodo: 'ultimos_7', cuenta_id: 'act_1' }).deHoy === false, 'extracción con la lectura de ayer: se usa, con deHoy = false');
    const XS = N.alcanceDeExtraccion({ alcanceFecha: null, alcanceMeta: [], alcanceCorridas: [], alcanceEstado: { Oficial: est.Oficial, Informativo: estadoCanal(disp(0), disp(0)) } }, { ahora: MANANA });
    ok(XS.estado === 'sin_dato' && XS.fechaLectura === null, 'extracción sin ninguna lectura: sin dato');

    // Cuenta "parcial" con `faltantes` (pedido 035): se descarta solo lo que faltó
    const faltoCom = JSON.stringify([{ cuenta_id: 'act_2', nivel: 'contenido', codigo: COD, comunicacion: 'Obras', codigos: [COD], motivo: 'error 503' }]);
    const filasParc = filasHoy.filter((f) => !(f.nivel === 'contenido_cuenta' && f.cuenta_id === 'act_2'));
    const PA = N.alcanceDeHoy({ alcance: filasParc, corridas: [corrida('act_1', CAT, 'ok'), corrida('act_2', CAT, 'parcial', hoyAR, { faltantes: faltoCom })] }, { ahora: AHORA });
    ok(PA.estado === 'parcial' && PA.cuentas.act_2.ok === true && PA.cuentas.act_2.completa === false && PA.faltantes.length === 1 && PA.faltantes[0].cuenta === 'Activo act_2', 'parcial con faltantes: la cuenta se usa y queda la lista de lo que faltó');
    ok(N.datoDeHoy(PA, { nivel: 'cuenta', periodo: 'ultimos_7', cuenta_id: 'act_2' }).estado === 'ok' && N.datoDeHoy(PA, { nivel: 'cliente', periodo: 'ultimos_7', cliente: CAT }).estado === 'por_cuenta', 'parcial con faltantes: lo que sí se leyó (cuenta, cliente por cuenta) sigue');
    const pFalta = N.datoDeHoy(PA, { nivel: 'contenido', periodo: 'desde_inicio', cliente: CAT, codigo: COD });
    ok(pFalta.estado === 'sin_dato_por_cuenta' && pFalta.cuentas_con_dato.length === 1 && pFalta.cuentas_con_dato[0].cuenta === 'Activo act_1' && /no se pudo leer en Activo act_2/.test(pFalta.motivo), 'el contenido que faltó en una cuenta: sin dato por cuenta, con la cuenta que sí tiene (nunca solo una como si fuera todo)');
    const PA2 = N.alcanceDeHoy({ alcance: filasHoy, corridas: [corrida('act_1', CAT, 'ok'), corrida('act_2', CAT, 'parcial', hoyAR, { faltantes: faltoCom })] }, { ahora: AHORA });
    ok(PA2.descartadas.some((d) => d.fila.nivel === 'contenido_cuenta' && d.fila.cuenta_id === 'act_2'), 'si igual viene la fila de lo que faltó, se descarta');
    const faltoCuenta = JSON.stringify([{ cuenta_id: 'act_2', nivel: 'cuenta', codigo: '', comunicacion: '', codigos: [], motivo: 'x' }]);
    const PC = N.alcanceDeHoy({ alcance: filasHoy.filter((f) => !(f.nivel === 'cuenta' && f.cuenta_id === 'act_2')), corridas: [corrida('act_1', CAT, 'ok'), corrida('act_2', CAT, 'parcial', hoyAR, { faltantes: faltoCuenta })] }, { ahora: AHORA });
    ok(N.datoDeHoy(PC, { nivel: 'cliente', periodo: 'ultimos_7', cliente: CAT }).estado === 'sin_dato_por_cuenta' && N.datoDeHoy(PC, { nivel: 'contenido', periodo: 'desde_inicio', cliente: CAT, codigo: COD }).estado === 'por_cuenta', 'faltó el total de una cuenta: el cliente queda sin dato por cuenta; el contenido sigue');
    const PI = N.alcanceDeHoy({ alcance: filasHoy, corridas: [corrida('act_1', CAT, 'ok'), corrida('act_2', CAT, 'parcial', hoyAR, { faltantes: 'no es json' })] }, { ahora: AHORA });
    ok(PI.cuentas.act_2.ok === false && PI.clientes_sin_dato.length === 1 && N.datoDeHoy(PI, { nivel: 'cliente', periodo: 'ultimos_7', cliente: CAT }).estado === 'sin_dato', 'parcial sin faltantes legible: la cuenta cuenta como no leída (como antes)');
    ok(N.alcanceDeHoy({ alcance: filasHoy, corridas: [corrida('act_1', CAT, 'ok'), corrida('act_2', CAT, 'parcial')] }, { ahora: AHORA }).cuentas.act_2.ok === false, 'parcial sin la columna faltantes: no leída');
    ok(N.faltantesDe(faltoCom.replace('act_2', 'act_9'), 'act_2') === null && N.faltantesDe('[]', 'act_2') === null && N.faltantesDe(JSON.stringify([{ nivel: 'contenido', codigo: 'CORTO' }]), 'act_2') === null, 'faltantes de otra cuenta, vacío o con código mal: no se aceptan');
    // Nunca sumar: ningún resultado de esta sección trae un total entre cuentas
    const textoD = JSON.stringify([hP, aP, pFalta]);
    ok(!/"alcance":(900|2500)[,}]/.test(textoD), 'en la lista por cuenta no aparece ningún total entre cuentas');
  }

  // ---------- 1b. Id del conjunto de Meta (conjuntoId) e ids de anuncio (ads), como los baja Datos ----------
  // Anuncios del simulador: 900000000000001 → cj-1, 900000000000002 → cj-2 (nexo/simulador.js).
  const cj = (nombre, ads, conjuntoId, extra = {}) => ({ nombre, cod: nombre.split(' - ')[1] || null, ads, conjuntoId, ...extra });
  const b1 = N.aSolicitud(tarjeta('Mejor momento', [cj(C_A, '900000000000001', 'cj-1'), cj(C_B, '900000000000002', 'cj-2')], { id: 'cj-b1' }), CTX);
  ok(b1.tipo === 'solicitud' && b1.solicitud.objetivos.map((o) => o.conjunto_id).join() === 'cj-1,cj-2' && b1.manuales.length === 0, 'un solo id de conjunto: va en la solicitud');
  ok(b1.solicitud.objetivos[0].anuncios.join() === '900000000000001' && N.validarForma(b1.solicitud) === null, 'ids de anuncio como texto (ads): se leen y la solicitud pasa la forma');
  const b2 = N.aSolicitud(tarjeta('Mejor momento', [cj(C_A, '900000000000001,900000000000005', 'cj-1,cj-9'), cj(C_B, '900000000000002', 'cj-2')], { id: 'cj-b2' }), CTX);
  ok(b2.tipo === 'solicitud' && b2.solicitud.objetivos.length === 1 && b2.solicitud.objetivos[0].conjunto === C_B, 'varios ids para un conjunto: ese conjunto no va en la solicitud');
  ok(b2.manuales.length === 1 && b2.manuales[0].conjunto === C_A && b2.manuales[0].conjunto_ids.join() === 'cj-1,cj-9' && b2.manuales[0].caso === 'sin_dato' && /^Se hace a mano: hay 2 conjuntos con este nombre en Meta y no tenemos cuándo gastó cada uno/.test(b2.manuales[0].motivo), 'varios ids sin el dato de gasto por id: el conjunto queda como tarea manual con el motivo');
  ok(!b2.solicitud.objetivos.some((o) => o.anuncios.includes('900000000000001')), 'varios ids: sus anuncios tampoco van');
  const b3 = N.aSolicitud(tarjeta('Se desgastó', [cj(C_A, '900000000000001', 'cj-1, cj-9'), cj(C_B, '900000000000002', ['cj-2', 'cj-8'])], { id: 'cj-b3' }), CTX);
  ok(b3.tipo === 'manual' && /más de un conjunto con el mismo nombre/.test(b3.motivo) && b3.manuales.length === 2, 'todos con varios ids: la recomendación entera es tarea manual');
  const b4 = N.aSolicitud(tarjeta('Rinde por debajo', [cj(C_A, '900000000000001', 'cj-1,cj-9', { rol: 'pausar' }), cj(C_C, '900000000000004', 'cj-4,cj-7', { rol: 'reforzar' })], { id: 'cj-b4' }), CTX);
  ok(b4.tipo === 'manual' && /^Se hace a mano: hay 2 conjuntos/.test(b4.motivo) && b4.manuales[0].conjunto_ids.join() === 'cj-1,cj-9', 'C1 con la pieza a pausar en varios conjuntos: tarea manual, con los ids aparte');
  const b5 = N.aSolicitud(tarjeta('Rinde por debajo', [cj(C_A, '900000000000001', 'cj-1', { rol: 'pausar' }), cj(C_C, '900000000000004', 'cj-4,cj-7', { rol: 'reforzar' })], { id: 'cj-b5' }), CTX);
  ok(b5.tipo === 'solicitud' && b5.manuales.length === 0, 'C1: un conjunto a reforzar con varios ids no molesta (no se toca)');
  const b6 = N.aSolicitud(tarjeta('Mejor momento', [conj(C_A, ['900000000000001'])], { id: 'cj-b6' }), CTX);
  ok(b6.tipo === 'solicitud' && b6.solicitud.objetivos[0].conjunto_id === null && N.validarForma(b6.solicitud) === null, 'sin conjuntoId (tarjeta de antes): se manda igual, sin id de conjunto');
  const b7 = N.aSolicitud(tarjeta('Mejor momento', [{ nombre: C_A, anuncios: [' 900000000000001', '', '900000000000001', 900000000000002], conjunto_id: ['cj-1'] }], { id: 'cj-b7' }), CTX);
  ok(b7.tipo === 'solicitud' && b7.solicitud.objetivos[0].anuncios.join() === '900000000000001,900000000000002' && b7.solicitud.objetivos[0].conjunto_id === 'cj-1', 'listas: sin vacíos, sin repetidos, todo como texto');
  const b8 = N.aSolicitud(tarjeta('Mejor momento', [cj(C_A, ' , ', 'cj-1')], { id: 'cj-b8' }), CTX);
  ok(b8.tipo === 'manual' && b8.motivo === 'Se hace a mano: no encontramos estos conjuntos en Meta (faltan los ids de sus anuncios).', 'con id de conjunto pero sin ids de anuncio: tarea manual');
  const b9 = N.aSolicitud(tarjeta('Mejor momento', [cj(C_A, '900000000000001', ' , ')], { id: 'cj-b9' }), CTX);
  ok(b9.tipo === 'solicitud' && b9.solicitud.objetivos[0].conjunto_id === null, 'conjuntoId vacío: como si no viniera');
  ok(/un solo id de conjunto/.test(N.validarForma({ ...b1.solicitud, objetivos: [{ ...b1.solicitud.objetivos[0], conjunto_id: 'cj-1,cj-9' }] }) || ''), 'la revisión de forma no deja pasar varios ids de conjunto');
  // D2 también se cruza por id de conjunto (mismo conjunto de Meta con otro nombre en la tarjeta)
  const histCj = [{ solicitud: { id: 'sol-viejo', accion: 'Cambiar presupuesto', creada: new Date(AHORA - 864e5).toISOString(), objetivos: [{ conjunto: 'otro nombre', conjunto_id: 'cj-1', anuncios: ['999'] }] }, ultimo: { estado: 'aplicada' } }];
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

  // ---------- 1c. Decisiones de Juan Pablo del 1/10: N7 (varios ids), N3 (3 días solo presupuesto), N4 y N5 (textos) ----------
  // N7: con varios ids para un nombre, se manda al único que gastó en los últimos 2 días (hoy 01/10 en Argentina: desde el 29/09).
  // Filas de mentira con la forma de `conjuntosPorId` que está sumando Extracción (borrador/_extraer.js).
  const fila = (conjuntoId, ultimoGasto, ads, extra = {}) => ({ canal: 'Oficial', cliente: 'Santa Fe', conjuntoId, nombre: C_A, activo: 'Prueba', primerGasto: '2026-09-01', ultimoGasto, gasto: 1000, g14: 500, ads, ...extra });
  const tarjN7 = (id, tipo = 'Mejor momento') => tarjeta(tipo, [cj(C_A, '900000000000001,900000000000005', 'cj-1,cj-9')], { id });
  const n1 = N.aSolicitud(tarjN7('n7-1'), { ...CTX, conjuntosPorId: [fila('cj-1', '2026-09-30', '900000000000001'), fila('cj-9', '2026-09-10', '900000000000005')] });
  ok(n1.tipo === 'solicitud' && n1.solicitud.objetivos.length === 1 && n1.solicitud.objetivos[0].conjunto_id === 'cj-1' && n1.manuales.length === 0, 'N7: varios ids, uno solo gastó en los últimos 2 días: se manda a ese');
  ok(n1.tipo === 'solicitud' && n1.solicitud.objetivos[0].anuncios.join() === '900000000000001', 'N7: van solo los anuncios del id elegido, no los del otro conjunto con el mismo nombre');
  ok(n1.elegidos && n1.elegidos.length === 1 && n1.elegidos[0].conjunto_id === 'cj-1' && n1.elegidos[0].ultimo_gasto === '2026-09-30' && n1.elegidos[0].descartados.join() === 'cj-9', 'N7: se devuelve cuál se eligió y cuál se descartó');
  ok(N.validarForma(n1.solicitud) === null && !('elegido' in n1.solicitud.objetivos[0]), 'N7: la solicitud pasa la forma y no lleva campos nuevos');
  const borde = (ug9) => N.aSolicitud(tarjN7('n7-borde'), { ...CTX, conjuntosPorId: [fila('cj-1', '2026-09-20', '900000000000001'), fila('cj-9', ug9, '900000000000005')] });
  ok(borde('2026-09-29').tipo === 'solicitud' && borde('2026-09-29').solicitud.objetivos[0].conjunto_id === 'cj-9', 'N7: gastó anteayer cuenta como "en los últimos 2 días"');
  ok(borde('2026-09-28').tipo === 'manual', 'N7: gastó hace 3 días no cuenta');
  const n2 = N.aSolicitud(tarjN7('n7-2'), { ...CTX, conjuntosPorId: [fila('cj-1', '2026-09-20', '900000000000001'), fila('cj-9', '2026-09-10', '900000000000005')] });
  ok(n2.tipo === 'manual' && n2.manuales[0].caso === 'ninguno_gasto' && n2.motivo === 'Se hace a mano: hay 2 conjuntos con este nombre en Meta y ninguno gastó en los últimos 2 días, así que no sabemos a cuál aplicar el cambio.', 'N7: ninguno gastó: a mano');
  const n3 = N.aSolicitud(tarjN7('n7-3'), { ...CTX, conjuntosPorId: [fila('cj-1', '2026-09-30', '900000000000001'), fila('cj-9', '2026-09-29', '900000000000005')] });
  ok(n3.tipo === 'manual' && n3.manuales[0].caso === 'varios_gastaron' && n3.manuales[0].conjunto_ids_con_gasto.join() === 'cj-1,cj-9' && /y 2 gastaron en los últimos 2 días/.test(n3.motivo), 'N7: varios gastaron: a mano');
  const n4 = N.aSolicitud(tarjN7('n7-4'), { ...CTX, conjuntosPorId: [fila('cj-1', '2026-09-30', '900000000000001')] });
  ok(n4.tipo === 'manual' && n4.manuales[0].caso === 'sin_dato', 'N7: si falta uno de los ids en la tabla, no se elige (a mano)');
  ok(N.aSolicitud(tarjN7('n7-5'), { ...CTX, conjuntosPorId: [] }).manuales[0].caso === 'sin_dato', 'N7: tabla vacía (Extracción todavía no la baja): a mano');
  const n6 = N.aSolicitud(tarjN7('n7-6'), { ...CTX, conjuntosPorId: [fila('cj-1', '2026-09-30', ''), fila('cj-9', '2026-09-10', '900000000000005')] });
  ok(n6.tipo === 'manual' && n6.motivo === N.TEXTO.sinIdsAnuncio, 'N7: el elegido no trae ids de anuncio: a mano por falta de ids');
  const n7 = N.aSolicitud(tarjN7('n7-7'), { ...CTX, conjuntosPorId: [fila('cj-1', null, '900000000000001'), fila('cj-9', 'no es fecha', '900000000000005')] });
  ok(n7.tipo === 'manual' && n7.manuales[0].caso === 'ninguno_gasto', 'N7: sin fecha de último gasto o con una fecha rota: no cuenta como gasto');
  // Una fila con varios ids no es de esta tabla y se ignora; el mismo id en dos filas: vale la fecha más nueva y se juntan los anuncios.
  const ixN7 = N.indicePorId([fila('cj-1,cj-9', '2026-09-30', '1'), fila('cj-1', '2026-09-20', '900000000000001'), fila('cj-1', '2026-09-30', '900000000000006', { cliente: 'Otro' }), null, 'x', { conjuntoId: '' }]);
  ok(ixN7.size === 1 && ixN7.get('cj-1').ultimoGasto === '2026-09-30' && ixN7.get('cj-1').anuncios.join() === '900000000000001,900000000000006', 'N7: el índice por id junta filas repetidas y descarta las que no sirven');
  ok(N.indicePorId(null).size === 0 && N.indicePorId('x').size === 0, 'N7: el índice tolera una entrada vacía o rara');
  ok(N.aSolicitud(tarjN7('n7-8'), { ...CTX, conjuntosPorId: [fila('cj-1', '2026-09-30T00:00:00', '900000000000001'), fila('cj-9', '2026-09-10', '900000000000005')] }).tipo === 'solicitud', 'N7: una fecha con hora también se lee');
  // Día en hora argentina: a las 23:00 del 30/09 en Argentina (02:00 del 01/10 UTC), "los últimos 2 días" empiezan el 28/09.
  const n9 = N.aSolicitud(tarjN7('n7-9'), { ...CTX, ahora: new Date('2026-10-01T02:00:00Z'), conjuntosPorId: [fila('cj-1', '2026-09-28', '900000000000001'), fila('cj-9', '2026-09-10', '900000000000005')] });
  ok(n9.tipo === 'solicitud' && n9.solicitud.objetivos[0].conjunto_id === 'cj-1', 'N7: los 2 días se cuentan en hora argentina');
  // Uno elegido y otro que queda a mano en la misma recomendación
  const n10 = N.aSolicitud(tarjeta('Se desgastó', [cj(C_A, '900000000000001,900000000000005', 'cj-1,cj-9'), cj(C_B, '900000000000002,900000000000007', 'cj-2,cj-8')], { id: 'n7-10' }),
    { ...CTX, conjuntosPorId: [fila('cj-1', '2026-09-30', '900000000000001'), fila('cj-9', '2026-09-10', '900000000000005'), fila('cj-2', '2026-09-30', '900000000000002'), fila('cj-8', '2026-09-30', '900000000000007')] });
  ok(n10.tipo === 'solicitud' && n10.solicitud.objetivos.map((o) => o.conjunto_id).join() === 'cj-1' && n10.manuales.length === 1 && n10.manuales[0].conjunto === C_B, 'N7: en la misma recomendación, uno se elige y el otro queda a mano');
  // De punta a punta: las filas se le pasan al nexo (lista o función) o en cada aceptar()
  const filasN7 = [fila('cj-1', '2026-09-30', '900000000000001'), fila('cj-9', '2026-09-10', '900000000000005')];
  const nexoN7 = N.crearNexo({ env: {}, repositorio: repoNuevo(), reloj: () => AHORA, accesos: ACCESOS, conjuntosPorId: () => filasN7 });
  const en1 = await nexoN7.aceptar(tarjN7('n7-e1'), CTX);
  ok(en1.tipo === 'solicitud' && en1.envio.estado === 'aplicada' && en1.envio.valores.length === 1 && en1.envio.valores[0].conjunto_id === 'cj-1' && en1.elegidos.length === 1, 'N7 de punta a punta: se aplica en el conjunto elegido');
  const nexoN7b = N.crearNexo({ env: {}, repositorio: repoNuevo(), reloj: () => AHORA, accesos: ACCESOS, conjuntosPorId: filasN7 });
  const en2 = await nexoN7b.aceptar(tarjN7('n7-e2'), { ...CTX, conjuntosPorId: [] });
  ok(en2.tipo === 'manual' && en2.manuales[0].caso === 'sin_dato', 'N7 de punta a punta: lo que viene en aceptar() manda sobre lo del nexo');
  const en3 = await nexoN7b.aceptar(tarjN7('n7-e3'), CTX);
  ok(en3.tipo === 'solicitud' && en3.envio.estado === 'aplicada', 'N7 de punta a punta: también con la lista fija');

  // N3: "un cambio por conjunto cada 3 días" vale solo para Cambiar presupuesto. Pausar siempre se puede.
  const previo = (accion, creada = new Date(AHORA - 864e5).toISOString()) => [{ solicitud: { id: 'sol-previo', accion, creada, objetivos: [{ conjunto: C_C, conjunto_id: null, anuncios: ['900000000000002'] }] }, ultimo: { estado: 'aplicada' } }];
  const t3 = (tipo) => tarjeta(tipo, [conj(C_C, ['900000000000002'])], { id: 'n3-' + tipo.slice(0, 3) });
  ok(N.aSolicitud(t3('Se desgastó'), { ...CTX, historial: previo('Cambiar presupuesto') }).tipo === 'solicitud', 'N3: pausar después de un cambio de presupuesto reciente: se puede');
  ok(N.aSolicitud(t3('Presión acumulada alta'), { ...CTX, historial: previo('Pausar') }).tipo === 'solicitud', 'N3: pausar después de otra pausa reciente: se puede');
  ok(N.aSolicitud(t3('Mejor momento'), { ...CTX, historial: previo('Pausar') }).tipo === 'solicitud', 'N3: una pausa reciente no frena un cambio de presupuesto');
  const d2n = N.aSolicitud(t3('Mejor momento'), { ...CTX, historial: previo('Cambiar presupuesto') });
  ok(d2n.tipo === 'bloqueada' && d2n.control === 'D2' && d2n.motivo === 'Todavía no: este conjunto ya tuvo un cambio el 30/09; se permite uno cada 3 días.', 'N3: presupuesto después de presupuesto dentro de 3 días: bloqueado, con la fecha en día y mes');
  const d2ar = N.aSolicitud(t3('Mejor momento'), { ...CTX, historial: previo('Cambiar presupuesto', '2026-10-01T01:00:00Z') });
  ok(d2ar.tipo === 'bloqueada' && /el 30\/09;/.test(d2ar.motivo), 'N3: la fecha del cambio anterior va en día argentino');
  const nexoN3 = N.crearNexo({ env: {}, repositorio: repoNuevo(), reloj: () => AHORA, accesos: ACCESOS });
  const pn1 = await nexoN3.aceptar(tarjeta('Se comparte', [conj(C_A, ['900000000000001'])], { id: 'n3-e1' }), CTX);
  const pn2 = await nexoN3.aceptar(tarjeta('Se desgastó', [conj(C_A, ['900000000000001'])], { id: 'n3-e2' }), CTX);
  ok(pn1.envio.estado === 'aplicada' && pn2.tipo === 'solicitud' && pn2.envio.estado === 'aplicada', 'N3 de punta a punta: sube el presupuesto y el mismo día se puede pausar');

  // N4: pausar sin Reactivar, con la nota de que volver a prenderlo se hace a mano. Nota nueva para C1.
  ok(N.ENCAJAN['Se desgastó'].nota === 'PAUTADOR pausa los conjuntos; volver a prenderlos en una semana se hace a mano.' && N.ENCAJAN['Presión acumulada alta'].nota === N.ENCAJAN['Se desgastó'].nota, 'N4: C3 y C7 llevan la nota de volver a prender a mano');
  ok(N.ENCAJAN['Rinde por debajo'].nota === 'PAUTADOR pausa los conjuntos de la peor pieza; pasar ese presupuesto a la mejor se pide aparte.', 'N5: C1 lleva su nota nueva');
  ok(!N.CATALOGO_ACCIONES.some((a) => /activ/i.test(a)), 'N4: Reactivar no está en el catálogo');
  ok(r1.tipo === 'solicitud' && N.aSolicitud(c1, CTX).solicitud.nota === N.ENCAJAN['Rinde por debajo'].nota, 'N5: la nota de C1 viaja en la solicitud');

  // N5: textos de tarea manual y de bloqueo, tal cual los propuso Recomendaciones.
  const esperados = {
    'Peor que la temporada anterior': 'Se hace a mano: volver a usar las piezas y audiencias de la temporada pasada se pide en PAUTADOR como un pedido nuevo.',
    'Sin entrega': 'Se hace a mano: hay que revisar en el administrador de anuncios si hay rechazos, anuncios en revisión o falta presupuesto.',
    'Apagón': 'Se hace a mano: hay que revisar las cuentas del activo (anuncios pausados, rechazados o sin presupuesto).',
    'Pico': 'Se hace a mano: hay que confirmar que el aumento de gasto sea intencional.',
    'Placements débiles': 'Se hace a mano: sacar placements cambia la segmentación, y desde el Tablero de optimización solo se puede pausar o cambiar el presupuesto.',
    'Sumar Facebook Reels': 'Se hace a mano: sumar un placement cambia la segmentación, y desde el Tablero de optimización solo se puede pausar o cambiar el presupuesto.',
    'Genera conversación': 'Se hace a mano: los comentarios se leen y se moderan desde la página.',
    'Costo por objetivo': 'Se hace a mano: hay que revisar la pieza, la audiencia y la puja de esa red.',
    'Se abandona temprano': 'Se hace a mano: hay que revisar el comienzo del video (los primeros segundos).',
    'Rotar contenidos': 'Se hace a mano: las piezas nuevas se piden en PAUTADOR como un pedido nuevo.',
  };
  for (const [tipo, texto] of Object.entries(esperados)) {
    const r = N.aSolicitud(tarjeta(tipo, [conj(C_A, ['900000000000001'])], { id: 'n5-' + tipo.slice(0, 4) }), CTX);
    ok(r.tipo === 'manual' && r.motivo === texto, `N5: texto de tarea manual de "${tipo}"`);
  }
  ok(Object.keys(N.NO_ENCAJAN).length === Object.keys(esperados).length, 'N5: no quedó ninguna tarea manual con el texto viejo');
  ok(Object.values(N.NO_ENCAJAN).concat(Object.values(N.TEXTO).filter((x) => typeof x === 'string')).every((t) => !/catálogo|v0\.3|D6|reglas/i.test(t)), 'N5: sin jerga (catálogo, reglas v0.3, D6)');
  ok(N.aSolicitud(tarjeta('Mejor momento', [conj(C_A, ['900000000000001'])], { id: 'n5-yt', plataforma: 'YouTube' }), CTX).motivo === 'Se hace a mano: desde el Tablero de optimización los cambios son solo para Meta; en YouTube se hacen en la plataforma.', 'N5: texto de otra plataforma');
  ok(N.aSolicitud(tarjeta('Rinde por debajo', [conj(C_A, ['900000000000001'])], { id: 'n5-c1' }), CTX).motivo === 'Se hace a mano: no hay una pieza claramente peor para pausar; revisar la pieza y la audiencia, y pausar si en 2 días no mejora.', 'N5: texto de C1 sin pieza peor');
  ok(/^Se hace a mano: /.test(N.aSolicitud(tarjeta('Algo nuevo', [conj(C_A, ['900000000000001'])], { id: 'n5-x' }), CTX).motivo), 'N5: una recomendación desconocida también empieza con "Se hace a mano:"');
  ok(N.aSolicitud(tarjeta('Mejor momento', [conj(C_A, ['900000000000001'])], { id: 'n5-d1' }), { ...CTX, cambioPct: 30 }).motivo === 'No se puede pedir: el cambio es de 30 %, y el máximo es 20 % por vez.', 'N5: texto del bloqueo por más de 20 %');
  const d3n = N.aSolicitud(tarjeta('Mejor momento', [conj(C_A, ['900000000000001'])], { id: 'n5-d3', fin: '2026-10-02' }), CTX);
  ok(d3n.control === 'D3' && d3n.motivo === 'No se puede pedir: la campaña termina el 02/10 y en sus últimos 2 días no se cambia el presupuesto.', 'N5: texto del bloqueo de los últimos 2 días, con día y mes');
  // Los últimos 2 días frenan solo el cambio de presupuesto: pausar se puede hasta el final (Juan Pablo, 1/10).
  for (const f of ['2026-10-01', '2026-10-02', '2026-10-03']) {
    const p7 = N.aSolicitud(tarjeta('Se desgastó', [conj(C_A, ['900000000000001'])], { id: 'd3p-' + f, fin: f }), CTX);
    ok(p7.tipo === 'solicitud' && p7.solicitud.accion === N.ACCION.PAUSAR, `C3: pausar se pide aunque la campaña termine el ${f}`);
    const p3 = N.aSolicitud(tarjeta('Presión acumulada alta', [conj(C_A, ['900000000000001'])], { id: 'd3c3-' + f, fin: f }), CTX);
    ok(p3.tipo === 'solicitud' && p3.solicitud.accion === N.ACCION.PAUSAR, `C7: pausar se pide aunque la campaña termine el ${f}`);
    const pr = N.aSolicitud(tarjeta('Mejor momento', [conj(C_A, ['900000000000001'])], { id: 'd3m-' + f, fin: f }), CTX);
    ok(pr.tipo === 'bloqueada' && pr.control === 'D3', `C6: cambiar presupuesto queda bloqueado si la campaña termina el ${f}`);
    const pc = N.aSolicitud(tarjeta('Se comparte', [conj(C_A, ['900000000000001'])], { id: 'd3c10-' + f, fin: f }), CTX);
    ok(pc.tipo === 'bloqueada' && pc.control === 'D3', `C10: cambiar presupuesto queda bloqueado si la campaña termina el ${f}`);
  }
  const c1fin = N.aSolicitud({ ...c1, fin: '2026-10-02' }, CTX);
  ok(c1fin.tipo === 'solicitud' && c1fin.solicitud.accion === N.ACCION.PAUSAR, 'C1: pausar la peor pieza se pide aunque la campaña termine en 2 días');
  ok(N.aSolicitud(tarjeta('Mejor momento', [conj(C_A, ['900000000000001'])], { id: 'd3m-lejos', fin: '2026-10-04' }), CTX).tipo === 'solicitud', 'cambiar presupuesto con 3 días hasta el fin se permite');

  // ---------- 7b. Consulta de accesos a PAUTADOR (consulta-accesos.md, "Ruta construida (1/10)") ----------
  // fetch de mentira: nunca se abre una conexión. Clave y URL de mentira, armadas acá (ninguna real).
  const CLAVE = 'clave-de-prueba-' + require('crypto').randomBytes(12).toString('hex');
  const ENV_REAL = { NEXO_MODO: 'real', NEXO_URL: 'https://pautador.ejemplo.invalid/', NEXO_CLAVE: CLAVE };
  const salida = [];
  const logsOrig = ['log', 'error', 'warn', 'info'].map((k) => [k, console[k]]);
  const capturar = () => logsOrig.forEach(([k, f]) => { console[k] = (...a) => { salida.push(a.map(String).join(' ')); if (k === 'log') f(...a); }; });
  const soltar = () => logsOrig.forEach(([k, f]) => { console[k] = f; });
  capturar();
  try {
    const resp = (status, cuerpo) => ({ status, json: async () => (typeof cuerpo === 'function' ? cuerpo() : cuerpo) });
    const fetchFalso = (responder) => { const f = async (url, init) => { f.llamadas.push({ url, init }); return responder(url, init); }; f.llamadas = []; return f; };
    const deLista = (url, init) => { const m = JSON.parse(init.body).email; const u = LISTA.find((x) => x.email === m); return resp(200, u ? JSON.parse(JSON.stringify(u)) : { email: m, nombre: '', habilitado: false, rol: null, administradorGlobal: false, superadministrador: false, accesos: [] }); };

    // modo
    ok(N.crearClienteAccesos({ env: {} }) === null, 'accesos: sin variables no hay cliente real');
    ok(N.crearClienteAccesos({ env: { NEXO_MODO: 'real', NEXO_URL: 'https://pautador.ejemplo.invalid' } }) === null, 'accesos: sin NEXO_CLAVE no hay cliente real');
    ok(N.crearClienteAccesos({ env: { NEXO_URL: 'https://pautador.ejemplo.invalid', NEXO_CLAVE: CLAVE } }) === null, 'accesos: sin NEXO_MODO=real no hay cliente real');
    ok(N.crearClienteAccesos({ env: { NEXO_MODO: 'simulado', NEXO_URL: 'https://pautador.ejemplo.invalid', NEXO_CLAVE: CLAVE } }) === null, 'accesos: NEXO_MODO=simulado no hay cliente real');
    ok(N.modoAccesos(ENV_REAL) === 'real' && N.modoAccesos({ ...ENV_REAL, NEXO_CLAVE: '  ' }) === 'simulado', 'accesos: el modo real pide las tres variables');
    ok(N.crearNexo({ env: { NEXO_MODO: 'real', NEXO_URL: 'https://pautador.ejemplo.invalid' }, repositorio: repoNuevo() }).accesos === null, 'nexo real sin NEXO_CLAVE: sin función de accesos');
    ok(N.crearNexo({ env: {}, repositorio: repoNuevo() }).accesos === null, 'nexo simulado: sin función de accesos por defecto (se pasa la lista de mentira)');
    ok(N.crearNexo({ env: {}, repositorio: repoNuevo(), accesos: ACCESOS }).accesos === ACCESOS, 'nexo simulado: usa la lista de mentira que se le pasa');

    // llamada bien armada
    const f1 = fetchFalso(deLista);
    const cli = N.crearClienteAccesos({ env: ENV_REAL, fetch: f1 });
    ok(typeof cli === 'function' && cli.modo === 'real', 'accesos: con las tres variables hay cliente real');
    const r1a = await cli('implementador@ejemplo.invalid');
    const ll = f1.llamadas[0];
    ok(f1.llamadas.length === 1 && ll.url === 'https://pautador.ejemplo.invalid/api/servicio/accesos', 'accesos: llama a NEXO_URL + /api/servicio/accesos');
    ok(ll.init.method === 'POST', 'accesos: método POST');
    ok(ll.init.headers['x-pautador-servicio'] === CLAVE, 'accesos: la clave va en el header x-pautador-servicio');
    ok(!Object.keys(ll.init.headers).some((h) => h.toLowerCase() === 'x-pautador-usuario'), 'accesos: no manda x-pautador-usuario');
    ok(/json/.test(ll.init.headers['content-type']) && JSON.stringify(JSON.parse(ll.init.body)) === JSON.stringify({ email: 'implementador@ejemplo.invalid' }), 'accesos: cuerpo JSON con solo el email');
    ok(!ll.url.includes('?') && !ll.url.includes('implementador'), 'accesos: el mail no va en la URL');
    ok(ll.init.signal && typeof ll.init.signal.aborted === 'boolean' && ll.init.redirect === 'error', 'accesos: la llamada tiene corte por tiempo y no sigue redirecciones');
    ok(r1a.email === 'implementador@ejemplo.invalid' && r1a.habilitado === true && r1a.accesos.length === 1, 'accesos: devuelve la respuesta de PAUTADOR');
    ok(N.urlAccesos('https://p.ejemplo.invalid/base/') === 'https://p.ejemplo.invalid/base/api/servicio/accesos' && N.urlAccesos('http://p.ejemplo.invalid') === null && N.urlAccesos('http://localhost:4000') === 'http://localhost:4000/api/servicio/accesos' && N.urlAccesos('https://u:p@p.ejemplo.invalid') === null, 'accesos: solo https (http solo localhost), sin credenciales en la URL');

    // memoria de 5 minutos
    let t = 1000000;
    const f2 = fetchFalso(deLista);
    const cm = N.crearClienteAccesos({ env: ENV_REAL, fetch: f2, reloj: () => t });
    await cm('implementador@ejemplo.invalid');
    t += 4 * 60 * 1000;
    const m2 = await cm('IMPLEMENTADOR@ejemplo.invalid');
    ok(f2.llamadas.length === 1 && m2.email === 'implementador@ejemplo.invalid', 'memoria: la segunda consulta dentro de 5 minutos no sale (y no distingue mayúsculas)');
    m2.habilitado = false; m2.accesos.push({ proyecto: 'X' });
    ok((await cm('implementador@ejemplo.invalid')).habilitado === true && f2.llamadas.length === 1, 'memoria: cambiar lo devuelto no cambia lo guardado');
    t += 61 * 1000;
    await cm('implementador@ejemplo.invalid');
    ok(f2.llamadas.length === 2, 'memoria: pasados los 5 minutos vuelve a preguntar');
    await cm('a@ejemplo.invalid');
    ok(f2.llamadas.length === 3 && cm.tamano() === 2, 'memoria: cada mail tiene su entrada');
    cm.vaciar('implementador@ejemplo.invalid');
    await cm('implementador@ejemplo.invalid'); await cm('a@ejemplo.invalid');
    ok(f2.llamadas.length === 4, 'memoria: vaciar(mail) borra solo ese mail');
    cm.vaciar();
    ok(cm.tamano() === 0, 'memoria: vaciar() borra todo');
    await cm('a@ejemplo.invalid');
    ok(f2.llamadas.length === 5, 'memoria: después de vaciar vuelve a preguntar');
    const fTope = fetchFalso(deLista);
    const ct = N.crearClienteAccesos({ env: ENV_REAL, fetch: fTope, maxEntradas: 3 });
    for (const m of ['implementador@ejemplo.invalid', 'a@ejemplo.invalid', 'otro@ejemplo.invalid', 'pm@ejemplo.invalid']) await ct(m);
    ok(ct.tamano() === 3, 'memoria: no pasa el tope de entradas');
    await ct('pm@ejemplo.invalid'); ok(fTope.llamadas.length === 4, 'memoria: la más nueva queda');
    await ct('implementador@ejemplo.invalid'); ok(fTope.llamadas.length === 5, 'memoria: al pasar el tope se descarta la más vieja');
    ok(N.MEMORIA_ACCESOS_MS === 5 * 60 * 1000 && N.MAX_ENTRADAS_ACCESOS > 0, 'memoria: 5 minutos y tope definido');
    let soltarLenta; const fJ = fetchFalso((u, i) => new Promise((ok3) => { soltarLenta = () => ok3(deLista(u, i)); }));
    const cj = N.crearClienteAccesos({ env: ENV_REAL, fetch: fJ });
    const pj = [cj('a@ejemplo.invalid'), cj('a@ejemplo.invalid')];
    await new Promise((r) => setImmediate(r)); soltarLenta();
    const rj = await Promise.all(pj);
    ok(fJ.llamadas.length === 1 && rj.every((x) => x.email === 'a@ejemplo.invalid'), 'memoria: dos consultas simultáneas del mismo mail hacen una sola llamada');

    // errores: no se guardan y se tratan como "sin acceso"
    const casosError = [
      ['401', () => resp(401, { error: 'No autorizado.' }), /401/],
      ['429', () => resp(429, { error: 'x' }), /429/],
      ['500', () => resp(500, {}), /500/],
      ['503', () => resp(503, {}), /503/],
      ['400', () => resp(400, {}), /400/],
      ['sin conexión', () => { throw new Error('ECONNREFUSED con ' + CLAVE); }, /no se pudo conectar/],
      ['no es JSON', () => resp(200, () => { throw new Error('json'); }), /no es JSON/],
      ['otro mail', () => resp(200, { ...LISTA[1] }), /formato acordado/],
      ['sin habilitado', () => resp(200, { ...LISTA[0], habilitado: undefined }), /formato acordado/],
      ['accesos no es lista', () => resp(200, { ...LISTA[0], accesos: 'Santa Fe' }), /formato acordado/],
      ['lista en vez de objeto', () => resp(200, [LISTA[0]]), /formato acordado/],
      ['null', () => resp(200, null), /formato acordado/],
    ];
    for (const [nombre, responder, re] of casosError) {
      const fe = fetchFalso(responder);
      const ce = N.crearClienteAccesos({ env: ENV_REAL, fetch: fe });
      let err = null; try { await ce('implementador@ejemplo.invalid'); } catch (e) { err = e; }
      ok(err && re.test(err.message) && !err.message.includes(CLAVE), `error ${nombre}: lanza un error claro y sin la clave`);
      ok(ce.tamano() === 0, `error ${nombre}: no se guarda en la memoria`);
      const p = await N.revisarPermiso(ce, 'implementador@ejemplo.invalid', 'Santa Fe', 'Oficial', { esperaMs: 500 });
      ok(!p.ok && p.codigo === 'sin_respuesta' && !p.motivo.includes(CLAVE), `error ${nombre}: revisarPermiso lo trata como sin acceso`);
      ok(fe.llamadas.length === 2, `error ${nombre}: la consulta siguiente vuelve a preguntar`);
    }
    const fLenta = fetchFalso((u, init) => new Promise((_, mal) => { init.signal.addEventListener('abort', () => mal(new Error('abortado'))); }));
    const cl = N.crearClienteAccesos({ env: ENV_REAL, fetch: fLenta, esperaMs: 50 });
    let errL = null; try { await cl('a@ejemplo.invalid'); } catch (e) { errL = e; }
    ok(errL && /no contestó/.test(errL.message) && cl.tamano() === 0, 'error: si no contesta a tiempo se corta, y no se guarda');
    ok(N.ESPERA_ACCESOS_HTTP_MS === 5000, 'error: la espera es de 5 segundos');
    const fHttp = fetchFalso(deLista);
    const cHttp = N.crearClienteAccesos({ env: { ...ENV_REAL, NEXO_URL: 'http://pautador.ejemplo.invalid' }, fetch: fHttp });
    let errH = null; try { await cHttp('a@ejemplo.invalid'); } catch (e) { errH = e; }
    ok(errH && /https/.test(errH.message) && fHttp.llamadas.length === 0, 'error: con NEXO_URL sin https no se manda la clave');

    // mail deshabilitado o inexistente: 200 con habilitado false → no ve nada; se guarda (es una respuesta válida)
    const fd = fetchFalso(deLista);
    const cd = N.crearClienteAccesos({ env: ENV_REAL, fetch: fd });
    const pd = await N.revisarPermiso(cd, 'baja@ejemplo.invalid', 'Santa Fe', 'Oficial');
    ok(!pd.ok && pd.codigo === 'inactivo', 'deshabilitado: no puede pedir');
    const pn = await N.revisarPermiso(cd, 'nadie@ejemplo.invalid', 'Santa Fe', 'Oficial');
    ok(!pn.ok && pn.codigo === 'inactivo', 'inexistente (misma respuesta que deshabilitado): no puede pedir');
    await N.revisarPermiso(cd, 'nadie@ejemplo.invalid', 'Santa Fe', 'Oficial');
    ok(fd.llamadas.length === 2 && cd.tamano() === 2, 'deshabilitado e inexistente: la respuesta válida se guarda 5 minutos');
    ok((await N.revisarPermiso(cd, 'implementador@ejemplo.invalid', 'Santa Fe', 'Oficial')).ok, 'implementador del proyecto: puede pedir con la consulta real');
    ok((await N.revisarPermiso(cd, 'admin@ejemplo.invalid', 'Córdoba', 'Oficial')).alcance === 'global', 'administrador global: puede pedir con la consulta real');

    // conectado a crearNexo: en modo real es la función por defecto
    const fn = fetchFalso(deLista);
    const nexoReal = N.crearNexo({ env: ENV_REAL, repositorio: repoNuevo(), reloj: () => AHORA, fetch: fn });
    ok(nexoReal.modo === 'real' && typeof nexoReal.accesos === 'function' && nexoReal.accesos.modo === 'real', 'nexo real: la consulta a PAUTADOR es la función de accesos por defecto');
    const rnPm = await nexoReal.aceptar(tarjeta('Se comparte', [conj(C_A, ['900000000000001'])], { id: 'acc-pm' }), { ...CTX, pedidaPor: 'pm@ejemplo.invalid' });
    ok(rnPm.tipo === 'sin_permiso' && rnPm.codigo === 'rol_sin_permiso' && fn.llamadas.length === 1, 'nexo real: un PM no pide (lo dice la consulta)');
    const rnOk = await nexoReal.aceptar(tarjeta('Se comparte', [conj(C_A, ['900000000000001'])], { id: 'acc-impl' }), CTX);
    ok(rnOk.tipo === 'solicitud' && rnOk.envio.estado === 'sin_respuesta' && fn.llamadas.length === 2, 'nexo real: el implementador pasa el permiso (el envío real sigue sin construir)');
    await nexoReal.enviar(rnOk.solicitud);
    ok(fn.llamadas.length === 2, 'nexo real: el reintento no vuelve a preguntar dentro de los 5 minutos');
    ok(fn.llamadas.every((x) => x.url === 'https://pautador.ejemplo.invalid/api/servicio/accesos'), 'nexo real: solo llama a la ruta de accesos');
    const nexoAcc = N.crearNexo({ env: ENV_REAL, repositorio: repoNuevo(), accesos: ACCESOS });
    ok(nexoAcc.accesos === ACCESOS, 'nexo real: si se pasa una función de accesos, se usa esa');
  } finally { soltar(); }
  ok(!salida.some((l) => l.includes(CLAVE)), 'la clave nunca aparece en lo que se escribe en pantalla');
  ok(conexiones === 0, `consulta de accesos: ninguna conexión de red (se intentaron ${conexiones})`);

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
