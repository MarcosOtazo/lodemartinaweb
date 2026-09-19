-- ============================================================
-- LO DE MARTINA - Actualizacion: imagen de fondo del footer
-- Ejecutar en Supabase: SQL Editor -> New query -> pegar -> Run
-- ============================================================

alter table public.site_config add column if not exists footer_pattern_url text;
