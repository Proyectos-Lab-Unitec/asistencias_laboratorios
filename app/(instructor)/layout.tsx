import { requireRol } from '@/lib/auth'
import { DashboardShell, type NavItem } from '@/components/dashboard-shell'

// Lee la sesión por request: se opta out del prerender con cacheComponents.
// Ver app/(admin)/layout.tsx.
export const instant = false

const navItems: NavItem[] = [
  { href: '/instructor', label: 'Mis secciones', icon: 'layout', end: true },
  { href: '/instructor/reportes', label: 'Reportes', icon: 'file' },
]

export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const usuario = await requireRol('instructor')

  return (
    <DashboardShell
      titulo="Panel Instructor"
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
