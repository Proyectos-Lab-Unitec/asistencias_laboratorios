'use client'

import { useEffect, useMemo, useState, useActionState } from 'react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import {
  FiBook,
  FiCopy,
  FiEdit2,
  FiGrid,
  FiPlus,
  FiSearch,
  FiTrash2,
} from 'react-icons/fi'
import {
  actualizarSeccion,
  alternarRegistro,
  crearSeccion,
  eliminarSeccion,
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
import {
  ESTADO_INICIAL,
  type EstadoAccion,
  type LaboratorioOpcion,
  type PeriodoOpcion,
  type SeccionFila,
} from '@/lib/types'

type AccionForm = (
  previo: EstadoAccion,
  formData: FormData
) => Promise<EstadoAccion>

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`
}

/** Mismo estilo de campo que Campo usa para sus inputs, para los <select>. */
const CLASE_SELECT =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-black outline-none transition focus:border-[#0f49b6] focus:ring-2 focus:ring-[#0f49b6] disabled:bg-gray-100'

function FormularioSeccion({
  accion,
  inicial,
  laboratorios,
  periodos,
  onExito,
  onCancelar,
}: {
  accion: AccionForm
  inicial?: SeccionFila
  laboratorios: LaboratorioOpcion[]
  periodos: PeriodoOpcion[]
  onExito: () => void
  onCancelar: () => void
}) {
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL)
  const [laboratorioId, setLaboratorioId] = useState(
    String(inicial?.laboratorio_id ?? '')
  )
  const [periodoId, setPeriodoId] = useState(String(inicial?.periodo_id ?? ''))
  const [grupo, setGrupo] = useState(inicial?.grupo ?? '')
  const [horario, setHorario] = useState(inicial?.horario ?? '')

  useEffect(() => {
    if (estado.ok) onExito()
  }, [estado, onExito])

  return (
    <form action={enviar} className="space-y-4">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}

      <Campo
        label="Laboratorio"
        name="laboratorio_id"
        valor={laboratorioId}
        onChange={setLaboratorioId}
        disabled={pendiente}
        requerido
      >
        <select
          name="laboratorio_id"
          value={laboratorioId}
          onChange={(e) => setLaboratorioId(e.target.value)}
          disabled={pendiente}
          required
          className={CLASE_SELECT}
        >
          <option value="">Elige un laboratorio</option>
          {laboratorios.map((lab) => (
            <option key={lab.id} value={lab.id}>
              {lab.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <Campo
        label="Periodo"
        name="periodo_id"
        valor={periodoId}
        onChange={setPeriodoId}
        disabled={pendiente}
        requerido
      >
        <select
          name="periodo_id"
          value={periodoId}
          onChange={(e) => setPeriodoId(e.target.value)}
          disabled={pendiente}
          required
          className={CLASE_SELECT}
        >
          <option value="">Elige un periodo</option>
          {periodos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.etiqueta}
            </option>
          ))}
        </select>
      </Campo>

      <Campo
        label="Sección (del laboratorio)"
        name="grupo"
        valor={grupo}
        onChange={setGrupo}
        placeholder="Viernes 4:00 p.m."
        disabled={pendiente}
        requerido
        maxLength={20}
      />

      <Campo
        label="Horario"
        name="horario"
        valor={horario}
        onChange={setHorario}
        placeholder="Lun y Mié 07:00–09:00"
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
        texto={inicial ? 'Guardar cambios' : 'Crear sección'}
        textoGuardando="Guardando..."
      />
    </form>
  )
}

function ConfirmarEliminacion({
  seccion,
  onExito,
  onCancelar,
}: {
  seccion: SeccionFila
  onExito: () => void
  onCancelar: () => void
}) {
  const [estado, enviar, pendiente] = useActionState(
    eliminarSeccion,
    ESTADO_INICIAL
  )

  useEffect(() => {
    if (estado.ok) onExito()
  }, [estado, onExito])

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={seccion.id} />

      <p className="text-sm text-gray-600">
        ¿Estás seguro de que deseas eliminar la sección{' '}
        <strong>
          {seccion.laboratorio} · Sección {seccion.grupo}
        </strong>
        ?
      </p>

      <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
        {seccion.alumnos > 0
          ? `Se eliminarán también ${plural(seccion.alumnos, 'matrícula', 'matrículas')}, las sesiones y todas las asistencias registradas.`
          : 'Esta sección no tiene alumnos inscritos, así que solo se borra el registro.'}{' '}
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

function ModalQR({
  seccion,
  onCerrar,
}: {
  seccion: SeccionFila
  onCerrar: () => void
}) {
  // El modal solo se monta tras un clic, así que window ya existe; el effect
  // deja el primer render sin parpadeo de URL vacía.
  const [origen, setOrigen] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    setOrigen(window.location.origin)
  }, [])

  const enlace = `${origen}/registro/${seccion.token_registro}`

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles: el enlace queda visible para copiarlo a mano
    }
  }

  return (
    <ModalBase titulo="QR de registro" onCerrar={onCerrar} ancho="max-w-lg">
      <p className="text-sm font-semibold text-gray-900">
        {seccion.laboratorio} · Sección {seccion.grupo}
      </p>
      <p className="mt-0.5 text-xs text-gray-500">
        {[seccion.periodo, seccion.horario].filter(Boolean).join(' · ') ||
          'Sin datos de horario'}
      </p>

      <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-6">
        {origen ? (
          <QRCodeSVG
            value={enlace}
            size={196}
            bgColor="#ffffff"
            fgColor="#06065c"
            level="M"
          />
        ) : (
          <div className="h-[196px] w-[196px] animate-pulse rounded-lg bg-gray-100" />
        )}
        <p className="max-w-xs text-center text-xs text-gray-500">
          Los alumnos lo escanean el primer día para inscribirse. Ciérralo desde
          la tabla cuando termine el registro.
        </p>
      </div>

      <label
        htmlFor="enlace-registro"
        className="mb-1 mt-4 block text-sm font-medium text-gray-700"
      >
        Enlace de registro
      </label>
      <div className="flex gap-2">
        <input
          id="enlace-registro"
          readOnly
          value={enlace}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700"
        />
        <button
          type="button"
          onClick={copiar}
          disabled={!origen}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
        >
          <FiCopy size={15} />
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-gray-500">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            seccion.registro_abierto ? 'bg-[#06065c]' : 'bg-gray-300'
          }`}
        />
        Registro {seccion.registro_abierto ? 'abierto' : 'cerrado'}
      </p>
    </ModalBase>
  )
}

export default function GestionSecciones({
  secciones,
  laboratorios,
  periodos,
}: {
  secciones: SeccionFila[]
  laboratorios: LaboratorioOpcion[]
  periodos: PeriodoOpcion[]
}) {
  const [modalNuevo, setModalNuevo] = useState(false)
  const [editando, setEditando] = useState<SeccionFila | null>(null)
  const [eliminando, setEliminando] = useState<SeccionFila | null>(null)
  const [qr, setQr] = useState<SeccionFila | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)

  const filtrados = useMemo(() => {
    const texto = normalizar(busqueda)
    if (!texto) return secciones
    return secciones.filter((s) =>
      normalizar(
        `${s.laboratorio} ${s.grupo} ${s.periodo} ${s.horario ?? ''}`
      ).includes(texto)
    )
  }, [secciones, busqueda])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const desde = (paginaSegura - 1) * POR_PAGINA
  const visibles = filtrados.slice(desde, desde + POR_PAGINA)

  const buscar = (valor: string) => {
    setBusqueda(valor)
    setPagina(1)
  }

  const limpiarBusqueda = () => buscar('')

  const abiertas = secciones.filter((s) => s.registro_abierto).length
  const totalAlumnos = secciones.reduce((a, s) => a + s.alumnos, 0)
  const sinLaboratorios = laboratorios.length === 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {plural(secciones.length, 'sección', 'secciones')} · {abiertas} con
          registro abierto · {plural(totalAlumnos, 'alumno inscrito', 'alumnos inscritos')}
        </p>
        <button
          type="button"
          onClick={() => setModalNuevo(true)}
          disabled={sinLaboratorios}
          title={
            sinLaboratorios
              ? 'Primero debe haber laboratorios en el catálogo del admin'
              : undefined
          }
          className="inline-flex items-center gap-2 rounded-lg bg-[#06065c] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0f49b6] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiPlus size={16} />
          Nueva sección
        </button>
      </div>

      <TablaDato
        anchoMinimo="min-w-[860px]"
        total={visibles.length}
        herramienta={
          <BarraBusqueda
            id="buscar-seccion"
            valor={busqueda}
            onCambio={buscar}
            etiqueta="Buscar sección"
            placeholder="Buscar por laboratorio, sección o periodo"
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
          { etiqueta: 'Sección' },
          { etiqueta: 'Periodo' },
          { etiqueta: 'Horario' },
          { etiqueta: 'Alumnos', clase: 'text-right' },
          { etiqueta: 'Registro' },
          { etiqueta: 'Acciones', clase: 'text-right' },
        ]}
        vacio={
          secciones.length === 0
            ? {
                titulo: 'Aún no tienes secciones',
                detalle: sinLaboratorios
                  ? 'Primero el admin debe registrar laboratorios en el catálogo.'
                  : 'Crea la primera con el botón de arriba.',
                icono: <FiGrid size={22} />,
              }
            : {
                titulo: 'Sin coincidencias',
                detalle: `Ninguna sección coincide con «${busqueda.trim()}».`,
                icono: <FiSearch size={22} />,
                accion: { etiqueta: 'Limpiar búsqueda', onClic: limpiarBusqueda },
              }
        }
      >
        {visibles.map((s) => (
          <tr key={s.id} className={CLASE_FILA}>
            <td className={CLASE_CELDA}>
              <p className="font-semibold text-gray-900">
                {s.laboratorio} · Sección {s.grupo}
              </p>
            </td>
            <td className={CLASE_CELDA}>{s.periodo}</td>
            <td className={CLASE_CELDA}>
              {s.horario ?? <span className="text-gray-500">—</span>}
            </td>
            <td
              className={`${CLASE_CELDA} text-right font-medium tabular-nums text-gray-900`}
            >
              {s.alumnos}
            </td>
            <td className={CLASE_CELDA}>
              <InterruptorEstado
                accion={alternarRegistro}
                id={s.id}
                activo={s.registro_abierto}
                etiqueta={{ activo: 'Abierto', inactivo: 'Cerrado' }}
              />
            </td>
            <td className={CLASE_CELDA}>
              <div className="flex items-center justify-end gap-2">
                <Link
                  href={`/instructor/seccion/${s.id}`}
                  className={`${CLASE_ACCION} text-[#06065c] hover:bg-[#06065c]/10`}
                  title="Abrir la sección: asistencia y notas"
                >
                  <FiBook size={15} />
                  Sección
                </Link>
                <button
                  type="button"
                  onClick={() => setQr(s)}
                  className={`${CLASE_ACCION} text-[#06065c] hover:bg-[#06065c]/10`}
                  title="Ver QR de registro"
                >
                  <FiGrid size={15} />
                  QR
                </button>
                <button
                  type="button"
                  onClick={() => setEditando(s)}
                  className={`${CLASE_ACCION} text-[#06065c] hover:bg-[#06065c]/10`}
                >
                  <FiEdit2 size={15} />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setEliminando(s)}
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
        <ModalBase titulo="Crear sección" onCerrar={() => setModalNuevo(false)}>
          <FormularioSeccion
            accion={crearSeccion}
            laboratorios={laboratorios}
            periodos={periodos}
            onExito={() => setModalNuevo(false)}
            onCancelar={() => setModalNuevo(false)}
          />
        </ModalBase>
      )}

      {editando && (
        <ModalBase titulo="Editar sección" onCerrar={() => setEditando(null)}>
          <FormularioSeccion
            key={editando.id}
            accion={actualizarSeccion}
            inicial={editando}
            laboratorios={laboratorios}
            periodos={periodos}
            onExito={() => setEditando(null)}
            onCancelar={() => setEditando(null)}
          />
        </ModalBase>
      )}

      {qr && <ModalQR seccion={qr} onCerrar={() => setQr(null)} />}

      {eliminando && (
        <ModalBase titulo="Eliminar sección" onCerrar={() => setEliminando(null)}>
          <ConfirmarEliminacion
            key={eliminando.id}
            seccion={eliminando}
            onExito={() => setEliminando(null)}
            onCancelar={() => setEliminando(null)}
          />
        </ModalBase>
      )}
    </div>
  )
}
