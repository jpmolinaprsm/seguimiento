// Nexo con PAUTADOR (lado Seguimiento) · camino 1: alcance y frecuencia reales de Meta.
// Contrato: orquestacion/CONTRATOS/lectura-alcance-meta.md, sección "Cómo quedó construido" (manda sobre lo de arriba).
//
// PAUTADOR lee Meta a las 6:00 (hora argentina, ventana hasta las 9:00) y deja, en el dataset `automatizado` de cada canal
// (Informativo en bq-project-450514; Oficial y "Ambos" en prsm-bq-media), dos tablas partidas por `fecha_lectura`:
//   meta_alcance_diario    una fila por nivel · período · lo que se mide (ver NIVELES y PERIODOS_POR_NIVEL)
//   meta_alcance_corridas  una fila por cuenta y día con cómo terminó su lectura: ok / parcial / saltada_por_publicacion /
//                          frenada / error. Desde el 3/10 (pedido 035), con estado parcial trae `faltantes` (JSON: qué no se
//                          pudo leer en esa cuenta).
//
// SIEMPRE LA ÚLTIMA LECTURA (decisión de Juan Pablo, 3/10/2026): el alcance se muestra con la última lectura disponible y su
// fecha, todos los días. Si hoy todavía no hay lectura, vale la de ayer (o la última que haya), marcada con su fecha
// (`fechaLectura`, `deHoy` = false) para que la app diga "al dd/mm". Solo si no hay ninguna lectura queda "sin dato de Meta"
// (estado 'sin_dato'). La última lectura es, por canal, la fecha más reciente (que no pase de hoy) con filas de alcance y
// corridas; las corridas de esa fecha dicen qué cuentas se leyeron bien.
//
// Quién baja las tablas: Extracción, dentro de la extracción de siempre (borrador/_extraer.js trae solo la última partición de
// cada canal). Este archivo NO consulta BigQuery: recibe las filas ya bajadas (de los dos proyectos, juntas), las valida y
// devuelve, por nivel, el dato de la última lectura o "sin dato de Meta".
//
// EL ALCANCE NUNCA SE SUMA ENTRE CUENTAS (decisión de Juan Pablo, 2/10/2026): "si Meta no puede tomar el total, nunca
// mezclemos alcance entre cuentas: se aclara cuánto es el alcance dentro de cada cuenta". Meta cuenta las personas sin
// repetir solo dentro de una cuenta publicitaria.
//   - Cliente, contenido o comunicación en UNA cuenta: el dato exacto (datoDeHoy → estado 'ok').
//   - En VARIAS cuentas: una lista por cuenta, cada una con su alcance exacto dentro de esa cuenta (estado 'por_cuenta').
//     Nunca un total, un rango ni un techo que junte cuentas.
//   - Si falta el dato de alguna de esas cuentas: estado 'sin_dato_por_cuenta', con lo que sí haya por cuenta.
// De dónde sale el dato por cuenta:
//   cliente       las filas de nivel `cuenta` de cada cuenta del cliente (mismos períodos).
//   contenido     filas `contenido_cuenta`     (una fila exacta por cuenta, con cuenta_id y activo; PAUTADOR las escribe
//   comunicación  filas `comunicacion_cuenta`   desde el 2/10).
// Las filas de rango viejas (exacto = false, alcance_min / alcance_max) se usan solo para saber que eso corre en varias
// cuentas y en cuáles: sus números no se devuelven nunca (tampoco en `descartadas`).
// Cuenta que no se leyó (error, frenada, saltada): no hay dato de cliente, contenido ni comunicación de su cliente.
// Cuenta "parcial" con `faltantes`: se descarta solo lo que faltó (pedido 035). Si falta un contenido o una comunicación en una
// cuenta, ese contenido o comunicación de ese cliente queda "sin dato por cuenta"; si falta el nivel cuenta, el cliente queda
// sin dato; si falta un nivel entero (campaña, conjunto, anuncio), ese nivel de esa cuenta. Una "parcial" sin `faltantes`
// legible cuenta como no leída.

const NIVELES = ['cuenta', 'cliente', 'campana', 'conjunto', 'anuncio', 'contenido', 'comunicacion', 'contenido_cuenta', 'comunicacion_cuenta'];
const PERIODOS_POR_NIVEL = {
  cuenta: ['mes_en_curso', 'ultimos_7', 'ultimos_30'],
  cliente: ['mes_en_curso', 'ultimos_7', 'ultimos_30'],
  campana: ['desde_inicio', 'ultimos_7', 'ultimos_30'],
  comunicacion: ['desde_inicio', 'ultimos_7', 'ultimos_30'],
  comunicacion_cuenta: ['desde_inicio', 'ultimos_7', 'ultimos_30'],
  conjunto: ['desde_inicio', 'ultimos_7'],
  anuncio: ['desde_inicio', 'ultimos_7'],
  contenido: ['desde_inicio', 'ultimos_7'],
  contenido_cuenta: ['desde_inicio', 'ultimos_7'],
};
const NIVELES_DE_CUENTA = ['cuenta', 'campana', 'conjunto', 'anuncio', 'contenido_cuenta', 'comunicacion_cuenta'];   // una sola cuenta, siempre exacto
const NIVELES_ENTRE_CUENTAS = ['cliente', 'contenido', 'comunicacion'];       // pueden juntar varias cuentas
const NIVELES_POR_CUENTA_DE_CLIENTE = ['contenido_cuenta', 'comunicacion_cuenta'];   // por cuenta, pero dependen de que el cliente esté completo
const POR_CUENTA_DE = { cliente: 'cuenta', contenido: 'contenido_cuenta', comunicacion: 'comunicacion_cuenta' };
const CLAVE_DE = { contenido: 'codigo', comunicacion: 'comunicacion', contenido_cuenta: 'codigo', comunicacion_cuenta: 'comunicacion' };
const SIN_NOMBRE = 'Cuenta sin nombre cargado en PAUTADOR';
const CANALES = ['Informativo', 'Oficial', 'Ambos'];                          // "Ambos" solo en nivel cliente
const ESTADOS_CORRIDA = ['ok', 'parcial', 'saltada_por_publicacion', 'frenada', 'error'];
const NIVELES_FALTANTE = ['cuenta', 'campana', 'conjunto', 'anuncio', 'contenido', 'comunicacion'];
const HORA_LECTURA = 6;            // PAUTADOR arranca a las 6:00 hora argentina
const HORA_LIMITE = 9;             // y tiene hasta las 9:00
const TOLERANCIA_FRECUENCIA = 0.02; // frecuencia = impresiones / alcance, con 2 % de margen por redondeo
const ZONA = 'America/Argentina/Buenos_Aires';
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_CODIGO = /^[A-Z0-9]{14}$/;

// "de hoy" o "del 02/10", según la fecha de la lectura
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const deLaLectura = (fecha, hoy) => (fecha === hoy ? 'de hoy' : `del ${dm(fecha)}`);
const MOTIVO_CORRIDA = {
  saltada_por_publicacion: (c) => `PAUTADOR no la leyó en la lectura ${c} porque estaba publicando en esa cuenta (la publicación tiene prioridad).`,
  frenada: (c) => `PAUTADOR frenó la lectura ${c} para no pasarse del uso permitido de Meta.`,
  error: (c) => `La lectura ${c} de esa cuenta dio error.`,
};
const NIVEL_FALTANTE_TXT = { cuenta: 'el total de la cuenta', campana: 'las campañas', conjunto: 'los conjuntos', anuncio: 'los anuncios' };

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
// Cada canal tiene su propia lectura (su propio proyecto de BigQuery). "Ambos" vivía en el proyecto de Oficial.
const grupoDe = (canal) => (texto(canal) === 'Ambos' ? 'Oficial' : texto(canal));

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
  if (n === 'contenido_cuenta') return `${texto(f.canal)}|${texto(f.cliente)}|${texto(f.codigo).toUpperCase()}|${texto(f.cuenta_id)}`;
  if (n === 'comunicacion_cuenta') return `${texto(f.canal)}|${texto(f.cliente)}|${texto(f.comunicacion)}|${texto(f.cuenta_id)}`;
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
  if ((NIVELES_ENTRE_CUENTAS.includes(f.nivel) || NIVELES_POR_CUENTA_DE_CLIENTE.includes(f.nivel)) && !texto(f.cliente)) return 'sin cliente';
  if (CLAVE_DE[f.nivel] === 'codigo' && !RE_CODIGO.test(texto(f.codigo).toUpperCase())) return 'sin código de contenido de 14 caracteres';
  if (CLAVE_DE[f.nivel] === 'comunicacion' && !texto(f.comunicacion)) return 'sin comunicación';

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

  // Fila de varias cuentas (exacto = false). Desde el 2/10 sus números no se usan nunca (el alcance no se suma entre
  // cuentas): solo dice que eso corre en varias cuentas y en cuáles. Por eso no se validan sus números.
  return null;
}

// Fila de varias cuentas → qué corre en varias cuentas y en cuáles, sin ningún número.
function aEntreCuentas(f) {
  return {
    nivel: f.nivel, periodo: f.periodo, canal: texto(f.canal), cliente: texto(f.cliente) || null,
    codigo: texto(f.codigo).toUpperCase() || null, comunicacion: texto(f.comunicacion) || null,
    cuenta_ids: cuentasDe(f),
  };
}

// Una fila para dejar en `descartadas`: si junta varias cuentas se le sacan todos los números (nunca se devuelve un total ni
// un rango entre cuentas); a las demás, los campos de rango que repiten el alcance.
const CAMPOS_RANGO = ['alcance_min', 'alcance_max', 'frecuencia_min', 'frecuencia_max', 'puede_contar_de_mas'];
const CAMPOS_NUMERO = ['alcance', 'impresiones', 'frecuencia', 'gasto'];
function sinSumas(f) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) return f;
  const copia = { ...f };
  CAMPOS_RANGO.forEach((k) => { delete copia[k]; });
  const variasCuentas = booleano(f.exacto) === false || cuentasDe(f).length > 1;
  if (variasCuentas) CAMPOS_NUMERO.forEach((k) => { delete copia[k]; });
  return copia;
}

// Fila exacta ya validada, con números de verdad. Nunca trae rango.
function normalizar(f) {
  const exacto = booleano(f.exacto);
  const cuentas = cuentasDe(f);
  const a = numONull(f.alcance);
  return {
    fecha_lectura: fechaDe(f.fecha_lectura), nivel: f.nivel, periodo: f.periodo,
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
    alcance: a,
    impresiones: num(f.impresiones),
    frecuencia: numONull(f.frecuencia),
    gasto: numONull(f.gasto),
  };
}

// `faltantes` de una corrida parcial (pedido 035): texto JSON con [{ cuenta_id, nivel, codigo, comunicacion, codigos, motivo }].
// Devuelve la lista normalizada, o null si no hay o no se puede leer (entonces la cuenta cuenta como no leída).
function faltantesDe(valor, cuenta) {
  let lista = valor;
  if (typeof valor === 'string') {
    if (!valor.trim()) return null;
    try { lista = JSON.parse(valor); } catch (e) { return null; }
  }
  if (!Array.isArray(lista) || !lista.length) return null;
  const salida = [];
  for (const x of lista) {
    if (!x || typeof x !== 'object') return null;
    const nivel = texto(x.nivel);
    if (!NIVELES_FALTANTE.includes(nivel)) return null;
    if (texto(x.cuenta_id) && texto(x.cuenta_id) !== cuenta) return null;
    const codigo = texto(x.codigo).toUpperCase(), comunicacion = texto(x.comunicacion);
    if (nivel === 'contenido' && !RE_CODIGO.test(codigo)) return null;
    if (nivel === 'comunicacion' && !comunicacion) return null;
    salida.push({ nivel, codigo: nivel === 'contenido' ? codigo : null, comunicacion: ['contenido', 'comunicacion'].includes(nivel) ? (comunicacion || null) : null, motivo: texto(x.motivo) || null });
  }
  return salida;
}
const queFalto = (x) => (x.nivel === 'contenido' ? `el contenido ${x.codigo}` : x.nivel === 'comunicacion' ? `la comunicación "${x.comunicacion}"` : NIVEL_FALTANTE_TXT[x.nivel]);

// Corridas de la lectura elegida → estado por cuenta. Si una cuenta aparece más de una vez, vale solo si todas sus filas
// valen. `ok` = sus filas se pueden usar (estado ok, o parcial con `faltantes` legible); `completa` = no le faltó nada.
function cuentasDeLectura(corridas, hoy) {
  const porCuenta = new Map();
  const problemas = [];
  for (const c of corridas) {
    const cuenta = texto(c.cuenta_id);
    const estado = texto(c.estado);
    const fecha = fechaDe(c.fecha_lectura);
    const cuando = deLaLectura(fecha, hoy);
    if (!/^act_\d+$/.test(cuenta)) { problemas.push({ corrida: c, motivo: 'corrida sin cuenta' }); continue; }
    const previo = porCuenta.get(cuenta);
    let ok = estado === 'ok', faltantes = [], motivo = '';
    if (estado === 'parcial') {
      const lista = faltantesDe(c.faltantes, cuenta);
      if (lista) { ok = true; faltantes = lista; motivo = `En la lectura ${cuando} no se pudo leer ${[...new Set(lista.map(queFalto))].join(', ')}.`; }
      else motivo = `La lectura ${cuando} de esa cuenta quedó incompleta y no dice qué faltó.`;
    } else if (!ok) {
      motivo = MOTIVO_CORRIDA[estado] ? MOTIVO_CORRIDA[estado](cuando) : `La lectura ${cuando} terminó con un estado desconocido (${estado || 'vacío'}).`;
    }
    const actual = { cuenta_id: cuenta, fecha_lectura: fecha, canal: texto(c.canal) || null, cliente: texto(c.cliente) || null, activo_key: texto(c.activo_key) || null,
      estado_lectura: estado || null, ok, completa: ok && !faltantes.length, faltantes, motivo, detalle: texto(c.motivo) || null };
    if (previo) {
      problemas.push({ corrida: c, motivo: 'corrida repetida para la misma cuenta' });
      if (previo.ok && actual.ok) {
        const juntos = [...previo.faltantes, ...actual.faltantes];
        porCuenta.set(cuenta, { ...previo, faltantes: juntos, completa: !juntos.length, motivo: [previo.motivo, actual.motivo].filter(Boolean).join(' ') });
      } else porCuenta.set(cuenta, previo.ok ? actual : previo);
      continue;
    }
    porCuenta.set(cuenta, actual);
  }
  return { porCuenta, problemas };
}

// ¿La fila es algo que, según `faltantes`, no se pudo leer? (control por las dudas: PAUTADOR ya no escribe esas filas)
//   de la propia cuenta: el nivel entero que faltó; el contenido o la comunicación que faltó (también por cuenta)
//   de otra cuenta del mismo cliente: la fila "de una sola cuenta" de cliente / contenido / comunicación, porque con lo que
//   faltó no se sabe si de verdad está en una sola cuenta
function faltoEnLectura(f, porCuenta, faltaPorCliente) {
  const nivel = f.nivel, cuenta = texto(f.cuenta_id);
  const propios = (porCuenta.get(cuenta) || {}).faltantes || [];
  const codigo = texto(f.codigo).toUpperCase(), comunicacion = texto(f.comunicacion);
  for (const x of propios) {
    if (x.nivel === nivel) {
      if (!CLAVE_DE[nivel]) return x;
      if (nivel === 'contenido' && x.codigo === codigo) return x;
      if (nivel === 'comunicacion' && x.comunicacion === comunicacion) return x;
    }
    if (nivel === 'cliente' && x.nivel === 'cuenta') return x;
    if (nivel === 'contenido_cuenta' && x.nivel === 'contenido' && x.codigo === codigo) return x;
    if (nivel === 'comunicacion_cuenta' && x.nivel === 'comunicacion' && x.comunicacion === comunicacion) return x;
  }
  if (NIVELES_ENTRE_CUENTAS.includes(nivel)) {
    const canal = texto(f.canal), cliente = texto(f.cliente);
    const k = nivel === 'cliente' ? 'cuenta|' : nivel === 'contenido' ? `contenido|${codigo}` : `comunicacion|${comunicacion}`;
    const deOtra = (faltaPorCliente.get(`${canal}|${cliente}|${k}`) || []).concat(canal === 'Ambos' ? faltaPorCliente.get(`*|${cliente}|${k}`) || [] : []);
    if (deOtra.length) return deOtra[0];
  }
  return null;
}

// entrada: { alcance: filas de meta_alcance_diario, corridas: filas de meta_alcance_corridas } (de los dos proyectos, pueden
// traer varios días). opciones: { ahora } (para pruebas).
// Devuelve:
//   estado        'ok' (todo leído y válido) · 'parcial' (hay dato, pero algunas cuentas o filas no) ·
//                 'sin_dato' (no hay ninguna lectura que sirva: no se devuelven números; la app dice "sin dato de Meta")
//   fecha         la fecha de la lectura que se usa (la más nueva de los canales); si no hay ninguna, hoy
//   fechaLectura  la fecha de la lectura que se usa, o null si no hay ninguna
//   deHoy         true si todos los canales con lectura tienen la de hoy; false si se usa una anterior (mostrar "al dd/mm")
//   hoy           el día de hoy en Argentina
//   fechas_por_canal { Informativo: 'AAAA-MM-DD', Oficial: … }  la lectura que se usa en cada canal
//   aviso         solo si deHoy = false: por qué no es la de hoy (todavía no se leyó, la de hoy no dejó datos, …)
//   motivo        solo si 'sin_dato'
//   ultima_fecha  la última fecha que hay en lo bajado (aunque sea futura o no sirva; solo informativo)
//   niveles       { cuenta, cliente, campana, conjunto, anuncio, contenido, comunicacion, contenido_cuenta, comunicacion_cuenta: [...] }
//                 SOLO filas exactas (una cuenta), cada una con su fecha_lectura. Las de varias cuentas no entran nunca.
//   entre_cuentas [{ nivel, periodo, canal, cliente, codigo, comunicacion, cuenta_ids, cuentas, con_dato_por_cuenta }]
//                 lo que corre en varias cuentas (sale de las filas de rango viejas de PAUTADOR), SIN números.
//   cuentas       { act_…: { ok, completa, estado_lectura, motivo, faltantes, fecha_lectura, canal, cliente, activo_key } }
//   faltantes     [{ cuenta_id, cuenta, canal, cliente, nivel, codigo, comunicacion, motivo }]  lo que no se pudo leer en
//                 las cuentas parciales (pedido 035)
//   clientes_sin_dato  [{ canal, cliente, motivo }]  clientes a los que les falta una cuenta: sin cliente, contenido ni comunicación
//   descartadas   [{ fila, motivo }]  filas de la lectura que no pasaron la validación o cuya cuenta no terminó bien (las de
//                 varias cuentas, sin sus números)
//   corridas_con_problemas [{ corrida, motivo }]
function alcanceDeHoy(entrada, { ahora = new Date() } = {}) {
  const { fecha: hoy, hora } = enArgentina(ahora);
  const e = Array.isArray(entrada) ? { alcance: entrada } : (entrada && typeof entrada === 'object' ? entrada : {});
  const filas = (Array.isArray(e.alcance) ? e.alcance : []).filter((f) => f && typeof f === 'object');
  const corridas = (Array.isArray(e.corridas) ? e.corridas : []).filter((c) => c && typeof c === 'object');

  const fechas = [...filas, ...corridas].map((f) => fechaDe(f.fecha_lectura)).filter((x) => RE_FECHA.test(x)).sort();
  const ultima = fechas.length ? fechas[fechas.length - 1] : null;
  const sinDato = (motivo, extra = {}) => ({ estado: 'sin_dato', fecha: hoy, fechaLectura: null, deHoy: false, hoy, fechas_por_canal: {}, motivo, ultima_fecha: ultima,
    niveles: nivelesVacios(), entre_cuentas: [], cuentas: {}, faltantes: [], clientes_sin_dato: [], descartadas: [], corridas_con_problemas: [], ...extra });

  // 0) Última lectura de cada canal: la fecha más reciente (que no pase de hoy) con filas y corridas de ese canal. Si un canal
  // solo tiene corridas (la lectura no dejó filas), se usa la última de sus corridas, para poder explicar qué pasó.
  const fechasDe = (lista) => {
    const m = new Map();
    for (const x of lista) {
      const d = fechaDe(x.fecha_lectura);
      if (!RE_FECHA.test(d) || d > hoy) continue;
      const g = grupoDe(x.canal);
      (m.get(g) || m.set(g, new Set()).get(g)).add(d);
    }
    return m;
  };
  const conFilas = fechasDe(filas), conCorr = fechasDe(corridas);
  const corrSinCanal = conCorr.get('') || new Set();
  const fechaPorGrupo = {};
  for (const g of new Set([...conFilas.keys(), ...conCorr.keys()])) {
    if (!g) continue;
    const corrG = conCorr.get(g) || new Set();
    const completas = [...(conFilas.get(g) || [])].filter((d) => corrG.has(d) || corrSinCanal.has(d)).sort();
    if (completas.length) fechaPorGrupo[g] = completas.pop();
    else if (corrG.size) fechaPorGrupo[g] = [...corrG].sort().pop();
  }
  if (!Object.keys(fechaPorGrupo).length && corrSinCanal.size && conFilas.size === 0) fechaPorGrupo[''] = [...corrSinCanal].sort().pop();
  const elegidas = Object.values(fechaPorGrupo);

  if (!elegidas.length) {
    let motivo;
    // Sin ninguna lectura: antes de las 9:00 se explica por el horario (lo normal hasta que PAUTADOR lee); después, que no trajo nada.
    if (filas.some((f) => RE_FECHA.test(fechaDe(f.fecha_lectura)) && fechaDe(f.fecha_lectura) <= hoy)) motivo = 'Hay filas de lectura pero la lectura no dejó el estado de las cuentas: no se puede saber si están completas.';
    else if (ultima && ultima > hoy) motivo = `La última lectura tiene fecha futura (${ultima}).`;
    else if (hora < HORA_LECTURA) motivo = `Todavía no hay ninguna lectura de alcance de Meta (PAUTADOR lee a las ${HORA_LECTURA}:00).`;
    else if (hora < HORA_LIMITE) motivo = `La primera lectura de alcance de Meta todavía no terminó (PAUTADOR tiene hasta las ${HORA_LIMITE}:00).`;
    else if (!filas.length && !corridas.length) motivo = 'La lectura de alcance no trajo nada.';
    else motivo = 'No hay ninguna lectura de alcance de Meta.';
    return sinDato(motivo);
  }

  // Una fila o corrida entra si es de la lectura elegida de su canal. Las de un canal sin lectura elegida (canal desconocido,
  // filas sin corridas) entran si son de la misma fecha que la más nueva: así se descartan con su motivo y no desaparecen.
  const masNueva = [...elegidas].sort().pop();
  const delGrupo = (x) => {
    const g = grupoDe(x.canal), d = fechaDe(x.fecha_lectura);
    if (g && g in fechaPorGrupo) return fechaPorGrupo[g] === d;
    return d === masNueva;
  };
  const corridasLectura = corridas.filter(delGrupo);
  const deLectura = filas.filter(delGrupo);
  const fechaLectura = masNueva;
  const deHoy = elegidas.every((d) => d === hoy);
  const fechasPorCanal = Object.fromEntries(Object.entries(fechaPorGrupo).filter(([g]) => g));
  const cuando = deLaLectura(fechaLectura, hoy);
  // Por qué no es la de hoy (solo si no lo es)
  let porQueNoHoy = null;
  if (!deHoy) {
    if (corridas.some((c) => fechaDe(c.fecha_lectura) === hoy)) porQueNoHoy = 'La lectura de hoy no dejó datos';
    else if (hora < HORA_LECTURA) porQueNoHoy = `Todavía no se leyó hoy (PAUTADOR lee a las ${HORA_LECTURA}:00)`;
    else if (hora < HORA_LIMITE) porQueNoHoy = `La lectura de hoy todavía no terminó (PAUTADOR tiene hasta las ${HORA_LIMITE}:00)`;
    else porQueNoHoy = 'No hay lectura de hoy';
  }
  const aviso = porQueNoHoy ? `${porQueNoHoy}: se muestra la lectura ${cuando}.` : null;
  const meta = { fecha: fechaLectura, fechaLectura, deHoy, hoy, fechas_por_canal: fechasPorCanal, aviso };

  const { porCuenta, problemas: corridasConProblemas } = cuentasDeLectura(corridasLectura, hoy);
  if (!porCuenta.size) {
    return sinDato('Hay filas de lectura pero la lectura no dejó el estado de las cuentas: no se puede saber si están completas.', { corridas_con_problemas: corridasConProblemas });
  }

  // 1) Validación fila por fila
  const descartadas = [];
  const validas = [];
  for (const f of deLectura) {
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

  // 3) Clientes a los que les falta una cuenta (por canal; "Ambos" = cualquier canal), y lo que les faltó a las parciales
  const incompletos = new Map();   // `${canal}|${cliente}` → motivo
  const clientesIncompletos = new Map();   // cliente → motivo (para "Ambos")
  const faltaPorCliente = new Map();   // `${canal}|${cliente}|cuenta|` o `…|contenido|COD` o `…|comunicacion|nombre` → [faltante]
  const faltantesSalida = [];
  for (const c of porCuenta.values()) {
    if (c.ok) {
      for (const x of c.faltantes) {
        faltantesSalida.push({ cuenta_id: c.cuenta_id, canal: c.canal, cliente: c.cliente, ...x });
        if (!c.cliente) continue;
        const k = x.nivel === 'cuenta' ? 'cuenta|' : x.nivel === 'contenido' ? `contenido|${x.codigo}` : x.nivel === 'comunicacion' ? `comunicacion|${x.comunicacion}` : null;
        if (!k) continue;
        const item = { cuenta_id: c.cuenta_id, ...x };
        for (const kk of [`${c.canal}|${c.cliente}|${k}`, `*|${c.cliente}|${k}`]) (faltaPorCliente.get(kk) || faltaPorCliente.set(kk, []).get(kk)).push(item);
      }
      continue;
    }
    if (!c.cliente) continue;
    const motivo = `Falta la lectura ${deLaLectura(c.fecha_lectura, hoy)} de una de sus cuentas (${c.cuenta_id}): ${c.motivo}`;
    if (!incompletos.has(`${c.canal}|${c.cliente}`)) incompletos.set(`${c.canal}|${c.cliente}`, motivo);
    if (!clientesIncompletos.has(c.cliente)) clientesIncompletos.set(c.cliente, motivo);
  }

  // 4) Cada fila tiene que venir de cuentas que se leyeron bien, y no ser algo que faltó
  const niveles = nivelesVacios();
  const entre = [];
  for (const f of unicas) {
    const cuentas = cuentasDe(f);
    const mal = cuentas.find((c) => !porCuenta.has(c) || !porCuenta.get(c).ok);
    if (mal) {
      const c = porCuenta.get(mal);
      descartadas.push({ fila: f, motivo: c ? `la cuenta ${mal} no se leyó bien en la lectura ${deLaLectura(c.fecha_lectura, hoy)}: ${c.motivo}` : `la cuenta ${mal} no tiene corrida en la lectura ${deLaLectura(fechaDe(f.fecha_lectura), hoy)}` });
      continue;
    }
    if (NIVELES_ENTRE_CUENTAS.includes(f.nivel) || NIVELES_POR_CUENTA_DE_CLIENTE.includes(f.nivel)) {
      const canal = texto(f.canal), cliente = texto(f.cliente);
      const falta = canal === 'Ambos' ? clientesIncompletos.get(cliente) : incompletos.get(`${canal}|${cliente}`);
      if (falta) { descartadas.push({ fila: f, motivo: `al cliente ${cliente} le falta una cuenta en la lectura` }); continue; }
    }
    const falto = faltoEnLectura(f, porCuenta, faltaPorCliente);
    if (falto) { descartadas.push({ fila: f, motivo: `no se pudo leer ${queFalto(falto)} en la cuenta ${falto.cuenta_id || texto(f.cuenta_id)}: no se usa` }); continue; }
    if (booleano(f.exacto) === false) entre.push(aEntreCuentas(f));   // varias cuentas: sin números
    else niveles[f.nivel].push(normalizar(f));
  }

  // Nombre legible de cada cuenta (el activo de PAUTADOR) y si hay dato exacto por cuenta para lo que corre en varias
  const nombres = nombresDeCuentas(niveles);
  for (const x of entre) {
    x.cuentas = x.cuenta_ids.map((id) => nombres.get(id) || SIN_NOMBRE);
    const deCadaCuenta = filasPorCuenta(niveles, x.nivel, { periodo: x.periodo, canal: x.canal, cliente: x.cliente, clave: x[CLAVE_DE[x.nivel]] });
    x.con_dato_por_cuenta = x.cuenta_ids.every((id) => deCadaCuenta.has(id));
  }
  faltantesSalida.forEach((x) => { x.cuenta = nombres.get(x.cuenta_id) || SIN_NOMBRE; });

  const cuentasSalida = {};
  for (const c of porCuenta.values()) {
    cuentasSalida[c.cuenta_id] = { ok: c.ok, completa: c.completa, estado_lectura: c.estado_lectura, motivo: c.motivo || null, detalle: c.detalle, faltantes: c.faltantes,
      fecha_lectura: c.fecha_lectura, canal: c.canal, cliente: c.cliente, activo_key: c.activo_key };
  }
  const clientesSinDato = [...incompletos.entries()].map(([k, motivo]) => { const [canal, cliente] = k.split('|'); return { canal, cliente, motivo }; });
  const descartadasSinSumas = descartadas.map((d) => ({ ...d, fila: sinSumas(d.fila) }));
  const hayDato = NIVELES.some((n) => niveles[n].length) || entre.length;
  if (!hayDato) {
    const algunaOk = [...porCuenta.values()].some((c) => c.ok);
    const motivo = (!algunaOk ? `En la lectura ${cuando} no se pudo leer ninguna cuenta.` : deLectura.length ? `La lectura ${cuando} vino con errores en todas las filas.` : `La lectura ${cuando} terminó sin filas.`)
      + (porQueNoHoy ? ` ${porQueNoHoy}.` : '');
    // fecha = la lectura que se miró (sin datos); fechaLectura queda null porque no hay ninguna lectura que sirva
    return sinDato(motivo, { fecha: fechaLectura, fecha_intentada: fechaLectura, fechas_por_canal: fechasPorCanal, cuentas: cuentasSalida, faltantes: faltantesSalida,
      clientes_sin_dato: clientesSinDato, descartadas: descartadasSinSumas, corridas_con_problemas: corridasConProblemas });
  }
  const todoBien = !descartadas.length && !clientesSinDato.length && !corridasConProblemas.length && [...porCuenta.values()].every((c) => c.ok && c.completa);
  return { estado: todoBien ? 'ok' : 'parcial', ...meta, ultima_fecha: ultima, niveles, entre_cuentas: entre, cuentas: cuentasSalida, faltantes: faltantesSalida,
    clientes_sin_dato: clientesSinDato, descartadas: descartadasSinSumas, corridas_con_problemas: corridasConProblemas };
}

function nivelesVacios() { return Object.fromEntries(NIVELES.map((n) => [n, []])); }

// cuenta_id → nombre legible (el activo de PAUTADOR), de cualquier fila exacta que lo traiga.
function nombresDeCuentas(niveles) {
  const nombres = new Map();
  for (const n of NIVELES) for (const d of (niveles && niveles[n]) || []) if (d.cuenta_id && d.activo && !nombres.has(d.cuenta_id)) nombres.set(d.cuenta_id, d.activo);
  return nombres;
}

// Filas exactas, una por cuenta, de un cliente / contenido / comunicación: cuenta_id → fila.
//   cliente       filas de nivel `cuenta` del cliente (en ese canal; "Ambos" o sin canal = todos los canales) y su fila exacta
//   contenido     filas `contenido_cuenta` y, si no está esa cuenta, la fila exacta de `contenido` (una sola cuenta)
//   comunicación  igual, con `comunicacion_cuenta` y `comunicacion`
function filasPorCuenta(niveles, nivel, { periodo, canal, cliente, clave }) {
  const campo = CLAVE_DE[nivel];
  const coincide = (d) => d.periodo === periodo && d.cliente === cliente
    && (!canal || canal === 'Ambos' || d.canal === canal)
    && (!campo || (campo === 'codigo' ? d.codigo === texto(clave).toUpperCase() : d.comunicacion === texto(clave)));
  const salida = new Map();
  const fuentes = [POR_CUENTA_DE[nivel], nivel];   // la fila exacta del nivel también es de una sola cuenta
  for (const n of fuentes) {
    for (const d of (niveles && niveles[n]) || []) {
      if (!coincide(d) || !d.cuenta_id || salida.has(d.cuenta_id)) continue;
      salida.set(d.cuenta_id, d);
    }
  }
  return salida;
}

// Un elemento de la lista por cuenta: nombre legible (nunca el id) y los números exactos dentro de esa cuenta.
function itemPorCuenta(d, nombres) {
  return {
    cuenta: d.activo || (nombres && nombres.get(d.cuenta_id)) || SIN_NOMBRE,
    alcance: d.alcance, impresiones: d.impresiones, frecuencia: d.frecuencia,
    periodo: d.periodo, desde: d.fecha_desde, hasta: d.fecha_hasta,
    gasto: d.gasto, canal: d.canal, fecha_lectura: d.fecha_lectura,
  };
}
const ordenPorAlcance = (a, b) => (b.alcance - a.alcance) || a.cuenta.localeCompare(b.cuenta, 'es');

// ---------- Lo que baja Extracción → alcanceDeHoy ----------
// Extracción baja las dos tablas dentro de la extracción (borrador/_extraer.js) y deja en _proyectos.json:
//   alcanceMeta      filas de meta_alcance_diario de la última lectura de cada canal (Oficial + Informativo juntas)
//   alcanceCorridas  filas de meta_alcance_corridas de esa misma fecha
//   alcanceFecha     la fecha de la última lectura (la más nueva de los dos canales; null si no hay ninguna)
//   alcanceFechas    { Oficial, Informativo }  la de cada canal · alcanceHoy  el día en que se bajó
//   alcanceEstado    { Oficial: { alcanceMeta: { disponible, filas | motivo, detalle }, alcanceCorridas: {…} }, Informativo: {…} }
//                    disponible false = la tabla no existe todavía o la consulta dio error: ese canal no tiene dato.
// Esta función lo pasa a alcanceDeHoy como { alcance, corridas } y agrega, por canal, si se pudo leer. Devuelve lo mismo que
// alcanceDeHoy más:
//   canales          { Oficial: { disponible, motivo }, Informativo: { disponible, motivo } }
//   canales_sin_dato [{ canal, motivo }]
// Un canal sin dato no aporta nada: se sacan sus filas y corridas (si una de sus dos tablas se leyó y la otra no, no se puede
// saber si lo leído está completo). Las filas "Ambos" se sacan si falta cualquiera de los dos canales (juntan cuentas de los dos).
// Desde el 3/10 ya no se descarta lo bajado otro día: vale la última lectura, con su fecha (fechaLectura, deHoy).
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
  if (canalesSin.length === CANALES_EXTRACCION.length) {
    return vacioSin(canalesSin.map((c) => c.motivo).join(' '), canales, canalesSin);
  }

  // Se sacan las filas y corridas de los canales sin dato
  const sinCanal = new Set(canalesSin.map((c) => c.canal));
  const descartadasPrevias = [];
  const quedaFila = (f) => {
    const canal = texto(f && f.canal);
    if (sinCanal.has(canal)) { descartadasPrevias.push({ fila: f, motivo: canales[canal].motivo }); return false; }
    if (canal === 'Ambos' && sinCanal.size) { descartadasPrevias.push({ fila: f, motivo: `el dato de los dos canales junta cuentas de ${[...sinCanal].join(' y ')}, que no tiene dato` }); return false; }
    return true;
  };
  const alcance = (Array.isArray(d.alcanceMeta) ? d.alcanceMeta : []).filter(quedaFila);
  const corridas = (Array.isArray(d.alcanceCorridas) ? d.alcanceCorridas : []).filter((c) => !sinCanal.has(texto(c && c.canal)));

  const r = alcanceDeHoy({ alcance, corridas }, { ahora });
  r.canales = canales;
  r.canales_sin_dato = canalesSin;
  if (descartadasPrevias.length) r.descartadas = [...descartadasPrevias.map((x) => ({ ...x, fila: sinSumas(x.fila) })), ...(r.descartadas || [])];
  if (canalesSin.length) {
    if (r.estado === 'ok') r.estado = 'parcial';
    if (r.estado === 'sin_dato') r.motivo = [r.motivo, ...canalesSin.map((c) => c.motivo)].filter(Boolean).join(' ');
  }
  return r;
}

// Busca el dato de la última lectura de una cosa concreta. consulta: { nivel, periodo, y lo que la identifica: cuenta_id |
// campana_id | conjunto_id | anuncio_id | cliente (+ canal) | codigo (+ cliente, canal) | comunicacion (+ cliente, canal) }.
// Para niveles de campaña, conjunto o anuncio conviene pasar también cuenta_id: así, si falta, se sabe si fue por la cuenta.
// Cliente sin canal (o con canal "Ambos") = todas sus cuentas, de los dos canales.
// Todo resultado con dato trae fechaLectura (AAAA-MM-DD) y deHoy (false = la app muestra "al dd/mm"). Si mezcla canales con
// lecturas de distinta fecha, fechaLectura es la más vieja y deHoy es true solo si todas son de hoy.
// Devuelve, nunca con números que junten cuentas:
//   { estado: 'ok', dato, fechaLectura, deHoy }    una sola cuenta: el dato exacto (fila normalizada)
//   { estado: 'por_cuenta', nivel, periodo, cliente, canal, motivo, cuentas: [item], fechaLectura, deHoy }
//                                                  varias cuentas: el alcance exacto dentro de cada una; nunca un total
//   { estado: 'sin_dato_por_cuenta', nivel, periodo, cliente, canal, motivo, cuentas_involucradas: [nombre],
//     cuentas_con_dato: [item], referencia, fechaLectura, deHoy }
//                                                  varias cuentas y falta el dato de alguna para este nivel.
//                                                  referencia = { alcance_de: 'toda la cuenta', aviso, cuentas: [item] }: el
//                                                  alcance de TODA la cuenta (no solo de esto) en el mismo período, si existe;
//                                                  null en el nivel cliente
//   { estado: 'sin_dato', motivo, caso? }          caso 'sin_fila' = la lectura no trae fila para esto
// item = { cuenta (nombre legible, nunca el id), alcance, impresiones, frecuencia, periodo, desde, hasta, gasto, canal,
// fecha_lectura }, ordenados de mayor a menor alcance.
const NIVEL_TXT = { cliente: 'el cliente', contenido: 'el contenido', comunicacion: 'la comunicación' };
const listaNombres = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs.join(''));
function conFecha(r, fechasLista, hoy) {
  const fs = [...new Set(fechasLista.filter(Boolean))].sort();
  const fechaLectura = fs[0] || null;
  return { ...r, fechaLectura, deHoy: !!fechaLectura && fs.every((x) => x === hoy) };
}
function datoDeHoy(resultado, consulta = {}) {
  const sin = (motivo, caso) => (caso ? { estado: 'sin_dato', motivo, caso } : { estado: 'sin_dato', motivo });
  if (!resultado || !['ok', 'parcial'].includes(resultado.estado)) return sin((resultado && resultado.motivo) || 'No hay ninguna lectura de alcance de Meta.');
  const { nivel, periodo } = consulta;
  if (!NIVELES.includes(nivel)) return sin(`Nivel desconocido: ${nivel}.`);
  if (!PERIODOS_POR_NIVEL[nivel].includes(periodo)) return sin(`El período ${periodo} no se lee para el nivel ${nivel}.`);
  const hoy = resultado.hoy || (resultado.deHoy ? resultado.fechaLectura : null);
  const fechaRes = resultado.fechaLectura || resultado.fecha;
  const cuando = fechaRes ? deLaLectura(fechaRes, hoy) : 'de hoy';
  const niveles = resultado.niveles || {};
  const lista = niveles[nivel] || [];
  const canal = texto(consulta.canal), cliente = texto(consulta.cliente);

  if (NIVELES_ENTRE_CUENTAS.includes(nivel)) {
    // Un canal sin dato: si se pregunta por ese canal, por "Ambos" o sin canal (todas las cuentas), la lista quedaría
    // incompleta: sin dato, con el motivo del canal.
    const canalCaido = (resultado.canales_sin_dato || []).find((x) => !canal || canal === 'Ambos' || x.canal === canal);
    if (canalCaido) return sin(canalCaido.motivo);
    // Cliente al que le falta una cuenta: no se muestra ninguna (la lista quedaría incompleta)
    const falta = (resultado.clientes_sin_dato || []).find((x) => x.cliente === cliente && (!canal || canal === 'Ambos' || x.canal === canal));
    if (falta) return sin(falta.motivo);
    const campo = CLAVE_DE[nivel];
    const clave = campo ? texto(consulta[campo]) : '';
    const claveOk = (x) => !campo || (campo === 'codigo' ? x.codigo === clave.toUpperCase() : x.comunicacion === clave);
    const enCanal = (x) => !canal || canal === 'Ambos' || x.canal === canal;
    const nombres = nombresDeCuentas(niveles);
    const deCada = filasPorCuenta(niveles, nivel, { periodo, canal, cliente, clave });
    const entre = (resultado.entre_cuentas || []).filter((x) => x.nivel === nivel && x.periodo === periodo && x.cliente === cliente && enCanal(x) && claveOk(x));
    // Lo que no se pudo leer en una cuenta parcial (pedido 035): esa cuenta también es una de las esperadas, sin dato.
    const faltoAca = (resultado.faltantes || []).filter((x) => x.cliente === cliente && enCanal(x)
      && (nivel === 'cliente' ? x.nivel === 'cuenta' : nivel === 'contenido' ? x.nivel === 'contenido' && x.codigo === clave.toUpperCase() : x.nivel === 'comunicacion' && x.comunicacion === clave));
    const esperadas = [...new Set([...entre.flatMap((x) => x.cuenta_ids), ...deCada.keys(), ...faltoAca.map((x) => x.cuenta_id)])];
    if (esperadas.length) {
      const items = [...deCada.values()].map((d) => itemPorCuenta(d, nombres)).sort(ordenPorAlcance);
      const fechasItems = [...deCada.values()].map((d) => d.fecha_lectura);
      const base = { nivel, periodo, cliente, canal: canal || null };
      const faltan = esperadas.filter((id) => !deCada.has(id));
      if (faltan.length) {
        const involucradas = esperadas.map((id) => nombres.get(id) || SIN_NOMBRE).sort((a, b) => a.localeCompare(b, 'es'));
        let referencia = null;
        if (nivel !== 'cliente' && PERIODOS_POR_NIVEL.cuenta.includes(periodo)) {
          const deCuenta = (niveles.cuenta || []).filter((d) => d.periodo === periodo && esperadas.includes(d.cuenta_id));
          referencia = { alcance_de: 'toda la cuenta', aviso: `Es el alcance de toda la cuenta en el período, no solo de ${NIVEL_TXT[nivel]}.`, cuentas: deCuenta.map((d) => itemPorCuenta(d, nombres)).sort(ordenPorAlcance) };
        }
        const conDato = items.length ? ` Hay dato de ${items.length} de esas cuentas.` : '';
        const noLeidas = faltoAca.filter((x) => faltan.includes(x.cuenta_id));
        const porQue = noLeidas.length
          ? `en la lectura ${cuando} no se pudo leer en ${listaNombres([...new Set(noLeidas.map((x) => nombres.get(x.cuenta_id) || x.cuenta || SIN_NOMBRE))])}`
          : 'PAUTADOR todavía no deja el alcance dentro de cada cuenta';
        return conFecha({ estado: 'sin_dato_por_cuenta', ...base,
          motivo: `Sin dato por cuenta todavía: ${NIVEL_TXT[nivel]} corre en ${esperadas.length} cuentas (${listaNombres(involucradas)}) y ${porQue}. El alcance no se suma entre cuentas.${conDato}`,
          cuentas_involucradas: involucradas, cuentas_con_dato: items, referencia }, fechasItems.length ? fechasItems : [fechaRes], hoy);
      }
      if (deCada.size === 1) {
        const exacta = lista.find((d) => d.periodo === periodo && d.cliente === cliente && enCanal(d) && claveOk(d) && d.cuenta_id === esperadas[0]);
        const dato = exacta || [...deCada.values()][0];
        return conFecha({ estado: 'ok', dato }, [dato.fecha_lectura], hoy);
      }
      return conFecha({ estado: 'por_cuenta', ...base,
        motivo: `Corre en ${items.length} cuentas. Meta no junta a las personas entre cuentas: el alcance se da dentro de cada cuenta y no se suma.`,
        cuentas: items }, fechasItems, hoy);
    }
  } else {
    let candidatos;
    if (NIVELES_POR_CUENTA_DE_CLIENTE.includes(nivel)) {
      const campo = CLAVE_DE[nivel], clave = texto(consulta[campo]);
      candidatos = lista.filter((d) => d.periodo === periodo && d.cuenta_id === texto(consulta.cuenta_id) && d.cliente === cliente
        && (!canal || d.canal === canal) && (campo === 'codigo' ? d.codigo === clave.toUpperCase() : d.comunicacion === clave));
    } else {
      const campo = { cuenta: 'cuenta_id', campana: 'campana_id', conjunto: 'conjunto_id', anuncio: 'anuncio_id' }[nivel];
      candidatos = lista.filter((d) => d.periodo === periodo && d[campo] === texto(consulta[campo]));
    }
    if (candidatos.length === 1) return conFecha({ estado: 'ok', dato: candidatos[0] }, [candidatos[0].fecha_lectura], hoy);
  }

  // No hay fila: se explica por qué, si se puede saber.
  const canalSin = (resultado.canales_sin_dato || []).find((x) => canal && (x.canal === canal || canal === 'Ambos'));
  if (canalSin) return sin(canalSin.motivo);
  const cuenta = texto(consulta.cuenta_id);
  const c = cuenta && resultado.cuentas && resultado.cuentas[cuenta];
  if (cuenta && !c) return sin(`La cuenta ${cuenta} no está en la lectura ${cuando}.`);
  if (c && !c.ok) return sin(c.motivo);
  if (c && c.faltantes && c.faltantes.length) {
    const deEsta = c.faltantes.find((x) => x.nivel === (nivel === 'contenido_cuenta' ? 'contenido' : nivel === 'comunicacion_cuenta' ? 'comunicacion' : nivel)
      && (!CLAVE_DE[nivel] || (CLAVE_DE[nivel] === 'codigo' ? x.codigo === texto(consulta.codigo).toUpperCase() : x.comunicacion === texto(consulta.comunicacion))));
    if (deEsta) return sin(`En la lectura ${deLaLectura(c.fecha_lectura, hoy)} no se pudo leer ${queFalto(deEsta)} de esa cuenta.`);
  }
  if (periodo === 'mes_en_curso' && fechaRes && fechaRes.endsWith('-01')) return sin('El primer día del mes todavía no hay mes en curso.');
  // El texto "No hay dato de hoy para esto" lo reconoce app/armar.js (Interfaz): se conserva igual cuando la lectura es de hoy.
  const motivo = cuando === 'de hoy'
    ? 'No hay dato de hoy para esto (puede no haber tenido gasto en los últimos 30 días).'
    : `No hay dato para esto en la lectura ${cuando} (puede no haber tenido gasto en los últimos 30 días).`;
  return sin(motivo, 'sin_fila');
}

module.exports = {
  alcanceDeHoy, alcanceDeExtraccion, datoDeHoy, problemaDeFila, enArgentina, faltantesDe,
  // Nombres que dicen lo que hacen desde el 3/10 (la última lectura, no solo la de hoy). Son las mismas funciones.
  alcanceDeUltimaLectura: alcanceDeHoy, datoDeUltimaLectura: datoDeHoy,
  NIVELES, PERIODOS_POR_NIVEL, ESTADOS_CORRIDA, HORA_LECTURA, HORA_LIMITE,
};
