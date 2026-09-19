-- ============================================================
-- LO DE MARTINA - Esquema de base de datos (version idempotente)
-- Se puede ejecutar las veces que sea necesario.
-- Supabase: SQL Editor -> New query -> pegar todo -> Run
-- ============================================================

-- ---------- LIMPIEZA (por si ya se ejecuto antes) ----------
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.make_admin(text);
drop policy if exists "Los usuarios pueden ver su propio perfil" on public.profiles;
drop policy if exists "Los usuarios pueden actualizar su propio perfil" on public.profiles;
drop policy if exists "Los usuarios pueden crear su propio perfil" on public.profiles;
drop policy if exists "Todos pueden ver productos activos" on public.products;
drop policy if exists "Solo admin puede crear productos" on public.products;
drop policy if exists "Solo admin puede actualizar productos" on public.products;
drop policy if exists "Solo admin puede eliminar productos" on public.products;
drop policy if exists "Los usuarios pueden ver sus propios pedidos" on public.orders;
drop policy if exists "Los usuarios autenticados pueden crear pedidos" on public.orders;
drop policy if exists "Solo admin puede actualizar pedidos" on public.orders;
drop policy if exists "Solo admin puede eliminar pedidos" on public.orders;
drop policy if exists "Todos pueden ver la configuracion" on public.site_config;
drop policy if exists "Solo admin puede actualizar la configuracion" on public.site_config;
drop policy if exists "Solo admin puede crear la configuracion" on public.site_config;
drop table if exists public.profiles cascade;
drop table if exists public.products cascade;
drop table if exists public.orders cascade;
drop table if exists public.site_config cascade;

-- ---------- PROFILES ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  role text not null default 'client' check (role in ('admin', 'client')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Los usuarios pueden ver su propio perfil"
  on public.profiles for select using (auth.uid() = id);

create policy "Los usuarios pueden actualizar su propio perfil"
  on public.profiles for update using (auth.uid() = id);

create policy "Los usuarios pueden crear su propio perfil"
  on public.profiles for insert with check (auth.uid() = id);

-- Trigger para crear el perfil automaticamente al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- PRODUCTS ----------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  price numeric(10,2) not null check (price >= 0),
  category text not null check (category in ('hamburguesas', 'tostadas', 'combos', 'bebidas')),
  image_url text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "Todos pueden ver productos activos"
  on public.products for select using (true);

create policy "Solo admin puede crear productos"
  on public.products for insert with check (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "Solo admin puede actualizar productos"
  on public.products for update using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "Solo admin puede eliminar productos"
  on public.products for delete using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- ---------- ORDERS ----------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  user_name text not null,
  user_phone text not null,
  items jsonb not null default '[]',
  subtotal numeric(10,2) not null check (subtotal >= 0),
  delivery_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null check (total >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled')),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'card', 'transfer')),
  delivery_address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "Los usuarios pueden ver sus propios pedidos"
  on public.orders for select using (auth.uid() = user_id or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "Los usuarios autenticados pueden crear pedidos"
  on public.orders for insert with check (auth.uid() = user_id);

create policy "Solo admin puede actualizar pedidos"
  on public.orders for update using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "Solo admin puede eliminar pedidos"
  on public.orders for delete using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- ---------- SITE CONFIG ----------
create table public.site_config (
  id int primary key default 1 check (id = 1),
  site_name text not null default 'Lo de Martina',
  logo_url text,
  primary_color text not null default '#e85d04',
  secondary_color text not null default '#1f2937',
  hero_title text not null default 'Lo de Martina',
  hero_subtitle text not null default 'Hamburguesas, tostadas y combos para todos los gustos',
  whatsapp_number text not null default '',
  delivery_fee numeric(10,2) not null default 0,
  min_order_amount numeric(10,2) not null default 0,
  is_open boolean not null default true,
  opening_hours jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_config enable row level security;

create policy "Todos pueden ver la configuracion"
  on public.site_config for select using (true);

create policy "Solo admin puede actualizar la configuracion"
  on public.site_config for update using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "Solo admin puede crear la configuracion"
  on public.site_config for insert with check (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Configuracion inicial
insert into public.site_config (id) values (1) on conflict do nothing;

-- ---------- STORAGE (fotos de productos y logo) ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Todos pueden ver imagenes de productos" on storage.objects;
drop policy if exists "Solo admin puede subir imagenes" on storage.objects;
drop policy if exists "Solo admin puede actualizar imagenes" on storage.objects;
drop policy if exists "Solo admin puede eliminar imagenes" on storage.objects;

create policy "Todos pueden ver imagenes de productos"
  on storage.objects for select using (bucket_id = 'product-images');

create policy "Solo admin puede subir imagenes"
  on storage.objects for insert with check (
    bucket_id = 'product-images' and exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

create policy "Solo admin puede actualizar imagenes"
  on storage.objects for update using (
    bucket_id = 'product-images' and exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

create policy "Solo admin puede eliminar imagenes"
  on storage.objects for delete using (
    bucket_id = 'product-images' and exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

-- ---------- FUNCION PARA HACER ADMIN A UN USUARIO ----------
-- Uso (desde SQL Editor, como dueño de la base): select public.make_admin('email@del-admin.com');
create or replace function public.make_admin(target_email text)
returns void as $$
begin
  update public.profiles set role = 'admin' where email = target_email;
end;
$$ language plpgsql security definer;

-- Seguridad: solo el dueño de la base (SQL Editor) puede ejecutarla,
-- no los usuarios de la web.
revoke execute on function public.make_admin(text) from anon, authenticated, public;
