// Prueba de contrato (correr con: node pruebas/contrato.js, después de node armar.js). Tiene que terminar en "problemas 0".
// Prueba de contrato: extrae del template DE SALIDA todas las expresiones {{ }} con su contexto (sc-if / sc-for anidados)
// y verifica que renderVals() las resuelva en cada pantalla, pestaña, período y campaña (primer elemento de cada lista).
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'Seguimiento y Optimizacion.html'), 'utf8');
const template = JSON.parse(html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
const logic = template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
const markup = template.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
// contexto por posición
const ctxs = new Map(); const stack = [];
const re = /<sc-if value="\{\{\s*([^}]+?)\s*\}\}">|<sc-for list="\{\{\s*([^}]+?)\s*\}\}" as="(\w+)"[^>]*>|<\/sc-if>|<\/sc-for>|\{\{\s*([^}]+?)\s*\}\}/g;
let m;
while ((m = re.exec(markup))) {
  if (m[1]) stack.push('if:' + m[1]);
  else if (m[2]) stack.push(`for:${m[2]}(${m[3]})`);
  else if (m[0] === '</sc-if>' || m[0] === '</sc-for>') stack.pop();
  else { const ctx = stack.length ? stack.join(' > ') : '(raíz)'; if (!ctxs.has(ctx)) ctxs.set(ctx, new Set()); ctxs.get(ctx).add(m[4]); }
}
global.localStorage = { getItem: () => null, setItem() {} };
global.window = { innerWidth: 1400, innerHeight: 900, addEventListener() {}, removeEventListener() {}, open() {} };
global.document = { createElement: () => ({ click() {} }) };
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
global.Blob = class { constructor(p) { this.txt = p.join(''); } };
global.prompt = () => '<iframe src="https://lookerstudio.google.com/embed/reporting/abc/page/p1"></iframe>';
class DCLogic { constructor() { this.props = {}; } setState(u) { const p = typeof u === 'function' ? u(this.state) : u; Object.assign(this.state, p); } }
const Component = new Function('DCLogic', logic + '; return Component;')(DCLogic);
const faltan = new Set(); let vistas = 0, checks = 0;
const get = (obj, p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
function scopeDe(vals, ctx) {
  const scope = { ...vals };
  for (const part of ctx.split(' > ')) {
    if (part === '(raíz)') continue;
    const mm = part.match(/^(if|for):(.+?)(?:\((\w+)\))?$/);
    const v = get(scope, mm[2]);
    if (mm[1] === 'if') { if (!v) return null; continue; }
    if (!Array.isArray(v)) { faltan.add(`LISTA ${mm[2]} en ${ctx}`); return null; }
    if (!v.length) return null;
    scope[mm[3]] = v[0];
  }
  return scope;
}
function chequear(vals, etiqueta) {
  vistas++;
  for (const [ctx, exprs] of ctxs) {
    const scope = scopeDe(vals, ctx); if (!scope) continue;
    for (const e of exprs) { if (e === 'true' || (e === 'c.onClick' && ctx === 'for:crumbs(c)')) continue; checks++; const v = get(scope, e);
      if (v === undefined) faltan.add(`${e}  [${ctx}]  (${etiqueta})`);
      else if (typeof v === 'number' && !isFinite(v)) faltan.add(`NaN ${e} [${ctx}] (${etiqueta})`);
      else if (typeof v === 'string' && /NaN|undefined/.test(v)) faltan.add(`texto roto ${e}="${v.slice(0, 60)}" [${ctx}] (${etiqueta})`); }
  }
}
// Alcance real de Meta (regla A3, 30/09): cada período es { sin: motivo } o un dato exacto / rango con sus números
const alcBien = (x) => !!x && (typeof x.sin === 'string' ? x.sin.length > 0 : x.ex === true ? isFinite(x.a) && x.amin === x.a && x.amax === x.a && (x.a === 0 || isFinite(x.f))
  : x.ex === false && x.a == null && isFinite(x.amin) && isFinite(x.amax) && x.amin <= x.amax);
const revisarAlcM = (alcM, periodos, donde) => { if (!alcM) { faltan.add(`alcance de Meta ausente: ${donde}`); return; } for (const per of periodos) if (!alcBien(alcM[per])) faltan.add(`alcance de Meta mal armado (${per}): ${donde} ${JSON.stringify(alcM[per])}`); };
function revisarTarjetaAlcance(vals, donde) {
  const t = (vals.cTiles || []).filter((x) => x.alcM);
  if (t.length !== 1) { faltan.add(`tarjeta de alcance: hay ${t.length} en ${donde}`); return; }
  const x = t[0], hay = ['desde_inicio', 'ultimos_30', 'ultimos_7'].some((k) => x.alcM[k] && !x.alcM[k].sin);
  if (hay && !/^(Llegó a|No llegó)/.test(x.delta)) faltan.add(`tarjeta de alcance con dato sin la frase: ${donde} "${x.delta}"`);
  if (!hay && !/^Sin dato de hoy/.test(x.delta)) faltan.add(`tarjeta de alcance sin dato no dice "Sin dato de hoy": ${donde} "${x.delta}"`);
  if (!hay && x.val !== '—' && !/aproximado/.test(x.label)) faltan.add(`el acumulado de BigQuery no está marcado como aproximado: ${donde}`);
}
const c = new Component();
const D = new Function(logic.match(/const DATA = [\s\S]*?;\n/)[0] + '; return DATA;')();
const TODO_ABIERTO = new Proxy({}, { get: () => true });
for (const canal of ['Oficial', 'Informativo']) {
  Object.assign(c.state, { canal, screen: 'portada', pid: null });
  chequear(c.renderVals(), `portada ${canal}`);
  for (const p of D.proyectos) {
    if (!p.canales[canal]) continue;
    const b = p.canales[canal];
    for (const tab of ['resumen', 'activos', 'ejes', 'campañas', 'audiencias', 'insights', 'looker']) {
      for (const period of Object.keys(b.periodos).slice(0, ['campañas', 'ejes'].includes(tab) ? 7 : 2)) {
        Object.assign(c.state, { screen: 'proyecto', pid: p.id, tab, period, panel: tab === 'resumen', abierto: TODO_ABIERTO, busca: '' });
        chequear(c.renderVals(), `${p.nombre} ${canal} ${tab} ${period}`);
        if (tab === 'ejes') { c.state.busca = 'zzzz-nada'; chequear(c.renderVals(), `${p.nombre} ${canal} ejes filtro vacío`); c.state.busca = ''; }
      }
    }
    for (const id of Object.keys(b.campanas)) for (const campTab of ['Contenidos', 'Audiencias', 'Activos y placements']) {
      Object.assign(c.state, { screen: 'campana', campId: id, campTab, panel: true, panelCamp: id, modal: null });
      const vc = c.renderVals();
      chequear(vc, `${p.nombre} ${canal} campaña ${id} ${campTab}`);
      if (campTab === 'Contenidos') revisarTarjetaAlcance(vc, `${p.nombre} ${canal} ${id}`);
    }
    const conPieza = Object.values(b.campanas).flatMap((x) => x.contenidos).find((x) => x.pieza && (x.pieza.fb || x.pieza.ig || x.pieza.yt));
    if (conPieza) { Object.assign(c.state, { screen: 'proyecto', tab: 'resumen', modal: 'pieza', pieza: conPieza.pieza }); chequear(c.renderVals(), `${p.nombre} ${canal} modal pieza`); }
    Object.assign(c.state, { modal: 'comentar' }); chequear(c.renderVals(), 'modal comentar'); c.state.modal = null;
    if (b.acciones[1]) { Object.assign(c.state, { screen: 'proyecto', tab: 'resumen', panel: true, panelCamp: null, sel: b.acciones[1].id, discardFor: b.acciones[1].id, otraFor: b.acciones[1].id, otraTxt: 'prueba' }); chequear(c.renderVals(), `${p.nombre} ${canal} descartar con Otra`); Object.assign(c.state, { discardFor: null, otraFor: null, otraTxt: '' }); }
    // "Hecho a mano" con motivo (30/09): el panel abierto con un motivo que pide texto, y sin motivo no se confirma
    if (b.acciones[1]) {
      const id1 = b.acciones[1].id, iTxt = 3;
      Object.assign(c.state, { screen: 'proyecto', tab: 'resumen', panel: true, panelCamp: null, sel: id1, discardFor: null, manualFor: id1, manualMot: iTxt, manualTxt: 'prueba' });
      chequear(c.renderVals(), `${p.nombre} ${canal} hecha a mano con motivo`);
      Object.assign(c.state, { manualMot: null, manualTxt: '' }); c.renderVals().cards[0].onManualOk();
      if ((c.state.st[id1] || {}).status === 'manual') faltan.add(`hecha a mano sin motivo se confirmó: ${p.nombre} ${canal}`);
      Object.assign(c.state, { manualMot: iTxt, manualTxt: '  ' }); c.renderVals().cards[0].onManualOk();
      if ((c.state.st[id1] || {}).status === 'manual') faltan.add(`hecha a mano sin el texto obligatorio se confirmó: ${p.nombre} ${canal}`);
      c.resolve(id1, 'discarded', ''); if ((c.state.st[id1] || {}).status === 'discarded') faltan.add(`descarte sin motivo se confirmó: ${p.nombre} ${canal}`);
      Object.assign(c.state, { manualFor: null, manualMot: null, manualTxt: '' });
      const soloMano = b.acciones.find((a) => a.via === 'manual');
      if (soloMano) { Object.assign(c.state, { sel: soloMano.id, panelCamp: null }); const card = c.renderVals().cards.find((x) => x.id === soloMano.id); if (card) { card.onManual(); if (c.state.manualMot == null || !/^Solo se puede hacer a mano/.test(c.renderVals().cards[0].motivosManual[c.state.manualMot].label)) faltan.add(`"Solo se puede hacer a mano" no viene elegido: ${p.nombre} ${canal} ${soloMano.id}`); Object.assign(c.state, { manualFor: null, manualMot: null }); } }
    }
    if (b.acciones[0]) { c.resolve(b.acciones[0].id, 'discarded', 'No aplica'); c.setAct(b.acciones[0].id, { op: 'Sí', comment: 'prueba' }); Object.assign(c.state, { panel: true, panelCamp: null }); chequear(c.renderVals(), `${p.nombre} ${canal} resueltas`); }
    // Looker: pegar link
    Object.assign(c.state, { screen: 'proyecto', tab: 'looker', panel: false }); c.renderVals().pegarLooker(); chequear(c.renderVals(), `${p.nombre} ${canal} looker pegado`);
  }
}
Object.assign(c.state, { screen: 'guia' }); chequear(c.renderVals(), 'guia');
// Reglas vigentes (30/09): con comentarios guardados y un borrador; y lo mismo desde la portada (sin proyecto elegido)
Object.assign(c.state, { respReglas: [{ clase: 'regla', regla: D.reglas.reglas[0].id, comentario: 'prueba', autor: 'Prueba', proyecto: 'Chaco', canal: 'Oficial', recibido: '2026-09-30T12:00:00Z' }, { clase: 'regla', regla: D.reglas.reglas[0].id, comentario: 'sin autor' }], reglaDraft: { [D.reglas.reglas[0].id]: 'borrador' } });
chequear(c.renderVals(), 'guia con comentarios a reglas');
Object.assign(c.state, { pid: null }); chequear(c.renderVals(), 'guia sin proyecto');
Object.assign(c.state, { respReglas: [], reglaDraft: {} });
// una sola fuente: las reglas de la app son las de borrador/reglas-vigentes.js que funcionan, ordenadas por prioridad, sin el número
{
  const rv = require('../../borrador/reglas-vigentes.js').reglasVigentes();
  const esperado = rv.reglas.filter((r) => r.estado === 'Funciona').sort((a, b) => b.prioridad - a.prioridad || Number(a.id.slice(1)) - Number(b.id.slice(1))).map((r) => r.id).join(',');
  const enApp = (D.reglas && D.reglas.reglas || []).map((r) => r.id).join(',');
  if (esperado !== enApp) faltan.add(`reglas vigentes distintas de borrador/reglas-vigentes.js: app ${enApp} · fuente ${esperado}`);
  for (const r of D.reglas.reglas) { if ('prioridad' in r) faltan.add(`la regla ${r.id} lleva el número de prioridad a la app`); if (!r.nombre || !r.cuando || !r.propone || !r.pautador) faltan.add(`regla ${r.id} incompleta`); }
  if (!D.reglas.observacion || !D.reglas.observacion.length) faltan.add('falta la línea "en observación" de las reglas');
  const vistas = c.renderVals().reglasLista; if (vistas.length !== D.reglas.reglas.length) faltan.add('la sección de reglas no muestra todas las vigentes');
}
// "hasta dónde va a llegar" y "solapan público" (30/09): toda campaña Activa o Por vencer trae su llegada (aunque sea "sin dato"),
// y la marca de solapamiento, si viene, trae el total y a lo sumo 3 pares con su texto
for (const p of D.proyectos) for (const [canal, b] of Object.entries(p.canales)) for (const x of Object.values(b.campanas)) {
  if (['Activa', 'Por vencer'].includes(x.estado) && (!x.llegada || (x.llegada.logrado == null && !x.llegada.sinDato))) faltan.add(`llegada ausente: ${p.nombre} ${canal} ${x.id}`);
  if (x.solapan && (!(x.solapan.n > 0) || !x.solapan.pares.length || x.solapan.pares.length > 3 || x.solapan.pares.some((sp) => !sp.texto))) faltan.add(`solapan mal armado: ${p.nombre} ${canal} ${x.id}`);
}
// bloque de alcance de Meta en los datos: estado general, cliente, campaña (dentro de su tarjeta) y contenido
if (!D.alcanceMeta || !['ok', 'parcial', 'sin_dato_de_hoy'].includes(D.alcanceMeta.estado) || !/^\d{4}-\d{2}-\d{2}$/.test(D.alcanceMeta.fecha || '')) faltan.add(`estado de la lectura de alcance mal armado: ${JSON.stringify(D.alcanceMeta)}`);
if (D.alcanceMeta && D.alcanceMeta.estado === 'sin_dato_de_hoy' && !D.alcanceMeta.motivo) faltan.add('sin dato de hoy de alcance y sin motivo');
for (const p of D.proyectos) for (const [canal, b] of Object.entries(p.canales)) {
  revisarAlcM(b.alcM, ['mes_en_curso', 'ultimos_7', 'ultimos_30'], `cliente ${p.nombre} ${canal}`);
  for (const x of Object.values(b.campanas)) {
    const t = (x.tiles || []).find((tt) => tt.alcM);
    revisarAlcM(t && t.alcM, ['desde_inicio', 'ultimos_7', 'ultimos_30'], `campaña ${p.nombre} ${canal} ${x.id}`);
    for (const k of x.contenidos || []) revisarAlcM(k.alcM, ['desde_inicio', 'ultimos_7'], `contenido ${p.nombre} ${canal} ${x.id} ${k.cod}`);
  }
}
c.exportar();
console.log('contextos', ctxs.size, '· vistas', vistas, '· chequeos', checks, '· problemas', faltan.size);
for (const f of [...faltan].slice(0, 40)) console.log(' -', f);
if (faltan.size) process.exitCode = 1;
