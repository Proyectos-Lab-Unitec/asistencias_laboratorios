import { redirect } from 'next/navigation'
import { requireUsuario } from '@/lib/auth'

export default async function HomePage() {
  const usuario = await requireUsuario()
  redirect(usuario.rol === 'admin' ? '/admin' : '/instructor')
}
