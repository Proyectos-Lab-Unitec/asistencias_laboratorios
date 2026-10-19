import { redirect } from 'next/navigation'
import { requireUsuario } from '@/lib/auth'

// Lee la sesión para decidir a dónde redirigir según el rol.
// Ver app/(admin)/layout.tsx por el detalle del prerender.
export const instant = false

export default async function HomePage() {
  const usuario = await requireUsuario()
  redirect(usuario.rol === 'admin' ? '/admin' : '/instructor')
}
