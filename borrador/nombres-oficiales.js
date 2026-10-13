// Nombre oficial de cada campaña (pedido 033, paso 2; Juan Pablo, 13/10/2026). Las campañas se agrupan por el nombre de la lista única de
// PAUTADOR (datos-fijos/campanas-oficiales.json: campanas { id, proyecto, nombre, nombre_norm } y equivalentes { campana_id, proyecto,
// nombre (el viejo), nombre_norm, vertical }). Se aplica una sola vez, al cargar los datos (borrador/armar.js), sobre la comunicación de
// DataJunta: todo lo de abajo (Campañas, Mapa, Ejes, Activos, Recomendaciones, Proyección, temporada, referencias) se agrupa solo.
//   - Normalización (la misma de PAUTADOR): sin tildes, minúsculas, todo lo que no sea letra o número pasa a espacio, espacios simples.
//   - Se busca por proyecto: los proyectos de PAUTADOR de cada cliente de DataJunta (el cliente mismo, "<cliente> Oficial" y los
//     subproyectos que DataJunta pone en la columna Proyecto de ese cliente, p. ej. Nacho Torres en Gobierno del Chubut). Primero el
//     proyecto principal; un nombre que en los subproyectos apunta a dos campañas distintas no se cambia.
//   - Sin par: conserva el nombre de DataJunta. Sin archivo: todo queda como antes.
//   - Alcance: nunca se suma. Si dos o más nombres de DataJunta se juntan en una campaña oficial (en un canal y cliente), las lecturas de
//     alcance de Meta por comunicación NO se renombran: la campaña queda "sin dato" de alcance en vez de sumar dos lecturas.
const fs = require('fs');
const path = require('path');

const ARCHIVO = path.join(__dirname, '..', 'datos-fijos', 'campanas-oficiales.json');
const normalizar = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// bloques de _proyectos.json con la comunicación (campo comunic); alcanceMeta va aparte (campo comunicacion, ver arriba)
const BLOQUES = ['cruce', 'diaria', 'semanal', 'eficacia', 'conjuntos', 'todas', 'audDia'];

function leerLista(archivo = ARCHIVO) {
  if (!fs.existsSync(archivo)) return null;
  const d = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  return d && Array.isArray(d.campanas) ? d : null;
}

// índice proyecto → nombre_norm → nombre oficial (las campañas y sus equivalentes)
function indice(lista) {
  const porId = new Map(lista.campanas.map((c) => [c.id, c]));
  const idx = {};
  const poner = (proyecto, norm, oficial) => {
    if (!norm || !oficial) return;
    const m = idx[proyecto] = idx[proyecto] || {};
    m[norm] = m[norm] && m[norm] !== oficial ? null : oficial;   // dos campañas con el mismo nombre en un proyecto: ambiguo, no se toca
  };
  for (const c of lista.campanas) poner(c.proyecto, c.nombre_norm || normalizar(c.nombre), c.nombre);
  for (const e of lista.equivalentes || []) { const c = porId.get(e.campana_id); if (c) poner(e.proyecto || c.proyecto, e.nombre_norm || normalizar(e.nombre), c.nombre); }
  return idx;
}

// proyectos de PAUTADOR de cada cliente de DataJunta: el principal primero, después los subproyectos de la columna Proyecto
function proyectosPorCliente(fuente, idx) {
  const out = {};
  const sumar = (cli, p) => { const xs = out[cli] = out[cli] || []; if (p && idx[p] && !xs.includes(p)) xs.push(p); };
  const clientes = new Set(BLOQUES.flatMap((b) => (fuente[b] || []).map((r) => r.cliente)));
  for (const cli of clientes) { sumar(cli, cli); sumar(cli, `${cli} Oficial`); }
  for (const r of fuente.plataformas || []) sumar(r.cliente, r.proyecto);
  return out;
}

function oficialDe(idx, proys, nombre) {
  const n = normalizar(nombre);
  if (!n) return null;
  if (proys.length && idx[proys[0]] && idx[proys[0]][n] !== undefined) return idx[proys[0]][n];   // proyecto principal (null = ambiguo)
  const xs = new Set(proys.slice(1).map((p) => idx[p] && idx[p][n]).filter((x) => x !== undefined));
  return xs.size === 1 ? [...xs][0] : null;
}

// aplica los nombres oficiales sobre fuente (en el lugar) y devuelve la medición
function aplicar(fuente, { archivo = ARCHIVO, desde = '2026-01-01' } = {}) {
  const lista = leerLista(archivo);
  if (!lista) return { aplicado: false, motivo: `no está ${path.basename(archivo)}: los nombres quedan como en DataJunta` };
  const idx = indice(lista), proyCli = proyectosPorCliente(fuente, idx);
  const mapa = new Map();   // canal|cliente|nombre DataJunta → nombre oficial (o null)
  const de = (canal, cli, nombre) => {
    const k = `${canal}|${cli}|${nombre}`;
    if (!mapa.has(k)) mapa.set(k, oficialDe(idx, proyCli[cli] || [], nombre));
    return mapa.get(k);
  };
  // qué nombres de DataJunta caen en cada campaña oficial (para saber cuáles se juntan)
  const juntos = {};
  for (const b of BLOQUES) for (const r of fuente[b] || []) {
    if (!r.comunic) continue;
    const of = de(r.canal, r.cliente, r.comunic);
    if (of) (juntos[`${r.canal}|${r.cliente}|${of}`] = juntos[`${r.canal}|${r.cliente}|${of}`] || new Set()).add(r.comunic);
  }
  // gasto 2026 por campaña de DataJunta (para la medición): cruce (Meta) + todas (el resto de las plataformas)
  const gasto = {};
  for (const r of fuente.cruce || []) if (r.comunic && (r.mes || '') >= desde.slice(0, 7)) gasto[`${r.canal}|${r.cliente}|${r.comunic}`] = (gasto[`${r.canal}|${r.cliente}|${r.comunic}`] || 0) + (Number(r.gasto) || 0);
  for (const r of fuente.todas || []) if (r.comunic && r.plataforma !== 'META' && (r.fecha || '') >= desde) gasto[`${r.canal}|${r.cliente}|${r.comunic}`] = (gasto[`${r.canal}|${r.cliente}|${r.comunic}`] || 0) + (Number(r.gasto) || 0);
  // renombrar
  for (const b of BLOQUES) for (const r of fuente[b] || []) { if (!r.comunic) continue; const of = de(r.canal, r.cliente, r.comunic); if (of && of !== r.comunic) r.comunic = of; }
  let alcanceSinRenombrar = 0;
  for (const r of fuente.alcanceMeta || []) {
    if (!r.comunicacion) continue;
    const of = de(r.canal, r.cliente, r.comunicacion);
    if (!of || of === r.comunicacion) continue;
    if (juntos[`${r.canal}|${r.cliente}|${of}`] && juntos[`${r.canal}|${r.cliente}|${of}`].size > 1) { alcanceSinRenombrar++; continue; }
    r.comunicacion = of;
  }
  // medición (campañas de DataJunta con gasto en 2026)
  const med = { conOficial: 0, mismoNombre: 0, renombradas: 0, juntadas: 0, sinPar: 0, gastoSinPar: 0, gastoTotal: 0 };
  const sinPar = [], grupos = [];
  for (const [k, g] of Object.entries(gasto)) {
    if (!(g > 0)) continue;
    const [canal, cli, nombre] = k.split('|'), of = mapa.get(k);
    med.gastoTotal += g;
    if (!of) { med.sinPar++; med.gastoSinPar += g; sinPar.push({ canal, cliente: cli, nombre, gasto: Math.round(g) }); continue; }
    med.conOficial++;
    if (of === nombre) med.mismoNombre++; else med.renombradas++;
    if (juntos[`${canal}|${cli}|${of}`].size > 1) med.juntadas++;
  }
  for (const [k, s] of Object.entries(juntos)) if (s.size > 1) { const [canal, cliente, oficial] = k.split('|'); grupos.push({ canal, cliente, oficial, nombres: [...s].sort() }); }
  sinPar.sort((a, b) => b.gasto - a.gasto);
  return { aplicado: true, generado_el: lista.generado_el || null, campanas: lista.campanas.length, equivalentes: (lista.equivalentes || []).length,
    medicion: { ...med, gastoSinPar: Math.round(med.gastoSinPar), gastoTotal: Math.round(med.gastoTotal) }, alcanceSinRenombrar, juntadas: grupos, sinPar };
}

module.exports = { aplicar, normalizar, ARCHIVO };
