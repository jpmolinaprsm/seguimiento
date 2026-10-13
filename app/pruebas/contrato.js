// Prueba de contrato (correr con: node pruebas/contrato.js, después de node armar.js). Tiene que terminar en "problemas 0".
// Prueba de contrato: extrae del template DE SALIDA todas las expresiones {{ }} con su contexto (sc-if / sc-for anidados)
// y verifica que renderVals() las resuelva en cada pantalla, pestaña, período y campaña (primer elemento de cada lista).
const fs = require('fs');
const path = require('path');
// SEGUIMIENTO_SALIDA: probar otro HTML (el armado de actualizar.js antes de cambiarlo). Sin la variable, el de siempre.
const html = fs.readFileSync(process.env.SEGUIMIENTO_SALIDA ? path.resolve(process.env.SEGUIMIENTO_SALIDA) : path.join(__dirname, '..', 'Seguimiento y Optimizacion.html'), 'utf8');
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
const faltan_markup = [];
// 03/10: sin el botón "Ver todo lo que está al aire · 2 Detalle" (a Detalle se pasa con la barra de pasos) y sin Revisar campañas
if (/Ver todo lo que está al aire/.test(markup)) faltan_markup.push('todavía está el botón "Ver todo lo que está al aire"');
if (/>Revisar campañas<\/h2>/.test(markup)) faltan_markup.push('todavía está el bloque Revisar campañas');
// 06/10: los pasos son General › Estructura › Detalle › Looker (Exploración ya no es un paso)
if (/Los números, en Exploración|El recorrido: General › Detalle/.test(logic) || !logic.includes('El recorrido: General › Estructura › Detalle › Looker')) faltan_markup.push('Cómo leer no explica los cuatro pasos en su orden');
if (/2 Detalle|3 Estructura|General, Detalle y Estructura/.test(logic)) faltan_markup.push('algún texto todavía nombra los pasos en el orden viejo');
if (/en las pestañas Campañas, Activos, Ejes, Audiencias y Proyección|\['Revisar campañas', 'Campañas al aire/.test(logic)) faltan_markup.push('Cómo leer todavía describe las pestañas viejas de Detalle o Revisar campañas');
// 06/10: Detalle › Campañas va siempre según objetivo: sin selector de Métrica en esa tabla, rótulo "Cómo rinde (según su objetivo)"
{
  const ini = markup.indexOf('data-screen-label="Proyecto · Campañas"'), sec = markup.slice(ini, markup.indexOf('</main>', ini));
  if (/campKpiOps|marcaKpiOps/.test(sec)) faltan_markup.push('la lista de Campañas todavía tiene un selector de Métrica');
  if (!sec.includes('{{ marcaRotCamp }}') || !sec.includes('{{ campListaTitulo }}')) faltan_markup.push('la lista de Campañas no usa los rótulos fijos según objetivo');
  // la Proyección va abajo de Campañas (las dos en Detalle): su sección está después en el markup
  const iP = markup.indexOf('data-screen-label="Proyecto · Proyección"');
  if (iP < ini) faltan_markup.push('la Proyección no está debajo de Campañas');
  // Estructura tiene el selector de Métrica de la marca arriba de sus tres pestañas
  const iE = markup.indexOf('<sc-if value="{{ pasoEstTablas }}">');
  if (iE < 0 || !markup.slice(iE, iE + 3000).includes('{{ marcaKpiOps }}') || iE > markup.indexOf('<sc-if value="{{ isEjes }}">')) faltan_markup.push('Estructura no tiene el selector de Métrica arriba');
  // Creatividades (06/10) salió de la app: queda solo el link a su plataforma
  // Mapa de Estructura (06/10, A5 · Zonas): primera pestaña de Estructura, antes de las tablas; todo con divs (un {{ }} dentro de un <text> de SVG
  // mete un <span> y no se dibuja); sin SVG; sin alcance; sin el selector Columnas / Libre ni la vista de nodos
  { const iM = markup.indexOf('data-screen-label="Proyecto · Mapa"'), jM = markup.indexOf('data-screen-label="Proyecto · Ejes"'), sM = markup.slice(iM, jM > iM ? jM : undefined);
    if (iM < 0) faltan_markup.push('falta el Mapa de Estructura en el markup');
    if (jM >= 0 && jM < iM) faltan_markup.push('el Mapa tiene que ir antes que las tablas de Estructura');
    const sinIcono = sM.replace(/<svg width="16"[\s\S]*?<\/svg>/, '');
    if (/<svg|<text|<circle|<path/.test(sinIcono)) faltan_markup.push('el Mapa tiene un SVG: los nombres no se dibujan si llevan {{ }} adentro; tiene que ir con divs');
    for (const k of ['mpZones', 'mpEdges', 'mpHlEdges', 'mpDots', 'mpLabels', 'mpPorOps', 'mpLeyenda']) if (!sM.includes('{{ ' + k + ' }}')) faltan_markup.push('al Mapa le falta ' + k);
    if (/mpVistaOps|Columnas|Libre|mpSh\./.test(sM) || /layNodos|layLibre|MP_K_DISENO/.test(logic)) faltan_markup.push('el Mapa todavía tiene la vista de nodos o el selector Columnas / Libre');
    if (!sM.includes('Agrupar campañas por')) faltan_markup.push('falta el selector "Agrupar campañas por"');
    if (/alcanzad|alcance/i.test(sM)) faltan_markup.push('el Mapa habla de alcance'); }
  if (/Proyecto · Creatividades|creaCmp|isCrea/.test(markup) || /creaVals|DATA.creatividades/.test(logic) || /"creatividades":/.test(logic)) faltan_markup.push('todavía queda código o datos de la sección Creatividades');
}
{
  const ini = markup.indexOf('data-screen-label="Proyecto · Campañas"'), fin = markup.indexOf('</main>', ini), sec = markup.slice(ini, fin);
  // 06/10: sin selector (siempre según objetivo); el título de la columna, fijo
  if (!/\{\{ campListaTitulo \}\}/.test(sec) || /list="\{\{ campKpiOps \}\}"/.test(sec)) faltan_markup.push('la lista de Campañas no tiene el título fijo de la columna o todavía tiene el selector de KPI');
  if ((sec.match(/\{\{ r\.kpi\.linea \}\}/g) || []).length !== 1) faltan_markup.push('la lista de Campañas tiene que tener una sola columna de KPI');
  if (/Contra lo normal|KPI principal|General · Proyecto · Propia|r\.lights|r\.kc\./.test(sec)) faltan_markup.push('la lista de Campañas todavía tiene la columna de luces, "KPI principal" o las columnas por KPI');
  if (!/position:sticky;left:0/.test(sec) || !/overflow-x:auto/.test(sec)) faltan_markup.push('la lista de Campañas no tiene scroll propio con el nombre fijo');
  if (!/white-space:nowrap">\{\{ r\.kpi\.p\.txt \}\}/.test(sec) || !/white-space:nowrap">\{\{ r\.kpi\.s\.txt \}\}/.test(sec)) faltan_markup.push('las comparaciones de la celda de KPI pueden cortarse en dos renglones');
  if (!/\{\{ campLeyenda \}\}/.test(sec)) faltan_markup.push('falta la línea que explica la tabla de Campañas');
  // 01/10: el nombre del KPI va en la misma línea que el valor, con el mismo peso ("CPM: $352"); ya no hay un rótulo chico aparte
  if (!/font-weight:\{\{ r\.kpi\.fw \}\};color:\{\{ r\.kpi\.valColor \}\}">\{\{ r\.kpi\.linea \}\}<\/div>/.test(sec)) faltan_markup.push('la celda de KPI no muestra el nombre del KPI en la línea del valor');
  if (/\{\{ r\.kpi\.(nombre|val) \}\}/.test(sec)) faltan_markup.push('la celda de KPI todavía muestra el nombre o el valor sueltos');
  // 01/10: Impresiones y Reacciones después de Gasto y antes del KPI
  if (!/\{\{ campGastoLabel \}\}<\/span><span>Impresiones<\/span><span>Reacciones<\/span>/.test(sec) || !/\{\{ r\.impC \}\}<\/span><span[^>]*>\{\{ r\.reaC \}\}<\/span><div title="\{\{ r\.kpi\.title \}\}"/.test(sec)) faltan_markup.push('faltan las columnas Impresiones y Reacciones entre Gasto y el KPI');
}
// 01/10: Revisar campañas, Contenidos y Audiencias de cada campaña con el mismo formato que la lista de Campañas: selector, Impresiones,
// Reacciones y una sola columna de KPI; sin luces, sin "General", "Luces" ni "Contra lo normal"
{
  const corte = (desde, hasta) => { const i = markup.indexOf(desde); if (i < 0) return ''; const j = hasta ? markup.indexOf(hasta, i + desde.length) : -1; return markup.slice(i, j < 0 ? undefined : j); };
  // 03/10: Revisar campañas se fue (ver arriba)
  const tablas = [['Contenidos', corte('<sc-if value="{{ ctContenidos }}">', '<sc-if value="{{ ctAudiencias }}">'), 'r'], ['Audiencias', corte('<sc-if value="{{ ctAudiencias }}">', '<sc-if value="{{ ctActivos }}">'), 'r']];
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const [nombre, sec, a] of tablas) {
    if (!sec) { faltan_markup.push(`no se encontró la tabla ${nombre}`); continue; }
    if (!/list="\{\{ campKpiOps \}\}"/.test(sec)) faltan_markup.push(`${nombre}: falta el selector de KPI`);
    if (sec.split(`{{ ${a}.kpi.linea }}`).length !== 2) faltan_markup.push(`${nombre}: tiene que tener una sola columna de KPI`);
    if (!sec.includes(`{{ ${a}.impC }}`) || !sec.includes(`{{ ${a}.reaC }}`)) faltan_markup.push(`${nombre}: faltan Impresiones y Reacciones`);
    if (/\.lights|\.gen\.|>General<|>Luces<|Contra lo normal|\{\{ c\.kpiLabel \}\}|audKpiL/.test(sec)) faltan_markup.push(`${nombre}: todavía tiene luces o columnas viejas`);
    if (!new RegExp(esc(`white-space:nowrap">{{ ${a}.kpi.p.txt }}`)).test(sec) || !new RegExp(esc(`white-space:nowrap">{{ ${a}.kpi.s.txt }}`)).test(sec)) faltan_markup.push(`${nombre}: las comparaciones pueden cortarse en dos renglones`);
    if (nombre !== 'Revisar campañas' && !sec.includes('{{ ctLeyenda }}')) faltan_markup.push(`${nombre}: falta la línea que explica la tabla`);
  }
  // Activos: el "% del total" debajo de cada número, en el activo (e) y en la campaña (c)
  const act = corte('data-screen-label="Proyecto · Activos"', '</main>');
  for (const k of ['cont', 'imp', 'vw', 'rea', 'gasto']) if (!act.includes(`{{ e.pc.${k} }}`) || !act.includes(`{{ c.pc.${k} }}`)) faltan_markup.push(`Activos: falta el % del total en ${k}`);
  // 01/10: la columna Campañas de Activos no lleva % (una campaña corre en varios activos y podía sumar más de 100)
  if (act.includes('{{ e.pc.camp }}') || act.includes('{{ c.pc.camp }}')) faltan_markup.push('Activos: la columna Campañas todavía muestra %');
  // 01/10: textos que no se entendían ("pagó … más que lo habitual", "% en rojo", "anuncios rojos") y nombres técnicos, fuera del markup
  for (const [re, que] of [[/más que lo habitual|de más<\/|en rojo<|anuncios rojos|del gasto en rojo/, 'textos viejos de "de más" o "en rojo"'], [/BigQuery|FBADS|automatizado\.|no la prendió/, 'nombres técnicos (tablas, BigQuery)']]) {
    const m2 = markup.match(re); if (m2) faltan_markup.push(`el markup todavía tiene ${que}: "${markup.slice(Math.max(0, m2.index - 60), m2.index + 40).replace(/\s+/g, ' ')}"`);
  }
  // 01/10: Rendimiento de la campaña en tarjetas chicas: sin párrafos (t.small, t.delta), sin "KPI principal", con la etiqueta "objetivo"
  const rend = corte('{{ campRendLinea }}', '{{ campHistTitle }}');
  if (!rend) faltan_markup.push('falta la línea de arriba de Rendimiento');
  else {
    if (/\{\{ t\.(small|delta|lights) \}\}|KPI principal|\{\{ campJuzga \}\}/.test(rend)) faltan_markup.push('Rendimiento todavía tiene párrafos, luces o "KPI principal" en las tarjetas');
    if (!/list="\{\{ t\.lineas \}\}"/.test(rend) || !/>objetivo</.test(rend)) faltan_markup.push('Rendimiento: faltan las líneas cortas o la etiqueta "objetivo"');
    // 02/10: cada línea dice cómo corta (l.ws): las de comparación en una sola línea (lo revisa revisarLuces); las cuentas del alcance, en dos
    if (!/white-space:(nowrap|\{\{ l\.ws \}\})[^"]*">\{\{ l\.txt \}\}/.test(rend)) faltan_markup.push('Rendimiento: las líneas de comparación pueden cortarse en dos renglones');
  }
  // 01/10: General y Todos los proyectos: la etiqueta de canales o proyecto al lado del nombre en Campañas y en Revisar
  const camps = corte('data-screen-label="Proyecto · Campañas"', '</main>');
  if (!camps.includes('{{ r.etq }}')) faltan_markup.push('Campañas: falta la etiqueta de canales o proyecto');
}
global.sessionStorage = { getItem: () => null, setItem() {} };
global.localStorage = { getItem: () => null, setItem() {} };
global.window = { innerWidth: 1400, innerHeight: 900, addEventListener() {}, removeEventListener() {}, open() {} };
global.document = { createElement: () => ({ click() {} }) };
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
global.Blob = class { constructor(p) { this.txt = p.join(''); } };
global.prompt = () => '<iframe src="https://lookerstudio.google.com/embed/reporting/abc/page/p1"></iframe>';
global.React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }), Fragment: 'fragment' };
class DCLogic { constructor() { this.props = {}; } setState(u) { const p = typeof u === 'function' ? u(this.state) : u; Object.assign(this.state, p); } }
const Component = new Function('DCLogic', logic + '; return Component;')(DCLogic);
const MP = new Function('DCLogic', logic + '; return { mpPrep };')(DCLogic);
const faltan = new Set(); let vistas = 0, checks = 0;
for (const f of faltan_markup) faltan.add(f);
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
// Luces (decisión de Juan Pablo del 01/10): a lo sumo dos (proyecto y la misma campaña), sin las etiquetas viejas ni "×", y cada
// frase completa dice contra qué compara
const ETIQ_VIEJA = /(General|Propia|Proyecto|Temporada anterior)|×/;
const CONTRA_QUE = /lo normal en |esta campaña|^Sin referencia en |^Poca historia|^Todavía no/;
function revisarLuces(vals, etiqueta) {
  const ls = [];
  // 01/10: Revisar campañas, Contenidos y Audiencias ya no tienen luces (tienen la columna de KPI)
  for (const [donde, xs] of [['Revisar', vals.badCamps], ['Contenidos', vals.contenidos], ['Audiencias', vals.audiencias]]) for (const r of xs || []) if (r.lights || r.gen) faltan.add(`${donde} todavía trae luces: ${r.name} (${etiqueta})`);
  // 01/10: tarjetas chicas: nombre, valor y hasta dos líneas cortas ("vs. Santa Fe $105 · −60 %", "vs. sem. ant. $84 · −83 %"); la del objetivo marcada
  const tiles = vals.cTiles || [];
  if (tiles.length && tiles.filter((t) => t.kpi).length > 1) faltan.add(`más de una tarjeta marcada como objetivo (${etiqueta})`);
  const CORTA = /^(vs\. [^·]+ (\$[\d.,]+|[\d.,]+ %) · (0|[+−]\d+) %|sin referencia en .+|sin (semanas anteriores|temporada pasada)|(sem\. ant\.|temp\. pas\.): poca historia|poca historia: .+|sin dato de Meta|[\d.,]+( a [\d.,]+)? veces por persona|.{1,45})$/;
  for (const t of tiles) {
    tilesVistas++;
    if (t.lights || 'small' in t || 'delta' in t && !t.alcM) faltan.add(`tarjeta con párrafos o luces: ${t.label} (${etiqueta})`);
    if (!t.alcM && t.label !== 'CPM de Alcance' && (t.lineas || []).some((l) => l.ws !== 'nowrap')) faltan.add(`tarjeta con líneas que se cortan en dos renglones: ${t.label} (${etiqueta})`);
    if (t.alcM) continue;   // Personas alcanzadas: la revisa revisarTarjetaAlcance (por cuenta lleva una línea por cuenta)
    // la comparación con la misma campaña va con el valor de las dos últimas semanas arriba (01/10): en esa tarjeta, hasta tres líneas
    const SEM_V = /^(últ\. 2 sem\.|esta temp\.|este mes) (\$[\d.,]+|[\d.,]+ %)$/, SEM_C = /^vs\. (sem\. ant|temp\. pas)\. /;
    const conSem = (t.lineas || []).findIndex((l) => SEM_V.test(l.txt || ''));
    if (conSem >= 0) { semValor++; if (!SEM_C.test((t.lineas[conSem + 1] || {}).txt || '')) faltan.add(`tarjeta: "últ. 2 sem." sin la comparación debajo: ${t.label} (${etiqueta})`); }
    if ((t.lineas || []).some((l) => SEM_C.test(l.txt || '')) && conSem < 0) faltan.add(`tarjeta: "vs. sem. ant." sin el valor de las dos últimas semanas: ${t.label} (${etiqueta})`);
    // CPM de Alcance: 'últimos 30 días' + una línea por cuenta (nunca sumadas) + la nota fija 'Corre en N cuentas: Meta no junta…' (esa nota es larga a propósito y no se mide)
    if (!Array.isArray(t.lineas) || t.lineas.length > (t.label === 'CPM de Alcance' ? 1 + 8 : conSem >= 0 ? 3 : 2)) { faltan.add(`tarjeta con más de dos líneas: ${t.label} (${etiqueta})`); continue; }
    for (const l of t.lineas) { const nota = t.label === 'CPM de Alcance' && /^Corre en \d+ cuentas: Meta no junta a las personas entre cuentas, por eso no se suma\.$/.test(l.txt || ''); if (nota) continue; if (!CORTA.test(l.txt || '') || (l.txt || '').length > 45) faltan.add(`línea de tarjeta larga o mal escrita: ${t.label} "${l.txt}" (${etiqueta})`); if (!l.title) faltan.add(`línea de tarjeta sin la frase completa al pasar el mouse: ${t.label} (${etiqueta})`); if (/^vs\. /.test(l.txt)) lineasTile++; }
    if (/^vs\. /.test((t.lineas[0] || {}).txt || '') && /[▲▼]/.test(t.lineas[0].txt)) faltan.add(`línea de tarjeta con flecha: ${t.label}`);
  }
  for (const [donde, l] of ls) {
    for (const t of [l.txt, l.title, l.num].filter((x) => typeof x === 'string')) if (ETIQ_VIEJA.test(t)) faltan.add(`luz con etiqueta vieja: ${donde} "${t}" (${etiqueta})`);
    if (!CONTRA_QUE.test(l.title || '') && !/^(En las últimas|En lo que va|En Meta|Mostrar el anuncio)/.test(l.title || '')) faltan.add(`luz sin decir contra qué compara: ${donde} "${l.title}" (${etiqueta})`);
  }
}
// Lista de Campañas (decisiones de Juan Pablo del 01/10): una sola columna de KPI con selector (Según objetivo o un KPI para todas);
// cada comparación lleva su valor de referencia entre paréntesis y el proyecto se nombra siempre igual; color solo con "peor"/"mejor"
const COLS_KPI = [['cr', 'Costo por reacción'], ['cpm', 'CPM'], ['ctr', 'CTR'], ['etrV', 'ETR Videos'], ['etrI', 'ETR Imágenes'], ['ca', 'CPM de Alcance'], ['cv', 'Costo por reproducción']];
const KPI_DEL_OBJ = { Interacción: 'cr', Alcance: 'cpm', Reproducciones: 'cv', Tráfico: 'ctr', Conversión: 'ctr' };
const COMPARA = /^vs\. .+ \((\$[\d.,]+|[\d.,]+ %)\): (0|[+−]\d+) %( [▲▼] (peor|mejor))?$/;
let juntaActual = null;
let tilesVistas = 0, lineasTile = 0, semValor = 0, revisarVistas = 0, tecnicos = 0;
let celdasRevisadas = 0, conCpmAlcance = 0, cvVistas = 0, cvComparadas = 0, contraCamp = 0;
// CTR de la parte de Google de Tráfico (02/10): renglones por red, contra lo normal de esa red; ejemplos reales para el informe
const GG = { renglones: 0, conRef: 0, sinRef: 0, solo: 0, revisarPorGoogle: 0, ejemplos: {} };
const GG_COMP = /^vs\. lo normal de (Search|Display|YouTube|Gmail|Discover|DV360|[^ ]+) en .+ \([\d.,]+ %\): (0|[+−]\d+) %( [▲▼] (peor|mejor))?$/;
const GG_SIN = /^sin referencia en [^:]+: todavía hay pocos casos$/;
const kpiVistos = new Set(), kpiVistosT = new Set(), porTabla = {};
// Activos (01/10): debajo de cada número, "N % del proyecto" (activo) o "N % de la campaña" (campaña dentro del activo), sin pasar de 100
const PCT = /^(menos de 1|\d{1,3}) % (del proyecto|del total|de la campaña)$/;
let pctVistos = 0;
function revisarPct(vals, etiqueta) {
  const suma = {};
  for (const e of vals.arbolActivos || []) {
    for (const [k, t] of Object.entries(e.pc || {})) { if (!t) continue; pctVistos++; if (k === 'camp') faltan.add(`Activos: la columna Campañas muestra % (${etiqueta})`); if (!PCT.test(t) || !/(del proyecto|del total)$/.test(t) || Number(t.split(' ')[0]) > 100) faltan.add(`Activos: % del activo mal escrito: ${e.name} ${k} "${t}" (${etiqueta})`); suma[k] = (suma[k] || 0) + (Number(t.split(' ')[0]) || 0); }
    for (const c2 of e.kids || []) for (const [k, t] of Object.entries(c2.pc || {})) { if (!t) continue; pctVistos++; if (!PCT.test(t) || !t.endsWith('de la campaña') || Number(t.split(' ')[0]) > 100) faltan.add(`Activos: % de la campaña mal escrito: ${e.name} › ${c2.name} ${k} "${t}" (${etiqueta})`); }
  }
  // los activos no pueden sumar más que el proyecto (margen: redondeo de un punto por activo)
  for (const [k, v] of Object.entries(suma)) if (k !== 'camp' && k !== 'cont' && v > 100 + (vals.arbolActivos || []).length) faltan.add(`Activos: los % del proyecto suman ${v} en ${k} (${etiqueta})`);
}
function revisarColumnas(vals, etiqueta, sel) {
  const proy = vals.refNombre || vals.projName;
  if (vals.isCampanas) {
    // 06/10: la lista de Campañas va siempre según objetivo (el selector sigue en Contenidos y Audiencias de cada campaña)
    if (vals.campListaTitulo !== 'Métrica según su objetivo' || !vals.campListaAyuda) faltan.add(`título de la columna de KPI de Campañas "${vals.campListaTitulo}" (${etiqueta})`);
    if (vals.marcaRotCamp !== 'Cómo rinde (según su objetivo)') faltan.add(`rótulo de la marca en Campañas "${vals.marcaRotCamp}" (${etiqueta})`);
  }
  if (vals.isCampana) {
    const ops = (vals.campKpiOps || []).map((o) => o.label).join(' · ');
    if (ops !== 'Según objetivo · ' + COLS_KPI.map(([, t]) => t).join(' · ')) faltan.add(`selector de KPI de la ficha distinto del pedido: ${ops}`);
  }
  const tablas = [['campañas', vals.campRows], ['revisar', vals.badCamps], ['contenidos', vals.contenidos], ['audiencias', vals.audiencias]];
  for (const [tabla, filas] of tablas) for (const r of filas || []) {
    const selT = tabla === 'campañas' ? 'obj' : sel;   // 06/10: Campañas, siempre según objetivo
    if (r.lights) faltan.add(`la tabla ${tabla} todavía trae luces: ${r.name} (${etiqueta})`);
    const objT = tabla === 'contenidos' || tabla === 'audiencias' ? vals.campObj : r.obj;
    const x = r.kpi;
    // cobertura de referencias en las vistas que juntan (01/10): celdas con valor (sin CPM de Alcance) que dicen "vs. …" contra lo normal
    if (juntaActual && (tabla === 'campañas' || tabla === 'revisar') && x && x.k !== 'ca' && !/^(no aplica|sin |—)/.test(x.val || '')) {
      const o = COBERTURA[juntaActual] = COBERTURA[juntaActual] || { n: 0, con: 0, sinMeta: 0, sinCasos: 0, porK: {} }, ok = x.hasP && /^vs\. /.test(x.p.txt);
      const pk = o.porK[x.k] = o.porK[x.k] || { n: 0, con: 0 }; o.n++; pk.n++;
      if (ok) { o.con++; pk.con++; } else if (/no tiene Meta/.test(x.p.title || '')) o.sinMeta++; else o.sinCasos++;
    }
    if (!x || typeof x !== 'object') { faltan.add(`fila sin la celda de KPI: ${r.name} (${etiqueta})`); continue; }
    const k = selT === 'obj' ? KPI_DEL_OBJ[objT] || 'cpm' : selT; celdasRevisadas++; porTabla[tabla] = (porTabla[tabla] || 0) + 1; if (tabla === 'campañas') kpiVistos.add(x.k); else kpiVistosT.add(`${tabla}|${x.k}`);
    if (x.k !== k) faltan.add(`la celda muestra ${x.k} y tenía que mostrar ${k}: ${r.name} (${etiqueta})`);
    if (x.hasNombre !== (selT === 'obj') || (selT === 'obj' && x.nombre !== (COLS_KPI.find(([kk]) => kk === k) || [])[1])) faltan.add(`nombre del KPI en la celda mal: ${r.name} "${x.nombre}" (${etiqueta})`);
    if (typeof x.val !== 'string' || !x.val || /NaN|undefined|Infinity/.test(x.val)) { faltan.add(`celda ${k} mal armada: ${r.name} (${etiqueta}) ${JSON.stringify(x.val)}`); continue; }
    if ('bg' in x) faltan.add(`la celda de KPI todavía tiene fondo: ${r.name}`);
    // el nombre del KPI en la línea del valor, con cualquier opción del selector
    const nomK = (COLS_KPI.find(([kk]) => kk === k) || [])[1];
    if (x.linea !== `${nomK}: ${x.val}`) faltan.add(`la línea del valor no dice "${nomK}: …": ${r.name} "${x.linea}" (${etiqueta})`);
    // parte de Google en CTR: solo en la celda de CTR, cada renglón con su red y su valor, contra lo normal de esa misma red (nunca "GG")
    if (x.hasG || (x.gs && x.gs.length)) {
      if (x.k !== 'ctr') faltan.add(`renglón de Google fuera de la celda de CTR: ${r.name} (${etiqueta})`);
      for (const g of x.gs || []) { GG.renglones++; const m = (g.txt || '').match(/^([^:]+): ([\d.,]+ %) · (.+)$/);
        if (!m) { faltan.add(`renglón de Google sin red y valor: ${r.name} "${g.txt}" (${etiqueta})`); continue; }
        if (/\bGG\b/.test(g.txt)) faltan.add(`renglón de Google con el código GG: ${r.name} "${g.txt}"`);
        if (GG_COMP.test(m[3])) { GG.conRef++; if (!m[3].startsWith(`vs. lo normal de ${m[1]} en `)) faltan.add(`renglón de Google contra otra red: ${r.name} "${g.txt}"`); if (/▲|▼/.test(m[3]) !== (g.color !== '#808080')) faltan.add(`color sin peor/mejor o al revés (Google): ${r.name} "${g.txt}"`);
          if (proy === 'todos los proyectos' && !m[3].includes(' en todos los proyectos (')) faltan.add(`panel: la parte de Google no va contra todos los proyectos: ${r.name} "${g.txt}" (${etiqueta}, ${tabla})`); }
        else if (GG_SIN.test(m[3])) GG.sinRef++; else faltan.add(`renglón de Google mal escrito: ${r.name} "${g.txt}" (${etiqueta})`);
        const ek = `${juntaActual || 'canal'}|${GG_SIN.test(m[3]) ? 'sin' : 'con'}`; if (!GG.ejemplos[ek]) GG.ejemplos[ek] = `${r.name} (${etiqueta}) · ${x.linea} · ${x.hasP ? x.p.txt : ''} · ${g.txt}`; }
    }
    if (x.k === 'ctr' && x.hasP && /^(vs\. lo normal de |sin referencia en [^:]+: todavía)/.test(x.p.txt)) { GG.solo++; if (!GG.ejemplos.solo) GG.ejemplos.solo = `${r.name} (${etiqueta}) · ${x.linea} · ${x.p.txt}`; }
    if (tabla === 'revisar' && !((x.hasP && x.p.color === '#D3222A') || (x.hasS && x.s.color === '#D3222A')) && (x.gs || []).some((g) => g.color === '#D3222A')) GG.revisarPorGoogle++;
    if (tabla === 'revisar') { revisarVistas++; if (!((x.hasP && x.p.color === '#D3222A') || (x.hasS && x.s.color === '#D3222A') || (x.gs || []).some((g) => g.color === '#D3222A'))) faltan.add(`Revisar muestra una campaña sin "peor" en su celda: ${r.name} (${etiqueta})`);
      if (r.demas && !/^\$[\d.,]+ (M|k) de más vs\. (el (CPM|costo por (reacción|click|reproducción)) normal|los costos normales) de .+$/.test(r.demasTxt || '')) faltan.add(`Revisar: "de más" mal escrito: ${r.name} "${r.demasTxt}"`);
      if (r.demas && !/^Le costó .+ más que si hubiera pagado /.test(r.demasTitle || '')) faltan.add(`Revisar: falta la frase completa de "de más": ${r.name}`);
      if (!/del gasto en anuncios flojos$|^sin dato de anuncios flojos$/.test(r.ef.corto || '')) faltan.add(`Revisar: eficacia mal escrita: ${r.name} "${r.ef.corto}"`); }
    if (tabla === 'campañas' && r.demas && (!/^\$[\d.,]+ (M|k) de más vs\. /.test(r.demasTxt || '') || !/^Le costó /.test(r.demasTitle || ''))) faltan.add(`Campañas: "de más" mal escrito: ${r.name} "${r.demasTxt}"`);
    if (k === 'cv' && tabla === 'campañas') { cvVistas++; if (x.val !== 'sin reproducciones' && x.hasP && /^vs\. /.test(x.p.txt)) cvComparadas++; }
    // Impresiones y Reacciones: números cortos; solo Stories, "no aplica (Stories)"
    const CANT = /^(\d{1,3}( mil)?|\d+(,\d)? M|\d{1,3}(\.\d{3})* mil|\d{1,3}(\.\d{3})*(,\d)? M)$/;
    if (!CANT.test(r.impC || '')) faltan.add(`Impresiones mal escritas: ${r.name} "${r.impC}" (${etiqueta})`);
    if (r.st ? r.reaC !== 'no aplica (Stories)' : !CANT.test(r.reaC || '')) faltan.add(`Reacciones mal escritas: ${r.name} "${r.reaC}" (${etiqueta})`);
    if (k === 'ca') { revisarCeldaCa(x, `${r.name} (${etiqueta}, ${tabla})`); continue; }
    if (x.hasC || (x.cs && x.cs.length)) faltan.add(`renglones por cuenta fuera del CPM de Alcance: ${r.name} (${etiqueta})`);
    if (/^(no aplica|sin |—)/.test(x.val)) { if (x.hasP || x.hasS) faltan.add(`celda ${k} sin valor pero con comparaciones: ${r.name} (${etiqueta})`); continue; }
    if (!x.hasP || !x.hasS) faltan.add(`celda ${k} sin sus dos renglones: ${r.name} (${etiqueta})`);
    for (const [cual, l] of [['proyecto', x.p], ['misma campaña', x.s]]) {
      if (!l || !l.txt) continue;
      const esComp = /^vs\. /.test(l.txt);
      if (esComp && !COMPARA.test(l.txt)) faltan.add(`comparación sin valor de referencia o mal escrita (${cual}, ${k}): ${r.name} "${l.txt}" (${etiqueta})`);
      if (esComp && /▲|▼/.test(l.txt) !== (l.color !== '#808080')) faltan.add(`color sin peor/mejor o al revés (${cual}, ${k}): ${r.name} "${l.txt}"`);
      if (cual === 'proyecto' && !(l.txt.startsWith(`vs. ${proy} (`) || l.txt === `sin referencia en ${proy}` || (k === 'ctr' && (GG_COMP.test(l.txt) || GG_SIN.test(l.txt))))) faltan.add(`la comparación con el proyecto no dice "vs. ${proy} (": ${r.name} "${l.txt}"`);
      if (cual === 'misma campaña' && (tabla === 'contenidos' || tabla === 'audiencias')) { if (!/^(vs\. la campaña \(|sin referencia en la campaña$)/.test(l.txt)) faltan.add(`${tabla}: la segunda comparación tiene que ser contra la campaña (${k}): ${r.name} "${l.txt}" (${etiqueta})`); if (/^vs\. la campaña/.test(l.txt)) contraCamp++; continue; }
      if (cual === 'misma campaña' && !/^(vs\. (semanas anteriores|temporada pasada) \(|sin (semanas anteriores|temporada pasada)$|(semanas anteriores|temporada pasada): no en este período$)/.test(l.txt)) faltan.add(`comparación con la misma campaña mal escrita (${k}): ${r.name} "${l.txt}"`);
    }
  }
}
const VIEJO = /pagó .{1,20} más que lo habitual|% en rojo|del gasto en rojo|anuncios rojos/, TECNICO = /BigQuery|FBADS|automatizado\.|no la prendió/;
function textosVisibles(v, out, prof) { if (prof > 7 || v == null) return; if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach((x) => textosVisibles(x, out, prof + 1)); else if (typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!['acciones', 'alcM', 'kc', 'pieza', 'embeds', 'icon', 'plats', 'codes', 'o', 'efRaw'].includes(k) && typeof x !== 'function') textosVisibles(x, out, prof + 1); }
function chequear(vals, etiqueta) {
  { const ts = []; for (const k of ['campRows', 'badCamps', 'cTiles', 'histStats', 'contenidos', 'audiencias', 'campEf', 'campDemasTxt', 'campDemasCorto', 'crendAyuda', 'campRendLinea', 'listItems', 'insEf', 'guiaMet', 'guiaSrc', 'guiaBlocks', 'guiaRefs', 'arbolEjes', 'arbolAuds', 'arbolActivos', 'projects', 'llegada', 'llegAyuda', 'campKpiAyuda', 'guiaKpi']) textosVisibles(vals[k], ts, 0);
    for (const t of ts) { if (SUMA_ALC.test(t)) faltan.add(`alcance sumado, en rango o acumulado en pantalla: "${t.slice(0, 110)}" (${etiqueta})`); if (VIEJO.test(t)) faltan.add(`texto viejo visible: "${t.slice(0, 90)}" (${etiqueta})`); if (TECNICO.test(t)) { tecnicos++; if (tecnicos < 4) console.log("técnico:", t.slice(0, 200)); faltan.add(`texto técnico visible: "${t.slice(0, 90)}" (${etiqueta})`); } } }
  vistas++; revisarLuces(vals, etiqueta); revisarColumnas(vals, etiqueta, c.state.kpiSel); revisarPct(vals, etiqueta);
  for (const [ctx, exprs] of ctxs) {
    const scope = scopeDe(vals, ctx); if (!scope) continue;
    for (const e of exprs) { if (e === 'true' || (e === 'c.onClick' && ctx === 'for:crumbs(c)')) continue; checks++; const v = get(scope, e);
      if (v === undefined) faltan.add(`${e}  [${ctx}]  (${etiqueta})`);
      else if (typeof v === 'number' && !isFinite(v)) faltan.add(`NaN ${e} [${ctx}] (${etiqueta})`);
      else if (typeof v === 'string' && /NaN|undefined/.test(v)) faltan.add(`texto roto ${e}="${v.slice(0, 60)}" [${ctx}] (${etiqueta})`); }
  }
}
// Alcance real de Meta (regla A3; 02/10: NUNCA se suma). Cada período es { a, f, d, h } (una cuenta), { pc: [{ c, a, f }] } (por cuenta,
// de mayor a menor, al menos dos, sin total), { sin, spc: true, ci, cc } (sin dato por cuenta todavía, con las que sí tienen dato) o { sin }
const cuentaBien = (i) => !!i && typeof i.c === 'string' && i.c.length > 0 && isFinite(i.a) && (i.a === 0 || isFinite(i.f)) && !('pc' in i);
const ordenadas = (xs) => xs.every((i, n) => !n || xs[n - 1].a >= i.a);
const alcBien = (x) => !!x && (typeof x.sin === 'string' ? x.sin.length > 0 && !('a' in x) && !('pc' in x) && (!x.spc || (Array.isArray(x.cc) && x.cc.every(cuentaBien) && ordenadas(x.cc) && Array.isArray(x.ci) && x.ci.length >= 2))
  : Array.isArray(x.pc) ? x.pc.length >= 2 && x.pc.every(cuentaBien) && ordenadas(x.pc) && !('a' in x)
  : isFinite(x.a) && (x.a === 0 || isFinite(x.f)));
// el alcance nunca se suma (02/10): ningún rango, mínimo, máximo, "puede contar de más" ni alcance acumulado, ni en los datos ni en pantalla
const CLAVES_SUMA = new Set(['amin', 'amax', 'fmin', 'fmax', 'vmin', 'vmax', 'alcance_min', 'alcance_max', 'frecuencia_min', 'frecuencia_max', 'puede_contar_de_mas', 'alc', 'ex']);
const SUMA_ALC = /entre [\d.]+ y [\d.]+ personas|personas alcanzadas[^.]{0,30}\bentre\b|alcance (diario )?acumulado|acumulad[oa]s?[^.]{0,40}\balcance|\balcance[^.]{0,40}acumulad|puede contar de más|la suma de todas|frecuencia diaria/i;
let clavesSuma = 0;
function buscarClavesSuma(v, donde, prof) {
  if (!v || typeof v !== 'object' || prof > 14) return;
  if (Array.isArray(v)) { for (const x of v) buscarClavesSuma(x, donde, prof + 1); return; }
  for (const [k, x] of Object.entries(v)) { if (CLAVES_SUMA.has(k)) { clavesSuma++; if (clavesSuma < 6) faltan.add(`dato de alcance con rango o suma ("${k}") en ${donde}`); } buscarClavesSuma(x, donde + '.' + k, prof + 1); }
}
// celda de CPM de Alcance: un valor (una cuenta) con "sin referencia todavía"; "por cuenta" con un renglón por cuenta y la nota de por qué
// no se suma; "sin dato por cuenta todavía" con las cuentas que sí tienen dato; o "sin dato". Nunca un rango ni un CPM combinado
const CA_CUENTA = /^[^:]+: (\$[\d.,]+|sin dato)$/, CA_NOTA = /^Corre en (\d+) cuentas: Meta no junta a las personas entre cuentas, por eso no se suma\.$/;
let caPorCuenta = 0, caSinPorCuenta = 0;
function revisarCeldaCa(x, donde) {
  if (x.hasS) faltan.add(`CPM de Alcance con comparación propia: ${donde}`);
  if (/ a \$|\$[\d.,]+ a /.test(x.val)) faltan.add(`CPM de Alcance en rango: ${donde} "${x.val}"`);
  if (x.hasG || (x.gs && x.gs.length)) faltan.add(`CPM de Alcance con renglones de Google: ${donde}`);
  const cs = x.hasC ? x.cs || [] : [];
  for (const t of [x.val, x.title || '', ...cs.map((l) => l.txt + ' ' + l.title)]) if (SUMA_ALC.test(t) || /toda la cuenta/i.test(t)) faltan.add(`CPM de Alcance con suma, rango o el alcance de toda la cuenta: ${donde} "${t.slice(0, 100)}"`);
  if (x.val === 'por cuenta') {
    caPorCuenta++;
    const m = cs.length ? CA_NOTA.exec(cs[cs.length - 1].txt) : null;
    if (x.hasP || cs.length < 3 || !m || Number(m[1]) !== cs.length - 1 || !cs.slice(0, -1).every((l) => CA_CUENTA.test(l.txt) && l.title)) faltan.add(`CPM de Alcance por cuenta mal armado: ${donde} ${JSON.stringify(cs.map((l) => l.txt))}`);
  } else if (x.val === 'sin dato por cuenta todavía') {
    caSinPorCuenta++;
    if (x.hasP || !cs.every((l) => CA_CUENTA.test(l.txt))) faltan.add(`CPM de Alcance sin dato por cuenta mal armado: ${donde} ${JSON.stringify(cs.map((l) => l.txt))}`);
  } else if (x.val === 'sin dato') { if (x.hasP || cs.length) faltan.add(`CPM de Alcance "sin dato" con comparaciones o cuentas: ${donde}`); }
  else { conCpmAlcance++; if (!/^\$[\d.,]+$/.test(x.val)) faltan.add(`CPM de Alcance mal escrito: ${donde} "${x.val}"`); if (!x.hasP || x.p.txt !== 'sin referencia todavía') faltan.add(`CPM de Alcance sin "sin referencia todavía": ${donde}`); if (cs.length) faltan.add(`CPM de Alcance de una cuenta con renglones por cuenta: ${donde}`); }
}
const revisarAlcM = (alcM, periodos, donde) => { if (!alcM) { faltan.add(`alcance de Meta ausente: ${donde}`); return; } for (const per of periodos) if (!alcBien(alcM[per])) faltan.add(`alcance de Meta mal armado (${per}): ${donde} ${JSON.stringify(alcM[per])}`); };
// per (02/10): el período de la lectura de Meta que corresponde a la opción elegida del panel (Este mes / Histórica): uno solo
const ALC_CORTO_T = { ultimos_7: 'últ. 7 días', ultimos_30: 'últ. 30 días' };
function revisarTarjetaAlcance(vals, donde, per = 'desde_inicio') {
  const t = (vals.cTiles || []).filter((x) => x.alcM);
  if (t.length !== 1) { faltan.add(`tarjeta de alcance: hay ${t.length} en ${donde}`); return; }
  const cual = ALC_CORTO_T[per] ? ` · ${ALC_CORTO_T[per]}` : '';
  const x = t[0], hay = [per].some((k) => x.alcM[k] && !x.alcM[k].sin);
  // 03/10: con una lectura que no es de hoy, "Personas alcanzadas · al dd/mm"
  if (!/^Personas alcanzadas( · al \d\d\/\d\d)?$/.test(x.label)) faltan.add(`la tarjeta de alcance no se llama "Personas alcanzadas": ${donde} "${x.label}"`);
  if (hay && !/^(Llegó a|No llegó|Corre en \d+ cuentas)/.test(x.title)) faltan.add(`tarjeta de alcance con dato sin la frase al pasar el mouse: ${donde}`);
  const spc = !hay && [per].some((k) => x.alcM[k] && x.alcM[k].spc);
  const porCuenta = hay && /^Corre en \d+ cuentas/.test(x.title);
  const LINEA_CUENTA = /^[^:]+: [\d.]+ personas · [\d,—]+ veces$/;
  if (!hay && !spc && (x.val !== '—' || !x.lineas.length || x.lineas[0].txt !== 'sin dato de Meta')) faltan.add(`tarjeta de alcance sin dato no dice "—" y "sin dato de Meta": ${donde} "${x.val}"`);
  const FALTA = /^(falta [^,]+|faltan [^,]+ y [^,]+|faltan \d+ cuentas)$/;
  if (spc && (x.val !== '—' || x.lineas[0].txt !== 'sin dato por cuenta todavía' + cual || !x.lineas.slice(1).every((l, i) => LINEA_CUENTA.test(l.txt) || (i === 0 && FALTA.test(l.txt))))) faltan.add(`tarjeta de alcance sin dato por cuenta mal armada: ${donde} ${JSON.stringify(x.lineas.map((l) => l.txt))}`);
  if (porCuenta) { const n = Number(x.title.match(/^Corre en (\d+)/)[1]), ls = x.lineas.map((l) => l.txt);
    if (x.val !== `${n} cuentas` || ls.length !== n + 1 || !ls.slice(0, n).every((t) => LINEA_CUENTA.test(t)) || ls[n] !== `Corre en ${n} cuentas${cual ? ` (${ALC_CORTO_T[per]})` : ''}: Meta no junta a las personas entre cuentas, por eso no se suma.`) faltan.add(`tarjeta de alcance por cuenta mal armada: ${donde} ${JSON.stringify(ls)}`); }
  if (hay && !porCuenta && (x.lineas.length !== 1 || (x.lineas[0].txt !== x.lineas[0].txt.replace(/ veces.*$/, '') + (cual ? ' veces' + cual : ' veces por persona') || !/^[\d,—]+ veces/.test(x.lineas[0].txt)) || / a /.test(x.val))) faltan.add(`tarjeta de alcance de una cuenta mal armada: ${donde} "${x.val}" ${JSON.stringify(x.lineas.map((l) => l.txt))}`);
  for (const t of [x.val, x.title, ...x.lineas.map((l) => l.txt + ' ' + l.title)]) if (SUMA_ALC.test(t) || /toda la cuenta/i.test(t)) faltan.add(`tarjeta de alcance con suma, rango o el alcance de toda la cuenta: ${donde} "${t.slice(0, 100)}"`);
  if (!hay && /BigQuery|tabla|prendió|extracción|bajar|filas|corrida/i.test(x.lineas[0].title || '')) faltan.add(`el motivo de "sin dato de Meta" no está en lenguaje de usuario: ${donde} "${x.lineas[0].title}"`);
}
// panel Rendimiento con período elegible (02/10): dos botones (Este mes y Histórica, o Esta temporada en las estacionales), la línea de
// arriba dice qué período se ve, con "(1 día)" si el mes tiene pocos días, y las tarjetas cambian con la opción
let rendVistas = 0, rendTemp = 0, rendPocos = 0;
const rendEj = {};
function revisarPeriodoRend(vals, x, sel, donde) {
  if (!x || !x.rp) { faltan.add(`campaña sin períodos del panel: ${donde}`); return; }
  rendVistas++;
  const ops = vals.campRendOps || [], estac = ops[1] && ops[1].label === 'Esta temporada';
  if (ops.length !== 2 || ops[0].label !== 'Este mes' || !['Histórica', 'Esta temporada'].includes(ops[1].label)) faltan.add(`selector del panel mal armado: ${donde} ${JSON.stringify(ops.map((o) => o.label))}`);
  if (estac && !x.rp.temp) faltan.add(`"Esta temporada" sin datos de la temporada: ${donde}`);
  const elegido = ops.findIndex((o) => o.bg === '#3C3C3C');
  if (elegido !== (sel === 'mes' ? 0 : 1)) faltan.add(`el selector del panel no marca la opción elegida: ${donde} ${sel}`);
  const L = vals.campRendLinea || '';
  const RE = sel === 'mes' ? /^Este mes( \(\d\d\/\d\d al \d\d\/\d\d\)( \(\d días?\))?|: sin gasto todavía) · / : estac ? /^Esta temporada \(desde el \d\d\/\d\d\) · / : /^Histórica \(desde el \d\d\/\d\d(: hasta ahí llegan los datos)?\) · /;
  if (!RE.test(L)) faltan.add(`línea del panel no dice el período: ${donde} "${L}"`);
  if (sel === 'mes' && !x.rp.mes.sin && x.rp.mes.n <= 6 && !/\(\d días?\)/.test(L)) faltan.add(`"Este mes" con pocos días sin decirlo: ${donde}`);
  if (sel === 'mes' && x.rp.mes.n <= 6) rendPocos++;
  if (estac && sel !== 'mes') rendTemp++;
  const quiere = sel === 'mes' ? x.rp.mes.tiles : estac ? x.rp.temp.tiles : x.tiles;
  const vistos = (vals.cTiles || []).filter((t) => t.label !== 'CPM de Alcance').map((t) => (/^Personas alcanzadas/.test(t.label) ? 'Personas alcanzadas=' : t.label + '=' + t.val)).join('|');
  const esperados = quiere.map((t) => t.label + '=' + (t.label === 'Personas alcanzadas' ? '' : t.val)).join('|');
  if (vistos !== esperados) faltan.add(`las tarjetas no son las del período elegido: ${donde} ${sel}`);
  { const ca = (vals.cTiles || []).filter((t) => t.label === 'CPM de Alcance');
    if (ca.length > 1) faltan.add(`CPM de Alcance repetido en la ficha: ${donde}`);
    for (const t of ca) { cpmAlcFicha++; if (!/^(\$[\d.,]+|por cuenta|sin dato.*|—)$/.test(t.val)) faltan.add(`CPM de Alcance de la ficha mal escrito "${t.val}": ${donde}`);
      if (/entre [\d.]+ y [\d.]+|acumulad|combinad/i.test(JSON.stringify(t.lineas.map((l) => l.txt)))) faltan.add(`CPM de Alcance de la ficha suma o combina cuentas: ${donde}`); } }
  if (vals.campMarca && vals.campMarca.txt && !['Bueno', 'Normal', 'Malo', 'Sin referencia'].includes(vals.campMarca.txt)) faltan.add(`marca de la ficha desconocida: ${donde}`);
  const k = `${sel}${estac ? ' estacional' : ''}`;
  if (!rendEj[k] && !(sel === 'mes' && x.rp.mes.sin)) rendEj[k] = `${donde} · ${L} · ${(vals.cTiles || []).map((t) => `${t.label} ${t.val}${t.lineas.length ? ' (' + t.lineas.map((l) => l.txt).join(' / ') + ')' : ''}`).join(' · ')}`;
}
const actNiv = { camp: 0, cont: 0, conj: 0 };
const c = new Component();
// rediseño v2 (02/10): los recorridos de siempre son Exploración; General y Detalle se recorren aparte (recorrido())
c.state.paso = 'explora';
// General (paso 1): sin números (salvo el % del presupuesto). Detalle (paso 2, ajuste del 03/10) = lo que era Exploración, con números, más la
// pestaña Proyección. Looker (paso 3): el tablero, o una línea en Ambas, Todos los proyectos y la portada. En todas: pasos y Acciones
const NUM_PROHIBIDO = /\$|\d\s?%|\bvs\.|▲|▼/;
let recVistas = 0, recSinNumeros = 0, cpmAlcFicha = 0;
const linksN = { lentos: 0, acciones: 0 };
const MARCAS_OK = ['Bueno', 'Normal', 'Malo', 'Sin referencia'], RITMOS_OK = ['Rápido', 'Normal', 'Lento', 'Sin gasto', 'sin dato'];   // antes del día 3: 'desde el 03/MM' (03/10)
function revisarRecorrido(v, donde, paso) {
  recVistas++;
  if (v.isPortada) { if (v.conPasos) faltan.add(`la portada tiene la barra de pasos: ${donde}`); }
  else if (!v.conPasos || !Array.isArray(v.pasos) || v.pasos.length !== 4 || v.pasos.map((x) => x.label).join('|') !== 'General|Estructura|Detalle|Looker' || v.pasos.map((x) => x.n).join('') !== '1234') faltan.add(`barra de pasos mal armada: ${donde}`);
  if (!v.isPortada && v.pasos && v.pasos.filter((x) => x.on).length !== 1) faltan.add(`barra de pasos sin un paso marcado: ${donde}`);
  if (typeof v.accGlobal !== 'function' || v.nAccGlobal == null) faltan.add(`falta el botón Acciones en el encabezado: ${donde}`);
  if ((v.canales || []).some((x) => x.label === 'General')) faltan.add(`el canal Oficial + Informativo todavía dice "General": ${donde}`);
  const textos = [];
  const sinNum = (t, que) => { if (typeof t === 'string' && NUM_PROHIBIDO.test(t)) { recSinNumeros++; if (recSinNumeros < 6) faltan.add(`número en ${paso}: ${que} "${t.slice(0, 80)}" (${donde})`); } };
  if (paso === 'General' && v.isProyecto) {
    for (const x of [v.expoRend, v.expoRitmo]) if (!x || !x.txt) faltan.add(`tarjeta de General sin marca: ${donde}`);
    if (!MARCAS_OK.includes(v.expoRend.txt)) faltan.add(`marca de rendimiento desconocida "${v.expoRend.txt}": ${donde}`);
    if (!RITMOS_OK.includes(v.expoRitmo.txt) && !/^desde el 03\/\d\d$/.test(v.expoRitmo.txt)) faltan.add(`ritmo desconocido "${v.expoRitmo.txt}": ${donde}`);
    if (v.expoHayPresu && !/^\d+ % usado$/.test(v.expoPresu)) faltan.add(`presupuesto mal escrito "${v.expoPresu}": ${donde}`);
    for (const x of [...(v.expoMalas || []), ...(v.expoLentos || [])]) { sinNum(x.sub, 'línea'); sinNum(x.chip.txt, 'marca'); }
    textos.push(v.expoRendSub, v.expoAcc);
  }
  if (paso === 'Proyección' && v.isProyecto) {
    if (!v.isDetProy || !v.isResumen || !v.isCampanas) faltan.add(`Detalle no muestra Campañas con la Proyección abajo: ${donde}`);
    if (v.isActivos || v.isEjes || v.isAud) faltan.add(`Detalle muestra una tabla de Estructura: ${donde}`);
    if (!v.pasoExplora) faltan.add(`Detalle sin el Período: ${donde}`);
    // 05/10: la proyección arranca el día 5 (antes el 10)
    if ((v.proyRows || []).some((x) => /desde el 10\//.test(x.gasto.txt + ' ' + x.imp.txt)) || /desde el 10\//.test(v.proyAviso || '')) faltan.add(`Proyección todavía dice "desde el 10": ${donde}`);
    for (const x of v.proyRows || []) if (x.nivel !== 'Eje' && /alcance|personas/i.test(x.hoy)) faltan.add(`Proyección con alcance: ${donde} (${x.nivel} ${x.name}: ${x.hoy})`);   // en Eje, hoy = nombres de campañas
    if (!['Proyecto', 'Activo'].every((n) => (v.proyRows || []).some((x) => x.nivel === n) || n === 'Activo' && !(v.detActivos || []).length)) faltan.add(`Proyección sin sus niveles: ${donde}`);
    if ((v.projTabs || []).length) faltan.add(`Detalle con barra de pestañas (tiene una sola sección): ${donde}`);
  }
  // Estructura (06/10): Activos · Ejes · Audiencias, una por vez, con el Período y el selector de Métrica de la marca
  if (paso === 'Estructura' && v.isProyecto) {
    const labs = (v.projTabs || []).map((x) => x.label).join('|');
    if (labs !== 'Mapa|Activos|Ejes|Audiencias') faltan.add(`Estructura sin sus cuatro pestañas (${labs}): ${donde}`);
    if ([v.pasoMapa, v.isActivos, v.isEjes, v.isAud].filter(Boolean).length !== 1 || v.isCampanas || v.isResumen || v.isDetProy) faltan.add(`Estructura no muestra una sola de sus pestañas: ${donde}`);
    if (v.pasoMapa === v.pasoEstTablas) faltan.add(`el selector de Métrica de las tablas y el Mapa se pisan: ${donde}`);
    if (!v.pasoExplora || !v.pasoEstructura || !(v.marcaKpiOps || []).length) faltan.add(`Estructura sin Período o sin selector de Métrica: ${donde}`);
  }
  if (paso === 'Looker') {
    const conLinea = v.isPortada ? v.pasoLooker : v.lookerNoAplica;
    if (v.isPortada) { /* la portada no tiene pasos (03/10) */ }
    else if (v.lookerNoAplica) { if (!conLinea || v.lookerLinea !== 'Looker está por proyecto y canal: elegí Oficial o Informativo.') faltan.add(`Looker sin la línea corta: ${donde}`); }
    else if (v.isProyecto && !v.isLooker) faltan.add(`el paso Looker no muestra Looker: ${donde}`);
    if ((v.vistas || []).some((x) => x.label === 'Looker')) faltan.add(`todavía hay botón Looker en el encabezado: ${donde}`);
  }
  // las listas de nombres de campañas y activos no se miran: un nombre puede tener números ("100% de iluminación LED")
  if (v.isPortada) for (const x of v.portadaVistas || []) { if (!MARCAS_OK.includes(x.rend.txt)) faltan.add(`portada sin marca: ${x.name}`); }
  for (const t of textos) sinNum(t, 'texto');
}
const recorrido = (donde) => {
  const antes = { paso: c.state.paso, detTab: c.state.detTab };
  c.state.paso = 'expo'; { const v = c.renderVals(); chequear(v, `${donde} · General`); revisarRecorrido(v, donde, 'General');
    // 06/10: "Activos que gastan lento" lleva a Estructura › Activos
    if ((v.expoLentos || []).length) { const tb = c.state.tab; v.expoLentos[0].onClick(); const vl = c.renderVals(); linksN.lentos++;
      if (c.state.paso !== 'estructura' || !vl.isActivos) faltan.add(`"Activos que gastan lento" no lleva a Estructura › Activos: ${donde}`); c.state.paso = 'expo'; c.state.tab = tb; } }
  const tabAntes = c.state.tab;
  // Detalle aunque haya quedado guardada una pestaña de Estructura (06/10): sigue mostrando Campañas y la Proyección
  c.state.paso = 'explora'; c.state.tab = 'activos'; { const v = c.renderVals(); chequear(v, `${donde} · Detalle`); revisarRecorrido(v, donde, 'Proyección'); }
  // Estructura: cada pestaña con un clic real en su botón; sin pestaña guardada abre Activos
  c.state.paso = 'estructura'; c.state.tab = 'campañas';
  { const v = c.renderVals(); if (v.isProyecto && !v.pasoMapa) faltan.add(`Estructura no abre en el Mapa: ${donde}`); }
  for (const lab of ['Mapa', 'Activos', 'Ejes', 'Audiencias']) { const v0 = c.renderVals(), tb = (v0.projTabs || []).find((x) => x.label === lab); if (!v0.isProyecto) break;
    if (!tb) { faltan.add(`Estructura sin la pestaña ${lab}: ${donde}`); continue; } tb.onClick({}); const v = c.renderVals(); chequear(v, `${donde} · Estructura ${lab}`); revisarRecorrido(v, donde, 'Estructura');
    if (!(lab === 'Mapa' ? v.pasoMapa : lab === 'Activos' ? v.isActivos : lab === 'Ejes' ? v.isEjes : v.isAud)) faltan.add(`la pestaña ${lab} de Estructura no abre su tabla: ${donde}`); }
  c.state.tab = tabAntes;
  c.state.paso = 'looker'; { const v = c.renderVals(); chequear(v, `${donde} · Looker`); revisarRecorrido(v, donde, 'Looker'); }
  Object.assign(c.state, antes);
};
const D = new Function(logic.match(/const DATA = [\s\S]*?;\n/)[0] + '; return DATA;')();
const TODO_ABIERTO = new Proxy({}, { get: () => true });
for (const canal of ['Oficial', 'Informativo']) {
  Object.assign(c.state, { canal, screen: 'portada', pid: null });
  chequear(c.renderVals(), `portada ${canal}`);
  recorrido(`portada ${canal}`);
  for (const p of D.proyectos) {
    if (!p.canales[canal]) continue;
    const b = p.canales[canal];
    for (const tab of ['resumen', 'activos', 'ejes', 'campañas', 'audiencias', 'insights', 'looker']) {
      for (const period of Object.keys(b.periodos).slice(0, ['campañas', 'ejes'].includes(tab) ? 7 : 2)) {
        Object.assign(c.state, { screen: 'proyecto', pid: p.id, tab, period, panel: tab === 'resumen', abierto: TODO_ABIERTO, busca: '', kpiSel: 'obj', paso: ['activos', 'ejes', 'audiencias'].includes(tab) ? 'estructura' : 'explora' });
        { const vt = c.renderVals(); chequear(vt, `${p.nombre} ${canal} ${tab} ${period}`);
          // 05/10: Activos baja hasta contenidos y conjuntos (activo → campaña → contenido → conjunto), con la marca en cada campaña
          if (tab === 'activos') for (const a of vt.arbolActivos || []) for (const cm of a.kids || []) { actNiv.camp++; if (!cm.hasMarca) faltan.add(`Activos: campaña sin "Cómo rinde": ${cm.name}`); for (const ct of cm.kids || []) { actNiv.cont++; actNiv.conj += (ct.kids || []).length; } } }
        if (tab === 'campañas' && Object.keys(b.periodos).indexOf(period) < 3) for (const [k] of COLS_KPI) { c.state.kpiSel = k; chequear(c.renderVals(), `${p.nombre} ${canal} campañas ${period} KPI ${k}`); }
        if (tab === 'resumen' && period === D.mes) for (const [k] of COLS_KPI) { c.state.kpiSel = k; chequear(c.renderVals(), `${p.nombre} ${canal} Revisar KPI ${k}`); }
        c.state.kpiSel = 'obj';
        if (tab === 'ejes') { c.state.busca = 'zzzz-nada'; chequear(c.renderVals(), `${p.nombre} ${canal} ejes filtro vacío`); c.state.busca = ''; }
      }
    }
    Object.assign(c.state, { screen: 'proyecto', pid: p.id, tab: 'resumen', period: D.mes, panel: false, abierto: {}, busca: '' }); recorrido(`${p.nombre} ${canal}`);
    for (const id of Object.keys(b.campanas)) for (const campTab of ['Contenidos', 'Audiencias', 'Activos y placements']) {
      Object.assign(c.state, { screen: 'campana', campId: id, campTab, panel: true, panelCamp: id, modal: null });
      c.state.kpiSel = 'obj';
      const vc = c.renderVals();
      chequear(vc, `${p.nombre} ${canal} campaña ${id} ${campTab}`);
      revisarPeriodoRend(vc, b.campanas[id], 'mes', `${p.nombre} ${canal} ${id}`);
      if (campTab !== 'Activos y placements' && Object.keys(b.campanas).indexOf(id) < 3) for (const [k] of COLS_KPI) { c.state.kpiSel = k; chequear(c.renderVals(), `${p.nombre} ${canal} campaña ${id} ${campTab} KPI ${k}`); }
      c.state.kpiSel = 'obj';
      if (campTab === 'Contenidos') {
        const x = b.campanas[id], alcPMes = x.rp ? (x.rp.mes.tiles.find((tt) => tt.alcR) || {}).alcP : 'desde_inicio';
        revisarTarjetaAlcance(vc, `${p.nombre} ${canal} ${id} este mes`, alcPMes);
        // Histórica (o Esta temporada): las mismas pantallas con la otra opción del panel
        c.state.rendPer = 'hist';
        const vh = c.renderVals();
        chequear(vh, `${p.nombre} ${canal} campaña ${id} Contenidos histórica`);
        revisarPeriodoRend(vh, x, 'hist', `${p.nombre} ${canal} ${id}`);
        revisarTarjetaAlcance(vh, `${p.nombre} ${canal} ${id} histórica`, 'desde_inicio');
        c.state.rendPer = 'mes';
      }
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
// ---- vistas que juntan (01/10): canal General de cada proyecto y "Todos los proyectos · <canal>" (Oficial, Informativo y General) ----
// Recorre las mismas pestañas (sin Looker), períodos, el selector de KPI y la pantalla de campaña que se abre desde ellas, y revisa:
// una campaña una sola vez por período y con sus canales (General); cada fila con su proyecto (panel); "vs. <proyecto>" o
// "vs. todos los proyectos"; acciones de los dos canales o de todos los proyectos, marcadas; presupuestos sumados.
const COBERTURA = {};
let vistasG = 0, vistasT = 0, campG = 0, campDosCanales = 0, campT = 0, detallesAbiertos = 0, sinPresuMes = 0;
const porPanel = {}, ejemplos = {};
const NOMBRES_P = D.proyectos.map((p) => p.nombre);
const vistaJunta = (canal, pid, nombre, b, esT) => {
  juntaActual = esT ? `panel ${canal}` : 'General de cada proyecto';
  Object.assign(c.state, { canal, screen: 'portada', pid: null, panel: false, modal: null });
  const vp = c.renderVals();
  if (!vp.canales.some((k) => k.label === 'Ambas')) faltan.add('el selector de canal no tiene Ambas (Oficial e Informativo juntos)');
  // el panel de todos los proyectos sigue al selector de canal y va primero
  if (!vp.projects.length || vp.projects[0].name !== `Todos los proyectos · ${canal === 'General' ? 'Ambas' : canal}`) faltan.add(`la portada no empieza con "Todos los proyectos · ${canal === 'General' ? 'Ambas' : canal}" (${vp.projects[0] && vp.projects[0].name})`);
  if (vp.projects.filter((x) => /^Todos los proyectos/.test(x.name)).length !== 1) faltan.add(`la portada de ${canal} tiene más de un panel de todos los proyectos`);
  vp.projects[esT ? 0 : vp.projects.findIndex((x) => x.name === nombre)].onClick();
  if (c.state.pid !== pid || c.state.screen !== 'proyecto' || c.state.canal !== canal) faltan.add(`la tarjeta de ${nombre} no abre la vista (${canal})`);
  if (esT && (c.blk() || {}).canal !== canal) faltan.add(`el panel de ${canal} no usa los datos de ${canal}`);
  if (esT) porPanel[canal] = { vistas: 0, filas: 0, proyectos: new Set() };
  const tabs = c.renderVals().projTabs.map((t) => t.label);
  if (tabs.includes('Looker')) faltan.add(`${nombre} ${canal}: la pestaña Looker no va en las vistas que juntan`);
  for (const tab of ['resumen', 'activos', 'ejes', 'campañas', 'audiencias', 'insights']) {
    for (const period of Object.keys(b.periodos).slice(0, ['campañas', 'ejes'].includes(tab) ? 7 : 2)) {
      Object.assign(c.state, { screen: 'proyecto', pid, canal, tab, period, panel: tab === 'resumen', panelCamp: null, abierto: TODO_ABIERTO, busca: '', kpiSel: 'obj', paso: ['activos', 'ejes', 'audiencias'].includes(tab) ? 'estructura' : 'explora' });
      const v = c.renderVals(); esT ? (vistasT++, porPanel[canal].vistas++) : vistasG++;
      chequear(v, `${nombre} ${canal} ${tab} ${period}`);
      if (tab === 'campañas') {
        const ids = v.campRows.map((r) => r.id);
        if (new Set(ids).size !== ids.length) faltan.add(`${nombre} ${canal}: una campaña aparece dos veces en ${period}`);
        for (const r of v.campRows) {
          if (esT) { campT++; porPanel[canal].filas++;
            // cada fila con su proyecto; en General, además, los canales donde corrió ("Santa Fe · Oficial + Informativo")
            const [pe, ce] = String(r.etq || '').split(' · ');
            if (!NOMBRES_P.includes(pe)) faltan.add(`panel ${canal}: fila sin proyecto: ${r.name} "${r.etq}"`);
            else porPanel[canal].proyectos.add(pe);
            if (canal === 'General' ? !/^(Oficial|Informativo)( \+ (Oficial|Informativo))?$/.test(ce || '') : ce != null) faltan.add(`panel ${canal}: la etiqueta de la fila no es la esperada: ${r.name} "${r.etq}"`);
            if (!/::/.test(r.id)) faltan.add(`panel ${canal}: la campaña no lleva su proyecto en el id: ${r.name}`);
            if (period === D.mes && !ejemplos[canal] && r.kpi && r.kpi.hasP) ejemplos[canal] = `${r.name} (${r.etq}) · ${r.kpi.linea} · ${r.kpi.p.txt}`; }
          else { campG++; if (!/^(Oficial|Informativo)( \+ (Oficial|Informativo))?$/.test(r.etq || '')) faltan.add(`General: la fila no dice en qué canales corrió: ${r.name} "${r.etq}"`); if (/\+/.test(r.etq)) campDosCanales++; }
        }
        if (Object.keys(b.periodos).indexOf(period) < 2) for (const [k] of COLS_KPI) { c.state.kpiSel = k; chequear(c.renderVals(), `${nombre} ${canal} campañas ${period} KPI ${k}`); }
        c.state.kpiSel = 'obj';
      }
      if (tab === 'resumen' && period === D.mes) {
        for (const [k] of COLS_KPI) { c.state.kpiSel = k; chequear(c.renderVals(), `${nombre} ${canal} Revisar KPI ${k}`); }
        c.state.kpiSel = 'obj';
        // acciones: las de los dos canales o de todos los proyectos, cada una marcada
        for (const it of v.listItems) if (!/ · (Oficial|Informativo|.+)$/.test(it.camp || '')) faltan.add(`${nombre} ${canal}: acción sin su canal o proyecto: ${it.title}`);
        if (v.cards[0] && !/^(Oficial|Informativo|[^·]+) · /.test(v.cards[0].via)) faltan.add(`${nombre} ${canal}: la tarjeta de acción no dice su canal o proyecto`);
        // presupuestos sumados: solo si alguno de los canales que junta tiene presupuestos del mes (el 2/10 DataJunta todavía no trae
        // los de octubre en ningún proyecto y las vistas de cada canal también quedan sin presupuestos)
        const hayPresu = D.proyectos.some((p) => (esT || p.id === pid) && Object.entries(p.canales).some(([cn, bb]) => (canal === 'General' || cn === canal) && (bb.budgets || []).length));
        if (hayPresu && !v.budgets.length) faltan.add(`${nombre} ${canal}: sin presupuestos`);
        if (!hayPresu) sinPresuMes++;
      }
    }
  }
  // pantalla de campaña desde la vista: el detalle de su canal (y de su proyecto en el panel)
  const filas = (b.periodos[D.mes] || { campRows: [] }).campRows.filter((r) => r.detalle).slice(0, 3);
  for (const r of filas) {
    Object.assign(c.state, { screen: 'proyecto', pid, canal, tab: 'campañas', period: D.mes, panel: false, kpiSel: 'obj' });
    c.irCampana(r.id);
    const vc = c.renderVals();
    if (!vc.isCampana) { faltan.add(`${nombre} ${canal}: no abre el detalle de ${r.name}`); continue; }
    detallesAbiertos++;
    for (const campTab of ['Contenidos', 'Audiencias']) { c.state.campTab = campTab; chequear(c.renderVals(), `${nombre} ${canal} campaña ${r.name} ${campTab}`); }
    const cr = vc.crumbs.map((x) => x.label).join(' / ');
    const pe = String(r.etq || '').split(' · ')[0], quiere = esT ? ' · ' + pe + (canal === 'General' ? ' · detalle de (Oficial|Informativo)' : '') : ' · detalle de (Oficial|Informativo)';
    if (!new RegExp(quiere).test(cr)) faltan.add(`${nombre} ${canal}: el detalle de ${r.name} no dice de qué ${esT ? 'proyecto' : 'canal'} es: "${cr}"`);
    if (esT && canal !== 'General' && c.state.campCanal !== canal) faltan.add(`panel ${canal}: el detalle de ${r.name} es de otro canal (${c.state.campCanal})`);
    const otro = vc.crumbs.find((x) => /^ver el detalle de /.test(x.label));
    if (otro) { otro.onClick(); if (!c.renderVals().isCampana) faltan.add(`${nombre}: no abre el detalle del otro canal de ${r.name}`); }
    c.state.campTab = 'Contenidos';
  }
  // cambiar de canal desde el panel: el panel pasa a ese canal (sigue al selector como el resto)
  if (esT) for (const k of ['Oficial', 'Informativo', 'General'].filter((x) => x !== canal)) {
    Object.assign(c.state, { screen: 'proyecto', pid, canal, tab: 'resumen', period: D.mes });
    c.renderVals().canales.find((x) => x.label === (k === 'General' ? 'Ambas' : k)).onClick();
    const v = c.renderVals();
    if (c.state.pid !== pid || c.state.screen !== 'proyecto' || !v.isProyecto || (c.blk() || {}).canal !== k) faltan.add(`panel: pasar de ${canal} a ${k} no deja el panel de ${k}`);
    chequear(v, `panel pasado de ${canal} a ${k}`);
  }
};
for (const p of D.proyectos) if (p.general) vistaJunta('General', p.id, p.nombre, (() => { Object.assign(c.state, { canal: 'General', pid: p.id }); return c.blk(); })(), false);
// General y Detalle también en Ambas (cada proyecto) y en Todos los proyectos de cada canal
for (const p of D.proyectos) if (p.general) { Object.assign(c.state, { canal: 'General', pid: p.id, screen: 'proyecto', tab: 'resumen', panel: false }); recorrido(`${p.nombre} Ambas`); }
for (const canal of ['Oficial', 'Informativo', 'General']) { Object.assign(c.state, { canal, pid: 'todos', screen: 'proyecto', tab: 'resumen', panel: false }); recorrido(`Todos los proyectos ${canal}`); }
Object.assign(c.state, { canal: 'Oficial', pid: null, screen: 'portada' }); { Object.assign(c.state, { canal: 'General' }); recorrido('portada Ambas'); }
for (const canal of ['Oficial', 'Informativo', 'General']) vistaJunta(canal, 'todos', `Todos los proyectos · ${canal}`, (() => { Object.assign(c.state, { canal, pid: 'todos' }); return c.blk(); })(), true);
for (const [canal, x] of Object.entries(porPanel)) {
  console.log(`  panel ${canal}: ${x.vistas} vistas · ${x.filas} filas de campañas · ${x.proyectos.size} proyectos · ejemplo: ${ejemplos[canal] || '(sin ejemplo con referencia)'}`);
  if (x.proyectos.size !== D.proyectos.filter((p) => canal === 'General' ? p.general : p.canales[canal]).length) faltan.add(`panel ${canal}: no aparecen todos los proyectos (${x.proyectos.size})`);
}
juntaActual = null;
for (const [k, o] of Object.entries(COBERTURA)) {
  const pc = Math.round(o.con / o.n * 100);
  console.log(`  referencias en ${k}: ${o.con} de ${o.n} celdas con "vs. …" (${pc} %) · sin referencia: ${o.sinCasos} por pocos casos o poca cobertura, ${o.sinMeta} porque la campaña no tiene Meta · ${Object.entries(o.porK).map(([kk, y]) => `${kk} ${Math.round(y.con / y.n * 100)} %`).join(', ')}`);
  if (pc < 50) faltan.add(`${k}: menos de la mitad de las celdas tiene referencia (${pc} %)`);
}
console.log(`General: ${vistasG} vistas · ${campG} filas de campañas (${campDosCanales} en los dos canales) · Todos los proyectos: ${vistasT} vistas · ${campT} filas · detalles abiertos ${detallesAbiertos} · vistas sin presupuestos del mes en ningún canal (no se exigen) ${sinPresuMes}`);
if (!campDosCanales) faltan.add('General: ninguna campaña aparece en los dos canales');
Object.assign(c.state, { screen: 'guia', canal: 'Oficial' }); chequear(c.renderVals(), 'guia');
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
if (!D.alcanceMeta || !['ok', 'parcial', 'sin_dato', 'sin_dato_de_hoy'].includes(D.alcanceMeta.estado) || !/^\d{4}-\d{2}-\d{2}$/.test(D.alcanceMeta.fecha || '')) faltan.add(`estado de la lectura de alcance mal armado: ${JSON.stringify(D.alcanceMeta)}`);
if (D.alcanceMeta && ['sin_dato', 'sin_dato_de_hoy'].includes(D.alcanceMeta.estado) && !D.alcanceMeta.motivo) faltan.add('sin dato de hoy de alcance y sin motivo');
for (const p of D.proyectos) for (const [canal, b] of Object.entries(p.canales)) {
  revisarAlcM(b.alcM, ['mes_en_curso', 'ultimos_7', 'ultimos_30'], `cliente ${p.nombre} ${canal}`);
  for (const x of Object.values(b.campanas)) {
    const t = (x.tiles || []).find((tt) => tt.alcM);
    revisarAlcM(t && t.alcM, ['desde_inicio', 'ultimos_7', 'ultimos_30'], `campaña ${p.nombre} ${canal} ${x.id}`);
    for (const k of x.contenidos || []) revisarAlcM(k.alcM, ['desde_inicio', 'ultimos_7'], `contenido ${p.nombre} ${canal} ${x.id} ${k.cod}`);
  }
}
buscarClavesSuma(D, 'DATA', 0);
if (clavesSuma) faltan.add(`claves de rango o suma de alcance en los datos: ${clavesSuma}`);
console.log(`alcance: CPM de Alcance por cuenta ${caPorCuenta} celdas · sin dato por cuenta ${caSinPorCuenta} · claves de rango o suma en los datos ${clavesSuma}`);
c.exportar();
console.log(`celdas de KPI por tabla: ${Object.entries(porTabla).map(([t, n]) => `${t} ${n}`).join(' · ')} · contra la campaña ${contraCamp} · % del total en Activos ${pctVistos}`);
// Revisar con CPM de Alcance queda vacío a propósito: no tiene referencias, así que ninguna celda puede decir “peor”
for (const t of ['revisar', 'contenidos', 'audiencias']) for (const [k] of COLS_KPI) if (!(t === 'revisar' && k === 'ca') && !kpiVistosT.has(`${t}|${k}`)) faltan.add(`el selector no recorrió ${k} en ${t}`);
if (!pctVistos) faltan.add('Activos: no se vio ningún % del total');
// ---- links del panel de Acciones (06/10): "ver campaña" abre la campaña o, si la acción no tiene campaña, Estructura › Activos ----
for (const p of D.proyectos) for (const canal of Object.keys(p.canales)) {
  Object.assign(c.state, { canal, pid: p.id, screen: 'proyecto', paso: 'expo', tab: 'campañas', period: D.mes, panel: true, panelCamp: null, modal: null, busca: '', abierto: {} });
  const n = (c.renderVals().cards || []).length;
  for (let i = 0; i < n; i++) {
    Object.assign(c.state, { screen: 'proyecto', paso: 'expo', tab: 'campañas', panel: true, panelCamp: null });
    const card = c.renderVals().cards[i]; if (!card || typeof card.onCamp !== 'function') continue;
    card.onCamp({ preventDefault() {} }); const v = c.renderVals(); linksN.acciones++;
    if (c.state.screen === 'campana' ? !v.isCampana : c.state.paso !== 'estructura' || !v.isActivos) faltan.add(`"ver campaña" de una acción no lleva a la campaña ni a Estructura › Activos: ${p.nombre} ${canal}`);
  }
}
Object.assign(c.state, { panel: false, paso: 'explora', tab: 'campañas' });
console.log(`links al lugar nuevo: ${linksN.lentos} de "Activos que gastan lento" · ${linksN.acciones} de "ver campaña" en Acciones`);
if (!linksN.lentos) faltan.add('no se probó el link de "Activos que gastan lento"');
// ---- marca con el KPI elegido (05/10): el selector de Métrica (compartido en Estructura, General y portada) cambia la marca y el rótulo ----
// Con un KPI, la letra de cada campaña es la de r.mks en el orden de DATA.cuartiles.orden; CPM de Alcance, sin referencia.
const kpiMarca = { vistas: 0, filas: 0, distintas: 0 };
{
  const LET = { Bueno: 'B', Normal: 'N', Malo: 'M', 'Sin referencia': 'S' }, orden = (D.cuartiles || {}).orden || [];
  if (!orden.length) faltan.add('faltan las tablas de cuartiles por KPI (DATA.cuartiles)');
  const p0 = D.proyectos.find((p) => p.canales.Oficial) || D.proyectos[0], canal0 = p0.canales.Oficial ? 'Oficial' : 'Informativo';
  Object.assign(c.state, { canal: canal0, screen: 'portada', pid: null, kpiSel: 'obj', paso: 'expo', tab: 'campañas', panel: false, modal: null });
  const vp = c.renderVals();
  if (!(vp.marcaKpiOps || []).length || !markup.includes('{{ mk.onClick }}')) faltan.add('la portada no tiene el selector de Métrica de la marca');
  const iCpm = vp.marcaKpiOps.findIndex((x) => x.label === 'CPM'); vp.marcaKpiOps[iCpm].onClick({});
  if (c.state.kpiSel !== 'cpm') faltan.add('el selector de Métrica de la portada no cambia la marca');
  // 06/10: la lista de Campañas de Detalle no cambia con el selector (siempre según objetivo); la marca por KPI se ve en Estructura
  // (Activos: activo › campaña), en General y en la portada
  const raws = p0.canales[canal0].periodos[D.mes].campRows || [];
  let base = null;
  for (const k of ['obj', 'cpm', 'cr', 'ctr', 'ca']) {
    Object.assign(c.state, { kpiSel: k, screen: 'proyecto', pid: p0.id, paso: 'explora', tab: 'campañas', period: D.mes, abierto: {}, busca: '' });
    const vd = c.renderVals(); kpiMarca.vistas++; chequear(vd, `marca por KPI ${k} · Detalle`);
    const firmaD = JSON.stringify((vd.campRows || []).map((r) => [r.id, r.marca.txt, r.kpi && r.kpi.k]));
    if (base == null) base = firmaD; else if (firmaD !== base) faltan.add(`la lista de Campañas cambia con el selector (${k}): tiene que ir siempre según objetivo`);
    if (vd.marcaRotCamp !== 'Cómo rinde (según su objetivo)') faltan.add(`el rótulo de Campañas no dice "según su objetivo" con ${k}`);
    Object.assign(c.state, { paso: 'estructura', tab: 'activos', abierto: TODO_ABIERTO });
    const v = c.renderVals(); kpiMarca.vistas++; chequear(v, `marca por KPI ${k} · Estructura`);
    const lab = k === 'obj' ? 'según objetivo' : ((v.marcaKpiOps || []).find((x) => x.bg === '#FFFFFF') || {}).label;
    if (v.marcaRot !== `Cómo rinde (${lab})`) faltan.add(`el rótulo de la marca no dice el KPI: "${v.marcaRot}" con ${k}`);
    for (const a of v.arbolActivos || []) for (const cm of a.kids || []) { const raw = raws.find((x) => x.name === cm.name || String(x.name).endsWith('::' + cm.name)); if (!raw || !cm.hasMarca) continue; kpiMarca.filas++;
      const esperado = k === 'obj' ? null : k === 'ca' ? 'S' : raw.mks ? raw.mks[orden.indexOf(k)] || 'S' : 'S';
      if (esperado && LET[cm.marca.txt] !== esperado) faltan.add(`marca con ${k} no coincide con marcas.js: ${cm.name} (${cm.marca.txt} y debería ser ${esperado})`);
      if (k !== 'obj' && raw.mk && LET[cm.marca.txt] !== raw.mk) kpiMarca.distintas++; }
    c.state.paso = 'expo'; const vg = c.renderVals(); chequear(vg, `General marca por KPI ${k}`);
    if (vg.marcaRotCorto !== `Rendimiento (${lab})`) faltan.add(`la tarjeta Rendimiento de General no dice el KPI (${k})`);
  }
  Object.assign(c.state, { kpiSel: 'obj', paso: 'explora' });
  console.log(`marca por KPI: ${kpiMarca.vistas} vistas · ${kpiMarca.filas} campañas de Estructura comparadas con marcas.js · ${kpiMarca.distintas} marcas que cambian al elegir otro KPI`);
  if (!kpiMarca.distintas) faltan.add('elegir otro KPI no cambió ninguna marca');
}
// ---- Mapa de Estructura (06/10): primera pestaña de Estructura, A5 · Zonas de Claude Design. Con clic real en el selector, los nodos, el buscador y los filtros ----
const mapaN = { ordenes: 0, vistas: 0, clics: 0, busquedas: 0, filtros: 0, pills: 0, otras: 0, terminadas: 0, detalleCamp: 0, tabla: 0, metricas: 0, porOps: 0, rotulos: 0, escalaMin: 1, zonas: 0 };
{
  const evento = { preventDefault() {}, stopPropagation() {}, target: {}, currentTarget: {} };
  const setOrig = c.setState; c.setState = function (u) { const p = typeof u === 'function' ? u(this.state) : u; this.state = { ...this.state, ...p }; };   // como el runtime: estado nuevo
  const base = { screen: 'proyecto', paso: 'estructura', tab: 'mapa', panel: false, modal: null, busca: '', abierto: {}, kpiSel: 'obj', mpPor: 'eje', mpSel: null, mpEjeF: '', mpActF: '', mpExpZ: {}, mpExpU: false, mpQ: '', mpQOpen: false, mpNotice: '', mpFlash: null, w: 1600, hv: 780 };
  const css = (s, k) => { const m = new RegExp('(?:^|;)' + k + ':([^;]+)').exec(s || ''); return m ? m[1] : null; };
  const px = (s, k) => { const v = css(s, k); return v == null ? null : parseFloat(v); };
  const POR_TXT = { eje: 'Eje', activo: 'Activo', objetivo: 'Objetivo' };
  const revisarMapa = (v, donde) => {
    mapaN.vistas++;
    if (!v.pasoMapa) faltan.add(`el Mapa no está a la vista: ${donde}`);
    if (v.mpHasMap && (!(v.mpEscala > 0 && v.mpEscala <= 1) || v.mpBoxW > 1144 || !(v.mpBoxW > 0 && v.mpBoxH > 0))) faltan.add(`el Mapa tiene mal la escala o el tamaño (${v.mpBoxW} × ${v.mpBoxH}, escala ${v.mpEscala}): ${donde}`);
    if ((v.mpPorOps || []).map((x) => x.label).join('|') !== 'Eje|Activo|Objetivo' || (v.mpPorOps || []).filter((x) => x.on).length !== 1) faltan.add(`el selector "Agrupar campañas por" está mal armado: ${donde}`);
    // todo lo que se dibuja: con texto donde corresponde, sin números rotos, dentro del lienzo
    const todo = [...v.mpZones, ...v.mpEdges, ...v.mpHlEdges, ...v.mpDots, ...v.mpLabels, ...v.mpFlashList];
    for (const x of todo) if (/NaN|undefined|Infinity/.test(x.style + (x.lab || '') + (x.label || ''))) faltan.add(`un elemento del Mapa tiene un número roto: ${donde}`);
    for (const z of v.mpZones) { mapaN.zonas++; if (!z.label || /NaN|undefined/.test(z.label) || !/ · \$/.test(z.label)) faltan.add(`zona sin nombre y gasto "${z.label}": ${donde}`); }
    for (const x of v.mpLabels) { mapaN.rotulos++; if (!String(x.label).trim()) faltan.add(`rótulo vacío en el Mapa: ${donde}`); }
    // los rótulos no se pisan (ancho estimado por cantidad de letras)
    const cajas = v.mpLabels.map((x) => { const tam = px(x.style, 'font-size') || 11, w = String(x.label).length * tam * 0.56 + 6, h = tam + 3, y = px(x.style, 'top'), l = px(x.style, 'left'), r = px(x.style, 'right');
      const x0 = l != null ? l : v.mpCW - r - w; return { x0, y0: y, x1: x0 + w, y1: y + h, s: x.label }; });
    let pis = 0; for (let i = 0; i < cajas.length; i++) for (let j = i + 1; j < cajas.length; j++) { const a = cajas[i], b = cajas[j]; if (a.x0 < b.x1 - 1 && b.x0 < a.x1 - 1 && a.y0 < b.y1 - 2 && b.y0 < a.y1 - 2) { pis++; if (pis < 3) faltan.add(`rótulos que se pisan "${a.s}" y "${b.s}": ${donde}`); } }
    for (const q of cajas) if (q.x0 < -2 || q.y0 < -2 || q.x1 > v.mpCW + 2 || q.y1 > v.mpCH + 2) { faltan.add(`rótulo fuera del lienzo "${q.s}": ${donde}`); break; }
    if (/alcanzad/i.test(JSON.stringify([v.mpTitle, v.mpSub, v.mpSum, v.mpEmptyTitle, v.mpEmptySub, v.mpPn.conn, v.mpPn.mkSub, v.mpPn.otras, v.mpPn.gastoNote, v.mpLeyenda.map((x) => x.label), v.mpNota.replace('Las personas alcanzadas no aparecen porque no se pueden sumar.', '')]))) faltan.add(`el Mapa habla de alcance: ${donde}`);
  };
  const lugaresDe = (canal) => [['todos', 'Todos los proyectos'], ...D.proyectos.filter((p) => (canal === 'General' ? p.general : p.canales[canal])).map((p) => [p.id, p.nombre])];
  for (const canal of ['Oficial', 'Informativo', 'General']) {
    for (const [pid, nombre] of lugaresDe(canal)) {
      const b = (() => { Object.assign(c.state, { canal, pid }); return c.blk(); })(); if (!b) continue;
      const periodos = ['30d', D.mes, '7d'].filter((x) => b.periodos[x]);
      for (const period of periodos) {
        const P = MP.mpPrep(b.periodos[period]);
        for (const por of ['eje', 'activo', 'objetivo']) {
          if (period !== periodos[0] && por !== 'eje') continue;
          const donde = `Mapa ${nombre} ${canal} ${period} por ${por}`;
          Object.assign(c.state, { canal, pid, period, ...base });
          // el selector con clic real: cambia la agrupación y se arma otra vez
          let v = c.renderVals(); const op = v.mpPorOps.find((x) => x.label === POR_TXT[por]); op.onClick(evento); mapaN.porOps++;
          if (c.state.mpPor !== por) faltan.add(`el selector "Agrupar campañas por" no pone ${por}: ${donde}`);
          v = c.renderVals(); chequear(v, donde); revisarMapa(v, donde);
          if (!v.mpHasMap) { if (P.recs.length) faltan.add(`hay gasto y el Mapa está vacío: ${donde}`); continue; }
          // zonas: una por eje, activo u objetivo (según se agrupe)
          const ejesN = new Set(P.recs.map((r) => (por === 'eje' ? r.eje : por === 'objetivo' ? r.o : r.a))).size;
          if (v.mpZones.length !== ejesN) faltan.add(`el Mapa tiene ${v.mpZones.length} zonas y deberían ser ${ejesN} (${por}): ${donde}`);
          // a la izquierda lo otro (activos si se agrupa por eje u objetivo; ejes si se agrupa por activo); a la derecha las audiencias
          const izq = v.mpLabels.filter((x) => (px(x.style, 'font-size') === 12.5) && px(x.style, 'left') != null && px(x.style, 'left') < 60);
          const nIzq = new Set(P.recs.map((r) => (por === 'activo' ? r.eje : r.a))).size;
          if (izq.length !== nIzq) faltan.add(`a la izquierda hay ${izq.length} nodos y deberían ser ${nIzq} (${por === 'activo' ? 'ejes' : 'activos'}): ${donde}`);
          if (por === 'activo' && !v.mpLeyenda.some((x) => x.label === 'Eje') || por !== 'activo' && !v.mpLeyenda.some((x) => x.label === 'Activo')) faltan.add(`la leyenda no dice qué hay a la izquierda: ${donde}`);
          // "Otras redes" (Google, DV360): un nodo a la izquierda o una zona punteada
          if (P.recs.some((r) => r.a === 'a:otras')) { mapaN.otras++;
            const hay = por === 'activo' ? v.mpZones.some((z) => /dashed/.test(z.style) && /Otras redes/.test(z.label)) : v.mpLabels.some((x) => /^Otras redes · sin cuenta ·/.test(x.label));
            if (!hay) faltan.add(`falta "Otras redes": ${donde}`); }
          // campañas terminadas en gris
          const termV = Object.values(P.camps).some((x) => x.termino && x.gasto > 0);
          if (termV) { const g = v.mpDots.some((x) => /background:#D5D5D5/.test(x.style)); if (g) mapaN.terminadas++; else if (!v.mpDots.some((x) => /\+\d+ campañas/.test(x.label))) faltan.add(`las campañas terminadas no van en gris: ${donde}`); }
          // más de 7 campañas en una zona: "+N campañas" (se abre tocándolo) y "Ver las N campañas"
          const camposZona = {}; for (const r of P.recs) { const z = por === 'eje' ? r.eje : por === 'objetivo' ? r.o : r.a; (camposZona[z] = camposZona[z] || new Set()).add(r.c); }
          const grandes = Object.entries(camposZona).filter(([, st]) => st.size > 7);
          const pills = v.mpDots.filter((x) => /^\+\d+ campañas$/.test(x.label));
          if (grandes.length !== pills.length) faltan.add(`hay ${grandes.length} zonas con más de 7 campañas y ${pills.length} "+N campañas": ${donde}`);
          if (grandes.length) { mapaN.pills++;
            if (!v.mpGrpBtns.some((x) => /^Ver las \d+ campañas$/.test(x.label))) faltan.add(`falta "Ver las N campañas": ${donde}`);
            Object.assign(c.state, { mpExpZ: {} }); pills[0].onClick(evento); const ex = Object.keys(c.state.mpExpZ || {}); if (ex.length !== 1) faltan.add(`tocar "+N campañas" no abre solo esa zona: ${donde}`);
            else { const vo = c.renderVals(); chequear(vo, donde + ' · una zona abierta'); revisarMapa(vo, donde + ' · una zona abierta'); if (vo.mpDots.filter((x) => /^\+\d+ campañas$/.test(x.label)).length !== pills.length - 1) faltan.add(`abrir una zona tendría que dejar las demás agrupadas: ${donde}`);
              if (!vo.mpGrpBtns.some((x) => x.label === 'Agrupar campañas chicas')) faltan.add(`con una zona abierta falta "Agrupar campañas chicas": ${donde}`);
              vo.mpGrpBtns.find((x) => /^Ver las \d+ campañas$/.test(x.label)) && vo.mpGrpBtns.find((x) => /^Ver las \d+ campañas$/.test(x.label)).onClick();
              const vt = c.renderVals(); chequear(vt, donde + ' · todas abiertas'); revisarMapa(vt, donde + ' · todas abiertas'); if (vt.mpDots.some((x) => /^\+\d+ campañas$/.test(x.label))) faltan.add(`"Ver las campañas" no abre todas las zonas: ${donde}`);
              vt.mpGrpBtns.find((x) => x.label === 'Agrupar campañas chicas').onClick(); if (Object.keys(c.state.mpExpZ || {}).length) faltan.add(`"Agrupar campañas chicas" no vuelve a agrupar: ${donde}`); }
            Object.assign(c.state, { mpExpZ: {} }); }
          // "Ordenar por": Gasto (de mayor a menor, el de siempre), Nombre (A–Z) y Cómo rinde; ordena las zonas y las columnas de los costados
          if (period === periodos[0]) {
            const sinGasto = (s) => s.slice(0, s.lastIndexOf(' · '));
            const gastoZ = {}; for (const r of P.recs) { const z = por === 'eje' ? r.eje : por === 'objetivo' ? r.o : r.a; gastoZ[z] = (gastoZ[z] || 0) + r.v; }
            const esperadoGasto = Object.keys(gastoZ).sort((x, y) => gastoZ[y] - gastoZ[x] || (x < y ? -1 : 1)).map((id) => P.names[id] || id);
            Object.assign(c.state, { ...base, canal, pid, period, mpPor: por });
            const v0 = c.renderVals(); if (v0.mpOrden !== 'gasto' || v0.mpOrdenOps.filter((x) => x.on).map((x) => x.label).join() !== 'Gasto' || v0.mpOrdenOps.map((x) => x.label).join('|') !== 'Gasto|Nombre|Cómo rinde') faltan.add(`"Ordenar por" mal armado o no abre en Gasto: ${donde}`);
            const zNom = (vv) => vv.mpZones.map((z) => sinGasto(z.label)), izqNom = (vv) => vv.mpLabels.filter((x) => px(x.style, 'font-size') === 12.5 && px(x.style, 'left') != null && px(x.style, 'left') < 60).map((x) => sinGasto(x.label)), audNom = (vv) => vv.mpLabels.filter((x) => /right:/.test(x.style) && !/^\+/.test(x.label)).map((x) => x.label);
            const trunc = (s) => (s.length > 30 ? s.slice(0, 29).trimEnd() + '…' : s);
            if (JSON.stringify(zNom(v0)) !== JSON.stringify(esperadoGasto.map(trunc))) faltan.add(`las zonas no van de mayor a menor gasto: ${donde}`);
            for (const [ord, etq] of [['nombre', 'Nombre'], ['rinde', 'Cómo rinde'], ['gasto', 'Gasto']]) {
              Object.assign(c.state, { ...base, canal, pid, period, mpPor: por, mpOrden: ord === 'gasto' ? 'nombre' : 'gasto' }); const va = c.renderVals(); va.mpOrdenOps.find((x) => x.label === etq).onClick(evento); mapaN.ordenes = (mapaN.ordenes || 0) + 1;
              if (c.state.mpOrden !== ord) { faltan.add(`"Ordenar por ${etq}" no cambia el orden: ${donde}`); continue; }
              const vo = c.renderVals(); chequear(vo, donde + ' · orden ' + ord); revisarMapa(vo, donde + ' · orden ' + ord);
              if (vo.mpOrdenOps.filter((x) => x.on).map((x) => x.label).join() !== etq) faltan.add(`el selector de orden no marca ${etq}: ${donde}`);
              if (vo.mpZones.length !== v0.mpZones.length) faltan.add(`el orden ${ord} cambia la cantidad de zonas: ${donde}`);
              const ordenado = (xs) => xs.every((x, i) => !i || xs[i - 1].localeCompare(x, 'es') <= 0);
              if (ord === 'nombre') { if (!ordenado(zNom(vo))) faltan.add(`las zonas no van de la A a la Z: ${donde} (${zNom(vo).join(', ')})`); if (!ordenado(izqNom(vo))) faltan.add(`la columna de la izquierda no va de la A a la Z: ${donde}`); const an = audNom(vo); if (!ordenado(an)) faltan.add(`las audiencias no van de la A a la Z: ${donde}`); }
              if (ord === 'gasto' && JSON.stringify(zNom(vo)) !== JSON.stringify(zNom(v0))) faltan.add(`volver a Gasto no deja las zonas como al principio: ${donde}`);
            }
            Object.assign(c.state, base);
          }
          // que se vea entero en una ventana de 1600 × 780 sin scroll: el dibujo entra en el alto del mapa (o se achica hasta 40 %)
          if (period === periodos[0]) { v = c.renderVals(); mapaN.escalaMin = Math.min(mapaN.escalaMin, v.mpEscala);
            if (v.mpBoxH > v.mpRowH - 60 && v.mpEscala > 0.4) faltan.add(`el Mapa no entra en 1600 × 780 sin scroll: ${donde} (alto ${v.mpBoxH} de ${v.mpRowH})`);
            if (v.mpRowH + 243 > 780) faltan.add(`el Mapa más la cabecera pasan los 780 px: ${donde}`); }
          // zoom: los botones +, − y Ajustar (la rueda y el arrastre son del navegador); el resaltado y el panel siguen igual
          if (period === periodos[0] && por === 'eje') {
            Object.assign(c.state, { ...base, canal, pid, period, mpPor: por, mpView: null }); let vz = c.renderVals(); const ini = vz.mpCanvasStyle;
            if (!vz.mpMas || !vz.mpMenos || !vz.mpAjustar || vz.mpZoomado) faltan.add(`faltan los botones de zoom o el mapa abre ya acercado: ${donde}`);
            const idc = vz.mpDots.find((x) => x.label === '' && /border-radius:50%/.test(x.style) && /background:#(46C678|FCB942|F7444C|A6AAA9|D5D5D5)/.test(x.style)); if (idc) idc.onClick(evento);
            vz = c.renderVals(); vz.mpMas(evento); mapaN.zoom = (mapaN.zoom || 0) + 1; let v1 = c.renderVals();
            if (!(v1.mpZoom > 1.2) || !v1.mpZoomado || v1.mpCanvasStyle === ini || !/scale\(/.test(v1.mpCanvasStyle)) faltan.add(`el botón + no acerca el mapa: ${donde}`);
            chequear(v1, donde + ' · con zoom'); revisarMapa(v1, donde + ' · con zoom');
            if (!v1.mpHasSel || !v1.mpHlEdges.length) faltan.add(`con zoom se pierde el resaltado o el panel: ${donde}`);
            v1.mpMenos(evento); v1.mpMenos(evento); v1 = c.renderVals(); if (!(v1.mpZoom < 1.01)) { /* alejar de más está permitido hasta la mitad */ }
            const vq = c.renderVals(); vq.mpMas(evento); const v2 = c.renderVals(); v2.mpAjustar(evento); const v3 = c.renderVals();
            const sinTr = (s) => s.replace(/transition:[^;]*/, '');
            if (c.state.mpView || v3.mpZoomado || sinTr(v3.mpCanvasStyle) !== sinTr(ini)) faltan.add(`"Ajustar" no vuelve a ver todo el mapa: ${donde}`);
            // al cambiar la agrupación el zoom no se arrastra (el dibujo es otro)
            v3.mpMas(evento); const v4 = c.renderVals(); v4.mpPorOps.find((x) => x.label === 'Activo').onClick(evento); const v5 = c.renderVals(); if (v5.mpZoomado) faltan.add(`al cambiar de agrupación el mapa queda acercado: ${donde}`);
            Object.assign(c.state, { ...base, canal, pid, period, mpPor: por, mpView: null });
          }
          // métricas del selector: el mapa se arma con cada una
          if (por === 'eje' && period === periodos[0]) for (const k of ['cr', 'cpm', 'ctr', 'ca', 'cv']) { Object.assign(c.state, { kpiSel: k }); const vk = c.renderVals(); chequear(vk, donde + ' · ' + k); revisarMapa(vk, donde + ' · ' + k); mapaN.metricas++; if (vk.mpMetric !== k) faltan.add(`el Mapa no sigue la Métrica elegida (${k}): ${donde}`); }
          Object.assign(c.state, { kpiSel: 'obj' });
          // clic real en un nodo de cada tipo (campaña, zona, activo o eje de la izquierda, audiencia): se resalta lo conectado y el panel dice lo esencial
          if (period === periodos[0]) {
            Object.assign(c.state, { ...base, canal, pid, period, mpPor: por }); v = c.renderVals();
            const zonaClic = v.mpZones[0], campClic = v.mpDots.find((x) => x.label === '' && /border-radius:50%/.test(x.style) && /background:#(46C678|FCB942|F7444C|A6AAA9|D5D5D5)/.test(x.style)),
              izqClic = v.mpDots.find((x) => /border-radius:8px/.test(x.style)), audClic = v.mpDots.find((x) => /dashed #8A8A8A/.test(x.style));
            for (const [que, nodo, tipoEsp] of [['la zona', zonaClic, null], ['una campaña', campClic, 'Campaña'], ['un nodo de la izquierda', izqClic, null], ['una audiencia', audClic, 'Audiencia']]) {
              if (!nodo) { if (que !== 'una audiencia' || P.recs.some((r) => r.u)) faltan.add(`no hay ${que} para tocar: ${donde}`); continue; }
              const lista = que === 'la zona' ? 'mpZones' : 'mpDots', idx = v[lista].indexOf(nodo);
              Object.assign(c.state, { ...base, canal, pid, period, mpPor: por }); nodo.onClick(evento); mapaN.clics++;
              const vs = c.renderVals(); chequear(vs, donde + ' · ' + que); revisarMapa(vs, donde + ' · ' + que);
              if (!c.state.mpSel || !vs.mpHasSel || !vs.mpPn.gasto || !/\d/.test(vs.mpPn.conn)) faltan.add(`tocar ${que} no abre el panel con lo esencial: ${donde}`);
              if (tipoEsp && vs.mpPn.type !== tipoEsp) faltan.add(`el panel de ${que} dice "${vs.mpPn.type}": ${donde}`);
              if (!vs.mpHlEdges.length && que !== 'la zona') faltan.add(`tocar ${que} no resalta sus líneas: ${donde}`);
              if (que !== 'la zona' && vs.mpDots.length > 6 && !vs.mpDots.some((x) => /opacity:0.15/.test(x.style))) faltan.add(`tocar ${que} no apaga lo que no está conectado: ${donde}`);
              // tocar de nuevo lo suelta (como en el navegador, la pantalla se arma otra vez entre un clic y otro); tocar el fondo también
              const nodo2 = vs[lista][idx]; if (!nodo2) faltan.add(`no se encuentra ${que} para volver a tocarlo: ${donde}`); else { nodo2.onClick(evento); if (c.state.mpSel) faltan.add(`volver a tocar ${que} no lo suelta: ${donde}`); }
              nodo.onClick(evento); const v3 = c.renderVals(); v3.mpClearSel(); if (c.state.mpSel) faltan.add(`tocar el fondo no suelta la selección: ${donde}`);
              // "Ver en Detalle" (campañas) o "Ver en la tabla" (activos, ejes y audiencias)
              if (que === 'una campaña' || que === 'una audiencia') { nodo.onClick(evento); const vd = c.renderVals(); const guardado = { ...c.state };
                if (que === 'una campaña') { if (vd.mpPn.detalleTxt !== 'Ver en Detalle') faltan.add(`la campaña dice "${vd.mpPn.detalleTxt}": ${donde}`); vd.mpPn.onDetalle(); if (c.state.screen !== 'campana') faltan.add(`"Ver en Detalle" no abre la ficha de la campaña: ${donde}`); else mapaN.detalleCamp++; }
                else { if (vd.mpPn.detalleTxt !== 'Ver en la tabla') faltan.add(`la audiencia dice "${vd.mpPn.detalleTxt}": ${donde}`); vd.mpPn.onDetalle(); const vt = c.renderVals(); if (c.state.paso !== 'estructura' || !vt.isAud || !c.state.busca) faltan.add(`"Ver en la tabla" no abre Audiencias con el nombre puesto: ${donde}`); else mapaN.tabla++; }
                Object.assign(c.state, guardado, { mpSel: null, busca: '', screen: 'proyecto', paso: 'estructura', tab: 'mapa' }); }
            }
            // buscador "¿Dónde está…?": una campaña, una zona, un activo y una audiencia; y algo que no existe
            for (const id of [P.recs[0].c, P.recs[0].eje, P.recs.find((r) => r.a !== 'a:otras') && P.recs.find((r) => r.a !== 'a:otras').a, P.recs.find((r) => r.u) && P.recs.find((r) => r.u).u, P.recs[0].o].filter(Boolean)) {
              Object.assign(c.state, { ...base, canal, pid, period, mpPor: por, mpQ: P.names[id].slice(0, 14), mpQOpen: true }); const vq = c.renderVals();
              const sug = vq.mpSugs.find((x) => x.id === id); if (!sug) { faltan.add(`el buscador no encuentra "${P.names[id]}": ${donde}`); continue; }
              sug.onPick(evento); mapaN.busquedas++; const vf = c.renderVals(); chequear(vf, donde + ' · buscar ' + id); revisarMapa(vf, donde + ' · buscar ' + id);
              if (c.state.mpSel !== id || !vf.mpHasSel) faltan.add(`buscar "${P.names[id]}" no lo selecciona: ${donde}`);
              if (!vf.mpFlashList.length) faltan.add(`buscar "${P.names[id]}" no lo ubica con el destello: ${donde}`);
              if (id[0] === 'o' && c.state.mpPor !== 'objetivo' && c.state.mpPor !== undefined) faltan.add(`un objetivo buscado no cambia la agrupación: ${donde}`);
              if (!vf.mpHasSel) continue;
            }
            Object.assign(c.state, { ...base, canal, pid, period, mpPor: por, mpQ: 'zzzz-nada', mpQOpen: true }); v = c.renderVals(); if (!v.mpNoSug || v.mpSugs.length) faltan.add(`buscar algo que no existe no avisa: ${donde}`);
            // filtros de eje y de activo, y "Ver todo"
            if (P.ejes.length > 1) { Object.assign(c.state, { ...base, canal, pid, period, mpPor: por, mpEjeF: P.ejes[0] }); const vf = c.renderVals(); chequear(vf, donde + ' · filtro de eje'); revisarMapa(vf, donde + ' · filtro de eje'); mapaN.filtros++;
              if (por === 'eje' && vf.mpZones.length !== 1) faltan.add(`el filtro de eje deja ${vf.mpZones.length} zonas: ${donde}`);
              vf.mpVerTodo(); if (c.state.mpEjeF || c.state.mpSel) faltan.add(`"Ver todo" no saca el filtro de eje: ${donde}`); }
            if (P.acts.length) { Object.assign(c.state, { ...base, canal, pid, period, mpPor: por, mpActF: P.acts[0] }); const vf = c.renderVals(); chequear(vf, donde + ' · filtro de activo'); revisarMapa(vf, donde + ' · filtro de activo'); mapaN.filtros++;
              if (!vf.mpDots.length) faltan.add(`el filtro de activo deja el Mapa vacío: ${donde}`);
              vf.mpVerTodo(); if (c.state.mpActF) faltan.add(`"Ver todo" no saca el filtro de activo: ${donde}`); }
          }
          Object.assign(c.state, base);
        }
      }
    }
  }
  c.setState = setOrig; c.state.tab = 'campañas'; c.state.paso = 'explora'; c.state.w = 1400; c.state.hv = 900;
  console.log(`Mapa: escala más chica en 1600 × 780 ${Math.round(mapaN.escalaMin * 100)} % · ${mapaN.vistas} vistas · ${mapaN.zonas} zonas · ${mapaN.rotulos} rótulos · ${mapaN.porOps} clics en "Agrupar por" · ${mapaN.clics} nodos tocados · ${mapaN.busquedas} búsquedas · ${mapaN.filtros} filtros · ${mapaN.pills} con "+N campañas" · ${mapaN.otras} con "otras redes" · ${mapaN.terminadas} con terminadas en gris · ${mapaN.detalleCamp} "Ver en Detalle" · ${mapaN.tabla} "Ver en la tabla" · ${mapaN.metricas} métricas`);
  if (!mapaN.clics || !mapaN.pills || !mapaN.otras || !mapaN.terminadas || !mapaN.detalleCamp || !mapaN.tabla || !mapaN.filtros || !mapaN.busquedas) faltan.add('el Mapa no se probó completo (nodos, "+N campañas", otras redes, terminadas, Detalle, tabla, filtros, buscador)');
}
console.log(`CPM de Alcance en la ficha: ${cpmAlcFicha} tarjetas`);
// ---- cambiar de proyecto desde la ruta de arriba (06/10): el proyecto es un desplegable; se mantiene el paso, la pestaña, el período y el canal ----
const cambioN = { clics: 0, canalCambiado: 0, desdeCampana: 0 };
{
  if (!markup.includes('{{ c.selVal }}') || !markup.includes('{{ c.onSel }}') || !/<sc-raw-select value="\{\{ c\.selVal \}\}"/.test(markup)) faltan_markup.push('el proyecto de la ruta no es un desplegable');
  const canalesPr = (p) => ['Oficial', 'Informativo'].filter((k) => p.canales[k]).concat(p.general ? ['General'] : []);
  const ids = [...D.proyectos.map((p) => p.id), 'todos'];
  const hay = (id, canal) => (id === 'todos' ? true : canalesPr(D.proyectos.find((p) => p.id === id)).includes(canal));
  for (const [canal, paso, tab] of [['Oficial', 'estructura', 'mapa'], ['Informativo', 'explora', 'campañas'], ['General', 'estructura', 'activos'], ['Oficial', 'looker', 'campañas'], ['Informativo', 'expo', 'campañas']]) {
    for (let i = 0; i < ids.length; i++) {
      const desde = ids[i], hasta = ids[(i + 1) % ids.length]; if (!hay(desde, canal)) continue;
      Object.assign(c.state, { canal, pid: desde, screen: 'proyecto', paso, tab, period: '30d', panel: false, modal: null, busca: 'x', campId: null, mpSel: 'c:x', mpEjeF: 'e:y', abierto: { z: 1 } });
      const v = c.renderVals(), cr = v.crumbs.find((x) => x.esSel), donde = `${desde} → ${hasta} (${canal}, ${paso} › ${tab})`;
      if (!cr || cr.selVal !== desde) { faltan.add(`la ruta no tiene el desplegable de proyecto: ${donde}`); continue; }
      if (cr.ops.length !== D.proyectos.length + 1 || cr.ops[cr.ops.length - 1].label !== 'Todos los proyectos' || !D.proyectos.every((p) => cr.ops.some((o) => o.id === p.id && o.label === p.nombre))) faltan.add(`el desplegable no trae todos los proyectos y "Todos los proyectos": ${donde}`);
      if (v.crumbs.filter((x) => x.esSel).length !== 1 || v.crumbs[0].esSel) faltan.add(`el desplegable tiene que ser solo el del proyecto: ${donde}`);
      cr.onSel({ target: { value: hasta } }); cambioN.clics++;
      const esperado = hay(hasta, canal) ? canal : canalesPr(D.proyectos.find((p) => p.id === hasta))[0];
      if (c.state.pid !== hasta) faltan.add(`cambiar de proyecto no cambia el proyecto: ${donde}`);
      if (c.state.paso !== paso || c.state.tab !== tab) faltan.add(`cambiar de proyecto no mantiene el paso y la pestaña (${c.state.paso} › ${c.state.tab}): ${donde}`);
      if (c.state.canal !== esperado) faltan.add(`el canal queda en ${c.state.canal} y tendría que ser ${esperado}: ${donde}`); else if (esperado !== canal) cambioN.canalCambiado++;
      if (c.state.period !== '30d' || c.state.screen !== 'proyecto' || c.state.busca !== '' || c.state.campId || c.state.mpSel || c.state.mpEjeF || Object.keys(c.state.abierto).length) faltan.add(`cambiar de proyecto no deja limpio lo del proyecto anterior (período, búsqueda, selección o filtros): ${donde}`);
      const v2 = c.renderVals(); chequear(v2, `cambio de proyecto ${donde}`);
      if (v2.crumbs.find((x) => x.esSel).selVal !== hasta || v2.projName !== (hasta === 'todos' ? 'Todos los proyectos' : D.proyectos.find((p) => p.id === hasta).nombre)) faltan.add(`después de cambiar, la pantalla no es la del proyecto nuevo: ${donde}`);
      if (paso === 'estructura' && tab === 'mapa' && !v2.pasoMapa) faltan.add(`después de cambiar no queda Estructura › Mapa: ${donde}`);
      // elegir el mismo proyecto no hace nada
      const antes = JSON.stringify([c.state.pid, c.state.paso, c.state.tab]); v2.crumbs.find((x) => x.esSel).onSel({ target: { value: hasta } }); if (JSON.stringify([c.state.pid, c.state.paso, c.state.tab]) !== antes) faltan.add(`elegir el mismo proyecto cambia algo: ${donde}`);
    }
  }
  // desde la ficha de una campaña: se vuelve al proyecto nuevo en el mismo paso
  { const p0 = D.proyectos.find((p) => p.canales.Oficial && Object.keys(p.canales.Oficial.campanas).length), p1 = D.proyectos.find((p) => p.id !== p0.id && p.canales.Oficial);
    Object.assign(c.state, { canal: 'Oficial', pid: p0.id, screen: 'proyecto', paso: 'explora', tab: 'campañas', period: D.mes, panel: false, busca: '' }); c.irCampana(Object.keys(p0.canales.Oficial.campanas)[0]);
    const v = c.renderVals(); if (!v.isCampana) faltan.add('no se pudo abrir la ficha para probar el cambio de proyecto'); else { v.crumbs.find((x) => x.esSel).onSel({ target: { value: p1.id } }); cambioN.desdeCampana++;
      if (c.state.screen !== 'proyecto' || c.state.pid !== p1.id || c.state.campId) faltan.add('cambiar de proyecto desde la ficha de una campaña no vuelve al proyecto nuevo'); chequear(c.renderVals(), 'cambio de proyecto desde la ficha'); } }
  // la portada no cambia: sin desplegable
  Object.assign(c.state, { screen: 'portada', pid: null, canal: 'Oficial' }); if (c.renderVals().crumbs.some((x) => x.esSel)) faltan.add('la portada tiene un desplegable de proyecto');
  Object.assign(c.state, { screen: 'proyecto', pid: D.proyectos[0].id, paso: 'explora', tab: 'campañas', period: D.mes, busca: '', canal: 'Oficial' });
  console.log(`cambio de proyecto desde la ruta: ${cambioN.clics} clics · ${cambioN.canalCambiado} con canal que cambia · ${cambioN.desdeCampana} desde la ficha`);
  if (!cambioN.clics) faltan.add('no se probó el cambio de proyecto');
}
// ---- Insights (vista aparte, 05/10) y Creatividades (06/10: salió de la app; queda el link "Creatividades ↗" a su plataforma local) ----
// Insights abierto: sin pestañas, sin Período y sin ningún paso marcado; tocar Detalle lo cierra. Creatividades abre localhost:4340 en otra
// pestaña y no cambia la pantalla.
const aparteN = { insights: 0, links: 0 };
{
  const evento = { preventDefault() {}, stopPropagation() {}, target: {}, currentTarget: {} };
  const abiertos = []; const wOrig = global.window.open; global.window.open = (u, d) => { abiertos.push([u, d]); return null; };
  for (const canal of ['Oficial', 'Informativo', 'General']) {
    const lugares = [['todos', 'Todos los proyectos'], ...D.proyectos.filter((p) => canal === 'General' || p.canales[canal]).map((p) => [p.id, p.nombre])];
    for (const [pid, nombre] of lugares) {
      const donde = `${nombre} ${canal}`;
      Object.assign(c.state, { canal, screen: 'proyecto', pid, paso: 'explora', tab: 'campañas', panel: false, modal: null, busca: '', abierto: {} });
      const v0 = c.renderVals(), ls = (v0.vistas || []).map((x) => x.label);
      if (ls.join('|') !== 'Insights|Creatividades ↗') { faltan.add(`botones del encabezado distintos de "Insights" y "Creatividades ↗": ${ls.join(', ')} (${donde})`); continue; }
      const antes = JSON.stringify(c.state); v0.vistas[1].onClick(evento); aparteN.links++;
      const ult = abiertos[abiertos.length - 1] || [];
      if (ult[0] !== 'http://localhost:4340' || ult[1] !== '_blank') faltan.add(`Creatividades ↗ no abre http://localhost:4340 en otra pestaña: ${donde}`);
      if (JSON.stringify(c.state) !== antes) faltan.add(`Creatividades ↗ cambia la pantalla de la app: ${donde}`);
      v0.vistas[0].onClick(evento); const v = c.renderVals(); aparteN.insights++; chequear(v, `Insights ${donde}`);
      if (!v.isInsights || v.isCampanas || v.isResumen || v.isActivos || v.isEjes || v.isAud) faltan.add(`Insights no se ve solo: ${donde}`);
      if ((v.projTabs || []).length) faltan.add(`con Insights abierto se ven pestañas: ${donde}`);
      if ((v.pasos || []).some((x) => x.on)) faltan.add(`con Insights abierto queda marcado un paso: ${donde}`);
      if (v.pasoExplora) faltan.add(`con Insights abierto se ve el Período: ${donde}`);
      if ((v.vistas[0] || {}).bg !== '#3C3C3C') faltan.add(`el botón Insights no queda marcado: ${donde}`);
      v.pasos.find((x) => x.label === 'Detalle').onClick(evento);
      const v2 = c.renderVals();
      if (v2.isInsights || !v2.isCampanas || !(v2.pasos.find((x) => x.label === 'Detalle') || {}).on) faltan.add(`tocar Detalle no cierra Insights: ${donde}`);
    }
  }
  global.window.open = wOrig;
  c.state.tab = 'campañas';
  console.log(`Insights: ${aparteN.insights} vistas aparte · Creatividades ↗: ${aparteN.links} links a la plataforma local`);
  if (!aparteN.links) faltan.add('no se probó el link a Creatividades');
}
console.log(`Activos: ${actNiv.camp} campañas · ${actNiv.cont} contenidos · ${actNiv.conj} conjuntos (dentro de cada activo)`);
if (!actNiv.cont || !actNiv.conj) faltan.add('Activos no baja hasta contenidos y conjuntos');
console.log(`recorrido: ${recVistas} vistas de General, Detalle, Estructura y Looker · números donde no van: ${recSinNumeros}`);
console.log(`panel Rendimiento: ${rendVistas} vistas (${rendTemp} de "Esta temporada", ${rendPocos} de "Este mes" con pocos días)`);
for (const [k, t] of Object.entries(rendEj)) console.log(`  ejemplo panel ${k}: ${t.slice(0, 600)}`);
if (!rendTemp) faltan.add('no se vio ninguna campaña en "Esta temporada"');
console.log(`tarjetas de campaña: ${tilesVistas} (${lineasTile} líneas de comparación, ${semValor} con el valor de las dos últimas semanas) · filas de Revisar: ${revisarVistas} (todas con "peor") · textos técnicos visibles: ${tecnicos}`);
console.log(`CTR de Google: ${GG.renglones} renglones (${GG.conRef} con referencia, ${GG.sinRef} sin referencia) · ${GG.solo} celdas solo de Google comparadas contra su red · ${GG.revisarPorGoogle} vistas de Revisar que entran por la parte de Google`);
for (const [k, t] of Object.entries(GG.ejemplos)) console.log(`  ejemplo Google ${k}: ${t}`);
console.log(`lista de Campañas: ${celdasRevisadas} celdas revisadas · KPI vistos ${[...kpiVistos].join(', ')} · con CPM de Alcance ${conCpmAlcance} · Costo por reproducción ${cvVistas} celdas (${cvComparadas} comparadas con el proyecto)`);
// 06/10: la lista de Campañas va según objetivo: solo los KPI de los objetivos (nunca ETR ni CPM de Alcance)
if (kpiVistos.size < 3 || [...kpiVistos].some((k) => !Object.values(KPI_DEL_OBJ).includes(k))) faltan.add(`la lista de Campañas no va según objetivo: KPI vistos ${[...kpiVistos].join(', ')}`);
console.log('contextos', ctxs.size, '· vistas', vistas, '· chequeos', checks, '· problemas', faltan.size);
for (const f of [...faltan].slice(0, 40)) console.log(' -', f);
if (faltan.size) process.exitCode = 1;
