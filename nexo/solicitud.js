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
const DIAS_ENTRE_CAMBIOS = 3;    // D2: un cambio por conjunto cada 3 días
const DIAS_FINALES = 2;          // D3: nada en los últimos 2 días (se mira la fecha de fin de la campaña, si viene)

// Recomendaciones (reglas C de la v0.3) que encajan en el catálogo, y qué parte de la campaña tocan.
//   'pausar'   → solo los conjuntos que la tarjeta marca para pausar (C1: la pieza de peor costo por reacción)
//   'todos'    → todos los conjuntos de la campaña que trae la tarjeta
const ENCAJAN = {
  'Rinde por debajo': { regla: 'C1', accion: ACCION.PAUSAR, conjuntos: 'pausar' },
  'Se desgastó': { regla: 'C3', accion: ACCION.PAUSAR, conjuntos: 'todos',
    nota: 'La recomendación dice pausar una semana: reactivar no está en el catálogo, se hace a mano.' },
  'Presión acumulada alta': { regla: 'C7', accion: ACCION.PAUSAR, conjuntos: 'todos',
    nota: 'La recomendación dice pausar una semana: reactivar no está en el catálogo, se hace a mano.' },
  'Mejor momento': { regla: 'C6', accion: ACCION.PRESUPUESTO, cambioPct: 20, conjuntos: 'todos' },
  'Se comparte': { regla: 'C10', accion: ACCION.PRESUPUESTO, cambioPct: 20, conjuntos: 'todos' },
};

// Por qué las demás no se mandan (texto para la tarea manual).
const NO_ENCAJAN = {
  'Peor que la temporada anterior': 'Retomar piezas y audiencias no es una acción del catálogo (Pausar o Cambiar presupuesto): va por un pedido normal.',
  'Sin entrega': 'Es una revisión (rechazos, revisión o presupuesto), no un cambio: se hace a mano.',
  'Apagón': 'Es una revisión de las cuentas del activo, no un cambio: se hace a mano.',
  'Pico': 'Es una confirmación de que el gasto sea intencional, no un cambio: se hace a mano.',
  'Placements débiles': 'Excluir placements cambia la segmentación y no está en el catálogo: se pide a mano.',
  'Sumar Facebook Reels': 'Habilitar un placement cambia la segmentación y no está en el catálogo: se pide a mano.',
  'Genera conversación': 'Leer y moderar comentarios siempre se hace a mano.',
  'Costo por objetivo': 'Es una revisión de pieza, audiencia y puja, no un cambio: se hace a mano.',
  'Se abandona temprano': 'Es una revisión de la pieza, no un cambio: se hace a mano.',
  'Rotar contenidos': 'Pedir piezas nuevas va por un pedido normal de PAUTADOR (reglas v0.3, D6).',
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
const MOTIVO_VARIOS_CONJUNTOS = (k) => `Hay más de un conjunto con este nombre en Meta (${k.conjuntoIds.length}: ${k.conjuntoIds.join(', ')}): no se sabe a cuál aplicar el cambio, se hace a mano.`;

// rec: la recomendación aceptada. ctx: { pedidaPor, proyecto, canal, ahora?, historial?, cambioPct? }
//   historial: lo que devuelve repositorio.historial() — solicitudes ya mandadas con su último estado (para el control D2).
//   cambioPct: si la persona ajustó el porcentaje antes de mandar (si no, el de la regla).
function aSolicitud(rec, ctx = {}) {
  if (!rec || !rec.id || !rec.tipo) throw new Error('nexo: la recomendación necesita id y tipo');
  if (!esMail(ctx.pedidaPor)) throw new Error('nexo: falta el mail de quien acepta la recomendación');
  if (!ctx.proyecto || !ctx.canal) throw new Error('nexo: falta proyecto o canal');
  const ahora = ctx.ahora ? new Date(ctx.ahora) : new Date();

  const def = ENCAJAN[rec.tipo];
  if (!def) return { tipo: 'manual', motivo: NO_ENCAJAN[rec.tipo] || 'No es una acción del catálogo (Pausar o Cambiar presupuesto): se hace a mano.' };
  const plataforma = rec.plataforma || 'Meta';   // las reglas que encajan son todas de Meta (reglas/meta.js)
  if (!PLATAFORMAS.includes(plataforma)) return { tipo: 'manual', motivo: `El nexo con PAUTADOR es solo para Meta; en ${plataforma} se hace a mano.` };

  let conj = conjuntosDe(rec);
  if (def.conjuntos === 'pausar') {
    conj = conj.filter((k) => k.rol === 'pausar');
    if (!conj.length) return { tipo: 'manual', motivo: 'No hay una pieza peor identificada para pausar: la recomendación es revisar la pieza y la audiencia.' };
  } else conj = conj.filter((k) => k.rol !== 'reforzar');
  if (!conj.length) return { tipo: 'manual', motivo: 'La recomendación no trae conjuntos de anuncios para tocar.' };
  // Un nombre de conjunto con varios ids de Meta en el mes: no se elige a ciegas, ese conjunto queda como tarea manual.
  const manuales = conj.filter((k) => k.conjuntoIds.length > 1).map((k) => ({ conjunto: k.nombre, conjunto_ids: k.conjuntoIds, motivo: MOTIVO_VARIOS_CONJUNTOS(k) }));
  const unicos = conj.filter((k) => k.conjuntoIds.length <= 1);
  if (!unicos.length) return { tipo: 'manual', motivo: manuales.length === 1 ? manuales[0].motivo : 'Hay más de un conjunto con el mismo nombre en Meta para cada uno de estos conjuntos: no se sabe a cuál aplicar el cambio, se hace a mano.', manuales };
  const conIds = unicos.filter((k) => k.anuncios.length);
  if (!conIds.length) return { tipo: 'manual', motivo: 'Faltan los ids de anuncio de Meta de estos conjuntos: sin ellos PAUTADOR no puede encontrarlos.', manuales };

  // D1: tope de ±20 %
  let cambioPct = null;
  if (def.accion === ACCION.PRESUPUESTO) {
    cambioPct = ctx.cambioPct != null ? Number(ctx.cambioPct) : def.cambioPct;
    if (!Number.isFinite(cambioPct) || cambioPct === 0) return { tipo: 'bloqueada', control: 'D1', motivo: 'El cambio de presupuesto tiene que ser un porcentaje distinto de cero.' };
    if (Math.abs(cambioPct) > TOPE_PCT) return { tipo: 'bloqueada', control: 'D1', motivo: `El cambio es de ${cambioPct} %: el máximo por cambio es ${TOPE_PCT} % (más reinicia el aprendizaje del conjunto).` };
  }
  // D3: nada en los últimos 2 días (si la tarjeta trae la fecha de fin de la campaña)
  if (rec.fin) {
    const faltan = Math.floor((new Date(diaDe(rec.fin) + 'T00:00:00Z') - new Date(diaDe(ahora.toISOString()) + 'T00:00:00Z')) / DIA);
    if (faltan <= DIAS_FINALES) return { tipo: 'bloqueada', control: 'D3', motivo: `La campaña termina el ${diaDe(rec.fin)}: en los últimos ${DIAS_FINALES} días no se hacen cambios.` };
  }

  const dia = diaDe(ahora.toISOString());
  const id = idSolicitud(rec.id, def.accion, dia);
  // D2: un cambio por conjunto cada 3 días (según lo que Seguimiento ya mandó; PAUTADOR lo vuelve a mirar con los cambios reales)
  const anuncios = new Set(conIds.flatMap((k) => k.anuncios.map(String)));
  const nombres = new Set(conIds.map((k) => k.nombre));
  const idsConjunto = new Set(conIds.flatMap((k) => k.conjuntoIds));
  for (const h of ctx.historial || []) {
    const s = h.solicitud;
    if (!s || s.id === id) continue;
    if (h.ultimo && ESTADOS_FINALES_SIN_CAMBIO.includes(h.ultimo.estado)) continue;
    if ((ahora - new Date(s.creada)) / DIA >= DIAS_ENTRE_CAMBIOS) continue;
    const pisa = (s.objetivos || []).some((o) => nombres.has(o.conjunto) || (o.conjunto_id && idsConjunto.has(String(o.conjunto_id)))
      || (o.anuncios || []).some((a) => anuncios.has(String(a))));
    if (pisa) return { tipo: 'bloqueada', control: 'D2', motivo: `Uno de estos conjuntos ya tuvo un pedido de cambio el ${diaDe(s.creada)}: se permite un cambio por conjunto cada ${DIAS_ENTRE_CAMBIOS} días.` };
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
    // Meta cuando DataJunta trae uno solo para ese nombre (null si no vino); PAUTADOR lo puede usar para confirmar que los anuncios
    // son de ese conjunto. Con varios ids el conjunto no llega hasta acá (queda en `manuales`).
    objetivos: conIds.map((k) => ({ conjunto: k.nombre, conjunto_id: k.conjuntoIds[0] || null, codigo: codigoDeNombre(k.nombre), codigo_contenido: k.cod || null, anuncios: k.anuncios })),
    cambio_pct: cambioPct,
    valores: null,   // antes y después: los completa PAUTADOR con el dato real de Meta
    motivo: rec.problema || rec.titulo || rec.title || rec.tipo,
    nota: def.nota || null,
    sin_ids: unicos.length - conIds.length,   // conjuntos que quedaron afuera por no tener id de anuncio
    creada: ahora.toISOString(),
  };
  // manuales: conjuntos que quedaron afuera porque su nombre tiene varios ids en Meta; se muestran como tarea manual con su motivo.
  return { tipo: 'solicitud', solicitud, manuales };
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
// Hasta que exista la consulta real no hay función por defecto: sin función de accesos, no se manda nada.
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

module.exports = { aSolicitud, validarForma, revisarPermiso, accesosDeLista, ROLES_QUE_PIDEN, idSolicitud, codigoDeNombre, ACCION, CATALOGO_ACCIONES, ENCAJAN, NO_ENCAJAN, TOPE_PCT, DIAS_ENTRE_CAMBIOS, DIAS_FINALES };
