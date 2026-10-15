#!/usr/bin/env node
// Actualización diaria de Seguimiento y Optimización (Extracción, 13/10/2026; ítem 10 de LANZAMIENTO-20-10.md, PLAN-RAILWAY sección 2).
// Un solo comando: verifica que ayer esté completo en DataJunta, baja los datos, arma la app y, si todos los controles pasan,
// cambia de versión de forma atómica. Si algo falla, la versión anterior sigue sirviéndose. Cada corrida queda registrada.
//
//   node actualizar.js                 corrida normal (la del cron de Railway)
//   node actualizar.js --manual        igual, pero se registra como tipo "manual"
//   node actualizar.js --forzar        corre aunque hoy ya haya una corrida buena
//   node actualizar.js --solo-verificar   solo mira si ayer está completo en DataJunta (no baja ni arma nada)
//   node actualizar.js --solo-armar    rearma la app con los datos ya guardados (_proyectos.json del volumen), sin BigQuery: lo lanza el
//                                      servidor al arrancar cuando el código cambió (estado.json.codigo_version). Mismos controles y cambio
//                                      atómico; si falla queda la versión anterior. No es una corrida diaria: no toca ultimo_ok_dia ni ultima_corrida.
//
// Pasos (cada uno en su proceso, con el medidor infra/medir-bq.js que suma los GB de BigQuery y la memoria):
//   1. Verificar que ayer esté completo en DataJunta (los dos canales). Si no: "sin dato de hoy", se queda la versión anterior.
//   2. borrador/_extraer.js           → borrador/_proyectos.nuevo.json
//   3. presupuestos/activos.js        → presupuestos/_activos.json (se respalda y se restituye si la corrida falla)
//   4. salidas/rendimiento-piezas.js  → archivo de prueba
//   5. app/armar.js                   → HTML de prueba (SEGUIMIENTO_PROYECTOS y SEGUIMIENTO_SALIDA)
//   6. Controles: parches N/N, prueba de contrato en 0, todos los proyectos con campañas y sin caída brusca de filas.
//   7. Cambio de versión: cada archivo se copia al lado de su destino con otro nombre y se renombra encima (renombrar es atómico:
//      quien lee ve el archivo viejo entero o el nuevo entero, nunca uno a medio escribir). El HTML va al final.
//   8. presupuestos/resumen-activos.js (para el módulo Activos; si falla no cambia el resultado).
// Registro: infra/registro/actualizaciones.jsonl (siempre) y la base (tabla actualizaciones, migración 006) si está configurada;
// infra/registro/estado.json guarda cómo quedó (lo puede leer la app para el aviso "Sin dato de hoy").
// Variable: HTML_ARMADO = dónde deja el HTML (el que sirve server.js); en esa carpeta del volumen quedan también _proyectos.json,
// rendimiento-piezas.json y el registro (actualizacion/). Sin ella, los lugares de siempre. Las claves
// (BQ_CREDENTIALS_JSON, SHEETS_CREDENTIALS_JSON) se leen como en el resto. Corre ya armado con `node actualizar.js` desde Seguimiento/.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { codigoVersion } = require('./servidor/codigo-version');

const RAIZ = __dirname;
// HTML_ARMADO = ruta del HTML que sirve el servidor (la misma variable que lee servidor/config.js). Con ella (Railway), todo lo de la
// actualización vive en esa misma carpeta del volumen (ej. /data/armado): _proyectos.json, rendimiento-piezas.json y el registro
// (actualizacion/). No usa DATOS_DIR: esa carpeta es de las respuestas del equipo. Sin la variable, los lugares de siempre (local).
const DATOS = process.env.HTML_ARMADO ? path.dirname(path.resolve(process.env.HTML_ARMADO)) : null;
const RUTAS = {
  proyectos: DATOS ? path.join(DATOS, '_proyectos.json') : path.join(RAIZ, 'borrador', '_proyectos.json'),
  html: process.env.HTML_ARMADO ? path.resolve(process.env.HTML_ARMADO) : path.join(RAIZ, 'app', 'Seguimiento y Optimizacion.html'),
  rendimiento: DATOS ? path.join(DATOS, 'rendimiento-piezas.json') : path.join(RAIZ, 'salidas', 'rendimiento-piezas.json'),
  registro: DATOS ? path.join(DATOS, 'actualizacion') : path.join(RAIZ, 'infra', 'registro'),
  activos: path.join(RAIZ, 'presupuestos', '_activos.json'),
};
const NUEVO = path.join(RUTAS.registro, 'nuevo'); // lo que se arma antes de cambiar de versión
const NUEVO_PROYECTOS_NOMBRE = '_proyectos.nuevo.json'; // _extraer.js solo acepta un nombre dentro de borrador/
const NUEVO_PROYECTOS = path.join(RAIZ, 'borrador', NUEVO_PROYECTOS_NOMBRE);
const NUEVO_HTML = path.join(NUEVO, 'Seguimiento y Optimizacion.html');
const NUEVO_REND = path.join(NUEVO, 'rendimiento-piezas.json');
const ESTADO = path.join(RUTAS.registro, 'estado.json');
const LOG_JSONL = path.join(RUTAS.registro, 'actualizaciones.jsonl');
const CANDADO = path.join(RUTAS.registro, 'actualizar.candado');

// Criterios de los controles. Los dos números son de calidad de datos, no de negocio; se pueden ajustar acá.
const MIN_VS_MEDIANA = 0.3;       // ayer cuenta como completo si gastó al menos el 30 % de la mediana de los 7 días anteriores (el mismo criterio que borrador/armar.js usa para datosHasta)
const CAIDA_MAXIMA_FILAS = 0.3;   // un bloque de la extracción no puede perder más del 30 % de sus filas respecto de la última corrida buena
const FILAS_MINIMAS_PARA_COMPARAR = 100;
const TABLAS_DATAJUNTA = { Oficial: 'prsm-bq-media.prsm_media_tableros.DataJunta', Informativo: 'bq-project-450514.informativo.DataJunta' };
const MIN = 60000;

const ARGS = new Set(process.argv.slice(2));
const hoyAR = (ahora = Date.now()) => new Date(ahora - 3 * 3600000).toISOString().slice(0, 10);
const sumarDias = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const dmy = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const ahoraISO = () => new Date().toISOString();
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

// ---------- archivos ----------
const leerJson = (p, defecto = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return defecto; } };
// Escritura atómica: se escribe al lado con otro nombre y se renombra encima.
function escribirAtomico(destino, texto) {
  const tmp = `${destino}.tmp-${process.pid}`;
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(tmp, texto);
  fs.renameSync(tmp, destino);
}
// Pasa un archivo ya armado a su lugar definitivo sin que nadie lo vea a medias (copia al lado y renombra; sirve aunque estén en discos distintos).
function promover(origen, destino) {
  const tmp = `${destino}.tmp-${process.pid}`;
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.copyFileSync(origen, tmp);
  fs.renameSync(tmp, destino);
}
const borrar = (p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { /* ya no estaba */ } };

// ---------- candado: una sola corrida a la vez ----------
function tomarCandado() {
  fs.mkdirSync(RUTAS.registro, { recursive: true });
  const previo = leerJson(CANDADO);
  if (previo && Date.now() - previo.desde < 3 * 60 * MIN) {
    let viva = true;
    try { process.kill(previo.pid, 0); } catch (e) { viva = false; }
    if (viva) return false;
  }
  fs.writeFileSync(CANDADO, JSON.stringify({ pid: process.pid, desde: Date.now() }));
  return true;
}
const soltarCandado = () => { const c = leerJson(CANDADO); if (c && c.pid === process.pid) borrar(CANDADO); };

// ---------- correr un paso en su propio proceso, con medidor ----------
// Devuelve { codigo, salida, ms, gbBytes, consultas, maxRssMb, esperado }.
function correr(nombre, script, args = [], { env = {}, timeoutMs = 20 * MIN, cwd = RAIZ } = {}) {
  return new Promise((resolve) => {
    const medicion = path.join(RUTAS.registro, `medicion-${nombre}-${process.pid}.jsonl`);
    borrar(medicion);
    const t0 = Date.now();
    // Sin límite fijo de memoria del proceso: lo que use se mide y se informa. NODE_OPTIONS lo puede fijar Railway si hiciera falta.
    const hijo = spawn(process.execPath, ['-r', path.join(RAIZ, 'infra', 'medir-bq.js'), script, ...args], {
      cwd, env: { ...process.env, ...env, MEDIR_BQ_ARCHIVO: medicion }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let salida = '';
    const juntar = (d) => { salida += d; if (salida.length > 4e6) salida = salida.slice(-2e6); };
    hijo.stdout.on('data', juntar);
    hijo.stderr.on('data', juntar);
    const reloj = setTimeout(() => { salida += `\n[actualizar] pasó el tiempo máximo (${Math.round(timeoutMs / MIN)} min): se corta el paso\n`; hijo.kill(); }, timeoutMs);
    const terminar = (codigo) => {
      clearTimeout(reloj);
      let gbBytes = 0, consultas = 0, maxRssMb = 0;
      try {
        for (const l of fs.readFileSync(medicion, 'utf8').split('\n').filter(Boolean)) {
          const o = JSON.parse(l);
          if (o.t === 'consulta') { gbBytes += Number(o.bytes) || 0; consultas++; } else if (o.t === 'fin') maxRssMb = Math.max(maxRssMb, o.maxRssMb || 0);
        }
      } catch (e) { /* sin medición (el paso no llegó a cargar el medidor) */ }
      borrar(medicion);
      resolve({ nombre, codigo, salida, ms: Date.now() - t0, gbBytes, consultas, maxRssMb });
    };
    hijo.on('error', (e) => { salida += `\n[actualizar] no se pudo iniciar: ${e.message}\n`; terminar(-1); });
    hijo.on('close', (codigo) => terminar(codigo));
  });
}

// ---------- 1. ¿ayer está completo en DataJunta? ----------
// Por canal: ayer tiene filas y gastó al menos el 30 % de la mediana de los 7 días anteriores (criterio de borrador/armar.js).
// Devuelve { completo, ayer, canales, gbBytes, motivo }.
async function verificarAyer() {
  const bq = require('./datos/bq');
  const hoy = hoyAR(), ayer = sumarDias(hoy, -1);
  const canales = {};
  let gbBytes = 0;
  for (const [canal, tabla] of Object.entries(TABLAS_DATAJUNTA)) {
    const sql = `SELECT CAST(Fecha AS STRING) AS fecha, SUM(IFNULL(Gasto, 0)) AS gasto, COUNT(*) AS filas FROM \`${tabla}\`
      WHERE Fecha >= DATE '${sumarDias(ayer, -8)}' AND Fecha <= DATE '${ayer}' GROUP BY fecha ORDER BY fecha`;
    gbBytes += await bq.dryRun(sql);
    const filas = await bq.query(sql);
    const porDia = Object.fromEntries(filas.map((f) => [f.fecha, { gasto: Number(f.gasto) || 0, filas: Number(f.filas) || 0 }]));
    const previos = [];
    for (let i = 2; i <= 8; i++) previos.push((porDia[sumarDias(ayer, -i + 1)] || { gasto: 0 }).gasto);
    const orden = previos.slice().sort((a, b) => a - b);
    const mediana = orden[Math.floor(orden.length / 2)] || 0;
    const delAyer = porDia[ayer] || { gasto: 0, filas: 0 };
    canales[canal] = { filas: delAyer.filas, gasto: Math.round(delAyer.gasto), medianaSemana: Math.round(mediana), completo: delAyer.filas > 0 && delAyer.gasto >= mediana * MIN_VS_MEDIANA };
  }
  const incompletos = Object.entries(canales).filter(([, c]) => !c.completo).map(([k]) => k);
  return { completo: !incompletos.length, ayer, canales, gbBytes,
    motivo: incompletos.length ? `DataJunta todavía no tiene el ${dmy(ayer)} completo en ${incompletos.join(' y ')}` : null };
}

// ---------- lecturas de la salida de los pasos ----------
function filasDeLaExtraccion(salida) {
  // Última línea de _extraer.js: "cruce 56206 diaria 12345 semanal ... activosEquivalencia N"
  const linea = salida.split('\n').reverse().find((l) => /^cruce \d+ diaria \d+/.test(l.trim()));
  if (!linea) return null;
  const filas = {};
  for (const m of linea.matchAll(/([A-Za-z]+) (\d+)/g)) filas[m[1]] = Number(m[2]);
  return filas;
}
function proyectosDelArmado(salida) {
  // Una línea por proyecto y canal: "Santa Fe  Oficial  campañas 23 · períodos ..."
  const r = {};
  for (const m of salida.matchAll(/^(.+?)\s+(Oficial|Informativo)\s+campañas (\d+) · períodos/gm)) r[`${m[1].trim()}|${m[2]}`] = Number(m[3]);
  return r;
}

// ---------- registro ----------
let almacenCache;
async function almacen() {
  if (almacenCache !== undefined) return almacenCache;
  try { almacenCache = require('./base/almacen.js').crearAlmacen(); } catch (e) { console.error('Sin almacén para el registro (se usa solo el archivo):', e.message); almacenCache = null; }
  return almacenCache;
}
function anotarArchivo(reg) {
  try { fs.mkdirSync(RUTAS.registro, { recursive: true }); fs.appendFileSync(LOG_JSONL, JSON.stringify(reg) + '\n'); } catch (e) { console.error('No se pudo escribir el registro en archivo:', e.message); }
}

// Resumen de lo que dejaron los pasos, para el registro y el informe.
const gb = (bytes) => Math.round(bytes / 1e9 * 1000) / 1000;

// ---------- --solo-armar: rearmar con los datos ya guardados (sin BigQuery) ----------
// Se llama con el candado ya tomado. Devuelve el código de salida. Deja el rastro en el registro (tipo "solo-armar") y en
// estado.json.ultimo_solo_armar; si salió bien, también estado.json.codigo_version (con qué código quedó armado lo que se sirve).
async function soloArmar() {
  const t0 = Date.now();
  const estadoPrevio = leerJson(ESTADO, {});
  const codigo = codigoVersion();
  const reg = { tipo: 'solo-armar', empezo: ahoraISO(), pasos: [], maxRssMb: 0 };
  const pasos = reg.pasos;
  const sumar = (r) => { reg.maxRssMb = Math.max(reg.maxRssMb, r.maxRssMb || 0); pasos.push({ paso: r.nombre, ok: r.codigo === 0, ms: r.ms, memoria_mb: r.maxRssMb }); };
  let resultado = 'fallo', error = null, version = null, datosHasta = null, proys = null; const controles = { codigo };
  try {
    log(`Rearmado con los datos guardados (código ${codigo}); no se consulta BigQuery.`);
    if (!fs.existsSync(RUTAS.proyectos)) throw new Error('No hay datos guardados (falta ' + path.basename(RUTAS.proyectos) + '): hace falta una actualización completa.');
    fs.mkdirSync(NUEVO, { recursive: true });
    borrar(NUEVO_HTML);

    log('1. Armando la app...');
    let r = await correr('armar', 'armar.js', [], { env: { SEGUIMIENTO_PROYECTOS: RUTAS.proyectos, SEGUIMIENTO_SALIDA: NUEVO_HTML }, cwd: path.join(RAIZ, 'app') });
    sumar(r);
    if (r.codigo !== 0) throw Object.assign(new Error('El armado falló: ' + r.salida.trim().split('\n').slice(-3).join(' | ')), { salida: r.salida });
    const armado = r.salida;

    log('2. Controles antes de cambiar de versión...');
    const pm = armado.match(/parches aplicados (\d+)\/(\d+)/);
    controles.parches = pm ? `${pm[1]}/${pm[2]}` : null;
    if (!pm || pm[1] !== pm[2]) throw new Error(`Parches de markup: ${controles.parches || 'sin dato'} (tienen que ser N/N).`);
    const hm = armado.match(/datos al (\d{4}-\d{2}-\d{2})/);
    datosHasta = hm ? hm[1] : estadoPrevio.datos_hasta || null;
    controles.datosHasta = datosHasta;
    proys = proyectosDelArmado(armado);
    controles.proyectosConCampanias = Object.keys(proys).filter((k) => proys[k] > 0).length;
    const antes = estadoPrevio.proyectos || {};
    const perdidos = Object.keys(antes).filter((k) => antes[k] > 0 && !(proys[k] > 0));
    if (!controles.proyectosConCampanias) throw new Error('El armado no dejó ningún proyecto con campañas.');
    if (perdidos.length) throw new Error('Proyectos que tenían campañas y ahora no tienen datos: ' + perdidos.join(', '));
    r = await correr('contrato', path.join('app', 'pruebas', 'contrato.js'), [], { env: { SEGUIMIENTO_SALIDA: NUEVO_HTML } });
    sumar(r);
    const pc = r.salida.match(/problemas (\d+)/);
    controles.contrato = pc ? `problemas ${pc[1]}` : 'sin resultado';
    if (r.codigo !== 0 || !pc || pc[1] !== '0') throw Object.assign(new Error(`La prueba de contrato no dio "problemas 0" (${controles.contrato}).`), { salida: r.salida });

    log('3. Cambiando de versión...');
    version = `${datosHasta || 'sin-fecha'}@${ahoraISO().slice(0, 16)}`;
    promover(NUEVO_HTML, RUTAS.html);   // solo el HTML: los datos no cambiaron
    resultado = 'ok';
    log(`Versión nueva en servicio con los mismos datos (${version}).`);
    return 0;
  } catch (e) {
    error = String(e && e.message || e).slice(0, 1500);
    reg.salidaDelPasoQueFallo = e && e.salida ? String(e.salida).slice(-3000) : undefined;
    log('FALLÓ: ' + error + ' — se sigue sirviendo la versión anterior.');
    return 1;
  } finally {
    borrar(NUEVO);
    const duracion = Date.now() - t0, ok = resultado === 'ok';
    anotarArchivo({ id: `${Date.now()}-${process.pid}`, tipo: 'solo-armar', empezo: reg.empezo, termino: ahoraISO(), resultado: ok ? 'ok' : 'fallo', datos_hasta: ok ? datosHasta : null,
      version, duracion_ms: duracion, memoria_mb: reg.maxRssMb, error: ok ? null : error, codigo_version: codigo, detalle: { pasos, controles } });
    try {
      const actual = leerJson(ESTADO, estadoPrevio) || {};   // se vuelve a leer: es lo último escrito
      escribirAtomico(ESTADO, JSON.stringify({
        ...actual, actualizado: ahoraISO(),
        ...(ok ? { version, codigo_version: codigo, datos_hasta: actual.datos_hasta || datosHasta, proyectos: proys && Object.keys(proys).length ? proys : actual.proyectos || null } : {}),
        ultimo_solo_armar: { resultado: ok ? 'ok' : 'fallo', empezo: reg.empezo, termino: ahoraISO(), duracion_ms: duracion, codigo_version: codigo, error: ok ? null : error },
      }, null, 1));
    } catch (e) { console.error('No se pudo escribir estado.json:', e.message); }
    log(`Rearmado ${ok ? 'ok' : 'fallo'} · ${Math.round(duracion / 1000)} s · memoria máxima de un paso ${reg.maxRssMb} MB`);
    soltarCandado();
  }
}

async function main() {
  const tipo = ARGS.has('--manual') ? 'manual' : 'diaria';
  const t0 = Date.now();
  const estadoPrevio = leerJson(ESTADO, {});
  const hoy = hoyAR();

  if (!tomarCandado()) { log('Ya hay una corrida en curso: no se hace nada.'); return 0; }
  if (ARGS.has('--solo-armar')) return soloArmar();
  if (!ARGS.has('--forzar') && !ARGS.has('--solo-verificar') && estadoPrevio.ultimo_ok_dia === hoy) {
    log(`Hoy (${hoy}) ya hay una corrida buena; no se repite (usar --forzar para repetirla).`);
    soltarCandado();
    return 0;
  }

  const reg = { tipo, empezo: ahoraISO(), resultado: 'en_curso', pasos: [], gbBytes: 0, filas: null, maxRssMb: 0 };
  let id = null, alm = null;
  const pasos = reg.pasos;
  const sumar = (r) => { reg.gbBytes += r.gbBytes || 0; reg.maxRssMb = Math.max(reg.maxRssMb, r.maxRssMb || 0); pasos.push({ paso: r.nombre, ok: r.codigo === 0, ms: r.ms, gb: gb(r.gbBytes || 0), consultas: r.consultas, memoria_mb: r.maxRssMb }); };
  let respaldoActivos = null;
  let resultado = 'fallo', error = null, sinDato = false, datosHasta = null, version = null, controles = {};

  try {
    if (!ARGS.has('--solo-verificar')) { try { alm = await almacen(); id = alm ? await alm.empezarActualizacion({ tipo }) : null; } catch (e) { console.error('No se pudo abrir el registro en la base:', e.message); } }

    // ----- 1. ayer completo
    log('1. Verificando que ayer esté completo en DataJunta...');
    const v = await verificarAyer();
    reg.gbBytes += v.gbBytes;
    pasos.push({ paso: 'verificar-ayer', ok: v.completo, canales: v.canales, gb: gb(v.gbBytes) });
    controles.ayer = v;
    if (!v.completo) {
      sinDato = true; error = v.motivo;
      log(`Sin dato de hoy: ${v.motivo}. Se sigue sirviendo la versión anterior (datos al ${estadoPrevio.datos_hasta || '—'}).`);
      return 0;
    }
    log(`Ayer (${dmy(v.ayer)}) está completo en los dos canales.`);
    if (ARGS.has('--solo-verificar')) { resultado = 'ok'; log(JSON.stringify(v.canales)); return 0; }

    fs.mkdirSync(NUEVO, { recursive: true });
    for (const p of [NUEVO_HTML, NUEVO_REND, NUEVO_PROYECTOS]) borrar(p);

    // ----- 2. extracción
    log('2. Extrayendo de BigQuery (varios minutos)...');
    let r = await correr('extraer', path.join('borrador', '_extraer.js'), [`--salida=${NUEVO_PROYECTOS_NOMBRE}`], { timeoutMs: 45 * MIN });
    sumar(r);
    if (r.codigo !== 0) throw Object.assign(new Error('La extracción falló: ' + r.salida.trim().split('\n').slice(-3).join(' | ')), { salida: r.salida });
    reg.filas = filasDeLaExtraccion(r.salida);
    if (!reg.filas) throw new Error('La extracción terminó pero no informó las filas que bajó.');
    // Control: sin caídas bruscas de filas contra la última corrida buena.
    const prev = estadoPrevio.filas || {};
    const caidas = Object.entries(reg.filas).filter(([k, n]) => (prev[k] || 0) >= FILAS_MINIMAS_PARA_COMPARAR && n < prev[k] * (1 - CAIDA_MAXIMA_FILAS));
    controles.caidasDeFilas = caidas.map(([k, n]) => `${k}: ${prev[k]} → ${n}`);
    if (caidas.length) throw new Error('Caída brusca de filas respecto de la última corrida buena: ' + controles.caidasDeFilas.join('; '));

    // ----- 3. presupuestos
    log('3. Presupuestos (planilla de pedidos y gasto por activo)...');
    try { respaldoActivos = fs.readFileSync(RUTAS.activos); } catch (e) { respaldoActivos = null; }
    r = await correr('presupuestos', path.join('presupuestos', 'activos.js'));
    sumar(r);
    if (r.codigo !== 0) throw Object.assign(new Error('Presupuestos falló: ' + r.salida.trim().split('\n').slice(-3).join(' | ')), { salida: r.salida });

    // ----- 4. rendimiento por pieza (para Creatividades)
    log('4. Rendimiento por pieza...');
    r = await correr('rendimiento', path.join('salidas', 'rendimiento-piezas.js'), [`--entrada=${NUEVO_PROYECTOS_NOMBRE}`, `--salida=${NUEVO_REND}`]);
    sumar(r);
    if (r.codigo !== 0) throw Object.assign(new Error('Rendimiento por pieza falló: ' + r.salida.trim().split('\n').slice(-3).join(' | ')), { salida: r.salida });

    // ----- 5. armar
    log('5. Armando la app...');
    const envArmado = { SEGUIMIENTO_PROYECTOS: NUEVO_PROYECTOS, SEGUIMIENTO_SALIDA: NUEVO_HTML };
    r = await correr('armar', 'armar.js', [], { env: envArmado, cwd: path.join(RAIZ, 'app') });
    sumar(r);
    if (r.codigo !== 0) throw Object.assign(new Error('El armado falló: ' + r.salida.trim().split('\n').slice(-3).join(' | ')), { salida: r.salida });
    const armado = r.salida;

    // ----- 6. controles
    log('6. Controles antes de cambiar de versión...');
    const pm = armado.match(/parches aplicados (\d+)\/(\d+)/);
    controles.parches = pm ? `${pm[1]}/${pm[2]}` : null;
    if (!pm || pm[1] !== pm[2]) throw new Error(`Parches de markup: ${controles.parches || 'sin dato'} (tienen que ser N/N).`);
    const hm = armado.match(/datos al (\d{4}-\d{2}-\d{2})/);
    datosHasta = hm ? hm[1] : v.ayer;
    controles.datosHasta = datosHasta;
    const proys = proyectosDelArmado(armado);
    controles.proyectosConCampanias = Object.keys(proys).filter((k) => proys[k] > 0).length;
    const antes = estadoPrevio.proyectos || {};
    const perdidos = Object.keys(antes).filter((k) => antes[k] > 0 && !(proys[k] > 0));
    if (!controles.proyectosConCampanias) throw new Error('El armado no dejó ningún proyecto con campañas.');
    if (perdidos.length) throw new Error('Proyectos que tenían campañas y ahora no tienen datos: ' + perdidos.join(', '));
    r = await correr('contrato', path.join('app', 'pruebas', 'contrato.js'), [], { env: { SEGUIMIENTO_SALIDA: NUEVO_HTML } });
    sumar(r);
    const pc = r.salida.match(/problemas (\d+)/);
    controles.contrato = pc ? `problemas ${pc[1]}` : 'sin resultado';
    if (r.codigo !== 0 || !pc || pc[1] !== '0') throw Object.assign(new Error(`La prueba de contrato no dio "problemas 0" (${controles.contrato}).`), { salida: r.salida });

    // ----- 7. cambio de versión (el HTML, que es lo que sirve la app, al final)
    log('7. Cambiando de versión...');
    promover(NUEVO_PROYECTOS, RUTAS.proyectos);
    promover(NUEVO_REND, RUTAS.rendimiento);
    version = `${datosHasta}@${ahoraISO().slice(0, 16)}`;
    promover(NUEVO_HTML, RUTAS.html);
    resultado = 'ok';
    respaldoActivos = null; // quedó en uso: no se restituye
    log(`Versión nueva en servicio: datos al ${dmy(datosHasta)} (${version}).`);

    // ----- 8. resumen por activo para el módulo Activos (no bloquea)
    r = await correr('resumen-activos', path.join('presupuestos', 'resumen-activos.js'), [], { env: { SEGUIMIENTO_PROYECTOS: RUTAS.proyectos } });
    sumar(r);
    if (r.codigo !== 0) { controles.resumenActivos = 'falló (no cambia el resultado): ' + r.salida.trim().split('\n').slice(-2).join(' | '); log(controles.resumenActivos); } else controles.resumenActivos = 'ok';
    reg.proyectos = proys;
    return 0;
  } catch (e) {
    resultado = 'fallo'; error = String(e && e.message || e).slice(0, 1500);
    reg.salidaDelPasoQueFallo = e && e.salida ? String(e.salida).slice(-3000) : undefined;
    log('FALLÓ: ' + error + ' — se sigue sirviendo la versión anterior.');
    if (respaldoActivos) { try { fs.writeFileSync(RUTAS.activos, respaldoActivos); } catch (e2) { /* se deja como está */ } }
    return 1;
  } finally {
    // ----- registro de la corrida
    borrar(NUEVO_PROYECTOS); borrar(NUEVO);
    if (!ARGS.has('--solo-verificar')) {
      const duracion = Date.now() - t0;
      const ok = resultado === 'ok';
      const fin = {
        id: id || `${Date.now()}-${process.pid}`, tipo, empezo: reg.empezo, termino: ahoraISO(), resultado: ok ? 'ok' : 'fallo',
        sin_dato_de_hoy: sinDato, datos_hasta: ok ? datosHasta : null, version, duracion_ms: duracion, filas: reg.filas,
        gb_bigquery: gb(reg.gbBytes), memoria_mb: reg.maxRssMb, error: ok ? null : error,
        detalle: { pasos, controles, ...(sinDato ? { motivo: 'sin_dato_de_hoy' } : {}) },
      };
      anotarArchivo(fin);
      if (alm && id) {
        try {
          await alm.terminarActualizacion(id, { resultado: fin.resultado, datos_hasta: fin.datos_hasta, version, duracion_ms: duracion, filas: reg.filas,
            gb_bigquery: fin.gb_bigquery, memoria_mb: fin.memoria_mb, error: fin.error, detalle: fin.detalle });
        } catch (e) { console.error('No se pudo cerrar el registro en la base:', e.message); }
      }
      // Estado para la app: lo servido hoy y si falta el dato de hoy.
      const servido = ok ? datosHasta : estadoPrevio.datos_hasta || null;
      const ayer = sumarDias(hoy, -1);
      escribirAtomico(ESTADO, JSON.stringify({
        actualizado: ahoraISO(), hoy, datos_hasta: servido, version: ok ? version : estadoPrevio.version || null, codigo_version: ok ? codigoVersion() : estadoPrevio.codigo_version || null,
        ...(estadoPrevio.ultimo_solo_armar ? { ultimo_solo_armar: estadoPrevio.ultimo_solo_armar } : {}),
        sin_dato_de_hoy: !servido || servido < ayer,
        aviso: !servido ? 'Sin datos' : servido < ayer ? `Sin dato de hoy: los números son al ${dmy(servido)}` : null,
        ultimo_ok_dia: ok ? hoy : estadoPrevio.ultimo_ok_dia || null, ultimo_ok: ok ? ahoraISO() : estadoPrevio.ultimo_ok || null,
        filas: ok ? reg.filas : estadoPrevio.filas || null, proyectos: ok ? reg.proyectos : estadoPrevio.proyectos || null,
        ultima_corrida: { id: fin.id, tipo, resultado: fin.resultado, sin_dato_de_hoy: sinDato, empezo: fin.empezo, termino: fin.termino, duracion_ms: duracion, gb_bigquery: fin.gb_bigquery, memoria_mb: fin.memoria_mb, error: fin.error },
      }, null, 1));
      log(`Corrida ${fin.resultado}${sinDato ? ' (sin dato de hoy)' : ''} · ${Math.round(duracion / 1000)} s · ${fin.gb_bigquery} GB de BigQuery · memoria máxima de un paso ${fin.memoria_mb} MB`);
    }
    soltarCandado();
  }
}

if (require.main === module) {
  main().then((codigo) => process.exit(codigo), (e) => { console.error('ERROR inesperado:', e && e.stack || e); soltarCandado(); process.exit(1); });
}
module.exports = { main, soloArmar, verificarAyer, filasDeLaExtraccion, proyectosDelArmado, escribirAtomico, promover, hoyAR, sumarDias, RUTAS };
