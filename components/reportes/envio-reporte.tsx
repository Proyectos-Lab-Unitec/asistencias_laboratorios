'use client'

import { useActionState, useState } from 'react'
import { FiSend } from 'react-icons/fi'
import { ESTADO_INICIAL, type EstadoAccion } from '@/lib/types'

const CLASE_INPUT =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-black outline-none transition focus:border-[#0f49b6] focus:ring-2 focus:ring-[#0f49b6] disabled:bg-gray-100'

const CLASE_BOTON =
  'inline-flex items-center gap-1.5 rounded-lg bg-[#06065c] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0f49b6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06065c] disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Formulario de envío del reporte por Power Automate.
 *
 * Recibe la acción y los campos ocultos (sección, periodo, clase, modo) para
 * que el instructor y el admin compartan el mismo formulario: el cuerpo del
 * correo se arma otra vez en el servidor con esos filtros, así que el cliente
 * nunca decide qué tabla viaja.
 */
export default function EnvioReporte({
  accion,
  campos,
  vacio,
  configurado,
}: {
  accion: (previo: EstadoAccion, formData: FormData) => Promise<EstadoAccion>
  /**
   * Campos ocultos, como pares y no como objeto: los filtros son listas y un
   * mismo nombre puede repetirse (`seccion` varias veces).
   */
  campos: { nombre: string; valor: string }[]
  vacio: boolean
  configurado: boolean
}) {
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL)
  const [correo, setCorreo] = useState('')

  const bloqueado = vacio || pendiente

  return (
    <form
      action={enviar}
      className="space-y-3 rounded-xl border border-gray-200 bg-white p-5"
    >
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#06065c]">
          Enviar por correo
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          El mensaje lleva la tabla del reporte en HTML, lista para leer en el
          correo.
        </p>
      </div>

      {campos.map((campo, indice) => (
        <input
          key={`${campo.nombre}-${indice}`}
          type="hidden"
          name={campo.nombre}
          value={campo.valor}
        />
      ))}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <label
            htmlFor="destinatario"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Destinatario <span className="text-red-500">*</span>
          </label>
          <input
            id="destinatario"
            type="email"
            name="destinatario"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="departamento@universidad.com"
            required
            maxLength={254}
            disabled={bloqueado}
            className={CLASE_INPUT}
          />
        </div>

        <button type="submit" disabled={bloqueado} className={CLASE_BOTON}>
          <FiSend size={16} aria-hidden />
          {pendiente ? 'Enviando…' : 'Enviar'}
        </button>
      </div>

      {!configurado && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          El envío aún no está configurado: falta{' '}
          <code className="font-semibold">POWERAPPS_URL</code> en .env.local con
          el enlace del flujo de Power Automate. La descarga del Excel funciona
          igual.
        </p>
      )}

      {vacio && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          El reporte no tiene alumnos con estos filtros, así que no hay nada que
          enviar.
        </p>
      )}

      {estado.ok && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
        >
          Correo enviado a {correo || 'el destinatario indicado'}.
        </p>
      )}

      {estado.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {estado.error}
        </p>
      )}
    </form>
  )
}
