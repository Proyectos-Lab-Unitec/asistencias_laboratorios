-- ============================================================
-- El docente deja de vivir en la seccion: lo declara el alumno.
--
-- Hasta ahora el instructor lo cargaba en el formulario de la seccion. Eso lo
-- volvia redundante con instructor_id (la cuenta que administra la seccion) y
-- dejaba un dato a mitad de camino: la seccion lo "tenia", pero nadie lo
-- declaraba realmente. Ahora lo escribe el alumno al inscribirse por QR, queda
-- en su matricula, y la seccion muestra al instructor que la administra.
-- ============================================================

-- 1. Se agrega primero en matriculas para poder volcar lo que ya existía.
alter table public.matriculas add column docente text;

-- 2. Las matrículas ya inscritas conservan el docente que tenía su sección.
update public.matriculas m
set docente = s.docente
from public.secciones s
where m.seccion_id = s.id
  and m.docente is null
  and s.docente is not null;

-- 3. Se rehacen las dos funciones de la ruta pública antes de tocar la columna:
--    * create or replace NO puede cambiar el tipo de retorno de una función
--      existente y get_seccion_by_token devuelve una tabla.
--    * Cambiar la lista de parámetros de registrar_alumno firma otra función
--      distinta (sobrecarga), dejando la vieja ahí con sus grants.
drop function public.get_seccion_by_token(uuid);
drop function public.registrar_alumno(uuid, text, text, text, text);

-- 4. La columna ya no tiene referencias.
alter table public.secciones drop column docente;

-- Devuelve los datos públicos de la sección del QR (para mostrar en el form)
create or replace function public.get_seccion_by_token(p_token uuid)
returns table (
  id bigint,
  laboratorio text,
  grupo text,
  horario text,
  instructor text,
  registro_abierto boolean
)
language sql
security definer
set search_path = public
as $$
  select s.id, l.nombre, s.grupo, s.horario, p.nombre, s.registro_abierto
  from secciones s
  join laboratorios l on l.id = s.laboratorio_id
  join perfiles p on p.id = s.instructor_id
  where s.token_registro = p_token;
$$;

-- Registro de alumno por QR: valida token, registro abierto, capacidad y
-- duplicados, y guarda el docente que declara.
create or replace function public.registrar_alumno(
  p_token uuid,
  p_numero_cuenta text,
  p_nombre text,
  p_carrera text,
  p_correo text,
  p_docente text
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
    insert into matriculas (seccion_id, numero_cuenta, nombre, carrera, correo, docente, origen)
    values (v_seccion.id, p_numero_cuenta, p_nombre, p_carrera, p_correo, p_docente, 'qr');
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'ya_registrado');
  end;

  return jsonb_build_object('ok', true);
end;
$$;

-- Solo anon puede ejecutar estas funciones (la ruta pública de alumnos)
revoke execute on function public.get_seccion_by_token(uuid) from public, authenticated;
revoke execute on function public.registrar_alumno(uuid, text, text, text, text, text) from public, authenticated;
grant execute on function public.get_seccion_by_token(uuid) to anon;
grant execute on function public.registrar_alumno(uuid, text, text, text, text, text) to anon;
