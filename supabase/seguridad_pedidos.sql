-- ============================================================
-- LO DE MARTINA - Seguridad de pedidos
-- Requiere haber ejecutado actualizacion_integridad.sql,
-- que define la funcion public.normalize_order_totals().
-- Este archivo solo asegura el trigger y la politica de insert.
-- ============================================================

drop trigger if exists normalize_order_totals on public.orders;

create trigger normalize_order_totals
before insert on public.orders
for each row execute function public.normalize_order_totals();

drop policy if exists "Los usuarios autenticados pueden crear pedidos" on public.orders;

create policy "Los usuarios autenticados pueden crear pedidos"
  on public.orders for insert
  with check (auth.uid() = user_id);
