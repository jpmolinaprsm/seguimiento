// Seguimiento y Optimización · piezas comunes de las cargas a la base (13/10/2026, agente Recomendaciones).
// Las usan base/cargar-inicial.js (lo que hay en app/repositorio/) y base/cargar-navegador.js (lo que vive en el navegador).
//
// Reglas de estas cargas:
//   - Por defecto NO escriben nada: cuentan lo que harían ("prueba en seco"). Para escribir hay que pasar --escribir-en <código del
//     proyecto de Supabase>, que es lo que aparece en la dirección (https://<código>.supabase.co). Sirve de doble control para no
//     cargar en la base equivocada.
//   - Se pueden repetir sin duplicar nada: antes de agregar, miran qué filas de "carga_inicial" ya están.
//   - Todo lo que cargan queda marcado origen = 'carga_inicial' (la base acepta ahí un autor que no sea mail).
//   - Las claves salen de variables de entorno (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY). Nada se guarda en archivos ni se imprime.
const fs = require('fs');
const path = require('path');
const { validarRespuesta, MAIL } = require('./almacen.js');

const PAGINA = 1000;
const LOTE = 200;
const SIN_IDENTIFICAR = 'sin identificar';
// Proyecto de los comentarios que no son de ningún proyecto (Mis proyectos, Cómo leer).
const PROYECTO_GENERAL = '(general)';

// ---------- argumentos ----------
function argumentos(argv) {
  const a = { _: [], opciones: {} };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x.startsWith('--')) {
      const [k, v] = x.slice(2).split('=');
      if (v !== undefined) a.opciones[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--') && ['escribir-en', 'autor-mail', 'repositorio', 'proyecto-extra'].includes(k)) a.opciones[k] = argv[++i];
      else a.opciones[k] = true;
    } else a._.push(x);
  }
  return a;
}

// ---------- conexión ----------
function conectar(env = process.env, opciones = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan las variables SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (se cargan en la ventana de PowerShell, nunca en un archivo).');
  }
  const ref = (String(env.SUPABASE_URL).match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1];
  if (!ref) throw new Error('SUPABASE_URL no tiene la forma https://<código>.supabase.co');
  const { createClient } = require('@supabase/supabase-js');
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const escribir = opciones['escribir-en'] !== undefined;
  if (escribir && opciones['escribir-en'] !== ref) {
    throw new Error(`--escribir-en dice "${opciones['escribir-en']}" pero las variables apuntan al proyecto "${ref}". No se escribe nada.`);
  }
  return { db, ref, escribir };
}

const ok = ({ data, error }, que) => { if (error) throw new Error(`base (${que}): ${error.message}`); return data; };
async function todas(db, tabla, columnas, armar = (q) => q) {
  const out = [];
  for (let desde = 0; ; desde += PAGINA) {
    const filas = ok(await armar(db.from(tabla).select(columnas)).range(desde, desde + PAGINA - 1), `leer ${tabla}`);
    out.push(...filas);
    if (filas.length < PAGINA) return out;
  }
}
async function insertarLotes(db, tabla, filas) {
  for (let i = 0; i < filas.length; i += LOTE) ok(await db.from(tabla).insert(filas.slice(i, i + LOTE)), `agregar a ${tabla}`);
}

// ---------- archivos ----------
function leerJsonl(f) {
  let t = '';
  try { t = fs.readFileSync(f, 'utf8'); } catch (e) { return []; }
  const out = [];
  t.split(/\r?\n/).forEach((l, i) => { if (!l.trim()) return; try { out.push(JSON.parse(l)); } catch (e) { throw new Error(`${path.basename(f)} línea ${i + 1}: no es JSON`); } });
  return out;
}
const REPO_POR_DEFECTO = path.join(__dirname, '..', 'app', 'repositorio');

// Proyectos de la app (id → nombre), leídos de borrador/armar.js para no tener dos listas. --proyecto-extra id=Nombre suma uno (pruebas).
function proyectosDeLaApp(extra) {
  const mapa = {};
  try {
    const t = fs.readFileSync(path.join(__dirname, '..', 'borrador', 'armar.js'), 'utf8');
    for (const m of t.matchAll(/\{\s*id:\s*'([^']+)',\s*cliente:\s*'[^']*',\s*nombre:\s*'([^']+)'\s*\}/g)) mapa[m[1]] = m[2];
  } catch (e) { /* queda vacío y se avisa más abajo */ }
  if (extra) { const [id, nombre] = String(extra).split('='); if (id && nombre) mapa[id] = nombre; }
  if (!Object.keys(mapa).length) throw new Error('No pude leer la lista de proyectos de borrador/armar.js');
  return mapa;
}

// ---------- reglas para que la base acepte lo viejo ----------
const MOTIVO_FALTANTE = 'Sin motivo registrado (decisión anterior a que el motivo fuera obligatorio)';

// Autor: si ya es un mail, va en minúsculas. Si no (un nombre suelto o "sin identificar"), va el mail de quien sube (si se lo dio) y el
// nombre queda en autor_nombre; si no hay mail, "sin identificar".
function resolverAutor(crudo, { mailDefecto } = {}) {
  const t = String(crudo == null ? '' : crudo).trim();
  if (MAIL.test(t)) return { autor: t.toLowerCase(), autor_nombre: null };
  const nombre = t && t.toLowerCase() !== SIN_IDENTIFICAR ? t : null;
  return { autor: mailDefecto || SIN_IDENTIFICAR, autor_nombre: nombre };
}

// Pantallas que existen hoy en la app (lo que escribe screenKey() de app/logica.js): la última parte de "Proyecto · Canal · pantalla".
// Pasos: General ('general'), Estructura (mapa, activos, ejes, audiencias), Detalle (campañas, insights) y Looker ('looker'); además
// "Campaña · id". Confirmado por Interfaz el 13/10. Los comentarios viejos guardados como "… · campañas" desde General quedaron
// mezclados con Detalle y no se pueden separar. Si Interfaz cambia los nombres, se cambia acá.
const PANTALLAS_VIGENTES = ['general', 'mapa', 'activos', 'ejes', 'audiencias', 'campañas', 'insights', 'looker'];
const PANTALLA_DESTINO = 'general';   // a dónde van los comentarios de pestañas que ya no existen (p. ej. "resumen")

// "Santa Fe · Oficial · mapa" → { proyecto, canal, pestana, referencia }. "Mis proyectos" y "Cómo leer" → sin proyecto.
function entenderPantalla(clave, nombresProyectos) {
  const partes = String(clave).split(' · ');
  if (partes.length < 3) return { proyecto: PROYECTO_GENERAL, canal: null, pestana: null, referencia: String(clave), general: true };
  const [proyecto, canal, pestana] = partes;
  const conocido = nombresProyectos.includes(proyecto) || proyecto === 'Todos los proyectos';
  if (!conocido) return { proyecto: PROYECTO_GENERAL, canal: null, pestana: null, referencia: String(clave), general: true, desconocido: proyecto };
  const vigente = PANTALLAS_VIGENTES.includes(pestana) || pestana === 'Campaña';
  if (vigente) return { proyecto, canal, pestana, referencia: String(clave) };
  return { proyecto, canal, pestana, referencia: `${proyecto} · ${canal} · ${PANTALLA_DESTINO}`, movida: true };
}

// ---------- de un registro (como los de respuestas.jsonl) a una fila de la base ----------
// reg: { clase, ... , cuando (ISO), autor }. ctx: { mailDefecto }. Devuelve { tabla, fila, clave } o { descartado: 'por qué' }.
function aFila(reg, ctx = {}) {
  const cuando = new Date(reg.cuando || reg.recibido || ctx.ahora || Date.now());
  if (Number.isNaN(cuando.getTime())) return { descartado: 'fecha ilegible' };
  const iso = cuando.toISOString();
  const quien = resolverAutor(reg.autor, ctx);
  const comun = { ...quien, origen: 'carga_inicial' };
  const r = { ...reg };
  if (r.clase === 'recomendacion' && ['hecha a mano', 'descartada'].includes(r.decision) && !String(r.motivo || '').trim()) r.motivo = MOTIVO_FALTANTE;
  if (r.clase === 'pantalla' && r.comentario != null && !String(r.comentario).trim()) r.comentario = null;
  const error = validarRespuesta(r, { exigirMail: false });
  if (error) return { descartado: error, detalle: `${r.clase}${r.proyecto ? ` · ${r.proyecto}` : ''}` };
  const ms = cuando.getTime();
  if (r.clase === 'recomendacion') {
    return { tabla: 'respuestas', clave: `${r.proyecto}|${r.canal}|${r.id}|${r.decision}|${ms}`, cuando: ms, fila: {
      recibido: iso, proyecto: r.proyecto, canal: r.canal, recomendacion_id: r.id, datos_al: r.datos_al ? String(r.datos_al).slice(0, 10) : null,
      decision: r.decision, motivo: r.motivo || null, sirve: r.sirve || null, comentario: r.comentario || null,
      tipo: r.tipo || null, titulo: r.titulo || null, campana: r.campana || null, solucion: r.solucion || null, ...comun } };
  }
  if (r.clase === 'regla') {
    return { tabla: 'comentarios', cuando: ms, clave: `regla|${r.regla}|${r.proyecto || ''}|${r.canal || ''}|${r.comentario}|${comun.autor}`, fila: {
      creado: iso, objeto: 'regla', referencia: r.regla, proyecto: r.proyecto || null, canal: r.canal || null, texto: r.comentario, ...comun } };
  }
  if (r.clase === 'pantalla') {
    return { tabla: 'comentarios', cuando: ms, clave: `pantalla|${r.pantalla}|${r.proyecto}|${r.canal || ''}|${r.comentario || ''}|${comun.autor}`, fila: {
      creado: iso, objeto: 'pantalla', referencia: r.pantalla, proyecto: r.proyecto, canal: r.canal || null, texto: r.comentario, ...comun } };
  }
  if (r.clase === 'tipo_campana') {
    return { tabla: 'tipos_campana_cambios', cuando: ms, clave: `${r.proyecto}|${r.canal}|${r.campana}|${r.tipo}|${ms}`, fila: {
      cambiado: iso, proyecto: r.proyecto, canal: r.canal, campana: r.campana, tipo: r.tipo, sugerido: r.sugerido || null, ...comun } };
  }
  return { descartado: `clase desconocida: ${r.clase}` };
}

// Claves de lo que ya está cargado (origen carga_inicial) en la base, para no repetir.
async function clavesExistentes(db) {
  const ms = (x) => new Date(x).getTime();
  const resp = await todas(db, 'respuestas', 'proyecto,canal,recomendacion_id,decision,recibido', (q) => q.eq('origen', 'carga_inicial'));
  const com = await todas(db, 'comentarios', 'objeto,referencia,proyecto,canal,texto,autor', (q) => q.eq('origen', 'carga_inicial').in('objeto', ['regla', 'pantalla']));
  const tip = await todas(db, 'tipos_campana_cambios', 'proyecto,canal,campana,tipo,cambiado', (q) => q.eq('origen', 'carga_inicial'));
  return {
    respuestas: new Set(resp.map((x) => `${x.proyecto}|${x.canal}|${x.recomendacion_id}|${x.decision}|${ms(x.recibido)}`)),
    comentarios: new Set(com.map((x) => `${x.objeto}|${x.referencia}|${x.proyecto || ''}|${x.canal || ''}|${x.texto || ''}|${x.autor}`)),
    tipos_campana_cambios: new Set(tip.map((x) => `${x.proyecto}|${x.canal}|${x.campana}|${x.tipo}|${ms(x.cambiado)}`)),
  };
}

// Agrega las filas que faltan, en orden de fecha (el tipo actual y el estado actual los calcula la base con triggers: tiene que llegar
// último lo más nuevo). Una por una para las tablas con triggers. Devuelve el resumen por tabla.
async function cargarFilas(db, items, { escribir }) {
  const existentes = await clavesExistentes(db);
  const resumen = { respuestas: { nuevas: 0, ya_estaban: 0 }, comentarios: { nuevas: 0, ya_estaban: 0 }, tipos_campana_cambios: { nuevas: 0, ya_estaban: 0 }, descartadas: [] };
  const nuevas = [];
  for (const it of items) {
    if (it.descartado) { resumen.descartadas.push(it); continue; }
    if (existentes[it.tabla].has(it.clave)) { resumen[it.tabla].ya_estaban++; continue; }
    existentes[it.tabla].add(it.clave);
    resumen[it.tabla].nuevas++;
    nuevas.push(it);
  }
  nuevas.sort((a, b) => a.cuando - b.cuando);
  if (escribir) for (const it of nuevas) ok(await db.from(it.tabla).insert(it.fila), `agregar a ${it.tabla}`);
  return resumen;
}

function imprimirResumen(titulo, resumen, escribir) {
  const v = escribir ? 'se agregaron' : 'se agregarían';
  console.log(`\n${titulo}`);
  for (const t of ['respuestas', 'comentarios', 'tipos_campana_cambios']) {
    const r = resumen[t]; if (r.nuevas + r.ya_estaban) console.log(`  ${t}: ${v} ${r.nuevas}, ya estaban ${r.ya_estaban}`);
  }
  if (resumen.descartadas.length) {
    console.log(`  no entraron ${resumen.descartadas.length}:`);
    for (const d of resumen.descartadas.slice(0, 20)) console.log(`    - ${d.descartado}${d.detalle ? ` (${d.detalle})` : ''}`);
  }
}

module.exports = { argumentos, conectar, ok, todas, insertarLotes, leerJsonl, REPO_POR_DEFECTO, proyectosDeLaApp, resolverAutor, entenderPantalla,
  aFila, cargarFilas, imprimirResumen, MOTIVO_FALTANTE, PROYECTO_GENERAL, PANTALLAS_VIGENTES, PANTALLA_DESTINO, SIN_IDENTIFICAR };
