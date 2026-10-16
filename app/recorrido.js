// Markup del recorrido en pasos (diseño v2 de Claude Design, 02/10; desde el 06/10 General › Estructura › Detalle › Looker), con Acciones siempre a mano.
// Copiado del diseño (seguimiento-agentes/diseno-claude-design/vuelta/extraido/markup-diseno.html) y conectado a los valores de
// logica.js. Solo 1600 px (el celular está en pausa). armar.js lo inserta con parches.js.

// ---- piezas ----
const marca = (x) => `<span title="{{ ${x}.title }}" style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px 3px 8px;border-radius:9999px;background:{{ ${x}.bg }};font-size:12px;font-weight:600;white-space:nowrap;color:#3C3C3C"><span style="width:8px;height:8px;border-radius:9999px;background:{{ ${x}.dot }}"></span>{{ ${x}.txt }}</span>`;
const marcaGrande = (x) => `<span title="{{ ${x}.title }}" style="display:inline-flex;align-items:center;gap:8px;padding:6px 14px 6px 12px;border-radius:9999px;background:{{ ${x}.bg }};font-size:15px;font-weight:600;color:#3C3C3C"><span style="width:10px;height:10px;border-radius:9999px;background:{{ ${x}.dot }}"></span>{{ ${x}.txt }}</span>`;
const ritmo = (x) => `<span title="{{ ${x}.title }}" style="display:inline-flex;align-items:center;gap:7px;padding:3px 10px;border-radius:9999px;border:1px solid #D5D5D5;font-size:12px;font-weight:600;white-space:nowrap;color:{{ ${x}.color }}"><span style="display:flex;align-items:flex-end;gap:2px;height:10px"><span style="width:3px;height:4px;border-radius:1px;background:{{ ${x}.b1 }}"></span><span style="width:3px;height:7px;border-radius:1px;background:{{ ${x}.b2 }}"></span><span style="width:3px;height:10px;border-radius:1px;background:{{ ${x}.b3 }}"></span></span>{{ ${x}.txt }}</span>`;
const ritmoGrande = (x) => `<span title="{{ ${x}.title }}" style="display:inline-flex;align-items:center;gap:8px;padding:5px 14px 5px 12px;border-radius:9999px;border:1px solid #D5D5D5;font-size:15px;font-weight:600;color:{{ ${x}.color }}"><span style="display:flex;align-items:flex-end;gap:2px;height:12px"><span style="width:3px;height:5px;border-radius:1px;background:{{ ${x}.b1 }}"></span><span style="width:3px;height:8px;border-radius:1px;background:{{ ${x}.b2 }}"></span><span style="width:3px;height:12px;border-radius:1px;background:{{ ${x}.b3 }}"></span></span>{{ ${x}.txt }}</span>`;
const estado = (x) => `<span title="{{ ${x}.title }}" style="display:inline-flex;align-items:center;padding:3px 10px;border-radius:9999px;background:{{ ${x}.bg }};color:{{ ${x}.color }};font-size:12px;font-weight:600;white-space:nowrap">{{ ${x}.txt }}</span>`;
const logos = (lista) => `<span style="display:inline-flex;gap:4px;align-items:center"><sc-for list="{{ ${lista} }}" as="pl" hint-placeholder-count="3"><img src="{{ pl.icon }}" alt="{{ pl.name }}" title="{{ pl.name }}" style="width:18px;height:18px;object-fit:contain"></sc-for></span>`;
const TH = 'text-align:left;font-size:12px;font-weight:500;color:#808080;padding:12px 16px;border-bottom:1px solid #E4E4E4;white-space:nowrap;background:#F5F5F5';
const TD = 'padding:14px 16px;border-bottom:1px solid #F0F0F0;font-size:13.5px;vertical-align:middle';

// ---- encabezado: fila de pasos, Insights y Looker, y Acciones (todas las pantallas, fija al bajar con el encabezado) ----
// sin esta fila en la portada (03/10): como la pantalla de inicio de PAUTADOR, ahí solo se elige el proyecto
const pasos = '<sc-if value="{{ conPasos }}"><div style="border-top:1px solid #F4F4F4"><div style="max-width:{{ L.max }};margin:0 auto;padding:4px 28px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">'
  + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><nav style="display:flex;align-items:center;gap:6px">'
  + '<sc-for list="{{ pasos }}" as="s" hint-placeholder-count="3"><sc-if value="{{ s.sep }}"><span style="color:#A6AAA9;font-size:14px">›</span></sc-if>'
  + '<button sc-camel-on-click="{{ s.onClick }}" style="display:inline-flex;align-items:center;gap:8px;padding:5px 14px 5px 6px;border-radius:9999px;border:1px solid {{ s.bd }};background:#FFFFFF;color:{{ s.color }};font-size:13px;font-weight:{{ s.fw }};cursor:pointer;white-space:nowrap">'
  + '<span style="display:inline-flex;width:22px;height:22px;border-radius:9999px;align-items:center;justify-content:center;font-size:11.5px;font-weight:600;background:{{ s.nBg }};color:{{ s.nColor }}">{{ s.n }}</span>{{ s.label }}</button></sc-for></nav>'
  + '<sc-if value="{{ hayVistas }}"><span style="width:1px;height:20px;background:#E4E4E4;margin:0 6px"></span><sc-for list="{{ vistas }}" as="v" hint-placeholder-count="2">'
  + '<button sc-camel-on-click="{{ v.onClick }}" style="padding:5px 14px;border-radius:9999px;border:1px solid {{ v.bd }};background:{{ v.bg }};color:{{ v.color }};font-size:13px;font-weight:{{ v.fw }};cursor:pointer">{{ v.label }}</button></sc-for><span style="width:1px;height:20px;background:#E4E4E4;margin:0 6px"></span><span style="font-size:13px;font-weight:600;color:#3C3C3C;white-space:nowrap">{{ tituloProy }}</span><span style="font-size:12px;color:#808080;white-space:nowrap">{{ tituloResto }}</span></sc-if></div>'
  // 06/10: el título del proyecto (antes un bloque aparte, alto) va en una línea chica junto a los pasos, y el Período al lado de Acciones
  + '<div style="display:flex;align-items:center;gap:14px"><sc-if value="{{ pasoExplora }}"><label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:#808080">Período<sc-raw-select value="{{ period }}" sc-camel-on-change="{{ onPeriod }}" style="border:1px solid #E4E4E4;border-radius:9999px;padding:5px 12px;font-size:12.5px;font-weight:500;color:#3C3C3C;background:#FFFFFF;cursor:pointer"><sc-for list="{{ periods }}" as="o" hint-placeholder-count="6"><option value="{{ o.id }}">{{ o.label }}</option></sc-for></sc-raw-select></label></sc-if>'
  + '<button sc-camel-on-click="{{ accGlobal }}" style="display:inline-flex;align-items:center;gap:8px;border:none;background:#3C3C3C;color:#FFFFFF;border-radius:9999px;padding:7px 8px 7px 16px;font-size:13px;font-weight:600;cursor:pointer" style-hover="opacity:0.9">Acciones<span style="background:#FFFFFF;color:#3C3C3C;border-radius:9999px;padding:1px 8px;font-size:12px">{{ nAccGlobal }}</span></button></div>'
  + '</div></div></sc-if>';

// ---- portada: General y Detalle (Exploración = la portada de hoy) ----
// portada (03/10): solo las tarjetas de los proyectos, sin pasos (un clic entra al proyecto en el paso 1 General)
const selMarca = '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span style="font-size:12px;color:#808080">Métrica de la marca</span><div style="display:inline-flex;flex-wrap:wrap;padding:3px;background:#F4F4F4;border-radius:9999px"><sc-for list="{{ marcaKpiOps }}" as="mk" hint-placeholder-count="8"><button sc-camel-on-click="{{ mk.onClick }}" style="border:none;border-radius:9999px;padding:4px 12px;font-size:12.5px;font-weight:500;cursor:pointer;color:{{ mk.color }};background:{{ mk.bg }};box-shadow:{{ mk.shadow }}">{{ mk.label }}</button></sc-for></div></div>';
const portada = '<sc-if value="{{ esPortada }}"><p style="margin:24px 0 0;font-size:13px;color:#808080">{{ portadaSub }}</p>'
  + '<div style="margin-top:20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px"><sc-for list="{{ portadaVistas }}" as="pr" hint-placeholder-count="6">'
  + '<div sc-camel-on-click="{{ pr.onClick }}" style="border:1px solid #E4E4E4;border-radius:16px;padding:20px 22px;cursor:pointer;display:flex;flex-direction:column;gap:14px;background:#FFFFFF" style-hover="border-color:#A6AAA9">'
  + '<div style="font-size:18px;font-weight:600;letter-spacing:-0.01em">{{ pr.name }}</div>'
  + '<sc-if value="{{ pr.hayPresu }}"><div style="display:flex;flex-direction:column;gap:6px"><span style="font-size:13px"><b style="font-weight:600">{{ pr.presuPct }}</b> <span style="color:#808080">del presupuesto del mes</span></span><div style="height:6px;background:#F4F4F4;border-radius:9999px;overflow:hidden"><div style="height:100%;width:{{ pr.presuBar }};background:#3C3C3C;border-radius:9999px"></div></div></div></sc-if>'
  + '<sc-if value="{{ pr.sinPresu }}"><span style="font-size:13px;color:#A6AAA9">Sin presupuesto cargado</span></sc-if>'
  // cada marca con su rótulo (03/10), como en las tarjetas de dentro del proyecto
  + `<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center"><span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#808080">Rendimiento: ${marca('pr.rend')}</span><span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#808080">Ritmo de gasto ${ritmo('pr.ritmo')}</span></div>`
  + '<div style="font-size:12.5px;color:#808080;padding-top:12px;border-top:1px solid #E4E4E4">{{ pr.atencion }}</div>'
  + '</div></sc-for></div></sc-if>';


// ---- proyecto: General ----
const general = '<sc-if value="{{ pasoExpo }}"><main data-screen-label="Proyecto · General" style="max-width:{{ L.max }};margin:0 auto;padding:32px 28px 64px;display:flex;flex-direction:column;gap:36px">' + selMarca
  + '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px">'
  + '<div style="border:1px solid #E4E4E4;border-radius:16px;padding:20px 24px;display:flex;flex-direction:column;gap:12px"><span style="font-size:12.5px;color:#808080">Presupuesto del mes</span>'
  + '<sc-if value="{{ expoHayPresu }}"><span style="font-size:24px;font-weight:600;letter-spacing:-.01em">{{ expoPresu }}</span><div style="height:6px;background:#F4F4F4;border-radius:9999px;overflow:hidden"><div style="height:100%;width:{{ expoPresuBar }};background:#3C3C3C;border-radius:9999px"></div></div></sc-if>'
  + '<sc-if value="{{ expoSinPresu }}"><span style="font-size:17px;font-weight:500;color:#A6AAA9">Sin presupuesto cargado</span></sc-if></div>'
  + `<div style="border:1px solid #E4E4E4;border-radius:16px;padding:20px 24px;display:flex;flex-direction:column;gap:12px"><span style="font-size:12.5px;color:#808080">{{ marcaRotCorto }}</span><div>${marcaGrande('expoRend')}</div><span style="font-size:12px;color:#808080">{{ expoRendSub }}</span></div>`
  + `<div style="border:1px solid #E4E4E4;border-radius:16px;padding:20px 24px;display:flex;flex-direction:column;gap:12px"><span style="font-size:12.5px;color:#808080">Ritmo de gasto</span><div>${ritmoGrande('expoRitmo')}</div><span style="font-size:12px;color:#808080">últimos 7 días contra lo habitual</span></div>`
  + '<div style="border:1px solid #E4E4E4;border-radius:16px;padding:20px 24px;display:flex;flex-direction:column;gap:12px"><span style="font-size:12.5px;color:#808080">Acciones</span><span style="font-size:17px;font-weight:600">{{ expoAcc }}</span>'
  + '<button sc-camel-on-click="{{ accGlobal }}" style="align-self:flex-start;border:none;background:none;padding:0;font-size:12.5px;font-weight:500;color:#3C3C3C;cursor:pointer">Abrir acciones ›</button></div></div>'
  + '<div style="display:flex;flex-direction:column;gap:16px"><h3 style="margin:0;font-size:17px;font-weight:600">Lo que pide atención</h3>'
  + '<sc-if value="{{ hayAtencion }}"><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px">'
  + '<div style="border:1px solid #E4E4E4;border-radius:16px;overflow:hidden"><div style="padding:14px 20px;font-size:12.5px;color:#808080;background:#F5F5F5">Campañas que rinden mal</div>'
  + `<sc-for list="{{ expoMalas }}" as="c" hint-placeholder-count="2"><div sc-camel-on-click="{{ c.onClick }}" style="display:flex;align-items:center;gap:16px;padding:16px 20px;border-top:1px solid #E4E4E4;cursor:pointer" style-hover="background:#FAFAFA"><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><span style="font-size:14px;font-weight:600">{{ c.name }}</span><span style="font-size:12.5px;color:#808080">{{ c.sub }}</span></div>${marca('c.chip')}<span style="color:#A6AAA9;font-size:16px">›</span></div></sc-for>`
  + '<sc-if value="{{ sinMalas }}"><div style="padding:16px 20px;border-top:1px solid #E4E4E4;font-size:13px;color:#808080">Ninguna campaña rinde mal</div></sc-if></div>'
  + '<div style="border:1px solid #E4E4E4;border-radius:16px;overflow:hidden"><div style="padding:14px 20px;font-size:12.5px;color:#808080;background:#F5F5F5">Activos que gastan lento</div>'
  + `<sc-for list="{{ expoLentos }}" as="a" hint-placeholder-count="2"><div sc-camel-on-click="{{ a.onClick }}" style="display:flex;align-items:center;gap:16px;padding:16px 20px;border-top:1px solid #E4E4E4;cursor:pointer" style-hover="background:#FAFAFA"><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><span style="font-size:14px;font-weight:600">{{ a.name }}</span><span style="font-size:12.5px;color:#808080">{{ a.sub }}</span></div>${ritmo('a.chip')}<span style="color:#A6AAA9;font-size:16px">›</span></div></sc-for>`
  + '<sc-if value="{{ sinLentos }}"><div style="padding:16px 20px;border-top:1px solid #E4E4E4;font-size:13px;color:#808080">{{ lentosVacio }}</div></sc-if></div></div></sc-if>'
  + '<sc-if value="{{ todoEnOrden }}"><div style="border:1px solid #E4E4E4;border-radius:16px;padding:32px;display:flex;align-items:center;gap:12px;font-size:14px"><span style="width:10px;height:10px;border-radius:9999px;background:#46C678"></span>Todo en orden: ninguna campaña rinde mal y ningún activo gasta lento</div></sc-if></div>'
  // sin botón a Detalle (03/10): a Detalle se pasa con la barra de pasos de arriba
  + '</main></sc-if>';

// ---- proyecto: Detalle (cinco pestañas) ----
const tabla = (cabeza, filas) => `<div style="border:1px solid #E4E4E4;border-radius:16px;overflow:hidden"><table style="width:100%;border-collapse:collapse"><thead><tr>${cabeza.map((h) => `<th style="${TH}">${h}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table></div>`;
// ajuste del 03/10: Detalle es lo que era Exploración (con números); de esta sección queda solo la pestaña Proyección, y en Ambas y Todos
// los proyectos, la línea de Looker
const detalle = '<sc-if value="{{ lookerNoAplica }}"><main style="max-width:{{ L.max }};margin:0 auto;padding:40px 28px 64px;font-size:14px;color:#808080">{{ lookerLinea }}</main></sc-if>'
  + '';
// Proyección (03/10): va en la pestaña Proyección de Detalle, debajo de las tarjetas de Gasto del mes (reemplaza a Revisar campañas)
const proyeccion = '<sc-if value="{{ isDetProy }}"><div data-block="1" style="grid-column:1/-1;order:9;display:flex;flex-direction:column;gap:16px"><h2 style="margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em">Proyección del mes</h2>'
  // Proyección
  + '<div style="padding:12px 16px;background:#F5F5F5;border-radius:12px;font-size:13px;color:#3C3C3C">{{ proyAviso }}</div>'
  + tabla(['Nivel', 'Nombre', 'Gasto al cierre', 'Resultado al cierre', 'Ritmo', 'Lo que lleva hoy'],
    `<sc-for list="{{ proyRows }}" as="f" hint-placeholder-count="6"><tr sc-camel-on-click="{{ f.onClick }}" style="cursor:{{ f.cursor }}"><td style="${TD};color:#808080;font-size:12.5px">{{ f.nivel }}</td><td style="${TD};font-weight:600">{{ f.name }}</td><td style="${TD}">${estado('f.gasto')}</td><td style="${TD}">${estado('f.imp')}</td><td style="${TD}"><sc-if value="{{ f.hayRitmo }}">${ritmo('f.ritmo')}</sc-if><sc-if value="{{ f.sinRitmo }}"><span style="color:#A6AAA9">—</span></sc-if></td><td style="${TD};color:{{ f.hoyColor }}">{{ f.hoy }}</td></tr></sc-for>`)
  + '</div></sc-if>';

// Estructura (06/10): el mismo selector de Métrica de la marca que General y la portada, arriba de Activos · Ejes · Audiencias
const selEstructura = '<sc-if value="{{ pasoEstTablas }}"><div style="max-width:{{ L.max }};margin:0 auto;padding:28px 28px 0">' + selMarca + '</div></sc-if>';

const { mapa } = require('./mapa-markup.js');

module.exports = { pasos, portada, general, detalle, proyeccion, marca, selEstructura, mapa };
