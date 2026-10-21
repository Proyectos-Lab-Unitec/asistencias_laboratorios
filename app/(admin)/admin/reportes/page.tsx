import { requireRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cargarReporte, modoValido } from '@/lib/reportes'
import { aObjeto } from '@/lib/utils'
import EnvioReporte from '@/components/reportes/envio-reporte'
import VistaReporte from '@/components/reportes/vista-reporte'
import { enviarReporteAdmin } from './actions'

// La sesión y los datos cambian por request: se corta el prerender.
export const instant = false

export const metadata = { title: 'Reportes' }

const CLASE_BOTON =
  'inline-flex items-center gap-1.5 rounded-lg bg-[#06065c] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0f49b6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06065c] disabled:cursor-not-allowed disabled:opacity-50'

const CLASE_CAMPO =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-black outline-none transition focus:border-[#0f49b6] focus:ring-2 focus:ring-[#0f49b6]'

const CLASE_MODO_ACTIVO =
  'rounded-lg bg-[#06065c] px-4 py-2.5 text-sm font-medium text-white'
const CLASE_MODO_INACTIVO =
  'rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100'

/** Fecha local del servidor en formato date de Postgres. */
function hoyIso() {
  const ahora = new Date()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${ahora.getFullYear()}-${mes}-${dia}`
}

/** Un id de filtro: vacío o basura equivalen a "sin filtro". */
function aId(valor: string | undefined): number | null {
  const numero = Number.parseInt(valor ?? '', 10)
  return Number.isInteger(numero) && numero > 0 ? numero : null
}

export default async function AdminReportesPage({
  searchParams,
}: {
  searchParams: Promise<{
    seccion?: string
    periodo?: string
    clase?: string
    modo?: string
  }>
}) {
  await requireRol('admin')
  const params = await searchParams

  const supabase = await createClient()

  const [{ data: secciones }, { data: periodos }, { data: clases }] =
    await Promise.all([
      supabase
        .from('secciones')
        .select('id, grupo, laboratorios(nombre), periodos(nombre, year)')
        .order('id', { ascending: true }),
      supabase
        .from('periodos')
        .select('id, year, nombre, fecha_inicio, fecha_fin')
        .order('fecha_inicio', { ascending: false }),
      supabase.from('clases').select('id, nombre').order('nombre', {
        ascending: true,
      }),
    ])

  const hoy = hoyIso()
  const periodoActual = (periodos ?? []).find(
    (periodo) => periodo.fecha_inicio <= hoy && hoy <= periodo.fecha_fin
  )

  // En la primera carga (sin query) se abre en el trimestre actual y con todas
  // las secciones. Después manda lo que venga en la URL, incluido el "todos"
  // (que llega como cadena vacía).
  const primeraCarga = params.periodo === undefined
  const periodoId = primeraCarga
    ? ((periodoActual?.id as number | undefined) ?? null)
    : aId(params.periodo)

  const seccionId = aId(params.seccion)
  const claseId = aId(params.clase)
  const modo = modoValido(params.modo ?? '')

  const reporte = await cargarReporte({ seccionId, periodoId, claseId }, modo)

  const vacio = !reporte || reporte.filas.length === 0
  const configurado = Boolean((process.env.POWERAPPS_URL ?? '').trim())

  const query = new URLSearchParams()
  if (seccionId !== null) query.set('seccion', String(seccionId))
  if (periodoId !== null) query.set('periodo', String(periodoId))
  if (claseId !== null) query.set('clase', String(claseId))
  query.set('modo', modo)
  const descarga = `/api/reportes/excel?${query.toString()}`

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500">
          Reporte global o por sección, del trimestre actual o de todos.
          Previsualízalo, descárgalo o envíalo por correo.
        </p>
      </header>

      {(secciones ?? []).length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
          <h2 className="text-lg font-bold text-gray-900">
            Todavía no hay secciones
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
            El reporte se arma con las secciones de los instructores. En cuanto
            exista la primera, aparecerá acá.
          </p>
        </div>
      ) : (
        <>
          {/* ---------- Filtros (GET, sin JavaScript) ---------- */}
          <form
            method="GET"
            className="space-y-4 rounded-xl border border-gray-200 bg-white p-5"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="filtro-seccion"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Sección
                </label>
                <select
                  id="filtro-seccion"
                  name="seccion"
                  defaultValue={seccionId === null ? '' : String(seccionId)}
                  className={CLASE_CAMPO}
                >
                  <option value="">Todas las secciones</option>
                  {(secciones ?? []).map((seccion) => {
                    const laboratorio = aObjeto(seccion.laboratorios)
                    const periodo = aObjeto(seccion.periodos)
                    const etiqueta = [
                      laboratorio?.nombre ?? '—',
                      `Sección ${seccion.grupo ?? '—'}`,
                      periodo ? `${periodo.nombre} ${periodo.year}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')

                    return (
                      <option key={seccion.id} value={seccion.id}>
                        {etiqueta}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label
                  htmlFor="filtro-periodo"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Periodo
                </label>
                <select
                  id="filtro-periodo"
                  name="periodo"
                  defaultValue={periodoId === null ? '' : String(periodoId)}
                  className={CLASE_CAMPO}
                >
                  <option value="">Todos los periodos</option>
                  {(periodos ?? []).map((periodo) => (
                    <option key={periodo.id} value={periodo.id}>
                      {periodo.nombre} {periodo.year}
                      {periodo.id === periodoActual?.id ? ' · actual' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="filtro-clase"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Clase
                </label>
                <select
                  id="filtro-clase"
                  name="clase"
                  defaultValue={claseId === null ? '' : String(claseId)}
                  className={CLASE_CAMPO}
                >
                  <option value="">Todas las clases</option>
                  {(clases ?? []).map((clase) => (
                    <option key={clase.id} value={clase.id}>
                      {clase.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-gray-100 pt-4">
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700">Modo</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    name="modo"
                    value="notas"
                    aria-pressed={modo === 'notas'}
                    className={
                      modo === 'notas' ? CLASE_MODO_ACTIVO : CLASE_MODO_INACTIVO
                    }
                  >
                    A · Notas finales
                  </button>
                  <button
                    type="submit"
                    name="modo"
                    value="asistencia"
                    aria-pressed={modo === 'asistencia'}
                    className={
                      modo === 'asistencia'
                        ? CLASE_MODO_ACTIVO
                        : CLASE_MODO_INACTIVO
                    }
                  >
                    B · Asistencia
                  </button>
                </div>
              </div>

              <button type="submit" name="modo" value={modo} className={CLASE_BOTON}>
                Ver reporte
              </button>
            </div>
          </form>

          {reporte && <VistaReporte reporte={reporte} descarga={descarga} />}

          <EnvioReporte
            accion={enviarReporteAdmin}
            campos={{
              seccion: seccionId === null ? '' : String(seccionId),
              periodo: periodoId === null ? '' : String(periodoId),
              clase: claseId === null ? '' : String(claseId),
              modo,
            }}
            vacio={vacio}
            configurado={configurado}
          />
        </>
      )}
    </div>
  )
}
