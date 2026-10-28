drop policy if exists "Los invitados pueden crear pedidos" on public.orders;

create policy "Los invitados pueden crear pedidos"
  on public.orders for insert
  with check (auth.uid() is null and user_id is null and status = 'pending');
