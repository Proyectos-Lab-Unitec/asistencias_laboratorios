import { requireRol } from '@/lib/auth'
import { DashboardShell, type NavItem } from '@/components/dashboard-shell'

// Este layout lee la sesión (cookies) en cada request, así que bloquea el
// prerender a propósito. Con cacheComponents activado esto es obligatorio:
// en lib/auth.ts cortamos con connection() y acá habilitamos la ruta
// bloqueante. Sin esta línea Next.js truena con "encountered uncached data
// during prerendering".
export const instant = false

const navItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: 'layout', end: true },
  { href: '/admin/laboratorios', label: 'Laboratorios', icon: 'box' },
  { href: '/admin/instructores', label: 'Instructores', icon: 'users' },
  { href: '/admin/reportes', label: 'Reportes', icon: 'file' },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const usuario = await requireRol('admin')

  return (
    <DashboardShell
      titulo="Panel Admin"
      perfil={{
        nombre: usuario.nombre,
        correo: usuario.email,
        rol: usuario.rol,
        created_at: usuario.created_at,
      }}
      navItems={navItems}
    >
      {children}
    </DashboardShell>
  )
}
