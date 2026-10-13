-- Seguimiento y Optimización · migración 002: recomendaciones del día, respuestas del equipo y estado de cada recomendación.
-- Reemplaza app/repositorio/recomendaciones/AAAA-MM-DD.jsonl (lo escribe app/redaccion.js) y app/repositorio/respuestas.jsonl
-- (lo escribe app/servir.js, /api/respuesta, líneas con clase "recomendacion").
--
-- Nombres: proyecto = nombre del proyecto como lo usa la app ("Santa Fe"); canal = "Oficial" o "Informativo".
-- Autor: el mail de la sesión (viene del login con Google, no lo escribe la persona), en minúsculas. Ver base/LEEME.md, "Mails".

-- 1. Recomendaciones generadas por día. Cada actualización diaria reemplaza las del día (hoy el archivo del día se reescribe).
create table if not exists recomendaciones (
  datos_al        date        not null,           -- día de los datos con que se generó
  proyecto        text        not null,
  canal           text        not null,
  id              text        not null,           -- id de la recomendación (el mismo que usa la app y las respuestas)
  generado        timestamptz not null,
  tipo            text        not null,           -- "Rinde por debajo", "Se desgastó", ...
  titulo          text,
  problema        text,
  solucion        text,
  campana         text,
  contenidos      jsonb       not null default '[]'::jsonb,
  conjuntos       jsonb       not null default '[]'::jsonb,
  revisar         jsonb       not null default '[]'::jsonb,
  regla           text,
  fuente          text,
  plata_en_juego  text,
  via             text,                           -- auto | manual | blocked (como la app)
  primary key (datos_al, proyecto, canal, id)
);
create index if not exists recomendaciones_proyecto_idx on recomendaciones (proyecto, canal, datos_al desc);
create index if not exists recomendaciones_id_idx       on recomendaciones (id);
alter table recomendaciones enable row level security;

-- 2. Respuestas del equipo: una fila por cada cambio sobre una recomendación. SOLO SE AGREGA (es el historial).
--    "hecha a mano" y "descartada" llevan motivo siempre (decisión del 30/9). La lista de motivos no se fija acá: la de "hecha a mano"
--    todavía la decide Juan Pablo; la base solo exige que no venga vacío.
create table if not exists respuestas (
  id                bigserial   primary key,
  recibido          timestamptz not null default now(),
  proyecto          text        not null,
  canal             text        not null,
  recomendacion_id  text        not null,
  datos_al          date,                         -- día de los datos que estaba mirando la persona
  decision          text        not null check (decision in ('pendiente', 'enviada a PAUTADOR', 'hecha a mano', 'descartada')),
  motivo            text,
  sirve             text,                         -- "Sí" | "No" | "Falta un dato" (el ¿sirve? de la tarjeta), o vacío
  comentario        text,                         -- comentario de la tarjeta en ese momento (también va a comentarios, ver trigger)
  tipo              text,                         -- copia de cómo era la tarjeta cuando se respondió
  titulo            text,
  campana           text,
  solucion          text,
  autor             text        not null,         -- mail de la sesión, en minúsculas
  autor_nombre      text,                         -- nombre que devuelve PAUTADOR (consulta de accesos)
  origen            text        not null default 'app' check (origen in ('app', 'carga_inicial')),
  constraint respuestas_motivo_obligatorio check (
    decision not in ('hecha a mano', 'descartada') or (motivo is not null and length(btrim(motivo)) > 0)),
  constraint respuestas_autor_mail check (
    origen = 'carga_inicial' or (autor = lower(autor) and autor ~ '^[^@[:space:]]+@[^@[:space:]]+$'))
);
create index if not exists respuestas_proyecto_idx on respuestas (proyecto, canal, recibido desc);
create index if not exists respuestas_rec_idx      on respuestas (recomendacion_id, recibido desc);
alter table respuestas enable row level security;

drop trigger if exists respuestas_solo_agregar on respuestas;
create trigger respuestas_solo_agregar before update or delete on respuestas for each row execute function solo_agregar();
drop trigger if exists respuestas_no_vaciar on respuestas;
create trigger respuestas_no_vaciar before truncate on respuestas for each statement execute function solo_agregar();

-- 3. Estado actual de cada recomendación (lo último que se respondió). Lo mantiene el trigger de abajo: el código no lo escribe.
create table if not exists recomendacion_estado (
  proyecto          text        not null,
  canal             text        not null,
  recomendacion_id  text        not null,
  decision          text        not null,
  motivo            text,
  sirve             text,
  comentario        text,
  autor             text        not null,
  autor_nombre      text,
  actualizado       timestamptz not null,
  respuesta_id      bigint      not null references respuestas (id),
  primary key (proyecto, canal, recomendacion_id)
);
alter table recomendacion_estado enable row level security;

-- Al agregar una respuesta: se actualiza el estado actual y, si el comentario de la tarjeta cambió, queda también como comentario
-- (con autor y fecha) en la tabla comentarios (migración 003). Corre con los permisos de quien inserta (el servidor).
create or replace function respuestas_al_agregar() returns trigger
language plpgsql set search_path = public as $$
declare
  comentario_previo text;
begin
  select comentario into comentario_previo from recomendacion_estado
   where proyecto = new.proyecto and canal = new.canal and recomendacion_id = new.recomendacion_id;

  insert into recomendacion_estado as e (proyecto, canal, recomendacion_id, decision, motivo, sirve, comentario, autor, autor_nombre, actualizado, respuesta_id)
  values (new.proyecto, new.canal, new.recomendacion_id, new.decision, new.motivo, new.sirve, new.comentario, new.autor, new.autor_nombre, new.recibido, new.id)
  on conflict (proyecto, canal, recomendacion_id) do update
     set decision = excluded.decision, motivo = excluded.motivo, sirve = excluded.sirve, comentario = excluded.comentario,
         autor = excluded.autor, autor_nombre = excluded.autor_nombre, actualizado = excluded.actualizado, respuesta_id = excluded.respuesta_id
   where e.actualizado <= excluded.actualizado;   -- si llega una vieja (carga inicial desordenada), no pisa a una más nueva

  if new.comentario is not null and length(btrim(new.comentario)) > 0
     and new.comentario is distinct from comentario_previo
     and to_regclass('public.comentarios') is not null then
    insert into comentarios (objeto, referencia, proyecto, canal, texto, autor, autor_nombre, origen, creado)
    values ('recomendacion', new.recomendacion_id, new.proyecto, new.canal, new.comentario, new.autor, new.autor_nombre, new.origen, new.recibido);
  end if;
  return null;
end;
$$;
drop trigger if exists respuestas_estado on respuestas;
create trigger respuestas_estado after insert on respuestas for each row execute function respuestas_al_agregar();

insert into migraciones (version) values ('002_recomendaciones') on conflict do nothing;
