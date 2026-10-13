// Rendimiento por pieza para Creatividades (pedido 040, contrato orquestacion/CONTRATOS/creatividades-seguimiento.md).
// Lee borrador/_proyectos.json (lo que ya bajó _extraer.js; no consulta BigQuery) y escribe salidas/rendimiento-piezas.json.
//
//   node salidas/rendimiento-piezas.js            (desde Seguimiento/, después de cada extracción diaria)
//   node salidas/rendimiento-piezas.js --entrada=_proyectos.nuevo.json   (lee otro archivo de borrador/, p. ej. antes de reemplazarlo)
//
// Una fila por código de pieza × mes × placement × canal × plataforma × objetivo × eje.
//   - Meta: bloque `cruce` (desde desdeCruce, hoy 01/01/2026). Placement = el de DataJunta (Facebook Feed, Instagram Reels…).
//   - Otras plataformas (Google Ads, DV360, TikTok, SMS): bloque `todas` (por día, 180 días), cortado en el último día completo.
//     Placement = la red de DataJunta (YouTube, Display Network, DV360, Tik Tok…). Sin marca (los cuartiles son solo de Meta); decil con su propia referencia por plataforma.
// El objetivo va en la clave porque un mismo código puede pautarse con dos objetivos en el mismo mes y placement (~5 % de los casos)
// y la marca depende del objetivo. El eje también (desde el 5/10/2026, decisión de Juan Pablo): hay piezas que salen legítimamente en
// dos o más ejes, y Creatividades cuenta cada pieza en cada eje con su gasto.
// Marca Bueno / Normal / Malo: app/marcas.js (no se modifica), con las mismas filas que arma borrador/armar.js para la app.
// Nunca alcance: no se lee ni se suma (regla de Juan Pablo del 2/10). Sin links, ids de cuenta ni mails.
const fs = require('fs');
const path = require('path');
const M = require('../app/marcas.js');

const RAIZ = path.join(__dirname, '..');
const ARG_ENTRADA = process.argv.find((a) => a.startsWith('--entrada='));
const ENTRADA = ARG_ENTRADA ? ARG_ENTRADA.slice('--entrada='.length) : '_proyectos.json';
if (!/^[\w.-]+\.json$/.test(ENTRADA)) throw new Error(`Entrada inválida: "${ENTRADA}" (solo un nombre de archivo .json de borrador/).`);
const fuente = require(path.join(RAIZ, 'borrador', ENTRADA));
// --salida=RUTA: escribir en otro archivo (actualizar.js arma ahí y después lo cambia de forma atómica).
const ARG_SALIDA = process.argv.find((a) => a.startsWith('--salida='));
const SALIDA = ARG_SALIDA ? path.resolve(ARG_SALIDA.slice('--salida='.length)) : path.join(__dirname, 'rendimiento-piezas.json');

const num = (x) => Number(x) || 0;
const r2 = (x) => (x == null || !isFinite(x) ? null : Math.round(x * 100) / 100);
const r4 = (x) => (x == null || !isFinite(x) ? null : Math.round(x * 1e4) / 1e4);

// ---------- mismas normalizaciones que borrador/armar.js (copiadas: ese archivo escribe el borrador al cargarse) ----------
const OBJ = { OUTCOME_TRAFFIC: 'Tráfico', OUTCOME_ENGAGEMENT: 'Interacción', OUTCOME_AWARENESS: 'Alcance' };
const objetivo = (o) => OBJ[o] || o || 'Sin objetivo';
function normFormato(f) {
  const u = String(f || '').toLowerCase();
  if (/video|vídeo|spot|reel/.test(u) || ['vid', 'bumper', 'yt shorts', 'testimonio', 'testimonios'].includes(u)) return 'Video';
  if (/carrusel|carousel/.test(u)) return 'Carrusel';
  if (/placa|plca|palca|flyer|imagen|banner|foto/.test(u) || ['pf', 'display'].includes(u)) return 'Placa Fija';
  if (/stor/.test(u)) return 'Stories';
  return ['', '(null)', 'nan', 'none', 'sin formato'].includes(u) ? '(sin formato)' : '(otro)';
}
function formato(raw, contenido) {
  const f = normFormato(raw);
  if (f === '(sin formato)' || f === '(otro)') {
    for (const m of String(contenido || '').matchAll(/\(([^()]*)\)/g)) {
      const g = normFormato(m[1]);
      if (g !== '(sin formato)' && g !== '(otro)') return g;
    }
  }
  return f;
}
const PLS = ['Facebook Feed', 'Instagram Feed', 'Instagram Reels', 'Facebook Reels', 'Instagram Stories', 'Facebook Stories', 'Facebook Instream Video', 'Threads Feed'];
const pgrp = (p) => (PLS.includes(p) ? p : /^Instagram Explore/.test(p) ? 'Instagram Explore' : 'Otros');

// último día completo (mismo criterio que borrador/armar.js: el día de hoy viene casi vacío)
const datosHasta = (() => {
  const tot = {};
  for (const r of fuente.plataformas || fuente.diaria) tot[r.fecha] = (tot[r.fecha] || 0) + num(r.gasto);
  const ds = Object.keys(tot).sort();
  const prev = ds.slice(-8, -1).map((f) => tot[f]).sort((a, b) => a - b);
  const med = prev.length ? prev[Math.floor(prev.length / 2)] : 0;
  return tot[ds[ds.length - 1]] < med * 0.3 ? ds[ds.length - 2] : ds[ds.length - 1];
})();

// ---------- marcas: las filas del cruce con la forma de B.filas (como app/armar.js) ----------
const filasMarcas = fuente.cruce.map((r) => {
  const fmt = formato(r.formato_raw, r.contenido), esVideo = fmt === 'Video';
  return { canal: r.canal, cli: r.cliente, mes: r.mes, cod: r.cod || r.contenido, fmt, obj: objetivo(r.objetivo), pl: pgrp(r.placement),
    g: num(r.gasto), i: num(r.imp), r: num(r.rea), c: num(r.clk), e: num(r.eng), sh: num(r.sha), vw: esVideo ? num(r.vw) : 0 };
});
const MARCAS = M.crearMarcas(filasMarcas);

// ---------- agrupar ----------
const SUMAS = ['impresiones', 'gasto', 'reacciones', 'clicks', 'engagement', 'compartidos', 'comentarios', 'reproducciones', 'v25', 'v50', 'v75', 'v100'];
const grupos = new Map();
// Código de pieza válido: solo letras y números, 8 a 20 caracteres (los de PAUTADOR tienen 14, p. ej. GSFOFIBGU00204). DataJunta pone
// a veces en Codigo_Contenido el comienzo del nombre del anuncio ("CBACOR - Córdo", un link…): esas filas cuentan como sin código.
const CODIGO_OK = /^[A-Z0-9]{8,20}$/;
const sinCodigo = { meta: 0, otras: 0, meta_codigo_invalido: 0, otras_codigo_invalido: 0, gasto_excluido: 0 };
function sumar(k, base, met, desde, hasta, extra) {
  let o = grupos.get(k);
  if (!o) {
    o = { ...base, activos: new Set(), comunicaciones: new Set(), ejes: new Set(), formatos: new Set(), fecha_desde: null, fecha_hasta: null, _filas: [] };
    for (const s of SUMAS) o[s] = 0;
    grupos.set(k, o);
  }
  for (const s of SUMAS) if (met[s] != null) o[s] += met[s];
  for (const [campo, v] of [['activos', extra.activo], ['comunicaciones', extra.comunic], ['ejes', extra.eje], ['formatos', extra.formato]]) if (v) o[campo].add(v);
  if (desde && (!o.fecha_desde || desde < o.fecha_desde)) o.fecha_desde = desde;
  if (hasta && (!o.fecha_hasta || hasta > o.fecha_hasta)) o.fecha_hasta = hasta;
  return o;
}

// Meta (cruce: mes × activo × comunicación × contenido × audiencia × placement)
fuente.cruce.forEach((r, idx) => {
  if (!r.cod) { sinCodigo.meta++; sinCodigo.gasto_excluido += num(r.gasto); return; }
  if (!CODIGO_OK.test(r.cod)) { sinCodigo.meta_codigo_invalido++; sinCodigo.gasto_excluido += num(r.gasto); return; }
  const obj = objetivo(r.objetivo);
  const eje = r.eje || null;
  const k = ['Meta', r.canal, r.cod, r.mes, r.placement, obj, eje].join('|');
  const o = sumar(k, { codigo_pieza: r.cod, mes: r.mes, proyecto: r.cliente, cliente: r.cliente, canal: r.canal, plataforma: 'Meta',
    placement: r.placement, placement_grupo: pgrp(r.placement), objetivo: obj, eje, formato_grupo: filasMarcas[idx].fmt },
  { impresiones: num(r.imp), gasto: num(r.gasto), reacciones: num(r.rea), clicks: num(r.clk), engagement: num(r.eng), compartidos: num(r.sha),
    comentarios: num(r.com), reproducciones: num(r.vw), v25: num(r.v25), v50: num(r.v50), v75: num(r.v75), v100: num(r.v100) },
  r.desde, r.hasta, { activo: r.activo, comunic: r.comunic, eje: r.eje, formato: r.formato_raw });
  o._filas.push(filasMarcas[idx]);
});

// ---------- decil fuera de Meta (07/10, aprobado por Juan Pablo y validado por Métricas; DEFINICION-REPRODUCCION.md de Extracción) ----------
// Cada plataforma se compara solo consigo misma, dentro del canal: celda proyecto × canal × plataforma × red × objetivo y, si no llega a 12
// piezas con 1.000 impresiones, toda la plataforma en el canal (todos los proyectos). Ventana: los 180 días del bloque todas.
//   Views → costo por reproducción (Gasto / Views; en cada plataforma Views mide otra cosa: el rótulo lo dice). Alcance → CPM. El resto
//   (Tráfico, Conversión, clicks…) sin decil. YouTube: sin anuncios de audio ni filas sin vistas. Red Display de Google: solo video con
//   vistas, con su propia referencia. TikTok: Gasto / Views = inicio de reproducción, con costo_25 y costo_100 al lado. DV360 y SMS: sin decil.
const AUDIO = /audio/i;
function reglaDecil(plataforma, red, obj) {
  if (plataforma === 'Google Ads' && red === 'YouTube') return obj === 'Views' ? { kpi: 'cv', rotulo: 'Costo por vista de YouTube', soloVistas: true, sinAudio: true } : obj === 'Alcance' ? { kpi: 'cpm', rotulo: 'CPM', sinAudio: true } : null;
  if (plataforma === 'Google Ads' && red === 'Display Network') return obj === 'Views' ? { kpi: 'cv', rotulo: 'Costo por vista de la Red Display de Google', soloVistas: true, sinAudio: true } : obj === 'Alcance' ? { kpi: 'cpm', rotulo: 'CPM', sinAudio: true } : null;
  if (plataforma === 'TikTok Ads') return obj === 'Views' ? { kpi: 'cv', rotulo: 'Costo por inicio de reproducción (TikTok)', soloVistas: true } : obj === 'Alcance' ? { kpi: 'cpm', rotulo: 'CPM' } : null;
  return null;   // DV360 (no trae vistas), SMS, Search, Gmail, Discover…
}
const entraDecil = (regla, r) => !!regla && !(regla.sinAudio && (AUDIO.test(r.formato_raw || '') || AUDIO.test(r.contenido || ''))) && !(regla.soloVistas && !(num(r.vw) > 0));
const valorDecil = (kpi, x) => (kpi === 'cv' ? (x.vw > 0 ? x.g / x.vw : null) : x.i > 0 ? x.g / x.i * 1000 : null);
const unidadesOtras = new Map();   // pieza × celda en los 180 días: la referencia
const ROTULO_META = { cr: 'Costo por reacción', cpm: 'CPM', ctr: 'CTR', cv: 'Costo por vista de 3 s (Meta)', etrV: 'ETR Videos', etrI: 'ETR Imágenes' };
const CALCULADO_EL = new Date().toISOString().slice(0, 10);

// Otras plataformas (todas: por día; Meta ya viene del cruce)
let desdeOtras = null;
for (const r of fuente.todas || []) {
  if (r.plataforma === 'META' || r.fecha > datosHasta) continue;
  if (!r.cod) { sinCodigo.otras++; sinCodigo.gasto_excluido += num(r.gasto); continue; }
  if (!CODIGO_OK.test(r.cod)) { sinCodigo.otras_codigo_invalido++; sinCodigo.gasto_excluido += num(r.gasto); continue; }
  if (!desdeOtras || r.fecha < desdeOtras) desdeOtras = r.fecha;
  const obj = objetivo(r.objetivo), mes = r.fecha.slice(0, 7), pl = r.red || '(sin red)';
  const eje = r.eje || null;
  const k = [r.plataforma, r.canal, r.cod, mes, pl, obj, eje].join('|');
  const conGasto = num(r.gasto) > 0;
  const o = sumar(k, { codigo_pieza: r.cod, mes, proyecto: r.cliente, cliente: r.cliente, canal: r.canal, plataforma: r.plataforma,
    placement: pl, placement_grupo: null, objetivo: obj, eje, formato_grupo: formato(r.formato_raw, r.contenido) },
  { impresiones: num(r.imp), gasto: num(r.gasto), reacciones: num(r.rea), clicks: num(r.clk), engagement: num(r.eng), compartidos: num(r.sha),
    comentarios: num(r.com), reproducciones: num(r.vw), v25: num(r.v25), v50: null, v75: null, v100: num(r.v100) },
  conGasto ? r.fecha : null, conGasto ? r.fecha : null, { activo: r.activo, comunic: r.comunic, eje: r.eje, formato: r.formato_raw });
  // decil: solo las filas que cuentan para su KPI (sin audio, con vistas si hace falta)
  const regla = reglaDecil(r.plataforma, pl, obj);
  if (regla && entraDecil(regla, r)) {
    const el = o._el = o._el || { g: 0, i: 0, vw: 0 }; el.g += num(r.gasto); el.i += num(r.imp); el.vw += num(r.vw);
    const ku = [r.canal, r.cliente, r.plataforma, pl, obj, r.cod].join('|');
    const u = unidadesOtras.get(ku) || { canal: r.canal, cli: r.cliente, plat: r.plataforma, red: pl, obj, kpi: regla.kpi, g: 0, i: 0, vw: 0 };
    u.g += num(r.gasto); u.i += num(r.imp); u.vw += num(r.vw); unidadesOtras.set(ku, u);
  }
}
const celdaProy = (x) => [x.canal, x.cli, x.plat, x.red, x.obj, x.kpi].join('|'), celdaPlat = (x) => [x.canal, x.plat, x.red, x.obj, x.kpi].join('|');
const DECILES_OTRAS = M.tablaDeciles([...unidadesOtras.values()].map((u) => ({ claves: [celdaProy(u), celdaPlat(u)], valor: valorDecil(u.kpi, u), i: u.i })));

// ---------- filas de salida ----------
const unir = (s) => [...s].sort().join(' | ') || null;
const filas = [];
for (const o of grupos.values()) {
  const esMeta = o.plataforma === 'Meta';
  const f = {
    codigo_pieza: o.codigo_pieza, mes: o.mes, proyecto: o.proyecto, cliente: o.cliente, canal: o.canal, plataforma: o.plataforma,
    placement: o.placement, placement_grupo: o.placement_grupo, objetivo: o.objetivo,
    formato: unir(o.formatos), formato_grupo: o.formato_grupo, eje: o.eje, activos: [...o.activos].sort(), comunicacion: unir(o.comunicaciones),
    fecha_desde: o.fecha_desde, fecha_hasta: o.fecha_hasta,
    impresiones: Math.round(o.impresiones), gasto: r2(o.gasto), reacciones: Math.round(o.reacciones), clicks: Math.round(o.clicks),
    engagement: Math.round(o.engagement), compartidos: Math.round(o.compartidos), comentarios: Math.round(o.comentarios),
    reproducciones: Math.round(o.reproducciones), v25: Math.round(o.v25),
    v50: esMeta ? Math.round(o.v50) : null, v75: esMeta ? Math.round(o.v75) : null, v100: Math.round(o.v100),
    cpm: o.impresiones > 0 ? r2(o.gasto / o.impresiones * 1000) : null,
    ctr: o.impresiones > 0 ? r4(o.clicks / o.impresiones * 100) : null,
    costo_por_reaccion: o.reacciones > 0 ? r2(o.gasto / o.reacciones) : null,
    etr: o.impresiones > 0 ? r4(o.engagement / o.impresiones * 100) : null,
    costo_por_reproduccion: o.reproducciones > 0 ? r4(o.gasto / o.reproducciones) : null,
    kpi_marca: null, marca: 'sin_ref', marca_base: null, n_piezas_referencia: null,
    decil: null, decil_base: null, decil_n: null, decil_kpi: null, decil_calculado_el: CALCULADO_EL,
    costo_25: o.plataforma === 'TikTok Ads' && o.v25 > 0 ? r4(o.gasto / o.v25) : null, costo_100: o.plataforma === 'TikTok Ads' && o.v100 > 0 ? r4(o.gasto / o.v100) : null,
  };
  if (esMeta) {
    const kpi = M.KPI_OBJETIVO[o.objetivo] || null;
    f.kpi_marca = kpi ? M.KPIS[kpi].nombre : null;
    if (kpi) {
      const x = MARCAS.marcarFilas(o._filas, kpi, { proyecto: o.cliente, canal: o.canal });
      f.marca = x.estado || 'sin_ref';
      f.marca_base = x.base || null;
      if (x.base === 'objetivo×placement') { const c = MARCAS.cortes.celdas[kpi][`${o.canal}|${o.cliente}|${o.objetivo}|${o.placement_grupo}`]; f.n_piezas_referencia = c ? c.n : null; }
      else if (x.base === 'objetivo') { const c = MARCAS.cortes.objetivo[kpi][`${o.canal}|${o.cliente}|${o.objetivo}`]; f.n_piezas_referencia = c ? c.n : null; }
      // decil (pedido 053): misma celda y mismo valor que la marca; 1 = el 10 % mejor, 10 = el 10 % peor
      const d = MARCAS.decilFilas(o._filas, kpi, { proyecto: o.cliente, canal: o.canal });
      f.decil = d.decil; f.decil_base = d.decil != null ? d.base : null; f.decil_n = d.decil != null ? d.n : null;
      f.decil_kpi = ROTULO_META[kpi] || M.KPIS[kpi].nombre;
    }
  } else {
    const regla = reglaDecil(o.plataforma, o.placement, o.objetivo);
    if (regla) {
      f.decil_kpi = regla.rotulo;
      const v = o._el ? valorDecil(regla.kpi, o._el) : null;
      const d = DECILES_OTRAS.decil([celdaProy({ canal: o.canal, cli: o.cliente, plat: o.plataforma, red: o.placement, obj: o.objetivo, kpi: regla.kpi }),
        celdaPlat({ canal: o.canal, plat: o.plataforma, red: o.placement, obj: o.objetivo, kpi: regla.kpi })], v, true);
      if (d.decil != null) { f.decil = d.decil; f.decil_base = d.nivel === 0 ? 'proyecto' : 'plataforma'; f.decil_n = d.n; }
      else f.decil_base = 'sin referencia';
    }
  }
  filas.push(f);
}
filas.sort((a, b) => (a.canal + a.proyecto + a.codigo_pieza + a.mes + a.plataforma + a.placement + a.objetivo + (a.eje || '')).localeCompare(b.canal + b.proyecto + b.codigo_pieza + b.mes + b.plataforma + b.placement + b.objetivo + (b.eje || '')));

sinCodigo.gasto_excluido = Math.round(sinCodigo.gasto_excluido);
const porMarca = filas.reduce((m, f) => ((m[f.marca] = (m[f.marca] || 0) + 1), m), {});
const porDecil = filas.reduce((m, f) => ((m[f.decil == null ? 'null' : f.decil] = (m[f.decil == null ? 'null' : f.decil] || 0) + 1), m), {});
const salida = {
  generado_el: new Date().toISOString(),
  datos_hasta: datosHasta,
  desde: { meta: fuente.desdeCruce || null, otras_plataformas: desdeOtras },
  nota: [
    'Una fila por código de pieza × mes × placement × canal × plataforma × objetivo × eje (una pieza en dos ejes da dos filas, cada una con su gasto). proyecto = cliente de DataJunta (el proyecto de la app).',
    'Meta: desde el 01/01/2026, por mes; el mes en curso puede traer el día de hoy incompleto. Otras plataformas: últimos 180 días, cortados en datos_hasta; placement = red (YouTube, Display Network, DV360, Tik Tok…); sin v50/v75 y sin marca (sí decil: ver abajo).',
    'Marca (solo Meta): app/marcas.js. Cuartiles P25/P75 del KPI del objetivo (Alcance: CPM; Interacción: costo por reacción; Tráfico y Conversión: CTR; Reproducciones: costo por reproducción) dentro del proyecto y canal, por objetivo × placement, con 2026; pieza con 1.000 impresiones o más y celda con 12 piezas o más; si no, objetivo solo; si tampoco, sin_ref. Costo por reacción en Stories: sin_ref. La marca compara dentro del proyecto: entre proyectos, usar las métricas.',
    'Decil (solo Meta, pedido 053): 1 = el 10 % mejor y 10 = el 10 % peor de las piezas de la misma celda que la marca (proyecto × canal × objetivo × placement, 2026, 12 piezas o más con 1.000 impresiones o más; si no alcanza, objetivo solo), con el KPI del objetivo (Alcance: CPM; Interacción: costo por reacción sin Stories; Tráfico y Conversión: CTR; Reproducciones o Views: costo por reproducción). En costos, más barato es mejor; en tasas, más alto. La posición se calcula con la misma interpolación que los cuartiles: Bueno = decil 1 a 3 (hasta el 25 %), Malo = decil 8 a 10 (más del 75 %), Normal = decil 3 a 8. decil_base = la celda usada ("objetivo×placement" u "objetivo"); decil_n = cuántas piezas tiene. Sin referencia: decil null.',
    'Decil fuera de Meta (07/10, validado por Métricas): cada plataforma se compara solo consigo misma, dentro del canal. Celda: proyecto × canal × plataforma × red × objetivo, últimos 180 días, 12 piezas o más con 1.000 impresiones o más (decil_base "proyecto"); si no alcanza, toda la plataforma en el canal, todos los proyectos ("plataforma"); si tampoco, decil null y decil_base "sin referencia". KPI: objetivo Views = costo por reproducción (Gasto / Views) y Alcance = CPM; Tráfico, Conversión y el resto, sin decil. YouTube: sin anuncios de audio ni filas sin vistas. Red Display de Google: solo anuncios de video con vistas, con su propia referencia. TikTok: Gasto / Views mide el inicio de la reproducción; costo_25 y costo_100 (Gasto / View_25 y Gasto / View_100) van al lado como dato de atención. DV360 y SMS: sin decil. Más barato = decil 1.',
    'decil_kpi: qué se midió, con su rótulo ("Costo por vista de 3 s (Meta)", "Costo por vista de YouTube", "Costo por vista de la Red Display de Google", "Costo por inicio de reproducción (TikTok)", "CPM", "Costo por reacción", "CTR"); null si la fila no tiene KPI de decil. "Reproducción" no mide lo mismo en cada plataforma: no comparar deciles ni costos por reproducción entre plataformas. decil_calculado_el: fecha del cálculo.',
    'ctr y etr en %, cpm cada mil impresiones, costos en pesos. Sumables: impresiones, gasto, reacciones, clicks, engagement, compartidos, comentarios, reproducciones y v25–v100. Las tasas y costos se recalculan sobre las sumas, nunca se promedian.',
    'Sin alcance: no se suma nunca (ni entre piezas, ni entre cuentas). Sin links, ids de cuenta ni mails. Filas sin código de pieza o con un código que no es código (texto con espacios o guiones, un link): excluidas; filas_sin_codigo cuenta las filas de origen (cruce para Meta, días de todas para el resto) y su gasto.',
  ],
  filas_sin_codigo: sinCodigo,
  resumen: { filas: filas.length, codigos: new Set(filas.map((f) => f.codigo_pieza)).size, por_marca: porMarca, por_decil: porDecil,
    por_plataforma: filas.reduce((m, f) => ((m[f.plataforma] = (m[f.plataforma] || 0) + 1), m), {}) },
  filas,
};
fs.mkdirSync(__dirname, { recursive: true });
fs.writeFileSync(SALIDA, JSON.stringify(salida));
console.log(`rendimiento-piezas.json: ${filas.length} filas, ${salida.resumen.codigos} códigos, datos hasta ${datosHasta}, ${(fs.statSync(SALIDA).size / 1e6).toFixed(1)} MB`);
console.log('por marca', JSON.stringify(porMarca), '| por decil', JSON.stringify(porDecil), '| por plataforma', JSON.stringify(salida.resumen.por_plataforma), '| sin código', JSON.stringify(sinCodigo));
