do $$
declare
  client_record record;
  candidate bigint;
begin
  for client_record in select id from public.profiles loop
    loop
      candidate := floor(random() * 899999) + 100000;
      exit when not exists (
        select 1
        from public.profiles
        where client_number = candidate
          and id <> client_record.id
      );
    end loop;

    update public.profiles
    set client_number = candidate
    where id = client_record.id;
  end loop;
end $$;

alter table public.profiles
  alter column client_number drop default;

create or replace function public.assign_random_client_number()
returns trigger
language plpgsql
as $$
declare
  candidate bigint;
begin
  if new.client_number is null then
    loop
      candidate := floor(random() * 899999) + 100000;
      exit when not exists (
        select 1
        from public.profiles
        where client_number = candidate
      );
    end loop;
    new.client_number := candidate;
  end if;

  return new;
end;
$$;

drop trigger if exists assign_random_client_number on public.profiles;

create trigger assign_random_client_number
before insert on public.profiles
for each row
execute function public.assign_random_client_number();
