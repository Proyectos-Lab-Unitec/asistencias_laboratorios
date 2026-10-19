import { requireRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import GestionInstructores from './gestion'

// La sesión cambia según el request: se corta el prerender.
export const instant = false

export const metadata = { title: 'Instructores' }

export default async function InstructoresPage() {
  await requireRol('admin')

  const supabase = await createClient()

  // Solo cuentas de instructor: el admin no se lista a sí mismo acá.
  const { data } = await supabase
    .from('perfiles')
    .select('id, email, rol, nombre, activo, created_at')
    .eq('rol', 'instructor')
    .order('activo', { ascending: false })
    .order('nombre', { ascending: true })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#06065c]">Instructores</h1>
        <p className="mt-1 text-sm text-gray-600">
          Crea y administra las cuentas de los instructores. Una cuenta
          desactivada no puede iniciar sesión, pero conserva sus secciones.
        </p>
      </header>

      <GestionInstructores cuentas={data ?? []} />
    </div>
  )
}
