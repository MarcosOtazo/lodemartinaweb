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
