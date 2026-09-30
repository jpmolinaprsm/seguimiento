// Informe semanal de Seguimiento para la sesión de aprendizaje de los lunes (una sola sesión con PAUTADOR, con Juan Pablo).
// Dueño: agente de Recomendaciones. Regla E7 de Seguimiento/documentos/reglas-recomendador-v0.3.md; flujo en
// orquestacion/FLUJO-OPERATIVO.md (paso 4, "Aprender").
//
// Lee solo el repositorio de la app (no consulta BigQuery ni Meta, no toca la app):
//   app/repositorio/recomendaciones/AAAA-MM-DD.jsonl   lo que generó el agente cada día (lo escribe app/redaccion.js)
//   app/repositorio/respuestas.jsonl                    lo que respondió el equipo (lo escribe app/servir.js, /api/respuesta)
//   app/repositorio/lectura-temprana/resumen.json       lectura temprana al día 5, en observación
//   app/repositorio/nexo/solicitudes.jsonl              cambios pedidos a PAUTADOR y su estado (si existe; lo escribe el Nexo)
//   app/repositorio/reglas-vigentes.json                o, si no está, la tabla C del documento (borrador/reglas-vigentes.js)
// Escribe app/repositorio/informes-lunes/AAAA-MM-DD.md (fecha del lunes de la sesión) y el mismo contenido en .json.
//
// Uso:  node borrador/informe-semanal.js [--hasta AAAA-MM-DD] [--repo carpeta] [--salida carpeta]
//   --hasta   último día de la semana que se mira (por defecto, ayer). La semana son los 7 días que terminan ahí.
//   --repo    carpeta del repositorio (por defecto app/repositorio). Sirve para probar con datos de mentira.
// Funciona con el repositorio vacío: cada sección dice que no hay datos todavía.
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DIA = 864e5;
const ESTADO = { recibida: 'recibida', rechazada_validacion: 'rechazada por validación', rechazada_persona: 'rechazada por una persona', pendiente_aprobacion: 'pendiente de aprobación', aprobada: 'aprobada', aplicada: 'aplicada', fallo: 'falló' };
const estadoTxt = (e) => ESTADO[e] || String(e || 'sin estado').replace(/_/g, ' ');

// Umbrales del informe (solo deciden qué se PROPONE en la sesión, no qué recomienda la app). Provisorios: los confirma Juan Pablo.
const SILENCIAR_DESCARTES = 3;      // E4: 3 descartes "Decisión del cliente" de la misma regla en el mismo proyecto
const MIN_DECISIONES = 5;           // mínimo de decisiones de una regla para sacar conclusiones
const PROPORCION_ALERTA = 0.5;      // la mitad o más descartadas por "No aplica" / "El dato está mal", o "¿sirve? No"
const MIN_MISMO_MOTIVO_MANO = 3;    // "hecha a mano" con el mismo motivo 3 veces en la misma regla
const VENTANA_TENDENCIA = 28;       // días hacia atrás para esas proporciones (una semana sola tiene muy pocos casos)

// ---------- utilidades ----------
const arg = (n, def) => { const i = process.argv.indexOf('--' + n); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def; };
const aDia = (d) => new Date(d).toISOString().slice(0, 10);
const sumar = (dia, n) => aDia(new Date(dia + 'T12:00:00Z').getTime() + n * DIA);
const diaArg = (iso) => aDia(new Date(iso).getTime() - 3 * 3600e3); // hora argentina
const dmy = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '—');
const dec = (x) => String(x).replace('.', ',');
const pct = (a, b) => (b ? Math.round((a / b) * 100) + ' %' : '—');
const leerJsonl = (f) => { let t = ''; try { t = fs.readFileSync(f, 'utf8'); } catch (e) { return []; } return t.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); };
const leerJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const contar = (arr, fn) => arr.reduce((m, x) => { const k = fn(x); if (k != null) m[k] = (m[k] || 0) + 1; return m; }, {});
const tabla = (cab, filas) => (filas.length ? [`| ${cab.join(' | ')} |`, `|${cab.map(() => '---').join('|')}|`, ...filas.map((f) => `| ${f.map((x) => String(x == null ? '—' : x).replace(/\|/g, '/').replace(/\n/g, ' ')).join(' | ')} |`)].join('\n') : '');

// ---------- lectura ----------
function leerRepositorio(repo) {
  const recs = new Map();   // id → { ...rec, primera, ultima }
  const carpetaRecs = path.join(repo, 'recomendaciones');
  let archivos = [];
  try { archivos = fs.readdirSync(carpetaRecs).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort(); } catch (e) { /* vacío */ }
  const porDia = {};
  for (const f of archivos) {
    const dia = f.slice(0, 10);
    const ls = leerJsonl(path.join(carpetaRecs, f));
    porDia[dia] = ls;
    for (const r of ls) { const v = recs.get(r.id); recs.set(r.id, { ...r, primera: v ? v.primera : dia, ultima: dia }); }
  }
  const respuestas = leerJsonl(path.join(repo, 'respuestas.jsonl'));
  const lt = leerJson(path.join(repo, 'lectura-temprana', 'resumen.json'));
  let nexo = [];
  if (fs.existsSync(path.join(repo, 'nexo', 'solicitudes.jsonl'))) {
    try {
      const r = require('../nexo/repositorio.js').crearRepositorioArchivo({ carpeta: path.join(repo, 'nexo') });
      nexo = r.historial().map((h) => ({ ...h, estados: r.leerEstados(h.solicitud.id) }));
    } catch (e) { nexo = { error: e.message }; }
  }
  let reglas = leerJson(path.join(repo, 'reglas-vigentes.json'));
  if (!reglas) try { reglas = require('./reglas-vigentes.js').reglasVigentes(); } catch (e) { reglas = { reglas: [] }; }
  return { recs, porDia, respuestas, lt, nexo, reglas };
}

// Última decisión de cada recomendación hasta el día "hasta" (el repositorio guarda una línea por cada cambio).
function decisiones(respuestas, hasta) {
  const ult = new Map();
  for (const r of respuestas) {
    if ((r.clase && r.clase !== 'recomendacion') || !r.id) continue;
    const dia = diaArg(r.recibido || r.fecha || Date.now());
    if (dia > hasta) continue;
    const v = ult.get(r.id);
    if (!v || (r.recibido || '') >= (v.recibido || '')) ult.set(r.id, { ...r, dia, primera: v ? v.primera : dia });
  }
  return [...ult.values()];
}

// ---------- informe ----------
function armarInforme({ repo, hasta }) {
  const desde = sumar(hasta, -6);
  let lunes = sumar(hasta, 1); while (new Date(lunes + 'T12:00:00Z').getUTCDay() !== 1) lunes = sumar(lunes, 1); // próximo lunes
  const dentro = (d) => d >= desde && d <= hasta;
  const { recs, porDia, respuestas, lt, nexo, reglas } = leerRepositorio(repo);
  const reglaDe = {}; for (const r of reglas.reglas || []) reglaDe[r.nombre] = r.id;
  const nomRegla = (tipo) => (reglaDe[tipo] ? `${reglaDe[tipo]} ${tipo}` : tipo || 'Sin regla');
  const recDe = (id) => recs.get(id) || {};

  const decs = decisiones(respuestas, hasta);
  const decsSemana = decs.filter((d) => dentro(d.dia));
  const decsVentana = decs.filter((d) => d.dia >= sumar(hasta, -(VENTANA_TENDENCIA - 1)));
  const recsSemana = [...recs.values()].filter((r) => Object.keys(porDia).some((d) => dentro(d) && porDia[d].some((x) => x.id === r.id)));
  const nuevasSemana = recsSemana.filter((r) => dentro(r.primera));
  const comentariosRegla = respuestas.filter((r) => r.clase === 'regla' && dentro(diaArg(r.recibido || r.fecha || 0)));
  const tiposCampana = respuestas.filter((r) => r.clase === 'tipo_campana' && dentro(diaArg(r.recibido || 0)));
  const esDesc = (d) => d.decision === 'descartada', esMano = (d) => d.decision === 'hecha a mano', esEnv = (d) => d.decision === 'enviada a PAUTADOR';
  const tipoDe = (d) => d.tipo || recDe(d.id).tipo;
  const proyDe = (d) => d.proyecto || recDe(d.id).proyecto || '—';

  const S = [];      // secciones en markdown
  const datos = { semana: { desde, hasta, lunes } };
  const vacio = (txt) => `_${txt}_`;

  // 0. Resumen
  const cuentaDec = contar(decsSemana, (d) => d.decision);
  datos.resumen = { generadas: recsSemana.length, nuevas: nuevasSemana.length, respondidas: decsSemana.length, por_decision: cuentaDec, comentarios_a_reglas: comentariosRegla.length };
  S.push((`## 1. Resumen de la semana\n\n` +
    `- Recomendaciones que mostró la app: **${recsSemana.length}** (${nuevasSemana.length} aparecieron por primera vez esta semana). Días con datos guardados: ${Object.keys(porDia).filter(dentro).map(dmy).join(', ') || 'ninguno'}.\n` +
    `- Decisiones del equipo: **${decsSemana.length}** — enviadas a PAUTADOR ${cuentaDec['enviada a PAUTADOR'] || 0}, hechas a mano ${cuentaDec['hecha a mano'] || 0}, descartadas ${cuentaDec['descartada'] || 0}, sin decidir (solo opinión o comentario) ${cuentaDec['pendiente'] || 0}.\n` +
    `- Comentarios a las reglas vigentes: **${comentariosRegla.length}**. Tipos de campaña confirmados: **${tiposCampana.length}**.\n` +
    (respuestas.length ? '' : `- ${vacio('El repositorio de respuestas está vacío: todavía nadie respondió recomendaciones desde la app abierta por el servidor local. Las secciones de abajo se llenan solas cuando haya respuestas.')}`)).trimEnd());

  // 2. Por regla
  const porTipo = {};
  for (const r of recsSemana) (porTipo[r.tipo] = porTipo[r.tipo] || { gen: 0, env: 0, mano: 0, desc: 0, si: 0, no: 0, falta: 0 }).gen++;
  for (const d of decsSemana) { const t = porTipo[tipoDe(d)] = porTipo[tipoDe(d)] || { gen: 0, env: 0, mano: 0, desc: 0, si: 0, no: 0, falta: 0 };
    if (esEnv(d)) t.env++; if (esMano(d)) t.mano++; if (esDesc(d)) t.desc++;
    if (/^s[ií]/i.test(d.sirve || '')) t.si++; else if (/^no/i.test(d.sirve || '')) t.no++; else if (/falta/i.test(d.sirve || '')) t.falta++; }
  const filasTipo = Object.entries(porTipo).sort((a, b) => (reglaDe[a[0]] || 'Z').localeCompare(reglaDe[b[0]] || 'Z', 'es', { numeric: true }))
    .map(([k, t]) => [nomRegla(k), t.gen, t.env, t.mano, t.desc, pct(t.env + t.mano + t.desc, t.gen), `${t.si} / ${t.no} / ${t.falta}`]);
  datos.por_regla = porTipo;
  S.push(`## 2. Cómo le fue a cada regla\n\nCuántas mostró la app en la semana y qué hizo el equipo con ellas. "¿Sirve?" es Sí / No / Falta un dato.\n\n` +
    (filasTipo.length ? tabla(['Regla', 'Mostradas', 'Enviadas a PAUTADOR', 'Hechas a mano', 'Descartadas', 'Respondidas', '¿Sirve? Sí / No / Falta'], filasTipo) : vacio('Sin recomendaciones guardadas en la semana.')));

  // 3. Descartes con motivo
  const desc = decsSemana.filter(esDesc);
  const filasDesc = Object.entries(contar(desc, (d) => `${nomRegla(tipoDe(d))}§${d.motivo || 'Sin motivo'}`)).sort((a, b) => b[1] - a[1]).map(([k, n]) => [...k.split('§'), n]);
  const detalleDesc = desc.map((d) => [nomRegla(tipoDe(d)), proyDe(d), d.canal || recDe(d.id).canal || '—', d.campana || recDe(d.id).campana || '—', d.motivo || 'Sin motivo', d.comentario || '', d.autor || '—', dmy(d.dia)]);
  datos.descartes = desc;
  S.push(`## 3. Descartes y su motivo\n\n` + (desc.length ? `${tabla(['Regla', 'Motivo', 'Veces'], filasDesc)}\n\nDetalle:\n\n${tabla(['Regla', 'Proyecto', 'Canal', 'Campaña', 'Motivo', 'Comentario', 'Quién', 'Día'], detalleDesc)}` : vacio('No hubo descartes en la semana.')) +
    (desc.some((d) => !d.motivo) ? `\n\nAviso: ${desc.filter((d) => !d.motivo).length} descartes llegaron sin motivo (el motivo es obligatorio desde el 30/09).` : ''));

  // 4. Hechas a mano
  const mano = decsSemana.filter(esMano);
  const detalleMano = mano.map((d) => [nomRegla(tipoDe(d)), proyDe(d), d.campana || recDe(d.id).campana || '—', d.motivo || 'Sin motivo', d.comentario || '', d.autor || '—', dmy(d.dia)]);
  datos.hechas_a_mano = mano;
  S.push(`## 4. Hechas a mano y su motivo\n\n` + (mano.length ? tabla(['Regla', 'Proyecto', 'Campaña', 'Motivo', 'Comentario', 'Quién', 'Día'], detalleMano) : vacio('No hubo recomendaciones marcadas como hechas a mano en la semana.')) +
    (mano.some((d) => !d.motivo) ? `\n\nAviso: ${mano.filter((d) => !d.motivo).length} "hechas a mano" llegaron sin motivo. Hasta que la app lo pida (pendiente de Interfaz), es lo esperable.` : ''));

  // 5. Comentarios a reglas vigentes y a recomendaciones
  const nombreReglaId = (id) => { const r = (reglas.reglas || []).find((x) => x.id === id); return r ? `${id} ${r.nombre}` : id || '—'; };
  const comRec = decsSemana.filter((d) => d.comentario && !esDesc(d) && !esMano(d));
  datos.comentarios = { reglas: comentariosRegla, recomendaciones: comRec };
  S.push(`## 5. Comentarios\n\n**A las reglas vigentes** (cada uno con su autor):\n\n` +
    (comentariosRegla.length ? tabla(['Regla', 'Comentario', 'Quién', 'Día'], comentariosRegla.map((c) => [nombreReglaId(c.regla), c.comentario || c.texto, c.autor || 'Sin autor', dmy(diaArg(c.recibido))])) : vacio('Sin comentarios a reglas (la pantalla de reglas todavía no existe).')) +
    `\n\n**A recomendaciones** (sin decisión tomada):\n\n` +
    (comRec.length ? tabla(['Regla', 'Campaña', 'Comentario', '¿Sirve?', 'Quién'], comRec.map((d) => [nomRegla(tipoDe(d)), d.campana || recDe(d.id).campana, d.comentario, d.sirve, d.autor])) : vacio('Sin comentarios sueltos.')));

  // 6. Cambios pedidos a PAUTADOR y resultado a 7 días
  let secNexo;
  if (!Array.isArray(nexo)) secNexo = `No se pudo leer el repositorio del nexo: ${nexo.error}`;
  else if (!nexo.length) secNexo = vacio('Todavía no hay cambios pedidos a PAUTADOR (el envío real empieza con Seguimiento en Railway; hasta entonces es simulado).');
  else {
    const fechaEstado = (e) => (e && (e.fecha || (Array.isArray(e.historial) && e.historial.length && e.historial[e.historial.length - 1].fecha))) || null;
    const filas = nexo.map((h) => {
      const s = h.solicitud, ult = h.ultimo || {};
      const aplicada = (h.estados || []).find((e) => e && e.estado === 'aplicada');
      const fa = aplicada ? (fechaEstado(aplicada) || s.creada) : null;
      const mide = fa ? sumar(diaArg(fa), 7) : null;
      const valores = (ult.valores || []).map((v) => `${String(v.campo).replace(/_/g, ' ')}: ${v.antes} → ${v.despues}`).join('; ');
      return { s, ult, fa, mide, fila: [nomRegla(s.tipo_recomendacion), s.proyecto, s.campana, s.accion + (s.cambio_pct ? ` ${s.cambio_pct > 0 ? '+' : ''}${s.cambio_pct} %` : ''), s.pedida_por, dmy(diaArg(s.creada)), estadoTxt(ult.estado) + (ult.motivo ? ` (${ult.motivo})` : '') + (ult.error ? ` (${ult.error})` : ''), valores || '—', mide ? (mide <= hasta ? `se mide desde el ${dmy(mide)}` : `se mide el ${dmy(mide)}`) : '—'] };
    });
    const pedidasSemana = filas.filter((f) => dentro(diaArg(f.s.creada)));
    const paraMedir = filas.filter((f) => f.mide && f.mide <= hasta);
    datos.nexo = { total: filas.length, semana: pedidasSemana.length, estados: contar(filas, (f) => f.ult.estado || 'sin estado'), para_medir: paraMedir.length };
    secNexo = `Pedidos en total: ${filas.length} (${pedidasSemana.length} en la semana). Estados: ${Object.entries(datos.nexo.estados).map(([k, n]) => `${estadoTxt(k)} ${n}`).join(', ')}.\n\n` +
      tabla(['Regla', 'Proyecto', 'Campaña', 'Acción', 'Pedida por', 'Día', 'Estado', 'Antes → después', 'Resultado a 7 días'], filas.map((f) => f.fila)) +
      `\n\n${paraMedir.length === 1 ? 'Un cambio aplicado ya cumplió' : paraMedir.length + ' cambios aplicados ya cumplieron'} 7 días. La medición del resultado (regla E3: la métrica de la campaña 7 días antes y 7 días después) todavía no está construida: por ahora se listan para revisarlos a mano.`;
  }
  S.push(`## 6. Cambios pedidos a PAUTADOR y resultado a 7 días\n\n${secNexo}`);

  // 7. Lectura temprana (en observación)
  let secLt = vacio('Sin datos de la lectura temprana.');
  if (lt && lt.en_vivo) {
    const a = lt.en_vivo.acierto || {}, rv = lt.retrospectiva && lt.retrospectiva.como_corre_en_vivo && lt.retrospectiva.como_corre_en_vivo.total;
    datos.lectura_temprana = { datos_al: lt.datos_al, en_vivo: lt.en_vivo.estado, acierto: a, retrospectiva: rv || null };
    secLt = `Datos al ${dmy(lt.datos_al)}. Piezas registradas al día 5: ${lt.en_vivo.predicciones} (sigue al aire ${lt.en_vivo.estado['sigue al aire'] || 0}, ya juzgadas ${lt.en_vivo.estado.juzgada || 0}, no se juzgan ${lt.en_vivo.estado['no se juzga'] || 0}).\n\n` +
      `- En vivo, entre las piezas que ya terminaron: ${a.peor_termina_en_peor_cuartil_pct == null ? 'de las que estaban en el peor cuartil al día 5 todavía no terminó ninguna' : `de ${a.peor_cuartil_al_dia5} en el peor cuartil al día 5, el ${dec(a.peor_termina_en_peor_cuartil_pct)} % terminó en el peor`}; ${a.mejor_termina_en_mejor_cuartil_pct == null ? 'de las del mejor cuartil todavía no terminó ninguna' : `de ${a.mejor_cuartil_al_dia5} en el mejor cuartil, el ${dec(a.mejor_termina_en_mejor_cuartil_pct)} % terminó en el mejor (todavía son pocas para sacar conclusiones)`}.\n` +
      (rv ? `- Hacia atrás (180 días, como corre en vivo): ${dec(rv.peor_termina_en_peor_cuartil_pct)} % de acierto en el peor cuartil (${rv.peor_cuartil_al_dia5.toLocaleString('es-AR')} piezas) y ${dec(rv.mejor_termina_en_mejor_cuartil_pct)} % en el mejor (${rv.mejor_cuartil_al_dia5.toLocaleString('es-AR')}).\n` : '') +
      `- Sigue en observación: no genera recomendaciones. Falta decidir con qué acierto se da por comprobada y si hace falta un gasto mínimo al día 5.`;
  }
  S.push(`## 7. Lectura temprana al día 5 (en observación)\n\n${secLt}`);

  // 8. Tipos de campaña confirmados
  S.push(`## 8. Tipos de campaña confirmados por el equipo\n\n` + (tiposCampana.length ? tabla(['Campaña', 'Tipo confirmado', 'Sugerido por la app', 'Proyecto', 'Quién'], tiposCampana.map((t) => [t.campana, t.tipo, t.sugerido, t.proyecto, t.autor])) : vacio('Sin confirmaciones en la semana.')));

  // 9. Propuestas de reglas nuevas o cambios (candidatos; decide Juan Pablo)
  const P = [];
  // a) silenciar (E4): misma regla y proyecto, 3+ descartes "Decisión del cliente" (todo el historial)
  const silenciar = contar(decs.filter((d) => esDesc(d) && /decisi[oó]n del cliente/i.test(d.motivo || '')), (d) => `${tipoDe(d)}§${proyDe(d)}`);
  for (const [k, n] of Object.entries(silenciar)) if (n >= SILENCIAR_DESCARTES) { const [t, p] = k.split('§');
    P.push({ tipo: 'silenciar', regla: nomRegla(t), vio: `Se descartó ${n} veces por "Decisión del cliente" en ${p}.`, propone: `Dejar de mostrar "${t}" en ${p} (regla E4), hasta que alguien la reactive.` }); }
  // b) revisar cuándo se dispara: la mitad o más descartadas por "No aplica" o "El dato está mal" (últimos 28 días)
  const porT = {}; for (const d of decsVentana) if (esDesc(d) || esMano(d) || esEnv(d)) (porT[tipoDe(d)] = porT[tipoDe(d)] || []).push(d);
  for (const [t, ds] of Object.entries(porT)) {
    const malas = ds.filter((d) => esDesc(d) && /no aplica|dato est[aá] mal/i.test(d.motivo || ''));
    if (ds.length >= MIN_DECISIONES && malas.length / ds.length >= PROPORCION_ALERTA) P.push({ tipo: 'umbral', regla: nomRegla(t), vio: `En los últimos ${VENTANA_TENDENCIA} días, ${malas.length} de ${ds.length} decisiones fueron descartes por "No aplica" o "El dato está mal".`, propone: 'Revisar cuándo se dispara (umbral o casos que habría que dejar afuera). Mirar los comentarios de esos descartes.' });
  }
  // c) ¿sirve? No
  const opin = {}; for (const d of decsVentana) if (d.sirve) (opin[tipoDe(d)] = opin[tipoDe(d)] || []).push(d);
  for (const [t, ds] of Object.entries(opin)) { const no = ds.filter((d) => /^no/i.test(d.sirve)).length;
    if (ds.length >= MIN_DECISIONES && no / ds.length >= PROPORCION_ALERTA) P.push({ tipo: 'sirve', regla: nomRegla(t), vio: `${no} de ${ds.length} opiniones dicen que no sirve (últimos ${VENTANA_TENDENCIA} días).`, propone: 'Revisar qué propone la regla o cómo está escrita la tarjeta.' }); }
  // d) hechas a mano con el mismo motivo: algo que falta en el catálogo o una forma distinta de resolverlo
  const manoMot = contar(decsVentana.filter((d) => esMano(d) && d.motivo), (d) => `${tipoDe(d)}§${d.motivo}`);
  for (const [k, n] of Object.entries(manoMot)) if (n >= MIN_MISMO_MOTIVO_MANO) { const [t, m] = k.split('§');
    P.push({ tipo: 'mano', regla: nomRegla(t), vio: `Se hizo a mano ${n} veces con el motivo "${m}".`, propone: /cat[aá]logo/i.test(m) ? 'Evaluar sumar esa acción al catálogo de cambios que ejecuta PAUTADOR.' : /distinto/i.test(m) ? 'Evaluar cambiar lo que propone la regla por lo que hizo el equipo.' : 'Revisar si la regla tiene que proponer otra cosa.' }); }
  // e) comentarios a reglas: cada uno es un candidato
  for (const c of comentariosRegla) P.push({ tipo: 'comentario', regla: nombreReglaId(c.regla), vio: `${c.autor || 'Sin autor'} comentó: "${c.comentario || c.texto}"`, propone: 'Decidir si cambia la regla, se aclara el texto o queda como está.' });
  datos.propuestas = P;
  S.push(`## 9. Propuestas para decidir en la sesión\n\n` +
    `Salen solas de lo de arriba. Ninguna cambia nada hasta que Juan Pablo la apruebe; lo aprobado se anota en el documento de reglas (v0.3) y en la bitácora de Recomendaciones.\n\n` +
    (P.length ? P.map((p, i) => `**${i + 1}. ${p.regla}**\n- Qué se vio: ${p.vio}\n- Qué se propone: ${p.propone}\n- Decisión: Sí · No · Cambiar así: ______`).join('\n\n')
      : vacio('Sin propuestas esta semana: no hay respuestas suficientes para sacar conclusiones.')) +
    `\n\nCómo se arma cada propuesta: silenciar si una regla se descartó ${SILENCIAR_DESCARTES} veces por "Decisión del cliente" en el mismo proyecto; revisar cuándo se dispara si, con ${MIN_DECISIONES} decisiones o más en ${VENTANA_TENDENCIA} días, la mitad o más fueron descartes por "No aplica" o "El dato está mal"; revisar qué propone si la mitad o más de las opiniones dicen que no sirve; evaluar el catálogo si se hizo a mano ${MIN_MISMO_MOTIVO_MANO} veces con el mismo motivo; y cada comentario a una regla vigente.`);

  const md = `# Sesión de los lunes · Seguimiento · ${dmy(lunes)}/${lunes.slice(0, 4)}\n\nSemana del ${dmy(desde)} al ${dmy(hasta)}. Armado por el agente de Recomendaciones con el repositorio de la app (${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC). Las correcciones de los implementadores en PAUTADOR las trae el informe de PAUTADOR.\n\n` + S.join('\n\n') + '\n';
  return { md, datos, lunes };
}

module.exports = { armarInforme, decisiones };

if (require.main === module) {
  const repo = path.resolve(arg('repo', path.join(RAIZ, 'app', 'repositorio')));
  const hasta = arg('hasta', sumar(diaArg(Date.now()), -1));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hasta)) { console.error('--hasta tiene que ser AAAA-MM-DD'); process.exit(1); }
  const salida = path.resolve(arg('salida', path.join(repo, 'informes-lunes')));
  const { md, datos, lunes } = armarInforme({ repo, hasta });
  fs.mkdirSync(salida, { recursive: true });
  fs.writeFileSync(path.join(salida, `${lunes}.md`), md);
  fs.writeFileSync(path.join(salida, `${lunes}.json`), JSON.stringify(datos, null, 1) + '\n');
  console.log(`informe de la sesión del ${lunes} (semana ${datos.semana.desde} a ${datos.semana.hasta}) → ${path.join(salida, lunes + '.md')}`);
  console.log(`  recomendaciones ${datos.resumen.generadas} · decisiones ${datos.resumen.respondidas} · comentarios a reglas ${datos.resumen.comentarios_a_reglas} · propuestas ${datos.propuestas.length}`);
}
