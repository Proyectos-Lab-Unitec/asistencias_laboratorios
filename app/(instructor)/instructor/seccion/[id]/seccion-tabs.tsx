'use client'

import { useState } from 'react'
import GrillaAsistencia, { type SesionAsistencia } from './grilla'
import CapturaNotas, { type AlumnoNota } from './notas'

const PESTANAS = [
  { id: 'asistencia', etiqueta: 'Asistencia' },
  { id: 'notas', etiqueta: 'Notas finales' },
] as const

type PestanaId = (typeof PESTANAS)[number]['id']

/**
 * Espacio de trabajo de una sección.
 *
 * La asistencia se vive día a día y las notas se capturan una vez al final del
 * trimestre: son dos ritmos distintos, pero los dos viven de la misma lista de
 * alumnos, así que van juntas en un solo lugar en vez de repartirse en dos
 * botones sueltos de la tabla.
 *
 * Los datos vienen ya cargados del servidor: cambiar de pestaña es instantáneo
 * y no vuelve a tocar la base.
 */
export default function EspacioSeccion({
  seccionId,
  alumnos,
  sesiones,
}: {
  seccionId: number
  alumnos: AlumnoNota[]
  sesiones: SesionAsistencia[]
}) {
  const [pestana, setPestana] = useState<PestanaId>('asistencia')

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Secciones de la gestión de la sección"
        className="flex gap-1 border-b border-gray-200"
      >
        {PESTANAS.map((p) => {
          const activa = pestana === p.id
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => setPestana(p.id)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06065c] ${
                activa
                  ? 'border-[#06065c] text-[#06065c]'
                  : 'border-transparent text-gray-500 hover:text-[#06065c]'
              }`}
            >
              {p.etiqueta}
            </button>
          )
        })}
      </div>

      {pestana === 'asistencia' ? (
        <GrillaAsistencia seccionId={seccionId} alumnos={alumnos} sesiones={sesiones} />
      ) : (
        <CapturaNotas seccionId={seccionId} alumnos={alumnos} />
      )}
    </div>
  )
}
