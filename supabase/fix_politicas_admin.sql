-- ============================================================
-- LO DE MARTINA - FIX URGENTE: recursion infinita en politicas
-- Ejecutar en Supabase: SQL Editor -> New query -> pegar -> Run
-- ============================================================

-- Funcion auxiliar que chequea si el usuario actual es admin.
-- Es security definer para que NO tenga recursion de politicas.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- PROFILES ----------
drop policy if exists "Solo admin puede ver todos los perfiles" on public.profiles;
create policy "Solo admin puede ver todos los perfiles"
  on public.profiles for select using (public.is_admin());

-- ---------- PRODUCTS ----------
drop policy if exists "Solo admin puede crear productos" on public.products;
create policy "Solo admin puede crear productos"
  on public.products for insert with check (public.is_admin());

drop policy if exists "Solo admin puede actualizar productos" on public.products;
create policy "Solo admin puede actualizar productos"
  on public.products for update using (public.is_admin());

drop policy if exists "Solo admin puede eliminar productos" on public.products;
create policy "Solo admin puede eliminar productos"
  on public.products for delete using (public.is_admin());

-- ---------- ORDERS ----------
drop policy if exists "Solo admin puede actualizar pedidos" on public.orders;
create policy "Solo admin puede actualizar pedidos"
  on public.orders for update using (public.is_admin());

drop policy if exists "Solo admin puede eliminar pedidos" on public.orders;
create policy "Solo admin puede eliminar pedidos"
  on public.orders for delete using (public.is_admin());

-- ---------- SITE CONFIG ----------
drop policy if exists "Solo admin puede actualizar la configuracion" on public.site_config;
create policy "Solo admin puede actualizar la configuracion"
  on public.site_config for update using (public.is_admin());

drop policy if exists "Solo admin puede crear la configuracion" on public.site_config;
create policy "Solo admin puede crear la configuracion"
  on public.site_config for insert with check (public.is_admin());

-- ---------- CATEGORIES ----------
drop policy if exists "Solo admin puede modificar categorias" on public.categories;
create policy "Solo admin puede modificar categorias"
  on public.categories for all using (public.is_admin());

-- ---------- PRODUCT OPTIONS ----------
drop policy if exists "Solo admin puede modificar opciones de productos" on public.product_options;
create policy "Solo admin puede modificar opciones de productos"
  on public.product_options for all using (public.is_admin());

-- ---------- OPTION ITEMS ----------
drop policy if exists "Solo admin puede modificar items de opciones" on public.option_items;
create policy "Solo admin puede modificar items de opciones"
  on public.option_items for all using (public.is_admin());

-- ---------- STORAGE ----------
drop policy if exists "Solo admin puede subir imagenes" on storage.objects;
create policy "Solo admin puede subir imagenes"
  on storage.objects for insert with check (
    bucket_id = 'product-images' and public.is_admin()
  );

drop policy if exists "Solo admin puede actualizar imagenes" on storage.objects;
create policy "Solo admin puede actualizar imagenes"
  on storage.objects for update using (
    bucket_id = 'product-images' and public.is_admin()
  );

drop policy if exists "Solo admin puede eliminar imagenes" on storage.objects;
create policy "Solo admin puede eliminar imagenes"
  on storage.objects for delete using (
    bucket_id = 'product-images' and public.is_admin()
  );
