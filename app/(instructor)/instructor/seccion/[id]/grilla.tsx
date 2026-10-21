'use client'

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  startTransition,
} from 'react'
import {
  FiCheck,
  FiEdit2,
  FiPlus,
  FiTrash2,
  FiUserPlus,
  FiUsers,
} from 'react-icons/fi'
import { BotonesModal, Campo, ModalBase } from '@/components/ui/modal'
import { InterruptorEstado } from '@/components/ui/interruptor-estado'
import { CLASE_CELDA, CLASE_FILA } from '@/components/ui/tabla-dato'
import {
  ESTADO_INICIAL,
  type AlumnoSeccion,
  type ClaseOpcion,
  type EstadoAccion,
} from '@/lib/types'
import {
  abrirSesion,
  actualizarAlumno,
  agregarAlumno,
  alternarAsistencia,
  alternarSesion,
  eliminarAlumno,
  marcarTodosPresentes,
} from '../actions'

export type AlumnoAsistencia = AlumnoSeccion

export type SesionAsistencia = {
  id: number
  fecha: string
  estado: 'abierta' | 'cerrada'
  presentes: number[]
}

/** Fecha local del navegador en formato date de Postgres (YYYY-MM-DD). */
function fechaIso(d: Date) {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function aFecha(iso: string) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

function fechaCorta(iso: string) {
  return aFecha(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  })
}

function fechaLarga(iso: string) {
  return aFecha(iso).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

const CLASE_BOTON =
  'inline-flex items-center gap-1.5 rounded-lg bg-[#06065c] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0f49b6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06065c] disabled:cursor-not-allowed disabled:opacity-50'

const CLASE_SELECT =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-black outline-none transition focus:border-[#0f49b6] focus:ring-2 focus:ring-[#0f49b6] disabled:bg-gray-100'

/**
 * Grilla de asistencia: filas = alumnos, columnas = fechas.
 *
 * Es la pantalla que se usa en vivo durante la clase, así que todo está
 * montado alrededor de hacer lo menos posible: un solo useActionState para
 * toda la grilla (una casilla es un FormData más, no un hook más), «marcar
 * todos presentes» para el arranque de la sesión y corrección a mano después.
 *
 * El encabezado va en dos renglones a propósito: el de arriba lleva las fechas
 * y el de abajo los controles, pero los dos dentro de la misma banda azul para
 * que la cabecera lea como un bloque único. Por eso el switch va con
 * `sobreOscuro`: su azul activo normal es el mismo azul del fondo.
 */
export default function GrillaAsistencia({
  seccionId,
  alumnos,
  sesiones,
  clases,
}: {
  seccionId: number
  alumnos: AlumnoAsistencia[]
  sesiones: SesionAsistencia[]
  /** Catálogo para el alta manual de alumnos. */
  clases: ClaseOpcion[]
}) {
  // Un hook por acción (React no deja llamar hooks dentro de un map, pero sí
  // tener varios en el componente). El de las casillas es uno solo para toda la
  // grilla: una casilla es un FormData más, no un hook más.
  const [estado, enviar, pendiente] = useActionState(
    alternarAsistencia,
    ESTADO_INICIAL
  )
  const [estadoAbrir, enviarAbrir, pendienteAbrir] = useActionState(
    abrirSesion,
    ESTADO_INICIAL
  )
  const [estadoTodos, enviarTodos, pendienteTodos] = useActionState(
    marcarTodosPresentes,
    ESTADO_INICIAL
  )
  const [modalAlumno, setModalAlumno] = useState(false)
  const [editando, setEditando] = useState<AlumnoSeccion | null>(null)
  const [eliminando, setEliminando] = useState<AlumnoSeccion | null>(null)
  const contenedor = useRef<HTMLDivElement>(null)
  // Día elegido en el formulario de la barra, para llevarle la vista cuando
  // la sesión se acabe de crear.
  const fechaAgregada = useRef<string | null>(null)

  // Al abrir la vista va al extremo derecho, donde vive la sesión más reciente.
  // Pero si se acaba de dar de alta un día pasado, su columna no está ahí: en
  // ese caso se lleva la vista a la fecha recién agregada.
  useEffect(() => {
    const caja = contenedor.current
    if (!caja) return

    const objetivo = fechaAgregada.current
    fechaAgregada.current = null

    const celda = objetivo
      ? caja.querySelector<HTMLElement>(`[data-fecha="${objetivo}"]`)
      : null

    if (celda) {
      celda.scrollIntoView({ block: 'nearest', inline: 'center' })
      return
    }

    caja.scrollLeft = caja.scrollWidth
  }, [sesiones.length])

  const hoy = fechaIso(new Date())
  const error = estado.error ?? estadoAbrir.error ?? estadoTodos.error

  // Llamar el dispatch devuelto por useActionState fuera de un transition hace
  // que React avise y que isPending no se comporte bien; va envuelto.
  const marcar = (sesionId: number, matriculaId: number) => {
    const datos = new FormData()
    datos.set('sesion_id', String(sesionId))
    datos.set('matricula_id', String(matriculaId))
    startTransition(() => enviar(datos))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => setModalAlumno(true)}
          className={CLASE_BOTON}
        >
          <FiUserPlus size={16} aria-hidden />
          Agregar alumno
        </button>

        <p className="text-sm text-gray-500">
          {alumnos.length} {alumnos.length === 1 ? 'alumno' : 'alumnos'} ·{' '}
          {sesiones.length} {sesiones.length === 1 ? 'sesión' : 'sesiones'}
        </p>

        <form
          action={enviarAbrir}
          onSubmit={(e) => {
            const campo =
              e.currentTarget.querySelector<HTMLInputElement>('input[name="fecha"]')
            fechaAgregada.current = campo?.value ?? null
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="seccion_id" value={seccionId} />
          <label htmlFor="fecha-sesion" className="text-sm text-gray-500">
            Fecha
          </label>
          <input
            id="fecha-sesion"
            type="date"
            name="fecha"
            defaultValue={hoy}
            max={hoy}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#0f49b6] focus:outline-2 focus:outline-[#0f49b6]"
          />
          <button
            type="submit"
            className={CLASE_BOTON}
            disabled={pendienteAbrir}
          >
            <FiPlus size={16} />
            {pendienteAbrir ? 'Agregando…' : 'Agregar sesión'}
          </button>
        </form>      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {alumnos.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
          <FiUsers className="mx-auto text-3xl text-[#06065c]" aria-hidden />
          <h2 className="mt-3 text-lg font-bold text-gray-900">
            Aún no hay alumnos inscritos
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
            Comparte el QR desde <strong>Mis secciones</strong> para que se
            inscriban el primer día. En cuanto se registren, aparecerán acá para
            marcar su asistencia.
          </p>
          <button
            type="button"
            onClick={() => setModalAlumno(true)}
            className={`${CLASE_BOTON} mt-5`}
          >
            <FiUserPlus size={16} aria-hidden />
            Agregar alumno a mano
          </button>
        </div>
      ) : (
        <div
          ref={contenedor}
          className="overflow-x-auto rounded-xl border border-gray-200 bg-white"
        >
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#06065c] text-white">
                <th
                  rowSpan={2}
                  scope="col"
                  className="sticky left-0 z-20 bg-[#06065c] px-4 py-3 text-left"
                >
                  Alumno
                </th>
                {sesiones.map((s) => (
                  <th
                    key={s.id}
                    scope="col"
                    data-fecha={s.fecha}
                    className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide"
                  >
                    {fechaCorta(s.fecha)}
                  </th>
                ))}
                <th
                  rowSpan={2}
                  scope="col"
                  className="px-4 py-3 text-right align-middle"
                >
                  % asistencia
                </th>
              </tr>

              {sesiones.length > 0 && (
                <tr className="border-t border-white/15 bg-[#06065c]">
                  {sesiones.map((s) => (
                    <th key={s.id} scope="col" className="px-2 pb-3 pt-1.5">
                      <div className="flex flex-col items-center gap-1.5">
                        <InterruptorEstado
                          accion={alternarSesion}
                          id={s.id}
                          activo={s.estado === 'abierta'}
                          etiqueta={{ activo: 'Abierta', inactivo: 'Cerrada' }}
                          sobreOscuro
                        />
                        {s.estado === 'abierta' && (
                          <form action={enviarTodos}>
                            <input
                              type="hidden"
                              name="sesion_id"
                              value={s.id}
                            />
                            <button
                              type="submit"
                              title="Marcar a todos los alumnos presentes"
                              disabled={pendienteTodos}
                              className="inline-flex items-center gap-1 rounded-md border border-white/30 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"
                            >
                              <FiCheck size={13} aria-hidden />
                              {pendienteTodos ? 'Marcando…' : 'Todos'}
                            </button>
                          </form>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              )}
            </thead>

            <tbody>
              {alumnos.map((alumno) => {
                const presentes = sesiones.filter((s) =>
                  s.presentes.includes(alumno.id)
                ).length
                const porcentaje =
                  sesiones.length === 0
                    ? null
                    : Math.round((presentes / sesiones.length) * 100)

                return (
                  // bg-white en la fila: la celda pegajosa necesita fondo propio
                  // y bg-inherit hereda este valor (y el de las bandas y el hover).
                  <tr key={alumno.id} className={`${CLASE_FILA} bg-white`}>
                    <td
                      className={`${CLASE_CELDA} sticky left-0 z-10 min-w-[240px] bg-inherit`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {alumno.nombre}
                          </p>
                          <p className="text-xs text-gray-500">
                            #{alumno.numero_cuenta}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditando(alumno)}
                          title="Editar los datos del alumno"
                          aria-label={`Editar a ${alumno.nombre}`}
                          className="shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-[#06065c]/10 hover:text-[#06065c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06065c]"
                        >
                          <FiEdit2 size={14} aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEliminando(alumno)}
                          title="Eliminar al alumno de la sección"
                          aria-label={`Eliminar a ${alumno.nombre}`}
                          className="shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                        >
                          <FiTrash2 size={14} aria-hidden />
                        </button>
                      </div>
                    </td>

                    {sesiones.map((sesion) => {
                      const presente = sesion.presentes.includes(alumno.id)
                      const editable = sesion.estado === 'abierta'

                      return (
                        <td
                          key={sesion.id}
                          className="px-2 py-2 text-center align-middle"
                        >
                          <button
                            type="button"
                            onClick={() => marcar(sesion.id, alumno.id)}
                            disabled={!editable || pendiente}
                            aria-pressed={presente}
                            aria-label={`${alumno.nombre}, ${fechaLarga(
                              sesion.fecha
                            )}: ${presente ? 'presente' : 'ausente'}`}
                            className={`mx-auto flex h-8 w-8 items-center justify-center rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06065c] disabled:cursor-default disabled:opacity-45 ${
                              presente
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : editable
                                  ? 'border-gray-200 bg-white text-gray-300 hover:border-[#0f49b6] hover:text-[#0f49b6]'
                                  : 'border-gray-100 bg-gray-50 text-gray-300'
                            }`}
                          >
                            {presente ? (
                              <FiCheck size={16} aria-hidden />
                            ) : (
                              <span aria-hidden>—</span>
                            )}
                          </button>
                        </td>
                      )
                    })}

                    <td className="px-4 py-3 text-right align-middle font-medium tabular-nums text-gray-900">
                      {porcentaje === null ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        `${porcentaje}%`
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {alumnos.length > 0 && sesiones.length === 0 && (
        <p className="text-sm text-gray-500">
          Aún no hay sesiones para esta sección. Abre la de hoy para empezar a
          marcar.
        </p>
      )}

      {modalAlumno && (
        <ModalBase
          titulo="Agregar alumno"
          ancho="max-w-lg"
          onCerrar={() => setModalAlumno(false)}
        >
          <FormularioAlumno
            accion={agregarAlumno}
            seccionId={seccionId}
            clases={clases}
            onExito={() => setModalAlumno(false)}
            onCancelar={() => setModalAlumno(false)}
          />
        </ModalBase>
      )}

      {editando && (
        <ModalBase
          titulo="Editar alumno"
          ancho="max-w-lg"
          onCerrar={() => setEditando(null)}
        >
          <FormularioAlumno
            key={editando.id}
            accion={actualizarAlumno}
            seccionId={seccionId}
            clases={clases}
            inicial={editando}
            onExito={() => setEditando(null)}
            onCancelar={() => setEditando(null)}
          />
        </ModalBase>
      )}

      {eliminando && (
        <ModalBase
          titulo="Eliminar alumno"
          onCerrar={() => setEliminando(null)}
        >
          <ConfirmarEliminarAlumno
            key={eliminando.id}
            alumno={eliminando}
            seccionId={seccionId}
            onExito={() => setEliminando(null)}
            onCancelar={() => setEliminando(null)}
          />
        </ModalBase>
      )}
    </div>
  )
}

/** Confirmación del borrado de un alumno de la sección. */
function ConfirmarEliminarAlumno({
  alumno,
  seccionId,
  onExito,
  onCancelar,
}: {
  alumno: AlumnoSeccion
  seccionId: number
  onExito: () => void
  onCancelar: () => void
}) {
  const [estado, enviar, pendiente] = useActionState(
    eliminarAlumno,
    ESTADO_INICIAL
  )

  useEffect(() => {
    if (estado.ok) onExito()
  }, [estado, onExito])

  return (
    <form action={enviar}>
      <input type="hidden" name="seccion_id" value={seccionId} />
      <input type="hidden" name="id" value={alumno.id} />

      <p className="text-sm text-gray-600">
        ¿Estás seguro de que deseas eliminar a{' '}
        <strong>{alumno.nombre}</strong> (#{alumno.numero_cuenta}) de esta
        sección?
      </p>

      <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
        Se borran también sus marcas de asistencia en esta sección y su nota
        final. Esta acción no se puede deshacer.
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

const VACIOS_ALUMNO = {
  numero_cuenta: '',
  nombre: '',
  docente: '',
  clase_id: '',
  seccion_clase: '',
  carrera: '',
  correo: '',
}

/**
 * Alta y edición de un alumno.
 *
 * Es el mismo formulario que el público de `/registro/[token]`, salvo que acá
 * manda el instructor y no hace falta token: carrera y correo quedan
 * opcionales porque no alimentan el reporte de Excel.
 *
 * El form vive dentro del modal, y el modal solo se monta cuando está abierto;
 * por eso su `useActionState` arranca limpio en cada apertura y el `estado.ok`
 * resultante no cierra una ventana anterior por accidente.
 */
type AccionFormAlumno = (
  previo: EstadoAccion,
  formData: FormData
) => Promise<EstadoAccion>

function FormularioAlumno({
  accion,
  seccionId,
  clases,
  inicial,
  onExito,
  onCancelar,
}: {
  accion: AccionFormAlumno
  seccionId: number
  clases: ClaseOpcion[]
  /** Si viene, el formulario edita en vez de dar de alta. */
  inicial?: AlumnoSeccion
  onExito: () => void
  onCancelar: () => void
}) {
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL)
  const [campos, setCampos] = useState({
    ...VACIOS_ALUMNO,
    numero_cuenta: inicial?.numero_cuenta ?? '',
    nombre: inicial?.nombre ?? '',
    docente: inicial?.docente ?? '',
    clase_id: inicial?.clase_id ? String(inicial.clase_id) : '',
    seccion_clase: inicial?.seccion_clase ?? '',
    carrera: inicial?.carrera ?? '',
    correo: inicial?.correo ?? '',
  })

  useEffect(() => {
    if (estado.ok) onExito()
  }, [estado.ok, onExito])

  const cambiar =
    (clave: keyof typeof VACIOS_ALUMNO) => (valor: string) =>
      setCampos((previo) => ({ ...previo, [clave]: valor }))

  // Si la clase del alumno se dio de baja, no está en el catálogo activo: se
  // agrega al final para no perderla al guardar.
  const opcionesClase = [...clases]
  if (
    inicial?.clase_id &&
    !opcionesClase.some((clase) => clase.id === inicial.clase_id)
  ) {
    opcionesClase.push({
      id: inicial.clase_id,
      nombre: `${inicial.clase ?? 'Clase'} (inactiva)`,
    })
  }

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="seccion_id" value={seccionId} />
      {inicial && <input type="hidden" name="id" value={inicial.id} />}

      <Campo
        label="Número de cuenta"
        name="numero_cuenta"
        valor={campos.numero_cuenta}
        onChange={cambiar('numero_cuenta')}
        disabled={pendiente}
        requerido
        maxLength={20}
      />

      <Campo
        label="Nombre completo"
        name="nombre"
        valor={campos.nombre}
        onChange={cambiar('nombre')}
        disabled={pendiente}
        requerido
        maxLength={120}
      />

      <Campo
        label="Docente"
        name="docente"
        valor={campos.docente}
        onChange={cambiar('docente')}
        placeholder="Mtra. Ana Ruiz"
        disabled={pendiente}
        requerido
        maxLength={120}
      />

      <Campo
        label="Clase"
        name="clase_id"
        valor={campos.clase_id}
        onChange={cambiar('clase_id')}
        disabled={pendiente}
        requerido
      >
        <select
          name="clase_id"
          value={campos.clase_id}
          onChange={(e) => cambiar('clase_id')(e.target.value)}
          disabled={pendiente || opcionesClase.length === 0}
          required
          className={CLASE_SELECT}
        >
          <option value="">Elige una clase…</option>
          {opcionesClase.map((clase) => (
            <option key={clase.id} value={clase.id}>
              {clase.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <Campo
        label="Sección de la clase"
        name="seccion_clase"
        valor={campos.seccion_clase}
        onChange={cambiar('seccion_clase')}
        placeholder="V1"
        disabled={pendiente}
        requerido
        maxLength={40}
      />

      {opcionesClase.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No hay clases activas. Crea una en Clases (admin) antes de dar de
          alta alumnos.
        </p>
      )}

      <Campo
        label="Carrera"
        name="carrera"
        valor={campos.carrera}
        onChange={cambiar('carrera')}
        disabled={pendiente}
        maxLength={120}
      />

      <Campo
        label="Correo"
        name="correo"
        tipo="email"
        valor={campos.correo}
        onChange={cambiar('correo')}
        disabled={pendiente}
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
        texto={inicial ? 'Guardar cambios' : 'Agregar alumno'}
        textoGuardando={inicial ? 'Guardando...' : 'Agregando...'}
      />
    </form>
  )
}
