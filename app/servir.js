// Sirve la app por http://localhost:4330 (sin dependencias). Hace falta para los iframes de Looker Studio,
// que rechazan cargarse desde un archivo abierto con doble clic (origen file://), y para el repositorio de respuestas:
//   POST /api/respuesta   → agrega una línea a repositorio/respuestas.jsonl (decisión, motivo, ¿sirve?, comentario, tipo de campaña)
//   GET  /api/respuestas  → devuelve todas las respuestas guardadas (JSON)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUERTO = Number(process.env.PORT) || 4330;
const ARCHIVO = path.join(__dirname, 'Seguimiento y Optimizacion.html');
const REPO = path.join(__dirname, 'repositorio');
const RESPUESTAS = path.join(REPO, 'respuestas.jsonl');
const MAX_CUERPO = 20 * 1024;

const json = (res, codigo, obj) => { res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };

http.createServer((req, res) => {
  const ruta = req.url.split('?')[0];
  if (req.method === 'POST' && ruta === '/api/respuesta') {
    let cuerpo = '', excedido = false;
    req.on('data', (d) => { cuerpo += d; if (cuerpo.length > MAX_CUERPO) { excedido = true; req.destroy(); } });
    req.on('end', () => {
      if (excedido) return;
      let reg; try { reg = JSON.parse(cuerpo); } catch (e) { return json(res, 400, { error: 'JSON inválido' }); }
      if (!reg || typeof reg !== 'object' || Array.isArray(reg)) return json(res, 400, { error: 'Se espera un objeto' });
      fs.mkdirSync(REPO, { recursive: true });
      fs.appendFile(RESPUESTAS, JSON.stringify({ recibido: new Date().toISOString(), ...reg }) + '\n', (err) => (err ? json(res, 500, { error: err.message }) : json(res, 200, { ok: true })));
    });
    return;
  }
  if (req.method === 'GET' && ruta === '/api/respuestas') {
    fs.readFile(RESPUESTAS, 'utf8', (err, txt) => json(res, 200, err ? [] : txt.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean)));
    return;
  }
  if (req.method !== 'GET' || (ruta !== '/' && !ruta.startsWith('/index'))) { res.writeHead(404); res.end(); return; }
  fs.readFile(ARCHIVO, (err, html) => {
    if (err) { res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Falta el HTML: corré node armar.js'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html);
  });
}).listen(PUERTO, () => console.log(`Optimización → http://localhost:${PUERTO}  (Ctrl+C para cortar)`));
