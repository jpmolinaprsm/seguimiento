// Nombres viejos de campaña → nombre oficial de PAUTADOR (13/10/2026). Las campañas ahora se agrupan por el nombre oficial
// (borrador/nombres-oficiales.js), así que lo que el equipo guardó con el nombre viejo (tipos de campaña, decisiones, comentarios)
// dejaba de encontrarse. Esto arma una tabla chica con la MISMA lista y la MISMA normalización que nombres-oficiales.js, para buscar
// lo guardado por nombre oficial, por nombre normalizado o por nombre viejo, sin migrar nada.
//   construirAlias()              → { "<proyecto de PAUTADOR>": { "<nombre viejo normalizado>": "<nombre oficial>" } }
//                                    (solo los que cambian de verdad; un nombre que en un proyecto apunta a dos oficiales no entra)
//   oficialDe(alias, cliente, n)  → nombre oficial para ese cliente de DataJunta (busca en "<cliente>" y en "<cliente> Oficial", como
//                                    nombres-oficiales.js busca primero el proyecto principal), o el mismo nombre si no hay
// Los subproyectos de un cliente (p. ej. Nacho Torres en Chubut) no se consultan: no se sabe a cuál va un registro suelto.
const fs = require('fs');
const { normalizar, ARCHIVO } = require('../borrador/nombres-oficiales.js');

function construirAlias(archivo = ARCHIVO) {
  let lista = null;
  try { lista = JSON.parse(fs.readFileSync(archivo, 'utf8')); } catch (e) { return {}; }
  if (!lista || !Array.isArray(lista.campanas)) return {};
  const porId = new Map(lista.campanas.map((c) => [c.id, c]));
  const vistos = {};    // proyecto → nombre normalizado → Set(oficiales)
  const poner = (proyecto, viejo, oficial) => {
    const n = normalizar(viejo);
    if (!proyecto || !n || !oficial) return;
    const m = vistos[proyecto] = vistos[proyecto] || {};
    (m[n] = m[n] || new Set()).add(oficial);
  };
  for (const c of lista.campanas) poner(c.proyecto, c.nombre_norm || c.nombre, c.nombre);
  for (const e of lista.equivalentes || []) { const c = porId.get(e.campana_id); if (c) poner(e.proyecto || c.proyecto, e.nombre_norm || e.nombre, c.nombre); }
  const alias = {};
  for (const [proy, m] of Object.entries(vistos)) {
    for (const [n, set] of Object.entries(m)) {
      if (set.size !== 1) continue;
      const of = [...set][0];
      if (normalizar(of) !== n) (alias[proy] = alias[proy] || {})[n] = of;
    }
  }
  return alias;
}

const oficialDe = (alias, cliente, nombre) => {
  const n = normalizar(nombre);
  for (const p of [cliente, `${cliente} Oficial`]) if (alias && alias[p] && alias[p][n]) return alias[p][n];
  return nombre;
};

module.exports = { construirAlias, oficialDe, normalizar };
