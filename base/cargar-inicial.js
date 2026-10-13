// Seguimiento y Optimización · carga inicial de lo que hay en app/repositorio/ a la base (13/10/2026, agente Recomendaciones).
//   - recomendaciones/AAAA-MM-DD.jsonl      → tabla recomendaciones (un día por archivo)
//   - respuestas.jsonl                      → respuestas, comentarios (reglas y pantallas) y tipos de campaña
//   - lectura-temprana/predicciones.jsonl   → predicciones (sin duplicar por id)
// No carga resumen.json (lo vuelve a escribir la próxima actualización) ni informes-lunes/ (no tienen tabla).
//
// Uso (desde Seguimiento/):
//   prueba en seco (no escribe):   node base/cargar-inicial.js
//   escribir de verdad:            node base/cargar-inicial.js --escribir-en <código del proyecto de Supabase>
//   otras opciones:  --repositorio <carpeta>   --reemplazar-dias   (vuelve a escribir días de recomendaciones que la base ya tiene)
// Variables: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (en la ventana de PowerShell; contra la base de prueba: node --env-file=.env ...).
const fs = require('fs');
const path = require('path');
const C = require('./carga-comun.js');
const { crearAlmacenSupabase } = require('./almacen-supabase.js');

async function main() {
  const args = C.argumentos(process.argv.slice(2));
  const repo = args.opciones.repositorio ? path.resolve(args.opciones.repositorio) : C.REPO_POR_DEFECTO;
  const { db, ref, escribir } = C.conectar(process.env, args.opciones);
  console.log(`Base: proyecto de Supabase "${ref}" · ${escribir ? 'ESCRIBE' : 'prueba en seco (no escribe nada)'} · carpeta ${repo}`);
  const almacen = crearAlmacenSupabase({ cliente: db });

  // 1. Recomendaciones del día
  const carpetaRecs = path.join(repo, 'recomendaciones');
  const dias = fs.existsSync(carpetaRecs) ? fs.readdirSync(carpetaRecs).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort() : [];
  console.log('\nRecomendaciones');
  for (const f of dias) {
    const dia = f.slice(0, 10);
    const filas = C.leerJsonl(path.join(carpetaRecs, f));
    const { count, error } = await db.from('recomendaciones').select('id', { count: 'exact', head: true }).eq('datos_al', dia);
    if (error) throw new Error(`base (contar ${dia}): ${error.message}`);
    if (count > 0 && !args.opciones['reemplazar-dias']) {
      console.log(`  ${dia}: la base ya tiene ${count} (el archivo tiene ${filas.length}); no se toca${count !== filas.length ? '  <-- NO COINCIDE, usar --reemplazar-dias si el archivo es el bueno' : ''}`);
      continue;
    }
    if (escribir) await almacen.guardarRecomendaciones(dia, filas);
    console.log(`  ${dia}: ${escribir ? 'cargadas' : 'se cargarían'} ${filas.length}`);
  }

  // 2. Respuestas, comentarios y tipos de campaña
  const regs = C.leerJsonl(path.join(repo, 'respuestas.jsonl')).map((x) => ({ ...x, cuando: x.recibido }));
  const resumen = await C.cargarFilas(db, regs.map((r) => C.aFila(r)), { escribir });
  C.imprimirResumen(`respuestas.jsonl (${regs.length} líneas)`, resumen, escribir);

  // 3. Predicciones de la lectura al día 5
  const preds = C.leerJsonl(path.join(repo, 'lectura-temprana', 'predicciones.jsonl'));
  const ids = new Set((await C.todas(db, 'lectura_temprana_predicciones', 'id')).map((x) => x.id));
  const faltan = preds.filter((p) => p.id && !ids.has(p.id));
  if (escribir && faltan.length) await almacen.agregarPredicciones(faltan);
  console.log(`\nPredicciones: el archivo tiene ${preds.length}; ${escribir ? 'se agregaron' : 'se agregarían'} ${faltan.length}, ya estaban ${preds.length - faltan.length}`);

  if (!escribir) console.log('\nNo se escribió nada. Para escribir: agregar --escribir-en ' + ref);
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
