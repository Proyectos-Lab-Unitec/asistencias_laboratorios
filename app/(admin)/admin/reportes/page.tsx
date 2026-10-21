import { requireRol } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  FILTRO_VACIO,
  cargarReporte,
  cargarSecciones,
  modoValido,
  type FiltroReporte,
} from '@/lib/reportes'
import EnvioReporte from '@/components/reportes/envio-reporte'
import VistaReporte from '@/components/reportes/vista-reporte'
import FiltrosReporte from './filtros'
import { enviarReporteAdmin } from './actions'

// La sesión y los datos cambian por request: se corta el prerender.
export const instant = false

export const metadata = { title: 'Reportes' }

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

  // `filtros=1` lo pone el cliente al navegar: distingue "primera carga" de
  // "el usuario destildó todos los periodos", que llega sin la clave `periodo`.
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

  // Todas las secciones visibles: el cliente filtra la lista en vivo con su
  // clase y su periodo, sin volver al servidor por cada casilla.
  const todas = await cargarSecciones(FILTRO_VACIO)

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
          Marca una o varias clases y periodos: las secciones se ajustan al
          instante. Después elige las secciones que quieras incluir.
        </p>
      </header>

      <FiltrosReporte
        clases={(clases ?? []).map((clase) => ({
          id: clase.id as number,
          nombre: clase.nombre as string,
        }))}
        periodos={(periodos ?? []).map((periodo) => ({
          id: periodo.id as number,
          nombre: periodo.nombre as string,
          year: periodo.year as number,
          actual: periodo.id === periodoActual?.id,
        }))}
        secciones={todas.map((seccion) => ({
          id: seccion.id,
          etiqueta: seccion.etiqueta,
          instructor: seccion.instructor,
          claseId: seccion.claseId,
          periodoId: seccion.periodoId,
        }))}
        inicial={{
          clases: filtro.claseIds,
          periodos: filtro.periodoIds,
          secciones: filtro.seccionIds,
        }}
        modo={modo}
      />

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
