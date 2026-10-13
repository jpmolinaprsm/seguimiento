-- ===== migraciones/001_base.sql =====
-- Seguimiento y Optimización · migración 001: piezas comunes (2/10/2026).
-- Base Supabase PROPIA de Seguimiento (decisión D3 del plan de Railway). No es la base de PAUTADOR.
-- Correr en el SQL Editor del proyecto de Seguimiento, en orden (ver base/LEEME.md). Se puede volver a correr sin romper nada.
--
-- Seguridad (vale para todas las migraciones):
--   * Solo el servidor de Seguimiento habla con la base, con la clave de servicio (SUPABASE_SERVICE_ROLE_KEY, variable de Railway).
--   * El navegador NUNCA habla directo con la base: no se usa la clave pública (anon) en ningún lado.
--   * Todas las tablas tienen RLS activado y NINGUNA política: con la clave pública o con un usuario de Supabase no se lee ni se
--     escribe nada. La clave de servicio saltea RLS (así funciona Supabase), por eso es la única que sirve.
--   * Además se les quitan los permisos a los roles anon y authenticated, por si alguien crea una política por error.

-- Registro de qué migraciones se aplicaron.
create table if not exists migraciones (
  version   text primary key,
  aplicada  timestamptz not null default now()
);
alter table migraciones enable row level security;

-- Tablas que solo se agregan (historiales): no se pueden cambiar ni borrar filas, ni vaciar la tabla. Vale también para la clave
-- de servicio, porque es un trigger y no una política. Para corregir algo se agrega una fila nueva.
create or replace function solo_agregar() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception 'La tabla % solo admite agregar filas (% no permitido)', tg_table_name, tg_op;
end;
$$;

-- Los roles públicos de Supabase no tocan nada de lo que se cree en este esquema, ni ahora ni después.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, public;

insert into migraciones (version) values ('001_base') on conflict do nothing;

-- ===== migraciones/002_recomendaciones.sql =====
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

-- ===== migraciones/003_comentarios_tipos_looker.sql =====
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

-- ===== migraciones/004_lectura_temprana.sql =====
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

-- ===== migraciones/005_nexo_solicitudes.sql =====
-- Seguimiento y Optimización · migración 005: solicitudes del nexo con PAUTADOR y su estado.
-- Reemplaza app/repositorio/nexo/solicitudes.jsonl (lo escribe nexo/repositorio.js: una línea "solicitud" por id y una línea
-- "estado" por cada cambio de estado). La forma de la solicitud es la de nexo/solicitud.js (version 1) y los estados los de
-- nexo/cliente.js y nexo/simulador.js. El dueño del nexo es el agente Nexo con PAUTADOR: esta tabla solo copia su formato.

-- 1. Solicitudes. El id es único: si se reintenta, mismo id y no se duplica (PLAN-RAILWAY, sección 6). SOLO SE AGREGA.
--    La solicitud entera va en "solicitud" (jsonb); las columnas de al lado son para filtrar por proyecto y canal sin abrirla.
create table if not exists nexo_solicitudes (
  id                text        primary key,
  guardado          timestamptz not null default now(),
  creada            timestamptz,
  version           integer,
  recomendacion_id  text,
  regla             text,
  proyecto          text        not null,
  canal             text        not null,
  plataforma        text,
  accion            text,                          -- Pausar | Cambiar presupuesto
  pedida_por        text,                          -- mail del implementador que la pidió (viaja a PAUTADOR: hace falta)
  solicitud         jsonb       not null
);
create index if not exists nexo_sol_proyecto_idx on nexo_solicitudes (proyecto, canal, creada desc);
create index if not exists nexo_sol_rec_idx      on nexo_solicitudes (recomendacion_id);
alter table nexo_solicitudes enable row level security;

drop trigger if exists nexo_sol_solo_agregar on nexo_solicitudes;
create trigger nexo_sol_solo_agregar before update or delete on nexo_solicitudes for each row execute function solo_agregar();
drop trigger if exists nexo_sol_no_vaciar on nexo_solicitudes;
create trigger nexo_sol_no_vaciar before truncate on nexo_solicitudes for each statement execute function solo_agregar();

-- 2. Estados de cada solicitud, del más viejo al más nuevo. SOLO SE AGREGA.
--    Recorrido: por_enviar → (sin_respuesta →) recibida → rechazada_validacion | aplicada | fallo. no_enviada = sin permiso.
--    pendiente_aprobacion y rechazada_persona hoy no se usan (el pedido del implementador ya es la aprobación), pero se aceptan.
--    Si el Nexo suma un estado nuevo, hay que agregarlo acá con una migración (si no, la base lo rechaza y se nota enseguida).
create table if not exists nexo_estados (
  id            bigserial   primary key,
  guardado      timestamptz not null default now(),
  solicitud_id  text        not null references nexo_solicitudes (id),
  estado        text        not null check (estado in ('por_enviar', 'sin_respuesta', 'recibida', 'rechazada_validacion', 'aplicada',
                                                       'fallo', 'no_enviada', 'pendiente_aprobacion', 'rechazada_persona')),
  detalle       jsonb       not null default '{}'::jsonb   -- el resto del estado tal cual: motivo, error, valores, aprobada_por, modo...
);
create index if not exists nexo_est_sol_idx on nexo_estados (solicitud_id, id);
alter table nexo_estados enable row level security;

drop trigger if exists nexo_est_solo_agregar on nexo_estados;
create trigger nexo_est_solo_agregar before update or delete on nexo_estados for each row execute function solo_agregar();
drop trigger if exists nexo_est_no_vaciar on nexo_estados;
create trigger nexo_est_no_vaciar before truncate on nexo_estados for each statement execute function solo_agregar();

-- 3. Último estado de cada solicitud (para el control "un cambio por conjunto cada 3 días" y para mostrar el estado).
--    security_invoker: la vista respeta los permisos de quien la lee (nadie salvo el servidor).
create or replace view nexo_ultimo_estado with (security_invoker = true) as
  select distinct on (e.solicitud_id) e.solicitud_id, e.estado, e.detalle, e.guardado
    from nexo_estados e
   order by e.solicitud_id, e.id desc;
revoke all on nexo_ultimo_estado from anon, authenticated;

insert into migraciones (version) values ('005_nexo_solicitudes') on conflict do nothing;

-- ===== migraciones/006_actualizaciones.sql =====
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

-- ===== migraciones/007_seguridad.sql =====
-- Seguimiento y Optimización · migración 007: cierre de seguridad. Se corre al final y se puede volver a correr cuando se sume
-- una tabla. Activa RLS en TODAS las tablas del esquema public (por si alguna quedó sin) y vuelve a quitar los permisos públicos.
-- No crea ninguna política a propósito: sin política, solo la clave de servicio (el servidor) lee y escribe.
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end;
$$;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;

insert into migraciones (version) values ('007_seguridad') on conflict do nothing;

-- Que la API (PostgREST) vuelva a leer el esquema: sin esto puede no ver las tablas nuevas (pasó el 2/10 en la base de prueba).
notify pgrst, 'reload schema';

-- Control (tiene que devolver CERO filas): tablas sin RLS o con alguna política.
select c.relname as tabla, c.relrowsecurity as rls_activo, count(p.polname) as politicas
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  left join pg_policy p on p.polrelid = c.oid
 where c.relkind = 'r'
 group by c.relname, c.relrowsecurity
having not c.relrowsecurity or count(p.polname) > 0;

