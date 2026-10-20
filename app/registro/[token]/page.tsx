import type { IconType } from 'react-icons'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FiAlertCircle, FiLock } from 'react-icons/fi'
import { crearClienteAnon } from '@/lib/supabase/anon-server'
import FormularioRegistro, { type SeccionPublica } from './registro-form'

// Los datos cambian en el momento (el instructor abre/cierra el registro),
// así que esta ruta nunca se prerenderiza.
export const instant = false

export const metadata: Metadata = {
  title: 'Registro de laboratorio',
  description: 'Registro de alumnos para asistencias de laboratorio',
}

const RE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type FilaSeccion = SeccionPublica & { registro_abierto: boolean }

/**
 * Esqueleto compartido: el mismo mundo visual del login (fondo de la
 * universidad, tarjeta blanca) porque ambas son las únicas pantallas públicas.
 * En celular se queda en una sola columna y el teclado no tapa el botón.
 */
function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-[#07065d] bg-cover bg-center px-4 py-10"
      style={{ backgroundImage: 'url(/fondo2.webp)' }}
    >
      <h1 className="mb-8 text-center text-4xl font-extrabold leading-tight text-white shadow-lg sm:text-6xl">
        Asistencias de Laboratorio
      </h1>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg sm:p-8">
        {children}
      </div>
    </div>
  )
}

function Aviso({
  Icono,
  titulo,
  texto,
}: {
  Icono: IconType
  titulo: string
  texto: string
}) {
  return (
    <div className="py-6 text-center">
      <Icono className="mx-auto text-4xl text-[#06065c]" aria-hidden />
      <h2 className="mt-3 text-xl font-bold text-gray-800">{titulo}</h2>
      <p className="mt-2 text-sm text-gray-600">{texto}</p>
    </div>
  )
}

function DatosSeccion({ seccion }: { seccion: SeccionPublica }) {
  return (
    <dl className="mb-6 divide-y divide-gray-100 rounded-lg bg-gray-50 px-4 py-1 text-sm">
      <FilaDato etiqueta="Laboratorio" valor={seccion.laboratorio} />
      <FilaDato etiqueta="Sección" valor={seccion.grupo} />
      {seccion.horario && <FilaDato etiqueta="Horario" valor={seccion.horario} />}
      {seccion.instructor && (
        <FilaDato etiqueta="Instructor" valor={seccion.instructor} />
      )}
    </dl>
  )
}

function FilaDato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-gray-500">{etiqueta}</dt>
      <dd className="text-right font-semibold text-gray-900">{valor}</dd>
    </div>
  )
}

export default async function PaginaRegistro({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Un token que no tiene forma de UUID nunca va a existir en la base; no vale
  // la pena gastar un round trip para saberlo.
  if (!RE_UUID.test(token)) notFound()

  const supabase = crearClienteAnon()
  const { data, error } = await supabase.rpc('get_seccion_by_token', {
    p_token: token,
  })

  if (error) {
    return (
      <Marco>
        <Aviso
          Icono={FiAlertCircle}
          titulo="No pudimos cargar la sección"
          texto="Ocurrió un problema al consultar el registro. Intenta de nuevo en unos segundos."
        />
      </Marco>
    )
  }

  const seccion = (data ?? [])[0] as FilaSeccion | undefined

  if (!seccion) {
    return (
      <Marco>
        <Aviso
          Icono={FiAlertCircle}
          titulo="Enlace no válido"
          texto="Este enlace no corresponde a ninguna sección. Puede que ya se haya eliminado; consulta a tu docente."
        />
      </Marco>
    )
  }

  if (!seccion.registro_abierto) {
    return (
      <Marco>
        <Aviso
          Icono={FiLock}
          titulo="Registro cerrado"
          texto={`El registro de ${seccion.laboratorio} · Sección ${seccion.grupo} ya está cerrado. Consulta a tu docente.`}
        />
      </Marco>
    )
  }

  return (
    <Marco>
      <h2 className="mb-2 text-center text-2xl font-bold text-gray-800">
        Registro de alumno
      </h2>
      <p className="mb-6 text-center text-gray-600">
        Completa tus datos para inscribirte en este laboratorio.
      </p>
      <DatosSeccion seccion={seccion} />
      <FormularioRegistro token={token} seccion={seccion} />
    </Marco>
  )
}
