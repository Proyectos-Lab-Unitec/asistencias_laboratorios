'use client'

import { useCallback, useEffect, useState, useActionState } from 'react'
import { FiEdit2, FiPlus, FiX } from 'react-icons/fi'
import {
  actualizarLaboratorio,
  alternarLaboratorio,
  crearLaboratorio,
} from './actions'
import {
  ESTADO_INICIAL,
  type EstadoAccion,
  type Laboratorio,
} from '@/lib/types'

const claseInput =
  'w-full rounded-lg border border-gray-300 p-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#06065c]'
const claseBtnPrimario =
  'inline-flex items-center gap-2 rounded-lg bg-[#06065c] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0f49b6] disabled:cursor-not-allowed disabled:opacity-50'
const claseBtnSecundario =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'

type AccionForm = (
  previo: EstadoAccion,
  formData: FormData
) => Promise<EstadoAccion>

function FormularioLaboratorio({
  accion,
  inicial,
  onExito,
  onCancelar,
}: {
  accion: AccionForm
  inicial?: Laboratorio
  onExito?: () => void
  onCancelar?: () => void
}) {
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL)

  useEffect(() => {
    if (estado.ok) onExito?.()
  }, [estado, onExito])

  return (
    <form action={enviar} className="grid gap-4 md:grid-cols-[1.4fr_1.4fr_160px_auto]">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Nombre
        </label>
        <input
          name="nombre"
          defaultValue={inicial?.nombre ?? ''}
          required
          maxLength={120}
          disabled={pendiente}
          placeholder="Laboratorio 1"
          className={claseInput}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Ubicación
        </label>
        <input
          name="ubicacion"
          defaultValue={inicial?.ubicacion ?? ''}
          maxLength={160}
          disabled={pendiente}
          placeholder="Edificio B, piso 2"
          className={claseInput}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Capacidad
        </label>
        <input
          name="capacidad"
          type="number"
          min={1}
          defaultValue={inicial?.capacidad ?? 30}
          required
          disabled={pendiente}
          className={claseInput}
        />
      </div>

      <div className="flex items-end gap-2">
        <button type="submit" disabled={pendiente} className={claseBtnPrimario}>
          {pendiente ? 'Guardando…' : inicial ? 'Guardar' : 'Crear'}
        </button>
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            disabled={pendiente}
            className={claseBtnSecundario}
          >
            Cancelar
          </button>
        )}
      </div>

      {estado.error && (
        <p className="text-sm text-red-600 md:col-span-full">{estado.error}</p>
      )}
    </form>
  )
}

function FilaLaboratorio({
  laboratorio,
  onEditar,
}: {
  laboratorio: Laboratorio
  onEditar: () => void
}) {
  const [estado, enviar, pendiente] = useActionState(
    alternarLaboratorio,
    ESTADO_INICIAL
  )

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/60">
      <td className="px-4 py-3 text-sm text-gray-500">{laboratorio.id}</td>
      <td className="px-4 py-3 text-sm font-medium text-gray-900">
        {laboratorio.nombre}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {laboratorio.ubicacion ?? <span className="text-gray-400">—</span>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {laboratorio.capacidad}
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            laboratorio.activo
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {laboratorio.activo ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          {estado.error && (
            <span className="text-xs text-red-600">{estado.error}</span>
          )}
          <button
            type="button"
            onClick={onEditar}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-[#06065c] transition-colors hover:bg-[#06065c]/10"
          >
            <FiEdit2 size={15} />
            Editar
          </button>
          <form action={enviar}>
            <input type="hidden" name="id" value={laboratorio.id} />
            <input
              type="hidden"
              name="activo"
              value={String(!laboratorio.activo)}
            />
            <button
              type="submit"
              disabled={pendiente}
              className="rounded-lg px-2.5 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              {pendiente
                ? 'Procesando…'
                : laboratorio.activo
                  ? 'Desactivar'
                  : 'Activar'}
            </button>
          </form>
        </div>
      </td>
    </tr>
  )
}

export default function GestionLaboratorios({
  laboratorios,
}: {
  laboratorios: Laboratorio[]
}) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState<Laboratorio | null>(null)

  const cerrarForm = useCallback(() => setMostrarForm(false), [])
  const cerrarEdicion = useCallback(() => setEditando(null), [])

  const activos = laboratorios.filter((lab) => lab.activo).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {laboratorios.length} laboratorio
          {laboratorios.length === 1 ? '' : 's'} en total · {activos} activo
          {activos === 1 ? '' : 's'}
        </p>
        {!mostrarForm && (
          <button
            type="button"
            onClick={() => setMostrarForm(true)}
            className={claseBtnPrimario}
          >
            <FiPlus size={16} />
            Nuevo laboratorio
          </button>
        )}
      </div>

      {mostrarForm && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Crear laboratorio
            </h2>
            <button
              type="button"
              onClick={cerrarForm}
              aria-label="Cerrar"
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <FiX size={18} />
            </button>
          </div>
          <FormularioLaboratorio
            accion={crearLaboratorio}
            onExito={cerrarForm}
            onCancelar={cerrarForm}
          />
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-gray-50">
              <tr className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Ubicación</th>
                <th className="px-4 py-3">Capacidad</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {laboratorios.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-gray-500"
                  >
                    Aún no hay laboratorios. Crea el primero con el botón de
                    arriba.
                  </td>
                </tr>
              )}
              {laboratorios.map((lab) => (
                <FilaLaboratorio
                  key={lab.id}
                  laboratorio={lab}
                  onEditar={() => setEditando(lab)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editando && (
        <section className="rounded-xl border border-[#06065c]/20 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Editando: {editando.nombre}
            </h2>
            <button
              type="button"
              onClick={cerrarEdicion}
              aria-label="Cerrar"
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <FiX size={18} />
            </button>
          </div>
          <FormularioLaboratorio
            key={editando.id}
            accion={actualizarLaboratorio}
            inicial={editando}
            onExito={cerrarEdicion}
            onCancelar={cerrarEdicion}
          />
        </section>
      )}
    </div>
  )
}
