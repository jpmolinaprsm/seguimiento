// Redacción de las recomendaciones para la app: título, Problema → Solución, qué está afectado (campaña, contenidos, conjuntos
// de anuncios), qué revisar y la regla ("Cómo lo detectamos"). También guarda el repositorio de lo que generó el agente.
// Dueño: agente de Recomendaciones. Qué se recomienda lo deciden las reglas (borrador/recomendaciones.js y borrador/reglas/);
// acá solo se escribe cómo se muestra. Detalle de cada regla: Seguimiento/documentos/reglas-recomendador-v0.3.md.
const fs = require('fs');
const path = require('path');

// "Cómo lo detectamos". Decisión de Juan Pablo del 01/10: en pantalla se compara solo contra lo normal del proyecto y contra la
// misma campaña; la comparación con todos los gobiernos ya no es una luz, pero la regla Rinde por debajo la sigue usando y se
// dice en simple. "en el proyecto" se cambia por el nombre del proyecto en cada tarjeta (reglaDe).
const REGLA = {
  'Rinde por debajo': 'El resultado principal (lo que cuesta cada reacción, lo que cuesta mostrar el anuncio mil veces o cuántos hacen click, según el objetivo) está 20 % o más peor que lo normal en el proyecto y que lo normal en todos los gobiernos, y la campaña pagó $100 mil o más (o 5 % de su gasto) por encima de lo habitual en el proyecto.',
  'Se desgastó': 'Campaña de 30 días o más cuyas 2 últimas semanas quedaron por debajo de su cuarto peor de semanas, con el resultado principal 20 % o más peor que lo normal en las semanas anteriores de esta campaña.',
  'Mejor momento': 'Campaña de 30 días o más cuyas 2 últimas semanas quedaron por encima de su cuarto mejor de semanas.',
  'Presión acumulada alta': 'Más de 20 impresiones por habitante en el último mes de la campaña y el resultado principal en baja (las últimas 4 semanas contra las 8 anteriores de esta campaña).',
  'Peor que la temporada anterior': 'Campaña estacional cuyo resultado principal, en toda esta temporada, está 20 % o más peor que en la misma cantidad de semanas desde el inicio de la temporada pasada (o toda la pasada, si fue más corta), comparando objetivo por objetivo y formato por formato, con la plata de entonces llevada a valores de hoy. Es el mismo cálculo que la tarjeta "Esta temporada".',
  'Se comparte': '10 o más compartidas cada 100 reacciones (el 10 % más compartido del último año).', 'Genera conversación': '13 o más comentarios cada 100 reacciones (el 10 % más comentado del último año).',
  'Se abandona temprano': 'Video con 20 mil o más reproducciones cuya retención al 25 % está 20 % por debajo del cuartil bajo de su objetivo.',
  'Sumar Facebook Reels': 'Campaña de Alcance con menos de 5 % del gasto en Facebook Reels.', 'Placements débiles': 'Campaña de Interacción con 5 % o más del gasto en Instream, Threads o Explore.',
  'Rotar contenidos': 'Piezas activas que pasaron 15 días (video) o 12 (placa o carrusel).', 'Sin entrega': 'Campaña vigente sin gasto hace más de 2 días.',
};
// ---- cómo se dice cada métrica (mismo vocabulario que las luces de app/logica.js, decisión del 01/10) ----
// El índice x que calcula Referencias vale 1 si es igual a la referencia y más de 1 si es mejor. Costo: la referencia = propio × x.
// Clicks cada 100 (tasa): la referencia = propio ÷ x.
const fCosto = (v) => (v >= 10 ? '$' + Math.round(v).toLocaleString('es-AR') : '$' + v.toLocaleString('es-AR', { maximumFractionDigits: 2 }));
const fCada100 = (v) => v.toLocaleString('es-AR', { minimumFractionDigits: v < 10 ? 1 : 0, maximumFractionDigits: v < 10 ? 2 : 0 });
const METRICA = {
  cr: { dice: (v) => `cada reacción costó ${fCosto(v)}`, cuesta: 'cada reacción cuesta', fem: true, ref: fCosto },
  cpm: { dice: (v) => `mostrar el anuncio mil veces costó ${fCosto(v)}`, cuesta: 'mostrar el anuncio mil veces cuesta', fem: false, ref: fCosto },
  ctr: { dice: (v) => `de cada 100 que lo vieron, ${fCada100(v)} hicieron click`, cuesta: 'hacen click', tasa: true, ref: (v) => `${fCada100(v)} de cada 100` },
};
// la métrica que comparan las reglas de campaña: Interacción costo por reacción, Tráfico clicks cada 100, el resto costo de mil impresiones
const metDe = (obj) => (obj === 'Interacción' ? 'cr' : obj === 'Tráfico' ? 'ctr' : 'cpm');
const valorDe = (met, m) => (!m ? null : met === 'cr' ? (m.r ? m.g / m.r : null) : met === 'ctr' ? (m.i ? m.c / m.i * 100 : null) : (m.i ? m.g / m.i * 1000 : null));
const may = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const pctDe = (met, x) => Math.round(Math.abs(METRICA[met].tasa ? x - 1 : 1 / x - 1) * 100);
// "10 % más cara que lo normal en Santa Fe ($35)"; sin valor propio, sin el paréntesis
function contra(met, x, v, que, ajuste = '') {
  if (x == null || !isFinite(x) || x <= 0) return null;
  const M = METRICA[met], a = M.fem ? 'a' : 'o', p = pctDe(met, x), mejor = x >= 1;
  const ref = v != null && isFinite(v) && v > 0 ? (M.tasa ? v / x : v * x) : null;
  const refT = ref != null ? ` (${M.ref(ref)}${ajuste})` : '';
  if (p === 0) return `igual que ${que}${refT}`;
  return `${p} % ${M.tasa ? (mejor ? 'más' : 'menos') : mejor ? `más barat${a}` : `más car${a}`} que ${que}${refT}`;
}
// "cada reacción cuesta 10 % más que lo normal en Santa Fe" (títulos y tendencias, sin valores)
const cuestaMas = (met, x, que) => `${METRICA[met].cuesta} ${pctDe(met, x)} % ${METRICA[met].tasa ? (x >= 1 ? 'más' : 'menos') : x >= 1 ? 'menos' : 'más'} que ${que}`;
// nombre del proyecto de la campaña ("Santa Fe"), para decir "lo normal en Santa Fe"
function proyDe(d) {
  const id = d && d.uid ? String(d.uid).split('|')[0] : null;
  const P = id ? (require('../borrador/armar.js').PROYECTOS || []).find((x) => x.id === id) : null;
  return P ? P.nombre : 'el proyecto';
}
// Problema escrito con la métrica, los valores y contra qué se compara. Si falta un dato, queda el texto de la regla.
function problemaDe(a, d, Mk) {
  if (!d) return a.que;
  const met = metDe(d.obj), M = METRICA[met], proy = proyDe(d), pr = d.propia;
  if (a.tipo === 'Rinde por debajo') {
    const v = valorDe(met, d.m), cP = contra(met, d.idxP, v, `lo normal en ${proy}`), cG = contra(met, d.idxG, v, 'lo normal en todos los gobiernos');
    if (v == null || !cP || !cG) return a.que;
    const efi = d.efi ? `; ${d.efi.pctGastoRojo} % del gasto fue a anuncios en rojo (${d.efi.rojos} de ${d.efi.n})` : '';
    return `${may(M.dice(v))}: ${cP} y ${cG}.${d.deMas != null ? ` Pagó ${Mk(d.deMas)} más que lo habitual en ${proy}${efi}.` : ''}`;
  }
  if (!pr) return a.que;
  if (a.tipo === 'Se desgastó' || a.tipo === 'Mejor momento') {
    const c = contra(met, pr.idxPropio, pr.valorAct, 'en las semanas anteriores de esta campaña');
    if (!c || pr.valorAct == null) return a.que;
    return `En las últimas dos semanas, ${M.dice(pr.valorAct)}: ${c}${a.tipo === 'Se desgastó' ? `, después de ${Math.round(pr.span / 7)} semanas al aire` : ''}.`;
  }
  // desde el 02/10, con temporada() de app/marcas.js (el cálculo de la tarjeta "Esta temporada"): a.temp lo deja reglas/meta.js
  if (a.tipo === 'Peor que la temporada anterior' && a.temp) {
    const t = a.temp, mt = METRICA[t.kpi] ? t.kpi : met, c = contra(mt, t.idx, t.valor, 'en la temporada pasada de esta campaña', METRICA[mt].tasa ? '' : ', en plata de hoy');
    if (!c || t.valor == null) return a.que;
    const f = t.desde, sem = `${t.semanas} ${t.semanas === 1 ? 'semana' : 'semanas'}`;
    return `En toda esta temporada, ${METRICA[mt].dice(t.valor)}: ${c}. Se compara con ${t.toda ? `toda la temporada pasada (${sem})` : `las primeras ${sem} de la temporada pasada`}, que arrancó el ${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}.`;
  }
  if (a.tipo === 'Presión acumulada alta' && pr.presion != null && pr.tendencia != null)
    return `${Math.round(pr.presion)} impresiones por habitante en el último mes, y en las últimas 4 semanas ${cuestaMas(met, pr.tendencia, 'en las 8 semanas anteriores de esta campaña')}.`;
  return a.que;
}
function tituloDe(a, d) {
  const c = a.camp || '';
  if (a.tipo === 'Rinde por debajo' && d && d.idxP) return `${c}: ${cuestaMas(metDe(d.obj), d.idxP, `lo normal en ${proyDe(d)}`)}`;
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
// contra qué se compara cada regla, dicho en simple (sin las etiquetas General, Proyecto ni Propia; decisión del 01/10)
const fuenteDe = (a, d) => (a.tipo === 'Rinde por debajo' ? `Lo normal en ${proyDe(d)} y en todos los gobiernos · último año`
  : /temporada/i.test(a.tipo) ? 'Esta campaña · la temporada pasada'
    : /desgast|mejor momento|presión/i.test(a.tipo) ? 'Esta campaña · sus semanas anteriores'
      : /Apagón|Pico|Costo por objetivo/.test(a.tipo) ? 'Todas las plataformas · mes anterior' : 'Todos los gobiernos · último año de DataJunta');
const reglaDe = (a, d) => (a.como || (REGLA[a.tipo] || '').replace(/en el proyecto/g, d ? `en ${proyDe(d)}` : 'en el proyecto'));

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
    const R = revisarDe(a, d, conj);
    // por PAUTADOR o a mano: lo decide recomendaciones.js (viaDe) según el contrato. Ya no hay "parte a mano" por activos no
    // automatizados: si la cuenta no está habilitada en PAUTADOR, PAUTADOR rechaza el pedido.
    const via = a.via === 'pautador' ? 'ok' : 'manual';
    return { id: a.id, tipo: a.tipo, camp: a.camp ? a.camp : (a.tipo === 'Apagón' || a.tipo === 'Pico' ? 'Activo ' + a.titulo.split(' casi ')[0].split(' gasta ')[0] : a.titulo.split(':')[0]), campId: a.camp || null,
      via, blockNote: via === 'blocked' ? `${d.voces.filter((v) => !v.auto).map((v) => v.k).join(', ')} no está automatizado: esa parte se hace a mano.` : '',
      plata: a.impacto && (a.tipo === 'Rinde por debajo' || a.tipo === 'Costo por objetivo') ? Mk(a.impacto) : '—',
      title: tituloDe(a, d), problema: problemaDe(a, d, Mk), solucion: solucionDe(a, d, conj, piezasA), afectado: { campana: a.camp || (a.campanas ? a.campanas.join(', ') : ''), contenidos, conjuntos: conj.map((k) => ({ ...k, corto: (k.rol ? (k.rol === 'pausar' ? 'Pausar · ' : 'Reforzar · ') : '') + k.corto })) }, revisar: R,
      porque: a.porque, fuente: fuenteDe(a, d), regla: reglaDe(a, d) };
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
