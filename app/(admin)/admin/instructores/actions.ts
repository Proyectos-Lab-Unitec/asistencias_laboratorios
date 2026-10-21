'use server'

import { revalidatePath } from 'next/cache'
import { requiereAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EstadoAccion } from '@/lib/types'

const OK: EstadoAccion = { ok: true, error: null }
const SIN_PERMISO: EstadoAccion = {
  ok: false,
  error: 'No tienes permiso para hacer esto.',
}

const RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validarCreacion(
  formData: FormData
): { datos: { email: string; password: string; nombre: string } } | { error: string } {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const nombre = String(formData.get('nombre') ?? '').trim()

  if (!email) return { error: 'El correo es obligatorio.' }
  if (!RE.test(email)) return { error: 'El correo no tiene un formato válido.' }
  if (!nombre) return { error: 'El nombre es obligatorio.' }
  if (nombre.length > 120) return { error: 'El nombre es demasiado largo.' }
  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres.' }
  }

  return { datos: { email, password, nombre } }
}

function mapearErrorAuth(error: { code?: string; message: string }): string {
  if (error.code === 'email_exists' || /already been registered/i.test(error.message)) {
    return 'Ya existe una cuenta con ese correo.'
  }
  if (error.code === 'weak_password' || /password should be/i.test(error.message)) {
    return 'La contraseña es demasiado débil (mínimo 6 caracteres).'
  }
  return `No se pudo crear la cuenta: ${error.message}`
}

/**
 * Crea la cuenta en auth.users con la Admin API (service role) y deja el
 * perfil como instructor. El trigger handle_new_user ya crea el perfil con
 * el nombre y el correo; acá solo reafirmamos el rol.
 */
export async function crearInstructor(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const admin = await requiereAdmin()
  if (!admin) return SIN_PERMISO

  const validado = validarCreacion(formData)
  if ('error' in validado) return { ok: false, error: validado.error }

  const auth = createAdminClient()

  const { data, error } = await auth.auth.admin.createUser({
    email: validado.datos.email,
    password: validado.datos.password,
    email_confirm: true,
    user_metadata: { nombre: validado.datos.nombre },
  })

  if (error) return { ok: false, error: mapearErrorAuth(error) }
  if (!data.user) {
    return { ok: false, error: 'La cuenta no se creó correctamente. Inténtalo de nuevo.' }
  }

  // Por si el trigger creó el perfil con otro rol o nombre
  const { error: errorPerfil } = await auth
    .from('perfiles')
    .update({ rol: 'instructor', nombre: validado.datos.nombre })
    .eq('id', data.user.id)

  if (errorPerfil) {
    return {
      ok: false,
      error: `La cuenta se creó pero no se pudo asignar el rol: ${errorPerfil.message}`,
    }
  }

  revalidatePath('/admin/instructores')
  return OK
}

export async function actualizarInstructor(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const admin = await requiereAdmin()
  if (!admin) return SIN_PERMISO

  const id = String(formData.get('id') ?? '').trim()
  const nombre = String(formData.get('nombre') ?? '').trim()

  if (!id) return { ok: false, error: 'Cuenta no válida.' }
  if (!nombre) return { ok: false, error: 'El nombre es obligatorio.' }
  if (nombre.length > 120) return { ok: false, error: 'El nombre es demasiado largo.' }

  // RLS ya solo deja que un admin toque perfiles ajenos; uso la sesión del
  // usuario (no la service role) para que el permiso quede verificado.
  const supabase = await createClient()
  const { error } = await supabase
    .from('perfiles')
    .update({ nombre })
    .eq('id', id)
    .eq('rol', 'instructor')

  if (error) return { ok: false, error: `No se pudo actualizar: ${error.message}` }

  revalidatePath('/admin/instructores')
  return OK
}

/**
 * Baja/alta lógica. No borra la cuenta: si el instructor ya tiene secciones,
 * hay que conservar el registro. Un perfil inactivo no puede iniciar sesión.
 */
export async function alternarInstructor(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const admin = await requiereAdmin()
  if (!admin) return SIN_PERMISO

  const id = String(formData.get('id') ?? '').trim()
  const activo = String(formData.get('activo') ?? '') !== 'false'

  if (!id) return { ok: false, error: 'Cuenta no válida.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('perfiles')
    .update({ activo })
    .eq('id', id)
    .eq('rol', 'instructor')

  if (error) return { ok: false, error: `No se pudo actualizar: ${error.message}` }

  revalidatePath('/admin/instructores')
  return OK
}

/**
 * Borrado físico de la cuenta. Borra el usuario en auth.users y el cascade
 * de perfiles arrastra el resto: secciones, y por cascada también
 * matrículas, sesiones y asistencias.
 */
export async function eliminarInstructor(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const admin = await requiereAdmin()
  if (!admin) return SIN_PERMISO

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { ok: false, error: 'Cuenta no válida.' }

  // Un admin no puede borrarse a sí mismo desde el propio panel
  if (id === admin.id) {
    return {
      ok: false,
      error: 'No puedes eliminar la cuenta con la que estás usando el sistema.',
    }
  }

  const auth = createAdminClient()
  const { error } = await auth.auth.admin.deleteUser(id)

  if (error) {
    return { ok: false, error: `No se pudo eliminar la cuenta: ${error.message}` }
  }

  revalidatePath('/admin/instructores')
  return OK
}

/**
 * Borrado múltiple. La Admin API no tiene un "delete users" en lote, así que
 * se borra una por una en paralelo; si alguna falla se reporta cuántas
 * quedaron para que el admin pueda reintentar solo con esas.
 */
export async function eliminarInstructores(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const admin = await requiereAdmin()
  if (!admin) return SIN_PERMISO

  const ids = formData
    .getAll('ids')
    .map((valor) => String(valor).trim())
    .filter(Boolean)

  // El chequeo de "no te borres a ti mismo" va acá y no solo en la UI.
  const seleccion = ids.filter((id) => id !== admin.id)
  if (seleccion.length === 0) {
    return { ok: false, error: 'No hay cuentas seleccionadas.' }
  }

  const auth = createAdminClient()
  const resultados = await Promise.all(
    seleccion.map((id) => auth.auth.admin.deleteUser(id))
  )

  const fallos = resultados.filter((r) => r.error).length
  if (fallos > 0) {
    return {
      ok: false,
      error: `Se eliminaron ${
        seleccion.length - fallos
      } de ${seleccion.length} cuentas. Vuelve a intentarlo con el resto.`,
    }
  }

  revalidatePath('/admin/instructores')
  return OK
}
