'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { plural } from '@/lib/utils'

export type ClaseFiltro = { id: number; nombre: string }

export type PeriodoFiltro = {
  id: number
  nombre: string
  year: number
  actual: boolean
}

export type SeccionFiltro = {
  id: number
  etiqueta: string
  instructor: string
  claseId: number | null
  periodoId: number
}

export type Seleccion = {
  clases: number[]
  periodos: number[]
  secciones: number[]
}

const CLASE_LEYENDA = 'mb-1.5 block text-sm font-medium text-gray-700'

const CLASE_LISTA =
  'max-h-52 space-y-1.5 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/60 p-3 [scrollbar-color:#c3c9d6_transparent] [scrollbar-width:thin]'

const CLASE_CASILLA = 'h-4 w-4 shrink-0 cursor-pointer accent-[#06065c]'

const CLASE_MODO_ACTIVO =
  'rounded-lg bg-[#06065c] px-4 py-2.5 text-sm font-medium text-white'
const CLASE_MODO_INACTIVO =
  'rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100'

function alternar(lista: number[], id: number): number[] {
  return lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]
}

/** Huella estable de una selección, sin importar el orden de los ids. */
function claveDe(seleccion: Seleccion): string {
  const orden = (lista: number[]) =>
    [...lista].sort((a, b) => a - b).join(',')
  return `${orden(seleccion.clases)}|${orden(
    seleccion.periodos
  )}|${orden(seleccion.secciones)}`
}

/**
 * Filtros del reporte del admin, en vivo.
 *
 * Todo el estado vive acá y la URL es el reflejo de ese estado: al marcar algo
 * se actualiza la pantalla en el acto (la lista de secciones se filtra en el
 * cliente, sin ida al servidor) y, con un pequeño debounce, se navega a la
 * misma pantalla con los parámetros nuevos para que el servidor recalcule el
 * reporte. Así el preview, la descarga y el correo siguen saliendo de la misma
 * fuente, sin duplicar el cálculo en el navegador.
 *
 * Las secciones que dejan de cumplir el filtro se sacan de la selección, para
 * que lo que se ve marcado sea exactamente lo que entra al reporte.
 */
export default function FiltrosReporte({
  clases,
  periodos,
  secciones,
  inicial,
  modo,
}: {
  clases: ClaseFiltro[]
  periodos: PeriodoFiltro[]
  secciones: SeccionFiltro[]
  inicial: Seleccion
  modo: 'notas' | 'asistencia'
}) {
  const router = useRouter()
  const [seleccion, setSeleccion] = useState<Seleccion>(inicial)
  const [claveLocal, setClaveLocal] = useState(() => claveDe(inicial))
  const [pendiente, iniciarTransicion] = useTransition()
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Última selección que mandamos nosotros a la URL. Es estado y no un ref
  // porque se lee durante el render (los refs no se tocan ahí).
  const [enviada, setEnviada] = useState<string | null>(null)

  const claveServidor = claveDe(inicial)

  // Ajuste durante el render (patrón de React, sin effect): si la URL cambió
  // por algo que no fuimos nosotros —el botón atrás, por ejemplo—, la selección
  // vuelve a reflejar lo que dice la URL en vez de quedarse con lo de antes.
  if (claveLocal !== claveServidor && claveServidor !== enviada) {
    setClaveLocal(claveServidor)
    setSeleccion(inicial)
    setEnviada(claveServidor)
  }

  const filtrarSecciones = (clasesMarcadas: number[], periodosMarcados: number[]) =>
    secciones.filter(
      (seccion) =>
        (clasesMarcadas.length === 0 ||
          (seccion.claseId !== null &&
            clasesMarcadas.includes(seccion.claseId))) &&
        (periodosMarcados.length === 0 ||
          periodosMarcados.includes(seccion.periodoId))
    )

  const visibles = filtrarSecciones(seleccion.clases, seleccion.periodos)

  const navegar = (siguiente: Seleccion, siguienteModo: string, inmediato = false) => {
    const params = new URLSearchParams()
    params.set('filtros', '1')
    for (const id of siguiente.clases) params.append('clase', String(id))
    for (const id of siguiente.periodos) params.append('periodo', String(id))
    for (const id of siguiente.secciones) params.append('seccion', String(id))
    params.set('modo', siguienteModo)

    const url = `/admin/reportes?${params.toString()}`
    setEnviada(claveDe(siguiente))
    const ir = () =>
      iniciarTransicion(() => router.replace(url, { scroll: false }))

    if (temporizador.current) clearTimeout(temporizador.current)
    if (inmediato) {
      ir()
      return
    }
    temporizador.current = setTimeout(ir, 250)
  }

  const cambiar = (grupo: keyof Seleccion, id: number) => {
    const clasesMarcadas =
      grupo === 'clases' ? alternar(seleccion.clases, id) : seleccion.clases
    const periodosMarcados =
      grupo === 'periodos'
        ? alternar(seleccion.periodos, id)
        : seleccion.periodos
    const seccionesMarcadas =
      grupo === 'secciones'
        ? alternar(seleccion.secciones, id)
        : seleccion.secciones

    const idsVisibles = new Set(
      filtrarSecciones(clasesMarcadas, periodosMarcados).map((s) => s.id)
    )

    const siguiente: Seleccion = {
      clases: clasesMarcadas,
      periodos: periodosMarcados,
      secciones: seccionesMarcadas.filter((seccionId) =>
        idsVisibles.has(seccionId)
      ),
    }

    setSeleccion(siguiente)
    setClaveLocal(claveDe(siguiente))
    navegar(siguiente, modo)
  }

  const cambiarModo = (nuevo: 'notas' | 'asistencia') => {
    navegar(seleccion, nuevo, true)
  }

  const efectivasClases =
    seleccion.clases.length === 0 ? clases.length : seleccion.clases.length
  const efectivosPeriodos =
    seleccion.periodos.length === 0
      ? periodos.length
      : seleccion.periodos.length
  const efectivasSecciones =
    seleccion.secciones.length === 0
      ? visibles.length
      : seleccion.secciones.length

  return (
    <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
      <div className="grid gap-5 lg:grid-cols-3">
        {/* ---------- Clases ---------- */}
        <fieldset>
          <legend className={CLASE_LEYENDA}>Clases</legend>
          <div className={CLASE_LISTA}>
            {clases.length === 0 ? (
              <p className="text-xs text-gray-500">
                No hay clases en el catálogo.
              </p>
            ) : (
              clases.map((clase) => (
                <label
                  key={clase.id}
                  className="flex cursor-pointer items-center gap-2 text-sm text-gray-800"
                >
                  <input
                    type="checkbox"
                    checked={seleccion.clases.includes(clase.id)}
                    onChange={() => cambiar('clases', clase.id)}
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
            {periodos.length === 0 ? (
              <p className="text-xs text-gray-500">No hay periodos.</p>
            ) : (
              periodos.map((periodo) => (
                <label
                  key={periodo.id}
                  className="flex cursor-pointer items-center gap-2 text-sm text-gray-800"
                >
                  <input
                    type="checkbox"
                    checked={seleccion.periodos.includes(periodo.id)}
                    onChange={() => cambiar('periodos', periodo.id)}
                    className={CLASE_CASILLA}
                  />
                  <span>
                    {periodo.nombre} {periodo.year}
                    {periodo.actual && (
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
          <legend className={CLASE_LEYENDA}>
            Secciones
            <span className="ml-1.5 font-normal text-gray-500">
              ({visibles.length})
            </span>
          </legend>
          <div className={CLASE_LISTA}>
            {visibles.length === 0 ? (
              <p className="text-xs text-gray-500">
                No hay secciones para esa combinación de clase y periodo.
              </p>
            ) : (
              visibles.map((seccion) => (
                <label
                  key={seccion.id}
                  className="flex cursor-pointer items-start gap-2 text-sm text-gray-800"
                >
                  <input
                    type="checkbox"
                    checked={seleccion.secciones.includes(seccion.id)}
                    onChange={() => cambiar('secciones', seccion.id)}
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
              type="button"
              onClick={() => cambiarModo('notas')}
              aria-pressed={modo === 'notas'}
              className={
                modo === 'notas' ? CLASE_MODO_ACTIVO : CLASE_MODO_INACTIVO
              }
            >
              A · Notas finales
            </button>
            <button
              type="button"
              onClick={() => cambiarModo('asistencia')}
              aria-pressed={modo === 'asistencia'}
              className={
                modo === 'asistencia' ? CLASE_MODO_ACTIVO : CLASE_MODO_INACTIVO
              }
            >
              B · Asistencia
            </button>
          </div>
        </div>

        <p
          className={`text-xs transition-opacity ${
            pendiente ? 'text-[#06065c] opacity-100' : 'text-gray-500 opacity-70'
          }`}
          role="status"
          aria-live="polite"
        >
          {pendiente
            ? 'Actualizando reporte…'
            : `${plural(efectivasClases, 'clase', 'clases')} · ${plural(
                efectivosPeriodos,
                'periodo',
                'periodos'
              )} · ${plural(efectivasSecciones, 'sección', 'secciones')}`}
        </p>
      </div>
    </section>
  )
}
