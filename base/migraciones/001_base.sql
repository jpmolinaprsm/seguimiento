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
