import { requireRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cargarReporteSeccion, modoValido } from '@/lib/reportes'
import { aObjeto } from '@/lib/utils'
import EnvioReporte from '@/components/reportes/envio-reporte'
import VistaReporte from '@/components/reportes/vista-reporte'
import { enviarReporte } from './actions'

// La sesión y los datos cambian por request: se corta el prerender.
export const instant = false

export const metadata = { title: 'Reportes' }

const CLASE_BOTON =
  'inline-flex items-center gap-1.5 rounded-lg bg-[#06065c] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0f49b6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06065c] disabled:cursor-not-allowed disabled:opacity-50'

const CLASE_CAMPO =
  'rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-black outline-none transition focus:border-[#0f49b6] focus:ring-2 focus:ring-[#0f49b6]'

/**
 * Selector de modo como dos formularios GET con botones `name=modo`: el valor
 * del botón pulsado viaja en la query string, así que cambiar de modo navega
 * sin una línea de JavaScript y sin perder la sección elegida.
 */
export default async function InstructorReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ seccion?: string; modo?: string }>
}) {
  const usuario = await requireRol('instructor')
  const { seccion: seccionParam, modo: modoParam } = await searchParams

  const supabase = await createClient()

  const { data } = await supabase
    .from('secciones')
    .select('id, grupo, laboratorios(nombre)')
    .eq('instructor_id', usuario.id)
    .order('id', { ascending: false })

  const lista = (data ?? []).map((seccion) => {
    const laboratorio = aObjeto(seccion.laboratorios)
    return {
      id: seccion.id as number,
      etiqueta: `Sección ${seccion.grupo ?? '—'} · ${
        laboratorio?.nombre ?? '—'
      }`,
    }
  })

  const modo = modoValido(modoParam ?? '')
  const pedida = Number(seccionParam)
  const seccionId = lista.some((s) => s.id === pedida)
    ? pedida
    : (lista[0]?.id ?? 0)

  // Si no hay secciones todavía no se pide nada a la base de reportes.
  const reporte =
    seccionId > 0 ? await cargarReporteSeccion(seccionId, modo) : null

  const vacio = !reporte || reporte.filas.length === 0
  const configurado = Boolean((process.env.POWERAPPS_URL ?? '').trim())
  const descarga = `/api/reportes/excel?seccion=${seccionId}&modo=${modo}`

  if (lista.length === 0) {
    return (
      <div className="space-y-4">
        <Cabecera />
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
          <h2 className="text-lg font-bold text-gray-900">
            Aún no tienes secciones
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
            Crea una sección desde <strong>Mis secciones</strong> y vuelve
            acá: el reporte se genera con sus alumnos, asistencias y notas.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Cabecera />

      {/* ---------- Elegir sección y modo (GET, sin JavaScript) ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="modo" value={modo} />
          <div>
            <label
              htmlFor="seccion-reporte"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Sección
            </label>
            <select
              id="seccion-reporte"
              name="seccion"
              defaultValue={String(seccionId)}
              className={`${CLASE_CAMPO} min-w-[290px]`}
            >
              {lista.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={CLASE_BOTON}>
            Ver reporte
          </button>
        </form>

        <div>
          <p className="mb-1 text-sm font-medium text-gray-700">Modo</p>
          <div className="flex gap-2">
            <form method="GET">
              <input type="hidden" name="seccion" value={seccionId} />
              <input type="hidden" name="modo" value="notas" />
              <button
                type="submit"
                aria-pressed={modo === 'notas'}
                className={
                  modo === 'notas'
                    ? 'rounded-lg bg-[#06065c] px-4 py-2.5 text-sm font-medium text-white'
                    : 'rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100'
                }
              >
                A · Notas finales
              </button>
            </form>
            <form method="GET">
              <input type="hidden" name="seccion" value={seccionId} />
              <input type="hidden" name="modo" value="asistencia" />
              <button
                type="submit"
                aria-pressed={modo === 'asistencia'}
                className={
                  modo === 'asistencia'
                    ? 'rounded-lg bg-[#06065c] px-4 py-2.5 text-sm font-medium text-white'
                    : 'rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100'
                }
              >
                B · Asistencia
              </button>
            </form>
          </div>
        </div>
      </div>

      {reporte && <VistaReporte reporte={reporte} descarga={descarga} />}

      <EnvioReporte
        accion={enviarReporte}
        campos={[
          { nombre: 'seccion', valor: String(seccionId) },
          { nombre: 'modo', valor: modo },
        ]}
        vacio={vacio}
        configurado={configurado}
      />
    </div>
  )
}

function Cabecera() {
  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-semibold text-gray-900">Reportes</h1>
      <p className="text-sm text-gray-500">
        Genera el reporte de una sección, prévisualízalo y envíalo por correo.
      </p>
    </header>
  )
}
