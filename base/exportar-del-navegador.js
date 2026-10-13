// Seguimiento y Optimización · EXPORTAR TODO LO GUARDADO EN ESTE NAVEGADOR (13/10/2026, agente Recomendaciones).
// Para pegar en la consola del navegador (F12 → Consola) con la app abierta. No cambia nada de la app ni del navegador:
// solo lee todas las claves "syo." de localStorage y sessionStorage y baja un archivo syo-export-AAAA-MM-DD.json.
// Después lo carga base/cargar-navegador.js. Ver Seguimiento/DESPLIEGUE.md, sección "Base".
(() => {
  const juntar = (almacen) => {
    const o = {};
    try { for (let i = 0; i < almacen.length; i++) { const k = almacen.key(i); if (k && k.startsWith('syo.')) o[k] = almacen.getItem(k); } } catch (e) { /* sin acceso */ }
    return o;
  };
  const local = juntar(window.localStorage), sesion = juntar(window.sessionStorage);
  const claves = Object.keys(local).length + Object.keys(sesion).length;
  if (!claves) { alert('No encontré nada guardado por la app (claves que empiezan con "syo.") en este navegador y esta dirección: ' + location.origin + '\nSi usás la copia de claude.ai, la consola tiene que estar en el cuadro de la copia (ver instrucciones).'); return; }
  const mail = (prompt('Tu mail de trabajo (firma lo que se suba a la base). Si lo dejás vacío, queda "sin identificar":', '') || '').trim().toLowerCase();
  const salida = { formato: 'syo-export-1', exportado: new Date().toISOString(), origen: location.origin, autor_mail: mail, local, sesion };
  const archivo = 'syo-export-' + salida.exportado.slice(0, 10) + '.json';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(salida, null, 1)], { type: 'application/json' }));
  a.download = archivo;
  document.body.appendChild(a); a.click(); a.remove();
  console.log('Listo: bajó ' + archivo + ' con ' + claves + ' claves: ' + Object.keys(local).concat(Object.keys(sesion)).join(', '));
})();
