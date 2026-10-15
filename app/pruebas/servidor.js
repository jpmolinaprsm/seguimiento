// Prueba del servidor de producción (server.js): sin sesión nada responde, y cada persona recibe solo lo suyo.
// Uso (desde Seguimiento/app):  node pruebas/servidor.js        No usa Google, ni PAUTADOR, ni claves: todo de mentira.
// Si existe el HTML armado de verdad, además comprueba que quien ve todo recibe exactamente el mismo HTML que el armado.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { crearServidor } = require('../../server');
const { leerConfig } = require('../../servidor/config');
const { crearSesiones } = require('../../servidor/sesion');
const { crearAccesosDe } = require('../../servidor/accesos');
const { validarIdentidad } = require('../../servidor/google');
const { cargarArmado, AVISO_SCRIPT, ICONOS_HEAD } = require('../../servidor/vista');
const { crearDisparador, activo: actualizacionActiva } = require('../../servidor/actualizacion');
const { EventEmitter } = require('events');
const { crearAlmacen } = require('../../base/almacen');
const { accesosDeLista, crearRepositorioArchivo } = { ...require('../../nexo/solicitud'), ...require('../../nexo/repositorio') };

let problemas = 0, pruebas = 0;
const ok = (cond, texto) => { pruebas++; if (!cond) { problemas++; console.log('  FALLA: ' + texto); } };
const SECRETO = crypto.randomBytes(32).toString('hex');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'syo-srv-'));

// ---- un HTML armado de mentira, con la misma forma que el real ----
const proy = (id, nombre, cliente) => ({ id, nombre, cliente, general: { periodos: {}, cdet: {}, ef: [] },
  canales: { Oficial: { canal: 'Oficial', secreto: `OFICIAL_${id}` }, Informativo: { canal: 'Informativo', secreto: `INFORM_${id}` } } });
const DATA = {
  cuartiles: { orden: ['cr'], costo: [true], pl: { 'Oficial|Gobierno de Alfa|Alcance|Reels': [[1, 2, 3]], 'Oficial|Gobierno de Beta|Alcance|Reels': [[4, 5, 6]], 'Oficial|Gobierno de Gamma|Alcance|Reels': [[7, 8, 9]] }, ob: {} },
  lookers: { 'alfa|Oficial': 'https://ejemplo.test/alfa', 'beta|Oficial': 'https://ejemplo.test/beta', 'gamma|Informativo': 'https://ejemplo.test/gamma' },
  generales: [['texto general', 'fuente']], todos: { ef: { Oficial: [{ title: 'SUMA_DE_TODOS' }] } }, datosHasta: '2026-10-10',
  proyectos: [proy('alfa', 'Alfa', 'Gobierno de Alfa'), proy('beta', 'Beta', 'Gobierno de Beta'), proy('gamma', 'Gamma', 'Gobierno de Gamma')],
};
const logica = 'class C{}\nconst DATA = ' + JSON.stringify(DATA) + ';\nnew C();\n';
const template = '<x-dc></x-dc><script type="text/x-dc" id="l">' + logica + '</script>';
const htmlFalso = '<!DOCTYPE html><html><head><title>t</title></head><body><script type="__bundler/template">' + JSON.stringify(template).replace(/<\//g, '<\\/') + '</script></body></html>';
const rutaHtml = path.join(tmp, 'armado.html');
fs.writeFileSync(rutaHtml, htmlFalso);

// ---- quién es quién (formato de PAUTADOR) ----
const persona = (email, extra) => ({ email, nombre: email.split('@')[0], habilitado: true, rol: 'implementador', administradorGlobal: false, superadministrador: false, accesos: [], ...extra });
const LISTA = [
  persona('admin@empresa.test', { rol: 'administrador', administradorGlobal: true }),
  persona('solo-alfa@empresa.test', { accesos: [{ proyecto: 'Gobierno de Alfa', activo: null, rol: null, canales: [] }] }),
  persona('inf-beta@empresa.test', { accesos: [{ proyecto: 'Beta', activo: null, rol: null, canales: ['Informativo'] }] }),
  persona('pm@empresa.test', { rol: 'pm_cuentas', accesos: [{ proyecto: 'Alfa', activo: null, rol: null, canales: [] }] }),
  persona('baja@empresa.test', { habilitado: false, accesos: [{ proyecto: 'Alfa', activo: null, rol: null, canales: [] }] }),
  persona('sin-nada@empresa.test', { accesos: [] }),
];

const sesionesPrueba = crearSesiones({ secreto: SECRETO, seguro: false });
const cookieDe = (email) => 'syo_sesion=' + sesionesPrueba.crearValor({ email, nombre: email });

async function levantar({ accesos, env = {}, google, nexo, aliasCampanas, disparador } = {}) {
  const cfg = leerConfig({ SESSION_SECRET: SECRETO, GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'x', AUTH_DOMINIO: 'empresa.test', URL_BASE: 'http://localhost', HTML_ARMADO: rutaHtml, DATOS_DIR: path.join(tmp, 'datos' + Math.random()), SUPABASE_URL: '', ...env });
  const s = crearServidor({ cfg, log: () => {}, almacen: crearAlmacen({ tipo: 'archivo', carpeta: cfg.datosDir }), google, ...(nexo ? { nexo } : {}), ...(aliasCampanas ? { aliasCampanas } : {}), ...(disparador ? { disparador } : {}), accesosDe: accesos || crearAccesosDe({ cliente: null, lista: accesosDeLista(LISTA) }) });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + s.address().port;
  const pedir = async (ruta, { cookie, metodo = 'GET', cuerpo, headers = {} } = {}) => {
    const r = await fetch(base + ruta, { method: metodo, redirect: 'manual', headers: { ...(cookie ? { cookie } : {}), ...(cuerpo ? { 'content-type': 'application/json' } : {}), ...headers }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    return { status: r.status, headers: r.headers, texto: await r.text() };
  };
  return { s, pedir, cerrar: () => new Promise((r) => s.close(r)) };
}
const datosDe = (texto) => { const f = path.join(tmp, 'v' + Math.random() + '.html'); fs.writeFileSync(f, texto); return cargarArmado(f).DATA; };

(async () => {
  const A = await levantar();

  console.log('1. /salud y pantalla de entrada: sin datos');
  let r = await A.pedir('/salud');
  ok(r.status === 200 && JSON.parse(r.texto).ok === true && JSON.parse(r.texto).accesos === 'ok' && Object.keys(JSON.parse(r.texto)).sort().join() === 'accesos,actualizacion,ok' && !/OFICIAL_|Alfa/.test(r.texto), '/salud responde solo {ok, accesos, actualizacion} (sin datos)');
  r = await A.pedir('/entrar');
  ok(r.status === 200 && /Entrar con Google/.test(r.texto) && !/OFICIAL_|Alfa/.test(r.texto), '/entrar muestra el botón y ningún dato');

  console.log('2. sin sesión: todo cerrado');
  for (const [m, ruta, cuerpo] of [['GET', '/'], ['GET', '/index.html'], ['GET', '/api/yo'], ['GET', '/api/respuestas'], ['GET', '/api/nexo/estado?id=x'], ['GET', '/api/nexo/recomendacion?id=x'],
    ['POST', '/api/respuesta', { x: 1 }], ['POST', '/api/nexo/solicitud', { recomendacion: {} }], ['GET', '/cualquier/cosa'], ['GET', '/Seguimiento y Optimizacion.html'], ['GET', '/repositorio/respuestas.jsonl'], ['POST', '/salir']]) {
    r = await A.pedir(ruta, { metodo: m, cuerpo });
    ok((r.status === 401 || (r.status === 302 && r.headers.get('location') === '/entrar')) && !/OFICIAL_|INFORM_|Alfa/.test(r.texto), `${m} ${ruta} sin sesión → ${r.status}`);
  }
  r = await A.pedir('/api/yo'); ok(r.status === 401, '/api/* sin sesión da 401');

  console.log('3. cookies falsas o vencidas');
  const buena = cookieDe('admin@empresa.test');
  const alterada = buena.slice(0, -3) + (buena.endsWith('AAA') ? 'BBB' : 'AAA');
  r = await A.pedir('/api/yo', { cookie: alterada }); ok(r.status === 401, 'firma alterada → 401');
  const falsa = 'syo_sesion=' + Buffer.from(JSON.stringify({ email: 'admin@empresa.test', exp: Date.now() + 1e9 })).toString('base64url') + '.firmafalsa';
  r = await A.pedir('/api/yo', { cookie: falsa }); ok(r.status === 401, 'cookie armada a mano → 401');
  const venc = crearSesiones({ secreto: SECRETO, seguro: false, reloj: () => Date.now() - 30 * 24 * 3600e3 });
  r = await A.pedir('/api/yo', { cookie: 'syo_sesion=' + venc.crearValor({ email: 'admin@empresa.test' }) }); ok(r.status === 401, 'cookie vencida → 401');
  const otraClave = crearSesiones({ secreto: crypto.randomBytes(32).toString('hex'), seguro: false });
  r = await A.pedir('/api/yo', { cookie: 'syo_sesion=' + otraClave.crearValor({ email: 'admin@empresa.test' }) }); ok(r.status === 401, 'cookie firmada con otra clave → 401');

  console.log('4. con sesión pero sin acceso');
  for (const mail of ['sin-nada@empresa.test', 'baja@empresa.test', 'pm@empresa.test', 'desconocido@empresa.test']) {
    r = await A.pedir('/', { cookie: cookieDe(mail) });
    ok(r.status === 403 && !/OFICIAL_|INFORM_|Alfa|Beta|Gamma/.test(r.texto), `${mail} → 403 sin datos (${r.status})`);
    r = await A.pedir('/api/respuestas', { cookie: cookieDe(mail) }); ok(r.status === 403, `${mail} /api → 403`);
  }

  console.log('5. cada persona recibe solo lo suyo');
  const ver = async (mail) => { const r2 = await A.pedir('/', { cookie: cookieDe(mail), headers: { 'accept-encoding': 'gzip' } }); return { r: r2, texto: r2.status === 200 ? r2.texto : '' }; };
  // fetch descomprime solo; así que el texto ya viene plano
  let v = await ver('solo-alfa@empresa.test');
  ok(v.r.status === 200, 'solo-alfa entra');
  ok(v.texto.includes('OFICIAL_alfa') && v.texto.includes('INFORM_alfa'), 'solo-alfa recibe Alfa completo');
  ok(!/_beta|_gamma|Gobierno de Beta|Gobierno de Gamma|ejemplo\.test\/beta|ejemplo\.test\/gamma|SUMA_DE_TODOS/.test(v.texto), 'solo-alfa no recibe nada de Beta, Gamma ni la suma de todos');
  let d = datosDe(v.texto);
  ok(d.proyectos.length === 1 && d.proyectos[0].id === 'alfa', 'solo-alfa: un solo proyecto en los datos');
  ok(Object.keys(d.cuartiles.pl).length === 1 && Object.keys(d.lookers).length === 1, 'referencias y Looker recortados');
  ok(v.r.headers.get('cache-control').includes('private'), 'respuesta privada (sin caché compartida)');

  v = await ver('inf-beta@empresa.test');
  ok(v.texto.includes('INFORM_beta') && !v.texto.includes('OFICIAL_beta'), 'inf-beta recibe Beta Informativo y NO Beta Oficial');
  ok(!/_alfa|_gamma|Gobierno de Alfa|Gobierno de Gamma/.test(v.texto), 'inf-beta no recibe Alfa ni Gamma');
  d = datosDe(v.texto); ok(d.proyectos[0].general === null, 'con un solo canal se saca la pestaña General (mezcla ambos canales)');

  v = await ver('admin@empresa.test');
  ok(v.texto.includes('OFICIAL_alfa') && v.texto.includes('INFORM_gamma') && v.texto.includes('SUMA_DE_TODOS'), 'el administrador global recibe todo');
  ok(v.texto === htmlFalso.replace('</head>', () => AVISO_SCRIPT + ICONOS_HEAD + '</head>'), 'quien ve todo recibe exactamente el HTML armado (byte a byte), más la franja de aviso');
  r = await A.pedir('/', { cookie: cookieDe('admin@empresa.test') });
  const et = r.headers.get('etag'); const r304 = await A.pedir('/', { cookie: cookieDe('admin@empresa.test'), headers: { 'if-none-match': et } });
  ok(et && r304.status === 304, 'ETag y 304');

  console.log('6. API: proyectos ajenos');
  const sa = cookieDe('solo-alfa@empresa.test');
  r = await A.pedir('/api/respuesta', { cookie: sa, metodo: 'POST', cuerpo: { clase: 'pantalla', pantalla: 'Resumen', proyecto: 'Beta', canal: 'Oficial', comentario: 'ajeno' } }); ok(r.status === 403, 'comentar un proyecto ajeno → 403');
  r = await A.pedir('/api/respuesta', { cookie: sa, metodo: 'POST', cuerpo: { clase: 'pantalla', pantalla: 'Resumen', proyecto: 'Alfa', canal: 'Oficial', comentario: 'propio', autor: 'otro@empresa.test' } }); ok(r.status === 200, 'comentar uno propio → 200');
  await A.pedir('/api/respuesta', { cookie: cookieDe('admin@empresa.test'), metodo: 'POST', cuerpo: { clase: 'pantalla', pantalla: 'Resumen', proyecto: 'Beta', canal: 'Oficial', comentario: 'de beta' } });
  r = await A.pedir('/api/respuestas', { cookie: sa }); let lista = JSON.parse(r.texto);
  ok(lista.length === 1 && lista[0].comentario === 'propio', '/api/respuestas devuelve solo lo de sus proyectos');
  ok(lista[0].autor === 'solo-alfa@empresa.test', 'el autor sale de la sesión, no de lo que manda la página');
  r = await A.pedir('/api/respuesta', { cookie: sa, metodo: 'POST', cuerpo: { proyecto: 'Alfa' }, headers: { origin: 'https://sitio-malo.test' } }); ok(r.status === 403, 'POST desde otro origen → 403');
  r = await A.pedir('/api/nexo/solicitud', { cookie: sa, metodo: 'POST', cuerpo: { recomendacion: { id: 'r' }, proyecto: 'Beta', canal: 'Oficial' } }); ok(r.status === 403, 'pedir un cambio en un proyecto ajeno → 403');
  r = await A.pedir('/api/nexo/solicitud', { cookie: sa, metodo: 'POST', cuerpo: { recomendacion: { id: 'r' }, proyecto: 'Alfa', canal: 'Oficial' } }); ok(r.status !== 403 && r.status !== 401, `pedir un cambio en uno propio no se frena por proyecto (${r.status})`);
  r = await A.pedir('/api/nexo/estado?id=no-existe', { cookie: sa }); ok(r.status === 404, 'estado de una solicitud inexistente → 404');
  r = await A.pedir('/api/yo', { cookie: sa }); const yo = JSON.parse(r.texto); ok(yo.email === 'solo-alfa@empresa.test' && yo.proyectos.length === 1 && !yo.global, '/api/yo');

  console.log('6b. envío de pedidos apagado (solo ver)');
  let recibido = null;
  const nexoApagado = { modo: 'simulado', envioHabilitado: false, repositorio: { porRecomendacion: () => [], leerSolicitud: () => null },
    aceptar: async (rec, ctx) => { recibido = ctx; return { tipo: 'solicitud', solicitud: { id: 's1' }, envio: { estado: 'no_enviada', codigo: 'envio_apagado', motivo: 'Todavía no se envían los pedidos a PAUTADOR', enviada: false } }; }, consultar: async () => null };
  const N0 = await levantar({ nexo: nexoApagado });
  r = await N0.pedir('/api/nexo/solicitud', { cookie: sa, metodo: 'POST', cuerpo: { recomendacion: { id: 'r' }, proyecto: 'Alfa', canal: 'Oficial', pedida_por: 'otro@empresa.test' } });
  const jn = JSON.parse(r.texto);
  ok(r.status === 200 && jn.envio.codigo === 'envio_apagado' && jn.envio.enviada === false && /Todavía no se envían/.test(jn.envio.motivo), 'con el envío apagado el servidor devuelve el pedido armado y el motivo (solo ver)');
  ok(recibido && recibido.pedidaPor === 'solo-alfa@empresa.test', 'quien pide sale de la sesión, no de lo que mande la página');
  await N0.cerrar();

  console.log('7. accesos: PAUTADOR caído → lista provisoria; baja → afuera');
  const caido = async () => { throw new Error('PAUTADOR respondió 503'); };
  caido.vaciar = () => {};
  const B = await levantar({ accesos: crearAccesosDe({ cliente: caido, lista: accesosDeLista(LISTA) }) });
  r = await B.pedir('/api/yo', { cookie: cookieDe('solo-alfa@empresa.test') }); ok(r.status === 200, 'con PAUTADOR caído, entra por la lista provisoria');
  r = await B.pedir('/api/yo', { cookie: cookieDe('baja@empresa.test') }); ok(r.status === 403, 'dado de baja en la lista → 403');
  const bajaReal = async (m) => ({ email: m, habilitado: false, rol: null, administradorGlobal: false, accesos: [] });
  const C = await levantar({ accesos: crearAccesosDe({ cliente: bajaReal, lista: accesosDeLista(LISTA) }) });
  r = await C.pedir('/api/yo', { cookie: cookieDe('solo-alfa@empresa.test') }); ok(r.status === 403, 'PAUTADOR dice "no habilitado": no cae a la lista');
  const sinFuente = await levantar({ accesos: crearAccesosDe({ cliente: null, lista: null }) });
  r = await sinFuente.pedir('/api/yo', { cookie: cookieDe('admin@empresa.test') }); ok(r.status === 403, 'sin consulta ni lista: nadie ve nada');
  const lanza = async () => { throw new Error('se cayó'); };
  const D = await levantar({ accesos: lanza });
  r = await D.pedir('/api/yo', { cookie: cookieDe('admin@empresa.test') }); ok(r.status === 503, 'si el hook falla del todo → 503, sin datos');

  console.log('7b. PAUTADOR falla: qué se hace en cada caso');
  const hoyMs = Date.now(); const dias = (n) => new Date(hoyMs - n * 86400000).toISOString();
  const listaCon = (generada) => { const f = accesosDeLista(LISTA); if (generada !== undefined) f.generada_el = generada; return f; };
  const errHttp = (n) => async () => { throw new Error(`PAUTADOR respondió ${n}`); };
  const SOLO = 'solo-alfa@empresa.test';
  const probar = async (cliente, lista, mail = SOLO) => { const regs = []; const f = crearAccesosDe({ cliente, lista, registrar: (m) => regs.push(m), reloj: () => hoyMs, esperar: async () => {}, reintentoMs: 0 }); let res, err = null; try { res = await f(mail); } catch (e) { err = e; } return { res, err, regs, f }; };
  for (const n of [401, 403]) {
    const x = await probar(errHttp(n), listaCon(dias(1)));
    ok(x.err && x.err.codigo === 'clave_rechazada' && x.res === undefined, `PAUTADOR ${n}: se cierra, no se usa la lista aunque esté vigente`);
    ok(x.regs.some((m) => /ERROR accesos/.test(m) && /rechazó la clave/.test(m)) && !x.regs.join(' ').includes(SOLO), `PAUTADOR ${n}: queda un error claro en el registro, sin el mail`);
    ok(x.f.salud().degradado === true && x.f.salud().motivo === 'clave_rechazada', `PAUTADOR ${n}: la salud queda degradada`);
  }
  for (const [nombre, cli] of [['timeout', async () => { throw new Error('PAUTADOR no contestó en 5 segundos'); }], ['sin conexión', async () => { throw new Error('no se pudo conectar con PAUTADOR'); }], ['503', errHttp(503)], ['500', errHttp(500)], ['formato raro', async () => { throw new Error('la respuesta de PAUTADOR no tiene el formato acordado'); }]]) {
    let x = await probar(cli, listaCon(dias(2)));
    ok(x.res && x.res.email === SOLO && x.f.salud().degradado === true, `${nombre}: con lista de hace 2 días entra por la lista (y la salud queda degradada)`);
    x = await probar(cli, listaCon(dias(8))); ok(x.res === null, `${nombre}: con lista de hace 8 días nadie entra`);
    x = await probar(cli, listaCon(null)); ok(x.res === null, `${nombre}: lista sin fecha → nadie entra`);
    x = await probar(cli, listaCon(undefined === 1 ? 0 : '')); ok(x.res === null, `${nombre}: fecha vacía → nadie entra`);
  }
  let x = await probar(errHttp(503), listaCon(dias(8))); ok(x.regs.some((m) => /ERROR accesos/.test(m) && /más de 7 días/.test(m)), 'lista vencida: queda un error claro en el registro');
  // 429: se reintenta una vez
  let llamadas = 0; const una429 = async (m) => { llamadas++; if (llamadas === 1) throw new Error('PAUTADOR respondió 429 (demasiadas consultas)'); return await accesosDeLista(LISTA)(m); };
  x = await probar(una429, listaCon(dias(1))); ok(llamadas === 2 && x.res && x.res.email === SOLO && x.f.salud().degradado === false, '429 y después responde: se reintenta una vez y se usa la respuesta de PAUTADOR');
  llamadas = 0; const siempre429 = async () => { llamadas++; throw new Error('PAUTADOR respondió 429 (demasiadas consultas)'); };
  x = await probar(siempre429, listaCon(dias(1))); ok(llamadas === 2 && x.res && x.res.email === SOLO, '429 dos veces: se trata como 5xx (lista vigente) tras un solo reintento');
  llamadas = 0; x = await probar(siempre429, listaCon(dias(9))); ok(llamadas === 2 && x.res === null, '429 dos veces con lista vencida: nadie entra');
  // baja explícita
  const bajaP = async (m) => ({ email: m, habilitado: false, rol: null, administradorGlobal: false, accesos: [] });
  x = await probar(bajaP, listaCon(dias(1))); ok(x.res && x.res.habilitado === false, 'baja explícita de PAUTADOR: se respeta, no se pisa con la lista');
  // consulta apagada: la lista vale solo si es reciente
  x = await probar(null, listaCon(dias(3))); ok(x.res && x.res.email === SOLO, 'consulta apagada y lista de hace 3 días: entra');
  x = await probar(null, listaCon(dias(10))); ok(x.res === null, 'consulta apagada y lista de hace 10 días: nadie entra');
  // el archivo de la lista: con fecha y sin fecha
  const { crearAccesosDeLista } = require('../../nexo/accesos-lista');
  const conJson = (o) => crearAccesosDeLista({ env: { NEXO_ACCESOS_JSON: JSON.stringify(o) } });
  ok(conJson({ generada_el: '2026-10-13', accesos: LISTA }).generada_el === '2026-10-13', 'la lista nueva { generada_el, accesos } trae su fecha');
  ok(conJson(LISTA).generada_el === null, 'la lista vieja (arreglo pelado) queda sin fecha: vencida');
  // en el servidor: 401 → nadie entra y /salud degradado; 5xx con lista vigente entra; 5xx con lista vencida no
  const regsS = [];
  const S401 = await levantar({ accesos: crearAccesosDe({ cliente: errHttp(401), lista: listaCon(dias(1)), registrar: (m) => regsS.push(m) }) });
  r = await S401.pedir('/api/yo', { cookie: cookieDe('admin@empresa.test') }); ok(r.status === 503, 'servidor con la clave rechazada: nadie entra');
  r = await S401.pedir('/salud'); const js = JSON.parse(r.texto); ok(r.status === 200 && js.accesos === 'degradado' && !/401|clave|@/i.test(r.texto), '/salud muestra "degradado" sin datos sensibles');
  ok(regsS.some((m) => /rechazó la clave/.test(m)), 'el servidor deja el error en el registro');
  const S5 = await levantar({ accesos: crearAccesosDe({ cliente: errHttp(503), lista: listaCon(dias(1)), registrar: () => {} }) });
  r = await S5.pedir('/api/yo', { cookie: cookieDe(SOLO) }); ok(r.status === 200, 'servidor con PAUTADOR caído y lista vigente: entra');
  const S5v = await levantar({ accesos: crearAccesosDe({ cliente: errHttp(503), lista: listaCon(dias(8)), registrar: () => {} }) });
  r = await S5v.pedir('/api/yo', { cookie: cookieDe(SOLO) }); ok(r.status === 403, 'servidor con PAUTADOR caído y lista vencida: nadie entra');
  // vaciar la memoria de accesos: solo administrador
  let vaciadas = 0; const conVaciar = crearAccesosDe({ cliente: null, lista: accesosDeLista(LISTA) }); const vaciarOriginal = conVaciar.vaciar; conVaciar.vaciar = (m) => { vaciadas++; return vaciarOriginal(m); };
  const SV = await levantar({ accesos: conVaciar });
  r = await SV.pedir('/api/admin/accesos/vaciar', { cookie: cookieDe(SOLO), metodo: 'POST', cuerpo: {} }); ok(r.status === 403 && vaciadas === 0, 'vaciar la memoria de accesos: un implementador no puede');
  r = await SV.pedir('/api/admin/accesos/vaciar', { cookie: cookieDe('admin@empresa.test'), metodo: 'POST', cuerpo: {} }); ok(r.status === 200 && vaciadas === 1, 'vaciar la memoria de accesos: el administrador sí');
  r = await SV.pedir('/api/admin/accesos/vaciar', { metodo: 'POST', cuerpo: {} }); ok(r.status === 401, 'vaciar la memoria de accesos: sin sesión → 401');
  for (const z of [S401, S5, S5v, SV]) await z.cerrar();

  console.log('8. inicio de sesión con Google (de mentira) y modo prueba');
  const g = { habilitado: true, urlDeEntrada: (st) => 'https://accounts.google.test/auth?state=' + st, identificar: async (codigo) => { if (codigo === 'malo') throw new Error('Solo pueden entrar cuentas de empresa.test.'); return { email: 'solo-alfa@empresa.test', nombre: 'Solo Alfa' }; } };
  const G = await levantar({ google: g });
  r = await G.pedir('/auth/google'); ok(r.status === 302 && r.headers.get('location').includes('state='), '/auth/google redirige a Google con state');
  const estado = new URL(r.headers.get('location')).searchParams.get('state');
  const cookieEstado = r.headers.get('set-cookie').split(';')[0];
  r = await G.pedir('/auth/google/callback?code=ok&state=otro', { cookie: cookieEstado }); ok(r.status === 403 && !r.headers.get('set-cookie')?.includes('syo_sesion=') || !/syo_sesion=[^;]+\./.test(r.headers.get('set-cookie') || ''), 'state distinto → no abre sesión');
  r = await G.pedir('/auth/google/callback?code=malo&state=' + estado, { cookie: cookieEstado }); ok(r.status === 403, 'cuenta de otro dominio → 403');
  r = await G.pedir('/auth/google/callback?code=ok&state=' + estado, { cookie: cookieEstado });
  const sc = r.headers.get('set-cookie') || '';
  ok(r.status === 302 && /syo_sesion=[^;]+\./.test(sc), 'callback correcto abre sesión');
  ok(/HttpOnly/i.test(sc) && /SameSite=Lax/i.test(sc), 'cookie HttpOnly y SameSite');
  const gp = await levantar({ env: { URL_BASE: 'https://tablero.empresa.test', NODE_ENV: 'production' }, google: g });
  const rp = await gp.pedir('/auth/google'); const ep = new URL(rp.headers.get('location')).searchParams.get('state'); const cp = rp.headers.get('set-cookie').split(';')[0];
  const rr = await gp.pedir('/auth/google/callback?code=ok&state=' + ep, { cookie: cp });
  ok(/__Host-syo_sesion=/.test(rr.headers.get('set-cookie')) && /;\s*Secure/i.test(rr.headers.get('set-cookie')), 'en producción la cookie es Secure y __Host-');
  ok(gp.s.cfg.usuarioPrueba === '', 'en producción no hay usuario de prueba');
  let imp = false; try { validarIdentidad({ email: 'x@otra.test', email_verified: true }, 'empresa.test'); } catch (e) { imp = true; } ok(imp, 'validarIdentidad rechaza otro dominio');
  imp = false; try { validarIdentidad({ email: 'x@empresa.test', email_verified: false }, 'empresa.test'); } catch (e) { imp = true; } ok(imp, 'validarIdentidad rechaza mail sin verificar');
  imp = false; try { validarIdentidad({ email: 'x@evilempresa.test', email_verified: true }, 'empresa.test'); } catch (e) { imp = true; } ok(imp, 'validarIdentidad rechaza dominios parecidos');
  const P = await levantar({ env: { MODO_PRUEBA_USUARIO: 'admin@empresa.test', NODE_ENV: 'production', URL_BASE: 'https://t.empresa.test' } });
  r = await P.pedir('/prueba/entrar'); ok(r.status === 302 && r.headers.get('location') === '/entrar' && !r.headers.get('set-cookie'), 'MODO_PRUEBA_USUARIO en producción no hace nada');
  const T = await levantar({ env: { MODO_PRUEBA_USUARIO: 'solo-alfa@empresa.test', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' } });
  r = await T.pedir('/prueba/entrar'); ok(r.status === 302 && /syo_sesion=/.test(r.headers.get('set-cookie') || ''), 'fuera de producción, el usuario de prueba entra');
  let falla = false; try { crearServidor({ cfg: leerConfig({ NODE_ENV: 'production' }), log: () => {} }); } catch (e) { falla = /SESSION_SECRET/.test(e.message); } ok(falla, 'en producción sin variables no arranca y dice cuáles faltan');

  const SA0 = await levantar({ env: { HTML_ARMADO: path.join(tmp, 'no-existe.html') } });
  r = await SA0.pedir('/api/yo', { cookie: cookieDe('admin@empresa.test') }); ok(r.status === 503, 'sin HTML armado todavía: 503 (y el servidor arranca igual)');
  r = await SA0.pedir('/salud'); ok(r.status === 200, '/salud responde aunque no haya HTML armado');
  await SA0.cerrar();

  console.log('10. el HTML armado cambia mientras el servidor está prendido');
  const rutaCambio = path.join(tmp, 'cambio.html');
  fs.writeFileSync(rutaCambio, htmlFalso);
  const H = await levantar({ env: { HTML_ARMADO: rutaCambio } });
  const adm = cookieDe('admin@empresa.test'), sal = cookieDe('solo-alfa@empresa.test');
  let a1 = await H.pedir('/', { cookie: adm }), b1 = await H.pedir('/', { cookie: sal });
  ok(a1.texto.includes('OFICIAL_alfa') && b1.texto.includes('OFICIAL_alfa'), 'antes del cambio: versión vieja');
  const DATA2 = JSON.parse(JSON.stringify(DATA)); DATA2.proyectos.forEach((p) => { p.canales.Oficial.secreto = 'NUEVO_' + p.id; });
  const tpl2 = '<x-dc></x-dc><script type="text/x-dc" id="l">class C{}\nconst DATA = ' + JSON.stringify(DATA2) + ';\nnew C();\n</script>';
  const nuevoHtml = '<!DOCTYPE html><html><head><title>t</title></head><body><script type="__bundler/template">' + JSON.stringify(tpl2).replace(/<\//g, '<\\/') + '</script></body></html>';
  const tmpNuevo = rutaCambio + '.nuevo'; fs.writeFileSync(tmpNuevo, nuevoHtml); fs.renameSync(tmpNuevo, rutaCambio);   // como hace actualizar.js: se renombra encima
  const t = new Date(Date.now() + 5000); fs.utimesSync(rutaCambio, t, t);
  a1 = await H.pedir('/', { cookie: adm }); b1 = await H.pedir('/', { cookie: sal });
  ok(a1.texto.includes('NUEVO_alfa') && !a1.texto.includes('OFICIAL_alfa'), 'el administrador recibe la versión nueva sin reiniciar');
  ok(b1.texto.includes('NUEVO_alfa') && !b1.texto.includes('OFICIAL_alfa') && !/_beta|_gamma/.test(b1.texto), 'la combinación de solo-alfa también se rearma (y sigue recortada)');
  await H.cerrar();

  console.log('11. aviso "sin dato de hoy"');
  const carpetaEstado = path.join(tmp, 'actualizacion'); fs.mkdirSync(carpetaEstado, { recursive: true });
  const rutaEst = path.join(carpetaEstado, 'estado.json');
  const conEstado = async (estado) => { fs.writeFileSync(rutaEst, JSON.stringify(estado)); const X = await levantar({ env: { HTML_ARMADO: rutaHtml } }); const rr = await X.pedir('/api/aviso', { cookie: sa }); await X.cerrar(); return rr; };
  r = await conEstado({ sin_dato_de_hoy: true, aviso: 'Sin dato de hoy: los números son al 11/10' });
  ok(r.status === 200 && JSON.parse(r.texto).aviso === 'Sin dato de hoy: los números son al 11/10', 'con sin_dato_de_hoy true, /api/aviso trae el texto');
  r = await conEstado({ sin_dato_de_hoy: false, aviso: null }); ok(JSON.parse(r.texto).aviso === null, 'con sin_dato_de_hoy false, no hay aviso');
  r = await conEstado({ sin_dato_de_hoy: false, aviso: 'texto que no corresponde' }); ok(JSON.parse(r.texto).aviso === null, 'el aviso solo sale si sin_dato_de_hoy es true');
  fs.rmSync(rutaEst); r = await conEstado.call(null, {}); ok(JSON.parse(r.texto).aviso === null, 'estado sin campos: sin aviso');
  r = await A.pedir('/api/aviso'); ok(r.status === 401, '/api/aviso sin sesión → 401');
  v = await ver('admin@empresa.test'); ok(v.texto.includes('/api/aviso') && v.texto.includes('syo-aviso'), 'la página trae el script de la franja de aviso');

  console.log('12. disparador de la actualización diaria (reloj simulado)');
  const dirD = fs.mkdtempSync(path.join(tmp, 'disp-')); const estD = path.join(dirD, 'estado.json');
  const ponerEstado = (o) => fs.writeFileSync(estD, JSON.stringify(o));
  const utc = (dia, hhmm) => Date.parse(`${dia}T${hhmm}:00Z`);
  let ahora = utc('2026-10-14', '13:00'); const lanzados = []; let ultimoProc = null; const logs = [];
  const falso = () => { const p = new EventEmitter(); p.stdout = new EventEmitter(); p.stderr = new EventEmitter(); ultimoProc = p; lanzados.push(ahora); return p; };
  const D1 = crearDisparador({ rutaEstado: estD, reloj: () => ahora, lanzar: falso, log: (m) => logs.push(m), env: { NODE_ENV: 'production' } });
  const en = (hhmm) => { ahora = utc('2026-10-14', hhmm); return D1.revisar(); };
  ok(D1.activo === true, 'activo en producción');
  ponerEstado({ ultimo_ok_dia: '2026-10-13', sin_dato_de_hoy: false });
  ok(en('13:29').lanzo === false && lanzados.length === 0, '10:29 de Argentina: todavía no');
  ok(en('13:30').lanzo === true && lanzados.length === 1, '10:30 de Argentina (13:30 UTC): lanza la actualización');
  ok(en('13:31').motivo === 'ya_corre' && lanzados.length === 1, 'mientras corre no lanza otra');
  ponerEstado({ ultimo_ok_dia: '2026-10-13', sin_dato_de_hoy: true, ultima_corrida: { resultado: 'sin_dato_de_hoy', sin_dato_de_hoy: true, termino: '2026-10-14T13:36:00Z' } });
  ultimoProc.emit('close', 0);
  ok(D1.corriendo() === false, 'al terminar el proceso, el disparador queda libre');
  ok(en('14:59').lanzo === false && lanzados.length === 1, '11:59: no reintenta antes de las 12:00');
  ok(en('15:00').lanzo === true && lanzados.length === 2, '12:00 con "sin dato de hoy": reintenta');
  ok(en('15:01').lanzo === false, 'no repite el mismo horario');
  ponerEstado({ ultimo_ok_dia: '2026-10-13', sin_dato_de_hoy: true, ultima_corrida: { resultado: 'sin_dato_de_hoy', sin_dato_de_hoy: true, termino: '2026-10-14T15:05:00Z' } });
  ultimoProc.emit('close', 0);
  ok(en('17:00').lanzo === true && lanzados.length === 3, '14:00 con "sin dato de hoy": último reintento');
  ponerEstado({ ultimo_ok_dia: '2026-10-14', sin_dato_de_hoy: false }); ultimoProc.emit('close', 0);
  ok(en('17:30').lanzo === false && en('20:00').lanzo === false && lanzados.length === 3, 'con corrida buena de hoy no lanza más');
  ok(logs.some((l) => l.includes('lanzada')) && fs.readFileSync(path.join(dirD, 'disparador.jsonl'), 'utf8').split('\n').filter(Boolean).length >= 4, 'queda registro en el servidor y en disparador.jsonl');
  // ya hay corrida buena de hoy: a las 10:30 no lanza
  const lan2 = []; const D2 = crearDisparador({ rutaEstado: estD, reloj: () => utc('2026-10-14', '13:35'), lanzar: () => { lan2.push(1); return falso(); }, env: { NODE_ENV: 'production' } });
  ok(D2.revisar().lanzo === false && lan2.length === 0, 'si hoy ya hubo corrida buena, a las 10:30 no lanza');
  // falló por error (no "sin dato"): no se reintenta a las 12:00
  ponerEstado({ ultimo_ok_dia: '2026-10-13', sin_dato_de_hoy: false, ultima_corrida: { resultado: 'error', sin_dato_de_hoy: false, termino: '2026-10-14T13:40:00Z' } });
  const lan3 = []; let t3 = utc('2026-10-14', '13:30'); const D3 = crearDisparador({ rutaEstado: estD, reloj: () => t3, lanzar: () => { lan3.push(1); return falso(); }, env: { NODE_ENV: 'production' } });
  D3.revisar(); ultimoProc.emit('close', 1); t3 = utc('2026-10-14', '15:00');
  ok(D3.revisar().lanzo === false && lan3.length === 1, 'un error (no "sin dato de hoy") no se reintenta solo: lo mira una persona');
  // servidor reiniciado tarde: sale al arrancar; pasadas las 18:00 no
  ponerEstado({ ultimo_ok_dia: '2026-10-13' });
  const lan4 = []; const D4 = crearDisparador({ rutaEstado: estD, reloj: () => utc('2026-10-14', '14:10'), lanzar: () => { lan4.push(1); return falso(); }, env: { NODE_ENV: 'production' } });
  ok(D4.revisar().lanzo === true, 'servidor que arranca a las 11:10 sin corrida buena: lanza');
  const D5 = crearDisparador({ rutaEstado: estD, reloj: () => utc('2026-10-14', '22:00'), lanzar: falso, env: { NODE_ENV: 'production' } });
  ok(D5.revisar().lanzo === false, 'a las 19:00 ya no lanza');
  // al día siguiente vuelve a andar
  ahora = utc('2026-10-15', '13:30'); ponerEstado({ ultimo_ok_dia: '2026-10-14' }); ok(D1.revisar().lanzo === true, 'al día siguiente vuelve a lanzar a las 10:30');
  // se apaga con la variable
  ok(actualizacionActiva({ NODE_ENV: 'production', ACTUALIZACION_AUTOMATICA: '0' }) === false, 'ACTUALIZACION_AUTOMATICA=0 la apaga, aun en producción');
  ok(actualizacionActiva({}) === false && actualizacionActiva({ NODE_ENV: 'production' }) === true && actualizacionActiva({ ACTUALIZACION_AUTOMATICA: '1' }) === true, 'sin variable: solo en producción');
  const Dap = crearDisparador({ rutaEstado: estD, lanzar: falso, env: { NODE_ENV: 'production', ACTUALIZACION_AUTOMATICA: '0' } });
  ok(Dap.iniciar() === false, 'apagada: el temporizador no arranca');
  // un proceso de verdad (no actualizar.js): no frena al servidor y deja registro cuando termina
  const { spawn } = require('child_process');
  const dirR = fs.mkdtempSync(path.join(tmp, 'real-')); const estR = path.join(dirR, 'estado.json'); fs.writeFileSync(estR, '{}');
  const logsR = []; const DR = crearDisparador({ rutaEstado: estR, reloj: () => utc('2026-10-14', '13:30'), lanzar: () => spawn(process.execPath, ['-e', 'console.log("listo")'], { stdio: ['ignore', 'pipe', 'pipe'] }), log: (m) => logsR.push(m), env: { NODE_ENV: 'production' } });
  const t0 = Date.now(); const rdr = DR.revisar();
  ok(rdr.lanzo === true && Date.now() - t0 < 500 && DR.corriendo() === true, 'lanza un proceso aparte y vuelve enseguida');
  for (let i = 0; i < 100 && DR.corriendo(); i++) await new Promise((x) => setTimeout(x, 50));
  ok(DR.corriendo() === false && logsR.some((l) => l.includes('termino')), 'al terminar queda registrado');
  ok(typeof A.s.disparador.revisar === 'function' && A.s.disparador.activo === false, 'el servidor trae el disparador, apagado fuera de producción');

  console.log('12b. rearmado al arrancar con código nuevo (--solo-armar), reloj y procesos simulados');
  const dirS = fs.mkdtempSync(path.join(tmp, 'rearm-')); const estS = path.join(dirS, 'actualizacion', 'estado.json'); fs.mkdirSync(path.dirname(estS), { recursive: true });
  const htmlS = path.join(dirS, 'armado.html'), proyS = path.join(dirS, '_proyectos.json');
  const ponerS = (o) => fs.writeFileSync(estS, JSON.stringify(o));
  const crearS = (extra = {}) => { const c = { completas: 0, solo: 0 }; const D = crearDisparador({ rutaEstado: estS, rutaHtml: htmlS, rutaProyectos: proyS, codigo: () => 'v2', reloj: () => utc('2026-10-14', '11:00'),
    lanzar: () => { c.completas++; return falso(); }, lanzarSoloArmar: () => { c.solo++; return falso(); }, env: { NODE_ENV: 'production' }, cadaMs: 3600000, ...extra }); return { c, D }; };
  fs.writeFileSync(htmlS, 'x'); fs.writeFileSync(proyS, '{}');
  ponerS({ ultimo_ok_dia: '2026-10-14', codigo_version: 'v1', datos_hasta: '2026-10-13' });
  let X = crearS(); ok(X.D.rearmarSiCambioElCodigo().lanzo === true && X.c.solo === 1 && X.c.completas === 0 && X.D.corriendo() === true, 'código distinto, con HTML y datos guardados: lanza el rearmado (y no la corrida completa)');
  ok(X.D.rearmarSiCambioElCodigo().lanzo === false && X.c.solo === 1, 'una sola vez por arranque');
  ultimoProc.emit('close', 0); ok(X.D.corriendo() === false, 'al terminar queda libre');
  ponerS({ ultimo_ok_dia: '2026-10-14', codigo_version: 'v2' }); X = crearS(); ok(X.D.rearmarSiCambioElCodigo().motivo === 'codigo_al_dia' && X.c.solo === 0, 'mismo código que el último armado: no hace nada');
  ponerS({ ultimo_ok_dia: '2026-10-14' }); X = crearS(); ok(X.D.rearmarSiCambioElCodigo().lanzo === true, 'estado.json sin codigo_version (anterior a esta función): rearma'); ultimoProc.emit('close', 0);
  ponerS({ codigo_version: 'v1', ultimo_solo_armar: { resultado: 'fallo', codigo_version: 'v2' } }); X = crearS(); ok(X.D.rearmarSiCambioElCodigo().motivo === 'ya_fallo_con_este_codigo' && X.c.solo === 0, 'si este mismo código ya falló al rearmar, no se repite en cada reinicio');
  ponerS({ codigo_version: 'v1', ultimo_solo_armar: { resultado: 'fallo', codigo_version: 'v0' } }); X = crearS(); ok(X.D.rearmarSiCambioElCodigo().lanzo === true, 'un fallo de un código anterior no impide probar con el nuevo'); ultimoProc.emit('close', 1);
  ponerS({ codigo_version: 'v1' }); fs.rmSync(proyS); X = crearS(); ok(X.D.rearmarSiCambioElCodigo().motivo === 'sin_datos_guardados' && X.c.solo === 0, 'sin datos guardados: no rearma (sigue la lógica de hoy)');
  fs.writeFileSync(proyS, '{}'); fs.rmSync(htmlS); X = crearS(); ok(X.D.rearmarSiCambioElCodigo().motivo === 'sin_datos_guardados', 'sin HTML armado: tampoco');
  fs.writeFileSync(htmlS, 'x');
  // iniciar(): antes de las 10:30 y con código nuevo → rearmado; pasadas las 10:30 sin corrida buena → la completa (que ya rearma todo)
  ponerS({ ultimo_ok_dia: '2026-10-13', codigo_version: 'v1' }); X = crearS({ reloj: () => utc('2026-10-14', '11:00') }); X.D.iniciar(); X.D.detener();
  ok(X.c.solo === 1 && X.c.completas === 0, 'al arrancar a las 08:00 con código nuevo: rearmado, no corrida completa'); ultimoProc.emit('close', 0);
  X = crearS({ reloj: () => utc('2026-10-14', '14:00') }); X.D.iniciar(); X.D.detener();
  ok(X.c.completas === 1 && X.c.solo === 0, 'al arrancar a las 11:00 sin corrida buena de hoy: sale la completa y no se suma el rearmado'); ultimoProc.emit('close', 0);
  ponerS({ ultimo_ok_dia: '2026-10-14', codigo_version: 'v1' }); X = crearS({ reloj: () => utc('2026-10-14', '14:00') }); X.D.iniciar(); X.D.detener();
  ok(X.c.completas === 0 && X.c.solo === 1, 'al arrancar con corrida buena de hoy y código nuevo: solo el rearmado'); ultimoProc.emit('close', 0);
  X = crearS({ env: { NODE_ENV: 'production', ACTUALIZACION_AUTOMATICA: '0' } }); ok(X.D.iniciar() === false && X.c.solo === 0, 'con ACTUALIZACION_AUTOMATICA=0 tampoco rearma');
  // mientras rearma, la corrida de las 10:30 espera (no se pisan)
  ponerS({ ultimo_ok_dia: '2026-10-13', codigo_version: 'v1' }); let tt = utc('2026-10-14', '11:00'); X = crearS({ reloj: () => tt }); X.D.rearmarSiCambioElCodigo(); tt = utc('2026-10-14', '13:30');
  ok(X.D.revisar().motivo === 'ya_corre' && X.c.completas === 0, 'si el rearmado sigue corriendo a las 10:30, la completa espera'); ultimoProc.emit('close', 0);
  ok(X.D.revisar().lanzo === true && X.c.completas === 1, 'y sale apenas termina'); ultimoProc.emit('close', 0);
  // resumen para /salud: sin errores ni rutas
  ponerS({ datos_hasta: '2026-10-13', ultima_corrida: { resultado: 'fallo', sin_dato_de_hoy: false, termino: '2026-10-14T13:40:00Z', error: 'SECRETO C:\\ruta\\interna', gb_bigquery: 6 } });
  X = crearS(); let rs = X.D.resumen(); ok(rs.corriendo === false && rs.ultima.resultado === 'fallo' && rs.ultima.datos_hasta === '2026-10-13' && !JSON.stringify(rs).includes('SECRETO'), 'resumen: última corrida sin el texto del error');
  ponerS({ datos_hasta: '2026-10-13', ultima_corrida: { resultado: 'fallo', sin_dato_de_hoy: true, termino: '2026-10-14T13:40:00Z' } }); ok(X.D.resumen().ultima.resultado === 'sin_dato_de_hoy', 'resumen: "sin dato de hoy" se distingue de un error');
  fs.rmSync(estS); ok(X.D.resumen().ultima.resultado === null && X.D.resumen().corriendo === false, 'resumen sin estado.json: vacío, sin romper');
  ponerS({ codigo_version: 'v1' }); X.D.rearmarSiCambioElCodigo(); rs = X.D.resumen(); ok(rs.corriendo === true && rs.tipo === 'solo-armar' && rs.desde === '2026-10-14T11:00:00.000Z', 'resumen mientras corre: tipo y hora de inicio'); ultimoProc.emit('close', 0);

  console.log('12c. primer arranque: pantalla "Se están armando los datos" y /salud con la actualización');
  const htmlNo = path.join(tmp, 'todavia-no-hay', 'armado.html');
  const dirP = fs.mkdtempSync(path.join(tmp, 'primer-')); const estP = path.join(dirP, 'estado.json');
  const dispP = crearDisparador({ rutaEstado: estP, reloj: () => utc('2026-10-14', '14:05'), lanzar: falso, env: { NODE_ENV: 'production' } });
  const P0 = await levantar({ env: { HTML_ARMADO: htmlNo }, disparador: dispP }); const ca = cookieDe('admin@empresa.test');
  r = await P0.pedir('/', { cookie: ca }); ok(r.status === 503 && /Sin datos todavía/.test(r.texto) && !/Se están armando/.test(r.texto), 'sin HTML y sin corrida en curso: "Sin datos todavía"');
  r = await P0.pedir('/salud'); let sl = JSON.parse(r.texto); ok(r.status === 200 && sl.ok === true && sl.actualizacion.corriendo === false && 'ultima' in sl.actualizacion, '/salud trae actualizacion { corriendo, ultima }');
  fs.writeFileSync(estP, JSON.stringify({ datos_hasta: '2026-10-13', ultima_corrida: { resultado: 'ok', termino: '2026-10-13T13:50:00Z', error: null, gb_bigquery: 6.4 } }));
  r = await P0.pedir('/salud'); sl = JSON.parse(r.texto); ok(sl.actualizacion.ultima.resultado === 'ok' && sl.actualizacion.ultima.termino === '2026-10-13T13:50:00Z' && sl.actualizacion.ultima.datos_hasta === '2026-10-13' && Object.keys(sl.actualizacion.ultima).length === 3, '/salud: última corrida con resultado, cuándo terminó y datos hasta (nada más)');
  dispP.revisar();   // 11:05 de Argentina, sin corrida buena de hoy: lanza la completa (simulada)
  r = await P0.pedir('/', { cookie: ca });
  ok(r.status === 503 && /Se están armando los datos\. Volvé en unos minutos\./.test(r.texto) && /11:05/.test(r.texto) && !/Sin datos todavía/.test(r.texto), 'con una corrida en curso: "Se están armando los datos. Volvé en unos minutos." con la hora de inicio (11:05)');
  r = await P0.pedir('/api/yo', { cookie: ca }); ok(r.status === 503 && /armando/.test(r.texto), 'la API también avisa que se están armando');
  r = await P0.pedir('/salud'); sl = JSON.parse(r.texto); ok(sl.actualizacion.corriendo === true && !JSON.stringify(sl).includes('gb_bigquery'), '/salud: corriendo true, sin datos de consumo');
  ultimoProc.emit('close', 0); r = await P0.pedir('/', { cookie: ca }); ok(/Sin datos todavía/.test(r.texto), 'al terminar la corrida sin dejar HTML, vuelve el aviso de siempre');
  await P0.cerrar();

  console.log('13. nombres viejos de campaña → oficial (tipos, comentarios y decisiones guardados)');
  const AC = require('../alias-campanas');
  const tabla = AC.construirAlias();
  ok(AC.oficialDe(tabla, 'Gobierno de Santa Fe', 'Inauguración') === 'Inauguración Cárcel de Recreo', 'tabla real: "Inauguración" en Santa Fe pasa a su nombre oficial');
  ok(AC.oficialDe(tabla, 'Gobierno de Santa Fe', 'Algo que no está') === 'Algo que no está', 'un nombre sin par queda como está');
  // la función de la página (app/logica.js) se prueba tal cual está escrita ahí
  const src = fs.readFileSync(path.join(__dirname, '..', 'logica.js'), 'utf8');
  const bloque = src.slice(src.indexOf('// <alias-campanas>'), src.indexOf('// </alias-campanas>'));
  const DATAp = { proyectos: [{ id: 'santa-fe', cliente: 'Gobierno de Santa Fe' }, { id: 'chaco', cliente: 'Gobierno del Chaco' }], aliasCampanas: { 'Gobierno de Santa Fe': { inauguracion: 'Inauguración Cárcel de Recreo' } } };
  const { tipoGuardado } = new Function('DATA', bloque + '\nreturn { tipoGuardado, oficialCamp };')(DATAp);
  const guardados = { 'santa-fe|Oficial|Inauguración': 'constante', 'santa-fe|Informativo|derribo de bunkers del narcotráfico': 'constante', 'chaco|Oficial|Obras': 'larga' };
  ok(tipoGuardado(guardados, 'santa-fe|Oficial|Inauguración') === 'constante', 'lo guardado con la clave exacta se sigue encontrando');
  ok(tipoGuardado(guardados, 'santa-fe|Oficial|Inauguración Cárcel de Recreo') === 'constante', 'lo guardado con el nombre viejo se encuentra por el nombre oficial');
  ok(tipoGuardado(guardados, 'santa-fe|Informativo|Derribo de bunkers del narcotráfico') === 'constante', 'lo guardado se encuentra por el nombre normalizado (mayúsculas y tildes)');
  ok(tipoGuardado(guardados, 'chaco|Oficial|Inauguración Cárcel de Recreo') === undefined, 'no se mezcla con otro proyecto');
  ok(tipoGuardado(guardados, 'santa-fe|Informativo|Inauguración Cárcel de Recreo') === undefined, 'no se mezcla con otro canal');
  ok(tipoGuardado({ 'santa-fe|Oficial|Inauguración': 'puntual', 'santa-fe|Oficial|Inauguración Cárcel de Recreo': 'estacional' }, 'santa-fe|Oficial|Inauguración Cárcel de Recreo') === 'estacional', 'si está guardado con el nombre oficial, gana ese');
  // en el servidor: el recorte deja la tabla solo de los clientes de la persona, y /api/respuestas trae campana_oficial
  const ALIAS = { 'Gobierno de Alfa': { vieja: 'Campaña Alfa Nueva' }, 'Gobierno de Beta': { otra: 'Campaña Beta Nueva' } };
  const dAlias = { ...DATA, aliasCampanas: ALIAS };
  const { recortar, alcanceDe } = require('../../servidor/vista');
  const recA = recortar(dAlias, alcanceDe(dAlias, { ok: true, global: false, proyectos: [{ proyecto: 'Alfa', canales: [] }] }));
  ok(Object.keys(recA.aliasCampanas).join() === 'Gobierno de Alfa', 'el recorte deja la tabla de nombres solo del cliente de la persona (no se filtran campañas ajenas)');
  const AL = await levantar({ aliasCampanas: ALIAS });
  await AL.pedir('/api/respuesta', { cookie: sa, metodo: 'POST', cuerpo: { clase: 'tipo_campana', campana: 'vieja', canal: 'Oficial', proyecto: 'Alfa', tipo: 'constante' } });
  r = await AL.pedir('/api/respuestas', { cookie: sa }); const reg = JSON.parse(r.texto).find((x) => x.clase === 'tipo_campana');
  ok(reg && reg.campana === 'vieja' && reg.campana_oficial === 'Campaña Alfa Nueva', '/api/respuestas agrega campana_oficial sin tocar lo guardado');
  await AL.cerrar();

  console.log('9. HTML armado de verdad (si existe)');
  const real = path.join(__dirname, '..', 'Seguimiento y Optimizacion.html');
  if (fs.existsSync(real)) {
    const R = await levantar({ env: { HTML_ARMADO: real }, accesos: crearAccesosDe({ cliente: null, lista: accesosDeLista([persona('admin@empresa.test', { rol: 'administrador', administradorGlobal: true }), persona('uno@empresa.test', { accesos: [{ proyecto: 'Gobierno del Chaco', activo: null, rol: null, canales: ['Informativo'] }, { proyecto: 'Chubut', activo: null, rol: null, canales: [] }] })]) }) });
    const original = fs.readFileSync(real, 'utf8');
    const t0 = Date.now(); r = await R.pedir('/', { cookie: cookieDe('admin@empresa.test') });
    ok(r.status === 200 && r.texto === original.replace('</head>', () => AVISO_SCRIPT + ICONOS_HEAD + '</head>'), `administrador global: HTML idéntico al armado (más la franja de aviso) (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    r = await R.pedir('/', { cookie: cookieDe('uno@empresa.test') });
    ok(r.status === 200 && r.texto.length < original.length / 2, `persona con 2 proyectos: HTML mucho más chico (${(r.texto.length / 1e6).toFixed(1)} de ${(original.length / 1e6).toFixed(1)} MB)`);
    const dd = r.status === 200 ? datosDe(r.texto) : null;
    ok(dd && dd.proyectos.map((p) => p.id).sort().join() === 'chubut' || (dd && dd.proyectos.length >= 1), 'proyectos recibidos: ' + (dd ? dd.proyectos.map((p) => p.id + ':' + Object.keys(p.canales).join('/')).join(', ') : '-'));
    if (dd) {
      const prohibidos = datosOriginal(real).proyectos.filter((p) => !dd.proyectos.some((q) => q.id === p.id));
      const todoTexto = r.texto;
      ok(prohibidos.every((p) => !todoTexto.includes(`"cliente":"${p.cliente}"`)), 'no aparece el "cliente" de ningún proyecto ajeno');
      ok(Object.keys(dd.lookers).every((k) => dd.proyectos.some((p) => k.startsWith(p.id + '|'))), 'Looker solo de sus proyectos');
      const nombresAjenos = prohibidos.flatMap((p) => [p.nombre, p.cliente]);
      ok(Object.keys(dd.cuartiles.pl).every((k) => !k.split('|').some((x) => nombresAjenos.includes(x))), 'referencias solo de sus proyectos');
      ok(!dd.todos || !dd.todos.ef, 'sin la eficacia sumada de todos los proyectos');
    }
    await R.cerrar();
  } else console.log('  (no está el HTML armado: se saltea)');

  for (const x of [A, B, C, D, G, gp, P, T, sinFuente]) await x.cerrar();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nservidor: ${pruebas} comprobaciones · problemas ${problemas}`);
  process.exit(problemas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

function datosOriginal(ruta) { return cargarArmado(ruta).DATA; }
