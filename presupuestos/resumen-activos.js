// Resumen por activo para el módulo Activos (contrato orquestacion/CONTRATOS/nexo-activos.md, "Seguimiento → Activos").
// Un renglón por proyecto × canal × activo con lo que Seguimiento sabe del activo: pedido, gastado y restante del mes,
// ritmo de gasto, luces, alcance de Meta por cuenta (lectura de PAUTADOR) y días sin dato. Cada renglón lleva el activo_key de
// PAUTADOR (null y "sin par en PAUTADOR" si no cruza); al final, cuántos tienen y la lista de los que no (para Activos).
// Uso para probar con un _proyectos.json sin el bloque de equivalencia: node presupuestos/resumen-activos.js --equivalencia <filas.json>
// No baja datos nuevos: usa borrador/armar.js cargado como módulo (que lee _proyectos.json) y presupuestos/_activos.json.
// Escribe presupuestos/resumen-activos/AAAA-MM-DD.json y .md (fecha del armado, hora de Argentina).
// Lo compartido NO lleva ids de cuentas, nombres de cuenta, claves ni mails (se verifica al final y corta si encuentra algo).
// Uso: node presupuestos/resumen-activos.js   (después del armado diario; tarda unos segundos por el tamaño de _proyectos.json)
const fs = require('fs');
const path = require('path');
const A = require('../borrador/armar.js');
const unidades = require('./_activos.json');
const { hoyAR } = require('./pedidos');

const SALIDA = path.join(__dirname, 'resumen-activos');
const FICHAS = path.join(__dirname, '../../activos/fichas');
const EN_LINEA = [0.85, 1.02]; // proyección al cierre entre 85 % y 102 % de lo pedido (mismos cortes que presupuestos/activos.js)

// Nombre en DataJunta → nombre con el que lo conoce el módulo Activos (el de PAUTADOR). Solo las diferencias conocidas.
// "a confirmar": lo tiene que confirmar el módulo Activos cuando arme la ficha.
const NOMBRE_FICHA = {
  'La Voz Litoral': { nombre: 'La Voz del Litoral', estado: 'a confirmar' },
};

const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const r0 = (x) => (x == null || !isFinite(x) ? null : Math.round(x));
const n = (x) => (x == null || x === '' ? null : Number(x));
const { DATA, MES, datosHasta, luz, plataformasPor, PROYECTOS } = A;

// fichas existentes del módulo Activos (solo se lee la lista de archivos)
const fichas = fs.existsSync(FICHAS) ? fs.readdirSync(FICHAS).filter((f) => /\.md$/i.test(f) && f !== 'PLANTILLA.md') : [];
const fichaDe = (nombre) => fichas.find((f) => slug(f.replace(/\.md$/i, '')) === slug(nombre)) || null;

// planilla del mes de la app, por unidad (misma clave que armar: nombre de la cuenta + plataforma + canal)
const unidadPor = new Map(unidades.map((u) => [`${u.canal}|${u.plataforma}|${u.nombre}`, u]));

// alcance de Meta (lectura de PAUTADOR, partición de hoy): solo filas EXACTAS de nivel cuenta, por canal + cliente + activo.
// Regla de Juan Pablo (2/10/2026): NUNCA SE SUMA ALCANCE (ni días, ni anuncios, ni cuentas, ni como techo de un rango).
// Cada cuenta lleva su propio alcance; si un activo tiene varias cuentas, van por separado. No se leen alcance_min / alcance_max.
const F = A.fuente;
const alcancePor = {};
for (const r of F.alcanceMeta || []) {
  if (r.nivel !== 'cuenta' || !r.activo || String(r.exacto) !== 'true') continue;
  const k = `${r.canal}|${r.cliente}|${slug(r.activo)}`;
  const porCuenta = (alcancePor[k] = alcancePor[k] || {});
  const c = (porCuenta[r.cuenta_id] = porCuenta[r.cuenta_id] || {}); // el id se usa solo para agrupar: no sale en el resumen
  c[r.periodo] = { alcance: n(r.alcance),
    impresiones: n(r.impresiones), frecuencia: n(r.frecuencia) == null ? null : Math.round(n(r.frecuencia) * 100) / 100, gasto: r0(n(r.gasto)),
    desde: r.fecha_desde, hasta: r.fecha_hasta };
}
const corridaPor = {};
for (const r of F.alcanceCorridas || []) {
  const k = `${r.canal}|${r.cliente}|${String(r.activo_key || '').split('--').pop()}`;
  (corridaPor[k] = corridaPor[k] || []).push({ estado: r.estado, motivo: r.motivo || '' });
}
function alcanceDe(canal, cliente, nombres) {
  const est = ((F.alcanceEstado || {})[canal] || {}).alcanceMeta;
  if (!est || !est.disponible) return { fuente: 'Meta (lectura diaria de PAUTADOR)', lectura: 'tabla no disponible para este canal', fechaLectura: F.alcanceFecha || null, cuentas: [] };
  let porCuenta = null, corridas = null;
  for (const nm of nombres) {
    porCuenta = porCuenta || alcancePor[`${canal}|${cliente}|${slug(nm)}`];
    corridas = corridas || corridaPor[`${canal}|${cliente}|${slug(nm)}`];
  }
  const errores = (corridas || []).filter((c) => c.estado !== 'ok');
  const lectura = !corridas ? 'sin lectura (el activo no está en la lectura de PAUTADOR)' : errores.length ? 'error' : 'ok';
  return { fuente: 'Meta (lectura diaria de PAUTADOR)', lectura, motivo: errores.map((e) => e.motivo).join(' · ') || null, fechaLectura: F.alcanceFecha || null,
    cuentas: Object.values(porCuenta || {}).map((c) => ({ mes: c.mes_en_curso || null, ultimos7: c.ultimos_7 || null })) };
}

// activo_key de PAUTADOR (clave común de los módulos, decisión de Juan Pablo del 30/09; tabla automatizado.activos_equivalencia,
// pedido 018). Viene en _proyectos.json (bloque activosEquivalencia de _extraer.js). Para probar con un _proyectos.json anterior:
// --equivalencia <archivo.json> (lista de filas de la tabla). Una fila por par activo_key ↔ nombre en DataJunta (ActivoLargo, el
// nombre de la cuenta, p. ej. "Valle 24 (INF)"). Se cruza por cliente (el proyecto de la app) + canal (Mixto vale para los dos) +
// nombre: primero contra los nombres de cuenta del renglón; si no hay, contra el nombre corto (sin código ni grupo, p. ej.
// "La Invencible") para los renglones que no tienen cuenta propia. Las filas "sin par" de PAUTADOR (nombre vacío) no cruzan nunca:
// si su nombre en PAUTADOR coincide con un renglón sin par, sale como "posible" para que lo revise Activos (no se asigna).
const argEq = process.argv.indexOf('--equivalencia');
const EQ = argEq > 0 ? { filas: JSON.parse(fs.readFileSync(process.argv[argEq + 1], 'utf8')), estado: { disponible: true, fuente: 'archivo' } }
  : F.activosEquivalencia ? { filas: F.activosEquivalencia, estado: F.activosEquivalenciaEstado || { disponible: true } }
  : { filas: [], estado: { disponible: false, motivo: '_proyectos.json sin el bloque activosEquivalencia' } };
const corto = (s) => slug(String(s || '').replace(/^[A-Z0-9]{6}\s+/, '').replace(/\s*\*?\s*\([^)]*\)\s*$/, ''));
const eqCanal = (r, canal) => r.canal === canal || r.canal === 'Mixto';
const eqFilas = EQ.filas.filter((r) => r.nombre_datajunta);
function activoKeyDe(canal, cliente, nombres, cuentas) {
  if (!EQ.estado.disponible) return { activo_key: null, cruce: 'equivalencia no disponible', candidatos: [] };
  const deCliente = eqFilas.filter((r) => r.cliente === cliente && eqCanal(r, canal));
  const nc = new Set(cuentas.flatMap((c) => String(c).split(' + ')).map(slug));
  let via = 'por cuenta', hits = deCliente.filter((r) => nc.has(slug(r.nombre_datajunta)));
  if (!hits.length) { via = 'por nombre'; const nn = new Set(nombres.map(corto)); hits = deCliente.filter((r) => nn.has(corto(r.nombre_datajunta))); }
  const keys = [...new Set(hits.map((r) => r.activo_key))].sort();
  if (keys.length === 1) return { activo_key: keys[0], cruce: via, candidatos: [] };
  if (keys.length > 1) return { activo_key: null, cruce: 'varios activo_key en PAUTADOR', candidatos: keys };
  const posibles = EQ.filas.filter((r) => !r.nombre_datajunta && r.cliente === cliente && eqCanal(r, canal) && nombres.some((x) => slug(x) === slug(r.activo)));
  return { activo_key: null, cruce: 'sin par en PAUTADOR', candidatos: [], posibles: [...new Set(posibles.map((r) => r.activo_key))] };
}

// días sin dato: desde el último día con gasto hasta el último día completo. Se toma el más reciente entre DataJunta por
// activo (todas las plataformas, desde 01/06) y el último gasto de cada cuenta en la planilla cruzada (_activos.json), porque
// hay cuentas cuyo gasto DataJunta carga con otro nombre de activo o de cliente.
function ultimoGasto(canal, cliente, nombre, us) {
  let u = null;
  const mas = (f) => { if (f && f <= datosHasta && (!u || f > u)) u = f; };
  for (const r of plataformasPor[`${canal}|${cliente}`] || []) if (r.voz === nombre && r.g > 0) mas(r.f);
  for (const x of us) for (const h of x.historial || []) if (h.gastado > 0) mas(h.ultimoGasto);
  return u;
}
const CLIENTES_APP = new Set(PROYECTOS.map((p) => p.cliente));
// gasto de los últimos 7 días completos, todas las plataformas (la app usa solo Meta para su "últimos 7 días")
const desde7 = new Date(new Date(datosHasta).getTime() - 6 * 864e5).toISOString().slice(0, 10);
const gasto7 = (canal, cliente, nombre) => (plataformasPor[`${canal}|${cliente}`] || [])
  .filter((r) => r.voz === nombre && r.f >= desde7 && r.f <= datosHasta).reduce((s, r) => s + r.g, 0);
const diasEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

const renglones = [];
for (const P of DATA.proyectos) {
  for (const [canal, b] of Object.entries(P.canales)) {
    for (const a of b.activos) {
      if (a.nombre === 'Cuentas sin identificar') continue; // pedidos de la planilla sin cuenta reconocida: no son un activo
      // pedido y gastado por cuenta; si la cuenta es compartida entre clientes, solo la parte de este cliente
      let pedido = 0, gastado = 0, proy = 0, compartida = false;
      const plataformas = new Set(), us = [];
      for (const c of a.cuentas) {
        plataformas.add(c.plataforma);
        const u = unidadPor.get(`${canal}|${c.plataforma}|${c.cuenta}`);
        if (u) us.push(u);
        const m = u && (u.meses || {})[MES];
        // compartida = la cuenta sirve a más de un proyecto de la app (p. ej. Informe Norte: Chaco y Corrientes)
        if (u && m && u.clientes.filter((x) => CLIENTES_APP.has(x)).length > 1) {
          compartida = true;
          const gC = (m.gastoPorCliente || {})[P.cliente] || 0, pC = (m.pedidoPorCliente || {})[P.cliente] || 0;
          pedido += a.pedidoCargado ? pC : 0; gastado += gC; proy += m.gastado ? (m.proy || m.gastado) * gC / m.gastado : 0;
        } else { pedido += c.pedido; gastado += c.gastado; proy += c.proy; }
      }
      const pedidoMes = a.pedidoCargado && pedido ? pedido : null;
      const pct = pedidoMes ? proy / pedidoMes : null;
      const alias = NOMBRE_FICHA[a.nombre];
      const nombre = alias ? alias.nombre : a.nombre;
      const ug = ultimoGasto(canal, P.cliente, a.nombre, us), g7 = gasto7(canal, P.cliente, a.nombre);
      // los nombres de cuenta se usan solo para cruzar: no salen en el resumen
      const ak = activoKeyDe(canal, P.cliente, [nombre, a.nombre], a.cuentas.map((c) => c.cuenta));
      renglones.push({
        activo_key: ak.activo_key, cruceActivoKey: ak.cruce, ...(ak.candidatos.length ? { activoKeyCandidatos: ak.candidatos } : {}),
        ...(ak.posibles && ak.posibles.length ? { activoKeyPosibles: ak.posibles } : {}),
        proyecto: P.nombre, canal, activo: nombre, nombreDataJunta: a.nombre,
        correspondencia: alias ? `alias ${alias.estado}` : / \+ /.test(a.nombre) ? 'a revisar: el nombre sale de varias cuentas agrupadas' : 'mismo nombre', ficha: fichaDe(nombre) ? 'existe' : 'sin ficha todavía',
        plataformas: [...plataformas].sort(),
        mes: MES, pedidoCargado: !!a.pedidoCargado, pedido: r0(pedidoMes), gastado: r0(gastado), restante: pedidoMes ? r0(pedidoMes - gastado) : null,
        cuentaCompartida: compartida,
        ritmo: {
          gastoUltimos7: r0(g7), promedioDiario7: r0(g7 / 7), proyeccionCierre: r0(proy), pctCierre: pct == null ? null : Math.round(pct * 100) / 100,
          enLinea: pct == null ? null : pct >= EN_LINEA[0] && pct <= EN_LINEA[1],
          lectura: pct == null ? 'sin pedido del mes' : pct < EN_LINEA[0] ? 'va a sobrar' : pct > EN_LINEA[1] ? 'se pasa de lo pedido' : 'en línea',
          habitual: a.pico && a.pico.idx != null ? { pct: Math.round(a.pico.idx * 100), estado: a.pico.estado || null } : null,
        },
        luces: a.obj && (a.idxG != null || a.idxP != null)
          ? { objetivo: a.obj, general: luz(a.idxG, a.obj), proyecto: luz(a.idxP, a.obj), indiceGeneral: a.idxG, indiceProyecto: a.idxP }
          : null,
        campanasVivas: a.vivas.length,
        alcance: alcanceDe(canal, P.cliente, [nombre, a.nombre]),
        ultimoGasto: ug, diasSinDato: ug ? diasEntre(ug, datosHasta) : null,
      });
    }
  }
}

// control: nada que parezca un id de cuenta (8+ dígitos, o 3-3-4 de Google), un mail o una clave de acceso de Meta.
// Se revisan los textos (los montos van como números y pueden tener 8+ dígitos).
const textos = (o) => (typeof o === 'string' ? [o] : o && typeof o === 'object' ? Object.values(o).flatMap(textos) : []);
function controlar(textosACompartir) {
  const malos = [/\d{8,}/, /\d{3}-\d{3}-\d{4}/, /[\w.+-]+@[\w-]+\.[\w.]+/, /act_\d/, /EAA[A-Za-z0-9]{20,}/];
  for (const t of textosACompartir) {
    const hallado = malos.find((re) => re.test(t));
    if (hallado) throw new Error(`El resumen tiene algo que no se puede compartir (${hallado}) en: ${t.slice(0, 60)}… No se escribió.`);
  }
}

const M = (x) => {
  if (x == null) return '—';
  const s = x < 0 ? '-' : '', v = Math.abs(x);
  if (v >= 1e6) return `${s}$${(v / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`;
  if (v >= 1e3) return `${s}$${Math.round(v / 1e3).toLocaleString('es-AR')} mil`;
  return `${s}$${Math.round(v)}`;
};
const luzTxt = (l) => (l === 'gris' ? 'sin referencia' : l);
const miles = (x) => (x == null ? '—' : Math.round(x).toLocaleString('es-AR'));
function md(fecha) {
  const l = [];
  l.push(`# Resumen por activo — ${fecha}`, '');
  l.push(`Datos hasta el ${datosHasta} (último día completo de DataJunta). Mes: ${MES}. Lo arma Seguimiento (agente Datos) para el módulo Activos.`);
  l.push('Sin ids de cuentas, claves ni mails. Montos en pesos. "En línea" = la proyección al cierre queda entre 85 % y 102 % de lo pedido.');
  l.push('Alcance: el de Meta que lee PAUTADOR cada día (mes en curso), dentro de cada cuenta y solo para los activos que PAUTADOR lee; nunca calculado desde BigQuery. El alcance no se suma: si un activo tiene varias cuentas, va una por una.', '');
  l.push('| Proyecto | Canal | Activo | Pedido | Gastado | Restante | Proyección al cierre | Ritmo | Luces (general / proyecto) | Alcance del mes (Meta) | Días sin dato |');
  l.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of renglones) {
    const ritmo = r.ritmo.pctCierre == null ? r.ritmo.lectura : `${Math.round(r.ritmo.pctCierre * 100)} % de lo pedido (${r.ritmo.lectura})`;
    const luces = r.luces ? `${luzTxt(r.luces.general)} / ${luzTxt(r.luces.proyecto)} (${r.luces.objetivo})` : 'sin gasto en Meta este mes';
    const porCta = (c) => (c.mes ? `${miles(c.mes.alcance)} personas, frecuencia ${String(c.mes.frecuencia).replace('.', ',')}` : 'sin dato del mes');
    const alc = r.alcance.cuentas.length === 1 ? porCta(r.alcance.cuentas[0])
      : r.alcance.cuentas.length > 1 ? `${r.alcance.cuentas.length} cuentas, cada una por separado (no se suman): ${r.alcance.cuentas.map((c, i) => `cuenta ${i + 1}: ${porCta(c)}`).join('; ')}`
      : r.alcance.lectura === 'error' ? `lectura con error: ${r.alcance.motivo}` : r.alcance.lectura === 'ok' ? 'sin dato del mes' : '—';
    const nombre = r.correspondencia.startsWith('alias') ? `${r.activo} (en DataJunta: ${r.nombreDataJunta})` : r.correspondencia.startsWith('a revisar') ? `${r.activo} (nombre a revisar)` : r.activo;
    l.push(`| ${r.proyecto} | ${r.canal} | ${nombre}${r.cuentaCompartida ? ' (cuenta compartida: solo la parte de este proyecto)' : ''} | ${r.pedidoCargado ? M(r.pedido) : 'sin pedido cargado'} | ${M(r.gastado)} | ${M(r.restante)} | ${M(r.ritmo.proyeccionCierre)} | ${ritmo} | ${luces} | ${alc} | ${r.diasSinDato == null ? 'sin gasto desde junio' : r.diasSinDato} |`);
  }
  return l.join('\n') + '\n';
}

// cuántos renglones tienen activo_key y cuáles no (los sin par se pasan a Activos)
const sinKey = renglones.filter((r) => !r.activo_key);
const resumenActivoKey = {
  fuente: 'automatizado.activos_equivalencia (PAUTADOR)', disponible: !!EQ.estado.disponible, motivo: EQ.estado.motivo || null,
  actualizadoEn: EQ.filas.reduce((m, r) => (r.actualizado_en && (!m || r.actualizado_en > m) ? r.actualizado_en : m), null),
  renglones: renglones.length, conActivoKey: renglones.length - sinKey.length, sinActivoKey: sinKey.length,
  porCruce: renglones.reduce((o, r) => ((o[r.cruceActivoKey] = (o[r.cruceActivoKey] || 0) + 1), o), {}),
  sinPar: sinKey.map((r) => ({ proyecto: r.proyecto, canal: r.canal, activo: r.activo, plataformas: r.plataformas, motivo: r.cruceActivoKey,
    ...(r.activoKeyCandidatos ? { candidatos: r.activoKeyCandidatos } : {}), ...(r.activoKeyPosibles ? { posibles: r.activoKeyPosibles } : {}) })),
};
function mdActivoKey() {
  const k = resumenActivoKey, l = ['', '## Clave de PAUTADOR (activo_key)', ''];
  if (!k.disponible) return [...l, `La tabla de equivalencia no estaba disponible (${k.motivo || 'sin motivo'}): ningún renglón tiene activo_key.`, ''].join('\n');
  l.push(`${k.conActivoKey} de ${k.renglones} renglones tienen activo_key; ${k.sinActivoKey} no. Tabla de PAUTADOR actualizada el ${k.actualizadoEn || '—'}.`, '');
  l.push('| Proyecto | Canal | Activo | Plataformas | Motivo | Para revisar |', '|---|---|---|---|---|---|');
  for (const s of k.sinPar) l.push(`| ${s.proyecto} | ${s.canal} | ${s.activo} | ${s.plataformas.join(', ') || '—'} | ${s.motivo} | ${s.candidatos ? 'puede ser ' + s.candidatos.join(' o ') : s.posibles ? 'posible en PAUTADOR (sin par): ' + s.posibles.join(', ') : '—'} |`);
  return l.join('\n') + '\n';
}

const fecha = hoyAR();
const salida = { fecha, datosHasta, mes: MES, generadoPor: 'Seguimiento · agente Datos', contrato: 'orquestacion/CONTRATOS/nexo-activos.md',
  criterios: { enLinea: 'proyección al cierre entre 85 % y 102 % de lo pedido', luces: '±20 % contra la referencia general y la del proyecto (mismas que la app)',
    alcance: 'Meta, lectura diaria de PAUTADOR, dentro de cada cuenta (filas exactas de nivel cuenta); nunca se suma entre cuentas, días ni anuncios', diasSinDato: 'días entre el último gasto registrado en DataJunta (todas las plataformas) y el último día completo' },
  activoKey: resumenActivoKey, renglones };
const json = JSON.stringify(salida, null, 1), texto = md(fecha) + mdActivoKey();
controlar([...textos(salida), texto]);
fs.mkdirSync(SALIDA, { recursive: true });
fs.writeFileSync(path.join(SALIDA, `${fecha}.json`), json);
fs.writeFileSync(path.join(SALIDA, `${fecha}.md`), texto);
console.log(`resumen de activos ${fecha} · ${renglones.length} renglones · datos al ${datosHasta} → ${path.relative(process.cwd(), SALIDA)}`);
console.log(`activo_key: ${resumenActivoKey.conActivoKey} con, ${resumenActivoKey.sinActivoKey} sin`, JSON.stringify(resumenActivoKey.porCruce));
