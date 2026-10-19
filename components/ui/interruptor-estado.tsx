'use client'

import { useActionState } from 'react'
import { ESTADO_INICIAL, type EstadoAccion } from '@/lib/types'

/**
 * Switch de activo/inactivo que dispara una server action al cambiar.
 *
 * Va en la columna Estado de las tablas del admin. Existe como pieza
 * aparte porque cada fila necesita su propio useActionState (no se puede
 * llamar un hook dentro de un map).
 */
export function InterruptorEstado({
  accion,
  id,
  activo,
  etiqueta,
}: {
  accion: (
    previo: EstadoAccion,
    formData: FormData
  ) => Promise<EstadoAccion>
  id: string | number
  activo: boolean
  etiqueta: { activo: string; inactivo: string }
}) {
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL)

  return (
    <form action={enviar} className="flex items-center gap-2.5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="activo" value={String(!activo)} />

      <button
        type="submit"
        role="switch"
        aria-checked={activo}
        aria-label={activo ? etiqueta.activo : etiqueta.inactivo}
        disabled={pendiente}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          activo ? 'bg-[#06065c]' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            activo ? 'translate-x-[18px]' : 'translate-x-[3px]'
          }`}
        />
      </button>

      <span className="text-xs font-medium text-gray-600">
        {pendiente ? 'Guardando…' : activo ? etiqueta.activo : etiqueta.inactivo}
      </span>

      {estado.error && (
        <span className="text-xs text-red-600">{estado.error}</span>
      )}
    </form>
  )
}
