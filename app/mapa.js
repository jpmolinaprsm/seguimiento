// ==== Mapa de Estructura (06/10, Juan Pablo eligió A5 de Claude Design; 15/10 pasó a armarse con lo que se toca) ====
// Primera pestaña de Estructura. Va pegado antes de logica.js (armar.js lo concatena): usa las funciones y constantes de logica.js
// (marcaDe, sinPid, KPI_SEL, kpiSelGuardar…) y el estado de la app con el prefijo "mp" (mpPor, mpSel, mpAbre, mpEjeF, mpActF, mpExpZ, mpQ,
// mpQOpen, mpNotice, mpFlash). Los datos salen del período elegido de la propia vista (campRows, pubs, actCods, audCods): no se manda nada
// nuevo a la app. Nunca se muestra ni se suma el alcance: solo gasto, marca y relaciones.
//
// Cómo funciona (pedido de Juan Pablo, 15/10): el mapa no se muestra entero. Arriba, "Empezar por" Activo, Eje o Audiencia (por defecto Eje): al principio
// solo están los nodos de lo elegido, con tamaño por gasto y color por la marca de la Métrica. Al tocar uno se abren, conectadas a él, sus campañas; al tocar
// una campaña, los otros dos tipos (si se empezó por Eje: sus activos y sus audiencias) y sus contenidos. Se pueden abrir varios; tocar un nodo abierto lo
// cierra con lo que colgaba de él. Cada nodo se identifica por su camino (Eje ¦ Campaña ¦ Activo…), porque una misma campaña puede colgar de dos nodos.
// Todo con divs (sin SVG). Decisión (anotada): lo que se abre dentro de un camino solo cuenta lo que corrió en ese camino (su gasto es el de ahí).
const MP_MK = {
  mejor: { c: '#46C678', bg: '#E5F6EC', t: 'Mejor que lo normal' },
  normal: { c: '#FCB942', bg: '#FEF3DC', t: 'Regular' },
  peor: { c: '#F7444C', bg: '#FDE6E7', t: 'Peor que lo normal' },
  sin_referencia: { c: '#A6AAA9', bg: '#F4F4F4', t: 'Sin referencia' },
};
const MP_LET = { B: 'mejor', N: 'normal', M: 'peor', S: 'sin_referencia' };
const MP_TYPE = { e: 'Eje', c: 'Campaña', a: 'Activo (cuenta)', u: 'Audiencia', p: 'Contenido', o: 'Objetivo' };
const MP_POR = [['activo', 'Activo'], ['eje', 'Eje'], ['audiencia', 'Audiencia']];   // Empezar por (por defecto Eje)
const MP_FLD = { eje: 'eje', activo: 'a', audiencia: 'u' };   // campo del registro de cada tipo de arranque
const MP_FLD_LET = { eje: 'e', activo: 'a', audiencia: 'u' };
const MP_PLURAL = { eje: 'Ejes', activo: 'Activos', audiencia: 'Audiencias' };
const MP_SEP = '¦';   // separa los tramos del camino de un nodo (Eje ¦ Campaña ¦ Activo…)
const MP_ORDEN = [['gasto', 'Gasto'], ['nombre', 'Nombre'], ['rinde', 'Cómo rinde']];
const MP_RANGO = { mejor: 0, normal: 1, sin_referencia: 2, peor: 3 };   // de lo que mejor rinde a lo que peor
const MP_META = new Set(['IG', 'FB', 'TH', 'AN', 'MS']);   // redes de Meta: traen cuenta y audiencia; las demás (Google, DV360…) no
const MP_TERM = '#D5D5D5';
const MP_MOV = 'left .4s ease, top .4s ease, width .4s ease, height .4s ease, opacity .2s, background .3s, border-color .3s';   // transición suave al cambiar de agrupación
const MP_RAIZ_MAX = 14;       // nodos de arranque visibles: si hay más, 13 y "+N"
const MP_CAMP_MAX = 10;       // campañas visibles de un nodo abierto: si hay más, 9 y "+N campañas"
// colores suaves (borde, fondo) de los recuadros de eje: no compiten con verde, amarillo y rojo de la marca; cada eje tiene siempre el suyo
const MP_EJE_COL = [['#9DBFE8', '#EEF4FC'], ['#C3B0E6', '#F5F1FC'], ['#8FD0CA', '#ECF8F7'], ['#E6B0D0', '#FCF1F7'], ['#D8C6A8', '#F9F5EE'], ['#A9B4EC', '#F1F3FD'], ['#9AD2E6', '#EBF7FB'], ['#C9CDB4', '#F6F7F0'], ['#E8C4A8', '#FBF3EC'], ['#B8CFE0', '#F0F5F9'], ['#D9B8C4', '#FAF3F6'], ['#E0D3A2', '#FAF7EC']];
const MP_FICHA_W = 232;       // ancho de la ficha de métricas pegada a una burbuja
// tipos que se pueden elegir en "Abrir por:" (en este orden), el campo del registro de cada uno y sus nombres
const MP_KINDS = ['c', 'a', 'e', 'u', 'p'];
const MP_FK = { c: 'c', a: 'a', e: 'eje', u: 'u', p: 'p' };
const MP_KN = { c: ['Campaña', 'Campañas'], a: ['Activo', 'Activos'], e: ['Eje', 'Ejes'], u: ['Audiencia', 'Audiencias'], p: ['Contenidos', 'Contenidos'] };
// Jerarquía (decisión de Juan Pablo, 15/10 y 16/10). Lo que se ofrece en cada columna sale del CAMINO COMPLETO (el tipo de cada columna hasta la actual), no solo del nodo de arriba:
//   - Eje, Activo y Audiencia contienen campañas: se abren por Campaña o por otro de esos tres que no esté en el camino.
//   - Campaña se abre por Contenidos, Activo, Audiencia o Eje (los que no estén en el camino).
//   - Contenidos es siempre una subcategoría de Campaña: se ofrece si hay una Campaña EN CUALQUIER lugar de arriba del camino y Contenidos todavía no está
//     (Eje › Campañas › Audiencias › Contenidos, Activos › Campañas › Audiencias › Contenidos…). Sin Campaña arriba, nunca.
//   - Desde un Contenido se sigue por Audiencia o Activo (si no están en el camino): en qué audiencias y activos corrió.
// Los hijos son siempre los del camino: los registros de cada nodo ya vienen filtrados por todo lo de arriba (Campaña X › Audiencia Y › Contenidos = los contenidos de X que corrieron en Y).
// kinds = el tipo de cada columna hasta la actual (el último es el del nodo); salen en el orden de los botones
const mpValidos = (kinds) => { const ult = kinds[kinds.length - 1]; return MP_KINDS.filter((k) => !kinds.includes(k) && (k === 'p' ? kinds.includes('c') : ult === 'p' ? k === 'a' || k === 'u' : true)); };
const MP_OPC_W = 124;         // lugar de los botones "Abrir por" que salen a la derecha de un nodo
const MP_CORTO = { cr: 'Costo/reacción', cpm: 'CPM', ctr: 'CTR', etrV: 'ETR videos', etrI: 'ETR imág.', cv: 'Costo/repr.', ca: 'CPM alcance' };
// lo que ocupa la pantalla fuera del mapa (encabezado, pasos, pestañas, barra de búsqueda, bordes): el resto es del mapa
const MP_FUERA = 243;
const MP_CACHE = new WeakMap();
// Zoom y desplazamiento (06/10): rueda (o Ctrl + rueda) acerca y aleja desde el cursor; arrastrar el fondo mueve el dibujo; botones +, − y Ajustar.
// La rueda necesita un oyente del documento que pueda frenar el scroll de la página (el de React es pasivo). Todo se apoya en el último mapa dibujado.
let MP_ACTIVO = null, MP_ESCUCHA = false, MP_DRAG = null, MP_MOVIDO = false, MP_T = 0;
function mpRueda(e) {
  const A = MP_ACTIVO; if (!A || typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
  const el = document.getElementById('mapa-zoom'); if (!el || !el.contains(e.target)) return;
  e.preventDefault(); const r = el.getBoundingClientRect();
  A.zoom(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), e.clientX - r.left, e.clientY - r.top);
}
function mpMueve(e) {
  const A = MP_ACTIVO; if (!MP_DRAG || !A) return;
  const dx = e.clientX - MP_DRAG.x0, dy = e.clientY - MP_DRAG.y0; if (!MP_MOVIDO && Math.hypot(dx, dy) < 4) return;
  MP_MOVIDO = true; MP_T = Date.now(); A.mover(MP_DRAG.vx + dx, MP_DRAG.vy + dy);
}
function mpSuelta() { MP_DRAG = null; setTimeout(() => { MP_MOVIDO = false; }, 0); }
const mpEscucha = () => { if (MP_ESCUCHA || typeof document === 'undefined' || typeof document.addEventListener !== 'function') return; MP_ESCUCHA = true; document.addEventListener('wheel', mpRueda, { passive: false }); document.addEventListener('mousemove', mpMueve); document.addEventListener('mouseup', mpSuelta); };
const mpFmt = (v) => { v = v || 0; if (v >= 1e6) { const m = v / 1e6; return '$' + (m >= 100 ? String(Math.round(m)) : m.toFixed(1).replace('.', ',')) + ' M'; } if (v >= 1e3) return '$' + Math.round(v / 1e3) + ' mil'; return '$' + Math.round(v); };
const mpTrunc = (s, n) => { s = s || ''; return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const mpNorm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const mpPl = (n, a, b) => n + ' ' + (n === 1 ? a : b);
const mpArgmax = (w) => { let b = 'sin_referencia', bv = -1; Object.keys(w).forEach((k) => { if (w[k] > bv) { bv = w[k]; b = k; } }); return b; };
const mpColor = (mk) => (MP_MK[mk] ? MP_MK[mk].c : '#D5D5D5');
const mpDot = (c, dashed) => ({ width: 9, height: 9, borderRadius: 999, background: dashed ? '#FFFFFF' : c, border: dashed ? '1px dashed #A6AAA9' : 'none', boxSizing: 'border-box', flex: 'none' });
// de un objeto de estilos a texto (los estilos de los divs del mapa van como texto, como en el diseño)
const mpCss = (o) => Object.keys(o).map((k) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()) + ':' + o[k]).join(';');

// ---- datos: del período de la vista a campañas, contenidos y "registros" (campaña · contenido · activo · audiencia · gasto) ----
// El gasto de cada campaña se reparte entre sus contenidos según lo que gastó cada uno, y el de cada contenido entre sus activos y sus
// audiencias; lo que no tiene cuenta (Google, DV360) queda en "Otras redes". Así activo y audiencia se unen por contenido.
function mpPrep(PD) {
  if (MP_CACHE.has(PD)) return MP_CACHE.get(PD);
  const names = { 'a:otras': 'Otras redes · sin cuenta' }, camps = {}, pieces = {}, byC = {};
  const ejeT = (e) => (!e || /^Sin c[oó]digo/i.test(e) ? 'Sin eje' : e);
  for (const r of PD.campRows || []) {
    const id = 'c:' + r.id, eje = ejeT(r.eje), obj = r.obj || 'Sin objetivo';
    camps[id] = { id, raw: r, nombre: sinPid(r.name || r.id), eje, objetivo: obj, gasto: Math.round(r.gastoN || 0), termino: /^Termin/.test(r.estado || ''), fechas: r.fechas || '', redes: (r.plats || []).map((x) => x.name) };
    names[id] = camps[id].nombre; names['e:' + eje] = eje; names['o:' + obj] = obj;
  }
  const cont = {};
  const K = (com, cod, nombre) => { const cid = 'c:' + com; if (!camps[cid]) return null; const k = com + '|' + cod; return (cont[k] = cont[k] || { cid, nombre, gasto: 0, activos: {}, audiencias: {}, red_sin_cuenta: null }); };
  const suma = (o, k, x) => { const t = (o[k] = o[k] || { i: 0, r: 0, w: 0 }); t.i += x.i || 0; t.r += x.r || 0; t.w += x.vw || 0; };
  for (const x of PD.actCods || []) { const c = K(x.com, x.cod, x.name); if (!c) continue; c.gasto += x.g; c.activos[x.voz] = (c.activos[x.voz] || 0) + x.g; suma(c.ai = c.ai || {}, x.voz, x); }
  for (const x of PD.audCods || []) { const c = K(x.com, x.cod, x.name); if (!c) continue; c.audiencias[x.aud] = (c.audiencias[x.aud] || 0) + x.g; }
  for (const p of PD.pubs || []) if (!MP_META.has(p.code)) { const c = K(p.camp, p.cod, p.name); if (!c) continue; c.gasto += p.gasto; c.red_sin_cuenta = c.red_sin_cuenta || p.red; suma(c.oo = c.oo || {}, 'o', { i: p.imp, r: p.rea, vw: p.vw }); }
  for (const p of PD.pubs || []) { const c = camps['c:' + p.camp]; if (c) c.dias = Math.max(c.dias || 0, p.dias || 0); }
  Object.values(cont).forEach((p, i) => { const id = 'p:' + i; pieces[id] = { ...p, id, v: 0 }; names[id] = p.nombre; (byC[p.cid] = byC[p.cid] || []).push(pieces[id]); });
  const recs = [];
  Object.values(camps).forEach((c) => {
    if (!(c.gasto > 0)) return;
    const base = { c: c.id, eje: 'e:' + c.eje, o: 'o:' + c.objetivo };
    const Pz = (byC[c.id] || []).filter((p) => p.gasto > 0), T = Pz.reduce((s, p) => s + p.gasto, 0);
    if (T <= 0) { recs.push({ ...base, p: null, a: 'a:otras', u: null, v: c.gasto, i: c.raw.imp || 0, r: c.raw.rea || 0, w: c.raw.vw || 0 }); return; }
    Pz.forEach((p) => {
      const f = c.gasto * p.gasto / T; p.v = f;
      const acts = Object.entries(p.activos).filter((x) => x[1] > 0), aS = acts.reduce((s, x) => s + x[1], 0), den = Math.max(aS, p.gasto);
      const auds = Object.entries(p.audiencias).filter((x) => x[1] > 0), uS = auds.reduce((s, x) => s + x[1], 0);
      let used = 0;
      acts.forEach(([a, x]) => {
        const va = f * x / den; used += va; names['a:' + a] = sinPid(a);
        const ai = (p.ai || {})[a] || { i: 0, r: 0, w: 0 };
        if (uS > 0) auds.forEach(([u, y]) => { names['u:' + u] = sinPid(u); const q = y / uS; recs.push({ ...base, p: p.id, a: 'a:' + a, u: 'u:' + u, v: va * q, i: ai.i * q, r: ai.r * q, w: ai.w * q }); });
        else recs.push({ ...base, p: p.id, a: 'a:' + a, u: null, v: va, i: ai.i, r: ai.r, w: ai.w });
      });
      if (f - used > 1) { const oo = (p.oo || {}).o || { i: 0, r: 0, w: 0 }; recs.push({ ...base, p: p.id, a: 'a:otras', u: null, v: f - used, i: oo.i, r: oo.r, w: oo.w }); }
    });
  });
  recs.forEach((r) => { const c = camps[r.c]; if (c) c.iRec = (c.iRec || 0) + (r.i || 0); });
  const uniq = (k) => [...new Set(recs.map((r) => r[k]).filter(Boolean))];
  const out = { names, camps, pieces, byC, recs, ejes: uniq('eje'), acts: uniq('a').filter((a) => a !== 'a:otras'), auds: uniq('u'), objs: uniq('o') };
  MP_CACHE.set(PD, out); return out;
}


class MapaVista {
  constructor(self, s, P) {
    this.self = self; this.P = P; this.s = s;
    const por = MP_POR.some(([k]) => k === s.mpPor) ? s.mpPor : 'eje';
    const orden = MP_ORDEN.some(([k]) => k === s.mpOrden) ? s.mpOrden : 'gasto';
    this.S = { por, orden, sel: s.mpSel || null, abre: s.mpAbre || {}, cols: Array.isArray(s.mpCols) ? s.mpCols : [], menuCol: s.mpMenuCol == null ? null : s.mpMenuCol, fichas: s.mpFichas || {}, expZ: s.mpExpZ || {}, q: s.mpQ || '', qOpen: !!s.mpQOpen, notice: s.mpNotice || '', flash: s.mpFlash || null,
      ejeF: P.ejes.includes(s.mpEjeF) ? s.mpEjeF : '', actF: P.acts.includes(s.mpActF) ? s.mpActF : '' };
    // el tipo de cada columna: la primera es "Empezar por"; las siguientes se eligen una vez y valen para toda la columna
    this.kinds = [MP_FLD_LET[por], ...this.S.cols];
    this.metric = s.kpiSel || 'obj';
    const pe = (typeof DATA !== 'undefined' && DATA.periodos || []).find((x) => x.id === s.period); this.periodoTxt = pe ? pe.label.replace(' (en curso)', '') : '';
  }
  set(u) { const o = {}; for (const k of Object.keys(u)) o['mp' + k[0].toUpperCase() + k.slice(1)] = u[k]; this.self.setState(o); }
  mkOf(c) { return c ? MP_LET[marcaDe(c.raw)] || 'sin_referencia' : 'sin_referencia'; }
  // volver a empezar: todo cerrado y sin filtros; queda lo elegido en "Empezar por"
  reset() { return { ejeF: '', actF: '', sel: null, abre: {}, cols: [], menuCol: null, fichas: {}, expZ: {}, notice: '', q: '', qOpen: false, flash: null }; }
  recsFor(s) { let R = this.P.recs; if (s.ejeF) R = R.filter((r) => r.eje === s.ejeF); if (s.actF) R = R.filter((r) => r.a === s.actF); return R; }

  // nota de 1 a 5 de un conjunto de campañas con "Según objetivo" (igual que Mis proyectos): promedio de la nota de cada campaña ponderado por gasto, redondeado; las que no tienen nota no entran.
  // cg = { campaña: gasto dentro del camino }. rep = cuántas campañas tiene cada nota; sin = campañas sin referencia; n = campañas.
  notaDeCg(cg) {
    let g = 0, sm = 0, n = 0, sin = 0; const rep = {};
    Object.keys(cg).forEach((cid) => { const c = this.P.camps[cid], nt = c && c.raw.nt; n++; if (!(nt >= 1)) { sin++; return; } const w = Math.max(cg[cid], 0) || 0.001; g += w; sm += w * nt; rep[nt] = (rep[nt] || 0) + 1; });
    return { nota: g ? Math.min(5, Math.max(1, Math.round(sm / g))) : null, rep, n, sin };
  }
  cgDe(Rx) { const cg = {}; Rx.forEach((r) => { cg[r.c] = (cg[r.c] || 0) + r.v; }); return cg; }

  // ---- lista ordenada de nodos de un tipo a partir de un conjunto de registros (con su gasto y su marca) ----
  lista(Rx, fld) {
    const P = this.P, m = new Map();
    Rx.forEach((r) => { const id = r[fld]; if (!id) return; let it = m.get(id); if (!it) { it = { id, v: 0, w: {}, cg: {} }; m.set(id, it); } it.v += r.v; it.cg[r.c] = (it.cg[r.c] || 0) + r.v; const mk = this.mkOf(P.camps[r.c]); it.w[mk] = (it.w[mk] || 0) + r.v; });
    const obj = this.metric === 'obj', arr = [...m.values()].map((it) => ({ id: it.id, v: it.v, mk: it.id[0] === 'c' ? this.mkOf(P.camps[it.id]) : mpArgmax(it.w), nt: obj && it.id[0] !== 'c' ? this.notaDeCg(it.cg).nota : null }));
    // orden elegido: Gasto (mayor a menor, el de siempre), Nombre (A–Z) o Cómo rinde (de lo que mejor rinde a lo que peor; a igual marca, el que más gastó)
    const modo = this.S.orden, nom = (id) => P.names[id] || id;
    const porGasto = (a, b) => b.v - a.v || (a.id < b.id ? -1 : 1);
    return arr.sort(modo === 'nombre' ? (a, b) => nom(a.id).localeCompare(nom(b.id), 'es') : modo === 'rinde' ? (a, b) => (MP_RANGO[a.mk] - MP_RANGO[b.mk]) || porGasto(a, b) : porGasto);
  }

  // ---- métrica de un conjunto de registros (para el número de cada burbuja y para su ficha) ----
  // En el primer nivel (campaña entera, o conjunto de campañas): el valor y la referencia de la tabla (conjuntos: ponderados por gasto en costos o por impresiones en tasas).
  // Dentro de un camino (una audiencia dentro de un activo, un contenido…) se calcula para ese nodo en ese camino: costos (costo por reacción, CPM, costo por reproducción)
  // con las sumas del camino; CTR y ETR con los clics o el engagement de cada campaña repartidos por gasto (el mismo reparto de impresiones y reacciones) sobre las
  // impresiones del nodo. Si no hay con qué calcular, queda sin valor ("—"). Nunca se suma alcance: el CPM de Alcance de un conjunto no se calcula.
  metricaDe(Rx, id, depth) {
    const P = this.P, obj = this.metric === 'obj', k = id[0];
    const colDe = (x) => KPI_COLS.find((c) => c.k === x);
    const gT = Rx.reduce((a, r) => a + r.v, 0), iT = Rx.reduce((a, r) => a + (r.i || 0), 0), reT = Rx.reduce((a, r) => a + (r.r || 0), 0), wT = Rx.reduce((a, r) => a + (r.w || 0), 0);
    const porCamp = new Map(); Rx.forEach((r) => { const o = porCamp.get(r.c) || { g: 0, i: 0 }; o.g += r.v; o.i += r.i || 0; porCamp.set(r.c, o); });
    const c0 = k === 'c' ? P.camps[id] : null;
    const completo = depth === 0 || (k === 'c' && gT >= (c0.gasto || 0) * 0.99);   // la campaña entera o un conjunto de primer nivel: valores de la tabla
    let col;
    if (k === 'p') col = obj ? null : colDe(this.metric);
    else if (k === 'c') col = colDe(obj ? KPI_OBJ[c0.raw.obj] || 'cpm' : this.metric);
    else col = obj ? null : colDe(this.metric);
    if (!col) return { col: null, v: null, r: null, motivo: obj ? (k === 'c' ? 'Sin dato en el período' : 'Cada campaña, según su objetivo') : 'Sin métrica para esto' };
    if (col.k === 'ca') {
      if (k === 'c' && completo) { const x = c0.raw.kc && c0.raw.kc.ca; return x && typeof x.v === 'number' ? { col, v: x.v, r: null } : { col, v: null, r: null, motivo: 'Va por cuenta; no se junta' }; }
      return { col, v: null, r: null, motivo: 'El alcance no se suma entre cuentas' };
    }
    const kcDe = (cid) => { const c = P.camps[cid]; return c && c.raw.kc && c.raw.kc[col.k]; };
    // referencia (lo normal del proyecto) de las campañas del nodo: costos por gasto, tasas por impresiones
    let ur = 0, gr = 0, wr = 0, w2 = 0;
    porCamp.forEach((o, cid) => { const x = kcDe(cid); if (!x || !(x.p && x.p.r > 0)) return; if (col.costo) { gr += o.g; ur += o.g / x.p.r; } else { const wt = o.i > 0 ? o.i : o.g; wr += wt * x.p.r; w2 += wt; } });
    const ref = col.costo ? (ur > 0 ? gr / ur : null) : (w2 > 0 ? wr / w2 : null);
    if (completo) {
      if (k === 'c') { const x = kcDe(id); if (!x || typeof x.v !== 'number') return { col, v: null, r: null, motivo: 'Sin dato en el período' }; return { col, v: x.v, r: x.p && x.p.r > 0 ? x.p.r : null }; }
      let u = 0, g = 0, wv = 0, w1 = 0;
      porCamp.forEach((o, cid) => { const x = kcDe(cid); if (!x || !(x.v > 0)) return; if (col.costo) { g += o.g; u += o.g / x.v; } else { const wt = o.i > 0 ? o.i : o.g; wv += wt * x.v; w1 += wt; } });
      const v = col.costo ? (u > 0 ? g / u : null) : (w1 > 0 ? wv / w1 : null);
      return v != null ? { col, v, r: ref } : { col, v: null, r: null, motivo: 'Sin dato en el período' };
    }
    // dentro de un camino: se calcula para este nodo
    let v = null;
    if (col.k === 'cpm') v = iT > 0 ? gT / iT * 1000 : null;
    else if (col.k === 'cr') v = reT > 0 ? gT / reT : null;
    else if (col.k === 'cv') v = wT > 0 ? gT / wT : null;
    else if (['ctr', 'etrV', 'etrI'].includes(col.k)) {   // clics o engagement de cada campaña, repartidos por gasto, sobre las impresiones del nodo
      let num = 0; porCamp.forEach((o, cid) => { const c = P.camps[cid], x = kcDe(cid); if (!c || !x || !(x.v >= 0) || !(c.iRec > 0) || !(c.gasto > 0)) return; num += x.v / 100 * c.iRec * (o.g / c.gasto); });
      v = iT > 0 && num > 0 ? num / iT * 100 : null;
    }
    return v != null && isFinite(v) ? { col, v, r: ref } : { col, v: null, r: null, motivo: 'Sin dato por separado' };
  }

  // ---- el árbol que se ve ----
  // Cada nodo, al tocarlo, muestra "Abrir por:" con los tipos que todavía no están en su camino; el que se elige abre los hijos de ese tipo (cada rama elige el suyo).
  arbol(R, proyN) {
    const P = this.P, S = this.S, rf = MP_FLD[S.por], selP = S.sel || '';
    const cp = (par, id) => (par ? par + MP_SEP + id : id);
    const forzado = (path) => !!selP && (selP === path || selP.startsWith(path + MP_SEP));   // lo que se está mirando nunca queda escondido en un "+N"
    const recorta = (arr, par, key, max) => {
      if (S.expZ[par + '#' + key] || arr.length <= max) return { show: arr, hid: 0 };
      const show = arr.slice(0, max - 1); arr.slice(max - 1).forEach((it) => { if (forzado(cp(par, it.id))) show.push(it); });
      return { show, hid: arr.length - show.length };
    };
    const kinds = this.kinds;
    const nodo = (it, path, depth, Rx, vmax) => {
      const k = it.id[0], c = k === 'c' ? P.camps[it.id] : null, nom = P.names[it.id] || it.id, enCamino = kinds.slice(0, depth + 1);
      const opts = mpValidos(enCamino), hijoK = S.cols[depth], open = !!S.abre[path] && hijoK !== undefined && opts.includes(hijoK), exp = opts.length > 0;
      const ntInfo = this.metric === 'obj' && k !== 'c' ? this.notaDeCg(this.cgDe(Rx)) : null;   // con "Según objetivo", un conjunto se mide por la nota de sus campañas
      const met = this.metricaDe(Rx, it.id, depth);
      const num = met && met.v != null ? `${MP_CORTO[met.col.k]} ${met.col.fmt(met.v)}` : mpFmt(it.v);
      const txt = mpTrunc(nom, 22) + ' · ' + num;
      const ficha = !!S.fichas[path], elige = exp && !open && S.sel === path && hijoK === undefined;
      const n = { t: 'n', path, id: it.id, k, depth, v: it.v, mk: it.mk, r: depth >= 2 ? 4 + 4 * Math.sqrt(it.v / Math.max(vmax, 1)) : 5 + 8 * Math.sqrt(it.v / Math.max(vmax, 1)), nt: ntInfo ? ntInfo.nota : null, objSet: !!ntInfo, name: nom, txt, lw: txt.length * 6.9 + 4, term: !!(c && c.termino), exp, open, kids: [], info: true, ficha, elige, opts, hijoK: open ? hijoK : null };
      if (ficha) { n.fl = this.ficha(Rx, it, met, c, nom, ntInfo); n.fh = n.fl.alto; }
      n.ex = n.fh ? n.fh + 8 : 0;
      if (!open) return n;
      const fld = MP_FK[hijoK], arr = this.lista(Rx, fld), plural = MP_KN[hijoK][1];
      if (!arr.length) { n.kids.push({ t: 'cap', path: path + '#vacio', label: 'Sin ' + plural.toLowerCase(), w: 130 }); return n; }
      const { show, hid } = recorta(arr, path, hijoK, MP_CAMP_MAX), vm = Math.max(1, ...show.map((x) => x.v));
      const hijo = (x) => nodo(x, cp(path, x.id), depth + 1, Rx.filter((r) => r[fld] === x.id), vm);
      if (hijoK === 'c' && !enCamino.includes('e')) {
        // el eje es un criterio para ordenar campañas: un recuadro por eje, con su color fijo (solo si el eje todavía no está en el camino)
        const grupos = new Map(); show.forEach((x) => { const e = 'e:' + P.camps[x.id].eje; if (!grupos.has(e)) grupos.set(e, []); grupos.get(e).push(x); });
        grupos.forEach((xs, e) => { const col = this.colorEje(e); n.kids.push({ t: 'cap', eje: e, path: path + '#eje' + e, label: mpTrunc(P.names[e] || e, 28), col, w: Math.min(28, (P.names[e] || e).length) * 7.2 + 14 }); xs.forEach((x) => n.kids.push(hijo(x))); });
      } else show.forEach((x) => n.kids.push(hijo(x)));
      if (hid) n.kids.push({ t: 'pill', path: path + '#' + hijoK, par: path, key: path + '#' + hijoK, n: hid, txt: `+${hid} ${plural.toLowerCase()}`, w: 104 });
      return n;
    };
    const todos = this.lista(R, rf), { show, hid } = recorta(todos, '', 'raiz', MP_RAIZ_MAX), vm = Math.max(1, ...show.map((x) => x.v));
    const raices = show.map((x) => nodo(x, x.id, 0, R.filter((r) => r[rf] === x.id), vm));
    if (hid) raices.push({ t: 'pill', path: '#raiz', par: '', key: '#raiz', n: hid, txt: `+${hid} ${MP_PLURAL[S.por].toLowerCase()}`, w: 104 });
    return { raices, todos };
  }
  // color fijo de cada eje en todo el mapa (borde y fondo suaves)
  colorEje(e) { const i = this.P.ejes.indexOf(e); return e === 'e:Sin eje' || i < 0 ? ['#C8C8C8', '#F6F6F6'] : MP_EJE_COL[i % MP_EJE_COL.length]; }
  // la ficha de métricas pegada a una burbuja: la métrica elegida con la marca y su comparación, y debajo gasto, impresiones, reacciones y (campañas) días al aire
  ficha(Rx, it, met, c, nom, ntInfo) {
    const g = Rx.reduce((a, r) => a + r.v, 0), i = Rx.reduce((a, r) => a + (r.i || 0), 0), re = Rx.reduce((a, r) => a + (r.r || 0), 0);
    const minis = [{ lab: 'Gasto', val: mpFmt(g) }, { lab: 'Impr.', val: fCant(i) }, { lab: 'Reacc.', val: fCant(re) }];
    if (c) minis.push({ lab: 'Al aire', val: c.dias ? mpPl(c.dias, 'día', 'días') : '—' });
    const mm = MP_MK[it.mk] || MP_MK.sin_referencia, marcaTxt = { mejor: 'Bueno', normal: 'Regular', peor: 'Malo' }[it.mk] || 'Sin referencia';
    let pillBgN = null;
    let metLab = 'Métrica', metVal = '—', pill = '', motivo = (met && met.motivo) || 'Sin métrica para esto';
    if (met && met.col) {
      metLab = met.col.label;
      if (met.v != null) {
        metVal = met.col.fmt(met.v); motivo = '';
        if (met.r != null) { const p = Math.round(Math.abs(met.v / met.r - 1) * 100); pill = `${marcaTxt} · ${p === 0 ? '' : met.v > met.r ? '+' : '−'}${p} % vs. ${this.proyN}`; }
        else pill = marcaTxt === 'Sin referencia' ? 'Sin referencia' : marcaTxt;
      }
    }
    const tipo = { e: 'Eje', c: 'Campaña', a: 'Activo', u: 'Audiencia', p: 'Contenido' }[it.id[0]] || '';
    // "Según objetivo" en un conjunto: la nota de 1 a 5 (Rendimiento) con su píldora y, debajo, el reparto de sus campañas
    let sub2 = '', marcaColor = mm.c;
    if (ntInfo) {
      const NT = typeof NOTA !== 'undefined' ? NOTA : { 5: ['Muy bueno', '#1F8A4C', '#D6EEDF'], 4: ['Bueno', '#46C678', '#E5F6EC'], 3: ['Regular', '#FCB942', '#FEF3DC'], 2: ['Malo', '#F7444C', '#FDE6E7'], 1: ['Muy malo', '#B3141B', '#F6D3D5'] };
      metLab = 'Rendimiento'; motivo = '';
      const partesR = [5, 4, 3, 2, 1].filter((x) => ntInfo.rep[x]).map((x) => ntInfo.rep[x] + ' ' + NT[x][0]); if (ntInfo.sin) partesR.push(ntInfo.sin + ' sin referencia');
      if (ntInfo.nota) { metVal = String(ntInfo.nota); pill = NT[ntInfo.nota][0]; pillBgN = NT[ntInfo.nota][2]; marcaColor = NT[ntInfo.nota][1]; sub2 = mpPl(ntInfo.n, 'campaña', 'campañas') + ': ' + partesR.join(' · '); }
      else { metVal = '—'; pill = 'Sin referencia'; pillBgN = '#F4F4F4'; marcaColor = '#A6AAA9'; sub2 = mpPl(ntInfo.n, 'campaña sin referencia', 'campañas sin referencia'); }
    }
    const nota = '';
    return { titulo: mpTrunc(nom, 24), sub: tipo + ' · ' + this.periodoTxt, minis, metLab, metVal, pill, hayPill: !!pill, pillBg: pill ? (pillBgN || mm.bg) : 'transparent', motivo, hayMotivo: !!motivo, nota, hayNota: !!nota, sub2, haySub2: !!sub2, sub2Alto: sub2.length > 34 ? 28 : 14, marcaColor, alto: 161 + (sub2 ? (sub2.length > 34 ? 30 : 16) : 0) };
  }

  // ---- disposición: columnas de izquierda a derecha (un nivel por columna); cada nodo abierto reparte sus hijos a su derecha; el selector "Abrir por" y la ficha ocupan su lugar debajo del nodo ----
  layout(raices) {
    const hOf = (it) => (it.t === 'cap' ? 16 : it.t === 'pill' ? 21 : it.depth >= 2 ? Math.max(2 * it.r + 4, 19) : Math.max(2 * it.r + 8, 24));
    const sub = (it) => {
      const h = hOf(it), ex = it.ex || 0;
      if (!it.kids || !it.kids.length) return h + ex;
      const ks = it.kids.reduce((s, k) => s + sub(k), 0);
      return ex ? Math.max(ks, ks / 2 + h / 2 + ex + 14) : Math.max(h, ks);
    };
    const colW = [];
    const medir = (it, d) => { it.d = d; const w = it.t === 'n' ? 14 + it.r + 24 + it.lw + (it.exp ? 16 : 0) : it.w; colW[d] = Math.max(colW[d] || 0, w, it.fh ? 14 + it.r + 27 + MP_FICHA_W : 0); if (it.elige) colW[d + 1] = Math.max(colW[d + 1] || 0, MP_OPC_W); (it.kids || []).forEach((k) => medir(k, d + 1)); };
    raices.forEach((r) => medir(r, 0));
    const colX = []; let x = 12; colW.forEach((w, d) => { colX[d] = x; x += w + 52; });
    const W = Math.max(x - 52 + 12, 200);
    const todos = [];
    const poner = (it, y0) => {
      const S = sub(it), h = hOf(it); todos.push(it); it.y0 = y0; it.S = S;
      if (it.kids && it.kids.length) {
        const ks = it.kids.reduce((s, k) => s + sub(k), 0); let y = it.ex ? y0 : y0 + (S - ks) / 2; const cys = [];
        it.kids.forEach((k) => { poner(k, y); y += sub(k); if (k.t === 'n') cys.push(k.cy); });
        it.cy = cys.length ? (cys[0] + cys[cys.length - 1]) / 2 : y0 + h / 2;
      } else it.cy = y0 + h / 2;
      it.cx = colX[it.d] + 14; it.h = h;
    };
    let y = 32; raices.forEach((r) => { poner(r, y); y += sub(r); });   // arriba queda la fila de encabezados de columna
    // recuadros de eje: cubren las campañas de cada eje (de su rótulo a la última campaña, con lo que ocupa su fila)
    const cajas = [];
    todos.forEach((it) => { if (!it.kids) return; it.kids.forEach((k, i) => { if (k.t !== 'cap' || !k.eje) return; let ult = k; for (let j = i + 1; j < it.kids.length && it.kids[j].t === 'n'; j++) ult = it.kids[j];
      cajas.push({ eje: k.eje, col: k.col, x: colX[k.d] - 8, y: k.y0 - 3, w: colW[k.d] + 16, h: ult.y0 + sub(ult) - k.y0 + 6 }); }); });
    // botones "Abrir por" (hijos fantasma): a la derecha del nodo, centrados en su altura; no ocupan lugar entre los hermanos
    const opciones = []; let H = y + 8;
    todos.forEach((it) => { if (it.t !== 'n' || !it.elige) return; const m = it.opts.length; let top = Math.max(30, it.cy - m * 24 / 2 + 1); H = Math.max(H, top + m * 24 + 6);
      it.opts.forEach((k, i) => opciones.push({ n: it, k, x: colX[it.d + 1] + 6, y: top + i * 24 + 11 })); });
    return { W, H, todos, cajas, opciones, colX, colW };
  }

  // ---- información de cada nodo (para el panel y los totales) ----
  info(R, id) {
    const P = this.P, t = id[0];
    const f = t === 'c' ? (r) => r.c === id : t === 'e' ? (r) => r.eje === id : t === 'a' ? (r) => r.a === id : t === 'u' ? (r) => r.u === id : (r) => r.p === id;
    const mr = R.filter(f), w = {}; let v = 0;
    mr.forEach((r) => { v += r.v; const mk = this.mkOf(P.camps[r.c]); w[mk] = (w[mk] || 0) + r.v; });
    return { id, name: P.names[id] || id, v, mk: t === 'c' ? this.mkOf(P.camps[id]) : mpArgmax(w), mr };
  }
  // los registros de un camino (cada tramo achica: eje › campaña › activo…)
  recsDe(R, segs) {
    const f = (s) => { const t = s[0]; return t === 'c' ? (r) => r.c === s : t === 'e' ? (r) => r.eje === s : t === 'a' ? (r) => r.a === s : t === 'u' ? (r) => r.u === s : (r) => r.p === s; };
    return segs.reduce((Rx, s) => Rx.filter(f(s)), R);
  }

  // ---- interacción ----
  // tocar un nodo: si es de una columna cuyo tipo ya se eligió, se abre directo con ese tipo; si no, aparecen los botones "Abrir por" (volver a tocarlo los esconde);
  // tocar uno abierto lo cierra con todo lo que colgaba de él
  tap(path) {
    const S = this.S, depth = path.split(MP_SEP).length - 1;
    if (S.abre[path]) { const abre = { ...S.abre }; Object.keys(abre).forEach((k) => { if (k === path || k.startsWith(path + MP_SEP)) delete abre[k]; }); this.set({ abre, sel: null, notice: '', menuCol: null }); return; }
    const opts = mpValidos(this.kinds.slice(0, depth + 1)), hijoK = S.cols[depth];
    if (hijoK !== undefined && opts.includes(hijoK)) this.set({ abre: { ...S.abre, [path]: true }, sel: path, notice: '', menuCol: null });
    else this.set({ sel: S.sel === path ? null : path, menuCol: null });
  }
  // elegir el tipo de toda la columna siguiente (primera vez que se abre un nodo de la columna)
  elegir(path, k) { const depth = path.split(MP_SEP).length - 1; this.set({ cols: [...this.S.cols.slice(0, depth), k], abre: { ...this.S.abre, [path]: true }, sel: path, notice: '', menuCol: null }); }
  // el encabezado de una columna: cambia el tipo de toda la columna a la vez; se cierran las columnas de más a la derecha (podrían quedar inválidas)
  cambiarCol(j, k) {
    const S = this.S;
    if (j === 0) { this.set({ por: { e: 'eje', a: 'activo', u: 'audiencia' }[k], sel: null, abre: {}, cols: [], fichas: {}, expZ: {}, notice: '', flash: null, menuCol: null }); return; }
    const abre = { ...S.abre }; Object.keys(abre).forEach((p) => { if (p.split(MP_SEP).length >= j + 1) delete abre[p]; });
    const sel = S.sel && S.sel.split(MP_SEP).length >= j + 1 ? null : S.sel;
    this.set({ cols: [...S.cols.slice(0, j - 1), k], abre, sel, notice: '', menuCol: null });
  }
  tapFn(path) { return (e) => { if (e && e.stopPropagation) e.stopPropagation(); if (MP_MOVIDO) return; this.tap(path); }; }
  pillFn(key) { return (e) => { if (e && e.stopPropagation) e.stopPropagation(); if (MP_MOVIDO) return; this.set({ expZ: { ...this.S.expZ, [key]: true } }); }; }
  // ---- zoom y desplazamiento ----
  vistaActual() { const d = this.dim, v = this.s.mpView; return v && d && v.sig === d.sig ? v : (d ? { sig: d.sig, k: d.k0, x: d.x0, y: d.y0 } : null); }
  fijar(v) { const d = this.dim; if (!d) return; const k = v.k;
    // el dibujo no se puede ir del todo: queda siempre un pedazo a la vista
    const x = Math.min(d.vw - 70, Math.max(70 - d.W * k, v.x)), y = Math.min(d.vh - 50, Math.max(50 - d.H * k, v.y));
    this.self.setState({ mpView: { sig: d.sig, k, x, y } }); }
  zoom(f, mx, my) { const d = this.dim, v = this.vistaActual(); if (!d || !v) return; if (mx == null) { mx = d.vw / 2; my = d.vh / 2; }
    const k = Math.min(d.k0 * 6, Math.max(d.k0 * 0.5, v.k * f)), real = k / v.k; MP_T = Date.now();
    this.fijar({ k, x: mx - (mx - v.x) * real, y: my - (my - v.y) * real }); }
  mover(x, y) { const v = this.vistaActual(); if (v) this.fijar({ k: v.k, x, y }); }
  ajustar() { this.self.setState({ mpView: null }); }
  destello(path) {
    this.set({ flash: { id: path, k: Date.now() } });
    if (typeof setTimeout !== 'function') return;
    clearTimeout(this.self.mpFt); this.self.mpFt = setTimeout(() => this.set({ flash: null }), 3000);
  }
  // ¿dónde está? Se abre el camino desde lo elegido en "Empezar por" hasta el nodo y se lo deja elegido. Si hay un filtro que lo esconde, se saca.
  locate(id) {
    const P = this.P, S = this.S, t = id[0], rk = MP_FLD[S.por];
    const match = (r) => (t === 'e' ? r.eje === id : t === 'c' ? r.c === id : t === 'a' ? r.a === id : t === 'u' ? r.u === id : r.p === id);
    let ejeF = S.ejeF, actF = S.actF; const msgs = [];
    const ok = (E, A) => P.recs.some((r) => match(r) && (!E || r.eje === E) && (!A || r.a === A));
    if (!ok(ejeF, actF)) {
      if (ejeF && ok('', actF)) { msgs.push('el filtro de eje'); ejeF = ''; }
      else if (actF && ok(ejeF, '')) { msgs.push('el filtro de activo'); actF = ''; }
      else { if (ejeF) msgs.push('el filtro de eje'); if (actF) msgs.push('el filtro de activo'); ejeF = ''; actF = ''; }
    }
    const R = this.recsFor({ ejeF, actF }).filter(match);
    // el camino con más gasto que llega al nodo: por quién se empezó › campaña › el nodo
    const mejor = (clave) => { const m = new Map(); R.forEach((r) => { const k = clave(r); if (k) m.set(k, (m.get(k) || 0) + r.v); }); return [...m].sort((a, b) => b[1] - a[1])[0]; };
    let segs;
    if (t === 'e' && S.por !== 'eje') { const b = mejor((r) => (r[rk] ? r[rk] + MP_SEP + r.c : null)); segs = b ? b[0].split(MP_SEP) : null; }   // el eje es un recuadro: se ubica su campaña con más gasto
    else if (t === MP_FLD_LET[S.por]) segs = [id];
    else if (t === 'c') { const b = mejor((r) => r[rk]); segs = b ? [b[0], id] : null; }
    else { const b = mejor((r) => (r[rk] ? r[rk] + MP_SEP + r.c : null)); segs = b ? [...b[0].split(MP_SEP), id] : null; }
    if (!segs) { this.set({ notice: `«${P.names[id] || id}» no aparece con lo elegido en este período.`, q: '', qOpen: false }); return; }
    // el camino fija el tipo de cada columna (Eje › Campaña › Contenidos…); si ya coincide con lo que está abierto se suma, si no se arma de nuevo
    const path = segs.join(MP_SEP), chain = segs.slice(1).map((x) => x[0]), coincide = chain.every((k, i) => S.cols[i] === k);
    const cols = coincide ? S.cols : chain, abre = coincide ? { ...S.abre } : {};
    segs.slice(0, -1).forEach((_, i) => { abre[segs.slice(0, i + 1).join(MP_SEP)] = true; });
    const aviso = msgs.map((m) => m.replace(/^el /, ''));
    this.set({ sel: path, abre, cols, menuCol: null, ejeF, actF, q: '', qOpen: false, notice: aviso.length ? `Se sacó ${aviso.join(' y ')} para mostrar «${P.names[id]}».` : '' });
    this.destello(path);
  }
  goTo(id) { this.locate(id); }

  // ---- panel lateral ----
  panel(R, segs) {
    const P = this.P, sel = segs[segs.length - 1], t = sel[0], n = this.info(R, sel), metLabel = (KPI_SEL.find((m) => m[0] === this.metric) || [])[1] || '';
    const mr = n.mr;
    const agg = (f) => { const m = new Map(); mr.forEach((r) => { const k = f(r); if (k == null) return; m.set(k, (m.get(k) || 0) + r.v); }); return [...m].sort((a, b) => b[1] - a[1]); };
    const colorId = (id) => { if (id.startsWith('c:')) { const c = P.camps[id]; return c.termino ? MP_TERM : mpColor(this.mkOf(c)); } if (id.startsWith('p:')) return '#BFC3C2'; return mpColor(this.info(R, id).mk); };
    const item = ([id, v]) => ({ name: P.names[id] || id, val: mpFmt(v), dot: mpDot(colorId(id), id === 'a:otras'), onClick: () => this.goTo(id) });
    const A = (r) => r.a, U = (r) => r.u, C = (r) => r.c, E = (r) => r.eje, Pp = (r) => r.p;
    const defs = { e: [['Campañas', C], ['Activos (cuentas)', A], ['Audiencias', U]], c: [['Eje', E], ['Activos (cuentas)', A], ['Audiencias', U], ['Contenidos', Pp]],
      a: sel === 'a:otras' ? [['Campañas', C], ['Contenidos', Pp]] : [['Campañas', C], ['Audiencias', U]], u: [['Campañas', C], ['Activos (cuentas)', A]], p: [['Campaña', C], ['Activos (cuentas)', A], ['Audiencias', U]] }[t];
    const nouns = { 'Campañas': ['campaña', 'campañas'], 'Campaña': ['campaña', 'campañas'], 'Activos (cuentas)': ['activo', 'activos'], 'Audiencias': ['audiencia', 'audiencias'], 'Contenidos': ['contenido', 'contenidos'] };
    const secs = [], conn = [];
    defs.forEach(([title, f]) => {
      const arr = agg(f);
      if (title === 'Activos (cuentas)') conn.push(mpPl(arr.filter((x) => x[0] !== 'a:otras').length, 'activo', 'activos'));
      else if (nouns[title]) conn.push(mpPl(arr.length, nouns[title][0], nouns[title][1]));
      if (arr.length) secs.push({ title, items: arr.map(item) });
    });
    const c = t === 'c' ? P.camps[sel] : null;
    let mk, mkText, mkSub;
    if (sel === 'a:otras') { mk = 'sin_referencia'; mkText = 'Sin marca'; mkSub = 'Google, DV360 y otras redes no informan cuenta ni audiencia.'; }
    else if (t === 'c') { mk = this.mkOf(c); mkText = MP_MK[mk].t; mkSub = this.metric === 'obj' ? `Según su objetivo (${c.objetivo}).` : `Según ${metLabel}.`; }
    else if (t === 'p') { mk = 'sin_referencia'; mkText = 'Sin marca propia'; mkSub = 'El color se calcula por campaña, no por contenido.'; }
    else { mk = n.mk; mkText = MP_MK[mk] ? MP_MK[mk].t : 'Sin referencia'; mkSub = `Es la marca de la mayor parte de su gasto, sumando lo que gastó cada campaña (${this.metric === 'obj' ? 'según el objetivo de cada una' : 'según ' + metLabel}).`; }
    const mkc = MP_MK[mk] || MP_MK.sin_referencia;
    const otrasV = mr.filter((r) => r.a === 'a:otras').reduce((s, r) => s + r.v, 0);
    let otras = '';
    if ((t === 'c' || t === 'e') && otrasV > 0) {
      const noDet = mr.every((r) => !r.p);
      if (noDet && t === 'c') otras = 'No hay detalle por cuenta ni audiencia para esta campaña en el período: todo su gasto queda en la campaña.';
      else { const redes = [...new Set(mr.filter((r) => r.a === 'a:otras' && r.p).map((r) => P.pieces[r.p].red_sin_cuenta).filter(Boolean))]; otras = `${mpFmt(otrasV)} de este gasto corrió en redes que no informan cuenta ni audiencia${redes.length ? ' (' + redes.join(', ') + ')' : ''}.`; }
    }
    const tabFor = { e: 'ejes', a: 'activos', u: 'audiencias' };
    const filtered = this.S.ejeF || this.S.actF, previos = segs.slice(0, -1);
    const nota = previos.length ? 'Solo lo que corrió en ' + previos.map((x) => P.names[x] || x).join(' › ') : 'Con los filtros aplicados';
    return {
      type: sel === 'a:otras' ? 'Otras redes' : MP_TYPE[t], name: n.name,
      hasStatus: !!c, status: c ? `${c.termino ? 'Terminó' : 'Activa'} · ${c.fechas} · Objetivo: ${c.objetivo}` : '', redes: c ? 'Redes: ' + (c.redes || []).join(', ') : '',
      gasto: mpFmt(n.v), hasGastoNote: !!filtered || previos.length > 0, gastoNote: nota,
      mkBox: { display: 'flex', gap: 10, alignItems: 'flex-start', background: mkc.bg, borderRadius: 12, padding: '10px 12px' }, mkDot: { width: 10, height: 10, borderRadius: 999, background: mkc.c, flex: 'none', marginTop: 4 },
      mkText, mkSub, hasOtras: !!otras, otras, conn: conn.join(' · '), secs,
      // campañas abren su ficha (Detalle); activos, ejes y audiencias, su tabla de Estructura con el nombre puesto; contenidos y "otras redes" no tienen
      canOpen: false, onOpen: () => {}, canDetalle: !!c || !!tabFor[t], detalleTxt: c ? 'Ver en Detalle' : 'Ver en la tabla',
      onDetalle: () => { if (c) this.self.irCampana(c.raw.id); else if (tabFor[t]) this.self.setState({ paso: 'estructura', tab: tabFor[t], busca: P.names[sel], abierto: {} }); },
    };
  }

  // ---- todo lo que usa el markup ----
  vals(proyNombre, deMes) {
    const P = this.P, S = this.S, s = this.s;
    const empty = !P.recs.length;
    const R = this.recsFor(S);
    this.proyN = proyNombre;
    const { raices, todos: todasRaices } = this.arbol(R, proyNombre);
    const hayMapa = !!raices.length;
    const L = hayMapa ? this.layout(raices) : null;
    const availW = Math.max(600, Math.min(s.w || 1600, 1600) - 48 - 376 - 32 - 6), rowH = Math.max(360, (s.hv || 900) - MP_FUERA), availH0 = rowH - 68 - 26;   // el título, las migas, la leyenda de abajo y los bordes ocupan el resto: así no aparece scroll
    const hayLeyEjes = !!(L && L.cajas.length), availH = availH0 - (hayLeyEjes ? 24 : 0);   // con recuadros de eje, la leyenda de colores de eje ocupa otra línea abajo
    const esc = L ? Math.max(0.5, Math.min(1.4, availW / L.W, availH / L.H)) : 1;   // los árboles chicos se agrandan un poco (hasta 40 %) para que se lean; los grandes se achican hasta la mitad y se mueven con el zoom
    // el recuadro donde se ve el mapa mide lo que hay disponible; el dibujo se ajusta adentro y se puede acercar, alejar y mover
    const vw = Math.round(availW), vh = Math.round(availH);
    const sig = L ? [S.por, S.orden, S.cols.join(''), L.todos.map((n) => n.path + (n.ex || 0) + (n.elige ? 'o' : '')).join('~')].join('#') : '';
    this.dim = L ? { sig, W: L.W, H: L.H, k0: esc, x0: Math.max(8, (vw - L.W * esc) / 2), y0: Math.max(8, (vh - L.H * esc) / 2), vw, vh } : null;
    const vista = this.vistaActual();
    MP_ACTIVO = this; mpEscucha();
    const byPath = new Map(); if (L) L.todos.forEach((n) => { if (n.t === 'n') byPath.set(n.path, n); });
    const sel = S.sel && byPath.has(S.sel) ? S.sel : null, selSegs = sel ? sel.split(MP_SEP) : [];
    const enCamino = (p) => !!sel && (sel === p || sel.startsWith(p + MP_SEP));
    const edges = [], hlEdges = [], dots = [], labels = [], infos = [], flechas = [], fichas = [], opciones = [], fantasmas = [], cajas = [], geo = {};
    if (L) {
      const linea = (p, q, color, grosor) => { const dx = q[0] - p[0], dy = q[1] - p[1]; return mpCss({ position: 'absolute', left: p[0].toFixed(1) + 'px', top: p[1].toFixed(1) + 'px', width: Math.sqrt(dx * dx + dy * dy).toFixed(1) + 'px', height: grosor + 'px', background: color, 'transform-origin': '0 0', transform: `rotate(${Math.atan2(dy, dx).toFixed(4)}rad)`, 'pointer-events': 'none', transition: 'opacity .2s' }); };
      L.todos.forEach((n) => {
        if (n.t === 'cap') { labels.push({ style: mpCss({ position: 'absolute', top: (n.cy - 8) + 'px', left: (n.cx - 10) + 'px', 'font-size': '10.5px', 'font-weight': 600, 'line-height': '16px', 'letter-spacing': '.04em', 'text-transform': 'uppercase', 'white-space': 'nowrap', color: '#808080', 'pointer-events': 'none' }), onClick: () => {}, label: n.label, title: n.label }); return; }
        if (n.t === 'pill') { dots.push({ style: mpCss({ position: 'absolute', left: (n.cx - 10) + 'px', top: (n.cy - 11) + 'px', width: n.w + 'px', height: '22px', 'border-radius': '11px', background: '#EDEDED', border: '1px dashed #A6AAA9', 'box-sizing': 'border-box', 'font-size': '11px', 'font-weight': 500, color: '#3C3C3C', 'text-align': 'center', 'line-height': '20px', cursor: 'pointer' }), onClick: this.pillFn(n.key), label: n.txt, title: 'Ver todos' }); return; }
        const esSel = n.path === sel, term = n.term, otra = n.id === 'a:otras';
        if (n.exp) flechas.push({ style: mpCss({ position: 'absolute', left: (n.cx + n.r + 24 + n.lw) + 'px', top: (n.cy - 9) + 'px', width: '14px', height: '18px', 'text-align': 'center', 'font-size': '15px', 'line-height': '17px', 'font-weight': 600, color: n.open || esSel ? '#3C3C3C' : '#A6AAA9', transform: n.open ? 'rotate(90deg)' : 'none', transition: 'transform .15s ease, color .15s ease', cursor: 'pointer' }), label: '›', abierta: n.open, title: n.open ? 'Cerrar' : 'Abrir por…', onClick: this.tapFn(n.path) });
        if (n.info) infos.push({ style: mpCss({ position: 'absolute', left: (n.cx + n.r + 4) + 'px', top: (n.cy - 8) + 'px', width: '16px', height: '16px', 'border-radius': '50%', border: '1px solid ' + (n.ficha ? '#3C3C3C' : '#A6AAA9'), background: n.ficha ? '#3C3C3C' : '#FFFFFF', color: n.ficha ? '#FFFFFF' : '#808080', 'font-size': '10px', 'font-weight': 700, 'font-style': 'italic', 'text-align': 'center', 'line-height': '14px', 'box-sizing': 'border-box', cursor: 'pointer' }), onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); if (MP_MOVIDO) return; this.set({ fichas: { ...S.fichas, [n.path]: !S.fichas[n.path] } }); }, label: 'i', title: n.ficha ? 'Cerrar las métricas' : 'Ver métricas' });
        if (n.ficha) fichas.push({ style: mpCss({ position: 'absolute', left: (n.cx + n.r + 27) + 'px', top: (n.cy + n.h / 2 + 4) + 'px', width: MP_FICHA_W + 'px', height: n.fl.alto + 'px', 'box-sizing': 'border-box', background: '#FFFFFF', border: '1px solid #E4E4E4', 'border-radius': '10px', 'box-shadow': '0 1px 6px rgba(0,0,0,0.08)', padding: '12px', color: '#3C3C3C', cursor: 'default', 'z-index': 2 }), titulo: n.fl.titulo, sub: n.fl.sub, minis: n.fl.minis, sub2: n.fl.sub2, haySub2: n.fl.haySub2, sub2Style: mpCss({ 'font-size': '10.5px', 'line-height': '14px', color: '#808080', height: n.fl.sub2Alto + 'px', overflow: 'hidden', 'white-space': 'normal' }), metLab: n.fl.metLab, metVal: n.fl.metVal, pill: n.fl.pill, hayPill: n.fl.hayPill, pillStyle: mpCss({ 'font-size': '10px', padding: '2px 8px', 'border-radius': '999px', background: n.fl.pillBg, color: '#3C3C3C', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis', 'min-width': 0, 'line-height': '14px' }), motivo: n.fl.motivo, hayMotivo: n.fl.hayMotivo, nota: n.fl.nota, hayNota: n.fl.hayNota, marcaDot: mpCss({ width: '8px', height: '8px', 'border-radius': '999px', background: n.fl.marcaColor, flex: 'none' }), miniCols: 'repeat(' + n.fl.minis.length + ',1fr)', alto: n.fl.alto, onStop: (e) => { if (e && e.stopPropagation) e.stopPropagation(); }, onClose: (e) => { if (e && e.stopPropagation) e.stopPropagation(); this.set({ fichas: { ...S.fichas, [n.path]: false } }); } });
        const NT0 = typeof NOTA !== 'undefined' ? NOTA : null, fill = n.objSet && NT0 ? (n.nt ? NT0[n.nt][1] : '#A6AAA9') : n.k === 'p' ? '#BFC3C2' : term ? MP_TERM : mpColor(n.mk);
        const forma = n.k === 'c' ? { 'border-radius': '50%', border: '0' } : n.k === 'e' ? { 'border-radius': '50%', border: '2.5px solid #3C3C3C' } : n.k === 'a' ? (otra ? { 'border-radius': '4px', border: '2px dashed #3C3C3C' } : { 'border-radius': '4px', border: '0' }) : n.k === 'u' ? { 'border-radius': '50%', border: '2px dashed #3C3C3C' } : { 'border-radius': '2px', border: '0', transform: 'rotate(45deg)' };
        const rr = n.k === 'p' ? n.r * 0.8 : n.r;
        dots.push({ style: mpCss({ position: 'absolute', left: (n.cx - rr) + 'px', top: (n.cy - rr) + 'px', width: (2 * rr) + 'px', height: (2 * rr) + 'px', background: otra ? '#FFFFFF' : fill, ...forma, 'box-sizing': 'border-box', 'box-shadow': esSel ? '0 0 0 3px rgba(60,60,60,0.35)' : 'none', cursor: 'pointer', transition: MP_MOV }), onClick: this.tapFn(n.path), label: '', title: n.name });
        labels.push({ style: mpCss({ position: 'absolute', top: (n.cy - 9) + 'px', left: (n.cx + n.r + 24) + 'px', 'font-size': n.depth === 0 ? '12.5px' : n.depth === 1 ? '12px' : '11.5px', 'font-weight': esSel || n.open ? 600 : 500, 'line-height': '18px', 'white-space': 'nowrap', background: esSel ? '#EDEDED' : 'rgba(255,255,255,0.85)', padding: '0 3px', 'border-radius': '3px', color: term ? '#808080' : '#3C3C3C', cursor: 'pointer', transition: MP_MOV }), onClick: this.tapFn(n.path), label: n.txt, title: n.name });
        geo[n.path] = { x: n.cx, y: n.cy, r: n.r };
        // las líneas: del nombre del nodo abierto a cada hijo (más gruesas si van por el camino elegido)
        const padre = n.path.includes(MP_SEP) ? byPath.get(n.path.slice(0, n.path.lastIndexOf(MP_SEP))) : null;
        if (padre) { const p = [Math.max(padre.cx + padre.r + 24 + padre.lw + (padre.exp ? 16 : 0) + 2, padre.ficha ? padre.cx + padre.r + 27 + MP_FICHA_W + 2 : 0), padre.cy], q = [n.cx - n.r - 3, n.cy];
          edges.push({ style: linea(p, q, 'rgba(60,60,60,0.22)', 1) });
          if (enCamino(n.path) || padre.path === sel) hlEdges.push({ style: linea(p, q, 'rgba(60,60,60,0.78)', 2) }); }
      });
    }
    if (L) L.opciones.forEach((o) => { const n = o.n, k = o.k, ix = Math.max(n.cx + n.r + 24 + n.lw + (n.exp ? 16 : 0) + 2, n.ficha ? n.cx + n.r + 27 + MP_FICHA_W + 2 : 0), dx = o.x - 2 - ix, dy = o.y - n.cy;
      fantasmas.push({ style: mpCss({ position: 'absolute', left: ix.toFixed(1) + 'px', top: n.cy.toFixed(1) + 'px', width: Math.sqrt(dx * dx + dy * dy).toFixed(1) + 'px', height: '0', 'border-top': '1px dotted rgba(60,60,60,0.5)', 'transform-origin': '0 0', transform: `rotate(${Math.atan2(dy, dx).toFixed(4)}rad)`, 'pointer-events': 'none' }) });
      const ico = { c: { 'border-radius': '50%', background: '#C9C9C9' }, a: { 'border-radius': '3px', background: '#C9C9C9' }, e: { 'border-radius': '50%', border: '2px solid #A6AAA9' }, u: { 'border-radius': '50%', border: '1.5px dashed #A6AAA9' }, p: { 'border-radius': '1px', background: '#C9C9C9', transform: 'rotate(45deg)', margin: '0 1.5px' } }[k];
      opciones.push({ style: mpCss({ position: 'absolute', left: o.x + 'px', top: (o.y - 11) + 'px', height: '22px', display: 'flex', 'align-items': 'center', gap: '6px', padding: '0 4px', 'font-size': '12px', color: '#808080', 'white-space': 'nowrap', cursor: 'pointer', 'z-index': 2 }), ico: mpCss({ width: k === 'p' ? '7px' : '10px', height: k === 'p' ? '7px' : '10px', 'box-sizing': 'border-box', flex: 'none', ...ico }), label: MP_KN[k][0], title: 'Abrir por ' + MP_KN[k][1].toLowerCase(), onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); if (MP_MOVIDO) return; this.elegir(n.path, k); }, path: n.path, k, onStop: (e) => { if (e && e.stopPropagation) e.stopPropagation(); } }); });
    if (L) L.cajas.forEach((cj) => { cajas.push({ style: mpCss({ position: 'absolute', left: cj.x + 'px', top: cj.y + 'px', width: cj.w + 'px', height: cj.h + 'px', 'border-radius': '12px', border: '1.5px solid ' + cj.col[0], background: cj.col[1], 'box-sizing': 'border-box', 'pointer-events': 'none' }), eje: cj.eje, color: cj.col[0] }); });
    const leyEjes = L ? [...new Map(L.cajas.map((cj) => [cj.eje, cj])).values()].map((cj) => ({ dot: mpCss({ width: '12px', height: '10px', 'border-radius': '3px', border: '1.5px solid ' + cj.col[0], background: cj.col[1], 'box-sizing': 'border-box' }), label: P.names[cj.eje] || cj.eje })) : [];
    const fl = S.flash && geo[S.flash.id] ? geo[S.flash.id] : null;
    const flash = fl ? [{ style: mpCss({ position: 'absolute', left: (fl.x - fl.r - 10) + 'px', top: (fl.y - fl.r - 10) + 'px', width: (2 * (fl.r + 10)) + 'px', height: (2 * (fl.r + 10)) + 'px', 'border-radius': '50%', border: '2.5px solid #3C3C3C', 'box-sizing': 'border-box', 'pointer-events': 'none', opacity: 0, animation: 'mapaFlash .9s ease-out 3' }) }] : [];
    const plural = MP_PLURAL[S.por];
    const mapSub = `Empezás por los ${plural.toLowerCase()}. Tocá un nodo y elegí en "Abrir por" qué ver a continuación: ese tipo vale para toda la columna siguiente, y el encabezado de la columna sirve para cambiarlo. Contenidos solo cuelga de una campaña. Volvé a tocar un nodo abierto para cerrarlo con todo lo que cuelga. El tamaño es el gasto y las campañas que ya terminaron van en gris.` + (deMes ? ' ' + deMes : '');
    // las migas: por dónde se llegó a lo último que se tocó (cada una se puede tocar para volver a ese punto)
    const migaStyle = (activa, fuerte) => mpCss({ border: 'none', background: 'transparent', padding: '2px 4px', 'font-size': '12.5px', 'font-weight': fuerte ? 600 : 500, color: activa ? '#3C3C3C' : '#808080', cursor: 'pointer', 'font-family': 'Poppins,sans-serif' });
    // las migas muestran el tipo de cada columna (Ejes › Campañas › Contenidos › Audiencias) y, si hay un nodo elegido, su nombre
    const tipoMiga = (txt) => ({ label: txt, sep: '›', onClick: () => {}, style: migaStyle(false, false) });
    const migas = [{ label: plural, sep: '', onClick: () => this.set({ sel: null }), style: migaStyle(!sel && !S.cols.length, !sel && !S.cols.length) }];
    S.cols.forEach((k) => migas.push(tipoMiga(MP_KN[k][1])));
    if (sel) migas.push({ label: mpTrunc(P.names[selSegs[selSegs.length - 1]] || selSegs[selSegs.length - 1], 28), sep: '·', onClick: () => {}, style: migaStyle(true, true) });
    // encabezado de cada columna: el tipo, con una flecha; al tocarlo se puede cambiar el tipo de toda la columna (las de más a la derecha se cierran)
    const columnas = [], menu = [];
    if (L) { const ds = [...new Set(L.todos.filter((n) => n.t === 'n').map((n) => n.d))].sort((x, y) => x - y);
      ds.forEach((d) => { const k = this.kinds[d], x = L.colX[d], abierto = S.menuCol === d;
        columnas.push({ style: mpCss({ position: 'absolute', left: (x + 4) + 'px', top: '6px', height: '20px', padding: '0 6px', 'border-radius': '6px', 'font-size': '10.5px', 'font-weight': 600, 'letter-spacing': '.04em', 'text-transform': 'uppercase', color: '#808080', background: abierto ? '#EDEDED' : 'transparent', cursor: 'pointer', 'white-space': 'nowrap', 'line-height': '20px', 'z-index': 3 }), label: MP_KN[k][1] + ' ▾', title: d === 0 ? 'Cambiar por dónde empezar' : 'Cambiar el tipo de toda la columna', onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); if (MP_MOVIDO) return; this.set({ menuCol: abierto ? null : d }); }, d, onStop: (e) => { if (e && e.stopPropagation) e.stopPropagation(); } });
        if (abierto) { const ks = d === 0 ? ['a', 'e', 'u'] : mpValidos(this.kinds.slice(0, d));
          ks.forEach((kk, i) => menu.push({ style: mpCss({ position: 'absolute', left: (x + 4) + 'px', top: (28 + i * 24) + 'px', height: '22px', padding: '0 12px 0 10px', background: '#FFFFFF', border: '1px solid #E4E4E4', 'border-radius': '8px', 'font-size': '12px', 'font-weight': kk === k ? 600 : 400, color: kk === k ? '#3C3C3C' : '#808080', cursor: 'pointer', 'white-space': 'nowrap', 'line-height': '20px', 'z-index': 4, 'box-shadow': '0 1px 4px rgba(0,0,0,0.06)' }), label: MP_KN[kk][1], actual: kk === k, d, k: kk, onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); if (MP_MOVIDO) return; this.cambiarCol(d, kk); }, onStop: (e) => { if (e && e.stopPropagation) e.stopPropagation(); } })); } }); }
    // buscador "¿Dónde está…?"
    const qn = mpNorm(S.q.trim());
    let sugs = [];
    if (qn.length >= 2) {
      const pool = [...P.ejes.map((id) => ['e', id]), ...Object.keys(P.camps).filter((id) => P.camps[id].gasto > 0).map((id) => ['c', id]), ...P.acts.map((id) => ['a', id]), ...P.auds.map((id) => ['u', id])];
      sugs = pool.map(([t, id]) => ({ t, id, n: mpNorm(P.names[id]) })).filter((x) => x.n.includes(qn)).sort((a, b) => (b.n.startsWith(qn) - a.n.startsWith(qn)) || a.n.length - b.n.length).slice(0, 8)
        .map((x) => ({ name: P.names[x.id], type: MP_TYPE[x.t], id: x.id, onPick: (e) => { if (e && e.preventDefault) e.preventDefault(); this.locate(x.id); } }));
    }
    const pick = () => { if (sugs[0]) this.locate(sugs[0].id); };
    // resumen (sin nada tocado): lo elegido, por gasto
    const totV = R.reduce((a, r) => a + r.v, 0);
    const cnt = (k) => new Set(R.map((r) => r[k]).filter((x) => x && x !== 'a:otras')).size;
    const sum = { gasto: mpFmt(totV), filtered: !!(S.ejeF || S.actF), conn: [mpPl(cnt('eje'), 'eje', 'ejes'), mpPl(cnt('c'), 'campaña', 'campañas'), mpPl(cnt('a'), 'activo', 'activos'), mpPl(cnt('u'), 'audiencia', 'audiencias')].join(' · '),
      titulo: plural + ' por gasto',
      items: todasRaices.slice(0, 12).map((z) => ({ name: P.names[z.id] || z.id, val: mpFmt(z.v), dot: mpDot(mpColor(z.mk), z.id === 'a:otras'), onClick: () => this.goTo(z.id) })) };
    const pn = sel ? this.panel(this.recsDe(R, selSegs.slice(0, -1)), selSegs) : { type: '', name: '', hasStatus: false, status: '', redes: '', gasto: '', hasGastoNote: false, gastoNote: '', mkBox: {}, mkDot: {}, mkText: '', mkSub: '', hasOtras: false, otras: '', conn: '', secs: [], canOpen: false, canDetalle: false, detalleTxt: '', onOpen: () => {}, onDetalle: () => {} };
    // leyenda (colores y formas del mapa)
    const forma = (css) => mpCss({ width: '10px', height: '10px', background: '#BFC3C2', 'box-sizing': 'border-box', ...css });
    const leyenda = [...['mejor', 'normal', 'peor', 'sin_referencia'].map((k) => ({ dot: mpCss({ width: '9px', height: '9px', 'border-radius': '999px', background: MP_MK[k].c }), label: MP_MK[k].t })),
      { dot: mpCss({ width: '9px', height: '9px', 'border-radius': '999px', background: MP_TERM }), label: 'Terminó' },
      { dot: forma({ 'border-radius': '50%' }), label: 'Campaña' },
      { dot: forma({ 'border-radius': '50%', border: '2.5px solid #3C3C3C' }), label: 'Eje' },
      { dot: forma({ 'border-radius': '3px' }), label: 'Activo' },
      { dot: forma({ 'border-radius': '50%', border: '2px dashed #3C3C3C' }), label: 'Audiencia' },
      { dot: forma({ 'border-radius': '1px', width: '8px', height: '8px', transform: 'rotate(45deg)' }), label: 'Contenido' }];
    if (this.metric === 'obj' && typeof NOTA !== 'undefined') leyenda.push({ dot: mpCss({ width: '9px', height: '9px', 'border-radius': '999px', background: NOTA[5][1] }), label: 'Nota 5 (conjuntos)' }, { dot: mpCss({ width: '9px', height: '9px', 'border-radius': '999px', background: NOTA[1][1] }), label: 'Nota 1' });
    const vacioTit = empty ? 'No hay gasto en este período.' : !R.length ? 'No hay gasto con estos filtros.' : `No hay ${plural.toLowerCase()} con gasto en este período.`;
    return {
      mpProyecto: proyNombre,
      mpQ: S.q, mpOnQ: (e) => this.set({ q: e.target.value, qOpen: true }), mpOnQFocus: () => this.set({ qOpen: true }), mpOnQBlur: () => setTimeout(() => this.set({ qOpen: false }), 150),
      mpOnQKey: (e) => { if (e.key === 'Enter') pick(); if (e.key === 'Escape') this.set({ qOpen: false }); },
      mpShowSug: S.qOpen && qn.length >= 2, mpSugs: sugs, mpNoSug: qn.length >= 2 && !sugs.length,
      mpEjeF: S.ejeF, mpActF: S.actF, mpMetric: this.metric, mpPor: S.por, mpPorVal: S.por,
      mpPorOpts: MP_POR.map(([v, t]) => ({ v, t })), mpOnPor: (e) => { const k = e.target.value; if (MP_POR.some(([x]) => x === k)) this.set({ por: k, sel: null, abre: {}, cols: [], menuCol: null, fichas: {}, expZ: {}, notice: '', flash: null }); },
      mpMigas: migas,
      mpOrdenOps: MP_ORDEN.map(([k, label]) => { const on = S.orden === k; return { label, on, onClick: () => this.set({ orden: k }),
        style: mpCss({ 'min-height': '32px', padding: '0 10px', 'border-radius': '16px', 'font-size': '12.5px', cursor: 'pointer', border: '1px solid ' + (on ? '#3C3C3C' : '#D6D6D6'), background: on ? '#3C3C3C' : '#FFFFFF', color: on ? '#FFFFFF' : '#3C3C3C', 'font-family': 'Poppins,sans-serif', 'white-space': 'nowrap' }) }; }),
      mpOrden: S.orden,
      mpEjeOpts: [{ v: '', t: 'Todos los ejes' }, ...P.ejes.map((id) => ({ v: id, t: P.names[id] }))],
      mpActOpts: [{ v: '', t: 'Todos los activos' }, ...P.acts.map((id) => ({ v: id, t: P.names[id] }))],
      mpMetOpts: KPI_SEL.map(([v, t]) => ({ v, t })),
      mpOnEje: (e) => this.set({ ejeF: e.target.value, sel: null, abre: {}, expZ: {}, notice: '' }), mpOnAct: (e) => this.set({ actF: e.target.value, sel: null, abre: {}, expZ: {}, notice: '' }),
      mpOnMet: (e) => { const k = e.target.value; kpiSelGuardar(k); this.self.setState({ kpiSel: k }); },
      mpVerTodo: () => this.set(this.reset()),
      mpHasNotice: !!S.notice, mpNotice: S.notice, mpCloseNotice: () => this.set({ notice: '' }),
      mpTitle: 'Mapa de relaciones', mpSub: mapSub, mpLeyenda: leyenda,
      mpEmpty: !hayMapa, mpEmptyTitle: vacioTit,
      mpEmptySub: empty ? 'Cuando haya pauta en el período elegido, el mapa aparece acá.' : !R.length ? 'Probá con otro eje u otro activo, o tocá «Volver a empezar».' : 'Probá con otra opción en «Empezar por».',
      mpHasMap: hayMapa,
      // el lienzo: medidas del dibujo, la escala y los divs de cada cosa
      mpCW: L ? Math.round(L.W) : 0, mpCH: L ? Math.round(L.H) : 0, mpEscala: esc, mpBoxW: L ? Math.round(L.W * esc) : 0, mpBoxH: L ? Math.round(L.H * esc) : 0, mpRowH: rowH, mpVW: vw, mpVH: vh, mpAjusta: L ? availW / L.W >= 0.5 && availH / L.H >= 0.5 : true,
      mpZoom: vista ? vista.k / esc : 1, mpZoomado: !!vista && (Math.abs(vista.k - esc) > 1e-6 || Math.abs(vista.x - this.dim.x0) > 0.5 || Math.abs(vista.y - this.dim.y0) > 0.5),
      mpCanvasStyle: L ? mpCss({ position: 'absolute', left: 0, top: 0, width: Math.round(L.W) + 'px', height: Math.round(L.H) + 'px', transform: `translate(${vista.x.toFixed(1)}px,${vista.y.toFixed(1)}px) scale(${vista.k.toFixed(4)})`, 'transform-origin': '0 0', 'font-family': 'Poppins,sans-serif', transition: Date.now() - MP_T < 300 ? 'none' : 'transform .25s ease' }) : '',
      mpOnDown: (e) => { if (!e || (e.button != null && e.button !== 0)) return; const v = this.vistaActual(); if (!v) return; MP_MOVIDO = false; MP_DRAG = { x0: e.clientX, y0: e.clientY, vx: v.x, vy: v.y }; },
      mpStop: (e) => { if (e && e.stopPropagation) e.stopPropagation(); },
      mpMas: (e) => { if (e && e.stopPropagation) e.stopPropagation(); this.zoom(1.3); }, mpMenos: (e) => { if (e && e.stopPropagation) e.stopPropagation(); this.zoom(1 / 1.3); }, mpAjustar: (e) => { if (e && e.stopPropagation) e.stopPropagation(); this.ajustar(); },
      mpColumnas: columnas, mpMenu: menu, mpFlechas: flechas, mpOpciones: opciones, mpFantasmas: fantasmas, mpCajas: cajas, mpInfos: infos, mpFichas: fichas, mpLeyEjes: leyEjes, mpHayLeyEjes: leyEjes.length > 0, mpEdges: edges, mpHlEdges: hlEdges, mpDots: dots, mpLabels: labels, mpFlashList: flash,
      mpNota: 'El tamaño es el gasto del período (el gasto sí se suma: el de un nodo es el de sus campañas). El color es cómo rinde contra lo normal del proyecto. Las campañas que terminaron van en gris. “Otras redes” es el gasto en redes que no informan cuenta ni audiencia (Google, DV360). Las personas alcanzadas no aparecen porque no se pueden sumar.',
      mpClearSel: () => { if (MP_MOVIDO) return; this.set({ sel: null, menuCol: null }); }, mpNoSel: !sel, mpHasSel: !!sel, mpSum: sum, mpPn: pn,
    };
  }
}
function mapaVals(self, s, PD, proyNombre, deMes) { return new MapaVista(self, s, mpPrep(PD)).vals(proyNombre, deMes); }
