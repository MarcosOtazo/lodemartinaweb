-- ============================================================
-- LO DE MARTINA - Actualizacion: recetas como entidad propia
-- Creas recetas (nombre + insumos) y despues se las asignas
-- a cada producto. Reemplaza la version anterior (por producto).
-- Ejecutar en Supabase: SQL Editor -> New query -> pegar -> Run
-- ============================================================

-- Limpieza (la version anterior vinculaba ingredientes a productos)
drop table if exists public.receta_ingredientes cascade;
drop table if exists public.recetas cascade;
alter table public.products drop column if exists receta_id;

-- ---------- RECETAS ----------
create table public.recetas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recetas enable row level security;

create policy "Solo admin puede ver recetas"
  on public.recetas for select using (public.is_admin());

create policy "Solo admin puede modificar recetas"
  on public.recetas for all using (public.is_admin())
  with check (public.is_admin());

-- ---------- INGREDIENTES DE CADA RECETA ----------
create table public.receta_ingredientes (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references public.recetas(id) on delete cascade,
  insumo_id uuid not null references public.insumos(id) on delete cascade,
  quantity numeric(10,3) not null default 0 check (quantity > 0),
  created_at timestamptz not null default now()
);

alter table public.receta_ingredientes enable row level security;

create policy "Solo admin puede ver ingredientes de recetas"
  on public.receta_ingredientes for select using (public.is_admin());

create policy "Solo admin puede modificar ingredientes de recetas"
  on public.receta_ingredientes for all using (public.is_admin())
  with check (public.is_admin());

-- ---------- PRODUCTOS: asignar receta ----------
alter table public.products
  add column if not exists receta_id uuid references public.recetas(id) on delete set null;
