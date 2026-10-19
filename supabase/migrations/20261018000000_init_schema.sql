-- ============================================================
-- Asistencias de Laboratorios — Esquema inicial
-- ============================================================

-- ---------- Tipos ----------
create type public.rol_usuario as enum ('admin', 'instructor');
create type public.origen_matricula as enum ('qr', 'manual');
create type public.estado_sesion as enum ('abierta', 'cerrada');

-- ---------- perfiles (usuarios autenticados) ----------
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  rol public.rol_usuario not null default 'instructor',
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Auto-crear perfil al crear el usuario (rol por defecto: instructor)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', new.email, 'Sin nombre'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- laboratorios (catálogo del admin) ----------
create table public.laboratorios (
  id bigint generated always as identity primary key,
  nombre text not null,
  ubicacion text,
  capacidad int not null default 30 check (capacidad > 0),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- periodos (trimestres fijos Q1-Q4 por año) ----------
create table public.periodos (
  id bigint generated always as identity primary key,
  year int not null check (year between 2000 and 2100),
  nombre text not null check (nombre in ('Q1', 'Q2', 'Q3', 'Q4')),
  fecha_inicio date not null,
  fecha_fin date not null,
  constraint periodos_rango check (fecha_fin > fecha_inicio),
  constraint periodos_unique unique (year, nombre)
);

-- ---------- secciones (las crea el instructor) ----------
create table public.secciones (
  id bigint generated always as identity primary key,
  laboratorio_id bigint not null references public.laboratorios (id),
  instructor_id uuid not null references public.perfiles (id),
  periodo_id bigint not null references public.periodos (id),
  grupo text not null,
  horario text,
  docente text,
  token_registro uuid not null unique default gen_random_uuid(),
  registro_abierto boolean not null default true,
  created_at timestamptz not null default now(),
  constraint secciones_grupo_unico unique (laboratorio_id, periodo_id, grupo)
);

-- ---------- matriculas (inscritos por sección; sin tabla global de alumnos) ----------
create table public.matriculas (
  id bigint generated always as identity primary key,
  seccion_id bigint not null references public.secciones (id) on delete cascade,
  numero_cuenta text not null,
  nombre text not null,
  carrera text,
  correo text,
  nota_final numeric(6, 2) check (nota_final >= 0),
  origen public.origen_matricula not null default 'manual',
  registrado_en timestamptz not null default now(),
  constraint matricula_unica unique (seccion_id, numero_cuenta)
);

-- ---------- sesiones (un día de clase, para marcar asistencia) ----------
create table public.sesiones (
  id bigint generated always as identity primary key,
  seccion_id bigint not null references public.secciones (id) on delete cascade,
  fecha date not null,
  estado public.estado_sesion not null default 'abierta',
  created_at timestamptz not null default now(),
  constraint sesion_unica unique (seccion_id, fecha)
);

-- ---------- asistencias ----------
create table public.asistencias (
  id bigint generated always as identity primary key,
  sesion_id bigint not null references public.sesiones (id) on delete cascade,
  matricula_id bigint not null references public.matriculas (id) on delete cascade,
  presente boolean not null default true,
  marcado_por uuid references public.perfiles (id),
  hora timestamptz not null default now(),
  constraint asistencia_unica unique (sesion_id, matricula_id)
);

-- ---------- Índices ----------
create index idx_secciones_instructor on public.secciones (instructor_id);
create index idx_secciones_periodo on public.secciones (periodo_id);
create index idx_matriculas_seccion on public.matriculas (seccion_id);
create index idx_sesiones_seccion on public.sesiones (seccion_id, fecha);
create index idx_asistencias_sesion on public.asistencias (sesion_id);
create index idx_asistencias_matricula on public.asistencias (matricula_id);

-- ---------- Helpers de permisos (requieren las tablas ya creadas) ----------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid() and rol = 'admin' and activo
  );
$$;

create or replace function public.is_instructor_of(p_seccion_id bigint)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from secciones
    where id = p_seccion_id and instructor_id = auth.uid()
  );
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.perfiles enable row level security;
alter table public.laboratorios enable row level security;
alter table public.periodos enable row level security;
alter table public.secciones enable row level security;
alter table public.matriculas enable row level security;
alter table public.sesiones enable row level security;
alter table public.asistencias enable row level security;

-- perfiles: cada quien ve el suyo; admin ve todos; solo admin crea/edita cuentas
create policy "perfiles_select" on public.perfiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "perfiles_update" on public.perfiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy "perfiles_insert" on public.perfiles
  for insert to authenticated
  with check (public.is_admin());

create policy "perfiles_delete" on public.perfiles
  for delete to authenticated
  using (public.is_admin());

-- laboratorios: cualquier usuario autenticado los ve; solo admin los gestiona
create policy "laboratorios_select" on public.laboratorios
  for select to authenticated
  using (true);

create policy "laboratorios_insert" on public.laboratorios
  for insert to authenticated
  with check (public.is_admin());

create policy "laboratorios_update" on public.laboratorios
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "laboratorios_delete" on public.laboratorios
  for delete to authenticated
  using (public.is_admin());

-- periodos: visibles para autenticados; solo admin los gestiona
create policy "periodos_select" on public.periodos
  for select to authenticated
  using (true);

create policy "periodos_insert" on public.periodos
  for insert to authenticated
  with check (public.is_admin());

create policy "periodos_update" on public.periodos
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "periodos_delete" on public.periodos
  for delete to authenticated
  using (public.is_admin());

-- secciones: el instructor ve/edita las suyas; admin ve/edita todas
create policy "secciones_select" on public.secciones
  for select to authenticated
  using (instructor_id = auth.uid() or public.is_admin());

create policy "secciones_insert" on public.secciones
  for insert to authenticated
  with check (instructor_id = auth.uid() or public.is_admin());

create policy "secciones_update" on public.secciones
  for update to authenticated
  using (instructor_id = auth.uid() or public.is_admin())
  with check (instructor_id = auth.uid() or public.is_admin());

create policy "secciones_delete" on public.secciones
  for delete to authenticated
  using (instructor_id = auth.uid() or public.is_admin());

-- matriculas: dueño de la sección o admin
create policy "matriculas_select" on public.matriculas
  for select to authenticated
  using (public.is_instructor_of(seccion_id) or public.is_admin());

create policy "matriculas_insert" on public.matriculas
  for insert to authenticated
  with check (public.is_instructor_of(seccion_id) or public.is_admin());

create policy "matriculas_update" on public.matriculas
  for update to authenticated
  using (public.is_instructor_of(seccion_id) or public.is_admin())
  with check (public.is_instructor_of(seccion_id) or public.is_admin());

create policy "matriculas_delete" on public.matriculas
  for delete to authenticated
  using (public.is_instructor_of(seccion_id) or public.is_admin());

-- sesiones: dueño de la sección o admin
create policy "sesiones_select" on public.sesiones
  for select to authenticated
  using (public.is_instructor_of(seccion_id) or public.is_admin());

create policy "sesiones_insert" on public.sesiones
  for insert to authenticated
  with check (public.is_instructor_of(seccion_id) or public.is_admin());

create policy "sesiones_update" on public.sesiones
  for update to authenticated
  using (public.is_instructor_of(seccion_id) or public.is_admin())
  with check (public.is_instructor_of(seccion_id) or public.is_admin());

create policy "sesiones_delete" on public.sesiones
  for delete to authenticated
  using (public.is_instructor_of(seccion_id) or public.is_admin());

-- asistencias: dueño de la sección (vía sesión) o admin
create policy "asistencias_select" on public.asistencias
  for select to authenticated
  using (
    public.is_instructor_of((select seccion_id from public.sesiones where id = asistencias.sesion_id))
    or public.is_admin()
  );

create policy "asistencias_insert" on public.asistencias
  for insert to authenticated
  with check (
    public.is_instructor_of((select seccion_id from public.sesiones where id = asistencias.sesion_id))
    or public.is_admin()
  );

create policy "asistencias_update" on public.asistencias
  for update to authenticated
  using (
    public.is_instructor_of((select seccion_id from public.sesiones where id = asistencias.sesion_id))
    or public.is_admin()
  )
  with check (
    public.is_instructor_of((select seccion_id from public.sesiones where id = asistencias.sesion_id))
    or public.is_admin()
  );

create policy "asistencias_delete" on public.asistencias
  for delete to authenticated
  using (
    public.is_instructor_of((select seccion_id from public.sesiones where id = asistencias.sesion_id))
    or public.is_admin()
  );

-- ============================================================
-- RPCs para la ruta pública de registro (anon, vía token)
-- ============================================================

-- Devuelve los datos públicos de la sección del QR (para mostrar en el form)
create or replace function public.get_seccion_by_token(p_token uuid)
returns table (
  id bigint,
  laboratorio text,
  grupo text,
  horario text,
  docente text,
  instructor text,
  registro_abierto boolean
)
language sql
security definer
set search_path = public
as $$
  select s.id, l.nombre, s.grupo, s.horario, s.docente, p.nombre, s.registro_abierto
  from secciones s
  join laboratorios l on l.id = s.laboratorio_id
  join perfiles p on p.id = s.instructor_id
  where s.token_registro = p_token;
$$;

-- Registro de alumno por QR: valida token, registro abierto, capacidad y duplicados
create or replace function public.registrar_alumno(
  p_token uuid,
  p_numero_cuenta text,
  p_nombre text,
  p_carrera text,
  p_correo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seccion secciones%rowtype;
  v_capacidad int;
  v_inscritos int;
begin
  select * into v_seccion from secciones where token_registro = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'token_invalido');
  end if;

  if not v_seccion.registro_abierto then
    return jsonb_build_object('ok', false, 'error', 'registro_cerrado');
  end if;

  select capacidad into v_capacidad from laboratorios where id = v_seccion.laboratorio_id;
  select count(*) into v_inscritos from matriculas where seccion_id = v_seccion.id;
  if v_inscritos >= v_capacidad then
    return jsonb_build_object('ok', false, 'error', 'seccion_llena');
  end if;

  begin
    insert into matriculas (seccion_id, numero_cuenta, nombre, carrera, correo, origen)
    values (v_seccion.id, p_numero_cuenta, p_nombre, p_carrera, p_correo, 'qr');
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'ya_registrado');
  end;

  return jsonb_build_object('ok', true);
end;
$$;

-- Solo anon puede ejecutar estas funciones (la ruta pública de alumnos)
revoke execute on function public.get_seccion_by_token(uuid) from public, authenticated;
revoke execute on function public.registrar_alumno(uuid, text, text, text, text) from public, authenticated;
grant execute on function public.get_seccion_by_token(uuid) to anon;
grant execute on function public.registrar_alumno(uuid, text, text, text, text) to anon;
