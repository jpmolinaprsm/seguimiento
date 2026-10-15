// Parches acordados sobre el markup del diseño curado (Claude Design). Cada uno es [patrón, reemplazo]; el patrón puede ser
// texto exacto o una expresión regular tolerante a espacios. Lo demás del diseño no se toca.
// tolerante a espacios y saltos de línea entre tags (el diseño está indentado; el patrón se escribe compacto)
const REC = require('./recorrido.js');
const ws = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/>\s*</g, '>\\s*<').replace(/\s+/g, '\\s*'));

const looker = require('./looker.js');
// un renglón de luz: punto de color y la frase; la frase completa al pasar el mouse
const LINEA = (fs) => `<span title="{{ l.title }}" style="display:flex;align-items:flex-start;gap:6px;font-size:${fs};line-height:1.4;color:#5C5C5C;text-wrap:pretty"><span style="flex:none;margin-top:3px;width:9px;height:9px;border-radius:50%;box-sizing:border-box;background:{{ l.bg }};border:{{ l.bd }}"></span><span>{{ l.txt }}</span></span>`;

// lista de Campañas (01/10): una sola columna de Métrica con selector arriba. Celda = (en "Según objetivo", el nombre del KPI), el valor y
// dos renglones chicos con la referencia entre paréntesis, cada uno en una sola línea
const COLS_CAMP = 'minmax(260px,2fr) 150px 90px 80px 90px minmax(330px,1.5fr) 70px 70px';
const RENGLON_KPI = (q, a = 'r') => `<sc-if value="{{ ${a}.kpi.has${q.toUpperCase()} }}"><div title="{{ ${a}.kpi.${q}.title }}" style="font-size:11px;line-height:1.4;color:{{ ${a}.kpi.${q}.color }};white-space:nowrap">{{ ${a}.kpi.${q}.txt }}</div></sc-if>`;
// CTR (02/10): la parte de Tráfico en Google, un renglón por red, debajo de las dos comparaciones. Puede ocupar dos líneas (es más largo:
// "Search: 3,12 % · vs. lo normal de Search en Santa Fe (10,36 %): −70 % ▼ peor")
const RENGLON_GG = (a) => `<sc-if value="{{ ${a}.kpi.hasG }}"><sc-for list="{{ ${a}.kpi.gs }}" as="gl" hint-placeholder-count="1"><div title="{{ gl.title }}" style="font-size:11px;line-height:1.4;color:{{ gl.color }};text-wrap:pretty">{{ gl.txt }}</div></sc-for></sc-if>`;
// CPM de Alcance en varias cuentas (02/10): un renglón por cuenta y abajo por qué no se suma (nunca un CPM combinado)
const RENGLON_CUENTAS = (a) => `<sc-if value="{{ ${a}.kpi.hasC }}"><sc-for list="{{ ${a}.kpi.cs }}" as="cl" hint-placeholder-count="1"><div title="{{ cl.title }}" style="font-size:11px;line-height:1.4;color:{{ cl.color }};text-wrap:pretty">{{ cl.txt }}</div></sc-for></sc-if>`;
// el nombre del KPI va en la misma línea que el valor y con el mismo peso ("CPM: $352"), con cualquier opción del selector (01/10)
const celdaKpi = (a) => `<div title="{{ ${a}.kpi.title }}" style="display:flex;flex-direction:column;gap:1px;min-width:0">`
  + `<div style="font-size:13px;font-weight:{{ ${a}.kpi.fw }};color:{{ ${a}.kpi.valColor }}">{{ ${a}.kpi.linea }}</div>` + RENGLON_KPI('p', a) + RENGLON_KPI('s', a) + RENGLON_GG(a) + RENGLON_CUENTAS(a) + '</div>';
const CELDA_KPI = celdaKpi('r');
// Impresiones y Reacciones del período (01/10): números cortos, sin comparaciones ni colores; solo Stories: "no aplica (Stories)"
const CELDAS_CANT = '<span>{{ r.impC }}</span><span style="color:{{ r.reaGris }}">{{ r.reaC }}</span>';
// el nombre de la campaña queda fijo a la izquierda si la tabla se corre de costado (la tabla tiene su propio scroll, no la página)
const FIJA = 'position:sticky;left:0;z-index:1;background:#FFFFFF;margin-right:-14px;padding-right:14px';
// selector de KPI, con el estilo de los botones Oficial / Informativo
const SELECTOR_KPI = '<div style="margin-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span style="font-size:12px;color:#808080">Métrica</span>'
  + '<div style="display:inline-flex;flex-wrap:wrap;padding:3px;background:#F4F4F4;border-radius:9999px"><sc-for list="{{ campKpiOps }}" as="op" hint-placeholder-count="8">'
  + '<button sc-camel-on-click="{{ op.onClick }}" style="border:none;border-radius:9999px;padding:4px 12px;font-size:12.5px;font-weight:500;cursor:pointer;color:{{ op.color }};background:{{ op.bg }};box-shadow:{{ op.shadow }}">{{ op.label }}</button></sc-for></div></div>';

// Contenidos y Audiencias de una campaña (01/10): Impresiones, Reacciones y la misma columna de Métrica que la lista de Campañas, con el
// mismo selector (compartido); la segunda comparación es contra toda la campaña
const COLS_CONT = 'minmax(240px,2.2fr) 80px 50px 80px 90px minmax(300px,1.5fr) 80px 90px 90px';
const COLS_AUD = 'minmax(220px,2fr) 80px 90px minmax(300px,1.5fr) 80px 100px 110px';
const TITULO_KPI = '<span title="{{ campKpiAyuda }}" style="cursor:help">{{ campKpiTitulo }} <span style="color:#A6AAA9">ⓘ</span></span>';
const LEYENDA_CT = '<p style="margin:12px 0 0;font-size:12px;line-height:1.55;color:#808080;max-width:1100px;text-wrap:pretty">{{ ctLeyenda }}</p>';
// Revisar campañas (01/10): Impresiones, Reacciones y la columna de Métrica (mes en curso) en lugar del KPI y las luces
// etiqueta "Oficial + Informativo" (General) o el proyecto (Todos los proyectos) al lado del nombre de la campaña (01/10)
const ETQ = (a) => `<sc-if value="{{ ${a}.etq }}"><span title="{{ ${a}.etqTitle }}" style="font-size:10.5px;padding:0 8px;border-radius:9999px;background:#F4F4F4;color:#5C5C5C;white-space:nowrap">{{ ${a}.etq }}</span></sc-if>`;
const DATO_REVISAR = (rot, campo, color) => `<div style="flex:0 0 76px"><div style="font-size:11px;color:#808080">${rot}</div><div style="font-size:13px;font-weight:600${color ? ';color:' + color : ''}">{{ c.${campo} }}</div></div>`;

module.exports = [
  // ---- pestaña Looker (nueva): va antes de Insights ----
  ['<sc-if value="{{ isInsights }}">', looker + '<sc-if value="{{ isInsights }}">'],
  // ---- textos fijos que pasan a ser datos ----
  ['>Santa Fe</h1>', '>{{ projName }}</h1>'],
  ['Septiembre · canal {{ canal }} · datos al 28/09', '{{ mesTxt }} · canal {{ canal }} · datos al {{ datosAl }}'],
  ['Datos al 28/09</span>', 'Datos al {{ datosAl }}</span>'],
  ['Gasto al 28/09</span>', 'Gasto al {{ datosAl }}</span>'],
  ['>Obras que Sí</h1>', '>{{ campName }}</h1>'],
  [ws('<span>Alcance</span><span style="color:#D5D5D5">·</span><span>Eje Obras</span><span style="color:#D5D5D5">·</span><span>01/08 – 30/09</span>'),
    '<span>{{ campObj }}</span><span style="color:#D5D5D5">·</span><span>Eje {{ campEje }}</span><span style="color:#D5D5D5">·</span><span>{{ campFechas }}</span>'],
  [ws('<span style="width:8px;height:8px;border-radius:50%;background:#FCB942"></span>Termina esta semana</span>'),
    '<span style="width:8px;height:8px;border-radius:50%;background:{{ campEstDot }}"></span>{{ campEstado }}</span>'],
  [ws('<span style="padding:2px 10px;border-radius:9999px;border:1px solid #D5D5D5;color:#3C3C3C">campaña larga</span>'),
    '<sc-if value="{{ campHasTag }}"><span style="padding:2px 10px;border-radius:9999px;border:1px solid #D5D5D5;color:#3C3C3C">{{ campTag }}</span></sc-if>'
    + '<span style="display:inline-flex;align-items:center;gap:6px" title="Constante: se comunica todo el año. Estacional: vuelve en la misma época. Si no es ninguna de las dos, es larga (30 días o más) o puntual. Define contra qué se compara la campaña: sus semanas anteriores o la temporada pasada."><span style="color:#A6AAA9">Tipo</span><span style="display:inline-flex;padding:2px;background:#F4F4F4;border-radius:9999px"><sc-for list="{{ campTipos }}" as="op" hint-placeholder-count="3"><button sc-camel-on-click="{{ op.onClick }}" style="border:none;border-radius:9999px;padding:2px 10px;font-size:11.5px;font-weight:500;cursor:pointer;color:{{ op.color }};background:{{ op.bg }};box-shadow:{{ op.shadow }}">{{ op.label }}</button></sc-for></span></span>'],
  ['CPM semanal de la campaña', '{{ campHistTitle }}'],
  ['>Campañas que rinden mal</h2>', '>Revisar campañas</h2>'],
  // ---- en el detalle, el sobrecosto se dice con todas las letras ("de más" se leía como pasarse del presupuesto) ----
  // Revisar campañas: "$3,9 M de más vs. el CPM normal de Santa Fe" y "17 % del gasto en anuncios flojos" (antes "pagó … más que lo habitual"
  // y "17 % en rojo"); la frase completa al pasar el mouse. En General y en Todos los proyectos, la etiqueta con los canales o el proyecto
  [ws('<span style="color:#E9121C;font-weight:600">{{ c.demas }} de más</span><span style="display:inline-flex;align-items:center;gap:5px;color:#808080"><span style="width:9px;height:9px;border-radius:2px;background:{{ c.ef.c }}"></span>{{ c.ef.short }} en rojo</span>'),
    '<sc-if value="{{ c.demas }}"><span title="{{ c.demasTitle }}" style="color:#E9121C;font-weight:600">{{ c.demasTxt }}</span></sc-if><span title="{{ c.ef.title }}" style="display:inline-flex;align-items:center;gap:5px;color:#808080"><span style="width:9px;height:9px;border-radius:2px;background:{{ c.ef.c }}"></span>{{ c.ef.corto }}</span>'],
  [ws('<span style="font-size:14px;font-weight:600">{{ c.name }}</span>'), '<span style="font-size:14px;font-weight:600">{{ c.name }}</span>' + ETQ('c')],
  // lista de Campañas: lo mismo debajo del nombre, y la etiqueta (canales en General, proyecto en Todos los proyectos) al lado del nombre
  [ws('<div style="margin-top:2px;font-size:11.5px;font-weight:600;color:#E9121C">{{ r.demas }} de más</div>'), '<div title="{{ r.demasTitle }}" style="margin-top:2px;font-size:11.5px;font-weight:600;color:#E9121C">{{ r.demasTxt }}</div>'],
  ['<span style="font-size:13.5px;font-weight:600">{{ r.name }}</span>', '<span style="font-size:13.5px;font-weight:600">{{ r.name }}</span>' + ETQ('r')],
  // lista de acciones: lo de más con la frase completa al pasar el mouse
  ['<span style="color:#E9121C;font-weight:600">{{ i.plata }}</span>', '<span title="{{ i.plataTitle }}" style="color:#E9121C;font-weight:600">{{ i.plata }}</span>'],
  // ---- tarjeta de presupuesto: "Tiempo" y el eje de fechas del gráfico eran fijos (del ejemplo: 93 %, día 28 de 30, 1/09–30/09) ----
  ['line-height:1.15">93 %</div>', 'line-height:1.15">{{ b.tiempoPct }} %</div>'],
  ['>día 28 de 30</div>', '>día {{ b.dia }} de {{ b.diasMes }}</div>'],
  ['fill="#A6AAA9">1/09</text>', 'fill="#A6AAA9">{{ b.ejeIni }}</text>'],
  ['text-anchor="middle">15/09</text>', 'text-anchor="middle">{{ b.ejeMed }}</text>'],
  ['text-anchor="end">30/09</text>', 'text-anchor="end">{{ b.ejeFin }}</text>'],
  // ---- pantalla de campaña: el encabezado de "Rendimiento" tenía los números del ejemplo del diseño (Obras que Sí) → datos reales ----
  [ws('<span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:#808080"><span style="width:9px;height:9px;border-radius:2px;background:#FCB942"></span>32 % del gasto en rojo (55 de 178)</span>'),
    // selector de período del panel (02/10): "Este mes" / "Histórica" (o "Esta temporada"), chico, antes de la línea que dice qué se ve
    '<span style="display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0"><span style="display:inline-flex;gap:4px"><sc-for list="{{ campRendOps }}" as="o" hint-placeholder-count="2">'
    + '<button sc-camel-on-click="{{ o.onClick }}" style="border:1px solid {{ o.bd }};background:{{ o.bg }};color:{{ o.color }};border-radius:9999px;padding:2px 10px;font-size:11.5px;cursor:pointer;white-space:nowrap">{{ o.label }}</button></sc-for></span>'
    + '<span style="font-size:12.5px;color:#808080">{{ campRendLinea }}</span></span>'],
  [ws('<span style="font-size:12.5px;color:#E9121C;font-weight:600">$2,1 M de más</span>'), ''],
  ['"$ de más" es lo gastado por encima de lo que habría costado el mismo resultado al costo habitual del proyecto.', '“$3,9 M de más vs. el CPM normal de Santa Fe”: le costó $3,9 M más que si hubiera pagado el costo normal del proyecto (CPM en Alcance, costo por reacción en Interacción, costo por click en Tráfico) por lo mismo que consiguió. Es lo gastado por encima de los costos normales del proyecto en el último año; no tiene relación con el presupuesto. Al pasar el mouse se ve la frase completa con el valor normal.'],
  // ---- portada: sin "$ de más" (se confundía con pasarse del presupuesto) ni la leyenda de luces que ya no están ----
  [ws('<div style="font-size:12.5px;font-weight:600;color:{{ p.demasColor }};white-space:nowrap">{{ p.demas }}</div>'), ''],
  [/<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:#808080">\s*<span[^>]*><span[^>]*><\/span>Al menos 20 % mejor<\/span>[\s\S]*?Sin referencia<\/span>\s*<\/div>/, ''],
  ['Ordenados por plata gastada de más. Cada tarjeta dice si el mes cierra en presupuesto y cómo rinde la pauta contra lo normal.', 'Cada tarjeta dice si el mes cierra en presupuesto, cuántas campañas hay activas y cuántas acciones quedan por resolver.'],
  ['General compara contra lo normal en todos los gobiernos, último año, mismo objetivo × formato × placement. Proyecto compara contra lo normal en este proyecto y canal. El número es cuántas veces lo normal; en costos, más de 1 es más barato. La proyección toma el ritmo de los últimos 2 días completos.', 'Gasto del mes: lo invertido contra el PresupuestoMensual de DataJunta. “Cierra en” proyecta el cierre sumando al gasto acumulado el ritmo de los últimos 2 días completos por los días que faltan: verde entre 85 % y 102 % del presupuesto, amarillo por debajo, rojo por encima.'],
  // ---- descartar con motivo "Otra": el usuario escribe por qué ----
  [ws('<button sc-camel-on-click="{{ r.onClick }}" style="border:1px solid #D5D5D5;background:#FFFFFF;border-radius:9999px;padding:4px 12px;font-size:12px;cursor:pointer" style-hover="background:#F4F4F4">{{ r.label }}</button></sc-for></div>'),
    '<button sc-camel-on-click="{{ r.onClick }}" style="border:1px solid {{ r.bd }};background:{{ r.bg }};color:{{ r.color }};border-radius:9999px;padding:4px 12px;font-size:12px;cursor:pointer">{{ r.label }}</button></sc-for></div>'
    + '<sc-if value="{{ c.otraOpen }}"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input value="{{ c.otraTxt }}" sc-camel-on-change="{{ c.onOtraTxt }}" placeholder="Escribí por qué la descartás…" style="flex:1;min-width:200px;border:1px solid #D5D5D5;border-radius:10px;padding:7px 12px;font-size:12.5px;font-family:inherit;background:#FFFFFF">'
    + '<button sc-camel-on-click="{{ c.onOtraOk }}" style="border:none;background:#3C3C3C;color:#FFFFFF;border-radius:9999px;padding:7px 15px;font-size:12.5px;font-weight:600;cursor:{{ c.otraCursor }};opacity:{{ c.otraOpacity }}">Descartar</button></div></sc-if>'],
  // ---- Insights: categorizar campañas en Constante / Estacional / Puntual (antes solo "Es estacional / No es") ----
  [/<h2[^>]*>Campañas estacionales detectadas<\/h2>[\s\S]*?(?=<\/div>\s*<sc-for list="\{\{ insLists \}\}")/, '<h2 style="margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em">Tipo de campaña</h2><p style="margin:4px 0 0;font-size:13px;color:#808080;text-wrap:pretty">A confirmar. <b>Constante</b>: se comunica todo el año (por ejemplo, Operativos de Seguridad); se compara contra sus propias semanas anteriores. <b>Estacional</b>: vuelve en la misma época; se compara contra la temporada anterior. Las demás son <b>largas</b> (30 días o más; se comparan contra sus propias semanas) o <b>puntuales</b> (menos de 30 días), según cuánto duran. Lo que elijas define contra qué se compara (sus semanas anteriores o la temporada pasada) y en qué filtro de Campañas aparece.</p><div style="margin-top:12px"><sc-for list="{{ insSeason }}" as="r" hint-placeholder-count="2"><div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding:14px 0;border-top:1px solid #E4E4E4"><div style="min-width:0;flex:1 1 360px"><div style="font-size:13.5px;font-weight:600">{{ r.name }}</div><div style="margin-top:3px;font-size:12px;color:#808080">{{ r.detalle }}</div></div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="font-size:11.5px;color:#A6AAA9">{{ r.nota }}</span><div style="display:flex;padding:3px;background:#F4F4F4;border-radius:9999px"><sc-for list="{{ r.ops }}" as="op" hint-placeholder-count="3"><button sc-camel-on-click="{{ op.onClick }}" style="border:none;border-radius:9999px;padding:5px 13px;font-size:12.5px;font-weight:500;cursor:pointer;color:{{ op.color }};background:{{ op.bg }};box-shadow:{{ op.shadow }}">{{ op.label }}</button></sc-for></div></div></div></sc-for><sc-if value="{{ insSeasonVacio }}"><div style="padding:18px 0;border-top:1px solid #E4E4E4;font-size:13px;color:#808080">No se detectaron campañas constantes ni estacionales en este proyecto.</div></sc-if></div>'],
  // ---- grilla más ancha: portada y campaña usan el mismo ancho máximo que el proyecto ----
  [new RegExp('max-width:1200px;margin:0 auto;', 'g'), 'max-width:{{ L.max }};margin:0 auto;'],
  // ---- sin luces General / Proyecto en el encabezado del proyecto ni en la portada ----
  [ws('<div style="display:flex;gap:14px"><sc-for list="{{ projLights }}" as="l" hint-placeholder-count="2"><span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:#808080"><span style="width:9px;height:9px;border-radius:50%;background:{{ l.bg }}"></span>{{ l.label }}<span style="color:#3C3C3C;font-weight:600">{{ l.num }}</span></span></sc-for></div>'), ''],
  [ws('<div style="display:flex;flex-direction:column;gap:6px"><div style="font-size:11.5px;color:#808080">Rendimiento del mes</div><div style="display:flex;gap:14px;flex-wrap:wrap"><sc-for list="{{ p.lights }}" as="l" hint-placeholder-count="2"><span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:#808080"><span style="width:9px;height:9px;border-radius:50%;box-sizing:border-box;background:{{ l.bg }};border:{{ l.bd }}"></span>{{ l.label }}<span style="color:#3C3C3C;font-weight:600">{{ l.num }}</span></span></sc-for></div></div>'), ''],
  // ---- el botón "Explorar en Looker" del encabezado sale: lo reemplaza la pestaña Looker ----
  [ws('<a href="#" sc-camel-on-click="{{ looker }}" style="font-size:13px;font-weight:500">Explorar en Looker ↗</a>'), ''],
  // ---- lo que no ocupa todo el ancho va centrado (gráfico de historia de la campaña, ayudas) ----
  ['style="width:100%;max-width:760px;height:auto;display:block;margin-top:18px"', 'style="width:100%;max-width:760px;height:auto;display:block;margin:18px auto 0"'],
  ['style="margin-top:10px;padding:12px 14px;background:#F5F5F5;border-radius:10px;font-size:12.5px;line-height:1.6;max-width:760px"', 'style="margin:10px auto 0;padding:12px 14px;background:#F5F5F5;border-radius:10px;font-size:12.5px;line-height:1.6;max-width:760px"'],

  // ---- chips de plataforma: logo en vez de iniciales (las 4 apariciones) ----
  [new RegExp(ws('<span title="{{ pl.name }}" style="width:20px;height:20px;border-radius:50%;background:#F4F4F4;display:inline-flex;align-items:center;justify-content:center;font-size:8.5px;font-weight:600;letter-spacing:0.02em;color:#3C3C3C">{{ pl.code }}</span>').source, 'g'),
    '<img src="{{ pl.icon }}" alt="{{ pl.name }}" title="{{ pl.name }}" style="width:15px;height:15px;display:inline-block;vertical-align:-3px;margin-right:1px">'],

  // ---- vista previa de pieza: iframe real de Facebook / Instagram / YouTube ----
  [ws('<div style="aspect-ratio:4 / 5;background:#F4F4F4;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center;font-size:12px;color:#808080">Vista previa embebida de {{ e.red }}<br>{{ pieza }}</div>'),
    '<sc-if value="{{ e.src }}"><iframe src="{{ e.src }}" style="display:block;width:100%;height:{{ e.h }};border:none;background:#F4F4F4" loading="lazy" scrolling="no" allowfullscreen></iframe></sc-if>'
    + '<sc-if value="{{ e.noSrc }}"><div style="aspect-ratio:4 / 5;background:#F4F4F4;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center;font-size:12px;color:#808080">{{ e.nota }}<br>{{ pieza }}</div></sc-if>'],
  [ws('<a href="#" style="font-size:12px">abrir en {{ e.red }} ↗</a>'), '<sc-if value="{{ e.url }}"><a href="{{ e.url }}" target="_blank" rel="noopener" style="font-size:12px">abrir en {{ e.red }} ↗</a></sc-if>'],

  // ---- hasta dónde va a llegar y solapan público (pedido de Juan Pablo del 30/09) ----
  // lista de Campañas: la etiqueta corta debajo del estado (frase entera al pasar el mouse) y la marca "solapan público" junto al tipo
  ['<span style="display:inline-flex;align-items:center;gap:6px;color:{{ r.estColor }}"><sc-if value="{{ r.estDot }}"><span style="width:8px;height:8px;border-radius:50%;background:{{ r.estDot }}"></span></sc-if>{{ r.estado }}</span>',
    '<div style="display:flex;flex-direction:column;gap:3px;min-width:0"><span style="display:inline-flex;align-items:center;gap:6px;color:{{ r.estColor }}"><sc-if value="{{ r.estDot }}"><span style="width:8px;height:8px;border-radius:50%;background:{{ r.estDot }}"></span></sc-if>{{ r.estado }}</span>'
    + '<sc-if value="{{ r.hasLleg }}"><span title="{{ r.llegTitle }}" style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:#808080"><span style="width:8px;height:8px;border-radius:2px;background:{{ r.llegDot }}"></span>{{ r.llegTxt }}</span></sc-if></div>'],
  ['{{ r.tag }}</span></sc-if>', '{{ r.tag }}</span></sc-if><sc-if value="{{ r.hasSol }}"><span title="{{ r.solTitle }}" style="font-size:10.5px;padding:0 8px;border-radius:9999px;border:1px dashed #A6AAA9;color:#808080">solapan público</span></sc-if>'],
  // pantalla de campaña: bloque propio antes de Rendimiento
  [ws('<div data-block="1"><div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap"><div style="display:flex;align-items:baseline;gap:16px;flex-wrap:wrap"><h2 style="margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em">Rendimiento</h2>'),
    '<sc-if value="{{ hasLlegOSol }}"><div data-block="1">'
    + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap"><div style="display:flex;align-items:baseline;gap:16px;flex-wrap:wrap"><h2 style="margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em">Hasta dónde va a llegar</h2>'
    + '<sc-if value="{{ hasLlegada }}"><span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:#3C3C3C;font-weight:600"><span style="width:9px;height:9px;border-radius:2px;background:{{ llegada.dot }}"></span>{{ llegada.etiqueta }}</span></sc-if>'
    + '<sc-if value="{{ hasSolapan }}"><span style="font-size:11.5px;padding:1px 10px;border-radius:9999px;border:1px dashed #A6AAA9;color:#808080">solapan público</span></sc-if></div>'
    + '<button sc-camel-on-click="{{ h.lleg.toggle }}" style="border:none;background:none;padding:0;font-size:12.5px;text-decoration:underline;text-underline-offset:3px;cursor:pointer">ⓘ Cómo se calcula</button></div>'
    + '<sc-if value="{{ h.lleg.open }}"><div style="margin:10px auto 0;padding:12px 14px;background:#F5F5F5;border-radius:10px;font-size:12.5px;line-height:1.6;max-width:760px">{{ llegAyuda }}</div></sc-if>'
    + '<sc-if value="{{ hasLlegada }}"><p style="margin:10px 0 0;font-size:14px;line-height:1.6;max-width:860px;text-wrap:pretty">{{ llegada.frase }}</p><p style="margin:6px 0 0;font-size:12px;line-height:1.5;color:#808080;max-width:860px;text-wrap:pretty">{{ llegada.plata }}</p></sc-if>'
    + '<sc-if value="{{ hasSolapan }}"><div style="margin-top:14px;padding:12px 14px;border:1px solid #E4E4E4;border-radius:12px;max-width:860px;font-size:12.5px;line-height:1.55"><div style="font-size:11.5px;color:#808080;margin-bottom:4px">Solapan público</div><div>{{ solapan.resumen }}</div>'
    + '<ul style="margin:6px 0 0;padding-left:18px"><sc-for list="{{ solapan.pares }}" as="sp" hint-placeholder-count="0"><li>{{ sp.txt }}</li></sc-for></ul><sc-if value="{{ solapan.hayMas }}"><div style="margin-top:4px;color:#808080">{{ solapan.mas }}</div></sc-if></div></sc-if>'
    + '</div></sc-if>'
    + '<div data-block="1"><div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap"><div style="display:flex;align-items:baseline;gap:16px;flex-wrap:wrap"><h2 style="margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em">Rendimiento</h2>'],
  // ---- "Hecho a mano" pide motivo (flujo operativo del 30/09: siempre hay un motivo); la lista está en MOTIVOS_MANUAL de logica.js ----
  [ws('<sc-if value="{{ c.sendBlocked }}"><div style="margin-top:-6px;font-size:11.5px;color:#808080">{{ c.sendTitle }}</div></sc-if>'),
    '<sc-if value="{{ c.sendBlocked }}"><div style="margin-top:-6px;font-size:11.5px;color:#808080">{{ c.sendTitle }}</div></sc-if>'
    + '<sc-if value="{{ c.manualOpen }}"><div style="display:flex;flex-direction:column;gap:8px;padding:12px 14px;border:1px solid #E4E4E4;border-radius:12px">'
    + '<span style="font-size:12px;color:#808080">¿Por qué la hiciste a mano?</span>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap"><sc-for list="{{ c.motivosManual }}" as="m" hint-placeholder-count="7"><button sc-camel-on-click="{{ m.onClick }}" style="border:1px solid {{ m.bd }};background:{{ m.bg }};color:{{ m.color }};border-radius:9999px;padding:4px 12px;font-size:12px;cursor:pointer;text-align:left">{{ m.label }}</button></sc-for></div>'
    + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><sc-if value="{{ c.manualPideTxt }}"><input value="{{ c.manualTxt }}" sc-camel-on-change="{{ c.onManualTxt }}" placeholder="{{ c.manualPh }}" style="flex:1;min-width:200px;border:1px solid #D5D5D5;border-radius:10px;padding:7px 12px;font-size:12.5px;font-family:inherit;background:#FFFFFF"></sc-if>'
    + '<button sc-camel-on-click="{{ c.onManualOk }}" style="border:none;background:#3C3C3C;color:#FFFFFF;border-radius:9999px;padding:7px 15px;font-size:12.5px;font-weight:600;cursor:{{ c.manualCursor }};opacity:{{ c.manualOpacity }}">Confirmar hecha a mano</button></div></div></sc-if>'],
  // ---- Reglas vigentes: sección de "Cómo leer", antes de "Cómo comentar". Se leen y se comentan (con autor) ----
  [ws('<div><h2 style="margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em">Cómo comentar</h2>'),
    '<div><h2 style="margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em">Reglas vigentes</h2>'
    + '<p style="margin:6px 0 0;font-size:13.5px;line-height:1.6;text-wrap:pretty">{{ reglasSub }}</p>'
    + '<div style="margin-top:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:12.5px;color:#808080"><span>{{ reglasAutor }}</span><button sc-camel-on-click="{{ cambiarAutor }}" style="border:none;background:none;padding:0;font-size:12.5px;text-decoration:underline;text-underline-offset:3px;cursor:pointer">cambiar</button></div>'
    + '<sc-if value="{{ reglasOffline }}"><div style="margin-top:8px;font-size:12.5px;color:#808080">Para comentar hay que abrir la app desde el servidor local (http://localhost:4330): abierta con doble clic, los comentarios no se guardan.</div></sc-if>'
    + '<div style="margin-top:14px"><sc-for list="{{ reglasLista }}" as="r" hint-placeholder-count="15"><div style="padding:14px 0;border-top:1px solid #F0F0F0;display:flex;flex-direction:column;gap:8px">'
    + '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><span style="font-size:14px;font-weight:600">{{ r.nombre }}</span><span style="font-size:11.5px;color:#A6AAA9">{{ r.id }} · {{ r.plats }}</span><span style="font-size:11px;padding:1px 9px;border-radius:9999px;border:1px solid #D5D5D5;color:#5C5C5C">{{ r.via }}</span></div>'
    + '<div style="display:grid;grid-template-columns:170px minmax(0,1fr);gap:6px 16px;font-size:13px;line-height:1.5">'
    + '<span style="color:#808080">Cuándo se dispara</span><span style="text-wrap:pretty">{{ r.cuando }}</span>'
    + '<span style="color:#808080">Qué propone</span><span style="text-wrap:pretty">{{ r.propone }}</span>'
    + '<sc-if value="{{ r.hasComo }}"><span style="color:#808080">Cómo lo detectamos</span><span style="color:#5C5C5C;text-wrap:pretty">{{ r.como }}</span></sc-if>'
    + '<sc-if value="{{ r.hasViaNota }}"><span style="color:#808080">PAUTADOR</span><span style="color:#5C5C5C;text-wrap:pretty">{{ r.viaNota }}</span></sc-if></div>'
    + '<sc-if value="{{ r.hasComs }}"><div style="display:flex;flex-direction:column;gap:6px;padding:10px 12px;background:#F7F7F7;border-radius:10px"><sc-for list="{{ r.coms }}" as="k" hint-placeholder-count="0"><div style="font-size:12.5px;line-height:1.5"><div style="font-size:11.5px;color:#808080">{{ k.quien }}</div><div style="text-wrap:pretty">{{ k.txt }}</div></div></sc-for></div></sc-if>'
    + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input value="{{ r.draft }}" sc-camel-on-change="{{ r.onDraft }}" placeholder="Comentar esta regla…" style="flex:1;min-width:200px;border:1px solid #E4E4E4;border-radius:10px;padding:7px 12px;font-size:12.5px;font-family:inherit;background:#FFFFFF">'
    + '<button sc-camel-on-click="{{ r.onComentar }}" style="border:1px solid #D5D5D5;background:#FFFFFF;border-radius:9999px;padding:6px 14px;font-size:12.5px;font-weight:500;cursor:{{ r.cCursor }};opacity:{{ r.cOpacity }}">Comentar</button></div>'
    + '</div></sc-for></div>'
    + '<sc-if value="{{ hayObservacion }}"><div style="margin-top:6px;padding:12px 14px;border:1px dashed #A6AAA9;border-radius:12px;font-size:12.5px;line-height:1.55"><sc-for list="{{ observacion }}" as="o" hint-placeholder-count="1"><div><span style="font-weight:600">En observación, todavía no genera recomendaciones: {{ o.nombre }}.</span> <span style="color:#5C5C5C">{{ o.regla }}</span></div></sc-for></div></sc-if>'
    + '<sc-if value="{{ hayNotasReglas }}"><div style="margin-top:14px;font-size:12px;color:#808080">Notas</div><ul style="margin:4px 0 0;padding-left:18px;font-size:12.5px;line-height:1.55;color:#5C5C5C"><sc-for list="{{ notasReglas }}" as="n" hint-placeholder-count="4"><li style="text-wrap:pretty">{{ n.t }}</li></sc-for></ul></sc-if>'
    + '</div>'
    + '<div><h2 style="margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em">Cómo comentar</h2>'],
  // ---- tarjeta de acción: Problema → Solución · Afectado · Qué revisar ----
  [ws('<div><div style="font-size:11.5px;color:#808080;margin-bottom:3px">Qué pasa</div><div style="font-size:13px;line-height:1.55;text-wrap:pretty">{{ c.que }}</div></div><div style="font-size:13.5px;font-weight:600;line-height:1.5;text-wrap:pretty">→ {{ c.hacer }}</div>'),
    '<div><div style="font-size:11.5px;color:#808080;margin-bottom:3px">Problema</div><div style="font-size:13px;line-height:1.55;text-wrap:pretty">{{ c.problema }}</div></div>'
    + '<div><div style="font-size:11.5px;color:#808080;margin-bottom:3px">Solución</div><div style="font-size:13.5px;font-weight:600;line-height:1.5;text-wrap:pretty">→ {{ c.solucion }}</div></div>'],
  [ws('<div style="padding:12px 14px;background:#F5F5F5;border-radius:12px"><div style="font-size:11.5px;color:#808080;margin-bottom:3px">Por qué · {{ c.fuente }}</div>'),
    '<sc-if value="{{ c.hasAfectado }}"><div style="border:1px solid #E4E4E4;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:10px">'
    + '<div style="font-size:11.5px;color:#808080">Qué está afectado</div>'
    + '<div style="display:grid;grid-template-columns:110px minmax(0,1fr);gap:6px 12px;font-size:12.5px;line-height:1.5">'
    + '<sc-if value="{{ c.afCampana }}"><span style="color:#808080">Campaña</span><span style="font-weight:500">{{ c.afCampana }}</span></sc-if>'
    + '<sc-if value="{{ c.hasContenidos }}"><span style="color:#808080">Contenido</span><span style="display:flex;flex-wrap:wrap;gap:6px"><sc-for list="{{ c.contenidos }}" as="p" hint-placeholder-count="0"><button sc-camel-on-click="{{ p.onClick }}" style="border:1px solid #E4E4E4;background:#FFFFFF;border-radius:10px;padding:4px 10px;font-size:12px;cursor:pointer;text-align:left" style-hover="border-color:#A6AAA9">{{ p.label }} ▸</button></sc-for></span></sc-if>'
    + '<sc-if value="{{ c.hasConj }}"><span style="color:#808080">Conjuntos</span><span style="display:flex;flex-direction:column;gap:5px"><sc-for list="{{ c.conjuntos }}" as="k" hint-placeholder-count="0"><span title="{{ k.nombre }}" style="display:flex;justify-content:space-between;gap:10px;font-size:12px"><span style="min-width:0;font-family:ui-monospace,Menlo,monospace;font-size:11.5px">{{ k.corto }}</span><span style="flex:none;color:#808080">{{ k.gastoT }} · {{ k.metrica }}</span></span></sc-for></span></sc-if>'
    + '</div></div></sc-if>'
    + '<sc-if value="{{ c.hasRevisar }}"><div><div style="font-size:11.5px;color:#808080;margin-bottom:4px">Qué revisar</div><ul style="margin:0;padding-left:18px;font-size:12.5px;line-height:1.55"><sc-for list="{{ c.revisar }}" as="r" hint-placeholder-count="0"><li>{{ r.txt }}</li></sc-for></ul></div></sc-if>'
    + '<div style="padding:12px 14px;background:#F5F5F5;border-radius:12px"><div style="font-size:11.5px;color:#808080;margin-bottom:3px">Por qué · {{ c.fuente }}</div>'],
  // ---- luces (decisión de Juan Pablo del 01/10): solo contra lo normal del proyecto y contra la misma campaña, cada una con la
  // métrica, contra qué y los valores. Una luz por renglón: punto + frase (l.txt), la frase completa al pasar el mouse (l.title) ----
  // lista de Campañas (decisiones de Juan Pablo del 01/10): sin la columna de luces ni "KPI principal"; una sola columna de Métrica que
  // cambia con el selector de arriba (Según objetivo o un KPI para todas); scroll horizontal propio y el nombre fijo a la izquierda
  // 06/10 (Juan Pablo): la lista de Campañas va siempre según objetivo: sin el selector de Métrica (sigue en la ficha de cada campaña)
  [ws('<div style="display:grid;grid-template-columns:minmax(280px,2.6fr) 160px 90px 120px minmax(230px,1.6fr) 70px 80px;gap:14px;padding:10px 0;font-size:11.5px;color:#808080;border-bottom:1px solid #E4E4E4"><span>Campaña</span><span>Estado</span><span>{{ campGastoLabel }}</span><span>KPI principal</span><span>General · Proyecto · Propia</span><span>Eficacia</span><span>Acciones</span></div>'),
    `<div style="display:grid;grid-template-columns:${COLS_CAMP};gap:14px;padding:10px 0;font-size:11.5px;color:#808080;border-bottom:1px solid #E4E4E4"><span style="${FIJA}">Campaña</span><span>Estado</span><span>{{ campGastoLabel }}</span><span>Impresiones</span><span>Reacciones</span>`
    + '<span title="{{ campListaAyuda }}" style="cursor:help">{{ campListaTitulo }} <span style="color:#A6AAA9">ⓘ</span></span><span>Eficacia</span><span>Acciones</span></div>'],
  [ws('<div sc-camel-on-click="{{ r.onClick }}" style="display:grid;grid-template-columns:minmax(280px,2.6fr) 160px 90px 120px minmax(230px,1.6fr) 70px 80px;gap:14px;padding:13px 0;align-items:center;font-size:12.5px;border-bottom:1px solid #F0F0F0;cursor:pointer" style-hover="background:#FAFAFA"><div style="min-width:0">'),
    `<div sc-camel-on-click="{{ r.onClick }}" style="display:grid;grid-template-columns:${COLS_CAMP};gap:14px;padding:13px 0;align-items:center;font-size:12.5px;border-bottom:1px solid #F0F0F0;cursor:pointer" style-hover="background:#FAFAFA"><div style="min-width:0;${FIJA};align-self:stretch;display:flex;flex-direction:column;justify-content:center">`],
  [ws('<div><div style="font-size:11px;color:#808080">{{ r.kpiL }}</div><div style="font-weight:600">{{ r.kpi }}</div></div><div style="display:flex;gap:12px;flex-wrap:wrap"><sc-for list="{{ r.lights }}" as="l" hint-placeholder-count="2"><span title="{{ l.label }}" style="display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:#808080"><span style="width:9px;height:9px;border-radius:50%;box-sizing:border-box;background:{{ l.bg }};border:{{ l.bd }}"></span>{{ l.short }}<span style="color:#3C3C3C;font-weight:600">{{ l.num }}</span></span></sc-for></div>'),
    CELDAS_CANT + CELDA_KPI],
  // la línea que explica la tabla, debajo (fuera del scroll)
  [ws('<sc-if value="{{ r.noAct }}"><span style="color:#A6AAA9">—</span></sc-if></span></div></sc-for></div></div>'),
    '<sc-if value="{{ r.noAct }}"><span style="color:#A6AAA9">—</span></sc-if></span></div></sc-for></div></div>'
    + '<p style="margin:12px 0 0;font-size:12px;line-height:1.55;color:#808080;max-width:1100px;text-wrap:pretty">{{ campLeyenda }}</p>'],
  ['De peor a mejor según su KPI principal contra lo normal. Muestra las campañas que estuvieron al aire en el período elegido.',
    'Ordenadas por gasto. Muestra las campañas que estuvieron al aire en el período elegido. En la columna de Métrica: arriba, el valor de la campaña; abajo, contra lo normal del proyecto y contra la misma campaña.'],
  // Revisar campañas (01/10): sin el KPI suelto ni las luces; Impresiones, Reacciones y la columna de Métrica con el mismo selector
  [ws('<div style="flex:1 1 110px"><div style="font-size:11.5px;color:#808080">{{ c.kpiLabel }}</div><div style="font-size:16px;font-weight:600">{{ c.kpi }}</div></div><div style="flex:1.4 1 200px;display:flex;gap:12px;flex-wrap:wrap"><sc-for list="{{ c.lights }}" as="l" hint-placeholder-count="3"><span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#808080"><span style="width:9px;height:9px;border-radius:50%;box-sizing:border-box;background:{{ l.bg }};border:{{ l.bd }}"></span>{{ l.label }}<span style="color:#3C3C3C;font-weight:600">{{ l.num }}</span></span></sc-for></div>'),
    DATO_REVISAR('Impresiones', 'impC') + DATO_REVISAR('Reacciones', 'reaC', '{{ c.reaGris }}') + '<div style="flex:2 1 270px;min-width:0">' + celdaKpi('c') + '</div>'],
  ['Activas, ordenadas por plata en juego. Cada una se juzga con el KPI de su objetivo.',
    'Al aire y con “peor” en su celda del mes: bastante peor que lo normal o que la misma campaña, con el KPI elegido. Ordenadas por lo que gastaron de más.'],
  ['El cuadradito es el % del gasto en anuncios rojos: menos de 25 % verde, menos de 50 % amarillo, menos de 75 % naranja, y rojo por encima.</div>',
    '“17 % del gasto en anuncios flojos”: qué parte del gasto fue a anuncios que rinden peor que lo normal (su costo por reacción está entre el 25 % más caro de los de su mismo objetivo y placement en el proyecto). El cuadradito: menos de 25 % verde, menos de 50 % amarillo, menos de 75 % naranja, y rojo por encima. '
    + 'Entran solo las campañas al aire que muestran “peor” en su celda de KPI del mes en curso: bastante peor (20 % o más) que lo normal en el proyecto o que la misma campaña (sus semanas anteriores o, si es estacional, la temporada pasada), con el KPI elegido en el selector. Ordenadas por lo que gastaron de más, hasta cinco. '
    + 'Impresiones, Reacciones y la columna de Métrica son del mes en curso, con el mismo selector que la lista de Campañas: arriba el KPI y su valor; abajo, contra lo normal y contra la misma campaña, con el valor de referencia entre paréntesis.</div>'],
  [ws('<div style="margin-top:14px"><sc-for list="{{ badCamps }}" as="c" hint-placeholder-count="5">'),
    SELECTOR_KPI + '<div style="margin-top:14px"><sc-for list="{{ badCamps }}" as="c" hint-placeholder-count="5">'],
  // Revisar sin campañas con “peor” (01/10): se dice, en lugar de dejar el bloque vacío
  [ws('→ {{ c.accion }}</div></div></sc-for></div>'), '→ {{ c.accion }}</div></div></sc-for><sc-if value="{{ badVacio }}"><div style="padding:16px 0;border-top:1px solid #E4E4E4;font-size:13px;color:#808080;text-wrap:pretty">{{ badVacioTxt }}</div></sc-if></div>'],
  // tarjetas de la pantalla de campaña
  [ws('<sc-for list="{{ t.lights }}" as="l" hint-placeholder-count="2"><span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:#808080"><span style="width:9px;height:9px;border-radius:50%;box-sizing:border-box;background:{{ l.bg }};border:{{ l.bd }}"></span>{{ l.label }}<span style="color:#3C3C3C;font-weight:600">{{ l.num }}</span></span></sc-for>'),
    '<sc-for list="{{ t.lights }}" as="l" hint-placeholder-count="2">' + LINEA('11.5px') + '</sc-for>'],
  // Contenidos (01/10): selector, Impresiones, Reacciones y la columna de Métrica en lugar de "Costo x reacción" y la luz
  [ws('<p style="margin:12px 0 0;font-size:13px;color:#808080">Ordenados por efectividad: costo por reacción contra lo normal.</p><div style="overflow-x:auto;margin-top:8px"><div style="min-width:980px"><div style="display:grid;grid-template-columns:minmax(260px,2.4fr) 80px 50px 90px 90px 90px 90px 90px;gap:12px;padding:10px 0;font-size:11.5px;color:#808080;border-bottom:1px solid #E4E4E4"><span>Contenido</span><span>Gasto</span><span>Días</span><span>Costo x reacción</span><span>General</span><span>Eficacia</span><span>Compartido</span><span>Retención 25 %</span></div>'),
    '<p style="margin:12px 0 0;font-size:13px;color:#808080;text-wrap:pretty">Las 20 piezas con más gasto en Meta de la campaña, de la más reciente a la más vieja, con lo que sumaron en los meses que trae la campaña (hasta seis). En la columna de Métrica: el valor de la pieza; abajo, contra lo normal del proyecto y contra toda la campaña.</p>'
    + SELECTOR_KPI + `<div style="overflow-x:auto;margin-top:8px"><div style="min-width:1200px"><div style="display:grid;grid-template-columns:${COLS_CONT};gap:12px;padding:10px 0;font-size:11.5px;color:#808080;border-bottom:1px solid #E4E4E4"><span>Contenido</span><span>Gasto</span><span>Días</span><span>Impresiones</span><span>Reacciones</span>${TITULO_KPI}<span>Eficacia</span><span>Compartido</span><span>Retención 25 %</span></div>`],
  [ws('<div style="display:grid;grid-template-columns:minmax(260px,2.4fr) 80px 50px 90px 90px 90px 90px 90px;gap:12px;padding:12px 0;align-items:center;font-size:12.5px;border-bottom:1px solid #F0F0F0">'),
    `<div style="display:grid;grid-template-columns:${COLS_CONT};gap:12px;padding:12px 0;align-items:center;font-size:12.5px;border-bottom:1px solid #F0F0F0">`],
  [ws('<span style="font-weight:600">{{ r.cxr }}</span><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:50%;background:{{ r.gen.bg }}"></span>{{ r.gen.num }}</span>'), CELDAS_CANT + CELDA_KPI],
  // fin de Contenidos (la línea que explica la tabla) y encabezado de Audiencias con el selector
  [ws('</div></sc-for></div></div></sc-if><sc-if value="{{ ctAudiencias }}"><div style="overflow-x:auto;margin-top:8px"><div style="min-width:820px"><div style="display:grid;grid-template-columns:minmax(220px,2fr) 90px minmax(200px,1.6fr) 90px 100px 110px;gap:12px;padding:10px 0;font-size:11.5px;color:#808080;border-bottom:1px solid #E4E4E4"><span>Audiencia</span><span>CPM</span><span>Luces</span><span>Eficacia</span><span>Costo x reacción</span><span>Cobertura</span></div>'),
    '</div></sc-for></div></div>' + LEYENDA_CT + '</sc-if><sc-if value="{{ ctAudiencias }}">' + SELECTOR_KPI
    + `<div style="overflow-x:auto;margin-top:8px"><div style="min-width:1060px"><div style="display:grid;grid-template-columns:${COLS_AUD};gap:12px;padding:10px 0;font-size:11.5px;color:#808080;border-bottom:1px solid #E4E4E4"><span>Audiencia</span><span>Impresiones</span><span>Reacciones</span>${TITULO_KPI}<span>Eficacia</span><span>Costo x reacción</span><span>Cobertura</span></div>`],
  [ws('<div style="display:grid;grid-template-columns:minmax(220px,2fr) 90px minmax(200px,1.6fr) 90px 100px 110px;gap:12px;padding:12px 0;align-items:center;font-size:12.5px;border-bottom:1px solid #F0F0F0"><span style="font-weight:600">{{ r.name }}</span><span style="font-weight:600">{{ r.kpi }}</span><span style="display:flex;gap:10px;flex-wrap:wrap"><sc-for list="{{ r.lights }}" as="l" hint-placeholder-count="3"><span style="display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:#808080"><span style="width:9px;height:9px;border-radius:50%;box-sizing:border-box;background:{{ l.bg }};border:{{ l.bd }}"></span>{{ l.num }}</span></sc-for></span>'),
    `<div style="display:grid;grid-template-columns:${COLS_AUD};gap:12px;padding:12px 0;align-items:center;font-size:12.5px;border-bottom:1px solid #F0F0F0"><span style="font-weight:600">{{ r.name }}</span>` + CELDAS_CANT + CELDA_KPI],
  // fin de Audiencias: la línea que explica la tabla
  [ws('</div></sc-for></div></div></sc-if><sc-if value="{{ ctActivos }}">'), '</div></sc-for></div></div>' + LEYENDA_CT + '</sc-if><sc-if value="{{ ctActivos }}">'],
  // textos de ayuda
  ['Cada campaña se juzga con el KPI de su objetivo: Alcance por CPM, Interacción por costo por reacción, Tráfico por CTR, Reproducciones por costo por reproducción. Propia: solo campañas de 30 días o más, contra sus semanas anteriores. En las estacionales confirmadas, Propia se reemplaza por Temporada anterior.',
    'Todo con Meta (Facebook, Instagram y Threads), que es lo que tiene referencias. Costo por reacción = gasto ÷ reacciones. CPM = gasto ÷ impresiones × 1.000. CTR = clicks ÷ impresiones × 100. ETR = engagement ÷ impresiones × 100, en dos columnas: videos, y placas y carruseles (en video el engagement es casi todo reproducciones; en placas, casi todo clicks). CPM de Alcance = gasto ÷ personas alcanzadas × 1.000, con el alcance real de Meta de hoy. Costo por reproducción = gasto ÷ reproducciones, la única que suma todas las plataformas con reproducciones (YouTube, TikTok, videos de Meta) y se compara plataforma por plataforma. Cada campaña muestra el KPI que busca su objetivo (Interacción: Costo por reacción; Alcance: CPM; Reproducciones: Costo por reproducción; Tráfico y Conversión: CTR). Cada valor se compara contra lo normal en el proyecto (mismo objetivo y formato) y, en las campañas de 30 días o más y las constantes, contra sus semanas anteriores, formato por formato (las estacionales confirmadas, contra la temporada pasada). La marca “Cómo rinde” usa ese mismo KPI. Todas las métricas de cada campaña están en su ficha. Al pasar el mouse por el título de la columna se ve cómo se calcula.'],
  [ws('<p style="margin:4px 0 0;font-size:13px;color:#808080">Objetivo Alcance: se juzga por CPM. Propia compara contra sus semanas anteriores.</p>'),
    '<div style="margin-top:4px;display:flex;gap:6px 18px;flex-wrap:wrap;align-items:center;font-size:12px;color:#808080"><span title="{{ campEf.title }}" style="display:inline-flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:2px;background:{{ campEf.c }}"></span>{{ campEf.largo }}</span>'
    + '<sc-if value="{{ campDemas }}"><span title="{{ campDemasTxt }}" style="color:#E9121C;font-weight:600">{{ campDemasCorto }}</span></sc-if></div>'],
  // tarjetas de Rendimiento (01/10): una fila de tarjetas chicas (7 u 8 a 1.600 px): nombre en una línea, valor grande y hasta dos líneas
  // cortas de comparación, sin párrafos; la frase completa al pasar el mouse. La del objetivo con el borde marcado y la etiqueta "objetivo"
  [/<div style="margin-top:16px;display:grid;grid-template-columns:repeat\(auto-fill,minmax\(150px,1fr\)\);gap:10px">\s*<sc-for list="\{\{ cTiles \}\}"[\s\S]*?\{\{ t\.small \}\}<\/div>\s*<\/div>\s*<\/sc-for>\s*<\/div>/,
    '<div style="margin-top:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:8px"><sc-for list="{{ cTiles }}" as="t" hint-placeholder-count="7">'
    + '<div title="{{ t.title }}" style="border:{{ t.border }};border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:5px;min-width:0">'
    + '<span style="font-size:11.5px;color:#808080;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ t.label }}</span>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:0"><span style="font-size:22px;font-weight:600;letter-spacing:-0.02em;line-height:1.15;white-space:nowrap">{{ t.val }}</span>'
    + '<sc-if value="{{ t.kpi }}"><span style="flex:none;font-size:10px;font-weight:600;border:1px solid #3C3C3C;color:#3C3C3C;border-radius:9999px;padding:0 6px">objetivo</span></sc-if></div>'
    + '<sc-for list="{{ t.lineas }}" as="l" hint-placeholder-count="2"><div title="{{ l.title }}" style="font-size:10.5px;line-height:1.35;color:{{ l.color }};white-space:{{ l.ws }};overflow:hidden;text-overflow:ellipsis">{{ l.txt }}</div></sc-for>'
    + '</div></sc-for></div>'],
  // historia de la campaña (01/10): valores grandes y comparaciones cortas debajo, la frase completa al pasar el mouse
  [ws('<div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:11.5px;color:#808080">{{ s.label }}</span><span style="display:inline-flex;align-items:center;gap:7px;font-size:20px;font-weight:600;letter-spacing:-0.01em"><sc-if value="{{ s.dot }}"><span style="width:10px;height:10px;border-radius:50%;background:{{ s.dot }}"></span></sc-if>{{ s.val }}</span></div>'),
    '<div title="{{ s.title }}" style="display:flex;flex-direction:column;gap:2px"><span style="font-size:11.5px;color:#808080;white-space:nowrap">{{ s.label }}</span><span style="display:inline-flex;align-items:center;gap:7px;font-size:20px;font-weight:600;letter-spacing:-0.01em;white-space:nowrap"><sc-if value="{{ s.dot }}"><span style="width:10px;height:10px;border-radius:50%;background:{{ s.dot }}"></span></sc-if>{{ s.val }}</span>'
    + '<sc-for list="{{ s.lineas }}" as="l" hint-placeholder-count="1"><span title="{{ l.title }}" style="font-size:11px;line-height:1.35;color:{{ l.color }};white-space:nowrap">{{ l.txt }}</span></sc-for></div>'],
  ['Las últimas 2 semanas van en negro. La franja gris es su rango normal: del 25 % peor al 25 % mejor de sus semanas anteriores. Línea punteada: su mediana.',
    'Una barra por semana: la altura es cómo rindió esa semana (más alta, mejor), y arriba va su valor. Las últimas 2 semanas van en negro. La franja gris es su rango normal: del 25 % peor al 25 % mejor de sus semanas anteriores. Línea punteada: su mediana.'],
  // eficacia: "anuncios flojos" (que rinden peor que lo normal) en vez de "anuncios rojos"
  ['<p style="margin:4px 0 0;font-size:13px;color:#808080">Últimos 30 días. % del gasto en anuncios rojos.</p>', '<p style="margin:4px 0 0;font-size:13px;color:#808080">Últimos 30 días. Qué parte del gasto fue a anuncios flojos, los que rinden peor que lo normal.</p>'],
  ['es rojo si su costo por reacción está entre el 25 % más caro. En grupos se muestra el % del gasto en anuncios rojos, con un cuadradito para distinguirlo de las luces.',
    'es flojo (rinde peor que lo normal) si su costo por reacción está entre el 25 % más caro. En campañas y grupos se muestra qué parte del gasto fue a anuncios flojos (“17 % del gasto en anuncios flojos”), con un cuadradito de color: menos de 25 % verde, menos de 50 % amarillo, menos de 75 % naranja y rojo por encima.'],
  // ayuda de Rendimiento (01/10): toda la explicación va acá (las tarjetas no llevan párrafos)
  ['La luz Propia solo aparece en campañas de 30 días o más y desde la tercera semana. Eficacia: cada anuncio, en cada placement, contra los de su mismo objetivo y placement del proyecto en su misma época; rojo si su costo por reacción está entre el 25 % más caro.', '{{ crendAyuda }}'],
  ['Cada indicador de rendimiento se compara contra lo normal. Al lado del punto va cuántas veces lo normal: 1,3× es 30 % mejor. En costos, más de 1 significa más barato.',
    'Cada luz dice qué se mide, contra qué se compara y los dos valores. Por ejemplo: “Cada reacción costó $38. Parecida a lo normal en Santa Fe ($35): 10 % más cara. 72 % más cara que en las semanas anteriores de esta campaña ($22).” En costos se dice más cara o más barata; en clicks, más alto o más bajo, y si es mejor o peor. En la lista de Campañas va la frase corta y, al pasar el mouse, la completa. Se compara contra:'],
  // ==== recorrido en pasos (diseño v2, 02/10): General › Detalle › Exploración, con Acciones siempre a mano (markup en recorrido.js) ====
  // encabezado: la fila de pasos, Insights y Looker, y el botón Acciones (en todas las pantallas)
  [/<\/header>/, () => REC.pasos + '</header>'],
  // 06/10: el proyecto de la ruta es un desplegable (texto con flechita) para cambiar de proyecto
  ['<span sc-camel-on-click="{{ c.onClick }}" style="cursor:{{ c.cursor }};color:{{ c.color }}">{{ c.label }}</span>',
    '<sc-if value="{{ c.noSel }}"><span sc-camel-on-click="{{ c.onClick }}" style="cursor:{{ c.cursor }};color:{{ c.color }}">{{ c.label }}</span></sc-if>'
    + '<sc-if value="{{ c.esSel }}"><sc-raw-select value="{{ c.selVal }}" sc-camel-on-change="{{ c.onSel }}" title="Cambiar de proyecto" style="appearance:none;-webkit-appearance:none;border:none;outline:none;background:transparent url(&quot;data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%276%27 viewBox=%270 0 10 6%27%3E%3Cpath d=%27M1 1l4 4 4-4%27 fill=%27none%27 stroke=%27%23808080%27 stroke-width=%271.6%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E&quot;) no-repeat right center;padding:2px 16px 2px 0;margin:0;font:inherit;font-size:13px;color:{{ c.color }};cursor:pointer;max-width:240px;text-overflow:ellipsis"><sc-for list="{{ c.ops }}" as="co" hint-placeholder-count="8"><option value="{{ co.id }}">{{ co.label }}</option></sc-for></sc-raw-select></sc-if>'],
  // el botón Acciones del encabezado del proyecto pasa al encabezado general
  [ws('<button sc-camel-on-click="{{ openPanel }}" style="margin-bottom:8px;display:inline-flex;align-items:center;gap:8px;border:none;background:#3C3C3C;color:#FFFFFF;border-radius:9999px;padding:7px 8px 7px 16px;font-size:13px;font-weight:600;cursor:pointer" style-hover="opacity:0.9">Acciones<span style="background:#FFFFFF;color:#3C3C3C;border-radius:9999px;padding:1px 8px;font-size:12px">{{ nPending }}</span></button>'), ''],
  // el período se elige solo en Exploración (General y Detalle son "al aire hoy")
  // 06/10: el Período pasó a la barra de pasos (recorrido.js) y el bloque del título del proyecto sale (el título va junto a los pasos): queda
  // solo la fila de pestañas
  [/<label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:#808080">Período[\s\S]*?<\/label>/, ''],
  [/(<div style="max-width:\{\{ L\.max \}\};margin:0 auto;)padding:28px 28px 0(">)\s*<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">[\s\S]*?<\/div>\s*<\/div>\s*<div style="margin-top:18px;display:flex;/, (m, a, b) => `${a}padding:0 28px${b}<div style="display:flex;`],
  // portada: la de hoy queda en Exploración; General y Detalle, del diseño
  [/(<main data-screen-label="Mis proyectos"[\s\S]*?)(<div style="margin-top:28px;display:flex;align-items:baseline[\s\S]*?)(\s*<\/main>)/, (m, a, b, c) => `${a}<sc-if value="{{ portadaVieja }}">${b}</sc-if>${REC.portada}${c}`],
  // proyecto: General y Detalle antes de las pestañas de Exploración
  ['<sc-if value="{{ isCampanas }}">', () => REC.general + REC.detalle + '<sc-if value="{{ isCampanas }}">'],
  // Exploración › Campañas: la marca de la campaña en una columna "Cómo rinde" (diseño v2), entre la métrica y la eficacia
  [/<div style="min-width:1060px">/, '<div style="min-width:1180px">'],
  [/grid-template-columns:minmax\(260px,2fr\) 150px 90px 80px 90px minmax\(330px,1\.5fr\) 70px 70px/g, 'grid-template-columns:minmax(260px,2fr) 150px 90px 80px 90px minmax(330px,1.5fr) 110px 70px 70px'],
  ['ⓘ</span></span><span>Eficacia</span><span>Acciones</span></div>', 'ⓘ</span></span><span>{{ marcaRotCamp }}</span><span>Eficacia</span><span>Acciones</span></div>'],
  [ws('<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:2px;background:{{ r.ef.c }}"></span>{{ r.ef.short }}</span>'),
    () => '<span>' + REC.marca('r.marca') + '</span><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:2px;background:{{ r.ef.c }}"></span>{{ r.ef.short }}</span>'],
  // pantalla de campaña (diseño v2): la marca al lado del nombre y "Hasta dónde va a llegar" en tres celdas antes de la frase
  ['<h1 style="margin:0;font-size:28px;font-weight:600;letter-spacing:-0.02em">{{ campName }}</h1>', () => '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><h1 style="margin:0;font-size:28px;font-weight:600;letter-spacing:-0.02em">{{ campName }}</h1>' + REC.marca('campMarca') + '</div>'],
  ['<sc-if value="{{ hasLlegada }}"><p style="margin:10px 0 0;font-size:14px;line-height:1.6;max-width:860px;text-wrap:pretty">{{ llegada.frase }}</p>',
    '<sc-if value="{{ hasLlegada }}"><div style="margin-top:12px;display:grid;grid-template-columns:repeat(3,minmax(0,260px));gap:12px"><sc-for list="{{ campLlegCeldas }}" as="lc" hint-placeholder-count="3"><div style="border:1px solid #E4E4E4;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:4px"><span style="font-size:11.5px;color:#808080">{{ lc.label }}</span><span style="font-size:17px;font-weight:600">{{ lc.val }}</span><span style="font-size:11.5px;color:#808080">{{ lc.sub }}</span></div></sc-for></div><p style="margin:10px 0 0;font-size:14px;line-height:1.6;max-width:860px;text-wrap:pretty">{{ llegada.frase }}</p>'],
  // 03/10: sin pestaña Resumen. Las tarjetas de Gasto del mes quedan arriba de la pestaña Proyección; "Revisar campañas" se va (lo cubren
  // "Lo que pide atención" de General y la columna "Cómo rinde" de Campañas) y en su lugar va la Proyección del mes
  [/(<main data-screen-label="Proyecto · Resumen"[\s\S]*?)(<div data-block="1"[^>]*>\s*<div[^>]*>\s*<h2[^>]*>Revisar campañas<\/h2>[\s\S]*?)(\s*<\/main>)/, (m, a, b, c) => a + REC.proyeccion + c],
  ['data-screen-label="Proyecto · Resumen"', 'data-screen-label="Proyecto · Proyección"'],
  // 06/10: la Proyección va abajo de todo en Detalle, debajo de Campañas (las dos se ven juntas): menos aire entre una y otra
  ['<main data-screen-label="Proyecto · Campañas" style="max-width:{{ L.max }};margin:0 auto;padding:36px 28px 120px"', '<main data-screen-label="Proyecto · Campañas" style="max-width:{{ L.max }};margin:0 auto;padding:36px 28px 16px"'],
  ['data-screen-label="Proyecto · Proyección" style="max-width:{{ L.max }};margin:0 auto;padding:36px 28px 120px;', 'data-screen-label="Proyecto · Proyección" style="max-width:{{ L.max }};margin:0 auto;padding:24px 28px 120px;'],
  // 06/10: Estructura: el Mapa (primera pestaña) y, para las tablas Activos · Ejes · Audiencias, el selector de Métrica de la marca arriba
  ['<sc-if value="{{ isEjes }}">', () => REC.mapa + REC.selEstructura + '<sc-if value="{{ isEjes }}">'],
  // 06/10: el destello del Mapa al ubicar algo
  ['<helmet>', '<helmet><style>@keyframes mapaFlash{0%{opacity:1;transform:scale(.7)}100%{opacity:0;transform:scale(1.9)}}</style>'],
  // 06/10: encabezado más bajo en todas las pantallas (el Mapa de Estructura tiene que entrar sin scroll en 1600 × 780)
  ['padding:10px 28px;min-height:56px', 'padding:5px 28px;min-height:44px'],
  // 07/10: la app se llama "Tablero de optimización" (15/10: "Optimización") (nombre en el encabezado)
  ['letter-spacing:-0.01em">Seguimiento y Optimización</span>', 'letter-spacing:-0.01em">Optimización</span>'],
  [/(<sc-for list="\{\{ projTabs \}\}" as="t"[^>]*>\s*<button sc-camel-on-click="\{\{ t\.onClick \}\}" style="border:none;background:none;)padding:10px 0 12px/, (m, a) => a + 'padding:5px 0 7px'],
];

