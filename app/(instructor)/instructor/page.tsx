import { requireRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import GestionSecciones from './gestion'
import type {
  LaboratorioOpcion,
  PeriodoOpcion,
  SeccionFila,
} from '@/lib/types'

// La sesión cambía según el request: se corta el prerender.
export const instant = false

export const metadata = { title: 'Mis secciones' }

/**
 * Sin tipos generados de la DB, supabase-js infiere los recursos embebidos
 * como arreglo aunque la relación sea many-to-one. Lo desenvolvemos a mano.
 * Mismo helper que usa el admin en instructores/page.tsx.
 */
function aObjeto<T>(valor: T | T[] | null): T | null {
  if (valor == null) return null
  return Array.isArray(valor) ? (valor[0] ?? null) : valor
}

export default async function InstructorPage() {
  const usuario = await requireRol('instructor')

  const supabase = await createClient()

  // RLS ya limita secciones y matrículas a las del usuario de la sesión,
  // así que el filtro por instructor_id es redundante pero explícito.
  const [{ data: secciones }, { data: laboratorios }, { data: periodos }, { data: matriculas }] =
    await Promise.all([
      supabase
        .from('secciones')
        .select(
          `id, laboratorio_id, periodo_id, grupo, horario, docente,
           registro_abierto, token_registro,
           laboratorios(nombre), periodos(nombre, year)`
        )
        .eq('instructor_id', usuario.id)
        .order('grupo', { ascending: true }),
      supabase
        .from('laboratorios')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre', { ascending: true }),
      // El periodo más reciente primero: es el que casi siempre se elige.
      supabase
        .from('periodos')
        .select('id, year, nombre, fecha_inicio')
        .order('fecha_inicio', { ascending: false }),
      supabase.from('matriculas').select('seccion_id'),
    ])

  const alumnosPorSeccion: Record<number, number> = {}
  for (const matricula of matriculas ?? []) {
    alumnosPorSeccion[matricula.seccion_id] =
      (alumnosPorSeccion[matricula.seccion_id] ?? 0) + 1
  }

  const filas: SeccionFila[] = (secciones ?? []).map((seccion) => {
    const laboratorio = aObjeto(seccion.laboratorios)
    const periodo = aObjeto(seccion.periodos)

    return {
      id: seccion.id,
      laboratorio_id: seccion.laboratorio_id,
      periodo_id: seccion.periodo_id,
      laboratorio: laboratorio?.nombre ?? '—',
      periodo: periodo ? `${periodo.nombre} ${periodo.year}` : '—',
      grupo: seccion.grupo,
      horario: seccion.horario,
      docente: seccion.docente,
      registro_abierto: seccion.registro_abierto,
      token_registro: seccion.token_registro,
      alumnos: alumnosPorSeccion[seccion.id] ?? 0,
    }
  })

  const opcionesLaboratorios: LaboratorioOpcion[] = (laboratorios ?? []).map(
    (lab) => ({ id: lab.id, nombre: lab.nombre })
  )

  const opcionesPeriodos: PeriodoOpcion[] = (periodos ?? []).map((p) => ({
    id: p.id,
    etiqueta: `${p.nombre} ${p.year}`,
  }))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#06065c]">Mis secciones</h1>
        <p className="mt-1 text-sm text-gray-600">
          Crea tus secciones de laboratorio y comparte su QR para que los
          alumnos se inscriban el primer día.
        </p>
      </header>

      <GestionSecciones
        secciones={filas}
        laboratorios={opcionesLaboratorios}
        periodos={opcionesPeriodos}
      />
    </div>
  )
}
