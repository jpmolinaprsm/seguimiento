// Arma las recomendaciones de un proyecto × canal: corre las reglas de cada plataforma y las ordena.
// Dueño: agente de Recomendaciones. Las reglas de cada plataforma viven en reglas/ (una por especialista).
// El orden de ejecución importa para el desempate: primero Meta, después Google, después las generales.
const reglasMeta = require('./reglas/meta');
const reglasGoogle = require('./reglas/google');
const reglasGenerales = require('./reglas/generales');

// Vía "por PAUTADOR" (contrato del 30/09, reglas v0.3 sección C): se puede pedir si la recomendación es de Meta y su acción es
// Pausar o Cambiar presupuesto: C1 (solo cuando propone pausar la pieza peor), C3, C7, C6 y C10. Vale para cualquier campaña de
// una cuenta habilitada en PAUTADOR; Seguimiento todavía no sabe cuáles están habilitadas, así que eso lo valida PAUTADOR y, si la
// cuenta no está habilitada, rechaza el pedido. Todas las reglas de campaña corren sobre campañas de Meta (la base es Meta).
// La lista de reglas que encajan es la del nexo (nexo/solicitud.js, ENCAJAN): se lee, no se copia.
const { ENCAJAN } = require('../nexo/solicitud');
function viaDe(a) {
  if (!ENCAJAN[a.tipo]) return 'manual';
  if (ENCAJAN[a.tipo].conjuntos === 'pausar' && !(a.piezas && a.piezas.length >= 2)) return 'manual';   // C1 sin pieza peor: es revisar
  return 'pautador';
}

function generar(ctx) {
  const { P, canal, hashId } = ctx;
  const acciones = [];
  const nuevo = (c, a) => acciones.push({ camp: c.id, uid: c.uid, via: viaDe(a), impacto: c.g7, ...a, id: a.tipo.slice(0, 3) + '-' + hashId(P.id + canal + c.id + a.tipo + (a.sub || '')) });
  const c = { ...ctx, acciones, nuevo };
  reglasMeta(c);
  reglasGoogle(c);
  reglasGenerales(c);
  acciones.sort((a, b) => b.prioridad - a.prioridad || b.impacto - a.impacto);
  return acciones;
}

module.exports = { generar };
