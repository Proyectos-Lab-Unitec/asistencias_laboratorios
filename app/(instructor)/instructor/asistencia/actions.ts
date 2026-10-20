'use server'

import { revalidatePath } from 'next/cache'
import { requiereInstructor } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { EstadoAccion } from '@/lib/types'

type Cliente = Awaited<ReturnType<typeof createClient>>

const OK: EstadoAccion = { ok: true, error: null }
const SIN_PERMISO: EstadoAccion = {
  ok: false,
  error: 'No tienes permiso para hacer esto.',
}

/** Formato de date de Postgres */
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/

function ruta(seccionId: number) {
  return `/instructor/asistencia/${seccionId}`
}

/**
 * Confirma que la sección es del instructor.
 *
 * RLS ya lo garantiza (una sección ajena ni siquiera se filtra), pero el
 * filtro explícito deja la intención clara y evita depender solo de la
 * política: son varias líneas por el precio de una consulta más.
 */
async function seccionPropia(
  supabase: Cliente,
  seccionId: number,
  instructorId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('secciones')
    .select('id')
    .eq('id', seccionId)
    .eq('instructor_id', instructorId)
    .maybeSingle()

  return !!data
}

/**
 * Carga una sesión validando que su sección es del instructor.
 * Devuelve `null` cuando no existe o no es suya.
 */
async function sesionValida(
  supabase: Cliente,
  sesionId: number,
  instructorId: string
) {
  const { data } = await supabase
    .from('sesiones')
    .select('id, seccion_id, estado')
    .eq('id', sesionId)
    .maybeSingle()

  if (!data || !(await seccionPropia(supabase, data.seccion_id, instructorId))) {
    return null
  }

  return data as { id: number; seccion_id: number; estado: string }
}

/**
 * Abre la sesión de un día.
 *
 * La fecha la manda el navegador: es el día local del instructor mientras está
 * en el aula, y calcularla en el servidor equivocaría en despliegues con
 * máquinas en UTC (una clase de las 6 p.m. caería al día siguiente).
 */
export async function abrirSesion(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const instructor = await requiereInstructor()
  if (!instructor) return SIN_PERMISO

  const seccionId = Number(formData.get('seccion_id'))
  const fecha = String(formData.get('fecha') ?? '').trim()

  if (!Number.isInteger(seccionId) || seccionId <= 0) {
    return { ok: false, error: 'Sección no válida.' }
  }
  if (!RE_FECHA.test(fecha)) return { ok: false, error: 'Fecha no válida.' }

  const supabase = await createClient()
  if (!(await seccionPropia(supabase, seccionId, instructor.id))) {
    return SIN_PERMISO
  }

  const { error } = await supabase
    .from('sesiones')
    .insert({ seccion_id: seccionId, fecha })

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'Ya hay una sesión registrada para ese día.' }
    }
    return { ok: false, error: `No se pudo abrir la sesión: ${error.message}` }
  }

  revalidatePath(ruta(seccionId))
  return OK
}

/**
 * Abre o cierra una sesión. Cerrarla deja la asistencia del día inmutable;
 * reabrirla es el camino para corregir un día viejo.
 */
export async function alternarSesion(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const instructor = await requiereInstructor()
  if (!instructor) return SIN_PERMISO

  const sesionId = Number(formData.get('id'))
  // InterruptorEstado manda el valor nuevo en el campo "activo"
  const abierta = String(formData.get('activo') ?? '') === 'true'

  if (!Number.isInteger(sesionId) || sesionId <= 0) {
    return { ok: false, error: 'Sesión no válida.' }
  }

  const supabase = await createClient()
  const sesion = await sesionValida(supabase, sesionId, instructor.id)
  if (!sesion) return SIN_PERMISO

  const { error } = await supabase
    .from('sesiones')
    .update({ estado: abierta ? 'abierta' : 'cerrada' })
    .eq('id', sesionId)

  if (error) {
    return { ok: false, error: `No se pudo actualizar la sesión: ${error.message}` }
  }

  revalidatePath(ruta(sesion.seccion_id))
  return OK
}

/**
 * Alterna la casilla de un alumno en un día.
 *
 * Cada casilla tiene tres estados de facto: sin marcar, presente y ausente.
 * Sin marcar y ausente cuentan igual para el reporte (no es presente), pero
 * se distinguen en pantalla para saber qué se tocó y qué no.
 */
export async function alternarAsistencia(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const instructor = await requiereInstructor()
  if (!instructor) return SIN_PERMISO

  const sesionId = Number(formData.get('sesion_id'))
  const matriculaId = Number(formData.get('matricula_id'))

  if (!Number.isInteger(sesionId) || sesionId <= 0) {
    return { ok: false, error: 'Sesión no válida.' }
  }
  if (!Number.isInteger(matriculaId) || matriculaId <= 0) {
    return { ok: false, error: 'Alumno no válido.' }
  }

  const supabase = await createClient()
  const sesion = await sesionValida(supabase, sesionId, instructor.id)
  if (!sesion) return SIN_PERMISO
  if (sesion.estado !== 'abierta') {
    return {
      ok: false,
      error: 'La sesión está cerrada. Ábrela desde la cabecera para corregir.',
    }
  }

  const { data: existente } = await supabase
    .from('asistencias')
    .select('id, presente')
    .eq('sesion_id', sesionId)
    .eq('matricula_id', matriculaId)
    .maybeSingle()

  const { error } = existente
    ? await supabase
        .from('asistencias')
        .update({ presente: !existente.presente })
        .eq('id', existente.id)
    : await supabase.from('asistencias').insert({
        sesion_id: sesionId,
        matricula_id: matriculaId,
        presente: true,
        marcado_por: instructor.id,
      })

  if (error) {
    return { ok: false, error: `No se pudo marcar la asistencia: ${error.message}` }
  }

  revalidatePath(ruta(sesion.seccion_id))
  return OK
}

/**
 * "Marcar todos presentes": el atajo del primer minuto de clase. Después el
 * instructor corrige las excepciones a mano, que es mucho menos trabajo que
 * encender uno por uno.
 */
export async function marcarTodosPresentes(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const instructor = await requiereInstructor()
  if (!instructor) return SIN_PERMISO

  const sesionId = Number(formData.get('sesion_id'))
  if (!Number.isInteger(sesionId) || sesionId <= 0) {
    return { ok: false, error: 'Sesión no válida.' }
  }

  const supabase = await createClient()
  const sesion = await sesionValida(supabase, sesionId, instructor.id)
  if (!sesion) return SIN_PERMISO
  if (sesion.estado !== 'abierta') {
    return { ok: false, error: 'La sesión está cerrada.' }
  }

  const { data: matriculas } = await supabase
    .from('matriculas')
    .select('id')
    .eq('seccion_id', sesion.seccion_id)

  if (!matriculas || matriculas.length === 0) {
    return { ok: false, error: 'Esta sección aún no tiene alumnos inscritos.' }
  }

  const filas = matriculas.map((m) => ({
    sesion_id: sesionId,
    matricula_id: m.id,
    presente: true,
    marcado_por: instructor.id,
  }))

  // onConflict sobre el constraint UNIQUE(sesion_id, matricula_id): lo que ya
  // estuviera marcado presente sigue igual y lo ausente pasa a presente.
  const { error } = await supabase
    .from('asistencias')
    .upsert(filas, { onConflict: 'sesion_id,matricula_id' })

  if (error) {
    return { ok: false, error: `No se pudo marcar la asistencia: ${error.message}` }
  }

  revalidatePath(ruta(sesion.seccion_id))
  return OK
}
