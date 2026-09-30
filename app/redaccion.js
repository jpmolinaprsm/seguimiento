// Redacción de las recomendaciones para la app: título, Problema → Solución, qué está afectado (campaña, contenidos, conjuntos
// de anuncios), qué revisar y la regla ("Cómo lo detectamos"). También guarda el repositorio de lo que generó el agente.
// Dueño: agente de Recomendaciones. Qué se recomienda lo deciden las reglas (borrador/recomendaciones.js y borrador/reglas/);
// acá solo se escribe cómo se muestra. Detalle de cada regla: Seguimiento/documentos/reglas-recomendador-v0.3.md.
const fs = require('fs');
const path = require('path');

const REGLA = {
  'Rinde por debajo': 'KPI principal al menos 20 % peor que la referencia General y la del Proyecto, y que pagó $100 mil o más (o 5 % de su gasto) por encima de lo habitual del proyecto.',
  'Se desgastó': 'Campaña de 30 días o más con 2 semanas seguidas bajo su propio cuartil bajo y el KPI principal 20 % o más abajo de su mediana.',
  'Mejor momento': 'Campaña de 30 días o más con 2 semanas seguidas sobre su propio cuartil alto.',
  'Presión acumulada alta': 'Más de 20 impresiones por habitante en el último mes de la campaña y KPI principal en baja (últimas 4 semanas contra las 8 anteriores).',
  'Peor que la temporada anterior': 'Campaña estacional 20 % o más peor que la temporada anterior en las mismas semanas, costos ajustados por inflación.',
  'Se comparte': '10 o más compartidas cada 100 reacciones (el 10 % más compartido del último año).', 'Genera conversación': '13 o más comentarios cada 100 reacciones (el 10 % más comentado del último año).',
  'Se abandona temprano': 'Video con 20 mil o más reproducciones cuya retención al 25 % está 20 % por debajo del cuartil bajo de su objetivo.',
  'Sumar Facebook Reels': 'Campaña de Alcance con menos de 5 % del gasto en Facebook Reels.', 'Placements débiles': 'Campaña de Interacción con 5 % o más del gasto en Instream, Threads o Explore.',
  'Rotar contenidos': 'Piezas activas que pasaron 15 días (video) o 12 (placa o carrusel).', 'Sin entrega': 'Campaña vigente sin gasto hace más de 2 días.',
};
function tituloDe(a, d, kpiL) {
  const c = a.camp || '';
  if (a.tipo === 'Rinde por debajo' && d) { const ix = Math.min(d.idxG || 1, d.idxP || 1); return `${c}: ${kpiL} ${Math.round((1 / ix - 1) * 100)} % más caro que lo normal`; }
  if (a.tipo === 'Se desgastó') return `${c}: viene cayendo hace 2 semanas`;
  if (a.tipo === 'Mejor momento') return `${c}: está en su mejor momento`;
  if (a.tipo === 'Peor que la temporada anterior') return `${c}: peor que la temporada pasada`;
  if (a.tipo === 'Rotar contenidos') return a.titulo.replace('pasaron su umbral de fatiga', 'pasaron su vida útil');
  return a.titulo;
}
function solucionDe(a, d, conj, piezasA = []) {
  if (a.tipo === 'Rinde por debajo') {
    const peor = conj.filter((k) => k.rol === 'pausar'), mejor = conj.filter((k) => k.rol === 'reforzar');
    if (peor.length && mejor.length) return `Pausar ${peor.length === 1 ? 'el conjunto' : 'los ' + peor.length + ' conjuntos de'} “${piezasA[0].nombreL}” (${peor[0].metrica}) y pasar ese presupuesto diario a ${mejor[0].corto} (${mejor[0].metrica}).`;
    if (piezasA.length >= 2) return `Pausar “${piezasA[0].nombreL}” y pasar su presupuesto a “${piezasA[1].nombreL}” (la de mejor costo por reacción).`;
  }
  if (a.tipo === 'Se desgastó' && conj.length) return `${a.hacer}. Empezar por el conjunto ${conj[0].corto}, que lleva más gasto (${conj[0].gastoT} en 14 días).`;
  if (a.tipo === 'Se comparte' && conj.length) return `Subir 20 % el presupuesto diario del conjunto ${conj[0].corto} mientras siga compartiéndose.`;
  return a.hacer.endsWith('.') ? a.hacer : a.hacer + '.';
}
function revisarDe(a, d, conj) {
  const L = [];
  const audCustom = conj.filter((c) => /^[A-Z]{3}[A-Z0-9]{4,}$|X{3}/.test((c.corto.split(' · ')[1] || '')));
  switch (a.tipo) {
    case 'Rinde por debajo':
      if (audCustom.length) L.push(`El tamaño de las audiencias personalizadas ${[...new Set(audCustom.map((c) => c.corto.split(' · ')[1]))].join(', ')}: un costo muy alto suele ser una audiencia chica.`);
      L.push('Placements y frecuencia de los conjuntos con peor costo.', 'Si la pieza nueva arrancó hace menos de 5 días, esperar: al día 5 ya se sabe.'); break;
    case 'Se desgastó': L.push('Cuántos días llevan las piezas al aire (la fatiga llega entre el día 12 y el 15).', 'Frecuencia en la API de Meta cuando esté conectada.', 'Si hay piezas nuevas en producción para rotar.'); break;
    case 'Mejor momento': L.push('Que el presupuesto diario tenga margen para subir 20 % sin salir de la fase de aprendizaje.', 'Que la pieza que empuja no esté por fatigar.'); break;
    case 'Peor que la temporada anterior': L.push('Piezas y audiencias de la temporada pasada: qué se cambió.', 'Si el objetivo o el formato cambió respecto del año anterior.'); break;
    case 'Se comparte': L.push('Que la pieza siga vigente y con presupuesto diario.', 'Comentarios: lo muy compartido a veces trae polémica.'); break;
    case 'Genera conversación': L.push('El tono de los comentarios: consultas sin responder, quejas o polémica.', 'Si conviene responder desde la página antes de seguir invirtiendo.'); break;
    case 'Se abandona temprano': L.push('Los primeros 3 segundos: gancho, texto en pantalla, subtítulos.', 'Si el video es más largo que lo habitual para su placement.'); break;
    case 'Sumar Facebook Reels': L.push('Que la pieza tenga formato vertical apto para Reels.', 'Placements automáticos o manuales en los conjuntos.'); break;
    case 'Placements débiles': L.push('Placements de cada conjunto de Interacción: sacar Instream, Threads y Explore.'); break;
    case 'Rotar contenidos': L.push('Qué piezas nuevas hay disponibles para las campañas que siguen más de una semana.', 'Cuáles de las fatigadas todavía valen la pena mantener.'); break;
    case 'Sin entrega': L.push('Anuncios rechazados o en revisión en el administrador de anuncios.', 'Presupuesto del conjunto y fecha de fin.'); break;
    case 'Apagón': L.push('Anuncios pausados, rechazados o sin presupuesto en las cuentas del activo.', 'Si el corte fue intencional (fin de campaña).'); break;
    case 'Pico': L.push('Si el aumento responde a una campaña nueva o a un pedido cargado.', 'Que el presupuesto del mes lo aguante.'); break;
    case 'Costo por objetivo': L.push('Pieza, audiencia y puja de los conjuntos de esa red y objetivo.', 'Si cambió la mezcla de placements o de formatos contra los meses anteriores.'); break;
    case 'Presión acumulada alta': L.push('Frecuencia real en la API de Meta cuando esté conectada.', 'Si conviene ampliar la audiencia o pausar una semana.'); break;
  }
  return L;
}
const fuenteDe = (a) => (/temporada|propia|desgast|mejor momento/i.test(a.tipo) ? 'Propia · historia de la campaña' : /Apagón|Pico|Costo por objetivo/.test(a.tipo) ? 'Todas las plataformas · mes anterior' : 'Generales · DataJunta último año');

// Convierte las acciones que generan las reglas (pend) en las tarjetas que muestra la app.
function redactar(pend, ctx) {
  const { campD, conjuntosCamp, limpio, kpiDe, Mk, dias, datosHasta, objetivo, num, fmtCosto, nombreCont, voz } = ctx;
  const conjDe = (com, cods) => conjuntosCamp.filter((r) => r.comunic === com && (!cods || !cods.length || cods.includes(r.cod)) && dias(r.hasta, datosHasta) <= 3)
    .map((r) => { const o = objetivo(r.objetivo), g14 = num(r.g14), i14 = num(r.i14), r14 = num(r.r14);
      const met = o === 'Interacción' ? (r14 ? `${fmtCosto(g14 / r14)} por reacción` : 'sin reacciones') : o === 'Tráfico' ? (num(r.imp) ? `CTR ${(num(r.clk) / num(r.imp) * 100).toFixed(2).replace('.', ',')} %` : '—') : (i14 ? `CPM ${fmtCosto(g14 / i14 * 1000)}` : '—');
      return { nombre: r.conjunto, corto: [r.cod, r.audiencia, r.placement].filter(Boolean).join(' · '), cod: r.cod, contenido: nombreCont(r.contenido), gasto: g14, gastoT: Mk(g14), metrica: met, activo: voz(r.activo),
        // ids de Meta para el nexo: tal cual vienen de la extracción (texto con comas; lo interpreta el nexo)
        ads: r.ads, conjuntoId: r.conjuntoId }; })
    .sort((a, b) => b.gasto - a.gasto);
  return pend.map((a) => {
    const d = campD[a.camp] || null;
    const codDe = (p) => (d ? (d.contenidos || []).find((x) => x.nombre === p.nombre) : null)?.k;
    const piezasA = (a.piezas || []).map((p) => ({ ...p, cod: codDe(p), nombreL: limpio(p.nombre, a.camp) }));
    let conj = [];
    if (a.tipo === 'Rinde por debajo' && piezasA.length >= 2) {
      const peor = conjDe(a.camp, piezasA[0].cod ? [piezasA[0].cod] : null), mejor = conjDe(a.camp, piezasA[1].cod ? [piezasA[1].cod] : null);
      conj = [...peor.slice(0, 4).map((k) => ({ ...k, rol: 'pausar' })), ...mejor.slice(0, 2).map((k) => ({ ...k, rol: 'reforzar' }))];
    } else conj = a.camp ? conjDe(a.camp, piezasA.map((p) => p.cod).filter(Boolean)).slice(0, 6) : [];
    const contenidos = piezasA.map((p) => ({ nombre: p.nombreL, rol: p.rol, pieza: { fb: p.fb || null, ig: p.ig || null, otro: p.otro || null, nombre: p.nombreL } }));
    const kpiL = d ? kpiDe(d.m, d.obj, []).kpiL : '';
    const R = revisarDe(a, d, conj);
    // por PAUTADOR o a mano: lo decide recomendaciones.js (viaDe) según el contrato. Ya no hay "parte a mano" por activos no
    // automatizados: si la cuenta no está habilitada en PAUTADOR, PAUTADOR rechaza el pedido.
    const via = a.via === 'pautador' ? 'ok' : 'manual';
    return { id: a.id, tipo: a.tipo, camp: a.camp ? a.camp : (a.tipo === 'Apagón' || a.tipo === 'Pico' ? 'Activo ' + a.titulo.split(' casi ')[0].split(' gasta ')[0] : a.titulo.split(':')[0]), campId: a.camp || null,
      via, blockNote: via === 'blocked' ? `${d.voces.filter((v) => !v.auto).map((v) => v.k).join(', ')} no está automatizado: esa parte se hace a mano.` : '',
      plata: a.impacto && (a.tipo === 'Rinde por debajo' || a.tipo === 'Costo por objetivo') ? Mk(a.impacto) : '—',
      title: tituloDe(a, d, kpiL), problema: a.que, solucion: solucionDe(a, d, conj, piezasA), afectado: { campana: a.camp || (a.campanas ? a.campanas.join(', ') : ''), contenidos, conjuntos: conj.map((k) => ({ ...k, corto: (k.rol ? (k.rol === 'pausar' ? 'Pausar · ' : 'Reforzar · ') : '') + k.corto })) }, revisar: R,
      porque: a.porque, fuente: fuenteDe(a), regla: a.como || REGLA[a.tipo] || '' };
  });
}

// Repositorio de recomendaciones: todas las que generó el agente con estos datos, una por línea, para cruzarlas con las
// respuestas del equipo (repositorio/respuestas.jsonl, lo escribe servir.js) y ver qué reglas sirven.
function guardarRepositorio(proyectos, datosHasta) {
  const REPO = path.join(__dirname, 'repositorio', 'recomendaciones');
  fs.mkdirSync(REPO, { recursive: true });
  const generado = new Date().toISOString();
  const lineas = [];
  for (const p of proyectos) for (const [canal, b] of Object.entries(p.canales)) for (const a of b.acciones) lineas.push(JSON.stringify({
    datos_al: datosHasta, generado, id: a.id, proyecto: p.nombre, canal, tipo: a.tipo, titulo: a.title, problema: a.problema, solucion: a.solucion,
    campana: a.afectado.campana || a.camp || null, contenidos: a.afectado.contenidos.map((c) => c.nombre), conjuntos: a.afectado.conjuntos.map((k) => k.nombre),
    revisar: a.revisar, regla: a.regla || null, fuente: a.fuente || null, plata_en_juego: a.plata || null, via: a.via }));
  fs.writeFileSync(path.join(REPO, `${datosHasta}.jsonl`), lineas.join('\n') + '\n');
  console.log(`repositorio: ${lineas.length} recomendaciones → repositorio/recomendaciones/${datosHasta}.jsonl`);
  // Lectura temprana al día 5, EN OBSERVACIÓN (decisión del 30/09/2026): registra predicciones y mide el acierto en
  // repositorio/lectura-temprana/. No genera recomendaciones ni tarjetas. Si falla, no corta el armado.
  try { require('../borrador/lectura-temprana.js').observar(require('../borrador/armar.js'), path.join(__dirname, 'repositorio', 'lectura-temprana')); }
  catch (e) { console.error('lectura temprana (observación) falló:', e.message); }
}

module.exports = { redactar, guardarRepositorio, REGLA };
