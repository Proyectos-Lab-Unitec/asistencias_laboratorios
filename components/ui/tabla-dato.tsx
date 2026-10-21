'use client'

import type { ReactNode } from 'react'
import {
  FiChevronLeft,
  FiChevronRight,
  FiSearch,
  FiTrash2,
} from 'react-icons/fi'

/**
 * Tabla de datos de las pantallas de gestión.
 *
 * La cabecera es una banda del azul de marca (#06065c, el mismo del sidebar y
 * de los botones): es el único momento fuerte de la tabla, y todo lo demás
 * (filas, celdas, acciones) queda deliberadamente más tranquilo para que esa
 * banda lea como la cumbre de la tarjeta.
 *
 * La tabla se pagina sola y el filtrado se hace en el cliente sobre los datos
 * que ya vienen cargados: no hay round-trip al servidor al escribir.
 */

export const POR_PAGINA = 15

export type ColumnaTabla = {
  etiqueta: string
  /** Clases extra del <th>, p. ej. 'text-right' para columnas numéricas. */
  clase?: string
  /**
   * Si viene, el <th> renderiza esto en vez de la etiqueta. Se usa para la
   * casilla de «seleccionar todo», que necesita estado.
   */
  nodo?: ReactNode
}

/** Fila estándar: bandas suaves, hover del azul de marca y foco de teclado. */
export const CLASE_FILA =
  'group border-t border-gray-100 text-black transition-colors duration-150 even:bg-gray-50 hover:bg-[#06065c]/[0.08] focus-within:bg-[#06065c]/[0.08]'

/** Celda estándar. */
export const CLASE_CELDA = 'px-4 py-4 align-middle text-sm'

/** Botón de acción dentro de una fila: colores del sistema, foco visible. */
export const CLASE_ACCION =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06065c]'

const CLASE_BOTON_PAGINA =
  'inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06065c] disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300'

/**
 * Búsqueda sin acentos: «ubicacion» encuentra «Ubicación». La app es
 * español-only, así que esto es lo esperado, no un extra.
 */
export function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function BarraBusqueda({
  id,
  valor,
  onCambio,
  placeholder,
  etiqueta,
}: {
  id: string
  valor: string
  onCambio: (valor: string) => void
  placeholder: string
  etiqueta: string
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <label htmlFor={id} className="sr-only">
        {etiqueta}
      </label>
      <FiSearch
        aria-hidden
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        id={id}
        type="search"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 transition-colors placeholder:text-gray-500 hover:border-gray-300 focus:border-[#06065c] focus:outline-none focus:ring-2 focus:ring-[#06065c]/15"
      />
    </div>
  )
}

export function Paginacion({
  desde,
  hasta,
  total,
  pagina,
  totalPaginas,
  onCambio,
}: {
  desde: number
  hasta: number
  total: number
  pagina: number
  totalPaginas: number
  onCambio: (pagina: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-gray-500">
        Mostrando{' '}
        <span className="font-medium tabular-nums text-gray-900">
          {desde}–{hasta}
        </span>{' '}
        de{' '}
        <span className="font-medium tabular-nums text-gray-900">{total}</span>
      </p>

      {totalPaginas > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onCambio(pagina - 1)}
            disabled={pagina <= 1}
            aria-label="Página anterior"
            className={`${CLASE_BOTON_PAGINA} text-gray-700 hover:border-[#06065c]/30 hover:text-[#06065c]`}
          >
            <FiChevronLeft size={15} />
            Anterior
          </button>

          <span className="px-1 text-sm tabular-nums text-gray-500">
            Página {pagina} de {totalPaginas}
          </span>

          <button
            type="button"
            onClick={() => onCambio(pagina + 1)}
            disabled={pagina >= totalPaginas}
            aria-label="Página siguiente"
            className={`${CLASE_BOTON_PAGINA} text-gray-700 hover:border-[#06065c]/30 hover:text-[#06065c]`}
          >
            Siguiente
            <FiChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  )
}

export function TablaDato({
  columnas,
  total,
  vacio,
  anchoMinimo = 'min-w-[720px]',
  herramienta,
  pie,
  children,
}: {
  columnas: ColumnaTabla[]
  /** Número de filas visibles; si es 0 se muestra el estado vacío. */
  total: number
  vacio: {
    titulo: string
    detalle: string
    icono: ReactNode
    /** Acción de recuperación opcional, p. ej. limpiar la búsqueda. */
    accion?: { etiqueta: string; onClic: () => void }
  }
  anchoMinimo?: string
  /** Franja superior de la tarjeta, p. ej. la barra de búsqueda. */
  herramienta?: ReactNode
  /** Franja inferior de la tarjeta, p. ej. la paginación. */
  pie?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {herramienta && (
        <div className="border-b border-gray-100 px-4 py-3">{herramienta}</div>
      )}

      <div className="overflow-x-auto [scrollbar-color:#c3c9d6_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar]:rounded-full [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#c3c9d6] [&::-webkit-scrollbar-thumb]:transition-colors hover:[&::-webkit-scrollbar-thumb]:bg-[#06065c]/40">
        <table
          className={`w-full ${anchoMinimo} text-left caret-[#06065c] selection:bg-[#06065c] selection:text-white`}
        >
          <thead className="bg-[#06065c]">
            <tr className="text-[11px] font-semibold uppercase tracking-[0.09em] text-white/90">
              {columnas.map((col) => (
                <th
                  key={col.etiqueta}
                  scope="col"
                  className={`px-4 py-3.5 ${col.clase ?? ''}`}
                >
                  {col.nodo ?? col.etiqueta}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {total === 0 ? (
              <tr>
                <td colSpan={columnas.length} className="px-4 py-14">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#06065c]/[0.07] text-[#06065c]">
                      {vacio.icono}
                    </span>
                    <p className="text-sm font-semibold text-gray-900">
                      {vacio.titulo}
                    </p>
                    <p className="max-w-xs break-words text-sm text-gray-500">
                      {vacio.detalle}
                    </p>
                    {vacio.accion && (
                      <button
                        type="button"
                        onClick={vacio.accion.onClic}
                        className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-[#06065c] transition-colors hover:border-[#06065c]/30 hover:bg-[#06065c]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06065c]"
                      >
                        <FiSearch size={14} />
                        {vacio.accion.etiqueta}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>

      {pie && <div className="border-t border-gray-100 px-4 py-3">{pie}</div>}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Selección múltiple
//
// Se arma con piezas sueltas y no con un hook: cada pantalla ya tiene su
// `useState`, así que acá solo hacen falta la casilla de la cabecera, la de la
// fila y la barra de acciones.
// ---------------------------------------------------------------------------

export const CLASE_CASILLA =
  'h-4 w-4 cursor-pointer accent-[#06065c] disabled:cursor-not-allowed disabled:opacity-40'

/** Casilla del <th>: marca o desmarca de un golpe lo que se ve en la página. */
export function CasillaCabecera<T extends string | number>({
  visibles,
  seleccionados,
  onCambio,
}: {
  /** ids de las filas que se están mostrando */
  visibles: T[]
  seleccionados: T[]
  onCambio: (ids: T[]) => void
}) {
  const marcados = visibles.filter((id) => seleccionados.includes(id)).length
  const todos = visibles.length > 0 && marcados === visibles.length
  const algunos = marcados > 0 && !todos

  return (
    <input
      type="checkbox"
      checked={todos}
      disabled={visibles.length === 0}
      ref={(el) => {
        // Estado intermedio: hay algo marcado, pero no todo lo visible.
        if (el) el.indeterminate = algunos
      }}
      onChange={() =>
        onCambio(
          todos
            ? seleccionados.filter((id) => !visibles.includes(id))
            : [...new Set([...seleccionados, ...visibles])]
        )
      }
      aria-label={
        todos ? 'Quitar selección de la página' : 'Seleccionar toda la página'
      }
      className={CLASE_CASILLA}
    />
  )
}

/** Casilla de una fila. */
export function CasillaFila<T extends string | number>({
  id,
  marcada,
  onCambio,
  etiqueta,
}: {
  id: T
  marcada: boolean
  onCambio: (id: T) => void
  etiqueta: string
}) {
  return (
    <input
      type="checkbox"
      checked={marcada}
      onChange={() => onCambio(id)}
      aria-label={`Seleccionar ${etiqueta}`}
      className={CLASE_CASILLA}
    />
  )
}

/** Barra que aparece cuando hay algo seleccionado. */
export function BarraSeleccion({
  cantidad,
  onEliminar,
  onLimpiar,
}: {
  cantidad: number
  onEliminar: () => void
  onLimpiar: () => void
}) {
  if (cantidad === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#06065c]/20 bg-[#06065c]/[0.04] px-4 py-3">
      <p className="text-sm font-medium text-[#06065c]">
        {cantidad} seleccionado{cantidad === 1 ? '' : 's'}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onLimpiar}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onEliminar}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
        >
          <FiTrash2 size={15} aria-hidden />
          Eliminar {cantidad}
        </button>
      </div>
    </div>
  )
}
