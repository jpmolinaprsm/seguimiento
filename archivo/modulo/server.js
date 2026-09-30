// Seguimiento y Optimización — módulo independiente (hoy corre aparte de PAUTADOR; mañana se conecta).
//   node server.js   →  http://localhost:4320
// Lee BigQuery de verdad (datajunta_meta_90d, alertas_diarias, perfil_*), aplica las reglas del motor y sirve la
// interfaz hecha en Claude Design (public/). Las decisiones se guardan en data/decisiones.json.
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

const bq = require('./src/bq'); // fija el cwd en PAUTADOR (lee su .env) y la clave de BigQuery
const consultas = require('./src/consultas');
const motor = require('./src/motor');

const express = createRequire(path.join(bq.PAUTADOR, 'package.json'))('express');
const RAIZ = __dirname;
const DATA = path.join(RAIZ, 'data');
const PUERTO = Number(process.env.PUERTO || 4320);
const CACHE_MS = 30 * 60 * 1000;

const leerJson = (nombre, porDefecto) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, nombre), 'utf8')); } catch (e) { return porDefecto; } };
const escribirJson = (nombre, obj) => fs.writeFileSync(path.join(DATA, nombre), JSON.stringify(obj, null, 1), 'utf8');
const hoyAR = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })).toISOString().slice(0, 10);
const fechaDdMm = (ts) => { const d = new Date(ts); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
const horaAR = () => new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

const proyectos = () => leerJson('proyectos.json', {});
const idDe = (nombre) => nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
const porId = (id) => Object.entries(proyectos()).find(([n]) => idDe(n) === id);

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(RAIZ, 'public')));

app.get('/api/proyectos', (req, res) => res.json(Object.keys(proyectos()).map((n) => ({ id: idDe(n), nombre: n }))));

// ---------- datos del proyecto (BigQuery, con caché de 30 min) ----------
const cache = new Map();
async function datosCrudos(nombre, cfg, forzar) {
  const hit = cache.get(nombre);
  if (hit && !forzar && Date.now() - hit.ts < CACHE_MS) return hit.datos;
  if (forzar) consultas.olvidarColumnas();
  const porCanal = {};
  for (const canal of ['Oficial', 'Informativo']) {
    const [conjuntos, serie, alertas, mes, benchmark] = await Promise.all([
      consultas.conjuntos(canal, cfg), consultas.serie(canal, cfg), consultas.alertas(canal, cfg), consultas.mes(canal, cfg), consultas.benchmark(canal),
    ]);
    porCanal[canal] = { conjuntos, serie, alertas, mes, benchmark };
  }
  const perfil = await consultas.perfil(cfg).catch((e) => { console.warn('perfil_*:', e.message); return { sesgo: [], audiencias: [] }; });
  const datos = { porCanal, perfil, consultado: horaAR() };
  cache.set(nombre, { ts: Date.now(), datos });
  return datos;
}

function historial(decisiones, proyectoId) {
  return Object.entries(decisiones)
    .filter(([, d]) => d.proyecto === proyectoId)
    .sort((a, b) => b[1].ts - a[1].ts)
    .map(([id, d]) => {
      const r = d.foto || {};
      const DEC = { aceptada: 'Aceptada e incorporada', noinc: 'Aceptada, no incorporada', resp: 'Respondida', decl: 'Declinada' };
      let aplic = '—', res = '—', lect = '', lectC = '';
      if (d.tipo === 'aceptada') {
        aplic = r.via === 'api' ? 'Aplicada vía API (simulado)' : r.via === 'pautador' ? 'Pedido enviado a PAUTADOR (simulado)' : d.hecho ? 'Hecha a mano' : 'Pendiente de hacer a mano';
        const mide = new Date(d.ts + 7 * 24 * 3600 * 1000);
        res = Date.now() < mide ? `Se mide el ${fechaDdMm(mide)}` : 'Medición pendiente de implementar';
      }
      const just = d.tipo === 'decl' ? `${d.motivo} — "${d.texto}"` : d.texto ? `"${d.texto}"` : '';
      return { id, fecha: d.fecha, quien: d.quien, proyecto: d.proyectoNombre, canal: r.canal || '', camp: r.campNombre || '', contenido: (r.contenido || '').replace(/"/g, ''), tipo: r.tipo || '', dec: DEC[d.tipo], just, aplic, res, lect, lectC };
    });
}

app.get('/api/datos', async (req, res) => {
  const id = String(req.query.proyecto || '');
  const encontrado = porId(id);
  if (!encontrado) return res.status(400).json({ error: `Proyecto desconocido: ${id}` });
  const [nombre, cfg] = encontrado;
  try {
    const crudos = await datosCrudos(nombre, cfg, req.query.forzar === '1');
    const decisiones = leerJson('decisiones.json', {});
    const salida = motor.armarProyecto({
      id, nombre, cfg, hoy: hoyAR(), porCanal: crudos.porCanal, perfil: crudos.perfil,
      poblacion: (consultas.leerJson('poblacion.json') || {}).poblacion, calendario: consultas.leerJson('calendario_electoral.json'),
      decisiones, cuentas: leerJson('cuentas.json', {}),
    });
    // marcas de cambios aplicados sobre la serie de cada campaña
    for (const c of salida.campanas) {
      c.serie.marcas = Object.values(decisiones).filter((d) => d.tipo === 'aceptada' && d.foto && d.foto.camp === c.id).map((d) => ({ fecha: new Date(d.ts).toISOString().slice(0, 10), texto: `${d.fecha} · ${d.foto.que}${d.foto.contenido ? ` — ${d.foto.contenido}` : ''}` }));
    }
    salida.decisiones = Object.fromEntries(Object.entries(decisiones).filter(([, d]) => d.proyecto === id).map(([k, d]) => [k, { tipo: d.tipo, texto: d.texto, motivo: d.motivo, hecho: !!d.hecho, fecha: d.fecha, quien: d.quien, ts: d.ts }]));
    salida.hist = historial(decisiones, id);
    salida.frescura.consultado = crudos.consultado;
    res.json(salida);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ---------- salud y presupuesto de cada activo (planilla "Presupuestos pedidos por proyecto" vs DataJunta) ----------
const activosPresu = require('../presupuestos/activos');
let cacheActivos = null;
async function activosCrudos(forzar) {
  if (cacheActivos && !forzar && Date.now() - cacheActivos.ts < CACHE_MS) return cacheActivos.datos;
  const datos = await activosPresu.calcular();
  cacheActivos = { ts: Date.now(), datos };
  return datos;
}

app.get('/api/activos', async (req, res) => {
  const encontrado = porId(String(req.query.proyecto || ''));
  if (!encontrado) return res.status(400).json({ error: 'Proyecto desconocido' });
  const cliente = encontrado[0];
  try {
    const { periodo: actual, periodos, unidades } = await activosCrudos(req.query.forzar === '1');
    const periodo = periodos.includes(String(req.query.periodo)) ? String(req.query.periodo) : actual;
    const us = unidades.filter((u) => u.clientes.includes(cliente) && (u.meses[periodo].pedido || u.meses[periodo].gastado))
      .map((u) => ({ id: u.id, nombre: u.nombre, plataforma: u.plataforma, canal: u.canal, cuentas: u.cuentas, activos: u.activos, union: u.union, agrupada: u.agrupada,
        mes: u.meses[periodo], resumenMeses: periodos.map((p) => ({ periodo: p, estado: u.meses[p].estado, pedido: u.meses[p].pedido, gastado: u.meses[p].gastado })) }))
      .sort((a, b) => b.mes.nivel - a.mes.nivel || b.mes.pedido - a.mes.pedido || b.mes.gastado - a.mes.gastado);
    const porCanal = ['Oficial', 'Informativo'].map((canal) => {
      const xs = us.filter((u) => u.canal === canal);
      const pedido = xs.reduce((t, u) => t + u.mes.pedido, 0), gastado = xs.reduce((t, u) => t + u.mes.gastado, 0);
      return { canal, pedido, gastado, restante: pedido - gastado, activos: xs.length };
    });
    const ref = us.find((u) => u.mes.diasMes) || {};
    res.json({ periodo, periodos, cliente, diaDatos: ref.mes ? ref.mes.diaDatos : null, diasMes: ref.mes ? ref.mes.diasMes : null, porCanal, activos: us });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ---------- decisiones ----------
app.post('/api/decisiones', (req, res) => {
  const { id, tipo, texto = '', motivo = '', quien = 'Juan', proyecto, foto } = req.body || {};
  if (!id || !['aceptada', 'noinc', 'resp', 'decl'].includes(tipo)) return res.status(400).json({ error: 'id y tipo (aceptada|noinc|resp|decl)' });
  if ((tipo === 'noinc' || tipo === 'decl') && !texto.trim()) return res.status(400).json({ error: 'La justificación es obligatoria.' });
  if (tipo === 'decl' && !motivo) return res.status(400).json({ error: 'Elegí un motivo.' });
  if (tipo === 'resp' && !texto.trim()) return res.status(400).json({ error: 'Escribí la respuesta.' });
  const decisiones = leerJson('decisiones.json', {});
  const nombre = (porId(proyecto) || [proyecto])[0];
  decisiones[id] = { tipo, texto: texto.trim(), motivo, quien, proyecto, proyectoNombre: nombre, fecha: fechaDdMm(Date.now()), ts: Date.now(), hecho: false, foto: foto || null };
  escribirJson('decisiones.json', decisiones);
  res.json({ ok: true, decision: decisiones[id] });
});
app.post('/api/decisiones/:id/hecho', (req, res) => {
  const decisiones = leerJson('decisiones.json', {});
  if (!decisiones[req.params.id]) return res.status(404).json({ error: 'No existe' });
  decisiones[req.params.id].hecho = true;
  escribirJson('decisiones.json', decisiones);
  res.json({ ok: true });
});
app.delete('/api/decisiones/:id', (req, res) => {
  const decisiones = leerJson('decisiones.json', {});
  delete decisiones[req.params.id];
  escribirJson('decisiones.json', decisiones);
  res.json({ ok: true });
});

app.listen(PUERTO, () => console.log(`Seguimiento y Optimización → http://localhost:${PUERTO}`));
