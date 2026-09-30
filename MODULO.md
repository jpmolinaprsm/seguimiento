# Ficha del módulo: Seguimiento y Optimización

**Qué hace:** los implementadores siguen cómo rinde lo pautado y lo convierten en acciones. Prioridad: rendimiento contra objetivo.
**Estado:** en construcción. Hay una app (`app/`) sobre el diseño de Claude Design, con datos reales de DataJunta (BigQuery) y un repositorio de recomendaciones y respuestas del equipo. La API de Meta sigue simulada y no hay conexión real con PAUTADOR.
**Código y diseño:** `Seguimiento/` y `analisis-datajunta/` · **Agentes:** `seguimiento-agentes/` (armados el 30/9: Extracción (antes Datos), Referencias e Insights, Recomendaciones, Interfaz, Meta y Google; definiciones en `.claude/agents/seguimiento-*.md`). **Reglas vigentes:** `Seguimiento/documentos/reglas-recomendador-v0.3.md`.

## Qué expone a otros módulos
- Recomendaciones de optimización por campaña (por definir cómo salen).
- Aprendizaje por proyecto (perfiles y benchmarks en BigQuery) para el Planificador.

## Qué necesita de otros módulos
- De PAUTADOR: qué se pautó (pedidos, códigos) y la vía para ejecutar un cambio (el nexo).
- Planilla de presupuestos pedidos (Sheets).

## Pendiente central
El nexo con PAUTADOR, a definir a mediados de octubre: `orquestacion/CONTRATOS/nexo-seguimiento-pautador.md`.

## Mapa general
`orquestacion/MAPA.md`
