// Inicio de sesión con Google (OAuth 2.0, código de autorización). Mismo criterio que PAUTADOR: Google filtra la lista con hd, pero eso
// no es seguridad; acá se verifica la firma del id_token, la audiencia, el mail verificado y que el dominio sea el de la empresa.
const { google } = require('googleapis');

function validarIdentidad(payload, dominio) {
  const email = String((payload && payload.email) || '').trim().toLowerCase();
  if (!email || !payload.email_verified) throw new Error('Tu mail de Google no está verificado.');
  if (!email.endsWith('@' + dominio) || (payload.hd && String(payload.hd).toLowerCase() !== dominio)) throw new Error('Solo pueden entrar cuentas de ' + dominio + '.');
  return { email, nombre: String(payload.name || '') };
}

function crearGoogle(cfg) {
  const cliente = () => new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
  return {
    habilitado: !!(cfg.clientId && cfg.clientSecret && cfg.redirectUri && cfg.dominio),
    urlDeEntrada: (estado) => cliente().generateAuthUrl({ scope: ['openid', 'email', 'profile'], hd: cfg.dominio, prompt: 'select_account', state: estado }),
    // → { email, nombre }, o lanza un error con un texto que se le puede mostrar a la persona
    async identificar(codigo) {
      const c = cliente();
      const { tokens } = await c.getToken(String(codigo));
      const ticket = await c.verifyIdToken({ idToken: tokens.id_token, audience: cfg.clientId });
      return validarIdentidad(ticket.getPayload(), cfg.dominio);
    },
  };
}

module.exports = { crearGoogle, validarIdentidad };
