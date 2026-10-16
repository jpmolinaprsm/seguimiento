// Lógica de "Optimización" sobre el diseño curado (Claude Design). Se inyecta después de `const DATA = …`
// en el script text/x-dc del bundle. Produce exactamente los valores que el markup del diseño (y los parches) interpolan.
const COL = { g: '#46C678', y: '#FCB942', o: '#F98C3E', r: '#F7444C', n: '#D5D5D5' };
const COLN = { verde: COL.g, amarillo: COL.y, naranja: COL.o, rojo: COL.r, gris: COL.n };
const fx = (x) => x.toFixed(1).replace('.', ',') + '×';
const fM = (v) => (v / 1e6).toFixed(1).replace('.', ',') + ' M';
const fMs = (v) => (Math.abs(v) < 1e6 ? '$' + Math.round(v / 1e3).toLocaleString('es-AR') + ' k' : ('$' + fM(v)).replace(',0 M', ' M'));
const fN = (v) => (v ? Math.round(v).toLocaleString('es-AR') : '—');
const n2 = (v, d) => v.toFixed(d).replace('.', ',');
const dm = (f) => (f ? f.slice(8, 10) + '/' + f.slice(5, 7) : '');
// ---- luces (decisión de Juan Pablo del 01/10) ----
// Solo dos comparaciones en pantalla: contra lo normal del proyecto y contra la misma campaña (sus semanas anteriores o, si es
// estacional, la temporada pasada). La de todos los gobiernos (General) ya no se muestra; el motor de recomendaciones la sigue usando.
// Cada luz dice qué se mide, contra qué y los dos valores: "Parecida a lo normal en Santa Fe ($35): 10 % más cara".
// x es el índice que calcula Referencias: 1 = igual a la referencia, más de 1 = mejor. Costo: el propio = referencia ÷ x. Tasa (CTR,
// tasas): el propio = referencia × x. Colores: los mismos cortes que luz() del borrador (±20 % sobre el índice).
const fCosto = (v) => (v >= 10 ?'$' + Math.round(v).toLocaleString('es-AR') : '$' + v.toLocaleString('es-AR', { maximumFractionDigits: 2 }));
const colorIdx = (x) => (x >= 1.2 ? COL.g : x < 1 / 1.2 ? COL.r : COL.y);
const fCada100 = (v) => v.toLocaleString('es-AR', { minimumFractionDigits: v < 10 ? 1 : 0, maximumFractionDigits: v < 10 ? 2 : 0 });
const fPct = (dec) => (v) => v.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + ' %';
// cada métrica: cómo se dice el valor (dice, y partida en pre / val para los encabezados), género de lo que se compara (fem), si más
// alto es mejor (tasa) y cómo se escribe la referencia (fmt)
const MET = {
  cr: { pre: 'Cada reacción costó', val: fCosto, fem: true, fmt: fCosto, mide: 'lo que costó cada reacción' },
  cpm: { pre: 'Mostrar el anuncio mil veces costó', val: fCosto, fem: false, fmt: fCosto, mide: 'lo que costó mostrar el anuncio mil veces' },
  cv: { pre: 'Cada reproducción costó', val: fCosto, fem: true, fmt: fCosto, mide: 'lo que costó cada reproducción' },
  ctr: { pre: 'De cada 100 que lo vieron,', val: (v) => `${fCada100(v)} hicieron click`, fem: false, tasa: true, fmt: (v) => `${fCada100(v)} de cada 100`, mide: 'cuántos hicieron click de cada 100 que lo vieron' },
  treac: { fem: true, tasa: true, fmt: fPct(2) },
  tcomp: { fem: true, tasa: true, fmt: fPct(3) },
  ctrPct: { fem: false, tasa: true, fmt: fPct(2) },
};
const dice = (m, v) => `${MET[m].pre} ${MET[m].val(v)}`;
// qué mide cada objetivo (la luz del proyecto) y qué mide la luz propia según Referencias (Interacción costo por reacción, Tráfico CTR, el resto CPM)
const MET_OBJ = { Interacción: 'cr', Alcance: 'cpm', Reproducciones: 'cv', Tráfico: 'ctr', Conversión: 'ctr' };
const metPropia = (obj) => (obj === 'Interacción' ? 'cr' : obj === 'Tráfico' ? 'ctr' : 'cpm');
// contra qué: "que" va después de "más cara que", "a" después de "parecida a", "corto" en la lista, "cuando" es la ventana del valor propio
const CONTRA = {
  proyecto: (pr) => ({ que: `lo normal en ${pr}`, a: `lo normal en ${pr}`, corto: `lo normal en ${pr}` }),
  semanas: () => ({ que: 'en las semanas anteriores de esta campaña', a: 'las semanas anteriores de esta campaña', corto: 'sus semanas anteriores', cuando: 'En las últimas dos semanas',
    poca: 'Poca historia: la comparación con sus semanas anteriores aparece desde la tercera semana' }),
  temporada: () => ({ que: 'en la temporada pasada de esta campaña', a: 'la temporada pasada de esta campaña', corto: 'su temporada pasada', cuando: 'En lo que va de esta temporada', ajuste: ', en plata de hoy',
    poca: 'Todavía no se puede comparar con la temporada pasada' }),
};
const may = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const minu = (t) => t.charAt(0).toLowerCase() + t.slice(1);
// o: { met (clave de MET), contra ('proyecto' | 'semanas' | 'temporada'), proy (nombre del proyecto), v (valor propio que compara la luz),
//      dice (la frase larga arranca con el valor propio, porque no es el del encabezado), meta (la luz mira solo Meta) }
// Devuelve { bg, bd, corto (lista), mini (columna angosta), largo (frase completa con valores), title }
function luzTxt(x, o) {
  const M = MET[o.met] || MET.cpm, C = CONTRA[o.contra](o.proy), a = M.fem ? 'a' : 'o';
  const fin = (corto, largo, mini, bg, bd) => ({ bg, bd: bd || 'none', corto, mini: mini ?? corto, largo, title: largo, txt: largo });
  if (x === null || x === undefined) { const t = o.contra === 'proyecto' ? `Sin referencia en ${o.proy}` : `Sin referencia en ${C.a}`; return fin(t, t, 'sin referencia', COL.n); }
  if (x === 'e') return fin(C.poca, C.poca, 'poca historia', 'transparent', '1.5px solid #A6AAA9');
  const bg = colorIdx(x), parecido = bg === COL.y;
  const p = Math.round(Math.abs(M.tasa ? x - 1 : 1 / x - 1) * 100), mejor = x >= 1;
  const dir = M.tasa ? (mejor ? `más alt${a}` : `más baj${a}`) : mejor ? `más barat${a}` : `más car${a}`;
  // con el valor propio adelante ("…costó $45: …") la frase ya tiene dos puntos: lo que sigue va con coma
  const conValor = !!(o.dice && o.v != null && isFinite(o.v) && o.v > 0 && M.pre), sep = conValor ? ', ' : ': ';
  const juicio = M.tasa && !parecido && p ? sep + (mejor ? 'mejor' : 'peor') : '';
  const hayV = o.v != null && isFinite(o.v) && o.v > 0;
  const ref = hayV ? (M.tasa ? o.v / x : o.v * x) : null;
  const refTxt = ref != null ? ` (${M.fmt(ref)}${C.ajuste || ''})` : '';
  let corto, largo, mini;
  if (p === 0) { corto = `Igual que ${C.corto}`; largo = `igual que ${C.a}${refTxt}`; mini = 'igual'; }
  else if (parecido) { corto = `Parecid${a} a ${C.corto} (${p} % ${dir})`; largo = `parecid${a} a ${C.a}${refTxt}${sep}${p} % ${dir}`; mini = `parecid${a} (${p} % ${dir})`; }
  else { const jc = juicio.replace(', ', ': '); corto = `${p} % ${dir} que ${C.corto}${jc}`; largo = `${p} % ${dir} que ${C.que}${refTxt}${juicio}`; mini = `${p} % ${dir}${jc}`; }
  // el valor propio va adelante cuando no es el del encabezado: la luz propia (otra ventana), la de Impresiones (mide el costo) o el CTR solo de Meta
  if (o.meta) corto = `En Meta, ${minu(corto)}`;
  if (conValor) { const antes = [C.cuando, o.meta ? 'en Meta' : ''].filter(Boolean).join(', '); largo = `${antes ? antes + ', ' + minu(dice(o.met, o.v)) : dice(o.met, o.v)}: ${largo}`; }
  else if (o.meta) largo = `En Meta, ${largo}`;
  return fin(may(corto), may(largo), mini, bg);
}
// las luces de una campaña: contra el proyecto y, si tiene historia propia, contra la misma campaña. Pr = { x, v, temporada }
const lucesCampana = (obj, proy, P, Pr) => [luzTxt(P.x, { met: MET_OBJ[obj] || 'cpm', contra: 'proyecto', proy, v: P.v, dice: !!P.meta, meta: !!P.meta }),
  ...(Pr ? [luzTxt(Pr.x, { met: metPropia(obj), contra: Pr.temporada ? 'temporada' : 'semanas', v: Pr.v, dice: true })] : [])];
// ---- lista de Campañas: una sola columna de Métrica con selector (decisiones de Juan Pablo del 01/10; reemplaza la columna de luces) ----
// Selector: Según objetivo (cada fila muestra el KPI de su objetivo y lo nombra) · Costo por reacción · CPM · CTR · ETR Videos ·
// ETR Imágenes · CPM de Alcance (todas las filas, ese KPI). Se recuerda mientras dura la sesión de la página (sessionStorage).
// Cada celda: el valor de la campaña en el período y dos renglones chicos, siempre con el valor de referencia entre paréntesis:
// "vs. Chaco ($240): +8 %" (lo normal del proyecto) y "vs. semanas anteriores ($84): −83 %" (o "vs. temporada pasada" si es estacional).
// Color solo con una diferencia grande, con el mismo corte que el motor (±20 % sobre lo que rinde la plata): rojo si es peor, verde si
// es mejor, con ▲/▼ y la palabra; si no, gris. Costos (Costo por reacción, CPM, CPM de Alcance): más alto es peor. Tasas (CTR, ETR):
// más alto es mejor. El proyecto se nombra siempre igual ("vs. Chaco"); si la referencia es solo de Meta, lo dice la ayuda de la columna.
const fPct2 = (v) => v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
const KPI_COLS = [
  { k: 'cr', label: 'Costo por reacción', fmt: fCosto, costo: true, soloMeta: true, sin: 'sin reacciones',
    ayuda: 'Costo por reacción = gasto ÷ reacciones. Solo Meta (Facebook, Instagram y Threads): las demás plataformas no registran reacciones.' },
  { k: 'cpm', label: 'CPM', fmt: fCosto, costo: true,
    ayuda: 'CPM = gasto ÷ impresiones × 1.000: lo que costó mostrar el anuncio mil veces. Solo Meta (Facebook, Instagram y Threads), que es lo que tiene referencias: el valor y sus dos comparaciones hablan de lo mismo. En una campaña sin Meta, el valor suma sus otras plataformas y no se compara.' },
  { k: 'ctr', label: 'CTR', fmt: fPct2,
    ayuda: 'CTR = clicks ÷ impresiones × 100: de cada 100 que lo vieron, cuántos hicieron click. El valor y sus dos comparaciones son de Meta (Facebook, Instagram y Threads). Si la campaña tiene una parte de Tráfico en Google, va en un renglón más por red (Search, Display, YouTube…), comparada contra lo normal de esa misma red: las redes de Google no se mezclan entre sí ni con Meta. Si la campaña es solo de Google, en una red y de Tráfico, el valor es el de Google y se compara contra su red. En una campaña sin Meta ni Tráfico en Google, el valor suma sus plataformas y no se compara.' },
  { k: 'etrV', label: 'ETR Videos', fmt: fPct2, soloMeta: true, sin: 'sin videos',
    ayuda: 'ETR = engagement ÷ impresiones × 100, solo con los videos de la campaña en Meta. En video el engagement es casi todo reproducciones: por eso va aparte de las imágenes y se compara solo contra videos (de lo normal del proyecto y de esta misma campaña).' },
  { k: 'etrI', label: 'ETR Imágenes', fmt: fPct2, soloMeta: true, sin: 'sin imágenes',
    ayuda: 'ETR = engagement ÷ impresiones × 100, solo con las placas y los carruseles de la campaña en Meta. En imágenes el engagement es casi todo clicks: se compara solo contra placas y carruseles (cada uno contra su mismo formato).' },
  { k: 'ca', label: 'CPM de Alcance', fmt: fCosto, costo: true,
    ayuda: 'CPM de Alcance = gasto ÷ personas alcanzadas × 1.000, con el alcance real que lee PAUTADOR de Meta cada mañana. Solo cuando hay lectura de hoy y su ventana coincide con el período (últimos 7 o 30 días, o el mes en curso si la campaña empezó este mes). Todavía no tiene referencias para comparar. Si la campaña corre en varias cuentas, va un CPM por cuenta, cada uno con el gasto y el alcance de esa cuenta: el alcance no se suma entre cuentas.' },
  { k: 'cv', label: 'Costo por reproducción', fmt: fCosto, costo: true, sin: 'sin reproducciones', porPlat: true,
    ayuda: 'Costo por reproducción = gasto ÷ reproducciones, en todas las plataformas que registran reproducciones (videos de Meta, YouTube, TikTok), solo con los anuncios que tuvieron reproducciones. Se compara contra lo normal del proyecto en la misma plataforma y objetivo, y contra la misma campaña plataforma por plataforma. Cada plataforma cuenta la reproducción a su manera: por eso se compara siempre dentro de la misma plataforma.' },
];
const KPI_OBJ = { Interacción: 'cr', Alcance: 'cpm', Reproducciones: 'cv', Tráfico: 'ctr', Conversión: 'ctr' };
const TXT = { gris: '#808080', rojo: '#D3222A', verde: '#1F8A4C', valor: '#3C3C3C' };
const KPI_SEL = [['obj', 'Según objetivo'], ...KPI_COLS.map((col) => [col.k, col.label])];
const kpiSelGuardado = () => { try { const v = sessionStorage.getItem('syo.kpiSel'); return KPI_SEL.some(([k]) => k === v) ? v : 'obj'; } catch (e) { return 'obj'; } };
const kpiSelGuardar = (v) => { try { sessionStorage.setItem('syo.kpiSel', v); } catch (e) {} };
// ws: cómo corta el renglón en las tarjetas (nowrap: una línea con puntos suspensivos; normal: puede ocupar dos, como las cuentas del alcance)
const renglon = (txt, color, title) => ({ txt, color: color || TXT.gris, title: title || txt, ws: 'nowrap' });
// x = { v (valor que se compara), r (referencia) }
function comparaTxt(x, col, contra, quien, esta) {
  const sube = x.v > x.r, idx = col.costo ? x.r / x.v : x.v / x.r, p = Math.round(Math.abs(x.v / x.r - 1) * 100);
  const juicio = !isFinite(idx) || p === 0 ? '' : idx >= 1.2 ? 'mejor' : idx < 1 / 1.2 ? 'peor' : '';
  const signo = p === 0 ? '' : sube ? '+' : '−';
  const txt = `${contra} (${col.fmt(x.r)}): ${signo}${p} %${juicio ? ` ${sube ? '▲' : '▼'} ${juicio}` : ''}`;
  const dif = p === 0 ? 'lo mismo' : `${p} % ${sube ? 'más alto' : 'más bajo'}${juicio ? `: ${juicio}` : ''}`;
  return renglon(txt, juicio === 'peor' ? TXT.rojo : juicio === 'mejor' ? TXT.verde : TXT.gris, `${quien}: ${col.fmt(x.r)}. ${esta || 'Esta campaña'}: ${col.fmt(x.v)} (${dif}).`);
}
const ALC_VENTANA = (x) => (x.d && x.h ? ` Del ${dm(x.d)} al ${dm(x.h)}.` : '');
// la celda dice siempre qué KPI muestra, en la misma línea que el valor y con el mismo peso ("CPM: $352", "CTR: 1,87 %"), con
// cualquier opción del selector (pedido de Juan Pablo del 01/10). conNombre queda por compatibilidad: true en "Según objetivo"
// otra = { nombre, quien } cambia la segunda comparación: en Contenidos y Audiencias de una campaña no hay "semanas anteriores" de una
// pieza o de una audiencia, así que se compara contra toda la campaña ("vs. la campaña ($84): −20 %")
// ref (vistas que juntan, 01/10) = { de: quién es "lo normal" en la ayuda }
function celdaKpi(c, col, tipo, proyN, conNombre, otra, ref) {
  const kc = c.kc || {}, x = kc[col.k] || {}, objKpi = KPI_OBJ[c.obj] === col.k;
  const celda = (val, valColor, p, s, extra) => ({ k: col.k, val, linea: `${col.label}: ${val}`, valColor, fw: valColor === TXT.valor ? 600 : 400, hasNombre: !!conNombre, nombre: col.label, hasG: false, gs: [], hasC: false, cs: [],
    hasP: !!p, p: p || renglon(''), hasS: !!s, s: s || renglon(''), title: col.ayuda + (objKpi ? ` Es el KPI que busca esta campaña (objetivo ${c.obj}).` : '') + (extra ? ' ' + extra : '') });
  // CPM de Alcance: solo el valor (o "sin dato"), sin comparaciones
  // Varias cuentas (02/10): un CPM por cuenta, cada uno con su gasto y su alcance; nunca combinado (el alcance no se suma entre cuentas)
  if (col.k === 'ca') {
    const cuenta = (i) => renglon(`${i.c}: ${i.v != null ? col.fmt(i.v) : 'sin dato'}`, i.v != null ? TXT.valor : TXT.gris,
      i.v != null ? `${i.c}: ${fN(i.a)} personas alcanzadas dentro de esa cuenta con ${fMs(i.g)}.${ALC_VENTANA(i)}` : `${i.c}: Meta no informó gasto o alcance para esta cuenta.`);
    if (x && x.pc) return { ...celda('por cuenta', TXT.valor, null, null, `Corre en ${x.pc.length} cuentas. ${NO_SUMA}`), hasC: true,
      cs: [...x.pc.map(cuenta), renglon(`Corre en ${x.pc.length} cuentas: Meta no junta a las personas entre cuentas, por eso no se suma.`, TXT.gris)] };
    if (x && x.spc) return { ...celda('sin dato por cuenta todavía', TXT.gris, null, null, sinPorCuentaTxt(x)), hasC: x.cc.length > 0, cs: x.cc.map(cuenta) };
    if (!x || x.sin) return celda('sin dato', TXT.gris, null, null, x && x.sin ? `Sin dato: ${motivoUsuario(x.sin)}` : '');
    return celda(col.fmt(x.v), TXT.valor, renglon('sin referencia todavía', TXT.gris, 'Todavía no hay referencias de CPM de Alcance para comparar.'), null, `Meta: ${fN(x.a)} personas alcanzadas con ${fMs(x.g)}.${ALC_VENTANA(x)}`);
  }
  if (col.soloMeta && c.st) return celda('no aplica (Stories)', TXT.gris, null, null, 'La campaña está solo en Stories, que no registra reacciones.');
  if (col.soloMeta && !c.sm) return celda('no aplica (sin Meta)', TXT.gris, null, null, 'La campaña no tiene impresiones en Meta en este período.');
  if (x.v == null) return celda(col.sin || '—', TXT.gris, null, null, col.sin ? '' : 'Sin dato en este período.');
  // contra lo normal del proyecto (siempre "vs. <proyecto>"; que la referencia es solo de Meta lo dice la ayuda de la columna)
  const igual = col.porPlat ? 'la misma plataforma y objetivo' : 'el mismo objetivo y formato';
  const p = x.p ? comparaTxt(x.p, col, `vs. ${proyN}`, `Lo normal en las campañas de ${(ref && ref.de) || proyN}, con ${igual}`, otra && otra.esta)
    : renglon(`sin referencia en ${proyN}`, TXT.gris, c.sm || col.porPlat ? `No hay suficientes casos en ${(ref && ref.de) || proyN} con ${igual} para comparar (la referencia tiene que cubrir al menos el 80 % de la campaña).` : 'La campaña no tiene Meta en este período: las referencias son de Meta.');
  // contra la misma campaña: la estacional confirmada contra la temporada pasada; el resto contra sus semanas anteriores
  const est = tipo === 'estacional' && c.tp, nombre = est ? 'temporada pasada' : 'semanas anteriores';
  let s;
  if (otra) s = x.s ? comparaTxt(x.s, col, `vs. ${otra.nombre}`, otra.quien, otra.esta) : renglon(`sin referencia en ${otra.nombre}`, TXT.gris, otra.sin);
  else if (c.sp === 'per') s = renglon(`${nombre}: no en este período`, TXT.gris, `La comparación con ${est ? 'la temporada pasada' : 'sus semanas anteriores'} se hace con el mes en curso o los últimos 7 o 30 días.`);
  else {
    const y = est ? x.t : x.s;
    const xx = col.porPlat ? 'plataforma por plataforma' : 'formato por formato';
    if (y) s = comparaTxt(y, col, `vs. ${nombre}`, est ? `Esta campaña en las mismas semanas de la temporada pasada, ${xx}, con la plata llevada a valores de hoy` : `Esta misma campaña antes de las últimas dos semanas, ${xx}`);
    else s = renglon(est ? 'sin temporada pasada' : 'sin semanas anteriores', TXT.gris, c.sp === 'e' ? 'Poca historia: la comparación con sus semanas anteriores aparece desde la tercera semana.'
      : c.sp ? (col.porPlat ? 'En las semanas anteriores no hubo suficientes reproducciones en estas plataformas para comparar' : 'En las semanas anteriores no hubo suficiente de estos formatos para comparar')
        + ' (la referencia tiene que cubrir al menos el 80 % de la campaña en el período).' : !c.sm ? 'La historia de cada campaña (de cuándo a cuándo comparar) se arma hoy con sus semanas en Meta, y esta campaña no tiene Meta en el período: todavía no se compara contra sí misma.' : 'Campaña de menos de 30 días que no es constante ni estacional: no se compara contra sí misma.');
  }
  // CTR de la parte de Google de Tráfico (02/10): cada red contra lo normal de esa misma red (nunca mezcladas). Con Meta, el valor de la
  // celda sigue siendo el de Meta y Google va en un renglón más por red ("Search: 3,12 % · vs. lo normal de Search en Santa Fe (10,36 %):
  // −70 % ▼ peor"). Solo Google en una red y todo Tráfico: el valor es el de Google y el primer renglón es su comparación.
  if (col.k === 'ctr' && x.gg && x.gg.length) {
    const solo = !c.sm && x.gg.length === 1 && x.gg[0].u;
    const gs = x.gg.map((e) => ggRenglon(e, col, proyN, ref, !solo));
    if (solo) return { ...celda(col.fmt(x.v), TXT.valor, gs[0], s), hasG: false, gs: [] };
    return { ...celda(col.fmt(x.v), TXT.valor, p, s), hasG: true, gs };
  }
  return celda(col.fmt(x.v), TXT.valor, p, s);
}
// un renglón de la parte de Google: e = { red, redL, v, r, n ('p' proyecto, 't' todos los proyectos) }; conValor = antepone "Search: 3,12 % · "
function ggRenglon(e, col, proyN, ref, conValor) {
  const pre = conValor ? `${e.red}: ${col.fmt(e.v)} · ` : '';
  if (e.r == null) return renglon(`${pre}sin referencia en ${e.redL}: todavía hay pocos casos`, TXT.gris,
    `Lo normal de CTR en ${e.redL} se calcula con los anuncios de Tráfico de esa red, cada red de Google por separado, y todavía hay pocos casos para comparar. ${conValor ? `La parte de ${e.redL} de esta campaña: ${col.fmt(e.v)}.` : ''}`.trim());
  const q = e.n === 'p' ? proyN : 'todos los proyectos';
  const quien = `Lo normal de CTR de los anuncios de Tráfico en ${e.redL} (cada red de Google por separado) en ${e.n === 'p' ? (ref && ref.de) || proyN : proyN === 'todos los proyectos' ? (ref && ref.de) || q : `todos los proyectos (${proyN} todavía tiene pocos casos en ${e.redL})`}`;
  const l = comparaTxt({ v: e.v, r: e.r }, col, `vs. lo normal de ${e.red} en ${q}`, quien, `La parte de ${e.redL} de esta campaña`);
  return pre ? { ...l, txt: pre + l.txt } : l;
}
// Contenidos y Audiencias traen la celda compacta { v, p, s } (p y s = valor de referencia): se lleva a la forma de la lista de Campañas
const kcAmplio = (kc) => Object.fromEntries(Object.entries(kc || {}).map(([k, x]) => [k, !x || 'sin' in x || k === 'ca' ? x : { v: x.v, p: x.p != null ? { v: x.v, r: x.p } : null, s: x.s != null ? { v: x.v, r: x.s } : null }]));
const contraCampana = (esta) => ({ nombre: 'la campaña', esta, quien: 'Toda esta campaña (todas sus piezas y audiencias en Meta, en los mismos meses), con el mismo objetivo y formato',
  sin: 'No hay suficiente de estos formatos en la campaña para comparar.' });
// "% del total" de la pestaña Activos (01/10): "34 % de la campaña", "28 % del proyecto"; nada si no hay número o no hay total
const pctDe = (n, tot, de) => { if (!(n > 0) || !(tot > 0)) return ''; let p = Math.round(n / tot * 100); if (p >= 100 && n < tot) p = 99; return (p < 1 ? 'menos de 1' : String(Math.min(p, 100))) + ' % ' + de; };
const SIN_PC = { camp: '', cont: '', imp: '', vw: '', rea: '', gasto: '' };
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
  // antes del día 5 del mes no se proyecta (05/10; antes el 10): se muestra lo que lleva y desde cuándo se calcula
  if (l.pocosDias && l.lleva != null) { const f = `Lleva ${cantTxt(l.lleva, l.metrica)} ${l.desde.slice(8) === '01' ? 'este mes' : `desde el ${dm(l.desde)}`}. ${l.sinDato}.`; return { hay: true, etiqueta: 'sin dato', dot: COL.n, frase: f, plata: '', titulo: f }; }
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
// El alcance NUNCA se suma (regla de Juan Pablo del 02/10): ni entre días, ni entre anuncios, ni entre cuentas o canales. Cada período
// viene { a, f, d, h } (una cuenta: dato exacto), { pc: [{ c, a, f, d, h }] } (varias cuentas: una entrada por cuenta, de mayor a
// menor, sin total), { sin, spc: true, ci, cc } (varias cuentas y Meta todavía no informa el alcance dentro de cada una; cc = las que sí
// tienen dato) o { sin: motivo } (sin dato de hoy).
const ALC_PER = { desde_inicio: 'desde que empezó', ultimos_7: 'en los últimos 7 días', ultimos_30: 'en los últimos 30 días', mes_en_curso: 'en lo que va del mes' };
const fP = (v) => Math.round(v).toLocaleString('es-AR');
// números cortos de la lista de Campañas: "1,2 M", "45 mil", "830"
const fCant = (n) => (!n ? '0' : n >= 1e6 ? (n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' M' : n >= 1e3 ? Math.round(n / 1e3).toLocaleString('es-AR') + ' mil' : fP(n));
const fVeces = (v) => (v == null || !isFinite(v) ? '—' : v.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const fCorto = (n) => (n >= 1e6 ? (n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' M' : n >= 1e4 ? Math.round(n / 1e3).toLocaleString('es-AR') + ' mil' : fP(n));   // "mil" y "M", como en las tablas (02/10)
// las cuentas que faltan, en la tarjeta (02/10): "falta Chaco Urbano", "faltan Chaco Urbano y Nodo Chaco", "faltan 3 cuentas" (el detalle, al pasar el mouse)
const faltaTxt = (xs) => (!xs || !xs.length ? '' : xs.length === 1 ? `falta ${xs[0]}` : xs.length === 2 ? `faltan ${xs[0]} y ${xs[1]}` : `faltan ${xs.length} cuentas`);
const faltanDe = (x) => (x.nl && x.nl.length ? x.nl : (x.ci || []).filter((n) => !(x.cc || []).some((i) => i.c === n)));
const renglonFalta = (xs, title) => (xs && xs.length ? [{ ...renglon(faltaTxt(xs), TXT.gris, title), ws: 'normal' }] : []);
const hayAlc = (x) => !!x && !x.sin;
const NO_SUMA = 'Meta no junta a las personas entre cuentas, por eso el alcance no se suma.';
const listaY = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs.join(''));
// "sin dato por cuenta todavía": en qué cuentas corre y cuáles sí tienen dato (nunca el alcance de toda la cuenta)
// fc (General): los canales donde la campaña corre y Meta todavía no informa el alcance de sus cuentas
// nl: las cuentas donde corrió la campaña en el período y que no están en la lectura de Meta de hoy (02/10)
const sinPorCuentaTxt = (x) => (x.nl && !x.fc ? `Sin dato por cuenta todavía: corre en ${(x.ci || []).length} cuentas (${listaY(x.ci || [])}) y falta el alcance de Meta de ${listaY(x.nl)}. ${NO_SUMA}${x.cc && x.cc.length ? ` Con dato: ${listaY(x.cc.map((i) => i.c))}.` : ''}` : x.fc ? `Sin dato por cuenta todavía: la campaña corre en Oficial e Informativo y Meta todavía no informa el alcance de sus cuentas de ${listaY(x.fc)}. ${NO_SUMA}${x.cc && x.cc.length ? ` Con dato: ${listaY(x.cc.map((i) => i.c))}.` : ''}` : `Sin dato por cuenta todavía: corre en ${(x.ci || []).length || 'varias'} cuentas${(x.ci || []).length ? ` (${listaY(x.ci)})` : ''} y Meta todavía no informa el alcance dentro de cada una. ${NO_SUMA}${x.cc && x.cc.length ? ` Con dato: ${listaY(x.cc.map((i) => i.c))}.` : ''}`);
// "Llegó a 120.000 personas en los últimos 7 días, que la vieron 3,2 veces en promedio."
function alcanceFrase(x, per) {
  const cuando = ALC_PER[per] || '';
  if (x.pc) return `Corre en ${x.pc.length} cuentas ${cuando}: ${x.pc.map((i) => `${i.c} llegó a ${fP(i.a || 0)} personas (${fVeces(i.f)} veces cada una)`).join('; ')}. ${NO_SUMA}`;
  return x.a ? `Llegó a ${fP(x.a)} personas ${cuando}, que la vieron ${fVeces(x.f)} veces en promedio.` : `No llegó a nadie ${cuando}.`;
}
// una línea por cuenta: "Gaceta Santafesina: 120.000 personas · 2,1 veces" (puede ocupar dos renglones de la tarjeta)
// fl = la fecha de la lectura de esa cuenta: si es distinta de la general, va "(al dd/mm)" (preparado para lecturas por cuenta, 03/10)
const flCuenta = (i) => (i && i.fl && i.fl !== ((DATA.alcanceMeta || {}).fechaLectura || (DATA.alcanceMeta || {}).fecha) ? ` (al ${dm(i.fl)})` : '');
const renglonCuenta = (i, per) => ({ ...renglon(`${i.c}${flCuenta(i)}: ${fP(i.a || 0)} personas · ${fVeces(i.f)} veces`, TXT.valor,
  `${i.c}: llegó a ${fP(i.a || 0)} personas ${ALC_PER[per] || ''} dentro de esa cuenta, que la vieron ${fVeces(i.f)} veces en promedio.`), ws: 'normal' });
const sinDatoTxt = (motivo) => 'Sin dato de hoy' + (motivo ? ': ' + motivo.charAt(0).toLowerCase() + motivo.slice(1) : '.');
// Tarjeta de alcance de la campaña: el período principal es "desde que empezó"; si no está, 30 y 7 días. Al pasar el mouse, también
// los últimos 7 días. Varias cuentas: una línea por cuenta, sin total, y abajo por qué no se suma.
// perFijo (Rendimiento con período elegible, 02/10): un solo período de la lectura de Meta, el que corresponde a la opción elegida
// ("Histórica" = desde que empezó; "Este mes" = desde que empezó si arrancó este mes, si no 7 o 30 días); si no es "desde que empezó",
// la línea dice cuál es ("· últ. 7 días")
const ALC_CORTO = { ultimos_7: 'últ. 7 días', ultimos_30: 'últ. 30 días' };
const alcLabel = () => { const L = DATA.alcanceMeta || {}; return L.deHoy === false && L.fechaLectura ? `Personas alcanzadas · al ${dm(L.fechaLectura)}` : 'Personas alcanzadas'; };
function alcanceTarjeta(tt, perFijo) {
  const A = tt.alcM || {}, L = DATA.alcanceMeta || {}, PERS = perFijo ? [perFijo] : ['desde_inicio', 'ultimos_30', 'ultimos_7'], leido = `Dato de Meta leído el ${dm(L.fecha)}.`;
  const cual = ALC_CORTO[PERS[0]] && perFijo ? ` · ${ALC_CORTO[PERS[0]]}` : '';
  const per = PERS.find((p) => hayAlc(A[p]));
  if (!per) {
    const ps = PERS.find((p) => A[p] && A[p].spc);
    if (ps) { const x = A[ps], motivo = sinPorCuentaTxt(x);
      return { label: alcLabel(), val: '—', alcM: A, lineas: [{ ...renglon('sin dato por cuenta todavía' + cual, TXT.gris, motivo), ws: cual ? 'normal' : 'nowrap' }, ...renglonFalta(faltanDe(x), motivo), ...x.cc.map((i) => renglonCuenta(i, ps))], title: `Personas alcanzadas${cual ? ' (' + ALC_PER[ps] + ')' : ''}: ${motivo} ${leido}` }; }
    const motivo = motivoUsuario((A[PERS[0]] && A[PERS[0]].sin) || L.motivo || '');
    return { label: alcLabel(), val: '—', alcM: A, lineas: [renglon('sin dato de Meta', TXT.gris, motivo), ...renglonFalta(A[PERS[0]] && A[PERS[0]].nl, motivo)], title: `Personas alcanzadas: sin dato de Meta. ${motivo}` }; }
  const x = A[per], y = per !== 'ultimos_7' && hayAlc(A.ultimos_7) ? A.ultimos_7 : null;
  const siete = !y ? '' : y.pc ? `Últimos 7 días, por cuenta: ${y.pc.map((i) => `${i.c}, ${fP(i.a || 0)} personas, ${fVeces(i.f)} veces cada una`).join('; ')}.` : `Últimos 7 días: ${fP(y.a || 0)} personas, ${fVeces(y.f)} veces cada una.`;
  const frase = alcanceFrase(x, per);
  if (x.pc) {
    const nota = { ...renglon(`Corre en ${x.pc.length} cuentas${cual ? ` (${ALC_CORTO[per]})` : ''}: Meta no junta a las personas entre cuentas, por eso no se suma.`, TXT.gris), ws: 'normal' };
    return { label: alcLabel(), val: `${x.pc.length} cuentas`, alcM: A, lineas: [...x.pc.map((i) => renglonCuenta(i, per)), nota], title: `${frase} ${siete ? siete + ' ' : ''}${leido}` };
  }
  const periodo = x.d && x.h ? `Del ${dm(x.d)} al ${dm(x.h)}. ` : '';
  return { label: alcLabel(), val: fCorto(x.a || 0), alcM: A, lineas: [renglon(cual ? `${fVeces(x.f)} veces${cual}` : `${fVeces(x.f)} veces por persona`, TXT.gris, frase)], title: `${frase} ${siete ? siete + ' ' : ''}${periodo}${leido}` };
}
// luz de cada tarjeta de la pantalla de campaña que no es el KPI principal: qué métrica compara (Impresiones compara el costo de mil impresiones)
const MET_TARJETA = { Impresiones: 'cpm', 'Costo por reacción': 'cr', CPM: 'cpm', 'Tasa de reacción': 'treac', 'Tasa de compartido': 'tcomp', CTR: 'ctrPct' };
// Eficacia (regla de Looker): qué parte del gasto fue a anuncios "flojos", los que rinden peor que lo normal (su costo por reacción está
// entre el 25 % más caro de los anuncios de su mismo objetivo y placement del proyecto, en su misma época). Textos del 01/10: corto
// "17 % del gasto en anuncios flojos", largo "17 % del gasto fue a anuncios que rinden peor que lo normal" (antes "17 % en rojo")
const EF_EXPLICA = 'Un anuncio es flojo cuando rinde peor que lo normal: su costo por reacción está entre el 25 % más caro de los anuncios de Meta de su mismo objetivo y placement en el proyecto, en su misma época (la regla de Looker).';
// ---- tarjetas de Rendimiento (01/10) ----
// nombre corto del proyecto para las líneas de las tarjetas ("vs. Catamarca" en vez de "vs. Catamarca Provincia"), así entran en una línea
const proyCorto = (n) => (String(n || '').length <= 12 ? n : String(n).split(' ')[0]);
// la tarjeta del objetivo (Interacción: Costo por reacción; Alcance: CPM; Tráfico y Conversión: CTR; Reproducciones: Costo por reproducción)
const TILE_OBJ = { cr: 'Costo por reacción', cpm: 'CPM', ctr: 'CTR', cv: 'Costo por reproducción' };
// la tarjeta donde va la comparación con la misma campaña: la métrica con la que Referencias arma su historia (costo por reacción, CTR o CPM)
const TILE_MET_LABEL = { cr: 'Costo por reacción', cpm: 'CPM', ctr: 'CTR' };
const FMT_TILE = { cr: fCosto, cpm: fCosto, cv: fCosto, ctr: fPct(2), ctrPct: fPct(2), treac: fPct(2), tcomp: fPct(3) };
// "vs. Santa Fe $105 · −60 %": la referencia y cuánto más alto o más bajo dio la campaña; rojo o verde solo con una diferencia grande
function lineaTile(v, ref, costo, etq, fmt, title) {
  const pct = Math.round((v / ref - 1) * 100), idx = costo ? ref / v : v / ref;
  const juicio = !isFinite(idx) || pct === 0 ? '' : idx >= 1.2 ? 'mejor' : idx < 1 / 1.2 ? 'peor' : '';
  return renglon(`${etq} ${fmt(ref)} · ${pct === 0 ? '0' : (pct > 0 ? '+' : '−') + Math.abs(pct)} %`, juicio === 'peor' ? TXT.rojo : juicio === 'mejor' ? TXT.verde : TXT.gris, title);
}
// motivo de "sin dato" del alcance de Meta, en lenguaje de usuario (nunca nombres de tablas, BigQuery ni procesos internos)
function motivoUsuario(m) {
  const t = String(m || '');
  if (!t) return 'Meta todavía no informó el alcance de hoy.';
  if (/^Todavía no se lee el alcance de Meta de /.test(t)) return t;   // ya en lenguaje de usuario: nombra las cuentas que no se leen (02/10)
  const canal = /Oficial/.test(t) ? ' de las cuentas de Oficial' : /Informativo/.test(t) ? ' de las cuentas de Informativo' : '';
  if (/BigQuery|tabla|prendió|consulta|extracción/i.test(t)) return `Meta todavía no informa el alcance${canal}.`;
  if (/una de sus cuentas|la cuenta /i.test(t)) return 'Falta el alcance de hoy de una de las cuentas de la campaña en Meta.';
  if (/lectura|bajaron|bajar|corrida|filas|estado|fecha futura|leyó|leer/i.test(t)) return 'Todavía no está el alcance de hoy de Meta: aparece cuando llega la lectura de la mañana.';
  return t.charAt(0).toUpperCase() + t.slice(1) + (/[.:]$/.test(t) ? '' : '.');
}
function efic(e) {
  if (!e || !e.N) return { c: COL.n, short: '—', largo: 'sin dato de anuncios flojos', corto: 'sin dato de anuncios flojos', txt: 'sin dato de anuncios flojos (sin anuncios de Meta con reacciones)', title: 'Sin anuncios de Meta con reacciones para medir cuánto del gasto fue a anuncios flojos.' };
  const largo = `${e.p} % del gasto fue a anuncios que rinden peor que lo normal`;
  return { c: COLN[e.color] || COL.n, short: e.p + ' %', largo, corto: `${e.p} % del gasto en anuncios flojos`, txt: `${largo} (${e.n} de ${e.N} anuncios)`, title: `${largo} (${e.n} de ${e.N} anuncios). ${EF_EXPLICA}` };
}
// "pagó $X más que lo habitual" pasa a decir qué se mide y contra qué (01/10): "Le costó $3,9 M más que si hubiera pagado el CPM normal de
// Santa Fe ($414)". dm = { m: métrica con la que se compra el objetivo, v: su valor normal en el proyecto } (lo arma armar.js con el
// mismo cálculo de siempre: solo cambia el texto). Corto para las filas: "$3,9 M de más vs. el CPM normal de Santa Fe"
const MET_NORMAL = { cpm: 'el CPM normal', cr: 'el costo por reacción normal', cpc: 'el costo por click normal', cv: 'el costo por reproducción normal' };
function deMasTxt(monto, dm, proy) {
  if (!monto) return { corto: '', largo: '' };
  const met = dm && MET_NORMAL[dm.m] ? MET_NORMAL[dm.m] : 'los costos normales', ref = dm && dm.v ? ` (${fCosto(dm.v)})` : '';
  return { corto: `${monto} de más vs. ${met} de ${proy}`, largo: `Le costó ${monto} más que si hubiera pagado ${met} de ${proy}${ref}. Es lo gastado por encima de lo que habría costado lo mismo a los costos normales del proyecto en el último año; no tiene que ver con el presupuesto.` };
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
// la lista de motivos de hoy más un texto opcional (02/10); en los motivos que lo piden, el texto es obligatorio
const motivoManualDe = (i, txt) => { const m = MOTIVOS_MANUAL[i]; if (!m) return null; const t = String(txt || '').trim(); return m.texto ? (t ? `${m.label}: ${t}` : null) : t ? `${m.label}: ${t}` : m.label; };
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
// 06/10 (Juan Pablo): Detalle queda solo con Campañas (y la Proyección abajo de todo); Activos, Ejes y Audiencias pasan al paso Estructura
// Mapa (propuesta de nodos de Claude Design) es la primera y abre por defecto; las tablas siguen después
const TABS_ESTRUCTURA = [['Mapa', 'mapa'], ['Activos', 'activos'], ['Ejes', 'ejes'], ['Audiencias', 'audiencias']];
const tabEstDe = (tab) => (TABS_ESTRUCTURA.some(([, k]) => k === tab) ? tab : 'mapa');
// a principio de mes (primera semana) el Mapa abre en los últimos 30 días: con pocos días del mes el mapa queda casi vacío
const mesTemprano = () => Number(DATA.datosHasta.slice(8, 10)) < 8;
const alMapa = (st) => (st.period === DATA.mes && mesTemprano() ? { period: '30d', abierto: {} } : {});
// Creatividades (06/10, Juan Pablo): se ve en su propia plataforma local; acá solo el link. publicar.js lo deja vacío (la copia no abre localhost)
const CREA_LINK = 'http://localhost:4340';
const GUIA = {
  refs: [['Contra lo normal del proyecto', 'Lo normal en este proyecto y canal en el último año, con el mismo objetivo y formato (en Meta) o la misma plataforma y objetivo (en el resto). Se nombra el proyecto: “lo normal en Santa Fe”. Hace falta un mínimo de 12 casos para comparar; si no los hay dice “Sin referencia en” y el proyecto. En Tráfico solo Meta tiene referencia de clicks. Aparece en todas las campañas. En las tablas con columna de Métrica (Campañas, Revisar campañas, y Contenidos y Audiencias de cada campaña) va debajo del KPI: “vs. Santa Fe ($240): +8 %”.'],
    ['Contra las semanas anteriores de esta campaña', 'Campañas de 30 días o más y campañas constantes (las que se comunican todo el año): las últimas dos semanas completas contra sus semanas anteriores. Por eso la línea dice primero cuánto dio en las últimas dos semanas. El valor entre paréntesis es lo que habrían dado esas dos semanas al rendimiento de antes, con la misma mezcla de formatos. Aparece desde la tercera semana.'],
    ['Contra la temporada pasada de esta campaña', 'Campañas estacionales confirmadas: lo que va de esta temporada contra las mismas semanas de la temporada anterior, con la plata de entonces llevada a valores de hoy por inflación. Reemplaza a la comparación con sus semanas anteriores.'],
    ['Contra la campaña (Contenidos y Audiencias)', 'Una pieza o una audiencia no tiene semanas anteriores propias: en Contenidos y Audiencias de cada campaña, la segunda comparación es contra toda la campaña en los mismos meses, con el mismo objetivo y formato (“vs. la campaña ($84): −20 %”). Dice si esa pieza o esa audiencia rinde mejor o peor que el resto de la campaña.'],
    ['Todos los gobiernos', 'La comparación con lo normal en todos los gobiernos ya no se muestra. El agente la sigue usando por dentro para algunas recomendaciones.'],
    ['El recorrido: General › Estructura › Detalle › Looker', 'Arriba de todo están los cuatro pasos. General: cómo viene el proyecto, sin números (solo el % del presupuesto usado), con lo que pide atención. Estructura: cómo está armada la pauta. Abre en el Mapa (muestra cómo se relacionan los ejes, las campañas, los activos y las audiencias, con el gasto de cada uno y cómo rinde; tocar un círculo resalta lo conectado, y arriba hay un buscador “¿Dónde está…?” y filtros por eje y activo) y sigue con las tablas Activos, Ejes y Audiencias (tablas anidadas, con el selector de Métrica y el Período). Detalle: la lista de Campañas con sus números (cada una con el KPI de su objetivo; tocando una se abre su ficha con todas las métricas) y, abajo de todo, la Proyección: primero las tarjetas de Gasto del mes contra el presupuesto y después la proyección por proyecto, ejes, campañas y activos. Looker: el tablero de Looker del proyecto y canal. Insights se abre con su botón, al lado de los pasos; Creatividades ↗ abre la plataforma de Creatividades en otra pestaña (solo en la app local). El botón Acciones está siempre arriba a la derecha.'],
    ['Marca Bueno · Regular · Malo', 'Sigue la Métrica elegida arriba (en General y en Estructura es el mismo selector; la portada no lo usa: tiene su propia nota) y el rótulo dice cuál: “Cómo rinde (CPM)”. En la lista de Campañas de Detalle va siempre según el objetivo de cada campaña: “Cómo rinde (según su objetivo)”. CPM de Alcance no tiene marca (Meta no da el alcance por pieza). Con “Según objetivo”, compara la métrica del objetivo de cada campaña (costo por reacción en Interacción, CPM en Alcance, CTR en Tráfico y Conversión, costo por reproducción en Reproducciones) con las del mismo proyecto en 2026, por objetivo y placement: Bueno si está entre el 25 % mejor, Malo si está entre el 25 % peor, Regular en el medio. Sin referencia: menos de 12 casos para comparar. La marca de un eje, un activo o un proyecto es la más repetida entre sus campañas, contando cuánto gastó cada una.'],
    ['Nota de rendimiento (portada, de 1 a 5)', 'Cada campaña se mide por la métrica de su objetivo y se ubica entre las campañas del mismo proyecto, canal, objetivo y placement de 2026 (con las mismas condiciones mínimas que la marca: 12 piezas y 1.000 impresiones): el 10 % mejor es 5 Muy bueno; del 10 al 35 %, 4 Bueno; del 35 al 65 %, 3 Regular; del 65 al 90 %, 2 Malo; el 10 % peor, 1 Muy malo. La nota del proyecto es el promedio de sus campañas al aire, ponderado por lo que gastó cada una, redondeado al entero más cercano; las campañas sin referencia no cuentan, y si no queda ninguna, Sin referencia. “Rinden mal” nombra las de nota 1 o 2, empezando por las que más gastaron. La marca de tres niveles (Bueno, Regular, Malo) de las otras pantallas no cambia.'],
    ['Ritmo · Proyección', 'Ritmo: el gasto de los últimos 7 días contra el que hace falta para llegar al presupuesto (Rápido, Normal o Lento; no es bueno ni malo). Proyección: desde el día 5 del mes, si al ritmo de los últimos 7 días el gasto llega al presupuesto (±10 %), se pasa o no llega. Las personas alcanzadas no se proyectan ni se suman.'],
    ['Canal Ambas (Oficial e Informativo juntos)', 'Arriba, al lado de Oficial e Informativo, “Ambas” muestra el proyecto con los dos canales sumados, con los mismos pasos (General, Estructura y Detalle) e Insights. Una campaña con el mismo nombre en los dos canales aparece una sola vez, sumada, con una etiqueta que dice en qué canales corrió (“Oficial + Informativo”). “vs. Santa Fe” es lo normal en el proyecto con los dos canales juntos, con el mismo criterio que en cada canal; si no hay suficientes casos, dice “sin referencia”. “vs. semanas anteriores” es la campaña sumada antes de las últimas dos semanas. Las recomendaciones siguen siendo de cada canal: se ven las de los dos, cada una con su canal. Los presupuestos con el mismo nombre en los dos canales se suman. El detalle de una campaña es el de un canal (el que más gastó); si está en los dos, arriba se puede pasar al del otro. No tiene pestaña Looker.'],
    ['Todos los proyectos', 'En Mis proyectos, la primera tarjeta abre los siete proyectos juntos en el canal elegido arriba, con los mismos pasos: “Todos los proyectos · Oficial”, “· Informativo” o “· Ambas” (los dos canales de cada proyecto). Si se cambia el canal adentro del panel, el panel pasa a ese canal. Cada fila dice de qué proyecto es (en General, también en qué canales corrió); las campañas no se suman entre proyectos. “vs. todos los proyectos” es lo normal en ese canal con los siete proyectos juntos (en General, con los dos canales juntos), con el mismo criterio que en cada proyecto; si no hay suficientes casos, dice “sin referencia”. “vs. semanas anteriores”, igual que en cada proyecto. La Proyección de Detalle tiene el total del canal y una tarjeta por proyecto. No tiene Looker.']],
  colors: [[COL.g, 'none', 'Verde: bastante mejor que la referencia. En costos, 17 % más barato o más (por la misma plata rinde 20 % más); en clicks, 20 % más alto o más.'], [COL.y, 'none', 'Amarillo: parecido a la referencia, entre verde y rojo.'], [COL.r, 'none', 'Rojo: bastante peor. En costos, 20 % más caro o más; en clicks, 17 % más bajo o más.'], [COL.n, 'none', 'Gris: sin referencia para comparar.'], ['transparent', '1.5px solid #A6AAA9', 'Vacío: poca historia; la comparación con sus semanas anteriores aparece desde la tercera semana.']],
  kpi: [['Columna de KPI (Campañas, Contenidos y Audiencias)', 'En la lista de Campañas de Detalle va siempre según objetivo, sin selector. En Contenidos y Audiencias de cada campaña hay un selector (lo que se elige en una vale para las dos): Según objetivo (cada campaña muestra el KPI que busca su objetivo y lo nombra: Interacción, Costo por reacción; Alcance, CPM; Reproducciones, Costo por reproducción; Tráfico y Conversión, CTR) o un solo KPI para todas: Costo por reacción, CPM, CTR, ETR Videos, ETR Imágenes, CPM de Alcance o Costo por reproducción. En la celda, arriba el nombre del KPI y el valor de la campaña en el período, en la misma línea (“CPM: $352”); abajo, contra lo normal del proyecto (“vs. Santa Fe ($240): +8 %”) y contra la misma campaña (“vs. semanas anteriores” o “vs. temporada pasada”), con el valor de referencia entre paréntesis. Rojo o verde solo con una diferencia grande, con ▲ o ▼ y la palabra “peor” o “mejor”; gris si es parecido. En campañas solo de Stories, Costo por reacción y ETR dicen “no aplica”. En Contenidos y Audiencias, de los meses que trae la campaña (hasta seis), solo Meta, y la segunda comparación es contra toda la campaña. Al lado del KPI van Impresiones y Reacciones. El selector se recuerda mientras la página esté abierta.'], ['Interacción', 'Cada reacción costó $X (costo por reacción). Más caro es peor.'], ['Alcance', 'Mostrar el anuncio mil veces costó $X (CPM, también en la tarjeta de impresiones). Más caro es peor.'], ['Tráfico y Conversión', 'De cada 100 que lo vieron, X hicieron click (CTR). Se dice más alto o más bajo, y si es mejor o peor.'], ['Reproducciones (YouTube, TikTok, Google)', 'Cada reproducción costó $X (costo por reproducción = gasto ÷ reproducciones, en todas las plataformas con reproducciones). Más caro es peor.']],
  met: [['Personas alcanzadas (Meta)', 'Personas distintas que vieron la campaña, y cuántas veces la vio cada una en promedio (frecuencia). Lo lee PAUTADOR de Meta cada mañana. El alcance nunca se suma: ni entre días, ni entre anuncios, ni entre cuentas o canales. Si la campaña corre en varias cuentas, Meta no junta a las personas entre cuentas: se muestra una línea por cuenta (“Gaceta Santafesina: 120.000 personas · 2,1 veces”), de la que más llegó a la que menos, sin total; si Meta todavía no informa el alcance dentro de cada cuenta, dice “sin dato por cuenta todavía” y lista las cuentas que sí tienen dato. Si todavía no hay dato de Meta, la tarjeta dice “—” y “sin dato de Meta”; el motivo se ve al pasar el mouse.'],
    ['Tarjetas de Rendimiento (pantalla de campaña)', 'Una fila de tarjetas chicas con los últimos 180 días: Impresiones, Personas alcanzadas, Costo por reacción, CPM, Tasa de reacción, Tasa de compartido y CTR (y Costo por reproducción si el objetivo es Reproducciones). Cada una: el nombre, el valor y hasta dos líneas cortas: “vs. Santa Fe $105 · −60 %” (lo normal en el proyecto) y “vs. sem. ant. $84 · −83 %” (esta campaña antes; en las estacionales, “vs. temp. pas.”). El porcentaje es cuánto más alto (+) o más bajo (−) dio la campaña. Verde o rojo solo con una diferencia grande; gris si es parecido. La del objetivo de la campaña tiene el borde marcado y dice “objetivo”. La frase completa, al pasar el mouse.'], ['Costo por reacción', 'Gasto ÷ reacciones. La medida de efectividad de los contenidos.'], ['Tasa de reacción', 'Reacciones ÷ impresiones'], ['Tasa de compartido', 'Compartidas ÷ impresiones (difusión orgánica)'], ['Tasa de comentario', 'Comentarios ÷ impresiones (conversación o polémica)'], ['ETR', 'ETR = engagement ÷ impresiones × 100. En video el engagement es casi todo reproducciones; en placas, casi todo clicks. Por eso en la lista de Campañas va en dos columnas: ETR Videos y ETR Imágenes (placas y carruseles), cada una comparada contra su mismo formato. Solo Meta.'], ['CPM de Alcance', 'CPM de Alcance = gasto ÷ personas alcanzadas × 1.000, con el alcance real de Meta que lee PAUTADOR cada mañana. Solo cuando hay lectura de hoy y su ventana coincide con el período elegido (últimos 7 o 30 días, o el mes en curso si la campaña empezó este mes); si no, “sin dato”. Todavía sin referencias para comparar. Si la campaña corre en varias cuentas, va un CPM por cuenta, cada uno con el gasto y el alcance de esa cuenta: el alcance no se suma entre cuentas.'], ['CTR', 'Clicks ÷ impresiones. En la columna de Métrica, la parte de Tráfico en Google va en un renglón más por red (“Search: 3,12 % · vs. lo normal de Search en Santa Fe (10,36 %): −70 % ▼ peor”), contra lo normal de esa misma red en el proyecto (si el proyecto tiene pocos casos, en todos los proyectos; en Todos los proyectos, siempre contra todos). Search, Display y YouTube nunca se mezclan. Display y YouTube todavía no tienen referencia: “sin referencia en Google Display: todavía hay pocos casos”.'], ['CPM · Costo por click · Costo por reproducción', 'Gasto ÷ …'], ['Video: retención 25/50/75/100 %', 'Reproducciones al X % ÷ reproducciones'], ['$X de más vs. el CPM normal de Santa Fe', 'En rojo debajo del nombre de la campaña. Le costó $X más que si hubiera pagado el costo normal del proyecto por lo mismo que consiguió: el CPM en Alcance, el costo por reacción en Interacción, el costo por click en Tráfico (en la lista de Campañas, el costo por reproducción en Reproducciones). Es lo gastado por encima de los costos normales del proyecto en el último año; no tiene relación con el presupuesto. Al pasar el mouse: “Le costó $3,9 M más que si hubiera pagado el CPM normal de Santa Fe ($414)”.'], ['Eficacia: % del gasto en anuncios flojos', 'Qué parte del gasto fue a anuncios que rinden peor que lo normal (“17 % del gasto en anuncios flojos”). Un anuncio es flojo cuando su costo por reacción está entre el 25 % más caro de los anuncios de Meta de su mismo objetivo y placement en el proyecto, en su misma época (la regla de Looker). El cuadradito: menos de 25 % verde, menos de 50 % amarillo, menos de 75 % naranja, y rojo por encima.']],
  blocks: [['Gasto del mes', 'Inversión contra tiempo, con el PresupuestoMensual de DataJunta y la proyección al cierre (promedio de los últimos 2 días completos).'], ['Proyección (abajo de todo en Detalle)', 'Primero las tarjetas de Gasto del mes contra el presupuesto; después, para el proyecto, cada eje, cada campaña al aire y cada activo: gasto al cierre, resultado al cierre, ritmo y lo que lleva hoy. Ejes y campañas no tienen presupuesto propio. Las personas alcanzadas no se proyectan ni se suman.'], ['Estructura: Activos · Ejes · Audiencias', 'Tablas anidadas con logos de plataforma, Impresiones · Reproducciones · Reacciones · Gasto y Eficacia (en Activos, activo → campaña con su Salud: ritmo de gasto y restante del pedido). Ejes: eje → campaña → pieza → anuncio. Audiencias: audiencia → campaña → pieza. Activos: activo → campaña; debajo de cada número (salvo Campañas), en chico, qué parte del total representa: en cada activo, “28 % del proyecto” (del total del proyecto en el canal y período elegidos; en Todos los proyectos, “del total”); en cada campaña, “34 % de la campaña” (de toda la campaña, sumando todos sus activos). La columna Campañas no lleva %: una campaña corre en varios activos y los porcentajes podían sumar más de 100. Cambian con el período.'], ['Acciones', 'Problema → Solución, qué está afectado (campaña, contenido, conjuntos de anuncios) y qué revisar. Se envían a PAUTADOR, se marcan hechas a mano o se descartan con motivo.'], ['Looker', 'El tablero de Looker Studio del proyecto, embebido. El link de inserción se carga una vez por proyecto y canal.']],
  src: [['DataJunta, Meta', 'Copia diaria de 180 días (9:10).'], ['DataJunta, todas las plataformas', 'Últimos 180 días por día: Google Ads, DV360, TikTok, SMS.'], ['Alcance', 'El alcance real de Meta que lee PAUTADOR cada mañana, por campaña y por pieza.'], ['Eficacia', 'Se recalcula todos los días a las 9:20, con la misma regla que Looker, con ventana móvil y mínimo 12 anuncios.'], ['Referencias', 'Generales y por proyecto: último año. Propias: semanales, desde 2024. Por plataforma (fuera de Meta): últimos 180 días.'], ['Presupuesto', 'PresupuestoMensual de DataJunta, por proyecto y canal.'], ['Último día completo', 'DataJunta carga a las 8:00 el día anterior.']],
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
function histView(h, fmt) {
  const ws = (h.semanas || []).filter((w) => w.x != null).slice(-12);
  const vals = ws.map((w) => w.x);
  const max = Math.max(1.2, ...vals, h.ref ? h.ref.p75 * 1.2 : 0) * 1.05;
  const Y = (v) => 180 - v / max * 160, n = Math.max(1, ws.length), step = 610 / n, bw = Math.min(44, step * 0.7);
  return {
    bandY: h.ref ? Y(h.ref.p75) : 0, bandH: h.ref ? Y(h.ref.p25) - Y(h.ref.p75) : 0, medY: h.ref ? Y(h.ref.p50) : -10,
    bars: ws.map((w, i) => ({ x: 30 + i * step + (step - bw) / 2, cx: 30 + i * step + step / 2, y: Y(w.x), h: 180 - Y(w.x), w: bw, c: i >= ws.length - 2 ? '#3C3C3C' : '#D5D5D5', label: dm(w.s), val: w.v != null && fmt ? fmt(w.v) : '', ty: Y(w.x) - 6 })),
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
// <alias-campanas>
// Lo guardado por nombre de campaña (tipos, decisiones, comentarios) se busca con la clave exacta y, si no está, por el nombre normalizado,
// el oficial o el viejo (DATA.aliasCampanas: la tabla de borrador/nombres-oficiales.js, vía app/alias-campanas.js). Sin migrar nada.
const normCamp = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const oficialCamp = (pid, n) => { const p = DATA.proyectos.find((x) => x.id === pid), al = DATA.aliasCampanas || {}, nn = normCamp(n); if (p) for (const q of [p.cliente, p.cliente + ' Oficial']) if (al[q] && al[q][nn]) return al[q][nn]; return n; };
const _idxTipos = new WeakMap();
const tipoGuardado = (tipos, key) => {
  if (tipos[key] !== undefined) return tipos[key];
  let ix = _idxTipos.get(tipos);
  if (!ix) {
    ix = {};
    for (const [k, v] of Object.entries(tipos)) {
      const a = k.split('|'); if (a.length < 3) continue;
      const c = a.slice(2).join('|');
      for (const n of new Set([normCamp(c), normCamp(oficialCamp(a[0], c))])) ix[a[0] + '|' + a[1] + '|' + n] = v;
    }
    _idxTipos.set(tipos, ix);
  }
  const a = key.split('|'); if (a.length < 3) return undefined;
  return ix[a[0] + '|' + a[1] + '|' + normCamp(a.slice(2).join('|'))];
};
// </alias-campanas>
const tiposGuardados = () => { const t = store('syo.tipos', null); if (t) return t; const v = store('syo.seasonal', {}); return Object.fromEntries(Object.entries(v).filter(([, x]) => x).map(([k, x]) => [k, x === 'si' ? 'estacional' : 'ninguna'])); };
const chipsDe = (codes) => codes.map((code) => ({ code, name: DATA.nombres[code] || code, icon: DATA.logos[code] || DATA.logos.OT }));
const conLogo = (plats) => (plats || []).map((p) => ({ ...p, icon: DATA.logos[p.code] || DATA.logos.OT }));
const sumO = (rows) => rows.reduce((o, r) => { o.i += r.i || r.imp || 0; o.vw += r.vw || 0; o.r += r.r || r.rea || 0; o.g += r.g || r.gasto || 0; o.xr += r.xr || 0; o.xg += r.xg || 0; return o; }, { i: 0, vw: 0, r: 0, g: 0, xr: 0, xg: 0 });

// ---------- vistas que juntan (pedido de Juan Pablo del 01/10) ----------
// Canal "General": el proyecto con Oficial e Informativo juntos. "Todos los proyectos": los siete proyectos del canal elegido en un solo
// panel (Oficial, Informativo o General = los dos canales de cada proyecto). Se arman en la página con los bloques de cada canal (así la app no pesa el doble); de armar.js vienen solo la lista
// de Campañas de la General (una campaña con el mismo nombre en los dos canales va una vez, sumada), los contenidos distintos por
// activo y la eficacia por categoría. En el panel cada fila sigue siendo de su proyecto: los ids llevan el proyecto adelante
// ("chaco::Obras") para que una campaña o un activo con el mismo nombre en dos proyectos no se junte; en pantalla va el nombre solo
// y una etiqueta con el proyecto. Las recomendaciones siguen siendo de cada canal y de cada proyecto: se muestran todas, marcadas.
const TODOS = 'todos';
const PROY_TODOS = { id: TODOS, nombre: 'Todos los proyectos', canales: { Oficial: true, Informativo: true } };
const CANALES = ['Oficial', 'Informativo'];
const conPid = (pid, x) => `${pid}::${x}`;
const sinPid = (x) => { const t = String(x == null ? '' : x), i = t.indexOf('::'); return i < 0 ? t : t.slice(i + 2); };
const pidDe = (x) => { const t = String(x == null ? '' : x), i = t.indexOf('::'); return i < 0 ? null : t.slice(0, i); };

// ==== recorrido en pasos (rediseño de Juan Pablo del 02/10, sobre la maqueta recorrido-v1) ====
// Exposición (panorama, sin números salvo el % del presupuesto) › Detalle (activos, campañas al aire, audiencias, ejes y Proyección, con
// marcas y pocas palabras) › Exploración (todo lo que había: tablas, selector de KPI, Rendimiento, Insights y Looker). Acciones, siempre
// a mano en el encabezado.
// el paso 1 se llama "General" (decisión de Juan Pablo del 02/10); el canal Oficial + Informativo pasa a decir "Ambas" (clave interna 'General')
// ajuste del 03/10: el paso 2 (Detalle) es lo que era Exploración, con números (clave interna 'explora'); el paso 3 es Looker
// 06/10: General › Estructura (Mapa · Activos · Ejes · Audiencias) › Detalle (solo Campañas y Proyección abajo) › Looker (el orden Estructura antes que Detalle es del 06/10, noche)
const PASOS = [['expo', 'General'], ['estructura', 'Estructura'], ['explora', 'Detalle'], ['looker', 'Looker']];
const DET_TABS = [['Campañas al aire', 'campanas'], ['Activos', 'activos'], ['Audiencias', 'audiencias'], ['Ejes', 'ejes'], ['Proyección', 'proyeccion']];
// marcas: [texto, color, fondo]
// colores del diseño v2: marca = punto + fondo; ritmo = tres barritas (Rápido en azul); estados de Proyección = texto + fondo
const MARCA = { B: ['Bueno', '#46C678', '#E5F6EC'], N: ['Regular', '#FCB942', '#FEF3DC'], M: ['Malo', '#F7444C', '#FDE6E7'], S: ['Sin referencia', '#A6AAA9', '#F4F4F4'] };
const RITMO = { R: ['Rápido', '#2F6FD0', '#FFFFFF', 3], N: ['Normal', '#3C3C3C', '#FFFFFF', 2], L: ['Lento', '#3C3C3C', '#FFFFFF', 1], S: ['Sin gasto', '#A6AAA9', '#FFFFFF', 0], X: ['sin dato', '#A6AAA9', '#FFFFFF', 0] };
// el ritmo arranca el día 3 del mes (decisión del 03/10): antes, en todos lados, "desde el 03/MM"
const ANTES_RITMO = () => Number(DATA.datosHasta.slice(8, 10)) < 3;
const RITMO_DESDE = () => `desde el 03/${DATA.mes.slice(5)}`;
const ritmoChip = (k, title) => (ANTES_RITMO() ? chipGris(RITMO_DESDE(), 'El ritmo de gasto se calcula desde el día 3 del mes') : chipDe(RITMO, k, title));
const RITMO_TIP = { R: 'Gasta más que lo habitual', N: 'Gasta parecido a lo habitual', L: 'Gasta menos que lo habitual', S: 'No gastó en los últimos días' };
const CIERRE = { L: ['Llega', '#0EA75D', '#E5F6EC'], P: ['Se pasa', '#E9121C', '#FDE6E7'], NL: ['No llega', '#9A6B00', '#FEF3DC'], S: ['—', '#A6AAA9', 'transparent'] };
// un solo formato para las tres: txt, color (texto o punto), dot, bg, title y, en el ritmo, las tres barritas (b1..b3)
const chipDe = (tabla, k, title, txt) => { const [t, color, bg, n] = tabla[k] || tabla.S; const on = (i) => (n != null && n >= i ? color : '#E4E4E4');
  return { txt: txt || t, color, dot: color, bg, title: title || (tabla === RITMO ? RITMO_TIP[k] || '' : ''), b1: on(1), b2: on(2), b3: on(3) }; };
const chipGris = (txt, title) => ({ txt, color: '#808080', dot: '#A6AAA9', bg: '#F4F4F4', title: title || '', b1: '#E4E4E4', b2: '#E4E4E4', b3: '#E4E4E4' });
// nota de rendimiento de 1 a 5 (15/10): palabra, color del punto y fondo suave (mismo estilo de píldora que la marca)
const NOTA = { 5: ['Muy bueno', '#1F8A4C', '#D6EEDF'], 4: ['Bueno', '#46C678', '#E5F6EC'], 3: ['Regular', '#FCB942', '#FEF3DC'], 2: ['Malo', '#F7444C', '#FDE6E7'], 1: ['Muy malo', '#B3141B', '#F6D3D5'] };
const chipNota = (n, title) => { const x = NOTA[n]; return x ? { txt: `${n} · ${x[0]}`, color: x[1], dot: x[1], bg: x[2], title: title || '', b1: '#E4E4E4', b2: '#E4E4E4', b3: '#E4E4E4' } : chipGris('Sin referencia', title); };
// nota del proyecto: promedio de la nota de sus campañas al aire ponderado por gasto, al entero más cercano; las que no tienen nota no entran
const notaProyecto = (aire) => { let g = 0, s = 0; for (const r of aire) { if (!(r.nt >= 1)) continue; const w = Math.max(r.gastoN || 0, 0) || 0.001; g += w; s += w * r.nt; } return g ? Math.min(5, Math.max(1, Math.round(s / g))) : null; };
const KPI_COSTO = { cr: true, cpm: true, cv: true };
const KPI_NOMBRE = { cr: 'Costo por reacción', cpm: 'CPM', ctr: 'CTR', cv: 'Costo por reproducción', etrV: 'ETR Videos', etrI: 'ETR Imágenes' };
// Marca del KPI del objetivo de una fila de campaña. Si el armado trae r.mk (marcas.js de Referencias: P25/P75 dentro del proyecto por
// objetivo × placement, 2026), manda esa. Mientras tanto (provisorio): contra lo normal del proyecto, ±20 % (el corte de las luces).
// Marca con el KPI elegido en el selector de Métrica (decisión del 05/10): "Según objetivo" = r.mk; otro KPI = su letra en r.mks (marcas.js,
// en el orden de DATA.cuartiles.orden). CPM de Alcance no tiene cuartiles: sin referencia. MARCA_KPI lo fija renderVals con s.kpiSel.
let MARCA_KPI = 'obj';
const marcaKpiLabel = () => (MARCA_KPI === 'obj' ? 'según objetivo' : (KPI_COLS.find((c) => c.k === MARCA_KPI) || {}).label || MARCA_KPI);
// marca siempre con el KPI del objetivo (06/10: la lista de Campañas de Detalle va siempre según objetivo, sin selector)
const marcaObjDe = (r) => { const antes = MARCA_KPI; MARCA_KPI = 'obj'; try { return marcaDe(r); } finally { MARCA_KPI = antes; } };
const marcaKpiDe = (obj) => (MARCA_KPI === 'obj' ? KPI_NOMBRE[KPI_OBJ[obj] || 'cpm'] || '' : marcaKpiLabel());
const marcaDe = (r) => {
  if (!r) return 'S';
  if (MARCA_KPI !== 'obj') { const i = ((DATA.cuartiles || {}).orden || []).indexOf(MARCA_KPI); return i < 0 || !r.mks ? 'S' : r.mks[i] || 'S'; }
  if (r.mk) return r.mk;
  const k = KPI_OBJ[r.obj] || 'cpm', x = r.kc && r.kc[k], v = x && x.v, ref = x && (x.p ? x.p.r : x.pT);
  if (!(v > 0) || !(ref > 0)) return 'S';
  const idx = KPI_COSTO[k] ? ref / v : v / ref;
  return idx >= 1.2 ? 'B' : idx < 1 / 1.2 ? 'M' : 'N';
};
// ritmo de gasto de un activo: a.rt (marcas.js) o, provisorio, "Gasta N % de lo habitual" (últimos 7 días contra su ritmo habitual)
// (03/10) solo el de marcas.js: sin rt, "sin dato"; antes del día 3, nada (lo dice ritmoChip)
const ritmoDe = (a) => (!a || ANTES_RITMO() ? 'X' : a.rt || 'X');
// marca de un conjunto (eje, activo, proyecto; decisión de Juan Pablo del 02/10): la más repetida entre sus campañas, ponderada por gasto
// (como combinar() de marcas.js). En un empate gana Normal. items: [{ m, g }] o letras
const marcaConjunto = (items) => {
  const c = { B: 0, N: 0, M: 0, S: 0 }; let hay = false;
  for (const x of items) { const m = typeof x === 'string' ? x : x.m, g = typeof x === 'string' ? 1 : Math.max(x.g || 0, 0) || 0.001; if (c[m] != null) { c[m] += g; hay = true; } }
  if (!hay) return 'S';
  const max = Math.max(c.B, c.N, c.M, c.S);
  return c.N === max ? 'N' : c.M === max ? 'M' : c.B === max ? 'B' : 'S';
};
const conGasto = (rs) => rs.map((r) => ({ m: marcaDe(r), g: r.gastoN || 0 }));
const ritmoConjunto = (rs) => { const c = { R: 0, N: 0, L: 0 }; for (const r of rs) if (c[r] != null) c[r]++; const n = c.R + c.N + c.L; if (!n) return 'X'; return c.L / n > 0.5 ? 'L' : c.R / n > 0.5 ? 'R' : 'N'; };
// presupuesto del mes de un bloque: PresupuestoMensual de DataJunta o, si no está, los pedidos de la planilla por activo (en millones)
const presuDe = (bb) => {
  const t = bb.tarjeta || {};
  if (t.presu) return { pct: Math.round(t.gastado / t.presu * 100), lleva: t.gastado, de: t.presu };
  const con = (bb.activos || []).filter((a) => a.pedidoCargado !== false && a.pedido != null && a.pedido > 0);
  const ped = con.reduce((x, a) => x + a.pedido, 0), gas = con.reduce((x, a) => x + (a.gastado || 0), 0);
  return ped > 0 ? { pct: Math.round(gas / ped * 100), lleva: gas * 1e6, de: ped * 1e6 } : null;
};
const listaCorta = (xs, n = 3) => (xs.length <= n ? listaYR(xs) : `${xs.slice(0, n).join(', ')} y otras`);
const listaYR = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs.join(''));
// campañas al aire de un bloque: las de la lista de los últimos 30 días que siguen gastando (estado Activa)
// campañas al aire: gastaron en los últimos 2 días y no terminaron según su fecha de fin (03/10: antes entraban las ya terminadas)
const alAireDe = (bb) => ((((bb || {}).periodos || {})['30d'] || {}).campRows || []).filter((r) => r.estado === 'Activa' && !(((bb || {}).campanas || {})[r.id] && bb.campanas[r.id].estado === 'Terminada'));
const canalesDe = (pr) => (pr.id === TODOS ? [...CANALES, 'General'] : [...CANALES.filter((c) => pr.canales[c]), ...(pr.general ? ['General'] : [])]);
const CANAL_TXT = { General: 'Ambas (Oficial e Informativo juntos)' };
// nombre visible del canal: la clave interna 'General' (Oficial + Informativo) se muestra "Ambas" desde el 02/10 (el paso 1 se llama General)
const CANAL_L = (k) => (k === 'General' ? 'Ambas' : k);
// suma de presupuestos (tarjetas de Gasto del mes): plata, ritmo, proyección y las curvas acumuladas día por día
const sumaCurva = (arrs) => { const n = Math.max(0, ...arrs.map((a) => a.length)); return Array.from({ length: n }, (_, i) => arrs.reduce((s, a) => s + (a.length ? a[Math.min(i, a.length - 1)] : 0), 0)); };
function sumarPresu(xs, name) {
  if (!xs.length) return null;
  const imps = xs.map((x) => x.imp).filter(Boolean), sum = (k) => xs.reduce((s, x) => s + (x[k] || 0), 0);
  return { name, presu: sum('presu'), gastado: sum('gastado'), ritmo: sum('ritmo'), proyeccion: sum('proyeccion'), acum: sumaCurva(xs.map((x) => x.acum || [])),
    imp: imps.length ? { actual: sumaCurva(imps.map((i) => i.actual)), previo: sumaCurva(imps.map((i) => i.previo)), mesPrevio: imps[0].mesPrevio } : null };
}
// tarjeta de la portada de una vista que junta: plata y acciones sumadas; campañas activas sin repetir (clave = quién es la misma campaña)
function tarjetaJunta(bs, budgets, clave) {
  const ts = bs.map(([, b]) => b.tarjeta), est = {}, rango = (e) => (e === 'Activa' ? 2 : e === 'Por vencer' ? 1 : 0);
  // la misma campaña en los dos canales: cuenta una vez, "Activa" si sigue en alguno, "Por vencer" si termina esta semana en todos
  for (const [k, b] of bs) for (const c of Object.values(b.campanas)) { const id = clave(k, c.id); if (!(id in est) || rango(c.estado) > rango(est[id])) est[id] = c.estado; }
  const conP = ts.filter((t) => t.presu), pres = budgets.reduce((s, x) => s + x.presu, 0), proy = budgets.reduce((s, x) => s + x.proyeccion, 0);
  return { gastado: ts.reduce((s, t) => s + (t.gastado || 0), 0), presu: conP.length ? conP.reduce((s, t) => s + t.presu, 0) : null, cierre: pres ? Math.round(proy / pres * 100) / 100 : null,
    vivas: Object.values(est).filter((e) => e === 'Activa' || e === 'Por vencer').length, porVencer: Object.values(est).filter((e) => e === 'Por vencer').length,
    pedidoCargado: ts.every((t) => t.pedidoCargado !== false), demas: ts.reduce((s, t) => s + (t.demas || 0), 0), nAcc: ts.reduce((s, t) => s + (t.nAcc || 0), 0) };
}
// la columna de Métrica en el panel: "vs. todos los proyectos" en lugar de "vs. <proyecto>". pT = el valor de lo normal con los siete proyectos
// en ese canal (en General, con los dos canales juntos), lo arma armar.js con el mismo criterio que lo del proyecto; sin pT, sin referencia
// La parte de Google (gg, en CTR) va contra lo normal de esa red en todos los proyectos del canal (rT)
const ggTodos = (gg) => gg.map(({ r, n, rT, ...e }) => (rT != null ? { ...e, r: rT, n: 't' } : e));
const kcTodos = (kc) => Object.fromEntries(Object.entries(kc || {}).map(([k, x]) => [k, !x || k === 'ca' ? x : { ...x, p: x.pT != null && x.v != null ? { v: x.v, r: x.pT } : null, ...(x.gg ? { gg: ggTodos(x.gg) } : {}) }]));
const COMPUESTOS = {};
function bloqueGeneral(p) {
  const key = 'G|' + p.id; if (COMPUESTOS[key]) return COMPUESTOS[key];
  const cans = CANALES.filter((c) => p.canales[c]), bs = cans.map((c) => [c, p.canales[c]]), G = p.general || { periodos: {}, cdet: {}, ef: [] };
  const periodos = {};
  for (const id of DATA.periodos.map((x) => x.id)) {
    const xs = bs.map(([, b]) => b.periodos[id]).filter(Boolean), g = G.periodos[id];
    if (!xs.length || !g) continue;
    periodos[id] = { campRows: g.campRows.map((r) => ({ ...r, etq: r.cn.join(' + '), tkey: `${p.id}|${r.cd}|${r.id}` })),
      pubs: xs.flatMap((x) => x.pubs), audCods: xs.flatMap((x) => x.audCods || []), actCods: xs.flatMap((x) => x.actCods || []), actN: g.actN || {}, actTot: g.actTot || null };
  }
  // el detalle de cada campaña: el de su canal (el que más gastó si está en los dos)
  const campanas = {};
  for (const [c, b] of bs) for (const [id, x] of Object.entries(b.campanas)) if (!campanas[id] || G.cdet[id] === c) campanas[id] = x;
  // activos: un activo con el mismo nombre en los dos canales va una vez, con el pedido y lo gastado sumados
  const act = {};
  for (const [c, b] of bs) for (const a of b.activos) {
    const x = act[a.name];
    if (!x) { act[a.name] = { ...a, etq: c }; continue; }
    const hayP = (y) => y.pedidoCargado !== false && y.pedido != null;
    act[a.name] = { ...x, etq: x.etq + ' + ' + c, plats: [...x.plats, ...a.plats.filter((pl) => !x.plats.some((q) => q.code === pl.code))], gastado: x.gastado + a.gastado,
      pedido: hayP(x) || hayP(a) ? (hayP(x) ? x.pedido : 0) + (hayP(a) ? a.pedido : 0) : null, pedidoCargado: x.pedidoCargado !== false || a.pedidoCargado !== false,
      ritmo: a.gastado > x.gastado ? a.ritmo : x.ritmo, g7: a.gastado > x.gastado ? a.g7 : x.g7, campIds: [...new Set([...x.campIds, ...a.campIds])], auto: x.auto || a.auto };
  }
  // presupuestos: los que tienen el mismo nombre en los dos canales se suman
  const porNombre = {}, enCanal = {};
  for (const [c, b] of bs) for (const x of b.budgets) { (porNombre[x.name] = porNombre[x.name] || []).push(x); (enCanal[x.name] = enCanal[x.name] || []).push(c); }
  const budgets = Object.entries(porNombre).map(([n, xs]) => sumarPresu(xs, `${n} · ${enCanal[n].join(' + ')}`));
  // Revisar: las candidatas de los dos canales (una vez por campaña); la lógica las juzga con la fila sumada
  const cand = {};
  for (const [, b] of bs) for (const x of b.bad) { const y = cand[x.id]; cand[x.id] = y ? { ...y, g7: y.g7 + x.g7, deMasN: y.deMasN + x.deMasN, accion: y.accion === 'Sin acción sugerida' ? x.accion : y.accion } : { ...x }; }
  const bad = Object.values(cand).map((x) => ({ ...x, meta: `${x.obj} · Eje ${x.eje} · ${fMs(x.g7)} en 7 días`, demas: x.deMasN > 0 ? fMs(x.deMasN) : '', tkey: `${p.id}|${G.cdet[x.id] || cans[0]}|${x.id}` }));
  const b0 = bs[0][1];
  return (COMPUESTOS[key] = { canal: 'General', compuesta: 'general', periodos, campanas, budgets, bad, activos: Object.values(act),
    anuncios: bs.flatMap(([, b]) => b.anuncios), diaAct: b0.diaAct, diasMes: b0.diasMes, mesAnt: b0.mesAnt,
    acciones: bs.flatMap(([c, b]) => b.acciones.map((a) => ({ ...a, etq: c, _pid: p.id, _canal: c }))),
    insights: { vs: bs.flatMap(([c, b]) => b.insights.vs.map((r) => ({ ...r, b: `${c}: ${r.b}` }))), ef: G.ef,
      season: bs.flatMap(([c, b]) => b.insights.season.map((r) => ({ ...r, etq: c, tkey: `${p.id}|${c}|${r.id}` }))),
      propios: bs.flatMap(([c, b]) => b.insights.propios.map(([t, src]) => [t, `${src} · ${c}`])) },
    tarjeta: tarjetaJunta(bs, budgets, (_k, id) => id) });
}
// panel "Todos los proyectos" del canal elegido (01/10): en Oficial e Informativo, el bloque de cada proyecto en ese canal; en General, el
// bloque General de cada proyecto (los dos canales juntos). Cada fila lleva su proyecto (pn) y la etiqueta: el proyecto o, en General,
// el proyecto y los canales donde corrió ("Santa Fe · Oficial + Informativo").
const TXT_TODOS = { Oficial: 'Oficial', Informativo: 'Informativo', General: 'Oficial e Informativo' };
function bloqueTodos(canal) {
  const key = 'T|' + canal; if (COMPUESTOS[key]) return COMPUESTOS[key];
  const gen = canal === 'General';
  const bs = DATA.proyectos.map((p) => [p, gen ? (p.general ? bloqueGeneral(p) : null) : p.canales[canal]]).filter(([, b]) => b);
  if (!bs.length) return null;
  // etiqueta de cada fila: el proyecto y, en General, los canales (lo que ya dice la fila del bloque General)
  const etqDe = (p, e) => (gen && e ? `${p.nombre} · ${e}` : p.nombre);
  const tkeyDe = (p, r) => r.tkey || `${p.id}|${canal}|${r.id}`;
  const periodos = {};
  for (const id of DATA.periodos.map((x) => x.id)) {
    const xs = bs.map(([p, b]) => [p, b.periodos[id]]).filter(([, x]) => x);
    if (!xs.length) continue;
    const actN = {}, tot = { p: { g: 0, i: 0, r: 0, vw: 0, k: 0 }, c: {} };
    for (const [p, x] of xs) {
      for (const [k, v] of Object.entries(x.actN || {})) { const i = k.indexOf('|'); actN[i < 0 ? conPid(p.id, k) : `${conPid(p.id, k.slice(0, i))}|${conPid(p.id, k.slice(i + 1))}`] = v; }
      if (x.actTot) { for (const k of ['g', 'i', 'r', 'vw', 'k']) tot.p[k] += x.actTot.p[k] || 0; for (const [com, v] of Object.entries(x.actTot.c)) tot.c[conPid(p.id, com)] = v; }
    }
    periodos[id] = { campRows: xs.flatMap(([p, x]) => x.campRows.map((r) => ({ ...r, id: conPid(p.id, r.id), pn: p.nombre, etq: etqDe(p, r.etq), tkey: tkeyDe(p, r), kc: kcTodos(r.kc) }))).sort((a, c) => c.gastoN - a.gastoN),
      pubs: xs.flatMap(([p, x]) => x.pubs.map((r) => ({ ...r, camp: conPid(p.id, r.camp) }))),
      audCods: xs.flatMap(([p, x]) => (x.audCods || []).map((r) => ({ ...r, aud: conPid(p.id, r.aud), com: conPid(p.id, r.com) }))),
      actCods: xs.flatMap(([p, x]) => (x.actCods || []).map((r) => ({ ...r, voz: conPid(p.id, r.voz), com: conPid(p.id, r.com) }))), actN, actTot: tot };
  }
  const todos = sumarPresu(bs.flatMap(([, b]) => b.budgets), `Total de ${TXT_TODOS[canal]} (todos los proyectos)`);
  const budgets = [todos, ...bs.map(([p, b]) => sumarPresu(b.budgets, p.nombre))].filter(Boolean);
  return (COMPUESTOS[key] = { canal, compuesta: 'todos', periodos, budgets,
    campanas: Object.fromEntries(bs.flatMap(([p, b]) => Object.entries(b.campanas).map(([id, c]) => [conPid(p.id, id), c]))),
    bad: bs.flatMap(([p, b]) => b.bad.map((x) => ({ ...x, id: conPid(p.id, x.id), pn: p.nombre, etq: p.nombre, tkey: tkeyDe(p, x) }))),
    activos: bs.flatMap(([p, b]) => b.activos.map((a) => ({ ...a, name: conPid(p.id, a.name), etq: etqDe(p, a.etq) }))),
    anuncios: bs.flatMap(([p, b]) => b.anuncios.map((a) => ({ ...a, com: conPid(p.id, a.com) }))), diaAct: bs[0][1].diaAct, diasMes: bs[0][1].diasMes, mesAnt: bs[0][1].mesAnt,
    acciones: bs.flatMap(([p, b]) => b.acciones.map((a) => ({ ...a, etq: etqDe(p, a.etq), _pid: p.id, _canal: a._canal || canal, campId: a.campId ? conPid(p.id, a.campId) : a.campId, campanas: (a.campanas || []).map((x) => conPid(p.id, x)) }))),
    insights: { vs: bs.flatMap(([p, b]) => b.insights.vs.map((r) => ({ ...r, b: `${p.nombre}: ${r.b}` }))), ef: ((DATA.todos && DATA.todos.ef) || {})[canal] || [],
      season: bs.flatMap(([p, b]) => b.insights.season.map((r) => ({ ...r, etq: etqDe(p, r.etq), tkey: tkeyDe(p, r) }))),
      propios: bs.flatMap(([p, b]) => b.insights.propios.map(([t, src]) => [t, `${src} · ${p.nombre}`])) },
    tarjeta: tarjetaJunta(bs.map(([p, b]) => [p.id, b]), budgets.slice(0, 1), (pid, id) => conPid(pid, id)) });
}

class Component extends DCLogic {
  state = {
    screen: 'portada', tab: 'resumen', canal: store('syo.canal', 'Oficial'), pid: null, campId: null, campPid: null, campCanal: null,
    panel: false, panelCamp: null, tipos: tiposGuardados(), campFilter: 'Todas', kpiSel: kpiSelGuardado(), sel: null, st: store('syo.st', {}), discardFor: null, otraFor: null, otraTxt: '', regla: {}, help: {},
    manualFor: null, manualMot: null, manualTxt: '', reglaDraft: {}, respReglas: [], autorV: 0,
    period: DATA.mes, abierto: {}, busca: '',
    campTab: 'Contenidos', rendPer: 'mes', paso: 'expo', detTab: 'campanas', modal: null, pieza: null, comments: store('syo.comments', {}), draft: '', toast: null, bMetric: 'Gasto', looker: store('syo.looker', {}),
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
    const slot = s.screen === 'proyecto' && s.paso === 'looker' && s.pid !== TODOS && s.canal !== 'General' && !s.modal && !s.panel && src ? document.getElementById('looker-slot') : null;
    let caja = this.lookerCaja, f = this.lookerFrame;
    if (!slot) {
      if (caja) caja.style.display = 'none';
      // si la pestaña Looker está abierta pero su hueco todavía no está en el DOM (el render llega después), se reintenta;
      // sin esto el tablero quedaba con el alto provisorio y sin ubicar hasta que el usuario scrolleaba
      const esperando = s.screen === 'proyecto' && s.paso === 'looker' && s.pid !== TODOS && s.canal !== 'General' && !s.modal && !s.panel && !!src;
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
  proj() { return this.state.pid === TODOS ? PROY_TODOS : DATA.proyectos.find((p) => p.id === this.state.pid) || null; }
  // el bloque de la vista: el de un canal, el General del proyecto (los dos canales juntos) o el de todos los proyectos del canal
  blk() {
    const s = this.state, p = this.proj(); if (!p) return null;
    if (p.id === TODOS) return bloqueTodos(s.canal);
    if (s.canal === 'General') return p.general ? bloqueGeneral(p) : null;
    return p.canales[s.canal] || null;
  }
  compuesta() { const s = this.state; return s.pid === TODOS ? 'todos' : s.canal === 'General' ? 'general' : ''; }
  // pantalla de campaña desde una vista que junta: el detalle es el de la campaña en su canal y su proyecto
  // cambiar de proyecto desde la ruta de arriba (06/10): se mantienen el paso, la pestaña y el período donde se está parado; el canal también, y si
  // el proyecto nuevo no lo tiene, va al primero que tenga; lo que era del proyecto anterior (filtros, campaña abierta, Mapa) se limpia
  cambiarProyecto(pid) {
    const s = this.state, pr = pid === TODOS ? PROY_TODOS : DATA.proyectos.find((p) => p.id === pid); if (!pr || pid === s.pid) return;
    const cs = canalesDe(pr), canal = cs.includes(s.canal) ? s.canal : cs[0];
    const b = pid === TODOS ? bloqueTodos(canal) : canal === 'General' ? bloqueGeneral(pr) : pr.canales[canal], period = b && b.periodos && b.periodos[s.period] ? s.period : DATA.mes;
    if (canal !== s.canal) keep('syo.canal', canal);
    this.setState({ pid, canal, period, screen: 'proyecto', campId: null, campPid: null, campCanal: null, panel: false, modal: null, busca: '', abierto: {}, sel: null, discardFor: null, otraFor: null, manualFor: null,
      mpSel: null, mpEjeF: '', mpActF: '', mpAbre: {}, mpCols: [], mpMenuCol: null, mpFichas: {}, mpExpZ: {}, mpQ: '', mpQOpen: false, mpNotice: '', mpFlash: null, mpView: null });
  }
  vistaCamp() {
    const s = this.state; if (s.screen !== 'campana' || !this.compuesta()) return null;
    const p = DATA.proyectos.find((x) => x.id === (s.campPid || s.pid)), b = p && s.campCanal ? p.canales[s.campCanal] : null;
    return p && b ? { p, b, canal: s.campCanal } : null;
  }
  setAct(id, patch) { this.setState((s) => { const st = { ...s.st, [id]: { ...(s.st[id] || {}), ...patch } }; keep('syo.st', st); return { st }; }); this.registrar(id); }
  // Repositorio de respuestas (para que el agente aprenda qué recomendaciones sirven): cada cambio sobre una recomendación se manda
  // al servidor local, que lo agrega a repositorio/respuestas.jsonl. Espera 1,5 s para no mandar una línea por cada tecla del comentario.
  // Abierta con doble clic (file://) no hay servidor: queda solo en el navegador y en "Exportar comentarios".
  // donde = { proyecto, canal } de lo que se responde (en General y en Todos los proyectos, el canal y el proyecto reales de la recomendación)
  enviar(reg, donde) {
    if (!enLinea()) return;
    const s = this.state, p = this.proj(), autor = autorActual(true);
    fetch('/api/respuesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...reg, autor, proyecto: donde ? donde.proyecto : p ? p.nombre : null, canal: donde ? donde.canal : s.canal, datos_al: DATA.datosHasta }) }).catch(() => {});
  }
  registrar(id) {
    this.regT = this.regT || {}; clearTimeout(this.regT[id]);
    const b = this.blk(); const a = b ? b.acciones.find((x) => x.id === id) : null; if (!a) return;
    const donde = a._pid ? { proyecto: (DATA.proyectos.find((x) => x.id === a._pid) || {}).nombre || null, canal: a._canal } : null;
    this.regT[id] = setTimeout(() => { const x = this.state.st[id] || {};
      this.enviar({ clase: 'recomendacion', id, tipo: a.tipo, titulo: a.title, campana: a.afectado.campana || a.camp || null, solucion: a.solucion,
        decision: x.status === 'sent' ? 'enviada a PAUTADOR' : x.status === 'manual' ? 'hecha a mano' : x.status === 'discarded' ? 'descartada' : 'pendiente', motivo: x.status === 'discarded' || x.status === 'manual' ? x.reason || null : null, sirve: x.op || null, comentario: x.comment || null }, donde); }, 1500);
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
  screenKey() { const s = this.state, p = this.proj(), vc = this.vistaCamp(); return s.screen === 'guia' ? 'Cómo leer' : s.screen === 'portada' ? 'Mis proyectos' : s.screen === 'campana' ? `${p.nombre} · ${s.canal} · Campaña · ${s.campId}${vc ? ` (${vc.p.nombre} · ${vc.canal})` : ''}` : `${p.nombre} · ${s.canal} · ${this.tabComentario()}`; }
  // pestaña que nombra el comentario (13/10): General = 'general'; Estructura, la suya (mapa, activos, ejes, audiencias); Detalle = 'campañas' o 'insights'; Looker = 'looker'
  tabComentario() { const s = this.state; return s.paso === 'estructura' ? tabEstDe(s.tab) : s.paso === 'looker' ? 'looker' : s.paso === 'explora' ? (s.tab === 'insights' ? 'insights' : 'campañas') : 'general'; }
  irCampana(id, canal) {
    const s = this.state, abrir = { screen: 'campana', panel: false, panelCamp: null, campTab: 'Contenidos', paso: 'explora' }, sinDetalle = () => this.say('Esta campaña no tiene detalle: terminó hace más de 60 días');
    // Todos los proyectos: el id lleva el proyecto adelante; se abre el detalle de la campaña en su proyecto y canal (en General, el del
    // canal que más gastó, o el que se pidió desde la miga)
    if (s.pid === TODOS) { const pid = pidDe(id) || s.campPid, nombre = sinPid(id), pr = DATA.proyectos.find((x) => x.id === pid); if (!pr) return sinDetalle();
      const cd = s.canal === 'General' ? canal || (pr.general && pr.general.cdet[nombre]) : s.canal;
      const c = (s.canal === 'General' ? [cd, ...CANALES] : [cd]).find((k) => k && pr.canales[k] && pr.canales[k].campanas[nombre]);
      return c ? this.setState({ ...abrir, campId: nombre, campPid: pid, campCanal: c }) : sinDetalle(); }
    // General: el detalle es el de un canal (el que más gastó si está en los dos; desde ahí se puede pasar al otro)
    if (s.canal === 'General') { const pr = this.proj(), cd = canal || (pr.general && pr.general.cdet[id]);
      const c = [cd, ...CANALES].find((k) => k && pr.canales[k] && pr.canales[k].campanas[id]);
      return c ? this.setState({ ...abrir, campId: id, campPid: pr.id, campCanal: c }) : sinDetalle(); }
    const b = this.blk();
    if (b && b.campanas[id]) this.setState({ ...abrir, campId: id });
    else sinDetalle();
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
        imp: fN(o.i), vw: o.vw ? fN(o.vw) : '—', rea: o.r ? fN(o.r) : '—', gasto: fMs(o.g), ef: efic(extra.ef || null), salud: extra.salud || SIN_SALUD, nCamp: extra.nCamp ?? '', nCont: extra.nCont ?? '', pc: extra.pc || SIN_PC, hasPieza: !!extra.pieza, onPieza: extra.pieza ? () => this.setState({ modal: 'pieza', pieza: extra.pieza }) : null, o, efRaw: extra.ef || null, hasMarca: !!extra.marca, marca: extra.marca || chipGris('') };
    };
    const anunciosDe = (com, cod, pre, voz) => anuncios.filter((a) => a.com === com && a.cod === cod && (!voz || a.voz === voz)).map((a) => nodo(`${pre}|${a.nombre}`, a.corto, chipsDe([a.code]), sumO([a]), [], { sub: a.obj, ef: null }));
    const hojasDe = (com, filas, pre, voz) => Object.values(filas.reduce((m, r) => { const k = r.cod; (m[k] = m[k] || { cod: k, name: r.name, codes: new Set(), rows: [], pieza: r.pieza, ef: [] }); m[k].rows.push(r); (r.codes || [r.code]).forEach((c) => c && m[k].codes.add(c)); if (r.ef) m[k].ef.push(r.ef); return m; }, {}))
      .sort((a, c) => sumO(c.rows).i - sumO(a.rows).i).slice(0, 30)
      .map((p) => nodo(`${pre}|${p.cod}`, p.name, chipsDe([...p.codes]), sumO(p.rows), opts.conAnuncios ? anunciosDe(com, p.cod, `${pre}|${p.cod}`, voz) : [], { sub: opts.sinSub ? '' : p.cod, ef: eficSuma(p.ef), pieza: p.pieza || null }));
    const campNodo = (id, filas, pre, n1) => {
      const c = campById[id]; if (!c) return null;
      const kids = opts.sinHojas ? [] : hojasDe(id, filas, `${pre}|${id}`, n1.voz);
      // Activos: qué parte de toda la campaña (todos sus activos) se hizo en este activo
      const o = sumO(filas), T = opts.pct && opts.pct.c[id], nC = n1.contDe ? n1.contDe(id) : 0;
      const pc = T ? { camp: '', cont: pctDe(nC, T.k, 'de la campaña'), imp: pctDe(o.i, T.i, 'de la campaña'), vw: pctDe(o.vw, T.vw, 'de la campaña'), rea: pctDe(o.r, T.r, 'de la campaña'), gasto: pctDe(o.g, T.g, 'de la campaña') } : null;
      // en General y en Todos los proyectos, al lado del objetivo: los canales donde corrió o el proyecto
      return nodo(`${pre}|${id}`, c.name, conLogo(c.plats), o, kids, { marca: chipDe(MARCA, marcaDe(c), `Cómo rinde (${marcaKpiDe(c.obj)}): del período contra lo de siempre`), sub: c.etq ? `${c.obj} · ${c.etq}` : c.obj, ef: c.ef, onLink: c.detalle ? () => this.irCampana(id) : null, nCont: n1.contDe ? fN(nC) : '', pc });
    };
    const nivel = (n) => {
      const kids = Object.entries(n.porCamp).map(([id, filas]) => campNodo(id, filas, n.key, n)).filter(Boolean).sort((a, c) => c.o.i - a.o.i);
      // Activos: qué parte del total del proyecto (canal y período elegidos; en Todos los proyectos, del total) hizo este activo. La columna
      // Campañas no lleva % (decisión de Juan Pablo del 01/10): una campaña corre en varios activos y los % podían sumar más de 100
      const o = sumO(kids.map((k) => k.o)), T = opts.pct && opts.pct.p, de = opts.pctDe || 'del proyecto';
      const pc = T ? { camp: '', cont: pctDe(n.nCont, T.k, de), imp: pctDe(o.i, T.i, de), vw: pctDe(o.vw, T.vw, de), rea: pctDe(o.r, T.r, de), gasto: pctDe(o.g, T.g, de) } : null;
      return { ...nodo(n.key, n.name, n.plats, o, kids, { ef: eficSuma(kids.map((k) => k.efRaw)), salud: n.salud, sub: n.sub, nCamp: n.nCont !== undefined ? String(kids.length) : '', nCont: n.nCont !== undefined ? fN(n.nCont) : '', pc }), keep: !!n.keep, ...(opts.sinHojas ? { hasN: false } : {}) };
    };
    return nivel1.map(nivel).filter((n) => n.visible && (n.o.i > 0 || n.keep)).sort((a, c) => c.o.i - a.o.i);
  }

  renderVals() {
    MARCA_KPI = this.state.kpiSel || 'obj';
    // pV = el proyecto de la vista (un proyecto o "Todos los proyectos"); comp = '' (un canal), 'general' o 'todos'. En la pantalla de
    // campaña de una vista que junta, p, b y canalR son los de la campaña: su proyecto y su canal (el detalle es el de cada canal)
    const s = this.state, pV = this.proj(), vc = this.vistaCamp(), comp = this.compuesta();
    const p = vc ? vc.p : pV, b = vc ? vc.b : this.blk(), canalR = vc ? vc.canal : s.canal;
    const narrow = s.w < 1100;
    const helpKeys = ['pubs', 'ejes', 'aud', 'portada', 'gasto', 'camp', 'imp', 'rend', 'crend', 'hist', 'camps', 'activos', 'ins', 'lleg', 'cmp'];
    const h = {}; helpKeys.forEach((k) => { h[k] = { open: !!s.help[k], toggle: () => this.setState((st) => ({ help: { ...st.help, [k]: !st.help[k] } })) }; });
    // Resumen variante B (tablero): los bloques plegables arrancan abiertos
    const o = {}; ['mas', 'video', 'piezas', 'picos', 'costo'].forEach((k) => { const open = s.open?.[k] ?? true; o[k] = { open, label: open ? 'Ocultar' : 'Mostrar', toggle: () => this.setState((st) => ({ open: { ...(st.open || {}), [k]: !(st.open?.[k] ?? true) } })) }; });
    const full = '1 / -1';
    // Resumen variante B · tablero: el diseño curado tiene dos bloques (Gasto del mes y Revisar campañas) → van lado a lado en tarjetas.
    // Con un solo presupuesto el gasto ocupa un tercio; con dos o más, la mitad (para que entren sus tarjetas una al lado de la otra).
    const nPresu = b ? b.budgets.length : 1, presuAncho = nPresu > 2;
    const L = { max: '1440px', cols: narrow ? 'minmax(0,1fr)' : 'repeat(12,minmax(0,1fr))', gap: '16px', card: '1px solid #E4E4E4', pad: '20px', pad2: '20px', fold: '1px solid #E4E4E4', rowPad: '11px 0',
      tileMin: '128px', tilePad: '12px 14px', val: '20px', big: '24px', innerBd: 'none', innerBg: '#F7F7F7', badgeBg: '#FFFFFF',
      o: { gasto: 1, camp: 2, imp: 3, rend: 4, piezas: 5, picos: 6, costo: 7 },
      s: { gasto: narrow || presuAncho ? full : nPresu >= 2 ? 'span 6' : 'span 4', camp: narrow || presuAncho ? full : nPresu >= 2 ? 'span 6' : 'span 8', imp: full, rend: full, piezas: full, picos: full, costo: full } };
    const P = { w: narrow ? '100%' : '1120px', isB: true, pad: '28px 36px 40px', cardBd: 'none', cardPad: '0', titleFs: '22px', showResolvedBelow: false };
    const datosAl = dm(DATA.datosHasta);
    const mesTxt = DATA.mesTxt[0].toUpperCase() + DATA.mesTxt.slice(1);

    // ---- acciones ----
    const acciones = b ? b.acciones : [];
    const statusOf = (a) => s.st[a.id]?.status || 'pending';
    // tipo efectivo de una campaña: lo que eligió el usuario en Insights o, si no eligió, lo sugerido por los datos
    // tkey = proyecto|canal|campaña de la decisión (en las vistas que juntan, el proyecto y el canal reales de la campaña)
    const claveTipo = (id, tkey) => tkey || `${p ? p.id : s.pid}|${canalR}|${id}`;
    const tipoDe = (id, sug, larga, tkey) => { const d = tipoGuardado(s.tipos, claveTipo(id, tkey)); const t = d || sug || ''; return t === 'constante' || t === 'estacional' ? t : larga ? 'larga' : 'puntual'; };
    const tipoCamp = (id, tkey) => { const c = b && b.campanas[id]; return c ? tipoDe(id, c.hist ? c.hist.sug : '', !!c.hist && c.hist.span >= 30, tkey) : ''; };
    // botones Constante · Estacional · Ninguna de una campaña (en Insights y en el encabezado de la campaña); gris = sugerido, negro = confirmado
    const tipoOps = (id, sug, larga, tkey) => { const key = claveTipo(id, tkey), d = tipoGuardado(s.tipos, key), actual = d || sug || 'ninguna', [kp, kc] = key.split('|');
      const donde = tkey ? { proyecto: (DATA.proyectos.find((x) => x.id === kp) || {}).nombre || null, canal: kc } : null;
      const set = (v) => { this.setState((st) => { const tipos = { ...st.tipos, [key]: v }; keep('syo.tipos', tipos); return { tipos }; }); this.enviar({ clase: 'tipo_campana', campana: sinPid(id), tipo: v === 'ninguna' ? (larga ? 'larga' : 'puntual') : v, sugerido: sug || null }, donde); };
      return { confirmado: !!d, ops: [['constante', 'Constante'], ['estacional', 'Estacional'], ['ninguna', larga ? 'Larga' : 'Puntual']].map(([k, label]) => { const on = actual === k; return { label, bg: on ? (d ? '#3C3C3C' : '#FFFFFF') : 'transparent', color: on && d ? '#FFFFFF' : '#3C3C3C', shadow: on && !d ? 'var(--shadow-sm)' : 'none', onClick: () => set(k) }; }) }; };
    // contra quién se compara "lo normal": el proyecto (también en la General, con los dos canales juntos) o todos los proyectos (panel)
    const proyN = comp === 'todos' && !vc ? 'todos los proyectos' : (p && p.nombre) || 'el proyecto';
    const refVista = vc || !comp || !p ? null : comp === 'general'
      ? { de: `${p.nombre} con los dos canales juntos` }
      : { de: `todos los proyectos de ${TXT_TODOS[s.canal]}${s.canal === 'General' ? ' juntos' : ''}` };
    const tipoAcc = (a) => (a._pid ? tipoCamp(a.campId, `${a._pid}|${a._canal}|${sinPid(a.campId)}`) : tipoCamp(a.campId));
    const pending = acciones.filter((a) => statusOf(a) === 'pending' && !(a.tipo === 'Peor que la temporada anterior' && tipoAcc(a) !== 'estacional'));
    const resolvedActs = acciones.filter((a) => statusOf(a) !== 'pending');
    const openPanelAt = (id, camp) => this.setState({ panel: true, sel: id || s.sel, panelCamp: camp || null, discardFor: null });
    const panelList = s.panelCamp ? pending.filter((a) => a.campId === s.panelCamp) : pending;
    const verPieza = (pz) => this.setState({ modal: 'pieza', pieza: pz });
    const cardView = (a) => {
      const x = s.st[a.id] || {};
      // vía: solo "por PAUTADOR" o "a mano" (redaccion.js ya no manda "parte a mano")
      return {
        // en General y en Todos los proyectos cada recomendación dice de qué canal o de qué proyecto es
        ...a, via: (a.etq ? a.etq + ' · ' : '') + (a.via === 'manual' ? 'Se hace a mano' : 'Se puede hacer desde PAUTADOR'),
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
            manualPideTxt: !!mot, manualTxt: abierto ? s.manualTxt : '', onManualTxt: (e) => this.setState({ manualTxt: e.target.value }),
            manualPh: mot && mot.texto ? (mot.label === 'Otra' ? 'Escribí el motivo…' : mot.label === 'Hice solo una parte' ? 'Contá qué parte hiciste…' : 'Contá qué hiciste…') : 'Agregá un comentario (opcional)…',
            manualCursor: listo ? 'pointer' : 'not-allowed', manualOpacity: listo ? 1 : 0.4,
            onManualOk: () => { const r = motivoManualDe(this.state.manualMot, this.state.manualTxt); if (r) this.resolve(a.id, 'manual', r); } }; })(),
        onDiscard: () => this.setState((st) => ({ discardFor: st.discardFor === a.id ? null : a.id, otraFor: null, otraTxt: '', manualFor: null, manualMot: null, manualTxt: '' })), discardOpen: s.discardFor === a.id,
        reasons: REASONS.map((r) => { const on = r === 'Otra' && s.otraFor === a.id; return { label: r, bg: on ? '#3C3C3C' : '#FFFFFF', color: on ? '#FFFFFF' : '#3C3C3C', bd: on ? '#3C3C3C' : '#D5D5D5',
          onClick: () => (r === 'Otra' ? this.setState({ otraFor: on ? null : a.id, otraTxt: '' }) : this.resolve(a.id, 'discarded', r)) }; }),
        otraOpen: s.otraFor === a.id, otraTxt: s.otraFor === a.id ? s.otraTxt : '', onOtraTxt: (e) => this.setState({ otraTxt: e.target.value }),
        otraCursor: s.otraTxt.trim() ? 'pointer' : 'not-allowed', otraOpacity: s.otraTxt.trim() ? 1 : 0.4,
        onOtraOk: () => { const t = s.otraTxt.trim(); if (t) this.resolve(a.id, 'discarded', 'Otra: ' + t); },
        reglaOpen: !!s.regla[a.id], reglaLabel: (s.regla[a.id] ? '▾' : '▸') + ' Cómo lo detectamos', toggleRegla: () => this.setState((st) => ({ regla: { ...st.regla, [a.id]: !st.regla[a.id] } })),
        onCamp: (e) => { e && e.preventDefault(); if (a.campId) this.irCampana(a.campId); else this.setState({ screen: 'proyecto', paso: 'estructura', tab: 'activos', panel: false }); },
        ops: ['Sí', 'No', 'Falta un dato'].map((lab) => { const on = x.op === lab; return { label: lab, bg: on ? '#3C3C3C' : '#FFFFFF', color: on ? '#FFFFFF' : '#3C3C3C', bd: on ? '#3C3C3C' : '#D5D5D5', onClick: () => this.setAct(a.id, { op: on ? null : lab }) }; }),
        comment: x.comment || '', onComment: (e) => this.setAct(a.id, { comment: e.target.value }),
      };
    };
    const selAct = panelList.find((a) => a.id === s.sel) || panelList[0];
    const cards = selAct ? [cardView(selAct)] : [];

    // ---- portada ----
    // una tarjeta por proyecto en el canal elegido (en General, los dos canales juntos) y, primero, "Todos los proyectos · <canal>" (el
    // panel de los siete proyectos en el mismo canal que el resto de la portada)
    const tarjetaProy = (name, bb, onClick) => {
      const t = bb.tarjeta, nPend = bb.acciones.filter((a) => (s.st[a.id]?.status || 'pending') === 'pending').length;
      return { name, gasto: t.presu ? `${fMs(t.gastado)} de ${fMs(t.presu)}` : `${fMs(t.gastado)} · sin PresupuestoMensual cargado`, bar: (t.presu ? Math.min(100, Math.round(t.gastado / t.presu * 100)) : 0) + '%',
        vivas: `${t.vivas} · ${t.porVencer ? t.porVencer + (t.porVencer === 1 ? ' termina' : ' terminan') + ' esta semana' : 'ninguna termina esta semana'}`, acc: nPend === 0 ? 'No hay acciones pendientes' : nPend,
        hasProy: t.cierre != null, proy: t.cierre != null ? Math.round(t.cierre * 100) : null, proyColor: t.cierre > 1.02 ? COL.r : t.cierre < 0.85 ? COL.y : COL.g,
        demas: t.demas ? fMs(t.demas) + ' de más' : 'Sin gasto de más', demasColor: t.demas ? '#E9121C' : '#A6AAA9',
        lights: [],
        onClick };
    };
    const projects = [
      ...(bloqueTodos(s.canal) ? [tarjetaProy(`Todos los proyectos · ${CANAL_L(s.canal)}`, bloqueTodos(s.canal), () => this.setState({ screen: 'proyecto', tab: 'resumen', pid: TODOS, panel: false, period: DATA.mes, busca: '', abierto: {} }))] : []),
      ...DATA.proyectos.filter((pr) => canalesDe(pr).includes(s.canal)).map((pr) => tarjetaProy(pr.nombre, s.canal === 'General' ? bloqueGeneral(pr) : pr.canales[s.canal],
        () => this.setState({ screen: 'proyecto', tab: 'resumen', pid: pr.id, panel: false, period: DATA.mes, busca: '', abierto: {} }))),
    ];

    const crumbs0 = s.screen === 'guia' ? [{ label: 'Mis proyectos', color: '#808080', cursor: 'pointer', onClick: () => this.setState({ screen: 'portada' }) }, { label: 'Cómo leer', color: '#3C3C3C', cursor: 'default' }]
      : s.screen === 'portada' || !pV ? [{ label: 'Mis proyectos', color: '#3C3C3C', cursor: 'default' }]
        : [{ label: 'Mis proyectos', color: '#808080', cursor: 'pointer', onClick: () => this.setState({ screen: 'portada', panel: false }) },
          // 06/10: el proyecto es un desplegable (texto con flechita): se cambia de proyecto sin volver a la portada y se mantiene dónde se está parado
          { label: pV.nombre, color: s.screen === 'proyecto' ? '#3C3C3C' : '#808080', cursor: 'pointer', esSel: true, noSel: false, selVal: pV.id, ops: [...DATA.proyectos.map((x) => ({ id: x.id, label: x.nombre })), { id: TODOS, label: 'Todos los proyectos' }], onSel: (e) => this.cambiarProyecto(e && e.target ? e.target.value : e), onClick: () => {} },
          // campaña abierta desde General o desde Todos los proyectos: se dice de qué canal o proyecto es el detalle; en General, si la
          // campaña también está en el otro canal, se puede pasar a ese detalle
          ...(s.screen === 'campana' ? (() => { if (!vc) return [{ label: s.campId, color: '#3C3C3C', cursor: 'default' }];
            const otro = s.canal === 'General' ? CANALES.find((k) => k !== vc.canal && vc.p.canales[k] && vc.p.canales[k].campanas[s.campId]) : null;
            return [{ label: `${s.campId} · ${comp === 'todos' ? vc.p.nombre + (s.canal === 'General' ? ' · detalle de ' + vc.canal : '') : 'detalle de ' + vc.canal}`, color: '#3C3C3C', cursor: 'default' },
              ...(otro ? [{ label: `ver el detalle de ${otro}`, color: '#808080', cursor: 'pointer', onClick: () => this.irCampana(s.campId, otro) }] : [])]; })() : [])];

    const crumbs = crumbs0.map((x) => ({ esSel: false, noSel: true, selVal: '', ops: [], onSel: () => {}, onClick: () => {}, ...x }));
    const nComments = Object.keys(s.comments).length + Object.values(s.st).filter((x) => x.comment || x.op).length;
    const modalTitles = { pieza: 'Vista previa de pieza', comentar: 'Comentar esta pantalla' };
    const vals = {
      canal: CANAL_TXT[s.canal] || s.canal, crumbs, L, h, o, P, datosAl, mesTxt, projName: pV ? pV.nombre : '', refNombre: proyN,
      goPortada: () => this.setState({ screen: 'portada', panel: false }),
      // Oficial · Informativo · General (los dos canales juntos). Todos los proyectos sigue al canal: al cambiarlo, el panel pasa a ese canal
      canales: [...CANALES, 'General'].map((k) => ({ label: CANAL_L(k), bg: s.canal === k ? '#FFFFFF' : 'transparent', color: s.canal === k ? '#3C3C3C' : '#808080', shadow: s.canal === k ? 'var(--shadow-sm)' : 'none',
        onClick: () => { keep('syo.canal', k); const pr = this.proj(); this.setState({ canal: k, panel: false, abierto: {}, ...(pr && !canalesDe(pr).includes(k) ? { screen: 'portada', pid: null } : s.screen === 'campana' ? { screen: 'proyecto', tab: 'resumen' } : {}), ...(k === 'General' && s.tab === 'looker' ? { tab: 'resumen' } : {}) }); } })),
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
      panelTitle: s.panelCamp ? 'Acciones · ' + sinPid(s.panelCamp) : pV ? `Acciones · ${pV.nombre} · ${CANAL_L(s.canal)}` : 'Acciones',
      panelSub: s.panelCamp ? panelList.length + ' pendientes en esta campaña' : pending.length + ' pendientes, ordenadas por prioridad y plata en juego',
      panelFiltered: !!s.panelCamp, panelAll: () => this.setState({ panelCamp: null }), noPanelItems: panelList.length === 0, nPending: pending.length, noPending: pending.length === 0,
      openPanel: () => openPanelAt(null, null), cards,
      listItems: panelList.map((a) => { const on = selAct && a.id === selAct.id; return { tipo: a.tipo, title: a.title, camp: a.etq ? `${a.camp} · ${a.etq}` : a.camp, ...(() => { const cc = a.campId && b.campanas[a.campId], t = a.plata === '—' ? { corto: '', largo: '' } : deMasTxt(a.plata, cc && a.tipo === 'Rinde por debajo' ? cc.dm : null, a._pid ? (DATA.proyectos.find((x) => x.id === a._pid) || {}).nombre : proyN); return { plata: t.corto, plataTitle: t.largo }; })(), bg: on ? '#F5F5F5' : '#FFFFFF', bl: on ? '#3C3C3C' : 'transparent', onClick: () => this.setState({ sel: a.id, discardFor: null }) }; }),
      resolved: resolvedActs.map((a) => { const x = s.st[a.id]; return { title: a.title, status: x.status === 'sent' ? 'Enviada a PAUTADOR' : x.status === 'manual' ? 'Hecha a mano' + (x.reason ? ' · ' + x.reason : '') : 'Descartada · ' + x.reason, onUndo: () => this.setAct(a.id, { status: 'pending', reason: null }) }; }),
      hasResolved: resolvedActs.length > 0, nResolved: resolvedActs.length,
      busca: s.busca, onBusca: (e) => this.setState({ busca: e.target.value }), colapsar: () => this.setState({ abierto: {}, busca: '' }),
    };

    // ---- recorrido: pasos y Acciones en el encabezado (en todas las pantallas) ----
    const pasoV = s.screen === 'campana' ? 'explora' : s.paso || 'expo';
    // Insights (05/10): vista aparte de Detalle. Abierta, ningún paso queda marcado, no van las pestañas ni el Período (no lo usa); tocar
    // un paso la cierra y va a ese paso
    const vistaAparte = s.screen === 'proyecto' && pasoV === 'explora' && s.tab === 'insights';
    // pestaña de Estructura (06/10): Activos si la que quedó guardada no es de Estructura
    const tabEst = tabEstDe(s.tab);
    const irPaso = (k) => this.setState({ paso: k, panel: false, ...(k === 'estructura' && tabEst === 'mapa' ? alMapa(s) : {}), ...(s.tab === 'insights' ? { tab: 'campañas', busca: '' } : {}), ...(s.screen === 'campana' || s.screen === 'guia' ? { screen: pV && b ? 'proyecto' : 'portada' } : {}) });
    const bTodosP = bloqueTodos(s.canal);
    const pendDe = (bb) => (bb ? bb.acciones.filter((a) => (s.st[a.id]?.status || 'pending') === 'pending').length : 0);
    const enPortada = s.screen === 'portada' || s.screen === 'guia' || !b;
    const nAccGlobal = enPortada ? pendDe(bTodosP) : pending.length;
    // Exposición y Detalle de la portada: una tarjeta (o una fila) por proyecto, sin números salvo el % del presupuesto
    const vistaProy = (name, bb, onClick) => {
      const aire = alAireDe(bb), pr = presuDe(bb), nota = notaProyecto(aire), malas = aire.filter((r) => r.nt === 1 || r.nt === 2).sort((x, y) => (y.gastoN || 0) - (x.gastoN || 0)).map((r) => sinPid(r.name || r.id));
      const lentos = (bb.activos || []).filter((a) => ritmoDe(a) === 'L').map((a) => sinPid(a.name));
      return { name, onClick, hayPresu: !!pr, sinPresu: !pr, presuPct: pr ? `${pr.pct} % usado` : 'sin presupuesto cargado', presuBar: pr ? Math.min(100, pr.pct) + '%' : '0%',
        rend: chipNota(nota, 'Nota de 1 a 5: promedio de sus campañas al aire (cada una contra las del mismo proyecto, canal, objetivo y placement de 2026), ponderado por gasto. Sin referencia si ninguna tiene con qué compararse'),
        ritmo: ritmoChip(ritmoConjunto((bb.activos || []).map(ritmoDe)), 'Ritmo de gasto de sus activos en los últimos 7 días contra lo habitual'),
        atencion: malas.length ? `Rinden mal: ${listaCorta(malas, 2)}` : 'Ninguna campaña al aire rinde mal', hayAtencion: malas.length > 0,
        malas: malas.length ? listaCorta(malas) : '—', lentos: lentos.length ? listaCorta(lentos) : '—', acc: pendDe(bb) ? 'Hay acciones para revisar' : 'Sin acciones pendientes' };
    };
    const vistasPortada = [
      ...(bTodosP ? [vistaProy(`Todos los proyectos · ${CANAL_L(s.canal)}`, bTodosP, () => this.setState({ screen: 'proyecto', paso: 'expo', tab: 'campañas', pid: TODOS, panel: false, period: DATA.mes, busca: '', abierto: {} }))] : []),
      ...DATA.proyectos.filter((pr) => canalesDe(pr).includes(s.canal)).map((pr) => vistaProy(pr.nombre, s.canal === 'General' ? bloqueGeneral(pr) : pr.canales[s.canal],
        () => this.setState({ screen: 'proyecto', paso: 'expo', tab: 'campañas', pid: pr.id, panel: false, period: DATA.mes, busca: '', abierto: {} }))),
    ];
    // marca con el KPI elegido (05/10): el rótulo dice cuál, y General y la portada tienen el mismo selector de Métrica (compartido)
    const kLab = marcaKpiLabel();
    Object.assign(vals, {
      marcaRot: `Cómo rinde (${kLab})`, marcaRotCorto: `Rendimiento (${kLab})`,
      marcaKpiOps: KPI_SEL.map(([k, label]) => { const on = (s.kpiSel || 'obj') === k; return { label, bg: on ? '#FFFFFF' : 'transparent', color: on ? '#3C3C3C' : '#808080', shadow: on ? 'var(--shadow-sm)' : 'none',
        onClick: () => { kpiSelGuardar(k); this.setState({ kpiSel: k }); } }; }),
      pasos: PASOS.map(([k, label], i) => { const on = pasoV === k && !vistaAparte; return { label, n: String(i + 1), on, color: on ? '#3C3C3C' : '#808080', bd: on ? '#3C3C3C' : '#E4E4E4', nBg: on ? '#3C3C3C' : '#F4F4F4', nColor: on ? '#FFFFFF' : '#808080', fw: on ? 600 : 500, sep: i > 0, onClick: () => irPaso(k) }; }),
      // portada (03/10): sin fila de pasos, solo las tarjetas; la portada vieja (Gasto del mes, Cierra en…) ya no se muestra: está en Todos los proyectos
      conPasos: s.screen !== 'portada', esPortada: s.screen === 'portada', portadaVieja: false,
      pasoExpo: pasoV === 'expo', pasoDetalle: pasoV === 'explora', pasoExplora: (pasoV === 'explora' || pasoV === 'estructura') && !vistaAparte, pasoEstructura: pasoV === 'estructura', pasoLooker: pasoV === 'looker',
      lookerLinea: 'Looker está por proyecto y canal: elegí Oficial o Informativo.',
      // título del proyecto en una línea chica junto a los pasos (06/10; antes un bloque aparte, alto)
      tituloProy: pV ? (comp === 'todos' ? 'Todos los proyectos' : pV.nombre) : '',
      tituloResto: pV ? `${CANAL_L(s.canal)}${pasoV === 'explora' || pasoV === 'estructura' ? '' : ' · ' + (pasoV === 'looker' ? 'Tablero de Looker Studio' : `Al aire hoy · datos al ${datosAl}`)}` : '',   // con el Período al lado, no se repite el período
      // Insights (05/10): vista de Detalle que se abre desde el encabezado. Creatividades (06/10): link a su plataforma local, en otra pestaña
      // (sin CREA_LINK, como en la copia publicada, el botón no va)
      vistas: !b || s.screen === 'guia' ? [] : [['Insights', 'insights'], ...(CREA_LINK ? [['Creatividades ↗', 'creatividades']] : [])].map(([label, k]) => { const on = k === 'insights' && s.screen === 'proyecto' && pasoV === 'explora' && s.tab === k;
        return { label, bd: on ? '#3C3C3C' : '#E4E4E4', bg: on ? '#3C3C3C' : '#FFFFFF', color: on ? '#FFFFFF' : '#3C3C3C', fw: on ? 600 : 400, onClick: k === 'creatividades' ? () => { if (typeof window !== 'undefined' && window.open) window.open(CREA_LINK, '_blank', 'noopener'); } : () => this.setState({ screen: 'proyecto', paso: 'explora', tab: k, panel: false, busca: '' }) }; }),
      hayVistas: !!b && s.screen !== 'guia', irDetalle: () => this.setState({ paso: 'explora', tab: 'campañas', busca: '' }),
      nAccGlobal, accGlobal: () => (enPortada ? (bTodosP ? this.setState({ screen: 'proyecto', tab: 'resumen', pid: TODOS, period: DATA.mes, busca: '', abierto: {}, panel: true, panelCamp: null, discardFor: null }) : null) : openPanelAt(null, null)),
      portadaVistas: vistasPortada, portadaSub: '¿Qué proyecto querés ver? Cada tarjeta dice el presupuesto del mes, cómo rinden las campañas al aire y el ritmo de gasto. El canal se elige arriba.',
    });
    if (!b) return vals;


    // ---- recorrido: General (paso 1) y Detalle del proyecto (también en Ambas y en Todos los proyectos) ----
    {
      const aire = alAireDe(b), cd = (r) => b.campanas && b.campanas[r.id];
      const ejeTxt = (e) => (!e || /^Sin c[oó]digo/i.test(e) ? 'Sin eje' : e);
      const kNom = (r) => KPI_NOMBRE[KPI_OBJ[r.obj] || 'cpm'];
      const marcaFila = (r) => chipDe(MARCA, marcaDe(r), `${marcaKpiDe(r.obj)} de los últimos 30 días contra lo de siempre en ${proyN}. Los números, en Detalle.`);
      const abrirCamp = (r) => () => { this.setState({ paso: 'explora' }); this.irCampana(r.id); };
      const estadoDe = (r) => { const c = cd(r); return estTxt(c ? c.estado : r.estado); };
      const ORD = { M: 0, N: 1, B: 2, S: 3 };
      const filasAire = aire.map((r) => { const tipo = tipoDe(r.id, r.sug, r.larga, r.tkey);
        return { name: sinPid(r.name || r.id), sub: r.etq || '', hasSub: !!r.etq, obj: r.obj || '—', eje: ejeTxt(r.eje), tag: TAG_TIPO[tipo] || '', hasTag: !!TAG_TIPO[tipo], plats: conLogo(r.plats), estado: estadoDe(r), marca: marcaFila(r), onClick: abrirCamp(r), _m: marcaDe(r), _g: r.gastoN || 0 }; })
        .sort((x, y) => (ORD[x._m] - ORD[y._m]) || y._g - x._g);
      const activosV = (b.activos || []).map((a) => { const sub = [a.auto ? 'automatizado' : '', comp ? a.etq || '' : ''].filter(Boolean).join(' · ');
        return { name: sinPid(a.name), sub, hasSub: !!sub, camps: a.camps || 'sin campañas en el período', ritmo: ritmoChip(ritmoDe(a)), plats: conLogo(a.plats), _r: ritmoDe(a) }; });
      const P30 = (b.periodos || {})['30d'] || { audCods: [] };
      const porAudR = {}; for (const x of P30.audCods || []) (porAudR[x.aud] = porAudR[x.aud] || new Set()).add(sinPid(x.com));
      const audsV = Object.entries(porAudR).map(([aud, cs]) => { const id = pidDe(aud), sub = id ? (DATA.proyectos.find((q) => q.id === id) || {}).nombre || '' : '';
        return { name: sinPid(aud), sub, hasSub: !!sub, camps: listaCorta([...cs].sort((x, y) => x.localeCompare(y, 'es'))) }; }).sort((x, y) => x.name.localeCompare(y.name, 'es'));
      const porEje = {}; for (const r of aire) (porEje[ejeTxt(r.eje)] = porEje[ejeTxt(r.eje)] || []).push(r);
      const ejesV = Object.entries(porEje).map(([eje, rs]) => { const m = marcaConjunto(conGasto(rs));
        return { name: eje, _m: m, camps: listaCorta(rs.map((r) => sinPid(r.name || r.id))), lista: rs.map((r) => ({ name: sinPid(r.name || r.id), marca: marcaFila(r), onClick: abrirCamp(r) })),
          marca: chipDe(MARCA, m, 'La marca más repetida entre las campañas al aire de este eje, contando cuánto gastó cada una') }; })
        .sort((x, y) => (ORD[x._m] - ORD[y._m]) || x.name.localeCompare(y.name, 'es'));
      // Proyección (decisión del 02/10): gasto al cierre contra el presupuesto, resultado al cierre y ritmo en cada nivel; antes del día 5 del
      // mes (05/10), "desde el 05/MM" y lo que lleva. Lo calcula marcas.js (proyectar) en el armado: b.proy = { p (proyecto), act: { activo: … } }.
      // Ejes y campañas no tienen presupuesto propio: "—". El alcance nunca se proyecta ni se suma.
      // la proyección de gasto e impresiones arranca el día 5 del mes (decisión de Juan Pablo del 05/10; antes el 10)
      const diaHoy = Number(DATA.datosHasta.slice(8, 10)), antes10 = diaHoy < 5, desde10 = `desde el 05/${DATA.mes.slice(5)}`;
      const pr = presuDe(b), PJ = b.proy || {};
      const cierreCh = (x) => (!x ? (antes10 ? chipGris(desde10) : chipGris('—')) : x.estado === 'antes_dia_10' ? chipGris(`desde el ${dm(x.desde)}`, 'Todavía pocos días del mes para un ritmo confiable')
        : x.estado === 'llega' ? chipDe(CIERRE, 'L', 'Al ritmo de los últimos 7 días, cierra el mes dentro del presupuesto (±10 %)') : x.estado === 'se_pasa' ? chipDe(CIERRE, 'P', 'Al ritmo de los últimos 7 días, gasta más que el presupuesto')
          : x.estado === 'no_llega' ? chipDe(CIERRE, 'NL', 'Al ritmo de los últimos 7 días, no gasta el presupuesto') : chipGris('sin presupuesto'));
      const ritmoPJ = (x, def) => (x && x.ritmo ? { rapido: 'R', normal: 'N', lento: 'L' }[x.ritmo] || def : def);
      const llevaDe = (x, presu) => (x && x.lleva ? `lleva ${fMs(x.lleva.gasto || 0)}${x.presupuesto ? ` de ${fMs(x.presupuesto)}` : ''}` : presu ? `lleva ${fMs(presu.lleva)} de ${fMs(presu.de)}` : 'sin presupuesto cargado');
      const llegaCh = (l) => { if (!l) return chipGris('—'); if (l.pocosDias) return chipGris(desde10, llegadaTxt(l).titulo); const x = llegadaTxt(l);
        return x.etiqueta === 'va a llegar' ? chipDe(CIERRE, 'L', x.titulo, 'Llega') : x.etiqueta === 'en riesgo' ? chipDe(CIERRE, 'NL', x.titulo, 'Puede no llegar') : x.etiqueta === 'no va a llegar' ? chipDe(CIERRE, 'NL', x.titulo, 'No llega') : chipGris('sin dato', x.titulo); };
      const llevaCamp = (l) => (l && l.lleva != null ? `lleva ${cantTxt(l.lleva, l.metrica)}` : l && l.logrado != null ? `lleva ${cantTxt(l.logrado, l.metrica)}` : '—');
      const ritmoProy = ritmoPJ(PJ.p, ritmoConjunto(activosV.map((a) => a._r)));
      const fila = (x) => ({ ...x, hayRitmo: !!x.ritmo, sinRitmo: !x.ritmo, ritmo: x.ritmo || chipGris('—'), hoyColor: x.hoy && x.hoy !== '—' ? '#3C3C3C' : '#A6AAA9', cursor: x.onClick ? 'pointer' : 'default', onClick: x.onClick || (() => {}) });
      const proyRows = [
        { nivel: 'Proyecto', name: comp === 'todos' ? `Todos los proyectos · ${CANAL_L(s.canal)}` : pV ? pV.nombre : '', gasto: cierreCh(PJ.p), imp: antes10 ? chipGris(desde10) : chipGris('—'), ritmo: ritmoChip(ritmoProy), hoy: llevaDe(PJ.p, pr) },
        ...ejesV.map((e) => ({ nivel: 'Eje', name: e.name, gasto: chipGris('—', 'No hay presupuesto por eje'), imp: antes10 ? chipGris(desde10) : chipGris('—'), ritmo: null, hoy: e.camps })),
        ...filasAire.map((x) => { const r = aire.find((q) => sinPid(q.name || q.id) === x.name), l = r ? (cd(r) || {}).llegada : null;
          return { nivel: 'Campaña', name: x.name, gasto: chipGris('—', 'La campaña no tiene presupuesto propio'), imp: llegaCh(l), ritmo: null, hoy: llevaCamp(l), onClick: x.onClick }; }),
        ...(b.activos || []).map((a) => { const x = (PJ.act || {})[a.name];
          return { nivel: 'Activo', name: sinPid(a.name), gasto: cierreCh(x), imp: antes10 ? chipGris(desde10) : chipGris('—'), ritmo: ritmoChip(ritmoPJ(x, ritmoDe(a))),
            hoy: x ? llevaDe(x) : a.pedido != null && a.pedidoCargado !== false ? `lleva ${fMs((a.gastado || 0) * 1e6)} de ${fMs(a.pedido * 1e6)}` : 'sin pedido cargado' }; }),
      ].map(fila);
      const malas = filasAire.filter((x) => x._m === 'M'), lentos = activosV.filter((a) => a._r === 'L');
      const expoMalas = malas.slice(0, 5).map((x) => ({ name: x.name, chip: x.marca, sub: [x.obj, String(x.estado || '').toLowerCase()].filter(Boolean).join(' · '), onClick: x.onClick }));
      const expoLentos = lentos.slice(0, 5).map((a) => ({ name: a.name, chip: a.ritmo, sub: [a.sub, 'gasta menos que lo habitual'].filter(Boolean).join(' · '), onClick: () => this.setState({ paso: 'estructura', tab: 'activos', busca: '' }) }));
      const nPendB = pending.length, hayAt = expoMalas.length + expoLentos.length > 0;
      Object.assign(vals, {
        expoPresu: pr ? `${pr.pct} % usado` : 'sin presupuesto cargado', expoPresuBar: pr ? Math.min(100, pr.pct) + '%' : '0%', expoHayPresu: !!pr, expoSinPresu: !pr,
        expoRend: chipDe(MARCA, marcaConjunto(conGasto(aire)), `Cada campaña al aire contra lo normal (${marcaKpiLabel()}); gana la marca con más gasto. Los números, en Detalle.`),
        expoRendSub: comp === 'todos' ? 'contra lo normal en todos los proyectos' : `contra lo normal en ${proyN}`,
        expoRitmo: ritmoChip(ritmoProy), expoAcc: nPendB ? 'Hay acciones para revisar' : 'Sin acciones pendientes',
        expoMalas, expoLentos, sinMalas: !expoMalas.length, sinLentos: !expoLentos.length, lentosVacio: ANTES_RITMO() ? `El ritmo de gasto se calcula ${RITMO_DESDE()}` : 'Ningún activo gasta lento', hayAtencion: hayAt, todoEnOrden: !hayAt,
        detTabs: DET_TABS.map(([label, k]) => { const on = (s.detTab || 'campanas') === k; return { label, color: on ? '#3C3C3C' : '#808080', bd: on ? '#3C3C3C' : 'transparent', onClick: () => this.setState({ detTab: k }) }; }),
        isDetCamp: pasoV === 'detalle' && (s.detTab || 'campanas') === 'campanas', isDetAct: pasoV === 'detalle' && s.detTab === 'activos', isDetAud: pasoV === 'detalle' && s.detTab === 'audiencias',
        isDetEjes: pasoV === 'detalle' && s.detTab === 'ejes', isDetProy: pasoV === 'explora' && !vistaAparte,
        detCamps: filasAire, detCampsVacio: filasAire.length === 0, detActivos: activosV, detActivosVacio: activosV.length === 0, detAuds: audsV, detAudsVacio: audsV.length === 0,
        detCampsNota: MARCA_KPI !== 'obj' ? `Cómo rinde (${marcaKpiLabel()}): cada campaña marcada con ${marcaKpiLabel()} contra lo normal en ${proyN}. Al aire: gastaron en los últimos 2 días.` : `Cómo rinde: el KPI del objetivo contra lo normal en ${proyN} (costo por reacción en Interacción, CPM —costo cada mil impresiones— en Alcance, CTR —clicks cada cien impresiones— en Tráfico y Conversión, costo por reproducción en Reproducciones). Al aire: gastaron en los últimos 2 días.`,
        detEjes: ejesV, detEjesVacio: ejesV.length === 0, proyRows,
        proyAviso: antes10 ? `Todavía pocos días del mes: se proyecta ${desde10}. Hasta entonces, lo que lleva cada uno. Personas alcanzadas no se proyecta.` : 'Gasto al cierre al ritmo de los últimos 7 días, contra el presupuesto (±10 %). Personas alcanzadas no se proyecta.',
      });
    }
    // ---- proyecto ----
    const per = DATA.periodos.find((x) => x.id === s.period) || DATA.periodos[0];
    const PD = b.periodos[per.id] || { campRows: [], pubs: [], audCods: [], actCods: [] };
    const t = b.tarjeta;
    const campRowV = (c) => { const tipo = tipoDe(c.id, c.sug, c.larga, c.tkey), cd = b.campanas[c.id] || {}, ll = c.lleg ? llegadaTxt(cd.llegada) : null;
      const llegV = { hasLleg: !!ll, llegTxt: ll ? ll.etiqueta : '', llegDot: ll ? ll.dot : COL.n, llegTitle: ll ? ll.titulo : '',
        hasSol: !!c.sol, solTitle: c.sol ? `Solapan público: ${c.sol === 1 ? 'un par de audiencias puede' : c.sol + ' pares de audiencias pueden'} llegar a la misma gente. El detalle está en la campaña.` : '' };
      // la columna de Métrica: el del objetivo de la campaña (nombrado en la celda) o el que se eligió en el selector
      // 06/10 (Juan Pablo): la lista de Campañas va siempre según objetivo: cada campaña con el KPI de su objetivo, sin selector
      const kSel = KPI_OBJ[c.obj] || 'cpm', col = KPI_COLS.find((x) => x.k === kSel) || KPI_COLS[1];
      // etq: en General, en qué canales corrió ("Oficial + Informativo"); en Todos los proyectos, de qué proyecto es
      return { ...c, ...llegV, kc: undefined, marca: chipDe(MARCA, marcaObjDe(c), `${KPI_NOMBRE[kSel] || ''} del período contra lo de siempre en ${proyN} (cuartiles del proyecto)`), kpi: celdaKpi(c, col, tipo, proyN, true, null, refVista), etq: c.etq || '', etqTitle: comp === 'general' ? 'Canales donde corrió en el período' : s.canal === 'General' ? 'Proyecto y canales donde corrió en el período' : 'Proyecto',
        ...(() => { const t = deMasTxt(c.demas, c.dm, comp === 'todos' ? c.pn || c.etq : proyN); return { demasTxt: t.corto, demasTitle: t.largo }; })(), impC: fCant(c.imp), reaC: c.st ? 'no aplica (Stories)' : fCant(c.rea), reaGris: c.st ? '#808080' : '#3C3C3C', tipo, plats: conLogo(c.plats), tag: TAG_TIPO[tipo] || '', estado: estTxt(c.estado), estDot: c.ec ? COL[c.ec] : '', estColor: c.estado === 'Terminó' ? '#A6AAA9' : '#3C3C3C', ef: efic(c.ef), nAct: c.nAct || 0, noAct: !c.nAct, onAct: (e) => { e && e.stopPropagation(); openPanelAt(null, c.id); }, onClick: () => this.irCampana(c.id) }; };
    // árboles
    const porCamp = (rows, campo) => rows.reduce((m, r) => { (m[r[campo]] = m[r[campo]] || []).push(r); return m; }, {});
    const platsDe = (rows) => { const m = {}; for (const r of rows) for (const c of (r.codes || [r.code])) if (c) m[c] = (m[c] || 0) + (r.g || r.gasto || 0); return chipsDe(Object.entries(m).sort((a, c) => c[1] - a[1]).map(([code]) => code)); };
    const pubsDeEje = PD.pubs.reduce((m, x) => { const e = !x.eje || /^Sin c[oó]digo/i.test(x.eje) ? 'Sin eje' : x.eje; (m[e] = m[e] || []).push({ ...x, g: x.gasto, i: x.imp, r: x.rea }); return m; }, {});
    const arbolEjes = this.arbol(Object.entries(pubsDeEje).map(([eje, rows]) => ({ key: `E|${eje}`, name: eje, plats: platsDe(rows), porCamp: porCamp(rows, 'camp') })), PD, b, { conAnuncios: true });
    const porAud = (PD.audCods || []).reduce((m, x) => { (m[x.aud] = m[x.aud] || []).push(x); return m; }, {});
    const proyDe = (x) => { const id = pidDe(x); return id ? (DATA.proyectos.find((q) => q.id === id) || {}).nombre || '' : ''; };
    const arbolAuds = this.arbol(Object.entries(porAud).map(([aud, rows]) => ({ key: `A|${aud}`, name: sinPid(aud), sub: proyDe(aud), plats: platsDe(rows), porCamp: porCamp(rows, 'com') })), PD, b, { conAnuncios: false, pctDe: comp === 'todos' ? 'del total' : 'del proyecto' });
    const porVoz = (PD.actCods || []).reduce((m, x) => { (m[x.voz] = m[x.voz] || []).push(x); return m; }, {});
    // Activos: una sola tabla; cada activo lleva su salud (ritmo de gasto y restante del pedido). Los activos del bloque sin gasto
    // en el período igual aparecen (un apagón es justamente lo que hay que ver)
    const saludDe = (a) => {
      if (!a) return SIN_SALUD;
      // sin pedido cargado en la planilla (pedidoCargado false, o sin pedido para este activo): "Sin pedido cargado" en gris, sin
      // restante, sin barra y sin "Superó el pedido" (decisión de Juan Pablo: no destacar lo que falta en la planilla)
      const hayP = a.pedidoCargado !== false && a.pedido != null;
      const restante = hayP ? (a.pedido >= a.gastado ? `Restan $${n2(a.pedido - a.gastado, 1)} M de $${n2(a.pedido, 1)} M` : `Superó el pedido por $${n2(a.gastado - a.pedido, 1)} M`) : 'Sin pedido cargado';
      return { hay: true, ritmo: ANTES_RITMO() ? `Ritmo ${RITMO_DESDE()}` : `Ritmo: ${(RITMO[ritmoDe(a)] || RITMO.X)[0]}`, dot: a.ritmo[1] ? COL[a.ritmo[1]] : '', bg: a.ritmo[1] ? '#F4F4F4' : '#FAFAFA', restante, hayBarra: hayP, w: hayP ? Math.max(0, Math.min(100, (a.pedido - a.gastado) / a.pedido * 100)) + '%' : '0%', titulo: `Gasto de los últimos 7 días: ${a.g7}` };
    };
    const actPorNombre = Object.fromEntries(b.activos.map((a) => [a.name, a]));
    const voces = [...new Set([...Object.keys(porVoz), ...b.activos.map((a) => a.name)])];
    const arbolActivos = this.arbol(voces.map((voz) => { const rows = porVoz[voz] || [], a = actPorNombre[voz];
      return { key: `V|${voz}`, name: sinPid(voz), plats: rows.length ? platsDe(rows) : conLogo(a ? a.plats : []), voz, porCamp: porCamp(rows, 'com'), salud: saludDe(a), sub: [a && a.auto ? 'Automatizado' : '', comp ? (a && a.etq) || proyDe(voz) : ''].filter(Boolean).join(' · '), keep: !!a, nCont: (PD.actN || {})[voz] || 0, contDe: (com) => (PD.actN || {})[`${voz}|${com}`] || 0 }; }), PD, b, { conAnuncios: true, pct: PD.actTot ? { ...PD.actTot, nCamp: PD.campRows.length } : null, pctDe: comp === 'todos' ? 'del total' : 'del proyecto' });
    // Looker embebido: precargado en DATA.lookers o pegado por el usuario (queda en el navegador)
    const lk = `${s.pid}|${s.canal}`, lookerSrc = s.looker[lk] || (DATA.lookers || {})[lk] || '';
    const pegarLooker = () => { const txt = prompt(`Pegá el link de inserción de Looker Studio de ${p.nombre} · ${CANAL_L(s.canal)} (Archivo → Insertar informe; sirve el <iframe> entero).`, ''); if (txt == null) return; const src = lookerSrcDe(txt); if (!src) { this.say('No parece un link de Looker Studio'); return; } const looker = { ...s.looker, [lk]: src }; keep('syo.looker', looker); this.setState({ looker, tab: 'looker' }); this.say('Tablero guardado'); };

    // Mapa de Estructura (06/10): se arma solo cuando está a la vista; usa el período elegido
    if (pasoV === 'estructura' && tabEst === 'mapa' && !vistaAparte) Object.assign(vals, mapaVals(this, s, PD, comp === 'todos' ? 'Todos los proyectos' : pV.nombre,
      mesTemprano() && per.id === '30d' ? 'Como el mes recién empieza, se muestran los últimos 30 días; el Período de arriba se puede cambiar.' : ''));
    const campTodas = PD.campRows.map(campRowV);
    const mesRows = Object.fromEntries((((b.periodos || {})[DATA.mes] || {}).campRows || []).map((r) => [r.id, r]));
    Object.assign(vals, {
      projLights: [],
      looker: (e) => { e && e.preventDefault(); this.setState({ tab: 'looker' }); },
      isLooker: pasoV === 'looker' && !comp, lookerNoAplica: pasoV === 'looker' && !!comp, lookerSrc, hasLooker: !!lookerSrc, noLooker: !lookerSrc, lookerH: Math.max(360, (s.hv || 900) - 120) + 'px', pegarLooker,
      // Looker: no hay tablero de los dos canales juntos ni de todos los proyectos; la pestaña no va en esas vistas
      // 06/10: Detalle tiene una sola sección (Campañas): sin barra de pestañas; Estructura, sus tres
      projTabs: pasoV !== 'estructura' || vistaAparte ? [] : TABS_ESTRUCTURA.map(([label, k]) => { const on = tabEst === k; return { label, color: on ? '#3C3C3C' : '#808080', bd: on ? '#3C3C3C' : 'transparent', onClick: () => this.setState({ tab: k, busca: '', ...(k === 'mapa' ? alMapa(s) : {}) }) }; }),
      // 06/10: Detalle = Campañas y, abajo de todo, la Proyección (tarjetas de Gasto del mes y los cuatro niveles); Estructura = Activos · Ejes · Audiencias
      isResumen: pasoV === 'explora' && !vistaAparte, isCampanas: pasoV === 'explora' && !vistaAparte, pasoMapa: pasoV === 'estructura' && tabEst === 'mapa' && !vistaAparte, pasoEstTablas: pasoV === 'estructura' && tabEst !== 'mapa', isEjes: pasoV === 'estructura' && tabEst === 'ejes', isPubs: false, isCmpTab: false, isAud: pasoV === 'estructura' && tabEst === 'audiencias', isActivos: pasoV === 'estructura' && tabEst === 'activos', isInsights: pasoV === 'explora' && s.tab === 'insights',
      period: per.id, onPeriod: (e) => this.setState({ period: e.target.value, abierto: {} }), periods: DATA.periodos.filter((x) => b.periodos[x.id]).map((x) => ({ id: x.id, label: x.label })), periodTxt: pasoV === 'explora' || pasoV === 'estructura' ? per.txt : pasoV === 'looker' ? 'Tablero de Looker Studio' : `Al aire hoy · datos al ${datosAl}`,
      campGastoLabel: per.id === DATA.mes ? 'Gasto' : 'Gasto del período',
      // Resumen
      budgets: b.budgets.map((x) => { const v = budgetView(x, b.diasMes, b.mesAnt), dia = x.acum.length, mm = DATA.mes.slice(5);
        return { ...v, c: s.bMetric === 'Gasto' ? v.gastoC : v.impC, dia, diasMes: b.diasMes, tiempoPct: Math.round(dia / b.diasMes * 100), ejeIni: `1/${mm}`, ejeMed: `${Math.round(b.diasMes / 2)}/${mm}`, ejeFin: `${b.diasMes}/${mm}` }; }),
      bMetrics: ['Gasto', 'Impresiones'].map((m) => { const on = s.bMetric === m; return { label: m, bg: on ? '#FFFFFF' : 'transparent', shadow: on ? 'var(--shadow-sm)' : 'none', onClick: () => this.setState({ bMetric: m }) }; }),
      // Revisar campañas (01/10): la misma columna de Métrica que la lista de Campañas (mismo selector), con los valores del mes en curso
      // (su fila de la lista de Campañas de ese período), más Impresiones y Reacciones
      // Revisar campañas (decisión de Juan Pablo del 01/10): de las campañas al aire, entran solo las que muestran "peor" en su celda del mes
      // (rojo contra lo normal o contra la misma campaña), con el KPI que está elegido en el selector; así se ve por qué está cada una.
      // Ordenadas por lo que pagaron de más, hasta cinco. En General la celda es la de la campaña sumada; en Todos los proyectos, la del panel
      badCamps: b.bad.map((c) => { const fm = mesRows[c.id]; if (!fm) return null;
        const kSel = s.kpiSel === 'obj' ? KPI_OBJ[fm.obj] || 'cpm' : s.kpiSel, col = KPI_COLS.find((x) => x.k === kSel) || KPI_COLS[1];
        const kpi = celdaKpi(fm, col, tipoDe(fm.id, fm.sug, fm.larga, fm.tkey), proyN, s.kpiSel === 'obj', null, refVista);
        if (!((kpi.hasP && kpi.p.color === TXT.rojo) || (kpi.hasS && kpi.s.color === TXT.rojo) || (kpi.hasG && kpi.gs.some((g) => g.color === TXT.rojo)))) return null;
        const dmT = deMasTxt(c.demas, c.dm, comp === 'todos' ? c.pn || c.etq : proyN), efT = efic(c.ef);
        return { ...c, kpi, impC: fCant(fm.imp), reaC: fm.st ? 'no aplica (Stories)' : fCant(fm.rea), reaGris: fm.st ? '#808080' : '#3C3C3C', st: !!fm.st, obj: fm.obj,
          meta: comp === 'general' ? `${fm.obj} · Eje ${c.eje} · ${fMs(c.g7)} en 7 días` : c.meta, etq: comp === 'general' ? fm.etq || '' : fm.etq || c.etq || '', etqTitle: comp === 'general' ? 'Canales donde corrió en el mes' : s.canal === 'General' ? 'Proyecto y canales donde corrió en el mes' : 'Proyecto',
          demasTxt: dmT.corto, demasTitle: dmT.largo, plats: conLogo(comp === 'general' ? fm.plats : c.plats), ef: efT, onClick: () => this.irCampana(c.id) }; }).filter(Boolean)
        .sort((x, y) => (y.deMasN || 0) - (x.deMasN || 0)).slice(0, 5),
      badVacioTxt: s.kpiSel === 'ca' ? 'El CPM de Alcance todavía no se compara (no tiene referencias): elegí otro KPI para ver qué campañas están peor.' : 'Ninguna campaña al aire dice “peor” en su celda del mes con este KPI.',
      // Campañas
      // filtros de Campañas: siempre sobre las campañas con gasto en el período elegido (por defecto, el mes en curso)
      campFilters: FILTROS_CAMP.map(([m, pasa]) => { const on = s.campFilter === m; return { label: `${m} (${campTodas.filter(pasa).length})`, bg: on ? '#3C3C3C' : '#FFFFFF', color: on ? '#FFFFFF' : '#3C3C3C', bd: on ? '#3C3C3C' : '#E4E4E4', onClick: () => this.setState({ campFilter: m }) }; }),
      campRows: campTodas.filter((FILTROS_CAMP.find(([m]) => m === s.campFilter) || FILTROS_CAMP[0])[1]),
      // selector de KPI (Según objetivo · uno por KPI), el título de la columna con su ayuda y la línea que explica la tabla, debajo
      campKpiOps: KPI_SEL.map(([k, label]) => { const on = s.kpiSel === k; return { label, bg: on ? '#FFFFFF' : 'transparent', color: on ? '#3C3C3C' : '#808080', shadow: on ? 'var(--shadow-sm)' : 'none',
        onClick: () => { kpiSelGuardar(k); this.setState({ kpiSel: k }); } }; }),
      ...(() => { const col = KPI_COLS.find((x) => x.k === s.kpiSel);
        return { campKpiTitulo: col ? col.label : 'Métrica según el objetivo', campKpiAyuda: col ? col.ayuda : 'Cada campaña muestra el KPI de su objetivo: Interacción, Costo por reacción; Alcance, CPM; Reproducciones, Costo por reproducción; Tráfico y Conversión, CTR. Arriba de la tabla se puede elegir ver un solo KPI para todas.' }; })(),
      // lista de Campañas (06/10): siempre según objetivo
      campListaTitulo: 'Métrica según su objetivo', campListaAyuda: 'Cada campaña muestra el KPI de su objetivo: Interacción, Costo por reacción; Alcance, CPM; Reproducciones, Costo por reproducción; Tráfico y Conversión, CTR. Todas las métricas de cada campaña están en su ficha.', marcaRotCamp: 'Cómo rinde (según su objetivo)',
      campLeyenda: (comp === 'general' ? `Oficial e Informativo juntos: una campaña con el mismo nombre en los dos canales va una sola vez, sumada, y dice en qué canales corrió. vs. ${proyN} = lo normal en las campañas de ${proyN} con los dos canales juntos en el último año (los costos, en los últimos cuatro meses), con el mismo objetivo y formato (en Costo por reproducción, la misma plataforma y objetivo, en los últimos seis meses). `
        : comp === 'todos' ? (s.canal === 'General' ? 'Las campañas de los siete proyectos con Oficial e Informativo juntos, cada una con su proyecto y los canales donde corrió (una campaña con el mismo nombre en los dos canales de un proyecto va una vez, sumada; no se suman entre proyectos). vs. todos los proyectos = lo normal en los siete proyectos con los dos canales juntos: ' : `Las campañas de los siete proyectos de ${s.canal}, cada una con su proyecto (no se suman entre proyectos). vs. todos los proyectos = lo normal en ${s.canal} con los siete proyectos juntos: `)
          + 'en el último año (los costos, en los últimos cuatro meses), con el mismo objetivo y formato (en Costo por reproducción, la misma plataforma y objetivo, en los últimos seis meses). '
        : `vs. ${proyN} = lo normal en las campañas de ${proyN} en el último año (los costos, en los últimos cuatro meses), con el mismo objetivo y formato (en Costo por reproducción, la misma plataforma y objetivo, en los últimos seis meses). `)
        + 'vs. semanas anteriores = la misma campaña antes de las últimas dos semanas; en las estacionales confirmadas, vs. temporada pasada = las mismas semanas del año anterior, con la plata llevada a valores de hoy. '
        + 'Entre paréntesis, el valor de referencia. Rojo con ▲ o ▼ y “peor”: bastante peor que la referencia; verde con “mejor”: bastante mejor (el mismo corte que usa el agente: en costos, 20 % más caro o 17 % más barato; en CTR y ETR, 17 % más bajo o 20 % más alto). Gris: parecido o sin referencia. '
        + 'En costos (Costo por reacción, CPM, CPM de Alcance, Costo por reproducción) más alto es peor; en CTR y ETR, más alto es mejor. En CTR, la parte de Tráfico en Google va en un renglón más por red, comparada contra lo normal de esa misma red. Al pasar el mouse por el título de la columna se ve cómo se calcula.',
      // Árboles
      arbolEjes, arbolEjesVacio: arbolEjes.length === 0, arbolAuds, arbolAudsVacio: arbolAuds.length === 0, arbolActivos, arbolActivosVacio: arbolActivos.length === 0,
      // Activos (estado)
      activos: b.activos.map((a) => { const hayP = a.pedidoCargado !== false && a.pedido != null; return { name: a.name, plats: conLogo(a.plats), auto: a.auto,
        hasPedido: hayP, noPedido: !hayP, restante: hayP ? (a.pedido >= a.gastado ? `$${n2(a.pedido - a.gastado, 1)} M de $${n2(a.pedido, 1)} M` : `superó el pedido de $${n2(a.pedido, 1)} M por $${n2(a.gastado - a.pedido, 1)} M`) : '', w: hayP ? Math.max(0, (a.pedido - a.gastado) / a.pedido * 100) + '%' : '0%',
        g7: a.g7, ritmo: a.ritmo[0], rDot: a.ritmo[1] ? COL[a.ritmo[1]] : '', rBg: a.ritmo[1] ? '#F4F4F4' : 'transparent' }; }),
      // Insights
      insVs: b.insights.vs.map((r) => ({ ...r, c: COL[r.c] })),
      insEf: b.insights.ef.map((g) => ({ title: g.title, rows: g.rows.map(([name, pp, n, N, gasto]) => ({ name, gasto, ef: efic({ p: pp, n, N, color: pp < 25 ? 'verde' : pp < 50 ? 'amarillo' : pp < 75 ? 'naranja' : 'rojo' }) })) })),
      insSeason: b.insights.season.map((r) => { const t = tipoOps(r.id, r.sug, r.larga, r.tkey);
        return { name: r.name, detalle: `${r.etq ? r.etq + ' · ' : ''}Con gasto en ${r.sem52} de las últimas 52 semanas${r.previa ? ' · ' + r.previa : ''}`, nota: t.confirmado ? 'confirmado' : 'sugerido', ops: t.ops }; }),
      insSeasonVacio: b.insights.season.length === 0,
      insLists: [
        { title: comp === 'todos' ? 'De cada proyecto' : 'De ' + p.nombre, sub: comp === 'todos' ? `Aprendizajes propios de cada proyecto${s.canal === 'General' ? ', en cada canal,' : ' de ' + s.canal} contra todos los gobiernos.` : comp === 'general' ? 'Aprendizajes propios del proyecto en cada canal, contra todos los gobiernos.' : 'Aprendizajes propios del proyecto contra todos los gobiernos.', rows: (b.insights.propios.length ? b.insights.propios : [['Todavía no hay suficiente historia para aprendizajes propios.', '']]).map(([txt, src]) => ({ txt, src })) },
        { title: 'Del uso', sub: 'Lo que aprendió de las decisiones y opiniones del equipo.', rows: this.delUso() },
        { title: 'Generales', sub: 'Aprendizajes del último año de DataJunta, en todos los gobiernos.', rows: DATA.generales.map(([txt, src]) => ({ txt, src })) },
      ],
    });

    vals.badVacio = vals.badCamps.length === 0;
    // ---- campaña ----
    const c = b.campanas[s.campId];
    if (s.screen === 'campana' && c) {
      const tipoC = tipoCamp(c.id), estac = tipoC === 'estacional' && !!(c.hist && c.hist.temporada);
      // la luz propia según el tipo: temporada anterior (estacional) o sus semanas anteriores (constante, larga)
      const H = c.hist ? { ...c.hist, idx: estac ? c.hist.idxTemporada : c.hist.idxPropio } : null;
      const propiaC = H ? (H.idx ?? 'e') : undefined;
      const PrC = H ? { x: propiaC, v: estac ? H.previa && H.previa.valorAct : H.valorAct, temporada: estac } : null, mObj = MET[MET_OBJ[c.obj]] || MET.cpm;
      // Rendimiento (pedido de Juan Pablo del 01/10): tarjetas chicas en una fila. Cada una: el nombre, el valor grande y hasta dos líneas
      // cortas ("vs. Santa Fe $105 · −60 %", "vs. sem. ant. $84 · −83 %"), con color solo si la diferencia es grande. Sin párrafos: la frase
      // completa va al pasar el mouse. La tarjeta del objetivo lleva el borde marcado y la etiqueta "objetivo". Impresiones no se compara
      // (el costo de las impresiones es la tarjeta CPM); Personas alcanzadas, el dato de Meta o "sin dato de Meta" con el motivo
      const pCorto = proyCorto(proyN), kObj = TILE_OBJ[KPI_OBJ[c.obj] || 'cpm'], kProp = TILE_MET_LABEL[metPropia(c.obj)];
      const semEtq = estac ? 'vs. temp. pas.' : 'vs. sem. ant.';
      // el valor grande es de 180 días y la comparación con la misma campaña es de las últimas dos semanas (o de lo que va de la temporada):
      // primero ese valor y después la comparación, en dos líneas cortas ("últ. 2 sem. $899" · "vs. sem. ant. $521 · +72 %"; pedido del 01/10)
      const semLineas = (v, ref, cst, fmt, title, etq, pri) => [renglon(`${pri || (estac && !etq ? 'esta temp.' : 'últ. 2 sem.')} ${fmt(v)}`, TXT.gris, title), lineaTile(v, ref, cst, etq || semEtq, fmt, title)];
      // período del panel (pedido del 02/10): "Este mes" (por defecto) o "Histórica" (en las estacionales, "Esta temporada"). Cada opción
      // trae sus tarjetas armadas sobre su ventana (c.rp); Histórica son las de siempre (c.tiles)
      const RP = c.rp || null, selR = !RP || s.rendPer === 'hist' ? (estac && RP && RP.temp ? 'temp' : 'hist') : 'mes';
      const tilesSel = selR === 'mes' ? RP.mes.tiles : selR === 'temp' ? RP.temp.tiles : c.tiles;
      const alcTile = c.tiles.find((x) => x.alcM);
      const perTxt = selR === 'mes' ? (RP.mes.sin ? 'este mes, sin gasto todavía' : `este mes, del ${dm(RP.mes.d)} al ${dm(RP.mes.h)}`) : selR === 'temp' ? `esta temporada, desde el ${dm(RP.temp.d)}` : RP ? `desde el ${dm(RP.hist.d)}` : 'últimos 180 días';
      const tarjeta = (tt) => {
        const esObj = tt.label === kObj, base = { label: tt.label, val: tt.val, kpi: esObj, border: esObj ? '1.5px solid #3C3C3C' : '1px solid #E4E4E4', lineas: [], title: `${tt.label}: ${tt.val}${tt.small ? ' (' + tt.small + ', ' + perTxt + ')' : ''}.` };
        if (tt.alcM || tt.alcR) return { ...base, ...alcanceTarjeta({ ...tt, alcM: tt.alcM || (alcTile && alcTile.alcM) || {} }, RP ? tt.alcP : undefined) };
        const met = MET_TARJETA[tt.label] || (tt.label === 'Costo por reproducción' ? 'cv' : 'cpm'), M2 = MET[met] || MET.cpm, fmt = FMT_TILE[met] || fCosto, costo = !M2.tasa;
        if (tt.label === 'Impresiones') return base;
        const lineas = [];
        // contra lo normal del proyecto: índice de Referencias (l[1]) o, en Costo por reproducción, la referencia (cp)
        const refP = tt.label === 'Costo por reproducción' ? tt.cp : tt.l && tt.l[1] != null && tt.lv > 0 ? (costo ? tt.lv * tt.l[1] : tt.lv / tt.l[1]) : null;
        const largoP = tt.label === 'Costo por reproducción' ? (refP ? `Lo normal en ${proyN} (misma plataforma y objetivo): ${fCosto(refP)}. Esta campaña: ${tt.val}.` : `Sin referencia en ${proyN} para el costo por reproducción.`)
          : luzTxt(tt.l ? tt.l[1] : null, { met, contra: 'proyecto', proy: proyN, v: tt.lv }).largo;
        lineas.push(refP ? lineaTile(tt.lv, refP, costo, `vs. ${pCorto}`, fmt, largoP) : renglon(`sin referencia en ${pCorto}`, TXT.gris, largoP));
        // contra la misma campaña: en la tarjeta de la métrica con la que Referencias arma su historia (o el costo por reproducción)
        // "Este mes": lo que va del mes contra sus semanas anteriores o contra la temporada pasada (como la lista de Campañas en el mes)
        if (selR === 'mes' && H && (tt.label === kProp || tt.label === 'Costo por reproducción')) {
          if (RP.mes.sin) return { ...base, lineas };   // sin gasto en el mes: no hay nada que comparar
          const pm = tt.pm, mp = tt.label === 'Costo por reproducción' ? 'cv' : metPropia(c.obj), cst = !(MET[mp] || {}).tasa, fm = FMT_TILE[mp] || fCosto, ref = pm ? (estac ? pm.t : pm.s) : null;
          const contra = estac ? 'en las mismas semanas de la temporada pasada (con la plata llevada a valores de hoy)' : 'en sus semanas anteriores';
          if (pm && pm.v != null && ref) lineas.push(...semLineas(pm.v, ref, cst, fm, `En lo que va del mes: ${fm(pm.v)}; ${contra}: ${fm(ref)}.`, semEtq, 'este mes'));
          else lineas.push(renglon(`sin ${estac ? 'temporada pasada' : 'semanas anteriores'}`, TXT.gris, `Este mes todavía no se puede comparar con ${estac ? 'la temporada pasada' : 'sus semanas anteriores'}: hacen falta semanas anteriores con el mismo objetivo y formato.`));
        } else if (selR === 'temp' && tt.pt) {
          // "Esta temporada" (02/10): el número grande (toda esta temporada) contra la misma cantidad de semanas desde el inicio de la
          // temporada pasada, en todas las tarjetas; "esta temp." es el mismo número grande
          const p = tt.pt, cuanto = p.toda ? `toda la temporada pasada (${p.n} ${p.n === 1 ? 'semana' : 'semanas'} desde el ${dm(p.d)}/${p.d.slice(2, 4)})` : `las primeras ${p.n} semanas de la temporada pasada (desde el ${dm(p.d)}/${p.d.slice(2, 4)})`;
          if (p.sin || !(tt.lv > 0) || !(p.r > 0)) lineas.push(renglon('sin temporada pasada', TXT.gris, `No se puede comparar con ${cuanto}: esta temporada usa objetivos que la pasada no tuvo.`));
          else lineas.push(...semLineas(tt.lv, p.r, costo, fmt, `Esta temporada, desde el ${dm(RP.temp.d)}: ${fmt(tt.lv)}. En ${cuanto}, con ${p.nivel === 'o' ? 'los mismos objetivos' : 'los mismos objetivos y formatos'}${costo ? ' y la plata llevada a valores de hoy' : ''}: ${fmt(p.r)}.`, semEtq, 'esta temp.'));
        } else if (tt.label === 'Costo por reproducción' && tt.cs) lineas.push(...semLineas(tt.cs.v, tt.cs.r, true, fCosto, `En las últimas dos semanas, cada reproducción costó ${fCosto(tt.cs.v)}; en sus semanas anteriores, ${fCosto(tt.cs.r)} (plataforma por plataforma).`, 'vs. sem. ant.'));
        else if (tt.label === kProp && PrC) {
          const lz = luzTxt(PrC.x, { met: metPropia(c.obj), contra: estac ? 'temporada' : 'semanas', v: PrC.v, dice: true });
          const x = PrC.x, v = PrC.v, mp = metPropia(c.obj), cst = !(MET[mp] || {}).tasa;
          if (x === 'e' || x == null || !(v > 0)) lineas.push(renglon(x === 'e' ? `${semEtq.replace('vs. ', '')}: poca historia` : `sin ${estac ? 'temporada pasada' : 'semanas anteriores'}`, TXT.gris, lz.largo));
          else lineas.push(...semLineas(v, cst ? v * x : v / x, cst, FMT_TILE[mp] || fCosto, lz.largo));
        }
        return { ...base, lineas };
      };
      const colDe = (obj) => { const k = s.kpiSel === 'obj' ? KPI_OBJ[obj] || 'cpm' : s.kpiSel; return KPI_COLS.find((x) => x.k === k) || KPI_COLS[1]; };
      const caTile = (() => { const fila = ((b.periodos || {})['30d'] || { campRows: [] }).campRows.find((x) => x.id === c.id); if (!fila || !fila.kc || !fila.kc.ca) return null;
        const x = celdaKpi(fila, KPI_COLS.find((k) => k.k === 'ca'), '', proyN, false, null, null);
        return { label: 'CPM de Alcance', val: x.val, kpi: false, border: '1px solid #E4E4E4', title: x.title, lineas: [renglon('últimos 30 días', TXT.gris, x.title), ...(x.hasC ? x.cs : x.hasP ? [x.p] : [])].map((l) => ({ ...l, ws: 'normal' })) }; })();
      const luzPropiaC = H ? luzTxt(propiaC, { met: metPropia(c.obj), contra: estac ? 'temporada' : 'semanas', v: PrC.v, dice: true }) : null;
      Object.assign(vals, {
        // 06/10: la marca al lado del nombre va siempre según el objetivo de la campaña (no sigue el selector de Métrica)
        campMarca: chipDe(MARCA, marcaObjDe(c), `${KPI_NOMBRE[KPI_OBJ[c.obj] || 'cpm']} de los últimos 30 días contra lo de siempre en ${proyN} (cuartiles del proyecto por objetivo y placement)`),
        campLlegCeldas: (() => { const l = c.llegada, d10 = `desde el 05/${DATA.mes.slice(5)}`;
          const res = !l ? '—' : l.pocosDias ? d10 : l.etiqueta === 'va a llegar' ? 'Llega' : l.etiqueta === 'no va a llegar' ? 'No llega' : l.etiqueta === 'en riesgo' ? 'Puede no llegar' : 'sin dato';
          const lleva = !l ? '—' : l.lleva != null ? cantTxt(l.lleva, l.metrica) : l.logrado != null ? cantTxt(l.logrado, l.metrica) : '—';
          return [{ label: 'Gasto al cierre', val: '—', sub: 'la campaña no tiene presupuesto propio' }, { label: 'Resultado al cierre', val: res, sub: l && l.pocosDias ? 'todavía pocos días del mes para proyectar' : l ? `${l.metrica || 'resultado'} contra una campaña normal con la misma plata` : 'sin dato' },
            { label: 'Lo que lleva', val: lleva, sub: l && l.gastado != null ? `${fMs(l.gastado)} gastados este mes` : 'este mes' }]; })(),
        campName: c.name, campObj: c.obj, campEje: c.eje || '—', campFechas: c.fechas, campEstado: estTxt(c.estado), campEstDot: c.ec ? COL[c.ec] : '#D5D5D5', campEf: efic(c.ef), campDemas: c.demas || '', campDemasTxt: deMasTxt(c.demas, c.dm, proyN).largo, campDemasCorto: deMasTxt(c.demas, c.dm, proyN).corto,
        campRendLinea: `${!RP ? 'Últimos 180 días' : selR === 'mes' ? (RP.mes.sin ? 'Este mes: sin gasto todavía' : `Este mes (${dm(RP.mes.d)} al ${dm(RP.mes.h)})${RP.mes.n <= 6 ? ` (${RP.mes.n} ${RP.mes.n === 1 ? 'día' : 'días'})` : ''}`) : selR === 'temp' ? `Esta temporada (desde el ${dm(RP.temp.d)})` : `Histórica (desde el ${dm(RP.hist.d)}${RP.hist.antes ? ': hasta ahí llegan los datos' : ''})`} · vs. ${pCorto} = lo normal en el proyecto${H ? ` · ${semEtq} = ${estac ? 'la temporada pasada de esta campaña' : 'esta campaña antes'}` : ''}`,
        campRendOps: RP ? [['mes', 'Este mes'], ['hist', estac && RP.temp ? 'Esta temporada' : 'Histórica']].map(([k, label]) => { const on = (k === 'mes') === (selR === 'mes');
          return { label, bg: on ? '#3C3C3C' : '#FFFFFF', color: on ? '#FFFFFF' : '#3C3C3C', bd: on ? '#3C3C3C' : '#D5D5D5', onClick: () => this.setState({ rendPer: k }) }; }) : [], campHasTag: !!tipoC, campTag: TAG_TIPO[tipoC] || '', campTipos: tipoOps(c.id, c.hist ? c.hist.sug : '', !!c.hist && c.hist.span >= 30).ops,
        campHistTitle: `${c.kpiL} semanal de la campaña`,
        campJuzga: `Objetivo ${c.obj}: se mide por ${mObj.mide}, contra lo normal en ${proyN}${H ? (estac ? ' y contra la temporada pasada de esta campaña' : ' y contra las semanas anteriores de esta campaña') : ''}.`,
        ...(() => { const ll = llegadaTxt(c.llegada), sp = solapanTxt(c.solapan), U = DATA.umbralesLlegada || { llega: 1, riesgo: 1 / 1.2 };
          return { hasLlegOSol: ll.hay || sp.hay, hasLlegada: ll.hay, llegada: ll, hasSolapan: sp.hay, solapan: sp,
            llegAyuda: `Solo Meta. Cuenta impresiones (Alcance), reacciones (Interacción) o clicks (Tráfico y Conversión) desde el 1 del mes o desde que arrancó la campaña, y le suma el ritmo de los últimos 7 días hasta su fecha de fin en DataJunta. Se proyecta desde el día 5 del mes: antes hay pocos días para un ritmo confiable y solo se muestra lo que lleva. Lo compara con lo que conseguiría una campaña normal con la misma plata, al costo habitual del proyecto en el último año; si el proyecto no tiene referencia, no se compara. Va a llegar: ${Math.round(U.llega * 100)} % o más de lo normal. En riesgo: entre ${Math.round(U.riesgo * 100)} % y ${Math.round(U.llega * 100)} %. No va a llegar: menos de ${Math.round(U.riesgo * 100)} %. Solapan público: pares de conjuntos que siguen al aire con audiencias que se pisan (misma zona, una dentro de otra o que se cruzan); es solo una marca.` }; })(), obrasPlats: conLogo(c.plats), spark: sparkView(c.spark),
        openCampPanel: () => openPanelAt(null, c.id), nCampActs: pending.filter((a) => a.campId === c.id || (a.campanas || []).includes(c.id)).length,
        // 06/10: tarjeta de CPM de Alcance (últimos 30 días): un valor por cuenta si corre en varias, nunca combinado ni sumado
        cTiles: [...tilesSel.map(tarjeta), ...(caTile ? [caTile] : [])],
        // historia (01/10): valores grandes y comparaciones cortas, sin párrafos (la frase completa al pasar el mouse)
        histStats: H ? (() => { const mp = metPropia(c.obj), fmt = FMT_TILE[mp] || fCosto, cst = !(MET[mp] || {}).tasa, x = PrC.x, v = PrC.v, sin = x === 'e' || x == null || !(v > 0);
          const linea = sin ? renglon(x === 'e' ? 'poca historia: aparece desde la tercera semana' : `sin ${estac ? 'temporada pasada' : 'semanas anteriores'}`, TXT.gris, luzPropiaC.largo) : lineaTile(v, cst ? v * x : v / x, cst, semEtq, fmt, luzPropiaC.largo);
          return [
            { label: estac ? 'Esta temporada' : 'Últimas dos semanas', val: v > 0 ? fmt(v) : '—', dot: '', lineas: [linea], title: luzPropiaC.largo },
            { label: 'Semanas al aire', val: String(Math.round(H.span / 7)), dot: '', lineas: [], title: '' },
            ...(tipoC === 'constante' ? [{ label: 'Constante', val: `${H.sem52} de 52`, dot: '', lineas: [renglon('semanas con gasto en el último año')], title: '' }] : []),
            ...(H.tendencia != null ? [{ label: 'Tendencia', val: (H.tendencia >= 1 ? '▲ ' : '▼ ') + Math.abs(Math.round((H.tendencia - 1) * 100)) + ' %', dot: '', lineas: [renglon('últimas 4 semanas vs. las 8 anteriores')], title: 'Rendimiento de las últimas 4 semanas contra las 8 anteriores: ▲ mejora, ▼ empeora.' }] : []),
            ...(H.presion != null ? [{ label: 'Presión del último mes', val: n2(H.presion, 1), dot: '', lineas: [renglon('impresiones por habitante')], title: '' }] : []),
            ...(H.presionAcum != null ? [{ label: 'Presión acumulada', val: n2(H.presionAcum, 0), dot: '', lineas: [renglon('impresiones por habitante')], title: '' }] : []),
            ...(estac && H.previa ? [{ label: 'Temporada pasada', val: `desde ${dm(H.previa.desde)}/${H.previa.desde.slice(2, 4)}`, dot: '', lineas: [renglon(`${H.previa.semanasComparadas} semanas comparadas`)], title: '' }] : []),
          ]; })() : [{ label: 'Historia propia', val: 'menos de 30 días', dot: '', lineas: [renglon('todavía no se compara contra sí misma')], title: '' }],
        hist: H ? histView(H, FMT_TILE[metPropia(c.obj)] || fCosto) : { bandY: 0, bandH: 0, medY: -10, bars: [] },
        crendAyuda: `Objetivo ${c.obj}: se mide por ${mObj.mide}; su tarjeta lleva la etiqueta “objetivo”. Arriba se elige qué período suman las tarjetas (Meta; Costo por reproducción, todas las plataformas con reproducciones): “Este mes”, desde el día 1 o desde que arrancó la campaña en el mes hasta el último día con datos, o “${estac ? 'Esta temporada' : 'Histórica'}”, ${estac ? 'desde que la campaña volvió a correr' : 'desde que empezó la campaña (los datos llegan hasta 180 días atrás)'}. Debajo del valor, hasta dos comparaciones: “vs. ${pCorto}” = lo normal en ${proyN} en el último año, con la misma mezcla de objetivo y formato, para el mismo período; “${semEtq}” = en “Este mes”, lo que va del mes contra ${estac ? 'las mismas semanas de la temporada pasada, con la plata llevada a valores de hoy' : 'sus semanas anteriores'}; en “${estac ? 'Esta temporada' : 'Histórica'}”, ${estac ? 'lo que va de esta temporada contra las mismas semanas de la temporada pasada, con la plata llevada a valores de hoy' : 'las dos últimas semanas completas de esta campaña contra sus semanas anteriores (campañas de 30 días o más y constantes, desde la tercera semana)'}. Personas alcanzadas: el dato de Meta de cada cuenta, nunca sumado; en “Este mes”, desde que empezó si la campaña arrancó este mes y, si no, los últimos 7 o 30 días (el más parecido a lo que va del mes); en “${estac ? 'Esta temporada' : 'Histórica'}”, desde que empezó. Entre la referencia y el porcentaje: cuánto más alto (+) o más bajo (−) dio la campaña. Verde o rojo solo con una diferencia grande (el mismo corte del agente: en costos, 20 % más caro o 17 % más barato; en tasas, 17 % más baja o 20 % más alta); gris si es parecido. Al pasar el mouse por cada línea, la frase completa. Anuncios flojos: ${EF_EXPLICA}`,
        campTabs: ['Contenidos', 'Audiencias', 'Activos y placements'].map((tt) => { const on = s.campTab === tt; return { label: tt, color: on ? '#3C3C3C' : '#808080', bd: on ? '#3C3C3C' : 'transparent', onClick: () => this.setState({ campTab: tt }) }; }),
        ctContenidos: s.campTab === 'Contenidos', ctAudiencias: s.campTab === 'Audiencias', ctActivos: s.campTab === 'Activos y placements',
        // Contenidos y Audiencias (01/10): la columna de Métrica de la lista de Campañas (mismo selector); Según objetivo = el KPI del objetivo
        // de la campaña. Segunda comparación: contra toda la campaña (una pieza o una audiencia no tiene semanas anteriores propias)
        contenidos: c.contenidos.map((r) => ({ ...r, gasto: fMs(r.gasto), kc: undefined, kpi: celdaKpi({ kc: kcAmplio(r.kc), obj: c.obj, st: r.st, sm: true }, colDe(c.obj), '', proyN, s.kpiSel === 'obj', contraCampana('Esta pieza')),
          impC: fCant(r.imp), reaC: r.st ? 'no aplica (Stories)' : fCant(r.rea), reaGris: r.st ? '#808080' : '#3C3C3C', ef: efic(r.ef), comp: r.comp == null ? '—' : n2(r.comp, 3) + ' %', ret: r.ret == null ? '—' : r.ret + ' %', retC: r.ret == null ? COL.n : r.ret >= 52 ? COL.g : r.ret < 40 ? COL.r : COL.y,
          senales: r.sen.map((k) => (k === 'c' ? { label: 'se comparte', c: COL.g } : { label: 'genera conversación', c: COL.y })), onPieza: () => verPieza(r.pieza) })),
        audiencias: c.audiencias.map((r) => ({ ...r, kc: undefined, kpi: celdaKpi({ kc: kcAmplio(r.kc), obj: c.obj, st: r.st, sm: true }, colDe(c.obj), '', proyN, s.kpiSel === 'obj', contraCampana('Esta audiencia')),
          impC: fCant(r.imp), reaC: r.st ? 'no aplica (Stories)' : fCant(r.rea), reaGris: r.st ? '#808080' : '#3C3C3C', ef: efic(r.ef) })),
        ctLeyenda: `vs. ${proyN} = lo normal en las campañas de ${proyN}, con el mismo objetivo y formato. vs. la campaña = toda esta campaña en los mismos meses, con el mismo objetivo y formato: dice si esta ${s.campTab === 'Audiencias' ? 'audiencia' : 'pieza'} rinde mejor o peor que el resto de la campaña. Entre paréntesis, el valor de referencia. Rojo con ▲ o ▼ y “peor”, o verde con “mejor”, solo con una diferencia grande; gris si es parecido. Solo Meta, en los meses que trae la campaña (hasta seis).`,
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
    const L = [`# Comentarios sobre Optimización (${hoy})`, '', `Datos al ${dm(DATA.datosHasta)}.`, '', '## Recomendaciones', ''];
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
