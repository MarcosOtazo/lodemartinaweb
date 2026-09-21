-- ============================================================
-- LO DE MARTINA - Actualizacion: categorias de insumos y
-- precio por bulto (ej: 100 unidades a $X)
-- Ejecutar en Supabase: SQL Editor -> New query -> pegar -> Run
-- ============================================================

alter table public.insumos
  add column if not exists category text not null default 'Otros';

alter table public.insumos
  add column if not exists quantity numeric(10,3) not null default 1 check (quantity > 0);
