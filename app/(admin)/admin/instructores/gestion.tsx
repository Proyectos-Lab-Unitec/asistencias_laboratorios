'use client'

import { useEffect, useMemo, useState, useActionState } from 'react'
import {
  FiEdit2,
  FiLayers,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUsers,
} from 'react-icons/fi'
import {
  actualizarInstructor,
  alternarInstructor,
  eliminarInstructor,
  eliminarInstructores,
  crearInstructor,
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
  type Perfil,
  type SeccionResumen,
} from '@/lib/types'
import { plural } from '@/lib/utils'

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
  secciones,
}: {
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
                {s.laboratorio} · Sección {s.grupo}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {[s.periodo, s.horario]
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
          ? `Se eliminarán también ${plural(secciones, 'sección', 'secciones')} que maneja, con sus matrículas, sesiones y asistencias.`
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

function ConfirmarEliminacionMultiple({
  seleccionadas,
  onExito,
  onCancelar,
}: {
  seleccionadas: Perfil[]
  onExito: () => void
  onCancelar: () => void
}) {
  const [estado, enviar, pendiente] = useActionState(
    eliminarInstructores,
    ESTADO_INICIAL
  )

  useEffect(() => {
    if (estado.ok) onExito()
  }, [estado, onExito])

  return (
    <form action={enviar}>
      {seleccionadas.map((cuenta) => (
        <input key={cuenta.id} type="hidden" name="ids" value={cuenta.id} />
      ))}

      <p className="text-sm text-gray-600">
        ¿Estás seguro de que deseas eliminar{' '}
        <strong>{plural(seleccionadas.length, 'cuenta', 'cuentas')}</strong>?
      </p>

      <ul className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
        {seleccionadas.map((cuenta) => (
          <li key={cuenta.id} className="py-0.5">
            {cuenta.nombre}
            {cuenta.email ? ` (${cuenta.email})` : ''}
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
        texto={`Eliminar ${seleccionadas.length}`}
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
  const [eliminandoVarias, setEliminandoVarias] = useState(false)
  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)

  // Filtrado en el cliente sobre los datos ya cargados, sin acentos.
  const filtrados = useMemo(() => {
    const texto = normalizar(busqueda)
    if (!texto) return cuentas
    return cuentas.filter((cuenta) =>
      normalizar(`${cuenta.nombre} ${cuenta.email ?? ''}`).includes(texto)
    )
  }, [cuentas, busqueda])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const desde = (paginaSegura - 1) * POR_PAGINA
  const visibles = filtrados.slice(desde, desde + POR_PAGINA)

  const buscar = (valor: string) => {
    setBusqueda(valor)
    setPagina(1) // una búsqueda nueva siempre vuelve a la primera página
  }

  const limpiarBusqueda = () => buscar('')

  const alternarSeleccion = (id: string) =>
    setSeleccionados((previo) =>
      previo.includes(id) ? previo.filter((x) => x !== id) : [...previo, id]
    )

  // La selección se deriva en vez de sincronizarse con un effect: si un
  // borrado deja ids que ya no existen, no llegan ni a la barra ni al modal.
  const idsExistentes = new Set(cuentas.map((cuenta) => cuenta.id))
  const seleccionValida = seleccionados.filter((id) => idsExistentes.has(id))

  const seleccionadas = cuentas.filter((cuenta) =>
    seleccionValida.includes(cuenta.id)
  )

  const activas = cuentas.filter((c) => c.activo).length
  const totalSecciones = Object.values(seccionesPorInstructor).reduce(
    (a, b) => a + b.length,
    0
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {plural(cuentas.length, 'cuenta', 'cuentas')} · {activas} activa
          {activas === 1 ? '' : 's'} · {plural(totalSecciones, 'sección', 'secciones')} en
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

      <BarraSeleccion
        cantidad={seleccionValida.length}
        onEliminar={() => setEliminandoVarias(true)}
        onLimpiar={() => setSeleccionados([])}
      />

      <TablaDato
        anchoMinimo="min-w-[720px]"
        total={visibles.length}
        herramienta={
          <BarraBusqueda
            id="buscar-instructor"
            valor={busqueda}
            onCambio={buscar}
            etiqueta="Buscar instructor"
            placeholder="Buscar por nombre o correo"
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
                visibles={visibles.map((cuenta) => cuenta.id)}
                seleccionados={seleccionValida}
                onCambio={setSeleccionados}
              />
            ),
          },
          { etiqueta: 'Nombre' },
          { etiqueta: 'Correo' },
          { etiqueta: 'Secciones', clase: 'text-right' },
          { etiqueta: 'Estado' },
          { etiqueta: 'Acciones', clase: 'text-right' },
        ]}
        vacio={
          cuentas.length === 0
            ? {
                titulo: 'Aún no hay cuentas de instructor',
                detalle: 'Crea la primera con el botón de arriba.',
                icono: <FiUsers size={22} />,
              }
            : {
                titulo: 'Sin coincidencias',
                detalle: `Ninguna cuenta coincide con «${busqueda.trim()}».`,
                icono: <FiSearch size={22} />,
                accion: { etiqueta: 'Limpiar búsqueda', onClic: limpiarBusqueda },
              }
        }
      >
        {visibles.map((cuenta) => {
          const secciones = seccionesPorInstructor[cuenta.id] ?? []
          return (
            <tr key={cuenta.id} className={CLASE_FILA}>
              <td className={`${CLASE_CELDA} w-10`}>
                <CasillaFila
                  id={cuenta.id}
                  marcada={seleccionValida.includes(cuenta.id)}
                  onCambio={alternarSeleccion}
                  etiqueta={cuenta.nombre}
                />
              </td>
              <td className={CLASE_CELDA}>
                <button
                  type="button"
                  onClick={() => setVerSecciones(cuenta)}
                  className="text-left text-sm font-semibold text-[#06065c] underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06065c]"
                  title="Ver secciones que maneja"
                >
                  {cuenta.nombre}
                </button>
              </td>
              <td className={CLASE_CELDA}>
                {cuenta.email ?? <span className="text-gray-500">—</span>}
              </td>
              <td
                className={`${CLASE_CELDA} text-right font-medium tabular-nums text-gray-900`}
              >
                {secciones.length}
              </td>
              <td className={CLASE_CELDA}>
                <InterruptorEstado
                  accion={alternarInstructor}
                  id={cuenta.id}
                  activo={cuenta.activo}
                  etiqueta={{ activo: 'Activo', inactivo: 'Inactivo' }}
                />
              </td>
              <td className={CLASE_CELDA}>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setVerSecciones(cuenta)}
                    className={`${CLASE_ACCION} text-gray-600 hover:bg-gray-100 hover:text-gray-900`}
                    title="Ver secciones"
                  >
                    <FiLayers size={15} />
                    Secciones
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditando(cuenta)}
                    className={`${CLASE_ACCION} text-[#06065c] hover:bg-[#06065c]/10`}
                  >
                    <FiEdit2 size={15} />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEliminando(cuenta)}
                    className={`${CLASE_ACCION} text-red-600 hover:bg-red-50 hover:text-red-700`}
                  >
                    <FiTrash2 size={15} />
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          )
        })}
      </TablaDato>

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

      {eliminandoVarias && (
        <ModalBase
          titulo="Eliminar instructores"
          onCerrar={() => setEliminandoVarias(false)}
        >
          <ConfirmarEliminacionMultiple
            seleccionadas={seleccionadas}
            onExito={() => {
              setSeleccionados([])
              setEliminandoVarias(false)
            }}
            onCancelar={() => setEliminandoVarias(false)}
          />
        </ModalBase>
      )}
    </div>
  )
}
