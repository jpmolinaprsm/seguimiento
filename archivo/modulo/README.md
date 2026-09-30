# Seguimiento y Optimización — módulo

Módulo HTML independiente del agente **Seguimiento y Optimización** (ecosistema Prosumia). Hoy corre solo; a futuro se conecta con PAUTADOR (vía de ajuste por conjunto, pedidos de pieza, quién aprueba). Todo lo que toca la API de Meta está **simulado**.

```bash
node server.js        # http://localhost:4320
```

Necesita el `.env` local de PAUTADOR (`../../pautador/.env`) y la clave de BigQuery en `../../GCP/prsm-bq-media-6a154f90fdb5.json` (o `BQ_SERVICE_ACCOUNT_KEY_PATH`). Usa el `node_modules` de PAUTADOR (express, googleapis): no tiene dependencias propias. Babel se carga de unpkg al abrir la página (el runtime de Claude Design lo pide); React y ReactDOM van locales.

## Qué hay

| Carpeta / archivo | Qué es |
|---|---|
| `server.js` | Express: sirve `public/` y el API (`/api/proyectos`, `/api/datos?proyecto=`, `/api/decisiones`). Caché de BigQuery de 30 min por proyecto (`?forzar=1` la salta). |
| `src/bq.js` | Cliente de BigQuery reutilizando el de PAUTADOR (jobs en `prsm-bq-media`). |
| `src/consultas.js` | Las consultas (solo lectura): conjuntos vivos, serie diaria, alertas diarias, mes en curso, benchmark semanal, perfil del proyecto (`perfil_campana`, `perfil_audiencia`). |
| `src/motor.js` | Reglas (`../documentos/reglas-recomendador.md` v0.2): estado, piso simulado, ritmo, comparable del benchmark, rankings, insights (cruce de canales, fatiga medida y por calendario, solapamiento, audiencias con historia, perfil del proyecto, calidad), recomendaciones agrupadas por contenido, prioridad, silenciamiento (propuesto, lo confirma una persona), presión por habitante, período electoral. |
| `ui/script.js` | Lógica de la pantalla (misma derivación que el prototipo de Claude Design, con datos del API). |
| `build-index.js` | Genera `public/index.html` desde el handoff de diseño (`../Interfaz de recomendaciones/...`) + `ui/script.js`. **Correrlo después de tocar `ui/script.js` o el diseño.** |
| `public/` | La página: `index.html` (generado), `RecoCard.dc.html`, `support.js` (runtime de Claude Design), `_ds/` (design system Prosumia), `fonts/`, `vendor/` (React), `assets/`. |
| `data/proyectos.json` | Qué códigos y nombres de proyecto de DataJunta forman cada cliente. |
| `data/decisiones.json` | Decisiones registradas (con foto de la recomendación). |
| `data/cuentas.json` | Activo → `app` para simular "vía API"; vacío = todo manual. Cuando exista la conexión con PAUTADOR, la vía sale de allá por conjunto. |
| `prueba-motor.js` | `node prueba-motor.js "Gobierno del Chaco"`: corre consultas + motor sin servidor y guarda `data/_ultima_prueba.json`. |

Datos de referencia del motor: `../../analisis-datajunta/data/poblacion.json` (presión por habitante) y `calendario_electoral.json` (período electoral).

## Fuentes y frescura

- `datajunta_meta_90d` (por canal): conjuntos, serie diaria, presupuesto mensual del proyecto. Se refresca 9:00 ART.
- `alertas_diarias`: solo conjuntos con $40 mil/semana; para el resto el comparable sale de `benchmark_meta` (nivel 4 → sin formato → nivel 2 → nivel 1).
- `benchmark_meta`: mediana de comparables, se reconstruye los lunes.
- `perfil_campana` / `perfil_audiencia` (solo en `prsm-bq-media`): sesgo histórico del proyecto y audiencias destacadas/difíciles.

## Limitaciones conocidas del runtime de Claude Design

- Las interpolaciones adentro de `<table>` no resuelven la variable del bucle: el historial se arma con una grilla de divs en `build-index.js`.
- Los `.dc.html` se cargan por `fetch`: la página tiene que servirse por HTTP (no abrir el archivo directo).

## Pendiente (la conexión con PAUTADOR)

- Vía API vs manual por conjunto (hoy `data/cuentas.json`).
- "Rotar creativo" → pedido de pieza real en PAUTADOR.
- Quién aprueba y qué le llega a PAUTADOR cuando se acepta una recomendación.
- Resultado a los 7 días de cada cambio aplicado (hoy solo "Se mide el dd/mm").
- Alcance, frecuencia y estados de entrega desde Meta.
