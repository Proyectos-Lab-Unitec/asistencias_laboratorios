import { requireRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { aObjeto } from '@/lib/utils'
import GestionLaboratorios from './gestion'
import type {
  ClaseOpcion,
  DetalleSeccion,
  Laboratorio,
  SeccionResumen,
} from '@/lib/types'

// La sesión cambia según el request: se corta el prerender.
export const instant = false

export const metadata = { title: 'Laboratorios' }

export default async function LaboratoriosPage() {
  await requireRol('admin')

  const supabase = await createClient()

  const [
    { data: laboratorios },
    { data: secciones },
    { data: clases },
    { data: matriculas },
    { data: sesiones },
  ] = await Promise.all([
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
    // Alumnos y sesiones se cargan de una vez: el detalle de una sección se
    // abre dentro del modal, sin volver al servidor por cada clic.
    supabase
      .from('matriculas')
      .select(
        'id, seccion_id, numero_cuenta, nombre, docente, nota_final, seccion_clase, clases(nombre)'
      )
      .order('nombre', { ascending: true }),
    supabase
      .from('sesiones')
      .select('id, seccion_id, asistencias(matricula_id, presente)'),
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

  // Detalle de cada sección para el modal: sus alumnos con la asistencia ya
  // contada (presentes sobre el total de sesiones de esa sección) y su nota.
  const sesionesPorSeccion: Record<number, number> = {}
  const presentesPorMatricula = new Map<number, number>()

  for (const sesion of sesiones ?? []) {
    sesionesPorSeccion[sesion.seccion_id] =
      (sesionesPorSeccion[sesion.seccion_id] ?? 0) + 1

    const marcas = (sesion.asistencias ?? []) as unknown as {
      matricula_id: number
      presente: boolean
    }[]
    for (const marca of marcas) {
      if (!marca.presente) continue
      presentesPorMatricula.set(
        marca.matricula_id,
        (presentesPorMatricula.get(marca.matricula_id) ?? 0) + 1
      )
    }
  }

  const detallePorSeccion: Record<number, DetalleSeccion> = {}
  for (const seccion of secciones ?? []) {
    detallePorSeccion[seccion.id] = {
      sesiones: sesionesPorSeccion[seccion.id] ?? 0,
      alumnos: [],
    }
  }

  for (const matricula of matriculas ?? []) {
    const detalle = detallePorSeccion[matricula.seccion_id]
    if (!detalle) continue

    detalle.alumnos.push({
      id: matricula.id,
      numeroCuenta: matricula.numero_cuenta,
      nombre: matricula.nombre,
      docente: matricula.docente ?? null,
      clase: aObjeto(matricula.clases)?.nombre ?? null,
      seccionClase: matricula.seccion_clase ?? null,
      notaFinal: matricula.nota_final ?? null,
      presentes: presentesPorMatricula.get(matricula.id) ?? 0,
    })
  }

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
        detallePorSeccion={detallePorSeccion}
        clases={opcionesClase}
      />
    </div>
  )
}
