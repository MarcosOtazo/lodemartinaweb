-- ============================================================
-- LO DE MARTINA - Actualizacion: mejoras del panel admin
-- Redes sociales, hero, textos + ver lista de clientes
-- Ejecutar en Supabase: SQL Editor -> New query -> pegar -> Run
-- ============================================================

-- El admin puede ver la lista de clientes registrados
drop policy if exists "Solo admin puede ver todos los perfiles" on public.profiles;

create policy "Solo admin puede ver todos los perfiles"
  on public.profiles for select using (exists (
    select 1 from public.profiles p2
    where p2.id = auth.uid() and p2.role = 'admin'
  ));

-- Redes sociales editables
alter table public.site_config add column if not exists facebook_url text;
alter table public.site_config add column if not exists instagram_url text;

-- Imagen principal (hero) y textos de la web
alter table public.site_config add column if not exists hero_image_url text;
alter table public.site_config add column if not exists about_text text;
