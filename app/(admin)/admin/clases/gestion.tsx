'use client'

import { useEffect, useMemo, useState, useActionState } from 'react'
import {
  FiBookOpen,
  FiEdit2,
  FiPlus,
  FiSearch,
  FiTrash2,
} from 'react-icons/fi'
import {
  actualizarClase,
  alternarClase,
  crearClase,
  eliminarClase,
  eliminarClases,
} from './actions'
import { BotonesModal, Campo, ModalBase } from '@/components/ui/modal'
import { InterruptorEstado } from '@/components/ui/interruptor-estado'
import {
  BarraBusqueda,
  BarraSeleccion,
  CasillaCabecera,
  CasillaFila,
  CLASE_ACCION,
  CLASE_CELDA,
  CLASE_FILA,
  normalizar,
  Paginacion,
  POR_PAGINA,
  TablaDato,
} from '@/components/ui/tabla-dato'
import { ESTADO_INICIAL, type Clase, type EstadoAccion } from '@/lib/types'
import { plural } from '@/lib/utils'

type AccionForm = (
  previo: EstadoAccion,
  formData: FormData
) => Promise<EstadoAccion>

function FormularioClase({
  accion,
  inicial,
  onExito,
  onCancelar,
}: {
  accion: AccionForm
  inicial?: Clase
  onExito: () => void
  onCancelar: () => void
}) {
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL)
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')

  useEffect(() => {
    if (estado.ok) onExito()
  }, [estado, onExito])

  return (
    <form action={enviar} className="space-y-4">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}

      <Campo
        label="Nombre de la clase"
        name="nombre"
        valor={nombre}
        onChange={setNombre}
        placeholder="Física 1"
        disabled={pendiente}
        requerido
        maxLength={120}
      />

      {estado.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {estado.error}
        </p>
      )}

      <BotonesModal
        onCancelar={onCancelar}
        guardando={pendiente}
        texto={inicial ? 'Guardar cambios' : 'Crear clase'}
        textoGuardando="Guardando..."
      />
    </form>
  )
}

function ConfirmarEliminacion({
  clase,
  usos,
  onExito,
  onCancelar,
}: {
  clase: Clase
  usos: number
  onExito: () => void
  onCancelar: () => void
}) {
  const [estado, enviar, pendiente] = useActionState(
    eliminarClase,
    ESTADO_INICIAL
  )

  useEffect(() => {
    if (estado.ok) onExito()
  }, [estado, onExito])

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={clase.id} />

      <p className="text-sm text-gray-600">
        ¿Estás seguro de que deseas eliminar <strong>{clase.nombre}</strong>?
      </p>

      <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
        {usos > 0
          ? `${plural(
              usos,
              'laboratorio',
              'laboratorios'
            )} que usan esta clase se quedan, pero sin clase asignada.`
          : 'Ningún laboratorio la está usando.'}{' '}
        Las matrículas que la declararon también pierden la referencia. Esta
        acción no se puede deshacer.
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

function ConfirmarEliminacionMultiple({
  seleccionadas,
  onExito,
  onCancelar,
}: {
  seleccionadas: Clase[]
  onExito: () => void
  onCancelar: () => void
}) {
  const [estado, enviar, pendiente] = useActionState(
    eliminarClases,
    ESTADO_INICIAL
  )

  useEffect(() => {
    if (estado.ok) onExito()
  }, [estado, onExito])

  return (
    <form action={enviar}>
      {seleccionadas.map((clase) => (
        <input key={clase.id} type="hidden" name="ids" value={clase.id} />
      ))}

      <p className="text-sm text-gray-600">
        ¿Estás seguro de que deseas eliminar{' '}
        <strong>{plural(seleccionadas.length, 'clase', 'clases')}</strong>?
      </p>

      <ul className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
        {seleccionadas.map((clase) => (
          <li key={clase.id} className="py-0.5">
            {clase.nombre}
          </li>
        ))}
      </ul>

      <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
        Los laboratorios y matrículas que las usan quedan sin clase asignada.
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
        texto={`Eliminar ${seleccionadas.length}`}
        textoGuardando="Eliminando..."
        peligro
      />
    </form>
  )
}

export default function GestionClases({
  clases,
  usosPorClase,
}: {
  clases: Clase[]
  usosPorClase: Record<number, number>
}) {
  const [modalNuevo, setModalNuevo] = useState(false)
  const [editando, setEditando] = useState<Clase | null>(null)
  const [eliminando, setEliminando] = useState<Clase | null>(null)
  const [eliminandoVarias, setEliminandoVarias] = useState(false)
  const [seleccionados, setSeleccionados] = useState<number[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)

  const cerrarNuevo = () => setModalNuevo(false)
  const cerrarEdicion = () => setEditando(null)
  const cerrarEliminacion = () => setEliminando(null)
  const cerrarEliminacionMultiple = () => setEliminandoVarias(false)

  const filtradas = useMemo(() => {
    const texto = normalizar(busqueda)
    if (!texto) return clases
    return clases.filter((clase) =>
      normalizar(clase.nombre).includes(texto)
    )
  }, [clases, busqueda])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const desde = (paginaSegura - 1) * POR_PAGINA
  const visibles = filtradas.slice(desde, desde + POR_PAGINA)

  const buscar = (valor: string) => {
    setBusqueda(valor)
    setPagina(1)
  }

  const limpiarBusqueda = () => buscar('')

  const alternarSeleccion = (id: number) =>
    setSeleccionados((previo) =>
      previo.includes(id) ? previo.filter((x) => x !== id) : [...previo, id]
    )

  // La selección se deriva en vez de sincronizarse con un effect: si un
  // borrado deja ids que ya no existen, no llegan ni a la barra ni al modal.
  const idsExistentes = new Set(clases.map((clase) => clase.id))
  const seleccionValida = seleccionados.filter((id) => idsExistentes.has(id))

  const seleccionadas = clases.filter((clase) =>
    seleccionValida.includes(clase.id)
  )

  const activas = clases.filter((clase) => clase.activo).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Clases: {clases.length} ● Activas: {activas}
        </p>
        <button
          type="button"
          onClick={() => setModalNuevo(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#06065c] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0f49b6]"
        >
          <FiPlus size={16} />
          Nueva clase
        </button>
      </div>

      <BarraSeleccion
        cantidad={seleccionValida.length}
        onEliminar={() => setEliminandoVarias(true)}
        onLimpiar={() => setSeleccionados([])}
      />

      <TablaDato
        anchoMinimo="min-w-[640px]"
        total={visibles.length}
        herramienta={
          <BarraBusqueda
            id="buscar-clase"
            valor={busqueda}
            onCambio={buscar}
            etiqueta="Buscar clase"
            placeholder="Buscar por nombre"
          />
        }
        pie={
          <Paginacion
            desde={filtradas.length === 0 ? 0 : desde + 1}
            hasta={desde + visibles.length}
            total={filtradas.length}
            pagina={paginaSegura}
            totalPaginas={totalPaginas}
            onCambio={setPagina}
          />
        }
        columnas={[
          {
            etiqueta: 'Selección',
            clase: 'w-10',
            nodo: (
              <CasillaCabecera
                visibles={visibles.map((clase) => clase.id)}
                seleccionados={seleccionValida}
                onCambio={setSeleccionados}
              />
            ),
          },
          { etiqueta: 'Nombre' },
          { etiqueta: 'Laboratorios', clase: 'text-right' },
          { etiqueta: 'Estado' },
          { etiqueta: 'Acciones', clase: 'text-right' },
        ]}
        vacio={
          clases.length === 0
            ? {
                titulo: 'Aún no hay clases',
                detalle:
                  'Crea la primera con el botón de arriba: después se elige al crear laboratorios y al inscribir alumnos.',
                icono: <FiBookOpen size={22} />,
              }
            : {
                titulo: 'Sin coincidencias',
                detalle: `Ninguna clase coincide con «${busqueda.trim()}».`,
                icono: <FiSearch size={22} />,
                accion: {
                  etiqueta: 'Limpiar búsqueda',
                  onClic: limpiarBusqueda,
                },
              }
        }
      >
        {visibles.map((clase) => (
          <tr key={clase.id} className={CLASE_FILA}>
            <td className={`${CLASE_CELDA} w-10`}>
              <CasillaFila
                id={clase.id}
                marcada={seleccionValida.includes(clase.id)}
                onCambio={alternarSeleccion}
                etiqueta={clase.nombre}
              />
            </td>
            <td className={`${CLASE_CELDA} font-semibold text-gray-900`}>
              {clase.nombre}
            </td>
            <td
              className={`${CLASE_CELDA} text-right font-medium tabular-nums text-gray-900`}
            >
              {usosPorClase[clase.id] ?? 0}
            </td>
            <td className={CLASE_CELDA}>
              <InterruptorEstado
                accion={alternarClase}
                id={clase.id}
                activo={clase.activo}
                etiqueta={{ activo: 'Activa', inactivo: 'Inactiva' }}
              />
            </td>
            <td className={CLASE_CELDA}>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditando(clase)}
                  className={`${CLASE_ACCION} text-[#06065c] hover:bg-[#06065c]/10`}
                >
                  <FiEdit2 size={15} />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setEliminando(clase)}
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
        <ModalBase titulo="Crear clase" onCerrar={cerrarNuevo}>
          <FormularioClase
            accion={crearClase}
            onExito={cerrarNuevo}
            onCancelar={cerrarNuevo}
          />
        </ModalBase>
      )}

      {editando && (
        <ModalBase titulo="Editar clase" onCerrar={cerrarEdicion}>
          <FormularioClase
            key={editando.id}
            accion={actualizarClase}
            inicial={editando}
            onExito={cerrarEdicion}
            onCancelar={cerrarEdicion}
          />
        </ModalBase>
      )}

      {eliminando && (
        <ModalBase titulo="Eliminar clase" onCerrar={cerrarEliminacion}>
          <ConfirmarEliminacion
            key={eliminando.id}
            clase={eliminando}
            usos={usosPorClase[eliminando.id] ?? 0}
            onExito={cerrarEliminacion}
            onCancelar={cerrarEliminacion}
          />
        </ModalBase>
      )}

      {eliminandoVarias && (
        <ModalBase
          titulo="Eliminar clases"
          onCerrar={cerrarEliminacionMultiple}
        >
          <ConfirmarEliminacionMultiple
            seleccionadas={seleccionadas}
            onExito={() => {
              setSeleccionados([])
              cerrarEliminacionMultiple()
            }}
            onCancelar={cerrarEliminacionMultiple}
          />
        </ModalBase>
      )}
    </div>
  )
}
