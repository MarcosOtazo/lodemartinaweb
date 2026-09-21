-- ============================================================
-- LO DE MARTINA - Actualizacion: unidades (gr/kg, ml/litro),
-- sub-recetas y productos con recetas + insumos directos
-- Ejecutar en Supabase: SQL Editor -> New query -> pegar -> Run
-- ============================================================

-- Limpieza de la version anterior
drop table if exists public.receta_ingredientes cascade;
drop table if exists public.receta_subrecetas cascade;
drop table if exists public.producto_recetas cascade;
drop table if exists public.producto_insumos cascade;
alter table public.products drop column if exists receta_id;

-- ---------- INGREDIENTES DE RECETA (con unidad) ----------
create table public.receta_ingredientes (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references public.recetas(id) on delete cascade,
  insumo_id uuid not null references public.insumos(id) on delete cascade,
  quantity numeric(10,3) not null default 0 check (quantity > 0),
  unit text not null default 'unidad',
  created_at timestamptz not null default now()
);

alter table public.receta_ingredientes enable row level security;

create policy "Solo admin puede ver ingredientes de recetas"
  on public.receta_ingredientes for select using (public.is_admin());

create policy "Solo admin puede modificar ingredientes de recetas"
  on public.receta_ingredientes for all using (public.is_admin())
  with check (public.is_admin());

-- ---------- SUB-RECETAS (receta dentro de receta) ----------
create table public.receta_subrecetas (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references public.recetas(id) on delete cascade,
  subreceta_id uuid not null references public.recetas(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.receta_subrecetas enable row level security;

create policy "Solo admin puede ver sub-recetas"
  on public.receta_subrecetas for select using (public.is_admin());

create policy "Solo admin puede modificar sub-recetas"
  on public.receta_subrecetas for all using (public.is_admin())
  with check (public.is_admin());

-- ---------- PRODUCTO -> RECETAS (puede tener varias) ----------
create table public.producto_recetas (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  receta_id uuid not null references public.recetas(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.producto_recetas enable row level security;

create policy "Solo admin puede ver recetas de productos"
  on public.producto_recetas for select using (public.is_admin());

create policy "Solo admin puede modificar recetas de productos"
  on public.producto_recetas for all using (public.is_admin())
  with check (public.is_admin());

-- ---------- PRODUCTO -> INSUMOS DIRECTOS (con unidad) ----------
create table public.producto_insumos (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  insumo_id uuid not null references public.insumos(id) on delete cascade,
  quantity numeric(10,3) not null default 0 check (quantity > 0),
  unit text not null default 'unidad',
  created_at timestamptz not null default now()
);

alter table public.producto_insumos enable row level security;

create policy "Solo admin puede ver insumos de productos"
  on public.producto_insumos for select using (public.is_admin());

create policy "Solo admin puede modificar insumos de productos"
  on public.producto_insumos for all using (public.is_admin())
  with check (public.is_admin());
