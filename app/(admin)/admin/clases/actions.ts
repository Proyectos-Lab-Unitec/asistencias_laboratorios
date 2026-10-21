'use server'

import { revalidatePath } from 'next/cache'
import { requiereAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { EstadoAccion } from '@/lib/types'

const OK: EstadoAccion = { ok: true, error: null }
const SIN_PERMISO: EstadoAccion = {
  ok: false,
  error: 'No tienes permiso para hacer esto.',
}
const RUTA = '/admin/clases'

function validar(formData: FormData):
  | { datos: { nombre: string } }
  | { error: string } {
  const nombre = String(formData.get('nombre') ?? '').trim()

  if (!nombre) return { error: 'El nombre es obligatorio.' }
  if (nombre.length > 120) return { error: 'El nombre es demasiado largo.' }

  return { datos: { nombre } }
}

async function obtenerAdmin() {
  const admin = await requiereAdmin()
  if (!admin) return null
  return createClient()
}

export async function crearClase(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const admin = await obtenerAdmin()
  if (!admin) return SIN_PERMISO

  const validado = validar(formData)
  if ('error' in validado) return { ok: false, error: validado.error }

  const { error } = await admin.from('clases').insert(validado.datos)
  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? 'Ya existe una clase con ese nombre.'
          : `No se pudo crear la clase: ${error.message}`,
    }
  }

  revalidatePath(RUTA)
  return OK
}

export async function actualizarClase(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const admin = await obtenerAdmin()
  if (!admin) return SIN_PERMISO

  const id = Number.parseInt(String(formData.get('id') ?? ''), 10)
  if (!Number.isInteger(id)) return { ok: false, error: 'Clase no válida.' }

  const validado = validar(formData)
  if ('error' in validado) return { ok: false, error: validado.error }

  const { error } = await admin
    .from('clases')
    .update(validado.datos)
    .eq('id', id)

  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? 'Ya existe una clase con ese nombre.'
          : `No se pudo actualizar: ${error.message}`,
    }
  }

  revalidatePath(RUTA)
  return OK
}

/**
 * Baja lógica (activo = false). Es la salida cuando la clase ya se usó: deja
 * de ofrecerse en los formularios sin borrar el histórico de matrículas.
 */
export async function alternarClase(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const admin = await obtenerAdmin()
  if (!admin) return SIN_PERMISO

  const id = Number.parseInt(String(formData.get('id') ?? ''), 10)
  if (!Number.isInteger(id)) return { ok: false, error: 'Clase no válida.' }

  // InterruptorEstado manda el valor nuevo en el campo "activo"
  const activo = String(formData.get('activo') ?? '') !== 'false'

  const { error } = await admin.from('clases').update({ activo }).eq('id', id)

  if (error) {
    return {
      ok: false,
      error: `No se pudo actualizar el estado: ${error.message}`,
    }
  }

  revalidatePath(RUTA)
  return OK
}

/**
 * Borrado físico. Las FKs de `laboratorios.clase_id` y `matriculas.clase_id`
 * son ON DELETE SET NULL: los registros que la usaban se quedan, solo pierden
 * la referencia. Por eso el modal avisa cuántos laboratorios quedan sin clase.
 */
export async function eliminarClase(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const admin = await obtenerAdmin()
  if (!admin) return SIN_PERMISO

  const id = Number.parseInt(String(formData.get('id') ?? ''), 10)
  if (!Number.isInteger(id)) return { ok: false, error: 'Clase no válida.' }

  const { error } = await admin.from('clases').delete().eq('id', id)

  if (error) {
    return { ok: false, error: `No se pudo eliminar: ${error.message}` }
  }

  revalidatePath(RUTA)
  return OK
}

/** Borrado múltiple: una sola sentencia para toda la selección de la tabla. */
export async function eliminarClases(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const admin = await obtenerAdmin()
  if (!admin) return SIN_PERMISO

  const ids = formData
    .getAll('ids')
    .map((valor) => Number.parseInt(String(valor), 10))
    .filter((id) => Number.isInteger(id) && id > 0)

  if (ids.length === 0) {
    return { ok: false, error: 'No hay clases seleccionadas.' }
  }

  const { error } = await admin.from('clases').delete().in('id', ids)

  if (error) {
    return {
      ok: false,
      error: `No se pudieron eliminar las clases: ${error.message}`,
    }
  }

  revalidatePath(RUTA)
  return OK
}
