import { requireRol } from '@/lib/auth'
import { DashboardShell, type NavItem } from '@/components/dashboard-shell'

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
