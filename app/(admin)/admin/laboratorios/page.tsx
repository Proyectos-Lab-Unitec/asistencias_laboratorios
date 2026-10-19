import { requireRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import GestionLaboratorios from './gestion'

// La sesión cambia según el request: se corta el prerender.
export const instant = false

export const metadata = { title: 'Laboratorios' }

export default async function LaboratoriosPage() {
  await requireRol('admin')

  const supabase = await createClient()

  const { data } = await supabase
    .from('laboratorios')
    .select('id, nombre, ubicacion, capacidad, activo, created_at')
    .order('activo', { ascending: false })
    .order('nombre', { ascending: true })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#06065c]">Laboratorios</h1>
        <p className="mt-1 text-sm text-gray-600">
          Registra los laboratorios disponibles y controla cuáles pueden tener
          secciones activas.
        </p>
      </header>

      <GestionLaboratorios laboratorios={data ?? []} />
    </div>
  )
}
