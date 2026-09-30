// Genera public/index.html a partir del diseño (handoff de Claude Design) + ui/script.js.
// El template HTML se toma tal cual del handoff; solo se cambian rutas, los textos fijos que ahora son datos
// y se reemplaza el <script data-dc-script> por el que habla con el API.
const fs = require('fs');
const path = require('path');

const HANDOFF = path.resolve(__dirname, '..', 'Interfaz de recomendaciones', 'design_handoff_seguimiento_optimizacion');
const fuente = fs.readFileSync(path.join(HANDOFF, 'Seguimiento y Optimizacion.dc.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, 'ui', 'script.js'), 'utf8');

const corte = fuente.indexOf('<script type="text/x-dc" data-dc-script>');
if (corte < 0) throw new Error('No encuentro el script data-dc-script en el handoff');
let html = fuente.slice(0, corte);

const DS = /_ds\/prosumia-design-system-[0-9a-f-]+\//g;
html = html.replace(DS, '_ds/');
html = html.replace('<script src="./support.js"></script>',
  `<title>Seguimiento y Optimización</title>
<link rel="icon" href="assets/LogoColor.svg">
<script>window.__resources = {
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': 'vendor/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': 'vendor/react-dom.production.min.js',
};</script>
<script src="./support.js"></script>`);
html = html.replace('{{ P.nombre }} · septiembre 2026', '{{ P.nombre }} · {{ P.mesTxt }}');
// Presupuesto: una tarjeta por canal (Oficial e Informativo tienen presupuesto propio). Misma estética que la del diseño.
const tarjetaCanal = `<sc-if value="{{ SA.visible }}" hint-placeholder-val="{{ false }}">
        <div style="border:1px solid #E4E4E4;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:16px">
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div style="display:flex;flex-direction:column;gap:2px">
              <h2 style="margin:0;font-size:20px;font-weight:600">Salud de los activos</h2>
              <span style="font-size:12px;color:#5C5C5C">{{ SA.sub }}</span>
            </div>
            <div style="display:flex;padding:3px;border-radius:9999px;background:#F4F4F4;gap:2px">
              <sc-for list="{{ SA.meses }}" as="sm" hint-placeholder-count="2">
                <button sc-camel-on-click="{{ sm.onClick }}" style="height:30px;padding:0 14px;border-radius:9999px;border:0;background:{{ sm.bg }};color:{{ sm.fg }};font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap">{{ sm.label }}</button>
              </sc-for>
            </div>
          </div>
          <div style="font-size:12px;color:#5C5C5C">{{ SA.totales }}</div>
          <div style="display:none">
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            <sc-for list="{{ SA.chips }}" as="ch" hint-placeholder-count="5">
              <button sc-camel-on-click="{{ ch.onClick }}" style="display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:9999px;border:1px solid {{ ch.bc }};background:{{ ch.bg }};color:#3C3C3C;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap"><span style="width:8px;height:8px;border-radius:50%;background:{{ ch.c }}"></span>{{ ch.label }}</button>
            </sc-for>
          </div>
          <div style="overflow-x:auto">
            <div style="min-width:980px">
              <div style="display:grid;grid-template-columns:150px minmax(0,2.2fr) repeat(3,minmax(0,0.9fr)) minmax(120px,1fr) minmax(0,1.3fr);gap:12px;padding:10px 0;border-bottom:1px solid #E4E4E4;font-size:11px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:#5C5C5C"><span>Estado</span><span>Activo</span><span>Pedido</span><span>Gastado</span><span>Restante</span><span>Ejecución</span><span>Nota</span></div>
              <sc-for list="{{ SA.filas }}" as="sa" hint-placeholder-count="8">
                <div style="display:grid;grid-template-columns:150px minmax(0,2.2fr) repeat(3,minmax(0,0.9fr)) minmax(120px,1fr) minmax(0,1.3fr);gap:12px;padding:12px 0;border-bottom:1px solid #E4E4E4;align-items:center;font-size:13px">
                  <span style="display:flex;align-items:center;gap:8px;font-weight:600;font-size:12px"><span style="flex:none;width:8px;height:8px;border-radius:50%;background:{{ sa.c }}"></span>{{ sa.estado }}</span>
                  <span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="{{ sa.nombre }}">{{ sa.nombre }}</span><span style="font-size:11px;color:#5C5C5C">{{ sa.sub }}</span></span>
                  <span>{{ sa.pedido }}</span><span>{{ sa.gastado }}</span><span style="font-weight:600;color:{{ sa.rc }}">{{ sa.restante }}</span>
                  <span style="display:flex;flex-direction:column;gap:4px"><span style="position:relative;height:8px;border-radius:9999px;background:#F4F4F4"><span style="position:absolute;left:0;top:0;bottom:0;width:{{ sa.bar }}%;border-radius:9999px;background:{{ sa.c }}"></span><span style="position:absolute;left:{{ sa.mes }}%;top:-3px;bottom:-3px;width:2px;background:#3C3C3C"></span></span><span style="font-size:11px;color:#5C5C5C">{{ sa.ejec }}</span></span>
                  <span style="font-size:12px;line-height:1.4;color:#3C3C3C">{{ sa.nota }}</span>
                </div>
              </sc-for>
            </div>
          </div>
          <sc-if value="{{ SA.hayMas }}" hint-placeholder-val="{{ false }}">
            <button sc-camel-on-click="{{ SA.toggle }}" style="align-self:flex-start;border:0;background:none;padding:0;font-size:13px;font-weight:600;color:#3C3C3C;cursor:pointer;text-decoration:underline;text-underline-offset:3px">{{ SA.toggleLabel }}</button>
          </sc-if>
          <div style="font-size:11px;color:#5C5C5C;line-height:1.5">{{ SA.pie }}</div>
        </div>
        </sc-if>
        <sc-for list="{{ budgetRows }}" as="br" hint-placeholder-count="2">
        <div style="border:1px solid #E4E4E4;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:18px">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="display:inline-flex;align-items:center;height:28px;padding:0 12px;border-radius:9999px;background:#F4F4F4;font-size:12px;font-weight:600;white-space:nowrap">{{ br.canal }}</span>
            <span style="font-size:12px;color:#5C5C5C">{{ br.sub }}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px 24px">
            <sc-for list="{{ br.figs }}" as="b" hint-placeholder-count="4">
              <div style="display:flex;flex-direction:column;gap:4px">
                <div style="font-size:12px;font-weight:500;color:#5C5C5C">{{ b.label }}</div>
                <div style="font-size:26px;font-weight:600;letter-spacing:-0.02em;line-height:1.1">{{ b.value }}</div>
              </div>
            </sc-for>
          </div>
          <sc-if value="{{ br.tienePresu }}" hint-placeholder-val="{{ true }}">
            <div style="display:flex;flex-direction:column;gap:8px">
              <div style="position:relative;height:10px;border-radius:9999px;background:#F4F4F4;overflow:hidden">
                <div style="position:absolute;left:0;top:0;bottom:0;width:{{ br.projBar }}%;background:#D5D5D5;border-radius:9999px"></div>
                <div style="position:absolute;left:0;top:0;bottom:0;width:{{ br.gastBar }}%;background:#3C3C3C;border-radius:9999px"></div>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:6px 20px;font-size:12px;color:#5C5C5C">
                <span style="display:flex;align-items:center;gap:6px"><span style="flex:none;width:10px;height:10px;border-radius:50%;background:#3C3C3C"></span><span>Gastado {{ br.gastPct }} %</span></span>
                <span style="display:flex;align-items:center;gap:6px"><span style="flex:none;width:10px;height:10px;border-radius:50%;background:#D5D5D5"></span><span>Proyección al cierre {{ br.projPct }} % (ritmo de los últimos 7 días)</span></span>
                <span>{{ br.diaTxt }}</span>
              </div>
            </div>
          </sc-if>
          <sc-if value="{{ br.hasAviso }}" hint-placeholder-val="{{ true }}">
            <div style="display:flex;gap:10px;align-items:flex-start;padding:12px 16px;border-radius:16px;background:#F4F4F4;font-size:13px;line-height:1.5;font-weight:500"><span style="flex:none;margin-top:6px;width:8px;height:8px;border-radius:50%;background:#FCB942"></span>{{ br.aviso }}</div>
          </sc-if>
        </div>
        </sc-for>
        <sc-if value="{{ P.hasAviso }}" hint-placeholder-val="{{ false }}">
          <div style="display:flex;gap:10px;align-items:flex-start;padding:12px 16px;border-radius:16px;background:#F4F4F4;font-size:13px;line-height:1.5;font-weight:500"><span style="flex:none;margin-top:6px;width:8px;height:8px;border-radius:50%;background:#FCB942"></span>{{ P.aviso }}</div>
        </sc-if>
        `;
const reTarjeta = /<div style="border:1px solid #E4E4E4;border-radius:24px;padding:24px;display:flex;flex-direction:column;gap:18px">[\s\S]*?<\/sc-if>\s*<\/div>\s*(?=<div style="display:grid;grid-template-columns:repeat\(auto-fit,minmax\(180px,1fr\)\);gap:12px">)/;
if (!reTarjeta.test(html)) throw new Error('No encuentro la tarjeta de presupuesto en el diseño');
html = html.replace(reTarjeta, tarjetaCanal);
html = html.replace(/<span style="flex:1 1 320px;font-size:13px;line-height:1\.5;font-weight:500">Dejé de proponer[^<]*<\/span>/,
  '<span style="flex:1 1 320px;font-size:13px;line-height:1.5;font-weight:500">{{ silencedText }}</span>');
html = html.replace('<main style="max-width:1280px;width:100%;margin:0 auto;padding:32px 32px 96px;display:flex;flex-direction:column;gap:28px">',
  `<main style="max-width:1280px;width:100%;margin:0 auto;padding:32px 32px 96px;display:flex;flex-direction:column;gap:28px">
    <sc-if value="{{ cargando }}" hint-placeholder-val="{{ false }}">
      <div style="padding:14px 18px;border-radius:16px;background:#F4F4F4;font-size:13px;font-weight:500;color:#5C5C5C">Consultando BigQuery… (la primera carga de un proyecto tarda unos segundos; después queda en caché 30 minutos)</div>
    </sc-if>
    <sc-if value="{{ hasError }}" hint-placeholder-val="{{ false }}">
      <div style="padding:14px 18px;border-radius:16px;background:#FFF1F1;border:1px solid #F7444C;font-size:13px;font-weight:500;color:#E9121C">{{ error }}</div>
    </sc-if>`);
// El runtime no resuelve la variable del bucle adentro de <sc-raw-table>: la tabla del historial se arma con una grilla de divs (mismo aspecto).
const COLS = '80px 90px minmax(220px,1.4fr) 130px minmax(220px,1.3fr) 160px minmax(200px,1fr)';
const th = (t) => `<div style="padding:12px 16px;font-size:11px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:#5C5C5C">${t}</div>`;
const tablaHist = `<div style="border:1px solid #E4E4E4;border-radius:24px;overflow-x:auto">
          <div style="min-width:1100px;font-size:13px">
            <div style="display:grid;grid-template-columns:${COLS};background:#F4F4F4">${['Fecha', 'Quién', 'Campaña · contenido', 'Cambio', 'Decisión', 'Aplicación', 'Resultado a 7 días'].map(th).join('')}</div>
            <sc-for list="{{ histRows }}" as="hr" hint-placeholder-count="7">
              <div style="display:grid;grid-template-columns:${COLS};border-top:1px solid #E4E4E4;align-items:start">
                <div style="padding:14px 16px;white-space:nowrap;font-weight:500">{{ hr.fecha }}</div>
                <div style="padding:14px 16px;white-space:nowrap">{{ hr.quien }}</div>
                <div style="padding:14px 16px"><div style="font-weight:600">{{ hr.camp }}</div><div style="color:#5C5C5C;font-size:12px">{{ hr.contenido }} · {{ hr.canal }} · {{ hr.proyecto }}</div></div>
                <div style="padding:14px 16px">{{ hr.tipo }}</div>
                <div style="padding:14px 16px"><div style="display:flex;align-items:center;gap:6px;font-weight:600"><span style="flex:none;width:8px;height:8px;border-radius:50%;background:{{ hr.decC }}"></span>{{ hr.dec }}</div><sc-if value="{{ hr.hasJust }}" hint-placeholder-val="{{ false }}"><div style="color:#5C5C5C;font-size:12px;line-height:1.5;margin-top:2px">{{ hr.just }}</div></sc-if></div>
                <div style="padding:14px 16px">{{ hr.aplic }}</div>
                <div style="padding:14px 16px"><div style="font-weight:500">{{ hr.res }}</div><sc-if value="{{ hr.hasLect }}" hint-placeholder-val="{{ false }}"><div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#5C5C5C;margin-top:2px"><span style="width:8px;height:8px;border-radius:50%;background:{{ hr.lectC }}"></span>{{ hr.lect }}</div></sc-if></div>
              </div>
            </sc-for>
          </div>
        </div>`;
html = html.replace(/<div style="border:1px solid #E4E4E4;border-radius:24px;overflow-x:auto">[\s\S]*?<\/table>\s*<\/div>/, tablaHist);
if (!html.includes('as="hr"') || html.includes('<table')) throw new Error('No se pudo reemplazar la tabla del historial');
for (const [antes, despues] of [['{{ P.nombre }} · {{ P.mesTxt }}', null], ['{{ silencedText }}', null], ['{{ budgetRows }}', null]]) {
  if (!html.includes(antes)) throw new Error(`No se aplicó el reemplazo: ${antes}`);
}

html += `<script type="text/x-dc" data-dc-script>
${script}
</script>

</body></html>
`;
fs.writeFileSync(path.join(__dirname, 'public', 'index.html'), html);

// RecoCard: mismas rutas del design system
const rc = path.join(__dirname, 'public', 'RecoCard.dc.html');
fs.writeFileSync(rc, fs.readFileSync(path.join(HANDOFF, 'RecoCard.dc.html'), 'utf8').replace(DS, '_ds/'));
console.log('public/index.html generado (' + html.length + ' caracteres)');
