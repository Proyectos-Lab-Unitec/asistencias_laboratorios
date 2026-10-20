import { notFound } from 'next/navigation'
import { requireRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import GrillaAsistencia, {
  type AlumnoAsistencia,
  type SesionAsistencia,
} from './grilla'

// La sesión y los datos cambian por request: se corta el prerender.
export const instant = false

export const metadata = { title: 'Asistencia' }

/**
 * Sin tipos generados de la DB, supabase-js infiere los recursos embebidos
 * como arreglo aunque la relación sea many-to-one. Lo desenvolvemos a mano.
 */
function aObjeto<T>(valor: T | T[] | null): T | null {
  if (valor == null) return null
  return Array.isArray(valor) ? (valor[0] ?? null) : valor
}

type FilaAsistencia = { matricula_id: number; presente: boolean }

export default async function PaginaAsistencia({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const usuario = await requireRol('instructor')
  const { id } = await params

  const seccionId = Number(id)
  if (!Number.isInteger(seccionId) || seccionId <= 0) notFound()

  const supabase = await createClient()

  // RLS ya acota a las secciones propias; el filtro por instructor_id además
  // deja la intención explícita y evita un 404 confuso si el id es ajeno.
  const { data: seccion } = await supabase
    .from('secciones')
    .select('id, grupo, horario, laboratorios(nombre), periodos(nombre, year)')
    .eq('id', seccionId)
    .eq('instructor_id', usuario.id)
    .maybeSingle()

  if (!seccion) notFound()

  const [{ data: matriculas }, { data: sesiones }] = await Promise.all([
    supabase
      .from('matriculas')
      .select('id, numero_cuenta, nombre')
      .eq('seccion_id', seccionId)
      .order('nombre', { ascending: true }),
    // Las asistencias vienen embebidas en su sesión: una consulta en vez de
    // dos, y así la grilla se arma de una sola pasada.
    supabase
      .from('sesiones')
      .select('id, fecha, estado, asistencias(matricula_id, presente)')
      .eq('seccion_id', seccionId)
      .order('fecha', { ascending: true }),
  ])

  const laboratorio = aObjeto(seccion.laboratorios)
  const periodo = aObjeto(seccion.periodos)

  const alumnos: AlumnoAsistencia[] = (matriculas ?? []).map((m) => ({
    id: m.id,
    numero_cuenta: m.numero_cuenta,
    nombre: m.nombre,
  }))

  // De cada sesión solo interesan los ids de los presentes: la grilla compara
  // contra eso para pintar cada casilla.
  const sesionesFinales: SesionAsistencia[] = (sesiones ?? []).map((s) => {
    const filas = (s.asistencias ?? []) as unknown as FilaAsistencia[]
    return {
      id: s.id,
      fecha: s.fecha,
      estado: s.estado as 'abierta' | 'cerrada',
      presentes: filas.filter((a) => a.presente).map((a) => a.matricula_id),
    }
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#06065c]">Asistencia</h1>
        <p className="mt-1 text-sm text-gray-600">
          {laboratorio?.nombre ?? '—'} · Sección {seccion.grupo}
          {periodo ? ` · ${periodo.nombre} ${periodo.year}` : ''}
          {seccion.horario ? ` · ${seccion.horario}` : ''}
        </p>
      </header>

      <GrillaAsistencia
        seccionId={seccionId}
        alumnos={alumnos}
        sesiones={sesionesFinales}
      />
    </div>
  )
}
