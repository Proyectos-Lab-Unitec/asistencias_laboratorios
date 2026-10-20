'use client'

import { useActionState, useEffect, useRef, startTransition } from 'react'
import { FiCheck, FiPlus, FiUsers } from 'react-icons/fi'
import { InterruptorEstado } from '@/components/ui/interruptor-estado'
import { CLASE_CELDA, CLASE_FILA } from '@/components/ui/tabla-dato'
import { ESTADO_INICIAL } from '@/lib/types'
import {
  abrirSesion,
  alternarAsistencia,
  alternarSesion,
  marcarTodosPresentes,
} from '../actions'

export type AlumnoAsistencia = {
  id: number
  numero_cuenta: string
  nombre: string
}

export type SesionAsistencia = {
  id: number
  fecha: string
  estado: 'abierta' | 'cerrada'
  presentes: number[]
}

/** Fecha local del navegador en formato date de Postgres (YYYY-MM-DD). */
function fechaIso(d: Date) {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function aFecha(iso: string) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

function fechaCorta(iso: string) {
  return aFecha(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  })
}

function fechaLarga(iso: string) {
  return aFecha(iso).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

const CLASE_BOTON =
  'inline-flex items-center gap-1.5 rounded-lg bg-[#06065c] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0f49b6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06065c] disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Grilla de asistencia: filas = alumnos, columnas = fechas.
 *
 * Es la pantalla que se usa en vivo durante la clase, así que todo está
 * montado alrededor de hacer lo menos posible: un solo useActionState para
 * toda la grilla (una casilla es un FormData más, no un hook más), «marcar
 * todos presentes» para el arranque de la sesión y corrección a mano después.
 *
 * El encabezado va en dos renglones a propósito: el de arriba lleva las fechas
 * y el de abajo los controles, pero los dos dentro de la misma banda azul para
 * que la cabecera lea como un bloque único. Por eso el switch va con
 * `sobreOscuro`: su azul activo normal es el mismo azul del fondo.
 */
export default function GrillaAsistencia({
  seccionId,
  alumnos,
  sesiones,
}: {
  seccionId: number
  alumnos: AlumnoAsistencia[]
  sesiones: SesionAsistencia[]
}) {
  // Un hook por acción (React no deja llamar hooks dentro de un map, pero sí
  // tener varios en el componente). El de las casillas es uno solo para toda la
  // grilla: una casilla es un FormData más, no un hook más.
  const [estado, enviar, pendiente] = useActionState(
    alternarAsistencia,
    ESTADO_INICIAL
  )
  const [estadoAbrir, enviarAbrir, pendienteAbrir] = useActionState(
    abrirSesion,
    ESTADO_INICIAL
  )
  const [estadoTodos, enviarTodos, pendienteTodos] = useActionState(
    marcarTodosPresentes,
    ESTADO_INICIAL
  )
  const contenedor = useRef<HTMLDivElement>(null)
  // Día elegido en el formulario de la barra, para llevarle la vista cuando
  // la sesión se acabe de crear.
  const fechaAgregada = useRef<string | null>(null)

  // Al abrir la vista va al extremo derecho, donde vive la sesión más reciente.
  // Pero si se acaba de dar de alta un día pasado, su columna no está ahí: en
  // ese caso se lleva la vista a la fecha recién agregada.
  useEffect(() => {
    const caja = contenedor.current
    if (!caja) return

    const objetivo = fechaAgregada.current
    fechaAgregada.current = null

    const celda = objetivo
      ? caja.querySelector<HTMLElement>(`[data-fecha="${objetivo}"]`)
      : null

    if (celda) {
      celda.scrollIntoView({ block: 'nearest', inline: 'center' })
      return
    }

    caja.scrollLeft = caja.scrollWidth
  }, [sesiones.length])

  const hoy = fechaIso(new Date())
  const error = estado.error ?? estadoAbrir.error ?? estadoTodos.error

  // Llamar el dispatch devuelto por useActionState fuera de un transition hace
  // que React avise y que isPending no se comporte bien; va envuelto.
  const marcar = (sesionId: number, matriculaId: number) => {
    const datos = new FormData()
    datos.set('sesion_id', String(sesionId))
    datos.set('matricula_id', String(matriculaId))
    startTransition(() => enviar(datos))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <p className="text-sm text-gray-500">
          {alumnos.length} {alumnos.length === 1 ? 'alumno' : 'alumnos'} ·{' '}
          {sesiones.length} {sesiones.length === 1 ? 'sesión' : 'sesiones'}
        </p>

        <form
          action={enviarAbrir}
          onSubmit={(e) => {
            const campo =
              e.currentTarget.querySelector<HTMLInputElement>('input[name="fecha"]')
            fechaAgregada.current = campo?.value ?? null
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="seccion_id" value={seccionId} />
          <label htmlFor="fecha-sesion" className="text-sm text-gray-500">
            Fecha
          </label>
          <input
            id="fecha-sesion"
            type="date"
            name="fecha"
            defaultValue={hoy}
            max={hoy}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#0f49b6] focus:outline-2 focus:outline-[#0f49b6]"
          />
          <button
            type="submit"
            className={CLASE_BOTON}
            disabled={pendienteAbrir}
          >
            <FiPlus size={16} />
            {pendienteAbrir ? 'Agregando…' : 'Agregar sesión'}
          </button>
        </form>      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {alumnos.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
          <FiUsers className="mx-auto text-3xl text-[#06065c]" aria-hidden />
          <h2 className="mt-3 text-lg font-bold text-gray-900">
            Aún no hay alumnos inscritos
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
            Comparte el QR desde <strong>Mis secciones</strong> para que se
            inscriban el primer día. En cuanto se registren, aparecerán acá para
            marcar su asistencia.
          </p>
        </div>
      ) : (
        <div
          ref={contenedor}
          className="overflow-x-auto rounded-xl border border-gray-200 bg-white"
        >
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#06065c] text-white">
                <th
                  rowSpan={2}
                  scope="col"
                  className="sticky left-0 z-20 bg-[#06065c] px-4 py-3 text-left"
                >
                  Alumno
                </th>
                {sesiones.map((s) => (
                  <th
                    key={s.id}
                    scope="col"
                    data-fecha={s.fecha}
                    className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide"
                  >
                    {fechaCorta(s.fecha)}
                  </th>
                ))}
                <th
                  rowSpan={2}
                  scope="col"
                  className="px-4 py-3 text-right align-middle"
                >
                  % asistencia
                </th>
              </tr>

              {sesiones.length > 0 && (
                <tr className="border-t border-white/15 bg-[#06065c]">
                  {sesiones.map((s) => (
                    <th key={s.id} scope="col" className="px-2 pb-3 pt-1.5">
                      <div className="flex flex-col items-center gap-1.5">
                        <InterruptorEstado
                          accion={alternarSesion}
                          id={s.id}
                          activo={s.estado === 'abierta'}
                          etiqueta={{ activo: 'Abierta', inactivo: 'Cerrada' }}
                          sobreOscuro
                        />
                        {s.estado === 'abierta' && (
                          <form action={enviarTodos}>
                            <input
                              type="hidden"
                              name="sesion_id"
                              value={s.id}
                            />
                            <button
                              type="submit"
                              title="Marcar a todos los alumnos presentes"
                              disabled={pendienteTodos}
                              className="inline-flex items-center gap-1 rounded-md border border-white/30 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"
                            >
                              <FiCheck size={13} aria-hidden />
                              {pendienteTodos ? 'Marcando…' : 'Todos'}
                            </button>
                          </form>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              )}
            </thead>

            <tbody>
              {alumnos.map((alumno) => {
                const presentes = sesiones.filter((s) =>
                  s.presentes.includes(alumno.id)
                ).length
                const porcentaje =
                  sesiones.length === 0
                    ? null
                    : Math.round((presentes / sesiones.length) * 100)

                return (
                  // bg-white en la fila: la celda pegajosa necesita fondo propio
                  // y bg-inherit hereda este valor (y el de las bandas y el hover).
                  <tr key={alumno.id} className={`${CLASE_FILA} bg-white`}>
                    <td
                      className={`${CLASE_CELDA} sticky left-0 z-10 min-w-[210px] bg-inherit`}
                    >
                      <p className="font-semibold text-gray-900">
                        {alumno.nombre}
                      </p>
                      <p className="text-xs text-gray-500">
                        #{alumno.numero_cuenta}
                      </p>
                    </td>

                    {sesiones.map((sesion) => {
                      const presente = sesion.presentes.includes(alumno.id)
                      const editable = sesion.estado === 'abierta'

                      return (
                        <td
                          key={sesion.id}
                          className="px-2 py-2 text-center align-middle"
                        >
                          <button
                            type="button"
                            onClick={() => marcar(sesion.id, alumno.id)}
                            disabled={!editable || pendiente}
                            aria-pressed={presente}
                            aria-label={`${alumno.nombre}, ${fechaLarga(
                              sesion.fecha
                            )}: ${presente ? 'presente' : 'ausente'}`}
                            className={`mx-auto flex h-8 w-8 items-center justify-center rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06065c] disabled:cursor-default disabled:opacity-45 ${
                              presente
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : editable
                                  ? 'border-gray-200 bg-white text-gray-300 hover:border-[#0f49b6] hover:text-[#0f49b6]'
                                  : 'border-gray-100 bg-gray-50 text-gray-300'
                            }`}
                          >
                            {presente ? (
                              <FiCheck size={16} aria-hidden />
                            ) : (
                              <span aria-hidden>—</span>
                            )}
                          </button>
                        </td>
                      )
                    })}

                    <td className="px-4 py-3 text-right align-middle font-medium tabular-nums text-gray-900">
                      {porcentaje === null ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        `${porcentaje}%`
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {alumnos.length > 0 && sesiones.length === 0 && (
        <p className="text-sm text-gray-500">
          Aún no hay sesiones para esta sección. Abre la de hoy para empezar a
          marcar.
        </p>
      )}
    </div>
  )
}
