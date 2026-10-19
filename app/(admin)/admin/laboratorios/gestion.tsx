'use client'

import { useEffect, useState, useActionState } from 'react'
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi'
import {
  actualizarLaboratorio,
  alternarLaboratorio,
  eliminarLaboratorio,
  crearLaboratorio,
} from './actions'
import { BotonesModal, Campo, ModalBase } from '@/components/ui/modal'
import { InterruptorEstado } from '@/components/ui/interruptor-estado'
import { ESTADO_INICIAL, type EstadoAccion, type Laboratorio } from '@/lib/types'

type AccionForm = (
  previo: EstadoAccion,
  formData: FormData
) => Promise<EstadoAccion>

function plural(n: number, palabra: string) {
  return `${n} ${palabra}${n === 1 ? '' : 'es'}`
}

function FormularioLaboratorio({
  accion,
  inicial,
  onExito,
  onCancelar,
}: {
  accion: AccionForm
  inicial?: Laboratorio
  onExito: () => void
  onCancelar: () => void
}) {
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL)
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [ubicacion, setUbicacion] = useState(inicial?.ubicacion ?? '')
  const [capacidad, setCapacidad] = useState(String(inicial?.capacidad ?? 30))

  useEffect(() => {
    if (estado.ok) onExito()
  }, [estado, onExito])

  return (
    <form action={enviar} className="space-y-4">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}

      <Campo
        label="Nombre"
        name="nombre"
        valor={nombre}
        onChange={setNombre}
        placeholder="Laboratorio 1"
        disabled={pendiente}
        requerido
        maxLength={120}
      />

      <Campo
        label="Ubicación"
        name="ubicacion"
        valor={ubicacion}
        onChange={setUbicacion}
        placeholder="Edificio B, piso 2"
        disabled={pendiente}
        maxLength={160}
      />

      <Campo
        label="Capacidad"
        name="capacidad"
        tipo="number"
        valor={capacidad}
        onChange={setCapacidad}
        disabled={pendiente}
        requerido
        min={1}
      />

      {estado.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {estado.error}
        </p>
      )}

      <BotonesModal
        onCancelar={onCancelar}
        guardando={pendiente}
        texto={inicial ? 'Guardar cambios' : 'Crear laboratorio'}
        textoGuardando="Guardando..."
      />
    </form>
  )
}

function ConfirmarEliminacion({
  laboratorio,
  secciones,
  onExito,
  onCancelar,
}: {
  laboratorio: Laboratorio
  secciones: number
  onExito: () => void
  onCancelar: () => void
}) {
  const [estado, enviar, pendiente] = useActionState(
    eliminarLaboratorio,
    ESTADO_INICIAL
  )

  useEffect(() => {
    if (estado.ok) onExito()
  }, [estado, onExito])

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={laboratorio.id} />

      <p className="text-sm text-gray-600">
        ¿Estás seguro de que deseas eliminar{' '}
        <strong>{laboratorio.nombre}</strong>?
      </p>

      <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
        {secciones > 0
          ? `Se eliminarán también ${plural(secciones, 'sección')} que maneja, con sus matrículas, sesiones y asistencias.`
          : 'Este laboratorio no tiene secciones asociadas, así que solo se borra el registro.'}{' '}
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

export default function GestionLaboratorios({
  laboratorios,
  seccionesPorLaboratorio,
}: {
  laboratorios: Laboratorio[]
  seccionesPorLaboratorio: Record<number, number>
}) {
  const [modalNuevo, setModalNuevo] = useState(false)
  const [editando, setEditando] = useState<Laboratorio | null>(null)
  const [eliminando, setEliminando] = useState<Laboratorio | null>(null)

  const cerrarNuevo = () => setModalNuevo(false)
  const cerrarEdicion = () => setEditando(null)
  const cerrarEliminacion = () => setEliminando(null)

  const activos = laboratorios.filter((lab) => lab.activo).length
  const totalSecciones = Object.values(seccionesPorLaboratorio).reduce(
    (a, b) => a + b,
    0
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Laboratorios: {laboratorios.length} ● Activos: {activos} ● Secciones en
          total: {totalSecciones}
        </p>
        <button
          type="button"
          onClick={() => setModalNuevo(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#06065c] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0f49b6]"
        >
          <FiPlus size={16} />
          Nuevo laboratorio
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-180 text-left">
            <thead className="bg-gray-50">
              <tr className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Ubicación</th>
                <th className="px-4 py-3">Capacidad</th>
                <th className="px-4 py-3">Secciones</th>
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
                <tr
                  key={lab.id}
                  className="border-t border-gray-100 hover:bg-gray-50/60"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {lab.nombre}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {lab.ubicacion ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {lab.capacidad}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {seccionesPorLaboratorio[lab.id] ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <InterruptorEstado
                      accion={alternarLaboratorio}
                      id={lab.id}
                      activo={lab.activo}
                      etiqueta={{ activo: 'Activo', inactivo: 'Inactivo' }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditando(lab)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-[#06065c] transition-colors hover:bg-[#06065c]/10"
                      >
                        <FiEdit2 size={15} />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEliminando(lab)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50"
                      >
                        <FiTrash2 size={15} />
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modalNuevo && (
        <ModalBase titulo="Crear laboratorio" onCerrar={cerrarNuevo}>
          <FormularioLaboratorio
            accion={crearLaboratorio}
            onExito={cerrarNuevo}
            onCancelar={cerrarNuevo}
          />
        </ModalBase>
      )}

      {editando && (
        <ModalBase titulo="Editar laboratorio" onCerrar={cerrarEdicion}>
          <FormularioLaboratorio
            key={editando.id}
            accion={actualizarLaboratorio}
            inicial={editando}
            onExito={cerrarEdicion}
            onCancelar={cerrarEdicion}
          />
        </ModalBase>
      )}

      {eliminando && (
        <ModalBase titulo="Eliminar laboratorio" onCerrar={cerrarEliminacion}>
          <ConfirmarEliminacion
            key={eliminando.id}
            laboratorio={eliminando}
            secciones={seccionesPorLaboratorio[eliminando.id] ?? 0}
            onExito={cerrarEliminacion}
            onCancelar={cerrarEliminacion}
          />
        </ModalBase>
      )}
    </div>
  )
}
