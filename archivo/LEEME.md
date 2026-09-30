# Archivo

Lo que está acá ya no se usa. Se guarda como referencia; nada de la app lo lee.

| Carpeta | Qué era | Archivado | Reemplazo |
|---|---|---|---|
| `modulo/` | El módulo anterior de Seguimiento (servidor en el puerto 4320, interfaz vieja, motor de reglas v0.2). | 30/09/2026 | `../app/` (interfaz), `../borrador/` (cálculos y recomendaciones), `../datos/bq.js` (acceso a BigQuery) |

Tres reglas del motor viejo (`modulo/src/motor.js`) no pasaron a la app: lectura temprana al día 5, mínimo de 8 campañas
comparables y presión por habitante por cliente (60 / 80). Están anotadas como "a decidir" en
`../documentos/reglas-recomendador-v0.3.md`, sección F.

Las rutas internas de `modulo/` quedaron rotas al moverlo (apuntaban a `../../pautador` y `../presupuestos`): no se corre desde acá.
