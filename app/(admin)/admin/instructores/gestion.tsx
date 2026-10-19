'use client'

import { useEffect, useState, useActionState } from 'react'
import { FiEdit2, FiLayers, FiPlus, FiTrash2 } from 'react-icons/fi'
import {
  actualizarInstructor,
  alternarInstructor,
  eliminarInstructor,
  crearInstructor,
} from './actions'
import { BotonesModal, Campo, ModalBase } from '@/components/ui/modal'
import { InterruptorEstado } from '@/components/ui/interruptor-estado'
import {
  ESTADO_INICIAL,
  type EstadoAccion,
  type Perfil,
  type SeccionResumen,
} from '@/lib/types'

function plural(n: number, palabra: string) {
  return `${n} ${palabra}${n === 1 ? '' : 's'}`
}

function FormularioCrear({
  onExito,
  onCancelar,
}: {
  onExito: () => void
  onCancelar: () => void
}) {
  const [estado, enviar, pendiente] = useActionState(crearInstructor, ESTADO_INICIAL)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (estado.ok) onExito()
  }, [estado, onExito])

  return (
    <form action={enviar} className="space-y-4">
      <Campo
        label="Nombre completo"
        name="nombre"
        valor={nombre}
        onChange={setNombre}
        placeholder="Ing. María López"
        disabled={pendiente}
        requerido
        maxLength={120}
      />

      <Campo
        label="Correo institucional"
        name="email"
        tipo="email"
        valor={email}
        onChange={setEmail}
        placeholder="instructor@universidad.com"
        disabled={pendiente}
        requerido
      />

      <Campo
        label="Contraseña provisional"
        name="password"
        tipo="password"
        valor={password}
        onChange={setPassword}
        placeholder="Mínimo 6 caracteres"
        disabled={pendiente}
        requerido
      />

      {estado.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {estado.error}
        </p>
      )}

      <BotonesModal
        onCancelar={onCancelar}
        guardando={pendiente}
        texto="Crear cuenta"
        textoGuardando="Creando..."
      />
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
  const [nombre, setNombre] = useState(cuenta.nombre)

  useEffect(() => {
    if (estado.ok) onExito()
  }, [estado, onExito])

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="id" value={cuenta.id} />

      <Campo
        label="Nombre completo"
        name="nombre"
        valor={nombre}
        onChange={setNombre}
        disabled={pendiente}
        requerido
        maxLength={120}
      />

      <Campo label="Correo" name="email" valor={cuenta.email ?? ''} onChange={() => {}} disabled>
        <input
          type="email"
          name="email"
          value={cuenta.email ?? ''}
          disabled
          className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2.5 text-sm text-gray-500"
        />
      </Campo>

      {estado.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {estado.error}
        </p>
      )}

      <BotonesModal
        onCancelar={onCancelar}
        guardando={pendiente}
        texto="Guardar cambios"
        textoGuardando="Guardando..."
      />
    </form>
  )
}

function DetalleSecciones({
  cuenta,
  secciones,
}: {
  cuenta: Perfil
  secciones: SeccionResumen[]
}) {
  return (
    <div className="space-y-3">
      {secciones.length === 0 ? (
        <p className="text-sm text-gray-500">
          Todavía no tiene secciones asignadas.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {secciones.map((s) => (
            <li key={s.id} className="px-3 py-2.5">
              <p className="text-sm font-medium text-gray-900">
                {s.laboratorio} · Grupo {s.grupo}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {[s.periodo, s.horario, s.docente ? `Docente: ${s.docente}` : null]
                  .filter(Boolean)
                  .join(' · ') || 'Sin datos de horario'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ConfirmarEliminacion({
  cuenta,
  secciones,
  onExito,
  onCancelar,
}: {
  cuenta: Perfil
  secciones: number
  onExito: () => void
  onCancelar: () => void
}) {
  const [estado, enviar, pendiente] = useActionState(eliminarInstructor, ESTADO_INICIAL)

  useEffect(() => {
    if (estado.ok) onExito()
  }, [estado, onExito])

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={cuenta.id} />

      <p className="text-sm text-gray-600">
        ¿Estás seguro de que deseas eliminar la cuenta de{' '}
        <strong>{cuenta.nombre}</strong>{' '}
        {cuenta.email ? `(${cuenta.email})` : ''}?
      </p>

      <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
        {secciones > 0
          ? `Se eliminarán también ${plural(secciones, 'sección')} que maneja, con sus matrículas, sesiones y asistencias.`
          : 'La cuenta no tiene secciones asignadas, así que solo se borra el registro.'}{' '}
        Esta acción no se puede deshacer.
      </p>

      {estado.error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {estado.error}
        </p>
      )}

      <BotonesModal
        onCancelar={onCancelar}
        guardando={pendiente}
        texto="Eliminar"
        textoGuardando="Eliminando..."
        peligro
      />
    </form>
  )
}

export default function GestionInstructores({
  cuentas,
  seccionesPorInstructor,
}: {
  cuentas: Perfil[]
  seccionesPorInstructor: Record<string, SeccionResumen[]>
}) {
  const [modalNuevo, setModalNuevo] = useState(false)
  const [editando, setEditando] = useState<Perfil | null>(null)
  const [eliminando, setEliminando] = useState<Perfil | null>(null)
  const [verSecciones, setVerSecciones] = useState<Perfil | null>(null)

  const activas = cuentas.filter((c) => c.activo).length
  const totalSecciones = Object.values(seccionesPorInstructor).reduce(
    (a, b) => a + b.length,
    0
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {plural(cuentas.length, 'cuenta')} · {activas} activa
          {activas === 1 ? '' : 's'} · {plural(totalSecciones, 'sección')} en
          total
        </p>
        <button
          type="button"
          onClick={() => setModalNuevo(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#06065c] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0f49b6]"
        >
          <FiPlus size={16} />
          Nueva cuenta
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-gray-50">
              <tr className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Correo</th>
                <th className="px-4 py-3">Secciones</th>
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
              {cuentas.map((cuenta) => {
                const secciones = seccionesPorInstructor[cuenta.id] ?? []
                return (
                  <tr
                    key={cuenta.id}
                    className="border-t border-gray-100 hover:bg-gray-50/60"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setVerSecciones(cuenta)}
                        className="text-left text-sm font-medium text-[#06065c] underline-offset-2 hover:underline"
                        title="Ver secciones que maneja"
                      >
                        {cuenta.nombre}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {cuenta.email ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {secciones.length}
                    </td>
                    <td className="px-4 py-3">
                      <InterruptorEstado
                        accion={alternarInstructor}
                        id={cuenta.id}
                        activo={cuenta.activo}
                        etiqueta={{ activo: 'Activo', inactivo: 'Inactivo' }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setVerSecciones(cuenta)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100"
                          title="Ver secciones"
                        >
                          <FiLayers size={15} />
                          Secciones
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditando(cuenta)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-[#06065c] transition-colors hover:bg-[#06065c]/10"
                        >
                          <FiEdit2 size={15} />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEliminando(cuenta)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50"
                        >
                          <FiTrash2 size={15} />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {modalNuevo && (
        <ModalBase titulo="Crear cuenta de instructor" onCerrar={() => setModalNuevo(false)}>
          <FormularioCrear
            onExito={() => setModalNuevo(false)}
            onCancelar={() => setModalNuevo(false)}
          />
        </ModalBase>
      )}

      {editando && (
        <ModalBase titulo="Editar instructor" onCerrar={() => setEditando(null)}>
          <FormularioEditar
            key={editando.id}
            cuenta={editando}
            onExito={() => setEditando(null)}
            onCancelar={() => setEditando(null)}
          />
        </ModalBase>
      )}

      {verSecciones && (
        <ModalBase
          titulo={`Secciones de ${verSecciones.nombre}`}
          onCerrar={() => setVerSecciones(null)}
          ancho="max-w-lg"
        >
          <DetalleSecciones
            cuenta={verSecciones}
            secciones={seccionesPorInstructor[verSecciones.id] ?? []}
          />
        </ModalBase>
      )}

      {eliminando && (
        <ModalBase titulo="Eliminar instructor" onCerrar={() => setEliminando(null)}>
          <ConfirmarEliminacion
            key={eliminando.id}
            cuenta={eliminando}
            secciones={(seccionesPorInstructor[eliminando.id] ?? []).length}
            onExito={() => setEliminando(null)}
            onCancelar={() => setEliminando(null)}
          />
        </ModalBase>
      )}
    </div>
  )
}
