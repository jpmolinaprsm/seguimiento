# Seguimiento y Optimización · app sobre el diseño curado

Toma el diseño exportado de Claude Design (`../Seguimiento y Optimizacion.html`, no editar a mano) y lo alimenta con datos reales.
Quién es dueño de cada archivo: `../../seguimiento-agentes/LEEME.md`. Reglas vigentes: `../documentos/reglas-recomendador-v0.3.md`.

## Cómo regenerar y probar
```bash
node ../borrador/_extraer.js   # baja de BigQuery (solo lectura; tarda varios minutos): Meta 180 d, todas las plataformas, conjuntos, alcance, eficacia, semanal desde 2024
node armar.js                  # arma "Seguimiento y Optimizacion.html" en esta carpeta y el repositorio de recomendaciones del día
node pruebas/contrato.js       # todas las pantallas, pestañas, períodos y campañas: tiene que dar "problemas 0"
node pruebas/huella.js         # huella de lo armado: igual antes y después si solo se movió código de lugar
node servir.js                 # http://localhost:4330 (hace falta para Looker y para guardar respuestas)
```
`node armar.js` tiene que decir `parches aplicados N/N` con los dos números iguales, sin `PARCHE NO ENCONTRADO` ni `SECCIÓN NO ENCONTRADA`.

## Cómo fluyen los datos
1. `../borrador/_extraer.js` (con `../datos/bq.js`) baja BigQuery a `../borrador/_proyectos.json`.
2. `../borrador/armar.js` calcula referencias, luces, campañas, tipos de campaña e insights, y llama a
   `../borrador/recomendaciones.js`, que corre las reglas de `../borrador/reglas/` (meta, google, generales).
3. `armar.js` (esta carpeta) suma períodos, todas las plataformas, conjuntos de anuncios, alcance y links de piezas; pasa cada
   recomendación por `redaccion.js`; inyecta `logica.js` + los datos en el diseño; reemplaza las secciones de Ejes, Audiencias y
   Activos por `arbol.js`, saca Publicaciones y Comparación, suma Looker (`looker.js`) y aplica `parches.js`.

## Archivos
- `armar.js`: el armado (compartido). `redaccion.js`: título, Problema → Solución, afectado, qué revisar, catálogo "Cómo lo
  detectamos" y repositorio de recomendaciones.
- `logica.js`: la clase `Component extends DCLogic` que produce cada valor del markup (`renderVals()`), los árboles, filtros,
  tipos de campaña, el panel de Acciones, Looker y la exportación de comentarios.
- `arbol.js`: tablas anidadas estilo "Detalle" de Dirección, con logos, sin scroll horizontal. Ejes y Audiencias terminan en
  Eficacia; Activos tiene Campañas, Contenidos y Salud (ritmo de gasto y restante del pedido).
- `looker.js`: pestaña con el tablero de Looker Studio embebido (links fijos en `LOOKERS` de `armar.js`; el iframe vive fuera del
  template para que no se recargue).
- `logos.js`: logos de plataforma como SVG embebido. `parches.js`: cambios puntuales al markup del diseño.
- `servir.js`: sirve la app y recibe las respuestas del equipo (`POST /api/respuesta`, `GET /api/respuestas`).
- `pubs.js`: Publicaciones con Comparación interna. Fuera por ahora; no se inyecta.
- `pruebas/`: `contrato.js` y `huella.js`.

## Pestañas
Resumen (variante B · tablero) · Activos · Ejes · Campañas · Audiencias · Insights · Looker.
- Ejes: eje → campaña → pieza → anuncio (conjuntos de Meta del mes en curso). Audiencias: audiencia → campaña → pieza (solo Meta).
  Activos: activo → campaña.
- El período (meses, últimos 7/30/90 días) aplica a Campañas, Ejes, Audiencias y Activos; el Resumen es siempre el mes en curso.

## Decisiones vigentes
- Panel de Acciones variante B (lista + detalle). Descartar tiene motivo "Otra" con texto libre.
- "Hecho a mano" pide motivo (lista `MOTIVOS_MANUAL` de `logica.js`, provisoria); sin motivo no se confirma, ni a mano ni al descartar.
- Reglas vigentes: sección de "Cómo leer", antes de "Cómo comentar". Salen de `../borrador/reglas-vigentes.js` (una sola fuente, la lee
  `armar.js`), ordenadas por prioridad sin el número, más la línea "en observación". Cada regla se comenta: va a `/api/respuesta` como
  `{ clase: 'regla', regla, comentario, autor, proyecto, canal }` y se muestran los comentarios de `GET /api/respuestas`.
- Autor: todo lo que se manda al repositorio lleva `autor`. En local se pide una vez y queda en el navegador (`syo.autor`; vacío =
  "sin identificar"); en Railway saldrá de la sesión: se cambia solo `autorActual()` de `logica.js`.
- Luces con ±20 %; eficacia con la regla de Looker (`automatizado.eficacia_anuncios`); fuera de Meta, referencias por plataforma
  (últimos 180 días).
- Alcance: provisorio, suma del alcance diario de Meta desde BigQuery. La decisión es leerlo desde la API de Meta, solo de las
  cuentas con acceso. Cobertura de audiencias: sin dato.
- Decisiones, opiniones, comentarios, tipos de campaña y links de Looker pegados quedan en el navegador (localStorage `syo.*`);
  "Exportar comentarios" baja un `.md`.

## Repositorio para el aprendizaje
- `repositorio/recomendaciones/AAAA-MM-DD.jsonl`: todo lo que generó el agente con los datos de ese día (lo escribe
  `redaccion.js` al armar).
- `repositorio/respuestas.jsonl`: lo que respondió el equipo (lo escribe `servir.js`). Se cruza por `id`.
- Solo se guarda si la app se abre por `http://localhost:4330`.

## Para tener en cuenta
- `pautador/src/services/bqDatajunta.js` devolvía solo la primera página de cada consulta hasta el 29/09/2026: los datos
  extraídos antes de esa fecha venían truncados. Ya está corregido (cambio en PAUTADOR, sin push).
- Córdoba entra en los dos canales; en Meta todavía no tiene referencias de proyecto.
