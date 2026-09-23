-- ============================================================
-- LO DE MARTINA - Actualizacion: insumos en variantes
-- Cada variante (opcion de producto) puede tener insumos
-- para que su costo tambien se calcule en los pedidos.
-- Ejecutar en Supabase: SQL Editor -> New query -> pegar -> Run
-- ============================================================

drop table if exists public.option_item_insumos cascade;

create table public.option_item_insumos (
  id uuid primary key default gen_random_uuid(),
  option_item_id uuid not null references public.option_items(id) on delete cascade,
  insumo_id uuid not null references public.insumos(id) on delete cascade,
  quantity numeric(10,3) not null default 0 check (quantity > 0),
  unit text not null default 'unidad',
  created_at timestamptz not null default now()
);

alter table public.option_item_insumos enable row level security;

create policy "Solo admin puede ver insumos de variantes"
  on public.option_item_insumos for select using (public.is_admin());

create policy "Solo admin puede modificar insumos de variantes"
  on public.option_item_insumos for all using (public.is_admin())
  with check (public.is_admin());
