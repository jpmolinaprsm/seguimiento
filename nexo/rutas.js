// Nexo con PAUTADOR (lado Seguimiento) · rutas para app/servir.js (las conecta Interfaz; este archivo no se engancha solo).
//   POST /api/nexo/solicitud          cuerpo { recomendacion, pedida_por, proyecto, canal, cambio_pct? }
//                                     → { tipo: 'solicitud', solicitud, envio } | { tipo: 'manual', motivo } | { tipo: 'bloqueada', control, motivo }
//                                       | { tipo: 'sin_permiso', codigo, motivo } (no es implementador ni administrador del proyecto,
//                                         está inactivo o no se pudo saber su rol)
//   GET  /api/nexo/estado?id=…        → último estado de una solicitud (lo vuelve a preguntar a PAUTADOR)
//   GET  /api/nexo/recomendacion?id=… → solicitudes de una recomendación con su último estado (para la tarjeta)
// Uso en servir.js:  const nexo = require('../nexo/rutas').crearRutas();  …  if (nexo.manejar(req, res, ruta)) return;
// Ojo: hoy `pedida_por` viene en el cuerpo porque la app local no tiene login. Con login (Railway) tiene que salir de la sesión.
// La función de accesos se pasa en opciones.accesos (o en el nexo ya armado); sin ella, ninguna solicitud sale.
const { URL } = require('url');
const { crearNexo } = require('./cliente');

const MAX_CUERPO = 50 * 1024;
const json = (res, codigo, obj) => { res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };

function crearRutas(opciones = {}) {
  const nexo = opciones.nexo || crearNexo(opciones);
  function manejar(req, res, ruta) {
    if (req.method === 'POST' && ruta === '/api/nexo/solicitud') {
      let cuerpo = '', excedido = false;
      req.on('data', (d) => { cuerpo += d; if (cuerpo.length > MAX_CUERPO) { excedido = true; req.destroy(); } });
      req.on('end', async () => {
        if (excedido) return;
        let b; try { b = JSON.parse(cuerpo); } catch (e) { return json(res, 400, { error: 'JSON inválido' }); }
        if (!b || typeof b !== 'object' || !b.recomendacion) return json(res, 400, { error: 'Falta la recomendación' });
        try { json(res, 200, { modo: nexo.modo, ...(await nexo.aceptar(b.recomendacion, { pedidaPor: b.pedida_por, proyecto: b.proyecto, canal: b.canal, cambioPct: b.cambio_pct })) }); }
        catch (e) { json(res, 400, { error: e.message }); }
      });
      return true;
    }
    if (req.method === 'GET' && (ruta === '/api/nexo/estado' || ruta === '/api/nexo/recomendacion')) {
      const id = new URL(req.url, 'http://local').searchParams.get('id');
      if (!id) { json(res, 400, { error: 'Falta id' }); return true; }
      if (ruta === '/api/nexo/recomendacion') { Promise.resolve(nexo.repositorio.porRecomendacion(id)).then((sol) => json(res, 200, { modo: nexo.modo, solicitudes: sol }), (e) => json(res, 500, { error: e.message })); return true; }
      nexo.consultar(id).then((r) => json(res, r ? 200 : 404, r || { error: 'No existe esa solicitud' }), (e) => json(res, 500, { error: e.message }));
      return true;
    }
    return false;
  }
  return { nexo, manejar };
}

module.exports = { crearRutas };
