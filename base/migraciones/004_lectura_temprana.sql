-- Seguimiento y Optimización · migración 004: lectura temprana al día 5 (EN OBSERVACIÓN: no genera recomendaciones).
-- Reemplaza app/repositorio/lectura-temprana/predicciones.jsonl y resumen.json (los escribe borrador/lectura-temprana.js).
-- Sin mails: no hay personas en estas tablas.
-- Ojo: acá el proyecto viene como "cliente" ("Gobierno de Córdoba"), no con el nombre corto de la app ("Córdoba"), igual que hoy.

-- 1. Predicciones. SOLO SE AGREGA (hoy el archivo tampoco se reescribe: las viejas quedan como se anotaron).
create table if not exists lectura_temprana_predicciones (
  id                    text        primary key,      -- "lt-..." (canal|cliente|campaña|código|desde)
  registrado            timestamptz not null,
  datos_al              date        not null,
  dia5                  date        not null,
  canal                 text        not null,
  cliente               text        not null,
  campana               text,
  cod                   text,
  contenido             text,
  objetivo              text,
  formato               text,
  desde                 date,
  metrica               text,
  valor_dia5            numeric,
  gasto_dia5            numeric,
  impresiones_dia5      bigint,
  percentil_dia5        numeric,
  cuartil_dia5          text,                          -- peor | medio | mejor
  comparables           integer,
  referencia            text,
  cuenta_para_registro  boolean,                       -- null en las anotadas antes del 1/10 (se recalcula con gasto e impresiones)
  extra                 jsonb       not null default '{}'::jsonb   -- campos que se sumen más adelante, sin migración
);
create index if not exists lt_pred_cliente_idx on lectura_temprana_predicciones (cliente, canal, dia5 desc);
alter table lectura_temprana_predicciones enable row level security;

drop trigger if exists lt_pred_solo_agregar on lectura_temprana_predicciones;
create trigger lt_pred_solo_agregar before update or delete on lectura_temprana_predicciones for each row execute function solo_agregar();
drop trigger if exists lt_pred_no_vaciar on lectura_temprana_predicciones;
create trigger lt_pred_no_vaciar before truncate on lectura_temprana_predicciones for each statement execute function solo_agregar();

-- 2. Resumen de cada corrida (hoy resumen.json se pisa; acá queda uno por corrida y se lee el último). Pesa pocos KB.
create table if not exists lectura_temprana_resumenes (
  id        bigserial   primary key,
  generado  timestamptz not null,
  datos_al  date        not null,
  resumen   jsonb       not null
);
create index if not exists lt_res_generado_idx on lectura_temprana_resumenes (generado desc);
alter table lectura_temprana_resumenes enable row level security;

drop trigger if exists lt_res_solo_agregar on lectura_temprana_resumenes;
create trigger lt_res_solo_agregar before update or delete on lectura_temprana_resumenes for each row execute function solo_agregar();

insert into migraciones (version) values ('004_lectura_temprana') on conflict do nothing;
