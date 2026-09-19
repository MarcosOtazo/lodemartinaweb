-- ============================================================
-- LO DE MARTINA - Actualizacion: direccion del local
-- Ejecutar en Supabase: SQL Editor -> New query -> pegar -> Run
-- ============================================================

alter table public.site_config add column if not exists address text;
