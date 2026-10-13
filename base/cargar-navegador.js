// Seguimiento y Optimización · carga a la base de lo que vivía solo en el navegador (13/10/2026, agente Recomendaciones).
// Lee el .json que baja el snippet base/exportar-del-navegador.js (una o varias personas) y carga, resolviendo lo que la base rechaza:
//
//   syo.st        decisión de cada recomendación   → respuestas. Se busca de qué proyecto y canal es mirando app/repositorio/recomendaciones/.
//                                                    Si no se encuentra (la recomendación ya no está en ningún día), va a "sin destino".
//                                                    "hecha a mano" o "descartada" sin motivo entra con un motivo aclaratorio (ver carga-comun.js).
//   syo.comments  comentarios de pantalla          → comentarios (objeto pantalla).
//                                                    "Mis proyectos" y "Cómo leer" no tienen proyecto: van al proyecto "(general)".
//                                                    De una pestaña que ya no existe, el comentario pasa a la pantalla "resumen" del mismo
//                                                    proyecto y canal, con una aclaración al principio.
//   syo.tipos     tipo de campaña confirmado       → tipos_campana_cambios (y la base calcula el tipo actual). La vieja syo.seasonal se
//                                                    convierte si no hay syo.tipos. Si el servidor ya tenía ese mismo tipo, no se repite.
//   syo.looker    links de Looker pegados a mano   → looker_links (el link de datastudio.google.com pasa a lookerstudio.google.com).
//                                                    Si ya hay uno para ese proyecto y canal, no se pisa.
//   syo.autor     nombre con que firmaba           → autor_nombre. El autor es el mail que se escribió al exportar (o --autor-mail).
//   syo.canal y syo.kpiSel son preferencias de pantalla: no se cargan.
// Todo queda como origen "carga_inicial". Se puede repetir sin duplicar.
//
// Uso (desde Seguimiento/):
//   prueba en seco:   node base/cargar-navegador.js salidas/syo-export-2026-10-14.json
//   escribir:         node base/cargar-navegador.js salidas/syo-export-2026-10-14.json --escribir-en <código del proyecto de Supabase>
//   opciones:  --autor-mail <mail>  (si el export no trae mail)   --repositorio <carpeta>   --proyecto-extra id=Nombre (pruebas)
// Si hay cosas sin destino, se escribe <archivo>.sin-destino.json al lado del export, para que Juan Pablo las mire.
const fs = require('fs');
const path = require('path');
const C = require('./carga-comun.js');
const { MAIL } = require('./almacen.js');

const DECISION = { sent: 'enviada a PAUTADOR', manual: 'hecha a mano', discarded: 'descartada' };
const CLAVES_SIN_CARGA = ['syo.canal', 'syo.kpiSel'];
const sinPid = (x) => { const t = String(x == null ? '' : x), i = t.indexOf('::'); return i < 0 ? t : t.slice(i + 2); };

function lookerNormal(url) {
  const m = String(url || '').match(/^https:\/\/(?:lookerstudio|datastudio)\.google\.com\/[^\s"'<>]+/);
  return m ? m[0].replace('://datastudio.google.com/', '://lookerstudio.google.com/') : '';
}

// id de recomendación → de qué proyecto y canal es (la última vez que apareció en un día del repositorio).
function indiceRecomendaciones(repo) {
  const carpeta = path.join(repo, 'recomendaciones');
  const idx = new Map();
  const dias = fs.existsSync(carpeta) ? fs.readdirSync(carpeta).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort() : [];
  for (const f of dias) for (const r of C.leerJsonl(path.join(carpeta, f))) {
    if (!r.id) continue;
    const previo = idx.get(r.id) || { destinos: new Set() };
    previo.destinos.add(`${r.proyecto}|${r.canal}`);
    idx.set(r.id, { ...previo, r });   // queda la última aparición
  }
  return idx;
}

function procesarExport(data, nombreArchivo, { repo, proyectos, mailArg }) {
  const local = data.local || {};
  const val = (k) => { const v = local[k]; if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch (e) { return v; } };
  const exportado = data.exportado || new Date().toISOString();
  const mailExport = String(mailArg || data.autor_mail || '').trim().toLowerCase();
  const mailDefecto = MAIL.test(mailExport) ? mailExport : null;
  const autorCrudo = typeof val('syo.autor') === 'string' ? val('syo.autor').trim() : '';
  const ctx = { mailDefecto };
  const regs = [], sinDestino = { decisiones: [], comentarios: [], tipos: [], lookers: [] }, notas = [];
  const nombres = Object.values(proyectos);

  // lo que el servidor ya tenía (respuestas.jsonl): no se repite
  const delServidor = C.leerJsonl(path.join(repo, 'respuestas.jsonl'));
  const decididas = new Set(delServidor.filter((x) => x.clase === 'recomendacion').map((x) => `${x.id}|${x.decision}`));
  const ultimoTipo = new Map();
  for (const x of delServidor) if (x.clase === 'tipo_campana') ultimoTipo.set(`${x.proyecto}|${x.canal}|${x.campana}`, x.tipo);

  // --- decisiones (syo.st) ---
  const indice = indiceRecomendaciones(repo);
  const st = val('syo.st') || {};
  let vacias = 0, yaEnServidor = 0;
  for (const [id, x] of Object.entries(st)) {
    const decision = DECISION[x && x.status] || 'pendiente';
    if (decision === 'pendiente' && !(x && x.op) && !(x && x.comment)) { vacias++; continue; }
    if (decididas.has(`${id}|${decision}`)) { yaEnServidor++; continue; }
    const hit = indice.get(id);
    if (!hit || hit.destinos.size !== 1) {
      sinDestino.decisiones.push({ id, motivo_no_cargada: hit ? 'el id aparece en más de un proyecto' : 'la recomendación ya no está en ningún día guardado', ...x });
      continue;
    }
    const r = hit.r;
    regs.push({ clase: 'recomendacion', id, proyecto: r.proyecto, canal: r.canal, datos_al: r.datos_al, tipo: r.tipo, titulo: r.titulo, campana: r.campana, solucion: r.solucion,
      decision, motivo: x.reason || null, sirve: x.op || null, comentario: x.comment || null, cuando: x.fecha || exportado, autor: autorCrudo });
  }

  // --- comentarios de pantalla (syo.comments) ---
  const comments = val('syo.comments') || {};
  let movidos = 0, generales = 0;
  for (const [clave, texto] of Object.entries(comments)) {
    if (!String(texto || '').trim()) continue;
    const p = C.entenderPantalla(clave, nombres);
    if (p.general) generales++;
    if (p.movida) movidos++;
    const t = p.movida ? `(Escrito en la pestaña «${p.pestana}», que ya no existe.) ${texto}` : String(texto);
    regs.push({ clase: 'pantalla', pantalla: p.referencia, proyecto: p.proyecto, canal: p.canal, comentario: t, cuando: exportado, autor: autorCrudo });
  }

  // --- tipos de campaña (syo.tipos, o la vieja syo.seasonal) ---
  let tipos = val('syo.tipos');
  if (!tipos) {
    const v = val('syo.seasonal') || {};
    tipos = Object.fromEntries(Object.entries(v).filter(([, x]) => x).map(([k, x]) => [k, x === 'si' ? 'estacional' : 'ninguna']));
    if (Object.keys(tipos).length) notas.push('Había decisiones de la clave vieja syo.seasonal: se convirtieron como hace la app.');
  }
  let tiposIguales = 0;
  for (const [clave, tipo] of Object.entries(tipos || {})) {
    const partes = clave.split('|');
    const nombre = proyectos[partes[0]];
    const campana = sinPid(partes.slice(2).join('|'));
    if (!nombre || partes.length < 3 || !campana) { sinDestino.tipos.push({ clave, tipo, motivo_no_cargada: 'no es un proyecto de la app' }); continue; }
    const previo = ultimoTipo.get(`${nombre}|${partes[1]}|${campana}`);
    if (previo && (previo === tipo || (tipo === 'ninguna' && ['larga', 'puntual'].includes(previo)))) { tiposIguales++; continue; }
    regs.push({ clase: 'tipo_campana', proyecto: nombre, canal: partes[1], campana, tipo, cuando: exportado, autor: autorCrudo });
  }

  // --- Looker (syo.looker) ---
  const lookers = [];
  for (const [clave, url] of Object.entries(val('syo.looker') || {})) {
    const [pid, canal] = clave.split('|');
    const nombre = proyectos[pid], link = lookerNormal(url);
    if (!nombre || !canal) { sinDestino.lookers.push({ clave, url, motivo_no_cargada: 'no es un proyecto de la app' }); continue; }
    if (!link) { sinDestino.lookers.push({ clave, url, motivo_no_cargada: 'no parece un link de Looker Studio' }); continue; }
    lookers.push({ proyecto: nombre, canal, url: link });
  }

  const conocidas = ['syo.st', 'syo.comments', 'syo.tipos', 'syo.seasonal', 'syo.looker', 'syo.autor', ...CLAVES_SIN_CARGA];
  const otras = [...Object.keys(local), ...Object.keys(data.sesion || {})].filter((k) => !conocidas.includes(k) && k !== 'syo.kpiSel');
  return { regs, lookers, sinDestino, ctx, autorCrudo, mailDefecto, notas, cuentas: { decisiones: Object.keys(st).length, vacias, yaEnServidor, comentarios: Object.keys(comments).length, movidos, generales, tipos: Object.keys(tipos || {}).length, tiposIguales, lookers: Object.keys(val('syo.looker') || {}).length, otras }, exportado };
}

async function main() {
  const args = C.argumentos(process.argv.slice(2));
  if (!args._.length) { console.error('Falta el archivo .json que bajó el snippet. Ejemplo: node base/cargar-navegador.js salidas/syo-export-2026-10-14.json'); process.exit(1); }
  const repo = args.opciones.repositorio ? path.resolve(args.opciones.repositorio) : C.REPO_POR_DEFECTO;
  const proyectos = C.proyectosDeLaApp(args.opciones['proyecto-extra']);
  const { db, ref, escribir } = C.conectar(process.env, args.opciones);
  console.log(`Base: proyecto de Supabase "${ref}" · ${escribir ? 'ESCRIBE' : 'prueba en seco (no escribe nada)'}`);

  for (const archivo of args._) {
    const data = JSON.parse(fs.readFileSync(path.resolve(archivo), 'utf8').replace(/^﻿/, ''));
    if (data.formato !== 'syo-export-1') throw new Error(`${archivo}: no es un export del snippet (falta formato "syo-export-1")`);
    const p = procesarExport(data, archivo, { repo, proyectos, mailArg: typeof args.opciones['autor-mail'] === 'string' ? args.opciones['autor-mail'] : '' });
    const c = p.cuentas;
    console.log(`\n== ${path.basename(archivo)} · exportado ${p.exportado} · de ${data.origen || '?'}`);
    console.log(`   firma: ${p.mailDefecto || 'sin mail (va "sin identificar")'}${p.autorCrudo ? ` · nombre "${p.autorCrudo}"` : ''}`);
    console.log(`   encontré: ${c.decisiones} decisiones (${c.vacias} sin nada, ${c.yaEnServidor} ya en el servidor), ${c.comentarios} comentarios de pantalla (${c.generales} sin proyecto, ${c.movidos} de pestañas que ya no existen), ${c.tipos} tipos de campaña (${c.tiposIguales} ya iguales en el servidor), ${c.lookers} links de Looker`);
    if (c.otras.length) console.log(`   claves que no conozco y NO se cargan: ${c.otras.join(', ')}`);
    p.notas.forEach((n) => console.log(`   nota: ${n}`));

    const items = p.regs.map((r) => C.aFila(r, p.ctx));
    const resumen = await C.cargarFilas(db, items, { escribir });
    C.imprimirResumen('   en la base', resumen, escribir);

    // Looker: no se pisa un link que ya esté
    const hay = new Set((await C.todas(db, 'looker_links', 'proyecto,canal')).map((x) => `${x.proyecto}|${x.canal}`));
    const nuevos = p.lookers.filter((l) => !hay.has(`${l.proyecto}|${l.canal}`));
    if (escribir && nuevos.length) {
      const q = C.resolverAutor(p.autorCrudo, p.ctx);
      await C.insertarLotes(db, 'looker_links', nuevos.map((l) => ({ ...l, autor: q.autor, autor_nombre: q.autor_nombre, origen: 'carga_inicial' })));
    }
    console.log(`   looker_links: ${escribir ? 'se agregaron' : 'se agregarían'} ${nuevos.length}, ya había ${p.lookers.length - nuevos.length}`);

    const nSin = Object.values(p.sinDestino).reduce((n, a) => n + a.length, 0);
    if (nSin) {
      const salida = `${path.resolve(archivo)}.sin-destino.json`;
      fs.writeFileSync(salida, JSON.stringify(p.sinDestino, null, 1));
      console.log(`   SIN DESTINO: ${nSin} (decisiones ${p.sinDestino.decisiones.length}, tipos ${p.sinDestino.tipos.length}, lookers ${p.sinDestino.lookers.length}). Quedaron en ${salida}`);
    }
  }
  if (!escribir) console.log('\nNo se escribió nada. Para escribir: agregar --escribir-en ' + ref);
}

if (require.main === module) main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
module.exports = { procesarExport, lookerNormal, indiceRecomendaciones };
