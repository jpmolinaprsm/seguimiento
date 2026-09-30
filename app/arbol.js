// Tabla anidada estilo "Detalle" del tablero de Dirección: Ejes → campañas → piezas → anuncios; Audiencias → campañas → piezas;
// Activos → campañas. Logos de plataforma, cantidad de hijos, "ver campaña ↗" (abre su detalle),
// Impresiones · Reproducciones · Reacciones · Gasto y, al final, Eficacia (Ejes, Audiencias) o Salud (Activos).
// Cada nodo que produce la lógica: { name, sub, plats:[{icon,name}], n, hasLink, onLink, open, chev, toggle, hasKids, kids:[…],
//   imp, vw, rea, gasto, ef:{c,short}, salud:{hay,ritmo,dot,bg,restante,w,hayBarra,titulo}, hasPieza, onPieza }

// entra en el ancho de la página (1440 px máx.) sin scroll horizontal: el nombre se recorta, los números son compactos
const COLS = { ef: 'minmax(0,1fr) 92px 96px 84px 84px 62px', salud: 'minmax(0,1fr) 74px 80px 92px 96px 84px 84px 190px' };

const eficacia = (a) => `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:#808080" title="Eficacia: % del gasto en anuncios rojos"><span style="width:9px;height:9px;border-radius:2px;background:{{ ${a}.ef.c }}"></span>{{ ${a}.ef.short }}</span>`;

// salud del activo: ritmo de gasto (normal / pico / apagón) y presupuesto restante del pedido; solo en el primer nivel
const salud = (a) => `<span style="display:flex;flex-direction:column;gap:4px;min-width:0" title="{{ ${a}.salud.titulo }}"><sc-if value="{{ ${a}.salud.hay }}">
      <span style="display:inline-flex;align-items:center;gap:6px;align-self:flex-start;padding:1px 9px;border-radius:9999px;background:{{ ${a}.salud.bg }};font-size:11.5px"><sc-if value="{{ ${a}.salud.dot }}"><span style="width:8px;height:8px;border-radius:50%;background:{{ ${a}.salud.dot }}"></span></sc-if>{{ ${a}.salud.ritmo }}</span>
      <span style="font-size:11px;color:#808080;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ ${a}.salud.restante }}</span>
      <sc-if value="{{ ${a}.salud.hayBarra }}"><span style="display:block;height:3px;background:#F0F0F0;border-radius:9999px"><span style="display:block;height:100%;width:{{ ${a}.salud.w }};background:#A6AAA9;border-radius:9999px"></span></span></sc-if>
    </sc-if></span>`;

const fila = (a, nivel, modo) => `
  <div style="display:grid;grid-template-columns:${COLS[modo]};gap:12px;align-items:center;padding:${nivel === 1 ? '13px' : nivel === 2 ? '11px' : '9px'} 0 ${nivel === 1 ? '13px' : nivel === 2 ? '11px' : '9px'} ${(nivel - 1) * 22}px;border-bottom:1px solid #F0F0F0;font-size:${nivel === 1 ? '13.5px' : '12.5px'}" style-hover="background:#FAFAFA">
    <div style="display:flex;gap:8px;align-items:center;min-width:0;flex-wrap:wrap">
      <sc-if value="{{ ${a}.hasKids }}"><button sc-camel-on-click="{{ ${a}.toggle }}" style="border:none;background:none;padding:0;width:14px;color:#A6AAA9;cursor:pointer;font-size:12px">{{ ${a}.chev }}</button></sc-if>
      <sc-if value="{{ ${a}.sinKids }}"><span style="width:14px"></span></sc-if>
      <span style="font-weight:${nivel <= 2 ? '600' : '500'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:${nivel === 1 ? '440px' : '520px'}" title="{{ ${a}.name }}">{{ ${a}.name }}</span>
      <span style="display:inline-flex;gap:2px;align-items:center"><sc-for list="{{ ${a}.plats }}" as="pl" hint-placeholder-count="2"><img src="{{ pl.icon }}" alt="{{ pl.name }}" title="{{ pl.name }}" style="width:13px;height:13px;display:inline-block"></sc-for></span>
      <sc-if value="{{ ${a}.hasN }}"><span style="font-size:11px;color:#A6AAA9">{{ ${a}.n }}</span></sc-if>
      <sc-if value="{{ ${a}.hasLink }}"><button sc-camel-on-click="{{ ${a}.onLink }}" style="border:1px solid #E4E4E4;background:#FFFFFF;border-radius:9999px;padding:1px 9px;font-size:10.5px;cursor:pointer;color:#3C3C3C" style-hover="border-color:#A6AAA9">ver campaña ↗</button></sc-if>
      <sc-if value="{{ ${a}.hasPieza }}"><button sc-camel-on-click="{{ ${a}.onPieza }}" style="border:none;background:none;padding:0;font-size:11px;text-decoration:underline;text-underline-offset:2px;cursor:pointer;color:#808080">ver pieza ▸</button></sc-if>
      <sc-if value="{{ ${a}.sub }}"><span style="font-size:11px;color:#A6AAA9">{{ ${a}.sub }}</span></sc-if>
    </div>
    ${modo === 'salud' ? `<span style="text-align:right;font-weight:${nivel === 1 ? '600' : '400'}">{{ ${a}.nCamp }}</span><span style="text-align:right;font-weight:${nivel === 1 ? '600' : '400'}">{{ ${a}.nCont }}</span>` : ''}
    <span style="text-align:right;font-weight:${nivel === 1 ? '600' : '400'}">{{ ${a}.imp }}</span>
    <span style="text-align:right;color:#5C5C5C">{{ ${a}.vw }}</span>
    <span style="text-align:right;color:#5C5C5C">{{ ${a}.rea }}</span>
    <span style="text-align:right;color:#5C5C5C">{{ ${a}.gasto }}</span>
    ${modo === 'salud' ? salud(a) : eficacia(a)}
  </div>`;

function arbol(lista, etiqueta, modo) {
  return `
  <div style="margin-top:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
    <input value="{{ busca }}" sc-camel-on-change="{{ onBusca }}" placeholder="Buscar campaña, pieza, audiencia o código (A06098)…" style="flex:1;min-width:220px;max-width:360px;border:1px solid #E4E4E4;border-radius:9999px;padding:6px 14px;font-size:12.5px;font-family:inherit;background:#FFFFFF">
    <button sc-camel-on-click="{{ colapsar }}" style="border:none;background:none;padding:0;font-size:12.5px;text-decoration:underline;text-underline-offset:3px;cursor:pointer;color:#3C3C3C">Colapsar todo</button>
  </div>
  <div style="margin-top:14px"><div>
    <div style="display:grid;grid-template-columns:${COLS[modo]};gap:12px;padding:8px 0;font-size:11.5px;color:#808080;border-bottom:1px solid #E4E4E4">
      <span>${etiqueta}</span>${modo === 'salud' ? '<span style="text-align:right">Campañas</span><span style="text-align:right">Contenidos</span>' : ''}<span style="text-align:right;font-weight:600;color:#3C3C3C">Impresiones ↓</span><span style="text-align:right">Reproducciones</span><span style="text-align:right">Reacciones</span><span style="text-align:right">Gasto</span><span>${modo === 'salud' ? 'Salud' : 'Eficacia'}</span>
    </div>
    <sc-for list="{{ ${lista} }}" as="e" hint-placeholder-count="6">
      ${fila('e', 1, modo)}
      <sc-if value="{{ e.open }}"><sc-for list="{{ e.kids }}" as="c" hint-placeholder-count="0">
        ${fila('c', 2, modo)}
        <sc-if value="{{ c.open }}"><sc-for list="{{ c.kids }}" as="p" hint-placeholder-count="0">
          ${fila('p', 3, modo)}
          <sc-if value="{{ p.open }}"><sc-for list="{{ p.kids }}" as="k" hint-placeholder-count="0">
            ${fila('k', 4, modo)}
          </sc-for></sc-if>
        </sc-for></sc-if>
      </sc-for></sc-if>
    </sc-for>
    <sc-if value="{{ ${lista}Vacio }}"><div style="padding:28px 0;text-align:center;color:#808080;font-size:13px">Nada que mostrar con ese filtro.</div></sc-if>
  </div></div>`;
}

const cabecera = (titulo, helpKey, texto, ayuda) => `
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <h2 style="margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em">${titulo}</h2>
        <button sc-camel-on-click="{{ h.${helpKey}.toggle }}" style="border:none;background:none;padding:0;font-size:12.5px;text-decoration:underline;text-underline-offset:3px;cursor:pointer">ⓘ Cómo se calcula</button>
      </div>
      <p style="margin:4px 0 0;font-size:13px;color:#808080;text-wrap:pretty">${texto}</p>
      <sc-if value="{{ h.${helpKey}.open }}"><div style="margin-top:10px;padding:12px 14px;background:#F5F5F5;border-radius:10px;font-size:12.5px;line-height:1.6">${ayuda}</div></sc-if>`;

const AYUDA = 'Impresiones, reproducciones, reacciones y gasto del período elegido, todas las plataformas. <b>Eficacia</b>: % del gasto en anuncios rojos según la regla de Looker (cada anuncio de Meta contra los de su mismo objetivo y placement del proyecto, en su misma época). En Ejes, los anuncios (último nivel) son los conjuntos de Meta del mes en curso.';
const AYUDA_SALUD = '<b>Campañas</b> y <b>Contenidos</b>: cuántas campañas y cuántas piezas distintas tuvo el activo en el período (en cada campaña, sus piezas en ese activo). Impresiones, reproducciones, reacciones y gasto del período elegido, todas las plataformas. <b>Salud</b> (solo en cada activo): <b>ritmo</b> = gasto de los últimos 2 días completos contra su día típico del mes anterior; apagón si gasta menos de la mitad, pico si gasta más del doble. <b>Restante</b> = pedido del mes menos lo gastado, según la planilla de pedidos (en revisión). <b>Automatizado</b>: PAUTADOR puede crear anuncios en ese activo.';

module.exports = {
  ejes: `<sc-if value="{{ isEjes }}">
    <main data-screen-label="Proyecto · Ejes" style="max-width:{{ L.max }};margin:0 auto;padding:36px 28px 120px">
      ${cabecera('Ejes', 'ejes', 'Eje → campaña → pieza → anuncio. Tocá para abrir cada nivel; “ver campaña” abre su detalle.', AYUDA)}
      ${arbol('arbolEjes', 'Eje / campaña / pieza / anuncio', 'ef')}
    </main></sc-if>`,
  auds: `<sc-if value="{{ isAud }}">
    <main data-screen-label="Proyecto · Audiencias" style="max-width:{{ L.max }};margin:0 auto;padding:36px 28px 120px">
      ${cabecera('Audiencias', 'aud', 'Audiencia → campaña → pieza. Qué se le comunicó a cada audiencia y cómo respondió (solo Meta: las audiencias vienen de los conjuntos de Meta).', AYUDA)}
      ${arbol('arbolAuds', 'Audiencia / campaña / pieza', 'ef')}
    </main></sc-if>`,
  activos: `<sc-if value="{{ isActivos }}">
    <main data-screen-label="Proyecto · Activos" style="max-width:{{ L.max }};margin:0 auto;padding:36px 28px 120px">
      ${cabecera('Activos', 'activos', 'Activo → campaña. En cada activo, su salud: ritmo de gasto y presupuesto restante del pedido.', AYUDA_SALUD)}
      ${arbol('arbolActivos', 'Activo / campaña', 'salud')}
    </main></sc-if>`,
  COLS,
};
