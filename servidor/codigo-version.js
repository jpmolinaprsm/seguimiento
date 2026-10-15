// Versión del código con el que se arma la app. La usan actualizar.js (la anota en estado.json como `codigo_version`) y el servidor
// (al arrancar compara: si el código cambió desde el último armado, pide un rearmado con los datos ya guardados, sin BigQuery).
// Orden: 1) RAILWAY_GIT_COMMIT_SHA  2) hash de git (solo si esta carpeta es la raíz de un repositorio)  3) hash de los archivos de app/ y borrador/.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
// Del hash de archivos quedan afuera los datos y lo que se genera: _*.json, el HTML armado, repositorio/, publicar/, pruebas/ y node_modules/.
const SALTEAR_CARPETAS = new Set(['repositorio', 'publicar', 'pruebas', 'node_modules', '.git']);
const CUENTA = /\.(js|json|html|md)$/i;

function archivosDe(dir, salida = []) {
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return salida; }
  for (const e of ents.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SALTEAR_CARPETAS.has(e.name)) archivosDe(p, salida); }
    else if (CUENTA.test(e.name) && !e.name.startsWith('_') && !/^Seguimiento y Optimizaci/.test(e.name) && !/^borrador-interfaz/.test(e.name)) salida.push(p);
  }
  return salida;
}

function hashDeArchivos(raiz = RAIZ) {
  const h = crypto.createHash('sha1');
  for (const sub of ['app', 'borrador']) {
    for (const f of archivosDe(path.join(raiz, sub))) {
      h.update(path.relative(raiz, f).split(path.sep).join('/')); h.update('\0');
      try { h.update(fs.readFileSync(f)); } catch (e) { /* desapareció mientras se leía */ }
      h.update('\0');
    }
  }
  return 'archivos:' + h.digest('hex').slice(0, 16);
}

function codigoVersion({ env = process.env, raiz = RAIZ } = {}) {
  const sha = String(env.RAILWAY_GIT_COMMIT_SHA || '').trim();
  if (sha) return 'railway:' + sha.slice(0, 12);
  try {
    if (fs.existsSync(path.join(raiz, '.git'))) {
      const g = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim();
      if (/^[0-9a-f]{7,40}$/.test(g)) return 'git:' + g.slice(0, 12);
    }
  } catch (e) { /* sin git: se usa el hash de archivos */ }
  return hashDeArchivos(raiz);
}

module.exports = { codigoVersion, hashDeArchivos };
