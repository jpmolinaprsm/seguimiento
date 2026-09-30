// Pestaña Publicaciones del diseño con la Comparación como pestaña interna (aparece al marcar 2 o más piezas).
// Reusa el markup de la lista del diseño y el bloque de comparación que antes era una pestaña aparte.
module.exports = `<sc-if value="{{ isPubs }}">
      <main data-screen-label="Proyecto · Publicaciones" style="max-width:{{ L.max }};margin:0 auto;padding:36px 28px 120px">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <h2 style="margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em">Publicaciones</h2>
          <button sc-camel-on-click="{{ h.pubs.toggle }}" style="border:none;background:none;padding:0;font-size:12.5px;text-decoration:underline;text-underline-offset:3px;cursor:pointer">ⓘ Cómo se calcula</button>
        </div>
        <p style="margin:4px 0 0;font-size:13px;color:#808080;text-wrap:pretty">Todas las piezas del período, de todas las campañas y plataformas. Marcá 2 o 3 para compararlas.</p>
        <sc-if value="{{ h.pubs.open }}"><div style="margin-top:10px;padding:12px 14px;background:#F5F5F5;border-radius:10px;font-size:12.5px;line-height:1.6">Costo por reacción: gasto ÷ reacciones, la medida de efectividad de los contenidos (solo Meta; en YouTube, TikTok y DV360 se muestra el costo de lo que compra cada uno). General: contra lo normal en todos los gobiernos para el mismo objetivo × formato × placement. Tasas sobre impresiones. Stories no registra reacciones y nunca se marca como malo por eso.</div></sc-if>

        <div style="margin-top:18px;display:flex;gap:2px;border-bottom:1px solid #E4E4E4">
          <button sc-camel-on-click="{{ pubVerLista }}" style="border:none;background:none;padding:8px 12px;font-size:13px;font-weight:500;cursor:pointer;color:{{ pubTabLista.color }};border-bottom:2px solid {{ pubTabLista.bd }};margin-bottom:-1px">Lista</button>
          <sc-if value="{{ hasSel }}"><button sc-camel-on-click="{{ pubVerCmp }}" style="border:none;background:none;padding:8px 12px;font-size:13px;font-weight:500;cursor:pointer;color:{{ pubTabCmp.color }};border-bottom:2px solid {{ pubTabCmp.bd }};margin-bottom:-1px">Comparación <span style="background:#3C3C3C;color:#FFFFFF;border-radius:9999px;padding:0 7px;font-size:11px">{{ cmpCount }}</span></button></sc-if>
        </div>

        <sc-if value="{{ pubEnLista }}">
        <div style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap;align-items:center">
          <sc-raw-select value="{{ pubCamp }}" sc-camel-on-change="{{ onPubCamp }}" style="border:1px solid #E4E4E4;border-radius:9999px;padding:5px 12px;font-size:12.5px;background:#FFFFFF;cursor:pointer;max-width:320px">
            <sc-for list="{{ pubCampOpts }}" as="o" hint-placeholder-count="4"><option value="{{ o.id }}">{{ o.label }}</option></sc-for>
          </sc-raw-select>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <sc-for list="{{ pubFormats }}" as="m" hint-placeholder-count="5">
              <button sc-camel-on-click="{{ m.onClick }}" style="border:1px solid {{ m.bd }};background:{{ m.bg }};color:{{ m.color }};border-radius:9999px;padding:4px 12px;font-size:12px;font-weight:500;cursor:pointer">{{ m.label }}</button>
            </sc-for>
          </div>
          <input value="{{ busca }}" sc-camel-on-change="{{ onBusca }}" placeholder="Buscar pieza o código…" style="min-width:180px;border:1px solid #E4E4E4;border-radius:9999px;padding:5px 12px;font-size:12.5px;font-family:inherit;background:#FFFFFF">
          <div style="display:flex;align-items:center;gap:6px;margin-left:auto;font-size:12px;color:#808080">Ordenar por
            <div style="display:flex;padding:3px;background:#F4F4F4;border-radius:9999px">
              <sc-for list="{{ pubSorts }}" as="m" hint-placeholder-count="3">
                <button sc-camel-on-click="{{ m.onClick }}" style="border:none;border-radius:9999px;padding:3px 11px;font-size:12px;font-weight:500;cursor:pointer;color:#3C3C3C;background:{{ m.bg }};box-shadow:{{ m.shadow }}">{{ m.label }}</button>
              </sc-for>
            </div>
          </div>
        </div>
        <sc-if value="{{ hasSel }}">
          <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:8px 14px;background:#F4F4F4;border-radius:12px;font-size:12.5px">
            <span>{{ selTxt }}</span>
            <div style="display:flex;gap:12px;align-items:center">
              <button sc-camel-on-click="{{ clearCmp }}" style="border:none;background:none;padding:0;font-size:12px;text-decoration:underline;cursor:pointer">Limpiar</button>
              <sc-if value="{{ hasCmp }}"><button sc-camel-on-click="{{ pubVerCmp }}" style="border:none;background:#3C3C3C;color:#FFFFFF;border-radius:9999px;padding:6px 14px;font-size:12.5px;font-weight:600;cursor:pointer">Ver comparación ›</button></sc-if>
            </div>
          </div>
        </sc-if>
        <div style="margin-top:12px">
          <div style="display:grid;grid-template-columns:28px minmax(0,2fr) 76px 84px 96px 70px 66px 80px 80px 80px;gap:10px;padding:10px 0;font-size:11.5px;color:#808080;border-bottom:1px solid #E4E4E4">
            <span></span><span>Publicación</span><span>Gasto</span><span>Impresiones</span><span>Costo x reacción</span><span>General</span><span>Eficacia</span><span>Compartido</span><span>Comentarios</span><span>Retención 25 %</span>
          </div>
          <sc-for list="{{ pubRows }}" as="r" hint-placeholder-count="10">
            <div style="display:grid;grid-template-columns:28px minmax(0,2fr) 76px 84px 96px 70px 66px 80px 80px 80px;gap:10px;padding:11px 0;align-items:center;font-size:12.5px;border-bottom:1px solid #F0F0F0;background:{{ r.rowBg }}">
              <button sc-camel-on-click="{{ r.onToggle }}" title="Comparar" style="width:18px;height:18px;border-radius:5px;border:1.5px solid {{ r.cbBd }};background:{{ r.cbBg }};color:#FFFFFF;font-size:11px;line-height:1;cursor:{{ r.cbCursor }};padding:0;opacity:{{ r.cbOp }}">{{ r.check }}</button>
              <div style="min-width:0">
                <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="{{ r.name }}"><img src="{{ r.icon }}" alt="{{ r.red }}" title="{{ r.red }}" style="width:13px;height:13px;vertical-align:-2px;margin-right:5px">{{ r.name }}</div>
                <div style="margin-top:2px;font-size:11.5px;color:#808080;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ r.campName }}</div>
                <div style="margin-top:2px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:11.5px;color:#808080">
                  <span>{{ r.formato }} · {{ r.fechas }}</span>
                  <button sc-camel-on-click="{{ r.onPieza }}" style="border:none;background:none;padding:0;font-size:11.5px;font-weight:500;cursor:pointer;text-decoration:underline;text-underline-offset:2px">ver pieza ▸</button>
                  <sc-for list="{{ r.senales }}" as="s" hint-placeholder-count="0"><span style="display:inline-flex;align-items:center;gap:5px;color:#3C3C3C"><span style="width:7px;height:7px;border-radius:50%;background:{{ s.c }}"></span>{{ s.label }}</span></sc-for>
                </div>
              </div>
              <span>{{ r.gastoT }}</span>
              <span>{{ r.impT }}</span>
              <span style="font-weight:600;font-size:12px">{{ r.cxrT }}</span>
              <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:50%;background:{{ r.gen.bg }}"></span>{{ r.gen.num }}</span>
              <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:2px;background:{{ r.ef.c }}"></span>{{ r.ef.short }}</span>
              <span>{{ r.compT }}</span>
              <span>{{ r.comT }}</span>
              <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:50%;background:{{ r.retC }}"></span>{{ r.retT }}</span>
            </div>
          </sc-for>
          <sc-if value="{{ pubVacio }}"><div style="padding:28px 0;text-align:center;color:#808080;font-size:13px">Nada que mostrar con ese filtro.</div></sc-if>
        </div>
        </sc-if>

        <sc-if value="{{ pubEnCmp }}">
          <div style="margin-top:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <sc-if value="{{ canAdd }}">
              <sc-raw-select value="" sc-camel-on-change="{{ onAddCmp }}" style="border:1px solid #E4E4E4;border-radius:9999px;padding:5px 12px;font-size:12.5px;background:#FFFFFF;cursor:pointer;max-width:420px">
                <sc-for list="{{ addOpts }}" as="o" hint-placeholder-count="4"><option value="{{ o.id }}">{{ o.label }}</option></sc-for>
              </sc-raw-select>
            </sc-if>
            <button sc-camel-on-click="{{ pubVerLista }}" style="border:none;background:none;padding:0;font-size:12.5px;text-decoration:underline;text-underline-offset:3px;cursor:pointer">Elegir desde la lista</button>
          </div>
          <sc-if value="{{ hasCmp }}">
            <div style="margin-top:20px;border:1px solid #E4E4E4;border-radius:16px;padding:18px 20px">
              <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:10px">
                <span style="font-size:13px;color:#808080">{{ cmpCount }} publicaciones · la mejor de cada fila va marcada</span>
                <button sc-camel-on-click="{{ clearCmp }}" style="border:none;background:none;padding:0;font-size:12px;text-decoration:underline;cursor:pointer">Limpiar</button>
              </div>
              <div>
                <div style="display:grid;grid-template-columns:{{ cmpCols }};gap:14px;padding:8px 0;border-bottom:1px solid #E4E4E4;align-items:end">
                  <span></span>
                  <sc-for list="{{ cmpHead }}" as="c" hint-placeholder-count="2">
                    <div style="min-width:0">
                      <div style="font-size:13px;font-weight:600;line-height:1.35"><img src="{{ c.icon }}" alt="" style="width:13px;height:13px;vertical-align:-2px;margin-right:5px">{{ c.name }}</div>
                      <div style="margin-top:4px;display:flex;gap:10px;font-size:11.5px"><button sc-camel-on-click="{{ c.onPieza }}" style="border:none;background:none;padding:0;font-size:11.5px;text-decoration:underline;cursor:pointer">ver pieza ▸</button><button sc-camel-on-click="{{ c.onRemove }}" style="border:none;background:none;padding:0;font-size:11.5px;color:#808080;cursor:pointer">Quitar</button></div>
                    </div>
                  </sc-for>
                </div>
                <sc-for list="{{ cmpRows }}" as="r" hint-placeholder-count="8">
                  <div style="display:grid;grid-template-columns:{{ cmpCols }};gap:14px;padding:9px 0;border-bottom:1px solid #F0F0F0;font-size:12.5px;align-items:center">
                    <span style="color:#808080;font-size:12px">{{ r.label }}</span>
                    <sc-for list="{{ r.cells }}" as="c" hint-placeholder-count="2">
                      <span style="display:inline-flex;align-items:center;gap:6px;font-weight:{{ c.fw }}"><sc-if value="{{ c.dot }}"><span style="width:9px;height:9px;border-radius:{{ c.radius }};background:{{ c.dot }}"></span></sc-if>{{ c.v }}<sc-if value="{{ c.best }}"><span style="font-size:10.5px;font-weight:500;color:#808080">mejor</span></sc-if></span>
                    </sc-for>
                  </div>
                </sc-for>
              </div>
            </div>
          </sc-if>
          <sc-if value="{{ noCmp }}">
            <div style="margin-top:20px;padding:40px 24px;border:1px dashed #D5D5D5;border-radius:16px;text-align:center;font-size:13px;color:#808080">{{ noCmpTxt }}</div>
          </sc-if>
        </sc-if>
      </main>
    </sc-if>`;
