'use server'

import { revalidatePath } from 'next/cache'
import { requiereInstructor } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { EstadoAccion } from '@/lib/types'

const OK: EstadoAccion = { ok: true, error: null }
const SIN_PERMISO: EstadoAccion = {
  ok: false,
  error: 'No tienes permiso para hacer esto.',
}

type DatosSeccion = {
  laboratorio_id: number
  periodo_id: number
  grupo: string
  horario: string | null
}

/**
 * Lee y valida los campos comunes de crear/editar sección.
 * Los ids vienen de <select>, así que llegan como texto.
 *
 * El docente no se toca acá: lo declara el alumno cuando se inscribe.
 */
function leerSeccion(formData: FormData):
  | { datos: DatosSeccion }
  | { error: string } {
  const laboratorioId = Number(formData.get('laboratorio_id'))
  const periodoId = Number(formData.get('periodo_id'))
  const grupo = String(formData.get('grupo') ?? '').trim()
  const horario = String(formData.get('horario') ?? '').trim()

  if (!Number.isInteger(laboratorioId) || laboratorioId <= 0) {
    return { error: 'Debes elegir un laboratorio.' }
  }
  if (!Number.isInteger(periodoId) || periodoId <= 0) {
    return { error: 'Debes elegir un periodo.' }
  }
  if (!grupo) return { error: 'La sección es obligatoria.' }
  if (grupo.length > 20) return { error: 'La sección es demasiado larga.' }
  if (horario.length > 120) return { error: 'El horario es demasiado largo.' }

  return {
    datos: {
      laboratorio_id: laboratorioId,
      periodo_id: periodoId,
      grupo,
      horario: horario || null,
    },
  }
}

/**
 * El constraint es unique(laboratorio_id, periodo_id, grupo); si se viola,
 * Postgres devuelve 23505 y hay que traducirlo a algo que el instructor
 * entienda en el modal.
 */
function mapearErrorSeccion(error: { code?: string; message: string }): string {
  if (error.code === '23505') {
    return 'Ya existe una sección con esa denominación en ese laboratorio y periodo.'
  }
  if (error.code === '23503') {
    return 'El laboratorio o el periodo elegido ya no existe.'
  }
  return `No se pudo guardar la sección: ${error.message}`
}

export async function crearSeccion(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const instructor = await requiereInstructor()
  if (!instructor) return SIN_PERMISO

  const validado = leerSeccion(formData)
  if ('error' in validado) return { ok: false, error: validado.error }

  const supabase = await createClient()
  const { error } = await supabase.from('secciones').insert({
    ...validado.datos,
    instructor_id: instructor.id,
  })

  if (error) return { ok: false, error: mapearErrorSeccion(error) }

  revalidatePath('/instructor')
  return OK
}

export async function actualizarSeccion(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const instructor = await requiereInstructor()
  if (!instructor) return SIN_PERMISO

  const id = Number(formData.get('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: 'Sección no válida.' }
  }

  const validado = leerSeccion(formData)
  if ('error' in validado) return { ok: false, error: validado.error }

  // El filtro por instructor_id es redundante con RLS, pero deja la
  // intención explícita: nadie edita una sección ajena.
  const supabase = await createClient()
  const { error } = await supabase
    .from('secciones')
    .update(validado.datos)
    .eq('id', id)
    .eq('instructor_id', instructor.id)

  if (error) return { ok: false, error: mapearErrorSeccion(error) }

  revalidatePath('/instructor')
  return OK
}

/**
 * Abre/cierra el registro por QR. No es un switch de "activo" del catálogo:
 * es el control del primer día, para dejar de aceptar inscripciones.
 */
export async function alternarRegistro(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const instructor = await requiereInstructor()
  if (!instructor) return SIN_PERMISO

  const id = Number(formData.get('id'))
  // InterruptorEstado manda el valor nuevo en el campo "activo"
  const abierto = String(formData.get('activo') ?? '') !== 'false'

  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: 'Sección no válida.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('secciones')
    .update({ registro_abierto: abierto })
    .eq('id', id)
    .eq('instructor_id', instructor.id)

  if (error) return { ok: false, error: `No se pudo actualizar: ${error.message}` }

  revalidatePath('/instructor')
  return OK
}

/**
 * Borrado físico. El cascade de la base arrastra matrículas, sesiones y
 * asistencias de la sección, por eso el modal lo avisa antes de confirmar.
 */
export async function eliminarSeccion(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const instructor = await requiereInstructor()
  if (!instructor) return SIN_PERMISO

  const id = Number(formData.get('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: 'Sección no válida.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('secciones')
    .delete()
    .eq('id', id)
    .eq('instructor_id', instructor.id)

  if (error) {
    return { ok: false, error: `No se pudo eliminar la sección: ${error.message}` }
  }

  revalidatePath('/instructor')
  return OK
}
