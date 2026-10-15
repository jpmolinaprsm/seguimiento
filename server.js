// Optimización · servidor de producción (Railway). Arranca con:  npm start   (node server.js)
// Toda ruta pide sesión, salvo /salud, /entrar (pantalla "Entrar con Google") y el ida y vuelta de Google (/auth/google…).
// Quién ve qué: ver servidor/vista.js (el servidor arma un HTML solo con los proyectos y canales de cada persona).
// Configuración: solo variables de entorno (servidor/config.js). Esto no reemplaza a app/servir.js, que sigue siendo el servidor local.
const http = require('http');
const zlib = require('zlib');
const { leerConfig, faltantes } = require('./servidor/config');
const { crearSesiones } = require('./servidor/sesion');
const { crearGoogle } = require('./servidor/google');
const { crearAccesosDe, permisosDe } = require('./servidor/accesos');
const { crearVistas, esProyecto } = require('./servidor/vista');
const { crearNexo } = require('./nexo/cliente');
const { crearAlmacen } = require('./base/almacen');
const { construirAlias, oficialDe } = require('./app/alias-campanas');
const { crearDisparador, crearAviso } = require('./servidor/actualizacion');

const MAX_RESPUESTA = 20 * 1024, MAX_NEXO = 50 * 1024;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const PAGINA = (titulo, cuerpo) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Optimización</title>`
  + `<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#faf9f5;color:#2b2b2b;font:16px/1.5 Poppins,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}`
  + `main{max-width:420px;padding:32px;text-align:center}h1{font-size:22px;margin:0 0 12px}p{margin:8px 0;color:#555}a.b,button{display:inline-block;margin-top:16px;padding:10px 20px;border-radius:8px;border:1px solid #2b2b2b;background:#2b2b2b;color:#fff;font:inherit;text-decoration:none;cursor:pointer}`
  + `.err{color:#a1260d}</style></head><body><main><h1>${esc(titulo)}</h1>${cuerpo}</main></body></html>`;

function crearServidor(opciones = {}) {
  const cfg = opciones.cfg || leerConfig();
  const falta = faltantes(cfg);
  if (falta.length) throw new Error('Faltan variables de entorno: ' + falta.join(', '));
  const log = opciones.log || ((m) => console.log('[optimización] ' + m));
  const sesiones = crearSesiones({ secreto: cfg.sesionSecreto, seguro: cfg.seguro });
  const google = opciones.google || crearGoogle(cfg);
  const accesosDe = opciones.accesosDe || crearAccesosDe({ registrar: log });
  const vistas = opciones.vistas || crearVistas({ ruta: cfg.htmlArmado });
  // Lo del equipo: base de Seguimiento (Supabase) si están SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY; si no, archivos en la carpeta de datos (local).
  const almacen = opciones.almacen || crearAlmacen({ carpeta: cfg.datosDir });
  const nexo = opciones.nexo || crearNexo({ accesos: accesosDe, repositorio: almacen.nexo });   // el registro de pedidos va al mismo almacen: base en Railway, archivo en local
  const aliasCamp = opciones.aliasCampanas || construirAlias();   // nombres viejos de campaña → oficial (borrador/nombres-oficiales.js)
  const avisoDeHoy = opciones.aviso || crearAviso({ rutaEstado: cfg.estadoActualizacion });
  const disparador = opciones.disparador || crearDisparador({ rutaEstado: cfg.estadoActualizacion, log });
  if (cfg.usuarioPrueba) log('ATENCIÓN: modo prueba con usuario falso (solo vale fuera de producción)');

  const cabeceras = (extra = {}) => ({
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "frame-ancestors 'none'", ...(cfg.seguro ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}), ...extra,
  });
  const enviar = (res, codigo, tipo, cuerpo, extra) => { res.writeHead(codigo, cabeceras({ 'Content-Type': tipo, ...extra })); res.end(cuerpo); };
  const json = (res, codigo, obj) => enviar(res, codigo, 'application/json; charset=utf-8', JSON.stringify(obj));
  const pagina = (res, codigo, titulo, cuerpo, extra) => enviar(res, codigo, 'text/html; charset=utf-8', PAGINA(titulo, cuerpo), extra);
  const redirigir = (res, donde) => { res.writeHead(302, cabeceras({ Location: donde })); res.end(); };
  const pantallaEntrar = (res, codigo, error) => pagina(res, codigo, 'Optimización',
    `<p>Entrá con tu cuenta de Google de la empresa.</p>${error ? `<p class="err">${esc(error)}</p>` : ''}<a class="b" href="/auth/google">Entrar con Google</a>`);

  const cuerpoDe = (req, res, max) => new Promise((ok) => {
    let c = '', pasado = false;
    req.on('data', (d) => { if (pasado) return; c += d; if (c.length > max) { pasado = true; json(res, 413, { error: 'Pedido demasiado grande' }); req.destroy(); ok(null); } });
    req.on('end', () => { if (!pasado) ok(c); });
    req.on('error', () => ok(null));
  });
  const jsonDe = async (req, res, max) => {
    const c = await cuerpoDe(req, res, max);
    if (c === null) return null;
    try { const o = JSON.parse(c); if (o && typeof o === 'object' && !Array.isArray(o)) return o; } catch (e) { /* abajo */ }
    json(res, 400, { error: 'Se espera un objeto JSON' }); return null;
  };
  // POST solo desde esta misma página (además de SameSite=Lax)
  const origenValido = (req) => { const o = req.headers.origin; if (!o) return true; return cfg.urlBase ? o === cfg.urlBase : true; };

  const puedeVer = (alcance, proyecto, canal) => {
    const p = vistas.datos().proyectos.find((x) => esProyecto(x, proyecto));
    const a = p && alcance.proyectos.find((x) => x.id === p.id);
    if (!a) return false;
    return !canal || a.canales.some((c) => c.toLowerCase() === String(canal).trim().toLowerCase());
  };

  async function manejar(req, res) {
    const url = new URL(req.url, 'http://local');
    const ruta = url.pathname;
    const api = ruta.startsWith('/api/');

    // ---- públicas ----
    if (req.method === 'GET' && ruta === '/salud') return json(res, 200, { ok: true, accesos: accesosDe.salud && accesosDe.salud().degradado ? 'degradado' : 'ok' });   // sin datos sensibles
    if (req.method === 'GET' && ruta === '/entrar') return pantallaEntrar(res, 200, url.searchParams.get('error') ? 'No se pudo entrar. Probá de nuevo con tu cuenta de la empresa.' : '');
    if (req.method === 'GET' && ruta === '/auth/google') {
      if (!google.habilitado) return pagina(res, 503, 'Inicio de sesión no disponible', '<p>El inicio de sesión con Google no está configurado.</p>');
      return redirigir(res, google.urlDeEntrada(sesiones.nuevoEstado(res)));
    }
    if (req.method === 'GET' && ruta === '/auth/google/callback') {
      try {
        if (!sesiones.validarEstado(req, res, url.searchParams.get('state'))) throw new Error('El inicio de sesión no arrancó desde este navegador o venció.');
        if (url.searchParams.get('error') || !url.searchParams.get('code')) throw new Error('Cancelaste el inicio de sesión.');
        const quien = await google.identificar(url.searchParams.get('code'));
        sesiones.abrir(res, quien);
        log('entró ' + quien.email.replace(/^(.).*(@.*)$/, '$1***$2'));
        return redirigir(res, '/');
      } catch (e) {
        log('entrada rechazada: ' + e.message);
        return pantallaEntrar(res, 403, e.message);
      }
    }
    if (cfg.usuarioPrueba && req.method === 'GET' && ruta === '/prueba/entrar') {   // no existe en producción (cfg.usuarioPrueba queda vacío)
      sesiones.abrir(res, { email: cfg.usuarioPrueba, nombre: 'Usuario de prueba' });
      return redirigir(res, '/');
    }

    // ---- desde acá, todo con sesión ----
    const ses = sesiones.leer(req);
    if (!ses) return api ? json(res, 401, { error: 'Hace falta iniciar sesión' }) : redirigir(res, '/entrar');
    if (req.method === 'POST' && ruta === '/salir') { sesiones.cerrar(res); return redirigir(res, '/entrar'); }
    if (req.method === 'POST' && !origenValido(req)) return json(res, 403, { error: 'Origen no permitido' });

    // qué puede ver, preguntado en cada pedido (con memoria de 5 minutos en la consulta a PAUTADOR)
    let permisos;
    try { permisos = permisosDe(await accesosDe(ses.email)); } catch (e) { log('no se pudo saber los accesos: ' + e.message); permisos = null; }
    if (permisos === null) return api ? json(res, 503, { error: 'No se pudieron verificar tus accesos. Probá en un rato.' }) : pagina(res, 503, 'No pudimos verificar tus accesos', '<p>Probá de nuevo en unos minutos.</p>');
    if (!permisos.ok) {
      sesiones.cerrar(res);
      return api ? json(res, 403, { error: 'Tu usuario no tiene acceso a Optimización' }) : pagina(res, 403, 'Sin acceso', `<p>${esc(ses.email)} no tiene proyectos asignados en el tablero. Pedile el acceso a Juan Pablo.</p>`);
    }
    let vista;
    try { vista = await vistas.paraPermisos(permisos); } catch (e) {
      log('no se pudo armar la vista: ' + e.message);
      return api ? json(res, 503, { error: 'Todavía no hay datos armados' }) : pagina(res, 503, 'Sin datos todavía', '<p>Optimización todavía no tiene datos armados. Probá en un rato.</p>');
    }
    if (!vista) return api ? json(res, 403, { error: 'No tenés proyectos asignados' }) : pagina(res, 403, 'Sin proyectos', '<p>Tu usuario no tiene proyectos del tablero asignados.</p>');
    const alcance = vista.alcance;

    if (req.method === 'GET' && (ruta === '/' || ruta.startsWith('/index'))) {
      if (req.headers['if-none-match'] === vista.etag) return enviar(res, 304, 'text/html; charset=utf-8', '', { ETag: vista.etag });
      const acepta = /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
      const extra = { ETag: vista.etag, Vary: 'Cookie, Accept-Encoding', ...(acepta ? { 'Content-Encoding': 'gzip' } : {}) };
      return enviar(res, 200, 'text/html; charset=utf-8', acepta ? vista.buf : zlib.gunzipSync(vista.buf), extra);
    }
    // vaciar la memoria de 5 minutos de accesos (cuando cambian permisos en PAUTADOR y no se quiere esperar): solo administrador global
    if (req.method === 'POST' && ruta === '/api/admin/accesos/vaciar') {
      if (!(permisos.global && permisos.rol === 'administrador')) return json(res, 403, { error: 'Solo un administrador' });
      if (accesosDe.vaciar) accesosDe.vaciar();
      log('memoria de accesos vaciada por un administrador');
      return json(res, 200, { ok: true });
    }
    if (req.method === 'GET' && ruta === '/api/aviso') return json(res, 200, { aviso: avisoDeHoy() });
    if (req.method === 'GET' && ruta === '/api/yo') return json(res, 200, { email: permisos.email, nombre: permisos.nombre, rol: permisos.rol, global: permisos.global, proyectos: alcance.proyectos });

    if (req.method === 'POST' && ruta === '/api/respuesta') {
      const b = await jsonDe(req, res, MAX_RESPUESTA); if (!b) return;
      if (b.proyecto != null && b.proyecto !== '' && !puedeVer(alcance, b.proyecto, b.canal)) return json(res, 403, { error: 'Ese proyecto no está entre los tuyos' });
      // el autor sale de la sesión, no de lo que mande la página
      const g = await almacen.guardarRespuesta(b, { autor: permisos.email, autorNombre: permisos.nombre });
      return g && g.ok === false ? json(res, 400, { error: g.error || 'No se pudo guardar' }) : json(res, 200, { ok: true });
    }
    if (req.method === 'GET' && ruta === '/api/respuestas') {
      // cada registro de campaña trae también campana_oficial (misma tabla de nombres-oficiales.js): se encuentra lo guardado con el nombre viejo
      return json(res, 200, (await almacen.leerRespuestas({})).filter((x) => x.proyecto == null || x.proyecto === '' || puedeVer(alcance, x.proyecto, x.canal))
        .map((x) => { if (typeof x.campana !== 'string' || !x.campana) return x; const p = vistas.datos().proyectos.find((q) => esProyecto(q, x.proyecto)); return p ? { ...x, campana_oficial: oficialDe(aliasCamp, p.cliente, x.campana) } : x; }));
    }
    if (req.method === 'POST' && ruta === '/api/nexo/solicitud') {
      const b = await jsonDe(req, res, MAX_NEXO); if (!b) return;
      if (!b.recomendacion) return json(res, 400, { error: 'Falta la recomendación' });
      if (!puedeVer(alcance, b.proyecto, b.canal)) return json(res, 403, { error: 'Ese proyecto no está entre los tuyos' });
      try { return json(res, 200, { modo: nexo.modo, ...(await nexo.aceptar(b.recomendacion, { pedidaPor: permisos.email, proyecto: b.proyecto, canal: b.canal, cambioPct: b.cambio_pct })) }); }
      catch (e) { return json(res, 400, { error: e.message }); }
    }
    if (req.method === 'GET' && (ruta === '/api/nexo/estado' || ruta === '/api/nexo/recomendacion')) {
      const id = url.searchParams.get('id');
      if (!id) return json(res, 400, { error: 'Falta id' });
      if (ruta === '/api/nexo/recomendacion') {
        return json(res, 200, { modo: nexo.modo, solicitudes: (await nexo.repositorio.porRecomendacion(id)).filter((x) => puedeVer(alcance, x.solicitud.proyecto, x.solicitud.canal)) });
      }
      const s = await nexo.repositorio.leerSolicitud(id);
      if (!s || !puedeVer(alcance, s.proyecto, s.canal)) return json(res, 404, { error: 'No existe esa solicitud' });
      try { return json(res, 200, await nexo.consultar(id)); } catch (e) { return json(res, 500, { error: 'No se pudo consultar' }); }
    }
    return api ? json(res, 404, { error: 'No existe' }) : pagina(res, 404, 'No existe', '<p><a href="/">Volver al inicio</a></p>');
  }

  const servidor = http.createServer((req, res) => {
    manejar(req, res).catch((e) => {
      log('error: ' + (e && e.message));
      if (!res.headersSent) json(res, 500, { error: 'Error del servidor' }); else res.end();
    });
  });
  servidor.cfg = cfg;
  servidor.disparador = disparador;
  return servidor;
}

if (require.main === module) {
  try {
    const s = crearServidor();
    s.listen(s.cfg.puerto, () => {
      console.log(`[optimización] escuchando en el puerto ${s.cfg.puerto}`);
      console.log(`[optimización] actualización automática: ${s.disparador.iniciar() ? 'prendida (10:30, 12:00 y 14:00 de Argentina)' : 'apagada'}`);
    });
  } catch (e) { console.error('[optimización] no arranca: ' + e.message); process.exit(1); }
}

module.exports = { crearServidor };
