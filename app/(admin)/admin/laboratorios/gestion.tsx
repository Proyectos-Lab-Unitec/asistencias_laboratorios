'use client'

import { useEffect, useMemo, useState, useActionState } from 'react'
import { FiBox, FiEdit2, FiPlus, FiSearch, FiTrash2 } from 'react-icons/fi'
import {
  actualizarLaboratorio,
  alternarLaboratorio,
  eliminarLaboratorio,
  crearLaboratorio,
} from './actions'
import { BotonesModal, Campo, ModalBase } from '@/components/ui/modal'
import { InterruptorEstado } from '@/components/ui/interruptor-estado'
import {
  BarraBusqueda,
  CLASE_ACCION,
  CLASE_CELDA,
  CLASE_FILA,
  normalizar,
  Paginacion,
  POR_PAGINA,
  TablaDato,
} from '@/components/ui/tabla-dato'
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
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)

  const cerrarNuevo = () => setModalNuevo(false)
  const cerrarEdicion = () => setEditando(null)
  const cerrarEliminacion = () => setEliminando(null)

  // Filtrado en el cliente: los datos ya vienen cargados, no hace falta
  // volver al servidor al escribir. Sin acentos, así "ubicacion" encuentra
  // "Ubicación".
  const filtrados = useMemo(() => {
    const texto = normalizar(busqueda)
    if (!texto) return laboratorios
    return laboratorios.filter((lab) =>
      normalizar(`${lab.nombre} ${lab.ubicacion ?? ''}`).includes(texto)
    )
  }, [laboratorios, busqueda])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const desde = (paginaSegura - 1) * POR_PAGINA
  const visibles = filtrados.slice(desde, desde + POR_PAGINA)

  const buscar = (valor: string) => {
    setBusqueda(valor)
    setPagina(1) // una búsqueda nueva siempre vuelve a la primera página
  }

  const limpiarBusqueda = () => buscar('')

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

      <TablaDato
        anchoMinimo="min-w-[720px]"
        total={visibles.length}
        herramienta={
          <BarraBusqueda
            id="buscar-laboratorio"
            valor={busqueda}
            onCambio={buscar}
            etiqueta="Buscar laboratorio"
            placeholder="Buscar por nombre o ubicación"
          />
        }
        pie={
          <Paginacion
            desde={filtrados.length === 0 ? 0 : desde + 1}
            hasta={desde + visibles.length}
            total={filtrados.length}
            pagina={paginaSegura}
            totalPaginas={totalPaginas}
            onCambio={setPagina}
          />
        }
        columnas={[
          { etiqueta: 'Nombre' },
          { etiqueta: 'Ubicación' },
          { etiqueta: 'Capacidad', clase: 'text-right' },
          { etiqueta: 'Secciones', clase: 'text-right' },
          { etiqueta: 'Estado' },
          { etiqueta: 'Acciones', clase: 'text-right' },
        ]}
        vacio={
          laboratorios.length === 0
            ? {
                titulo: 'Aún no hay laboratorios',
                detalle: 'Crea el primero con el botón de arriba.',
                icono: <FiBox size={22} />,
              }
            : {
                titulo: 'Sin coincidencias',
                detalle: `Ningún laboratorio coincide con «${busqueda.trim()}».`,
                icono: <FiSearch size={22} />,
                accion: { etiqueta: 'Limpiar búsqueda', onClic: limpiarBusqueda },
              }
        }
      >
        {visibles.map((lab) => (
          <tr key={lab.id} className={CLASE_FILA}>
            <td className={`${CLASE_CELDA} font-semibold text-gray-900`}>
              {lab.nombre}
            </td>
            <td className={CLASE_CELDA}>
              {lab.ubicacion ?? <span className="text-gray-500">—</span>}
            </td>
            <td
              className={`${CLASE_CELDA} text-right font-medium tabular-nums text-gray-900`}
            >
              {lab.capacidad}
            </td>
            <td
              className={`${CLASE_CELDA} text-right font-medium tabular-nums text-gray-900`}
            >
              {seccionesPorLaboratorio[lab.id] ?? 0}
            </td>
            <td className={CLASE_CELDA}>
              <InterruptorEstado
                accion={alternarLaboratorio}
                id={lab.id}
                activo={lab.activo}
                etiqueta={{ activo: 'Activo', inactivo: 'Inactivo' }}
              />
            </td>
            <td className={CLASE_CELDA}>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditando(lab)}
                  className={`${CLASE_ACCION} text-[#06065c] hover:bg-[#06065c]/10`}
                >
                  <FiEdit2 size={15} />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setEliminando(lab)}
                  className={`${CLASE_ACCION} text-red-600 hover:bg-red-50 hover:text-red-700`}
                >
                  <FiTrash2 size={15} />
                  Eliminar
                </button>
              </div>
            </td>
          </tr>
        ))}
      </TablaDato>

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
