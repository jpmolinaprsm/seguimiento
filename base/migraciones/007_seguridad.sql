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
