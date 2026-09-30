// Huella de lo que arma la app: sirve para comprobar que un cambio de orden en el código (mover funciones de archivo,
// renombrar, partir) NO cambió ningún número ni texto. Uso: `node pruebas/huella.js` antes y después; las líneas tienen que coincidir.
// Si en el medio se volvió a bajar datos de BigQuery, la huella de datos cambia: comparar solo con los mismos datos.
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const html = fs.readFileSync(path.join(__dirname, '..', 'Seguimiento y Optimizacion.html'), 'utf8');
const template = JSON.parse(html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
const logic = template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
const fin = logic.indexOf(';\n', logic.indexOf('const DATA = ')) + 2;
const datos = logic.slice(logic.indexOf('const DATA = '), fin);
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
const markup = template.replace(/<script type="text\/x-dc"[^>]*>[\s\S]*?<\/script>/, '');

console.log(`datos   ${md5(datos)} (${Math.round(datos.length / 1024)} KB)`);
console.log(`lógica  ${md5(logic.slice(fin))}`);
console.log(`markup  ${md5(markup)}`);
