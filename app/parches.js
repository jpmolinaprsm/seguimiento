// Parches acordados sobre el markup del diseño curado (Claude Design). Cada uno es [patrón, reemplazo]; el patrón puede ser
// texto exacto o una expresión regular tolerante a espacios. Lo demás del diseño no se toca.
// tolerante a espacios y saltos de línea entre tags (el diseño está indentado; el patrón se escribe compacto)
const ws = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/>\s*</g, '>\\s*<').replace(/\s+/g, '\\s*'));

const looker = require('./looker.js');

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
    + '<span style="display:inline-flex;align-items:center;gap:6px" title="Constante: se comunica todo el año. Estacional: vuelve en la misma época. Si no es ninguna de las dos, es larga (30 días o más) o puntual. Define contra qué se compara (luz Propia)."><span style="color:#A6AAA9">Tipo</span><span style="display:inline-flex;padding:2px;background:#F4F4F4;border-radius:9999px"><sc-for list="{{ campTipos }}" as="op" hint-placeholder-count="3"><button sc-camel-on-click="{{ op.onClick }}" style="border:none;border-radius:9999px;padding:2px 10px;font-size:11.5px;font-weight:500;cursor:pointer;color:{{ op.color }};background:{{ op.bg }};box-shadow:{{ op.shadow }}">{{ op.label }}</button></sc-for></span></span>'],
  ['CPM semanal de la campaña', '{{ campHistTitle }}'],
  ['>Campañas que rinden mal</h2>', '>Revisar campañas</h2>'],
  // ---- en el detalle, el sobrecosto se dice con todas las letras ("de más" se leía como pasarse del presupuesto) ----
  ['{{ c.demas }} de más</span>', 'pagó {{ c.demas }} más que lo habitual</span>'],
  ['{{ r.demas }} de más</div>', 'pagó {{ r.demas }} más que lo habitual</div>'],
  // ---- tarjeta de presupuesto: "Tiempo" y el eje de fechas del gráfico eran fijos (del ejemplo: 93 %, día 28 de 30, 1/09–30/09) ----
  ['line-height:1.15">93 %</div>', 'line-height:1.15">{{ b.tiempoPct }} %</div>'],
  ['>día 28 de 30</div>', '>día {{ b.dia }} de {{ b.diasMes }}</div>'],
  ['fill="#A6AAA9">1/09</text>', 'fill="#A6AAA9">{{ b.ejeIni }}</text>'],
  ['text-anchor="middle">15/09</text>', 'text-anchor="middle">{{ b.ejeMed }}</text>'],
  ['text-anchor="end">30/09</text>', 'text-anchor="end">{{ b.ejeFin }}</text>'],
  // ---- pantalla de campaña: el encabezado de "Rendimiento" tenía los números del ejemplo del diseño (Obras que Sí) → datos reales ----
  [ws('<span style="width:9px;height:9px;border-radius:2px;background:#FCB942"></span>32 % del gasto en rojo (55 de 178)</span>'), '<span style="width:9px;height:9px;border-radius:2px;background:{{ campEf.c }}"></span>{{ campEf.txt }}</span>'],
  [ws('<span style="font-size:12.5px;color:#E9121C;font-weight:600">$2,1 M de más</span>'), '<sc-if value="{{ campDemas }}"><span style="font-size:12.5px;color:#E9121C;font-weight:600">pagó {{ campDemas }} más que lo habitual</span></sc-if>'],
  ['"$ de más" es lo gastado por encima de lo que habría costado el mismo resultado al costo habitual del proyecto.', '“Pagó $X más que lo habitual” es lo gastado por encima de lo que habría costado lo mismo (impresiones, reacciones o clicks, según el objetivo) a los costos habituales del proyecto en el último año. No tiene relación con el presupuesto.'],
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
  [/<h2[^>]*>Campañas estacionales detectadas<\/h2>[\s\S]*?(?=<\/div>\s*<sc-for list="\{\{ insLists \}\}")/, '<h2 style="margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em">Tipo de campaña</h2><p style="margin:4px 0 0;font-size:13px;color:#808080;text-wrap:pretty">A confirmar. <b>Constante</b>: se comunica todo el año (por ejemplo, Operativos de Seguridad); se compara contra sus propias semanas anteriores. <b>Estacional</b>: vuelve en la misma época; se compara contra la temporada anterior. Las demás son <b>largas</b> (30 días o más; se comparan contra sus propias semanas) o <b>puntuales</b> (menos de 30 días), según cuánto duran. Lo que elijas define su luz Propia y en qué filtro de Campañas aparece.</p><div style="margin-top:12px"><sc-for list="{{ insSeason }}" as="r" hint-placeholder-count="2"><div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding:14px 0;border-top:1px solid #E4E4E4"><div style="min-width:0;flex:1 1 360px"><div style="font-size:13.5px;font-weight:600">{{ r.name }}</div><div style="margin-top:3px;font-size:12px;color:#808080">{{ r.detalle }}</div></div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="font-size:11.5px;color:#A6AAA9">{{ r.nota }}</span><div style="display:flex;padding:3px;background:#F4F4F4;border-radius:9999px"><sc-for list="{{ r.ops }}" as="op" hint-placeholder-count="3"><button sc-camel-on-click="{{ op.onClick }}" style="border:none;border-radius:9999px;padding:5px 13px;font-size:12.5px;font-weight:500;cursor:pointer;color:{{ op.color }};background:{{ op.bg }};box-shadow:{{ op.shadow }}">{{ op.label }}</button></sc-for></div></div></div></sc-for><sc-if value="{{ insSeasonVacio }}"><div style="padding:18px 0;border-top:1px solid #E4E4E4;font-size:13px;color:#808080">No se detectaron campañas constantes ni estacionales en este proyecto.</div></sc-if></div>'],
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
];
