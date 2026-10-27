'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FiChevronRight } from 'react-icons/fi'
import { ModalBase } from '@/components/ui/modal'

/** Fila concreta detrás de un pendiente del dashboard. */
export type ElementoPendiente = {
  id: string
  titulo: string
  subtitulo: string
  /** Si viene, la fila abre esa sección en /admin/laboratorios. */
  href?: string
}

/**
 * Un pendiente del panel. Si trae `elementos`, al hacer clic abre un modal con
 * el detalle; si no, navega a `href` como antes.
 */
export type PendienteDashboard = {
  clave: string
  titulo: string
  detalle: string
  href?: string
  elementos?: ElementoPendiente[]
}

const CLASE_FILA =
  'flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left transition-colors hover:bg-[#06065c]/[0.04] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#06065c]'

/**
 * "Requiere atención" con detalle.
 *
 * Los datos ya vienen resueltos del servidor (el panel los carga igual para
 * calcular los totales), así que abrir la lista no dispara consultas: solo
 * muestra lo que ya está en memoria.
 */
export default function Pendientes({
  pendientes,
}: {
  pendientes: PendienteDashboard[]
}) {
  const [abierto, setAbierto] = useState<PendienteDashboard | null>(null)

  const cerrar = () => setAbierto(null)

  return (
    <>
      <ul className="divide-y divide-gray-100">
        {pendientes.map((pendiente) => {
          const contenido = (
            <>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900">
                  {pendiente.titulo}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  {pendiente.detalle}
                </span>
              </span>
              <FiChevronRight
                size={16}
                aria-hidden
                className="shrink-0 text-gray-400"
              />
            </>
          )

          return (
            <li key={pendiente.clave}>
              {pendiente.elementos ? (
                <button
                  type="button"
                  onClick={() => setAbierto(pendiente)}
                  aria-haspopup="dialog"
                  className={CLASE_FILA}
                >
                  {contenido}
                </button>
              ) : (
                <Link href={pendiente.href ?? '/admin'} className={CLASE_FILA}>
                  {contenido}
                </Link>
              )}
            </li>
          )
        })}
      </ul>

      {abierto?.elementos && (
        <ModalBase titulo={abierto.titulo} ancho="max-w-2xl" onCerrar={cerrar}>
          <p className="mb-3 text-xs text-gray-500">
            {abierto.elementos.some((elemento) => elemento.href)
              ? 'Haz clic en una sección para abrirla en Laboratorios.'
              : abierto.detalle}
          </p>

          <ul className="max-h-[60vh] divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
            {abierto.elementos.map((elemento) => {
              const fila = (
                <span className="flex min-w-0 items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900">
                      {elemento.titulo}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {elemento.subtitulo}
                    </span>
                  </span>
                  {elemento.href && (
                    <FiChevronRight
                      size={16}
                      aria-hidden
                      className="shrink-0 text-gray-400"
                    />
                  )}
                </span>
              )

              return (
                <li key={elemento.id}>
                  {elemento.href ? (
                    <Link
                      href={elemento.href}
                      className="block transition-colors hover:bg-[#06065c]/[0.04] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#06065c]"
                    >
                      {fila}
                    </Link>
                  ) : (
                    <div>{fila}</div>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="mt-6 flex justify-end border-t pt-4">
            <button
              type="button"
              onClick={cerrar}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              Cerrar
            </button>
          </div>
        </ModalBase>
      )}
    </>
  )
}
