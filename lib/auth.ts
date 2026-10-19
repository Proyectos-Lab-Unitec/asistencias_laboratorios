import { redirect } from 'next/navigation'
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
 * Obtiene el usuario autenticado con su perfil. Si no hay sesión, redirige a /login.
 */
export async function requireUsuario(): Promise<UsuarioActual> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombre, rol, activo, created_at')
    .eq('id', user.id)
    .single()

  if (!perfil || !perfil.activo) {
    await supabase.auth.signOut()
    redirect('/login')
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
 * Igual que requireUsuario, pero además exige un rol específico.
 */
export async function requireRol(rol: RolUsuario): Promise<UsuarioActual> {
  const usuario = await requireUsuario()
  if (usuario.rol !== rol) {
    redirect(usuario.rol === 'admin' ? '/admin' : '/instructor')
  }
  return usuario
}
