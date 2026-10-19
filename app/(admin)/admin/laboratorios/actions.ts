'use server'

import { revalidatePath } from 'next/cache'
import { requiereAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { EstadoAccion } from '@/lib/types'

type DatosLaboratorio = {
  nombre: string
  ubicacion: string | null
  capacidad: number
}

const OK: EstadoAccion = { ok: true, error: null }

function validar(formData: FormData):
  | { datos: DatosLaboratorio }
  | { error: string } {
  const nombre = String(formData.get('nombre') ?? '').trim()
  const ubicacion = String(formData.get('ubicacion') ?? '').trim()
  const capacidad = Number.parseInt(
    String(formData.get('capacidad') ?? '').trim(),
    10
  )

  if (!nombre) return { error: 'El nombre es obligatorio.' }
  if (nombre.length > 120) return { error: 'El nombre es demasiado largo.' }
  if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 100000) {
    return { error: 'La capacidad debe ser un número entero mayor a 0.' }
  }

  return {
    datos: {
      nombre,
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
