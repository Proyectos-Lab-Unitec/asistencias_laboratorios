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
  ubicacion: string | null
  capacidad: number
  activo: boolean
  created_at: string
}

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
  docente: string | null
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
  nota_final: number | null
  origen: OrigenMatricula
  registrado_en: string
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
