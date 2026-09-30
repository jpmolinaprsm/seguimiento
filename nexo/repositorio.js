// Nexo con PAUTADOR (lado Seguimiento) · dónde quedan las solicitudes y sus estados.
// Interfaz chica para que después se cambie a la base (PLAN-RAILWAY, sección 3: "Solicitudes a PAUTADOR → tabla con id único")
// sin tocar lo demás. Hoy: un archivo en app/repositorio/nexo/ que solo se agrega (una línea por solicitud y una por cada estado).
//
// Interfaz (cualquier reemplazo tiene que cumplirla):
//   guardarSolicitud(solicitud)      → false si ese id ya estaba (no se duplica)
//   guardarEstado(id, estado)        → agrega un estado ({ estado, motivo?, error?, valores?, ... })
//   leerSolicitud(id)                → la solicitud o null
//   leerEstados(id)                  → todos los estados de esa solicitud, del más viejo al más nuevo
//   ultimoEstado(id)                 → el último estado o null
//   historial()                      → [{ solicitud, ultimo }] de todas (lo usa el control "un cambio por conjunto cada 3 días")
//   porRecomendacion(recId)          → [{ solicitud, ultimo }] de una recomendación (para que Interfaz muestre el estado)
const fs = require('fs');
const path = require('path');

const CARPETA_POR_DEFECTO = path.join(__dirname, '..', 'app', 'repositorio', 'nexo');

function crearRepositorioArchivo({ carpeta = CARPETA_POR_DEFECTO, reloj = () => new Date() } = {}) {
  const archivo = path.join(carpeta, 'solicitudes.jsonl');
  const leer = () => {
    let txt = '';
    try { txt = fs.readFileSync(archivo, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    return txt.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  };
  const agregar = (obj) => { fs.mkdirSync(carpeta, { recursive: true }); fs.appendFileSync(archivo, JSON.stringify({ guardado: reloj().toISOString(), ...obj }) + '\n'); };
  const armar = () => {
    const sols = new Map(), estados = new Map();
    for (const l of leer()) {
      if (l.clase === 'solicitud' && l.solicitud && !sols.has(l.solicitud.id)) sols.set(l.solicitud.id, l.solicitud);
      if (l.clase === 'estado' && l.id) { if (!estados.has(l.id)) estados.set(l.id, []); estados.get(l.id).push(l.estado); }
    }
    return { sols, estados };
  };
  const conUltimo = ({ sols, estados }, filtro) => [...sols.values()].filter(filtro).map((s) => { const e = estados.get(s.id) || []; return { solicitud: s, ultimo: e[e.length - 1] || null }; });

  return {
    archivo,
    guardarSolicitud(s) {
      if (!s || !s.id) throw new Error('repositorio nexo: la solicitud necesita id');
      if (armar().sols.has(s.id)) return false;
      agregar({ clase: 'solicitud', solicitud: s });
      return true;
    },
    guardarEstado(id, estado) { agregar({ clase: 'estado', id, estado }); },
    leerSolicitud(id) { return armar().sols.get(id) || null; },
    leerEstados(id) { return armar().estados.get(id) || []; },
    ultimoEstado(id) { const e = armar().estados.get(id) || []; return e[e.length - 1] || null; },
    historial() { return conUltimo(armar(), () => true); },
    porRecomendacion(recId) { return conUltimo(armar(), (s) => s.recomendacion === recId); },
  };
}

module.exports = { crearRepositorioArchivo, CARPETA_POR_DEFECTO };
