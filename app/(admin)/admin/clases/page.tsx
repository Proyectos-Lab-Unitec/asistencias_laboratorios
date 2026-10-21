import { requireRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import GestionClases from './gestion'

// La sesión cambia según el request: se corta el prerender.
export const instant = false

export const metadata = { title: 'Clases' }

export default async function ClasesPage() {
  await requireRol('admin')

  const supabase = await createClient()

  const [{ data: clases }, { data: laboratorios }] = await Promise.all([
    supabase
      .from('clases')
      .select('id, nombre, activo, created_at')
      .order('activo', { ascending: false })
      .order('nombre', { ascending: true }),
    // Solo se necesita saber cuántos laboratorios usan cada clase: es lo que
    // avisa el modal antes de un borrado físico.
    supabase.from('laboratorios').select('clase_id'),
  ])

  const usosPorClase: Record<number, number> = {}
  for (const laboratorio of laboratorios ?? []) {
    if (laboratorio.clase_id == null) continue
    usosPorClase[laboratorio.clase_id] =
      (usosPorClase[laboratorio.clase_id] ?? 0) + 1
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#06065c]">Clases</h1>
        <p className="mt-1 text-sm text-gray-600">
          Catálogo de materias (Física 1, Química, ...). Se elige al crear un
          laboratorio y también al inscribir a un alumno.
        </p>
      </header>

      <GestionClases
        clases={clases ?? []}
        usosPorClase={usosPorClase}
      />
    </div>
  )
}
