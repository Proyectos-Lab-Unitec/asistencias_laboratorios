import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { RolUsuario } from '@/lib/types'

export type UsuarioActual = {
  id: string
  email: string
  nombre: string
  rol: RolUsuario
  created_at?: string | null
}

/**
 * Lee el usuario autenticado con su perfil.
 *
 * Devuelve `null` en lugar de redirigir, para que pueda usarse tanto en
 * layouts (vía requireUsuario) como en server actions (vía requiereAdmin),
 * donde redigirir no tiene sentido. Tampoco llama a connection(): esa
 * exclusión del prerender solo aplica a render, no a acciones.
 */
async function leerUsuario(): Promise<UsuarioActual | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombre, rol, activo, created_at')
    .eq('id', user.id)
    .single()

  if (!perfil || !perfil.activo) {
    await supabase.auth.signOut()
    return null
  }

  return {
    id: user.id,
    email: user.email ?? '',
    nombre: perfil.nombre,
    rol: perfil.rol as RolUsuario,
    created_at: perfil.created_at,
  }
}

/**
 * Obtiene el usuario autenticado con su perfil. Si no hay sesión, redirige a /login.
 */
export async function requireUsuario(): Promise<UsuarioActual> {
  // Corta el prerender: la sesión depende del request (cookie) y del momento
  // exacto (auth-js valida el vencimiento con Date.now()). Sin esto, con
  // cacheComponents activado, Next.js truena con "encountered the unstable
  // value `Date.now()` while prerendering".
  await connection()

  const usuario = await leerUsuario()
  if (!usuario) redirect('/login')
  return usuario
}

/**
 * Igual que requireUsuario, pero además exige un rol específico.
 */
export async function requireRol(rol: RolUsuario): Promise<UsuarioActual> {
  const usuario = await requireUsuario()
  if (usuario.rol !== rol) {
    redirect(usuario.rol === 'admin' ? '/admin' : '/instructor')
  }
  return usuario
}

/**
 * Para server actions: devuelve el usuario instructor activo o `null`.
 * Quien llama decide qué responder (en una acción no corresponde redirigir).
 */
export async function requiereInstructor(): Promise<UsuarioActual | null> {
  const usuario = await leerUsuario()
  if (!usuario || usuario.rol !== 'instructor') return null
  return usuario
}

/**
 * Para server actions: devuelve el usuario admin activo o `null`.
 * Quien llama decide qué responder (en una acción no corresponde redirigir).
 */
export async function requiereAdmin(): Promise<UsuarioActual | null> {
  const usuario = await leerUsuario()
  if (!usuario || usuario.rol !== 'admin') return null
  return usuario
}

/**
 * Para rutas que sirven a los dos roles por igual (la descarga del Excel).
 *
 * Evita encadenar `requiereAdmin() ?? requiereInstructor()`, que leería la
 * sesión y el perfil dos veces para el mismo request.
 */
export async function requiereUsuario(): Promise<UsuarioActual | null> {
  return leerUsuario()
}
