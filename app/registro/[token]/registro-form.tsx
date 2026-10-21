'use client'

import { useActionState, useState } from 'react'
import { FiCheckCircle } from 'react-icons/fi'
import { Campo } from '@/components/ui/modal'
import { registrarAlumno } from './actions'
import { ESTADO_INICIAL, type ClaseOpcion } from '@/lib/types'

const CLASE_SELECT =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-black outline-none transition focus:border-[#0f49b6] focus:ring-2 focus:ring-[#0f49b6] disabled:bg-gray-100'

/** Lo mínimo que la página pública muestra de la sección antes del formulario */
export type SeccionPublica = {
  laboratorio: string
  grupo: string
  horario: string | null
  instructor: string | null
}

/**
 * Formulario de inscripción del primer día. No hay cuenta: el alumno entra por
 * el QR, se registra una vez y ya queda en la matrícula de la sección.
 *
 * El docente lo escribe el alumno acá (y no en la sección): es el dato que
 * aporta él, mientras que la sección se identifica con el instructor que la
 * administra.
 *
 * Los campos van controlados (y no como form sin estado) porque al fallar la
 * server action el alumno debe conservar lo que ya había escrito; si el form
 * se reiniciara tendría que volver a llenar todo por un solo error.
 */
export default function FormularioRegistro({
  token,
  seccion,
  clases,
}: {
  token: string
  seccion: SeccionPublica
  clases: ClaseOpcion[]
}) {
  const [estado, enviar, pendiente] = useActionState(
    registrarAlumno,
    ESTADO_INICIAL
  )

  const [numeroCuenta, setNumeroCuenta] = useState('')
  const [nombre, setNombre] = useState('')
  const [carrera, setCarrera] = useState('')
  const [correo, setCorreo] = useState('')
  const [docente, setDocente] = useState('')
  const [claseId, setClaseId] = useState('')
  const [seccionClase, setSeccionClase] = useState('')

  if (estado.ok) {
    return (
      <div className="py-4 text-center">
        <FiCheckCircle
          className="mx-auto text-4xl text-emerald-600"
          aria-hidden
        />
        <h3 className="mt-3 text-lg font-bold text-gray-900">
          Registro completo
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          Ya quedaste inscrito en{' '}
          <strong>
            {seccion.laboratorio} · Sección {seccion.grupo}
          </strong>
          . Tu docente tomará asistencia a partir de este registro.
        </p>
      </div>
    )
  }

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <Campo
        label="Número de cuenta"
        name="numero_cuenta"
        valor={numeroCuenta}
        onChange={setNumeroCuenta}
        placeholder="12345678"
        disabled={pendiente}
        requerido
        maxLength={20}
      />
      <Campo
        label="Nombre completo"
        name="nombre"
        valor={nombre}
        onChange={setNombre}
        placeholder="Nombre y apellidos"
        disabled={pendiente}
        requerido
        maxLength={120}
      />
      <Campo
        label="Carrera"
        name="carrera"
        valor={carrera}
        onChange={setCarrera}
        placeholder="Ingeniería en ..."
        disabled={pendiente}
        requerido
        maxLength={120}
      />
      <Campo
        label="Correo electrónico"
        tipo="email"
        name="correo"
        valor={correo}
        onChange={setCorreo}
        placeholder="alumno@universidad.com"
        disabled={pendiente}
        requerido
        maxLength={254}
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
          disabled={pendiente || clases.length === 0}
          required
          className={CLASE_SELECT}
        >
          <option value="">Elige la clase que cursas…</option>
          {clases.map((clase) => (
            <option key={clase.id} value={clase.id}>
              {clase.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo
        label="Sección de la clase"
        name="seccion_clase"
        valor={seccionClase}
        onChange={setSeccionClase}
        placeholder="V1"
        disabled={pendiente}
        requerido
        maxLength={40}
      />
      {clases.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Todavía no hay clases dadas de alta. Avisa a tu docente para que
          habiliten el registro.
        </p>
      )}
      <Campo
        label="Docente"
        name="docente"
        valor={docente}
        onChange={setDocente}
        placeholder="Ing. María López"
        disabled={pendiente}
        requerido
        maxLength={120}
      />

      <button
        type="submit"
        disabled={pendiente}
        className="w-full rounded-lg bg-[#06065c] py-3 text-lg text-white transition-all duration-300 hover:bg-[#0f49b6] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pendiente ? 'Registrando...' : 'Registrarme'}
      </button>

      {estado.error && (
        <p role="alert" className="text-center text-sm text-red-600">
          {estado.error}
        </p>
      )}
    </form>
  )
}
