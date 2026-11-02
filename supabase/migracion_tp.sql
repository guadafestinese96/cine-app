-- =====================================================================
-- CineWidi 
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tablas existentes: columnas nuevas
-- ---------------------------------------------------------------------

-- Usuarios: rol, puntos de fidelidad y crédito en cuenta
alter table public.usuarios add column if not exists rol text not null default 'cliente';
alter table public.usuarios add column if not exists puntos integer not null default 0;
alter table public.usuarios add column if not exists credito numeric(12,2) not null default 0;
alter table public.usuarios add column if not exists created_at timestamptz not null default now();

-- Películas: visibilidad, preventa configurable por película
alter table public.peliculas add column if not exists activa boolean default true;
alter table public.peliculas add column if not exists fecha_estreno date;
alter table public.peliculas add column if not exists preventa_activa boolean not null default false;
alter table public.peliculas add column if not exists precio_preventa numeric(12,2);

-- Salas: activas y butacas fuera de servicio (ej. ["A1","T28"])
alter table public.salas add column if not exists activa boolean not null default true;
alter table public.salas add column if not exists butacas_bloqueadas jsonb not null default '[]'::jsonb;

-- Funciones: precio propio y estado
alter table public.funciones add column if not exists precio_base numeric(12,2);
alter table public.funciones add column if not exists activa boolean not null default true;
alter table public.funciones add column if not exists created_at timestamptz not null default now();

-- Candy bar
alter table public.candy_bar add column if not exists activo boolean default true;
alter table public.candy_bar add column if not exists es_combo boolean default false;

-- Butacas ocupadas: reserva temporal (10 min) vs. vendida.
-- Las filas que ya existían quedan como 'vendida'; las nuevas arrancan como 'reservada'.
alter table public.butacas_ocupadas add column if not exists estado text default 'vendida';
alter table public.butacas_ocupadas alter column estado set default 'reservada';
alter table public.butacas_ocupadas add column if not exists expira_en timestamptz;
alter table public.butacas_ocupadas add column if not exists compra_id text;
alter table public.butacas_ocupadas add column if not exists created_at timestamptz not null default now();

-- Una butaca no puede estar dos veces en la misma función (evita la doble venta)
do $$ begin
  create unique index if not exists butacas_ocupadas_unica
    on public.butacas_ocupadas (funcion_id, fila, numero);
exception when others then
  raise notice 'No se pudo crear el índice único (hay duplicados previos): %', sqlerrm;
end $$;

-- Alertas de estreno
alter table public.alertas_estreno add column if not exists notificado boolean not null default false;
alter table public.alertas_estreno add column if not exists created_at timestamptz not null default now();
do $$ begin
  create unique index if not exists alertas_estreno_unica
    on public.alertas_estreno (pelicula_id, email_usuario);
exception when others then
  raise notice 'No se pudo crear el índice único de alertas: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- 2. Tablas nuevas
-- ---------------------------------------------------------------------

create table if not exists public.configuracion (
  clave text primary key,
  valor jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.configuracion (clave, valor) values
  ('precio_entrada', '5000'),
  ('recargo_vip_pct', '30'),
  ('minutos_reserva', '10')
on conflict (clave) do nothing;

create table if not exists public.compras (
  id bigint generated always as identity primary key,
  codigo text not null unique,                 -- lo que contiene el QR
  usuario_id uuid,                             -- null = compra anónima
  email text,
  nombre text,
  funcion_id bigint not null references public.funciones(id),
  pelicula_id bigint,
  butacas jsonb not null default '[]'::jsonb,  -- [{fila, numero, tipo, precio}]
  productos jsonb not null default '[]'::jsonb,-- [{id, nombre, cantidad, precio}]
  combos jsonb not null default '[]'::jsonb,   -- [{id, nombre, cantidad, precio, incluye}]
  cantidad_entradas integer not null default 0,
  subtotal numeric(12,2) not null default 0,
  descuento numeric(12,2) not null default 0,
  cupon_codigo text,
  canje_codigo text,
  credito_usado numeric(12,2) not null default 0,
  total_pagado numeric(12,2) not null default 0,
  metodo_pago text,
  puntos_ganados integer not null default 0,
  estado text not null default 'pagada',       -- pagada | cancelada
  entrada_validada_at timestamptz,
  candy_entregado_at timestamptz,
  cancelada_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists compras_usuario_idx on public.compras (usuario_id);
create index if not exists compras_fecha_idx on public.compras (created_at);

create table if not exists public.resenas (
  id bigint generated always as identity primary key,
  pelicula_id bigint not null,
  usuario_id uuid not null,
  autor text not null,
  estrellas integer not null check (estrellas between 1 and 5),
  comentario text check (char_length(comentario) <= 280),
  created_at timestamptz not null default now(),
  unique (pelicula_id, usuario_id)
);

create table if not exists public.cupones (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  descripcion text,
  porcentaje numeric(5,2) not null check (porcentaje > 0 and porcentaje <= 100),
  tipo text not null default 'general',        -- bienvenida | mayores_50 | general
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.cupones (codigo, descripcion, porcentaje, tipo) values
  ('BIENVENIDA', 'Descuento automático en la primera compra de usuarios registrados', 20, 'bienvenida'),
  ('MAYOR50', 'Descuento para usuarios de más de 50 años', 25, 'mayores_50')
on conflict (codigo) do nothing;

create table if not exists public.combos (
  id bigint generated always as identity primary key,
  nombre text not null,
  descripcion text,
  incluye text,                                -- "Entrada + Pochoclo grande + Gaseosa"
  precio numeric(12,2) not null,
  imagen_url text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.recompensas (
  id bigint generated always as identity primary key,
  nombre text not null,
  tipo text not null default 'producto',       -- entrada | producto
  puntos integer not null check (puntos > 0),
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.recompensas (nombre, tipo, puntos)
select * from (values ('Entrada 2D gratis', 'entrada', 500), ('Pochoclo grande', 'producto', 150)) v(nombre, tipo, puntos)
where not exists (select 1 from public.recompensas);

create table if not exists public.canjes (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  usuario_id uuid not null,
  recompensa_id bigint,
  nombre text not null,
  tipo text not null,
  puntos integer not null,
  usado boolean not null default false,
  usado_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.logs_actividad (
  id bigint generated always as identity primary key,
  usuario_email text,
  accion text not null,
  detalle text,
  created_at timestamptz not null default now()
);
create index if not exists logs_fecha_idx on public.logs_actividad (created_at desc);

-- Salas de ejemplo si no hay ninguna
insert into public.salas (nombre)
select 'Sala ' || n from generate_series(1, 4) n
where not exists (select 1 from public.salas);

-- ---------------------------------------------------------------------
-- 3. Funciones atómicas (se llaman con supabase.rpc)
-- ---------------------------------------------------------------------

-- Suma/resta puntos y crédito sin dejar saldos negativos
create or replace function public.ajustar_saldo(p_usuario uuid, p_puntos integer, p_credito numeric)
returns table (puntos integer, credito numeric)
language sql security definer set search_path = public as $$
  update public.usuarios u
     set puntos  = greatest(0, u.puntos + coalesce(p_puntos, 0)),
         credito = greatest(0, u.credito + coalesce(p_credito, 0))
   where u.id = p_usuario
  returning u.puntos, u.credito;
$$;

-- Canjea una recompensa: descuenta puntos solo si alcanzan y genera el código
create or replace function public.canjear_recompensa(p_usuario uuid, p_recompensa bigint)
returns text
language plpgsql security definer set search_path = public as $$
declare
  r public.recompensas%rowtype;
  v_codigo text;
begin
  select * into r from public.recompensas where id = p_recompensa and activa;
  if not found then raise exception 'La recompensa no existe o no está activa'; end if;

  update public.usuarios set puntos = puntos - r.puntos
   where id = p_usuario and puntos >= r.puntos;
  if not found then raise exception 'No tenés puntos suficientes'; end if;

  v_codigo := 'CANJE-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into public.canjes (codigo, usuario_id, recompensa_id, nombre, tipo, puntos)
  values (v_codigo, p_usuario, r.id, r.nombre, r.tipo, r.puntos);
  return v_codigo;
end $$;

grant execute on function public.ajustar_saldo(uuid, integer, numeric) to anon, authenticated;
grant execute on function public.canjear_recompensa(uuid, bigint) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Seguridad (RLS)
-- Para el TP toda la lógica corre en el cliente con la clave pública,
-- así que las políticas son abiertas. En producción real se restringirían
-- por rol usando auth.uid().
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['usuarios','peliculas','salas','funciones','candy_bar','butacas_ocupadas',
                           'alertas_estreno','configuracion','compras','resenas','cupones','combos',
                           'recompensas','canjes','logs_actividad']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "tp_acceso_total" on public.%I', t);
    execute format('create policy "tp_acceso_total" on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. Realtime para el mapa de butacas
-- ---------------------------------------------------------------------
alter table public.butacas_ocupadas replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.butacas_ocupadas;
exception when duplicate_object then null;
          when others then raise notice 'Realtime: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- 6. Usuarios de prueba (opcional)
-- Registrate desde la app y después asignale el rol acá:
--   update public.usuarios set rol = 'admin'    where email = 'admin@cineapp.com';
--   update public.usuarios set rol = 'empleado' where email = 'empleado@cineapp.com';
-- También se puede cambiar el rol desde Admin → Usuarios.
-- ---------------------------------------------------------------------
