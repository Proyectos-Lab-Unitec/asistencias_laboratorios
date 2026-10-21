-- ============================================================
-- Clases como catalogo + seccion de clase del alumno
--
-- Hasta ahora "clase" era una columna de texto libre en laboratorios. Eso no
-- sirve para filtrar reportes (cada quien la escribe distinto) y ademas deja
-- fuera el dato que el reporte realmente necesita: la seccion de la CLASE que
-- cursa el alumno, que no es la seccion del laboratorio.
--
-- Entonces:
--   * clases            -> catalogo que administra el admin (Fisica 1, ...)
--   * laboratorios       -> clase_id (FK al catalogo)
--   * matriculas         -> clase_id + seccion_clase (los declara el alumno)
--
-- El reporte usa lo de la matricula: dos alumnos del mismo laboratorio pueden
-- estar en clases (y secciones de clase) distintas.
-- ============================================================

-- 1. Catalogo de clases
create table public.clases (
  id bigint generated always as identity primary key,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint clases_nombre_unico unique (nombre)
);

-- 2. El laboratorio apunta al catalogo en vez de guardar texto libre
alter table public.laboratorios
  add column clase_id bigint references public.clases (id) on delete set null;

-- Volcar lo que ya estuviera escrito a mano. Hoy la columna esta vacia en
-- todos los laboratorios, pero la migracion queda correcta si alguno llego a
-- llenarla antes de este cambio.
insert into public.clases (nombre)
select distinct btrim(clase)
from public.laboratorios
where clase is not null and btrim(clase) <> ''
on conflict (nombre) do nothing;

update public.laboratorios l
set clase_id = c.id
from public.clases c
where l.clase is not null and btrim(l.clase) = c.nombre;

alter table public.laboratorios drop column clase;

-- 3. La clase y su seccion las declara el alumno al inscribirse.
--    `secciones.grupo` sigue siendo la seccion DEL LABORATORIO (Viernes 4:00
--    p.m.); esto de aca es la seccion de la materia que cursa el alumno.
alter table public.matriculas
  add column clase_id bigint references public.clases (id) on delete set null;
alter table public.matriculas
  add column seccion_clase text;

-- 4. La nota del laboratorio ya no esta topada en 15: varia por clase.
--    El check viejo solo exigia >= 0, asi que basta con agregar el tope nuevo.
alter table public.matriculas
  add constraint matriculas_nota_final_maxima check (nota_final <= 100);

-- 5. RLS del catalogo: lo lee cualquier sesion y ademas la ruta publica
--    (el alumno elige su clase en el formulario del QR, sin cuenta).
alter table public.clases enable row level security;

create policy "clases_select" on public.clases
  for select to authenticated
  using (true);

create policy "clases_select_publica" on public.clases
  for select to anon
  using (activo);

create policy "clases_insert" on public.clases
  for insert to authenticated
  with check (public.is_admin());

create policy "clases_update" on public.clases
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "clases_delete" on public.clases
  for delete to authenticated
  using (public.is_admin());

grant select on public.clases to anon;

-- 6. El alta publica recibe ahora la clase y su seccion.
--    Cambiar la lista de parametros firma otra funcion, asi que se borra la
--    vieja (si no, quedan dos sobrecargas y el grant se pierde).
drop function public.registrar_alumno(uuid, text, text, text, text, text);

create or replace function public.registrar_alumno(
  p_token uuid,
  p_numero_cuenta text,
  p_nombre text,
  p_carrera text,
  p_correo text,
  p_docente text,
  p_clase_id bigint,
  p_seccion_clase text
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

  if p_clase_id is null
     or not exists (select 1 from clases where id = p_clase_id and activo) then
    return jsonb_build_object('ok', false, 'error', 'clase_invalida');
  end if;

  if p_seccion_clase is null or btrim(p_seccion_clase) = '' then
    return jsonb_build_object('ok', false, 'error', 'seccion_invalida');
  end if;

  select capacidad into v_capacidad from laboratorios where id = v_seccion.laboratorio_id;
  select count(*) into v_inscritos from matriculas where seccion_id = v_seccion.id;
  if v_inscritos >= v_capacidad then
    return jsonb_build_object('ok', false, 'error', 'seccion_llena');
  end if;

  begin
    insert into matriculas (
      seccion_id, numero_cuenta, nombre, carrera, correo, docente,
      clase_id, seccion_clase, origen
    )
    values (
      v_seccion.id, p_numero_cuenta, p_nombre, p_carrera, p_correo, p_docente,
      p_clase_id, btrim(p_seccion_clase), 'qr'
    );
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'ya_registrado');
  end;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.registrar_alumno(uuid, text, text, text, text, text, bigint, text)
  from public, authenticated;
grant execute on function public.registrar_alumno(uuid, text, text, text, text, text, bigint, text)
  to anon;
