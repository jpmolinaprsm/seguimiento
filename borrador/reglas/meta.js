// Reglas de Meta (Facebook e Instagram). Dueño: especialista de Meta.
// Detalle y estado de cada regla: Seguimiento/documentos/reglas-recomendador-v0.3.md, sección C.
// Cada regla agrega recomendaciones con ctx.nuevo(campaña, {...}) o ctx.acciones.push({...}). No calcula referencias: las recibe
// ya hechas en cada campaña (luces, índices, propia, eficacia) desde borrador/armar.js.

// umbrales propios de Meta
const PLACEMENTS_DEBILES = ['Facebook Instream Video', 'Threads Feed', 'Instagram Explore'];
const FATIGA_DIAS = { Video: 15, 'Placa Fija': 12, Carrusel: 12 };
const PRESION_CAMPANA = 20;        // impresiones por habitante por mes de UNA campaña (provisorio: un tercio del umbral de saturación del cliente)

// "Peor que la temporada anterior" (C2): el mismo cálculo que la tarjeta "Esta temporada" del panel Rendimiento (decisión del 02/10).
// temporada() vive en app/marcas.js (Referencias): toda esta temporada contra la misma cantidad de semanas desde el inicio de la
// temporada pasada, objetivo por objetivo y formato por formato (si no cubre el 80 %, objetivo por objetivo; si tampoco, sin
// comparación), con la plata de la pasada llevada a hoy. Dispara si el KPI del objetivo queda en rojo (20 % o más peor).
const { temporada, semanasDe } = require('../../app/marcas');
function temporadaDe(c, { P, canal, rows, fuenteSemanal, objetivo, datosHasta }) {
  const pr = c.propia;
  if (!pr || pr.tipo !== 'temporada' || !pr.inicio || !pr.previa || !rows || !fuenteSemanal) return null;
  const actual = rows.filter((r) => r.com === c.id && r.mes >= pr.inicio.slice(0, 7));
  const pasada = semanasDe(fuenteSemanal, { canal, cliente: P.cliente, comunic: c.id }, objetivo);
  return temporada({ actual, pasada, inicio: pr.inicio, previa: pr.previa, datosHasta, objetivo: c.obj });
}
const fPesos = (v) => '$' + Math.round(v).toLocaleString('es-AR');
const fPct = (v) => v.toLocaleString('es-AR', { maximumFractionDigits: 2 }) + ' %';
const KPI_TXT = { cr: ['Costo por reacción', fPesos], cpm: ['CPM', fPesos], ctr: ['CTR', fPct], treac: ['Tasa de reacción', fPct], tcomp: ['Tasa de compartido', fPct] };

function reglasMeta(ctx) {
  const { acciones, nuevo, vivas, campanas, deJuegos, bandaVideo, datosHasta, dias, luz, pz, corto, vx, Mk, dmy, pctTxt, hashId, COM_GENERICA, P, canal } = ctx;
  const fatigas = [];
  for (const c of vivas) {
    const pr = c.propia;
    if (c.luzG === 'rojo' && c.luzP === 'rojo' && c.deMas != null && c.deMas >= Math.max(100000, c.m.g * 0.05)) {
      const cs = (c.contenidos || []).filter((x) => x.g > 20000 && x.crP != null && dias(x.hasta, datosHasta) <= 2).sort((a, b) => a.crP - b.crP);
      const peor = cs[0], mejor = cs[cs.length - 1];
      const hay2 = cs.length >= 2 && mejor.crP > peor.crP * 1.5;
      nuevo(c, { tipo: 'Rinde por debajo', prioridad: 3, impacto: c.deMas, piezas: hay2 ? [pz(peor, 'La de peor costo por reacción'), pz(mejor, 'La de mejor costo por reacción')] : cs.slice(0, 1).map((x) => pz(x, 'Pieza principal')),
        titulo: `${c.nombre} rinde por debajo de las referencias`,
        que: (c.obj === 'Interacción' ? `Costo por reacción $${Math.round(c.m.g / (c.m.r || 1)).toLocaleString('es-AR')}: ${vx((1 / c.idxG))} la referencia general y ${vx((1 / c.idxP))} la del proyecto.`
          : c.obj === 'Tráfico' ? `CTR ${(c.m.c / c.m.i * 100).toFixed(2)} %: ${vx(c.idxG)} la referencia general y ${vx(c.idxP)} la del proyecto.`
            : `CPM $${Math.round(c.m.g / c.m.i * 1000).toLocaleString('es-AR')}: ${vx((1 / c.idxG))} la referencia general y ${vx((1 / c.idxP))} la del proyecto.`)
          + ` Pagó ${Mk(c.deMas)} más que lo habitual del proyecto${c.efi ? `; ${c.efi.pctGastoRojo} % del gasto en anuncios rojos (${c.efi.rojos} de ${c.efi.n})` : ''}.`,
        hacer: hay2 ? `Pausar “${corto(peor.nombre, 50)}” y pasar su presupuesto a “${corto(mejor.nombre, 50)}” (la que tiene mejor costo por reacción)` : 'Revisar la pieza y la audiencia; si en 2 días no mejora, pausar',
        porque: 'Una campaña que al día 5 está en el peor cuartil termina ahí el 82 % de las veces (solo 3 % se recupera por encima de la mediana).' });
    }
    // luz propia: recomendaciones propias de campañas largas
    if (pr && pr.estado === 'ok') {
      const tp = pr.tipo === 'temporada' ? temporadaDe(c, ctx) : null;
      if (tp && tp.peor) {
        const k = tp.kpis[tp.kpi], [nom, f] = KPI_TXT[tp.kpi], costo = ['cr', 'cpm'].includes(tp.kpi);
        nuevo(c, { tipo: 'Peor que la temporada anterior', prioridad: 2.5,
          temp: { kpi: tp.kpi, valor: k.valor, ref: k.ref, idx: tp.idx, dif: k.dif, nivel: k.nivel, semanas: tp.semanas, desde: tp.desde, toda: tp.toda },
          titulo: `${c.nombre} rinde peor que en la temporada anterior`,
          que: `${nom} ${f(k.valor)} en toda esta temporada, contra ${f(k.ref)} en ${tp.toda ? 'toda la temporada pasada' : 'las mismas semanas desde el inicio de la temporada pasada'} (${tp.semanas} ${tp.semanas === 1 ? 'semana' : 'semanas'} desde el ${dmy(tp.desde)}/${tp.desde.slice(0, 4)}): ${Math.abs(k.dif)} % ${costo ? 'más caro' : 'menos'}${costo ? ', con la plata de entonces llevada a hoy' : ''}.`,
          hacer: 'Comparar piezas y audiencias con las de la temporada pasada y retomar lo que funcionó', porque: 'Las campañas estacionales se comparan contra su propia temporada anterior, no contra el promedio.' });
      }
      if (pr.debajo && pr.idxPropio != null && luz(pr.idxPropio, c.obj) === 'rojo') nuevo(c, { tipo: 'Se desgastó', prioridad: 2.5,
        titulo: `${c.nombre} se desgastó`, que: `Las últimas 2 semanas quedaron debajo de su propio rango normal (KPI principal ${vx(pr.idxPropio)} su mediana, después de ${Math.round(pr.span / 7)} semanas al aire).`,
        hacer: 'Renovar las piezas o pausar una semana', porque: 'Contra su propia historia: dos semanas seguidas por debajo de su cuartil más bajo. La fatiga de contenido llega entre el día 12 y el 15.' });
      if (pr.arriba && c.luzG !== 'rojo') nuevo(c, { tipo: 'Mejor momento', prioridad: 2,
        titulo: `${c.nombre} está en su mejor momento`, que: `Las últimas 2 semanas quedaron arriba de su propio rango normal (${vx(pr.idxPropio)} su mediana).`,
        hacer: 'Sostener las piezas y subir 20 % el presupuesto diario', porque: 'Contra su propia historia: dos semanas seguidas por encima de su mejor cuartil.' });
      if (pr.presion != null && pr.presion >= PRESION_CAMPANA && pr.tendencia != null && pr.tendencia < 0.85) nuevo(c, { tipo: 'Presión acumulada alta', prioridad: 2,
        titulo: `${c.nombre}: mucha presión y respuesta en baja`, que: `${pr.presion.toFixed(0)} impresiones por habitante en el último mes; el KPI principal cayó a ${vx(pr.tendencia)} el de las 8 semanas anteriores.`,
        hacer: 'Bajar frecuencia: ampliar la audiencia o pausar una semana', porque: 'Por encima de 60–70 impresiones por habitante por mes aparece saturación (Chubut y Catamarca: la respuesta cayó hasta 43 %). Umbral por campaña provisorio.' });
    }
    if (c.obj === 'Interacción' && c.porPl) {
      const deb = c.porPl.filter((p) => PLACEMENTS_DEBILES.includes(p.k)).reduce((s, p) => s + p.g, 0);
      if (deb / c.m.g >= 0.05 && deb > 50000) nuevo(c, { tipo: 'Placements débiles', prioridad: 2,
        titulo: `${c.nombre}: ${Math.round(deb / c.m.g * 100)} % del gasto en Instream, Threads o Explore`,
        que: `${Mk(deb)} en placements que casi no generan reacciones.`, hacer: 'Excluir Instream, Threads y Explore de los conjuntos',
        porque: 'En Interacción esos placements dan entre 0,01 y 0,57 veces las reacciones del mismo contenido en Feed o Reels.' });
    }
    const stories = c.porPl ? c.porPl.filter((p) => /Stories/.test(p.k)).reduce((s, p) => s + p.g, 0) / c.m.g : 0;
    if (c.obj === 'Alcance' && c.porPl && c.m.g > 500000 && !COM_GENERICA.test(c.nombre) && stories < 0.5) {
      const fbr = (c.porPl.find((p) => p.k === 'Facebook Reels') || { g: 0 }).g / c.m.g;
      if (fbr < 0.05) nuevo(c, { tipo: 'Sumar Facebook Reels', prioridad: 2,
        titulo: `${c.nombre} casi no sale por Facebook Reels`, que: `${Math.round(fbr * 100)} % del gasto en Facebook Reels.`,
        hacer: 'Habilitar Facebook Reels en los conjuntos', porque: 'En Alcance, el mismo contenido saca 1,8 veces más reacciones en Facebook Reels al mismo CPM.' });
    }
    const vivos = (c.contenidos || []).filter((x) => dias(x.hasta, datosHasta) <= 2);
    const fatigados = vivos.filter((x) => FATIGA_DIAS[x.fmt] && dias(x.desde, datosHasta) > FATIGA_DIAS[x.fmt] && x.g > 30000);
    if (fatigados.length) fatigas.push({ c, fatigados });
    // retención: videos que se abandonan antes del 25 %
    const bv = bandaVideo(c.obj);
    const abandonan = vivos.filter((x) => x.fmt === 'Video' && x.vw >= 20000 && x.g >= 50000 && bv.ret25 && x.v25 / x.vw * 100 < bv.ret25 * 0.8);
    if (abandonan.length) nuevo(c, { tipo: 'Se abandona temprano', prioridad: 1.8, piezas: abandonan.slice(0, 3).map((x) => pz(x, 'Se abandona')),
      titulo: abandonan.length === 1 ? `“${corto(abandonan[0].nombre, 70)}” se abandona temprano` : `${c.nombre}: ${abandonan.length} videos se abandonan temprano`,
      que: abandonan.slice(0, 3).map((x) => `${abandonan.length > 1 ? `“${corto(x.nombre, 40)}”: ` : ''}${pctTxt(x.v25 / x.vw * 100)} llega al 25 %`).join(' · ') + ` (lo normal en ${c.obj} es ${pctTxt(bv.ret25p50)}).`,
      hacer: 'Revisar los primeros segundos de la pieza: gancho, texto en pantalla, subtítulos',
      porque: 'En Alcance, los videos que se ven completos también juntan más reacciones (correlación 0,59): la retención mide la calidad de la pieza.' });
    const utiles = vivos.filter((y) => y.r >= 300 && !/^Sin C[oó]digo/i.test(y.nombre));
    const comp = utiles.map((x) => ({ x, v: x.sh / x.r * 100 })).filter((z) => z.v >= 10.2).sort((a, b) => b.v - a.v);
    if (comp.length) nuevo(c, { tipo: 'Se comparte', prioridad: 2, piezas: comp.slice(0, 3).map((z) => pz(z.x, 'Se comparte')),
      titulo: comp.length === 1 ? `“${corto(comp[0].x.nombre, 70)}” se comparte mucho` : `${c.nombre}: ${comp.length} contenidos se comparten mucho`,
      que: comp.slice(0, 3).map((z) => `${comp.length > 1 ? `“${corto(z.x.nombre, 45)}”: ` : ''}${z.v.toFixed(0)} compartidas cada 100 reacciones`).join(' · ') + ' (el 10 % más compartido pasa de 10).',
      hacer: 'Subir 20 % el presupuesto diario mientras siga compartiéndose',
      porque: 'Lo que más se comparte es información útil: la difusión orgánica abarata el resultado.' });
    for (const z of utiles.map((x) => ({ x, v: x.co / x.r * 100 })).filter((z) => z.v >= 13.4)) {
      nuevo(c, { tipo: 'Genera conversación', sub: z.x.k, prioridad: 2, piezas: [pz(z.x, 'Genera conversación')], titulo: `“${corto(z.x.nombre, 70)}” genera mucha conversación`,
        que: `${z.v.toFixed(0)} comentarios cada 100 reacciones (el 10 % más comentado pasa de 13).`, hacer: 'Leer los comentarios y decidir si seguir, moderar o pausar',
        porque: 'En el último año este nivel aparece con temas en conflicto: paritarias, jubilaciones, polémica política.' });
    }
  }
  if (fatigas.length) {
    const total = fatigas.reduce((s, f) => s + f.fatigados.length, 0);
    fatigas.sort((a, b) => b.fatigados.length - a.fatigados.length);
    acciones.push({ id: 'rot-' + hashId(P.id + canal + 'fatiga'), tipo: 'Rotar contenidos', camp: null, via: 'manual', prioridad: 1.5, impacto: fatigas.reduce((s, f) => s + f.c.g7, 0),
      titulo: `${total} contenidos en ${fatigas.length} campañas pasaron su umbral de fatiga`,
      que: fatigas.slice(0, 4).map((f) => `${f.c.nombre} (${f.fatigados.length})`).join(' · ') + (fatigas.length > 4 ? '…' : ''),
      hacer: 'Pedir piezas nuevas para las campañas que siguen más de una semana', campanas: fatigas.map((f) => f.c.id), piezas: fatigas.flatMap((f) => f.fatigados).slice(0, 3).map((x) => pz(x, 'Fatigada')),
      porque: 'La mitad de los contenidos fatiga entre el día 12 y el 15: la tasa de reacción cae 45 % contra su primera semana.' });
  }
  for (const c of campanas.filter((y) => y.estado === 'Sin entrega' && dias(y.hasta, datosHasta) <= 10 && !deJuegos(y))) {
    nuevo(c, { tipo: 'Sin entrega', prioridad: 2.5, titulo: `${c.nombre} dejó de gastar y sigue vigente`,
      que: `Último gasto el ${dmy(c.hasta)}; termina el ${dmy(c.fin)}.`,
      hacer: 'Revisar si hay anuncios rechazados, en revisión o sin presupuesto', porque: 'Una campaña vigente sin gasto pierde los primeros días, que son los más baratos.' });
  }
}

// ---------- Solapamiento de audiencias (spec 7.8) ----------
// Decisión de Juan Pablo (30/09): "Solo marcar que solapan público". Es una MARCA, no una recomendación: no propone acción ni
// entra a la bandeja. Todavía NO está conectada al armado.
// Dato que usa: el texto de la columna Audiencia de DataJunta de cada conjunto de anuncios (fuente.conjuntos). No hay
// segmentación real de Meta (ubicaciones, radios, exclusiones): se interpreta el nombre que cargó el equipo, así que es aproximado.
// Qué marca, dentro de UNA campaña de la app (misma comunicación, canal y cliente) y solo entre conjuntos vivos:
//   'misma zona'  → dos audiencias con distinto nombre que apuntan al mismo lugar ("Geo | Provincia Corrientes" y "Corrientes prov").
//   'contenida'   → una zona dentro de la otra ("Provincia Santa Fe" y "Ciudad Rosario").
//   'se cruzan'   → dos listas de lugares que comparten alguno ("Rawson, Trelew…" y "Trelew, Rawson, Playa Unión…").
// Qué NO marca: la misma audiencia usada en varios conjuntos (es como se arma: un conjunto por contenido y por placement);
// audiencias sin geografía legible (códigos, Army, bases, intereses, lookalikes); una zona que figura en la exclusión de la otra
// ("Toda la provincia excluyendo Resistencia" no se pisa con "Ciudad Resistencia"); rangos de edad que no se tocan.
const PROVINCIA_DE = { 'Gobierno de Santa Fe': 'santa fe', 'Gobierno del Chaco': 'chaco', 'Gobierno del Chubut': 'chubut', 'Gobierno de Corrientes': 'corrientes',
  'Catamarca Provincia': 'catamarca', 'Catamarca Ciudad': 'catamarca', 'Gobierno de Córdoba': 'cordoba' };
// Catamarca Ciudad: su "todo" es la capital (San Fernando del Valle)
const TODO_CIUDAD = { 'Catamarca Ciudad': /^(capital|ciudad sfvc|sfvc|san fernando del valle( de catamarca)?)$/ };
const PROVINCIAS_AR = ['buenos aires', 'pba', 'caba', 'ciudad autonoma de buenos aires', 'autonoma de buenos aires', 'catamarca', 'chaco', 'chubut', 'cordoba', 'corrientes', 'entre rios', 'formosa',
  'jujuy', 'la pampa', 'la rioja', 'mendoza', 'misiones', 'neuquen', 'rio negro', 'salta', 'san juan', 'san luis', 'santa cruz', 'santa fe', 'santiago del estero',
  'tierra del fuego', 'tucuman'];
const SIN_GEO = /army|lookalike|base de votantes|inscriptos|intereses de plataforma|ciudadanos que|trabajadores|padres de|jubilad|^otra:|^\(sin audiencia\)$|rango etario de plataforma|^au_/;
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Interpreta el texto de una audiencia. Devuelve { todo, lugares, excluye, capital, edades, sinGeo }.
function leerAudiencia(texto, cliente) {
  const crudo = String(texto || '').trim();
  const out = { texto: crudo, todo: false, lugares: [], excluye: [], capital: false, edades: null, sinGeo: false };
  // códigos de públicos guardados (VEJQQJP, 2609, AEN122XXXX/JEN167XXXX): no se sabe qué zona son
  let s = sinTildes(crudo);
  if (PROVINCIAS_AR.includes(s) && s !== PROVINCIA_DE[cliente]) { out.lugares = [s]; return out; }   // "CABA", "Córdoba", "Santa Fe" sueltos (otra provincia)
  // barrios, cuadrantes y seccionales de la capital
  if (/^(barrio|cuadrante|\d{3} - seccional)/.test(s) || /seccional|cuadrante/.test(s)) out.enCapital = true;
  if (!crudo || /^[A-Z0-9_/]{4,}$/.test(crudo.replace(/\s/g, ''))) { out.sinGeo = true; return out; }
  if (SIN_GEO.test(s)) { out.sinGeo = true; return out; }
  // rango de edad ("30 a 65 años", "30-60 años", "17 y 18")
  const ed = s.match(/(\d{2})\s*(?:a|-|y)\s*(\d{2})(?:\s*anos)?/);
  if (ed && /ano|etario/.test(s)) out.edades = [Number(ed[1]), Number(ed[2])];
  s = s.replace(/rango etario[^-/]*?(\d{2})\s*(?:a|-|y)\s*(\d{2})/, '').replace(/\/?\s*\d{2}\s*(a|-)\s*\d{2}\s*anos/g, '');
  // paréntesis: "(Open a toda la provincia)" es la provincia; "(Pin 1km…)" se descarta; el resto son más lugares
  s = s.replace(/\((pin|open)[^)]*\)/g, (m) => (/open/.test(m) ? ' toda la provincia ' : ' ')).replace(/\(([^)]*)\)/g, ', $1').replace(/\s+/g, ' ').trim();
  if (/\/\s*int|^int(ereses?)? [^|]*\||\scon (interes|au_)/.test(s)) out.recorte = true;
  // filtros de interés después de "/" ("Córdoba Capital/Int en Seguridad") o antes de "|" ("Int Seguridad | Corrientes Provincia")
  s = s.replace(/\/\s*int(ereses?)?\b.*$/, '').replace(/^int(ereses?)? [^|]*\|\s*/, '').replace(/\s*\/\s*/g, ', ').replace(/ con (interes|au_).*$/, '').trim();
  // exclusiones
  const ex = s.match(/(?:excluyendo|excepto|sin|menos)\s+(.+)$/);
  if (ex) { out.excluye = partir(ex[1]); s = s.slice(0, ex.index).trim(); }
  s = s.replace(/^geo\s*(\||-)?\s*toda la provincia/, 'toda la provincia');
  s = s.replace(/^.*-\s*geo\s+/, '').replace(/^geo\s*\|?\s*/, '').replace(/^(personas )?residentes (en |de )?(la )?(ciudad de )?/, '').replace(/^open /, 'provincia ')
    .replace(/^[^:]{0,80}:\s*/, '').replace(/^barrios que se suman al cuadrante \d+\s*/, '').replace(/\b(gral|n|dr|pte)\.\s*/g, '$1 ').trim();
  const prov = PROVINCIA_DE[cliente];
  if (TODO_CIUDAD[cliente] && TODO_CIUDAD[cliente].test(s.replace(/^(geo \| |muni \| )/, ''))) { out.todo = true; return out; }
  if (!TODO_CIUDAD[cliente] && (/toda la provincia/.test(s) || new RegExp(`^(provincia (de |del )?${prov}|${prov} (prov|provincia)|${prov})$`).test(s))) { out.todo = true; return out; }
  // capital de la provincia (Córdoba Capital, Capital Corrientes, Ciudad de Corrientes…) y todos los cuadrantes de Córdoba
  const capital = /^todos los cuadr?antes$/.test(s) || new RegExp(`^(ciudad (de )?)?(${prov} capital|capital ${prov}|capital|ciudad de ${prov})$`).test(s);
  if (capital && !TODO_CIUDAD[cliente]) { out.capital = true; return out; }
  out.lugares = partir(s);
  if (out.enCapital && !out.lugares.length) out.lugares = [s];   // "Cuadrante 6"
  // una lista de provincias que incluye la del cliente la contiene entera
  if (out.lugares.includes(prov) && /provincias?/.test(s)) out.todo = true;
  if (!out.lugares.length && !out.todo) out.sinGeo = true;
  return out;
}
function partir(s) {
  return String(s).split(/\s*(?:,|;|\.\s|\.$|\||\s-\s|-\s|\s[—–]\s|\sy\s|\se\s|:)\s*/)
    .map((t) => t.replace(/^(y|en|de|del|los|las)\s+/, '').replace(/^(ciudad(es)?|barrio|departamentos?|deptos?|muni(cipio)?s?|localidad(es)?|provincias?|geo|zona|cuadrante|seccional)\b\s*(de\s+|del\s+)?:?\s*/, '')
      .replace(/^(de|del)\s+/, '').replace(/\s*total\s*\d+.*$/, '').replace(/\s+y mas$/, '').trim())
    .filter((t) => (t.length >= 4 || PROVINCIAS_AR.includes(t)) && !/^\d+$/.test(t) && !/comunicacion|institucional/.test(t));
}
// ¿el lugar t aparece en la lista (o en el texto crudo de la otra audiencia, para listas separadas solo con espacios)?
const nombra = (t, a) => a.lugares.some((u) => u === t || (` ${u} `).includes(` ${t} `) || (` ${t} `).includes(` ${u} `));
// "Capital" en una lista es la ciudad capital de la provincia (en Chaco, "excluyendo Resistencia" deja afuera "Capital y Gran Resistencia")
const CAPITAL_DE = { chaco: 'resistencia', 'santa fe': 'santa fe', corrientes: 'corrientes', chubut: 'rawson', catamarca: 'san fernando del valle', cordoba: 'cordoba' };
const excluido = (b, a, prov) => {
  const cap = (t) => (/^capital\b/.test(t) ? CAPITAL_DE[prov] || t : t);
  return b.lugares.length && b.lugares.every((t0) => { const t = cap(t0); return a.excluye.some((x0) => { const x = cap(x0); return (` ${t} `).includes(` ${x} `) || (` ${x} `).includes(` ${t} `); }); });
};
const fueraDeProvincia = (a, prov) => a.lugares.length && a.lugares.every((t) => PROVINCIAS_AR.includes(t) && t !== prov);

// Misma zona: si solo una recorta el público (edad o interés), queda dentro de la otra
const recortaPublico = (x) => !!(x.recorte || x.edades);
const igual = (a, b) => (recortaPublico(a) === recortaPublico(b) ? 'misma zona' : { tipo: 'contenida', grande: recortaPublico(a) ? b : a });
// Compara dos audiencias ya leídas. Devuelve null o 'misma zona' | 'contenida' | 'se cruzan' (en 'contenida', la primera es la grande).
function comparar(a, b, prov) {
  if (a.sinGeo || b.sinGeo) return null;
  if (a.edades && b.edades && (a.edades[1] < b.edades[0] || b.edades[1] < a.edades[0])) return null;
  // las dos son "toda la provincia": iguales si ninguna recorta (exclusión o edad); si una recorta, la otra la contiene
  if (a.todo && b.todo) {
    const recorta = (x) => x.excluye.length > 0 || recortaPublico(x);
    if (!recorta(a) && !recorta(b)) return 'misma zona';
    if (!recorta(a)) return { tipo: 'contenida', grande: a };
    if (!recorta(b)) return { tipo: 'contenida', grande: b };
    return 'se cruzan';
  }
  for (const [x, y] of [[a, b], [b, a]]) {
    if (x.todo && !y.todo && !fueraDeProvincia(y, prov)) {
      if (x.excluye.length && (excluido(y, x, prov) || (y.capital && x.excluye.some((e) => /capital/.test(e) || e === CAPITAL_DE[prov])))) return null;
      return { tipo: 'contenida', grande: x };
    }
  }
  if (a.capital && b.capital) return igual(a, b);
  for (const [x, y] of [[a, b], [b, a]]) if (x.capital && y.enCapital) return { tipo: 'contenida', grande: x };
  // "Capital" suelta contra una lista de departamentos que incluye "Capital"
  for (const [x, y] of [[a, b], [b, a]]) if (x.capital && y.lugares.some((t) => /^capital\b/.test(t))) return y.lugares.length > 1 ? { tipo: 'contenida', grande: y } : 'misma zona';
  if (!a.lugares.length || !b.lugares.length) return null;
  const comunes = a.lugares.filter((t) => nombra(t, b));
  if (!comunes.length) return null;
  const clave = (x) => [...x.lugares].sort().join('|');
  if (clave(a) === clave(b)) return igual(a, b);
  const aEnB = comunes.length === a.lugares.length, bEnA = b.lugares.every((t) => nombra(t, a));
  // si cada una nombra a la otra ("Villa Allende" y "Villa Allende Parque"), la de nombre más corto es la zona grande
  if (aEnB && bEnA) return { tipo: 'contenida', grande: clave(a).length <= clave(b).length ? a : b };
  if (aEnB) return { tipo: 'contenida', grande: b };
  if (bEnA) return { tipo: 'contenida', grande: a };
  return 'se cruzan';
}

// Recibe los conjuntos de UNA campaña de la app (filas de fuente.conjuntos con el mismo canal, cliente y comunicación; puede
// venir con varios meses) y devuelve la lista de pares que se pisan, solo entre conjuntos vivos (último gasto a 2 días o menos).
// Cada par: { tipo, a: { audiencia, conjuntos, contenidos, gasto14 }, b: {…}, mismoContenido, texto }. En 'contenida', a es la zona grande.
function solapamientoAudiencias(conjuntos, { cliente, datosHasta, diasVivo = 2 } = {}) {
  const prov = PROVINCIA_DE[cliente];
  if (!prov || !conjuntos || !conjuntos.length) return [];
  const vivo = (r) => r.hasta && (new Date(datosHasta) - new Date(r.hasta)) / 864e5 <= diasVivo;
  const porAud = new Map();
  for (const r of conjuntos.filter(vivo)) {
    const k = sinTildes(r.audiencia);
    const g = porAud.get(k) || { audiencia: String(r.audiencia || '').trim(), conjuntos: new Set(), contenidos: new Set(), gasto14: 0 };
    g.conjuntos.add(r.conjunto); g.contenidos.add(r.cod); g.gasto14 += Number(r.g14) || 0;
    porAud.set(k, g);
  }
  const grupos = [...porAud.values()].map((g) => ({ ...g, leida: leerAudiencia(g.audiencia, cliente) }));
  const salida = [];
  const lado = (g) => ({ audiencia: g.audiencia, conjuntos: [...g.conjuntos], contenidos: [...g.contenidos], gasto14: Math.round(g.gasto14) });
  for (let i = 0; i < grupos.length; i++) for (let j = i + 1; j < grupos.length; j++) {
    const r = comparar(grupos[i].leida, grupos[j].leida, prov);
    if (!r) continue;
    const tipo = typeof r === 'string' ? r : r.tipo;
    const [A, B] = tipo === 'contenida' && r.grande === grupos[j].leida ? [grupos[j], grupos[i]] : [grupos[i], grupos[j]];
    const texto = tipo === 'misma zona' ? `Posible solapamiento: “${A.audiencia}” y “${B.audiencia}” apuntan a la misma zona.`
      : tipo === 'contenida' ? `Posible solapamiento: “${B.audiencia}” está dentro de “${A.audiencia}”.`
        : `Posible solapamiento: “${A.audiencia}” y “${B.audiencia}” se superponen en parte.`;
    salida.push({ tipo, a: lado(A), b: lado(B), mismoContenido: [...A.contenidos].some((c) => B.contenidos.has(c)), texto });
  }
  return salida;
}

module.exports = reglasMeta;
module.exports.solapamientoAudiencias = solapamientoAudiencias;
module.exports.leerAudiencia = leerAudiencia;
module.exports.PLACEMENTS_DEBILES = PLACEMENTS_DEBILES;
module.exports.FATIGA_DIAS = FATIGA_DIAS;
module.exports.PRESION_CAMPANA = PRESION_CAMPANA;
