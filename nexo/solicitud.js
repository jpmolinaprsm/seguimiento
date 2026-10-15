// Nexo con PAUTADOR (lado Seguimiento) · de recomendación aceptada a solicitud de cambio.
// Dueño: agente Nexo con PAUTADOR (lado Seguimiento). Contrato: orquestacion/CONTRATOS/cambios-seguimiento-a-pautador.md,
// con los ajustes de la respuesta de Seguimiento en orquestacion/BUZON/pedido-006 (Seguimiento manda ids de anuncio + códigos y el
// cambio en %; PAUTADOR resuelve cuenta, campaña y conjunto de Meta y completa los valores antes y después).
//
// Qué hace: toma una recomendación ya aceptada (la tarjeta que arma app/redaccion.js, o una con la misma forma) y decide:
//   { tipo: 'solicitud', solicitud, manuales }   encaja en el catálogo y pasó los controles que se pueden ver de este lado;
//                                      manuales = conjuntos que quedaron afuera porque su nombre tiene varios ids en Meta
//   { tipo: 'manual', motivo, manuales? }  no encaja en el catálogo (o ningún conjunto se puede mandar): tarea manual
// Desde el 30/9 cada conjunto de la tarjeta puede traer, como los baja Datos en `conjuntos`, `ads` (ids de anuncio) y `conjuntoId`
// (id del conjunto de Meta, o varios separados por coma si hubo conjuntos distintos con el mismo nombre en el mes).
//   { tipo: 'bloqueada', control, motivo }  encaja, pero un control de seguridad (reglas v0.3, sección D) no deja mandarla
// Desde el 1/10 (decisión N7 de Juan Pablo): si un nombre de conjunto tiene varios ids, se manda al único id que gastó en los últimos
// 2 días, con los ids de anuncio de ESE id (ctx.conjuntosPorId, la tabla que baja Extracción). Si gastaron ninguno o varios, o falta
// el dato, ese conjunto queda a mano.
// Textos de tarea manual y de bloqueo: los que propuso Recomendaciones el 30/9 (decisión N5, 1/10): empiezan con "Se hace a mano:",
// sin jerga, y las fechas van en día y mes.
// No manda nada: el envío es de nexo/cliente.js.
//
// También tiene el control de quién pide (revisarPermiso): desde el 30/9 el pedido del implementador del proyecto cuenta como la
// aprobación, así que una solicitud solo sale si quien la pide es implementador o administrador de ESE proyecto y está activo, según
// el sistema de usuarios de PAUTADOR (orquestacion/CONTRATOS/consulta-accesos.md). Si no se puede saber el rol, no se manda.
const crypto = require('crypto');

const ACCION = { PAUSAR: 'Pausar', PRESUPUESTO: 'Cambiar presupuesto' };
const CATALOGO_ACCIONES = [ACCION.PAUSAR, ACCION.PRESUPUESTO];   // primera versión (Decisiones de Juan Pablo, 30/9/2026)
const PLATAFORMAS = ['Meta'];                                     // el nexo es solo Meta

// Controles de seguridad de la sección D de Seguimiento/documentos/reglas-recomendador-v0.3.md que se ven desde Seguimiento.
// El resto (mínimo diario de Meta, presupuesto mensual, estado real del conjunto) lo valida PAUTADOR, que tiene la última palabra.
const TOPE_PCT = 20;             // D1: máximo ±20 % del presupuesto diario por cambio
const DIAS_ENTRE_CAMBIOS = 3;    // D2: un cambio por conjunto cada 3 días. Desde el 1/10 (N3) solo para Cambiar presupuesto: pausar
                                 //     siempre se puede, porque es la acción que corta el daño
const DIAS_FINALES = 2;          // D3: nada en los últimos 2 días (se mira la fecha de fin de la campaña, si viene). Desde el 1/10
                                 //     solo para Cambiar presupuesto: pausar se puede igual, porque corta el daño (misma idea que N3)
const DIAS_GASTO_RECIENTE = 2;   // N7: con varios ids para un nombre, vale el único que gastó en los últimos 2 días

// Recomendaciones (reglas C de la v0.3) que encajan en el catálogo, y qué parte de la campaña tocan.
//   'pausar'   → solo los conjuntos que la tarjeta marca para pausar (C1: la pieza de peor costo por reacción)
//   'todos'    → todos los conjuntos de la campaña que trae la tarjeta
// nota: lo que PAUTADOR no hace y queda para hacer a mano (N4, 1/10: no hay Reactivar; volver a prender se hace a mano).
const NOTA_PAUSA_UNA_SEMANA = 'PAUTADOR pausa los conjuntos; volver a prenderlos en una semana se hace a mano.';
const ENCAJAN = {
  'Rinde por debajo': { regla: 'C1', accion: ACCION.PAUSAR, conjuntos: 'pausar',
    nota: 'PAUTADOR pausa los conjuntos de la peor pieza; pasar ese presupuesto a la mejor se pide aparte.' },
  'Se desgastó': { regla: 'C3', accion: ACCION.PAUSAR, conjuntos: 'todos', nota: NOTA_PAUSA_UNA_SEMANA },
  'Presión acumulada alta': { regla: 'C7', accion: ACCION.PAUSAR, conjuntos: 'todos', nota: NOTA_PAUSA_UNA_SEMANA },
  'Mejor momento': { regla: 'C6', accion: ACCION.PRESUPUESTO, cambioPct: 20, conjuntos: 'todos' },
  'Se comparte': { regla: 'C10', accion: ACCION.PRESUPUESTO, cambioPct: 20, conjuntos: 'todos' },
};

// Por qué las demás no se mandan (texto para la tarea manual). Redacción de Recomendaciones aprobada el 1/10 (N5), tal cual.
const A_MANO = 'Se hace a mano: ';
const NO_ENCAJAN = {
  'Peor que la temporada anterior': A_MANO + 'volver a usar las piezas y audiencias de la temporada pasada se pide en PAUTADOR como un pedido nuevo.',
  'Sin entrega': A_MANO + 'hay que revisar en el administrador de anuncios si hay rechazos, anuncios en revisión o falta presupuesto.',
  'Apagón': A_MANO + 'hay que revisar las cuentas del activo (anuncios pausados, rechazados o sin presupuesto).',
  'Pico': A_MANO + 'hay que confirmar que el aumento de gasto sea intencional.',
  'Placements débiles': A_MANO + 'sacar placements cambia la segmentación, y desde Optimización solo se puede pausar o cambiar el presupuesto.',
  'Sumar Facebook Reels': A_MANO + 'sumar un placement cambia la segmentación, y desde Optimización solo se puede pausar o cambiar el presupuesto.',
  'Genera conversación': A_MANO + 'los comentarios se leen y se moderan desde la página.',
  'Costo por objetivo': A_MANO + 'hay que revisar la pieza, la audiencia y la puja de esa red.',
  'Se abandona temprano': A_MANO + 'hay que revisar el comienzo del video (los primeros segundos).',
  'Rotar contenidos': A_MANO + 'las piezas nuevas se piden en PAUTADOR como un pedido nuevo.',
};

// Los demás textos de tarea manual y de bloqueo. Los marcados N5 son los propuestos por Recomendaciones, tal cual; los demás se
// escribieron con el mismo criterio y Juan Pablo los aprobó el 1/10.
const diaAR = (d) => new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 10);   // Argentina: UTC−3, sin horario de verano
const fechaCorta = (x) => {   // 'AAAA-MM-DD' o fecha y hora → 'dd/mm' (con hora: el día en Argentina)
  const t = String(x || '');
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : diaAR(new Date(t));
  return dia.slice(8, 10) + '/' + dia.slice(5, 7);
};
const TEXTO = {
  otraPlataforma: (p) => A_MANO + `desde Optimización los cambios son solo para Meta; en ${p} se hacen en la plataforma.`,                // N5
  sinPiezaPeor: A_MANO + 'no hay una pieza claramente peor para pausar; revisar la pieza y la audiencia, y pausar si en 2 días no mejora.', // N5
  sinIdsAnuncio: A_MANO + 'no encontramos estos conjuntos en Meta (faltan los ids de sus anuncios).',                                  // N5
  fueraDelCatalogo: A_MANO + 'desde Optimización solo se puede pausar o cambiar el presupuesto.',
  sinConjuntos: A_MANO + 'la recomendación no dice qué conjuntos tocar.',
  // N7: un nombre con varios conjuntos en Meta
  variosSinDato: (n) => A_MANO + `hay ${n} conjuntos con este nombre en Meta y no tenemos cuándo gastó cada uno, así que no sabemos a cuál aplicar el cambio.`,
  variosNinguno: (n) => A_MANO + `hay ${n} conjuntos con este nombre en Meta y ninguno gastó en los últimos ${DIAS_GASTO_RECIENTE} días, así que no sabemos a cuál aplicar el cambio.`,
  variosVarios: (n, m) => A_MANO + `hay ${n} conjuntos con este nombre en Meta y ${m} gastaron en los últimos ${DIAS_GASTO_RECIENTE} días, así que no sabemos a cuál aplicar el cambio.`,
  variosTodos: A_MANO + 'cada uno de estos conjuntos tiene más de un conjunto con el mismo nombre en Meta y no se pudo saber cuál está andando.',
  // Bloqueos (N5, con la fecha en día y mes)
  d1: (pct) => `No se puede pedir: el cambio es de ${pct} %, y el máximo es ${TOPE_PCT} % por vez.`,
  d1Cero: 'No se puede pedir: el cambio de presupuesto tiene que ser un porcentaje distinto de cero.',
  d2: (fecha) => `Todavía no: este conjunto ya tuvo un cambio el ${fechaCorta(fecha)}; se permite uno cada ${DIAS_ENTRE_CAMBIOS} días.`,
  d3: (fin) => `No se puede pedir: la campaña termina el ${fechaCorta(fin)} y en sus últimos ${DIAS_FINALES} días no se cambia el presupuesto.`,
};

// 'rechazada_persona' ya no la produce el simulador (no hay segundo paso de aprobación), pero el contrato la sigue nombrando: si algún
// día llega de PAUTADOR, tampoco cuenta como cambio hecho para el control D2.
const ESTADOS_FINALES_SIN_CAMBIO = ['rechazada_validacion', 'rechazada_persona', 'fallo'];
const DIA = 864e5;

const esMail = (x) => typeof x === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x);
const diaDe = (iso) => String(iso).slice(0, 10);
// "GSFOFIBOB10983 - SFEOQQNQSK - Obras - ..." → primer bloque del nombre del conjunto (código de la pauta)
const codigoDeNombre = (nombre) => { const m = String(nombre || '').match(/^\s*([A-Z0-9]{6,})\s*-/); return m ? m[1] : null; };

// Id único y estable: la misma recomendación, con la misma acción, aceptada el mismo día, da el mismo id. Así, si se reintenta o se
// toca dos veces el botón, PAUTADOR recibe el mismo id y no la ejecuta dos veces.
function idSolicitud(recId, accion, dia) {
  return 'sol-' + crypto.createHash('sha1').update(`${recId}|${accion}|${dia}`).digest('hex').slice(0, 16);
}

// Lista de ids: acepta una lista o un texto separado por comas (como los baja Datos en `conjuntos`: `ads`, `conjuntoId`).
// Devuelve ids de texto, sin vacíos ni repetidos, en el orden en que vienen.
const listaIds = (x) => {
  const crudo = Array.isArray(x) ? x : (x == null ? [] : String(x).split(','));
  return [...new Set(crudo.map((v) => (v == null ? '' : String(v).trim())).filter(Boolean))];
};

// Normaliza los conjuntos de la tarjeta: [{ nombre, cod, rol, anuncios: [AD_ID], conjuntoIds: [id de conjunto de Meta] }].
// Acepta texto suelto (nombre) u objetos. Los ids pueden venir como los baja Datos en `conjuntos` (texto separado por comas):
//   anuncios ← `anuncios` (lista) o `ads` (texto)            ids de anuncio de Meta (ID_del_Anuncio)
//   conjuntoIds ← `conjuntoId` o `conjunto_id` (texto o lista)  id del conjunto de Meta (ID_Conjunto). Puede traer VARIOS: DataJunta
//                 agrupa por nombre y en el mes hubo conjuntos distintos con el mismo nombre.
function conjuntosDe(rec) {
  const lista = rec.conjuntosTodos || (rec.afectado && rec.afectado.conjuntos) || rec.conjuntos || [];
  return lista.map((k) => (typeof k === 'string' ? { nombre: k } : k)).filter((k) => k && k.nombre).map((k) => ({
    ...k,
    anuncios: listaIds(k.anuncios != null ? k.anuncios : k.ads),
    conjuntoIds: listaIds(k.conjuntoId != null ? k.conjuntoId : k.conjunto_id),
  }));
}

// ---------- N7: un nombre de conjunto con varios ids de Meta ----------
// conjuntosPorId: las filas que baja Extracción (borrador/_extraer.js, `conjuntosPorId`), una por id de conjunto de Meta en 180 días:
//   { canal, cliente, conjuntoId, nombre, activo, primerGasto, ultimoGasto: 'AAAA-MM-DD', gasto, g14, ads: 'id,id,…' }
// Se usan solo conjuntoId, ultimoGasto y ads. Si un id aparece en varias filas, vale la fecha más nueva y se juntan los anuncios.
// También acepta un Map ya armado (id → { ultimoGasto, anuncios }).
function indicePorId(conjuntosPorId) {
  if (conjuntosPorId instanceof Map) return conjuntosPorId;
  const ix = new Map();
  for (const f of Array.isArray(conjuntosPorId) ? conjuntosPorId : []) {
    if (!f || typeof f !== 'object') continue;
    const id = listaIds(f.conjuntoId != null ? f.conjuntoId : f.conjunto_id);
    if (id.length !== 1) continue;   // una fila por id: si trae varios, no es una fila de esta tabla
    const ug = /^\d{4}-\d{2}-\d{2}/.test(String(f.ultimoGasto || '')) ? String(f.ultimoGasto).slice(0, 10) : null;
    const prev = ix.get(id[0]) || { ultimoGasto: null, anuncios: [] };
    ix.set(id[0], { ultimoGasto: [prev.ultimoGasto, ug].filter(Boolean).sort().pop() || null,
      anuncios: [...new Set([...prev.anuncios, ...listaIds(f.anuncios != null ? f.anuncios : f.ads)])] });
  }
  return ix;
}
// Gastó en los últimos 2 días = su último día con gasto es anteayer o después, en hora argentina (DataJunta llega hasta ayer).
const gastoReciente = (ultimoGasto, ahora) => !!ultimoGasto && ultimoGasto >= diaAR(new Date(ahora.getTime() - DIAS_GASTO_RECIENTE * DIA));
// k: conjunto con más de un id → { ok: true, conjunto (con el id elegido y SUS anuncios) } | { ok: false, manual }
function elegirConjunto(k, indice, ahora) {
  const n = k.conjuntoIds.length;
  const base = { conjunto: k.nombre, conjunto_ids: k.conjuntoIds };
  const datos = k.conjuntoIds.map((id) => ({ id, d: indice.get(id) }));
  if (datos.some((x) => !x.d)) return { ok: false, manual: { ...base, caso: 'sin_dato', motivo: TEXTO.variosSinDato(n) } };
  const recientes = datos.filter((x) => gastoReciente(x.d.ultimoGasto, ahora));
  if (!recientes.length) return { ok: false, manual: { ...base, caso: 'ninguno_gasto', motivo: TEXTO.variosNinguno(n) } };
  if (recientes.length > 1) return { ok: false, manual: { ...base, caso: 'varios_gastaron', conjunto_ids_con_gasto: recientes.map((x) => x.id), motivo: TEXTO.variosVarios(n, recientes.length) } };
  const el = recientes[0];
  return { ok: true, conjunto: { ...k, conjuntoIds: [el.id], anuncios: el.d.anuncios,
    elegido: { conjunto_id: el.id, ultimo_gasto: el.d.ultimoGasto, descartados: k.conjuntoIds.filter((id) => id !== el.id) } } };
}

// rec: la recomendación aceptada. ctx: { pedidaPor, proyecto, canal, ahora?, historial?, cambioPct? }
//   historial: lo que devuelve repositorio.historial() — solicitudes ya mandadas con su último estado (para el control D2).
//   cambioPct: si la persona ajustó el porcentaje antes de mandar (si no, el de la regla).
//   conjuntosPorId: filas de Extracción por id de conjunto (N7). Sin ellas, un nombre con varios ids queda a mano.
function aSolicitud(rec, ctx = {}) {
  if (!rec || !rec.id || !rec.tipo) throw new Error('nexo: la recomendación necesita id y tipo');
  if (!esMail(ctx.pedidaPor)) throw new Error('nexo: falta el mail de quien acepta la recomendación');
  if (!ctx.proyecto || !ctx.canal) throw new Error('nexo: falta proyecto o canal');
  const ahora = ctx.ahora ? new Date(ctx.ahora) : new Date();

  const def = ENCAJAN[rec.tipo];
  if (!def) return { tipo: 'manual', motivo: NO_ENCAJAN[rec.tipo] || TEXTO.fueraDelCatalogo };
  const plataforma = rec.plataforma || 'Meta';   // las reglas que encajan son todas de Meta (reglas/meta.js)
  if (!PLATAFORMAS.includes(plataforma)) return { tipo: 'manual', motivo: TEXTO.otraPlataforma(plataforma) };

  let conj = conjuntosDe(rec);
  if (def.conjuntos === 'pausar') {
    conj = conj.filter((k) => k.rol === 'pausar');
    if (!conj.length) return { tipo: 'manual', motivo: TEXTO.sinPiezaPeor };
  } else conj = conj.filter((k) => k.rol !== 'reforzar');
  if (!conj.length) return { tipo: 'manual', motivo: TEXTO.sinConjuntos };
  // Un nombre de conjunto con varios ids de Meta (N7): se manda al único que gastó en los últimos 2 días, con los anuncios de ese id.
  // Si gastaron ninguno o varios, o falta el dato, ese conjunto queda como tarea manual.
  const indice = indicePorId(ctx.conjuntosPorId);
  const manuales = [];
  const unicos = [];
  for (const k of conj) {
    if (k.conjuntoIds.length <= 1) { unicos.push(k); continue; }
    const e = elegirConjunto(k, indice, ahora);
    if (e.ok) unicos.push(e.conjunto); else manuales.push(e.manual);
  }
  if (!unicos.length) return { tipo: 'manual', motivo: manuales.length === 1 ? manuales[0].motivo : TEXTO.variosTodos, manuales };
  const conIds = unicos.filter((k) => k.anuncios.length);
  if (!conIds.length) return { tipo: 'manual', motivo: TEXTO.sinIdsAnuncio, manuales };

  // D1: tope de ±20 %
  let cambioPct = null;
  if (def.accion === ACCION.PRESUPUESTO) {
    cambioPct = ctx.cambioPct != null ? Number(ctx.cambioPct) : def.cambioPct;
    if (!Number.isFinite(cambioPct) || cambioPct === 0) return { tipo: 'bloqueada', control: 'D1', motivo: TEXTO.d1Cero };
    if (Math.abs(cambioPct) > TOPE_PCT) return { tipo: 'bloqueada', control: 'D1', motivo: TEXTO.d1(cambioPct) };
  }
  // D3: nada en los últimos 2 días (si la tarjeta trae la fecha de fin de la campaña). Solo para Cambiar presupuesto: pausar se
  // puede hasta el final, porque corta el daño (Juan Pablo, 1/10).
  if (def.accion === ACCION.PRESUPUESTO && rec.fin) {
    const faltan = Math.floor((new Date(diaDe(rec.fin) + 'T00:00:00Z') - new Date(diaDe(ahora.toISOString()) + 'T00:00:00Z')) / DIA);
    if (faltan <= DIAS_FINALES) return { tipo: 'bloqueada', control: 'D3', motivo: TEXTO.d3(diaDe(rec.fin)) };
  }

  const dia = diaDe(ahora.toISOString());
  const id = idSolicitud(rec.id, def.accion, dia);
  // D2: un cambio de presupuesto por conjunto cada 3 días (según lo que Seguimiento ya mandó; PAUTADOR lo vuelve a mirar con los
  // cambios reales). Desde el 1/10 (N3) vale solo para Cambiar presupuesto y cuenta solo los cambios de presupuesto anteriores:
  // pausar siempre se puede, y una pausa anterior no frena un cambio de presupuesto.
  const anuncios = new Set(conIds.flatMap((k) => k.anuncios.map(String)));
  const nombres = new Set(conIds.map((k) => k.nombre));
  const idsConjunto = new Set(conIds.flatMap((k) => k.conjuntoIds));
  for (const h of def.accion === ACCION.PRESUPUESTO ? ctx.historial || [] : []) {
    const s = h.solicitud;
    if (!s || s.id === id || s.accion !== ACCION.PRESUPUESTO) continue;
    if (h.ultimo && ESTADOS_FINALES_SIN_CAMBIO.includes(h.ultimo.estado)) continue;
    if ((ahora - new Date(s.creada)) / DIA >= DIAS_ENTRE_CAMBIOS) continue;
    const pisa = (s.objetivos || []).some((o) => nombres.has(o.conjunto) || (o.conjunto_id && idsConjunto.has(String(o.conjunto_id)))
      || (o.anuncios || []).some((a) => anuncios.has(String(a))));
    if (pisa) return { tipo: 'bloqueada', control: 'D2', motivo: TEXTO.d2(s.creada) };
  }

  const solicitud = {
    version: 1,
    id,
    recomendacion: rec.id,
    regla: def.regla,
    tipo_recomendacion: rec.tipo,
    pedida_por: ctx.pedidaPor,
    proyecto: ctx.proyecto,
    canal: ctx.canal,
    plataforma,
    campana: (rec.afectado && rec.afectado.campana) || rec.campana || rec.campId || null,
    accion: def.accion,
    nivel: 'conjunto',
    // cuenta y campaña de Meta los resuelve PAUTADOR a partir de los ids de anuncio y los códigos. conjunto_id: el id del conjunto de
    // Meta cuando DataJunta trae uno solo para ese nombre, o el único que gastó en los últimos 2 días si trae varios (N7); null si no
    // vino. PAUTADOR lo puede usar para confirmar que los anuncios son de ese conjunto. Si no se pudo elegir, queda en `manuales`.
    objetivos: conIds.map((k) => ({ conjunto: k.nombre, conjunto_id: k.conjuntoIds[0] || null, codigo: codigoDeNombre(k.nombre), codigo_contenido: k.cod || null, anuncios: k.anuncios })),
    cambio_pct: cambioPct,
    valores: null,   // antes y después: los completa PAUTADOR con el dato real de Meta
    motivo: rec.problema || rec.titulo || rec.title || rec.tipo,
    nota: def.nota || null,
    sin_ids: unicos.length - conIds.length,   // conjuntos que quedaron afuera por no tener id de anuncio
    creada: ahora.toISOString(),
  };
  // manuales: conjuntos que quedaron afuera porque su nombre tiene varios ids en Meta y no se pudo elegir; se muestran como tarea
  // manual con su motivo. elegidos: los que tenían varios ids y se mandaron al único que gastó (para mostrarlo o revisarlo; no viaja).
  const elegidos = conIds.filter((k) => k.elegido).map((k) => ({ conjunto: k.nombre, ...k.elegido }));
  return { tipo: 'solicitud', solicitud, manuales, elegidos };
}

// Revisión de forma, la misma que usa el simulador para "rechazada por validación". PAUTADOR hace la suya.
function validarForma(s) {
  const faltan = [];
  for (const k of ['id', 'recomendacion', 'pedida_por', 'proyecto', 'canal', 'plataforma', 'accion', 'motivo', 'creada']) if (!s || !s[k]) faltan.push(k);
  if (faltan.length) return `Faltan datos: ${faltan.join(', ')}.`;
  if (!esMail(s.pedida_por)) return 'El pedido no trae un mail válido de quien lo pide.';
  if (!PLATAFORMAS.includes(s.plataforma)) return `Plataforma fuera del nexo: ${s.plataforma}.`;
  if (!CATALOGO_ACCIONES.includes(s.accion)) return `Acción fuera del catálogo: ${s.accion}.`;
  if (!Array.isArray(s.objetivos) || !s.objetivos.length || s.objetivos.some((o) => !Array.isArray(o.anuncios) || !o.anuncios.length)) return 'Cada conjunto tiene que traer al menos un id de anuncio.';
  if (s.objetivos.some((o) => o.conjunto_id != null && !/^[^,\s]+$/.test(String(o.conjunto_id)))) return 'Cada conjunto tiene que traer un solo id de conjunto de Meta (o ninguno).';
  if (s.accion === ACCION.PRESUPUESTO && (!Number.isFinite(s.cambio_pct) || s.cambio_pct === 0 || Math.abs(s.cambio_pct) > TOPE_PCT)) return `El cambio de presupuesto tiene que estar entre −${TOPE_PCT} % y ${TOPE_PCT} %.`;
  if (s.accion === ACCION.PAUSAR && s.cambio_pct != null) return 'Pausar no lleva porcentaje.';
  return null;
}

// ---------- Quién puede pedir ----------
// accesos: función inyectable async (mail) → lo que devuelve PAUTADOR para ese mail, o null si el mail no existe.
// Formato acordado con PAUTADOR (orquestacion/CONTRATOS/consulta-accesos.md, "Formato acordado", 30/9), con estos nombres exactos:
//   { email, nombre,
//     habilitado: true|false,
//     rol: 'pm_cuentas'|'implementador'|'administrador',   rol general
//     administradorGlobal: true|false,
//     superadministrador: true|false,
//     accesos: [{ proyecto,
//                 activo,     clave del activo, o null = todos los activos del proyecto
//                 rol,        null = vale el rol general
//                 canales }] }  [] = todos los canales del proyecto
//
// Reglas (decisiones de Juan Pablo, 30/9):
//   - Piden cambios los implementadores del proyecto y los administradores. pm_cuentas nunca. habilitado distinto de true nunca.
//   - administradorGlobal: true (con rol general administrador) = puede pedir en todos los proyectos. Viene con accesos vacío:
//     vale por administradorGlobal, NO por la lista vacía. Un accesos vacío sin administradorGlobal no habilita nada.
//   - Sin administradorGlobal, solo cuenta la fila del proyecto (y del canal y del activo, si la fila los limita), con su rol
//     (o el general si viene null). Un rol que no es uno de los tres no pide.
//   - superadministrador se lee pero no da ningún permiso de pedir: el contrato no le asigna ninguno.
//   - Si el canal del cambio no se sabe (hoy Valle 24, El Norte Ahora y Noticia Franca no tienen canal cargado en PAUTADOR),
//     no se controla por canal, pero se devuelve un aviso.
//   - Sin respuesta, respuesta con otro formato o de otro mail: no sale.
// La función real (consulta a PAUTADOR con memoria de 5 minutos) está en nexo/accesos.js y crearNexo la usa por defecto en modo
// real. Sin función de accesos, no se manda nada.
const ROLES = ['pm_cuentas', 'implementador', 'administrador'];
const ROLES_QUE_PIDEN = ['implementador', 'administrador'];
const ESPERA_ACCESOS_MS = 5000;
const normal = (x) => String(x == null ? '' : x).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// Rol tal como lo manda PAUTADOR → uno de los tres, 'desconocido:…' o null (sin rol). Sin sinónimos: solo los tres nombres acordados.
function rolDe(x) {
  if (x == null || !normal(x)) return null;
  const r = normal(x);
  return ROLES.includes(r) ? r : 'desconocido:' + String(x).trim();
}
const nombreRol = (r) => (r === 'pm_cuentas' ? 'PM/Cuentas' : !r ? 'sin rol' : r.startsWith('desconocido:') ? r.slice(12) : r);

// Filas de accesos → [{ proyecto, activo (null = todos), rol (ya resuelto con el general), canales (vacío = todos) }]. Filas sin proyecto se ignoran.
function filasDe(accesos, rolGeneral) {
  return accesos.filter((a) => a && typeof a === 'object' && normal(a.proyecto)).map((a) => ({
    proyecto: a.proyecto,
    activo: a.activo == null || !normal(a.activo) ? null : a.activo,
    rol: a.rol == null || !normal(a.rol) ? rolGeneral : rolDe(a.rol),
    canales: Array.isArray(a.canales) ? a.canales.filter((c) => normal(c)) : [],
  }));
}

// → { ok: true, rol, alcance: 'global'|'proyecto', aviso? } | { ok: false, codigo, motivo }
//   codigos: sin_accesos · sin_respuesta · respuesta_invalida · no_existe · inactivo · otro_proyecto · rol_sin_permiso
//   opciones.activo: clave del activo del cambio, si se sabe (una fila limitada a un activo solo vale si coincide).
async function revisarPermiso(accesos, mail, proyecto, canal, { esperaMs = ESPERA_ACCESOS_MS, activo = null } = {}) {
  const no = (codigo, motivo) => ({ ok: false, codigo, motivo });
  if (typeof accesos !== 'function') return no('sin_accesos', 'No se pudo saber el rol de quien pide (todavía no hay consulta de accesos a PAUTADOR): la solicitud no se manda.');
  if (!esMail(mail)) return no('no_existe', 'El pedido no trae un mail válido de quien lo pide.');
  if (!normal(proyecto)) return no('otro_proyecto', 'El pedido no dice de qué proyecto es: la solicitud no se manda.');
  let r, timer;
  try {
    r = await Promise.race([
      Promise.resolve().then(() => accesos(mail)),
      new Promise((_, mal) => { timer = setTimeout(() => mal(new Error('tardó demasiado')), esperaMs); }),
    ]);
  } catch (e) {
    return no('sin_respuesta', `No se pudo consultar a PAUTADOR qué rol tiene ${mail} (${e.message}): la solicitud no se manda.`);
  } finally { clearTimeout(timer); }
  if (r === undefined) return no('sin_respuesta', `PAUTADOR no respondió qué rol tiene ${mail}: la solicitud no se manda.`);
  if (r === null) return no('no_existe', `${mail} no está en el sistema de usuarios de PAUTADOR.`);
  if (typeof r !== 'object' || Array.isArray(r)) return no('respuesta_invalida', `La respuesta de PAUTADOR sobre ${mail} no tiene el formato acordado: la solicitud no se manda.`);
  if (normal(r.email) !== normal(mail)) return no('respuesta_invalida', `La respuesta de PAUTADOR no es de ${mail}: la solicitud no se manda.`);
  if (r.accesos != null && !Array.isArray(r.accesos)) return no('respuesta_invalida', `La respuesta de PAUTADOR sobre ${mail} trae los accesos en un formato que no es el acordado: la solicitud no se manda.`);
  if (r.habilitado !== true) return no('inactivo', `${mail} no está habilitado en PAUTADOR.`);

  const rolGeneral = rolDe(r.rol);
  if (r.administradorGlobal === true && rolGeneral === 'administrador') return { ok: true, rol: 'administrador', alcance: 'global' };

  const filas = filasDe(r.accesos || [], rolGeneral);
  const sinCanal = !normal(canal);
  const delProyecto = filas.filter((a) => normal(a.proyecto) === normal(proyecto)
    && (sinCanal || !a.canales.length || a.canales.some((c) => normal(c) === normal(canal)))
    && (a.activo == null || (normal(activo) && normal(a.activo) === normal(activo))));
  if (!delProyecto.length) return no('otro_proyecto', `${mail} no tiene asignado el proyecto ${proyecto}${sinCanal ? '' : ` (${canal})`}.`);
  const conPermiso = delProyecto.find((a) => ROLES_QUE_PIDEN.includes(a.rol));
  if (!conPermiso) return no('rol_sin_permiso', `En ${proyecto} ${mail} tiene rol ${nombreRol(delProyecto[0].rol)}: solo el implementador del proyecto (o un administrador) puede pedir cambios.`);
  const res = { ok: true, rol: conPermiso.rol, alcance: 'proyecto' };
  if (sinCanal && conPermiso.canales.length) res.aviso = `No se sabe el canal del cambio: no se revisó que ${mail} tenga ese canal (tiene ${conPermiso.canales.join(', ')}).`;
  return res;
}

// Arma una función de accesos a partir de una lista fija con el formato acordado (para las pruebas y, en local, la lista
// provisoria hasta Railway). Busca por email.
function accesosDeLista(lista) {
  const copia = JSON.parse(JSON.stringify(lista || []));
  return async (mail) => { const u = copia.find((x) => normal(x.email) === normal(mail)); return u ? JSON.parse(JSON.stringify(u)) : null; };
}

module.exports = { aSolicitud, validarForma, revisarPermiso, accesosDeLista, ROLES_QUE_PIDEN, idSolicitud, codigoDeNombre, indicePorId, ACCION, CATALOGO_ACCIONES, ENCAJAN, NO_ENCAJAN, TEXTO, TOPE_PCT, DIAS_ENTRE_CAMBIOS, DIAS_FINALES, DIAS_GASTO_RECIENTE };
