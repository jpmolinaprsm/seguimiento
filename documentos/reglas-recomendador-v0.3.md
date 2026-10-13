# Reglas de Seguimiento y Optimización (v0.3)

Fecha: 30/09/2026. **Es la versión vigente.** Parte de lo que la app hace hoy (`Seguimiento/app/` y `Seguimiento/borrador/armar.js`) y dice, regla por regla, qué está funcionando, qué quedó pendiente de la v0.2 y qué falta decidir.

- La v0.2 (`reglas-recomendador.md`, 23/09) queda como historia: tiene la evidencia de cada umbral viejo y las reglas que todavía no se implementaron.
- La evidencia de los números está en `analisis-datajunta/hallazgos-perfiles.md` (tandas 1 a 5).
- Cuando una regla cambia en el código, se cambia acá en el mismo momento.

Estados que usa este documento: **Funciona** (la app la aplica hoy) · **Pendiente** (decidida, sin implementar) · **A decidir** (hay que confirmar si sigue).

---

## A. Decisiones de Juan Pablo

| # | Decisión | Estado |
|---|---|---|
| A1 | Quedan afuera los activos Pulso (encuestas), Vibes Argentina, los proyectos Observatorio / Analytics / tracking y las cuentas internas. **01/10:** "Pulso del Interior" no es de encuestas y queda adentro; "Campaña Santa Fe 2025" se cuenta dentro de Santa Fe. | Funciona |
| A2 | **Córdoba entra en los dos canales** (desde el 30/09; antes estaba afuera). La exclusión de Córdoba Oficial vale solo para lo que PAUTADOR publica solo. | Funciona. Falta calcular sus referencias de proyecto en Meta |
| A3 | **El alcance y la frecuencia se leen desde Meta, solo de las cuentas a las que la app tiene acceso.** No se calculan desde BigQuery. Decidido el 30/09: se leen con el mismo acceso de PAUTADOR, una vez por día (pedido al Orquestador general: `orquestacion/BUZON/pedido-004-seguimiento-alcance-diario-meta.md`). | Pendiente del pedido 004. Hoy la app muestra un "alcance diario acumulado" sumado desde BigQuery; sale cuando esté la lectura desde Meta |
| A4 | Las recomendaciones nombran campaña, contenido y conjunto de anuncios, sobre lo que está vivo. Formato: Problema → Solución · qué está afectado · qué revisar. | Funciona |
| A5 | Los cambios reales en Meta se simulan hasta que exista el nexo con PAUTADOR. | Funciona |
| A6 | Umbral único de ±20 % para todas las comparaciones (igual que el tablero de Dirección). | Funciona |
| A7 | Los números se escriben en palabras o con su valor y su referencia ("pagó $2 M más que lo habitual", "gasta 80 % de lo habitual"). No se usa "1,4×" ni "de más" sueltos. | Funciona en portada, Activos y acciones. En las luces de Campañas y de cada campaña, decidido el 30/09: se escriben en claro, diciendo cuánto % más barato o más caro es que lo normal. Lo implementa Interfaz. **01/10:** siempre la métrica y los dos valores ("Cada reacción costó $38 · 10 % más cara que lo normal en Santa Fe ($35)"); las tarjetas de acción ya lo cumplen (ver B1) |
| A8 | Se mide mucho el **costo por reacción** como medida de efectividad de los contenidos. | Funciona |
| A9 | Tema claro siempre. No destacar los pedidos de presupuesto que faltan (la base tiene problemas). | Funciona |
| A10 | **02/10:** la recomendación "Peor que la temporada anterior" (C2) usa el mismo cálculo que la tarjeta "Esta temporada" del panel Rendimiento, para que la tarjeta y la recomendación nunca digan cosas distintas. El canal Oficial e Informativo juntos se llama "Ambas" (antes "General"). | Funciona en C2. La luz Propia de las estacionales sigue con el cálculo viejo hasta que Interfaz la conecte |

---

## B. Contra qué se compara

### B1. Las tres referencias ("luces")

| Referencia | Qué es | Cuándo aparece |
|---|---|---|
| General | Lo normal en todos los gobiernos, último año. En Meta: mismo objetivo × formato × placement. En el resto: misma plataforma × objetivo, últimos 180 días. | Siempre que haya 12 casos o más |
| Proyecto | Lo normal en ese proyecto y canal, último año, mismo objetivo × formato. | Ídem |
| Propia | Las semanas anteriores de la misma campaña. | Campañas largas y constantes, desde la tercera semana |
| Temporada anterior | Las mismas semanas de la temporada pasada, con los costos ajustados por inflación (Interacción y Tráfico: 2 % por mes; Alcance: 0). Reemplaza a Propia. | Campañas estacionales |

Colores: verde = 20 % o más mejor · amarillo = dentro de ±20 % · rojo = 20 % o más peor · gris = sin referencia.

**Qué se muestra (decisión de Juan Pablo del 01/10).** En pantalla las luces comparan solo contra lo normal del proyecto, con su
nombre ("lo normal en Santa Fe"), y contra la misma campaña ("las semanas anteriores de esta campaña" o "la temporada pasada de
esta campaña"). General deja de mostrarse como luz, pero el motor la sigue usando sin cambios (C1 sigue pidiendo rojo contra General
y contra Proyecto); la tarjeta de C1 lo explica como "lo normal en todos los gobiernos". General, Proyecto, Propia y Temporada
anterior quedan como nombres internos de este documento: la app no los usa como etiquetas.
También del 01/10: si el proyecto no tiene referencia, no se reemplaza por la de todos los gobiernos: se dice "sin referencia en
<proyecto>". "Revisar campañas" muestra solo las campañas en rojo contra lo normal del proyecto o contra la misma campaña.

### B2. Con qué métrica se juzga cada campaña

| Objetivo | Métrica principal |
|---|---|
| Alcance | CPM |
| Interacción | Costo por reacción |
| Tráfico | CTR |
| Reproducciones (YouTube, TikTok, Google) | Costo por reproducción |

El "engagement" de un video es casi todo reproducciones (98 %): las tasas solo se comparan dentro del mismo formato. Stories no registra reacciones: no entra en las referencias de reacción (01/10: en Stories, la tasa de interacción dice "no aplica").

### B3. Eficacia (la regla de Looker, ajustada)

Cada anuncio de Meta se compara contra los de su mismo objetivo y placement dentro del cliente, en su misma época (los 3 meses que terminan en su último mes), sobre una ventana de 365 días. Verde: entre el 25 % más barato por reacción. Rojo: entre el 25 % más caro. Si el cliente tiene menos de 12 anuncios comparables, se usa la referencia general. Se resume como **% del gasto en anuncios rojos**: menos de 25 % verde, menos de 50 % amarillo, menos de 75 % naranja, y rojo por encima. Tabla: `automatizado.eficacia_anuncios`, se regenera todos los días.

### B4. Tipos de campaña

| Tipo | Qué es | Contra qué se compara |
|---|---|---|
| Constante | Se comunica todo el año (Operativos de Seguridad, Chubut Avanza). Se sugiere con gasto en 20 de las últimas 52 semanas, o 16 si no tiene una temporada anterior. | Sus semanas anteriores |
| Estacional | Vuelve en la misma época: una tanda anterior de 2 semanas o más que arrancó hace 1 o 2 años (±6 semanas), separada por 16 semanas o más sin gasto. | La temporada anterior |
| Larga | Ninguna de las dos y 30 días o más. | Sus semanas anteriores |
| Puntual | Ninguna de las dos y menos de 30 días. | Solo General y Proyecto |

Constante y estacional son sugerencias: **las confirma una persona** en Insights o en la pantalla de la campaña.

### B5. Datos

- Se evalúa hasta el último día completo (DataJunta carga a las 8:00 el día anterior).
- Pieza viva = con gasto en los últimos 2 días.
- "Pagó $X más que lo habitual" = lo gastado menos lo que habría costado lo mismo (impresiones, reacciones o clicks, según el objetivo) a los costos habituales del proyecto. No tiene relación con el presupuesto.

---

## C. Reglas que la app aplica hoy

Todas sobre campañas activas. Orden en la bandeja: primero por prioridad, después por plata en juego.

| # | Recomendación | Se dispara cuando… | Qué propone | Prioridad | Plataformas |
|---|---|---|---|---|---|
| C1 | Rinde por debajo | Métrica principal 20 % o más peor que lo normal en el proyecto **y** que lo normal en todos los gobiernos, y pagó $100 mil o más (o 5 % de su gasto) por encima de lo habitual en el proyecto | Pausar la pieza de peor costo por reacción y pasar su presupuesto a la mejor (si la mejor rinde 1,5 veces la peor); si no, revisar pieza y audiencia y pausar si en 2 días no mejora | 3 | Meta |
| C2 | Peor que la temporada anterior | Estacional confirmada cuyo KPI del objetivo, en toda esta temporada, está 20 % o más peor que en la misma cantidad de semanas desde el inicio de la temporada pasada (toda la pasada, si fue más corta). Se compara objetivo por objetivo y formato por formato; si por formato no cubre el 80 % del gasto, objetivo por objetivo; si tampoco, no se dispara. La plata de la pasada se lleva a hoy con la inflación de cada objetivo. **Desde el 02/10 es el mismo cálculo que la tarjeta "Esta temporada"** (`temporada()` en `app/marcas.js`); antes comparaba solo las semanas completas del objetivo de la campaña | Retomar las piezas y audiencias que funcionaron | 2,5 | Meta |
| C3 | Se desgastó | Larga o constante: sus 2 últimas semanas quedaron debajo del cuarto peor de las semanas anteriores de esta campaña, y 20 % o más peor que lo normal en esas semanas | Renovar las piezas o pausar una semana | 2,5 | Meta |
| C4 | Sin entrega | Vigente, sin gasto hace más de 2 días (y con gasto en los últimos 10) | Revisar rechazos, revisión o presupuesto | 2,5 | Meta |
| C5 | Apagón | Un activo gastó menos de la mitad de su día típico del mes anterior en los últimos 2 días completos | Revisar pausas, rechazos o presupuesto en sus cuentas | 2,5 | Todas |
| C6 | Mejor momento | Larga o constante: sus 2 últimas semanas quedaron arriba del cuarto mejor de las semanas anteriores de esta campaña, y no está 20 % o más peor que lo normal en todos los gobiernos | Sostener y subir 20 % el presupuesto diario | 2 | Meta |
| C7 | Presión acumulada alta | 20 impresiones por habitante o más en el último mes de la campaña, y la métrica principal de las últimas 4 semanas 15 % o más abajo de las 8 anteriores | Ampliar la audiencia o pausar una semana | 2 | Meta |
| C8 | Placements débiles | Interacción con 5 % o más del gasto (y más de $50 mil) en Instream, Threads o Explore | Excluir esos placements | 2 | Meta |
| C9 | Sumar Facebook Reels | Alcance de más de $500 mil con menos de 5 % en Facebook Reels (y menos de la mitad en Stories) | Habilitar Facebook Reels | 2 | Meta |
| C10 | Se comparte | Pieza viva con 300 reacciones o más y 10 o más compartidas cada 100 reacciones | Subir 20 % el presupuesto mientras siga compartiéndose | 2 | Meta |
| C11 | Genera conversación | Pieza viva con 300 reacciones o más y 13 o más comentarios cada 100 reacciones | Leer los comentarios: seguir, moderar o pausar (siempre a mano) | 2 | Meta |
| C12 | Costo por objetivo | Una combinación de red y objetivo 20 % o más cara que en los 3 meses anteriores y con 8 % o más del gasto del mes | Revisar pieza, audiencia y puja de esa red | 2 | Todas |
| C13 | Se abandona temprano | Video vivo con 20 mil reproducciones o más y $50 mil o más, cuya retención al 25 % está 20 % debajo del cuartil bajo de su objetivo | Revisar los primeros segundos | 1,8 | Meta |
| C14 | Pico | Un activo gastó más del doble de su día típico en los últimos 2 días completos | Confirmar que sea intencional | 1,8 | Todas |
| C15 | Rotar contenidos | Piezas vivas con más de $30 mil que pasaron 15 días (video) o 12 (placa o carrusel) | Pedir piezas nuevas | 1,5 | Meta |

Notas:
- "Subir 20 %" respeta el primer control de seguridad (sección D).
- Qué puede ir por PAUTADOR (contrato aprobado el 30/09, `orquestacion/CONTRATOS/cambios-seguimiento-a-pautador.md`): cualquier campaña de Meta de una cuenta habilitada en PAUTADOR, aunque la haya cargado un implementador a mano, y solo si la acción es **Pausar** o **Cambiar presupuesto**. Lo demás es manual (otras plataformas, y revisar, pedir piezas o cambiar la segmentación). Ya no hace falta que todos los activos de la campaña estén automatizados. Desde el 30/09 la app lo marca así: C1 (solo cuando propone pausar la pieza peor), C3, C6, C7 y C10 se pueden pedir; el resto va a mano. Seguimiento todavía no sabe qué cuentas están habilitadas: si la cuenta no lo está, PAUTADOR rechaza el pedido en su validación.
- Campañas que terminan esa semana por un evento (hoy, Juegos Suramericanos) no generan recomendaciones. La lista se carga a mano.
- Presupuesto mensual: proyección al cierre = gasto acumulado + ritmo de los últimos 2 días completos × días que faltan. En línea entre 85 % y 102 % del presupuesto. Se muestra; no genera recomendación.

Para la app (lo que leen los implementadores en "Cómo leer", debajo de las reglas; en castellano simple, sin referencias a este documento). Si cambia una nota de arriba, se revisa esta lista:
- Desde la tarjeta se puede pedir el cambio a PAUTADOR cuando la recomendación es de Meta y propone pausar o cambiar el presupuesto. Si la cuenta de la campaña no está habilitada en PAUTADOR, el pedido vuelve rechazado y el cambio se hace a mano. Lo demás (otras plataformas, revisar, pedir piezas nuevas o cambiar la segmentación) se hace a mano.
- Ningún cambio de presupuesto supera el 20 % por vez; por eso las subas que se proponen son de 20 %.
- Las campañas de un evento que termina esa semana (hoy, los Juegos Suramericanos) no generan recomendaciones.
- El presupuesto del mes se muestra con una proyección al cierre: lo gastado más el ritmo de los últimos 2 días completos por los días que faltan. Está en línea si queda entre 85 % y 102 % del presupuesto. Es solo informativo: no genera recomendaciones.

En observación en la app (las que la sección F marca "En observación"; nombre y qué hace):
- Lectura temprana: al quinto día de cada pieza de Meta se anota si va entre las que peor o mejor rinden de su tipo, y cuando la pieza termina se mide si esa lectura acertó.

---

## D. Controles de seguridad para cambios en Meta

Vienen de la spec v0.4. No se usan todavía porque los cambios están simulados, pero **valen para el nexo con PAUTADOR**.

1. Máximo ±20 % del presupuesto diario por cambio (más reinicia el aprendizaje del conjunto).
2. Un cambio por conjunto cada 3 días (01/10: vale solo para Cambiar presupuesto; pausar no tiene esa espera).
3. Nada en los últimos 2 días del conjunto.
4. Nunca por debajo del mínimo diario de Meta.
5. Mover plata entre campañas respeta el presupuesto mensual del proyecto.
6. Rotar creativo no se aplica solo: genera un pedido de pieza nueva.
7. (01/10) Lo que se pausa por pedido no se reactiva desde Seguimiento: no hay acción "Reactivar"; se reactiva a mano.

Estado: Pendiente (se implementan con el nexo).

---

## E. Respuestas del equipo y aprendizaje

| # | Regla | Estado |
|---|---|---|
| E1 | Cada recomendación se puede enviar a PAUTADOR, marcar como hecha a mano o descartar. **Siempre con motivo** (decisión del 30/09): el descarte, con No aplica · Ya estaba resuelto · Decisión del cliente · El dato está mal · Esperar unos días · Otra, con texto libre; la "hecha a mano", con su propia lista de motivos, también con texto libre. Además: ¿sirve? (Sí / No / Falta un dato) y comentario. **Decidido el 01/10 (definitivo):** motivos de "hecha a mano": Solo se puede hacer a mano (no es pausar ni cambiar presupuesto) · Es de otra plataforma (no Meta) · Lo hice como se proponía, pero directo en la plataforma · Lo hice distinto a lo propuesto (con texto) · Hice solo una parte (con texto) · PAUTADOR lo rechazó o falló y lo hice a mano · Otra (con texto). Cuando la recomendación es de las que solo se hacen a mano, el primero viene elegido (se puede cambiar). En los dos casos, "Otra" pide texto obligatorio. | Funciona (descartes y "hecha a mano") |
| E1b | **Quién pide un cambio:** solo el implementador del proyecto (según el sistema de usuarios de PAUTADOR). Su pedido cuenta como la aprobación: no hay un segundo paso en PAUTADOR. PAUTADOR igual valida los controles de la sección D y tiene la última palabra. 01/10: quién puede pedir lo dice el rol de su acceso en PAUTADOR. | Pendiente (con Railway y el nexo) |
| E1c | **Comentarios a las reglas vigentes:** los implementadores ven las reglas de esta sección C en la app, las comentan y cada comentario queda con su autor y fecha en el repositorio. Se revisan en la sesión de los lunes. **Decidido el 01/10 (definitivo):** la pantalla muestra las 15 reglas de la sección C más una línea con lo que está en observación (hoy, la lectura temprana). | Pendiente (la pantalla es de Interfaz; el autor sale del sistema de usuarios) |
| E2 | Todo queda en el repositorio: `app/repositorio/recomendaciones/` (lo que generó el agente cada día) y `app/repositorio/respuestas.jsonl` (lo que respondió el equipo). | Funciona en local. Pendiente: base compartida |
| E3 | Medir si el cambio funcionó: a los 7 días de cada recomendación aplicada, comparar la métrica antes y después. | Pendiente |
| E4 | Silenciamiento: una regla descartada 3 veces con "decisión del cliente" o equivalente para el mismo cliente y eje **propone** silenciarse; lo confirma una persona. | Pendiente |
| E5 | No mostrar recomendaciones que muevan menos de $100 mil o menos del 5 % del gasto. | Funciona en C1. Pendiente en el resto |
| E6 | Confianza alta / media / baja según cuántos casos tiene la referencia y cuántos días lleva la campaña. | A decidir (hoy se usa el mínimo de 12 casos y "poca historia") |
| E7 | **Sesión de aprendizaje de los lunes**, una sola con PAUTADOR (`orquestacion/FLUJO-OPERATIVO.md`). Recomendaciones lleva un informe de la semana: comentarios a reglas, descartes y "hechas a mano" con su motivo, resultados a 7 días, lectura temprana y propuestas de reglas nuevas. Una regla nueva solo entra con el visto bueno de Juan Pablo en esa sesión, y se anota acá. **Criterios del informe, decididos el 01/10 (definitivos):** se propone silenciar una regla con 3 descartes "Decisión del cliente" en el mismo proyecto; para sacar conclusiones de una regla hacen falta 5 decisiones; se marca una regla cuando la mitad o más se descarta por "No aplica" o "El dato está mal", o responde "¿sirve? No"; se señala una regla con 3 "hechas a mano" con el mismo motivo; esas proporciones se miran sobre los últimos 28 días. Solo deciden qué se lleva a la sesión, no qué recomienda la app. | Funciona el informe (`borrador/informe-semanal.js`); hoy casi sin respuestas guardadas |

---

## F. Reglas de la v0.2 que no están en la app

Siguen escritas, con su evidencia, en `reglas-recomendador.md`. Hay que decidir una por una si se implementan, se cambian o se dan de baja.

| Grupo | Reglas | Estado |
|---|---|---|
| Lectura temprana | Al día 5, la pieza en el peor cuartil se pausa o se mueve; la del mejor se refuerza. Nada antes del día 3. | **En observación** desde el 30/09 (decisión de Juan Pablo: corroborarla, todavía no accionar). No genera recomendaciones ni tarjetas: cada día registra qué piezas de Meta quedan en el peor y en el mejor cuartil al día 5 y, cuando terminan, mide el acierto con los criterios de la v0.2. Datos: `app/repositorio/lectura-temprana/` (`predicciones.jsonl` y `resumen.json`). Código: `borrador/lectura-temprana.js`. Evidencia: 82 % de acierto en la v0.2 (campañas); con los datos de la app, 87 % por pieza (ver nota abajo). **01/10:** cuándo se da por comprobada y mínimo al día 5, decididos (ver nota) |
| Ritmo por campaña | Subejecutada (menos de la mitad de lo que corresponde al plazo) o sobreejecutada (más de 1,15). | A decidir. Necesita el presupuesto de cada campaña, que DataJunta no trae bien |
| Audiencias | Difícil · destacada · profesionales declarados · ampliar antes que segmentar · probar intereses · sin explotar. | A decidir |
| Electorales (para 2027) | Escalada por cliente · veda · apagón post-electoral · mezcla en campaña. | Pendiente para 2027 |
| Contexto | Núcleo duro contra núcleo duro (por tamaño y por nombre) · sesgo histórico del proyecto. | A decidir |
| Estructura | Concentración de gasto en una pieza (más de 80 %) · continuidad por eje · mezcla de jerarquía. | A decidir |
| Presión por cliente | 60 / 80 impresiones por habitante y por mes, por cliente. La app usa otra medida, por campaña (C7). | Decidido el 30/09: conviven. La presión (cuánto vio cada persona) se mide por campaña, por contenido y por cliente (todas sus campañas y contenidos). Depende del pedido 004 (alcance desde Meta). El especialista de Meta propone cómo queda C7; C7 no cambia todavía |
| Propuestas para PAUTADOR | Reparto histórico en vez del 70/30 · monto sugerido por jerarquía · duración sugerida · aviso de audiencia · marcar permanentes. | Van al Orquestador general cuando se defina el nexo |
| Adelantar gasto en Interacción | Hipótesis. | No se prueba por ahora (decisión del 23/09) |

Nota sobre la lectura temprana en observación (30/09):
- Unidad: la pieza (contenido) de Meta; su día 1 es su primer día con gasto. Métrica: la principal de su objetivo (B2).
- Al día 5 se compara contra el día 5 de las piezas del mismo canal, objetivo y formato de los 60 días anteriores (8 o más). Es lo único que no viene de la v0.2, que comparaba contra el mismo mes de inicio (en vivo esas piezas todavía no existen).
- Se juzga igual que en la v0.2: la pieza terminó (3 días sin gasto), duró 8 días o más y menos de 120, tuvo 10.000 impresiones o más, y se compara contra las terminadas del mismo canal, objetivo, formato y mes de inicio (8 o más). Peor cuartil: el 25 % que peor rinde; mejor cuartil: el 25 % que mejor rinde.
- Hacia atrás, con los 180 días que ya tiene la app (sin bajar datos nuevos): de 930 piezas en el peor cuartil al día 5, el 87 % terminó en el peor cuartil y el 2 % terminó arriba de la mediana; de 1.122 en el mejor cuartil, el 75 % terminó en el mejor. Medido igual que la v0.2 (todo dentro del mismo mes de inicio): 87 % y 86 %. Por campaña, como en la v0.2: 84 %.
- Decidido el 01/10. **Se da por comprobada** con 50 piezas reales (registradas en vivo, no hacia atrás) que estaban en el peor cuartil al día 5 y ya se juzgaron, si el 75 % o más terminó en el peor cuartil y el 5 % o menos se recuperó (terminó arriba de la mediana). **Mínimo:** para el registro solo cuentan las piezas que al día 5 llevan $20.000 o más de gasto, o 5.000 impresiones o más; las que no llegan se anotan igual, quedan marcadas "fuera por el mínimo" y no entran en el acierto (las anotadas antes no se borran). **Resultado:** se juzga cuando la pieza lleva 3 días sin gasto, como hasta ahora. El resumen dice cuántas piezas faltan para darla por comprobada. Aunque se compruebe, sigue en observación hasta que Juan Pablo decida en la sesión de los lunes que pase a recomendar.

---

## G. De la spec v0.4: a decidir si se retoman

| Tema | Qué era | Estado |
|---|---|---|
| Piso simulado | Para cada campaña, cuánto debería lograr con su presupuesto si rindiera como una campaña normal; etiqueta "en camino / en riesgo / no llega". | Aprobado el 30/09 como "hasta dónde llega" (lo construye Referencias). **01/10:** va a llegar con 100 % o más de lo esperado, en riesgo entre 83 % y 100 %, no va a llegar debajo de 83 %; cuando la campaña terminó dice "llegó" o "no llegó"; lo esperado sale solo de lo normal del proyecto (sin él: "sin referencia en <proyecto>"). **02/10:** antes del día 10 del mes (según el último día completo de datos) no se proyecta: queda "sin dato" con el motivo "Todavía pocos días del mes para proyectar: se calcula desde el 10/<mes>" |
| Audiencias solapadas | Aviso cuando dos conjuntos de la misma campaña apuntan a zonas que se pisan (toda la provincia y su capital). | Aprobado el 30/09: solo una marca, sin acción (lo construye Meta). **01/10:** también se marcan las audiencias que comparten algún lugar; se le pide a PAUTADOR la segmentación real |
| Calidad de datos | Lista de lo que no se pudo analizar por cómo está cargado (conjuntos sin eje, comunicaciones llamadas "Stories"). | A decidir |
| Historial | Pantalla con todas las decisiones y su resultado. | Pendiente, junto con E3 |

---

## H. Por plataforma

| Plataforma | Peso del gasto (180 días) | Qué datos trae | Reglas propias hoy |
|---|---|---|---|
| Meta (Facebook, Instagram) | 52 % | Todo: reacciones, reproducciones, clicks, audiencia, placement, conjunto | C1 a C4, C6 a C11, C13, C15 |
| DV360 | 23 % | Impresiones y clicks | Ninguna propia (C5, C12, C14) |
| YouTube | 16 % | Reproducciones y clicks | Ninguna propia |
| TikTok | 4 % | Reproducciones y clicks; solo Oficial | Ninguna propia |
| Display | 4 % | Reproducciones y clicks | Ninguna propia |
| Search | 0,4 % | Clicks | Ninguna propia |
| X | — | Sin datos | — |

Fuera de Meta solo corren las tres reglas generales (Apagón, Pico y Costo por objetivo). Escribir las reglas propias de Google (video y display) es el primer trabajo de su especialista. 01/10: se arma la referencia de CTR para Google (Search y Display).

---

## I. Preguntas abiertas

1. Piso simulado y audiencias solapadas (G): ¿se retoman o se dan de baja? **Respondida el 30/09:** se retoman los dos, el piso como "hasta dónde llega" y las audiencias solapadas como una marca. Detalles cerrados el 01/10 (ver G).
2. Lectura temprana al día 5 (F): ¿se implementa? Reemplazaría parte de C1. **Respondida el 30/09:** se agrega en observación, para corroborarla, sin accionar (ver F). Lo que quedaba (con qué acierto se da por comprobada y el mínimo al día 5) se decidió el 01/10 (ver la nota de F).
3. Luces de Campañas y de cada campaña: ¿pasan a "Costo por reacción $38 · lo normal $52" o se sacan? (A7) **Respondida el 30/09:** se escriben en claro, diciendo cuánto % más barato o más caro es que lo normal. Lo implementa Interfaz.
4. Alcance desde Meta (A3): con qué acceso se lee y de qué cuentas. **Respondida el 30/09:** con el mismo acceso de PAUTADOR, una vez por día. Pedido al Orquestador general: `orquestacion/BUZON/pedido-004-seguimiento-alcance-diario-meta.md`.
5. ¿La presión por habitante se mide por campaña (hoy), por cliente (v0.2) o las dos? **Respondida el 30/09:** las dos, y también por contenido: por campaña, por contenido y por cliente (todas sus campañas y contenidos). Depende del pedido 004. El especialista de Meta está proponiendo cómo queda C7; hasta entonces C7 sigue igual.
