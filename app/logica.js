// Lógica de "Seguimiento y Optimización" sobre el diseño curado (Claude Design). Se inyecta después de `const DATA = …`
// en el script text/x-dc del bundle. Produce exactamente los valores que el markup del diseño (y los parches) interpolan.
const COL = { g: '#46C678', y: '#FCB942', o: '#F98C3E', r: '#F7444C', n: '#D5D5D5' };
const COLN = { verde: COL.g, amarillo: COL.y, naranja: COL.o, rojo: COL.r, gris: COL.n };
const fx = (x) => x.toFixed(1).replace('.', ',') + '×';
const fM = (v) => (v / 1e6).toFixed(1).replace('.', ',') + ' M';
const fMs = (v) => (Math.abs(v) < 1e6 ? '$' + Math.round(v / 1e3).toLocaleString('es-AR') + ' k' : ('$' + fM(v)).replace(',0 M', ' M'));
const fN = (v) => (v ? Math.round(v).toLocaleString('es-AR') : '—');
const n2 = (v, d) => v.toFixed(d).replace('.', ',');
const dm = (f) => (f ? f.slice(8, 10) + '/' + f.slice(5, 7) : '');
// Texto de una luz (regla A7: nada de "1,4×"). x es el índice que calcula Referencias: 1 = igual a la referencia, más de 1 = mejor.
// d describe la métrica: m (nombre), tasa (true si más alto es mejor: CTR, tasas; si no, es un costo), fem (la tasa → "más alta"),
// dec (decimales de la tasa), v (valor propio, para mostrar la referencia en plata o en %), pre (antepone el nombre de la métrica),
// ref (contra qué: "lo normal", "sus semanas anteriores", "la temporada anterior").
// Costo: el propio = referencia ÷ x → "27 % más barato". Tasa: el propio = referencia × x → "35 % más alto". Colores sin cambios.
const fCosto = (v) => (v >= 10 ?'$' + Math.round(v).toLocaleString('es-AR') : '$' + v.toLocaleString('es-AR', { maximumFractionDigits: 2 }));
const fValor = (v, d) => (d.tasa ? v.toLocaleString('es-AR', { minimumFractionDigits: d.dec ?? 2, maximumFractionDigits: d.dec ?? 2 }) + ' %' : fCosto(v));
function light(label, x, d = {}) {
  const ref = d.ref || 'lo normal';
  if (x === null || x === undefined) return { label, short: '', num: 'sin referencia', corto: 'sin referencia', largo: label + ': sin referencia', bg: COL.n, bd: 'none', title: label + ': sin referencia' };
  if (x === 'e') return { label, short: '', num: '', corto: '', largo: label + ': poca historia, la luz aparece desde la tercera semana', bg: 'transparent', bd: '1.5px solid #A6AAA9', title: label + ': la luz aparece desde la tercera semana' };
  const bg = x >= 1.2 ? COL.g : x <= 0.8 ? COL.r : COL.y, parecido = bg === COL.y;
  const p = Math.round(Math.abs(d.tasa ? x - 1 : 1 / x - 1) * 100), mejor = x >= 1, a = d.fem ? 'a' : 'o';
  const dir = d.tasa ? (mejor ? `más alt${a}` : `más baj${a}`) : mejor ? 'más barato' : 'más caro';
  const rv = d.v != null && isFinite(d.v) && d.v > 0 && !d.ref ? (d.tasa ? d.v / x : d.v * x) : null;
  const refTxt = rv != null ? ` (${fValor(rv, d)})` : '';
  const juicio = d.tasa && !parecido ? (mejor ? ': mejor' : ': peor') : '';
  const pre = d.pre && d.m ? d.m + ' ' : '';
  let corto, medio;
  if (p === 0) { corto = `igual que ${ref}`; medio = `igual que ${ref}${refTxt}`; }
  else if (parecido) { corto = `parecido: ${p} % ${dir}`; medio = `parecido a ${ref}${refTxt}: ${p} % ${dir}`; }
  else { corto = `${p} % ${dir}` + (d.tasa ? (mejor ? ' (mejor)' : ' (peor)') : ''); medio = `${p} % ${dir} que ${ref}${refTxt}${juicio}`; }
  medio = pre + medio;
  const largo = `${label}: ${d.m ? d.m + (d.v != null && isFinite(d.v) && d.v > 0 ? ' ' + fValor(d.v, d) : '') + ' · ' : ''}${medio.slice(pre.length)}`;
  return { label, short: '', num: medio, corto, largo, bg, bd: 'none', title: largo };
}
const ESTADO = { 'Por vencer': 'Termina esta semana', Terminada: 'Terminó' };
const estTxt = (e) => ESTADO[e] || e;
// ---- hasta dónde va a llegar (lo calcula Referencias en borrador/armar.js → c.llegada) ----
const LLEGA_COL = { 'va a llegar': COL.g, 'en riesgo': COL.y, 'no va a llegar': COL.r };
const cantTxt = (n, met) => { if (n >= 1e6) { const v = n2(n / 1e6, 1).replace(',0', ''); return v === '1' ? `1 millón de ${met}` : `${v} millones de ${met}`; } return `${Math.round(n).toLocaleString('es-AR')} ${met}`; };
const diaAntes = (f) => new Date(new Date(f + 'T12:00:00Z').getTime() - 864e5).toISOString().slice(0, 10);
const COSTO_LLEGA = { impresiones: (v) => `CPM normal ${fCosto(v)}`, reacciones: (v) => `${fCosto(v)} por reacción`, clicks: (v) => `${fCosto(v)} por click` };
// devuelve { hay, etiqueta, dot, frase, plata } listo para mostrar; hay = false si la campaña no trae el dato
function llegadaTxt(l) {
  if (!l) return { hay: false, etiqueta: '', dot: COL.n, frase: '', plata: '', titulo: '' };
  if (l.logrado == null) return { hay: true, etiqueta: 'sin dato', dot: COL.n, frase: `Sin dato: ${l.sinDato || 'no se pudo calcular'}.`, plata: '', titulo: '' };
  const ultimo = diaAntes(l.fin), cuando = l.desde.slice(8) === '01' ? 'este mes' : `desde el ${dm(l.desde)}`;
  const quien = l.referencia === 'General' ? 'Una campaña normal de todos los gobiernos' : 'Una campaña normal del proyecto';
  const termino = !l.diasRestantes;
  let frase = termino ? `Lleva ${cantTxt(l.logrado, l.metrica)} ${cuando}; su fecha de fin en DataJunta es el ${dm(ultimo)}, así que no se proyecta más.`
    : `Lleva ${cantTxt(l.logrado, l.metrica)} ${cuando} y, a este ritmo, cierra el ${dm(ultimo)} con ${cantTxt(l.proyeccion, l.metrica)}.`;
  let etiqueta = 'sin dato', dot = COL.n;
  if (l.esperado && l.etiqueta) {
    const pct = Math.round((l.pctEsperado - 1) * 100);
    const cuanto = pct === 0 ? 'lo mismo que lo normal' : pct > 0 ? `${pct} % más de lo normal` : `${-pct} % menos de lo normal`;
    etiqueta = l.etiqueta; dot = LLEGA_COL[l.etiqueta] || COL.n;
    frase += ` ${quien} con esa plata ${termino ? 'habría llegado' : 'llegaría'} a ${cantTxt(l.esperado, l.metrica)} (${(COSTO_LLEGA[l.metrica] || COSTO_LLEGA.impresiones)(l.costoNormal)}). ${l.etiqueta[0].toUpperCase() + l.etiqueta.slice(1)}: ${cuanto}.`;
  } else frase += ` ${l.sinDato ? 'Sin dato para comparar: ' + l.sinDato + '.' : 'No hay con qué compararla.'}`;
  const plata = termino ? `La plata es lo que ya gastó: ${fMs(l.gastado)}.`
    : `La plata es estimada: ${fMs(l.plataEstimada)}, que suma lo gastado hasta ahora (${fMs(l.gastado)}) y ${fMs(l.gastoDiario)} por día hasta el ${dm(ultimo)}, el ritmo de gasto de los últimos 7 días. DataJunta no trae el presupuesto de cada campaña.`;
  return { hay: true, etiqueta, dot, frase, plata, titulo: frase + ' ' + plata };
}
// ---- solapan público (detección de Meta, borrador/reglas/meta.js): solo una marca, sin recomendación ----
const sinPrefijo = (t) => { const x = String(t || '').replace(/^Posible solapamiento:\s*/, ''); return x ? x[0].toUpperCase() + x.slice(1) : x; };
function solapanTxt(sp) {
  if (!sp || !sp.n) return { hay: false, resumen: '', pares: [], mas: '', hayMas: false };
  const resto = sp.n - sp.pares.length;
  return { hay: true, resumen: sp.n === 1 ? 'Hay un par de audiencias de esta campaña que pueden llegar a la misma gente:' : `Hay ${sp.n} pares de audiencias de esta campaña que pueden llegar a la misma gente${resto > 0 ? '. Los que más gastaron en los últimos 14 días' : ''}:`,
    pares: sp.pares.map((p) => ({ txt: sinPrefijo(p.texto) + (p.mismoContenido ? ' Llevan el mismo contenido.' : '') })), mas: resto > 0 ? `Y ${resto} ${resto === 1 ? 'par más' : 'pares más'}.` : '', hayMas: resto > 0 };
}
// ---- alcance real de Meta (regla A3): lo lee PAUTADOR cada mañana, lo valida el Nexo ----
// Cada período viene { ex, a, amin, amax, f, fmin, fmax, d, h } (ex = false: está en varias cuentas y Meta no junta las personas
// entre cuentas: rango entre la cuenta más grande y la suma) o { sin: motivo }. Sin dato de hoy se sigue mostrando el alcance
// diario acumulado de BigQuery, marcado como aproximado.
const ALC_PER = { desde_inicio: 'desde que empezó', ultimos_7: 'en los últimos 7 días', ultimos_30: 'en los últimos 30 días', mes_en_curso: 'en lo que va del mes' };
const fP = (v) => Math.round(v).toLocaleString('es-AR');
const fVeces = (v) => (v == null || !isFinite(v) ? '—' : v.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const fCorto = (n) => (n >= 1e6 ? (n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' M' : n >= 1e4 ? Math.round(n / 1e3).toLocaleString('es-AR') + ' K' : fP(n));
const hayAlc = (x) => !!x && !x.sin;
// "Llegó a 120.000 personas en los últimos 7 días, que la vieron 3,2 veces en promedio."
function alcanceFrase(x, per) {
  const cuando = ALC_PER[per] || '';
  if (x.ex) return x.a ? `Llegó a ${fP(x.a)} personas ${cuando}, que la vieron ${fVeces(x.f)} veces en promedio.` : `No llegó a nadie ${cuando}.`;
  return x.amax ? `Llegó a entre ${fP(x.amin)} y ${fP(x.amax)} personas ${cuando} (varias cuentas: puede contar de más), que la vieron entre ${fVeces(x.fmin)} y ${fVeces(x.fmax)} veces en promedio.` : `No llegó a nadie ${cuando}.`;
}
const sinDatoTxt = (motivo) => 'Sin dato de hoy' + (motivo ? ': ' + motivo.charAt(0).toLowerCase() + motivo.slice(1) : '.');
// Tarjeta de alcance de la campaña: el período principal es "desde que empezó" (el que reemplaza al acumulado); si no está, 30 y 7 días.
// El otro renglón muestra los últimos 7 días. tt trae el acumulado viejo (val, small) para el caso sin dato.
function alcanceTarjeta(tt) {
  const A = tt.alcM || {}, L = DATA.alcanceMeta || {};
  const per = ['desde_inicio', 'ultimos_30', 'ultimos_7'].find((p) => hayAlc(A[p]));
  if (!per) {
    const motivo = (A.desde_inicio && A.desde_inicio.sin) || L.motivo || '';
    const hayViejo = tt.val && tt.val !== '—';
    return { label: hayViejo ? 'Alcance diario acumulado (aproximado)' : 'Alcance', delta: sinDatoTxt(motivo), dColor: '#808080',
      small: hayViejo ? `Aproximado, sumado desde BigQuery: una persona cuenta una vez por cada día que la alcanzan. ${tt.small[0].toUpperCase() + tt.small.slice(1)}.` : 'Sin dato de alcance.' };
  }
  const x = A[per], y = per !== 'ultimos_7' && hayAlc(A.ultimos_7) ? A.ultimos_7 : null;
  const val = x.ex ? fCorto(x.a || 0) : `${fCorto(x.amin || 0)} a ${fCorto(x.amax || 0)}`;
  const siete = y ? (y.ex ? `Últimos 7 días: ${fP(y.a || 0)} personas, ${fVeces(y.f)} veces cada una.` : `Últimos 7 días: entre ${fP(y.amin || 0)} y ${fP(y.amax || 0)} personas, entre ${fVeces(y.fmin)} y ${fVeces(y.fmax)} veces cada una.`) : '';
  const periodo = x.d && x.h ? `Del ${dm(x.d)} al ${dm(x.h)}. ` : '';
  return { label: x.ex ? 'Personas alcanzadas (Meta)' : 'Personas alcanzadas (Meta, varias cuentas)', val, delta: alcanceFrase(x, per), dColor: '#3C3C3C',
    small: `${siete ? siete + ' ' : ''}${periodo}Dato de Meta leído el ${dm(L.fecha)}.` };
}
// métrica del índice según quién lo calcula: General y Proyecto de la lista de Campañas comparan el costo por resultado del objetivo;
// la luz Propia / Temporada, Revisar campañas y las audiencias usan el KPI principal (Tráfico por CTR)
const KPI_COSTO = { Alcance: 'CPM', Interacción: 'Costo por reacción', Tráfico: 'Costo por click', Conversión: 'Costo por click', Reproducciones: 'Costo por reproducción' };
const dCosto = (obj) => ({ m: KPI_COSTO[obj] || 'CPM' });
const dKpi = (obj) => (obj === 'Tráfico' ? { m: 'CTR', tasa: true } : { m: obj === 'Interacción' ? 'Costo por reacción' : 'CPM' });
const dPropia = (d, estac) => ({ ...d, v: null, ref: estac ? 'la temporada anterior' : 'sus semanas anteriores' });
const lightsOf = (l, estac, d = {}, dp = d) => (l || []).map((x, i) => light(['General', 'Proyecto', estac ? 'Temporada anterior' : 'Propia'][i], x, i < 2 ? d : dPropia(dp, estac)));
// versión corta para filas de tabla: el nombre de la luz adelante, la frase corta en negrita y la frase completa al pasar el mouse
const lucesCortas = (ls) => ls.map((l) => ({ ...l, short: l.label, num: l.corto, label: l.largo }));
// métrica de cada tarjeta de la pantalla de campaña (la luz de Impresiones compara el CPM)
const D_TARJETA = { Impresiones: { m: 'CPM', pre: true }, 'Costo por reacción': { m: 'Costo por reacción' }, CPM: { m: 'CPM' }, 'Tasa de reacción': { m: 'Tasa de reacción', tasa: true, fem: true, dec: 2 }, 'Tasa de compartido': { m: 'Tasa de compartido', tasa: true, fem: true, dec: 3 }, CTR: { m: 'CTR', tasa: true, dec: 2 } };
function efic(e) {
  if (!e || !e.N) return { c: COL.n, short: '—', txt: 'sin eficacia (sin anuncios de Meta con reacciones)' };
  return { c: COLN[e.color] || COL.n, short: e.p + ' %', txt: `${e.p} % del gasto en rojo (${e.n} de ${e.N})` };
}
// eficacia agregada de varios nodos: gasto en rojo sobre el gasto total evaluado
function eficSuma(es) {
  const v = es.filter(Boolean); if (!v.length) return null;
  const gr = v.reduce((s, e) => s + (e.gr || 0), 0), gt = v.reduce((s, e) => s + (e.gt || 0), 0), n = v.reduce((s, e) => s + e.n, 0), N = v.reduce((s, e) => s + e.N, 0);
  if (!gt || !N) return null;
  const p = Math.round(gr / gt * 100);
  return { p, n, N, gr, gt, color: p < 25 ? 'verde' : p < 50 ? 'amarillo' : p < 75 ? 'naranja' : 'rojo' };
}
const path = (pts) => 'M' + pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L');
const store = (k, def) => { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } };
const keep = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const REASONS = ['No aplica', 'Ya estaba resuelto', 'Decisión del cliente', 'El dato está mal', 'Esperar unos días', 'Otra'];
// Motivos de "hecha a mano" (regla del flujo operativo: siempre hay un motivo). Lista provisoria: el texto lo confirma Juan Pablo;
// se cambia solo acá. texto: true = hay que escribir el detalle (se guarda "Motivo: detalle"). soloMano: viene elegido cuando la
// recomendación es de las que solo se hacen a mano (se puede cambiar).
const MOTIVOS_MANUAL = [
  { label: 'Solo se puede hacer a mano (no es pausar ni cambiar presupuesto)', soloMano: true },
  { label: 'Es de otra plataforma (no Meta)' },
  { label: 'Lo hice como se proponía, pero directo en la plataforma' },
  { label: 'Lo hice distinto a lo propuesto', texto: true },
  { label: 'Hice solo una parte', texto: true },
  { label: 'PAUTADOR lo rechazó o falló y lo hice a mano' },
  { label: 'Otra', texto: true },
];
const motivoManualDe = (i, txt) => { const m = MOTIVOS_MANUAL[i]; if (!m) return null; const t = String(txt || '').trim(); return m.texto ? (t ? `${m.label}: ${t}` : null) : m.label; };
// ¿la app está servida por el servidor local (o Railway)? Abierta con doble clic (file://) no hay repositorio.
const enLinea = () => typeof location !== 'undefined' && /^http/.test(location.protocol) && typeof fetch === 'function';
// Autor de todo lo que se manda al repositorio. En local no hay login: se pide una vez y queda en este navegador (syo.autor);
// si no lo cargan, va "sin identificar". En Railway saldrá de la sesión de PAUTADOR: se cambia solo esta función.
function autorActual(preguntar) {
  let a = store('syo.autor', null);
  if (a == null && preguntar && typeof prompt === 'function') { const r = prompt('¿Quién sos? Tu nombre queda en este navegador y acompaña tus respuestas y comentarios.', ''); a = r == null ? '' : r.trim(); keep('syo.autor', a); }
  return a || 'sin identificar';
}
const fechaCorta = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
const TABS = [['Resumen', 'resumen'], ['Activos', 'activos'], ['Ejes', 'ejes'], ['Campañas', 'campañas'], ['Audiencias', 'audiencias'], ['Insights', 'insights'], ['Looker', 'looker']];
const GUIA = {
  refs: [['General', 'Lo normal en todos los gobiernos, último año, mismo objetivo × formato × placement (en Meta) o misma plataforma × objetivo (en el resto). Aparece en todo.'], ['Proyecto', 'Lo normal en este proyecto y canal, último año. Aparece en todo.'], ['Propia', 'Campañas de 30 días o más y campañas constantes (las que se comunican todo el año): sus propias semanas anteriores.'], ['Temporada anterior', 'Campañas estacionales confirmadas: las mismas semanas del año anterior. Reemplaza a Propia.']],
  colors: [[COL.g, 'none', 'Verde: al menos 20 % mejor que la referencia'], [COL.y, 'none', 'Amarillo: dentro de ±20 %'], [COL.r, 'none', 'Rojo: al menos 20 % peor'], [COL.n, 'none', 'Gris: sin referencia'], ['transparent', '1.5px solid #A6AAA9', 'Vacío: poca historia; la luz aparece desde la tercera semana']],
  kpi: [['Alcance', 'CPM (e impresiones)'], ['Interacción', 'Costo por reacción'], ['Tráfico', 'CTR (costo por click en Costo por objetivo)'], ['Reproducciones (YouTube, TikTok, Google)', 'Costo por reproducción']],
  met: [['Personas alcanzadas (Meta)', 'Personas distintas que vieron la campaña, y cuántas veces la vio cada una en promedio (frecuencia). Lo lee PAUTADOR de Meta cada mañana. Si la campaña está en varias cuentas, Meta no junta las personas entre cuentas: se muestra un rango entre la cuenta que más llegó y la suma de todas (puede contar de más). Si hoy no hay lectura dice "Sin dato de hoy" con el motivo.'], ['Alcance diario acumulado (aproximado)', 'Se muestra solo mientras no haya dato de Meta de hoy. Suma del alcance de cada día: una persona cuenta una vez por cada día que la alcanzan, así que da más que las personas reales. Frecuencia diaria = impresiones ÷ ese alcance.'], ['Costo por reacción', 'Gasto ÷ reacciones. La medida de efectividad de los contenidos.'], ['Tasa de reacción', 'Reacciones ÷ impresiones'], ['Tasa de compartido', 'Compartidas ÷ impresiones (difusión orgánica)'], ['Tasa de comentario', 'Comentarios ÷ impresiones (conversación o polémica)'], ['ETR', 'Engagement ÷ impresiones (en video ≈ reproducciones; en placas ≈ clicks)'], ['CTR', 'Clicks ÷ impresiones'], ['CPM · Costo por click · Costo por reproducción', 'Gasto ÷ …'], ['Video: retención 25/50/75/100 %', 'Reproducciones al X % ÷ reproducciones'], ['Pagó $X más que lo habitual', 'Lo gastado por encima de lo que habría costado lo mismo (impresiones, reacciones o clicks, según el objetivo) a los costos habituales del proyecto. No tiene relación con el presupuesto.'], ['Eficacia', 'Regla de Looker: cada anuncio de Meta contra los de su mismo objetivo y placement del proyecto en su misma época; rojo = entre el 25 % más caro por reacción. Se resume como % del gasto en anuncios rojos.']],
  blocks: [['Gasto del mes', 'Inversión contra tiempo, con el PresupuestoMensual de DataJunta y la proyección al cierre (promedio de los últimos 2 días completos).'], ['Revisar campañas', 'Vivas, con alguna luz en rojo, ordenadas por plata en juego, con la acción sugerida.'], ['Ejes · Audiencias · Activos', 'Tablas anidadas con logos de plataforma, Impresiones · Reproducciones · Reacciones · Gasto y Eficacia (en Activos, activo → campaña con su Salud: ritmo de gasto y restante del pedido). Ejes: eje → campaña → pieza → anuncio. Audiencias: audiencia → campaña → pieza. Activos: activo → campaña. Cambian con el período.'], ['Acciones', 'Problema → Solución, qué está afectado (campaña, contenido, conjuntos de anuncios) y qué revisar. Se envían a PAUTADOR, se marcan hechas a mano o se descartan con motivo.'], ['Looker', 'El tablero de Looker Studio del proyecto, embebido. El link de inserción se carga una vez por proyecto y canal.']],
  src: [['DataJunta, Meta', 'Copia diaria de 180 días (9:10).'], ['DataJunta, todas las plataformas', 'Últimos 180 días por día: Google Ads, DV360, TikTok, SMS.'], ['Alcance', 'Tablas de Meta (FBADS_TABLERO_META) por anuncio y día, cruzadas con DataJunta.'], ['Eficacia', 'automatizado.eficacia_anuncios, regenerada todos los días (9:20). Misma regla que Looker, con ventana móvil y mínimo 12 anuncios.'], ['Referencias', 'Generales y por proyecto: último año. Propias: semanales, desde 2024. Por plataforma (fuera de Meta): últimos 180 días.'], ['Presupuesto', 'PresupuestoMensual de DataJunta, por proyecto y canal.'], ['Último día completo', 'DataJunta carga a las 8:00 el día anterior.']],
};

// ---------- gráficos ----------
function budgetView(b, diasMes, mesPrevio) {
  const B = b.presu, spent = b.gastado, proj = b.proyeccion, days = b.acum.length;
  const pts = [[0, 0], ...b.acum.map((v, i) => [i + 1, v])];
  const maxV = Math.max(B, proj) * 1.12;
  const X = (d) => d / diasMes * 400, Y = (v) => 150 - v / maxV * 140;
  const pct = Math.round(proj / B * 100);
  const color = pct > 102 ? COL.r : pct < 85 ? COL.y : COL.g;
  const txt = pct > 102 ? 'por encima del presupuesto' : pct < 85 ? 'por debajo del presupuesto' : 'en línea con el presupuesto';
  const timePoly = `0,150 ${X(days)},${Y(B * days / diasMes)} ${X(days)},150`;
  const den = Math.max(B, proj) * 1.08;
  const out = {
    name: b.name, color, proyPct: pct, proyTxt: txt, invPct: Math.round(spent / B * 100), invTxt: `${fMs(spent)} de ${fMs(B)}`,
    timePoly, spentW: (spent / den * 100) + '%', projW: (proj / den * 100) + '%', timeL: (B * days / diasMes / den * 100) + '%', budgetL: (B / den * 100) + '%',
    endX: X(days), endY: Y(spent), budgetY: Y(B), budgetLabelY: Y(B) - 6, budgetTxt: 'Presupuesto ' + fMs(B),
    gastoC: { title: 'Evolución del gasto', poly: timePoly, main: path(pts.map((p) => [X(p[0]), Y(p[1])])), proj: path([[X(days), Y(spent)], [X(diasMes), Y(proj)]]), showRef: true, refY: Y(B), showPrev: false, prev: '', endX: X(days), endY: Y(spent), label: 'Presupuesto ' + fMs(B), labelY: Y(B) - 6, refLegend: 'Presupuesto', refStyle: 'dotted #A6AAA9' },
    foot: `Cierra en ${fMs(proj)} al ritmo de ${fMs(b.ritmo)} por día (promedio de los últimos 2 días completos).`,
  };
  if (b.imp && b.imp.actual.length) {
    const act = b.imp.actual, prev = b.imp.previo, imps = act[act.length - 1], iProj = imps + (act[act.length - 1] - (act[act.length - 3] || 0)) / 2 * (diasMes - days);
    const mI = Math.max(iProj, prev[prev.length - 1] || 0, 1) * 1.12, YI = (v) => 150 - v / mI * 140;
    out.impC = { title: 'Evolución de impresiones', poly: '0,150 0,150 0,150', main: path([[0, YI(0)], ...act.map((v, i) => [X(i + 1), YI(v)])]), proj: path([[X(days), YI(imps)], [X(diasMes), YI(iProj)]]), showRef: false, refY: 0, showPrev: true,
      prev: path([[0, YI(0)], ...prev.map((v, i) => [X(i + 1), YI(v)])]), endX: X(days), endY: YI(imps), label: `${mesPrevio[0].toUpperCase() + mesPrevio.slice(1)} ${fM(prev[prev.length - 1] || 0)}`, labelY: YI(prev[prev.length - 1] || 0) - 6, refLegend: mesPrevio, refStyle: 'solid #D5D5D5' };
  } else out.impC = { ...out.gastoC, title: 'Evolución de impresiones', main: '', proj: '', showRef: false, showPrev: false, label: 'Sin datos de impresiones' };
  return out;
}
function histView(h) {
  const ws = (h.semanas || []).filter((w) => w.x != null).slice(-12);
  const vals = ws.map((w) => w.x);
  const max = Math.max(1.2, ...vals, h.ref ? h.ref.p75 * 1.2 : 0) * 1.05;
  const Y = (v) => 180 - v / max * 160, n = Math.max(1, ws.length), step = 610 / n, bw = Math.min(44, step * 0.7);
  return {
    bandY: h.ref ? Y(h.ref.p75) : 0, bandH: h.ref ? Y(h.ref.p25) - Y(h.ref.p75) : 0, medY: h.ref ? Y(h.ref.p50) : -10,
    bars: ws.map((w, i) => ({ x: 30 + i * step + (step - bw) / 2, cx: 30 + i * step + step / 2, y: Y(w.x), h: 180 - Y(w.x), w: bw, c: i >= ws.length - 2 ? '#3C3C3C' : '#D5D5D5', label: dm(w.s), val: fx(w.x), ty: Y(w.x) - 6 })),
  };
}
function sparkView(serie) {
  const pts = (serie || []).slice(-45);
  const max = Math.max(1, ...pts);
  return path(pts.map((v, i) => [i / Math.max(1, pts.length - 1) * 220, 38 - v / max * 34]));
}
const NET = { Facebook: '#1877F2', Instagram: '#D62976', YouTube: '#FF0000', DV360: '#34A853', TikTok: '#111111', Google: '#4285F4' };
// vista previa: Facebook (plugin), Instagram (embed), YouTube (embed); TikTok solo link
function embedsDe(pz) {
  const out = [];
  if (!pz) return out;
  const fb = pz.fb, ig = pz.ig, yt = pz.yt, tt = pz.tt, otro = pz.otro;
  if (fb) out.push({ red: 'Facebook', c: NET.Facebook, url: fb, src: `https://www.facebook.com/plugins/${/\/(reel|videos|watch)\b|fb\.watch/.test(fb) ? 'video' : 'post'}.php?href=${encodeURIComponent(fb)}&show_text=true&width=340`, h: /\/(reel|videos|watch)\b/.test(fb) ? '600px' : '520px' });
  if (ig) { const m = ig.match(/instagram\.com\/(p|reel|tv)\/([^/?#]+)/); out.push({ red: 'Instagram', c: NET.Instagram, url: ig, src: m ? `https://www.instagram.com/${m[1]}/${m[2]}/embed/` : '', h: '560px' }); }
  if (yt) { const m = yt.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{6,})/); out.push({ red: 'YouTube', c: NET.YouTube, url: yt, src: m ? `https://www.youtube.com/embed/${m[1]}` : '', h: '315px' }); }
  if (tt) out.push({ red: 'TikTok', c: NET.TikTok, url: tt, src: '', h: '0' });
  if (!out.length && otro) out.push({ red: 'Link', c: '#808080', url: otro, src: '', h: '0' });
  return out.map((e) => ({ ...e, noSrc: !e.src, nota: e.src ? '' : 'Esta pieza tiene link pero no vista previa embebida' }));
}
// link de Looker Studio: si pegan el <iframe> entero o el link "reporting/…", se lleva a la forma embebible
function lookerSrcDe(txt) {
  const m = String(txt || '').match(/https:\/\/(?:lookerstudio\.google\.com|datastudio\.google\.com)\/(?:embed\/)?(?:u\/\d+\/)?reporting\/[^\s"'<>]+/);
  if (!m) return '';
  return m[0].replace(/\/(?:u\/\d+\/)?reporting\//, '/embed/reporting/').replace(/lookerstudio\.google\.com\/(?!embed)/, 'lookerstudio.google.com/embed/');
}
const SIN_SALUD = { hay: false, ritmo: '', dot: '', bg: 'transparent', restante: '', w: '0%', hayBarra: false, titulo: '' };
// Campañas: "Todas" = las que tuvieron gasto en el período; "Finalizadas" = las que ya terminaron; "Activas" = siguen al aire
// tipo de campaña: constante (todo el año) · estacional (vuelve en la misma época) · larga (ninguna de las dos y 30 días o más; tiene luz
// Propia contra sus semanas anteriores) · puntual (ninguna de las dos y menos de 30 días). Constante/estacional las confirma el usuario.
const FILTROS_CAMP = [['Todas', () => true], ['Activas', (c) => c.act], ['Finalizadas', (c) => !c.act], ['Constantes', (c) => c.tipo === 'constante'], ['Estacionales', (c) => c.tipo === 'estacional'], ['Largas', (c) => c.tipo === 'larga'], ['Puntuales', (c) => c.tipo === 'puntual']];
const TAG_TIPO = { constante: 'constante', estacional: 'estacional', larga: 'larga', puntual: 'puntual' };
// decisiones guardadas antes ("es estacional / no es") pasan al esquema nuevo
const tiposGuardados = () => { const t = store('syo.tipos', null); if (t) return t; const v = store('syo.seasonal', {}); return Object.fromEntries(Object.entries(v).filter(([, x]) => x).map(([k, x]) => [k, x === 'si' ? 'estacional' : 'ninguna'])); };
const chipsDe = (codes) => codes.map((code) => ({ code, name: DATA.nombres[code] || code, icon: DATA.logos[code] || DATA.logos.OT }));
const conLogo = (plats) => (plats || []).map((p) => ({ ...p, icon: DATA.logos[p.code] || DATA.logos.OT }));
const sumO = (rows) => rows.reduce((o, r) => { o.i += r.i || r.imp || 0; o.vw += r.vw || 0; o.r += r.r || r.rea || 0; o.g += r.g || r.gasto || 0; o.xr += r.xr || 0; o.xg += r.xg || 0; return o; }, { i: 0, vw: 0, r: 0, g: 0, xr: 0, xg: 0 });

class Component extends DCLogic {
  state = {
    screen: 'portada', tab: 'resumen', canal: store('syo.canal', 'Oficial'), pid: null, campId: null,
    panel: false, panelCamp: null, tipos: tiposGuardados(), campFilter: 'Todas', sel: null, st: store('syo.st', {}), discardFor: null, otraFor: null, otraTxt: '', regla: {}, help: {},
    manualFor: null, manualMot: null, manualTxt: '', reglaDraft: {}, respReglas: [], autorV: 0,
    period: DATA.mes, abierto: {}, busca: '',
    campTab: 'Contenidos', modal: null, pieza: null, comments: store('syo.comments', {}), draft: '', toast: null, bMetric: 'Gasto', looker: store('syo.looker', {}),
    w: typeof window !== 'undefined' ? window.innerWidth : 1400, hv: typeof window !== 'undefined' ? window.innerHeight : 900,
  };
  componentDidMount() {
    this.onR = () => this.setState({ w: window.innerWidth, hv: window.innerHeight }); window.addEventListener('resize', this.onR);
    this.onS = () => this.ubicarLooker(); document.addEventListener('scroll', this.onS, true); window.addEventListener('resize', this.onS);
    this.cargarRespuestas();
  }
  // comentarios a las reglas vigentes que ya están en el repositorio (GET /api/respuestas)
  cargarRespuestas() {
    if (!enLinea()) return;
    fetch('/api/respuestas').then((r) => r.json()).then((xs) => this.setState({ respReglas: (Array.isArray(xs) ? xs : []).filter((x) => x && x.clase === 'regla' && x.regla && x.comentario) })).catch(() => {});
  }
  comentarRegla(id) {
    const txt = String(this.state.reglaDraft[id] || '').trim(); if (!txt) return;
    if (!enLinea()) { this.say('Sin servidor local: abrí la app por http://localhost:4330 para comentar'); return; }
    const p = this.proj();
    this.enviar({ clase: 'regla', regla: id, comentario: txt });
    const reg = { clase: 'regla', regla: id, comentario: txt, autor: autorActual(false), proyecto: p ? p.nombre : null, canal: this.state.canal, recibido: new Date().toISOString() };
    this.setState((s) => ({ respReglas: [...s.respReglas, reg], reglaDraft: { ...s.reglaDraft, [id]: '' } }));
    this.say('Comentario guardado');
  }
  componentWillUnmount() { window.removeEventListener('resize', this.onR); document.removeEventListener('scroll', this.onS, true); window.removeEventListener('resize', this.onS); clearTimeout(this.tt); clearTimeout(this.lookerT); if (this.lookerCaja) this.lookerCaja.remove(); }
  // el iframe de Looker vive fuera del template (se crea una vez) y se posiciona sobre #looker-slot; así los re-renders no lo recargan
  ubicarLooker() {
    if (typeof document === 'undefined' || !document.getElementById) return;
    const s = this.state, b = this.blk();
    const src = b ? (s.looker[`${s.pid}|${s.canal}`] || (DATA.lookers || {})[`${s.pid}|${s.canal}`] || '') : '';
    const slot = s.screen === 'proyecto' && s.tab === 'looker' && !s.modal && !s.panel && src ? document.getElementById('looker-slot') : null;
    let caja = this.lookerCaja, f = this.lookerFrame;
    if (!slot) {
      if (caja) caja.style.display = 'none';
      // si la pestaña Looker está abierta pero su hueco todavía no está en el DOM (el render llega después), se reintenta;
      // sin esto el tablero quedaba con el alto provisorio y sin ubicar hasta que el usuario scrolleaba
      const esperando = s.screen === 'proyecto' && s.tab === 'looker' && !s.modal && !s.panel && !!src;
      if (esperando && (this.lookerIntentos = (this.lookerIntentos || 0) + 1) <= 40) { clearTimeout(this.lookerT); this.lookerT = setTimeout(() => this.ubicarLooker(), 50); }
      else if (!esperando) { this.lookerEntrado = false; this.lookerIntentos = 0; }
      return;
    }
    this.lookerIntentos = 0;
    if (!caja) {
      // caja fija que recorta (para que el tablero no se meta debajo del encabezado pegajoso) + iframe adentro
      caja = this.lookerCaja = document.createElement('div');
      caja.style.cssText = 'position:fixed;overflow:hidden;border:1px solid #E4E4E4;border-radius:12px;background:#FFFFFF;z-index:5;display:none';
      f = this.lookerFrame = document.createElement('iframe');
      f.setAttribute('allowfullscreen', ''); f.setAttribute('sandbox', 'allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
      f.style.cssText = 'position:absolute;left:0;border:0;background:#FFFFFF';
      caja.appendChild(f); document.body.appendChild(caja);
    }
    if (f.dataset.src !== src) { f.dataset.src = src; f.src = src; }
    const head = document.querySelector('header'); const tope = head ? head.getBoundingClientRect().bottom : 0;
    const main = slot.closest('main') || slot.parentElement;
    // Regla: el tablero SIEMPRE entra en la ventana, en cualquier monitor. Su caja va desde debajo de la barra superior (o desde
    // donde esté la pestaña, si se ve) hasta el borde inferior de la ventana. El informe también entra entero, sin la barra de scroll
    // de Looker: el lienzo de los tableros es de 1200 × 900 y Looker lo escala al ancho del iframe (menos su barra de páginas),
    // así que el ancho sale del alto disponible. Va centrado. No depende de que la página haya scrolleado.
    const LIENZO = 1200 / 900, NAV = 48, HOLGURA = 8, BORDE = 10;
    const anchoPara = (alto) => Math.round((alto - HOLGURA) * LIENZO + NAV);
    const titulo = document.getElementById('looker-titulo');
    if (titulo) { titulo.style.position = 'fixed'; titulo.style.visibility = 'hidden'; }
    // alto del hueco en la página: lo que queda de ventana debajo de la barra, para que la pestaña pueda quedar pegada a ella
    const medir = () => { const arriba = slot.getBoundingClientRect().top - main.getBoundingClientRect().top; const H = Math.max(240, window.innerHeight - tope - arriba - 12); slot.style.height = H + 'px'; return { H, r: slot.getBoundingClientRect() }; };
    let { H, r } = medir();
    let enMargen = false;
    if (titulo) {
      enMargen = (r.width - Math.min(r.width, anchoPara(H))) / 2 >= 100;
      if (!enMargen) { titulo.style.position = 'static'; titulo.style.visibility = 'visible'; ({ H, r } = medir()); }
    }
    // al entrar, la página scrollea sola hasta dejar la pestaña pegada debajo de la barra (tapa el nombre del proyecto y las
    // pestañas). Va después de fijar el alto del hueco: antes la página no era lo bastante alta y el scroll quedaba a medias.
    if (!this.lookerEntrado) { this.lookerEntrado = true; window.scrollTo(0, Math.max(0, window.scrollY + main.getBoundingClientRect().top - tope)); r = slot.getBoundingClientRect(); }
    const top = Math.max(r.top, tope + 2), fondo = Math.min(r.top + H, window.innerHeight - BORDE), disponible = Math.max(0, fondo - top);
    const W = Math.min(r.width, anchoPara(disponible)), left = r.left + (r.width - W) / 2;
    // si lo que limita es el ancho (ventana angosta), el alto se achica para no dejar un hueco debajo del informe
    const alto = Math.min(disponible, Math.round((W - NAV) / LIENZO + HOLGURA));
    caja.style.left = left + 'px'; caja.style.top = top + 'px'; caja.style.width = W + 'px'; caja.style.height = alto + 'px'; caja.style.display = alto > 120 ? 'block' : 'none';
    f.style.top = '0px'; f.style.width = W + 'px'; f.style.height = alto + 'px';
    if (titulo && enMargen) { titulo.style.left = r.left + 'px'; titulo.style.top = top + 'px'; titulo.style.width = Math.max(80, left - r.left - 16) + 'px'; titulo.style.whiteSpace = 'normal'; titulo.style.visibility = alto > 120 ? 'visible' : 'hidden'; }
  }
  say(msg) { clearTimeout(this.tt); this.setState({ toast: msg }); this.tt = setTimeout(() => this.setState({ toast: null }), 2600); }
  proj() { return DATA.proyectos.find((p) => p.id === this.state.pid) || null; }
  blk() { const p = this.proj(); return p ? p.canales[this.state.canal] || null : null; }
  setAct(id, patch) { this.setState((s) => { const st = { ...s.st, [id]: { ...(s.st[id] || {}), ...patch } }; keep('syo.st', st); return { st }; }); this.registrar(id); }
  // Repositorio de respuestas (para que el agente aprenda qué recomendaciones sirven): cada cambio sobre una recomendación se manda
  // al servidor local, que lo agrega a repositorio/respuestas.jsonl. Espera 1,5 s para no mandar una línea por cada tecla del comentario.
  // Abierta con doble clic (file://) no hay servidor: queda solo en el navegador y en "Exportar comentarios".
  enviar(reg) {
    if (!enLinea()) return;
    const s = this.state, p = this.proj(), autor = autorActual(true);
    fetch('/api/respuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...reg, autor, proyecto: p ? p.nombre : null, canal: s.canal, datos_al: DATA.datosHasta }) }).catch(() => {});
  }
  registrar(id) {
    this.regT = this.regT || {}; clearTimeout(this.regT[id]);
    const b = this.blk(); const a = b ? b.acciones.find((x) => x.id === id) : null; if (!a) return;
    this.regT[id] = setTimeout(() => { const x = this.state.st[id] || {};
      this.enviar({ clase: 'recomendacion', id, tipo: a.tipo, titulo: a.title, campana: a.afectado.campana || a.camp || null, solucion: a.solucion,
        decision: x.status === 'sent' ? 'enviada a PAUTADOR' : x.status === 'manual' ? 'hecha a mano' : x.status === 'discarded' ? 'descartada' : 'pendiente', motivo: x.status === 'discarded' || x.status === 'manual' ? x.reason || null : null, sirve: x.op || null, comentario: x.comment || null }); }, 1500);
  }
  resolve(id, status, reason) {
    // hecha a mano y descartada van siempre con motivo: sin motivo no se confirma
    if ((status === 'manual' || status === 'discarded') && !String(reason || '').trim()) { this.say('Falta el motivo'); return; }
    this.setAct(id, { status, reason: reason || null, fecha: new Date().toISOString() });
    this.setState((s) => {
      const b = this.blk(); const next = b ? b.acciones.find((a) => a.id !== id && (s.st[a.id]?.status || 'pending') === 'pending') : null;
      return { discardFor: null, otraFor: null, otraTxt: '', manualFor: null, manualMot: null, manualTxt: '', sel: s.sel === id && next ? next.id : s.sel };
    });
    this.say(status === 'sent' ? 'Enviada a PAUTADOR' : status === 'manual' ? 'Marcada como hecha a mano · ' + reason : 'Descartada · ' + reason);
  }
  screenKey() { const s = this.state, p = this.proj(); return s.screen === 'guia' ? 'Cómo leer' : s.screen === 'portada' ? 'Mis proyectos' : s.screen === 'campana' ? `${p.nombre} · ${s.canal} · Campaña · ${s.campId}` : `${p.nombre} · ${s.canal} · ${s.tab}`; }
  irCampana(id) {
    const b = this.blk();
    if (b && b.campanas[id]) this.setState({ screen: 'campana', campId: id, panel: false, panelCamp: null, campTab: 'Contenidos' });
    else this.say('Esta campaña no tiene detalle: terminó hace más de 60 días');
  }
  toggleNodo(k) { this.setState((s) => ({ abierto: { ...s.abierto, [k]: !s.abierto[k] } })); }

  // ---------- tabla anidada: nivel 1 → campañas → (piezas → anuncios | audiencias) ----------
  // nivel1: [{ key, name, plats, porCamp: { campId: filas } }]; cada fila tiene cod/name (pieza o audiencia), codes, g/i/r/vw/xr/xg y opcionalmente pieza/ef
  arbol(nivel1, PD, b, opts) {
    const s = this.state, q = s.busca.trim().toLowerCase();
    const hit = (txt) => !q || String(txt || '').toLowerCase().includes(q);
    const campById = Object.fromEntries(PD.campRows.map((c) => [c.id, c]));
    const anuncios = opts.conAnuncios ? b.anuncios : [];
    const nodo = (key, name, plats, o, kids, extra) => {
      const open = q ? true : !!s.abierto[key];
      const kidsV = kids.filter((k) => k.visible);
      const visible = hit(name) || hit(extra.sub || '') || kidsV.length > 0;
      return { key, name, sub: extra.sub || '', plats, n: kids.length, hasN: kids.length > 0, hasLink: !!extra.onLink, onLink: extra.onLink || null, open, chev: open ? '▾' : '▸',
        toggle: () => this.toggleNodo(key), hasKids: kidsV.length > 0, sinKids: kidsV.length === 0, kids: open ? kidsV : [], visible,
        imp: fN(o.i), vw: o.vw ? fN(o.vw) : '—', rea: o.r ? fN(o.r) : '—', gasto: fMs(o.g), ef: efic(extra.ef || null), salud: extra.salud || SIN_SALUD, nCamp: extra.nCamp ?? '', nCont: extra.nCont ?? '', hasPieza: !!extra.pieza, onPieza: extra.pieza ? () => this.setState({ modal: 'pieza', pieza: extra.pieza }) : null, o, efRaw: extra.ef || null };
    };
    const anunciosDe = (com, cod, pre) => anuncios.filter((a) => a.com === com && a.cod === cod).map((a) => nodo(`${pre}|${a.nombre}`, a.corto, chipsDe([a.code]), sumO([a]), [], { sub: a.obj, ef: null }));
    const hojasDe = (com, filas, pre) => Object.values(filas.reduce((m, r) => { const k = r.cod; (m[k] = m[k] || { cod: k, name: r.name, codes: new Set(), rows: [], pieza: r.pieza, ef: [] }); m[k].rows.push(r); (r.codes || [r.code]).forEach((c) => c && m[k].codes.add(c)); if (r.ef) m[k].ef.push(r.ef); return m; }, {}))
      .sort((a, c) => sumO(c.rows).i - sumO(a.rows).i).slice(0, 30)
      .map((p) => nodo(`${pre}|${p.cod}`, p.name, chipsDe([...p.codes]), sumO(p.rows), opts.conAnuncios ? anunciosDe(com, p.cod, `${pre}|${p.cod}`) : [], { sub: opts.sinSub ? '' : p.cod, ef: eficSuma(p.ef), pieza: p.pieza || null }));
    const campNodo = (id, filas, pre, n1) => {
      const c = campById[id]; if (!c) return null;
      const kids = opts.sinHojas ? [] : hojasDe(id, filas, `${pre}|${id}`);
      return nodo(`${pre}|${id}`, c.name, conLogo(c.plats), sumO(filas), kids, { sub: c.obj, ef: c.ef, onLink: c.detalle ? () => this.irCampana(id) : null, nCont: n1.contDe ? fN(n1.contDe(id)) : '' });
    };
    const nivel = (n) => {
      const kids = Object.entries(n.porCamp).map(([id, filas]) => campNodo(id, filas, n.key, n)).filter(Boolean).sort((a, c) => c.o.i - a.o.i);
      return { ...nodo(n.key, n.name, n.plats, sumO(kids.map((k) => k.o)), kids, { ef: eficSuma(kids.map((k) => k.efRaw)), salud: n.salud, sub: n.sub, nCamp: n.nCont !== undefined ? String(kids.length) : '', nCont: n.nCont !== undefined ? fN(n.nCont) : '' }), keep: !!n.keep, ...(opts.sinHojas ? { hasN: false } : {}) };
    };
    return nivel1.map(nivel).filter((n) => n.visible && (n.o.i > 0 || n.keep)).sort((a, c) => c.o.i - a.o.i);
  }

  renderVals() {
    const s = this.state, p = this.proj(), b = this.blk();
    const narrow = s.w < 1100;
    const helpKeys = ['pubs', 'ejes', 'aud', 'portada', 'gasto', 'camp', 'imp', 'rend', 'crend', 'hist', 'camps', 'activos', 'ins', 'lleg'];
    const h = {}; helpKeys.forEach((k) => { h[k] = { open: !!s.help[k], toggle: () => this.setState((st) => ({ help: { ...st.help, [k]: !st.help[k] } })) }; });
    // Resumen variante B (tablero): los bloques plegables arrancan abiertos
    const o = {}; ['mas', 'video', 'piezas', 'picos', 'costo'].forEach((k) => { const open = s.open?.[k] ?? true; o[k] = { open, label: open ? 'Ocultar' : 'Mostrar', toggle: () => this.setState((st) => ({ open: { ...(st.open || {}), [k]: !(st.open?.[k] ?? true) } })) }; });
    const full = '1 / -1';
    // Resumen variante B · tablero: el diseño curado tiene dos bloques (Gasto del mes y Revisar campañas) → van lado a lado en tarjetas.
    // Con un solo presupuesto el gasto ocupa un tercio; con dos o más, la mitad (para que entren sus tarjetas una al lado de la otra).
    const nPresu = b ? b.budgets.length : 1;
    const L = { max: '1440px', cols: narrow ? 'minmax(0,1fr)' : 'repeat(12,minmax(0,1fr))', gap: '16px', card: '1px solid #E4E4E4', pad: '20px', pad2: '20px', fold: '1px solid #E4E4E4', rowPad: '11px 0',
      tileMin: '128px', tilePad: '12px 14px', val: '20px', big: '24px', innerBd: 'none', innerBg: '#F7F7F7', badgeBg: '#FFFFFF',
      o: { gasto: 1, camp: 2, imp: 3, rend: 4, piezas: 5, picos: 6, costo: 7 },
      s: { gasto: narrow ? full : nPresu >= 2 ? 'span 6' : 'span 4', camp: narrow ? full : nPresu >= 2 ? 'span 6' : 'span 8', imp: full, rend: full, piezas: full, picos: full, costo: full } };
    const P = { w: narrow ? '100%' : '1120px', isB: true, pad: '28px 36px 40px', cardBd: 'none', cardPad: '0', titleFs: '22px', showResolvedBelow: false };
    const datosAl = dm(DATA.datosHasta);
    const mesTxt = DATA.mesTxt[0].toUpperCase() + DATA.mesTxt.slice(1);

    // ---- acciones ----
    const acciones = b ? b.acciones : [];
    const statusOf = (a) => s.st[a.id]?.status || 'pending';
    // tipo efectivo de una campaña: lo que eligió el usuario en Insights o, si no eligió, lo sugerido por los datos
    const tipoDe = (id, sug, larga) => { const d = s.tipos[`${s.pid}|${s.canal}|${id}`]; const t = d || sug || ''; return t === 'constante' || t === 'estacional' ? t : larga ? 'larga' : 'puntual'; };
    const tipoCamp = (id) => { const c = b && b.campanas[id]; return c ? tipoDe(id, c.hist ? c.hist.sug : '', !!c.hist && c.hist.span >= 30) : ''; };
    // botones Constante · Estacional · Ninguna de una campaña (en Insights y en el encabezado de la campaña); gris = sugerido, negro = confirmado
    const tipoOps = (id, sug, larga) => { const key = `${s.pid}|${s.canal}|${id}`, d = s.tipos[key], actual = d || sug || 'ninguna';
      const set = (v) => { this.setState((st) => { const tipos = { ...st.tipos, [key]: v }; keep('syo.tipos', tipos); return { tipos }; }); this.enviar({ clase: 'tipo_campana', campana: id, tipo: v === 'ninguna' ? (larga ? 'larga' : 'puntual') : v, sugerido: sug || null }); };
      return { confirmado: !!d, ops: [['constante', 'Constante'], ['estacional', 'Estacional'], ['ninguna', larga ? 'Larga' : 'Puntual']].map(([k, label]) => { const on = actual === k; return { label, bg: on ? (d ? '#3C3C3C' : '#FFFFFF') : 'transparent', color: on && d ? '#FFFFFF' : '#3C3C3C', shadow: on && !d ? 'var(--shadow-sm)' : 'none', onClick: () => set(k) }; }) }; };
    // luces de una fila según su tipo: la estacional se compara con la temporada anterior; el resto con su propia historia
    const lucesDe = (c, tipo) => { const est = tipo === 'estacional' && c.lt !== undefined; const tercera = est ? c.lt : c.lp; return lucesCortas(lightsOf([c.l[0], c.l[1], ...(tercera !== undefined ? [tercera] : [])], est, dCosto(c.obj), dKpi(c.obj))); };
    const pending = acciones.filter((a) => statusOf(a) === 'pending' && !(a.tipo === 'Peor que la temporada anterior' && tipoCamp(a.campId) !== 'estacional'));
    const resolvedActs = acciones.filter((a) => statusOf(a) !== 'pending');
    const openPanelAt = (id, camp) => this.setState({ panel: true, sel: id || s.sel, panelCamp: camp || null, discardFor: null });
    const panelList = s.panelCamp ? pending.filter((a) => a.campId === s.panelCamp) : pending;
    const verPieza = (pz) => this.setState({ modal: 'pieza', pieza: pz });
    const cardView = (a) => {
      const x = s.st[a.id] || {};
      // vía: solo "por PAUTADOR" o "a mano" (redaccion.js ya no manda "parte a mano")
      return {
        ...a, via: a.via === 'manual' ? 'Se hace a mano' : 'Se puede hacer desde PAUTADOR',
        hasPiezas: false, piezas: [], que: a.problema, hacer: a.solucion,
        hasAfectado: !!(a.afectado.campana || a.afectado.contenidos.length || a.afectado.conjuntos.length), afCampana: a.afectado.campana || '',
        hasContenidos: a.afectado.contenidos.length > 0, contenidos: a.afectado.contenidos.map((c) => ({ label: (c.rol ? c.rol + ' — ' : '') + c.nombre, onClick: () => verPieza(c.pieza) })),
        hasConj: a.afectado.conjuntos.length > 0, conjuntos: a.afectado.conjuntos, hasRevisar: a.revisar.length > 0, revisar: a.revisar.map((t) => ({ txt: t })),
        // sendBlocked/sendTitle/sendCursor/sendOpacity los usa el markup del diseño exportado: van fijos (el botón nunca se bloquea)
        showSend: a.via !== 'manual', sendBlocked: false, sendTitle: '', sendCursor: 'pointer', sendOpacity: 1,
        onSend: () => this.resolve(a.id, 'sent'),
        // "Hecho a mano" abre la elección del motivo (si la recomendación solo se hace a mano, viene elegido "Solo se puede hacer a mano")
        onManual: () => this.setState((st) => (st.manualFor === a.id ? { manualFor: null, manualMot: null, manualTxt: '' }
          : { manualFor: a.id, manualMot: a.via === 'manual' ? MOTIVOS_MANUAL.findIndex((m) => m.soloMano) : null, manualTxt: '', discardFor: null, otraFor: null, otraTxt: '' })),
        ...(() => { const abierto = s.manualFor === a.id, mot = abierto ? MOTIVOS_MANUAL[s.manualMot] : null, listo = abierto && !!motivoManualDe(s.manualMot, s.manualTxt);
          return { manualOpen: abierto,
            motivosManual: MOTIVOS_MANUAL.map((m, i) => { const on = abierto && s.manualMot === i; return { label: m.label + (m.texto ? '…' : ''), bg: on ? '#3C3C3C' : '#FFFFFF', color: on ? '#FFFFFF' : '#3C3C3C', bd: on ? '#3C3C3C' : '#D5D5D5', onClick: () => this.setState({ manualMot: i, manualTxt: '' }) }; }),
            manualPideTxt: !!(mot && mot.texto), manualTxt: abierto ? s.manualTxt : '', onManualTxt: (e) => this.setState({ manualTxt: e.target.value }),
            manualPh: mot && mot.texto ? (mot.label === 'Otra' ? 'Escribí el motivo…' : mot.label === 'Hice solo una parte' ? 'Contá qué parte hiciste…' : 'Contá qué hiciste…') : '',
            manualCursor: listo ? 'pointer' : 'not-allowed', manualOpacity: listo ? 1 : 0.4,
            onManualOk: () => { const r = motivoManualDe(this.state.manualMot, this.state.manualTxt); if (r) this.resolve(a.id, 'manual', r); } }; })(),
        onDiscard: () => this.setState((st) => ({ discardFor: st.discardFor === a.id ? null : a.id, otraFor: null, otraTxt: '', manualFor: null, manualMot: null, manualTxt: '' })), discardOpen: s.discardFor === a.id,
        reasons: REASONS.map((r) => { const on = r === 'Otra' && s.otraFor === a.id; return { label: r, bg: on ? '#3C3C3C' : '#FFFFFF', color: on ? '#FFFFFF' : '#3C3C3C', bd: on ? '#3C3C3C' : '#D5D5D5',
          onClick: () => (r === 'Otra' ? this.setState({ otraFor: on ? null : a.id, otraTxt: '' }) : this.resolve(a.id, 'discarded', r)) }; }),
        otraOpen: s.otraFor === a.id, otraTxt: s.otraFor === a.id ? s.otraTxt : '', onOtraTxt: (e) => this.setState({ otraTxt: e.target.value }),
        otraCursor: s.otraTxt.trim() ? 'pointer' : 'not-allowed', otraOpacity: s.otraTxt.trim() ? 1 : 0.4,
        onOtraOk: () => { const t = s.otraTxt.trim(); if (t) this.resolve(a.id, 'discarded', 'Otra: ' + t); },
        reglaOpen: !!s.regla[a.id], reglaLabel: (s.regla[a.id] ? '▾' : '▸') + ' Cómo lo detectamos', toggleRegla: () => this.setState((st) => ({ regla: { ...st.regla, [a.id]: !st.regla[a.id] } })),
        onCamp: (e) => { e && e.preventDefault(); if (a.campId) this.irCampana(a.campId); else this.setState({ screen: 'proyecto', tab: 'activos', panel: false }); },
        ops: ['Sí', 'No', 'Falta un dato'].map((lab) => { const on = x.op === lab; return { label: lab, bg: on ? '#3C3C3C' : '#FFFFFF', color: on ? '#FFFFFF' : '#3C3C3C', bd: on ? '#3C3C3C' : '#D5D5D5', onClick: () => this.setAct(a.id, { op: on ? null : lab }) }; }),
        comment: x.comment || '', onComment: (e) => this.setAct(a.id, { comment: e.target.value }),
      };
    };
    const selAct = panelList.find((a) => a.id === s.sel) || panelList[0];
    const cards = selAct ? [cardView(selAct)] : [];

    // ---- portada ----
    const projects = DATA.proyectos.filter((pr) => pr.canales[s.canal]).map((pr) => {
      const t = pr.canales[s.canal].tarjeta, nPend = pr.canales[s.canal].acciones.filter((a) => (s.st[a.id]?.status || 'pending') === 'pending').length;
      return { name: pr.nombre, gasto: t.presu ? `${fMs(t.gastado)} de ${fMs(t.presu)}` : `${fMs(t.gastado)} · sin PresupuestoMensual cargado`, bar: (t.presu ? Math.min(100, Math.round(t.gastado / t.presu * 100)) : 0) + '%',
        vivas: `${t.vivas} · ${t.porVencer ? t.porVencer + (t.porVencer === 1 ? ' termina' : ' terminan') + ' esta semana' : 'ninguna termina esta semana'}`, acc: nPend === 0 ? 'No hay acciones pendientes' : nPend,
        hasProy: t.cierre != null, proy: t.cierre != null ? Math.round(t.cierre * 100) : null, proyColor: t.cierre > 1.02 ? COL.r : t.cierre < 0.85 ? COL.y : COL.g,
        demas: t.demas ? fMs(t.demas) + ' de más' : 'Sin gasto de más', demasColor: t.demas ? '#E9121C' : '#A6AAA9',
        lights: [],
        onClick: () => this.setState({ screen: 'proyecto', tab: 'resumen', pid: pr.id, panel: false, period: DATA.mes, busca: '', abierto: {} }) };
    });

    const crumbs = s.screen === 'guia' ? [{ label: 'Mis proyectos', color: '#808080', cursor: 'pointer', onClick: () => this.setState({ screen: 'portada' }) }, { label: 'Cómo leer', color: '#3C3C3C', cursor: 'default' }]
      : s.screen === 'portada' || !p ? [{ label: 'Mis proyectos', color: '#3C3C3C', cursor: 'default' }]
        : [{ label: 'Mis proyectos', color: '#808080', cursor: 'pointer', onClick: () => this.setState({ screen: 'portada', panel: false }) },
          { label: p.nombre, color: s.screen === 'proyecto' ? '#3C3C3C' : '#808080', cursor: 'pointer', onClick: () => this.setState({ screen: 'proyecto', tab: 'resumen', panel: false }) },
          ...(s.screen === 'campana' ? [{ label: s.campId, color: '#3C3C3C', cursor: 'default' }] : [])];

    const nComments = Object.keys(s.comments).length + Object.values(s.st).filter((x) => x.comment || x.op).length;
    const modalTitles = { pieza: 'Vista previa de pieza', comentar: 'Comentar esta pantalla' };
    const vals = {
      canal: s.canal, crumbs, L, h, o, P, datosAl, mesTxt, projName: p ? p.nombre : '',
      goPortada: () => this.setState({ screen: 'portada', panel: false }),
      canales: ['Oficial', 'Informativo'].map((k) => ({ label: k, bg: s.canal === k ? '#FFFFFF' : 'transparent', color: s.canal === k ? '#3C3C3C' : '#808080', shadow: s.canal === k ? 'var(--shadow-sm)' : 'none',
        onClick: () => { keep('syo.canal', k); const pr = this.proj(); this.setState({ canal: k, panel: false, abierto: {}, ...(pr && !pr.canales[k] ? { screen: 'portada' } : s.screen === 'campana' ? { screen: 'proyecto', tab: 'resumen' } : {}) }); } })),
      openGuia: () => this.setState({ screen: 'guia', panel: false }), isGuia: s.screen === 'guia',
      openComentar: () => this.setState({ modal: 'comentar', draft: s.comments[this.screenKey()] || '' }),
      exportar: () => this.exportar(), nComments,
      isPortada: s.screen === 'portada', isProyecto: s.screen === 'proyecto' && !!b, isCampana: s.screen === 'campana' && !!b && !!b.campanas[s.campId],
      projects,
      guiaRefs: GUIA.refs.map(([a, bb]) => ({ a, b: bb })), guiaColors: GUIA.colors.map(([bg, bd, label]) => ({ bg, bd, label })), guiaKpi: GUIA.kpi.map(([a, bb]) => ({ a, b: bb })), guiaMet: GUIA.met.map(([a, bb]) => ({ a, b: bb })), guiaBlocks: GUIA.blocks.map(([a, bb]) => ({ a, b: bb })), guiaSrc: GUIA.src.map(([a, bb]) => ({ a, b: bb })), ...this.reglasVals(),
      panel: s.panel, closePanel: () => this.setState({ panel: false, discardFor: null, panelCamp: null }),
      modalOpen: !!s.modal, modalTitle: modalTitles[s.modal] || '', modalW: s.modal === 'pieza' ? '720px' : '540px', closeModal: () => this.setState({ modal: null }),
      isPiezaModal: s.modal === 'pieza', isComentarModal: s.modal === 'comentar', pieza: s.pieza ? s.pieza.nombre : '', embeds: s.modal === 'pieza' ? embedsDe(s.pieza) : [],
      screenName: this.screenKey(), draft: s.draft, onDraft: (e) => this.setState({ draft: e.target.value }),
      saveComment: () => { const k = this.screenKey(), comments = { ...s.comments }; if (s.draft.trim()) comments[k] = s.draft.trim(); else delete comments[k]; keep('syo.comments', comments); this.setState({ comments, modal: null }); this.say('Comentario guardado'); },
      toast: s.toast,
      panelTitle: s.panelCamp ? 'Acciones · ' + s.panelCamp : p ? `Acciones · ${p.nombre} · ${s.canal}` : 'Acciones',
      panelSub: s.panelCamp ? panelList.length + ' pendientes en esta campaña' : pending.length + ' pendientes, ordenadas por prioridad y plata en juego',
      panelFiltered: !!s.panelCamp, panelAll: () => this.setState({ panelCamp: null }), noPanelItems: panelList.length === 0, nPending: pending.length, noPending: pending.length === 0,
      openPanel: () => openPanelAt(null, null), cards,
      listItems: panelList.map((a) => { const on = selAct && a.id === selAct.id; return { tipo: a.tipo, title: a.title, camp: a.camp, plata: a.plata === '—' ? '' : 'pagó ' + a.plata + ' más que lo habitual', bg: on ? '#F5F5F5' : '#FFFFFF', bl: on ? '#3C3C3C' : 'transparent', onClick: () => this.setState({ sel: a.id, discardFor: null }) }; }),
      resolved: resolvedActs.map((a) => { const x = s.st[a.id]; return { title: a.title, status: x.status === 'sent' ? 'Enviada a PAUTADOR' : x.status === 'manual' ? 'Hecha a mano' + (x.reason ? ' · ' + x.reason : '') : 'Descartada · ' + x.reason, onUndo: () => this.setAct(a.id, { status: 'pending', reason: null }) }; }),
      hasResolved: resolvedActs.length > 0, nResolved: resolvedActs.length,
      busca: s.busca, onBusca: (e) => this.setState({ busca: e.target.value }), colapsar: () => this.setState({ abierto: {}, busca: '' }),
    };
    if (!b) return vals;

    // ---- proyecto ----
    const per = DATA.periodos.find((x) => x.id === s.period) || DATA.periodos[0];
    const PD = b.periodos[per.id] || { campRows: [], pubs: [], audCods: [], actCods: [] };
    const t = b.tarjeta;
    const campRowV = (c) => { const tipo = tipoDe(c.id, c.sug, c.larga), cd = b.campanas[c.id] || {}, ll = c.lleg ? llegadaTxt(cd.llegada) : null;
      const llegV = { hasLleg: !!ll, llegTxt: ll ? ll.etiqueta : '', llegDot: ll ? ll.dot : COL.n, llegTitle: ll ? ll.titulo : '',
        hasSol: !!c.sol, solTitle: c.sol ? `Solapan público: ${c.sol === 1 ? 'un par de audiencias puede' : c.sol + ' pares de audiencias pueden'} llegar a la misma gente. El detalle está en la campaña.` : '' };
      return { ...c, ...llegV, tipo, plats: conLogo(c.plats), tag: TAG_TIPO[tipo] || '', estado: estTxt(c.estado), estDot: c.ec ? COL[c.ec] : '', estColor: c.estado === 'Terminó' ? '#A6AAA9' : '#3C3C3C', ef: efic(c.ef), lights: lucesDe(c, tipo), nAct: c.nAct || 0, noAct: !c.nAct, onAct: (e) => { e && e.stopPropagation(); openPanelAt(null, c.id); }, onClick: () => this.irCampana(c.id) }; };
    // árboles
    const porCamp = (rows, campo) => rows.reduce((m, r) => { (m[r[campo]] = m[r[campo]] || []).push(r); return m; }, {});
    const platsDe = (rows) => { const m = {}; for (const r of rows) for (const c of (r.codes || [r.code])) if (c) m[c] = (m[c] || 0) + (r.g || r.gasto || 0); return chipsDe(Object.entries(m).sort((a, c) => c[1] - a[1]).map(([code]) => code)); };
    const pubsDeEje = PD.pubs.reduce((m, x) => { const e = !x.eje || /^Sin c[oó]digo/i.test(x.eje) ? 'Sin eje' : x.eje; (m[e] = m[e] || []).push({ ...x, g: x.gasto, i: x.imp, r: x.rea }); return m; }, {});
    const arbolEjes = this.arbol(Object.entries(pubsDeEje).map(([eje, rows]) => ({ key: `E|${eje}`, name: eje, plats: platsDe(rows), porCamp: porCamp(rows, 'camp') })), PD, b, { conAnuncios: true });
    const porAud = (PD.audCods || []).reduce((m, x) => { (m[x.aud] = m[x.aud] || []).push(x); return m; }, {});
    const arbolAuds = this.arbol(Object.entries(porAud).map(([aud, rows]) => ({ key: `A|${aud}`, name: aud, plats: platsDe(rows), porCamp: porCamp(rows, 'com') })), PD, b, { conAnuncios: false });
    const porVoz = (PD.actCods || []).reduce((m, x) => { (m[x.voz] = m[x.voz] || []).push(x); return m; }, {});
    // Activos: una sola tabla; cada activo lleva su salud (ritmo de gasto y restante del pedido). Los activos del bloque sin gasto
    // en el período igual aparecen (un apagón es justamente lo que hay que ver)
    const saludDe = (a) => {
      if (!a) return SIN_SALUD;
      // sin pedido cargado en la planilla (pedidoCargado false, o sin pedido para este activo): "Sin pedido cargado" en gris, sin
      // restante, sin barra y sin "Superó el pedido" (decisión de Juan Pablo: no destacar lo que falta en la planilla)
      const hayP = a.pedidoCargado !== false && a.pedido != null;
      const restante = hayP ? (a.pedido >= a.gastado ? `Restan $${n2(a.pedido - a.gastado, 1)} M de $${n2(a.pedido, 1)} M` : `Superó el pedido por $${n2(a.gastado - a.pedido, 1)} M`) : 'Sin pedido cargado';
      return { hay: true, ritmo: a.ritmo[0], dot: a.ritmo[1] ? COL[a.ritmo[1]] : '', bg: a.ritmo[1] ? '#F4F4F4' : '#FAFAFA', restante, hayBarra: hayP, w: hayP ? Math.max(0, Math.min(100, (a.pedido - a.gastado) / a.pedido * 100)) + '%' : '0%', titulo: `Gasto de los últimos 7 días: ${a.g7}` };
    };
    const actPorNombre = Object.fromEntries(b.activos.map((a) => [a.name, a]));
    const voces = [...new Set([...Object.keys(porVoz), ...b.activos.map((a) => a.name)])];
    const arbolActivos = this.arbol(voces.map((voz) => { const rows = porVoz[voz] || [], a = actPorNombre[voz];
      return { key: `V|${voz}`, name: voz, plats: rows.length ? platsDe(rows) : conLogo(a ? a.plats : []), porCamp: porCamp(rows, 'com'), salud: saludDe(a), sub: a && a.auto ? 'Automatizado' : '', keep: !!a, nCont: (PD.actN || {})[voz] || 0, contDe: (com) => (PD.actN || {})[`${voz}|${com}`] || 0 }; }), PD, b, { conAnuncios: false, sinSub: true, sinHojas: true });
    // Looker embebido: precargado en DATA.lookers o pegado por el usuario (queda en el navegador)
    const lk = `${s.pid}|${s.canal}`, lookerSrc = s.looker[lk] || (DATA.lookers || {})[lk] || '';
    const pegarLooker = () => { const txt = prompt(`Pegá el link de inserción de Looker Studio de ${p.nombre} · ${s.canal} (Archivo → Insertar informe; sirve el <iframe> entero).`, ''); if (txt == null) return; const src = lookerSrcDe(txt); if (!src) { this.say('No parece un link de Looker Studio'); return; } const looker = { ...s.looker, [lk]: src }; keep('syo.looker', looker); this.setState({ looker, tab: 'looker' }); this.say('Tablero guardado'); };

    const campTodas = PD.campRows.map(campRowV);
    Object.assign(vals, {
      projLights: [],
      looker: (e) => { e && e.preventDefault(); this.setState({ tab: 'looker' }); },
      isLooker: s.tab === 'looker', lookerSrc, hasLooker: !!lookerSrc, noLooker: !lookerSrc, lookerH: Math.max(360, (s.hv || 900) - 120) + 'px', pegarLooker,
      projTabs: TABS.map(([label, k]) => { const on = s.tab === k; return { label, color: on ? '#3C3C3C' : '#808080', bd: on ? '#3C3C3C' : 'transparent', onClick: () => this.setState({ tab: k, busca: '' }) }; }),
      isResumen: s.tab === 'resumen', isCampanas: s.tab === 'campañas', isEjes: s.tab === 'ejes', isPubs: false, isCmpTab: false, isAud: s.tab === 'audiencias', isActivos: s.tab === 'activos', isInsights: s.tab === 'insights',
      period: per.id, onPeriod: (e) => this.setState({ period: e.target.value, abierto: {} }), periods: DATA.periodos.filter((x) => b.periodos[x.id]).map((x) => ({ id: x.id, label: x.label })), periodTxt: per.txt,
      campGastoLabel: per.id === DATA.mes ? 'Gasto' : 'Gasto del período',
      // Resumen
      budgets: b.budgets.map((x) => { const v = budgetView(x, b.diasMes, b.mesAnt), dia = x.acum.length, mm = DATA.mes.slice(5);
        return { ...v, c: s.bMetric === 'Gasto' ? v.gastoC : v.impC, dia, diasMes: b.diasMes, tiempoPct: Math.round(dia / b.diasMes * 100), ejeIni: `1/${mm}`, ejeMed: `${Math.round(b.diasMes / 2)}/${mm}`, ejeFin: `${b.diasMes}/${mm}` }; }),
      bMetrics: ['Gasto', 'Impresiones'].map((m) => { const on = s.bMetric === m; return { label: m, bg: on ? '#FFFFFF' : 'transparent', shadow: on ? 'var(--shadow-sm)' : 'none', onClick: () => this.setState({ bMetric: m }) }; }),
      badCamps: b.bad.map((c) => ({ ...c, plats: conLogo(c.plats), ef: efic(c.ef), lights: lightsOf(c.l, tipoCamp(c.id) === 'estacional', dKpi((b.campanas[c.id] || {}).obj)), onClick: () => this.irCampana(c.id) })),
      // Campañas
      // filtros de Campañas: siempre sobre las campañas con gasto en el período elegido (por defecto, el mes en curso)
      campFilters: FILTROS_CAMP.map(([m, pasa]) => { const on = s.campFilter === m; return { label: `${m} (${campTodas.filter(pasa).length})`, bg: on ? '#3C3C3C' : '#FFFFFF', color: on ? '#FFFFFF' : '#3C3C3C', bd: on ? '#3C3C3C' : '#E4E4E4', onClick: () => this.setState({ campFilter: m }) }; }),
      campRows: campTodas.filter((FILTROS_CAMP.find(([m]) => m === s.campFilter) || FILTROS_CAMP[0])[1]),
      // Árboles
      arbolEjes, arbolEjesVacio: arbolEjes.length === 0, arbolAuds, arbolAudsVacio: arbolAuds.length === 0, arbolActivos, arbolActivosVacio: arbolActivos.length === 0,
      // Activos (estado)
      activos: b.activos.map((a) => { const hayP = a.pedidoCargado !== false && a.pedido != null; return { name: a.name, plats: conLogo(a.plats), auto: a.auto,
        hasPedido: hayP, noPedido: !hayP, restante: hayP ? (a.pedido >= a.gastado ? `$${n2(a.pedido - a.gastado, 1)} M de $${n2(a.pedido, 1)} M` : `superó el pedido de $${n2(a.pedido, 1)} M por $${n2(a.gastado - a.pedido, 1)} M`) : '', w: hayP ? Math.max(0, (a.pedido - a.gastado) / a.pedido * 100) + '%' : '0%',
        g7: a.g7, ritmo: a.ritmo[0], rDot: a.ritmo[1] ? COL[a.ritmo[1]] : '', rBg: a.ritmo[1] ? '#F4F4F4' : 'transparent', lights: lightsOf(a.l) }; }),
      // Insights
      insVs: b.insights.vs.map((r) => ({ ...r, c: COL[r.c] })),
      insEf: b.insights.ef.map((g) => ({ title: g.title, rows: g.rows.map(([name, pp, n, N, gasto]) => ({ name, gasto, ef: efic({ p: pp, n, N, color: pp < 25 ? 'verde' : pp < 50 ? 'amarillo' : pp < 75 ? 'naranja' : 'rojo' }) })) })),
      insSeason: b.insights.season.map((r) => { const t = tipoOps(r.id, r.sug, r.larga);
        return { name: r.name, detalle: `Con gasto en ${r.sem52} de las últimas 52 semanas${r.previa ? ' · ' + r.previa : ''}`, nota: t.confirmado ? 'confirmado' : 'sugerido', ops: t.ops }; }),
      insSeasonVacio: b.insights.season.length === 0,
      insLists: [
        { title: 'De ' + p.nombre, sub: 'Aprendizajes propios del proyecto contra todos los gobiernos.', rows: (b.insights.propios.length ? b.insights.propios : [['Todavía no hay suficiente historia para aprendizajes propios.', '']]).map(([txt, src]) => ({ txt, src })) },
        { title: 'Del uso', sub: 'Lo que aprendió de las decisiones y opiniones del equipo.', rows: this.delUso() },
        { title: 'Generales', sub: 'Aprendizajes del último año de DataJunta, en todos los gobiernos.', rows: DATA.generales.map(([txt, src]) => ({ txt, src })) },
      ],
    });

    // ---- campaña ----
    const c = b.campanas[s.campId];
    if (s.screen === 'campana' && c) {
      const tipoC = tipoCamp(c.id), estac = tipoC === 'estacional' && !!(c.hist && c.hist.temporada);
      // la luz propia según el tipo: temporada anterior (estacional) o sus semanas anteriores (constante, larga)
      const H = c.hist ? { ...c.hist, idx: estac ? c.hist.idxTemporada : c.hist.idxPropio } : null;
      const propiaC = H ? (H.idx ?? 'e') : undefined;
      Object.assign(vals, {
        campName: c.name, campObj: c.obj, campEje: c.eje || '—', campFechas: c.fechas, campEstado: estTxt(c.estado), campEstDot: c.ec ? COL[c.ec] : '#D5D5D5', campEf: efic(c.ef), campDemas: c.demas || '', campHasTag: !!tipoC, campTag: TAG_TIPO[tipoC] || '', campTipos: tipoOps(c.id, c.hist ? c.hist.sug : '', !!c.hist && c.hist.span >= 30).ops,
        campHistTitle: `${c.kpiL} semanal de la campaña`,
        ...(() => { const ll = llegadaTxt(c.llegada), sp = solapanTxt(c.solapan), U = DATA.umbralesLlegada || { llega: 1, riesgo: 1 / 1.2 };
          return { hasLlegOSol: ll.hay || sp.hay, hasLlegada: ll.hay, llegada: ll, hasSolapan: sp.hay, solapan: sp,
            llegAyuda: `Solo Meta. Cuenta impresiones (Alcance), reacciones (Interacción) o clicks (Tráfico y Conversión) desde el 1 del mes o desde que arrancó la campaña, y le suma el ritmo de los últimos 7 días hasta su fecha de fin en DataJunta. Lo compara con lo que conseguiría una campaña normal con la misma plata, al costo habitual del proyecto en el último año (o de todos los gobiernos, si el proyecto no tiene referencia). Va a llegar: ${Math.round(U.llega * 100)} % o más de lo normal. En riesgo: entre ${Math.round(U.riesgo * 100)} % y ${Math.round(U.llega * 100)} %. No va a llegar: menos de ${Math.round(U.riesgo * 100)} %. Solapan público: pares de conjuntos que siguen al aire con audiencias que se pisan (misma zona, una dentro de otra o que se cruzan); es solo una marca.` }; })(), obrasPlats: conLogo(c.plats), spark: sparkView(c.spark),
        openCampPanel: () => openPanelAt(null, c.id), nCampActs: pending.filter((a) => a.campId === c.id || (a.campanas || []).includes(c.id)).length,
        cTiles: c.tiles.map((tt) => ({ ...tt, kpi: !!tt.kpi, sim: !!tt.sim, border: tt.kpi ? '1.5px solid #3C3C3C' : '1px solid #E4E4E4', lights: lightsOf(tt.l && tt.l.length === 3 && propiaC !== undefined ? [tt.l[0], tt.l[1], propiaC] : tt.l, estac, { ...(D_TARJETA[tt.label] || {}), v: tt.lv }), delta: '', dColor: '#808080', ...(tt.alcM ? alcanceTarjeta(tt) : {}) })),
        histStats: H ? [
          { label: estac ? 'Luz Temporada anterior' : 'Luz propia', val: H.idx == null || H.idx === 'e' ? 'poca historia' : light('', H.idx, dPropia(dKpi(c.obj), estac)).num, dot: H.idx == null || H.idx === 'e' ? '' : H.idx >= 1.2 ? COL.g : H.idx <= 0.8 ? COL.r : COL.y },
          { label: 'Semanas al aire', val: String(Math.round(H.span / 7)) },
          ...(tipoC === 'constante' ? [{ label: 'Constante', val: `${H.sem52} de 52 semanas` }] : []),
          ...(H.tendencia != null ? [{ label: 'Tendencia (4 vs 8 semanas)', val: (H.tendencia >= 1 ? '▲ ' : '▼ ') + Math.abs(Math.round((H.tendencia - 1) * 100)) + ' %' }] : []),
          ...(H.presion != null ? [{ label: 'Presión del último mes', val: n2(H.presion, 1) + ' imp/hab' }] : []),
          ...(H.presionAcum != null ? [{ label: 'Presión acumulada', val: n2(H.presionAcum, 0) + ' imp/hab' }] : []),
          ...(estac && H.previa ? [{ label: 'Temporada anterior', val: `desde el ${dm(H.previa.desde)}/${H.previa.desde.slice(2, 4)} · ${H.previa.semanasComparadas} semanas comparadas` }] : []),
        ] : [{ label: 'Historia propia', val: 'la campaña tiene menos de 30 días' }],
        hist: H ? histView(H) : { bandY: 0, bandH: 0, medY: -10, bars: [] },
        campTabs: ['Contenidos', 'Audiencias', 'Activos y placements'].map((tt) => { const on = s.campTab === tt; return { label: tt, color: on ? '#3C3C3C' : '#808080', bd: on ? '#3C3C3C' : 'transparent', onClick: () => this.setState({ campTab: tt }) }; }),
        ctContenidos: s.campTab === 'Contenidos', ctAudiencias: s.campTab === 'Audiencias', ctActivos: s.campTab === 'Activos y placements',
        contenidos: c.contenidos.map((r) => ({ ...r, gasto: fMs(r.gasto), cxr: r.cxrT, gen: (({ corto, ...l }) => ({ ...l, num: corto }))(light('General', r.g, { m: 'Costo por reacción', v: r.cxr })), ef: efic(r.ef), comp: r.comp == null ? '—' : n2(r.comp, 3) + ' %', ret: r.ret == null ? '—' : r.ret + ' %', retC: r.ret == null ? COL.n : r.ret >= 52 ? COL.g : r.ret < 40 ? COL.r : COL.y,
          senales: r.sen.map((k) => (k === 'c' ? { label: 'se comparte', c: COL.g } : { label: 'genera conversación', c: COL.y })), onPieza: () => verPieza(r.pieza) })),
        audiencias: c.audiencias.map((r) => ({ ...r, ef: efic(r.ef), lights: lightsOf(r.l, false, dKpi(c.obj)).map((l) => ({ ...l, num: l.label + ' ' + l.corto })) })),
        voces: (c.voces || []).map((v) => ({ ...v, plats: conLogo(v.plats) })), placements: c.placements.map((x) => ({ name: x.name, pct: x.pct + ' %', w: (x.pct / Math.max(1, ...c.placements.map((y) => y.pct)) * 100) + '%', note: x.note })),
      });
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => this.ubicarLooker());
    return vals;
  }
  // ---------- reglas vigentes (sección de Cómo leer): las lee y comenta el equipo; los datos vienen de borrador/reglas-vigentes.js ----------
  reglasVals() {
    const s = this.state, R = DATA.reglas || { reglas: [], notas: [], observacion: [] };
    const coms = {}; for (const x of s.respReglas) (coms[x.regla] = coms[x.regla] || []).push(x);
    const plat = (ps) => ((ps || []).includes('Todas') ? 'Todas las plataformas' : (ps || []).join(', '));
    const cambiarAutor = () => { if (typeof prompt !== 'function') return; const r = prompt('¿Quién sos? Tu nombre queda en este navegador y acompaña tus respuestas y comentarios.', store('syo.autor', '') || ''); if (r == null) return; keep('syo.autor', r.trim()); this.setState((st) => ({ autorV: st.autorV + 1 })); };
    return {
      reglasSub: `Las ${R.reglas.length} reglas que la app aplica hoy (versión ${String(R.version || "").replace(/^v/, "")}, al ${R.fecha}), de la más importante a la menos importante. Cada comentario queda con el nombre de quien lo escribe y se revisa en la sesión de los lunes.`,
      reglasAutor: `Comentás como: ${autorActual(false)}`, cambiarAutor, reglasOffline: !enLinea(),
      reglasLista: R.reglas.map((r) => { const draft = s.reglaDraft[r.id] || '', ok = !!draft.trim(), cs = (coms[r.id] || []).slice().sort((a, b) => String(a.recibido || '').localeCompare(String(b.recibido || '')));
        const nota = r.pautador && r.pautador.nota && r.pautador.nota !== 'Se hace a mano.' ? r.pautador.nota : '';
        return { id: r.id, nombre: r.nombre, plats: plat(r.plataformas), cuando: r.cuando, propone: r.propone, como: r.como, hasComo: !!r.como,
          via: r.pautador && r.pautador.va ? `Se puede pedir a PAUTADOR (${r.pautador.accion})` : 'Se hace a mano', viaNota: nota, hasViaNota: !!nota,
          coms: cs.map((x) => ({ quien: [x.autor || 'sin identificar', x.proyecto ? x.proyecto + (x.canal ? ' · ' + x.canal : '') : '', fechaCorta(x.recibido)].filter(Boolean).join(' · '), txt: x.comentario })), hasComs: cs.length > 0,
          draft, onDraft: (e) => { const v = e.target.value; this.setState((st) => ({ reglaDraft: { ...st.reglaDraft, [r.id]: v } })); }, onComentar: () => this.comentarRegla(r.id), cCursor: ok ? 'pointer' : 'not-allowed', cOpacity: ok ? 1 : 0.4 }; }),
      hayObservacion: (R.observacion || []).length > 0, observacion: (R.observacion || []).map((o) => ({ nombre: o.nombre, regla: o.regla })),
      hayNotasReglas: (R.notas || []).length > 0, notasReglas: (R.notas || []).map((t) => ({ t })),
    };
  }
  delUso() {
    const tipos = {};
    for (const [id, x] of Object.entries(this.state.st)) {
      const tipo = id.split('-')[0];
      const tt = tipos[tipo] = tipos[tipo] || { hechas: 0, desc: 0, ops: {} };
      if (x.status === 'sent' || x.status === 'manual') tt.hechas++; if (x.status === 'discarded') tt.desc++; if (x.op) tt.ops[x.op] = (tt.ops[x.op] || 0) + 1;
    }
    const NOMBRE = { Rin: 'Rinde por debajo', Se: 'Se desgastó / Se comparte / Se abandona', Mej: 'Mejor momento', Pre: 'Presión acumulada alta', Peo: 'Peor que la temporada anterior', Gen: 'Genera conversación', Sum: 'Sumar Facebook Reels', Pla: 'Placements débiles', rot: 'Rotar contenidos', Sin: 'Sin entrega', pic: 'Picos y apagones', cxo: 'Costo por objetivo' };
    const rows = Object.entries(tipos).map(([k, tt]) => ({ txt: `${NOMBRE[k] || k}: ${tt.hechas} hechas · ${tt.desc} descartadas${Object.keys(tt.ops).length ? ' · ¿sirve? ' + Object.entries(tt.ops).map(([a, n]) => a + ': ' + n).join(' · ') : ''}`, src: 'Este navegador' }));
    return rows.length ? rows : [{ txt: 'Cuando se resuelvan, descarten u opinen recomendaciones, acá se ve qué aprende el agente de cada decisión.', src: '' }];
  }
  exportar() {
    const s = this.state, hoy = new Date().toISOString().slice(0, 10);
    const L = [`# Comentarios sobre Seguimiento y Optimización (${hoy})`, '', `Datos al ${dm(DATA.datosHasta)}.`, '', '## Recomendaciones', ''];
    let n = 0;
    for (const p of DATA.proyectos) for (const [canal, b] of Object.entries(p.canales)) for (const a of b.acciones) {
      const x = s.st[a.id]; if (!x || !(x.status && x.status !== 'pending' || x.op || x.comment)) continue; n++;
      L.push(`### [${a.tipo}] ${a.title}`, `- Proyecto: ${p.nombre} · ${canal}`, `- Solución sugerida: ${a.solucion}`);
      if (a.afectado.conjuntos.length) L.push(`- Conjuntos: ${a.afectado.conjuntos.map((k) => k.corto).join(' | ')}`);
      if (x.op) L.push(`- ¿Sirve?: **${x.op}**`);
      if (x.status && x.status !== 'pending') L.push(`- Decisión: ${x.status === 'sent' ? 'Enviar a PAUTADOR' : x.status === 'manual' ? 'Hecho a mano' : 'Descartada'}${x.reason ? ` (${x.reason})` : ''}`);
      if (x.comment) L.push(`- Comentario: ${x.comment.replace(/\n/g, ' ')}`);
      L.push('');
    }
    if (!n) L.push('_Sin comentarios._', '');
    L.push('## Pantallas', '');
    const ps = Object.entries(s.comments); if (!ps.length) L.push('_Sin comentarios._', '');
    for (const [k, txt] of ps) L.push(`### ${k}`, `- Comentario: ${txt.replace(/\n/g, ' ')}`, '');
    const est = Object.entries(s.tipos).filter(([, v]) => v);
    if (est.length) { L.push('## Tipo de campaña', ''); for (const [k, v] of est) L.push(`- ${k.split('|').join(' · ')}: ${v === 'ninguna' ? 'ni constante ni estacional' : v}`); L.push(''); }
    const url = URL.createObjectURL(new Blob([L.join('\n')], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `comentarios-seguimiento-${hoy}.md`; a.click(); URL.revokeObjectURL(url);
    this.say('Comentarios exportados');
  }
}
