create sequence if not exists public.client_number_seq;

alter table public.profiles
  add column if not exists client_number bigint;

select setval(
  'public.client_number_seq',
  coalesce((select max(client_number) from public.profiles), 0) + 1,
  false
);

update public.profiles
set client_number = nextval('public.client_number_seq')
where client_number is null;

alter table public.profiles
  alter column client_number set default nextval('public.client_number_seq'),
  alter column client_number set not null;

create unique index if not exists profiles_client_number_unique
  on public.profiles (client_number);

create index if not exists orders_user_id_idx
  on public.orders (user_id);
