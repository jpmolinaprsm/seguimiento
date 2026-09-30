// Nexo con PAUTADOR (lado Seguimiento). Dueño: agente Nexo con PAUTADOR (lado Seguimiento).
// Brief y bitácora: orquestacion/NEXOS/seguimiento-pautador/lado-seguimiento/. Contratos: orquestacion/CONTRATOS/.
//   solicitud.js   recomendación aceptada → solicitud de cambio (o tarea manual / bloqueada por un control de seguridad);
//                  control de quién pide (implementador o administrador del proyecto, activo)
//   cliente.js     envío y estado; modo simulado por defecto y siempre sin NEXO_URL
//   simulador.js   PAUTADOR de mentira: recibida → rechazada por validación / aplicada / falló
//   repositorio.js guardado de solicitudes y estados (hoy app/repositorio/nexo/solicitudes.jsonl, solo se agrega)
//   alcance.js     camino 1: valida lo bajado de automatizado.meta_alcance_diario + meta_alcance_corridas y devuelve, por
//                  nivel, el dato de hoy (exacto o rango entre cuentas) o "sin dato de hoy"
//                  alcanceDeExtraccion(_proyectos.json) = lo que baja Datos (alcanceMeta, alcanceCorridas, alcanceFecha,
//                  alcanceEstado) pasado a alcanceDeHoy; un canal con disponible false queda "sin dato de hoy" con su motivo
//   rutas.js       rutas /api/nexo/... para app/servir.js (las conecta Interfaz)
// Prueba: node app/pruebas/nexo.js (desde Seguimiento/app: node pruebas/nexo.js).
module.exports = {
  ...require('./solicitud'),
  ...require('./cliente'),
  ...require('./simulador'),
  ...require('./repositorio'),
  ...require('./alcance'),
  ...require('./rutas'),
};
