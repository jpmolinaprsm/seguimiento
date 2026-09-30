// Pestaña "Looker": el tablero de Looker Studio del proyecto embebido. El <iframe> NO va en el template: cada re-render lo
// recrearía (Looker recargaba y el foco scrolleaba la página). La lógica lo crea una sola vez y lo posiciona sobre #looker-slot.
// El título es el link para abrir el tablero en Looker; la lógica lo mueve al margen izquierdo del tablero cuando hay lugar.
module.exports = `<sc-if value="{{ isLooker }}">
    <main data-screen-label="Proyecto · Looker" style="max-width:1720px;margin:0 auto;padding:10px 20px 12px">
      <sc-if value="{{ hasLooker }}">
        <a id="looker-titulo" href="{{ lookerSrc }}" target="_blank" rel="noopener" title="Abrir el tablero en Looker Studio" style="display:inline-block;font-size:15px;font-weight:600;letter-spacing:-0.01em;color:#3C3C3C;text-decoration:none;line-height:1.3;margin-bottom:8px">Tablero de Looker ↗</a>
        <div id="looker-slot" style="width:100%;height:{{ lookerH }}"></div>
      </sc-if>
      <sc-if value="{{ noLooker }}">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <h2 style="margin:0;font-size:17px;font-weight:600;letter-spacing:-0.01em">Tablero de Looker</h2>
          <button sc-camel-on-click="{{ pegarLooker }}" style="border:none;background:none;padding:0;font-size:12.5px;text-decoration:underline;text-underline-offset:3px;cursor:pointer;color:#3C3C3C">pegar el link del tablero</button>
        </div>
        <div style="margin-top:18px;padding:40px 20px;border:1px dashed #D5D5D5;border-radius:12px;text-align:center;color:#808080;font-size:13px">Este proyecto y canal todavía no tienen tablero cargado. Pegá el link de inserción de Looker Studio (Archivo → Insertar informe) con el botón de arriba.</div>
      </sc-if>
    </main></sc-if>
`;
