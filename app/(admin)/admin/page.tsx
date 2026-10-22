import Link from 'next/link'
import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronRight,
  FiFileText,
} from 'react-icons/fi'
import { requireRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { aObjeto, plural } from '@/lib/utils'

// La sesión y los datos cambian por request: se corta el prerender.
export const instant = false

export const metadata = { title: 'Panel' }

const MS_DIA = 86_400_000

const FORMATO_DIA = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
})

const CLASE_BOTON =
  'inline-flex items-center gap-1.5 rounded-lg bg-[#06065c] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0f49b6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06065c]'

const CLASE_TITULO_SECCION =
  'text-sm font-bold uppercase tracking-wide text-[#06065c]'

/** `new Date('2026-10-01')` se interpreta en UTC; acá queremos fecha local. */
function aFecha(iso: string) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

/** Fecha local del servidor en formato date de Postgres. */
function hoyIso() {
  const ahora = new Date()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${ahora.getFullYear()}-${mes}-${dia}`
}

function fechaCorta(iso: string) {
  return FORMATO_DIA.format(aFecha(iso)).replace('.', '')
}

type SeccionDashboard = {
  id: number
  laboratorio: string
  clase: string
  grupo: string
  instructor: string
  alumnos: number
  sesiones: number
  asistencia: number | null
  conNota: number
  registroAbierto: boolean
}

type Pendiente = {
  clave: string
  titulo: string
  detalle: string
  href: string
}

export default async function AdminPage() {
  await requireRol('admin')

  const supabase = await createClient()

  const { data: periodos } = await supabase
    .from('periodos')
    .select('id, year, nombre, fecha_inicio, fecha_fin')
    .order('fecha_inicio', { ascending: false })

  const hoy = hoyIso()
  const periodoActual =
    (periodos ?? []).find(
      (periodo) => periodo.fecha_inicio <= hoy && hoy <= periodo.fecha_fin
    ) ??
    (periodos ?? [])[0] ??
    null

  const [{ data: secciones }, { data: instructores }, { data: laboratorios }, { data: clases }] =
    await Promise.all([
      supabase
        .from('secciones')
        .select(
          'id, grupo, instructor_id, registro_abierto, laboratorios(nombre, clases(nombre)), perfiles(nombre)'
        )
        .eq('periodo_id', periodoActual?.id ?? -1)
        .order('id', { ascending: true }),
      supabase
        .from('perfiles')
        .select('id, nombre, activo')
        .eq('rol', 'instructor')
        .order('nombre', { ascending: true }),
      supabase.from('laboratorios').select('id'),
      supabase.from('clases').select('id'),
    ])

  const idsSecciones = (secciones ?? []).map((seccion) => seccion.id)

  const { data: matriculas } = idsSecciones.length
    ? await supabase
        .from('matriculas')
        .select('id, seccion_id, nota_final')
        .in('seccion_id', idsSecciones)
    : { data: [] }

  const { data: sesiones } = idsSecciones.length
    ? await supabase
        .from('sesiones')
        .select('id, seccion_id, asistencias(matricula_id, presente)')
        .in('seccion_id', idsSecciones)
    : { data: [] }

  // ---------- Avance por sección ----------
  const presentesPorMatricula = new Map<number, number>()
  const sesionesPorSeccion = new Map<number, number>()

  for (const sesion of sesiones ?? []) {
    const seccionId = sesion.seccion_id as number
    sesionesPorSeccion.set(
      seccionId,
      (sesionesPorSeccion.get(seccionId) ?? 0) + 1
    )

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

  const filas: SeccionDashboard[] = (secciones ?? []).map((seccion) => {
    const laboratorio = aObjeto(
      seccion.laboratorios as unknown as {
        nombre: string
        clases: unknown
      } | null
    )
    const clase = laboratorio
      ? aObjeto(laboratorio.clases as unknown as { nombre: string } | null)
      : null
    const instructor = aObjeto(
      seccion.perfiles as unknown as { nombre: string } | null
    )

    const propias = (matriculas ?? []).filter(
      (matricula) => matricula.seccion_id === seccion.id
    )
    const sesionesDeLaSeccion = sesionesPorSeccion.get(seccion.id) ?? 0

    // Mismo criterio que el reporte: presentes sobre sesiones de la sección,
    // promediado entre los alumnos.
    const asistencia =
      sesionesDeLaSeccion === 0 || propias.length === 0
        ? null
        : Math.round(
            (propias.reduce(
              (suma, matricula) =>
                suma +
                (presentesPorMatricula.get(matricula.id) ?? 0) /
                  sesionesDeLaSeccion,
              0
            ) /
              propias.length) *
              100
          )

    return {
      id: seccion.id,
      laboratorio: laboratorio?.nombre ?? '—',
      clase: clase?.nombre ?? '',
      grupo: seccion.grupo ?? '—',
      instructor: instructor?.nombre ?? '—',
      alumnos: propias.length,
      sesiones: sesionesDeLaSeccion,
      asistencia,
      conNota: propias.filter((matricula) => matricula.nota_final !== null)
        .length,
      registroAbierto: seccion.registro_abierto === true,
    }
  })

  filas.sort(
    (a, b) =>
      a.laboratorio.localeCompare(b.laboratorio, 'es') ||
      a.grupo.localeCompare(b.grupo, 'es')
  )

  // ---------- Totales ----------
  const totalAlumnos = filas.reduce((suma, fila) => suma + fila.alumnos, 0)
  const totalSesiones = filas.reduce((suma, fila) => suma + fila.sesiones, 0)
  const alumnosSinNota = filas.reduce(
    (suma, fila) => suma + (fila.alumnos - fila.conNota),
    0
  )
  const seccionesSinSesiones = filas.filter((fila) => fila.sesiones === 0).length
  const seccionesVacias = filas.filter((fila) => fila.alumnos === 0).length
  const registrosAbiertos = filas.filter((fila) => fila.registroAbierto).length

  const instructoresActivos = (instructores ?? []).filter(
    (instructor) => instructor.activo
  )
  const instructoresSinSeccion = instructoresActivos.filter(
    (instructor) =>
      !(secciones ?? []).some(
        (seccion) => seccion.instructor_id === instructor.id
      )
  ).length

  const pendientes: Pendiente[] = []

  if (alumnosSinNota > 0) {
    pendientes.push({
      clave: 'sin-nota',
      titulo: `${plural(alumnosSinNota, 'alumno', 'alumnos')} sin nota final`,
      detalle: `de ${plural(
        totalAlumnos,
        'inscrito',
        'inscritos'
      )} en el trimestre`,
      href: '/admin/reportes',
    })
  }

  if (seccionesSinSesiones > 0) {
    pendientes.push({
      clave: 'sin-sesiones',
      titulo: `${plural(
        seccionesSinSesiones,
        'sección',
        'secciones'
      )} sin ninguna sesión`,
      detalle: 'sin asistencia registrada en el trimestre',
      href: '/admin/laboratorios',
    })
  }

  if (seccionesVacias > 0) {
    pendientes.push({
      clave: 'vacias',
      titulo: `${plural(seccionesVacias, 'sección', 'secciones')} sin alumnos`,
      detalle: 'nadie se ha inscrito todavía',
      href: '/admin/laboratorios',
    })
  }

  if (instructoresSinSeccion > 0) {
    pendientes.push({
      clave: 'instructores',
      titulo: `${plural(
        instructoresSinSeccion,
        'instructor activo',
        'instructores activos'
      )} sin secciones`,
      detalle: 'sin ninguna sección en este trimestre',
      href: '/admin/instructores',
    })
  }

  // ---------- Trimestre ----------
  const inicio = periodoActual ? aFecha(periodoActual.fecha_inicio) : null
  const fin = periodoActual ? aFecha(periodoActual.fecha_fin) : null
  const hoyFecha = aFecha(hoy)

  const diasTotales =
    inicio && fin
      ? Math.round((fin.getTime() - inicio.getTime()) / MS_DIA) + 1
      : 0
  const diasTranscurridos =
    inicio && fin
      ? Math.min(
          diasTotales,
          Math.max(
            0,
            Math.round((hoyFecha.getTime() - inicio.getTime()) / MS_DIA) + 1
          )
        )
      : 0
  const avance =
    diasTotales > 0 ? Math.round((diasTranscurridos / diasTotales) * 100) : 0
  const restantes = fin
    ? Math.max(0, Math.round((fin.getTime() - hoyFecha.getTime()) / MS_DIA))
    : 0

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Panel de administración
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Estado del trimestre y lo que necesita tu atención.
          </p>
        </div>

        <Link href="/admin/reportes" className={CLASE_BOTON}>
          <FiFileText size={16} aria-hidden />
          Generar reporte
        </Link>
      </header>

      {/* ---------- Estado del trimestre ---------- */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="text-lg font-bold text-[#06065c]">
            {periodoActual
              ? `${periodoActual.nombre} ${periodoActual.year}`
              : 'Sin trimestre activo'}
          </p>
          <p className="text-sm text-gray-500">
            {!fin
              ? '—'
              : restantes === 0
                ? 'Último día del trimestre'
                : `${plural(restantes, 'día restante', 'días restantes')}`}
          </p>
        </div>

        {inicio && fin && (
          <div className="mt-3">
            <div
              role="progressbar"
              aria-label="Avance del trimestre"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={avance}
              className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
            >
              <div
                className="h-full rounded-full bg-[#06065c]"
                style={{ width: `${avance}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {avance}% transcurrido · {fechaCorta(periodoActual!.fecha_inicio)}{' '}
              – {fechaCorta(periodoActual!.fecha_fin)}
            </p>
          </div>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-gray-100 pt-4 sm:grid-cols-4">
          {[
            { etiqueta: 'Secciones', valor: filas.length },
            { etiqueta: 'Alumnos inscritos', valor: totalAlumnos },
            { etiqueta: 'Sesiones registradas', valor: totalSesiones },
            {
              etiqueta: 'Instructores activos',
              valor: instructoresActivos.length,
            },
          ].map((dato) => (
            <div key={dato.etiqueta}>
              <dt className="text-xs uppercase tracking-wide text-gray-500">
                {dato.etiqueta}
              </dt>
              <dd className="mt-0.5 text-xl font-bold tabular-nums text-gray-900">
                {dato.valor}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-xs text-gray-500">
          Catálogo: {plural((laboratorios ?? []).length, 'laboratorio', 'laboratorios')} ·{' '}
          {plural((clases ?? []).length, 'clase', 'clases')} ·{' '}
          {registrosAbiertos === 0
            ? 'ningún registro QR abierto'
            : `${plural(
                registrosAbiertos,
                'registro QR abierto',
                'registros QR abiertos'
              )}`}
        </p>
      </section>

      {filas.length === 0 ? (
        <section className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
          <FiAlertCircle
            className="mx-auto text-3xl text-[#06065c]"
            aria-hidden
          />
          <h2 className="mt-3 text-lg font-bold text-gray-900">
            {periodoActual
              ? `Todavía no hay secciones en ${periodoActual.nombre} ${periodoActual.year}`
              : 'Todavía no hay secciones'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
            Las crean los instructores desde su panel. En cuanto exista la
            primera, acá aparecerá su avance de asistencia y de notas.
          </p>
        </section>
      ) : (
        <>
          {/* ---------- Requiere atención ---------- */}
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-5 py-4">
              <h2 className={CLASE_TITULO_SECCION}>Requiere atención</h2>
              <p className="text-xs text-gray-500">
                {pendientes.length === 0
                  ? 'Sin pendientes'
                  : plural(pendientes.length, 'punto', 'puntos')}
              </p>
            </div>

            {pendientes.length === 0 ? (
              <div className="flex items-start gap-3 px-5 py-6">
                <FiCheckCircle
                  size={18}
                  className="mt-0.5 shrink-0 text-emerald-600"
                  aria-hidden
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Todo al día
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    No hay notas sin capturar, ni secciones sin sesiones o sin
                    alumnos en este trimestre.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {pendientes.map((pendiente) => (
                  <li key={pendiente.clave}>
                    <Link
                      href={pendiente.href}
                      className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-[#06065c]/[0.04] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#06065c]"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900">
                          {pendiente.titulo}
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-500">
                          {pendiente.detalle}
                        </span>
                      </span>
                      <FiChevronRight
                        size={16}
                        aria-hidden
                        className="shrink-0 text-gray-400"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---------- Avance por sección ---------- */}
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className={CLASE_TITULO_SECCION}>Avance por sección</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Asistencia y captura de notas del trimestre.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left">
                <thead className="bg-[#06065c]">
                  <tr className="text-[11px] font-semibold uppercase tracking-[0.09em] text-white/90">
                    <th scope="col" className="px-5 py-3.5">
                      Sección
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Instructor
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-right">
                      Alumnos
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-right">
                      Sesiones
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-right">
                      Asistencia
                    </th>
                    <th scope="col" className="px-5 py-3.5">
                      Notas capturadas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila) => {
                    const porcentajeNotas =
                      fila.alumnos === 0
                        ? 0
                        : Math.round((fila.conNota / fila.alumnos) * 100)

                    return (
                      <tr
                        key={fila.id}
                        className="border-t border-gray-100 text-black even:bg-gray-50"
                      >
                        <td className="px-5 py-3.5 align-middle">
                          <p className="text-sm font-semibold text-gray-900">
                            {fila.laboratorio}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            Sección {fila.grupo}
                            {fila.clase ? ` · ${fila.clase}` : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 align-middle text-sm text-gray-700">
                          {fila.instructor}
                        </td>
                        <td className="px-4 py-3.5 text-right align-middle text-sm font-medium tabular-nums text-gray-900">
                          {fila.alumnos}
                        </td>
                        <td className="px-4 py-3.5 text-right align-middle text-sm font-medium tabular-nums text-gray-900">
                          {fila.sesiones}
                        </td>
                        <td className="px-4 py-3.5 text-right align-middle text-sm font-medium tabular-nums text-gray-900">
                          {fila.asistencia === null ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            `${fila.asistencia}%`
                          )}
                        </td>
                        <td className="px-5 py-3.5 align-middle">
                          <div className="flex items-center gap-2.5">
                            <span className="text-sm tabular-nums text-gray-900">
                              {fila.conNota}/{fila.alumnos}
                            </span>
                            <span
                              aria-hidden
                              className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100"
                            >
                              <span
                                className="block h-full rounded-full bg-[#06065c]"
                                style={{ width: `${porcentajeNotas}%` }}
                              />
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
