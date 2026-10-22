'use client'

import { useEffect, useMemo, useState, useActionState } from 'react'
import Link from 'next/link'
import {
  FiArrowLeft,
  FiBox,
  FiChevronRight,
  FiEdit2,
  FiList,
  FiPlus,
  FiSearch,
  FiTrash2,
} from 'react-icons/fi'
import {
  actualizarLaboratorio,
  alternarLaboratorio,
  crearLaboratorio,
  eliminarLaboratorio,
  eliminarLaboratorios,
  eliminarSeccion,
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
import {
  ESTADO_INICIAL,
  type ClaseOpcion,
  type DetalleSeccion,
  type EstadoAccion,
  type Laboratorio,
  type SeccionResumen,
} from '@/lib/types'
import { plural } from '@/lib/utils'

type AccionForm = (
  previo: EstadoAccion,
  formData: FormData
) => Promise<EstadoAccion>

const CLASE_SELECT =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-black outline-none transition focus:border-[#0f49b6] focus:ring-2 focus:ring-[#0f49b6] disabled:bg-gray-100'

function FormularioLaboratorio({
  accion,
  inicial,
  clases,
  onExito,
  onCancelar,
}: {
  accion: AccionForm
  inicial?: Laboratorio
  clases: ClaseOpcion[]
  onExito: () => void
  onCancelar: () => void
}) {
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL)
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [ubicacion, setUbicacion] = useState(inicial?.ubicacion ?? '')
  const [capacidad, setCapacidad] = useState(String(inicial?.capacidad ?? 30))
  const [claseId, setClaseId] = useState(String(inicial?.clase_id ?? ''))

  useEffect(() => {
    if (estado.ok) onExito()
  }, [estado, onExito])

  // Si el laboratorio apunta a una clase que se dio de baja, la opción no está
  // en el catálogo activo: se agrega al final para no perderla al guardar.
  const opciones = useMemo(() => {
    const base = [...clases]
    if (inicial?.clase_id && !base.some((c) => c.id === inicial.clase_id)) {
      base.push({
        id: inicial.clase_id,
        nombre: `${inicial.clase ?? 'Clase'} (inactiva)`,
      })
    }
    return base
  }, [clases, inicial])

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
        label="Clase"
        name="clase_id"
        valor={claseId}
        onChange={setClaseId}
        disabled={pendiente}
        requerido
      >
        <select
          name="clase_id"
          value={claseId}
          onChange={(e) => setClaseId(e.target.value)}
          disabled={pendiente || opciones.length === 0}
          required
          className={CLASE_SELECT}
        >
          <option value="">Elige una clase…</option>
          {opciones.map((clase) => (
            <option key={clase.id} value={clase.id}>
              {clase.nombre}
            </option>
          ))}
        </select>
      </Campo>

      {opciones.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No hay clases activas. Crea una en{' '}
          <Link href="/admin/clases" className="font-semibold underline">
            Clases
          </Link>{' '}
          antes de guardar el laboratorio.
        </p>
      )}

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

/** Lista de secciones de un laboratorio; cada una abre su detalle. */
function DetalleSecciones({
  secciones,
  detallePorSeccion,
}: {
  secciones: SeccionResumen[]
  detallePorSeccion: Record<number, DetalleSeccion>
}) {
  const [abierta, setAbierta] = useState<SeccionResumen | null>(null)
  const [eliminando, setEliminando] = useState<SeccionResumen | null>(null)

  if (eliminando) {
    return (
      <ConfirmarEliminarSeccion
        seccion={eliminando}
        alumnos={detallePorSeccion[eliminando.id]?.alumnos.length ?? 0}
        sesiones={detallePorSeccion[eliminando.id]?.sesiones ?? 0}
        onExito={() => setEliminando(null)}
        onCancelar={() => setEliminando(null)}
      />
    )
  }

  if (abierta) {
    return (
      <DetalleDeSeccion
        seccion={abierta}
        detalle={detallePorSeccion[abierta.id]}
        onVolver={() => setAbierta(null)}
      />
    )
  }

  if (secciones.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Este laboratorio todavía no tiene secciones. Las crea el instructor
        desde su panel.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Haz clic en una sección para ver sus alumnos, asistencias y notas.
      </p>

      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {secciones.map((seccion) => {
          const detalle = detallePorSeccion[seccion.id]
          const alumnos = detalle?.alumnos.length ?? 0

          return (
            <li key={seccion.id} className="flex items-center">
              <button
                type="button"
                onClick={() => setAbierta(seccion)}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#06065c]/[0.06] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#06065c]"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900">
                    Sección {seccion.grupo}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {[seccion.instructor, seccion.periodo, seccion.horario]
                      .filter(Boolean)
                      .join(' · ') || 'Sin datos de horario'}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-400">
                    {plural(alumnos, 'alumno', 'alumnos')} ·{' '}
                    {plural(detalle?.sesiones ?? 0, 'sesión', 'sesiones')}
                  </span>
                </span>

                <FiChevronRight
                  size={16}
                  aria-hidden
                  className="shrink-0 text-gray-400"
                />
              </button>

              <button
                type="button"
                onClick={() => setEliminando(seccion)}
                title="Eliminar la sección"
                aria-label={`Eliminar la sección ${seccion.grupo}`}
                className="mr-1 shrink-0 rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                <FiTrash2 size={15} aria-hidden />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Detalle de una sección: sus alumnos, con asistencia y nota. */
function DetalleDeSeccion({
  seccion,
  detalle,
  onVolver,
}: {
  seccion: SeccionResumen
  detalle: DetalleSeccion | undefined
  onVolver: () => void
}) {
  const alumnos = detalle?.alumnos ?? []
  const sesiones = detalle?.sesiones ?? 0

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onVolver}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#06065c] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06065c]"
      >
        <FiArrowLeft size={15} aria-hidden />
        Volver a las secciones
      </button>

      <div>
        <p className="text-base font-bold text-gray-900">
          Sección {seccion.grupo}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          {[
            seccion.laboratorio,
            seccion.instructor,
            seccion.periodo,
            seccion.horario,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      <p className="text-sm text-gray-600">
        {plural(alumnos.length, 'alumno', 'alumnos')} ·{' '}
        {plural(sesiones, 'sesión', 'sesiones')}
      </p>

      {alumnos.length === 0 ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Esta sección todavía no tiene alumnos inscritos.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#06065c] text-white">
                {[
                  { texto: 'Alumno', clase: 'text-left' },
                  { texto: 'Docente', clase: 'text-left' },
                  { texto: 'Clase', clase: 'text-left' },
                  { texto: 'Sec. clase', clase: 'text-left' },
                  { texto: 'Asistencia', clase: 'text-right' },
                  { texto: 'Nota', clase: 'text-right' },
                ].map((columna) => (
                  <th
                    key={columna.texto}
                    scope="col"
                    className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide ${columna.clase}`}
                  >
                    {columna.texto}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alumnos.map((alumno, indice) => (
                <tr
                  key={alumno.id}
                  className={indice % 2 === 1 ? 'bg-gray-50' : 'bg-white'}
                >
                  <td className="border-t border-gray-100 px-3 py-2">
                    <p className="font-medium text-gray-900">{alumno.nombre}</p>
                    <p className="text-xs text-gray-500">
                      #{alumno.numeroCuenta}
                    </p>
                  </td>
                  <td className="border-t border-gray-100 px-3 py-2 text-gray-700">
                    {alumno.docente ?? '—'}
                  </td>
                  <td className="border-t border-gray-100 px-3 py-2 text-gray-700">
                    {alumno.clase ?? '—'}
                  </td>
                  <td className="border-t border-gray-100 px-3 py-2 text-gray-700">
                    {alumno.seccionClase ?? '—'}
                  </td>
                  <td className="border-t border-gray-100 px-3 py-2 text-right tabular-nums text-gray-700">
                    {sesiones === 0 ? '—' : `${alumno.presentes}/${sesiones}`}
                  </td>
                  <td className="border-t border-gray-100 px-3 py-2 text-right font-medium tabular-nums text-gray-900">
                    {alumno.notaFinal ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Confirmación del borrado de una sección, dentro del mismo modal. */
function ConfirmarEliminarSeccion({
  seccion,
  alumnos,
  sesiones,
  onExito,
  onCancelar,
}: {
  seccion: SeccionResumen
  alumnos: number
  sesiones: number
  onExito: () => void
  onCancelar: () => void
}) {
  const [estado, enviar, pendiente] = useActionState(
    eliminarSeccion,
    ESTADO_INICIAL
  )

  useEffect(() => {
    if (estado.ok) onExito()
  }, [estado.ok, onExito])

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="id" value={seccion.id} />

      <p className="text-sm text-gray-600">
        ¿Estás seguro de que deseas eliminar la sección{' '}
        <strong>{seccion.grupo}</strong> de{' '}
        <strong>{seccion.laboratorio}</strong>?
      </p>

      <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
        {alumnos > 0
          ? `Se eliminarán también ${plural(
              alumnos,
              'alumno',
              'alumnos'
            )} con sus ${plural(
              sesiones,
              'sesión',
              'sesiones'
            )} y todas las asistencias registradas.`
          : 'La sección no tiene alumnos inscritos, así que solo se borra el registro.'}{' '}
        Esta acción no se puede deshacer.
      </p>

      {estado.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
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
          ? `Se eliminarán también ${plural(
              secciones,
              'sección',
              'secciones'
            )} que maneja, con sus matrículas, sesiones y asistencias.`
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

function ConfirmarEliminacionMultiple({
  seleccionados,
  onExito,
  onCancelar,
}: {
  seleccionados: Laboratorio[]
  onExito: () => void
  onCancelar: () => void
}) {
  const [estado, enviar, pendiente] = useActionState(
    eliminarLaboratorios,
    ESTADO_INICIAL
  )

  useEffect(() => {
    if (estado.ok) onExito()
  }, [estado, onExito])

  return (
    <form action={enviar}>
      {seleccionados.map((lab) => (
        <input key={lab.id} type="hidden" name="ids" value={lab.id} />
      ))}

      <p className="text-sm text-gray-600">
        ¿Estás seguro de que deseas eliminar{' '}
        <strong>{plural(seleccionados.length, 'laboratorio', 'laboratorios')}</strong>?
      </p>

      <ul className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
        {seleccionados.map((lab) => (
          <li key={lab.id} className="py-0.5">
            {lab.nombre}
          </li>
        ))}
      </ul>

      <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
        Se eliminan también sus secciones, con matrículas, sesiones y
        asistencias. Esta acción no se puede deshacer.
      </p>

      {estado.error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {estado.error}
        </p>
      )}

      <BotonesModal
        onCancelar={onCancelar}
        guardando={pendiente}
        texto={`Eliminar ${seleccionados.length}`}
        textoGuardando="Eliminando..."
        peligro
      />
    </form>
  )
}

export default function GestionLaboratorios({
  laboratorios,
  seccionesPorLaboratorio,
  detallePorSeccion,
  clases,
}: {
  laboratorios: Laboratorio[]
  seccionesPorLaboratorio: Record<number, SeccionResumen[]>
  detallePorSeccion: Record<number, DetalleSeccion>
  clases: ClaseOpcion[]
}) {
  const [modalNuevo, setModalNuevo] = useState(false)
  const [editando, setEditando] = useState<Laboratorio | null>(null)
  const [eliminando, setEliminando] = useState<Laboratorio | null>(null)
  const [verSecciones, setVerSecciones] = useState<Laboratorio | null>(null)
  const [eliminandoVarios, setEliminandoVarios] = useState(false)
  const [seleccionados, setSeleccionados] = useState<number[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)

  const cerrarNuevo = () => setModalNuevo(false)
  const cerrarEdicion = () => setEditando(null)
  const cerrarEliminacion = () => setEliminando(null)
  const cerrarVerSecciones = () => setVerSecciones(null)
  const cerrarEliminacionMultiple = () => setEliminandoVarios(false)

  // Filtrado en el cliente: los datos ya vienen cargados, no hace falta
  // volver al servidor al escribir. Sin acentos, así "ubicacion" encuentra
  // "Ubicación".
  const filtrados = useMemo(() => {
    const texto = normalizar(busqueda)
    if (!texto) return laboratorios
    return laboratorios.filter((lab) =>
      normalizar(
        `${lab.nombre} ${lab.clase ?? ''} ${lab.ubicacion ?? ''}`
      ).includes(texto)
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

  const alternarSeleccion = (id: number) =>
    setSeleccionados((previo) =>
      previo.includes(id) ? previo.filter((x) => x !== id) : [...previo, id]
    )

  // La selección se deriva en vez de sincronizarse con un effect: si un
  // borrado deja ids que ya no existen, no llegan ni a la barra ni al modal.
  const idsExistentes = new Set(laboratorios.map((lab) => lab.id))
  const seleccionValida = seleccionados.filter((id) => idsExistentes.has(id))

  const seleccionadosLab = laboratorios.filter((lab) =>
    seleccionValida.includes(lab.id)
  )

  const activos = laboratorios.filter((lab) => lab.activo).length
  const totalSecciones = Object.values(seccionesPorLaboratorio).reduce(
    (a, b) => a + b.length,
    0
  )

  return (
    <div className="space-y-4">
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

      {clases.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Todavía no hay clases activas. Crea al menos una en{' '}
          <Link href="/admin/clases" className="font-semibold underline">
            Clases
          </Link>{' '}
          para poder registrar laboratorios.
        </p>
      )}

      <BarraSeleccion
        cantidad={seleccionValida.length}
        onEliminar={() => setEliminandoVarios(true)}
        onLimpiar={() => setSeleccionados([])}
      />

      <TablaDato
        anchoMinimo="min-w-[840px]"
        total={visibles.length}
        herramienta={
          <BarraBusqueda
            id="buscar-laboratorio"
            valor={busqueda}
            onCambio={buscar}
            etiqueta="Buscar laboratorio"
            placeholder="Buscar por nombre, clase o ubicación"
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
          {
            etiqueta: 'Selección',
            clase: 'w-10',
            nodo: (
              <CasillaCabecera
                visibles={visibles.map((lab) => lab.id)}
                seleccionados={seleccionValida}
                onCambio={setSeleccionados}
              />
            ),
          },
          { etiqueta: 'Nombre' },
          { etiqueta: 'Clase' },
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
            <td className={`${CLASE_CELDA} w-10`}>
              <CasillaFila
                id={lab.id}
                marcada={seleccionValida.includes(lab.id)}
                onCambio={alternarSeleccion}
                etiqueta={lab.nombre}
              />
            </td>
            <td className={`${CLASE_CELDA} font-semibold text-gray-900`}>
              {lab.nombre}
            </td>
            <td className={CLASE_CELDA}>
              {lab.clase ?? <span className="text-gray-500">—</span>}
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
              {(seccionesPorLaboratorio[lab.id] ?? []).length}
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
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setVerSecciones(lab)}
                  className={`${CLASE_ACCION} text-[#06065c] hover:bg-[#06065c]/10`}
                  title="Ver las secciones de este laboratorio"
                >
                  <FiList size={15} />
                  Secciones
                </button>
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
            clases={clases}
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
            clases={clases}
            onExito={cerrarEdicion}
            onCancelar={cerrarEdicion}
          />
        </ModalBase>
      )}

      {verSecciones && (
        <ModalBase
          titulo={`Secciones de ${verSecciones.nombre}`}
          ancho="max-w-3xl"
          onCerrar={cerrarVerSecciones}
        >
          <DetalleSecciones
            secciones={seccionesPorLaboratorio[verSecciones.id] ?? []}
            detallePorSeccion={detallePorSeccion}
          />
          <div className="mt-6 flex justify-end border-t pt-4">
            <button
              type="button"
              onClick={cerrarVerSecciones}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              Cerrar
            </button>
          </div>
        </ModalBase>
      )}

      {eliminando && (
        <ModalBase titulo="Eliminar laboratorio" onCerrar={cerrarEliminacion}>
          <ConfirmarEliminacion
            key={eliminando.id}
            laboratorio={eliminando}
            secciones={(seccionesPorLaboratorio[eliminando.id] ?? []).length}
            onExito={cerrarEliminacion}
            onCancelar={cerrarEliminacion}
          />
        </ModalBase>
      )}

      {eliminandoVarios && (
        <ModalBase
          titulo="Eliminar laboratorios"
          onCerrar={cerrarEliminacionMultiple}
        >
          <ConfirmarEliminacionMultiple
            seleccionados={seleccionadosLab}
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
