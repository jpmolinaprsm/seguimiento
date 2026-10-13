// Seguimiento y Optimización · almacén en archivos: lo de hoy, detrás de la interfaz de base/almacen.js.
// Mismos archivos y mismo formato de línea que hoy, para que nada de lo que ya lee app/repositorio/ (informe de los lunes, reglas
// vigentes) cambie:
//   repositorio/recomendaciones/AAAA-MM-DD.jsonl    (hoy lo escribe app/redaccion.js)
//   repositorio/respuestas.jsonl                     (hoy lo escribe app/servir.js; suma la clase "pantalla")
//   repositorio/lectura-temprana/predicciones.jsonl y resumen.json   (hoy borrador/lectura-temprana.js)
//   repositorio/nexo/solicitudes.jsonl               (nexo/repositorio.js, que se usa tal cual)
//   repositorio/looker.json, repositorio/actualizaciones.jsonl       (nuevos: hoy no existen)
// En esta computadora queda como respaldo; en Railway se usa el de Supabase.
const fs = require('fs');
const path = require('path');
const { validarRespuesta, conAutor, validarLooker } = require('./almacen.js');

const REPO_POR_DEFECTO = path.join(__dirname, '..', 'app', 'repositorio');

const leerJsonl = (f) => { let t = ''; try { t = fs.readFileSync(f, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; } return t.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); };
const leerJson = (f, siNo) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return siNo; throw e; } };
const agregarJsonl = (f, objs) => { if (!objs.length) return; fs.mkdirSync(path.dirname(f), { recursive: true }); fs.appendFileSync(f, objs.map((o) => JSON.stringify(o)).join('\n') + '\n'); };
const dentro = (x, { proyecto, canal, desde } = {}, campoFecha = 'recibido') => (!proyecto || x.proyecto === proyecto) && (!canal || x.canal === canal) && (!desde || String(x[campoFecha] || '') >= desde);

function crearAlmacenArchivo({ carpeta = REPO_POR_DEFECTO, reloj = () => new Date() } = {}) {
  const F = {
    recs: path.join(carpeta, 'recomendaciones'),
    respuestas: path.join(carpeta, 'respuestas.jsonl'),
    lt: path.join(carpeta, 'lectura-temprana'),
    looker: path.join(carpeta, 'looker.json'),
    actualizaciones: path.join(carpeta, 'actualizaciones.jsonl'),
    nexo: path.join(carpeta, 'nexo'),
  };
  const ahora = () => reloj().toISOString();
  const respuestas = (filtro) => leerJsonl(F.respuestas).filter((x) => dentro(x, filtro));

  // Nexo: el repositorio de archivo del Nexo, tal cual, envuelto en promesas.
  const repoNexo = require('../nexo/repositorio.js').crearRepositorioArchivo({ carpeta: F.nexo, reloj });
  const nexo = Object.fromEntries(['guardarSolicitud', 'guardarEstado', 'leerSolicitud', 'leerEstados', 'ultimoEstado', 'historial', 'porRecomendacion']
    .map((m) => [m, async (...a) => repoNexo[m](...a)]));

  return {
    tipo: 'archivo',
    carpeta,

    async guardarRecomendaciones(datosAl, filas) {
      fs.mkdirSync(F.recs, { recursive: true });
      fs.writeFileSync(path.join(F.recs, `${datosAl}.jsonl`), filas.map((f) => JSON.stringify(f)).join('\n') + '\n');
      return { guardadas: filas.length, donde: `repositorio/recomendaciones/${datosAl}.jsonl` };
    },
    async leerRecomendaciones({ desde, hasta, proyecto, canal } = {}) {
      let archivos = [];
      try { archivos = fs.readdirSync(F.recs).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort(); } catch (e) { /* vacío */ }
      return archivos.filter((f) => (!desde || f.slice(0, 10) >= desde) && (!hasta || f.slice(0, 10) <= hasta))
        .flatMap((f) => leerJsonl(path.join(F.recs, f))).filter((x) => dentro(x, { proyecto, canal }));
    },

    async guardarRespuesta(reg, quien) {
      const r = conAutor(reg, quien);
      const error = validarRespuesta(r);
      if (error) return { ok: false, error };
      agregarJsonl(F.respuestas, [{ recibido: ahora(), ...r }]);
      return { ok: true };
    },
    async leerRespuestas(filtro = {}) { return respuestas(filtro); },
    async leerEstados({ proyecto, canal } = {}) {
      const out = {};
      for (const x of respuestas({ proyecto, canal })) if (x.clase === 'recomendacion' && x.id) out[x.id] = { decision: x.decision, motivo: x.motivo || null, sirve: x.sirve || null, comentario: x.comentario || null, autor: x.autor || null, actualizado: x.recibido };
      return out;
    },
    async leerComentarios({ proyecto, canal, objeto, referencia } = {}) {
      const out = [], previo = {};
      for (const x of respuestas({})) {
        let c = null;
        if (x.clase === 'regla') c = { objeto: 'regla', referencia: x.regla, texto: x.comentario };
        if (x.clase === 'pantalla') c = { objeto: 'pantalla', referencia: x.pantalla, texto: x.comentario || null };
        if (x.clase === 'recomendacion') {   // igual que el trigger de la base: solo cuando el comentario de la tarjeta cambió
          const k = `${x.proyecto}|${x.canal}|${x.id}`;
          if (x.comentario && String(x.comentario).trim() && x.comentario !== previo[k]) c = { objeto: 'recomendacion', referencia: x.id, texto: x.comentario };
          previo[k] = x.comentario || null;
        }
        if (c) out.push({ ...c, proyecto: x.proyecto || null, canal: x.canal || null, autor: x.autor || null, creado: x.recibido });
      }
      return out.filter((c) => (!objeto || c.objeto === objeto) && (!referencia || c.referencia === referencia)
        && (!proyecto || c.proyecto === proyecto || (c.objeto === 'regla' && !c.proyecto)) && (!canal || c.canal === canal));
    },
    async leerTiposCampana({ proyecto, canal } = {}) {
      const out = {};
      for (const x of respuestas({ proyecto, canal })) if (x.clase === 'tipo_campana' && x.campana) out[x.campana] = { tipo: x.tipo, sugerido: x.sugerido || null, autor: x.autor || null, cambiado: x.recibido };
      return out;
    },

    async guardarLooker({ proyecto, canal, url }, quien) {
      const error = validarLooker(url) || (!proyecto || !canal ? 'Falta el proyecto o el canal' : null);
      if (error) return { ok: false, error };
      const todo = leerJson(F.looker, {});
      todo[`${proyecto}|${canal}`] = { url, autor: (quien && quien.autor) || null, actualizado: ahora() };
      fs.mkdirSync(carpeta, { recursive: true });
      fs.writeFileSync(F.looker, JSON.stringify(todo, null, 1));
      return { ok: true };
    },
    async leerLookers({ proyectos } = {}) {
      const todo = leerJson(F.looker, {});
      return Object.fromEntries(Object.entries(todo).filter(([k]) => !proyectos || proyectos.includes(k.split('|')[0])).map(([k, v]) => [k, v.url]));
    },

    async leerPredicciones() { return leerJsonl(path.join(F.lt, 'predicciones.jsonl')); },
    async agregarPredicciones(nuevas) {
      const ya = new Set(leerJsonl(path.join(F.lt, 'predicciones.jsonl')).map((x) => x.id));
      const sirven = nuevas.filter((x) => x && x.id && !ya.has(x.id));
      agregarJsonl(path.join(F.lt, 'predicciones.jsonl'), sirven);
      return sirven.length;
    },
    async guardarResumenLectura(resumen) { fs.mkdirSync(F.lt, { recursive: true }); fs.writeFileSync(path.join(F.lt, 'resumen.json'), JSON.stringify(resumen, null, 1)); },
    async leerResumenLectura() { return leerJson(path.join(F.lt, 'resumen.json'), null); },

    // Registro de actualizaciones: una línea al empezar y otra al terminar con el mismo id; al leer vale la última.
    async empezarActualizacion({ tipo = 'diaria', referencia = null } = {}) {
      const id = `${Date.now()}-${process.pid}`;
      agregarJsonl(F.actualizaciones, [{ id, tipo, referencia, empezo: ahora(), resultado: 'en_curso' }]);
      return id;
    },
    async terminarActualizacion(id, datos = {}) {
      const previa = leerJsonl(F.actualizaciones).filter((x) => x.id === id).pop() || { id };
      agregarJsonl(F.actualizaciones, [{ ...previa, ...datos, id, termino: ahora() }]);
    },
    async ultimaActualizacion({ tipo, resultado } = {}) {
      const porId = new Map();
      for (const x of leerJsonl(F.actualizaciones)) porId.set(x.id, x);
      return [...porId.values()].filter((x) => (!tipo || x.tipo === tipo) && (!resultado || x.resultado === resultado)).pop() || null;
    },

    nexo,
  };
}

module.exports = { crearAlmacenArchivo, REPO_POR_DEFECTO };
