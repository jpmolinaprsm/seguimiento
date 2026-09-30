// Lógica de la pantalla raíz (se inyecta en public/index.html con build-index.js).
// Misma derivación que el prototipo de Claude Design, pero los datos vienen del API del módulo.
const EST_C = { 'Activa': '#46C678', 'Por vencer': '#FCB942', 'Sin entrega': '#F7444C', 'Agotada': '#A6AAA9', 'Programada': '#D5D5D5' };
const PISO_C = { 'En camino': '#46C678', 'En riesgo': '#FCB942', 'No llega': '#F7444C', '—': '#D5D5D5' };
const RITMO_C = { 'En ritmo': '#46C678', 'Subejecutada': '#FCB942', 'Sobreejecutada': '#F7444C' };
const vc = v => v >= 1 ? '#46C678' : v >= 0.5 ? '#FCB942' : '#F7444C';
const fx = v => (v == null ? '—' : (v < 0.1 ? v.toFixed(2) : v.toFixed(1)).replace('.', ','));
const money = n => '$' + Math.round(n || 0).toLocaleString('es-AR');
const DEC = { aceptada: 'Aceptada e incorporada', noinc: 'Aceptada, no incorporada', resp: 'Respondida', decl: 'Declinada' };
const DEC_C = { 'Aceptada e incorporada': '#46C678', 'Aceptada, no incorporada': '#FCB942', 'Respondida': '#A6AAA9', 'Declinada': '#F7444C' };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const api = (url, opts) => fetch(url, opts).then(r => r.json());
const fechaCorta = iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—';
const horaDe = ts => ts ? String(ts).slice(11, 16) : '—';

function buildChart(c, metric, marcas) {
  const s = c.serie;
  if (!s || !s.dias || !s.dias.length) return { bars: [], medPct: 0, medTxt: '—', unitLabel: '', mkText: '' };
  const isRes = metric === 'res';
  const vals = s.dias.map(x => (isRes ? x.res : x.cost) || 0);
  const med = isRes ? s.medRes : s.medCost;
  const max = Math.max(med || 0, ...vals) * 1.12 || 1;
  const fmt = v => isRes ? Math.round(v).toLocaleString('es-AR') : money(v);
  const marcasMap = new Map((marcas || []).map(m => [m.fecha, m.texto]));
  const n = s.dias.length;
  const conLabel = i => i === n - 1 || (i % 4 === 0 && i < n - 2);
  const bars = s.dias.map((x, i) => ({ h: (vals[i] / max * 100).toFixed(1), d: x.d, lab: conLabel(i) ? x.d : '', mk: marcasMap.has(x.fecha), tip: x.d + ' · ' + (vals[i] ? fmt(vals[i]) : 'sin entrega') }));
  const resLabel = s.unit.res.charAt(0).toUpperCase() + s.unit.res.slice(1) + ' por día';
  const costLabel = s.unit.costo === 'CPM' ? 'CPM' : 'Costo ' + s.unit.costo;
  return { bars, medPct: med ? (med / max * 100).toFixed(1) : 0, medTxt: med ? fmt(med) + (isRes ? ' por día' : '') : 'sin comparable', unitLabel: isRes ? resLabel : costLabel, resLabel, costLabel, mkText: [...marcasMap.values()].join(' · ') };
}

class Component extends DCLogic {
  state = { tab: 'seg', proyecto: null, proyectos: [], data: null, cargando: true, error: '', canal: 'Ambos', eje: 'Todos', campId: null, metric: 'res', allCont: false, allAud: false, calidadOpen: false,
    decisions: {}, soloPend: true, fTipo: 'Todos', fVia: 'Todas', fConf: 'Todas', agrupar: 'Ninguno', unsilenced: false, refreshing: false, hImpl: 'Todos', hDec: 'Todas', hTipo: 'Todos', toast: null };

  componentDidMount() { this.cargarProyectos(); }
  componentWillUnmount() { clearTimeout(this._tt); }

  async cargarProyectos() {
    try {
      const ps = await api('/api/proyectos');
      this.setState({ proyectos: ps });
      if (ps.length) this.cargar(ps[0].id);
    } catch (e) { this.setState({ error: 'No se pudo conectar con el servidor del módulo.', cargando: false }); }
  }

  async cargar(id, forzar) {
    this.setState({ cargando: true, refreshing: !!forzar, error: '', pedidos: null });
    this.cargarPedidos(id, forzar);
    try {
      const d = await api(`/api/datos?proyecto=${encodeURIComponent(id)}${forzar ? '&forzar=1' : ''}`);
      if (d.error) throw new Error(d.error);
      this.setState({ proyecto: id, data: d, decisions: d.decisiones || {}, cargando: false, refreshing: false, campId: null, eje: 'Todos' });
    } catch (e) { this.setState({ error: e.message, cargando: false, refreshing: false }); }
  }

  async cargarPedidos(id, forzar, periodo) {
    try {
      const per = periodo || this.state.periodoAct || '';
      const p = await api(`/api/activos?proyecto=${encodeURIComponent(id)}${forzar ? '&forzar=1' : ''}${per ? '&periodo=' + per : ''}`);
      if (!p.error) this.setState({ pedidos: p });
    } catch (e) { /* la sección de pedidos no se muestra */ }
  }

  async refrescarHist() {
    try {
      const d = await api(`/api/datos?proyecto=${encodeURIComponent(this.state.proyecto)}`);
      if (!d.error) this.setState({ data: d });
    } catch (e) { /* la próxima carga lo trae */ }
  }

  toast(id, text) { this.setState({ toast: { id, text } }); clearTimeout(this._tt); this._tt = setTimeout(() => this.setState({ toast: null }), 5000); }

  decide = async (id, d) => {
    const rec = (this.state.data.recs || []).find(r => r.id === id);
    const r = await api('/api/decisiones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...d, proyecto: this.state.proyecto, quien: 'Juan', foto: rec }) });
    if (r.error) return this.toast(null, r.error);
    this.setState(s => ({ decisions: { ...s.decisions, [id]: r.decision } }));
    this.toast(id, 'Decisión registrada: ' + DEC[d.tipo]);
    this.refrescarHist();
  };
  undo = async id => {
    await fetch('/api/decisiones/' + id, { method: 'DELETE' });
    this.setState(s => { const n = { ...s.decisions }; delete n[id]; return { decisions: n, toast: null }; });
    this.refrescarHist();
  };
  markDone = async id => {
    await fetch(`/api/decisiones/${id}/hecho`, { method: 'POST' });
    this.setState(s => ({ decisions: { ...s.decisions, [id]: { ...s.decisions[id], hecho: true } } }));
    this.refrescarHist();
  };
  openCamp = id => { this.setState({ tab: 'seg', campId: id, allCont: false, allAud: false }); window.scrollTo(0, 0); };

  seg(opts, cur, key) {
    return opts.map(o => ({ label: o, bg: cur === o ? '#3C3C3C' : 'transparent', fg: cur === o ? '#fff' : '#3C3C3C', onClick: () => this.setState({ [key]: o }) }));
  }

  exportCsv(rows) {
    const cols = ['fecha', 'quien', 'proyecto', 'canal', 'camp', 'contenido', 'tipo', 'dec', 'just', 'aplic', 'res', 'lect'];
    const csv = [cols.join(';')].concat(rows.map(r => cols.map(k => '"' + String(r[k] || '').replace(/"/g, '""') + '"').join(';'))).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = 'historial-seguimiento.csv'; a.click();
  }

  renderVals() {
    const s = this.state;
    const data = s.data || { P: { nombre: '', presu: 0, gast: 0, proj: 0, aviso: '', conjuntos: 0, calidadAviso: '', calidad: [], diaMes: 0, diasMes: 0 }, campanas: [], recs: [], hist: [], ejes: [], avisosSilencio: [], frescura: {} };
    const P0 = data.P;
    const decs = s.decisions;
    const CAMPS = data.campanas, RECS = data.recs;
    const campById = Object.fromEntries(CAMPS.map(c => [c.id, c]));
    const inFilter = c => c && (s.canal === 'Ambos' || c.canales.includes(s.canal)) && (s.eje === 'Todos' || c.eje === s.eje);
    const recsAll = RECS.filter(r => !r.silenced || s.unsilenced).filter(r => inFilter(campById[r.camp]));
    const isPend = r => !decs[r.id];
    const enrich = r => { const c = campById[r.camp] || {}; return { ...r, campNombre: c.nombre, eje: c.eje, decision: decs[r.id] || null }; };
    const pendAll = recsAll.filter(isPend);

    const camps = CAMPS.filter(inFilter);
    const problem = c => c.piso === 'No llega' || c.piso === 'En riesgo' || c.estado === 'Sin entrega';
    const rows = camps.slice().sort((a, b) => (problem(b) - problem(a)) || (b.gasto7 - a.gasto7)).map(c => {
      const pr = pendAll.filter(r => r.camp === c.id);
      const alta = pr.filter(r => r.prioridad === 'Alta').length;
      return { ...c, canalTxt: c.canales.join(' e '), estC: EST_C[c.estado] || '#D5D5D5', pisoC: PISO_C[c.piso] || '#D5D5D5', pend: pr.length,
        recBg: alta ? '#F7444C' : '#F4F4F4', recFg: alta ? '#fff' : '#3C3C3C', altaTxt: alta ? `${alta} de prioridad alta` : pr.length ? 'pendientes' : 'sin pendientes',
        open: () => this.openCamp(c.id) };
    });

    const hoy = new Date();
    const P = { ...P0, hasAviso: !!P0.aviso, hasCalidad: (P0.calidad || []).length > 0, mesTxt: `${MESES[hoy.getMonth()]} ${hoy.getFullYear()}` };
    // presupuesto: una tarjeta por canal; con el filtro de canal se muestra solo ese
    const canalesVis = (P0.presupuestos || []).filter(b => s.canal === 'Ambos' || b.canal === s.canal);
    const budgetRows = canalesVis.map(b => {
      const base = b.tienePresu ? b.gastConPresu : b.gast;
      const gastPct = b.presu > 0 ? Math.round(b.gastConPresu / b.presu * 100) : 0;
      const projPct = b.presu > 0 ? Math.round(b.projConPresu / b.presu * 100) : 0;
      const proyectos = (b.proyectos || []).filter(x => x.presu > 0 || x.gast > 0);
      const sub = proyectos.length > 1
        ? proyectos.map(x => `${x.nombre}: ${x.presu > 0 ? money(x.presu) : 'sin presupuesto'}`).join(' · ')
        : `Datos hasta ${fechaCorta(b.datosHasta)}`;
      return {
        canal: b.canal, sub, tienePresu: b.tienePresu,
        figs: [
          { label: 'Presupuesto mensual', value: b.tienePresu ? money(b.presu) : 'sin dato' },
          { label: 'Gastado en el mes', value: money(b.gast) },
          { label: 'Restante del mes', value: b.tienePresu ? money(Math.max(0, b.presu - base)) : '—' },
          { label: 'Proyección al cierre', value: money(b.proj) },
        ],
        gastPct, projPct, gastBar: Math.min(100, gastPct), projBar: Math.min(100, projPct),
        diaTxt: `Datos hasta el día ${b.diaDatos} de ${b.diasMes}`,
        hasAviso: !!b.aviso, aviso: b.aviso,
      };
    });

    // salud y presupuesto de cada activo (planilla de pedidos vs DataJunta)
    const MM = n => (n < 0 ? '-' : '') + '$' + (Math.abs(n || 0) / 1e6).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' M';
    const pctTxt = x => x == null ? '—' : Math.round(x * 100) + ' %';
    const EST_ACT = { 'Gasto sin pedido': '#F7444C', 'Por encima de lo pedido': '#F7444C', 'Se agota antes de fin de mes': '#FCB942', 'Sin gasto reciente': '#FCB942', 'No gastó': '#FCB942', 'Va a sobrar': '#A6AAA9', 'Sobró': '#A6AAA9', 'En ritmo': '#46C678', 'Ejecutado': '#46C678' };
    const ORDEN_EST = Object.keys(EST_ACT);
    const pa = s.pedidos;
    const SA = { visible: !!pa && (pa.activos || []).length > 0, chips: [], filas: [] };
    if (pa) {
      const xs = pa.activos.filter(u => s.canal === 'Ambos' || u.canal === s.canal);
      const cuenta = {}; for (const u of xs) cuenta[u.mes.estado] = (cuenta[u.mes.estado] || 0) + 1;
      SA.chips = [{ label: `Todos (${xs.length})`, estado: null }].concat(ORDEN_EST.filter(e => cuenta[e]).map(e => ({ label: `${e} (${cuenta[e]})`, estado: e })))
        .map(ch => { const on = (s.fEstAct || null) === ch.estado; return { ...ch, c: ch.estado ? EST_ACT[ch.estado] : '#3C3C3C', bg: on ? '#F4F4F4' : '#fff', bc: on ? '#3C3C3C' : '#D5D5D5', onClick: () => this.setState({ fEstAct: ch.estado, verTodosAct: true }) }; });
      const filtrados = s.fEstAct ? xs.filter(u => u.mes.estado === s.fEstAct) : xs;
      const fecha = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '';
      const nota = m => {
        if (m.estado === 'Gasto sin pedido') return `Gastó ${MM(m.gastado)} sin nada pedido en la planilla este mes.`;
        if (m.estado === 'Por encima de lo pedido') return `Va ${MM(m.gastado - m.pedido)} por encima de lo pedido.`;
        if (m.estado === 'Se agota antes de fin de mes') return `Al ritmo de ${MM(m.diario * 7)} por semana se agota el ${fecha(m.agota)}.`;
        if (m.estado === 'Sin gasto reciente') return m.gastado ? `No gasta desde el ${fecha(m.ultimoGasto)}: quedan ${MM(m.restante)} parados.` : `Tiene ${MM(m.pedido)} pedidos y no gastó nada este mes.`;
        if (m.estado === 'No gastó') return `Tenía ${MM(m.pedido)} pedidos y no gastó nada en el mes.`;
        if (m.estado === 'Sobró') return `Sobraron ${MM(m.restante)} (${pctTxt(1 - m.pctEjec)} de lo pedido)${m.diasSinGasto >= 3 ? `; dejó de gastar el ${fecha(m.ultimoGasto)}` : ''}.`;
        if (m.estado === 'Ejecutado') return `Usó el ${pctTxt(m.pctEjec)} de lo pedido.`;
        if (m.estado === 'Va a sobrar') return `Al ritmo actual cierra en ${MM(m.proy)}: sobrarían ${MM(m.pedido - m.proy)}.`;
        return `Cierra en ${MM(m.proy)} al ritmo actual.`;
      };
      const otroMes = x => { const o = (x.resumenMeses || []).find(r => r.periodo !== pa.periodo); return o && (o.pedido || o.gastado) ? `(${MESES[Number(o.periodo.slice(5, 7)) - 1]}: ${o.estado.toLowerCase()}, ${MM(o.gastado)} de ${MM(o.pedido)})` : ''; };
      const vis = (s.verTodosAct || s.fEstAct) ? filtrados : filtrados.filter(u => u.mes.nivel > 0).slice(0, 12);
      SA.filas = vis.map(u => {
        const m = u.mes;
        return { estado: m.estado, c: EST_ACT[m.estado] || '#D5D5D5', nombre: u.nombre,
          sub: `${u.plataforma} · ${u.canal}${u.cuentas.length ? ' · cuenta ' + u.cuentas.join(', ') : ''}${u.agrupada ? ' · agrupada' : ''}${m.pendiente ? ' · ' + MM(m.pendiente) + ' pendientes de aplicar' : ''}`,
          pedido: m.pedido ? MM(m.pedido) : 'sin pedido', gastado: MM(m.gastado), restante: m.pedido ? MM(m.restante) : '—', rc: m.restante < 0 ? '#E9121C' : '#3C3C3C',
          bar: Math.min(100, Math.round((m.pctEjec || (m.gastado ? 1 : 0)) * 100)), mes: Math.round((m.pctMes || 0) * 100),
          ejec: m.pedido ? (m.cerrado ? `${pctTxt(m.pctEjec)} del pedido` : `${pctTxt(m.pctEjec)} con ${pctTxt(m.pctMes)} del mes`) : '—', nota: nota(m) + (otroMes(u) ? ' ' + otroMes(u) : '') };
      });
      SA.hayMas = filtrados.length > vis.length || !!s.verTodosAct;
      SA.toggleLabel = s.verTodosAct ? 'Mostrar solo los que necesitan atención' : `Ver todos los activos (${filtrados.length})`;
      SA.toggle = () => this.setState({ verTodosAct: !s.verTodosAct, fEstAct: null });
      const mesTxt = MESES[Number(pa.periodo.slice(5, 7)) - 1];
      const cerrado = pa.diaDatos && pa.diaDatos >= pa.diasMes;
      SA.sub = `Presupuesto pedido en la planilla contra el gasto de DataJunta, por cuenta publicitaria · ${mesTxt}${cerrado ? ' (mes cerrado)' : ` · datos hasta el día ${pa.diaDatos || '—'} de ${pa.diasMes || '—'}`}`;
      SA.meses = (pa.periodos || []).map(p => ({ label: MESES[Number(p.slice(5, 7)) - 1].replace(/^./, c => c.toUpperCase()), bg: p === pa.periodo ? '#3C3C3C' : 'transparent', fg: p === pa.periodo ? '#fff' : '#3C3C3C', onClick: () => { this.setState({ periodoAct: p, fEstAct: null }); this.cargarPedidos(s.proyecto, false, p); } }));
      SA.totales = pa.porCanal.filter(k => (s.canal === 'Ambos' || k.canal === s.canal) && (k.pedido || k.gastado)).map(k => `${k.canal}: ${MM(k.pedido)} pedidos · ${MM(k.gastado)} gastados · quedan ${MM(k.restante)}`).join('   ·   ');
      SA.pie = 'Unión cuenta ↔ activo: Meta y DV360 por número de cuenta; Google, TikTok y el resto por código de proyecto y grupo. Las cuentas que no se pueden identificar aparecen como "Cuenta N" y se pueden asignar a mano en presupuestos/cuentas_manual.json.';
    }

    // detalle
    const c = s.campId ? campById[s.campId] : null;
    let D = {}, K = {}, B = {}, chart = { bars: [], opts: [] }, rankings = [], campRecs = [];
    if (c) {
      D = { ...c, canalTxt: c.canales.join(' e '), estC: EST_C[c.estado] || '#D5D5D5', pisoC: PISO_C[c.piso] || '#D5D5D5', hasKpi: !!c.kpi,
        hasInsights: (c.insights || []).length > 0,
        insights: (c.insights || []).map(i => ({ ...i, hasRows: !!i.rows, rows: (i.rows || []).map(r => ({ a: r[0], b: r[1], c: r[2], d: r[3] })), hasNota: !!i.nota })) };
      if (c.kpi) {
        const k = c.kpi;
        K = { ...k, resUnit: c.serie.unit.res, vecesTxt: fx(k.veces), vecesC: vc(k.veces), pisoBar: Math.min(k.pisoPct, 100), ritmoC: RITMO_C[k.ritmo] || '#D5D5D5',
          presu: [{ label: 'Presupuesto', value: k.presu }, { label: 'Gastado', value: k.gastado }, { label: 'Restante', value: k.restante }, { label: 'Días restantes', value: k.dias }] };
        B = { ...c.bench, vecesTxt: fx(c.bench.veces), pos: (Math.min(c.bench.veces, 3) / 3 * 100).toFixed(1), c: vc(c.bench.veces) };
        const sr = buildChart(c, s.metric, c.serie.marcas);
        chart = { ...sr, sub: sr.unitLabel + ' · ' + (c.serie.dias.length >= 30 ? 'últimos 30 días' : 'desde el inicio de la campaña'), hasMk: !!sr.mkText, mkText: sr.mkText,
          opts: [['res', sr.resLabel.replace(' por día', '')], ['cost', sr.costLabel]].map(([id, label]) => ({ label, bg: s.metric === id ? '#3C3C3C' : 'transparent', fg: s.metric === id ? '#fff' : '#3C3C3C', onClick: () => this.setState({ metric: id }) })) };
      }
      const rank = (list, all, key, title, sub, map) => {
        const sorted = list.map(map).sort((a, b) => b.v - a.v);
        const nb = Math.min(3, Math.ceil(sorted.length / 2));
        const cols = all ? [{ title: 'Todos, de mejor a peor', items: sorted }] : [{ title: 'Mejores', items: sorted.slice(0, nb) }, { title: 'Peores', items: sorted.slice(nb).slice(-3).reverse() }].filter(x => x.items.length);
        return { title, sub, cols, toggleLabel: all ? 'Ver mejores y peores' : `Ver todos (${sorted.length})`, toggle: () => this.setState({ [key]: !all }) };
      };
      const item = (x, v) => ({ ...x, v, vecesTxt: fx(v), bar: (Math.min(v, 3) / 3 * 100).toFixed(1), c: vc(v) });
      if ((c.cont || []).length) {
        rankings.push(rank(c.cont, s.allCont, 'allCont', 'Mejores y peores contenidos', 'Eficiencia contra la mediana. Solo entran los que superan el piso de volumen mínimo.',
          x => item({ nombre: x[1], sub: x[0] + ' · ' + x[2], meta: [x[3], x[4], 'Gasto ' + x[6]] }, x[5])));
      }
      if ((c.aud || []).length) {
        rankings.push(rank(c.aud, s.allAud, 'allAud', 'Mejores y peores audiencias', 'Ranking de conjuntos (ubicación + segmentación), con el mismo piso de volumen.',
          x => item({ nombre: x[1] + ' · ' + x[2], sub: x[0] + ' · ' + x[3], meta: [x[4], x[5], x[7] === 'api' ? 'Vía API (simulado)' : 'Manual'] }, x[6])));
      }
      campRecs = RECS.filter(r => r.camp === c.id && (!r.silenced || s.unsilenced)).sort((a, b) => b.score - a.score).map(enrich);
    }

    // pestaña recomendaciones
    const tipos = ['Todos', ...Array.from(new Set(RECS.map(r => r.tipo)))];
    const viaMap = { 'API (simulado)': 'api', 'Manual': 'manual', 'PAUTADOR': 'pautador' };
    const list = recsAll.filter(r => {
      const d = decs[r.id];
      if (s.soloPend && d && !(d.tipo === 'aceptada' && r.via === 'manual' && !d.hecho)) return false;
      if (s.fTipo !== 'Todos' && r.tipo !== s.fTipo) return false;
      if (s.fVia !== 'Todas' && r.via !== viaMap[s.fVia]) return false;
      if (s.fConf !== 'Todas' && r.confianza !== s.fConf) return false;
      return true;
    }).sort((a, b) => b.score - a.score).map(enrich);
    let recGroups;
    if (s.agrupar === 'Ninguno') recGroups = [{ hasTitle: false, recs: list }];
    else {
      const key = s.agrupar === 'Eje' ? 'eje' : 'campNombre'; const m = new Map();
      list.forEach(r => { if (!m.has(r[key])) m.set(r[key], []); m.get(r[key]).push(r); });
      recGroups = Array.from(m, ([title, recs]) => ({ hasTitle: true, title, recs, countTxt: recs.length + (recs.length === 1 ? ' recomendación' : ' recomendaciones') }));
    }
    const nApi = pendAll.filter(r => r.via === 'api').length;
    const counter = `${pendAll.length} pendientes · ${nApi} se pueden aplicar vía API (simulado) · ${pendAll.length - nApi} manuales`;
    const silenciados = (data.avisosSilencio || []);
    const silencedText = silenciados.map(a => `Dejé de proponer “${a.tipo}” en ${a.campNombre}: se declinó ${a.n} veces con “es intencional” o “pedido del cliente”.`).join(' ');

    // historial
    const allHist = data.hist || [];
    const histRows = allHist.filter(h => (s.hImpl === 'Todos' || h.quien === s.hImpl) && (s.hDec === 'Todas' || h.dec === s.hDec) && (s.hTipo === 'Todos' || h.tipo === s.hTipo))
      .map(h => ({ ...h, decC: DEC_C[h.dec], hasJust: !!h.just, hasLect: !!h.lect, lectC: h.lectC || '#A6AAA9' }));
    const sel = (label, key, opts) => ({ label, value: s[key], opts, onChange: e => this.setState({ [key]: e.target.value }) });

    const f = data.frescura || {};
    const tab = s.tab;
    return {
      tabs: [['seg', 'Seguimiento'], ['rec', 'Recomendaciones'], ['his', 'Historial']].map(([id, label]) => ({
        label, fw: tab === id ? 600 : 500, bc: tab === id ? '#3C3C3C' : 'transparent', hasCount: id === 'rec' && pendAll.length > 0, count: pendAll.length,
        onClick: () => this.setState({ tab: id, campId: id === 'seg' ? null : s.campId }) })),
      proyecto: s.proyecto || '', proyectos: s.proyectos,
      onProyecto: e => this.cargar(e.target.value),
      canalOpts: this.seg(['Ambos', 'Oficial', 'Informativo'], s.canal, 'canal'),
      eje: s.eje, ejes: ['Todos', ...(data.ejes || [])], onEje: e => this.setState({ eje: e.target.value }),
      frescura: s.data ? `Datos hasta ${fechaCorta(f.datosHasta)} · chequeo de las ${horaDe(f.calculadoEn)} · consultado ${f.consultado || '—'}` : 'Consultando BigQuery…',
      refreshLabel: s.refreshing ? 'Actualizando…' : 'Actualizar',
      onRefresh: () => { if (!s.refreshing && s.proyecto) this.cargar(s.proyecto, true); },
      cargando: s.cargando, hasError: !!s.error, error: s.error,
      showPanel: tab === 'seg' && !c, showDetail: tab === 'seg' && !!c, showRecs: tab === 'rec', showHist: tab === 'his',
      P, budgetRows, SA,
      totals: [{ value: camps.filter(x => ['Activa', 'Por vencer', 'Sin entrega'].includes(x.estado)).length, label: 'Campañas activas' }, { value: canalesVis.reduce((a, b) => a + b.conjuntos, 0), label: 'Conjuntos vivos' }, { value: money(canalesVis.reduce((a, b) => a + b.gasto7, 0)), label: 'Gasto de los últimos 7 días' }, { value: pendAll.length, label: 'Recomendaciones pendientes' }],
      openCalidad: () => this.setState({ calidadOpen: true }), toggleCalidad: () => this.setState({ calidadOpen: !s.calidadOpen }),
      calidadOpen: s.calidadOpen, calidadToggle: s.calidadOpen ? 'Plegar' : 'Desplegar', calidadCount: (P0.calidad || []).length,
      rows, noRows: rows.length === 0 && !s.cargando,
      emptyPanel: 'No hay campañas con estos filtros.',
      backToPanel: () => this.setState({ campId: null }),
      D, K, B, chart, rankings, campRecs, noCampRecs: c ? campRecs.length === 0 : false,
      decide: this.decide, undo: this.undo, markDone: this.markDone, openCamp: this.openCamp,
      counter, showSilenced: silenciados.length > 0 && !s.unsilenced, silencedText, unsilence: () => this.setState({ unsilenced: true }),
      toggleSolo: () => this.setState({ soloPend: !s.soloPend }), soloBg: s.soloPend ? '#3C3C3C' : '#D5D5D5', soloKnob: s.soloPend ? 15 : 3,
      recSelects: [sel('Tipo', 'fTipo', tipos), sel('Vía', 'fVia', ['Todas', 'API (simulado)', 'Manual', 'PAUTADOR']), sel('Confianza', 'fConf', ['Todas', 'Alta', 'Media', 'Baja'])],
      groupOpts: this.seg(['Ninguno', 'Eje', 'Campaña'], s.agrupar, 'agrupar'),
      recGroups, noRecs: list.length === 0,
      histSelects: [sel('Implementador', 'hImpl', ['Todos', ...new Set(allHist.map(h => h.quien))]), sel('Decisión', 'hDec', ['Todas', ...Object.values(DEC)]), sel('Tipo de cambio', 'hTipo', ['Todos', ...new Set(allHist.map(h => h.tipo))])],
      histRows, histCount: `${histRows.length} decisiones`, exportCsv: () => this.exportCsv(histRows),
      hasToast: !!s.toast, toastText: s.toast ? s.toast.text : '', toastUndo: () => s.toast && s.toast.id && this.undo(s.toast.id),
    };
  }
}
