-- ============================================================
-- perfiles.email
-- ============================================================
-- El correo vive en auth.users, que no es visible desde PostgREST ni
-- desde el dashboard. Lo duplicamos en perfiles (lo llena el mismo
-- trigger al crear el usuario) para que el admin pueda listar las
-- cuentas de instructores y buscarlas por correo.
-- ============================================================

alter table public.perfiles
  add column if not exists email text;

-- Backfill por si quedaron usuarios creados antes de esta columna
update public.perfiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is distinct from u.email
  and u.email is not null;

-- Reemplazo el trigger para que también lleve el correo
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', new.email, 'Sin nombre'),
    new.email
  )
  on conflict (id) do update set email = excluded.email;

  return new;
end;
$$;
