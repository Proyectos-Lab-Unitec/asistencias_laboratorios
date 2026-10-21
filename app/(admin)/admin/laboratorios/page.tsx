import { requireRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import GestionLaboratorios from './gestion'
import type { ClaseOpcion, Laboratorio, SeccionResumen } from '@/lib/types'

// La sesión cambia según el request: se corta el prerender.
export const instant = false

export const metadata = { title: 'Laboratorios' }

/**
 * Sin tipos generados de la DB, supabase-js infiere los recursos embebidos
 * como arreglo aunque la relación sea many-to-one. Lo desenvolvemos a mano.
 */
function aObjeto<T>(valor: T | T[] | null): T | null {
  if (valor == null) return null
  return Array.isArray(valor) ? (valor[0] ?? null) : valor
}

export default async function LaboratoriosPage() {
  await requireRol('admin')

  const supabase = await createClient()

  const [{ data: laboratorios }, { data: secciones }, { data: clases }] =
    await Promise.all([
      supabase
        .from('laboratorios')
        .select(
          'id, nombre, clase_id, ubicacion, capacidad, activo, created_at, clases(nombre)'
        )
        .order('activo', { ascending: false })
        .order('nombre', { ascending: true }),
      supabase
        .from('secciones')
        .select(
          `id, laboratorio_id, grupo, horario,
           laboratorios(nombre), periodos(nombre, year), perfiles(nombre)`
        ),
      // Solo las activas se ofrecen al crear/editar: una clase dada de baja
      // deja de aparecer en los formularios pero no rompe lo ya guardado.
      supabase
        .from('clases')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre', { ascending: true }),
    ])

  const lista: Laboratorio[] = (laboratorios ?? []).map((lab) => ({
    id: lab.id,
    nombre: lab.nombre,
    clase_id: lab.clase_id ?? null,
    clase: aObjeto(lab.clases)?.nombre ?? null,
    ubicacion: lab.ubicacion ?? null,
    capacidad: lab.capacidad,
    activo: lab.activo,
    created_at: lab.created_at,
  }))

  // Las secciones de cada laboratorio: la tabla muestra cuántas son y el modal
  // que abre el botón de la fila las lista igual que en Instructores.
  const seccionesPorLaboratorio: Record<number, SeccionResumen[]> = {}
  for (const seccion of secciones ?? []) {
    const periodo = aObjeto(seccion.periodos)
    const instructor = aObjeto(seccion.perfiles)

    const resumen: SeccionResumen = {
      id: seccion.id,
      grupo: seccion.grupo,
      horario: seccion.horario,
      laboratorio: aObjeto(seccion.laboratorios)?.nombre ?? '—',
      periodo: periodo ? `${periodo.nombre} ${periodo.year}` : '—',
      instructor: instructor?.nombre ?? '—',
    }

    const bolsa = (seccionesPorLaboratorio[seccion.laboratorio_id] ??= [])
    bolsa.push(resumen)
  }

  const opcionesClase: ClaseOpcion[] = clases ?? []

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#06065c]">Laboratorios</h1>
        <p className="mt-1 text-sm text-gray-600">
          Registra los laboratorios disponibles y controla cuáles pueden tener
          secciones activas.
        </p>
      </header>

      <GestionLaboratorios
        laboratorios={lista}
        seccionesPorLaboratorio={seccionesPorLaboratorio}
        clases={opcionesClase}
      />
    </div>
  )
}
