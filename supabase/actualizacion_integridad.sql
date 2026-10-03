alter table public.receta_ingredientes
  add column if not exists unit text not null default 'unidad';

delete from public.receta_subrecetas
where receta_id = subreceta_id;

alter table public.receta_subrecetas
  drop constraint if exists receta_subrecetas_no_self;

alter table public.receta_subrecetas
  add constraint receta_subrecetas_no_self check (receta_id <> subreceta_id);

do $$
begin
  if not exists (
    select 1 from public.producto_recetas
    group by product_id, receta_id having count(*) > 1
  ) then
    create unique index if not exists producto_recetas_producto_receta_unique
      on public.producto_recetas (product_id, receta_id);
  else
    raise notice 'producto_recetas tiene duplicados: no se creo el indice unico';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.receta_subrecetas
    group by receta_id, subreceta_id having count(*) > 1
  ) then
    create unique index if not exists receta_subrecetas_unica
      on public.receta_subrecetas (receta_id, subreceta_id);
  else
    raise notice 'receta_subrecetas tiene duplicados: no se creo el indice unico';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.receta_ingredientes
    group by receta_id, insumo_id having count(*) > 1
  ) then
    create unique index if not exists receta_ingredientes_unica
      on public.receta_ingredientes (receta_id, insumo_id);
  else
    raise notice 'receta_ingredientes tiene duplicados: no se creo el indice unico';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.producto_insumos
    group by product_id, insumo_id having count(*) > 1
  ) then
    create unique index if not exists producto_insumos_unica
      on public.producto_insumos (product_id, insumo_id);
  else
    raise notice 'producto_insumos tiene duplicados: no se creo el indice unico';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.option_item_insumos
    group by option_item_id, insumo_id having count(*) > 1
  ) then
    create unique index if not exists option_item_insumos_unica
      on public.option_item_insumos (option_item_id, insumo_id);
  else
    raise notice 'option_item_insumos tiene duplicados: no se creo el indice unico';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.product_options
    group by product_id, name having count(*) > 1
  ) then
    create unique index if not exists product_options_nombre_unico
      on public.product_options (product_id, name);
  else
    raise notice 'product_options tiene grupos con nombre repetido: revisar manualmente';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from public.option_items
    group by option_id, name having count(*) > 1
  ) then
    create unique index if not exists option_items_nombre_unico
      on public.option_items (option_id, name);
  else
    raise notice 'option_items tiene variantes con nombre repetido: revisar manualmente';
  end if;
end $$;

alter table public.orders
  drop constraint if exists orders_user_id_fkey;

alter table public.orders
  add constraint orders_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table public.orders
  drop constraint if exists orders_delivery_fee_check;

alter table public.orders
  add constraint orders_delivery_fee_check check (delivery_fee >= 0);

alter table public.site_config
  drop constraint if exists site_config_delivery_fee_check;

alter table public.site_config
  add constraint site_config_delivery_fee_check check (delivery_fee >= 0);

alter table public.site_config
  drop constraint if exists site_config_min_order_amount_check;

alter table public.site_config
  add constraint site_config_min_order_amount_check check (min_order_amount >= 0);

drop policy if exists "Todos pueden ver productos activos" on public.products;
drop policy if exists "Todos pueden ver productos" on public.products;

create policy "Todos pueden ver productos"
  on public.products for select
  using (is_active = true or public.is_admin());

drop policy if exists "Solo admin puede ver todos los perfiles" on public.profiles;

create policy "Solo admin puede ver todos los perfiles"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "Solo admin puede modificar categorias" on public.categories;

create policy "Solo admin puede modificar categorias"
  on public.categories for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Solo admin puede modificar opciones de productos" on public.product_options;

create policy "Solo admin puede modificar opciones de productos"
  on public.product_options for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Solo admin puede modificar items de opciones" on public.option_items;

create policy "Solo admin puede modificar items de opciones"
  on public.option_items for all
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone');
  return new;
end;
$$;

create or replace function public.make_admin(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set role = 'admin' where email = target_email;
end;
$$;

revoke execute on function public.make_admin(text) from anon, authenticated, public;

create or replace function public.normalize_order_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  option_item jsonb;
  normalized_items jsonb := '[]'::jsonb;
  normalized_options jsonb;
  v_product_id uuid;
  v_quantity int;
  v_product_name text;
  v_base_price numeric;
  v_option_price numeric;
  v_product_price numeric;
  v_subtotal numeric := 0;
  v_is_admin boolean;
  v_delivery_fee numeric;
  v_has_delivery boolean;
begin
  if new.items is null
     or jsonb_typeof(new.items) <> 'array'
     or jsonb_array_length(new.items) = 0 then
    raise exception 'El pedido no contiene productos';
  end if;

  for item in select value from jsonb_array_elements(new.items)
  loop
    v_product_id := nullif(item->>'product_id', '')::uuid;
    v_quantity := coalesce((item->>'quantity')::int, 0);

    if v_product_id is null or v_quantity <= 0 then
      raise exception 'El pedido contiene un producto inválido';
    end if;

    select name, price
    into v_product_name, v_base_price
    from public.products
    where id = v_product_id
      and is_active = true;

    if v_base_price is null then
      raise exception 'Producto no disponible en el pedido';
    end if;

    normalized_options := '[]'::jsonb;

    if item ? 'selected_options' and jsonb_typeof(item->'selected_options') = 'array' then
      for option_item in select value from jsonb_array_elements(item->'selected_options')
      loop
        v_option_price := null;

        select oi.price
        into v_option_price
        from public.option_items oi
        join public.product_options po on po.id = oi.option_id
        where po.product_id = v_product_id
          and po.name = option_item->>'group_name'
          and oi.name = option_item->>'item_name'
        limit 1;

        if v_option_price is null then
          raise exception 'Opción inválida en el pedido: %', option_item->>'item_name';
        end if;

        normalized_options := normalized_options || jsonb_build_array(
          jsonb_build_object(
            'group_name', option_item->>'group_name',
            'item_name', option_item->>'item_name',
            'price', v_option_price
          )
        );
      end loop;
    end if;

    v_product_price := v_base_price + coalesce((
      select sum((value->>'price')::numeric)
      from jsonb_array_elements(normalized_options)
    ), 0);

    v_subtotal := v_subtotal + v_product_price * v_quantity;

    normalized_items := normalized_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product_id,
        'product_name', v_product_name,
        'product_price', v_product_price,
        'quantity', v_quantity,
        'notes', item->>'notes',
        'selected_options', normalized_options
      )
    );
  end loop;

  new.items := normalized_items;
  new.subtotal := v_subtotal;
  v_is_admin := public.is_admin();

  if not v_is_admin then
    new.user_id := auth.uid();
    new.status := 'pending';
    v_has_delivery := new.delivery_address is not null and btrim(new.delivery_address) <> '';
    v_delivery_fee := coalesce((select delivery_fee from public.site_config where id = 1), 0);
    new.delivery_fee := case when v_has_delivery then v_delivery_fee else 0 end;

    if new.payment_method is null or new.payment_method not in ('cash', 'transfer') then
      new.payment_method := 'cash';
    end if;

    if not v_has_delivery then
      new.delivery_address := null;
    end if;

    new.total := new.subtotal + new.delivery_fee;
  else
    new.delivery_fee := coalesce(new.delivery_fee, 0);
    new.total := coalesce(new.total, new.subtotal + new.delivery_fee);
    if new.total < 0 or new.total > new.subtotal + new.delivery_fee then
      raise exception 'Total de pedido inválido';
    end if;
  end if;

  new.user_name := left(coalesce(btrim(new.user_name), ''), 120);
  new.user_phone := left(coalesce(btrim(new.user_phone), ''), 40);
  new.notes := left(coalesce(new.notes, ''), 2000);

  return new;
end;
$$;

drop trigger if exists normalize_order_totals on public.orders;

create trigger normalize_order_totals
before insert on public.orders
for each row execute function public.normalize_order_totals();

drop policy if exists "Los usuarios autenticados pueden crear pedidos" on public.orders;

create policy "Los usuarios autenticados pueden crear pedidos"
  on public.orders for insert
  with check (auth.uid() = user_id);
