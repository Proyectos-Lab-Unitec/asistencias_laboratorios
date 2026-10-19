'use client'

import { useEffect } from 'react'
import { FiX } from 'react-icons/fi'

/**
 * Piezas de modal compartidas por los CRUD del admin. El diseño replica el
 * de proyectoReserva (ModalBase / Campo / BotonesModal); solo cambia el
 * color de acento, que acá es el azul institucional del sistema.
 */

export function ModalBase({
  titulo,
  onCerrar,
  children,
  ancho = 'max-w-md',
}: {
  titulo: string
  onCerrar: () => void
  children: React.ReactNode
  ancho?: string
}) {
  // Escape cierra, como en cualquier modal estándar
  useEffect(() => {
    const manejar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', manejar)
    return () => document.removeEventListener('keydown', manejar)
  }, [onCerrar])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`w-full ${ancho} rounded-2xl bg-white p-6 shadow-2xl`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Cerrar modal"
          >
            <FiX size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Campo({
  label,
  tipo = 'text',
  name,
  valor,
  onChange,
  placeholder,
  disabled,
  requerido,
  min,
  maxLength,
  children,
}: {
  label: string
  tipo?: string
  name: string
  valor: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  requerido?: boolean
  min?: number
  maxLength?: number
  /** Si se pasa, renderiza un select en vez de un input */
  children?: React.ReactNode
}) {
  const clase =
    'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-black outline-none transition focus:border-[#0f49b6] focus:ring-2 focus:ring-[#0f49b6] disabled:bg-gray-100'

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {requerido && <span className="text-red-500"> *</span>}
      </label>
      {children ?? (
        <input
          type={tipo}
          name={name}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={requerido}
          min={min}
          maxLength={maxLength}
          className={clase}
        />
      )}
    </div>
  )
}

export function BotonesModal({
  onCancelar,
  guardando,
  texto,
  textoGuardando,
  peligro,
}: {
  onCancelar: () => void
  guardando: boolean
  texto: string
  textoGuardando: string
  /** true = botón rojo (destructivo) en vez del azul institucional */
  peligro?: boolean
}) {
  return (
    <div className="mt-6 flex justify-end gap-3 border-t pt-4">
      <button
        type="button"
        onClick={onCancelar}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
        disabled={guardando}
      >
        Cancelar
      </button>
      <button
        type="submit"
        className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          peligro
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-[#06065c] hover:bg-[#0f49b6]'
        }`}
        disabled={guardando}
      >
        {guardando ? textoGuardando : texto}
      </button>
    </div>
  )
}
