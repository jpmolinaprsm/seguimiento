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
  // Mapa de Estructura (06/10, A5; desde el 15/10 se arma con lo que se toca): primera pestaña de Estructura, antes de las tablas; todo con divs (un {{ }} dentro de un <text> de SVG
  // mete un <span> y no se dibuja); sin SVG; sin alcance; sin el selector Columnas / Libre ni la vista de nodos
  { const iM = markup.indexOf('data-screen-label="Proyecto · Mapa"'), jM = markup.indexOf('data-screen-label="Proyecto · Ejes"'), sM = markup.slice(iM, jM > iM ? jM : undefined);
    if (iM < 0) faltan_markup.push('falta el Mapa de Estructura en el markup');
    if (jM >= 0 && jM < iM) faltan_markup.push('el Mapa tiene que ir antes que las tablas de Estructura');
    const sinIcono = sM.replace(/<svg width="16"[\s\S]*?<\/svg>/, '');
    if (/<svg|<text|<circle|<path/.test(sinIcono)) faltan_markup.push('el Mapa tiene un SVG: los nombres no se dibujan si llevan {{ }} adentro; tiene que ir con divs');
    for (const k of ['mpEdges', 'mpHlEdges', 'mpDots', 'mpLabels', 'mpPorOpts', 'mpMigas', 'mpLeyenda']) if (!sM.includes('{{ ' + k + ' }}')) faltan_markup.push('al Mapa le falta ' + k);
    if (/mpVistaOps|>Columnas<|>Libre<|mpSh\./.test(sM) || /layNodos|layLibre|MP_K_DISENO/.test(logic)) faltan_markup.push('el Mapa todavía tiene la vista de nodos o el selector Columnas / Libre');
    { const pos = ['Empezar por', 'Ordenar por', '>Métrica', 'placeholder="¿Dónde está…?"', '>Eje', 'Volver a empezar'].map((k) => sM.indexOf(k)); if (pos.some((x, i) => x < 0 || (i && x < pos[i - 1])) || sM.indexOf('>Activo') < sM.indexOf('>Eje') || sM.indexOf('>Activo') > sM.indexOf('Volver a empezar')) faltan_markup.push('la barra del Mapa no va en el orden Empezar por · Ordenar por · Métrica · ¿Dónde está…? · Eje · Activo · Volver a empezar'); }
    for (const k of ['mpCajas', 'mpInfos', 'mpFlechas', 'mpFichas', 'mpLeyEjes', 'mpOpciones', 'mpFantasmas', 'mpColumnas', 'mpMenu']) if (!sM.includes('{{ ' + k + ' }}')) faltan_markup.push('al Mapa le falta ' + k);
    if (!sM.includes('Empezar por') || !sM.includes('Volver a empezar')) faltan_markup.push('faltan "Empezar por" o "Volver a empezar" en el Mapa');
    if (/Agrupar campañas por|mpZones|mpPorOps|mpGrpBtns|Ver todo<\/button>/.test(sM)) faltan_markup.push('el Mapa todavía tiene el selector "Agrupar campañas por", las zonas o "Ver todo"');
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
  if (vals.campMarca && vals.campMarca.txt && !['Bueno', 'Regular', 'Malo', 'Sin referencia'].includes(vals.campMarca.txt)) faltan.add(`marca de la ficha desconocida: ${donde}`);
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
// nota de rendimiento de 1 a 5 de la portada (15/10)
const NOTA_PAL = { 5: 'Muy bueno', 4: 'Bueno', 3: 'Regular', 2: 'Malo', 1: 'Muy malo' }, NOTA_RE = /^([1-5]) · (Muy bueno|Bueno|Regular|Malo|Muy malo)$|^Sin referencia$/, notaN = { vistas: 0, proyectos: 0, conNota: 0, sinNota: 0, malas: 0, normalBorrado: 0 };
const MARCAS_OK = ['Bueno', 'Regular', 'Malo', 'Sin referencia'], RITMOS_OK = ['Rápido', 'Normal', 'Lento', 'Sin gasto', 'sin dato'];   // antes del día 3: 'desde el 03/MM' (03/10)
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
  if (v.isPortada) for (const x of v.portadaVistas || []) { if (!NOTA_RE.test(x.rend.txt)) faltan.add(`portada sin nota de 1 a 5: ${x.name} ("${x.rend.txt}")`); else notaN.vistas++; if (/Rendimiento \(|según objetivo/.test(JSON.stringify(x))) faltan.add(`la tarjeta de la portada habla de "según objetivo": ${x.name}`); }
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
// ---- nota de rendimiento de 1 a 5 en "Mis proyectos" (15/10): la nota de cada campaña viene de marcas.js (c.nt: percentil dentro de su celda proyecto × canal × objetivo × placement);
// la del proyecto es el promedio de sus campañas al aire ponderado por gasto, redondeado; sin nota las campañas no cuentan; "Rinden mal" nombra las de 1 o 2 de más gasto a menos.
// Y en toda la app la marca "Normal" pasó a decir "Regular" (el Ritmo de gasto sigue con "Normal"). ----
{
  const notaEsp = (aire) => { let g = 0, s = 0; for (const r of aire) { if (!(r.nt >= 1)) continue; const w = Math.max(r.gastoN || 0, 0) || 0.001; g += w; s += w * r.nt; } return g ? Math.min(5, Math.max(1, Math.round(s / g))) : null; };
  const todasCamp = []; for (const p of D.proyectos) for (const k of ['Oficial', 'Informativo']) { const bb = p.canales[k]; if (bb && bb.periodos['30d']) for (const r of bb.periodos['30d'].campRows) todasCamp.push(r); }
  if (!todasCamp.some((r) => r.nt >= 1)) faltan.add('ninguna campaña trae nota de 1 a 5 (c.nt)');
  for (const r of todasCamp) { if (r.nt != null && ![1, 2, 3, 4, 5].includes(r.nt)) faltan.add('una campaña trae una nota fuera de 1 a 5: ' + r.id + ' (' + r.nt + ')'); if (r.nt != null && (r.mk === 'S')) faltan.add('una campaña con nota no tiene marca de tres niveles: ' + r.id); }
  // la nota y la marca salen de los mismos cortes: una nota 5 o 4 nunca puede ser marca Malo, y una 1 o 2 nunca Bueno
  for (const r of todasCamp) { if (r.nt >= 4 && r.mk === 'M') faltan.add('nota ' + r.nt + ' con marca Malo: ' + r.id); if (r.nt <= 2 && r.nt >= 1 && r.mk === 'B') faltan.add('nota ' + r.nt + ' con marca Bueno: ' + r.id); }
  const alAireT = (bb) => ((((bb || {}).periodos || {})['30d'] || {}).campRows || []).filter((r) => r.estado === 'Activa' && !(((bb || {}).campanas || {})[r.id] && bb.campanas[r.id].estado === 'Terminada'));
  for (const canal of ['Oficial', 'Informativo']) {
    Object.assign(c.state, { canal, screen: 'portada', pid: null, kpiSel: 'obj' }); const vp = c.renderVals(); chequear(vp, 'portada nota ' + canal);
    for (const x of vp.portadaVistas || []) {
      const esT = /^Todos los proyectos/.test(x.name), pr = D.proyectos.find((p) => p.nombre === x.name);
      if (!esT && !pr) continue;
      const aire = esT ? D.proyectos.flatMap((p) => alAireT(p.canales[canal])) : alAireT(pr.canales[canal]);
      const n = notaEsp(aire), esp = n == null ? 'Sin referencia' : n + ' · ' + NOTA_PAL[n];
      if (x.rend.txt !== esp && !esT) faltan.add('la nota de ' + x.name + ' (' + canal + ') es "' + x.rend.txt + '" y debería ser "' + esp + '"'); else if (x.rend.txt === esp) notaN.proyectos++;
      if (esT && x.rend.txt !== esp) { /* el panel de todos usa las campañas de todos los proyectos con su id propio: se compara por rango */ const m = /^([1-5])/.exec(x.rend.txt); if (n != null && (!m || Math.abs(Number(m[1]) - n) > 1)) faltan.add('la nota de ' + x.name + ' (' + canal + ') es "' + x.rend.txt + '" y debería parecerse a "' + esp + '"'); }
      n == null ? notaN.sinNota++ : notaN.conNota++;
      if (n == null && x.rend.txt !== 'Sin referencia') faltan.add('un proyecto sin notas tiene que decir "Sin referencia": ' + x.name);
      if (x.rend.txt === 'Sin referencia' && x.rend.dot !== '#A6AAA9') faltan.add('"Sin referencia" tiene que ir en gris: ' + x.name);
      // "Rinden mal": las de nota 1 o 2, de más gasto a menos
      const malas = aire.filter((r) => r.nt === 1 || r.nt === 2).sort((a, b) => (b.gastoN || 0) - (a.gastoN || 0));
      if (!esT) { if (malas.length) { notaN.malas++; if (!/^Rinden mal: /.test(x.atencion) || !x.atencion.includes(String(malas[0].name || malas[0].id).replace(/^.*::/, '').slice(0, 12))) faltan.add('"Rinden mal" de ' + x.name + ' no empieza por la de nota 1 o 2 que más gastó (' + x.atencion + ')'); } else if (x.hayAtencion) faltan.add('"Rinden mal" lista campañas sin nota 1 o 2 en ' + x.name); }
    }
  }
  // colores de la nota: Muy bueno verde oscuro, Bueno el verde de hoy, Regular el amarillo de hoy, Malo el rojo de hoy, Muy malo rojo oscuro
  for (const s of ["5: ['Muy bueno', '#1F8A4C'", "4: ['Bueno', '#46C678'", "3: ['Regular', '#FCB942'", "2: ['Malo', '#F7444C'", "1: ['Muy malo', '#B3141B'"]) if (!logic.includes(s)) faltan.add('los colores de la nota no son los pedidos: falta ' + s);
  // la palabra "Normal" de la marca ya no está en ningún lado (el Ritmo de gasto sigue con "Normal")
  { const ritmoNormal = "N: ['Normal', '#3C3C3C'", resto = logic.split(ritmoNormal).join('');
    if (!logic.includes(ritmoNormal) || resto.includes("'Normal'")) faltan.add('quedó una marca que dice "Normal" en la lógica de la app (solo el Ritmo de gasto puede)'); else notaN.normalBorrado++;
    if (!logic.includes("N: ['Regular', '#FCB942'") || logic.includes("N: ['Normal', '#FCB942'")) faltan.add('la marca de tres niveles tiene que decir Regular');
    if (logic.includes('Bueno · Normal · Malo') || logic.includes('Normal en el medio')) faltan.add('la guía todavía habla de la marca "Normal"');
    if (markup.includes('>Normal<')) faltan.add('el markup todavía dice "Normal" como marca'); }
  console.log('nota de la portada: ' + notaN.vistas + ' tarjetas con nota válida · ' + notaN.proyectos + ' proyectos con la nota esperada · ' + notaN.conNota + ' con nota · ' + notaN.sinNota + ' sin referencia · ' + notaN.malas + ' con "Rinden mal" · "Normal" de la marca borrado: ' + notaN.normalBorrado);
}
// ---- marca con el KPI elegido (05/10): el selector de Métrica (compartido en Estructura, General y portada) cambia la marca y el rótulo ----
// Con un KPI, la letra de cada campaña es la de r.mks en el orden de DATA.cuartiles.orden; CPM de Alcance, sin referencia.
const kpiMarca = { vistas: 0, filas: 0, distintas: 0 };
{
  const LET = { Bueno: 'B', Regular: 'N', Malo: 'M', 'Sin referencia': 'S' }, orden = (D.cuartiles || {}).orden || [];
  if (!orden.length) faltan.add('faltan las tablas de cuartiles por KPI (DATA.cuartiles)');
  const p0 = D.proyectos.find((p) => p.canales.Oficial) || D.proyectos[0], canal0 = p0.canales.Oficial ? 'Oficial' : 'Informativo';
  Object.assign(c.state, { canal: canal0, screen: 'portada', pid: null, kpiSel: 'obj', paso: 'expo', tab: 'campañas', panel: false, modal: null });
  const vp = c.renderVals();
  if (!(vp.marcaKpiOps || []).length || !markup.includes('{{ mk.onClick }}')) faltan.add('falta el selector de Métrica de la marca (General y Estructura)');
  { const iPo = markup.indexOf('<sc-if value="{{ esPortada }}">'), subPo = markup.slice(iPo, markup.indexOf('data-screen-label="Proyecto · General"')); if (iPo < 0 || subPo.includes('marcaKpiOps') || subPo.includes('Métrica de la marca')) faltan.add('la portada todavía tiene el selector de Métrica de la marca (Mis proyectos usa la nota de 1 a 5)'); if (!subPo.includes('Rendimiento: ') || subPo.includes('marcaRotCorto') || subPo.includes('según objetivo)')) faltan.add('la tarjeta de la portada no dice "Rendimiento: <nota>" sin "(según objetivo)"'); }
  const iCpm = vp.marcaKpiOps.findIndex((x) => x.label === 'CPM'); vp.marcaKpiOps[iCpm].onClick({});
  if (c.state.kpiSel !== 'cpm') faltan.add('el selector de Métrica no cambia la marca');
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
// ---- Mapa de Estructura (15/10): primera pestaña de Estructura. Se va armando con lo que se toca: "Empezar por" Activo, Eje o Audiencia; el tipo de lo que sigue se elige una vez por columna (botones "Abrir por" a la derecha) y se cambia desde el encabezado de la columna. Contenidos solo cuelga de una Campaña. Con clic real ----
const mapaN = { vistas: 0, empezar: 0, elige: 0, aperturas: 0, directos: 0, columnas: 0, cierraDer: 0, cierres: 0, hojas: 0, migas: 0, busquedas: 0, filtros: 0, pills: 0, otras: 0, terminadas: 0, detalleCamp: 0, tabla: 0, metricas2: 0, ordenes: 0, reinicios: 0, zoom: 0, cajas: 0, fichas: 0, fichasP: 0, cierraFicha: 0, cadenas: 0, cuatro: 0, escalaMin: 1, escalaAbierta: 1, abiertasSinAjuste: 0, rotulos: 0, noEntra: 0 };
{
  const evento = { preventDefault() {}, stopPropagation() {}, target: {}, currentTarget: {} };
  const setOrig = c.setState; c.setState = function (u) { const p = typeof u === 'function' ? u(this.state) : u; this.state = { ...this.state, ...p }; };   // como el runtime: estado nuevo
  const base = { screen: 'proyecto', paso: 'estructura', tab: 'mapa', panel: false, modal: null, busca: '', abierto: {}, kpiSel: 'obj', mpPor: 'eje', mpSel: null, mpAbre: {}, mpCols: [], mpMenuCol: null, mpFichas: {}, mpEjeF: '', mpActF: '', mpExpZ: {}, mpQ: '', mpQOpen: false, mpNotice: '', mpFlash: null, mpView: null, mpOrden: 'gasto', w: 1600, hv: 780 };
  const css = (s, k) => { const m = new RegExp('(?:^|;)' + k + ':([^;]+)').exec(s || ''); return m ? m[1] : null; };
  const px = (s, k) => { const v = css(s, k); return v == null ? null : parseFloat(v); };
  const FLD = { eje: 'eje', activo: 'a', audiencia: 'u' }, PLURAL = { eje: 'Ejes', activo: 'Activos', audiencia: 'Audiencias' }, LET = { eje: 'e', activo: 'a', audiencia: 'u' };
  const FK = { c: 'c', a: 'a', e: 'eje', u: 'u', p: 'p' }, KN = { c: ['Campaña', 'Campañas'], a: ['Activo', 'Activos'], e: ['Eje', 'Ejes'], u: ['Audiencia', 'Audiencias'], p: ['Contenidos', 'Contenidos'] };
  // la jerarquía, escrita aparte para la prueba (no se copia del código): qué tipos puede abrir cada tipo
  // (escrita aparte, por reglas: sin Campaña en el camino nunca Contenidos; con Campaña en cualquier lugar de arriba, sí; desde Contenidos solo Audiencia o Activo)
  const validos = (kinds) => ['c', 'a', 'e', 'u', 'p'].filter((k) => { if (kinds.includes(k)) return false; if (k === 'p') return kinds.includes('c'); if (kinds[kinds.length - 1] === 'p') return k === 'a' || k === 'u'; return true; });
  const SEP = '¦', RAIZ_MAX = 14, CAMP_MAX = 10;
  const tr = (s) => (s.length > 22 ? s.slice(0, 21).trimEnd() + '…' : s);
  const tr28 = (s) => (s.length > 28 ? s.slice(0, 27).trimEnd() + '…' : s);
  const esPill = (x) => /^\+\d+ /.test(x.label);
  const partes = (v) => { const nodosL = v.mpLabels.filter((x) => [12.5, 12, 11.5].includes(px(x.style, 'font-size'))), dotsN = v.mpDots.filter((x) => x.label === ''), pills = v.mpDots.filter(esPill), caps = v.mpLabels.filter((x) => px(x.style, 'font-size') === 10.5);
    const nom = (l) => l.label.slice(0, l.label.lastIndexOf(' · '));
    return { nodosL, dotsN, pills, caps, raicesL: nodosL.filter((x) => px(x.style, 'font-size') === 12.5), nom }; };
  const gastoPor = (P, fld, Rx) => { const g = {}; for (const r of (Rx || P.recs)) if (r[fld]) g[r[fld]] = (g[r[fld]] || 0) + r.v; return g; };
  const cuenta = (Rx, k) => new Set(Rx.map((r) => r[FK[k]]).filter(Boolean)).size;
  // lo que se ofrece nunca rompe la jerarquía: Contenidos solo después de una Campaña
  const jerarquiaOk = (kinds, ofrecidos, donde, faltan2) => { if (ofrecidos.includes('Contenidos') && !kinds.includes('c')) faltan2.add(`se ofrece Contenidos sin una Campaña en el camino (${kinds.join('›')}): ${donde}`);
    const esp = validos(kinds).map((k) => KN[k][0]); if (ofrecidos.join('|') !== esp.join('|')) faltan2.add(`se ofrece ${ofrecidos.join(', ') || 'nada'} y la jerarquía dice ${esp.join(', ') || 'nada'} (${kinds.join('›')}): ${donde}`); };
  // "Según objetivo": un conjunto (eje, activo, audiencia, contenido) se mide por la nota de 1 a 5 de sus campañas, ponderada por gasto y redondeada; la burbuja y la ficha dicen lo mismo
  const NT_COL = { 5: '#1F8A4C', 4: '#46C678', 3: '#FCB942', 2: '#F7444C', 1: '#B3141B' }, NT_PAL = { 5: 'Muy bueno', 4: 'Bueno', 3: 'Regular', 2: 'Malo', 1: 'Muy malo' };
  const notaEsp = (P, Rx) => { const cg = {}; Rx.forEach((r) => { cg[r.c] = (cg[r.c] || 0) + r.v; }); let g = 0, sm = 0, n = 0, sin = 0; const rep = {}; Object.keys(cg).forEach((cid) => { const nt = P.camps[cid].raw.nt; n++; if (!(nt >= 1)) { sin++; return; } const w = Math.max(cg[cid], 0) || 0.001; g += w; sm += w * nt; rep[nt] = (rep[nt] || 0) + 1; }); return { nota: g ? Math.min(5, Math.max(1, Math.round(sm / g))) : null, rep, n, sin }; };
  const revisaFichaNota = (f, esp, donde, que) => {
    if (f.metLab !== 'Rendimiento') faltan.add('la ficha de ' + que + ' con "Según objetivo" no dice Rendimiento (dice "' + f.metLab + '"): ' + donde);
    const palEsp = esp.nota ? NT_PAL[esp.nota] : 'Sin referencia';
    if (!f.hayPill || f.pill !== palEsp) faltan.add('la ficha de ' + que + ' con "Según objetivo" dice "' + f.pill + '" y la nota esperada es ' + (esp.nota || 'sin referencia') + ' (' + palEsp + '): ' + donde);
    if (!f.haySub2 || !/^\d+ campañas?/.test(f.sub2) || /…/.test(f.sub2)) faltan.add('la ficha de ' + que + ' no tiene la línea del reparto de campañas (o está cortada): "' + f.sub2 + '" ' + donde);
    if (f.hayMotivo || /Cada campaña, según/.test(f.motivo)) faltan.add('la ficha de ' + que + ' todavía dice "Cada campaña, según su objetivo": ' + donde);
    if (esp.nota && f.metVal !== String(esp.nota)) faltan.add('la ficha de ' + que + ' muestra ' + f.metVal + ' y la nota es ' + esp.nota + ': ' + donde);
    if (!esp.nota && f.pillStyle.indexOf('#F4F4F4') < 0) faltan.add('"Sin referencia" tiene que ir en gris en la ficha de ' + que + ': ' + donde);
    if (esp.nota && f.pillStyle.indexOf('background:#') < 0) faltan.add('la píldora de la ficha de ' + que + ' no tiene color: ' + donde);
    mapaN.notaSets = (mapaN.notaSets || 0) + 1;
  };
  const revisarMapa = (v, donde) => {
    mapaN.vistas++;
    if (!v.pasoMapa) faltan.add(`el Mapa no está a la vista: ${donde}`);
    if (v.mpHasMap && (!(v.mpEscala >= 0.5 && v.mpEscala <= 1.4) || !(v.mpBoxW > 0 && v.mpBoxH > 0))) faltan.add(`el Mapa tiene mal la escala o el tamaño (${v.mpBoxW} × ${v.mpBoxH}, escala ${v.mpEscala}): ${donde}`);
    if ((v.mpPorOpts || []).map((x) => x.t).join('|') !== 'Activo|Eje|Audiencia' || !(v.mpPorOpts || []).some((x) => x.v === v.mpPorVal)) faltan.add(`el desplegable "Empezar por" está mal armado: ${donde}`);
    const todo = [...v.mpEdges, ...v.mpHlEdges, ...v.mpDots, ...v.mpLabels, ...v.mpFlashList, ...v.mpMigas, ...v.mpCajas, ...v.mpInfos, ...v.mpFlechas, ...v.mpColumnas, ...v.mpMenu, ...v.mpOpciones.map((q) => ({ style: q.style + q.ico, label: q.label })), ...v.mpFantasmas, ...v.mpFichas.map((f) => ({ style: f.style, label: f.titulo + f.sub + f.metVal + f.pill + f.motivo + f.minis.map((l) => l.val).join('|') }))];
    for (const x of todo) if (/NaN|undefined|Infinity/.test((x.style || '') + (x.lab || '') + (x.label || ''))) faltan.add(`un elemento del Mapa tiene un número roto: ${donde}`);
    for (const x of v.mpLabels) { mapaN.rotulos++; if (!String(x.label).trim()) faltan.add(`rótulo vacío en el Mapa: ${donde}`); }
    // encabezados de columna: uno por columna con nodos, con el tipo; el de la columna 0 es "Empezar por"
    if (v.mpHasMap) { if (!v.mpColumnas.length || v.mpColumnas[0].label !== PLURAL[v.mpPorVal] + ' ▾') faltan.add(`el encabezado de la primera columna no es "${PLURAL[v.mpPorVal]} ▾": ${donde}`); mapaN.columnas++; }
    // los rótulos no se pisan (ancho estimado por cantidad de letras) y no salen del lienzo
    const cajas = v.mpLabels.map((x) => { const tam = px(x.style, 'font-size') || 11, w = String(x.label).length * tam * 0.56 + 6, h = tam + 3, y = px(x.style, 'top'), l = px(x.style, 'left'); return { x0: l, y0: y, x1: l + w, y1: y + h, s: x.label }; });
    let pis = 0; for (let i = 0; i < cajas.length; i++) for (let j = i + 1; j < cajas.length; j++) { const a = cajas[i], b = cajas[j]; if (a.x0 < b.x1 - 1 && b.x0 < a.x1 - 1 && a.y0 < b.y1 - 2 && b.y0 < a.y1 - 2) { pis++; if (pis < 3) faltan.add(`rótulos que se pisan "${a.s}" y "${b.s}": ${donde}`); } }
    for (const q of cajas) if (q.x0 < -2 || q.y0 < -2 || q.x1 > v.mpCW + 2 || q.y1 > v.mpCH + 2) { faltan.add(`rótulo fuera del lienzo "${q.s}": ${donde}`); break; }
    // fichas y botones "Abrir por": no se tapan entre sí ni tapan rótulos, burbujas o íconos, y quedan dentro del lienzo
    { const rec = (x, w, h) => ({ x0: px(x.style, 'left'), y0: px(x.style, 'top'), x1: px(x.style, 'left') + w, y1: px(x.style, 'top') + h });
      const flot = [...v.mpFichas.map((f) => ({ ...rec(f, px(f.style, 'width'), f.alto), q: 'una ficha de métricas' })), ...v.mpOpciones.map((q) => ({ ...rec(q, q.label.length * 6.8 + 28, 22), q: `un botón "Abrir por" (${q.label})` }))];
      const cho = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
      for (let i = 0; i < flot.length; i++) { const a = flot[i]; if (a.x0 < -1 || a.y0 < -1 || a.x1 > v.mpCW + 1 || a.y1 > v.mpCH + 1) faltan.add(`${a.q} sale del lienzo: ${donde}`);
        for (let j = i + 1; j < flot.length; j++) if (cho(a, flot[j])) faltan.add(`${a.q} y ${flot[j].q} se tapan: ${donde}`);
        for (const x of [...v.mpDots, ...v.mpInfos]) { const w = px(x.style, 'width') || 0, h = px(x.style, 'height') || 0; if (w && cho(a, rec(x, w, h))) { faltan.add(`${a.q} tapa una burbuja o un ícono (${x.title}): ${donde}`); break; } }
        for (const x of v.mpLabels) { const tam = px(x.style, 'font-size') || 11; if (cho(a, rec(x, String(x.label).length * tam * 0.56 + 6, tam + 3))) { faltan.add(`${a.q} tapa un rótulo (${x.label}): ${donde}`); break; } } }
      if (v.mpOpciones.length && v.mpFantasmas.length !== v.mpOpciones.length) faltan.add(`cada botón "Abrir por" tiene que tener su línea punteada: ${donde}`);
      if (v.mpFichas.length) { const f = v.mpFichas[0]; if (f.minis.map((l) => l.lab).slice(0, 3).join('|') !== 'Gasto|Impr.|Reacc.' || !/^\$/.test(f.minis[0].val) || !/ · /.test(f.sub) || !f.metLab || !(f.hayPill || f.hayMotivo) || (f.hayPill && /…/.test(f.pill))) faltan.add(`la ficha de métricas (con la píldora sin cortar) no tiene nombre, tipo y período, métrica con su marca, gasto, impresiones y reacciones: ${donde}`); } }
    if (v.mpHasMap && (v.mpMigas || []).length < 1) faltan.add(`faltan las migas: ${donde}`);
    // la jerarquía en lo que se ve: las migas nunca ponen Contenidos sin una Campaña justo antes
    { const ms = v.mpMigas.map((x) => x.label); const iP = ms.indexOf('Contenidos'); if (iP >= 0 && !ms.slice(0, iP).includes('Campañas')) faltan.add(`las migas ponen Contenidos sin Campañas antes (${ms.join(' › ')}): ${donde}`); }
    if (/alcanzad/i.test(JSON.stringify([v.mpTitle, v.mpSub, v.mpSum, v.mpEmptyTitle, v.mpEmptySub, v.mpPn.conn, v.mpPn.mkSub, v.mpPn.otras, v.mpPn.gastoNote, v.mpLeyenda.map((x) => x.label), v.mpNota.replace('Las personas alcanzadas no aparecen porque no se pueden sumar.', '')]))) faltan.add(`el Mapa habla de alcance: ${donde}`);
  };
  const lugaresDe = (canal) => [['todos', 'Todos los proyectos'], ...D.proyectos.filter((p) => (canal === 'General' ? p.general : p.canales[canal])).map((p) => [p.id, p.nombre])];
  // tipos de las columnas que se pueden armar (hasta 4 columnas en total), desde "Empezar por"
  const cadenas = (ini) => { const out = []; const rec = (kinds) => { if (kinds.length > 1) out.push(kinds.slice(1)); if (kinds.length >= 4) return; for (const k of validos(kinds)) rec([...kinds, k]); }; rec([ini]); return out; };
  for (const canal of ['Oficial', 'Informativo', 'General']) {
    let nLug = 0;
    for (const [pid, nombre] of lugaresDe(canal)) {
      nLug++;
      const b = (() => { Object.assign(c.state, { canal, pid }); return c.blk(); })(); if (!b) continue;
      const periodos = ['30d', D.mes, '7d'].filter((x) => b.periodos[x]);
      for (const period of periodos) {
        const P = MP.mpPrep(b.periodos[period]);
        for (const por of ['eje', 'activo', 'audiencia']) {
          if (period !== periodos[0] && por !== 'eje') continue;
          const fld = FLD[por], plural = PLURAL[por], L0 = LET[por], donde = `Mapa ${nombre} ${canal} ${period} empezando por ${por}`;
          const st = (extra) => Object.assign(c.state, { canal, pid, period, ...base, ...(extra || {}) });
          // arranca en Eje sin que nadie elija nada; el desplegable cambia lo de arranque con el evento real de cambio
          st({ mpPor: undefined }); let v = c.renderVals(); chequear(v, donde + ' · apertura'); revisarMapa(v, donde + ' · apertura');
          if (v.mpPorVal !== 'eje') faltan.add(`"Empezar por" no abre en Eje: ${donde}`);
          v.mpOnPor({ target: { value: por } }); mapaN.empezar++;
          if (c.state.mpPor !== por) faltan.add(`"Empezar por" no pone ${por}: ${donde}`);
          v = c.renderVals(); chequear(v, donde); revisarMapa(v, donde);
          const g = gastoPor(P, fld), ids = Object.keys(g);
          if (!ids.length) { if (!v.mpEmpty && v.mpHasMap) faltan.add(`no hay ${plural.toLowerCase()} y el Mapa dibuja algo: ${donde}`); if (P.recs.length && por === 'eje') faltan.add(`hay gasto y el Mapa está vacío: ${donde}`); continue; }
          if (!v.mpHasMap) { faltan.add(`hay ${plural.toLowerCase()} y el Mapa está vacío: ${donde}`); continue; }
          // al principio solo están los nodos de lo elegido, sin líneas ni botones, ordenados por gasto, con un solo encabezado de columna
          let pt = partes(v);
          const esperadosN = ids.length <= RAIZ_MAX ? ids.length : RAIZ_MAX - 1;
          if (pt.dotsN.length !== esperadosN || pt.raicesL.length !== esperadosN || pt.nodosL.length !== esperadosN) faltan.add(`al empezar hay ${pt.dotsN.length} nodos y deberían ser ${esperadosN} (${plural}): ${donde}`);
          if (v.mpEdges.length || v.mpHlEdges.length || v.mpOpciones.length || v.mpFantasmas.length || v.mpColumnas.length !== 1) faltan.add(`al empezar el Mapa ya muestra líneas, botones o más de una columna: ${donde}`);
          if (ids.length > RAIZ_MAX) { mapaN.pills++; if (pt.pills.length !== 1 || pt.pills[0].label !== `+${ids.length - (RAIZ_MAX - 1)} ${plural.toLowerCase()}`) faltan.add(`falta o está mal el "+N ${plural.toLowerCase()}": ${donde} (${pt.pills.map((x) => x.label)})`); }
          else if (pt.pills.length) faltan.add(`hay un "+N" de más al empezar: ${donde}`);
          const esperadoGasto = ids.sort((x, y) => g[y] - g[x] || (x < y ? -1 : 1)).map((id) => tr(P.names[id] || id));
          if (JSON.stringify(pt.raicesL.map(pt.nom)) !== JSON.stringify(esperadoGasto.slice(0, esperadosN))) faltan.add(`lo de arranque no va de mayor a menor gasto: ${donde}`);
          if (v.mpFlechas.length !== pt.raicesL.length || v.mpFlechas.some((f) => f.abierta)) faltan.add(`cada nodo de arranque tiene que llevar su flecha "›" al final, sin abrir: ${donde}`);
          if (por === 'activo' && P.recs.some((r) => r.a === 'a:otras') && ids.length <= RAIZ_MAX) { mapaN.otras++; if (!pt.nodosL.some((x) => /^Otras redes · sin/.test(x.label))) faltan.add(`falta "Otras redes": ${donde}`); }
          // que se vea entero en una ventana de 1600 × 780 sin scroll
          mapaN.escalaMin = Math.min(mapaN.escalaMin, v.mpEscala);
          if (!v.mpAjusta && ids.length <= RAIZ_MAX) { mapaN.noEntra++; faltan.add(`el Mapa de arranque no entra en 1600 × 780 sin scroll: ${donde} (alto ${v.mpCH} de ${v.mpVH})`); }
          if (v.mpRowH + 243 > 780) faltan.add(`el Mapa más la cabecera pasan los 780 px: ${donde}`);
          const primero = ids[0], Rprim = P.recs.filter((r) => r[fld] === primero), campsPrim = [...new Set(Rprim.map((r) => r.c))];
          // ---- tocar el primer nodo: "Abrir por" con lo que la jerarquía permite (nunca Contenidos al principio); volver a tocarlo lo esconde ----
          pt.dotsN[pt.nodosL.indexOf(pt.raicesL[0])].onClick(evento); mapaN.elige++;
          if (c.state.mpSel !== primero || Object.keys(c.state.mpAbre).length || c.state.mpCols.length) faltan.add(`tocar un nodo sin tipo elegido lo elige pero no tiene que abrir nada solo: ${donde}`);
          let vs = c.renderVals(); chequear(vs, donde + ' · abrir por'); revisarMapa(vs, donde + ' · abrir por');
          jerarquiaOk([L0], vs.mpOpciones.map((x) => x.label), donde + ' · raíz', faltan);
          if (partes(vs).dotsN.length !== esperadosN || vs.mpEdges.length) faltan.add(`mostrar "Abrir por" no debería dibujar hijos: ${donde}`);
          { const vt = c.renderVals(), pq = partes(vt); pq.dotsN[pq.nodosL.indexOf(pq.raicesL[0])].onClick(evento); } if (c.state.mpSel || c.renderVals().mpOpciones.length) faltan.add(`volver a tocar el nodo no esconde "Abrir por": ${donde}`);
          // ---- elegir Campaña: el tipo de TODA la columna siguiente; aparecen las campañas con líneas y un encabezado "Campañas ▾" ----
          { const vt = c.renderVals(), pq = partes(vt); pq.dotsN[pq.nodosL.indexOf(pq.raicesL[0])].onClick(evento); } vs = c.renderVals(); vs.mpOpciones.find((x) => x.label === 'Campaña').onClick(evento); mapaN.aperturas++;
          if (c.state.mpCols.join() !== 'c' || !c.state.mpAbre[primero] || c.state.mpSel !== primero) faltan.add(`elegir Campaña no fija el tipo de la columna ni abre el nodo: ${donde}`);
          let vo = c.renderVals(); chequear(vo, donde + ' · campañas'); revisarMapa(vo, donde + ' · campañas'); let po = partes(vo);
          const campVis = campsPrim.length <= CAMP_MAX ? campsPrim.length : CAMP_MAX - 1;
          if (po.dotsN.length !== esperadosN + campVis) faltan.add(`al abrir por Campaña hay ${po.dotsN.length - esperadosN} campañas y deberían ser ${campVis}: ${donde}`);
          if (vo.mpEdges.length !== campVis) faltan.add(`al abrir por Campaña hay ${vo.mpEdges.length} líneas y deberían ser ${campVis}: ${donde}`);
          if (!vo.mpHlEdges.length) faltan.add(`el camino elegido no tiene líneas resaltadas: ${donde}`);
          if (vo.mpOpciones.length) faltan.add(`un nodo ya abierto no tiene que mostrar "Abrir por": ${donde}`);
          if (!vo.mpFlechas.some((f) => f.abierta)) faltan.add(`el nodo abierto no marca su flecha como abierta: ${donde}`);
          if (vo.mpColumnas.map((x) => x.label).join('|') !== `${plural} ▾|Campañas ▾`) faltan.add(`los encabezados no son "${plural} ▾" y "Campañas ▾" (son ${vo.mpColumnas.map((x) => x.label).join(', ')}): ${donde}`);
          { const esp = [plural, 'Campañas', tr28(P.names[primero] || primero)]; if (vo.mpMigas.map((x) => x.label).join('|') !== esp.join('|')) faltan.add(`las migas no dicen ${esp.join(' › ')} (dicen ${vo.mpMigas.map((x) => x.label).join(' › ')}): ${donde}`); else mapaN.migas++; }
          if (vo.mpPn.name !== (P.names[primero] || primero)) faltan.add(`el panel no es del nodo tocado: ${donde}`);
          { const ejesVis = new Set(campsPrim.map((id) => P.camps[id].eje));
            if (por === 'eje') { if (vo.mpCajas.length || vo.mpHayLeyEjes) faltan.add(`empezando por Eje no hay recuadros de eje: ${donde}`); }
            else { if (vo.mpCajas.length < 1 || (campsPrim.length <= CAMP_MAX && vo.mpCajas.length !== ejesVis.size) || !vo.mpHayLeyEjes || po.caps.length !== vo.mpCajas.length) faltan.add(`las campañas no van en un recuadro por eje (${vo.mpCajas.length} recuadros, ${po.caps.length} rótulos, ${ejesVis.size} ejes): ${donde}`); else mapaN.cajas++;
              const porEje = {}; for (const cj of vo.mpCajas) { (porEje[cj.eje] = porEje[cj.eje] || new Set()).add(cj.color); } if (Object.values(porEje).some((x) => x.size !== 1)) faltan.add(`un mismo eje tiene dos colores: ${donde}`);
              const colores = Object.values(porEje).map((x) => [...x][0]); if (new Set(colores).size !== colores.length && P.ejes.length <= 12) faltan.add(`dos ejes comparten color de recuadro: ${donde}`); } }
          { const termVis = campsPrim.some((id) => P.camps[id].termino && P.camps[id].gasto > 0); if (termVis && vo.mpDots.some((x) => /background:#D5D5D5/.test(x.style))) mapaN.terminadas++; }
          // "+N campañas": se abre tocándolo
          if (campsPrim.length > CAMP_MAX) { mapaN.pills++; const pc0 = po.pills.filter((x) => / campañas$/.test(x.label)); if (pc0.length !== 1 || pc0[0].label !== `+${campsPrim.length - (CAMP_MAX - 1)} campañas`) faltan.add(`falta o está mal el "+N campañas": ${donde} (${po.pills.map((x) => x.label)})`); else { pc0[0].onClick(evento); const vp = c.renderVals(); chequear(vp, donde + ' · todas las campañas'); revisarMapa(vp, donde + ' · todas las campañas'); const pp = partes(vp); if (pp.pills.filter((x) => / campañas$/.test(x.label)).length || pp.dotsN.length !== esperadosN + campsPrim.length) faltan.add(`"+N campañas" no muestra todas: ${donde}`); Object.assign(c.state, { mpExpZ: {} }); } }
          // ---- otro nodo de la misma columna: se abre directo con el mismo tipo, sin volver a preguntar ----
          if (ids.length > 1) {
            const seg = ids[1], R2 = P.recs.filter((r) => r[fld] === seg), camps2 = [...new Set(R2.map((r) => r.c))];
            const vz = c.renderVals(), pz = partes(vz), i2 = pz.raicesL.findIndex((x) => pz.nom(x) === pt.nom(pt.raicesL[1]));
            if (i2 < 0) faltan.add(`no se encuentra el segundo nodo: ${donde}`);
            else { pz.dotsN[pz.nodosL.indexOf(pz.raicesL[i2])].onClick(evento); const v2 = c.renderVals(); mapaN.directos++;
              if (v2.mpOpciones.length || c.state.mpCols.join() !== 'c' || !c.state.mpAbre[seg] || !c.state.mpAbre[primero]) faltan.add(`otro nodo de la columna no se abre directo con el mismo tipo: ${donde}`);
              chequear(v2, donde + ' · dos abiertos'); revisarMapa(v2, donde + ' · dos abiertos');
              const n2 = camps2.length <= CAMP_MAX ? camps2.length : CAMP_MAX - 1; if (partes(v2).dotsN.length !== esperadosN + campVis + n2) faltan.add(`el segundo nodo no muestra sus ${n2} campañas: ${donde}`);
              // cerrar el primero cierra lo que colgaba de él, y el otro sigue abierto
              { const pd = partes(v2), iA = pd.raicesL.findIndex((x) => pd.nom(x) === esperadoGasto[0]); pd.dotsN[pd.nodosL.indexOf(pd.raicesL[iA])].onClick(evento);
                const ab = Object.keys(c.state.mpAbre); if (ab.length !== 1 || ab[0] !== seg || c.state.mpSel || c.state.mpCols.join() !== 'c') faltan.add(`cerrar un nodo no cierra lo que colgaba de él (quedan ${ab.length}): ${donde}`); else mapaN.cierres++; }
              Object.assign(c.state, { mpAbre: { [primero]: true, [seg]: true }, mpSel: null }); } }
          // ---- encabezado de la columna: cambia el tipo de TODA la columna a la vez; las columnas de la derecha se cierran ----
          { st({ mpPor: por, mpCols: ['c'], mpAbre: { [primero]: true } }); const vh = c.renderVals(); const h1 = vh.mpColumnas[1]; h1.onClick(evento); const vm = c.renderVals();
            const ofreceCol = vm.mpMenu.map((x) => x.label), esp1 = validos([L0]).map((k) => KN[k][1]);
            if (ofreceCol.join('|') !== esp1.join('|')) faltan.add(`el menú del encabezado ofrece ${ofreceCol.join(', ')} y la jerarquía dice ${esp1.join(', ')}: ${donde}`);
            if (ofreceCol.includes('Contenidos')) faltan.add(`el menú de la columna que sigue a un ${plural} ofrece Contenidos: ${donde}`);
            if (vm.mpMenu.filter((x) => x.actual).length !== 1 || !vm.mpMenu.find((x) => x.actual).label.startsWith('Campañas')) faltan.add(`el menú no marca el tipo actual: ${donde}`);
            chequear(vm, donde + ' · menú'); revisarMapa(vm, donde + ' · menú');
            const otro = vm.mpMenu.find((x) => !x.actual); if (otro) { otro.onClick(evento); mapaN.cierraDer++; const k2 = c.state.mpCols[0];
              if (c.state.mpCols.length !== 1 || k2 === 'c' || !c.state.mpAbre[primero]) faltan.add(`cambiar el tipo de la columna desde el encabezado no lo cambia o cierra de más: ${donde}`);
              const vc = c.renderVals(); chequear(vc, donde + ' · columna cambiada'); revisarMapa(vc, donde + ' · columna cambiada'); const hijosN = Math.min(cuenta(Rprim, k2), 99); if (vc.mpColumnas[1].label !== KN[k2][1] + ' ▾') faltan.add(`el encabezado no dice ${KN[k2][1]}: ${donde}`);
              const visK = hijosN <= CAMP_MAX ? hijosN : CAMP_MAX - 1; if (partes(vc).dotsN.length !== esperadosN + visK) faltan.add(`al cambiar la columna a ${KN[k2][1]} hay ${partes(vc).dotsN.length - esperadosN} nodos y deberían ser ${visK}: ${donde}`); }
            // cambiar el tipo de la columna 1 cuando ya hay columnas a la derecha las cierra
            if (campsPrim.length && cuenta(Rprim.filter((r) => r.c === campsPrim[0]), 'p') > 0) { const pathC = primero + SEP + campsPrim[0]; st({ mpPor: por, mpCols: ['c', 'p'], mpAbre: { [primero]: true, [pathC]: true } }); const vq = c.renderVals(); vq.mpColumnas[1].onClick(evento); const vq2 = c.renderVals(); const alt = vq2.mpMenu.find((x) => !x.actual); if (alt) { alt.onClick(evento); if (c.state.mpCols.length !== 1 || c.state.mpAbre[pathC] || !c.state.mpAbre[primero]) faltan.add(`cambiar la columna 1 no cerró las de la derecha: ${donde}`); else mapaN.cierraDer++; } }
            // la primera columna es el mismo "Empezar por": cambiarlo desde el encabezado lo cambia y vuelve a empezar
            st({ mpPor: por, mpCols: ['c'], mpAbre: { [primero]: true } }); const v0h = c.renderVals(); v0h.mpColumnas[0].onClick(evento); const v0m = c.renderVals(); if (v0m.mpMenu.map((x) => x.label).join('|') !== 'Activos|Ejes|Audiencias') faltan.add(`el menú de la primera columna no ofrece Activos, Ejes y Audiencias: ${donde}`);
            const otroP = v0m.mpMenu.find((x) => !x.actual && x.label !== plural); if (otroP) { otroP.onClick(evento); if (c.state.mpPor === por || c.state.mpCols.length || Object.keys(c.state.mpAbre).length) faltan.add(`cambiar "Empezar por" desde el encabezado no vuelve a empezar: ${donde}`); } }
          // ---- tocar una campaña: "Abrir por" con Contenidos entre las opciones (porque ya hay una Campaña arriba); elegir Contenidos fija el tipo de la columna 2 ----
          st({ mpPor: por, mpCols: ['c'], mpAbre: { [primero]: true } }); vo = c.renderVals(); po = partes(vo);
          const titulosPrev = new Set(pt.dotsN.map((x) => x.title)), campDots = po.dotsN.filter((x) => !titulosPrev.has(x.title));
          if (campDots.length) {
            const cdot = campDots[0], cid = campsPrim.find((id) => P.camps[id].nombre === cdot.title) || campsPrim[0], rr = Rprim.filter((r) => r.c === cid), pathC = primero + SEP + cid;
            cdot.onClick(evento); const vc0 = c.renderVals(); chequear(vc0, donde + ' · campaña elegida'); revisarMapa(vc0, donde + ' · campaña elegida');
            jerarquiaOk([L0, 'c'], vc0.mpOpciones.map((x) => x.label), donde + ' · campaña', faltan);
            if (c.state.mpSel !== pathC) faltan.add(`tocar una campaña no la elige: ${donde}`);
            if (vc0.mpPn.type !== 'Campaña' || vc0.mpPn.detalleTxt !== 'Ver en Detalle' || !vc0.mpPn.hasGastoNote) faltan.add(`el panel de la campaña está mal (${vc0.mpPn.type}): ${donde}`);
            const kindC = validos([L0, 'c']).find((k) => cuenta(rr, k) > 0);
            if (kindC) {
              vc0.mpOpciones.find((x) => x.label === KN[kindC][0]).onClick(evento); mapaN.aperturas++;
              if (c.state.mpCols.join() !== 'c,' + kindC || !c.state.mpAbre[pathC]) faltan.add(`elegir ${KN[kindC][0]} en la campaña no fija el tipo de la columna 2: ${donde}`);
              const vc = c.renderVals(); chequear(vc, donde + ' · campaña abierta'); revisarMapa(vc, donde + ' · campaña abierta'); const pc = partes(vc); mapaN.escalaAbierta = Math.min(mapaN.escalaAbierta, vc.mpEscala); if (!vc.mpAjusta) mapaN.abiertasSinAjuste++;
              const nHij = cuenta(rr, kindC), vis = nHij <= CAMP_MAX ? nHij : CAMP_MAX - 1;
              if (pc.dotsN.length !== po.dotsN.length + vis) faltan.add(`al abrir la campaña por ${KN[kindC][1]} aparecen ${pc.dotsN.length - po.dotsN.length} nodos y deberían ser ${vis}: ${donde}`);
              if (vc.mpEdges.length !== vo.mpEdges.length + vis) faltan.add(`al abrir la campaña las líneas no suman ${vis}: ${donde}`);
              if (nHij > CAMP_MAX) mapaN.pills++;
              if (vc.mpColumnas.map((x) => x.label).join('|') !== `${plural} ▾|Campañas ▾|${KN[kindC][1]} ▾`) faltan.add(`los encabezados no son ${plural}, Campañas y ${KN[kindC][1]} (son ${vc.mpColumnas.map((x) => x.label).join(', ')}): ${donde}`);
              const migasEsp = [plural, 'Campañas', KN[kindC][1], tr28(P.names[cid])].join('|');
              if (vc.mpMigas.map((x) => x.label).join('|') !== migasEsp) faltan.add(`las migas de la campaña no son ${migasEsp.replace(/\|/g, ' › ')} (son ${vc.mpMigas.map((x) => x.label).join(' › ')}): ${donde}`); else mapaN.migas++;
              // la primera miga suelta la selección
              vc.mpMigas[0].onClick(); if (c.state.mpSel) faltan.add(`tocar la primera miga no suelta la selección: ${donde}`);
              // hojas: tocar un nodo del último nivel lo elige (y volver a tocarlo lo suelta)
              Object.assign(c.state, { mpSel: pathC });
              const vh = c.renderVals(), ph = partes(vh), hojaI = ph.nodosL.findIndex((x) => px(x.style, 'font-size') === 11.5);
              if (hojaI >= 0) { ph.dotsN[hojaI].onClick(evento); mapaN.hojas++; const vl = c.renderVals(); chequear(vl, donde + ' · hoja'); revisarMapa(vl, donde + ' · hoja');
                if (!vl.mpHasSel) faltan.add(`tocar un nodo del tercer nivel no lo elige: ${donde}`);
                if (vl.mpPn.hasGastoNote && !/^Solo lo que corrió en /.test(vl.mpPn.gastoNote) && !c.state.mpEjeF) faltan.add(`el panel de una hoja no aclara el recorte: ${donde}`);
                if (kindC !== 'p' && !/Activo|Audiencia|Eje|Otras redes/.test(vl.mpPn.type)) faltan.add(`el panel de la hoja dice "${vl.mpPn.type}": ${donde}`);
                if (/Activo|Audiencia|Eje/.test(vl.mpPn.type) && vl.mpPn.canDetalle) { const guardado = { ...c.state }; if (vl.mpPn.detalleTxt !== 'Ver en la tabla') faltan.add(`la hoja dice "${vl.mpPn.detalleTxt}": ${donde}`); vl.mpPn.onDetalle(); if (c.state.paso !== 'estructura' || c.state.tab === 'mapa' || !c.state.busca) faltan.add(`"Ver en la tabla" no abre su tabla con el nombre puesto: ${donde}`); else mapaN.tabla++; Object.assign(c.state, guardado, { busca: '', screen: 'proyecto', paso: 'estructura', tab: 'mapa' }); }
                if (vl.mpOpciones.length) jerarquiaOk([L0, 'c', kindC], vl.mpOpciones.map((x) => x.label), donde + ' · hoja', faltan);
                const v2 = c.renderVals(), p2 = partes(v2); p2.dotsN[hojaI].onClick(evento); if (c.state.mpSel) faltan.add(`volver a tocar una hoja sin tipo elegido no la suelta: ${donde}`); }
            }
            // "Ver en Detalle" de la campaña
            Object.assign(c.state, { mpSel: pathC }); const vd = c.renderVals(); vd.mpPn.onDetalle(); if (c.state.screen !== 'campana') faltan.add(`"Ver en Detalle" no abre la ficha de la campaña: ${donde}`); else mapaN.detalleCamp++;
            Object.assign(c.state, { screen: 'proyecto', paso: 'estructura', tab: 'mapa', mpSel: null });
            // volver a tocar la campaña abierta la cierra (con lo que colgaba); el nodo sigue abierto y la columna conserva su tipo
            if (kindC) { const vx = c.renderVals(), px2 = partes(vx), ci = px2.dotsN.findIndex((x) => x.title === cdot.title && !titulosPrev.has(x.title)); px2.dotsN[ci].onClick(evento);
              if (c.state.mpAbre[pathC] || !c.state.mpAbre[primero] || c.state.mpCols.join() !== 'c,' + kindC) faltan.add(`volver a tocar la campaña no la cierra (o cierra de más): ${donde}`); else mapaN.cierres++; }
          }
          // ---- jerarquía completa: todas las cadenas posibles de tipos (hasta 4 columnas), abriendo el primer nodo de cada columna; lo que se ofrece en cada paso sale de la jerarquía ----
          if (period === periodos[0] && nLug <= 3) {
            for (const chain of cadenas(L0)) {
              if (chain.includes('p') && !chain.slice(0, chain.indexOf('p')).includes('c')) { faltan.add(`la jerarquía arma una cadena con Contenidos sin Campaña arriba (${[L0, ...chain].join('›')}): ${donde}`); continue; }
              // se baja por el primer nodo de cada columna y se abre el último, para que se vean todas las columnas de la cadena
              let Rx = Rprim, path = primero; const abre = { [primero]: true }; let ok = true; const kinds = [L0, ...chain];
              for (let i = 0; i < chain.length - 1 && ok; i++) { const lst = Object.entries(gastoPor(P, FK[chain[i]], Rx)).sort((x, y) => y[1] - x[1]); if (!lst.length) { ok = false; break; } const idn = lst[0][0]; Rx = Rx.filter((r) => r[FK[chain[i]]] === idn); path += SEP + idn; abre[path] = true; }
              if (!ok) continue;
              st({ mpPor: por, mpCols: chain, mpAbre: abre, mpSel: null }); const vq = c.renderVals(); chequear(vq, donde + ' · cadena ' + kinds.join('›')); revisarMapa(vq, donde + ' · cadena ' + kinds.join('›')); mapaN.cadenas++;
              if (chain.length >= 3) mapaN.cuatro++;
              const hdrEsp = kinds.map((k, i) => (i === 0 ? PLURAL[por] : KN[k][1]) + ' ▾');
              if (vq.mpColumnas.map((x) => x.label).join('|') !== hdrEsp.slice(0, vq.mpColumnas.length).join('|') || vq.mpColumnas.length > hdrEsp.length) faltan.add(`los encabezados no siguen los tipos ${kinds.join('›')} (son ${vq.mpColumnas.map((x) => x.label).join(', ')}): ${donde}`);
              // en la última columna: un nodo elegido ofrece lo que la jerarquía permite después de toda la cadena
              const lst2 = Object.entries(gastoPor(P, FK[chain[chain.length - 1]], Rx)).sort((x, y) => y[1] - x[1]);
              if (lst2.length) { const path2 = path + SEP + lst2[0][0]; st({ mpPor: por, mpCols: chain, mpAbre: abre, mpSel: path2 }); const vq2 = c.renderVals(); chequear(vq2, donde + ' · cadena ' + kinds.join('›') + ' · último nodo'); revisarMapa(vq2, donde + ' · cadena ' + kinds.join('›') + ' · último nodo');
                jerarquiaOk(kinds, vq2.mpOpciones.map((x) => x.label), donde + ' · cadena', faltan);
                if (vq2.mpColumnas.length !== kinds.length) faltan.add(`la cadena ${kinds.join('›')} muestra ${vq2.mpColumnas.length} columnas y deberían ser ${kinds.length}: ${donde}`);
                const migasT = vq2.mpMigas.map((x) => x.label).slice(0, kinds.length).join('|'); if (migasT !== [PLURAL[por], ...chain.map((k) => KN[k][1])].join('|')) faltan.add(`las migas no muestran los tipos ${kinds.join('›')} (son ${vq2.mpMigas.map((x) => x.label).join(' › ')}): ${donde}`); }
            }
          }
          // ---- Contenidos con la Campaña en cualquier lugar de arriba: Eje › Campañas › Audiencias › Contenidos, Eje › Campañas › Activos › Contenidos, Activos › Campañas › Audiencias › Contenidos.
          // Los contenidos son los del camino (los de la campaña que corrieron en esa audiencia o activo); si no hay cruce, no se inventa ----
          for (const mid of ['u', 'a', 'e'].filter((k) => k !== L0)) {
            const cid = campsPrim.find((id) => { const Rc0 = Rprim.filter((r) => r.c === id); return cuenta(Rc0, mid) > 0 && cuenta(Rc0, 'p') > 0 && Object.keys(gastoPor(P, FK[mid], Rc0)).some((x) => cuenta(Rc0.filter((r) => r[FK[mid]] === x), 'p') > 0); });
            if (!cid) { mapaN.sinCruce = (mapaN.sinCruce || 0) + 1; continue; }
            const Rc = Rprim.filter((r) => r.c === cid), m0 = Object.entries(gastoPor(P, FK[mid], Rc)).sort((x, y) => y[1] - x[1]).find(([id]) => cuenta(Rc.filter((r) => r[FK[mid]] === id), 'p') > 0)[0];
            const Rcm = Rc.filter((r) => r[FK[mid]] === m0), pathC = primero + SEP + cid, pathM = pathC + SEP + m0, kindsM = [L0, 'c', mid];
            st({ mpPor: por, mpCols: ['c', mid], mpAbre: { [primero]: true, [pathC]: true }, mpSel: pathM }); const vA = c.renderVals(); chequear(vA, donde + ' · ' + kindsM.join('›')); revisarMapa(vA, donde + ' · ' + kindsM.join('›'));
            jerarquiaOk(kindsM, vA.mpOpciones.map((x) => x.label), donde + ' · Contenidos tras ' + KN[mid][1], faltan);
            if (!vA.mpOpciones.some((x) => x.label === 'Contenidos')) { faltan.add('con la Campaña arriba (' + kindsM.join('›') + ') no se ofrece Contenidos: ' + donde); continue; }
            vA.mpOpciones.find((x) => x.label === 'Contenidos').onClick(evento); mapaN.pCualquier = (mapaN.pCualquier || 0) + 1;
            if (c.state.mpCols.join() !== 'c,' + mid + ',p') faltan.add('elegir Contenidos tras ' + KN[mid][1] + ' no fija las columnas c,' + mid + ',p (queda ' + c.state.mpCols.join() + '): ' + donde);
            const vB = c.renderVals(); chequear(vB, donde + ' · ' + kindsM.join('›') + '›p'); revisarMapa(vB, donde + ' · ' + kindsM.join('›') + '›p');
            const hdr = [PLURAL[por], 'Campañas', KN[mid][1], 'Contenidos'].map((x) => x + ' ▾').join('|'); if (vB.mpColumnas.map((x) => x.label).join('|') !== hdr) faltan.add('los encabezados no son ' + hdr + ' (son ' + vB.mpColumnas.map((x) => x.label).join(', ') + '): ' + donde);
            // los contenidos que se ven son los del camino: los de la campaña que corrieron en ese nodo
            const nomsP = [...new Set(Rcm.map((r) => r.p).filter(Boolean))].map((id) => P.names[id]), titulos = new Set(vB.mpDots.map((x) => x.title));
            const n2 = cuenta(Rc, mid) <= CAMP_MAX ? cuenta(Rc, mid) : CAMP_MAX - 1, n3 = cuenta(Rcm, 'p') <= CAMP_MAX ? cuenta(Rcm, 'p') : CAMP_MAX - 1;
            if (nomsP.length && !nomsP.some((nm) => titulos.has(nm))) faltan.add('los contenidos de ' + kindsM.join('›') + ' no son los del camino (se esperaban ' + nomsP.slice(0, 3).join(', ') + '): ' + donde);
            const todosP = new Set(P.recs.filter((r) => r.c === cid && r.p).map((r) => P.names[r.p])), otrosNodos = new Set([...Object.keys(g).map((id) => P.names[id]), ...campsPrim.map((id) => P.names[id]), P.names[cid], ...Rc.map((r) => P.names[r[FK[mid]]])]), fuera = vB.mpDots.filter((x) => todosP.has(x.title) && !nomsP.includes(x.title) && !otrosNodos.has(x.title));
            if (fuera.length) faltan.add('aparecen contenidos de la campaña que no corrieron en ' + KN[mid][0] + ' (' + fuera.map((x) => x.title).slice(0, 2).join(', ') + '): ' + donde);
            const n11 = partes(vB).nodosL.filter((x) => px(x.style, 'font-size') === 11.5).length; if (n11 !== n2 + n3) faltan.add('el camino ' + kindsM.join('›') + '›p muestra ' + n11 + ' nodos del tercer y cuarto nivel y deberían ser ' + (n2 + n3) + ': ' + donde);
            mapaN.pCruce = (mapaN.pCruce || 0) + 1;
            // "Según objetivo" dentro del camino: la nota usa solo las campañas de ese camino (el nodo del medio y el contenido)
            { const p0 = Object.keys(gastoPor(P, 'p', Rcm)).sort((x, y) => gastoPor(P, 'p', Rcm)[y] - gastoPor(P, 'p', Rcm)[x])[0], pathP = pathM + SEP + p0;
              st({ mpPor: por, kpiSel: 'obj', mpCols: ['c', mid, 'p'], mpAbre: { [primero]: true, [pathC]: true, [pathM]: true }, mpSel: pathP, mpFichas: { [pathM]: true, [pathP]: true } }); const vS = c.renderVals(); chequear(vS, donde + ' · nota en el camino'); revisarMapa(vS, donde + ' · nota en el camino');
              if (vS.mpFichas.length !== 2) faltan.add('en el camino ' + kindsM.join('›') + '›p faltan fichas (hay ' + vS.mpFichas.length + '): ' + donde); else { revisaFichaNota(vS.mpFichas[0], notaEsp(P, Rcm), donde, KN[mid][0] + ' dentro del camino'); revisaFichaNota(vS.mpFichas[1], notaEsp(P, Rcm.filter((r) => r.p === p0)), donde, 'contenido dentro del camino'); } }
          }
          // ---- "Según objetivo": ninguna ficha de conjunto queda sin nota y el color de la burbuja coincide con la nota ----
          { const rootsIds = Object.keys(g).sort((x, y) => g[y] - g[x]).slice(0, Math.min(3, esperadosN)), fich = {}; rootsIds.forEach((id) => { fich[id] = true; });
            st({ mpPor: por, kpiSel: 'obj', mpFichas: fich }); const vN = c.renderVals(); chequear(vN, donde + ' · nota de los conjuntos'); revisarMapa(vN, donde + ' · nota de los conjuntos');
            const pN = partes(vN);
            rootsIds.forEach((id, i) => { const esp = notaEsp(P, P.recs.filter((r) => r[fld] === id)); const f = vN.mpFichas[i]; if (!f) { faltan.add('falta la ficha de ' + (P.names[id] || id) + ': ' + donde); return; }
              revisaFichaNota(f, esp, donde, PLURAL[por].toLowerCase() + ' ' + (P.names[id] || id));
              const iL = pN.raicesL.findIndex((x) => pN.nom(x) === tr(P.names[id] || id)); const dot = iL >= 0 && pN.dotsN[pN.nodosL.indexOf(pN.raicesL[iL])];
              const colEsp = esp.nota ? NT_COL[esp.nota] : '#A6AAA9'; if (!dot) faltan.add('no se encuentra la burbuja de ' + (P.names[id] || id) + ': ' + donde); else if (id !== 'a:otras' && dot.style.toLowerCase().indexOf('background:' + colEsp.toLowerCase()) < 0) faltan.add('la burbuja de ' + (P.names[id] || id) + ' no tiene el color de su nota (' + (esp.nota || 'sin referencia') + ' = ' + colEsp + '): ' + donde); else if (dot) mapaN.notaBurbujas = (mapaN.notaBurbujas || 0) + 1; });
            // con otra métrica sigue como está: la ficha no habla de Rendimiento ni de la nota
            st({ mpPor: por, kpiSel: 'cpm', mpFichas: fich }); const vM = c.renderVals(); if (vM.mpFichas.some((f) => f.metLab === 'Rendimiento' || f.haySub2)) faltan.add('con otra métrica la ficha de un conjunto no debería mostrar la nota: ' + donde);
            Object.assign(c.state, { kpiSel: 'obj' }); }
          // ---- Métrica: define el número y el color de cada burbuja ----
          { const KPIS = ['obj', 'cr', 'cpm', 'ctr', 'etrV', 'etrI', 'cv', 'ca'], CORTO = { cr: 'Costo/reacción', cpm: 'CPM', ctr: 'CTR', etrV: 'ETR videos', etrI: 'ETR imág.', cv: 'Costo/repr.', ca: 'CPM alcance' };
            for (const k of KPIS) { st({ mpPor: por, kpiSel: k, mpCols: ['c'], mpAbre: { [primero]: true } }); const vk = c.renderVals(); chequear(vk, donde + ' · métrica ' + k); revisarMapa(vk, donde + ' · métrica ' + k); mapaN.metricas2++; if (vk.mpMetric !== k) faltan.add(`el Mapa no sigue la Métrica ${k}: ${donde}`);
              const pk = partes(vk), raizL = pk.raicesL[0].label, campL = pk.nodosL.filter((x) => px(x.style, 'font-size') === 12);
              if (/NaN|undefined|Infinity/.test(pk.nodosL.map((x) => x.label).join('|'))) faltan.add(`un número roto en un rótulo con la Métrica ${k}: ${donde}`);
              if (k === 'ca' && /CPM alcance/.test(raizL)) faltan.add(`el CPM de Alcance se junta en un nodo (nunca se suma alcance): ${donde}`);
              if (k !== 'obj' && k !== 'ca' && campL.length && !campL.some((x) => x.label.includes(CORTO[k]) || /\$/.test(x.label))) faltan.add(`las campañas no muestran la Métrica ${k}: ${donde}`);
              if (k === 'obj' && campL.length && !campL.every((x) => Object.values(CORTO).some((n) => x.label.includes(n)) || / · \$/.test(x.label))) faltan.add(`las campañas no muestran su número según el objetivo: ${donde}`); }
            Object.assign(c.state, { kpiSel: 'obj' });
            // fichas: la del primer nodo y la de una campaña, las dos a la vez; cerrar con la ×
            st({ mpPor: por, mpCols: ['c'], mpAbre: { [primero]: true } }); const vf0 = c.renderVals(); if (!vf0.mpInfos.length) faltan.add(`no hay ícono para ver las métricas: ${donde}`); else {
              vf0.mpInfos[0].onClick(evento); if (!c.state.mpFichas[primero]) faltan.add(`el ícono no abre la ficha: ${donde}`); let vf = c.renderVals(); chequear(vf, donde + ' · ficha'); revisarMapa(vf, donde + ' · ficha'); mapaN.fichas++;
              if (vf.mpFichas.length !== 1) faltan.add(`hay ${vf.mpFichas.length} fichas y debería haber 1: ${donde}`);
              else { const ff = vf.mpFichas[0], lf = [ff.titulo, ff.sub, ...ff.minis.map((l) => l.lab + ' ' + l.val), ff.metLab, ff.metVal, ff.pill, ff.motivo].join(' | '); if (/alcanzad/i.test(lf)) faltan.add(`la ficha habla de alcance: ${donde}`); if (!/\d/.test(lf)) faltan.add(`la ficha no tiene números: ${donde}`); if (/\d\.\d{3}\.\d{3}/.test(ff.minis.map((l) => l.val).join(' '))) faltan.add(`la ficha no usa "mil" y "M": ${donde}`);
                if (ff.hayPill && !/^(Muy bueno|Muy malo|Bueno|Regular|Malo|Sin referencia)/.test(ff.pill)) faltan.add(`la píldora de la ficha no dice Bueno, Regular o Malo: ${donde}`); }
              if (vf.mpInfos.length > 1) { vf.mpInfos[1].onClick(evento); vf = c.renderVals(); chequear(vf, donde + ' · dos fichas'); revisarMapa(vf, donde + ' · dos fichas'); if (vf.mpFichas.length !== 2) faltan.add(`no se pueden tener dos fichas abiertas: ${donde}`); else if (!vf.mpFichas[1].minis.some((l) => l.lab === 'Al aire')) faltan.add(`la ficha de una campaña no dice los días al aire: ${donde}`); }
              const n0 = vf.mpFichas.length; vf.mpFichas[0].onClose(evento); const vc2 = c.renderVals(); if (vc2.mpFichas.length !== n0 - 1) faltan.add(`la × no cierra la ficha: ${donde}`); else mapaN.cierraFicha++;
              if (vc2.mpFichas.length) vc2.mpFichas[0].onClose(evento); if (c.renderVals().mpFichas.length) faltan.add(`quedan fichas abiertas: ${donde}`); }
            // la ficha de un contenido (Eje/Activo/Audiencia › Campaña › Contenidos): tiene ficha y se puede seguir abriendo por Audiencia o Activo
            { const cid = campsPrim[0], R2 = Rprim.filter((r) => r.c === cid), pid = [...new Set(R2.map((r) => r.p).filter(Boolean))][0];
              if (pid) { const pathK = primero + SEP + cid + SEP + pid; st({ mpPor: por, mpCols: ['c', 'p'], mpAbre: { [primero]: true, [primero + SEP + cid]: true }, mpSel: pathK, mpFichas: { [pathK]: true } }); const vk = c.renderVals(); chequear(vk, donde + ' · contenido'); revisarMapa(vk, donde + ' · contenido');
                if (!vk.mpFichas.length) faltan.add(`un contenido no tiene ficha: ${donde}`); else mapaN.fichasP++;
                jerarquiaOk([L0, 'c', 'p'], vk.mpOpciones.map((x) => x.label), donde + ' · contenido', faltan);
                const sig = validos([L0, 'c', 'p']).find((k) => cuenta(R2.filter((r) => r.p === pid), k) > 0);
                if (sig) { vk.mpOpciones.find((x) => x.label === KN[sig][0]).onClick(evento); const v4 = c.renderVals(); chequear(v4, donde + ' · cuarto nivel'); revisarMapa(v4, donde + ' · cuarto nivel'); mapaN.cuatro++;
                  if (c.state.mpCols.join() !== 'c,p,' + sig) faltan.add(`un contenido no fija el tipo ${KN[sig][0]} para la columna 3: ${donde}`);
                  const espM = [PLURAL[por], 'Campañas', 'Contenidos', KN[sig][1], tr28(P.names[pid])].join('|'); if (v4.mpMigas.map((x) => x.label).join('|') !== espM) faltan.add(`las migas del cuarto nivel no son ${espM.replace(/\|/g, ' › ')} (son ${v4.mpMigas.map((x) => x.label).join(' › ')}): ${donde}`); }
                else mapaN.sinDatoP = (mapaN.sinDatoP || 0) + 1; } } }
          // ---- "Volver a empezar": todo cerrado, sin tipos de columna, sin filtros ni fichas, y queda lo elegido en "Empezar por" ----
          { Object.assign(c.state, { mpEjeF: P.ejes[0] || '', mpQ: 'x', mpCols: ['c'], mpMenuCol: 1, mpAbre: { [primero]: true }, mpFichas: { [primero]: true }, mpSel: primero }); const vr = c.renderVals(); vr.mpVerTodo(); mapaN.reinicios++;
            if (Object.keys(c.state.mpAbre).length || c.state.mpCols.length || c.state.mpMenuCol != null || Object.values(c.state.mpFichas || {}).some(Boolean) || c.state.mpSel || c.state.mpEjeF || c.state.mpActF || c.state.mpQ || c.state.mpPor !== por) faltan.add(`"Volver a empezar" no deja el Mapa como al principio (o cambia "Empezar por"): ${donde}`);
            const vv = c.renderVals(); if (partes(vv).dotsN.length !== esperadosN || vv.mpEdges.length || vv.mpOpciones.length || vv.mpColumnas.length !== 1) faltan.add(`después de "Volver a empezar" quedan nodos abiertos: ${donde}`); }
          if (period !== periodos[0]) { Object.assign(c.state, base); continue; }
          // ---- "Ordenar por": Gasto (de mayor a menor), Nombre (A–Z) y Cómo rinde ----
          for (const [ord, etq] of [['nombre', 'Nombre'], ['rinde', 'Cómo rinde'], ['gasto', 'Gasto']]) {
            st({ mpPor: por, mpOrden: ord === 'gasto' ? 'nombre' : 'gasto' }); const va = c.renderVals(); va.mpOrdenOps.find((x) => x.label === etq).onClick(evento); mapaN.ordenes++;
            if (c.state.mpOrden !== ord) { faltan.add(`"Ordenar por ${etq}" no cambia el orden: ${donde}`); continue; }
            const vq = c.renderVals(); chequear(vq, donde + ' · orden ' + ord); revisarMapa(vq, donde + ' · orden ' + ord); const nq = partes(vq).raicesL.map(pt.nom);
            if (vq.mpOrdenOps.filter((x) => x.on).map((x) => x.label).join() !== etq) faltan.add(`el selector de orden no marca ${etq}: ${donde}`);
            if (ord === 'nombre' && !(nq.every((x, i) => !i || nq[i - 1].localeCompare(x, 'es') <= 0))) faltan.add(`lo de arranque no va de la A a la Z: ${donde} (${nq.join(', ')})`);
            if (ord === 'gasto' && JSON.stringify(nq) !== JSON.stringify(esperadoGasto.slice(0, esperadosN))) faltan.add(`volver a Gasto no deja el orden como al principio: ${donde}`);
            if (ord === 'nombre' && por === 'eje') { Object.assign(c.state, { mpCols: ['c'], mpAbre: { [primero]: true } }); const vn = c.renderVals(), cn = partes(vn).nodosL.filter((x) => px(x.style, 'font-size') === 12).map((x) => x.label.replace(/ · .*$/, '')); if (!cn.every((x, i) => !i || cn[i - 1].localeCompare(x, 'es') <= 0)) faltan.add(`las campañas abiertas no van de la A a la Z: ${donde}`); }
          }
          // ---- zoom: los botones +, − y Ajustar; al cambiar lo que se ve el dibujo es otro y se vuelve a ajustar ----
          if (por === 'eje') {
            st({ mpCols: ['c'], mpAbre: { [primero]: true }, mpSel: primero }); const vz = c.renderVals(); const ini = vz.mpCanvasStyle;
            if (!vz.mpMas || !vz.mpMenos || !vz.mpAjustar || vz.mpZoomado) faltan.add(`faltan los botones de zoom o el mapa abre ya acercado: ${donde}`);
            vz.mpMas(evento); mapaN.zoom++; const v1 = c.renderVals();
            if (!(v1.mpZoom > 1.2) || !v1.mpZoomado || v1.mpCanvasStyle === ini || !/scale\(/.test(v1.mpCanvasStyle)) faltan.add(`el botón + no acerca el mapa: ${donde}`);
            chequear(v1, donde + ' · con zoom'); revisarMapa(v1, donde + ' · con zoom');
            if (!v1.mpHasSel || !v1.mpHlEdges.length) faltan.add(`con zoom se pierde el resaltado o el panel: ${donde}`);
            v1.mpMenos(evento); const vq = c.renderVals(); vq.mpMas(evento); const v2 = c.renderVals(); v2.mpAjustar(evento); const v3 = c.renderVals(); const sinTr = (s) => s.replace(/transition:[^;]*/, '');
            if (c.state.mpView || v3.mpZoomado || sinTr(v3.mpCanvasStyle) !== sinTr(ini)) faltan.add(`"Ajustar" no vuelve a ver todo el mapa: ${donde}`);
            v3.mpMas(evento); const v4 = c.renderVals(); v4.mpOnPor({ target: { value: 'activo' } }); const v5 = c.renderVals(); if (v5.mpZoomado) faltan.add(`al cambiar "Empezar por" el mapa queda acercado: ${donde}`);
          }
          // ---- buscador "¿Dónde está…?": arma el camino y fija el tipo de cada columna ----
          { const rs = P.recs, algun = (f) => rs.find((r) => f(r)), cand = [];
            const rc = rs[0]; if (rc) cand.push(rc.c, rc.eje);
            const ra = algun((r) => r.a !== 'a:otras'); if (ra) cand.push(ra.a);
            const ru = algun((r) => r.u); if (ru) cand.push(ru.u);
            const rp = algun((r) => r.p); if (rp) cand.push(rp.p);
            for (const id of cand) {
              const nombreId = P.names[id]; st({ mpPor: por, mpQ: (nombreId || '').slice(0, 14), mpQOpen: true }); const vq = c.renderVals();
              const sug = id[0] === 'p' ? null : vq.mpSugs.find((x) => x.id === id); if (id[0] !== 'p' && !sug) { faltan.add(`el buscador no encuentra "${nombreId}": ${donde}`); continue; }
              if (id[0] === 'p') { c.state.mpSel = null; vq.mpPn; continue; }
              sug.onPick(evento); mapaN.busquedas++; const vf = c.renderVals(); chequear(vf, donde + ' · buscar ' + id); revisarMapa(vf, donde + ' · buscar ' + id);
              const sel = c.state.mpSel || '', segs = sel.split(SEP), t = id[0], raizLet = LET[por];
              const ejeRecuadro = t === 'e' && por !== 'eje', esperaLargo = ejeRecuadro ? 2 : t === raizLet ? 1 : t === 'c' ? 2 : 3;
              if ((ejeRecuadro ? !(segs[1] || '').startsWith('c:') || 'e:' + P.camps[segs[1]].eje !== id : segs[segs.length - 1] !== id) || segs.length !== esperaLargo) faltan.add(`buscar "${P.names[id]}" no arma el camino de ${esperaLargo} tramos (${segs.length}): ${donde}`);
              if (c.state.mpCols.join() !== segs.slice(1).map((x) => x[0]).join() || segs.slice(0, -1).some((_, i) => !c.state.mpAbre[segs.slice(0, i + 1).join(SEP)])) faltan.add(`buscar "${P.names[id]}" no fija los tipos de columna del camino ni abre cada tramo: ${donde}`);
              if (c.state.mpCols.includes('p') && !c.state.mpCols.slice(0, c.state.mpCols.indexOf('p')).includes('c')) faltan.add(`buscar "${P.names[id]}" deja Contenidos sin Campaña arriba: ${donde}`);
              if (!vf.mpHasSel || !vf.mpFlashList.length) faltan.add(`buscar "${P.names[id]}" no lo elige ni lo ubica con el destello: ${donde}`);
              if (!ejeRecuadro && !vf.mpDots.some((x) => x.title === P.names[id])) faltan.add(`buscar "${P.names[id]}" no lo deja a la vista: ${donde}`);
            }
            st({ mpPor: por, mpQ: 'zzzz-nada', mpQOpen: true }); v = c.renderVals(); if (!v.mpNoSug || v.mpSugs.length) faltan.add(`buscar algo que no existe no avisa: ${donde}`); }
          // ---- filtros de eje y de activo, con "Volver a empezar" ----
          if (P.ejes.length > 1) { st({ mpPor: por, mpEjeF: P.ejes[0] }); const vf = c.renderVals(); chequear(vf, donde + ' · filtro de eje'); revisarMapa(vf, donde + ' · filtro de eje'); mapaN.filtros++;
            if (por === 'eje' && partes(vf).dotsN.length !== 1) faltan.add(`el filtro de eje deja ${partes(vf).dotsN.length} nodos: ${donde}`);
            vf.mpVerTodo(); if (c.state.mpEjeF || c.state.mpSel) faltan.add(`"Volver a empezar" no saca el filtro de eje: ${donde}`); }
          if (P.acts.length) { st({ mpPor: por, mpActF: P.acts[0] }); const vf = c.renderVals(); chequear(vf, donde + ' · filtro de activo'); revisarMapa(vf, donde + ' · filtro de activo'); mapaN.filtros++;
            if (!vf.mpDots.length) faltan.add(`el filtro de activo deja el Mapa vacío: ${donde}`);
            vf.mpVerTodo(); if (c.state.mpActF) faltan.add(`"Volver a empezar" no saca el filtro de activo: ${donde}`); }
          Object.assign(c.state, base);
        }
      }
    }
  }
  c.setState = setOrig; c.state.tab = 'campañas'; c.state.paso = 'explora'; c.state.w = 1400; c.state.hv = 900;
  console.log(`Mapa: escala más chica en 1600 × 780 ${Math.round(mapaN.escalaMin * 100)} % (con un nodo y una campaña abiertos ${Math.round(mapaN.escalaAbierta * 100)} %, ${mapaN.abiertasSinAjuste} casos que pasan del alto y se mueven con el zoom) · ${mapaN.vistas} vistas · ${mapaN.rotulos} rótulos · ${mapaN.empezar} cambios de "Empezar por" · ${mapaN.elige} "Abrir por" · ${mapaN.aperturas} tipos elegidos · ${mapaN.directos} nodos que se abren directo con el tipo de su columna · ${mapaN.columnas} vistas con encabezados · ${mapaN.cierraDer} cambios de columna que cierran las de la derecha · ${mapaN.cadenas} cadenas de tipos (${mapaN.cuatro} de 4 columnas) · ${mapaN.notaSets || 0} fichas de conjunto con nota y ${mapaN.notaBurbujas || 0} burbujas con el color de su nota · ${mapaN.pCualquier || 0} Contenidos con la Campaña en cualquier lugar de arriba (${mapaN.pCruce || 0} con sus contenidos del cruce, ${mapaN.sinCruce || 0} sin datos del cruce) · ${mapaN.cierres} cierres · ${mapaN.hojas} hojas tocadas · ${mapaN.migas} migas · ${mapaN.reinicios} "Volver a empezar" · ${mapaN.busquedas} búsquedas · ${mapaN.filtros} filtros · ${mapaN.pills} con "+N" · ${mapaN.otras} con "otras redes" · ${mapaN.terminadas} con terminadas en gris · ${mapaN.detalleCamp} "Ver en Detalle" · ${mapaN.tabla} "Ver en la tabla" · ${mapaN.metricas2} métricas · ${mapaN.fichas} fichas (${mapaN.fichasP} de contenidos) · ${mapaN.cierraFicha} cierres con × · ${mapaN.cajas} con recuadros de eje · ${mapaN.ordenes} órdenes · ${mapaN.zoom} zooms`);
  if (!mapaN.elige || !mapaN.aperturas || !mapaN.directos || !mapaN.cierraDer || !mapaN.cadenas || !mapaN.cuatro || !mapaN.pCualquier || !mapaN.pCruce || !mapaN.notaSets || !mapaN.notaBurbujas || !mapaN.cierres || !mapaN.hojas || !mapaN.pills || !mapaN.otras || !mapaN.terminadas || !mapaN.detalleCamp || !mapaN.tabla || !mapaN.filtros || !mapaN.busquedas || !mapaN.migas || !mapaN.fichas || !mapaN.fichasP || !mapaN.cajas || !mapaN.cierraFicha) faltan.add('el Mapa no se probó completo ("Abrir por", tipo por columna, encabezados, cadenas de la jerarquía, cierres, hojas, "+N", otras redes, terminadas, Detalle, tabla, filtros, buscador, migas, fichas, recuadros)');
}
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
