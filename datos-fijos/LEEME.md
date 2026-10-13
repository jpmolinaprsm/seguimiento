# Datos fijos de Seguimiento

Copia fija de las referencias que arma Python en `analisis-datajunta/`. El armado (`borrador/armar.js`) lee de acá y no de
`analisis-datajunta/`, para que la app funcione sola en Railway (decisión D11 del plan de Railway, 30/9/2026).

**Se actualiza a mano una vez por mes** (lo hace Referencias e Insights): se rehacen los archivos en `analisis-datajunta/`, se
copian acá encima de los viejos, se corre `node armar.js`, `node pruebas/contrato.js` y se anota la fecha abajo. La huella
cambia (cambian las referencias): está bien, se avisa en el informe.

| Archivo | Qué es | De dónde sale | Cómo se rehace |
|---|---|---|---|
| `t6_bandas_general.csv` | Lo normal de cada métrica (p25 / p50 / p75) de todos los gobiernos, por objetivo, formato y placement | `analisis-datajunta/resultados/` | `16_tanda5_raw.py` (baja de BigQuery `t5_raw_*.parquet`) y después `19_bandas_metricas.py` |
| `t6_bandas_proyecto.csv` | Lo mismo por proyecto y canal | `analisis-datajunta/resultados/` | `19_bandas_metricas.py` (mismo paso) |
| `t6_bandas_juntas.csv` | Lo mismo juntando: cada proyecto con los dos canales (canal "General") y los siete proyectos de la app (cliente "Todos") | `analisis-datajunta/resultados/` | `19_bandas_metricas.py` (mismo paso) |
| `poblacion.json` | Población por proyecto (Censo 2022), para la presión por habitante | `analisis-datajunta/data/` | Se edita a mano (no lo arma ningún script) |

Los scripts se corren desde `analisis-datajunta/` con `.venv/Scripts/python.exe <script>`.

## Copias

- **2/10/2026**: copia inicial. Bandas del 1/10/2026 (incluye `t6_bandas_juntas.csv`, primera versión); población del 23/9/2026.
