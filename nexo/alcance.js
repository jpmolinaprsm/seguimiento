// Nexo con PAUTADOR (lado Seguimiento) · camino 1: alcance y frecuencia reales de Meta.
// Contrato: orquestacion/CONTRATOS/lectura-alcance-meta.md, sección "Cómo quedó construido" (manda sobre lo de arriba).
//
// PAUTADOR lee Meta a las 6:00 (hora argentina, ventana hasta las 9:00) y deja, en el dataset `automatizado` de cada canal
// (Informativo en bq-project-450514; Oficial y "Ambos" en prsm-bq-media), dos tablas partidas por `fecha_lectura`:
//   meta_alcance_diario    una fila por nivel · período · lo que se mide (ver NIVELES y PERIODOS_POR_NIVEL)
//   meta_alcance_corridas  una fila por cuenta y día con cómo terminó su lectura: ok / saltada_por_publicacion / frenada / error
// El "sin dato de hoy" sale de las corridas: una cuenta sin fila de corrida hoy, o con estado distinto de ok, no tiene dato hoy.
//
// Quién baja las tablas: Datos, dentro de la extracción de siempre. Este archivo NO consulta BigQuery: recibe las filas ya
// bajadas (de los dos proyectos, juntas), las valida y devuelve, por nivel, el dato de hoy o "sin dato de hoy".
// Nunca devuelve el dato de ayer como si fuera de hoy.
//
// Cliente, contenido y comunicación que están en varias cuentas: PAUTADOR no da un número exacto sino un rango
// (alcance_min = la cuenta más grande, alcance_max = la suma; exacto = false). Se devuelve el rango y la marca `exacto`
// para que Interfaz muestre "entre X e Y personas". Si ese día falta una cuenta del cliente, no hay dato de cliente,
// contenido ni comunicación de ese cliente (PAUTADOR ya no escribe esas filas; acá se vuelve a controlar por las dudas).

const NIVELES = ['cuenta', 'cliente', 'campana', 'conjunto', 'anuncio', 'contenido', 'comunicacion'];
const PERIODOS_POR_NIVEL = {
  cuenta: ['mes_en_curso', 'ultimos_7', 'ultimos_30'],
  cliente: ['mes_en_curso', 'ultimos_7', 'ultimos_30'],
  campana: ['desde_inicio', 'ultimos_7', 'ultimos_30'],
  comunicacion: ['desde_inicio', 'ultimos_7', 'ultimos_30'],
  conjunto: ['desde_inicio', 'ultimos_7'],
  anuncio: ['desde_inicio', 'ultimos_7'],
  contenido: ['desde_inicio', 'ultimos_7'],
};
const NIVELES_DE_CUENTA = ['cuenta', 'campana', 'conjunto', 'anuncio'];      // una sola cuenta, siempre exacto
const NIVELES_ENTRE_CUENTAS = ['cliente', 'contenido', 'comunicacion'];       // pueden juntar varias cuentas (rango)
const CANALES = ['Informativo', 'Oficial', 'Ambos'];                          // "Ambos" solo en nivel cliente
const ESTADOS_CORRIDA = ['ok', 'saltada_por_publicacion', 'frenada', 'error'];
const HORA_LECTURA = 6;            // PAUTADOR arranca a las 6:00 hora argentina
const HORA_LIMITE = 9;             // y tiene hasta las 9:00
const TOLERANCIA_FRECUENCIA = 0.02; // frecuencia = impresiones / alcance, con 2 % de margen por redondeo
const ZONA = 'America/Argentina/Buenos_Aires';
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_CODIGO = /^[A-Z0-9]{14}$/;

const MOTIVO_CORRIDA = {
  saltada_por_publicacion: 'PAUTADOR no la leyó hoy porque estaba publicando en esa cuenta (la publicación tiene prioridad).',
  frenada: 'PAUTADOR frenó la lectura de hoy para no pasarse del uso permitido de Meta.',
  error: 'La lectura de hoy de esa cuenta dio error.',
};

// Fecha (AAAA-MM-DD) y hora en Argentina de un momento dado
function enArgentina(momento = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(momento)).map((x) => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour) % 24 };
}
function diaAnterior(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// BigQuery devuelve INT64 como texto, BOOL como 'true'/'false' y DATE como texto o { value }.
const vacio = (x) => x === null || x === undefined || x === '';
const num = (x) => (vacio(x) ? NaN : Number(x));
const numONull = (x) => (vacio(x) ? null : Number(x));
const texto = (x) => (vacio(x) ? '' : String(x).trim());
const fechaDe = (x) => (x && typeof x === 'object' && x.value ? String(x.value) : String(x || '')).slice(0, 10);
function booleano(x) {
  if (x === true || x === false) return x;
  const t = String(x).trim().toLowerCase();
  if (t === 'true') return true;
  if (t === 'false') return false;
  return null;
}
const cuentasDe = (f) => {
  const lista = texto(f.cuentas).split(',').map((c) => c.trim()).filter(Boolean);
  if (!lista.length && texto(f.cuenta_id)) lista.push(texto(f.cuenta_id));
  return [...new Set(lista)].sort();
};
const cerca = (a, b) => Math.abs(a - b) <= Math.abs(b) * TOLERANCIA_FRECUENCIA + 1e-9;

// Qué identifica una fila dentro de su nivel (sin la fecha ni el período). En los niveles de cuenta el id de Meta es único;
// en los que cruzan cuentas lo que se mide es por canal + cliente (+ código o comunicación).
function idDe(f) {
  const n = f.nivel;
  if (n === 'cuenta') return texto(f.cuenta_id);
  if (n === 'campana') return texto(f.campana_id);
  if (n === 'conjunto') return texto(f.conjunto_id);
  if (n === 'anuncio') return texto(f.anuncio_id);
  if (n === 'cliente') return `${texto(f.canal)}|${texto(f.cliente)}`;
  if (n === 'contenido') return `${texto(f.canal)}|${texto(f.cliente)}|${texto(f.codigo).toUpperCase()}`;
  if (n === 'comunicacion') return `${texto(f.canal)}|${texto(f.cliente)}|${texto(f.comunicacion)}`;
  return '';
}
const claveDe = (f) => `${f.nivel}|${f.periodo}|${idDe(f)}`;

// Revisa una fila de meta_alcance_diario. Devuelve null si está bien, o el motivo (en castellano).
function problemaDeFila(f) {
  if (!f || typeof f !== 'object') return 'no es una fila';
  const lectura = fechaDe(f.fecha_lectura);
  if (!RE_FECHA.test(lectura)) return 'sin fecha de lectura';
  if (!NIVELES.includes(f.nivel)) return `nivel desconocido: ${f.nivel}`;
  if (!PERIODOS_POR_NIVEL[f.nivel].includes(f.periodo)) return `período ${f.periodo || 'vacío'} no corresponde al nivel ${f.nivel}`;
  const canal = texto(f.canal);
  if (!CANALES.includes(canal)) return `canal desconocido: ${canal || 'vacío'}`;
  if (canal === 'Ambos' && f.nivel !== 'cliente') return 'el canal "Ambos" solo existe en el nivel cliente';

  // Lo que identifica la fila, según el nivel
  if (NIVELES_DE_CUENTA.includes(f.nivel) && !/^act_\d+$/.test(texto(f.cuenta_id))) return 'sin cuenta';
  if (['campana', 'conjunto', 'anuncio'].includes(f.nivel) && !texto(f.campana_id)) return 'sin campaña';
  if (['conjunto', 'anuncio'].includes(f.nivel) && !texto(f.conjunto_id)) return 'sin conjunto';
  if (f.nivel === 'anuncio' && !texto(f.anuncio_id)) return 'sin anuncio';
  if (NIVELES_ENTRE_CUENTAS.includes(f.nivel) && !texto(f.cliente)) return 'sin cliente';
  if (f.nivel === 'contenido' && !RE_CODIGO.test(texto(f.codigo).toUpperCase())) return 'sin código de contenido de 14 caracteres';
  if (f.nivel === 'comunicacion' && !texto(f.comunicacion)) return 'sin comunicación';

  // Período: tiene que terminar el día anterior a la lectura
  const desde = fechaDe(f.fecha_desde), hasta = fechaDe(f.fecha_hasta);
  if (!vacio(f.fecha_hasta) && hasta !== diaAnterior(lectura)) return 'el período no termina el día anterior a la lectura';
  if (!vacio(f.fecha_desde) && !vacio(f.fecha_hasta) && !(RE_FECHA.test(desde) && desde <= hasta)) return 'el período empieza después de terminar';

  // Exacto o rango, coherente con cuántas cuentas junta
  const exacto = booleano(f.exacto);
  if (exacto === null) return 'sin la marca exacto';
  const cuentas = cuentasDe(f);
  if (!cuentas.length) return 'sin cuentas';
  if (!vacio(f.n_cuentas) && num(f.n_cuentas) !== cuentas.length) return 'la cantidad de cuentas no coincide con la lista de cuentas';
  if (NIVELES_DE_CUENTA.includes(f.nivel) && !exacto) return 'una fila de una sola cuenta tiene que ser exacta';
  if (exacto && cuentas.length !== 1) return 'marcada exacta pero junta varias cuentas';
  if (!exacto && cuentas.length < 2) return 'marcada como rango pero es de una sola cuenta';

  const i = num(f.impresiones);
  if (!Number.isFinite(i) || i < 0) return 'impresiones no es un número válido';
  if (!vacio(f.gasto) && !(num(f.gasto) >= 0)) return 'gasto no es un número válido';

  if (exacto) {
    const a = num(f.alcance);
    if (!Number.isFinite(a) || a < 0) return 'alcance no es un número válido';
    if (a > i) return 'el alcance es mayor que las impresiones';
    if (a === 0 && i > 0) return 'impresiones sin alcance';
    const mn = numONull(f.alcance_min), mx = numONull(f.alcance_max);
    if ((mn !== null && mn !== a) || (mx !== null && mx !== a)) return 'en una fila exacta el rango tiene que ser igual al alcance';
    const fr = numONull(f.frecuencia);
    if (a > 0) {
      if (fr === null || !Number.isFinite(fr)) return 'sin frecuencia';
      if (!cerca(fr, i / a)) return 'la frecuencia no cierra con impresiones sobre alcance';
    } else if (fr !== null && fr !== 0) return 'frecuencia sin alcance';
    for (const x of [numONull(f.frecuencia_min), numONull(f.frecuencia_max)]) {
      if (x !== null && (fr === null || !cerca(x, fr))) return 'en una fila exacta la frecuencia mínima y máxima tienen que ser iguales a la frecuencia';
    }
    return null;
  }

  // Rango (varias cuentas)
  if (!vacio(f.alcance)) return 'una fila de rango no puede traer alcance exacto';
  if (!vacio(f.frecuencia)) return 'una fila de rango no puede traer frecuencia exacta';
  const mn = num(f.alcance_min), mx = num(f.alcance_max);
  if (!Number.isFinite(mn) || !Number.isFinite(mx) || mn < 0) return 'rango de alcance incompleto';
  if (mn > mx) return 'el alcance mínimo es mayor que el máximo';
  if (mx > i) return 'el alcance máximo es mayor que las impresiones';
  if (mx === 0 && i > 0) return 'impresiones sin alcance';
  const fmn = numONull(f.frecuencia_min), fmx = numONull(f.frecuencia_max);
  if (mx > 0) {
    if (fmn === null || !cerca(fmn, i / mx)) return 'la frecuencia mínima no cierra con impresiones sobre el alcance máximo';
  }
  if (mn > 0) {
    if (fmx === null || !cerca(fmx, i / mn)) return 'la frecuencia máxima no cierra con impresiones sobre el alcance mínimo';
  }
  if (fmn !== null && fmx !== null && fmn > fmx + 1e-9) return 'la frecuencia mínima es mayor que la máxima';
  return null;
}

// Fila ya validada, con números de verdad y la marca para Interfaz.
function normalizar(f, hoy) {
  const exacto = booleano(f.exacto);
  const cuentas = cuentasDe(f);
  const a = numONull(f.alcance);
  return {
    fecha_lectura: hoy, nivel: f.nivel, periodo: f.periodo,
    fecha_desde: vacio(f.fecha_desde) ? null : fechaDe(f.fecha_desde), fecha_hasta: vacio(f.fecha_hasta) ? null : fechaDe(f.fecha_hasta),
    canal: texto(f.canal), cliente: texto(f.cliente) || null, proyecto: texto(f.proyecto) || null,
    activo_key: texto(f.activo_key) || null, activo: texto(f.activo) || null,
    cuenta_id: texto(f.cuenta_id) || null, cuentas, n_cuentas: cuentas.length,
    campana_id: texto(f.campana_id) || null, campana_nombre: texto(f.campana_nombre) || null,
    conjunto_id: texto(f.conjunto_id) || null, conjunto_nombre: texto(f.conjunto_nombre) || null,
    anuncio_id: texto(f.anuncio_id) || null, anuncio_nombre: texto(f.anuncio_nombre) || null,
    codigo: texto(f.codigo).toUpperCase() || null, comunicacion: texto(f.comunicacion) || null,
    n_anuncios: numONull(f.n_anuncios),
    exacto,
    puede_contar_de_mas: !exacto,            // rango entre cuentas: el máximo puede contar dos veces a la misma persona
    alcance: exacto ? a : null,
    alcance_min: exacto ? a : num(f.alcance_min),
    alcance_max: exacto ? a : num(f.alcance_max),
    impresiones: num(f.impresiones),
    frecuencia: exacto ? numONull(f.frecuencia) : null,
    frecuencia_min: exacto ? numONull(f.frecuencia) : numONull(f.frecuencia_min),
    frecuencia_max: exacto ? numONull(f.frecuencia) : numONull(f.frecuencia_max),
    gasto: numONull(f.gasto),
  };
}

// Corridas de hoy → estado por cuenta. Si una cuenta aparece más de una vez, vale ok solo si todas sus filas dicen ok.
function cuentasDeHoy(corridas, hoy) {
  const porCuenta = new Map();
  const problemas = [];
  for (const c of corridas) {
    if (!c || typeof c !== 'object' || fechaDe(c.fecha_lectura) !== hoy) continue;
    const cuenta = texto(c.cuenta_id);
    const estado = texto(c.estado);
    if (!/^act_\d+$/.test(cuenta)) { problemas.push({ corrida: c, motivo: 'corrida sin cuenta' }); continue; }
    const previo = porCuenta.get(cuenta);
    const conocido = ESTADOS_CORRIDA.includes(estado);
    const motivo = estado === 'ok' ? '' : (conocido ? MOTIVO_CORRIDA[estado] : `La lectura de hoy terminó con un estado desconocido (${estado || 'vacío'}).`);
    const actual = { cuenta_id: cuenta, canal: texto(c.canal) || null, cliente: texto(c.cliente) || null, activo_key: texto(c.activo_key) || null,
      estado_lectura: estado || null, ok: estado === 'ok', motivo, detalle: texto(c.motivo) || null };
    if (previo) {
      problemas.push({ corrida: c, motivo: 'corrida repetida para la misma cuenta' });
      if (!(previo.ok && actual.ok)) porCuenta.set(cuenta, previo.ok ? actual : previo);
      continue;
    }
    porCuenta.set(cuenta, actual);
  }
  return { porCuenta, problemas };
}

// entrada: { alcance: filas de meta_alcance_diario, corridas: filas de meta_alcance_corridas } (de los dos proyectos, pueden
// traer varios días). opciones: { ahora } (para pruebas).
// Devuelve:
//   estado        'ok' (todo leído y válido) · 'parcial' (hay dato de hoy, pero algunas cuentas o filas no) ·
//                 'sin_dato_de_hoy' (nada de hoy: no se devuelven números)
//   fecha         día de hoy en Argentina
//   motivo        solo si 'sin_dato_de_hoy'
//   ultima_fecha  la última lectura que hay en lo bajado (aunque sea vieja; solo informativo)
//   niveles       { cuenta: [...], cliente: [...], campana: [...], conjunto: [...], anuncio: [...], contenido: [...], comunicacion: [...] }
//   cuentas       { act_…: { ok, estado_lectura, motivo, canal, cliente, activo_key } }  cómo terminó la lectura de cada cuenta hoy
//   clientes_sin_dato  [{ canal, cliente, motivo }]  clientes a los que les falta una cuenta hoy: sin cliente, contenido ni comunicación
//   descartadas   [{ fila, motivo }]  filas de hoy que no pasaron la validación o cuya cuenta no terminó bien
//   corridas_con_problemas [{ corrida, motivo }]
function alcanceDeHoy(entrada, { ahora = new Date() } = {}) {
  const { fecha: hoy, hora } = enArgentina(ahora);
  const e = Array.isArray(entrada) ? { alcance: entrada } : (entrada && typeof entrada === 'object' ? entrada : {});
  const filas = Array.isArray(e.alcance) ? e.alcance : [];
  const corridas = Array.isArray(e.corridas) ? e.corridas : [];

  const fechas = [...filas, ...corridas].map((f) => fechaDe(f && f.fecha_lectura)).filter((x) => RE_FECHA.test(x)).sort();
  const ultima = fechas.length ? fechas[fechas.length - 1] : null;
  const sinDato = (motivo, extra = {}) => ({ estado: 'sin_dato_de_hoy', fecha: hoy, motivo, ultima_fecha: ultima, niveles: nivelesVacios(), cuentas: {}, clientes_sin_dato: [], descartadas: [], corridas_con_problemas: [], ...extra });

  const { porCuenta, problemas: corridasConProblemas } = cuentasDeHoy(corridas, hoy);
  const deHoy = filas.filter((f) => f && fechaDe(f.fecha_lectura) === hoy);

  if (!porCuenta.size) {
    let motivo;
    // Sin nada: antes de las 9:00 se explica por el horario (lo normal hasta que PAUTADOR lee); después, que no trajo nada.
    if (deHoy.length) motivo = 'Hay filas de hoy pero la lectura no dejó el estado de las cuentas: no se puede saber si están completas.';
    else if (ultima && ultima > hoy) motivo = `La última lectura tiene fecha futura (${ultima}).`;
    else if (hora < HORA_LECTURA) motivo = `Todavía no se leyó hoy (PAUTADOR lee a las ${HORA_LECTURA}:00).`;
    else if (hora < HORA_LIMITE) motivo = `La lectura de hoy todavía no terminó (PAUTADOR tiene hasta las ${HORA_LIMITE}:00).`;
    else if (!filas.length && !corridas.length) motivo = 'La lectura de alcance no trajo nada.';
    else motivo = ultima ? `No hay lectura de hoy (la última es del ${ultima}).` : 'No hay lectura de hoy.';
    return sinDato(motivo, { corridas_con_problemas: corridasConProblemas });
  }

  // 1) Validación fila por fila
  const descartadas = [];
  const validas = [];
  for (const f of deHoy) {
    const p = problemaDeFila(f);
    if (p) descartadas.push({ fila: f, motivo: p });
    else validas.push(f);
  }

  // 2) Repetidas por (fecha_lectura, nivel, período, id): no se sabe cuál vale, se descartan todas las copias
  const cuantas = new Map();
  validas.forEach((f) => { const k = claveDe(f); cuantas.set(k, (cuantas.get(k) || 0) + 1); });
  const unicas = [];
  for (const f of validas) {
    if (cuantas.get(claveDe(f)) > 1) descartadas.push({ fila: f, motivo: 'fila repetida (misma fecha, nivel, período y lo que se mide): no se sabe cuál vale' });
    else unicas.push(f);
  }

  // 3) Clientes a los que les falta una cuenta hoy (por canal; "Ambos" = cualquier canal)
  const incompletos = new Map();   // `${canal}|${cliente}` → motivo
  const clientesIncompletos = new Map();   // cliente → motivo (para "Ambos")
  for (const c of porCuenta.values()) {
    if (c.ok || !c.cliente) continue;
    const motivo = `Falta la lectura de hoy de una de sus cuentas (${c.cuenta_id}): ${c.motivo}`;
    if (!incompletos.has(`${c.canal}|${c.cliente}`)) incompletos.set(`${c.canal}|${c.cliente}`, motivo);
    if (!clientesIncompletos.has(c.cliente)) clientesIncompletos.set(c.cliente, motivo);
  }

  // 4) Cada fila tiene que venir de cuentas que se leyeron bien hoy
  const niveles = nivelesVacios();
  for (const f of unicas) {
    const cuentas = cuentasDe(f);
    const mal = cuentas.find((c) => !porCuenta.has(c) || !porCuenta.get(c).ok);
    if (mal) {
      const c = porCuenta.get(mal);
      descartadas.push({ fila: f, motivo: c ? `la cuenta ${mal} no se leyó bien hoy: ${c.motivo}` : `la cuenta ${mal} no tiene corrida de hoy` });
      continue;
    }
    if (NIVELES_ENTRE_CUENTAS.includes(f.nivel)) {
      const canal = texto(f.canal), cliente = texto(f.cliente);
      const falta = canal === 'Ambos' ? clientesIncompletos.get(cliente) : incompletos.get(`${canal}|${cliente}`);
      if (falta) { descartadas.push({ fila: f, motivo: `al cliente ${cliente} le falta una cuenta hoy` }); continue; }
    }
    niveles[f.nivel].push(normalizar(f, hoy));
  }

  const cuentasSalida = {};
  for (const c of porCuenta.values()) cuentasSalida[c.cuenta_id] = { ok: c.ok, estado_lectura: c.estado_lectura, motivo: c.motivo || null, detalle: c.detalle, canal: c.canal, cliente: c.cliente, activo_key: c.activo_key };
  const clientesSinDato = [...incompletos.entries()].map(([k, motivo]) => { const [canal, cliente] = k.split('|'); return { canal, cliente, motivo }; });
  const hayDato = NIVELES.some((n) => niveles[n].length);
  if (!hayDato) {
    const algunaOk = [...porCuenta.values()].some((c) => c.ok);
    const motivo = !algunaOk ? 'Hoy no se pudo leer ninguna cuenta.' : deHoy.length ? 'La lectura de hoy vino con errores en todas las filas.' : 'La lectura de hoy terminó sin filas.';
    return sinDato(motivo, { cuentas: cuentasSalida, clientes_sin_dato: clientesSinDato, descartadas, corridas_con_problemas: corridasConProblemas });
  }
  const todoBien = !descartadas.length && !clientesSinDato.length && !corridasConProblemas.length && [...porCuenta.values()].every((c) => c.ok);
  return { estado: todoBien ? 'ok' : 'parcial', fecha: hoy, ultima_fecha: ultima, niveles, cuentas: cuentasSalida, clientes_sin_dato: clientesSinDato, descartadas, corridas_con_problemas: corridasConProblemas };
}

function nivelesVacios() { return Object.fromEntries(NIVELES.map((n) => [n, []])); }

// ---------- Lo que baja Datos → alcanceDeHoy ----------
// Datos baja las dos tablas dentro de la extracción (borrador/_extraer.js, 30/9) y deja en _proyectos.json:
//   alcanceMeta      filas de meta_alcance_diario de hoy (Oficial + Informativo juntas; "Ambos" viene del proyecto de Oficial)
//   alcanceCorridas  filas de meta_alcance_corridas de hoy
//   alcanceFecha     el día (hora argentina) que se pidió
//   alcanceEstado    { Oficial: { alcanceMeta: { disponible, filas | motivo, detalle }, alcanceCorridas: {…} }, Informativo: {…} }
//                    disponible false = la tabla no existe todavía o la consulta dio error: ese canal no tiene dato de hoy.
// Esta función lo pasa a alcanceDeHoy como { alcance, corridas } y agrega, por canal, si se pudo leer. Devuelve lo mismo que
// alcanceDeHoy más:
//   canales          { Oficial: { disponible, motivo }, Informativo: { disponible, motivo } }
//   canales_sin_dato [{ canal, motivo }]
// Un canal sin dato no aporta nada: se sacan sus filas y corridas (si una de sus dos tablas se leyó y la otra no, no se puede
// saber si lo leído está completo). Las filas "Ambos" se sacan si falta cualquiera de los dos canales (juntan cuentas de los dos).
const CANALES_EXTRACCION = ['Oficial', 'Informativo'];
const NOMBRE_TABLA = { alcanceMeta: 'la tabla de alcance', alcanceCorridas: 'la tabla de corridas de la lectura' };
function motivoTabla(canal, tabla, est) {
  const que = `${NOMBRE_TABLA[tabla]} de ${canal}`;
  if (!est || typeof est !== 'object') return `La extracción no dice si se pudo leer ${que}.`;
  if (est.motivo === 'tabla inexistente') return `Todavía no existe ${que} en BigQuery (PAUTADOR no la prendió).`;
  if (est.motivo === 'error de consulta') return `No se pudo leer ${que} de BigQuery (error de consulta).`;
  return `No se pudo leer ${que}${est.motivo ? ` (${est.motivo})` : ''}.`;
}
function alcanceDeExtraccion(datos, { ahora = new Date() } = {}) {
  const { fecha: hoy } = enArgentina(ahora);
  const d = datos && typeof datos === 'object' ? datos : {};
  const vacioSin = (motivo, canales, canalesSin) => ({ ...alcanceDeHoy({ alcance: [], corridas: [] }, { ahora }), motivo, canales, canales_sin_dato: canalesSin });

  // Estado de cada canal
  const estado = d.alcanceEstado && typeof d.alcanceEstado === 'object' ? d.alcanceEstado : null;
  const canales = {};
  for (const canal of CANALES_EXTRACCION) {
    if (!estado) { canales[canal] = { disponible: false, motivo: 'La extracción no trae el estado de la lectura de alcance (es anterior al 30/9 o se cortó).' }; continue; }
    const e = estado[canal] && typeof estado[canal] === 'object' ? estado[canal] : {};
    const malas = ['alcanceMeta', 'alcanceCorridas'].filter((t) => !(e[t] && e[t].disponible === true));
    canales[canal] = malas.length ? { disponible: false, motivo: malas.map((t) => motivoTabla(canal, t, e[t])).join(' ') } : { disponible: true, motivo: null };
  }
  const canalesSin = CANALES_EXTRACCION.filter((c) => !canales[c].disponible).map((c) => ({ canal: c, motivo: canales[c].motivo }));

  // Datos de otro día: nunca se usan como de hoy
  const fechaBajada = texto(d.alcanceFecha);
  if (fechaBajada && fechaBajada !== hoy) {
    return vacioSin(`Los datos de alcance se bajaron el ${fechaBajada}: no hay lectura de hoy (${hoy}). Hay que volver a bajar los datos.`, canales, canalesSin);
  }
  if (canalesSin.length === CANALES_EXTRACCION.length) {
    return vacioSin(canalesSin.map((c) => c.motivo).join(' '), canales, canalesSin);
  }

  // Se sacan las filas y corridas de los canales sin dato
  const sinCanal = new Set(canalesSin.map((c) => c.canal));
  const descartadasPrevias = [];
  const quedaFila = (f) => {
    const canal = texto(f && f.canal);
    if (sinCanal.has(canal)) { descartadasPrevias.push({ fila: f, motivo: canales[canal].motivo }); return false; }
    if (canal === 'Ambos' && sinCanal.size) { descartadasPrevias.push({ fila: f, motivo: `el dato de los dos canales junta cuentas de ${[...sinCanal].join(' y ')}, que no tiene dato de hoy` }); return false; }
    return true;
  };
  const alcance = (Array.isArray(d.alcanceMeta) ? d.alcanceMeta : []).filter(quedaFila);
  const corridas = (Array.isArray(d.alcanceCorridas) ? d.alcanceCorridas : []).filter((c) => !sinCanal.has(texto(c && c.canal)));

  const r = alcanceDeHoy({ alcance, corridas }, { ahora });
  r.canales = canales;
  r.canales_sin_dato = canalesSin;
  if (descartadasPrevias.length) r.descartadas = [...descartadasPrevias, ...(r.descartadas || [])];
  if (canalesSin.length) {
    if (r.estado === 'ok') r.estado = 'parcial';
    if (r.estado === 'sin_dato_de_hoy') r.motivo = [r.motivo, ...canalesSin.map((c) => c.motivo)].filter(Boolean).join(' ');
  }
  return r;
}

// Busca el dato de hoy de una cosa concreta. consulta: { nivel, periodo, y lo que la identifica: cuenta_id | campana_id |
// conjunto_id | anuncio_id | cliente (+ canal) | codigo (+ cliente, canal) | comunicacion (+ cliente, canal) }.
// Para niveles de campaña, conjunto o anuncio conviene pasar también cuenta_id: así, si falta, se sabe si fue por la cuenta.
// Devuelve { estado: 'ok', dato } o { estado: 'sin_dato_de_hoy', motivo }. Nunca números viejos.
function datoDeHoy(resultado, consulta = {}) {
  const sin = (motivo) => ({ estado: 'sin_dato_de_hoy', motivo });
  if (!resultado || resultado.estado === 'sin_dato_de_hoy') return sin((resultado && resultado.motivo) || 'No hay lectura de hoy.');
  const { nivel, periodo } = consulta;
  if (!NIVELES.includes(nivel)) return sin(`Nivel desconocido: ${nivel}.`);
  if (!PERIODOS_POR_NIVEL[nivel].includes(periodo)) return sin(`El período ${periodo} no se lee para el nivel ${nivel}.`);
  const lista = (resultado.niveles && resultado.niveles[nivel]) || [];
  let candidatos;
  if (NIVELES_ENTRE_CUENTAS.includes(nivel)) {
    const campo = nivel === 'contenido' ? 'codigo' : nivel === 'comunicacion' ? 'comunicacion' : null;
    const valor = campo ? texto(consulta[campo]) : '';
    candidatos = lista.filter((d) => d.periodo === periodo && d.cliente === texto(consulta.cliente)
      && (!consulta.canal || d.canal === consulta.canal) && (!campo || (campo === 'codigo' ? d.codigo === valor.toUpperCase() : d.comunicacion === valor)));
    if (candidatos.length > 1) return sin('Hay más de un dato posible: falta indicar el canal.');
  } else {
    const campo = { cuenta: 'cuenta_id', campana: 'campana_id', conjunto: 'conjunto_id', anuncio: 'anuncio_id' }[nivel];
    candidatos = lista.filter((d) => d.periodo === periodo && d[campo] === texto(consulta[campo]));
  }
  if (candidatos.length === 1) return { estado: 'ok', dato: candidatos[0] };

  // No hay fila: se explica por qué, si se puede saber.
  const canalSin = (resultado.canales_sin_dato || []).find((x) => consulta.canal && (x.canal === consulta.canal || consulta.canal === 'Ambos'));
  if (canalSin) return sin(canalSin.motivo);
  const cuenta = texto(consulta.cuenta_id);
  const c = cuenta && resultado.cuentas && resultado.cuentas[cuenta];
  if (cuenta && !c) return sin(`La cuenta ${cuenta} no tiene lectura de hoy.`);
  if (c && !c.ok) return sin(c.motivo);
  if (NIVELES_ENTRE_CUENTAS.includes(nivel)) {
    const falta = (resultado.clientes_sin_dato || []).find((x) => x.cliente === texto(consulta.cliente) && (!consulta.canal || x.canal === consulta.canal || consulta.canal === 'Ambos'));
    if (falta) return sin(falta.motivo);
  }
  if (periodo === 'mes_en_curso' && resultado.fecha && resultado.fecha.endsWith('-01')) return sin('El primer día del mes todavía no hay mes en curso.');
  return sin('No hay dato de hoy para esto (puede no haber tenido gasto en los últimos 30 días).');
}

module.exports = {
  alcanceDeHoy, alcanceDeExtraccion, datoDeHoy, problemaDeFila, enArgentina,
  NIVELES, PERIODOS_POR_NIVEL, ESTADOS_CORRIDA, HORA_LECTURA, HORA_LIMITE,
};
