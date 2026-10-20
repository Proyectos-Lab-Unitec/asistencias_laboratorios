'use client'

import { useActionState } from 'react'
import { FiCheck, FiUsers } from 'react-icons/fi'
import { CLASE_CELDA, CLASE_FILA } from '@/components/ui/tabla-dato'
import { ESTADO_INICIAL } from '@/lib/types'
import { guardarNotas } from '../actions'

export type AlumnoNota = {
  id: number
  numero_cuenta: string
  nombre: string
  nota_final: number | null
}

const CLASE_BOTON =
  'inline-flex items-center gap-1.5 rounded-lg bg-[#06065c] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0f49b6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06065c] disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Captura de la nota final, una por alumno.
 *
 * Las entradas van sin controlar (defaultValue): lo que se teclea sobrevive a
 * un guardado fallido sin que haya que guardar estado en el cliente, y al
 * guardar se revalida la página con los valores ya escritos en la base.
 *
 * El guardado es de una sola pasada para toda la sección: es una tarea que se
 * hace una vez al final del trimestre, y estar guardando alumno por alumno es
 * la forma más segura de perder el trabajo a medio camino.
 */
export default function CapturaNotas({
  seccionId,
  alumnos,
}: {
  seccionId: number
  alumnos: AlumnoNota[]
}) {
  const [estado, enviar, pendiente] = useActionState(guardarNotas, ESTADO_INICIAL)

  if (alumnos.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
        <FiUsers className="mx-auto text-3xl text-[#06065c]" aria-hidden />
        <h2 className="mt-3 text-lg font-bold text-gray-900">
          Aún no hay alumnos en esta sección
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
          Cuando haya alumnos inscritos aparecerán acá con su nota final para
          capturarla.
        </p>
      </div>
    )
  }

  const conNota = alumnos.filter((a) => a.nota_final !== null).length

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="seccion_id" value={seccionId} />

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#06065c] text-white">
              <th scope="col" className="px-4 py-3 text-left">
                Alumno
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Nota final
              </th>
            </tr>
          </thead>
          <tbody>
            {alumnos.map((alumno) => (
              <tr key={alumno.id} className={`${CLASE_FILA} bg-white`}>
                <td className={CLASE_CELDA}>
                  <p className="font-semibold text-gray-900">{alumno.nombre}</p>
                  <p className="text-xs text-gray-500">
                    #{alumno.numero_cuenta}
                  </p>
                </td>
                <td className={`${CLASE_CELDA} text-right`}>
                  <input
                    type="number"
                    name={`nota_${alumno.id}`}
                    defaultValue={alumno.nota_final ?? ''}
                    min={0}
                    max={15}
                    step="0.01"
                    inputMode="decimal"
                    aria-label={`Nota final de ${alumno.nombre}`}
                    className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-right text-sm tabular-nums text-gray-900 transition-colors focus:border-[#0f49b6] focus:outline-2 focus:outline-[#0f49b6]"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <p className="text-sm text-gray-500">
          {conNota} de {alumnos.length} con nota · escala 0 a 15
        </p>

        {estado.error ? (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {estado.error}
          </p>
        ) : estado.ok ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Notas guardadas.
          </p>
        ) : null}

        <button type="submit" className={CLASE_BOTON} disabled={pendiente}>
          <FiCheck size={16} aria-hidden />
          {pendiente ? 'Guardando…' : 'Guardar notas'}
        </button>
      </div>
    </form>
  )
}
