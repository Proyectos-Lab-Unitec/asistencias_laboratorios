'use server'

import { revalidatePath } from 'next/cache'
import { requiereInstructor } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { EstadoAccion } from '@/lib/types'

type Cliente = Awaited<ReturnType<typeof createClient>>

const OK: EstadoAccion = { ok: true, error: null }
const SIN_PERMISO: EstadoAccion = {
  ok: false,
  error: 'No tienes permiso para hacer esto.',
}

/** Formato de date de Postgres */
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/

/** Mismo corte que usa el registro público: alcanza para descartar typos. */
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Fecha local del servidor en formato date de Postgres (YYYY-MM-DD). */
function fechaLocal(d: Date) {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function ruta(seccionId: number) {
  return `/instructor/seccion/${seccionId}`
}

/**
 * Confirma que la sección es del instructor.
 *
 * RLS ya lo garantiza (una sección ajena ni siquiera se filtra), pero el
 * filtro explícito deja la intención clara y evita depender solo de la
 * política: son varias líneas por el precio de una consulta más.
 */
async function seccionPropia(
  supabase: Cliente,
  seccionId: number,
  instructorId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('secciones')
    .select('id')
    .eq('id', seccionId)
    .eq('instructor_id', instructorId)
    .maybeSingle()

  return !!data
}

/**
 * Carga una sesión validando que su sección es del instructor.
 * Devuelve `null` cuando no existe o no es suya.
 */
async function sesionValida(
  supabase: Cliente,
  sesionId: number,
  instructorId: string
) {
  const { data } = await supabase
    .from('sesiones')
    .select('id, seccion_id, estado')
    .eq('id', sesionId)
    .maybeSingle()

  if (!data || !(await seccionPropia(supabase, data.seccion_id, instructorId))) {
    return null
  }

  return data as { id: number; seccion_id: number; estado: string }
}

/**
 * Crea la sesión de un día.
 *
 * El instructor elige la fecha: por defecto es hoy, pero también sirve para
 * dar de alta un día que se pasó por alto. La fecha la manda el navegador
 * porque es la hora del aula; si se calculara en el servidor en un despliegue
 * con máquinas en UTC, una clase de las 6 p.m. caería al día siguiente.
 *
 * No se aceptan fechas futuras: una sesión es el registro de una clase que ya
 * ocurrió, y abrirla de más sería una puerta a marcar asistencia antes de
 * tiempo. La UI además limita el calendario al día de hoy; acá se repite el
 * corte con un día de tolerancia por la zona horaria del servidor.
 */
export async function abrirSesion(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const instructor = await requiereInstructor()
  if (!instructor) return SIN_PERMISO

  const seccionId = Number(formData.get('seccion_id'))
  const fecha = String(formData.get('fecha') ?? '').trim()

  if (!Number.isInteger(seccionId) || seccionId <= 0) {
    return { ok: false, error: 'Sección no válida.' }
  }
  if (!RE_FECHA.test(fecha)) return { ok: false, error: 'Fecha no válida.' }

  // Comparación lexicográfica: en formato YYYY-MM-DD el orden de cadena es el
  // orden cronológico.
  const manana = fechaLocal(new Date(Date.now() + 24 * 60 * 60 * 1000))
  if (fecha > manana) {
    return {
      ok: false,
      error: 'No se puede crear una sesión para una fecha futura.',
    }
  }

  const supabase = await createClient()
  if (!(await seccionPropia(supabase, seccionId, instructor.id))) {
    return SIN_PERMISO
  }

  const { error } = await supabase
    .from('sesiones')
    .insert({ seccion_id: seccionId, fecha })

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'Ya hay una sesión registrada para ese día.' }
    }
    return { ok: false, error: `No se pudo abrir la sesión: ${error.message}` }
  }

  revalidatePath(ruta(seccionId))
  return OK
}

/**
 * Abre o cierra una sesión. Cerrarla deja la asistencia del día inmutable;
 * reabrirla es el camino para corregir un día viejo.
 */
export async function alternarSesion(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const instructor = await requiereInstructor()
  if (!instructor) return SIN_PERMISO

  const sesionId = Number(formData.get('id'))
  // InterruptorEstado manda el valor nuevo en el campo "activo"
  const abierta = String(formData.get('activo') ?? '') === 'true'

  if (!Number.isInteger(sesionId) || sesionId <= 0) {
    return { ok: false, error: 'Sesión no válida.' }
  }

  const supabase = await createClient()
  const sesion = await sesionValida(supabase, sesionId, instructor.id)
  if (!sesion) return SIN_PERMISO

  const { error } = await supabase
    .from('sesiones')
    .update({ estado: abierta ? 'abierta' : 'cerrada' })
    .eq('id', sesionId)

  if (error) {
    return { ok: false, error: `No se pudo actualizar la sesión: ${error.message}` }
  }

  revalidatePath(ruta(sesion.seccion_id))
  return OK
}

/**
 * Alterna la casilla de un alumno en un día.
 *
 * Cada casilla tiene tres estados de facto: sin marcar, presente y ausente.
 * Sin marcar y ausente cuentan igual para el reporte (no es presente), pero
 * se distinguen en pantalla para saber qué se tocó y qué no.
 */
export async function alternarAsistencia(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const instructor = await requiereInstructor()
  if (!instructor) return SIN_PERMISO

  const sesionId = Number(formData.get('sesion_id'))
  const matriculaId = Number(formData.get('matricula_id'))

  if (!Number.isInteger(sesionId) || sesionId <= 0) {
    return { ok: false, error: 'Sesión no válida.' }
  }
  if (!Number.isInteger(matriculaId) || matriculaId <= 0) {
    return { ok: false, error: 'Alumno no válido.' }
  }

  const supabase = await createClient()
  const sesion = await sesionValida(supabase, sesionId, instructor.id)
  if (!sesion) return SIN_PERMISO
  if (sesion.estado !== 'abierta') {
    return {
      ok: false,
      error: 'La sesión está cerrada. Ábrela desde la cabecera para corregir.',
    }
  }

  const { data: existente } = await supabase
    .from('asistencias')
    .select('id, presente')
    .eq('sesion_id', sesionId)
    .eq('matricula_id', matriculaId)
    .maybeSingle()

  const { error } = existente
    ? await supabase
        .from('asistencias')
        .update({ presente: !existente.presente })
        .eq('id', existente.id)
    : await supabase.from('asistencias').insert({
        sesion_id: sesionId,
        matricula_id: matriculaId,
        presente: true,
        marcado_por: instructor.id,
      })

  if (error) {
    return { ok: false, error: `No se pudo marcar la asistencia: ${error.message}` }
  }

  revalidatePath(ruta(sesion.seccion_id))
  return OK
}

/**
 * "Marcar todos presentes": el atajo del primer minuto de clase. Después el
 * instructor corrige las excepciones a mano, que es mucho menos trabajo que
 * encender uno por uno.
 */
export async function marcarTodosPresentes(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const instructor = await requiereInstructor()
  if (!instructor) return SIN_PERMISO

  const sesionId = Number(formData.get('sesion_id'))
  if (!Number.isInteger(sesionId) || sesionId <= 0) {
    return { ok: false, error: 'Sesión no válida.' }
  }

  const supabase = await createClient()
  const sesion = await sesionValida(supabase, sesionId, instructor.id)
  if (!sesion) return SIN_PERMISO
  if (sesion.estado !== 'abierta') {
    return { ok: false, error: 'La sesión está cerrada.' }
  }

  const { data: matriculas } = await supabase
    .from('matriculas')
    .select('id')
    .eq('seccion_id', sesion.seccion_id)

  if (!matriculas || matriculas.length === 0) {
    return { ok: false, error: 'Esta sección aún no tiene alumnos inscritos.' }
  }

  const filas = matriculas.map((m) => ({
    sesion_id: sesionId,
    matricula_id: m.id,
    presente: true,
    marcado_por: instructor.id,
  }))

  // onConflict sobre el constraint UNIQUE(sesion_id, matricula_id): lo que ya
  // estuviera marcado presente sigue igual y lo ausente pasa a presente.
  const { error } = await supabase
    .from('asistencias')
    .upsert(filas, { onConflict: 'sesion_id,matricula_id' })

  if (error) {
    return { ok: false, error: `No se pudo marcar la asistencia: ${error.message}` }
  }

  revalidatePath(ruta(sesion.seccion_id))
  return OK
}

/**
 * Guarda las notas finales de la sección de una sola pasada.
 *
 * El formulario manda una entrada por alumno (`nota_<id>`). Antes de escribir
 * se comparan contra lo que ya está en la base y solo se actualizan las que
 * cambiaron: capturar 30 notas de un salto no son 30 idas y vueltas, y corregir
 * una sola tampoco mueve las otras 29.
 */
export async function guardarNotas(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const instructor = await requiereInstructor()
  if (!instructor) return SIN_PERMISO

  const seccionId = Number(formData.get('seccion_id'))
  if (!Number.isInteger(seccionId) || seccionId <= 0) {
    return { ok: false, error: 'Sección no válida.' }
  }

  const supabase = await createClient()
  if (!(await seccionPropia(supabase, seccionId, instructor.id))) {
    return SIN_PERMISO
  }

  // El formulario trae otros campos ocultos (los de la server action); solo
  // nos interesan las entradas de nota.
  const entradas: { id: number; nota_final: number | null }[] = []
  for (const [clave, valor] of formData.entries()) {
    if (!clave.startsWith('nota_')) continue

    const id = Number(clave.slice('nota_'.length))
    if (!Number.isInteger(id) || id <= 0) continue

    const texto = String(valor).trim()
    if (texto === '') {
      // Vacío = sin nota todavía, no un cero.
      entradas.push({ id, nota_final: null })
      continue
    }

    // La escala la fija la clase, no el laboratorio: se acepta de 0 a 100.
    const nota = Number(texto)
    if (!Number.isFinite(nota) || nota < 0 || nota > 100) {
      return {
        ok: false,
        error: `La nota debe estar entre 0 y 100 (se recibió «${texto}»).`,
      }
    }

    entradas.push({ id, nota_final: nota })
  }

  if (entradas.length === 0) return OK

  const { data: actuales } = await supabase
    .from('matriculas')
    .select('id, nota_final')
    .eq('seccion_id', seccionId)

  const guardadas = new Map(
    (actuales ?? []).map((m) => [m.id as number, m.nota_final as number | null])
  )

  // Solo lo que difiere de lo que ya hay, y solo de alumnos de esta sección:
  // el id viene del cliente y no alcanza con confiar en él.
  const cambios = entradas.filter(
    (e) => guardadas.has(e.id) && guardadas.get(e.id) !== e.nota_final
  )

  if (cambios.length === 0) return OK

  const resultados = await Promise.all(
    cambios.map((c) =>
      supabase
        .from('matriculas')
        .update({ nota_final: c.nota_final })
        .eq('id', c.id)
        .eq('seccion_id', seccionId)
    )
  )

  const fallo = resultados.find((r) => r.error)
  if (fallo?.error) {
    return {
      ok: false,
      error: `No se pudieron guardar las notas: ${fallo.error.message}`,
    }
  }

  revalidatePath(ruta(seccionId))
  return OK
}

/** Lo que se escribe en `matriculas` al dar de alta o editar a un alumno. */
type DatosAlumno = {
  numero_cuenta: string
  nombre: string
  docente: string
  clase_id: number
  seccion_clase: string
  carrera: string | null
  correo: string | null
}

/**
 * Validación compartida por el alta y la edición del alumno.
 *
 * Docente, clase y sección de clase van obligatorios porque las tres son
 * columnas del reporte de Excel; carrera y correo quedan opcionales porque la
 * tabla los permite nulos y no se imprimen.
 */
function validarAlumno(formData: FormData):
  | { datos: DatosAlumno }
  | { error: string } {
  const numeroCuenta = String(formData.get('numero_cuenta') ?? '').trim()
  const nombre = String(formData.get('nombre') ?? '').trim()
  const docente = String(formData.get('docente') ?? '').trim()
  const carrera = String(formData.get('carrera') ?? '').trim()
  const correo = String(formData.get('correo') ?? '').trim()
  const claseId = Number.parseInt(String(formData.get('clase_id') ?? ''), 10)
  const seccionClase = String(formData.get('seccion_clase') ?? '').trim()

  if (!numeroCuenta) {
    return { error: 'El número de cuenta es obligatorio.' }
  }
  if (numeroCuenta.length > 20) {
    return { error: 'El número de cuenta es demasiado largo.' }
  }
  if (!nombre) return { error: 'El nombre es obligatorio.' }
  if (nombre.length > 120) {
    return { error: 'El nombre es demasiado largo.' }
  }
  if (!docente) return { error: 'El docente es obligatorio.' }
  if (docente.length > 120) {
    return { error: 'El docente es demasiado largo.' }
  }
  if (carrera.length > 120) {
    return { error: 'La carrera es demasiado larga.' }
  }
  if (correo.length > 120) {
    return { error: 'El correo es demasiado largo.' }
  }
  if (correo && !RE_CORREO.test(correo)) {
    return { error: 'El correo no tiene un formato válido.' }
  }
  if (!Number.isInteger(claseId) || claseId <= 0) {
    return { error: 'Elige una clase.' }
  }
  if (!seccionClase) {
    return { error: 'La sección de la clase es obligatoria.' }
  }
  if (seccionClase.length > 40) {
    return { error: 'La sección de la clase es demasiado larga.' }
  }

  return {
    datos: {
      numero_cuenta: numeroCuenta,
      nombre,
      docente,
      clase_id: claseId,
      seccion_clase: seccionClase,
      carrera: carrera || null,
      correo: correo || null,
    },
  }
}

/**
 * Da de alta un alumno a mano (§4.1.6).
 *
 * Es el mismo alta que haría el alumno desde el QR, pero lo dispara el
 * instructor: sirve para quien llegó sin celular y para corregir un registro
 * equivocado sin tener que tocar la base.
 */
export async function agregarAlumno(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const instructor = await requiereInstructor()
  if (!instructor) return SIN_PERMISO

  const seccionId = Number(formData.get('seccion_id'))
  if (!Number.isInteger(seccionId) || seccionId <= 0) {
    return { ok: false, error: 'Sección no válida.' }
  }

  const validado = validarAlumno(formData)
  if ('error' in validado) return { ok: false, error: validado.error }

  const supabase = await createClient()
  if (!(await seccionPropia(supabase, seccionId, instructor.id))) {
    return SIN_PERMISO
  }

  // `origen` documenta cómo entró el alumno: el QR y el alta a mano conviven
  // en la misma sección y el reporte no distingue entre ambos.
  const { error } = await supabase.from('matriculas').insert({
    seccion_id: seccionId,
    ...validado.datos,
    origen: 'manual',
  })

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        error: 'Ya hay un alumno con ese número de cuenta en esta sección.',
      }
    }
    return { ok: false, error: `No se pudo agregar al alumno: ${error.message}` }
  }

  revalidatePath(ruta(seccionId))
  return OK
}

/**
 * Corrige los datos de una matrícula ya inscrita.
 *
 * No toca `nota_final` (se captura en su propia pestaña) ni `origen`: son datos
 * que el instructor no debería reescribir desde acá. El filtro por `seccion_id`
 * evita que un id de otra sección sirva para editar a un alumno ajeno.
 */
export async function actualizarAlumno(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const instructor = await requiereInstructor()
  if (!instructor) return SIN_PERMISO

  const seccionId = Number(formData.get('seccion_id'))
  const matriculaId = Number(formData.get('id'))

  if (!Number.isInteger(seccionId) || seccionId <= 0) {
    return { ok: false, error: 'Sección no válida.' }
  }
  if (!Number.isInteger(matriculaId) || matriculaId <= 0) {
    return { ok: false, error: 'Alumno no válido.' }
  }

  const validado = validarAlumno(formData)
  if ('error' in validado) return { ok: false, error: validado.error }

  const supabase = await createClient()
  if (!(await seccionPropia(supabase, seccionId, instructor.id))) {
    return SIN_PERMISO
  }

  const { error } = await supabase
    .from('matriculas')
    .update(validado.datos)
    .eq('id', matriculaId)
    .eq('seccion_id', seccionId)

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        error: 'Ya hay un alumno con ese número de cuenta en esta sección.',
      }
    }
    if (error.code === '23503') {
      return { ok: false, error: 'La clase seleccionada ya no existe.' }
    }
    return {
      ok: false,
      error: `No se pudo actualizar al alumno: ${error.message}`,
    }
  }

  revalidatePath(ruta(seccionId))
  return OK
}
