// Seguimiento y Optimización · comprobación de que la base quedó bien armada (13/10/2026, agente Recomendaciones).
// Solo LEE. Uso (desde Seguimiento/):  node base/verificar-base.js
// Variables: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (en la ventana de PowerShell).
// Mira: que estén las siete migraciones, que la API vea todas las tablas y cuántas filas tiene cada una, y que la clave pública
// (anon, la que NO se usa) no pueda leer nada. Lo que no se puede ver desde acá (RLS y políticas) lo controla el SQL del final de
// todas-las-migraciones.sql, que tiene que dar cero filas.
const C = require('./carga-comun.js');

const TABLAS = ['migraciones', 'recomendaciones', 'respuestas', 'recomendacion_estado', 'comentarios', 'tipos_campana_cambios', 'tipos_campana',
  'looker_links', 'lectura_temprana_predicciones', 'lectura_temprana_resumenes', 'nexo_solicitudes', 'nexo_estados', 'nexo_ultimo_estado', 'actualizaciones'];
const MIGRACIONES = ['001_base', '002_recomendaciones', '003_comentarios_tipos_looker', '004_lectura_temprana', '005_nexo_solicitudes', '006_actualizaciones', '007_seguridad'];

async function main() {
  const { db, ref } = C.conectar(process.env, {});
  console.log(`Base: proyecto de Supabase "${ref}"\n`);
  let problemas = 0;
  const falla = (t) => { problemas++; console.log('  PROBLEMA: ' + t); };

  const m = await db.from('migraciones').select('version').order('version');
  if (m.error) falla(`no puedo leer "migraciones": ${m.error.message} (¿se corrió el SQL? ¿se corrió "notify pgrst, 'reload schema'"?)`);
  else {
    const hay = m.data.map((x) => x.version);
    console.log(`Migraciones anotadas: ${hay.length} de ${MIGRACIONES.length}`);
    for (const v of MIGRACIONES) if (!hay.includes(v)) falla(`falta la migración ${v}`);
  }
  console.log('\nTabla                            filas');
  for (const t of TABLAS) {
    const r = await db.from(t).select('*', { count: 'exact', head: true });
    if (r.error) falla(`la API no ve "${t}": ${r.error.message}`);
    else console.log(`${t.padEnd(32)} ${r.count}`);
  }
  // La clave pública no debe leer nada. Se prueba con una clave pública falsa de la misma base solo si el usuario la pasa por variable.
  if (process.env.SUPABASE_ANON_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    for (const t of ['respuestas', 'comentarios', 'recomendaciones']) {
      const r = await anon.from(t).select('*', { count: 'exact', head: true });
      if (!r.error && r.count > 0) falla(`la clave pública LEE "${t}" (${r.count} filas): hay un permiso o una política de más`);
      else console.log(`clave pública sobre "${t}": sin acceso (${r.error ? r.error.message : '0 filas'})`);
    }
  } else console.log('\n(Para probar también que la clave pública no lee nada, pasar SUPABASE_ANON_KEY en la ventana de PowerShell.)');

  console.log(problemas ? `\nProblemas: ${problemas}` : '\nTodo bien: migraciones completas y tablas visibles.');
  process.exit(problemas ? 1 : 0);
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
