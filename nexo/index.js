// Nexo con PAUTADOR (lado Seguimiento). Dueño: agente Nexo con PAUTADOR (lado Seguimiento).
// Brief y bitácora: orquestacion/NEXOS/seguimiento-pautador/lado-seguimiento/. Contratos: orquestacion/CONTRATOS/.
//   solicitud.js   recomendación aceptada → solicitud de cambio (o tarea manual / bloqueada por un control de seguridad);
//                  control de quién pide (implementador o administrador del proyecto, activo)
//   cliente.js     envío y estado; modo simulado por defecto y siempre sin NEXO_URL
//   accesos.js     consulta de accesos a PAUTADOR (POST /api/servicio/accesos) con memoria de 5 minutos por mail; solo en
//                  modo real con NEXO_URL y NEXO_CLAVE; es la función de accesos por defecto de crearNexo en ese modo
//   accesos-lista.js    plan B de accesos: lista provisoria exportada de PAUTADOR (no versionada)
//   transporte-real.js  envio real de los pedidos de cambio; solo en Railway con todos los candados
//   simulador.js   PAUTADOR de mentira: recibida → rechazada por validación / aplicada / falló
//   repositorio.js guardado de solicitudes y estados en archivo (local). crearNexo usa por defecto base/almacen.js (.nexo): la base de
//                  Seguimiento con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY, y este archivo en local. Todo con await.
//   alcance.js     camino 1: valida lo bajado de automatizado.meta_alcance_diario + meta_alcance_corridas y devuelve, por
//                  nivel, el dato de la ÚLTIMA lectura con su fecha (fechaLectura, deHoy; desde el 3/10) (exacto con una
//                  cuenta; con varias, lista por cuenta, nunca sumado) o "sin dato" (estado 'sin_dato') si no hay ninguna
//                  alcanceDeExtraccion(_proyectos.json) = lo que baja Extracción (alcanceMeta, alcanceCorridas, alcanceFecha,
//                  alcanceEstado) pasado a alcanceDeHoy; un canal con disponible false queda sin dato con su motivo
//   rutas.js       rutas /api/nexo/... para app/servir.js (las conecta Interfaz)
// Prueba: node app/pruebas/nexo.js (desde Seguimiento/app: node pruebas/nexo.js).
module.exports = {
  ...require('./solicitud'),
  ...require('./cliente'),
  ...require('./accesos'),
  ...require('./accesos-lista'),
  ...require('./transporte-real'),
  ...require('./simulador'),
  ...require('./repositorio'),
  ...require('./alcance'),
  ...require('./rutas'),
};
