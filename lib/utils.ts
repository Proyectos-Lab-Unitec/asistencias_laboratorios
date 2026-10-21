/**
 * Utilidades sin dependencias que comparten el admin y el instructor.
 *
 * Vive en `lib/` y no en `components/` porque la mitad de los usos son de
 * servidor (páginas que leen la base) y la otra mitad de cliente (tablas).
 */

/**
 * Desenvuelve un recurso embebido de PostgREST.
 *
 * Sin tipos generados de la DB, supabase-js infiere las relaciones
 * many-to-one como arreglo aunque en runtime lleguen como objeto.
 */
export function aObjeto<T>(valor: T | T[] | null): T | null {
  if (valor == null) return null
  return Array.isArray(valor) ? (valor[0] ?? null) : valor
}

/**
 * «1 alumno» / «3 alumnos».
 *
 * Se piden las dos formas y no se adivina el plural: «sección» → «secciones»
 * y «cuenta» → «cuentas» siguen reglas distintas, y una heurística de sufijos
 * falla en español.
 */
export function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`
}
