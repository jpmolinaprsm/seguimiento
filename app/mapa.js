// ==== Mapa de Estructura (06/10, Juan Pablo eligió A5 · Zonas en Claude Design) ====
// Primera pestaña de Estructura. Va pegado antes de logica.js (armar.js lo concatena): usa las funciones y constantes de logica.js
// (marcaDe, sinPid, KPI_SEL, kpiSelGuardar…) y el estado de la app con el prefijo "mp" (mpPor, mpSel, mpEjeF, mpActF, mpExpZ, mpExpU, mpQ,
// mpQOpen, mpNotice, mpFlash). Los datos salen del período elegido de la propia vista (campRows, pubs, actCods, audCods): no se manda nada
// nuevo a la app. Nunca se muestra ni se suma el alcance: solo gasto, marca y relaciones.
//
// Cómo se dibuja (igual que el diseño A5, con divs y sin SVG): las campañas van como círculos chicos dentro de zonas ovaladas, una zona por
// cada eje, activo u objetivo (lo que se elija agrupar); a la izquierda, "lo otro" (los activos si se agrupa por eje u objetivo; los ejes si
// se agrupa por activo) y a la derecha las audiencias. Las líneas van de cada campaña a su nodo de la izquierda y a sus audiencias.
// Decisión (anotada): una campaña que corre en varios activos aparece en cada zona de activo donde corre, con su gasto ahí (más claro que
// un "también en…"); al tocarla se resaltan todas sus apariciones. Ejes y objetivos son uno por campaña.
const MP_MK = {
  mejor: { c: '#46C678', bg: '#E5F6EC', t: 'Mejor que lo normal' },
  normal: { c: '#FCB942', bg: '#FEF3DC', t: 'Normal' },
  peor: { c: '#F7444C', bg: '#FDE6E7', t: 'Peor que lo normal' },
  sin_referencia: { c: '#A6AAA9', bg: '#F4F4F4', t: 'Sin referencia' },
};
const MP_LET = { B: 'mejor', N: 'normal', M: 'peor', S: 'sin_referencia' };
const MP_TYPE = { e: 'Eje', c: 'Campaña', a: 'Activo (cuenta)', u: 'Audiencia', p: 'Contenido', o: 'Objetivo' };
const MP_POR = [['eje', 'Eje'], ['activo', 'Activo'], ['objetivo', 'Objetivo']];
const MP_ORDEN = [['gasto', 'Gasto'], ['nombre', 'Nombre'], ['rinde', 'Cómo rinde']];
const MP_RANGO = { mejor: 0, normal: 1, sin_referencia: 2, peor: 3 };   // de lo que mejor rinde a lo que peor
const MP_META = new Set(['IG', 'FB', 'TH', 'AN', 'MS']);   // redes de Meta: traen cuenta y audiencia; las demás (Google, DV360…) no
const MP_TERM = '#D5D5D5';
const MP_MOV = 'left .4s ease, top .4s ease, width .4s ease, height .4s ease, opacity .2s, background .3s, border-color .3s';   // transición suave al cambiar de agrupación
const MP_ZONA_MAX = 7;        // campañas visibles por zona: si hay más, se muestran 6 y el resto va en "+N campañas" (se abre tocándolo)
const MP_AUD_MAX = 11;        // audiencias visibles: si hay más, 10 y "+N audiencias"
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
const MP_LAYOUT = new Map();
const mpFmt = (v) => { v = v || 0; if (v >= 1e6) { const m = v / 1e6; return '$' + (m >= 100 ? String(Math.round(m)) : m.toFixed(1).replace('.', ',')) + ' M'; } if (v >= 1e3) return '$' + Math.round(v / 1e3) + ' mil'; return '$' + Math.round(v); };
const mpTrunc = (s, n) => { s = s || ''; return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const mpNorm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const mpPl = (n, a, b) => n + ' ' + (n === 1 ? a : b);
const mpArgmax = (w) => { let b = 'sin_referencia', bv = -1; Object.keys(w).forEach((k) => { if (w[k] > bv) { bv = w[k]; b = k; } }); return b; };
const mpColor = (mk) => (MP_MK[mk] ? MP_MK[mk].c : '#D5D5D5');
const mpDot = (c, dashed) => ({ width: 9, height: 9, borderRadius: 999, background: dashed ? '#FFFFFF' : c, border: dashed ? '1px dashed #A6AAA9' : 'none', boxSizing: 'border-box', flex: 'none' });
// de un objeto de estilos a texto (los estilos de los divs del mapa van como texto, como en el diseño)
const mpCss = (o) => Object.keys(o).map((k) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()) + ':' + o[k]).join(';');
// la zona a la que pertenece un registro según cómo se agrupa
const mpZonaDe = (r, por) => (por === 'eje' ? r.eje : por === 'objetivo' ? r.o : r.a);

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
  for (const x of PD.actCods || []) { const c = K(x.com, x.cod, x.name); if (!c) continue; c.gasto += x.g; c.activos[x.voz] = (c.activos[x.voz] || 0) + x.g; }
  for (const x of PD.audCods || []) { const c = K(x.com, x.cod, x.name); if (!c) continue; c.audiencias[x.aud] = (c.audiencias[x.aud] || 0) + x.g; }
  for (const p of PD.pubs || []) if (!MP_META.has(p.code)) { const c = K(p.camp, p.cod, p.name); if (!c) continue; c.gasto += p.gasto; c.red_sin_cuenta = c.red_sin_cuenta || p.red; }
  Object.values(cont).forEach((p, i) => { const id = 'p:' + i; pieces[id] = { ...p, id, v: 0 }; names[id] = p.nombre; (byC[p.cid] = byC[p.cid] || []).push(pieces[id]); });
  const recs = [];
  Object.values(camps).forEach((c) => {
    if (!(c.gasto > 0)) return;
    const base = { c: c.id, eje: 'e:' + c.eje, o: 'o:' + c.objetivo };
    const Pz = (byC[c.id] || []).filter((p) => p.gasto > 0), T = Pz.reduce((s, p) => s + p.gasto, 0);
    if (T <= 0) { recs.push({ ...base, p: null, a: 'a:otras', u: null, v: c.gasto }); return; }
    Pz.forEach((p) => {
      const f = c.gasto * p.gasto / T; p.v = f;
      const acts = Object.entries(p.activos).filter((x) => x[1] > 0), aS = acts.reduce((s, x) => s + x[1], 0), den = Math.max(aS, p.gasto);
      const auds = Object.entries(p.audiencias).filter((x) => x[1] > 0), uS = auds.reduce((s, x) => s + x[1], 0);
      let used = 0;
      acts.forEach(([a, x]) => {
        const va = f * x / den; used += va; names['a:' + a] = sinPid(a);
        if (uS > 0) auds.forEach(([u, y]) => { names['u:' + u] = sinPid(u); recs.push({ ...base, p: p.id, a: 'a:' + a, u: 'u:' + u, v: va * y / uS }); });
        else recs.push({ ...base, p: p.id, a: 'a:' + a, u: null, v: va });
      });
      if (f - used > 1) recs.push({ ...base, p: p.id, a: 'a:otras', u: null, v: f - used });
    });
  });
  const uniq = (k) => [...new Set(recs.map((r) => r[k]).filter(Boolean))];
  const out = { names, camps, pieces, byC, recs, ejes: uniq('eje'), acts: uniq('a').filter((a) => a !== 'a:otras'), auds: uniq('u'), objs: uniq('o') };
  MP_CACHE.set(PD, out); return out;
}

class MapaVista {
  constructor(self, s, P) {
    this.self = self; this.P = P; this.s = s;
    const por = MP_POR.some(([k]) => k === s.mpPor) ? s.mpPor : 'eje';
    const orden = MP_ORDEN.some(([k]) => k === s.mpOrden) ? s.mpOrden : 'gasto';
    this.S = { por, orden, sel: s.mpSel || null, expZ: s.mpExpZ || {}, expU: !!s.mpExpU, q: s.mpQ || '', qOpen: !!s.mpQOpen, notice: s.mpNotice || '', flash: s.mpFlash || null,
      ejeF: P.ejes.includes(s.mpEjeF) ? s.mpEjeF : '', actF: P.acts.includes(s.mpActF) ? s.mpActF : '' };
    this.metric = s.kpiSel || 'obj';
    this.hl = null; this.selRecs = null;
  }
  set(u) { const o = {}; for (const k of Object.keys(u)) o['mp' + k[0].toUpperCase() + k.slice(1)] = u[k]; this.self.setState(o); }
  mkOf(c) { return c ? MP_LET[marcaDe(c.raw)] || 'sin_referencia' : 'sin_referencia'; }
  reset() { return { ejeF: '', actF: '', sel: null, expZ: {}, expU: false, notice: '', q: '', flash: null }; }
  recsFor(s) { let R = this.P.recs; if (s.ejeF) R = R.filter((r) => r.eje === s.ejeF); if (s.actF) R = R.filter((r) => r.a === s.actF); return R; }

  // ---- el modelo del dibujo: zonas, nodos de la izquierda y audiencias ----
  modelo(R, por) {
    const P = this.P; por = por || this.S.por;
    const lk = por === 'activo' ? (r) => r.eje : (r) => r.a;
    const G = new Map(), Lm = new Map(), Um = new Map();
    R.forEach((r) => {
      const g = mpZonaDe(r, por), l = lk(r), mk = this.mkOf(P.camps[r.c]);
      let z = G.get(g); if (!z) { z = { id: g, v: 0, w: {}, camps: new Map() }; G.set(g, z); }
      z.v += r.v; z.w[mk] = (z.w[mk] || 0) + r.v;
      let ci = z.camps.get(r.c); if (!ci) { ci = { cid: r.c, g, v: 0, ls: new Set(), us: new Set() }; z.camps.set(r.c, ci); }
      ci.v += r.v; ci.ls.add(l); if (r.u) ci.us.add(r.u);
      let L = Lm.get(l); if (!L) { L = { id: l, v: 0, w: {} }; Lm.set(l, L); } L.v += r.v; L.w[mk] = (L.w[mk] || 0) + r.v;
      if (r.u) { let U = Um.get(r.u); if (!U) { U = { id: r.u, v: 0, w: {} }; Um.set(r.u, U); } U.v += r.v; U.w[mk] = (U.w[mk] || 0) + r.v; }
    });
    // orden elegido: Gasto (mayor a menor, el de siempre), Nombre (A–Z) o Cómo rinde (de lo que mejor rinde a lo que peor; a igual marca, el que más gastó)
    const modo = this.S.orden, nom = (id) => (P.names[id] || id), mkG = (x) => mpArgmax(x.w || {});
    const porGasto = (a, b) => b.v - a.v || (a.id < b.id ? -1 : 1);
    const cmp = (rango) => (a, b) => (modo === 'nombre' ? nom(a.id).localeCompare(nom(b.id), 'es') : modo === 'rinde' ? (MP_RANGO[rango(a)] - MP_RANGO[rango(b)]) || porGasto(a, b) : porGasto(a, b));
    const orden = (m) => [...m.values()].sort(cmp(mkG));
    const campCmp = (a, b) => { const A = { id: a.cid, v: a.v }, B = { id: b.cid, v: b.v }; return cmp((x) => this.mkOf(P.camps[x.id]))(A, B); };
    const zonas = orden(G).map((z) => ({ ...z, camps: [...z.camps.values()].sort(campCmp) }));
    return { zonas, izq: orden(Lm), auds: orden(Um), por };
  }
  // cuántas campañas se ven de cada zona (más de MP_ZONA_MAX: las 6 de más gasto y "+N campañas")
  visibles(z, expZ) { return (expZ || this.S.expZ)[z.id] || z.camps.length <= MP_ZONA_MAX ? z.camps : z.camps.slice(0, MP_ZONA_MAX - 1); }

  // ---- disposición: zonas ovaladas en filas, "lo otro" a la izquierda y las audiencias a la derecha. Todo calculado con el dato (sin azar) ----
  layout(M, availW, availH) {
    const P = this.P, S = this.S;
    const zonasV = M.zonas.map((z) => ({ z, vis: this.visibles(z) }));
    const audsV = !S.expU && M.auds.length > MP_AUD_MAX ? M.auds.slice(0, MP_AUD_MAX - 1) : M.auds;
    const audsOcultas = M.auds.length - audsV.length;
    const nomIzq = (L) => `${mpTrunc(P.names[L.id] || L.id, 24)} · ${mpFmt(L.v)}`;
    const clave = ['zonas', M.por, S.orden, Math.round(availW), Math.round(availH), zonasV.map((x) => x.z.id + ':' + x.vis.map((c) => c.cid + Math.round(c.v)).join(',') + '/' + x.z.camps.length).join('|'), M.izq.map((l) => l.id + Math.round(l.v)).join(','), audsV.map((u) => u.id).join(','), audsOcultas].join('#');
    if (MP_LAYOUT.has(clave)) return MP_LAYOUT.get(clave);
    const cuadr = Math.max(1, ...M.zonas.flatMap((z) => z.camps.map((c) => c.v)));
    // tamaño de cada campaña (círculo) y su recuadro con el nombre a la derecha
    const caja = (ci) => { const r = 5 + 5 * Math.sqrt(ci.v / cuadr), nom = mpTrunc(P.camps[ci.cid].nombre, 22), lw = nom.length * 6.15 + 4; return { ci, r, nom, lw, bw: 2 * r + 6 + lw, bh: Math.max(2 * r, 15) + 3, ax: -r }; };
    const izqW = Math.min(250, Math.max(140, Math.max(...M.izq.map((l) => nomIzq(l).length * 7), 60) + 44));
    const audW = Math.min(190, Math.max(110, Math.max(...audsV.map((u) => mpTrunc(P.names[u.id] || u.id, 26).length * 6.1), 70) + 36));
    const nCol = Math.max(M.izq.length, audsV.length + (audsOcultas ? 1 : 0), 1), HMIN = nCol * 30 + 60;
    const GAP = 22;
    // se prueban lienzos de distinto ancho y densidad y queda el que deja el dibujo más grande en pantalla
    let mejor = null;
    for (let f = 1.5; f <= 4.8 && !mejor; f *= 1.2) {
      const tam = zonasV.map(({ z, vis }) => {
        const items = vis.map(caja); if (vis.length < z.camps.length) items.push({ pill: true, n: z.camps.length - vis.length, bw: 78, bh: 20, ax: 0, id: 'g:' + z.id });
        const rot = `${mpTrunc(P.names[z.id] || z.id, 30)} · ${mpFmt(z.v)}`, sumA = items.reduce((s, it) => s + it.bw * it.bh, 0);
        const A = sumA * 2.9 * f + 2400, asp = 1.55; let w = Math.sqrt(A * asp), h = w / asp; w = Math.max(w, rot.length * 7.2 + 34); h = Math.max(h, 96);
        return { z, items, rot, w, h };
      });
      const maxW = Math.max(...tam.map((t) => t.w));
      let intento = null;
      for (const rw0 of [380, 480, 600, 740, 900, 1080, 1280, 1520, 1800, 2200]) {
        const rw = Math.max(rw0, maxW);
        const filas = []; let fila = { zs: [], w: 0, h: 0 };
        tam.forEach((t) => { if (fila.zs.length && fila.w + GAP + t.w > rw) { filas.push(fila); fila = { zs: [], w: 0, h: 0 }; } fila.zs.push(t); fila.w += (fila.zs.length > 1 ? GAP : 0) + t.w; fila.h = Math.max(fila.h, t.h); });
        if (fila.zs.length) filas.push(fila);
        const Hz = filas.reduce((s, x) => s + x.h, 0) + GAP * (filas.length - 1) + 24, H = Math.max(Hz, HMIN), W = izqW + 18 + rw + 18 + audW;
        const sc = Math.min(1, availW / W, availH / H);
        if (!intento || sc > intento.sc + 1e-9) intento = { sc, rw, filas, W, H, Hz };
      }
      // cada campaña dentro de su zona (espiral desde el centro; nunca fuera del óvalo ni pisando a otra)
      const zonasPos = []; let falla = false; let y = 12 + (intento.H - intento.Hz) / 2;
      const x0 = izqW + 18;
      for (const fila of intento.filas) {
        let x = x0 + (intento.rw - fila.w) / 2;
        for (const t of fila.zs) {
          const cx = x + t.w / 2, cy = y + fila.h / 2, w = t.w - 6, h = fila.h - 6, a = w / 2, b = h / 2, placed = [], cs = [];
          for (const it of t.items) {
            let ok = false;
            for (let st = 0; st < 1400 && !ok; st++) {
              const ang = st * 2.399963 + 0.7, u = Math.sqrt(st / 1400), px = cx + Math.cos(ang) * u * a * 0.98, py = cy + 8 + Math.sin(ang) * u * b * 0.98;
              const bx0 = px + it.ax, bx1 = bx0 + it.bw, by0 = py - it.bh / 2, by1 = py + it.bh / 2;
              if (by0 < cy - b + 34) continue;
              const dentro = [[bx0, by0], [bx1, by0], [bx0, by1], [bx1, by1]].every(([qx, qy]) => ((qx - cx) / (a * 0.97)) ** 2 + ((qy - cy) / (b * 0.97)) ** 2 <= 1);
              if (!dentro) continue;
              if (placed.some((q) => bx0 < q[2] + 4 && q[0] < bx1 + 4 && by0 < q[3] + 3 && q[1] < by1 + 3)) continue;
              placed.push([bx0, by0, bx1, by1]); cs.push({ ...it, x: px, y: py }); ok = true;
            }
            if (!ok) { falla = true; break; }
          }
          zonasPos.push({ ...t, cx, cy, w, h, cs }); x += t.w + GAP; if (falla) break;
        }
        if (falla) break;
        y += fila.h + GAP;
      }
      if (!falla) mejor = { ...intento, zonasPos };
    }
    if (!mejor) mejor = { sc: 0.3, rw: 2200, W: izqW + 2200 + 36 + audW, H: HMIN, zonasPos: [] };   // no entró ni con el lienzo más holgado
    // columnas de los costados: repartidas a lo alto
    const W = mejor.W, H = mejor.H, ys = (n, k) => (n <= 1 ? H / 2 : 34 + k * (H - 68) / (n - 1));
    const izq = M.izq.map((L, k) => ({ L, x: 24, y: ys(M.izq.length, k), txt: nomIzq(L) }));
    const nAud = audsV.length + (audsOcultas ? 1 : 0);
    const aud = audsV.map((U, k) => ({ U, x: W - 24, y: ys(nAud, k), txt: mpTrunc(P.names[U.id] || U.id, 26) }));
    if (audsOcultas) aud.push({ pill: true, n: audsOcultas, x: W - 24, y: ys(nAud, nAud - 1), txt: `+${audsOcultas} audiencias`, id: 'g:u' });
    const out = { W, H, izq, aud, zonas: mejor.zonasPos, izqW, audW, clave };
    MP_LAYOUT.set(clave, out); if (MP_LAYOUT.size > 24) MP_LAYOUT.delete(MP_LAYOUT.keys().next().value);
    return out;
  }

  // ---- información de cada nodo (para el panel y los totales) ----
  info(R, id) {
    const P = this.P, t = id[0];
    const f = t === 'c' ? (r) => r.c === id : t === 'e' ? (r) => r.eje === id : t === 'a' ? (r) => r.a === id : t === 'u' ? (r) => r.u === id : t === 'o' ? (r) => r.o === id : (r) => r.p === id;
    const mr = R.filter(f), w = {}; let v = 0;
    mr.forEach((r) => { v += r.v; const mk = this.mkOf(P.camps[r.c]); w[mk] = (w[mk] || 0) + r.v; });
    return { id, name: P.names[id] || id, v, mk: t === 'c' ? this.mkOf(P.camps[id]) : mpArgmax(w), mr };
  }

  // ---- interacción ----
  tap(id) { this.set({ sel: this.S.sel === id ? null : id }); }
  tapFn(id) { return (e) => { if (e && e.stopPropagation) e.stopPropagation(); if (MP_MOVIDO) return; this.tap(id); }; }
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
  destello(id) {
    this.set({ flash: { id, k: Date.now() } });
    if (typeof setTimeout !== 'function') return;
    clearTimeout(this.self.mpFt); this.self.mpFt = setTimeout(() => this.set({ flash: null }), 3000);
  }
  // ¿dónde está? Se ubica el nodo: se ajustan los filtros, la agrupación y las zonas o grupos cerrados para que se vea
  locate(id) {
    const P = this.P, t = id[0];
    const match = (r) => (t === 'e' ? r.eje === id : t === 'c' ? r.c === id : t === 'a' ? r.a === id : t === 'u' ? r.u === id : r.o === id);
    let ejeF = this.S.ejeF, actF = this.S.actF; const msgs = [];
    const ok = (E, A) => P.recs.some((r) => match(r) && (!E || r.eje === E) && (!A || r.a === A));
    if (!ok(ejeF, actF)) {
      if (ejeF && ok('', actF)) { msgs.push('el filtro de eje'); ejeF = ''; }
      else if (actF && ok(ejeF, '')) { msgs.push('el filtro de activo'); actF = ''; }
      else { if (ejeF) msgs.push('el filtro de eje'); if (actF) msgs.push('el filtro de activo'); ejeF = ''; actF = ''; }
    }
    const ns = { sel: id, ejeF, actF, q: '', qOpen: false };
    // un objetivo solo se ve agrupando por objetivo; un eje o un activo, en cualquier otra agrupación (zona o columna de la izquierda)
    let por = this.S.por; if (t === 'o') por = 'objetivo'; else if ((t === 'e' || t === 'a') && por === 'objetivo') por = 'eje';
    if (por !== this.S.por) ns.por = por;
    let nota = '';
    // una campaña o audiencia escondida en un "+N": se abre ese grupo
    const M = this.modelo(this.recsFor({ ejeF, actF }), por);
    if (t === 'c') { const abrir = {}; M.zonas.filter((z) => z.camps.some((c) => c.cid === id)).forEach((z) => { if (!this.visibles(z, this.S.expZ).some((c) => c.cid === id)) abrir[z.id] = true; });
      if (Object.keys(abrir).length) { ns.expZ = { ...this.S.expZ, ...abrir }; nota = ' Estaba dentro de “+N campañas”: se abrió esa zona.'; } }
    if (t === 'u' && !this.S.expU && M.auds.length > MP_AUD_MAX && M.auds.findIndex((u) => u.id === id) >= MP_AUD_MAX - 1) { ns.expU = true; nota = ' Estaba dentro de “+N audiencias”: se abrieron.'; }
    const aviso = [...msgs, ...(ns.por ? ['la agrupación'] : [])].map((m) => m.replace(/^el /, ''));
    ns.notice = aviso.length ? `Se cambió ${aviso.join(' y ')} para mostrar «${P.names[id]}».${nota}` : (nota ? `«${P.names[id]}».${nota}` : '');
    this.set(ns); this.destello(id);
  }
  goTo(id) { this.locate(id.startsWith('p:') ? this.P.pieces[id].cid : id); }

  // ---- panel lateral ----
  panel(R, sel) {
    const P = this.P, t = sel[0], n = this.info(R, sel), metLabel = (KPI_SEL.find((m) => m[0] === this.metric) || [])[1] || '';
    const mr = n.mr;
    const agg = (f) => { const m = new Map(); mr.forEach((r) => { const k = f(r); if (k == null) return; m.set(k, (m.get(k) || 0) + r.v); }); return [...m].sort((a, b) => b[1] - a[1]); };
    const colorId = (id) => { if (id.startsWith('c:')) { const c = P.camps[id]; return c.termino ? MP_TERM : mpColor(this.mkOf(c)); } if (id.startsWith('p:')) return '#BFC3C2'; return mpColor(this.info(R, id).mk); };
    const item = ([id, v]) => ({ name: P.names[id] || id, val: mpFmt(v), dot: mpDot(colorId(id), id === 'a:otras'), onClick: () => this.goTo(id) });
    const A = (r) => r.a, U = (r) => r.u, C = (r) => r.c, E = (r) => r.eje, Pp = (r) => r.p, O = (r) => r.o;
    const defs = { e: [['Campañas', C], ['Activos (cuentas)', A], ['Audiencias', U]], c: [['Eje', E], ['Objetivo', O], ['Activos (cuentas)', A], ['Audiencias', U], ['Contenidos', Pp]],
      a: sel === 'a:otras' ? [['Campañas', C], ['Contenidos', Pp]] : [['Campañas', C], ['Audiencias', U]], u: [['Campañas', C], ['Activos (cuentas)', A]], o: [['Campañas', C], ['Activos (cuentas)', A], ['Audiencias', U]] }[t];
    const nouns = { 'Campañas': ['campaña', 'campañas'], 'Activos (cuentas)': ['activo', 'activos'], 'Audiencias': ['audiencia', 'audiencias'], 'Contenidos': ['contenido', 'contenidos'] };
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
    else { mk = n.mk; mkText = MP_MK[mk] ? MP_MK[mk].t : 'Sin referencia'; mkSub = `Es la marca de la mayor parte de su gasto, sumando lo que gastó cada campaña (${this.metric === 'obj' ? 'según el objetivo de cada una' : 'según ' + metLabel}).`; }
    const mkc = MP_MK[mk] || MP_MK.sin_referencia;
    const otrasV = mr.filter((r) => r.a === 'a:otras').reduce((s, r) => s + r.v, 0);
    let otras = '';
    if ((t === 'c' || t === 'e' || t === 'o') && otrasV > 0) {
      const noDet = mr.every((r) => !r.p);
      if (noDet && t === 'c') otras = 'No hay detalle por cuenta ni audiencia para esta campaña en el período: todo su gasto queda en la campaña.';
      else { const redes = [...new Set(mr.filter((r) => r.a === 'a:otras' && r.p).map((r) => P.pieces[r.p].red_sin_cuenta).filter(Boolean))]; otras = `${mpFmt(otrasV)} de este gasto corrió en redes que no informan cuenta ni audiencia${redes.length ? ' (' + redes.join(', ') + ')' : ''}.`; }
    }
    const tabFor = { e: 'ejes', a: 'activos', u: 'audiencias' };
    const filtered = this.S.ejeF || this.S.actF;
    return {
      type: sel === 'a:otras' ? 'Otras redes' : MP_TYPE[t], name: n.name,
      hasStatus: !!c, status: c ? `${c.termino ? 'Terminó' : 'Activa'} · ${c.fechas} · Objetivo: ${c.objetivo}` : '', redes: c ? 'Redes: ' + (c.redes || []).join(', ') : '',
      gasto: mpFmt(n.v), hasGastoNote: !!filtered, gastoNote: 'Con los filtros aplicados',
      mkBox: { display: 'flex', gap: 10, alignItems: 'flex-start', background: mkc.bg, borderRadius: 12, padding: '10px 12px' }, mkDot: { width: 10, height: 10, borderRadius: 999, background: mkc.c, flex: 'none', marginTop: 4 },
      mkText, mkSub, hasOtras: !!otras, otras, conn: conn.join(' · '), secs,
      // campañas abren su ficha (Detalle); activos, ejes y audiencias, su tabla de Estructura con el nombre puesto; objetivos y "otras redes" no tienen
      canOpen: false, onOpen: () => {}, canDetalle: !!c || !!tabFor[t], detalleTxt: c ? 'Ver en Detalle' : 'Ver en la tabla',
      onDetalle: () => { if (c) this.self.irCampana(c.raw.id); else if (tabFor[t]) this.self.setState({ paso: 'estructura', tab: tabFor[t], busca: P.names[sel], abierto: {} }); },
    };
  }

  // ---- todo lo que usa el markup ----
  vals(proyNombre, deMes) {
    const P = this.P, S = this.S, s = this.s;
    const empty = !P.recs.length;
    const R = this.recsFor(S);
    const M = this.modelo(R);
    const availW = Math.max(600, Math.min(s.w || 1600, 1600) - 48 - 376 - 32 - 6), rowH = Math.max(360, (s.hv || 900) - MP_FUERA), availH = rowH - 68;   // el título de la tarjeta y los bordes ocupan el resto: así no aparece scroll
    const L = R.length ? this.layout(M, availW, availH) : null;
    const esc = L ? Math.min(1, availW / L.W, availH / L.H) : 1;
    // el recuadro donde se ve el mapa mide lo que hay disponible; el dibujo se ajusta adentro y se puede acercar, alejar y mover
    const vw = Math.round(availW), vh = Math.round(availH);
    this.dim = L ? { sig: L.clave, W: L.W, H: L.H, k0: esc, x0: (vw - L.W * esc) / 2, y0: (vh - L.H * esc) / 2, vw, vh } : null;
    const vista = this.vistaActual();
    MP_ACTIVO = this; mpEscucha();
    // selección: se resalta lo conectado y se apaga el resto
    const valida = (id) => !!id && id[0] !== 'g' && R.some((r) => r.c === id || r.eje === id || r.a === id || r.u === id || r.o === id);
    const sel = valida(S.sel) ? S.sel : null;
    if (sel) { const f = this.info(R, sel); this.selRecs = f.mr; this.hl = new Set(); f.mr.forEach((r) => { [r.c, r.eje, r.a, r.u, r.o].forEach((k) => k && this.hl.add(k)); }); }
    const dim = (...ids) => !!sel && !ids.some((id) => id && this.hl.has(id));
    const zones = [], edges = [], hlEdges = [], dots = [], labels = [], geo = {};
    if (L) {
      const posIzq = {}, posAud = {};
      L.izq.forEach((n) => { posIzq[n.L.id] = [n.x, n.y]; });
      L.aud.forEach((n) => { if (n.pill) posAud['g:u'] = [n.x, n.y]; else posAud[n.U.id] = [n.x, n.y]; });
      const visAud = new Set(L.aud.filter((n) => !n.pill).map((n) => n.U.id));
      const linea = (p, q, color, grosor) => { const dx = q[0] - p[0], dy = q[1] - p[1]; return mpCss({ position: 'absolute', left: p[0].toFixed(1) + 'px', top: p[1].toFixed(1) + 'px', width: Math.sqrt(dx * dx + dy * dy).toFixed(1) + 'px', height: grosor + 'px', background: color, 'transform-origin': '0 0', transform: `rotate(${Math.atan2(dy, dx).toFixed(4)}rad)`, 'pointer-events': 'none', transition: 'opacity .2s' }); };
      const mk0 = this.selRecs || [];
      L.zonas.forEach((zp) => {
        const zid = zp.z.id, otra = zid === 'a:otras';
        zones.push({ style: mpCss({ position: 'absolute', left: (zp.cx - zp.w / 2) + 'px', top: (zp.cy - zp.h / 2) + 'px', width: zp.w + 'px', height: zp.h + 'px', 'border-radius': '50%', background: zid === sel ? 'rgba(60,60,60,0.085)' : 'rgba(60,60,60,0.058)', border: (zid === sel ? '2px solid #3C3C3C' : otra ? '1px dashed rgba(60,60,60,0.38)' : '1px solid rgba(60,60,60,0.15)'), 'box-sizing': 'border-box', opacity: dim(zid) ? 0.35 : 1, cursor: 'pointer', transition: MP_MOV }), onClick: this.tapFn(zid),
          lab: mpCss({ position: 'absolute', left: (zp.cx - zp.w / 2) + 'px', width: zp.w + 'px', 'text-align': 'center', top: (zp.cy - zp.h / 2 + 12) + 'px', 'font-size': '13px', 'font-weight': 600, 'letter-spacing': '-0.005em', opacity: dim(zid) ? 0.3 : 1, cursor: 'pointer', transition: MP_MOV }), label: zp.rot, name: mpTrunc(P.names[zid] || zid, 30), gasto: mpFmt(zp.z.v), title: `${P.names[zid] || zid} · ${mpFmt(zp.z.v)}` });
        geo[zid] = { x: zp.cx, y: zp.cy - zp.h / 2 + 18, r: 30 };
        zp.cs.forEach((it) => {
          if (it.pill) { dots.push({ style: mpCss({ position: 'absolute', left: it.x + 'px', top: (it.y - it.bh / 2) + 'px', width: it.bw + 'px', height: it.bh + 'px', 'border-radius': '10px', background: '#EDEDED', border: '1px dashed #A6AAA9', 'box-sizing': 'border-box', 'font-size': '11px', 'font-weight': 500, color: '#3C3C3C', 'text-align': 'center', 'line-height': (it.bh - 2) + 'px', cursor: 'pointer' }), onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); this.set({ expZ: { ...S.expZ, [zid]: true } }); }, label: `+${it.n} campañas`, title: 'Abrir las campañas de esta zona' }); return; }
          const cid = it.ci.cid, c = P.camps[cid], color = c.termino ? MP_TERM : mpColor(this.mkOf(c)), apagado = dim(cid), p = [it.x, it.y];
          // las líneas: de la campaña a su nodo de la izquierda y a sus audiencias (más gruesas si son de lo tocado)
          it.ci.ls.forEach((l) => { const q = posIzq[l]; if (!q) return; edges.push({ style: linea(p, q, 'rgba(60,60,60,0.13)', 1) + ';opacity:' + (sel ? 0.22 : 1) });
            if (sel && mk0.some((r) => r.c === cid && mpZonaDe(r, M.por) === zid && (M.por === 'activo' ? r.eje : r.a) === l)) hlEdges.push({ style: linea(p, q, 'rgba(60,60,60,0.78)', 2) }); });
          it.ci.us.forEach((u) => { const q = posAud[visAud.has(u) ? u : 'g:u']; if (!q) return; edges.push({ style: linea(p, q, 'rgba(60,60,60,0.07)', 1) + ';opacity:' + (sel ? 0.22 : 1) });
            if (sel && mk0.some((r) => r.c === cid && mpZonaDe(r, M.por) === zid && r.u === u)) hlEdges.push({ style: linea(p, q, 'rgba(60,60,60,0.62)', 2) }); });
          dots.push({ style: mpCss({ position: 'absolute', left: (it.x - it.r) + 'px', top: (it.y - it.r) + 'px', width: (2 * it.r) + 'px', height: (2 * it.r) + 'px', 'border-radius': '50%', background: color, border: cid === sel ? '2px solid #3C3C3C' : '0', 'box-sizing': 'border-box', opacity: apagado ? 0.15 : 1, cursor: 'pointer', transition: MP_MOV }), onClick: this.tapFn(cid), label: '', title: c.nombre });
          labels.push({ style: mpCss({ position: 'absolute', top: (it.y - 8) + 'px', left: (it.x + it.r + 6) + 'px', 'font-size': '11px', 'font-weight': cid === sel ? 600 : 500, 'white-space': 'nowrap', background: 'rgba(255,255,255,0.85)', padding: '0 3px', 'border-radius': '3px', color: c.termino ? '#808080' : '#3C3C3C', opacity: apagado ? 0.22 : 1, cursor: 'pointer', transition: MP_MOV }), onClick: this.tapFn(cid), label: it.nom, title: c.nombre });
          if (!geo[cid]) geo[cid] = { x: it.x, y: it.y, r: it.r };
        });
      });
      // lo otro, a la izquierda: cuadrados con borde (activos o ejes)
      L.izq.forEach((n) => { const id = n.L.id, apagado = dim(id);
        dots.push({ style: mpCss({ position: 'absolute', left: (n.x - 10) + 'px', top: (n.y - 10) + 'px', width: '20px', height: '20px', 'border-radius': '8px', background: '#FFFFFF', border: (id === sel ? '3px solid #3C3C3C' : id === 'a:otras' ? '2.5px dashed #3C3C3C' : '2.5px solid #3C3C3C'), 'box-sizing': 'border-box', opacity: apagado ? 0.15 : 1, cursor: 'pointer', transition: MP_MOV }), onClick: this.tapFn(id), label: '', title: P.names[id] || id });
        labels.push({ style: mpCss({ position: 'absolute', top: (n.y - 9) + 'px', left: (n.x + 18) + 'px', 'font-size': '12.5px', 'font-weight': 600, 'white-space': 'nowrap', background: 'rgba(255,255,255,0.85)', padding: '0 3px', 'border-radius': '3px', opacity: apagado ? 0.22 : 1, cursor: 'pointer', transition: MP_MOV }), onClick: this.tapFn(id), label: n.txt, title: P.names[id] || id });
        geo[id] = { x: n.x, y: n.y, r: 12 }; });
      // las audiencias, a la derecha: círculos con borde punteado
      L.aud.forEach((n) => {
        if (n.pill) { dots.push({ style: mpCss({ position: 'absolute', left: (n.x - 70) + 'px', top: (n.y - 10) + 'px', width: '94px', height: '20px', 'border-radius': '10px', background: '#EDEDED', border: '1px dashed #A6AAA9', 'box-sizing': 'border-box', 'font-size': '11px', 'font-weight': 500, 'text-align': 'center', 'line-height': '18px', cursor: 'pointer' }), onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); this.set({ expU: true }); }, label: n.txt, title: 'Ver todas las audiencias' }); return; }
        const id = n.U.id, apagado = dim(id);
        dots.push({ style: mpCss({ position: 'absolute', left: (n.x - 8) + 'px', top: (n.y - 8) + 'px', width: '16px', height: '16px', 'border-radius': '50%', background: '#FFFFFF', border: (id === sel ? '3px solid #3C3C3C' : '2px dashed #8A8A8A'), 'box-sizing': 'border-box', opacity: apagado ? 0.15 : 1, cursor: 'pointer', transition: MP_MOV }), onClick: this.tapFn(id), label: '', title: P.names[id] || id });
        labels.push({ style: mpCss({ position: 'absolute', top: (n.y - 8) + 'px', right: (L.W - n.x + 16) + 'px', 'text-align': 'right', 'font-size': '11px', 'font-weight': id === sel ? 600 : 500, 'white-space': 'nowrap', background: 'rgba(255,255,255,0.85)', padding: '0 3px', 'border-radius': '3px', opacity: apagado ? 0.22 : 1, cursor: 'pointer', transition: MP_MOV }), onClick: this.tapFn(id), label: n.txt, title: P.names[id] || id });
        geo[id] = { x: n.x, y: n.y, r: 10 }; });
    }
    const fl = S.flash && geo[S.flash.id] ? geo[S.flash.id] : null;
    const flash = fl ? [{ style: mpCss({ position: 'absolute', left: (fl.x - fl.r - 10) + 'px', top: (fl.y - fl.r - 10) + 'px', width: (2 * (fl.r + 10)) + 'px', height: (2 * (fl.r + 10)) + 'px', 'border-radius': '50%', border: '2.5px solid #3C3C3C', 'box-sizing': 'border-box', 'pointer-events': 'none', opacity: 0, animation: 'mapaFlash .9s ease-out 3' }) }] : [];
    const mapSub = `Cada zona es un ${M.por} y adentro van sus campañas. A la izquierda, ${M.por === 'activo' ? 'los ejes' : 'los activos (cuentas)'}; a la derecha, las audiencias. El tamaño es el gasto y las campañas que ya terminaron van en gris.` + (deMes ? ' ' + deMes : '');
    // botones para abrir o volver a agrupar lo chico
    const grpBtns = [];
    if (!empty) {
      const cerradas = M.zonas.filter((z) => z.camps.length > MP_ZONA_MAX && !S.expZ[z.id]), abiertas = M.zonas.filter((z) => z.camps.length > MP_ZONA_MAX && S.expZ[z.id]);
      if (cerradas.length) grpBtns.push({ label: `Ver las ${new Set(R.map((r) => r.c)).size} campañas`, onClick: () => this.set({ expZ: Object.fromEntries(M.zonas.map((z) => [z.id, true])) }) });
      if (abiertas.length) grpBtns.push({ label: 'Agrupar campañas chicas', onClick: () => this.set({ expZ: {} }) });
      if (M.auds.length > MP_AUD_MAX) { if (!S.expU) grpBtns.push({ label: `Ver las ${M.auds.length} audiencias`, onClick: () => this.set({ expU: true }) }); else grpBtns.push({ label: 'Agrupar audiencias chicas', onClick: () => this.set({ expU: false }) }); }
    }
    // buscador "¿Dónde está…?"
    const qn = mpNorm(S.q.trim());
    let sugs = [];
    if (qn.length >= 2) {
      const pool = [...P.ejes.map((id) => ['e', id]), ...Object.keys(P.camps).filter((id) => P.camps[id].gasto > 0).map((id) => ['c', id]), ...P.acts.map((id) => ['a', id]), ...P.auds.map((id) => ['u', id]), ...P.objs.map((id) => ['o', id])];
      sugs = pool.map(([t, id]) => ({ t, id, n: mpNorm(P.names[id]) })).filter((x) => x.n.includes(qn)).sort((a, b) => (b.n.startsWith(qn) - a.n.startsWith(qn)) || a.n.length - b.n.length).slice(0, 8)
        .map((x) => ({ name: P.names[x.id], type: MP_TYPE[x.t], id: x.id, onPick: (e) => { if (e && e.preventDefault) e.preventDefault(); this.locate(x.id); } }));
    }
    const pick = () => { if (sugs[0]) this.locate(sugs[0].id); };
    // resumen (sin nada tocado): las zonas por gasto
    const totV = R.reduce((a, r) => a + r.v, 0);
    const cnt = (k) => new Set(R.map((r) => r[k]).filter((x) => x && x !== 'a:otras')).size;
    const sum = { gasto: mpFmt(totV), filtered: !!(S.ejeF || S.actF), conn: [mpPl(cnt('eje'), 'eje', 'ejes'), mpPl(cnt('c'), 'campaña', 'campañas'), mpPl(cnt('a'), 'activo', 'activos'), mpPl(cnt('u'), 'audiencia', 'audiencias')].join(' · '),
      titulo: { eje: 'Ejes por gasto', activo: 'Activos por gasto', objetivo: 'Objetivos por gasto' }[M.por],
      items: M.zonas.slice(0, 12).map((z) => ({ name: P.names[z.id] || z.id, val: mpFmt(z.v), dot: mpDot(mpColor(mpArgmax(z.w)), z.id === 'a:otras'), onClick: () => this.goTo(z.id) })) };
    const pn = sel ? this.panel(R, sel) : { type: '', name: '', hasStatus: false, status: '', redes: '', gasto: '', hasGastoNote: false, gastoNote: '', mkBox: {}, mkDot: {}, mkText: '', mkSub: '', hasOtras: false, otras: '', conn: '', secs: [], canOpen: false, canDetalle: false, detalleTxt: '', onOpen: () => {}, onDetalle: () => {} };
    // leyenda (colores y formas del mapa)
    const leyenda = [...['mejor', 'normal', 'peor', 'sin_referencia'].map((k) => ({ dot: mpCss({ width: '9px', height: '9px', 'border-radius': '999px', background: MP_MK[k].c }), label: MP_MK[k].t })),
      { dot: mpCss({ width: '9px', height: '9px', 'border-radius': '999px', background: MP_TERM }), label: 'Terminó' },
      { dot: mpCss({ width: '10px', height: '10px', 'border-radius': '3px', border: '2px solid #3C3C3C', 'box-sizing': 'border-box' }), label: M.por === 'activo' ? 'Eje' : 'Activo' },
      { dot: mpCss({ width: '10px', height: '10px', 'border-radius': '50%', border: '2px dashed #8A8A8A', 'box-sizing': 'border-box' }), label: 'Audiencia' }];
    return {
      mpProyecto: proyNombre,
      mpQ: S.q, mpOnQ: (e) => this.set({ q: e.target.value, qOpen: true }), mpOnQFocus: () => this.set({ qOpen: true }), mpOnQBlur: () => setTimeout(() => this.set({ qOpen: false }), 150),
      mpOnQKey: (e) => { if (e.key === 'Enter') pick(); if (e.key === 'Escape') this.set({ qOpen: false }); },
      mpShowSug: S.qOpen && qn.length >= 2, mpSugs: sugs, mpNoSug: qn.length >= 2 && !sugs.length,
      mpEjeF: S.ejeF, mpActF: S.actF, mpMetric: this.metric, mpPor: M.por,
      mpOrdenOps: MP_ORDEN.map(([k, label]) => { const on = S.orden === k; return { label, on, onClick: () => this.set({ orden: k }),
        style: mpCss({ 'min-height': '32px', padding: '0 10px', 'border-radius': '16px', 'font-size': '12.5px', cursor: 'pointer', border: '1px solid ' + (on ? '#3C3C3C' : '#D6D6D6'), background: on ? '#3C3C3C' : '#FFFFFF', color: on ? '#FFFFFF' : '#3C3C3C', 'font-family': 'Poppins,sans-serif', 'white-space': 'nowrap' }) }; }),
      mpOrden: S.orden,
      mpPorOps: MP_POR.map(([k, label]) => { const on = M.por === k; return { label, on, onClick: () => this.set({ por: k, sel: null, expZ: {}, notice: '' }),
        style: mpCss({ 'min-height': '32px', padding: '0 11px', 'border-radius': '16px', 'font-size': '12.5px', cursor: 'pointer', border: '1px solid ' + (on ? '#3C3C3C' : '#D6D6D6'), background: on ? '#3C3C3C' : '#FFFFFF', color: on ? '#FFFFFF' : '#3C3C3C', 'font-family': 'Poppins,sans-serif' }) }; }),
      mpEjeOpts: [{ v: '', t: 'Todos los ejes' }, ...P.ejes.map((id) => ({ v: id, t: P.names[id] }))],
      mpActOpts: [{ v: '', t: 'Todos los activos' }, ...P.acts.map((id) => ({ v: id, t: P.names[id] }))],
      mpMetOpts: KPI_SEL.map(([v, t]) => ({ v, t })),
      mpOnEje: (e) => this.set({ ejeF: e.target.value, sel: null, notice: '' }), mpOnAct: (e) => this.set({ actF: e.target.value, sel: null, notice: '' }),
      mpOnMet: (e) => { const k = e.target.value; kpiSelGuardar(k); this.self.setState({ kpiSel: k }); },
      mpVerTodo: () => this.set(this.reset()),
      mpHasNotice: !!S.notice, mpNotice: S.notice, mpCloseNotice: () => this.set({ notice: '' }),
      mpTitle: 'Mapa de relaciones', mpSub: mapSub, mpGrpBtns: grpBtns, mpLeyenda: leyenda,
      mpEmpty: empty || !R.length, mpEmptyTitle: empty ? 'No hay gasto en este período.' : 'No hay gasto con estos filtros.',
      mpEmptySub: empty ? 'Cuando haya pauta en el período elegido, el mapa aparece acá.' : 'Probá con otro eje u otro activo, o tocá «Ver todo».',
      mpHasMap: !!R.length,
      // el lienzo: medidas del dibujo, la escala y los divs de cada cosa
      mpCW: L ? Math.round(L.W) : 0, mpCH: L ? Math.round(L.H) : 0, mpEscala: esc, mpBoxW: L ? Math.round(L.W * esc) : 0, mpBoxH: L ? Math.round(L.H * esc) : 0, mpRowH: rowH, mpVW: vw, mpVH: vh,
      mpZoom: vista ? vista.k / esc : 1, mpZoomado: !!vista && (Math.abs(vista.k - esc) > 1e-6 || Math.abs(vista.x - this.dim.x0) > 0.5 || Math.abs(vista.y - this.dim.y0) > 0.5),
      mpCanvasStyle: L ? mpCss({ position: 'absolute', left: 0, top: 0, width: Math.round(L.W) + 'px', height: Math.round(L.H) + 'px', transform: `translate(${vista.x.toFixed(1)}px,${vista.y.toFixed(1)}px) scale(${vista.k.toFixed(4)})`, 'transform-origin': '0 0', 'font-family': 'Poppins,sans-serif', transition: Date.now() - MP_T < 300 ? 'none' : 'transform .25s ease' }) : '',
      mpOnDown: (e) => { if (!e || (e.button != null && e.button !== 0)) return; const v = this.vistaActual(); if (!v) return; MP_MOVIDO = false; MP_DRAG = { x0: e.clientX, y0: e.clientY, vx: v.x, vy: v.y }; },
      mpStop: (e) => { if (e && e.stopPropagation) e.stopPropagation(); },
      mpMas: (e) => { if (e && e.stopPropagation) e.stopPropagation(); this.zoom(1.3); }, mpMenos: (e) => { if (e && e.stopPropagation) e.stopPropagation(); this.zoom(1 / 1.3); }, mpAjustar: (e) => { if (e && e.stopPropagation) e.stopPropagation(); this.ajustar(); },
      mpZones: zones, mpEdges: edges, mpHlEdges: hlEdges, mpDots: dots, mpLabels: labels, mpFlashList: flash,
      mpNota: 'El tamaño es el gasto del período (el gasto sí se suma: el de una zona es el de sus campañas). El color es cómo rinde contra lo normal del proyecto. Las campañas que terminaron van en gris. “Otras redes” es el gasto en redes que no informan cuenta ni audiencia (Google, DV360). Las personas alcanzadas no aparecen porque no se pueden sumar.',
      mpClearSel: () => { if (MP_MOVIDO) return; this.set({ sel: null }); }, mpNoSel: !sel, mpHasSel: !!sel, mpSum: sum, mpPn: pn,
    };
  }
}
function mapaVals(self, s, PD, proyNombre, deMes) { return new MapaVista(self, s, mpPrep(PD)).vals(proyNombre, deMes); }
