import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FiArrowLeft } from 'react-icons/fi'
import { requireRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { ClaseOpcion } from '@/lib/types'
import { aObjeto } from '@/lib/utils'
import EspacioSeccion from './seccion-tabs'
import type { AlumnoNota } from './notas'
import type { SesionAsistencia } from './grilla'

// La sesión y los datos cambian por request: se corta el prerender.
export const instant = false

export const metadata = { title: 'Sección' }

type FilaAsistencia = { matricula_id: number; presente: boolean }

export default async function PaginaSeccion({
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

  const [{ data: matriculas }, { data: sesiones }, { data: clases }] =
    await Promise.all([
      supabase
        .from('matriculas')
        .select(
          'id, numero_cuenta, nombre, nota_final, docente, clase_id, seccion_clase, carrera, correo, clases(nombre)'
        )
        .eq('seccion_id', seccionId)
        .order('nombre', { ascending: true }),
      // Las asistencias vienen embebidas en su sesión: una consulta en vez de
      // dos, y así la grilla se arma de una sola pasada.
      supabase
        .from('sesiones')
        .select('id, fecha, estado, asistencias(matricula_id, presente)')
        .eq('seccion_id', seccionId)
        .order('fecha', { ascending: true }),
      // Catálogo para el alta manual de alumnos: mismo criterio que el QR,
      // solo se ofrecen las clases activas.
      supabase
        .from('clases')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre', { ascending: true }),
    ])

  const laboratorio = aObjeto(seccion.laboratorios)
  const periodo = aObjeto(seccion.periodos)

  const alumnos: AlumnoNota[] = (matriculas ?? []).map((m) => ({
    id: m.id,
    numero_cuenta: m.numero_cuenta,
    nombre: m.nombre,
    docente: (m.docente as string | null) ?? null,
    clase_id: (m.clase_id as number | null) ?? null,
    clase: aObjeto(m.clases)?.nombre ?? null,
    seccion_clase: (m.seccion_clase as string | null) ?? null,
    carrera: (m.carrera as string | null) ?? null,
    correo: (m.correo as string | null) ?? null,
    nota_final: m.nota_final as number | null,
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
      <header className="space-y-2">
        <Link
          href="/instructor"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#06065c] hover:underline"
        >
          <FiArrowLeft size={15} />
          Mis secciones
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-[#06065c]">
            Sección {seccion.grupo}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {laboratorio?.nombre ?? '—'}
            {periodo ? ` · ${periodo.nombre} ${periodo.year}` : ''}
            {seccion.horario ? ` · ${seccion.horario}` : ''}
          </p>
        </div>
      </header>

      <EspacioSeccion
        seccionId={seccionId}
        alumnos={alumnos}
        sesiones={sesionesFinales}
        clases={(clases ?? []) as ClaseOpcion[]}
      />
    </div>
  )
}
