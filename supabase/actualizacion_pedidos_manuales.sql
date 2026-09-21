-- ============================================================
-- LO DE MARTINA - Actualizacion: pedidos manuales y borrado
-- Permite cargar pedidos en el local (sin usuario registrado)
-- Ejecutar en Supabase: SQL Editor -> New query -> pegar -> Run
-- ============================================================

-- El pedido manual no requiere un usuario registrado
alter table public.orders alter column user_id drop not null;

-- El admin puede crear pedidos (ventas en el local)
drop policy if exists "Solo admin puede crear pedidos" on public.orders;

create policy "Solo admin puede crear pedidos"
  on public.orders for insert with check (public.is_admin());
