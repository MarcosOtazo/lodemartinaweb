-- ============================================================
-- LO DE MARTINA - Actualizacion: insumos y recetas (costos)
-- Ejecutar en Supabase: SQL Editor -> New query -> pegar -> Run
-- ============================================================

-- ---------- LIMPIEZA (las tablas se borran con sus politicas) ----------
drop table if exists public.insumos cascade;
drop table if exists public.receta_ingredientes cascade;

-- ---------- INSUMOS ----------
create table public.insumos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'unidad',
  cost numeric(10,2) not null default 0 check (cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.insumos enable row level security;

create policy "Solo admin puede ver insumos"
  on public.insumos for select using (public.is_admin());

create policy "Solo admin puede modificar insumos"
  on public.insumos for all using (public.is_admin())
  with check (public.is_admin());

-- ---------- RECETAS (insumos por producto) ----------
create table public.receta_ingredientes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  insumo_id uuid not null references public.insumos(id) on delete cascade,
  quantity numeric(10,3) not null default 0 check (quantity > 0),
  created_at timestamptz not null default now()
);

alter table public.receta_ingredientes enable row level security;

create policy "Solo admin puede ver recetas"
  on public.receta_ingredientes for select using (public.is_admin());

create policy "Solo admin puede modificar recetas"
  on public.receta_ingredientes for all using (public.is_admin())
  with check (public.is_admin());
