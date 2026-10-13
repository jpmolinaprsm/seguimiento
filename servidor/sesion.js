// Sesión en cookie firmada (HMAC-SHA256). La página no la puede leer (HttpOnly), solo viaja por https (Secure), no se manda desde
// otros sitios (SameSite=Lax). Lleva solo el mail, el nombre y el vencimiento: lo que la persona puede ver se vuelve a preguntar
// (con memoria corta) en cada pedido, así una baja en PAUTADOR se nota en pocos minutos.
const crypto = require('crypto');

const DURACION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_COOKIE = 2048;

function crearSesiones({ secreto, seguro, reloj = () => Date.now() }) {
  if (!secreto || secreto.length < 32) throw new Error('SESSION_SECRET falta o es muy corto (mínimo 32 caracteres)');
  const NOMBRE = seguro ? '__Host-syo_sesion' : 'syo_sesion';     // __Host-: solo https, sin Domain, Path=/
  const NOMBRE_ESTADO = seguro ? '__Host-syo_estado' : 'syo_estado';
  const firma = (d) => crypto.createHmac('sha256', secreto).update(d).digest('base64url');
  const igual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
  const attrs = (seg) => `Path=/; HttpOnly; SameSite=Lax; Max-Age=${seg}${seguro ? '; Secure' : ''}`;

  function crearValor(datos) {
    const cuerpo = Buffer.from(JSON.stringify({ ...datos, exp: reloj() + DURACION_MS })).toString('base64url');
    return `${cuerpo}.${firma(cuerpo)}`;
  }
  function leerValor(valor) {
    const v = String(valor || '');
    if (!v || v.length > MAX_COOKIE) return null;
    const [cuerpo, sello] = v.split('.');
    if (!cuerpo || !sello || !igual(firma(cuerpo), sello)) return null;
    try {
      const s = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
      if (!s || typeof s.email !== 'string' || !s.email || !(Number(s.exp) > reloj())) return null;
      return { email: s.email, nombre: String(s.nombre || ''), exp: s.exp };
    } catch (e) { return null; }
  }
  function leerCookie(req, nombre) {
    for (const parte of String(req.headers.cookie || '').split(';')) {
      const i = parte.indexOf('=');
      if (i > 0 && parte.slice(0, i).trim() === nombre) { try { return decodeURIComponent(parte.slice(i + 1).trim()); } catch (e) { return ''; } }
    }
    return '';
  }
  return {
    NOMBRE,
    abrir: (res, { email, nombre }) => res.setHeader('Set-Cookie', [...[].concat(res.getHeader('Set-Cookie') || []), `${NOMBRE}=${crearValor({ email, nombre })}; ${attrs(Math.floor(DURACION_MS / 1000))}`]),
    cerrar: (res) => res.setHeader('Set-Cookie', [...[].concat(res.getHeader('Set-Cookie') || []), `${NOMBRE}=; ${attrs(0)}`]),
    leer: (req) => leerValor(leerCookie(req, NOMBRE)),
    // "estado" del ida y vuelta con Google: valor al azar en una cookie corta; se compara al volver y se borra
    nuevoEstado: (res) => { const e = crypto.randomBytes(24).toString('base64url'); res.setHeader('Set-Cookie', [...[].concat(res.getHeader('Set-Cookie') || []), `${NOMBRE_ESTADO}=${e}; ${attrs(600)}`]); return e; },
    validarEstado: (req, res, recibido) => {
      const guardado = leerCookie(req, NOMBRE_ESTADO);
      res.setHeader('Set-Cookie', [...[].concat(res.getHeader('Set-Cookie') || []), `${NOMBRE_ESTADO}=; ${attrs(0)}`]);
      return !!guardado && igual(guardado, recibido || '');
    },
    crearValor, leerValor,
  };
}

module.exports = { crearSesiones, DURACION_MS };
