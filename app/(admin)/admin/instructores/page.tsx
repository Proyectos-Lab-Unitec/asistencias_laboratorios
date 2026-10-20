import { requireRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import GestionInstructores from './gestion'
import type { SeccionResumen } from '@/lib/types'

// La sesión cambia según el request: se corta el prerender.
export const instant = false

export const metadata = { title: 'Instructores' }

/**
 * Sin tipos generados de la DB, supabase-js infiere los recursos embebidos
 * como arreglo aunque la relación sea many-to-one. Lo desenvolvemos a mano.
 */
function aObjeto<T>(valor: T | T[] | null): T | null {
  if (valor == null) return null
  return Array.isArray(valor) ? (valor[0] ?? null) : valor
}

export default async function InstructoresPage() {
  await requireRol('admin')

  const supabase = await createClient()

  // Solo cuentas de instructor: el admin no se lista a sí mismo acá.
  const [{ data: cuentas }, { data: secciones }] = await Promise.all([
    supabase
      .from('perfiles')
      .select('id, email, rol, nombre, activo, created_at')
      .eq('rol', 'instructor')
      .order('activo', { ascending: false })
      .order('nombre', { ascending: true }),
    supabase.from('secciones').select(
      `id, instructor_id, grupo, horario,
       laboratorios(nombre), periodos(nombre, year)`
    ),
  ])

  const seccionesPorInstructor: Record<string, SeccionResumen[]> = {}
  for (const seccion of secciones ?? []) {
    const laboratorio = aObjeto(seccion.laboratorios)
    const periodo = aObjeto(seccion.periodos)

    const resumen: SeccionResumen = {
      id: seccion.id,
      grupo: seccion.grupo,
      horario: seccion.horario,
      laboratorio: laboratorio?.nombre ?? '—',
      periodo: periodo ? `${periodo.nombre} ${periodo.year}` : '—',
    }
    const lista = (seccionesPorInstructor[seccion.instructor_id] ??= [])
    lista.push(resumen)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#06065c]">Instructores</h1>
        <p className="mt-1 text-sm text-gray-600">
          Crea y administra las cuentas de los instructores. Haz clic en un
          nombre para ver las secciones que maneja.
        </p>
      </header>

      <GestionInstructores
        cuentas={cuentas ?? []}
        seccionesPorInstructor={seccionesPorInstructor}
      />
    </div>
  )
}
