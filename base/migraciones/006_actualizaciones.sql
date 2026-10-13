-- Seguimiento y Optimización · migración 006: registro de cada actualización diaria (y de la copia semanal a BigQuery).
-- PLAN-RAILWAY, sección 2: "registro de la corrida (fecha, resultado, hasta qué día, duración, filas, GB de BigQuery, error)".
-- Una fila al empezar (resultado en_curso) que se completa al terminar. Sin mails.
create table if not exists actualizaciones (
  id            bigserial   primary key,
  tipo          text        not null default 'diaria' check (tipo in ('diaria', 'manual', 'respaldo_bq')),
  empezo        timestamptz not null default now(),
  termino       timestamptz,
  resultado     text        not null default 'en_curso' check (resultado in ('en_curso', 'ok', 'fallo')),
  datos_hasta   date,                              -- hasta qué día quedaron los números
  version       text,                              -- carpeta armada que pasó a ser "la del día" (si pasó)
  duracion_ms   integer,
  filas         jsonb,                             -- filas por consulta o por tabla
  gb_bigquery   numeric(10, 3),
  memoria_mb    integer,
  referencia    text,                              -- respaldo_bq: el lunes de la semana (para no repetirlo tras un reinicio)
  error         text,
  detalle       jsonb       not null default '{}'::jsonb   -- controles: contrato, parches, proyectos con datos, caída de filas
);
create index if not exists actualizaciones_idx on actualizaciones (tipo, empezo desc);
-- Una sola copia buena por semana.
create unique index if not exists actualizaciones_respaldo_unico on actualizaciones (referencia)
  where tipo = 'respaldo_bq' and resultado = 'ok';
alter table actualizaciones enable row level security;

insert into migraciones (version) values ('006_actualizaciones') on conflict do nothing;
