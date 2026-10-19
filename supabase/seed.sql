-- Periodos fijos: Q1-Q4 por año (trimestres de calendario)
insert into public.periodos (year, nombre, fecha_inicio, fecha_fin) values
  (2026, 'Q1', '2026-01-01', '2026-03-31'),
  (2026, 'Q2', '2026-04-01', '2026-06-30'),
  (2026, 'Q3', '2026-07-01', '2026-09-30'),
  (2026, 'Q4', '2026-10-01', '2026-12-31'),
  (2027, 'Q1', '2027-01-01', '2027-03-31'),
  (2027, 'Q2', '2027-04-01', '2027-06-30'),
  (2027, 'Q3', '2027-07-01', '2027-09-30'),
  (2027, 'Q4', '2027-10-01', '2027-12-31')
on conflict (year, nombre) do nothing;

-- Laboratorios de ejemplo (borrar cuando el admin cargue los reales)
insert into public.laboratorios (nombre, ubicacion, capacidad) values
  ('Laboratorio de Química 1', 'Edificio A - Piso 2', 30),
  ('Laboratorio de Física 1', 'Edificio B - Piso 1', 25),
  ('Laboratorio de Cómputo 1', 'Edificio C - Piso 3', 40)
on conflict do nothing;

-- Usuario admin de DESARROLLO (solo local; no llevar a producción)
do $$
declare
  v_user_id uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email = 'admin@universidad.com') then
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new,
    email_change, email_change_token_current, phone_change,
    reauthentication_token, created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    'admin@universidad.com', extensions.crypt('admin123', extensions.gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{"nombre":"Admin General"}',
    '', '', '',
    '', '', '',
    '', now(), now()
  );

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_user_id::text, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', 'admin@universidad.com', 'email_verified', true),
    'email', now(), now(), now()
  );
end $$;

-- El trigger crea el perfil con rol 'instructor' por defecto; ascender al admin
update public.perfiles set rol = 'admin' where nombre = 'Admin General';
