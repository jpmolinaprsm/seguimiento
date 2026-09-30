# Handoff: Seguimiento y Optimización

## Overview
Interfaz del agente **Seguimiento y Optimización** del ecosistema Prosumia (separado de PAUTADOR). Sirve para que los implementadores sigan lo que está pautado en Meta (canales Oficial e Informativo), vean recomendaciones concretas de ajuste y registren qué decidieron con cada una. La especificación funcional completa está en `spec-funcional.md` (v0.3). Las secciones citadas abajo (§4.3, §7.5, etc.) remiten a ese documento.

## About the Design Files
Los archivos de este paquete son **referencias de diseño hechas en HTML**: prototipos que muestran el aspecto y el comportamiento buscados. **No son código de producción para copiar.** Hay que **recrearlos en el entorno del codebase de destino** (React, Vue, etc.) con sus patrones y librerías. Si todavía no existe un entorno, elegir el framework más adecuado; React + TypeScript es una buena opción por defecto.

- `Seguimiento y Optimización (standalone).html`: el prototipo completo en un solo archivo. Se abre con doble clic y funciona sin conexión. Es la mejor forma de ver la interacción.
- `Seguimiento y Optimizacion.dc.html` / `RecoCard.dc.html`: el código fuente del prototipo. La lógica de cada uno está en el `<script data-dc-script>` (una clase con `renderVals()`) y el markup en el template con holes `{{ }}`. Los datos de ejemplo (`PROJ`, `CAMPS`, `RECS`, `HIST`) y las reglas de derivación están al principio del script de `Seguimiento y Optimizacion.dc.html`. Para abrir los fuentes con estilos hace falta el design system de Prosumia (`_ds/…`), que no viene en este paquete. Para mirarlo, usar el standalone.

## Fidelity
**High-fidelity.** Colores, tipografía, espaciados, radios y copy son finales y siguen el **Prosumia Design System**. Recrear pixel-perfect. Los datos son de ejemplo (Gobierno del Chaco, 22/09/2026). Todo lo que toca la API de Meta está **simulado** y tiene que seguir marcado como tal en pantalla hasta que exista la integración real (spec §1, §9).

---

## Layout global
- Fondo blanco `#FFFFFF`, texto ink `#3C3C3C`, familia **Poppins** en todo.
- Contenedor central `max-width: 1280px`, padding horizontal `32px`. Es fluido: todos los grids usan `auto-fit/minmax` o flex-wrap.
- **Top bar** (borde inferior `1px #E4E4E4`, padding `20px 32px 0`):
  - Logo `assets/LogoColor.svg`, alto 28px. Separador vertical de 1×24px `#E4E4E4`. Nombre del producto "Seguimiento y optimización" (16px/600, nowrap).
  - Chip "Borrador · todo lo que toca Meta está simulado": borde `1px #D5D5D5`, radio pill, 11px/500, color `#5C5C5C`, `min-height: 24px`.
  - A la derecha, "Juan · Implementador" (13px/500, `#5C5C5C`).
- **Tabs** (gap 28px): Seguimiento · Recomendaciones · Historial. 15px. La activa va en 600 con borde inferior `3px #3C3C3C`; las inactivas en 500 y borde transparente. Recomendaciones lleva un badge con la cantidad de pendientes (22px de alto, pill, fondo `#F4F4F4`, 12px/600).
- **Barra de filtros global** (borde inferior `1px #E4E4E4`, padding `14px 32px`, flex-wrap, gap `12px 24px`). Visible en las tres pestañas:
  - Label en eyebrow (11px/500, `letter-spacing: .1em`, mayúsculas, `#5C5C5C`) y a su lado el control.
  - **Proyecto**: select pill (alto 36px, borde `1px #D5D5D5`, 13px/500).
  - **Canal**: control segmentado Ambos / Oficial / Informativo. Contenedor `#F4F4F4` con padding 3px. Opción de 30px de alto; la activa con fondo `#3C3C3C` y texto blanco. Por defecto: Ambos.
  - **Eje**: select (Todos, Deportes, Educación, Salud, Seguridad, Cultura).
  - A la derecha, la frescura: "Datos hasta 22/09 · chequeo de las 11:00 · consultado HH:MM" (12px, `#5C5C5C`), más un botón outline "Actualizar". Mientras carga, el botón dice "Actualizando…" (≈800 ms); al terminar, actualiza la hora de "consultado".
- **Main**: padding `32px 32px 96px`, columna con gap 28px.

## Screens / Views

### 1. Seguimiento → Panel general (§4.1, §4.2, §4.4)
Pregunta que responde: ¿qué está corriendo y a cuál entro?
1. **Encabezado**: eyebrow "{Proyecto} · septiembre 2026" y H1 "¿Qué está corriendo y a cuál entro?" (32px/600, `-0.02em`, lh 1.1).
2. **Card de presupuesto** (borde `1px #E4E4E4`, radio 24px, padding 24px):
   - Grid auto-fit `minmax(180px,1fr)` con 4 cifras: Presupuesto mensual, Gastado en el mes, Restante del mes, Proyección al cierre. Label 12px/500 `#5C5C5C`; valor 26px/600, `-0.02em`.
   - Barra de 10px, pill, fondo `#F4F4F4`. Encima, el relleno de proyección en `#D5D5D5` y, sobre ese, el de gastado en `#3C3C3C`.
   - Leyenda debajo (12px): "Gastado X %", "Proyección al cierre Y % (ritmo de los últimos 7 días)", "Día 22 de 30".
   - Aviso si la proyección supera el presupuesto mensual o si queda más del 15 % sin usar: caja `#F4F4F4`, radio 16px, punto amarillo `#FCB942` y texto 13px/500.
3. **Totales**: 4 tiles `#F4F4F4`, radio 20px, padding `16px 20px`. Valor 24px/600 y label 12px/500. Son: Campañas activas, Conjuntos vivos, Gasto de los últimos 7 días, Recomendaciones pendientes.
4. **Aviso de calidad de datos**: punto rojo, "15 conjuntos con problemas de carga." y un link "Ver lista" que despliega el bloque 6.
5. **Panel general**: H2 20px/600, con la nota de orden a la derecha. Es una tabla en card radio 24px:
   - Columnas `minmax(0,2fr) minmax(112px,1fr) minmax(104px,1fr) minmax(170px,1.2fr) 20px`.
   - Header `#F4F4F4` con eyebrows: Campaña · Estado · Piso · Recomendaciones.
   - Cada fila es un botón completo (padding `16px 24px`, borde superior `1px #E4E4E4`, hover `#FAFAFA`). Contiene:
     - Nombre (15px/600) y debajo "Eje · Canales" (12px `#5C5C5C`).
     - Estado y piso: punto de 8px más label, en nowrap.
     - Badge de pendientes: 26px, pill. Si hay alguna de prioridad alta, fondo `#F7444C` y texto blanco; si no, `#F4F4F4`. Al lado, "N de prioridad alta" / "pendientes" / "sin pendientes".
     - Chevron "›".
   - **Orden**: primero las que tienen problemas (piso "No llega" o "En riesgo", o estado "Sin entrega"); después, por gasto de los últimos 7 días descendente.
   - Estado vacío: texto en `#5C5C5C`. Para Lotería de Santa Fe muestra el texto de la spec §11.
6. **Calidad de datos del proyecto**: card plegable. Header con título, conteo y "Desplegar/Plegar". Cada ítem es una línea con punto `#A6AAA9` y borde superior.

### 2. Seguimiento → Detalle de campaña (§4.3)
Se abre al hacer clic en una fila (o en el nombre de la campaña dentro de una recomendación). "← Panel general" vuelve al panel; hacer clic en la pestaña Seguimiento también.
1. **Encabezado**: eyebrow "Proyecto · Eje", H1 36px/600 y, a la derecha, "Campaña de Meta: {id}" (12px, solo como contexto; spec §2). Chips de 28px, pill, `#F4F4F4`: estado (con punto), canales y "Objetivo: X".
2. **Resumen del agente**: caja `#F4F4F4`, radio 24px, padding `24px 28px`. Eyebrow y texto 22px/500, lh 1.4.
3. **KPIs**: grid auto-fit `minmax(240px,1fr)`, gap 16. Cuatro cards con borde, radio 24px y padding 22px:
   - *Resultado · últimos 7 días*: cifra 36px/600 (`-0.025em`) + unidad; costo por resultado; punto de color + "X veces la mediana".
   - *Avance contra el piso*: etiqueta arriba a la derecha y "N %" del esperado a la fecha. Barra de 8px con relleno en el color del piso (tope 100 %) y marca vertical gris en el 70 %. Debajo, "acumuladas contra esperadas".
   - *Ritmo de gasto*: etiqueta (En ritmo / Subejecutada / Sobreejecutada), dos barras (Gastado en `#3C3C3C` y Plazo en `#A6AAA9`) y la proyección en texto.
   - *Presupuesto*: 4 filas label/valor con hairline: Presupuesto, Gastado, Restante, Días restantes.
4. **Evolución en el tiempo** (flex `2 1 520px`) y **Relación con el benchmark** (flex `1 1 300px`):
   - Gráfico de barras diario, 220px de alto, barras `#5C5C5C` con radio superior 4px y gap 3px. Toggle segmentado entre resultado y costo por resultado.
   - Línea de mediana del benchmark: dashed `2px #F7444C`, con una etiqueta pill blanca de borde rojo alineada a la izquierda.
   - En los días donde se aplicó un cambio: línea vertical dashed ink y un pill ink "dd/mm · cambio". Debajo del gráfico, una caja gris con la descripción del cambio.
   - Etiquetas del eje X cada 4 días (10px). Tooltip nativo (`title`) por barra.
   - Benchmark: cifra 44px "X veces la mediana". Escala de 0 a ≥3, con la mediana (1×) en el 33,33 % y un punto de 18px del color de eficiencia. Debajo, la métrica comparada y el texto "Comparable: …".
5. **Rankings**: grid auto-fit `minmax(420px,1fr)` con dos cards, "Mejores y peores contenidos" y "Mejores y peores audiencias".
   - Columnas "Mejores" / "Peores", cada una con hasta 3 ítems.
   - "Ver todos (N)" las cambia por una sola lista ordenada de mejor a peor.
   - Cada fila muestra el nombre (14px/600) y el subtítulo (código · formato, o código · contenido). A la derecha, "X,X×" (15px/600) y una mini-barra de 96×6 con marca de mediana. Debajo, la meta en nowrap: resultado · costo · gasto, o la vía de ajuste.
   - Solo entran los ítems que superan el piso de volumen (§7.7).
6. **Insights**: grid auto-fit `minmax(280px,1fr)`. Cards `#F4F4F4`, radio 24px, con eyebrow del tipo (Cruce de canales / Fatiga de creativo / Posible solapamiento / Calidad de datos) y texto 14px/500. El cruce de canales incluye una mini-tabla blanca: Canal · Gasto · CPM · Reac./mil. Nota opcional en 12px gris.
7. **Recomendaciones de esta campaña**: las mismas tarjetas `RecoCard` de la pestaña Recomendaciones, sin el link a la campaña. Van todas, incluidas las ya decididas (apagadas).

Si la campaña está en estado Programada (sin KPI), se muestran solo el resumen y las recomendaciones.

### 3. Recomendaciones (§5)
- Eyebrow "{Proyecto} · todas las campañas" y H1 "¿Qué hay que cambiar hoy?". Contador: "N pendientes · X se pueden aplicar vía API (simulado) · Y manuales". Los pedidos a PAUTADOR cuentan como manuales.
- **Aviso de aprendizaje** (§8): caja gris con el texto "Dejé de proponer "Reforzar" en Juegos Suramericanos…" y el botón "Volver a mostrar". El botón vuelve a mostrar la recomendación silenciada (`silenced: true`) y oculta el aviso.
- **Filtros**:
  - Toggle "Solo pendientes" (switch de 36×24, activo `#3C3C3C`). Por defecto está activado; con el filtro activo siguen visibles las aceptadas manuales que todavía están "pendientes de hacer".
  - Selects Tipo, Vía (Todas / API (simulado) / Manual / PAUTADOR) y Confianza.
  - Segmentado "Agrupar": Ninguno / Eje / Campaña. Al agrupar se agrega un H2 por grupo con el conteo.
- **Orden**: por `score` de prioridad descendente (§7.5). Las de confianza baja nunca quedan primeras.

### 4. Tarjeta de recomendación — `RecoCard` (§5.2–5.4)
Card con borde `1px #E4E4E4`, radio 24px, padding `24px 28px`, gap 18px, lh 1.5.
1. **Fila de chips** (26px, pill, 12px):
   - Prioridad con punto (Alta `#F7444C`, Media `#FCB942`, Baja `#D5D5D5`).
   - Tipo.
   - Vía, en outline: "Vía API (simulado)" / "Manual" / "Pedido a PAUTADOR".
   - Confianza con punto (Alta `#46C678`, Media `#FCB942`, Baja `#D5D5D5`).
   - A la derecha, "Vence dd/mm".
2. **Qué hacer**: H3 20px/600.
3. **Dónde**: link a la campaña (subrayado; abre el detalle) → contenido. Debajo, una línea por conjunto: "Conjunto → ubicación · segmentación".
4. **Por qué** / **Qué se espera ganar**: 2 columnas auto-fit `minmax(240px,1fr)`, eyebrow y 14px.
5. **Aplicación técnica**: caja `#F4F4F4`, radio 16px, con eyebrow "Aplicación técnica · vía". Los pasos van en lista numerada 14px/500. Debajo de un hairline, los controles de seguridad (§7.4): punto verde de 6px y texto 12px gris.
6. **Acciones** (botones de 40px, pill):
   - La primaria es sólida ink y blanca, con hover opacity .9. Su texto depende de la vía: "Aplicar (simulado)" (API), "Aceptar, lo hago a mano" (manual) o "Aceptar y pedir pieza en PAUTADOR" (rotar creativo).
   - Las secundarias son outline `1.5px #3C3C3C`, con hover `#F4F4F4`: "Aceptar sin incorporar", "Responder", "Declinar". La que está abierta queda con fondo `#E4E4E4`.
7. **Formulario inline** (caja gris, radio 16px) según la decisión:
   - *Aceptada, no incorporada*: justificación obligatoria.
   - *Respondida*: texto libre obligatorio.
   - *Declinada*: primero un motivo con chips de selección única (Es intencional · Pedido del cliente · No hay pieza · Timing · No coincido con el análisis · El dato está mal · Otro); después, la justificación obligatoria.
   - Mensajes de error en `#E9121C` 13px: "Elegí un motivo." / "La justificación es obligatoria." / "Escribí la respuesta.".
   - Botones "Registrar" (sólido) y "Cancelar" (link).
8. **Después de decidir** (§5.4): el cuerpo queda a opacity .5 y aparece una línea de estado con punto de color:
   - "Aplicada vía API (simulado) el 23/09 por Juan. El resultado se mide a los 7 días."
   - "Aceptada el 23/09 por Juan · pendiente de hacer a mano." En este caso el cuerpo no se apaga y aparece el botón "Marcar hecho", que la pasa a "Hecha a mano el …".
   - "Pedido de pieza nueva enviado a PAUTADOR (simulado) …"
   - "Aceptada, no incorporada … — "texto"" / "Respondida … — "texto"" / "Declinada … · motivo — "texto""
   - Siempre con el link "Deshacer".
9. Toda decisión muestra un **toast** (pill ink, fijo abajo al centro) "Decisión registrada: {tipo}" con "Deshacer". Se oculta a los 5 s.

### 5. Historial (§6)
- Eyebrow, H1 "Historial" y botón sólido "Exportar CSV". El prototipo genera el CSV en el cliente, separado por `;`, con BOM UTF-8.
- Filtros: Implementador, Decisión, Tipo de cambio. A la derecha, "N decisiones".
- Tabla en card radio 24px con scroll horizontal (`min-width: 1100px`). Header `#F4F4F4` con eyebrows. Columnas:
  - Fecha · Quién.
  - Campaña · contenido: campaña en 600 y debajo "contenido · canal · proyecto".
  - Cambio.
  - Decisión: punto de color (Aceptada e incorporada verde, No incorporada amarillo, Respondida gris, Declinada rojo) y la justificación debajo.
  - Aplicación.
  - Resultado a 7 días: antes → después y la lectura "Mejoró / Sin cambio / Empeoró" con punto.
- Las decisiones tomadas en la sesión se agregan arriba de todo, con "Se mide el 30/09".

---

## State Management
Estado raíz (ver la clase del prototipo):
- `tab`: `'seg' | 'rec' | 'his'`.
- `proyecto`, `canal` (`Ambos|Oficial|Informativo`), `eje`: filtros globales. Afectan a las tres pestañas.
- `campId`: campaña abierta en el detalle (`null` = panel general).
- `metric`: `'res' | 'cost'` (toggle del gráfico). `allCont`, `allAud`: "Ver todos". `calidadOpen`.
- `decisions: { [recId]: { tipo: 'aceptada'|'noinc'|'resp'|'decl', texto?, motivo?, hecho?, fecha, quien, ts } }`. Es **la única fuente de verdad**: la pestaña Recomendaciones, el detalle de la campaña, los contadores, los badges del panel y el Historial se derivan de acá. Decidir en un lugar actualiza todos (§4.3.8, §5.1).
- `soloPend`, `fTipo`, `fVia`, `fConf`, `agrupar`, `unsilenced`.
- `hImpl`, `hDec`, `hTipo` (filtros del historial). `consultado`, `refreshing`, `toast`.
- Estado local de `RecoCard`: `mode` (formulario abierto), `text`, `motivo`, `err`.

En producción, toda decisión persiste en la base propia del agente con quién, cuándo, una foto de la recomendación y las métricas de ese momento. También tiene que poder deshacerse (§5.3).

### Reglas derivadas que la UI tiene que respetar
- Colores de estado: Activa `#46C678` · Por vencer `#FCB942` · Sin entrega `#F7444C` · Agotada `#A6AAA9` · Programada `#D5D5D5`.
- Piso: En camino verde · En riesgo amarillo · No llega rojo (umbrales en §7.3).
- Eficiencia ("veces la mediana"): ≥1 verde · ≥0,5 amarillo · <0,5 rojo.
- Formato numérico es-AR: miles con punto y decimales con coma (`$325.230`, `0,2`); magnitudes como `$3,2 M`.

### Datos (§9)
- DataJunta: gasto, impresiones, clics y reacciones por conjunto y día; presupuesto, fechas, eje, campaña, contenido, audiencia.
- BigQuery: benchmark y alertas.
- PAUTADOR: vía de ajuste (API o manual) por conjunto.
- Aplicar cambios en Meta queda **simulado**. Alcance, frecuencia y estados de entrega quedan **pendientes**.

## Design Tokens (Prosumia Design System)
- **Colores**:
  - Ink `#3C3C3C` · Ink light `#5C5C5C` (texto secundario).
  - Gray-100 `#F4F4F4` (cards y tiles suaves) · Gray-200 `#E4E4E4` (hairlines y bordes) · Gray-300 `#D5D5D5` (bordes de controles) · Gray-400 `#A6AAA9`.
  - Red `#F7444C` / red-deep `#E9121C` (errores) · Green `#46C678` · Yellow `#FCB942` · White `#FFFFFF`.
- **Reglas de color**: la interfaz es interna, así que el fondo es siempre blanco. Los colores de marca se usan solo como acento (puntos de estado, barras, línea de mediana, badge de prioridad alta). Sobre un pleno de color, todo va en blanco. No hay sombras ni gradientes.
- **Tipografía**: Poppins.
  - Pesos: 600 en títulos, cifras y botones; 500 en labels, chips y eyebrows; 400 en cuerpo.
  - Escala UI: 36 / 32 (H1) · 22 (resumen) · 20 (H2 y títulos de recomendación) · 18 (títulos de card) · 15 · 14 (cuerpo) · 13 · 12 · 11 (eyebrow) · 10 (eje del gráfico).
  - Eyebrow: 11px/500, mayúsculas, `letter-spacing: .1em`, `#5C5C5C`. Cifras grandes con `letter-spacing` de −0.02 a −0.025em.
- **Radios**: pill `9999px` (botones, chips, barras) · 24px (cards) · 20px (tiles) · 16px (cajas internas) · 12–14px (inputs, mini-tabla).
- **Espaciado**: gaps de 8 / 12 / 16 / 18 / 24 / 28; padding de card 22–28px.
- **Alturas de controles**: 40 (botón principal) · 36 (select, botón secundario) · 30 (opción segmentada) · 26–28 (chips).
- **Estados**: hover en sólidos con opacity .9; en outline, fondo `#F4F4F4`. Filas de tabla con hover `#FAFAFA`. Sin escalado.

## Assets
- `assets/LogoColor.svg`: logo Prosumia a color (del design system). No hay otros íconos ni imágenes: los estados usan puntos de color, sin íconos.

## Files
- `Seguimiento y Optimización (standalone).html`: prototipo navegable completo.
- `Seguimiento y Optimizacion.dc.html`: pantalla raíz (tabs, filtros, panel, detalle, recomendaciones, historial) con los datos de ejemplo.
- `RecoCard.dc.html`: tarjeta de recomendación con el flujo de decisiones.
- `spec-funcional.md`: especificación funcional v0.3 (reglas del motor, fuentes, pendientes).
- `assets/LogoColor.svg`.
