-- Seguimiento y Optimización · migración 003: comentarios, tipos de campaña y links de Looker.
-- Hoy viven en el navegador de cada persona (syo.comments, syo.tipos / syo.seasonal, syo.looker) y, en parte, en respuestas.jsonl
-- (líneas con clase "regla" y "tipo_campana"). Desde Railway son COMPARTIDOS POR PROYECTO, con autor y fecha (decisión D5-B):
-- lo que marca o comenta un implementador lo ven todos los de ese proyecto, y queda quién lo cambió.

-- 1. Comentarios. SOLO SE AGREGA: editar un comentario es agregar uno nuevo; borrar el de una pantalla es agregar uno con texto vacío
--    (null). Así siempre queda quién escribió qué y cuándo.
--    objeto:
--      recomendacion  referencia = id de la recomendación (lo carga solo el trigger de respuestas, migración 002)
--      regla          referencia = id de la regla vigente (C1, C3, ...). Puede no tener proyecto: las reglas valen para todos
--      pantalla       referencia = la pantalla ("Santa Fe · Oficial · Campañas"), como hoy syo.comments
create table if not exists comentarios (
  id            bigserial   primary key,
  creado        timestamptz not null default now(),
  objeto        text        not null check (objeto in ('recomendacion', 'regla', 'pantalla')),
  referencia    text        not null,
  proyecto      text,
  canal         text,
  texto         text,
  autor         text        not null,
  autor_nombre  text,
  origen        text        not null default 'app' check (origen in ('app', 'carga_inicial')),
  constraint comentarios_proyecto check (objeto = 'regla' or proyecto is not null),
  constraint comentarios_texto check (
    (texto is not null and length(btrim(texto)) > 0) or (texto is null and objeto = 'pantalla')),
  constraint comentarios_autor_mail check (
    origen = 'carga_inicial' or (autor = lower(autor) and autor ~ '^[^@[:space:]]+@[^@[:space:]]+$'))
);
create index if not exists comentarios_proyecto_idx   on comentarios (proyecto, canal, objeto, referencia, creado desc);
create index if not exists comentarios_referencia_idx on comentarios (objeto, referencia, creado desc);
alter table comentarios enable row level security;

drop trigger if exists comentarios_solo_agregar on comentarios;
create trigger comentarios_solo_agregar before update or delete on comentarios for each row execute function solo_agregar();
drop trigger if exists comentarios_no_vaciar on comentarios;
create trigger comentarios_no_vaciar before truncate on comentarios for each statement execute function solo_agregar();

-- 2. Tipos de campaña: cada cambio (SOLO SE AGREGA) y el tipo actual (lo mantiene el trigger).
--    tipo: lo que manda hoy la app. "ninguna" se manda como "larga" o "puntual" según la duración; se acepta igual "ninguna".
create table if not exists tipos_campana_cambios (
  id            bigserial   primary key,
  cambiado      timestamptz not null default now(),
  proyecto      text        not null,
  canal         text        not null,
  campana       text        not null,
  tipo          text        not null check (tipo in ('constante', 'estacional', 'larga', 'puntual', 'ninguna')),
  sugerido      text,                             -- lo que sugerían los datos en ese momento
  autor         text        not null,
  autor_nombre  text,
  origen        text        not null default 'app' check (origen in ('app', 'carga_inicial')),
  constraint tipos_autor_mail check (
    origen = 'carga_inicial' or (autor = lower(autor) and autor ~ '^[^@[:space:]]+@[^@[:space:]]+$'))
);
create index if not exists tipos_cambios_idx on tipos_campana_cambios (proyecto, canal, campana, cambiado desc);
alter table tipos_campana_cambios enable row level security;

drop trigger if exists tipos_cambios_solo_agregar on tipos_campana_cambios;
create trigger tipos_cambios_solo_agregar before update or delete on tipos_campana_cambios for each row execute function solo_agregar();
drop trigger if exists tipos_cambios_no_vaciar on tipos_campana_cambios;
create trigger tipos_cambios_no_vaciar before truncate on tipos_campana_cambios for each statement execute function solo_agregar();

create table if not exists tipos_campana (
  proyecto      text        not null,
  canal         text        not null,
  campana       text        not null,
  tipo          text        not null,
  sugerido      text,
  autor         text        not null,             -- quién lo cambió por última vez
  autor_nombre  text,
  cambiado      timestamptz not null,
  cambio_id     bigint      not null references tipos_campana_cambios (id),
  primary key (proyecto, canal, campana)
);
alter table tipos_campana enable row level security;

create or replace function tipos_campana_al_agregar() returns trigger
language plpgsql set search_path = public as $$
begin
  insert into tipos_campana as t (proyecto, canal, campana, tipo, sugerido, autor, autor_nombre, cambiado, cambio_id)
  values (new.proyecto, new.canal, new.campana, new.tipo, new.sugerido, new.autor, new.autor_nombre, new.cambiado, new.id)
  on conflict (proyecto, canal, campana) do update
     set tipo = excluded.tipo, sugerido = excluded.sugerido, autor = excluded.autor, autor_nombre = excluded.autor_nombre,
         cambiado = excluded.cambiado, cambio_id = excluded.cambio_id
   where t.cambiado <= excluded.cambiado;
  return null;
end;
$$;
drop trigger if exists tipos_campana_actual on tipos_campana_cambios;
create trigger tipos_campana_actual after insert on tipos_campana_cambios for each row execute function tipos_campana_al_agregar();

-- 3. Links de Looker Studio por proyecto y canal (hoy syo.looker en el navegador y la lista fija de borrador/armar.js).
--    Se guarda el link de inserción ya limpio (lo limpia lookerSrcDe en la app). Queda quién lo cargó por última vez.
create table if not exists looker_links (
  proyecto      text        not null,
  canal         text        not null,
  url           text        not null check (url ~ '^https://lookerstudio\.google\.com/'),
  autor         text        not null,
  autor_nombre  text,
  actualizado   timestamptz not null default now(),
  origen        text        not null default 'app' check (origen in ('app', 'carga_inicial')),
  primary key (proyecto, canal)
);
alter table looker_links enable row level security;

insert into migraciones (version) values ('003_comentarios_tipos_looker') on conflict do nothing;
