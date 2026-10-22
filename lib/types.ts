export type RolUsuario = 'admin' | 'instructor'
export type OrigenMatricula = 'qr' | 'manual'
export type EstadoSesion = 'abierta' | 'cerrada'

/**
 * Estado que devuelven las server actions y que consume useActionState.
 * Vive acá (y no en un archivo 'use server') porque esos archivos solo
 * pueden exportar funciones asíncronas.
 */
export type EstadoAccion = {
  ok: boolean
  error: string | null
}

export const ESTADO_INICIAL: EstadoAccion = { ok: false, error: null }

export type Perfil = {
  id: string
  email: string | null
  rol: RolUsuario
  nombre: string
  activo: boolean
  created_at: string
}

export type Laboratorio = {
  id: number
  nombre: string
  clase_id: number | null
  /**
   * Nombre de la clase ya resuelto (join con `clases`). Es solo para mostrar:
   * lo que se guarda es `clase_id`.
   */
  clase: string | null
  ubicacion: string | null
  capacidad: number
  activo: boolean
  created_at: string
}

/** Catálogo de materias que administra el admin (Física 1, Química, ...). */
export type Clase = {
  id: number
  nombre: string
  activo: boolean
  created_at: string
}

/** Opciones de los <select> de clase. */
export type ClaseOpcion = { id: number; nombre: string }

export type Periodo = {
  id: number
  year: number
  nombre: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  fecha_inicio: string
  fecha_fin: string
}

export type Seccion = {
  id: number
  laboratorio_id: number
  instructor_id: string
  periodo_id: number
  grupo: string
  horario: string | null
  token_registro: string
  registro_abierto: boolean
  created_at: string
}

export type Matricula = {
  id: number
  seccion_id: number
  numero_cuenta: string
  nombre: string
  carrera: string | null
  correo: string | null
  /** Lo declara el alumno al inscribirse; es un dato suyo, no de la sección */
  docente: string | null
  /** Clase que cursa el alumno (FK al catálogo de clases). */
  clase_id: number | null
  /** Sección de esa clase (p. ej. «V1»); no es la sección del laboratorio. */
  seccion_clase: string | null
  nota_final: number | null
  origen: OrigenMatricula
  registrado_en: string
}

/**
 * Una matrícula vista desde la UI de la sección: la grilla de asistencia y la
 * captura de notas consumen lo mismo, y también es lo que precarga el modal de
 * edición del alumno.
 */
export type AlumnoSeccion = {
  id: number
  numero_cuenta: string
  nombre: string
  docente: string | null
  clase_id: number | null
  /** Nombre de la clase ya resuelto (join), solo para mostrar. */
  clase: string | null
  seccion_clase: string | null
  carrera: string | null
  correo: string | null
  nota_final: number | null
}

export type Sesion = {
  id: number
  seccion_id: number
  fecha: string
  estado: EstadoSesion
  created_at: string
}

export type Asistencia = {
  id: number
  sesion_id: number
  matricula_id: number
  presente: boolean
  marcado_por: string | null
  hora: string
}

/** Lo que muestra el admin de cada sección al abrir el detalle de un instructor */
export type SeccionResumen = {
  id: number
  grupo: string
  horario: string | null
  laboratorio: string
  periodo: string
  /** Solo lo llena el modal de secciones de un laboratorio. */
  instructor?: string
}

/** Alumno tal como lo muestra el detalle de una sección del admin. */
export type AlumnoDetalle = {
  id: number
  numeroCuenta: string
  nombre: string
  docente: string | null
  clase: string | null
  seccionClase: string | null
  notaFinal: number | null
  /** Días a los que asistió, sobre el total de sesiones de la sección. */
  presentes: number
}

export type DetalleSeccion = {
  sesiones: number
  alumnos: AlumnoDetalle[]
}

/** Opciones de los <select> del formulario de sección */
export type LaboratorioOpcion = { id: number; nombre: string }
export type PeriodoOpcion = { id: number; etiqueta: string }

/** Fila de la tabla "Mis secciones" del instructor */
export type SeccionFila = {
  id: number
  laboratorio_id: number
  periodo_id: number
  laboratorio: string
  periodo: string
  grupo: string
  horario: string | null
  registro_abierto: boolean
  token_registro: string
  alumnos: number
}
