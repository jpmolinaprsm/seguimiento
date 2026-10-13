// Nexo con PAUTADOR (lado Seguimiento) · PLAN B de la consulta de accesos: lista provisoria exportada de PAUTADOR.
// Solo se usa si la consulta real (nexo/accesos.js) no está prendida. Se descarta al conectarla.
//
// De dónde sale la lista (en este orden):
//   1. NEXO_ACCESOS_JSON: el contenido de la lista como variable (Railway). 2. NEXO_ACCESOS_ARCHIVO: ruta a un archivo JSON
//   (por defecto datos-fijos/accesos-provisorios.json, NO versionado: está en .gitignore). Tiene mails: nunca va a git ni a un chat.
// Formato: un arreglo de lo mismo que devuelve PAUTADOR en /api/servicio/accesos (consulta-accesos.md):
//   [ { email, nombre, habilitado, rol, administradorGlobal, superadministrador, accesos: [ { proyecto, activo, rol, canales } ] } ]
// Un mail que no está en la lista = "no ve nada" (habilitado: false, accesos []), igual que PAUTADOR con un mail desconocido.
const fs = require('fs');
const path = require('path');

const limpio = (x) => String(x == null ? '' : x).trim();
const claveMail = (m) => limpio(m).toLowerCase();
const ARCHIVO_POR_DEFECTO = path.join(__dirname, '..', 'datos-fijos', 'accesos-provisorios.json');

function cargarLista({ env = process.env, leerArchivo = (p) => fs.readFileSync(p, 'utf8') } = {}) {
  let texto = limpio(env.NEXO_ACCESOS_JSON);
  if (!texto) {
    const ruta = limpio(env.NEXO_ACCESOS_ARCHIVO) || ARCHIVO_POR_DEFECTO;
    try { texto = leerArchivo(ruta); } catch (e) { return null; }   // sin lista: no hay plan B
  }
  let lista;
  try { lista = JSON.parse(texto); } catch (e) { throw new Error('la lista provisoria de accesos no es un JSON válido'); }
  if (!Array.isArray(lista)) throw new Error('la lista provisoria de accesos tiene que ser un arreglo');
  return lista.filter((p) => p && typeof p === 'object' && limpio(p.email));
}

// → función async (mail) → respuesta con la forma de PAUTADOR, o null si no hay lista cargada.
function crearAccesosDeLista(opciones = {}) {
  const lista = cargarLista(opciones);
  if (!lista) return null;
  const porMail = new Map(lista.map((p) => [claveMail(p.email), p]));
  const copia = (x) => JSON.parse(JSON.stringify(x));
  const accesosDe = async (mail) => {
    const p = porMail.get(claveMail(mail));
    if (!p) return { email: limpio(mail), nombre: '', habilitado: false, rol: null, administradorGlobal: false, superadministrador: false, accesos: [] };
    return copia({
      email: p.email, nombre: p.nombre || '', habilitado: p.habilitado === true, rol: p.rol || null,
      administradorGlobal: p.administradorGlobal === true, superadministrador: p.superadministrador === true,
      accesos: Array.isArray(p.accesos) ? p.accesos : [],
    });
  };
  accesosDe.vaciar = () => {};
  accesosDe.tamano = () => porMail.size;
  accesosDe.modo = 'lista_provisoria';
  return accesosDe;
}

module.exports = { crearAccesosDeLista, cargarLista, ARCHIVO_POR_DEFECTO };
