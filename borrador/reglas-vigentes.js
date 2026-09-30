// Reglas vigentes para mostrar en la app (pantalla de reglas que ven y comentan los implementadores).
// Dueño: agente de Recomendaciones. Una sola fuente: la tabla C de Seguimiento/documentos/reglas-recomendador-v0.3.md.
// Este archivo la lee y le suma lo que ya está en el código (el detalle "Cómo lo detectamos" de app/redaccion.js y si la acción
// puede ir por PAUTADOR según nexo/solicitud.js), así no hay que mantener dos copias de las reglas.
// Además compara el documento con el código (nombre y prioridad de cada regla en borrador/reglas/) y avisa si no coinciden.
//
// Uso:
//   require('./reglas-vigentes').reglasVigentes()   → { version, fecha, reglas: [...], notas: [...], en_observacion: [...], avisos: [...] }
//     notas: la lista "Para la app" del final de la sección C (texto para el implementador; las "Notas:" internas no salen).
//     en_observacion: la lista "En observación en la app" de la sección C, [{ nombre, regla }] (regla = una frase de qué hace);
//     se compara con lo que la sección F marca "En observación".
//   node borrador/reglas-vigentes.js                → escribe app/repositorio/reglas-vigentes.json y muestra los avisos
// Solo lee: no toca la app ni otros archivos.
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DOC = path.join(RAIZ, 'documentos', 'reglas-recomendador-v0.3.md');
const SALIDA = path.join(RAIZ, 'app', 'repositorio', 'reglas-vigentes.json');
const ARCHIVOS_REGLAS = { Meta: 'borrador/reglas/meta.js', Todas: 'borrador/reglas/generales.js' };

const limpiar = (t) => String(t || '').replace(/\*\*/g, '').replace(/`/g, '').trim();

// Tabla C y sus notas, tal cual están en el documento.
function leerDocumento(txt) {
  const ini = txt.indexOf('## C.');
  const fin = txt.indexOf('\n## ', ini + 5);
  if (ini < 0) throw new Error('reglas vigentes: no encuentro la sección C en el documento');
  const sec = txt.slice(ini, fin < 0 ? undefined : fin);
  const reglas = [];
  for (const l of sec.split('\n')) {
    const m = l.match(/^\|\s*(C\d+)\s*\|(.*)\|\s*$/);
    if (!m) continue;
    const [nombre, cuando, propone, prioridad, plataformas] = m[2].split('|').map(limpiar);
    reglas.push({ id: m[1], nombre, cuando, propone, prioridad: Number(prioridad.replace(',', '.')), plataformas: plataformas === 'Todas' ? ['Todas'] : plataformas.split(/,\s*|\s+y\s+/) });
  }
  // Lo que sale a la pantalla son dos listas escritas para el implementador, al final de la sección C. Las "Notas:" de arriba son
  // internas (con referencias al documento y al contrato) y se quedan solo en el documento.
  const lista = (titulo) => {
    const i = sec.indexOf(titulo);
    if (i < 0) return [];
    const out = [];
    for (const l of sec.slice(i).split('\n').slice(1)) {
      if (/^- /.test(l)) out.push(limpiar(l.slice(2)));
      else if (out.length && l.trim() === '') break;
      else if (out.length) break;
    }
    return out;
  };
  const notas = lista('Para la app');
  const en_observacion = lista('En observación en la app').map((l) => {
    const i = l.indexOf(':');
    return i < 0 ? { nombre: l, regla: '' } : { nombre: l.slice(0, i).trim(), regla: l.slice(i + 1).trim().replace(/^./, (x) => x.toUpperCase()) };
  });
  // Qué marca la sección F como "En observación" (para avisar si la lista de la app se desactualiza).
  const iF = txt.indexOf('## F.'), fF = txt.indexOf('\n## ', iF + 5);
  const enF = iF < 0 ? [] : txt.slice(iF, fF < 0 ? undefined : fF).split('\n').map((l) => l.match(/^\|([^|]+)\|[^|]+\|\s*\*\*En observación\*\*/)).filter(Boolean).map((m) => limpiar(m[1]));
  const fecha = (txt.match(/^Fecha:\s*([0-9/]+)/m) || [])[1] || null;
  return { reglas, notas, en_observacion, enF, fecha };
}

// Las notas por regla del nexo a veces citan el documento ("reglas v0.3, D6"): en pantalla no van referencias internas.
const sinReferencias = (t) => (t == null ? t : String(t).replace(/\s*\((?:reglas )?v0\.\d[^)]*\)/g, '').replace(/\s*\(sección [A-Z]\d*\)/g, ''));

// Qué dice el código de cada regla: si existe con ese nombre y con qué prioridad (lectura del texto, no se ejecuta nada).
function prioridadEnCodigo(nombre) {
  const e = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const rel of Object.values(ARCHIVOS_REGLAS)) {
    let src = '';
    try { src = fs.readFileSync(path.join(RAIZ, rel), 'utf8'); } catch (err) { continue; }
    let m = src.match(new RegExp(`tipo: '${e}'[^\\n]*?prioridad: ([\\d.]+)`));
    if (m) return { archivo: rel, prioridad: Number(m[1]) };
    // Apagón y Pico (generales.js): "pk.estado === 'Apagón' ? 2.5 : 1.8"; el segundo número es el de Pico
    m = src.match(/=== 'Apagón' \? ([\d.]+) : ([\d.]+)/);
    if (m && (nombre === 'Apagón' || nombre === 'Pico')) return { archivo: rel, prioridad: Number(nombre === 'Apagón' ? m[1] : m[2]) };
    if (src.includes(`'${nombre}'`)) return { archivo: rel, prioridad: null };
  }
  return null;
}

function reglasVigentes() {
  const { reglas, notas, en_observacion, enF, fecha } = leerDocumento(fs.readFileSync(DOC, 'utf8'));
  let REGLA = {};
  try { REGLA = require('../app/redaccion.js').REGLA || {}; } catch (e) { /* sin detalle */ }
  let nexo = null;
  try { nexo = require('../nexo/solicitud.js'); } catch (e) { /* sin nexo */ }
  const avisos = [];
  const salida = reglas.map((r) => {
    const cod = prioridadEnCodigo(r.nombre);
    if (!cod) avisos.push(`${r.id} "${r.nombre}": está en el documento y no la encuentro en el código.`);
    else if (cod.prioridad != null && cod.prioridad !== r.prioridad) avisos.push(`${r.id} "${r.nombre}": el documento dice prioridad ${r.prioridad} y el código ${cod.prioridad}.`);
    let pautador = { va: false, accion: null, nota: 'Se hace a mano.' };
    if (nexo && nexo.ENCAJAN[r.nombre]) pautador = { va: true, accion: nexo.ENCAJAN[r.nombre].accion, nota: sinReferencias(nexo.ENCAJAN[r.nombre].nota) || null };
    else if (nexo && nexo.NO_ENCAJAN[r.nombre]) pautador = { va: false, accion: null, nota: sinReferencias(nexo.NO_ENCAJAN[r.nombre]) };
    return {
      id: r.id,
      nombre: r.nombre,
      cuando: r.cuando,                       // cuándo se dispara
      propone: r.propone,                     // qué propone
      prioridad: r.prioridad,                 // más alto = más arriba en la bandeja
      plataformas: r.plataformas,
      estado: 'Funciona',                     // la sección C es "Reglas que la app aplica hoy"
      como_lo_detectamos: REGLA[r.nombre] || null,
      pautador,                               // si la acción puede pedirse a PAUTADOR (Pausar o Cambiar presupuesto, solo Meta)
      archivo: cod ? cod.archivo : null,
      comentar: { clase: 'regla', regla: r.id }, // cómo se guarda un comentario (ver informe del 30/09 en la bitácora)
    };
  });
  if (!notas.length) avisos.push('No encuentro la lista "Para la app" al final de la sección C: la pantalla queda sin notas.');
  const nombresObs = en_observacion.map((o) => o.nombre);
  for (const n of enF) if (!nombresObs.includes(n)) avisos.push(`"${n}" está en observación en la sección F y no en la lista "En observación en la app" de la sección C.`);
  for (const n of nombresObs) if (!enF.includes(n)) avisos.push(`"${n}" está en la lista "En observación en la app" y la sección F no la marca en observación.`);
  return { version: 'v0.3', fecha, fuente: 'Seguimiento/documentos/reglas-recomendador-v0.3.md, sección C', generado: new Date().toISOString(), reglas: salida, notas, en_observacion, avisos };
}

module.exports = { reglasVigentes, leerDocumento };

if (require.main === module) {
  const r = reglasVigentes();
  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  fs.writeFileSync(SALIDA, JSON.stringify(r, null, 1) + '\n');
  console.log(`reglas vigentes: ${r.reglas.length} reglas → ${path.relative(RAIZ, SALIDA)}`);
  for (const a of r.avisos) console.log('  aviso: ' + a);
  if (!r.avisos.length) console.log('  documento y código coinciden en nombre y prioridad');
}
