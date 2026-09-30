# Seguimiento y Optimización — especificación funcional (borrador)

Versión 0.4 · 23/09/2026 · Solo texto: qué muestra cada pantalla, con qué datos y con qué reglas. El diseño visual se define aparte.

---

## 1. Qué es

Un agente del ecosistema de Prosumia, separado de PAUTADOR, que:

1. **Sigue** lo que está pautado: qué está activo, cómo rinde y cómo va el gasto.
2. **Recomienda** qué mejorar en cada contenido y campaña para llegar al objetivo, con el paso técnico concreto.
3. **Registra** qué se decidió con cada recomendación y cómo le fue al conjunto después.

PAUTADOR crea la pauta; Seguimiento y Optimización la mira mientras corre y propone ajustes. Comparten activos, proyectos y la marca visual.

**Cómo una recomendación aceptada vuelve a convertirse en un cambio real dentro de PAUTADOR es, en rigor, el problema central** — esta pantalla es la capa que se construye después de resolver esa conexión. Sigue en pie como pendiente (sección 10) mientras se termina de moldear la pantalla.

### Principios del borrador

- **Todo lo que sea API de Meta está simulado.** Aplicar un cambio, leer alcance y frecuencia, ver si un anuncio fue rechazado: en este borrador se simula y se marca como tal en pantalla. Ningún botón toca Meta.
- **Usuarios: implementadores.** Se puede usar vocabulario técnico (conjunto, CPM, presupuesto diario, fase de aprendizaje). A futuro, esta vista entra en una plataforma más grande donde cada implementador ve el estado de sus seguimientos.
- **Se compara contra el benchmark**, más un **piso simulado** de impresiones o interacciones por campaña (sección 7.3).
- **Fuera del alcance:** Córdoba, y todo lo que sea encuesta (activos Pulso, Vibes Argentina, proyectos Observatorio y Analytics).
- **Solo Meta**, canales Oficial e Informativo.

---

## 2. Vocabulario y jerarquía

La pantalla se ordena en cuatro niveles, de mayor a menor:

| Nivel | Qué es | De dónde sale | Ejemplo |
|---|---|---|---|
| **Eje** | El tema | `Eje` de DataJunta | Deportes, Seguridad, Educación |
| **Campaña** | Lo que el equipo llama campaña | `Comunicacion` de DataJunta | "Más Futuro", "Juegos Suramericanos" |
| **Contenido** | La pieza | `Codigo_Contenido` y `Contenido` | GDCHACAED10771 · "Inscripción Chaco sin Resistencia" (Placa Fija) |
| **Conjunto** | El conjunto de anuncios de Meta: lo que se ajusta | `Conjunto_de_Anuncios` | … · FB/IG Feed · Toda la provincia excluyendo Resistencia |

- La "campaña" de Meta (`Campana` en DataJunta) **no** es la campaña de esta pantalla: es un contenedor por objetivo que agrupa varias comunicaciones. Solo se muestra como dato de contexto.
- Una misma campaña puede correr en **Oficial e Informativo** a la vez. Se la muestra una vez, con los dos canales.
- Los conjuntos de Facebook e Instagram de la misma pieza son el mismo contenido: las recomendaciones se agrupan por contenido.
- Un **conjunto** de Meta encierra tanto la ubicación (FB/IG Feed, Reels…) como la segmentación: en esta pantalla es lo más cercano a "una audiencia". Cuando se habla de "mejores/peores audiencias" de una campaña, es un ranking de sus conjuntos.

---

## 3. Navegación

Tres pestañas: **Seguimiento · Recomendaciones · Historial**.

- **Seguimiento** tiene dos niveles: un **panel general** liviano (una fila por campaña, para decidir dónde entrar) y, al abrir una fila, el **detalle de la campaña** con todo lo demás — KPIs, evolución, mejores/peores, insights y sus recomendaciones.
- **Recomendaciones** es la misma información que aparece dentro de cada detalle de campaña, pero **ordenada de punta a punta entre todas las campañas**: la cola de triage diario para quien sigue varias campañas y no quiere entrar una por una a buscar lo urgente.
- **Historial** no cambia (sección 6).

Filtros globales, visibles en las tres:
- **Proyecto** (cliente).
- **Canal:** Oficial, Informativo o Ambos (por defecto, Ambos).
- **Eje:** todos o uno (en el panel general, actúa como filtro, no como agrupador con su propio resumen).
- **Actualizar:** vuelve a consultar los datos. Al lado, la frescura: "Datos hasta 22/09 · chequeo de las 11:00 · consultado 14:32".

---

## 4. Pantalla: Seguimiento

Pregunta que responde: **¿qué está corriendo, cómo va, y a cuál entro?**

### 4.1 Encabezado del proyecto

- **Presupuesto mensual del proyecto** (de DataJunta), **gastado en el mes**, **restante del mes** y **proyección al cierre del mes** al ritmo de los últimos 7 días.
- Aviso si la proyección supera el presupuesto mensual o si va a quedar más del 15 % sin usar.
- Totales: campañas activas, conjuntos vivos, gasto de los últimos 7 días, recomendaciones pendientes.
- Si hay conjuntos con problemas de carga (sección 4.4), un aviso corto con el conteo y link a la lista completa.

### 4.2 Panel general

Una fila por campaña, sin agrupamiento extra por eje (el eje queda como filtro arriba). Orden por defecto: primero las que tienen problemas, después por gasto de los últimos 7 días.

Cada fila muestra solo lo necesario para decidir si hay que entrar:
- **Nombre** de la campaña, **eje** y **canales** donde corre (Oficial, Informativo o los dos).
- **Estado** (sección 7.1).
- **Piso:** en camino / en riesgo / no llega (sección 7.3).
- **Recomendaciones pendientes** (número; en rojo si alguna es de prioridad alta).

Todo lo demás — objetivo, KPI exacto, ritmo de gasto, presupuesto — vive en el detalle.

### 4.3 Detalle de la campaña (al abrirla)

**4.3.1 Resumen en una frase**, armado por el agente. Ejemplo: "Gasta en ritmo pero genera la quinta parte de las reacciones esperadas; el problema está en dos de sus cinco contenidos."

**4.3.2 KPIs principales**
- Objetivo (Alcance, Impresiones, Interacción, Tráfico).
- Resultado de los últimos 7 días y costo por resultado (sección 7.2).
- Avance contra el piso: acumulado contra esperado a la fecha, con la etiqueta en camino / en riesgo / no llega.
- Ritmo de gasto: % gastado contra % del plazo transcurrido, con la etiqueta en ritmo / subejecutada / sobreejecutada y la proyección al cierre.
- Presupuesto, gastado, restante y días restantes.

**4.3.3 Evolución en el tiempo**
- Gráfico diario del resultado principal (o del costo por resultado, según objetivo) de los últimos 30 días, o desde el inicio de la campaña si empezó después.
- Línea de referencia con la mediana del benchmark del mismo período.
- Marcas en los días donde se aplicó un cambio (de la sección 4.3.8 o del historial), para ver a simple vista si movió la aguja.

**4.3.4 Relación con el benchmark**
- Cuántas veces la mediana está el costo por resultado de la campaña, contra el conjunto de comparables usado (objetivo, formato, tipo de geografía y segmentación — sección 7.2).
- Tamaño del comparable ("30 conjuntos de Interacción, placa fija, audiencia provincial abierta, últimas 13 semanas").
- Este es el mismo dato que sostiene el piso simulado (7.3) y el "por qué" de las recomendaciones (5.2): acá se muestra de forma explícita, no solo como justificación de un cambio puntual.

**4.3.5 Mejores y peores contenidos**
- Ranking de los contenidos de la campaña por eficiencia contra la mediana (mejores 3, peores 3; link a "ver todos").
- Cada fila: contenido, resultado, costo por resultado, veces la mediana, gasto acumulado.
- Solo entran contenidos que superan el piso de volumen mínimo (sección 7.7), para no rankear con datos insuficientes.

**4.3.6 Mejores y peores audiencias**
- Mismo ranking, a nivel conjunto (la "audiencia" de esta pantalla — sección 2). Mejores 3, peores 3; link a "ver todos".
- Cada fila: conjunto (ubicación + segmentación), contenido al que pertenece, resultado, costo por resultado, veces la mediana, vía de ajuste (API simulada / manual).
- Mismo piso de volumen mínimo que 4.3.5.

**4.3.7 Insights**
Hallazgos automáticos, en lenguaje llano, acotados a esta campaña:
- **Cruce de canales**, solo si corre en Oficial e Informativo: gasto, CPM y reacciones por mil de cada canal, con una lectura ("Informativo genera 13 veces más reacciones por mil; Oficial tiene el CPM 40 % más barato").
- **Fatiga de creativo**: contenidos con más de 21 días activos (mismo umbral que dispara "Rotar creativo" en 7.5).
- **Solapamiento de audiencias**: conjuntos de la misma campaña con segmentación que se superpone (por ejemplo, uno apunta a toda la provincia y otro a la capital) y podrían estar compitiendo por el mismo público. Heurística aproximada, a refinar (7.8).
- **Calidad de datos** de esta campaña puntual (ver también 4.4, la lista completa del proyecto).

**4.3.8 Recomendaciones de esta campaña**
- Mismas tarjetas y las mismas cuatro decisiones que en la pestaña Recomendaciones (sección 5.2 y 5.3), filtradas a esta campaña.
- Es la misma información que aparece en la cola global de Recomendaciones — decidir acá o decidir allá actualiza lo mismo.

### 4.4 Calidad de datos del proyecto

Bloque plegado, con la lista completa de lo que no se pudo analizar por cómo está cargado (cruza todas las campañas del proyecto). Ejemplos:
- "Lotería de Santa Fe: la comunicación está cargada como 'Stories' e 'IG/FB Feed'."
- "12 conjuntos sin eje."
- "3 conjuntos sin presupuesto asignado: no se puede calcular el ritmo."

---

## 5. Pantalla: Recomendaciones

Pregunta que responde: **¿qué tengo que cambiar hoy, en cualquiera de mis campañas, y cómo?**

### 5.1 Lista

- Ordenada por **prioridad** (sección 7.5), de punta a punta entre todas las campañas — las más urgentes arriba, sin importar el eje o la campaña.
- Agrupable por eje o por campaña.
- Filtros: solo pendientes (por defecto), tipo de cambio, vía de ajuste (API simulada o manual), confianza.
- Contador: "18 pendientes · 6 se pueden aplicar vía API (simulado) · 12 manuales".
- Cada recomendación también es visible, con el mismo contenido, dentro del detalle de su campaña (4.3.8). Decidir en un lado o en el otro es lo mismo.

### 5.2 Una recomendación

Cada recomendación es sobre un **contenido** (con uno o más conjuntos) o sobre una **campaña**. Muestra:

1. **Qué hacer**, en una línea: "Bajar 20 % el presupuesto diario", "Pausar el conjunto", "Rotar el creativo".
2. **Dónde:** campaña → contenido → conjuntos afectados (con ubicación).
3. **Por qué:** el dato que la dispara, comparado con el benchmark o el piso. "Genera 0,1 veces las reacciones por impresión de conjuntos comparables (30 conjuntos de Interacción, placa fija, provincia, audiencia abierta)."
4. **Qué se espera ganar:** "+1.200 reacciones en los 9 días que quedan, con el mismo gasto" o "evita que sobren $325.000".
5. **Aplicación técnica:** los pasos exactos.
   - Vía API (simulado): "Presupuesto diario del conjunto: $22.000 → $17.600 (-20 %)". Botón **Aplicar (simulado)**.
   - Manual: "En el administrador de anuncios → conjunto X → presupuesto diario → $17.600". Botón **Marcar hecho**.
   - Rotar creativo: "Pedir una pieza nueva en PAUTADOR para la misma campaña y audiencia", con un enlace al pedido.
6. **Controles de seguridad** que ya aplicó (sección 7.4): "Limitado a -20 % para no reiniciar el aprendizaje de Meta".
7. **Confianza:** alta, media o baja, según cuántos conjuntos comparables hubo.
8. **Vence:** cuándo deja de tener sentido (normalmente, el fin del conjunto o de la campaña).

### 5.3 Las cuatro decisiones

| Decisión | Qué pide | Qué pasa después |
|---|---|---|
| **Aceptada e incorporada** | Nada | Si es vía API, se aplica (simulado). Si es manual, queda "pendiente de hacer" hasta que se marque hecha. A los 7 días se mide el resultado. |
| **Aceptada, no incorporada** | Justificación obligatoria | Se registra que el análisis es correcto pero no se actúa ahora (por ejemplo, "lo hacemos en el próximo pedido"). |
| **Respondida** | Texto libre | Es la vía para enseñarle al agente: qué debería haber recomendado, qué contexto no está viendo. |
| **Declinada** | Motivo de una lista + justificación obligatoria | Se registra por qué no. Motivos: es intencional · pedido del cliente · no hay pieza · timing · no coincido con el análisis · el dato está mal · otro. |

Toda decisión se puede deshacer. Guarda quién, cuándo, una foto de la recomendación y las métricas de ese momento.

### 5.4 Estado después de decidir

La recomendación queda visible (apagada) con su estado: "Aplicada vía API (simulado) el 23/09 por Juan" o "Pendiente de hacer a mano". Con "Solo pendientes" activo, desaparece de la lista.

---

## 6. Pantalla: Historial

- Todas las decisiones, de la más nueva a la más vieja: fecha, implementador, proyecto, canal, campaña, contenido, tipo de cambio, decisión, justificación o respuesta, estado de aplicación.
- **Resultado a los 7 días** de cada cambio aplicado: KPI antes y después, contra la mediana, y una lectura ("mejoró", "sin cambio", "empeoró"). El mismo resultado ya es visible como marca sobre el gráfico de evolución de la campaña (4.3.3); acá queda el registro completo y exportable.
- Filtros por proyecto, implementador, decisión y tipo de cambio.
- Exportar (para el aprendizaje, sección 8).

---

## 7. Reglas del motor

### 7.1 Estados de campaña y de conjunto

| Estado | Cuándo |
|---|---|
| Activa | Gastó en las últimas 48 h y le quedan más de 3 días |
| Por vencer | Gastó en las últimas 48 h y le quedan 3 días o menos |
| Sin entrega | Tiene presupuesto y fecha vigente, pero no gastó en 48 h |
| Agotada | Gastó el 98 % o más de su presupuesto y paró |
| Programada | Todavía no empezó |

La campaña toma el estado más "vivo" de sus conjuntos. "Sin entrega" no distingue todavía entre rechazado, en revisión o entrega limitada: eso requiere la API de Meta y se suma después.

### 7.2 KPIs principales según el objetivo

| Objetivo | Resultado | Costo por resultado | Eficiencia contra benchmark |
|---|---|---|---|
| Alcance | Impresiones (alcance y frecuencia, cuando estén desde Meta) | CPM | CPM contra la mediana |
| Impresiones | Impresiones | CPM | CPM contra la mediana |
| Interacción | Reacciones | Costo por reacción | Reacciones por mil impresiones contra la mediana |
| Tráfico | Clics | Costo por clic | CPC contra la mediana |

- "Interacción" de Meta incluye reproducciones de video: solo se compara dentro del mismo formato.
- El benchmark es la mediana de conjuntos comparables (mismo objetivo, formato, tipo de geografía y segmentación de audiencia) de las últimas 13 semanas. Se recalcula los lunes.

### 7.3 Piso simulado

Mientras no haya metas cargadas por campaña, el piso simula **lo que lograría una campaña mediana con este presupuesto**:

- **Resultado esperado total** = presupuesto ÷ costo por resultado de la mediana del benchmark.
  Ejemplo: $400.000 en Interacción, placa fija, a $90 por reacción mediana → 4.444 reacciones.
- **Piso** = 80 % del resultado esperado total (el porcentaje es configurable).
- **Esperado a la fecha** = piso × % del plazo transcurrido.
- **Etiqueta:**
  - En camino: acumulado ≥ esperado a la fecha.
  - En riesgo: entre 70 % y 100 % del esperado a la fecha.
  - No llega: menos del 70 %, o la proyección al cierre queda por debajo del piso.
- **Proyección al cierre** = acumulado + resultado diario de los últimos 7 días × días restantes.

Cuando existan metas reales, reemplazan al piso sin cambiar la pantalla.

### 7.4 Controles de seguridad (fase de aprendizaje de Meta)

Toda recomendación que toque presupuesto o entrega respeta:

1. **Máximo ±20 %** del presupuesto diario por cambio (más reinicia el aprendizaje del conjunto).
2. **Un cambio por conjunto cada 3 días.** Si el conjunto se tocó hace menos, la recomendación espera.
3. **Nada en los últimos 2 días** del conjunto.
4. **Nunca por debajo del mínimo diario de Meta.**
5. **Mover plata entre campañas respeta el presupuesto mensual** del proyecto.
6. **Rotar creativo no se aplica solo:** genera un pedido de pieza nueva en PAUTADOR.

### 7.5 Tipos de recomendación y prioridad

| Tipo | Se dispara cuando |
|---|---|
| Reforzar | El conjunto rinde 2 veces o más que la mediana y tiene presupuesto y plazo por delante |
| Bajar presupuesto | Rinde entre 0,25 y 0,5 veces la mediana |
| Pausar y mover el restante | Rinde 0,25 veces la mediana o menos; el restante va al mejor conjunto de la misma campaña |
| Revisar audiencia | CPM más de 2 veces la mediana (típico de audiencias chicas) |
| Revisar entrega | Sin entrega con presupuesto vigente |
| Acelerar | Subejecutado: gastó menos de la mitad de lo que corresponde al plazo |
| Frenar | Sobreejecutado: gastó más de 1,15 veces lo que corresponde al plazo |
| Rotar creativo | Fatiga medida: la tasa de reacción móvil de 7 días cae 35 % contra la primera semana. Respaldo por calendario: placa fija y carrusel a los 12 días, video a los 15 (evento y turismo, 25). La mitad de los contenidos largos fatiga antes del día 15 |
| Lectura temprana | Al día 5 de vuelo, contenido en el peor cuartil de su comparable → pausar o mover; en el mejor cuartil → reforzar. Antes del día 3 no se recomienda (pico de novedad). Al día 5 el rango ya predice el final (82 % de los peores siguen peores; 3 % se recupera) |
| Ampliar audiencia | Contenido que fatiga antes del día 10 sobre audiencia chica (ciudad, departamento, lista, custom), o campaña de Alcance solo con audiencias chicas: sumar la abierta provincial (rinde 0,92 vs 1,3–1,8 de las chicas) |
| Presión por habitante | Impresiones del cliente por habitante y por mes: aviso a 60, alerta a 80 (Chubut a 80–100 tiene la tasa de reacción en 0,57 de la mediana) |
| Continuidad por eje | En 7 días no queda nada vivo en un eje que históricamente siempre tuvo algo. Se evalúa por eje, no por campaña |

**Reglas de contexto** (cambian la comparación, no generan recomendación): comparable electoral en campaña y veda (sección 7.9); audiencias custom / núcleo duro se comparan entre sí; el ratio de la campaña se muestra junto al ratio histórico del proyecto ("este proyecto suele estar en 1,3"); las comunicaciones permanentes (120+ días) se siguen como programas, sin "vence" ni recorrido.

El detalle de cada regla, con umbral y evidencia, está en `reglas-recomendador.md` (v0.2).

**Prioridad** = plata en juego (restante afectado) × gravedad (qué tan lejos está de la mediana o del piso) × urgencia (sube cuanto menos días quedan, con tope). Las recomendaciones de confianza baja nunca pasan al primer lugar.

### 7.6 Vía de ajuste: API o manual

La define **PAUTADOR, conjunto por conjunto**:
- Si el conjunto salió de un pedido **automatizado** de PAUTADOR, PAUTADOR tiene su identificador de Meta → **vía API** (simulado en este borrador).
- Si salió de un pedido **manual**, o se creó a mano en Meta → **manual**.

Hoy lo automatizado es el recorte chico (intensidad media y baja), así que al principio la mayoría de las recomendaciones sobre campañas grandes van a ser manuales.

### 7.7 Piso de volumen para los rankings

Para que "mejores/peores contenidos" (4.3.5) y "mejores/peores audiencias" (4.3.6) no rankeen con datos insuficientes, un contenido o conjunto solo entra si en la ventana analizada superó un mínimo de gasto o de impresiones (a definir el número exacto; provisorio: el equivalente a 3 días de presupuesto mínimo de Meta para ese conjunto). El que no llega al mínimo queda afuera del ranking y, si corresponde, aparece en calidad de datos.

### 7.8 Solapamiento de audiencias (heurística, a refinar)

Un insight (4.3.7) que compara, dentro de la misma campaña, la segmentación geográfica de sus conjuntos: si uno apunta a un área contenida en la de otro (ej. "toda la provincia" y "capital" de esa provincia), se marca como posible solapamiento. No mide superposición real de personas (eso requiere datos de audiencia de Meta): es una señal aproximada para que el implementador la revise, no una recomendación automática.

### 7.9 Comparable electoral y perfil del proyecto

- **Período electoral.** Cada cliente tiene su calendario (`calendario_electoral.json`: campaña = 60 días antes, veda = 2, post = 7). En campaña y veda, la campaña se compara contra comparables del mismo período: en campaña el costo por resultado sube 1,2–1,4 veces y en veda 2,6–4 veces, y eso no es un problema de la pieza. En los 14 días posteriores, "sin entrega" no es alerta para clientes con apagón histórico (Corrientes, Chubut): se muestra como "pausa post-electoral".
- **Plantilla de escalada.** Desde la semana –10, el detalle del proyecto muestra la curva histórica del cliente (índice de gasto semanal) contra el ritmo actual.
- **Perfil del proyecto.** Cada ratio se muestra junto al ratio mediano histórico del proyecto (últimos 6 meses), su mezcla de jerarquía, su reparto entre contenidos y su ejecución del presupuesto mensual. Sale de las tablas `perfil_*` (sección 9), que se reconstruyen los lunes.
- **Presión por habitante.** Impresiones del cliente ÷ población (censo 2022), por mes. Aviso a 60, alerta a 80: es el mejor proxy de saturación mientras no haya alcance y frecuencia de Meta.

---

## 8. Aprendizaje: el nexo (a definir juntos)

Hoy cada decisión se guarda. Falta decidir **cómo cambia lo que recomienda el agente**. Propuesta en tres vueltas:

1. **Silenciar lo que no sirve.** Si una regla se declina repetidamente con "es intencional" o "pedido del cliente" para el mismo cliente o campaña, el agente baja su prioridad o deja de mostrarla ahí, y lo avisa ("Dejé de proponer pausas en Juegos Suramericanos: se declinaron 4 veces").
2. **Medir si funcionó.** A los 7 días de cada cambio aplicado se compara el resultado. Si un tipo de recomendación no mejora nada en la mayoría de los casos, se ajusta su umbral.
3. **Contexto de las respuestas.** Lo que se escribe en "Respondida" queda como nota de la campaña o del cliente, visible para el próximo implementador. Una vez por semana alguien las revisa y decide cuáles se convierten en reglas. A futuro, esas notas pueden servirle a un modelo que redacte las recomendaciones.

Preguntas abiertas:
- ¿El silenciamiento es automático o lo confirma alguien?
- ¿Las reglas se ajustan por cliente, por tipo de campaña o global?
- ¿Quién revisa las respuestas y cada cuánto?

---

## 9. Datos y fuentes

| Dato | Fuente | Frescura | En el borrador |
|---|---|---|---|
| Gasto, impresiones, clics, reacciones por conjunto y día | DataJunta (Meta, 90 días) | Diaria, 9:00 | Real |
| Presupuesto, fechas, eje, campaña, contenido, audiencia | DataJunta | Diaria, 9:00 | Real |
| Presupuesto mensual del proyecto | DataJunta (`PresupuestoMensual`, viene como texto) | Diaria | Real |
| Evolución en el tiempo (4.3.3) | Misma serie diaria de DataJunta, sin fuente nueva | Diaria, 9:00 | Real |
| Alertas contra el benchmark | Chequeo diario en BigQuery | Diaria, 11:00 | Real |
| Benchmark | BigQuery, últimas 13 semanas | Lunes, 10:00 | Real |
| Perfil del proyecto (`perfil_campana`, `perfil_proyecto_mes`, `perfil_curva`, `perfil_audiencia`, `perfil_electoral`) | BigQuery `automatizado`, desde 12/2024 | Lunes (a programar) | Real |
| Calendario electoral y población por cliente | `calendario_electoral.json` + censo 2022 | Manual | Real |
| Catálogo de audiencias | PAUTADOR (Supabase, mig 012) | En vivo | Real |
| Vía de ajuste (API o manual) | PAUTADOR (modo del pedido e identificador del conjunto) | En vivo | Real |
| Aplicar cambios en Meta | API de Meta | En vivo | **Simulado** |
| Alcance y frecuencia por período | API de Meta | En vivo | **Pendiente** |
| Rechazado, en revisión, entrega limitada | API de Meta | En vivo | **Pendiente** |
| Decisiones y resultados | Base propia del agente | En vivo | Real (local) |

---

## 10. Fuera del borrador (se suma después)

- **Cómo una recomendación aceptada se convierte en un cambio real dentro de PAUTADOR** (pedido automático, quién aprueba, qué le llega a PAUTADOR) — es el tema central pendiente, a pensar aparte de esta pantalla.
- Aplicación real por API de Meta.
- Alcance, frecuencia y estados de entrega desde Meta.
- Metas reales por campaña (reemplazan al piso simulado).
- Avisos (mail o Slack) con lo urgente del día.
- Plataforma general de implementadores donde entra esta vista.
- Córdoba.
- Otras plataformas (Google, TikTok).

---

## 11. Textos de ejemplo

Para que el diseño trabaje con contenido real (datos del 22/09).

**Fila del panel general**
> **Más Futuro** · Deportes · Gobierno del Chaco · Oficial e Informativo · Activa
> Piso: no llega · 4 recomendaciones pendientes (1 de prioridad alta)

**Detalle — resumen y KPIs**
> **Más Futuro** · Gobierno del Chaco · Oficial e Informativo · Activa · Interacción
> "Gasta en ritmo pero genera la quinta parte de las reacciones esperadas; el problema está en dos de sus cinco contenidos."
> 1.381 reacciones en 7 días · $890 por reacción · 0,2 veces la mediana
> Piso: no llega (35 % del esperado a la fecha) · Ritmo: subejecutada — 32 % gastado con 47 % del plazo; termina con $3,2 M sin gastar

**Detalle — evolución en el tiempo**
> Gráfico diario de reacciones, últimos 30 días, con la mediana del benchmark ($90/reacción) como línea de referencia. Marca el 18/09: "Se bajó 20 % el presupuesto de 'Inscripción Madres y Padres'" — desde ahí el costo por reacción bajó de $1.050 a $760.

**Detalle — mejores/peores audiencias**
> Peor: GDCHACAED10771 · FB/IG Feed · Toda la provincia excluyendo Resistencia · $2.400 por reacción · 0,04 veces la mediana
> Mejor: GDCHACAED10669 · FB/IG Feed · Capital y Gran Resistencia · $310 por reacción · 2,9 veces la mediana

**Detalle — insight**
> Posible solapamiento: "Toda la provincia excluyendo Resistencia" (GDCHACAED10771) y "Capital y Gran Resistencia" (GDCHACAED10669) compiten por buena parte del mismo público. Revisar antes de reforzar ambos a la vez.

**Recomendación**
> **Pausar el conjunto y mover el restante**
> Más Futuro → "Inscripción Chaco sin Resistencia" (Placa Fija) → FB/IG Feed · Toda la provincia excluyendo Resistencia
> **Por qué:** genera 0,1 veces las reacciones por impresión de conjuntos comparables (30 conjuntos de Interacción, placa fija, audiencia provincial abierta). Confianza alta.
> **Qué se gana:** mover $325.230 a "Inscripción Madres y Padres", que rinde en la mediana, suma ~2.900 reacciones en los 9 días que quedan.
> **Aplicación:** manual — en el administrador de anuncios, pausar el conjunto GDCHACAED10771 y subir el presupuesto diario de GDCHACAED10669 en 20 % (el resto del restante queda para el próximo ajuste, dentro de 3 días).
> **Vence:** 01/10.
> [Aceptar, lo hago a mano] [Aceptar sin incorporar] [Responder] [Declinar]

**Calidad de datos**
> Lotería de Santa Fe: 3 campañas cargadas como "Stories", "IG/FB Feed" o sin comunicación. No se pueden comparar por campaña.

**Aprendizaje**
> Dejé de proponer "Reforzar" en Juegos Suramericanos: se declinó 4 veces con "pedido del cliente". [Volver a mostrar]
