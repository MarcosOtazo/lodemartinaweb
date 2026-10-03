drop policy if exists "Los usuarios pueden actualizar su propio perfil" on public.profiles;
drop policy if exists "Solo admin puede actualizar perfiles" on public.profiles;

create policy "Solo admin puede actualizar perfiles"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Los usuarios pueden crear su propio perfil" on public.profiles;

create policy "Los usuarios pueden crear su propio perfil"
  on public.profiles for insert
  with check (auth.uid() = id and role = 'client');

create or replace function public.protect_admin_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'admin' and new.role <> 'admin' then
    if old.id = auth.uid() then
      raise exception 'No podés quitarte tu propio rol de admin';
    end if;

    if not exists (
      select 1
      from public.profiles
      where role = 'admin'
        and id <> old.id
    ) then
      raise exception 'Debe quedar al menos un admin';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_admin_roles on public.profiles;

create trigger protect_admin_roles
before update on public.profiles
for each row execute function public.protect_admin_roles();
