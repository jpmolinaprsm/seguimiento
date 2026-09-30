// Prueba directa del motor con BigQuery (sin servidor): node prueba-motor.js "Gobierno del Chaco"
const consultas = require('./src/consultas');
const motor = require('./src/motor');
const fs = require('fs');
(async () => {
  const nombre = process.argv[2] || 'Gobierno del Chaco';
  const cfg = JSON.parse(fs.readFileSync(__dirname + '/data/proyectos.json', 'utf8'))[nombre];
  const t0 = Date.now();
  const porCanal = {};
  for (const canal of ['Oficial', 'Informativo']) {
    const [conjuntos, serie, alertas, mes, benchmark] = await Promise.all([consultas.conjuntos(canal, cfg), consultas.serie(canal, cfg), consultas.alertas(canal, cfg), consultas.mes(canal, cfg), consultas.benchmark(canal)]);
    porCanal[canal] = { conjuntos, serie, alertas, mes, benchmark };
    console.log(canal, '| conjuntos', conjuntos.length, '| serie', serie.length, '| alertas', alertas.length, '| benchmark', benchmark.length, '| mes', JSON.stringify(mes));
  }
  const perfil = await consultas.perfil(cfg);
  console.log('perfil: sesgo', perfil.sesgo.length, 'audiencias', perfil.audiencias.length, '| ', (Date.now() - t0) / 1000, 's');
  const hoy = new Date().toISOString().slice(0, 10);
  const out = motor.armarProyecto({ id: 'x', nombre, cfg, hoy, porCanal, perfil, poblacion: (consultas.leerJson('poblacion.json') || {}).poblacion, calendario: consultas.leerJson('calendario_electoral.json'), decisiones: {}, cuentas: {} });
  console.log('\nP:', JSON.stringify(out.P, null, 1).slice(0, 900));
  console.log('\ncampañas:', out.campanas.length, '| recs:', out.recs.length, '| ejes:', out.ejes.join(', '));
  for (const c of out.campanas.slice(0, 12)) console.log(`- ${c.nombre} | ${c.canales.join('+')} | ${c.estado} | piso ${c.piso} | ${c.objetivo} | g7 ${Math.round(c.gasto7)} | veces ${c.bench.veces} | cont ${c.cont.length} aud ${c.aud.length} ins ${c.insights.length} | serie ${c.serie.dias.length}d`);
  console.log('\nrecs:');
  for (const r of out.recs.slice(0, 10)) console.log(`- [${r.prioridad} ${r.score}] ${r.tipo} · ${r.campNombre} · ${r.contenido} · ${r.confianza} · vence ${r.vence}\n    ${r.porque}\n    ${r.gana}`);
  const c0 = out.campanas.find(c => c.kpi) || out.campanas[0];
  if (c0) { console.log('\nejemplo detalle:', c0.nombre, JSON.stringify({ kpi: c0.kpi, bench: c0.bench, resumen: c0.resumen, insights: c0.insights.map(i => i.tag + ': ' + i.texto.slice(0, 120)) }, null, 1)); console.log('cont[0]', JSON.stringify(c0.cont[0])); console.log('aud[0]', JSON.stringify(c0.aud[0])); }
  fs.writeFileSync(__dirname + '/data/_ultima_prueba.json', JSON.stringify(out, null, 1));
})().catch(e => { console.error('ERROR', e); process.exit(1); });
