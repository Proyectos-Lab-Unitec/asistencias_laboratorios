'use server'

import { headers } from 'next/headers'
import { crearClienteAnon } from '@/lib/supabase/anon-server'
import type { EstadoAccion } from '@/lib/types'

const OK: EstadoAccion = { ok: true, error: null }

/**
 * Forma de un UUID v4. Sirve para cortar de raíz tokens malformados sin
 * mandarlos a la base (el comparador de uuid tiraría error igual).
 */
const RE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Rate limiting por IP en la ruta pública.
 *
 * No es para frenar al alumno (registra una sola vez), sino para frenar a
 * quien mande el formulario en bucle. Va en memoria: sobrevive a los requests
 * del proceso pero no a un reinicio ni a un despliegue con varios workers.
 * Para uso interno de una universidad alcanza; si algún día se despliega con
 * más de un proceso, hay que moverlo a Postgres o Redis.
 */
const LIMITE = { maximo: 10, ventanaMs: 60_000 }
const intentos = new Map<string, { inicio: number; total: number }>

function excedeElLimite(clave: string): boolean {
  const ahora = Date.now()

  // Evita que el Map crezca sin límite con claves que nunca se repiten.
  if (intentos.size > 1_000) {
    for (const [k, v] of intentos) {
      if (ahora - v.inicio > LIMITE.ventanaMs) intentos.delete(k)
    }
  }

  const actual = intentos.get(clave)
  if (!actual || ahora - actual.inicio > LIMITE.ventanaMs) {
    intentos.set(clave, { inicio: ahora, total: 1 })
    return false
  }

  actual.total += 1
  return actual.total > LIMITE.maximo
}

async function claveDelSolicitante(): Promise<string> {
  // Detrás de un proxy (nginx, Vercel) viene la IP real. Sin proxy, como en
  // local, puede venir vacío y todos comparten la misma tanda.
  const cabeceras = await headers()
  const xff = cabeceras.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return cabeceras.get('x-real-ip') ?? 'sin-ip'
}

/** El RPC devuelve jsonb con un código; esto lo traduce a lo que ve el alumno. */
const ERRORES = {
  token_invalido: 'Este enlace de registro no es válido.',
  registro_cerrado:
    'El registro de esta sección ya está cerrado. Consulta a tu docente.',
  seccion_llena: 'La sección ya alcanzó su capacidad máxima de alumnos.',
  ya_registrado:
    'Ya existe un alumno con ese número de cuenta en esta sección.',
  clase_invalida: 'Elige una clase válida de la lista.',
  seccion_invalida: 'La sección de tu clase es obligatoria.',
} as const

type CodigoError = keyof typeof ERRORES

function leerCampo(formData: FormData, nombre: string): string {
  return String(formData.get(nombre) ?? '').trim()
}

export async function registrarAlumno(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const token = leerCampo(formData, 'token')
  const numeroCuenta = leerCampo(formData, 'numero_cuenta')
  const nombre = leerCampo(formData, 'nombre')
  const carrera = leerCampo(formData, 'carrera')
  const correo = leerCampo(formData, 'correo')
  const docente = leerCampo(formData, 'docente')
  const claseId = Number.parseInt(leerCampo(formData, 'clase_id'), 10)
  const seccionClase = leerCampo(formData, 'seccion_clase')

  if (!RE_UUID.test(token)) return { ok: false, error: ERRORES.token_invalido }

  if (!numeroCuenta) return { ok: false, error: 'El número de cuenta es obligatorio.' }
  if (numeroCuenta.length > 20) return { ok: false, error: 'El número de cuenta es demasiado largo.' }
  if (!nombre) return { ok: false, error: 'El nombre es obligatorio.' }
  if (nombre.length > 120) return { ok: false, error: 'El nombre es demasiado largo.' }
  if (!carrera) return { ok: false, error: 'La carrera es obligatoria.' }
  if (carrera.length > 120) return { ok: false, error: 'La carrera es demasiado larga.' }
  if (!correo) return { ok: false, error: 'El correo es obligatorio.' }
  if (correo.length > 254) return { ok: false, error: 'El correo es demasiado largo.' }
  if (!RE_CORREO.test(correo)) return { ok: false, error: 'El correo no tiene un formato válido.' }
  if (!docente) return { ok: false, error: 'El docente es obligatorio.' }
  if (docente.length > 120) return { ok: false, error: 'El nombre del docente es demasiado largo.' }
  if (!Number.isInteger(claseId) || claseId <= 0) {
    return { ok: false, error: 'Elige la clase que cursas.' }
  }
  if (!seccionClase) {
    return { ok: false, error: 'La sección de tu clase es obligatoria.' }
  }
  if (seccionClase.length > 40) {
    return { ok: false, error: 'La sección de la clase es demasiado larga.' }
  }

  if (excedeElLimite(await claveDelSolicitante())) {
    return {
      ok: false,
      error: 'Demasiados intentos. Espera un minuto y vuelve a intentarlo.',
    }
  }

  const supabase = crearClienteAnon()
  const { data, error } = await supabase.rpc('registrar_alumno', {
    p_token: token,
    p_numero_cuenta: numeroCuenta,
    p_nombre: nombre,
    p_carrera: carrera,
    p_correo: correo,
    p_docente: docente,
    p_clase_id: claseId,
    p_seccion_clase: seccionClase,
  })

  if (error) {
    return { ok: false, error: `No se pudo completar el registro: ${error.message}` }
  }

  const resultado = data as { ok?: boolean; error?: string } | null

  if (!resultado?.ok) {
    const codigo = (resultado?.error ?? 'token_invalido') as CodigoError
    return { ok: false, error: ERRORES[codigo] ?? ERRORES.token_invalido }
  }

  return OK
}
