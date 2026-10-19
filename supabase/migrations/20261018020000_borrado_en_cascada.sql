-- ============================================================
-- Borrado físico en cascada
-- ============================================================
-- secciones.laboratorio_id e instructor_id no declaraban ON DELETE, así
-- que el borrado físico quedaba restringido y el admin no podía eliminar
-- un laboratorio o un instructor que tuviera secciones. Ahora se propaga
-- en cascada: borrar el laboratorio/instructor arrastra sus secciones, y
-- por la cascada existente también matrículas, sesiones y asistencias.
--
-- asistencias.marcado_por solo se anula: la asistencia pertenece al
-- alumno y a la sesión, no a quien la marcó.
-- ============================================================

alter table public.secciones
  drop constraint if exists secciones_laboratorio_id_fkey,
  add constraint secciones_laboratorio_id_fkey
    foreign key (laboratorio_id)
    references public.laboratorios (id)
    on delete cascade;

alter table public.secciones
  drop constraint if exists secciones_instructor_id_fkey,
  add constraint secciones_instructor_id_fkey
    foreign key (instructor_id)
    references public.perfiles (id)
    on delete cascade;

alter table public.asistencias
  drop constraint if exists asistencias_marcado_por_fkey,
  add constraint asistencias_marcado_por_fkey
    foreign key (marcado_por)
    references public.perfiles (id)
    on delete set null;
