'use client'

import { useCallback, useEffect, useState, useActionState } from 'react'
import { FiEdit2, FiPlus, FiX } from 'react-icons/fi'
import {
  actualizarInstructor,
  alternarInstructor,
  crearInstructor,
} from './actions'
import { ESTADO_INICIAL, type EstadoAccion, type Perfil } from '@/lib/types'

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

function FormularioCrear({ onExito }: { onExito: () => void }) {
  const [estado, enviar, pendiente] = useActionState(crearInstructor, ESTADO_INICIAL)

  useEffect(() => {
    if (estado.ok) onExito()
  }, [estado, onExito])

  return (
    <form action={enviar} className="grid gap-4 md:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Nombre completo
        </label>
        <input
          name="nombre"
          required
          maxLength={120}
          disabled={pendiente}
          placeholder="Ing. María López"
          className={claseInput}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Correo institucional
        </label>
        <input
          name="email"
          type="email"
          required
          disabled={pendiente}
          placeholder="instructor@universidad.com"
          className={claseInput}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Contraseña provisional
        </label>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          disabled={pendiente}
          placeholder="Mínimo 6 caracteres"
          className={claseInput}
        />
      </div>

      <div className="flex items-end gap-2">
        <button type="submit" disabled={pendiente} className={claseBtnPrimario}>
          {pendiente ? 'Creando…' : 'Crear cuenta'}
        </button>
      </div>

      {estado.error && (
        <p className="text-sm text-red-600 md:col-span-2">{estado.error}</p>
      )}
    </form>
  )
}

function FormularioEditar({
  cuenta,
  onExito,
  onCancelar,
}: {
  cuenta: Perfil
  onExito: () => void
  onCancelar: () => void
}) {
  const [estado, enviar, pendiente] = useActionState(actualizarInstructor, ESTADO_INICIAL)

  useEffect(() => {
    if (estado.ok) onExito()
  }, [estado, onExito])

  return (
    <form action={enviar} className="grid gap-4 md:grid-cols-[1fr_auto]">
      <input type="hidden" name="id" value={cuenta.id} />

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Nombre completo
        </label>
        <input
          name="nombre"
          defaultValue={cuenta.nombre}
          required
          maxLength={120}
          disabled={pendiente}
          className={claseInput}
        />
      </div>

      <div className="flex items-end gap-2">
        <button type="submit" disabled={pendiente} className={claseBtnPrimario}>
          {pendiente ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={pendiente}
          className={claseBtnSecundario}
        >
          Cancelar
        </button>
      </div>

      {estado.error && (
        <p className="text-sm text-red-600 md:col-span-2">{estado.error}</p>
      )}
    </form>
  )
}

function FilaCuenta({
  cuenta,
  onEditar,
}: {
  cuenta: Perfil
  onEditar: () => void
}) {
  const [estado, enviar, pendiente] = useActionState(alternarInstructor, ESTADO_INICIAL)

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/60">
      <td className="px-4 py-3 text-sm font-medium text-gray-900">
        {cuenta.nombre}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{cuenta.email ?? '—'}</td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-[#06065c]/10 px-2.5 py-1 text-xs font-medium text-[#06065c]">
          Instructor
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            cuenta.activo
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {cuenta.activo ? 'Activo' : 'Inactivo'}
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
            <input type="hidden" name="id" value={cuenta.id} />
            <input
              type="hidden"
              name="activo"
              value={String(!cuenta.activo)}
            />
            <button
              type="submit"
              disabled={pendiente}
              className="rounded-lg px-2.5 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              {pendiente
                ? 'Procesando…'
                : cuenta.activo
                  ? 'Desactivar'
                  : 'Activar'}
            </button>
          </form>
        </div>
      </td>
    </tr>
  )
}

export default function GestionInstructores({
  cuentas,
}: {
  cuentas: Perfil[]
}) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState<Perfil | null>(null)

  const cerrarForm = useCallback(() => setMostrarForm(false), [])
  const cerrarEdicion = useCallback(() => setEditando(null), [])

  const activas = cuentas.filter((c) => c.activo).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {cuentas.length} cuenta{cuentas.length === 1 ? '' : 's'} · {activas}{' '}
          activa{activas === 1 ? '' : 's'}
        </p>
        {!mostrarForm && (
          <button
            type="button"
            onClick={() => setMostrarForm(true)}
            className={claseBtnPrimario}
          >
            <FiPlus size={16} />
            Nueva cuenta
          </button>
        )}
      </div>

      {mostrarForm && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Crear cuenta de instructor
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
          <FormularioCrear onExito={cerrarForm} />
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-gray-50">
              <tr className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Correo</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cuentas.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-gray-500"
                  >
                    Aún no hay cuentas de instructor. Crea la primera con el
                    botón de arriba.
                  </td>
                </tr>
              )}
              {cuentas.map((cuenta) => (
                <FilaCuenta
                  key={cuenta.id}
                  cuenta={cuenta}
                  onEditar={() => setEditando(cuenta)}
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
          <FormularioEditar
            key={editando.id}
            cuenta={editando}
            onExito={cerrarEdicion}
            onCancelar={cerrarEdicion}
          />
        </section>
      )}
    </div>
  )
}
