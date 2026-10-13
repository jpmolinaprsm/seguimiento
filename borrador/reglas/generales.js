// Reglas que valen para todas las plataformas (Meta, Google, TikTok, SMS): apagones y picos de gasto por activo, y costo por
// objetivo por red. Dueño: agente de Recomendaciones. Detalle: Seguimiento/documentos/reglas-recomendador-v0.3.md, sección C.

function reglasGenerales(ctx) {
  const { acciones, pp, P, canal, hashId, Mk, fmtCosto, MESES_TXT, TERMINAN } = ctx;
  if (pp) {
    for (const [v, pk] of Object.entries(pp.vozPicos)) {
      if (!pk.estado || TERMINAN.includes(v)) continue;
      acciones.push({ id: 'pic-' + hashId(P.id + canal + v + pk.estado), tipo: pk.estado, camp: null, via: 'manual', prioridad: pk.estado === 'Apagón' ? 2.5 : 1.8,
        impacto: Math.abs(pk.tipico * (1 - pk.idx)) * 2,
        titulo: pk.estado === 'Apagón' ? `${v} casi dejó de gastar` : `${v} gasta mucho más que lo habitual`,
        // valor y referencia, nunca "0,4×" (REGLAS-COMUNES, sección 5)
        que: `Los últimos 2 días completos gastó ${Mk(pk.tipico * pk.idx)} por día, sumando todas las plataformas: ${Math.round(Math.abs(pk.idx - 1) * 100)} % ${pk.idx < 1 ? 'menos' : 'más'} que su día típico de ${MESES_TXT[pp.meses[1].slice(5)]} (${Mk(pk.tipico)} por día).`,
        hacer: pk.estado === 'Apagón' ? 'Revisar si hay anuncios pausados, rechazados o sin presupuesto en sus cuentas' : 'Confirmar que el aumento sea intencional (campaña nueva o pedido cargado)',
        porque: 'Picos y apagones: comparar el gasto diario contra el día típico del mes anterior detecta cortes de entrega o gastos fuera de plan antes de que afecten el mes.',
        como: 'Día típico = mediana del gasto diario del mes anterior. Apagón: los últimos 2 días gastó menos de la mitad de su día típico. Pico: más del doble.' });
    }
    for (const x of pp.costoObjetivo.filter((y) => y.color === 'rojo' && y.peso >= 0.08)) {
      acciones.push({ id: 'cxo-' + hashId(P.id + canal + x.red + x.obj), tipo: 'Costo por objetivo', camp: null, via: 'manual', prioridad: 2, impacto: x.deMas,
        titulo: `${x.red} · ${x.obj}: ${Math.round(x.delta * 100)} % más caro que lo habitual`,
        que: `${x.metrica} ${fmtCosto(x.valor)} contra ${fmtCosto(x.ref)} de ${MESES_TXT[pp.ref[0].slice(5)]}–${MESES_TXT[pp.ref[1].slice(5)]}. Pesa el ${Math.round(x.peso * 100)} % del gasto del mes: pagó ${Mk(x.deMas)} más que lo habitual.`,
        hacer: 'Revisar los conjuntos de esa red y objetivo: pieza, audiencia y puja', porque: 'Cada campaña se evalúa con la métrica de lo que compra; 20 % o más caro que los 3 meses anteriores es una alerta.',
        como: 'Mismo cálculo que "Costo por objetivo" del tablero de Dirección: por red y objetivo, mes en curso contra los 3 meses anteriores.' });
    }
  }
}

module.exports = reglasGenerales;
