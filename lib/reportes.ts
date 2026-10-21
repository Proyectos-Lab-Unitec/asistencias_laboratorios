import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Datos de un reporte, ya armados.
 *
 * Este módulo es la única fuente de verdad de las columnas: de acá salen a la
 * vez el preview de la pantalla, el cuerpo del correo y el Excel, así que los
 * tres nunca pueden divergir.
 *
 * Orden de columnas (definido por el dueño del proyecto, no por la spec
 * original): ALUMNO, NO. CUENTA, LABORATORIO ID, SECCION, DOCENTE, CLASE,
 * HORARIO, INSTRUCTOR y, al final, NOTA FINAL. El modo B mete ASISTENCIAS y
 * % ASISTENCIA justo antes de la nota.
 */
export type ModoReporte = 'notas' | 'asistencia'

export function modoValido(valor: string): ModoReporte {
  return valor === 'asistencia' ? 'asistencia' : 'notas'
}

export type FilaReporte = {
  alumno: string
  numero_cuenta: string
  laboratorio: string
  seccion: string
  docente: string
  clase: string
  horario: string
  instructor: string
  nota_final: number | null
  presentes: number
  total: number
}

export type DatoEncabezado = { etiqueta: string; valor: string }

export type Reporte = {
  modo: ModoReporte
  titulo: string
  /** Bloque de título: va en la cabecera del Excel, no repetido por fila. */
  encabezado: DatoEncabezado[]
  columnas: string[]
  filas: FilaReporte[]
}

export function tituloDe(modo: ModoReporte): string {
  return modo === 'notas'
    ? 'REPORTE DE NOTAS FINALES'
    : 'REPORTE DE ASISTENCIA'
}

/** Nombre con el que se descarga el archivo y con el que se asienta el correo. */
export function nombreDeArchivo(reporte: Reporte): string {
  const laboratorio = valorDe(reporte, 'Laboratorio')
  const seccion = valorDe(reporte, 'Seccion')
  const modo = reporte.modo === 'notas' ? 'notas' : 'asistencia'
  return `${aSlug(modo)}-${aSlug(laboratorio)}-${aSlug(seccion)}.xlsx`
}

export function asuntoDe(reporte: Reporte): string {
  const laboratorio = valorDe(reporte, 'Laboratorio')
  const seccion = valorDe(reporte, 'Seccion')
  const periodo = valorDe(reporte, 'Periodo')
  return `${reporte.titulo} - ${laboratorio} (${seccion}) ${periodo}`
}

function valorDe(reporte: Reporte, etiqueta: string): string {
  return (
    reporte.encabezado.find((d) => d.etiqueta === etiqueta)?.valor.trim() ||
    'reporte'
  )
}

/** Para nombres de archivo: sin acentos, sin espacios, sin signos raros. */
function aSlug(texto: string): string {
  return (
    texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'reporte'
  )
}

export function columnasDe(modo: ModoReporte): string[] {
  const base = [
    'ALUMNO',
    'NO. CUENTA',
    'LABORATORIO ID',
    'SECCION',
    'DOCENTE',
    'CLASE',
    'HORARIO',
    'INSTRUCTOR',
  ]
  if (modo === 'notas') return [...base, 'NOTA FINAL']
  return [...base, 'ASISTENCIAS', '% ASISTENCIA', 'NOTA FINAL']
}

/** Las 9 celdas de una fila, siempre en el mismo orden que `columnasDe`. */
export function celdasDe(f: FilaReporte, modo: ModoReporte): string[] {
  const nota = f.nota_final === null ? '' : String(f.nota_final)
  const base = [
    f.alumno,
    f.numero_cuenta,
    f.laboratorio,
    f.seccion,
    f.docente,
    f.clase,
    f.horario,
    f.instructor,
  ]
  if (modo === 'notas') return [...base, nota]

  const porcentaje =
    f.total === 0 ? '' : `${Math.round((f.presentes / f.total) * 100)}%`
  return [...base, `${f.presentes}/${f.total}`, porcentaje, nota]
}

/**
 * Sin tipos generados de la DB, supabase-js infiere los recursos embebidos
 * como arreglo aunque la relación sea many-to-one. Lo desenvolvemos a mano.
 */
export function aObjeto<T>(valor: T | T[] | null): T | null {
  if (valor == null) return null
  return Array.isArray(valor) ? (valor[0] ?? null) : valor
}

type FilaAsistencia = { matricula_id: number; presente: boolean }

/**
 * Reporte de una sola sección.
 *
 * Devuelve `null` si la sección no existe o no es visible para quien pide:
 * la RLS ya acota a las secciones propias en instructores y no deja pasar a
 * nadie más, así que `null` se convierte en un 404 claro en la ruta.
 */
export async function cargarReporteSeccion(
  seccionId: number,
  modo: ModoReporte
): Promise<Reporte | null> {
  const supabase = await createClient()

  const { data: seccion } = await supabase
    .from('secciones')
    .select(
      'id, grupo, horario, laboratorios(nombre, clases(nombre)), periodos(nombre, year), perfiles(nombre)'
    )
    .eq('id', seccionId)
    .maybeSingle()

  if (!seccion) return null

  const laboratorio = aObjeto(seccion.laboratorios)
  const periodo = aObjeto(seccion.periodos)
  const instructor = aObjeto(seccion.perfiles)
  const claseLaboratorio = laboratorio ? aObjeto(laboratorio.clases) : null

  const [{ data: matriculas }, { data: sesiones }] = await Promise.all([
    supabase
      .from('matriculas')
      .select(
        'id, numero_cuenta, nombre, docente, nota_final, seccion_clase, clases(nombre)'
      )
      .eq('seccion_id', seccionId)
      .order('nombre', { ascending: true }),
    supabase
      .from('sesiones')
      .select('id, asistencias(matricula_id, presente)')
      .eq('seccion_id', seccionId),
  ])

  // Presentes por alumno y total de sesiones, que es lo único que el modo B
  // agrega sobre el modo A.
  const presentes = new Map<number, number>()
  let total = 0
  for (const sesion of sesiones ?? []) {
    total += 1
    const filas = (sesion.asistencias ?? []) as unknown as FilaAsistencia[]
    for (const a of filas) {
      if (a.presente) {
        presentes.set(a.matricula_id, (presentes.get(a.matricula_id) ?? 0) + 1)
      }
    }
  }

  const filas: FilaReporte[] = (matriculas ?? []).map((m) => {
    const clase = aObjeto(m.clases)
    return {
      alumno: m.nombre,
      numero_cuenta: m.numero_cuenta,
      laboratorio: laboratorio?.nombre ?? '',
      // La sección del reporte es la de la CLASE del alumno, no la del
      // laboratorio: dos alumnos del mismo laboratorio pueden estar en
      // paralelos distintos. Si la matrícula es anterior a este cambio y no la
      // declaró, se cae a la del laboratorio para no dejar la celda vacía.
      seccion: (m.seccion_clase as string | null) || (seccion.grupo ?? ''),
      docente: (m.docente as string | null) ?? '',
      clase: clase?.nombre ?? claseLaboratorio?.nombre ?? '',
      horario: seccion.horario ?? '',
      instructor: instructor?.nombre ?? '',
      nota_final: m.nota_final as number | null,
      presentes: presentes.get(m.id) ?? 0,
      total,
    }
  })

  return {
    modo,
    titulo: tituloDe(modo),
    // El encabezado lleva solo lo que es propio de la sección: el docente va
    // por alumno (columna DOCENTE), así que no puede salir acá.
    encabezado: [
      {
        etiqueta: 'Periodo',
        valor: periodo ? `${periodo.nombre} ${periodo.year}` : '—',
      },
      { etiqueta: 'Laboratorio', valor: laboratorio?.nombre ?? '—' },
      { etiqueta: 'Seccion', valor: seccion.grupo ?? '—' },
      { etiqueta: 'Horario', valor: seccion.horario ?? '—' },
      { etiqueta: 'Instructor', valor: instructor?.nombre ?? '—' },
    ],
    columnas: columnasDe(modo),
    filas,
  }
}

/**
 * Cuerpo HTML del correo.
 *
 * Va con estilos en línea y sin clases: los clientes de correo (Outlook a la
 * cabeza) tiran lo que venga en `<style>`.
 */
export function reporteAHtml(reporte: Reporte): string {
  const celda = (texto: string) =>
    `<td style="border:1px solid #ccc;padding:6px 10px;white-space:nowrap">${escapar(
      texto
    )}</td>`

  const filas = reporte.filas
    .map(
      (f) =>
        `<tr>${celdasDe(f, reporte.modo).map(celda).join('')}</tr>`
    )
    .join('')

  const encabezado = reporte.encabezado
    .map((d) => `<strong>${escapar(d.etiqueta)}:</strong> ${escapar(d.valor)}`)
    .join(' &nbsp;&nbsp;|&nbsp;&nbsp; ')

  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px">',
    `<p style="margin:0 0 4px"><strong style="font-size:16px">${escapar(
      reporte.titulo
    )}</strong></p>`,
    `<p style="margin:0 0 14px;color:#444">${encabezado}</p>`,
    '<table style="border-collapse:collapse">',
    `<tr>${reporte.columnas
      .map(
        (c) =>
          `<th style="border:1px solid #ccc;background:#06065c;color:#fff;padding:6px 10px">${escapar(
            c
          )}</th>`
      )
      .join('')}</tr>`,
    filas,
    '</table>',
    '</div>',
  ].join('')
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
