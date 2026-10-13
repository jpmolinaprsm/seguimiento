// Seguimiento y Optimización · almacén en Supabase, detrás de la interfaz de base/almacen.js.
// Probado contra la base de PRUEBA el 2/10/2026 (37 casos, scratchpad del agente Recomendaciones). Paquete @supabase/supabase-js
// instalado en el package.json propio de Seguimiento (D9).
// Solo corre en el servidor, con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (variables de Railway). El navegador nunca habla con la
// base. Tablas: base/migraciones/.
const { validarRespuesta, conAutor, validarLooker } = require('./almacen.js');

const PAGINA = 1000;   // PostgREST devuelve hasta 1000 filas por pedido: se lee de a páginas
const LOTE = 500;      // filas por inserción

function crearAlmacenSupabase({ env = process.env, cliente } = {}) {
  const db = cliente || (() => {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    const { createClient } = require('@supabase/supabase-js');
    return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  })();

  const ok = ({ data, error }, que) => { if (error) throw new Error(`base de Seguimiento (${que}): ${error.message}`); return data; };
  // Lee todas las filas de una consulta, de a páginas. armar(q) agrega filtros y orden a db.from(tabla).select(...).
  async function todas(tabla, columnas, armar = (q) => q) {
    const out = [];
    for (let desde = 0; ; desde += PAGINA) {
      const filas = ok(await armar(db.from(tabla).select(columnas)).range(desde, desde + PAGINA - 1), `leer ${tabla}`);
      out.push(...filas);
      if (filas.length < PAGINA) return out;
    }
  }
  async function insertar(tabla, filas, opciones) {
    for (let i = 0; i < filas.length; i += LOTE) ok(await db.from(tabla).insert(filas.slice(i, i + LOTE), opciones), `guardar en ${tabla}`);
  }
  const filtrar = (q, { proyecto, canal } = {}) => { if (proyecto) q = q.eq('proyecto', proyecto); if (canal) q = q.eq('canal', canal); return q; };
  const fecha = (x) => (x ? String(x).slice(0, 10) : null);
  // La base devuelve las fechas con hora como "2026-09-30T17:30:41.243+00:00"; los archivos de hoy usan "...243Z" y se comparan como
  // texto (informe-semanal.js). Se devuelven siempre en el formato de los archivos.
  const iso = (x) => (x ? new Date(x).toISOString() : x);

  // ---------- recomendaciones del día ----------
  const filaRec = (f) => ({ datos_al: f.datos_al, proyecto: f.proyecto, canal: f.canal, id: f.id, generado: f.generado, tipo: f.tipo,
    titulo: f.titulo ?? null, problema: f.problema ?? null, solucion: f.solucion ?? null, campana: f.campana ?? null,
    contenidos: f.contenidos || [], conjuntos: f.conjuntos || [], revisar: f.revisar || [], regla: f.regla ?? null, fuente: f.fuente ?? null,
    plata_en_juego: f.plata_en_juego ?? null, via: f.via ?? null });

  async function guardarRecomendaciones(datosAl, filas) {
    const nuevas = filas.map((f) => filaRec({ ...f, datos_al: datosAl }));
    for (let i = 0; i < nuevas.length; i += LOTE) ok(await db.from('recomendaciones').upsert(nuevas.slice(i, i + LOTE), { onConflict: 'datos_al,proyecto,canal,id' }), 'guardar recomendaciones');
    // Las que estaban de una corrida anterior del mismo día y ya no salen se borran (hoy el archivo del día se reescribe entero).
    const quedan = new Set(nuevas.map((f) => `${f.proyecto}|${f.canal}|${f.id}`));
    const viejas = (await todas('recomendaciones', 'proyecto,canal,id', (q) => q.eq('datos_al', datosAl))).filter((f) => !quedan.has(`${f.proyecto}|${f.canal}|${f.id}`));
    for (const f of viejas) ok(await db.from('recomendaciones').delete().match({ datos_al: datosAl, proyecto: f.proyecto, canal: f.canal, id: f.id }), 'borrar recomendaciones viejas del día');
    return { guardadas: nuevas.length, borradas: viejas.length, donde: 'base: recomendaciones' };
  }
  async function leerRecomendaciones({ desde, hasta, proyecto, canal } = {}) {
    const filas = await todas('recomendaciones', '*', (q) => { q = filtrar(q, { proyecto, canal }); if (desde) q = q.gte('datos_al', desde); if (hasta) q = q.lte('datos_al', hasta); return q.order('datos_al').order('proyecto').order('canal').order('id'); });
    return filas.map((f) => ({ ...f, generado: iso(f.generado) }));
  }

  // ---------- respuestas, comentarios y tipos de campaña ----------
  async function guardarRespuesta(reg, quien) {
    const r = conAutor(reg, quien);
    const error = validarRespuesta(r, { exigirMail: true });
    if (error) return { ok: false, error };
    const autor = { autor: r.autor, autor_nombre: r.autor_nombre || null };
    if (r.clase === 'recomendacion') {
      ok(await db.from('respuestas').insert({ proyecto: r.proyecto, canal: r.canal, recomendacion_id: r.id, datos_al: fecha(r.datos_al),
        decision: r.decision, motivo: r.motivo || null, sirve: r.sirve || null, comentario: r.comentario || null,
        tipo: r.tipo || null, titulo: r.titulo || null, campana: r.campana || null, solucion: r.solucion || null, ...autor }), 'guardar respuesta');
    } else if (r.clase === 'regla') {
      ok(await db.from('comentarios').insert({ objeto: 'regla', referencia: r.regla, proyecto: r.proyecto || null, canal: r.canal || null, texto: r.comentario, ...autor }), 'guardar comentario a regla');
    } else if (r.clase === 'pantalla') {
      ok(await db.from('comentarios').insert({ objeto: 'pantalla', referencia: r.pantalla, proyecto: r.proyecto, canal: r.canal || null, texto: r.comentario && String(r.comentario).trim() ? r.comentario : null, ...autor }), 'guardar comentario de pantalla');
    } else if (r.clase === 'tipo_campana') {
      ok(await db.from('tipos_campana_cambios').insert({ proyecto: r.proyecto, canal: r.canal, campana: r.campana, tipo: r.tipo, sugerido: r.sugerido || null, ...autor }), 'guardar tipo de campaña');
    }
    return { ok: true };
  }

  // Misma forma que hoy tienen las líneas de respuestas.jsonl (lo que devuelve GET /api/respuestas).
  async function leerRespuestas({ proyecto, canal, desde } = {}) {
    const conFecha = (q, campo) => (desde ? q.gte(campo, desde) : q);
    const [resp, coms, tipos] = await Promise.all([
      todas('respuestas', '*', (q) => conFecha(filtrar(q, { proyecto, canal }), 'recibido').order('id')),
      todas('comentarios', '*', (q) => conFecha(filtrar(q.in('objeto', ['regla', 'pantalla']), { proyecto, canal }), 'creado').order('id')),
      todas('tipos_campana_cambios', '*', (q) => conFecha(filtrar(q, { proyecto, canal }), 'cambiado').order('id')),
    ]);
    const base = (x, cuando) => ({ recibido: iso(cuando), autor: x.autor, autor_nombre: x.autor_nombre || null, proyecto: x.proyecto, canal: x.canal });
    return [
      ...resp.map((x) => ({ ...base(x, x.recibido), clase: 'recomendacion', id: x.recomendacion_id, tipo: x.tipo, titulo: x.titulo, campana: x.campana, solucion: x.solucion,
        decision: x.decision, motivo: x.motivo, sirve: x.sirve, comentario: x.comentario, datos_al: x.datos_al })),
      ...coms.map((x) => (x.objeto === 'regla' ? { ...base(x, x.creado), clase: 'regla', regla: x.referencia, comentario: x.texto }
        : { ...base(x, x.creado), clase: 'pantalla', pantalla: x.referencia, comentario: x.texto })),
      ...tipos.map((x) => ({ ...base(x, x.cambiado), clase: 'tipo_campana', campana: x.campana, tipo: x.tipo, sugerido: x.sugerido })),
    ].sort((a, b) => String(a.recibido).localeCompare(String(b.recibido)));
  }
  async function leerEstados({ proyecto, canal } = {}) {
    const filas = await todas('recomendacion_estado', '*', (q) => filtrar(q, { proyecto, canal }));
    return Object.fromEntries(filas.map((x) => [x.recomendacion_id, { decision: x.decision, motivo: x.motivo, sirve: x.sirve, comentario: x.comentario, autor: x.autor, actualizado: iso(x.actualizado) }]));
  }
  async function leerComentarios({ proyecto, canal, objeto, referencia } = {}) {
    const filas = await todas('comentarios', '*', (q) => {
      if (objeto) q = q.eq('objeto', objeto);
      if (referencia) q = q.eq('referencia', referencia);
      if (proyecto) q = q.or(`proyecto.eq."${String(proyecto).replace(/"/g, '')}",and(objeto.eq.regla,proyecto.is.null)`);
      if (canal) q = q.eq('canal', canal);
      return q.order('id');
    });
    return filas.map((x) => ({ objeto: x.objeto, referencia: x.referencia, proyecto: x.proyecto, canal: x.canal, texto: x.texto, autor: x.autor, autor_nombre: x.autor_nombre, creado: iso(x.creado) }));
  }
  async function leerTiposCampana({ proyecto, canal } = {}) {
    const filas = await todas('tipos_campana', '*', (q) => filtrar(q, { proyecto, canal }));
    return Object.fromEntries(filas.map((x) => [x.campana, { tipo: x.tipo, sugerido: x.sugerido, autor: x.autor, cambiado: iso(x.cambiado) }]));
  }

  // ---------- Looker ----------
  async function guardarLooker({ proyecto, canal, url }, quien) {
    const error = validarLooker(url) || (!proyecto || !canal ? 'Falta el proyecto o el canal' : null) || (!quien || !quien.autor ? 'Falta el autor (mail de la sesión)' : null);
    if (error) return { ok: false, error };
    ok(await db.from('looker_links').upsert({ proyecto, canal, url, autor: String(quien.autor).trim().toLowerCase(), autor_nombre: quien.autorNombre || null, actualizado: new Date().toISOString() }, { onConflict: 'proyecto,canal' }), 'guardar Looker');
    return { ok: true };
  }
  async function leerLookers({ proyectos } = {}) {
    const filas = await todas('looker_links', 'proyecto,canal,url', (q) => (proyectos ? q.in('proyecto', proyectos) : q));
    return Object.fromEntries(filas.map((x) => [`${x.proyecto}|${x.canal}`, x.url]));
  }

  // ---------- lectura temprana ----------
  const COLS_LT = ['id', 'registrado', 'datos_al', 'dia5', 'canal', 'cliente', 'campana', 'cod', 'contenido', 'objetivo', 'formato', 'desde', 'metrica',
    'valor_dia5', 'gasto_dia5', 'impresiones_dia5', 'percentil_dia5', 'cuartil_dia5', 'comparables', 'referencia', 'cuenta_para_registro'];
  const filaLt = (p) => { const f = { extra: {} }; for (const [k, v] of Object.entries(p)) { if (COLS_LT.includes(k)) f[k] = v; else f.extra[k] = v; } return f; };
  // Vuelve a la forma de la línea de predicciones.jsonl: sin los campos vacíos (las anotadas antes del 1/10 no traen
  // cuenta_para_registro) y con los campos extra en su lugar. PostgREST devuelve numeric e integer como números.
  const deFilaLt = (f) => { const p = {}; for (const k of COLS_LT) if (f[k] !== null && f[k] !== undefined) p[k] = f[k]; if (p.registrado) p.registrado = iso(p.registrado); return { ...p, ...(f.extra || {}) }; };

  async function leerPredicciones() { return (await todas('lectura_temprana_predicciones', '*', (q) => q.order('registrado').order('id'))).map(deFilaLt); }
  async function agregarPredicciones(nuevas) {
    const filas = nuevas.filter((x) => x && x.id).map(filaLt);
    let n = 0;
    for (let i = 0; i < filas.length; i += LOTE) {
      const r = ok(await db.from('lectura_temprana_predicciones').upsert(filas.slice(i, i + LOTE), { onConflict: 'id', ignoreDuplicates: true }).select('id'), 'agregar predicciones');
      n += (r || []).length;
    }
    return n;
  }
  async function guardarResumenLectura(resumen) {
    ok(await db.from('lectura_temprana_resumenes').insert({ generado: resumen.generado || new Date().toISOString(), datos_al: resumen.datos_al, resumen }), 'guardar resumen de lectura temprana');
  }
  async function leerResumenLectura() {
    const r = ok(await db.from('lectura_temprana_resumenes').select('resumen').order('generado', { ascending: false }).limit(1), 'leer resumen de lectura temprana');
    return r && r[0] ? r[0].resumen : null;
  }

  // ---------- registro de actualizaciones ----------
  async function empezarActualizacion({ tipo = 'diaria', referencia = null } = {}) {
    const r = ok(await db.from('actualizaciones').insert({ tipo, referencia }).select('id'), 'registrar actualización');
    return r[0].id;
  }
  async function terminarActualizacion(id, d = {}) {
    const campos = ['resultado', 'datos_hasta', 'version', 'duracion_ms', 'filas', 'gb_bigquery', 'memoria_mb', 'error', 'detalle'];
    const cambio = Object.fromEntries(campos.filter((k) => d[k] !== undefined).map((k) => [k, d[k]]));
    ok(await db.from('actualizaciones').update({ ...cambio, termino: new Date().toISOString() }).eq('id', id), 'cerrar actualización');
  }
  async function ultimaActualizacion({ tipo, resultado } = {}) {
    let q = db.from('actualizaciones').select('*');
    if (tipo) q = q.eq('tipo', tipo);
    if (resultado) q = q.eq('resultado', resultado);
    const r = ok(await q.order('empezo', { ascending: false }).limit(1), 'leer última actualización');
    return r && r[0] ? r[0] : null;
  }

  // ---------- nexo (misma interfaz que nexo/repositorio.js, con promesa) ----------
  const estadoDe = (f) => ({ ...(f.detalle || {}), estado: f.estado });
  const conUltimo = async (sols) => {
    if (!sols.length) return [];
    const ult = await todas('nexo_ultimo_estado', 'solicitud_id,estado,detalle', (q) => q.in('solicitud_id', sols.map((s) => s.id)));
    const porId = new Map(ult.map((u) => [u.solicitud_id, estadoDe(u)]));
    return sols.map((s) => ({ solicitud: s.solicitud, ultimo: porId.get(s.id) || null }));
  };
  const nexo = {
    async guardarSolicitud(s) {
      if (!s || !s.id) throw new Error('repositorio nexo: la solicitud necesita id');
      const r = ok(await db.from('nexo_solicitudes').upsert({ id: s.id, creada: s.creada || null, version: s.version || null, recomendacion_id: s.recomendacion || null,
        regla: s.regla || null, proyecto: s.proyecto, canal: s.canal, plataforma: s.plataforma || null, accion: s.accion || null, pedida_por: s.pedida_por || null, solicitud: s },
      { onConflict: 'id', ignoreDuplicates: true }).select('id'), 'guardar solicitud');
      return (r || []).length > 0;   // false si ese id ya estaba
    },
    async guardarEstado(id, estado) {
      const { estado: e, ...detalle } = estado || {};
      ok(await db.from('nexo_estados').insert({ solicitud_id: id, estado: e, detalle }), 'guardar estado de solicitud');
    },
    async leerSolicitud(id) {
      const r = ok(await db.from('nexo_solicitudes').select('solicitud').eq('id', id).limit(1), 'leer solicitud');
      return r && r[0] ? r[0].solicitud : null;
    },
    async leerEstados(id) { return (await todas('nexo_estados', 'estado,detalle', (q) => q.eq('solicitud_id', id).order('id'))).map(estadoDe); },
    async ultimoEstado(id) {
      const r = ok(await db.from('nexo_ultimo_estado').select('estado,detalle').eq('solicitud_id', id).limit(1), 'leer último estado');
      return r && r[0] ? estadoDe(r[0]) : null;
    },
    async historial() { return conUltimo(await todas('nexo_solicitudes', 'id,solicitud', (q) => q.order('creada'))); },
    async porRecomendacion(recId) { return conUltimo(await todas('nexo_solicitudes', 'id,solicitud', (q) => q.eq('recomendacion_id', recId).order('creada'))); },
  };

  return {
    tipo: 'supabase',
    guardarRecomendaciones, leerRecomendaciones,
    guardarRespuesta, leerRespuestas, leerEstados, leerComentarios, leerTiposCampana,
    guardarLooker, leerLookers,
    leerPredicciones, agregarPredicciones, guardarResumenLectura, leerResumenLectura,
    empezarActualizacion, terminarActualizacion, ultimaActualizacion,
    nexo,
  };
}

module.exports = { crearAlmacenSupabase };
