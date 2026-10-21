import { requireRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  cargarReporte,
  cargarSecciones,
  modoValido,
  type FiltroReporte,
} from '@/lib/reportes'
import { plural } from '@/lib/utils'
import EnvioReporte from '@/components/reportes/envio-reporte'
import VistaReporte from '@/components/reportes/vista-reporte'
import { enviarReporteAdmin } from './actions'

// La sesión y los datos cambian por request: se corta el prerender.
export const instant = false

export const metadata = { title: 'Reportes' }

const CLASE_BOTON =
  'inline-flex items-center gap-1.5 rounded-lg bg-[#06065c] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0f49b6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06065c]'

const CLASE_MODO_ACTIVO =
  'rounded-lg bg-[#06065c] px-4 py-2.5 text-sm font-medium text-white'
const CLASE_MODO_INACTIVO =
  'rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100'

const CLASE_LEYENDA = 'mb-1.5 block text-sm font-medium text-gray-700'

const CLASE_LISTA =
  'max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/60 p-3 [scrollbar-color:#c3c9d6_transparent] [scrollbar-width:thin]'

const CLASE_CASILLA = 'h-4 w-4 shrink-0 cursor-pointer accent-[#06065c]'

/** Fecha local del servidor en formato date de Postgres. */
function hoyIso() {
  const ahora = new Date()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${ahora.getFullYear()}-${mes}-${dia}`
}

/** Next entrega las claves repetidas como string[]; las normalizamos. */
function aLista(valor: string | string[] | undefined): string[] {
  if (valor === undefined) return []
  return Array.isArray(valor) ? valor : [valor]
}

function aIds(valores: string[]): number[] {
  return valores
    .map((valor) => Number.parseInt(valor, 10))
    .filter((numero) => Number.isInteger(numero) && numero > 0)
}

export default async function AdminReportesPage({
  searchParams,
}: {
  searchParams: Promise<{
    clase?: string | string[]
    periodo?: string | string[]
    seccion?: string | string[]
    modo?: string
    filtros?: string
  }>
}) {
  await requireRol('admin')
  const params = await searchParams

  const supabase = await createClient()

  const [{ data: clases }, { data: periodos }] = await Promise.all([
    supabase.from('clases').select('id, nombre').order('nombre', {
      ascending: true,
    }),
    supabase
      .from('periodos')
      .select('id, year, nombre, fecha_inicio, fecha_fin')
      .order('fecha_inicio', { ascending: false }),
  ])

  const hoy = hoyIso()
  const periodoActual = (periodos ?? []).find(
    (periodo) => periodo.fecha_inicio <= hoy && hoy <= periodo.fecha_fin
  )

  // `filtros=1` lo manda el formulario: distingue "primera carga" de "el
  // usuario destildó todos los periodos", que llega sin la clave `periodo`.
  const primeraCarga = params.filtros === undefined

  const filtro: FiltroReporte = {
    claseIds: aIds(aLista(params.clase)),
    periodoIds: primeraCarga
      ? periodoActual
        ? [periodoActual.id as number]
        : []
      : aIds(aLista(params.periodo)),
    seccionIds: aIds(aLista(params.seccion)),
  }

  const modo = modoValido(params.modo ?? '')

  // La lista de secciones se arma con clase y periodo, pero sin el filtro de
  // sección: si no, al destildar todas desaparecerían las opciones.
  const disponibles = await cargarSecciones({
    seccionIds: [],
    periodoIds: filtro.periodoIds,
    claseIds: filtro.claseIds,
  })

  const reporte = await cargarReporte(filtro, modo)
  const vacio = !reporte || reporte.filas.length === 0
  const configurado = Boolean((process.env.POWERAPPS_URL ?? '').trim())

  const query = new URLSearchParams()
  for (const id of filtro.seccionIds) query.append('seccion', String(id))
  for (const id of filtro.periodoIds) query.append('periodo', String(id))
  for (const id of filtro.claseIds) query.append('clase', String(id))
  query.set('modo', modo)
  const descarga = `/api/reportes/excel?${query.toString()}`

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500">
          Elige una o varias clases y periodos: las secciones se ajustan a esa
          combinación. Después marca las secciones que quieras incluir.
        </p>
      </header>

      <form
        method="GET"
        className="space-y-5 rounded-xl border border-gray-200 bg-white p-5"
      >
        <input type="hidden" name="filtros" value="1" />

        <div className="grid gap-5 lg:grid-cols-3">
          {/* ---------- Clases ---------- */}
          <fieldset>
            <legend className={CLASE_LEYENDA}>Clases</legend>
            <div className={CLASE_LISTA}>
              {(clases ?? []).length === 0 ? (
                <p className="text-xs text-gray-500">
                  No hay clases en el catálogo.
                </p>
              ) : (
                (clases ?? []).map((clase) => (
                  <label
                    key={clase.id}
                    className="flex cursor-pointer items-center gap-2 text-sm text-gray-800"
                  >
                    <input
                      type="checkbox"
                      name="clase"
                      value={clase.id}
                      defaultChecked={filtro.claseIds.includes(clase.id)}
                      className={CLASE_CASILLA}
                    />
                    {clase.nombre}
                  </label>
                ))
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">Sin marcar = todas.</p>
          </fieldset>

          {/* ---------- Periodos ---------- */}
          <fieldset>
            <legend className={CLASE_LEYENDA}>Periodos</legend>
            <div className={CLASE_LISTA}>
              {(periodos ?? []).length === 0 ? (
                <p className="text-xs text-gray-500">No hay periodos.</p>
              ) : (
                (periodos ?? []).map((periodo) => (
                  <label
                    key={periodo.id}
                    className="flex cursor-pointer items-center gap-2 text-sm text-gray-800"
                  >
                    <input
                      type="checkbox"
                      name="periodo"
                      value={periodo.id}
                      defaultChecked={filtro.periodoIds.includes(periodo.id)}
                      className={CLASE_CASILLA}
                    />
                    <span>
                      {periodo.nombre} {periodo.year}
                      {periodo.id === periodoActual?.id && (
                        <span className="ml-1.5 rounded bg-[#06065c]/10 px-1.5 py-0.5 text-[11px] font-medium text-[#06065c]">
                          actual
                        </span>
                      )}
                    </span>
                  </label>
                ))
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">Sin marcar = todos.</p>
          </fieldset>

          {/* ---------- Secciones (dependen de clase y periodo) ---------- */}
          <fieldset>
            <legend className={CLASE_LEYENDA}>Secciones</legend>
            <div className={CLASE_LISTA}>
              {disponibles.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No hay secciones para esa combinación de clase y periodo.
                </p>
              ) : (
                disponibles.map((seccion) => (
                  <label
                    key={seccion.id}
                    className="flex cursor-pointer items-start gap-2 text-sm text-gray-800"
                  >
                    <input
                      type="checkbox"
                      name="seccion"
                      value={seccion.id}
                      defaultChecked={filtro.seccionIds.includes(seccion.id)}
                      className={`${CLASE_CASILLA} mt-0.5`}
                    />
                    <span>
                      {seccion.etiqueta}
                      {seccion.instructor !== '—' && (
                        <span className="block text-xs text-gray-500">
                          {seccion.instructor}
                        </span>
                      )}
                    </span>
                  </label>
                ))
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Sin marcar = todas las que cumplan el filtro.
            </p>
          </fieldset>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-gray-100 pt-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700">Modo</p>
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

          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-500">
              {plural(filtro.claseIds.length || (clases ?? []).length, 'clase', 'clases')}
              {' · '}
              {plural(filtro.periodoIds.length || (periodos ?? []).length, 'periodo', 'periodos')}
              {' · '}
              {plural(
                filtro.seccionIds.length || disponibles.length,
                'sección',
                'secciones'
              )}
            </p>
            <button type="submit" name="modo" value={modo} className={CLASE_BOTON}>
              Aplicar filtros
            </button>
          </div>
        </div>
      </form>

      {reporte ? (
        <VistaReporte reporte={reporte} descarga={descarga} />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
          <h2 className="text-lg font-bold text-gray-900">
            No hay secciones con esos filtros
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
            Prueba marcando otra clase u otro periodo, o destildando todo para
            incluir todas las secciones.
          </p>
        </div>
      )}

      <EnvioReporte
        accion={enviarReporteAdmin}
        campos={[
          ...filtro.seccionIds.map((id) => ({
            nombre: 'seccion',
            valor: String(id),
          })),
          ...filtro.periodoIds.map((id) => ({
            nombre: 'periodo',
            valor: String(id),
          })),
          ...filtro.claseIds.map((id) => ({
            nombre: 'clase',
            valor: String(id),
          })),
          { nombre: 'modo', valor: modo },
        ]}
        vacio={vacio}
        configurado={configurado}
      />
    </div>
  )
}
