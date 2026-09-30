// Prueba aislada del aviso de audiencias que se pisan (borrador/reglas/meta.js → solapamientoAudiencias).
// No lee BigQuery ni arma la app: casos armados a mano con nombres de audiencias reales de DataJunta.
// Uso: node pruebas/solapamiento.js   (desde Seguimiento/app/). Termina en "problemas 0".
const { solapamientoAudiencias } = require('../../borrador/reglas/meta');

const hoy = '2026-09-29';
const cj = (audiencia, cod = 'X1') => ({ conjunto: `${cod} - ${audiencia}`, cod, audiencia, hasta: hoy, g14: '1000' });
const casos = [
  // [cliente, audiencias, tipo esperado (null = no se marca)]
  ['Gobierno del Chaco', ['Toda la provincia excluyendo Resistencia', 'Capital y Gran Resistencia'], null],
  ['Gobierno del Chaco', ['Toda la provincia excluyendo resistencia', 'Ciudad Resistencia'], null],
  ['Gobierno del Chaco', ['Toda la provincia excluyendo resistencia', 'Ciudad Barranqueras'], 'contenida'],
  ['Gobierno del Chaco', ['Provincia Chaco (Open a toda la provincia)', 'Toda la provincia excluyendo resistencia'], 'contenida'],
  ['Gobierno del Chaco', ['Rango etario 17 y 18 - Geo toda la provincia', 'Toda la provincia excluyendo resistencia'], 'se cruzan'],
  ['Gobierno del Chaco', ['Provincia Chaco (Open a toda la provincia)', 'Audiencia Zdero Army'], null],
  ['Gobierno de Corrientes', ['Geo | Provincia Corrientes', 'Corrientes prov'], 'misma zona'],
  ['Gobierno de Corrientes', ['Capital', 'Geo | Capital Corrientes'], 'misma zona'],
  ['Gobierno de Santa Fe', ['Provincia Santa Fe', 'Ciudad Rosario'], 'contenida'],
  ['Gobierno de Santa Fe', ['Provincia Santa Fe', 'VEJQQJP'], null],
  ['Gobierno de Santa Fe', ['Provincia Santa Fe', 'PBA, Córdoba, Chaco, Entre Ríos, Santiago del Estero'], null],
  ['Gobierno de Córdoba', ['Córdoba Capital/30 a 60 años', 'Cuadrante 7'], 'contenida'],
  ['Gobierno de Córdoba', ['Córdoba Provincia/30 a 60 años', 'Ciudad Villa María/30 a 65 años'], 'contenida'],
  ['Gobierno de Córdoba', ['Ciudad Mendiolaza', 'Ciudad Mendiolaza/30 a 65 años'], 'contenida'],
  ['Gobierno del Chubut', ['Provincia Chubut', 'Córdoba'], null],
  ['Gobierno del Chubut', ['Provincias de Chubut, Salta, Jujuy, Tucumán y Mendoza', 'Provincia de Buenos Aires y Ciudad Autónoma de Buenos Aires'], null],
  ['Gobierno del Chubut', ['Provincias de Chubut, Salta, Jujuy, Tucumán y Mendoza', 'Punta Tombo'], 'contenida'],
  ['Gobierno del Chubut', ['Trelew, Rawson, Playa unión, Dolavon, Gaiman, 28 de Julio', 'VIRCh — Trelew, Rawson, Gaiman y más'], 'se cruzan'],
  // la misma audiencia en dos conjuntos (un contenido por conjunto) no se marca
  ['Gobierno de Santa Fe', ['Provincia Santa Fe', 'Provincia Santa Fe'], null],
];
let problemas = 0;
for (const [cliente, auds, esperado] of casos) {
  const pares = solapamientoAudiencias(auds.map((a, i) => cj(a, 'C' + i)), { cliente, datosHasta: hoy });
  const tipo = pares.length ? pares[0].tipo : null;
  if (tipo !== esperado) { problemas++; console.log(`MAL  ${cliente}: ${auds.join(' / ')} → ${tipo} (se esperaba ${esperado})`); }
}
// un conjunto que dejó de gastar hace más de 2 días no cuenta
const viejo = solapamientoAudiencias([cj('Provincia Santa Fe'), { ...cj('Ciudad Rosario'), hasta: '2026-09-20' }], { cliente: 'Gobierno de Santa Fe', datosHasta: hoy });
if (viejo.length) { problemas++; console.log('MAL  un conjunto sin gasto reciente se marcó'); }
console.log(`casos ${casos.length + 1} · problemas ${problemas}`);
process.exitCode = problemas ? 1 : 0;
