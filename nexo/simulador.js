// Nexo con PAUTADOR (lado Seguimiento) · PAUTADOR de mentira.
// Hasta que Seguimiento esté en Railway (~14/10/2026) no hay envío real: este simulador hace de PAUTADOR y devuelve los estados del
// contrato (orquestacion/CONTRATOS/cambios-seguimiento-a-pautador.md). No habla con nadie: todo queda en memoria.
//
// Recorrido (decisión de Juan Pablo del 30/9: el pedido del implementador del proyecto cuenta como la aprobación, no hay un segundo
// paso en PAUTADOR). Optimización valida, ejecuta en Meta y devuelve el resultado:
//   recibida → rechazada_validacion (con motivo)
//            → aplicada (con valores antes y después)
//            → fallo (con el error de Meta)
// El simulador no produce "pendiente de aprobación" ni "rechazada por una persona": Seguimiento solo manda pedidos del implementador
// del proyecto (o de un administrador), así que ese caso no se da desde acá (ver ESTADOS_SIN_USO en nexo/cliente.js).
// Un mismo id no se procesa dos veces: la segunda vez devuelve el estado que ya tenía, marcado como duplicada.
//
// Ejecución:
//   'inmediata' (por defecto): recibir() valida y ejecuta en el momento y devuelve el resultado final.
//   'diferida': recibir() valida y deja la solicitud en "recibida"; ejecutar(id) hace de Optimización más tarde (para probar que
//               Seguimiento sabe esperar y consultar el estado).
// accesos (opcional): la misma función de accesos que usa Seguimiento. Si se pasa, el simulador también revisa quién pide, como hará
// PAUTADOR (contrato, paso 3), y rechaza por validación a quien no es implementador o administrador del proyecto.
const { validarForma, revisarPermiso, ACCION } = require('./solicitud');

const ESTADOS = ['recibida', 'rechazada_validacion', 'aplicada', 'fallo'];

// Anuncios de mentira: AD_ID → datos que en la realidad conoce PAUTADOR (cuenta, campaña y conjunto de Meta, presupuesto diario).
const ANUNCIOS_DE_PRUEBA = {
  '900000000000001': { cuenta: 'act_prueba_1', habilitada: true, campana_id: 'c-1', conjunto_id: 'cj-1', presupuesto_diario: 10000, estado: 'ACTIVE' },
  '900000000000002': { cuenta: 'act_prueba_1', habilitada: true, campana_id: 'c-1', conjunto_id: 'cj-2', presupuesto_diario: 15000, estado: 'ACTIVE' },
  '900000000000003': { cuenta: 'act_prueba_2', habilitada: false, campana_id: 'c-2', conjunto_id: 'cj-3', presupuesto_diario: 8000, estado: 'ACTIVE' },
  '900000000000004': { cuenta: 'act_prueba_1', habilitada: true, campana_id: 'c-1', conjunto_id: 'cj-4', presupuesto_diario: 12000, estado: 'ACTIVE', falla: 'Meta respondió: el conjunto está en revisión y no admite cambios (simulado).' },
};
const MINIMO_DIARIO_META = 1000;   // de mentira: el real lo conoce PAUTADOR

function crearSimulador({ anuncios: base = ANUNCIOS_DE_PRUEBA, reloj = () => new Date(), ejecucion = 'inmediata', accesos = null } = {}) {
  if (!['inmediata', 'diferida'].includes(ejecucion)) throw new Error(`simulador: ejecución desconocida "${ejecucion}"`);
  const anuncios = JSON.parse(JSON.stringify(base));   // cada simulador tiene su propia "Meta"
  const pedidos = new Map();   // id → { solicitud, estado, motivo, error, valores, historial }
  const copia = (p, extra = {}) => ({ id: p.solicitud.id, estado: p.estado, motivo: p.motivo || null, error: p.error || null, valores: p.valores || null,
    aprobada_por: p.aprobada_por || null, historial: p.historial.map((h) => ({ ...h })), ...extra });
  const pasar = (p, estado, extra = {}) => { Object.assign(p, { estado }, extra); p.historial.push({ estado, fecha: reloj().toISOString(), ...extra }); };

  // Lo que en PAUTADOR es la validación: forma, quién pide (si hay accesos), anuncios conocidos, cuentas habilitadas, mínimo diario.
  async function validar(s) {
    const forma = validarForma(s);
    if (forma) return forma;
    if (accesos) {
      const permiso = await revisarPermiso(accesos, s.pedida_por, s.proyecto, s.canal);
      if (!permiso.ok) return permiso.motivo;
    }
    for (const o of s.objetivos) for (const a of o.anuncios) {
      const d = anuncios[a];
      if (!d) return `No se encontró el anuncio ${a} en Meta.`;
      if (!d.habilitada) return `La cuenta ${d.cuenta} no está habilitada en PAUTADOR.`;
      // Si Seguimiento mandó el id del conjunto, se confirma que el anuncio sea de ese conjunto (propuesta para PAUTADOR, 30/9).
      if (o.conjunto_id != null && String(d.conjunto_id) !== String(o.conjunto_id)) return `El anuncio ${a} no es del conjunto ${o.conjunto_id} en Meta.`;
      if (s.accion === ACCION.PRESUPUESTO && Math.round(d.presupuesto_diario * (1 + s.cambio_pct / 100)) < MINIMO_DIARIO_META) return 'El presupuesto nuevo queda por debajo del mínimo diario de Meta.';
    }
    return null;
  }

  // Lo que hace Optimización: ejecuta en la "Meta" de mentira, completa antes y después, o falla con el error del anuncio.
  // El pedido de quien lo mandó cuenta como la aprobación: aprobada_por = pedida_por.
  function aplicar(p) {
    const s = p.solicitud;
    const ids = [...new Set(s.objetivos.flatMap((o) => o.anuncios))];
    const falla = ids.map((a) => anuncios[a]).find((d) => d && d.falla);
    if (falla) { pasar(p, 'fallo', { error: falla.falla, aprobada_por: s.pedida_por }); return; }
    const vistos = new Set(), valores = [];   // un valor por conjunto de Meta (varios anuncios pueden ser del mismo conjunto)
    for (const a of ids) {
      const d = anuncios[a];
      if (vistos.has(d.conjunto_id)) continue;
      vistos.add(d.conjunto_id);
      if (s.accion === ACCION.PAUSAR) { valores.push({ cuenta: d.cuenta, campana_id: d.campana_id, conjunto_id: d.conjunto_id, campo: 'estado', antes: d.estado, despues: 'PAUSED' }); d.estado = 'PAUSED'; }
      else { const nuevo = Math.round(d.presupuesto_diario * (1 + s.cambio_pct / 100)); valores.push({ cuenta: d.cuenta, campana_id: d.campana_id, conjunto_id: d.conjunto_id, campo: 'presupuesto_diario', antes: d.presupuesto_diario, despues: nuevo }); d.presupuesto_diario = nuevo; }
    }
    pasar(p, 'aplicada', { valores, aprobada_por: s.pedida_por });
  }

  return {
    modo: 'simulado',
    ejecucion,
    // Entrada "recibir solicitud"
    async recibir(s) {
      if (s && pedidos.has(s.id)) return copia(pedidos.get(s.id), { duplicada: true });
      const p = { solicitud: JSON.parse(JSON.stringify(s || {})), historial: [] };
      if (!p.solicitud.id) return { id: null, estado: 'rechazada_validacion', motivo: 'La solicitud no trae id.', historial: [] };
      pedidos.set(p.solicitud.id, p);
      pasar(p, 'recibida');
      const error = await validar(p.solicitud);
      if (error) pasar(p, 'rechazada_validacion', { motivo: error });
      else if (ejecucion === 'inmediata') aplicar(p);
      return copia(p);
    },
    // Entrada "consultar estado"
    async consultar(id) {
      const p = pedidos.get(id);
      return p ? copia(p) : { id, estado: null, motivo: 'PAUTADOR no tiene una solicitud con ese id.', historial: [] };
    },
    // Solo en modo 'diferida': Optimización ejecuta una solicitud que quedó en "recibida".
    ejecutar(id) {
      const p = pedidos.get(id);
      if (!p || p.estado !== 'recibida') throw new Error(`simulador: ${id} no está esperando ejecución`);
      aplicar(p);
      return copia(p);
    },
  };
}

module.exports = { crearSimulador, ESTADOS, ANUNCIOS_DE_PRUEBA };
