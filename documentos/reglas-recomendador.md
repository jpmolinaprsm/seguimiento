# Reglas del Recomendador (v0.2)

Fecha: 23/09/2026. Reemplaza el borrador v0.1 del 21/09. Cada regla trae el umbral, la evidencia que lo sostiene (`analisis-datajunta/hallazgos-perfiles.md`) y de qué tabla de `automatizado` sale el dato. Estado: **propuesta para revisar**; los umbrales marcados "a validar" no tienen todavía un backtest propio.

Convenciones: "ratio" = costo por resultado de la campaña ÷ mediana de sus comparables (canal × objetivo × formato × mes). "Perfil" = las tablas `perfil_*` que se reconstruyen los lunes.

---

## A. Reglas dadas por vos (sin cambios)

| # | Regla |
|---|---|
| D1 | Fuera: activos Pulso, Vibes Argentina, proyectos Observatorio / Analytics / tracking, Córdoba (todos los clientes que digan Córdoba), cuentas internas (Prosumia, Intelia), proyectos "No usar". |
| D2 | El alcance y la frecuencia se leen por período desde Meta. No se calculan desde BigQuery. |
| D3 | Toda consulta a BigQuery restringe por `Fecha`, `Proyecto`, `Activo` y `Comunicacion`. |
| D4 | Los consejos nombran campaña, contenido y contexto, sobre lo que está vivo. |
| D5 | Todo lo que sea API de Meta se simula en el borrador. |
| D6 | Jerarquía = `Tipo` (acuerdo con el cliente): coinciden → esa; se contradicen → la del canal con más gasto; sin etiqueta → observada. Tamaño (pieza suelta / chica / grande / permanente) es otra dimensión. |

---

## B. Cómo se compara (base de todo lo demás)

| # | Regla | Umbral | Evidencia | Fuente |
|---|---|---|---|---|
| B1 | **Comparable** = mismo canal, objetivo, formato y mes; mínimo 8 campañas. Si no alcanza, cae a canal × objetivo × mes. Nunca en pesos entre meses distintos (inflación). | 8 | El orden dentro del comparable persiste semana a semana (corr. 0,74–0,84) | `benchmark_meta`, `perfil_campana` |
| B2 | **Comparable electoral.** Si la campaña corre en período "campaña" o "veda" del cliente, se compara contra comparables del mismo período, no contra la mediana general. | período del calendario | En campaña el ratio general sube 1,2–1,4 (Chubut, Corrientes, Catamarca); en veda 2,6–4× | `perfil_electoral`, `data/calendario_electoral.json` |
| B3 | **Comparable de núcleo duro.** Las audiencias custom (Army, votantes, seguidores, afines) se comparan entre sí, no contra las abiertas: por **tamaño** (chica / mediana / grande según el potencial del catálogo) y por **nombre** (la misma audiencia contra su propia historia). | `aud_seg = custom`; tamaño del catálogo; mismo nombre | Custom paga 1,38× y afinidad política 1,8–4,7×, pero su objetivo es llegar a la base | `perfil_audiencia` |
| B4 | **Sesgo del proyecto.** El ratio de una campaña se lee junto al ratio mediano histórico del proyecto: "0,9 contra la mediana, pero este proyecto suele estar en 1,3" cambia el mensaje. | ratio mediano de 6 meses | Chubut 1,33 y subiendo; JPV 0,70; Israel 0,82; Chaco/Corrientes/Santa Fe estables 0,8–1,0 | `perfil_campana` |
| B5 | **Formato.** Interacción solo se compara dentro del mismo formato. Si el formato no está ni en `Formato` ni en el nombre del contenido, se compara al nivel canal × objetivo × mes y se avisa en calidad de datos. | — | 29 % del gasto sin formato | — |
| B6 | **Permanentes** (comunicaciones de 120+ días) no entran en duraciones, recorridos ni "vence"; se siguen como programas: ritmo mensual y rotación de contenidos. | 120 días | 30 % del gasto son permanentes | `perfil_campana.tamano` |
| B7 | **Datos:** evaluar hasta D-2 (el último día llega parcial); contenido vivo = gasto en las últimas 48 h. | — | — | `datajunta_meta_90d` |

---

## C. Reglas de rendimiento (por contenido y campaña)

| # | Regla | Umbral | Evidencia | Fuente |
|---|---|---|---|---|
| C1 | **Lectura temprana (nueva).** Al **día 5** de vuelo, si el contenido está en el peor cuartil de su comparable → recomendar pausar o mover el restante; si está en el mejor cuartil → candidato a reforzar. Antes del día 3 no se recomienda nada (pico de novedad). | día 5; cuartiles | Rango al día 5 vs final: Spearman 0,88; peor cuartil al día 5 → 82 % termina peor cuartil, 3 % se recupera sobre la mediana; mejor cuartil → 79 % termina mejor | `perfil_curva` + diario |
| C2 | **Confianza por día.** Día 3: media (0,85). Día 5: alta (0,88). Día 7+: alta (0,91). | — | ídem | — |
| C3 | **Caída normal.** Una caída de hasta 25 % en la tasa de reacción respecto de los días 1–3 **no es alerta**: es la meseta esperada (el día 1 rinde 1,44× el promedio; desde el día 11, 0,79×). Solo alertar si la caída supera el 35 % contra la primera semana. | –25 % normal / –35 % alerta | Curva de recorrido (3.472 campañas) | `perfil_curva` |
| C4 | **Bajar presupuesto:** ratio entre 2 y 4 (0,25–0,5 veces la eficiencia de la mediana), con al menos 5 días de vuelo y 10 mil impresiones. | 2–4 | — | `alertas_diarias` |
| C5 | **Pausar y mover el restante:** ratio ≥ 4, mismas condiciones; el restante va al mejor contenido de la misma campaña (ratio < 1). Si no hay uno, al mejor de la misma jerarquía y eje del proyecto. | ≥ 4 | Mover 30 % del gasto del peor al mejor cuartil gana +1,7 a +12 % de resultados (backtest) | `alertas_diarias`, `perfil_campana` |
| C6 | **Reforzar:** ratio ≤ 0,5 desde el día 5, con presupuesto y más de 3 días por delante; máximo +20 % del diario por cambio. | ≤ 0,5 | — | — |
| C7 | **Rotar creativo (cambia).** Aviso por **fatiga medida**: la tasa de reacción móvil de 7 días cae 35 % respecto de la primera semana. Aviso por calendario como respaldo: **placa fija y carrusel a los 12 días, video a los 15** (antes: 21 para todos). Excepciones por proyecto: evento y turismo (Juegos Suramericanos, Turismo Chubut) a los 25. | 12 / 15 / 25 días; –35 % | 2 de cada 3 contenidos de 21+ días fatigan; la mitad antes del día 15 (placa 13, carrusel 12, video 15). Juegos Suramericanos 21 %, día 25 | `perfil_curva`, fatiga |
| C8 | **Fatiga y tamaño de audiencia.** Si el contenido fatiga antes del día 10 y corre sobre una audiencia chica (ciudad, departamento, lista de localidades, custom), la recomendación es ampliar audiencia, no solo cambiar la pieza. | día 10 + `aud_geo` chico | Fatigan más los contenidos chicos (83 %) que los grandes (55 %) | `perfil_audiencia` |
| C9 | **Adelantar el gasto en Interacción (hipótesis; no se prueba por ahora).** En campañas de Interacción, si el gasto diario es plano, proponer concentrar más presupuesto en los días 1–5 (respetando el +20 % por cambio de la fase de aprendizaje). No aplica a Alcance/Impresiones. | días 1–5 | La reacción cuesta 0,60× el día 1 y 1,35× los días 11–21; el gasto está repartido parejo | `perfil_curva` |

---

## D. Reglas de ritmo y presupuesto

| # | Regla | Umbral | Evidencia | Fuente |
|---|---|---|---|---|
| D-R1 | **Ritmo de campaña:** % gastado vs % del plazo, con plazo entre 15 % y 95 %. Subejecutada < 0,5; sobreejecutada > 1,15. | 0,5 / 1,15 | — | `datajunta_meta_90d` |
| D-R2 | **Presupuesto mensual del proyecto** (`PresupuestoMensual`, por proyecto): proyección al cierre al ritmo de 7 días; aviso si supera el 100 % o si va a quedar más del 15 % sin usar. Mostrar el % histórico del proyecto como referencia. | 100 % / 85 % | Ejecución mediana: Santa Fe 96 %, Corrientes 72 %, Chubut 59 %, Chaco 55 %, Catamarca 46 % | `perfil_proyecto_mes` |
| D-R3 | **Mezcla de jerarquía (nueva).** Si el gasto del mes en Alta se aparta más de 20 puntos del histórico del proyecto, avisar (no es error: es contexto para el implementador). | ±20 pp | Santa Fe 59 % Alta; Chubut/Chaco/Corrientes 48–56 % Media; Catamarca Ciudad y Nacho Torres mayormente Baja | `perfil_proyecto_mes` |
| D-R4 | **Concentración de gasto (nueva).** Campaña de 2+ contenidos donde uno se lleva más del 80 % → aviso de riesgo (si ese contenido fatiga, cae toda la campaña). | 80 % | Reparto histórico: principal 53 % en chicas, 23 % en grandes | `perfil_campana` |
| D-R5 | **Continuidad por eje (cambia).** El aviso "vencimiento sin continuidad" se evalúa **por eje**, no por campaña: si en 7 días no queda nada vivo en un eje que históricamente siempre tuvo algo (solapamiento ≥ 60 %), avisar. | 7 días; 60 % | 62–91 % de las campañas se solapan con la siguiente del mismo eje; huecos > 14 días: 2–20 % | `perfil_campana` |
| D-R6 | **Presión por habitante (nueva).** Impresiones del cliente ÷ población, por mes. Aviso a partir de 60; alerta a partir de 80 impresiones/hab/mes. Se muestra junto a la tasa de reacción del cliente vs comparables. La población por cliente está cargada a mano (censo 2022) en `analisis-datajunta/data/poblacion.json`. | 60 / 80 | Chubut 80–100 → tasa 0,57×, ratio 1,83; Catamarca 117 → 0,77, y al bajar a 76 volvió a 0,98; Chaco/Corrientes/Santa Fe 25–50 | `perfil_electoral` (impresiones diarias) + población |

---

## E. Reglas de audiencias

| # | Regla | Umbral | Evidencia | Fuente |
|---|---|---|---|---|
| E1 | **Audiencia difícil:** CPM > 1,5× o ratio > 1,5 en 3 o más campañas del mismo proyecto (persistente, no una vez). | 3 campañas; 1,5 | Listas de localidades 1,77×; departamentos chicos 1,8–2,4× | `perfil_audiencia.etiqueta` |
| E2 | **Audiencia destacada:** ratio < 0,8 en 3+ campañas con el 67 % mejor que la mediana. Se sugiere para contenidos nuevos del mismo eje. | 3; 0,8; 67 % | "Geo Toda la Provincia" SF 0,36–0,39; "Provincia Chaco" 0,65–0,80; "Ciudad SFVC" 0,41–0,73 | `perfil_audiencia` |
| E3 | **Profesionales declarados y afinidad laboral** (empleadores, directores, policías, trabajadores de X): avisar siempre que se usen con objetivo de costo; proponer reemplazar por intereses amplios o abierta. | — | 5–15× la mediana (pymes 14,9; policías 11,5; gerentes 7,0) | `perfil_audiencia` |
| E4 | **Ampliar antes que segmentar.** Para Alcance e Impresiones, si una campaña usa solo audiencias chicas (ciudad, departamento, lista), proponer sumar la abierta provincial. | — | Provincia abierta 0,92 vs departamento 1,31 vs lista 1,77 | `perfil_audiencia` |
| E5 | **Intereses: probar más (a validar).** Sugerir audiencias de intereses del catálogo cuando el eje coincide (salud, educación, seguridad): pocas campañas, ratio 0,65–0,87. | — | 221 campañas, ratio 0,65–0,87 | `perfil_audiencia`, catálogo |
| E6 | **Sin explotar.** Audiencia del catálogo de PAUTADOR nunca usada en el eje, con potencial ≥ 100 mil, o usada con ratio < 0,8 en otro eje del mismo cliente. Solo para clientes cuyo catálogo cruza por nombre (Chubut, Chaco, Santa Fe, Catamarca); Corrientes y Lotería requieren cruce por código. | 100 mil | Catálogo 382 / 152 usadas | `catalogo_audiencias.csv` |

---

## F. Reglas electorales (para 2027)

| # | Regla | Umbral | Evidencia | Fuente |
|---|---|---|---|---|
| F1 | **Plantilla de escalada por cliente.** Desde la semana –10 el agente muestra la curva histórica del cliente (índice semanal) y compara el ritmo actual con ella: "Corrientes en 2025 estaba en 6× a esta altura; hoy va en 2×". | semana –10 | Corrientes 6× (–5) → 11,5× (–1); Chaco 2× desde –7; Santa Fe 2–3×; Chubut sin escalada, cambia la mezcla (Alta 12 → 40 %) | `perfil_electoral` |
| F2 | **Veda:** desaconsejar gasto en veda salvo Informativo; si hay gasto, avisar el costo esperado. | veda | Ratio 2,6–4× en veda; Chaco y Chubut pautan solo Informativo en veda | `perfil_electoral` |
| F3 | **Apagón post-electoral esperado.** En los 14 días posteriores, "sin entrega" no es alerta para clientes con apagón histórico (Corrientes, Chubut); se marca como "pausa post-electoral". | 14 días | Corrientes 1 % del ritmo por dos meses; Chubut 0,09 → 0 | `perfil_electoral` |
| F4 | **Mezcla en campaña.** Avisar cuando la jerarquía Alta o los contenidos nuevos por semana se apartan del patrón del cliente (Corrientes: 100+ contenidos nuevos por semana en campaña). | patrón del cliente | — | `perfil_electoral` |

---

## G. Prioridad, confianza y aprendizaje

- **Prioridad** = plata en juego (restante afectado) × gravedad (distancia a la mediana o al piso) × urgencia (días restantes, con tope). Las de confianza baja nunca van primeras.
- **Confianza:** alta si el comparable tiene 20+ campañas y la campaña 5+ días; media con 8–19 o 3–4 días; baja debajo de eso.
- **Umbral de valor:** no mostrar recomendaciones que muevan menos de $100 mil o menos del 5 % del restante de la campaña. (Confirmado.)
- **Silenciamiento:** una regla declinada 3 veces con "es intencional" o "pedido del cliente" para el mismo cliente y eje **propone** silenciarse; **lo confirma una persona** (no es automático). Mientras no se confirme, sigue apareciendo con confianza baja.

---

## H. Lo que va a PAUTADOR (propuestas, no cambios hechos)

| # | Propuesta | Evidencia |
|---|---|---|
| P1 | **Presupuesto sugerido: reparto histórico en vez del 70/30.** Usar el share del contenido principal que el proyecto hace de verdad por tamaño de campaña (chica: 53 % mediana; grande: 23 %, 5 contenidos para el 80 %) y por proyecto (Chubut 50 %, Catamarca 51–54 %, Chaco 41 %, Corrientes 39 %, Santa Fe 36 %). Solo el 26 % de las chicas y el 2 % de las grandes cumplen hoy el 70/30. | 3.3 |
| P2 | **Monto sugerido por jerarquía y tamaño del proyecto.** Además de la mediana de los últimos 5 pedidos: la mediana histórica del proyecto para esa jerarquía × tamaño (de `perfil_campana`), como segunda referencia. | 3.1 |
| P3 | **Pacing en Interacción.** Ofrecer "adelantado" (más gasto en los días 1–5) como opción de reparto temporal para campañas de Interacción; dejar plano para Alcance. Hipótesis: no se prueba por ahora. | 3.4 D |
| P4 | **Duración sugerida por tamaño.** Pieza suelta 11 días, chica 18, grande 35 (medianas sin permanentes). | 3.8 |
| P5 | **Aviso de audiencia en Pedido Manual.** Al elegir una audiencia del catálogo, mostrar su etiqueta (destacada / difícil / sin uso) y su ratio histórico en el proyecto. | 3.7 |
| P6 | **Marcar permanentes.** Permitir marcar una comunicación como "permanente" al pedir, para que Seguimiento la siga como programa. | 3.8 |

---

## Decisiones cerradas (23/09/2026)

1. Silenciamiento (G): lo confirma una persona.
2. Núcleo duro (B3): custom contra custom, por tamaño y por nombre de audiencia.
3. Adelantar gasto en Interacción (C9, P3): queda como hipótesis; no se prueba por ahora.
4. Población por cliente (D-R6): cargada a mano, censo 2022, en `data/poblacion.json`.
5. Umbral de valor (G): $100 mil / 5 %, confirmado.
