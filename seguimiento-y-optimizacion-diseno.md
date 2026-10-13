# Seguimiento y Optimización: idea y especificación para diseño

> Versión del 30/09/2026. Describe lo que la app hace hoy (la versión anterior era del 29/09/2026).
>
> Documento para diseñar la interfaz en Claude Design. Describe qué es la herramienta, para quién es, cómo se navega, qué muestra cada pantalla, qué significa cada indicador y cómo se comporta. Los números de ejemplo son reales (Santa Fe · Oficial, septiembre 2026, datos al 28/09).
>
> La app funcionando está en `Seguimiento/app/Seguimiento y Optimizacion.html` (se abre con doble clic; cómo se arma, en `Seguimiento/app/README.md`). Las reglas vigentes de las recomendaciones están en `Seguimiento/documentos/reglas-recomendador-v0.3.md`: si este documento y las reglas no coinciden, valen las reglas.

---

## 1. Qué es

**Seguimiento y Optimización** es un agente del ecosistema Prosumia, al lado de PAUTADOR (que crea los anuncios) y de los tableros de Looker (exploración) y de Dirección (reporte). Su trabajo:

1. **Seguir** cómo rinde la pauta de cada proyecto, contra lo que es normal.
2. **Convertir lo que ve en acciones concretas**, que se hacen a mano o se mandan a PAUTADOR.
3. **Aprender**: del último año de DataJunta (qué funciona y qué no) y del uso (qué acciones el equipo hace, descarta o comenta).

Las tres verticales del producto (**Seguimiento**, **Optimización**, **Aprendizaje**) no son pestañas:
- Seguimiento y Optimización van juntos: cada cosa que se sigue termina en una acción.
- El Aprendizaje tiene su módulo propio, **Insights**, y además alimenta el "por qué" de cada acción.

### Para quién
- **Implementadores** que lo abren todos los días.
- Cada uno tiene **varios proyectos asignados** y trabaja **un canal**: Oficial o Informativo.
- Hoy hay **7 proyectos**, y todos están en los dos canales: Santa Fe, Chaco, Chubut, Corrientes, Catamarca provincia, Catamarca ciudad y Córdoba.

### Principios de diseño
- **Tema claro siempre.** Sin modo oscuro.
- **Minimalista**, estilo Linear / Notion: mucho aire, poca información por pantalla y jerarquía clara. Tiene que verse profesional.
- **Ancho máximo de página: 1440 px.** Las tablas entran en ese ancho sin barra de desplazamiento horizontal. Lo que no ocupa todo el ancho (por ejemplo, el gráfico de historia de una campaña) va centrado.
- **Prioridad número uno: el rendimiento contra el objetivo.** Lo primero que se ve es si la pauta rinde bien o mal.
- **Todo número se explica.** Cada bloque tiene una línea de ayuda y un "Cómo se calcula" desplegable.
- **Los números se dicen con su valor y su referencia**, no como un múltiplo suelto: "pagó $2 M más que lo habitual", "gasta 80 % de lo habitual". El formato "1,4×" no se entiende y no se usa en textos nuevos (regla A7 de las reglas v0.3).
- **Las piezas se ven.** Donde se habla de un contenido, se puede ver la pieza (vista previa de Facebook, Instagram o YouTube).
- **Toda recomendación dice cuál es el problema, cuál es la solución, qué está afectado y qué revisar**, y se puede resolver o comentar ahí mismo.
- **El color se reserva para el semáforo.** El resto en grises. Las plataformas se identifican con su logo, no con iniciales.
- **No se destacan los pedidos de presupuesto faltantes.** La base de pedidos está en revisión: el restante se muestra como referencia, en gris.

---

## 2. Navegación

```
Mis proyectos (portada)
└── Proyecto ── Resumen · Activos · Ejes · Campañas · Audiencias · Insights · Looker   [Acciones (n)]
    └── Campaña ── Rendimiento · Acciones · Historia propia · Contenidos | Audiencias | Activos y placements
Cómo leer (guía)
```

**Barra superior (fija):**
- a la izquierda, nombre del producto y migas (Mis proyectos / Santa Fe / Obras que Sí);
- a la derecha:
  - selector de canal **Oficial | Informativo**, que la app recuerda;
  - **Cómo leer**, que abre la guía;
  - **Comentar esta pantalla**;
  - **Exportar comentarios (n)**;
  - "Datos al 28/09".

**Dentro de un proyecto:**
- el encabezado muestra el nombre del proyecto, el período elegido y el canal. No lleva luces ni link a Looker (el tablero de Looker tiene su pestaña);
- selector de **Período**: el mes en curso, los meses anteriores, o los últimos 7, 30 o 90 días. Cambia Campañas, Ejes, Audiencias y Activos. El Resumen siempre muestra el mes en curso;
- pestañas Resumen · Activos · Ejes · Campañas · Audiencias · Insights · Looker;
- a la derecha, el botón **Acciones** con el contador de pendientes, que abre la bandeja.

Las pestañas Publicaciones y Comparación salieron de la app hasta que el usuario las defina.

**Los contenidos no tienen pestaña propia.** Se ven como piezas dentro de Ejes y Audiencias, dentro de cada campaña y en Insights.

---

## 3. Conceptos que el diseño tiene que comunicar

### 3.1 Las luces (semáforo de rendimiento)
Cada indicador de rendimiento se compara contra "lo normal". Hay hasta tres referencias, y cada una es un punto de color con su etiqueta:

| Luz | Contra qué | Dónde aparece |
|---|---|---|
| **General** | Lo normal en todos los gobiernos, último año. En Meta: mismo objetivo × formato × placement. En el resto de las plataformas: misma plataforma × objetivo, últimos 180 días | Revisar campañas, Campañas y pantalla de campaña |
| **Proyecto** | Lo normal en este proyecto y canal, último año | Ídem |
| **Propia** | Campañas largas (30 días o más) y constantes: sus propias semanas anteriores | Campañas y pantalla de campaña |
| **Temporada anterior** | Campañas estacionales confirmadas: las mismas semanas de la temporada pasada | Reemplaza a "Propia" |

Una referencia aparece solo si tiene 12 casos o más.

**Colores (umbral ±20 %, el mismo del tablero de Dirección):**
- **verde**: 20 % o más mejor que la referencia;
- **amarillo**: dentro de ±20 %;
- **rojo**: 20 % o más peor;
- **gris**: sin referencia;
- **vacío** (solo el borde): poca historia; la luz aparece desde la tercera semana.

**Número:** hoy, al lado del punto va **cuántas veces lo normal** (1,3×). En costos, más de 1 significa más barato. Ejemplo: "General 0,8× · Proyecto 0,8× · Propia 0,6×". Este formato va a cambiar: la regla A7 pide decirlo con el valor y su referencia, y todavía está pendiente decidir si las luces de Campañas y de cada campaña pasan a "Costo por reacción $38 · lo normal $52" o se sacan.

Las luces ya no aparecen en la portada, en el encabezado del proyecto ni en la pestaña Activos.

### 3.2 Eficacia (la regla de Looker)
Es el mismo semáforo que usa el equipo en Looker, unificado en una tabla compartida (`automatizado.eficacia_anuncios`).
- **Por anuncio:** cada anuncio de Meta, en cada placement, se compara contra los de su mismo objetivo y placement del proyecto en su misma época (los 3 meses que terminan en su último mes). Es **rojo** si su costo por reacción está entre el 25 % más caro y **verde** si está entre el 25 % más barato. Si el proyecto tiene menos de 12 anuncios comparables, se usa la referencia general.
- **Por grupo:** en campañas, contenidos, audiencias, ejes y formatos se muestra el **% del gasto en anuncios rojos**. Un **cuadradito** (para distinguirlo de las luces redondas) toma el color con la escala de Looker: menos de 25 % verde, menos de 50 % amarillo, menos de 75 % naranja, y rojo por encima.
- **Ejemplo:** "Obras que Sí: 32 % del gasto en rojo (55 de 178 anuncios)", cuadradito amarillo.

### 3.3 KPI principal según objetivo
Cada campaña se juzga con la métrica de lo que compra. El mismo contenido en Interacción paga 3,3 veces el CPM, pero cada reacción sale 7 veces más barata.

| Objetivo | KPI principal |
|---|---|
| Alcance | CPM (e impresiones) |
| Interacción | Costo por reacción |
| Tráfico | CTR (costo por click en "Costo por objetivo") |
| Reproducciones (YouTube, TikTok, Google) | Costo por reproducción |

En los tiles de métricas, el KPI principal va destacado con la etiqueta "KPI principal".

### 3.4 Métricas
Todas son tasas sobre impresiones, como el CTR. El **costo por reacción es la medida de efectividad de los contenidos**.

| Métrica | Cálculo |
|---|---|
| Impresiones | Sin cálculo: es el dato de DataJunta |
| Alcance diario acumulado | Suma del alcance de cada día en Meta: una persona cuenta una vez por cada día que la alcanzan. Frecuencia diaria = impresiones ÷ ese alcance. Es provisorio: la decisión es leer el alcance y la frecuencia desde la API de Meta, y cuando esté esa lectura este dato sale |
| Costo por reacción | Gasto ÷ reacciones |
| Tasa de reacción | Reacciones ÷ impresiones |
| Tasa de compartido | Compartidas ÷ impresiones (difusión orgánica, con peso propio) |
| Tasa de comentario | Comentarios ÷ impresiones (conversación o polémica) |
| ETR | Engagement ÷ impresiones (en video, casi todo son reproducciones; en placas, casi todo son clicks) |
| CTR | Clicks ÷ impresiones |
| CPM · Costo por click · Costo por reproducción | Gasto ÷ … |
| Video: retención 25/50/75/100 % | Reproducciones al X % ÷ reproducciones |

### 3.5 "Pagó $X más que lo habitual"
Lo gastado por encima de lo que habría costado lo mismo (impresiones, reacciones o clicks, según el objetivo) a los costos habituales del proyecto en el último año. Es lo que ordena las prioridades: plata en juego.
- **Ejemplo:** Obras que Sí pagó $2,1 M más que lo habitual.
- **No tiene relación con el presupuesto.** Antes se escribía "$ de más", y se leía como pasarse del presupuesto; esa expresión ya no se usa en ninguna pantalla.
- Equivale a las "Pautas caras" del tablero de Dirección.

### 3.6 Tipos de campaña
Cada campaña es de uno de cuatro tipos, y el tipo define contra qué se compara:

| Tipo | Qué es | Contra qué se compara |
|---|---|---|
| Constante | Se comunica todo el año (Operativos de Seguridad, Chubut Avanza). Se sugiere cuando tuvo gasto en 20 de las últimas 52 semanas, o en 16 si no tiene una temporada anterior | Sus semanas anteriores |
| Estacional | Vuelve en la misma época: tuvo una tanda anterior de 2 semanas o más que arrancó hace 1 o 2 años (con 6 semanas de margen), separada por 16 semanas o más sin gasto | La temporada anterior |
| Larga | Ninguna de las dos y 30 días o más | Sus semanas anteriores |
| Puntual | Ninguna de las dos y menos de 30 días | Solo General y Proyecto |

Constante y estacional son sugerencias: **las confirma una persona**, en Insights (bloque "Tipo de campaña") o en el encabezado de la pantalla de campaña. En los botones, lo sugerido se ve en gris y lo confirmado en negro.

---

## 4. Pantallas

### 4.1 Mis proyectos (portada)
**Propósito:** ver en 5 segundos qué proyecto necesita atención hoy.

- **Encabezado:** "Mis proyectos" y "Septiembre · canal Oficial · datos al 28/09". No hay leyenda de colores.
- **Ayuda:** "Cada tarjeta dice si el mes cierra en presupuesto, cuántas campañas hay activas y cuántas acciones quedan por resolver."
- **Grilla de tarjetas**, una por proyecto del canal elegido (7 en cada canal). Cada tarjeta tiene:
  - Nombre del proyecto.
  - **Gasto del mes** contra el presupuesto, con una barrita: "$208,3 M de $220 M". Si el proyecto no tiene presupuesto cargado, dice "sin PresupuestoMensual cargado".
  - **Proyección**: badge "cierra en 96 %" (verde entre 85 % y 102 %; amarillo por debajo del 85 %; rojo por encima del 102 %).
  - **Campañas activas**: "27 · 26 terminan esta semana".
  - **Acciones pendientes**: "15", o "No hay acciones pendientes".
- Las tarjetas ya no muestran las luces General y Proyecto ni lo pagado por encima de lo habitual.
- **Clic en la tarjeta:** va al Resumen del proyecto.

### 4.2 Proyecto · Resumen
Es un tablero de dos tarjetas lado a lado, siempre sobre el mes en curso. Con un solo presupuesto, Gasto del mes ocupa un tercio del ancho y Revisar campañas los otros dos tercios; con dos presupuestos o más, cada tarjeta ocupa la mitad. En pantallas de menos de 1100 px van una debajo de la otra.

1. **Gasto del mes.** "¿Cerramos en presupuesto?" Una tarjeta por presupuesto cargado. Santa Fe Oficial tiene dos: "Gobierno de Santa Fe", $60 M, y "Juegos Suramericanos & Soy Capi", $160 M. Cada tarjeta tiene:
   - un badge "cierra en 96 % · en línea con el presupuesto" (o "por debajo" o "por encima del presupuesto");
   - dos cifras grandes, **Inversión** y **Tiempo** ("91 % · $54,4 M de $60 M" y "93 % · día 28 de 30");
   - un **gráfico** con selector Gasto o Impresiones:
     - en Gasto: zona gris = tiempo transcurrido (diagonal del presupuesto); línea negra = gasto acumulado; línea punteada = proyección al cierre; línea de puntos = presupuesto;
     - en Impresiones: impresiones acumuladas del mes con su proyección, contra la línea del mes anterior;
   - el pie: "Cierra en $57,8 M al ritmo de $1,7 M por día (promedio de los últimos 2 días completos)".

2. **Revisar campañas** (antes se llamaba "Campañas que rinden mal").
   - Campañas activas con alguna luz en rojo (General, Proyecto o Propia), hasta 5, ordenadas por plata en juego. Las campañas que terminan esa semana por un evento (hoy, Juegos Suramericanos) no aparecen.
   - Cada fila tiene:
     - nombre, objetivo y eje, **"pagó $2,1 M más que lo habitual"** en rojo, y el cuadradito de eficacia ("32 % en rojo");
     - el KPI principal con su valor;
     - las luces con números (General / Proyecto / Propia);
     - la acción sugerida.
   - Clic: va a la campaña.

Los demás bloques que describía la versión anterior de este documento (Rendimiento del mes, Costo por objetivo, Piezas destacadas, Impacto comparado, Picos y apagones) no están en la app hoy.

### 4.3 Proyecto · Activos
Una sola tabla anidada: activo y, adentro, sus campañas. Un activo es una voz que pauta (La Calle Hoy, Gobierno Santa Fe…).
- **Buscador** ("Buscar campaña, pieza, audiencia o código") y **Colapsar todo**. Al buscar, se abren solos los niveles que coinciden.
- **Columnas:** Activo / campaña · Campañas · Contenidos · Impresiones · Reproducciones · Reacciones · Gasto · Salud. Se ordena por impresiones, de mayor a menor.
- En cada fila: los **logos** de las plataformas donde pautó y, debajo del nombre del activo, la etiqueta "Automatizado" si PAUTADOR puede crear anuncios en ese activo. Las filas de campaña tienen el botón "ver campaña", que abre su pantalla.
- **Campañas y Contenidos:** cuántas campañas y cuántas piezas distintas tuvo el activo en el período (en cada campaña, sus piezas en ese activo).
- **Salud** (solo en la fila del activo):
  - **ritmo de gasto en palabras**, en un chip: "Gasta X % de lo habitual", "Pico: gasta X % de lo habitual" (punto amarillo), "Apagón: gasta X % de lo habitual" (punto rojo) o "Sin gasto reciente". Compara el gasto de los últimos 2 días completos contra su día típico del mes anterior; apagón es menos de la mitad y pico es más del doble;
  - **restante del pedido**, en gris y con una barrita: "Restan $X M de $Y M", "Superó el pedido por $X M" o "Sin pedido cargado";
  - al pasar el mouse, el gasto de los últimos 7 días.
- Los activos del proyecto sin gasto en el período igual aparecen: un apagón es justamente lo que hay que ver.
- No hay una segunda tabla de estado ni columna de luces.

### 4.4 Proyecto · Ejes
Tabla anidada de cuatro niveles: **eje, campaña, pieza y anuncio**. Los anuncios del último nivel son los conjuntos de anuncios de Meta del mes en curso.
- Mismo buscador y "Colapsar todo" que en Activos.
- **Columnas:** Eje / campaña / pieza / anuncio · Impresiones · Reproducciones · Reacciones · Gasto · Eficacia. Se ordena por impresiones.
- Cada fila lleva los logos de plataforma y cuántos elementos tiene adentro. Las campañas tienen "ver campaña"; las piezas, "ver pieza", que abre la vista previa. Muestra hasta 30 piezas por campaña.
- Lo que no tiene eje cargado va en "Sin eje".
- Todas las plataformas; la eficacia es solo de Meta.

### 4.5 Proyecto · Campañas
- **Filtros**, cada uno con su cantidad entre paréntesis, siempre sobre las campañas con gasto en el período elegido:
  - **Todas** (las del período) · **Activas** · **Finalizadas** · **Constantes** · **Estacionales** · **Largas** · **Puntuales**.
- **Tabla:**
  - Campaña (con logos de plataforma, la etiqueta del tipo, objetivo, eje, fechas y "pagó $X más que lo habitual");
  - Estado ("Termina esta semana" con punto amarillo, "Sin entrega" con punto rojo, "Terminó" en gris);
  - Gasto (o "Gasto del período" si no es el mes en curso);
  - Impresiones y Reacciones del período (01/10), en números cortos ("1,2 M", "45 mil"), sin comparaciones ni colores; en las
    campañas solo de Stories, Reacciones dice "no aplica (Stories)";
  - una sola columna de KPI (decisiones del 01/10, reemplaza "KPI principal" y "Contra lo normal"), con un selector arriba:
    **Según objetivo** (por defecto; cada fila muestra el KPI de su objetivo y lo nombra: Interacción Costo por reacción, Alcance CPM,
    Reproducciones Costo por reproducción, Tráfico y Conversión CTR) · Costo por reacción · CPM · CTR · ETR Videos · ETR Imágenes ·
    CPM de Alcance · Costo por reproducción (todas
    las filas, ese KPI; el título de la columna es su nombre). El selector se recuerda mientras la página está abierta. En la celda:
    el nombre del KPI y el valor del período en la misma línea y con el mismo peso ("CPM: $352", "CTR: 1,87 %"), con cualquier
    opción del selector, y dos renglones de una línea, cada uno con su referencia entre paréntesis: "vs. Santa Fe ($240): +8 %" y
    "vs. semanas anteriores ($84): −34 % ▼ mejor" (o "vs. temporada pasada" en las estacionales confirmadas). Color solo con una
    diferencia grande (corte del motor), con ▲/▼ y "peor"/"mejor". Todo con Meta (lo que tiene referencias); ETR = engagement ÷
    impresiones × 100, separado en videos e imágenes (placas y carruseles), cada uno contra su formato. CPM de Alcance solo con
    lectura de Meta de hoy y sin referencias todavía. Costo por reproducción = gasto ÷ reproducciones, la excepción: todas las
    plataformas con reproducciones (YouTube, TikTok, videos de Meta), comparado plataforma por plataforma (lo normal del proyecto:
    mediana del costo por reproducción de cada pieza en la misma plataforma y objetivo, últimos seis meses, 12 casos o más). Debajo de la tabla, una línea que explica las comparaciones y los colores.
    Scroll horizontal propio con el nombre fijo a la izquierda;
  - eficacia;
  - contador de acciones, que abre la bandeja filtrada por esa campaña.
- Orden: por gasto en el período.

### 4.6 Proyecto · Audiencias
Tabla anidada de tres niveles: **audiencia, campaña y pieza**. Muestra qué se le comunicó a cada audiencia y cómo respondió.
- Solo Meta: las audiencias salen de los conjuntos de anuncios de Meta.
- Mismas columnas, buscador y "Colapsar todo" que en Ejes (sin el nivel de anuncio).

### 4.7 Proyecto · Insights (el módulo de Aprendizaje)
1. **Lo que pasa contra lo aprendido.** Filas de dos columnas: "Lo aprendido" / "Lo que pasa ahora", con un punto verde o amarillo.
   - Ejemplo: "En Alcance, el mismo contenido saca 1,8× reacciones en Facebook Reels" / "Este mes Facebook Reels se lleva el 4 % del gasto de Alcance", con punto amarillo.
2. **Eficacia por eje, formato y audiencia** (últimos 30 días). Listas con el cuadradito, "% del gasto en rojo (n de N)" y el gasto.
3. **Tipo de campaña.** A confirmar. Cada fila muestra la campaña, "Con gasto en N de las últimas 52 semanas" (y la temporada anterior si la hay), la nota "sugerido" o "confirmado" y tres botones: **Constante · Estacional · Larga** (o **Puntual**, si dura menos de 30 días). Lo que se elige define su luz Propia y en qué filtro de Campañas aparece. Si no hay candidatas: "No se detectaron campañas constantes ni estacionales en este proyecto."
4. **De [proyecto]:** aprendizajes propios del proyecto contra todos los gobiernos. Ejemplo: "Placa Fija en Interacción: costo por reacción 0,6× la referencia general".
5. **Del uso:** qué aprendió de las decisiones y opiniones del equipo. Ejemplo: "Se desgastó: 3 hechas · 1 descartada · ¿sirve? Sí: 3".
6. **Generales:** los aprendizajes del último año, cada uno con su fuente.

### 4.8 Proyecto · Looker
El tablero de Looker Studio del proyecto y canal, embebido en la página.
- Los links están precargados para los 7 proyectos en los dos canales (14 tableros).
- El lienzo de los tableros es de 1200 × 900. El tablero se dimensiona para entrar entero en la ventana, sin barra de desplazamiento de Looker: el alto es el que queda debajo de la barra superior y el ancho sale de ese alto. Va centrado. Al entrar, la página se desplaza sola hasta dejar el tablero pegado debajo de la barra.
- El título "Tablero de Looker" es un link para abrirlo en Looker Studio; si hay lugar, va en el margen izquierdo del tablero.
- Si un proyecto y canal no tiene tablero, la pestaña ofrece "pegar el link del tablero" (el link de inserción de Looker Studio), que queda guardado en el navegador.

### 4.9 Acciones (bandeja del proyecto)
Un panel con la lista a la izquierda y el detalle de la acción elegida a la derecha. Las pendientes van ordenadas por prioridad y plata en juego; abajo, las resueltas, con la opción de deshacer. Desde una campaña, la bandeja se abre filtrada por esa campaña, con el link "Ver todas las del proyecto".

**Fila de la lista:** tipo, título, campaña y "pagó $X más que lo habitual" cuando corresponde.

**Tarjeta de acción** (es el componente más importante). Formato: problema, solución, qué está afectado y qué revisar.
- **Tipo**, la vía ("Se puede hacer desde PAUTADOR", "Se hace a mano" o "Parte se hace a mano") y el link "ver campaña".
- **Título:** "Obras que Sí rinde por debajo de las referencias".
- **Problema:** "CPM $541: 1,3× la referencia general y 1,3× la del proyecto. Pagó $2,1 M más que lo habitual del proyecto; 32 % del gasto en anuncios rojos (55 de 178)."
- **Solución** (en negrita): "Pausar 'Recorrida por el sur…' y pasar su presupuesto a 'Recorrida por obras en el norte…'".
- **Qué está afectado:** la campaña; los contenidos, como botones que abren la vista previa ("La de peor costo por reacción: …"); y los conjuntos de anuncios, cada uno con su gasto y su métrica.
- **Qué revisar:** una lista corta de cosas a mirar. Ejemplo para un apagón: "Anuncios pausados, rechazados o sin presupuesto en las cuentas del activo."
- **Por qué:** el aprendizaje que sostiene la acción, con su fuente. Ejemplo: "Una campaña que al día 5 está en el peor cuartil termina ahí el 82 % de las veces".
- **Cómo lo detectamos:** desplegable con la regla exacta.
- **Botones:**
  - **Enviar a PAUTADOR** (principal; deshabilitado si algún activo no está automatizado);
  - **Hecho a mano**;
  - **Descartar**, que pide un motivo: No aplica / Ya estaba resuelto / Decisión del cliente / El dato está mal / Esperar unos días / **Otra**. Con "Otra" aparece un campo para escribir por qué, y el botón Descartar se habilita recién cuando hay texto.
- **Opinión:** "¿Te sirve esta recomendación? Sí · No · Falta un dato", más un campo de comentario.

**Repositorio.** Todo queda guardado para que el agente aprenda:
- las recomendaciones que generó el agente cada día, en `app/repositorio/recomendaciones/` (un archivo por día, una línea por recomendación con problema, solución, campaña, contenidos, conjuntos, regla y plata en juego);
- lo que respondió el equipo, en `app/repositorio/respuestas.jsonl`: decisión, motivo (incluido el texto de "Otra"), ¿sirve?, comentario y tipo de campaña confirmado.
- Solo se guarda en el repositorio si la app se abre desde el servidor local (`node servir.js`, en `http://localhost:4330`). Abierta con doble clic, queda en el navegador y en "Exportar comentarios".

### 4.10 Campaña
- **Encabezado:** nombre, objetivo, eje, fechas, estado, la etiqueta del tipo y el selector **Tipo** (Constante · Estacional · Larga o Puntual) para confirmarlo; un sparkline del gasto diario de los últimos 45 días; y el botón **Acciones de esta campaña** con su contador.
- **Rendimiento:** en la línea del título, la eficacia real de esa campaña ("32 % del gasto en rojo (55 de 178)") y, si corresponde, "pagó $2,1 M más que lo habitual". Debajo, 7 tiles: Impresiones · Alcance diario acumulado (con la frecuencia diaria) · Costo por reacción · CPM · Tasa de reacción · Tasa de compartido · CTR. Cada tile tiene el valor, las luces General y Proyecto con su número y un dato chico debajo. El tile del KPI principal va destacado y suma la tercera luz (Propia o Temporada anterior).
- **Contra su propia historia / Contra la temporada anterior** (campañas largas, constantes y estacionales):
  - Cifras: luz propia (o de temporada anterior), semanas al aire, "N de 52 semanas" en las constantes, tendencia (4 contra 8 semanas), presión del último mes y presión acumulada (impresiones por habitante), y en las estacionales desde cuándo es la temporada anterior y cuántas semanas se compararon.
  - Gráfico de barras semanales del KPI principal (las últimas 12 semanas), centrado: las últimas 2 en negro; franja gris del rango normal (del 25 % peor al 25 % mejor de sus semanas anteriores) y línea punteada de su mediana.
  - Si la campaña tiene menos de 30 días: "la campaña tiene menos de 30 días".
- **Pestañas internas:**
  - **Contenidos:** ordenados por efectividad (costo por reacción contra lo normal). Cada fila tiene nombre, formato, fechas, "ver pieza", señales ("se comparte" en verde, "genera conversación" en amarillo), gasto, días, costo por reacción, luz General con su número, eficacia, tasa de compartido y retención al 25 % con su punto. En Stories dice "Stories: sin reacciones" en vez de un costo.
  - **Audiencias:** KPI principal, luces, eficacia, costo por reacción y cobertura (sin dato todavía: "—").
  - **Activos y placements:** desde qué voces habla (con la etiqueta "Automatizado") y el reparto por placement. Stories lleva la nota "no registra reacciones".
- Las campañas que terminaron hace más de 60 días no tienen pantalla: al tocarlas, un aviso lo dice.

### 4.11 Cómo leer (guía)
Una página de referencia: las luces, los colores, la eficacia, el KPI por objetivo, las métricas, los bloques (Gasto del mes, Revisar campañas, las tablas de Ejes, Audiencias y Activos, las acciones y Looker), las fuentes de datos y cómo comentar.

### 4.12 Modales
- **Vista previa de pieza:** embeds de Facebook, Instagram y YouTube, lado a lado, con "abrir en Facebook" (o en la red que corresponda). TikTok solo tiene link. Nota: si el posteo es privado o se borró, no se ve.
- **Comentar esta pantalla:** un campo de texto que se guarda por pantalla.

---

## 5. Catálogo de acciones

Es la sección C de `documentos/reglas-recomendador-v0.3.md`, que tiene el detalle y el estado de cada regla. Todas corren sobre campañas activas. En la bandeja se ordenan primero por prioridad (el número más alto va primero) y después por plata en juego.

| # | Tipo | Se dispara cuando… | Qué propone | Prioridad | Plataformas |
|---|---|---|---|---|---|
| C1 | Rinde por debajo | KPI principal en rojo contra General **y** contra Proyecto, y pagó $100 mil o más (o 5 % de su gasto) por encima de lo habitual | Pausar la pieza de peor costo por reacción y pasar su presupuesto a la mejor (si la mejor rinde 1,5 veces la peor); si no, revisar pieza y audiencia, y pausar si en 2 días no mejora | 3 | Meta |
| C2 | Peor que la temporada anterior | Estacional confirmada, 20 % o más peor que en las mismas semanas de la temporada pasada | Retomar las piezas y audiencias que funcionaron | 2,5 | Meta |
| C3 | Se desgastó | Larga o constante: 2 semanas seguidas debajo de su propio cuartil bajo y 20 % o más abajo de su mediana | Renovar las piezas o pausar una semana | 2,5 | Meta |
| C4 | Sin entrega | Vigente, sin gasto hace más de 2 días (y con gasto en los últimos 10) | Revisar rechazos, revisión o presupuesto | 2,5 | Meta |
| C5 | Apagón | Un activo gastó menos de la mitad de su día típico del mes anterior en los últimos 2 días completos | Revisar pausas, rechazos o presupuesto en sus cuentas | 2,5 | Todas |
| C6 | Mejor momento | Larga o constante: 2 semanas seguidas arriba de su propio cuartil alto, y no está en rojo contra General | Sostener y subir 20 % el presupuesto diario | 2 | Meta |
| C7 | Presión acumulada alta | 20 impresiones por habitante o más en el último mes de la campaña, y el KPI principal de las últimas 4 semanas 15 % o más abajo de las 8 anteriores | Ampliar la audiencia o pausar una semana | 2 | Meta |
| C8 | Placements débiles | Interacción con 5 % o más del gasto (y más de $50 mil) en Instream, Threads o Explore | Excluir esos placements | 2 | Meta |
| C9 | Sumar Facebook Reels | Alcance de más de $500 mil con menos de 5 % en Facebook Reels (y menos de la mitad en Stories) | Habilitar Facebook Reels | 2 | Meta |
| C10 | Se comparte | Pieza viva con 300 reacciones o más y 10 o más compartidas cada 100 reacciones | Subir 20 % el presupuesto mientras siga compartiéndose | 2 | Meta |
| C11 | Genera conversación | Pieza viva con 300 reacciones o más y 13 o más comentarios cada 100 reacciones | Leer los comentarios: seguir, moderar o pausar (siempre a mano) | 2 | Meta |
| C12 | Costo por objetivo | Una red × objetivo 20 % o más cara que los 3 meses anteriores y con 8 % o más del gasto del mes | Revisar pieza, audiencia y puja de esa red | 2 | Todas |
| C13 | Se abandona temprano | Video vivo con 20 mil reproducciones o más y $50 mil o más, cuya retención al 25 % está 20 % debajo del cuartil bajo de su objetivo | Revisar los primeros segundos | 1,8 | Meta |
| C14 | Pico | Un activo gastó más del doble de su día típico en los últimos 2 días completos | Confirmar que sea intencional | 1,8 | Todas |
| C15 | Rotar contenidos | Piezas vivas con más de $30 mil que pasaron 15 días (video) o 12 (placa o carrusel) | Pedir piezas nuevas | 1,5 | Meta |

- Pieza viva = con gasto en los últimos 2 días.
- Una acción puede ir por PAUTADOR solo si todos los activos de la campaña están automatizados; si no, es manual.
- "Subir 20 %" respeta el primer control de seguridad para cambios en Meta: máximo ±20 % del presupuesto diario por cambio (sección D de las reglas).
- Las campañas que terminan esa semana por un evento (hoy, Juegos Suramericanos) no generan acciones. La lista se carga a mano.

Volumen actual: entre 0 y 21 acciones por proyecto y canal (Santa Fe Oficial tiene 15).

---

## 6. Componentes

- **Tarjeta de proyecto** (portada): gasto contra presupuesto, "cierra en", campañas activas y acciones pendientes.
- **Tile de métrica:** valor, luces con número, dato chico y la etiqueta "KPI principal" cuando aplica.
- **Luces:** punto de 9 px con etiqueta y número. Versión compacta: solo puntos, con el detalle en un tooltip.
- **Cuadradito de eficacia:** cuadrado de 9 px, "% del gasto en rojo (n de N)" o solo "%".
- **Logo de plataforma:** ícono de 13 a 15 px con el nombre de la red al pasar el mouse. Reemplaza a las iniciales.
- **Tabla anidada** (Ejes, Audiencias, Activos): filas que se abren con un triángulo, sangría de 22 px por nivel, buscador, "Colapsar todo", sin desplazamiento horizontal. El nombre largo se corta con puntos suspensivos y se ve entero al pasar el mouse.
- **Celda de salud** (Activos): chip de ritmo de gasto en palabras, restante del pedido y barrita gris.
- **Fila de campaña** y **fila de contenido**.
- **Tarjeta de acción**, con problema, solución, qué está afectado, qué revisar, "por qué", "cómo lo detectamos", botones y opinión.
- **Selector de tipo de campaña:** Constante · Estacional · Larga o Puntual; gris = sugerido, negro = confirmado.
- **Vista previa de pieza:** iframe de Facebook, Instagram o YouTube.
- **Gráfico de consumo** (inversión contra tiempo, con proyección; alterna con impresiones contra el mes anterior).
- **Gráfico de historia propia** (barras semanales con banda de rango normal).
- **Tablero de Looker embebido.**
- **Bloque de ayuda:** una línea de explicación más el desplegable "ⓘ Cómo se calcula".
- **Chips:** "Automatizado", "Apagón" (punto rojo), "Pico" (punto amarillo), "Termina esta semana" (punto amarillo), "Sin entrega" (punto rojo).

---

## 7. Estados especiales
- **Sin referencia:** luz gris, "—". Pasa, por ejemplo, con la luz Proyecto de Córdoba Oficial en Meta, cuyas referencias todavía no se calcularon.
- **Poca historia** (campaña larga con menos de 3 semanas): luz vacía y "La luz aparece desde la tercera semana".
- **Alcance:** hoy es el alcance diario acumulado; la cobertura de audiencias no tiene dato ("—").
- **Stories:** no registra reacciones. Nunca se lo marca como "malo" por eso.
- **Pieza sin link:** "Esta pieza no tiene link en DataJunta". Con link pero sin vista previa (TikTok): "Esta pieza tiene link pero no vista previa embebida".
- **Proyecto sin presupuesto cargado:** "Este proyecto no tiene PresupuestoMensual cargado en DataJunta".
- **Proyecto que no existe en el canal:** al cambiar de canal, vuelve a la portada. Hoy los 7 proyectos están en los dos canales.
- **Tabla vacía con el filtro o la búsqueda:** "Nada que mostrar con ese filtro."
- **Campaña sin pantalla** (terminó hace más de 60 días): aviso "Esta campaña no tiene detalle: terminó hace más de 60 días".
- **Proyecto sin tablero de Looker:** "Este proyecto y canal todavía no tienen tablero cargado", con el botón para pegar el link.
- **Sin acciones:** "No hay acciones pendientes".

---

## 8. Datos (contexto para el diseño)
- **DataJunta, Meta:** copia diaria de 180 días (`automatizado.datajunta_meta_180d`, 9:10).
- **DataJunta, todas las plataformas:** últimos 180 días por día (Google Ads, DV360, TikTok, SMS), para las tablas, el gasto del mes y las reglas de Apagón, Pico y Costo por objetivo.
- **Alcance:** tablas de Meta (`FBADS_TABLERO_META`) por anuncio y día, cruzadas con DataJunta.
- **Eficacia:** `automatizado.eficacia_anuncios`, regenerada todos los días a las 9:20. Es la misma regla que Looker, en versión ajustada: ventana de 365 días, comparación contra la misma época, mínimo 12 anuncios y % del gasto en rojo.
- **Referencias:**
  - generales y por proyecto: último año, con tasas de 365 días y costos de los últimos 90 a 120 días;
  - propias: semanales, desde 2024;
  - fuera de Meta: por plataforma, últimos 180 días.
- **Presupuesto:** `PresupuestoMensual` de DataJunta, por proyecto y canal.
- **Pedidos por activo:** planilla de pedidos (en revisión).
- **Tableros de Looker:** links de inserción precargados para los 14 tableros (7 proyectos × 2 canales).
- **Respuestas del equipo:** repositorio local de la app (ver 4.9).
- **Último día completo:** DataJunta carga a las 8:00 el día anterior.

---

## 9. Lo que falta definir
1. **Asignación de proyectos por implementador:** hoy se muestran todos.
2. **Juegos Suramericanos** (termina esta semana): ya no genera acciones ni aparece en Revisar campañas. Falta decidir si también se excluye de las comparaciones de Santa Fe por activo y por red (Pico, Apagón y Costo por objetivo).
3. **Conexión real con PAUTADOR:** qué recibe PAUTADOR al tocar "Enviar a PAUTADOR", qué aprobación hace falta y cómo se aplican los controles de seguridad para cambios en Meta (sección D de las reglas).
4. **Alcance desde la API de Meta:** con qué acceso se lee y de qué cuentas. Además del alcance, falta la frecuencia, la cobertura y el estado de entrega (rechazado, limitado, en aprendizaje).
5. **Luces de Campañas y de cada campaña:** ¿pasan a "Costo por reacción $38 · lo normal $52" o se sacan? (regla A7)
6. **Piso simulado y audiencias solapadas:** ¿se retoman o se dan de baja?
7. **Lectura temprana al día 5:** ¿se implementa? Reemplazaría parte de "Rinde por debajo".
8. **Presión por habitante:** ¿se mide por campaña (hoy), por cliente (como en la versión 0.2 de las reglas) o las dos?
9. **Referencias de proyecto de Córdoba Oficial en Meta:** falta calcularlas.
10. **Base de pedidos de presupuesto:** revisión del cruce entre la planilla y DataJunta.
11. **Dónde viven los comentarios y decisiones:** hoy en el navegador y en el repositorio local de la app; falta una base compartida para que el agente aprenda de todo el equipo, y medir a los 7 días si cada cambio aplicado funcionó.
12. **Vistas de Looker:** apuntarlas a la tabla de eficacia nueva, con una vista con grano diario (ofrecida, no hecha).
13. **Publicaciones y Comparación:** las pestañas salieron hasta que el usuario las defina.

---

## 10. Tono y textos
- Español rioplatense, con voseo ("Revisá", "Pegá el link").
- Frases cortas. Primero el dato, después la interpretación.
- **Números:** "$2,1 M", "32 %", "día 28 de 30", "gasta 80 % de lo habitual", "pagó $2 M más que lo habitual". Decimales con coma. No usar "1,4×" ni "de más" sueltos.
- **Nada de jerga técnica:** "lo normal" en vez de "benchmark p50"; "20 % o más peor" en vez de "fuera de banda".
- Las acciones empiezan con un verbo: "Pausar…", "Revisar…", "Subir 20 %…".
