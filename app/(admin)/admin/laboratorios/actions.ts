'use server'

import { revalidatePath } from 'next/cache'
import { requiereAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { EstadoAccion } from '@/lib/types'

type DatosLaboratorio = {
  nombre: string
  clase_id: number
  ubicacion: string | null
  capacidad: number
}

const OK: EstadoAccion = { ok: true, error: null }

function validar(formData: FormData):
  | { datos: DatosLaboratorio }
  | { error: string } {
  const nombre = String(formData.get('nombre') ?? '').trim()
  const claseId = Number.parseInt(
    String(formData.get('clase_id') ?? '').trim(),
    10
  )
  const ubicacion = String(formData.get('ubicacion') ?? '').trim()
  const capacidad = Number.parseInt(
    String(formData.get('capacidad') ?? '').trim(),
    10
  )

  if (!nombre) return { error: 'El nombre es obligatorio.' }
  if (nombre.length > 120) return { error: 'El nombre es demasiado largo.' }
  // La clase sale del catálogo: sin ella el laboratorio no sirve para filtrar
  // reportes ni para que el alumno elija su materia.
  if (!Number.isInteger(claseId) || claseId <= 0) {
    return { error: 'Elige una clase.' }
  }
  if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 100000) {
    return { error: 'La capacidad debe ser un número entero mayor a 0.' }
  }

  return {
    datos: {
      nombre,
      clase_id: claseId,
      ubicacion: ubicacion ? ubicacion : null,
      capacidad,
    },
  }
}

async function obtenerAdmin() {
  const admin = await requiereAdmin()
  if (!admin) return null
  return createClient()
}

export async function crearLaboratorio(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const admin = await obtenerAdmin()
  if (!admin) return { ok: false, error: 'No tienes permiso para hacer esto.' }

  const validado = validar(formData)
  if ('error' in validado) return { ok: false, error: validado.error }

  const { error } = await admin.from('laboratorios').insert(validado.datos)
  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? 'Ya existe un laboratorio con ese nombre.'
          : `No se pudo crear el laboratorio: ${error.message}`,
    }
  }

  revalidatePath('/admin/laboratorios')
  return OK
}

export async function actualizarLaboratorio(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const admin = await obtenerAdmin()
  if (!admin) return { ok: false, error: 'No tienes permiso para hacer esto.' }

  const id = Number.parseInt(String(formData.get('id') ?? ''), 10)
  if (!Number.isInteger(id)) {
    return { ok: false, error: 'Laboratorio no válido.' }
  }

  const validado = validar(formData)
  if ('error' in validado) return { ok: false, error: validado.error }

  const { error } = await admin
    .from('laboratorios')
    .update(validado.datos)
    .eq('id', id)

  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? 'Ya existe un laboratorio con ese nombre.'
          : `No se pudo actualizar: ${error.message}`,
    }
  }

  revalidatePath('/admin/laboratorios')
  return OK
}

/**
 * Baja lógica (activo = false). No borra de verdad porque secciones y
 * matrículas referencian el laboratorio.
 */
/**
 * Borrado físico. La FK de secciones.laboratorio_id propaga en cascada
 * (migración 20261018020000), así que desaparecen también matrículas,
 * sesiones y asistencias de ese laboratorio.
 */
export async function eliminarLaboratorio(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const admin = await obtenerAdmin()
  if (!admin) return { ok: false, error: 'No tienes permiso para hacer esto.' }

  const id = Number.parseInt(String(formData.get('id') ?? ''), 10)
  if (!Number.isInteger(id)) {
    return { ok: false, error: 'Laboratorio no válido.' }
  }

  const { error } = await admin.from('laboratorios').delete().eq('id', id)

  if (error) {
    return {
      ok: false,
      error:
        error.code === '23503'
          ? 'No se pudo eliminar: el laboratorio todavía tiene registros asociados.'
          : `No se pudo eliminar: ${error.message}`,
    }
  }

  revalidatePath('/admin/laboratorios')
  return OK
}

export async function alternarLaboratorio(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const admin = await obtenerAdmin()
  if (!admin) return { ok: false, error: 'No tienes permiso para hacer esto.' }

  const id = Number.parseInt(String(formData.get('id') ?? ''), 10)
  const activoRaw = String(formData.get('activo') ?? '')
  if (!Number.isInteger(id)) {
    return { ok: false, error: 'Laboratorio no válido.' }
  }
  const activo = activoRaw !== 'false'

  const { error } = await admin
    .from('laboratorios')
    .update({ activo })
    .eq('id', id)

  if (error) return { ok: false, error: `No se pudo actualizar: ${error.message}` }

  revalidatePath('/admin/laboratorios')
  return OK
}

/**
 * Borrado múltiple. Igual que el individual, la cascada de
 * `secciones.laboratorio_id` se lleva matrículas, sesiones y asistencias.
 */
export async function eliminarLaboratorios(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const admin = await obtenerAdmin()
  if (!admin) return { ok: false, error: 'No tienes permiso para hacer esto.' }

  const ids = formData
    .getAll('ids')
    .map((valor) => Number.parseInt(String(valor), 10))
    .filter((id) => Number.isInteger(id) && id > 0)

  if (ids.length === 0) {
    return { ok: false, error: 'No hay laboratorios seleccionados.' }
  }

  const { error } = await admin.from('laboratorios').delete().in('id', ids)

  if (error) {
    return {
      ok: false,
      error: `No se pudieron eliminar los laboratorios: ${error.message}`,
    }
  }

  revalidatePath('/admin/laboratorios')
  return OK
}
