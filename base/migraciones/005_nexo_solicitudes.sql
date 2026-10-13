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
