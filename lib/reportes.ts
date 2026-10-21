import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { aObjeto } from '@/lib/utils'

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
  /** De dónde salen las filas: una sección o todo lo visible para quien pide. */
  alcance: 'seccion' | 'global'
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
  const modo = reporte.modo === 'notas' ? 'notas' : 'asistencia'

  if (reporte.alcance === 'global') {
    return `${aSlug(modo)}-global-${aSlug(valorDe(reporte, 'Periodo'))}.xlsx`
  }

  const laboratorio = valorDe(reporte, 'Laboratorio')
  const seccion = valorDe(reporte, 'Seccion')
  return `${aSlug(modo)}-${aSlug(laboratorio)}-${aSlug(seccion)}.xlsx`
}

export function asuntoDe(reporte: Reporte): string {
  const periodo = valorDe(reporte, 'Periodo')

  if (reporte.alcance === 'global') {
    return `${reporte.titulo} - Global (${periodo})`
  }

  const laboratorio = valorDe(reporte, 'Laboratorio')
  const seccion = valorDe(reporte, 'Seccion')
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

type FilaAsistencia = { matricula_id: number; presente: boolean }

/** Qué filas entran al reporte. `null` = sin filtro. */
export type FiltroReporte = {
  /** Una sección concreta; null = todas las visibles para quien pide. */
  seccionId: number | null
  /** Un periodo concreto; null = todos. */
  periodoId: number | null
  /** Una clase concreta (la que declara el alumno); null = todas. */
  claseId: number | null
}

type SeccionCruda = {
  id: number
  grupo: string | null
  horario: string | null
  laboratorios: unknown
  periodos: unknown
  perfiles: unknown
}

type MetaSeccion = {
  laboratorio: string
  claseLaboratorio: string
  periodo: string
  instructor: string
  grupo: string
  horario: string
}

/**
 * Arma un reporte, de una sección o global.
 *
 * Con `seccionId` sale el reporte de esa sección, con su encabezado completo.
 * Sin él sale el global: ahí no hay un laboratorio ni un instructor únicos, así
 * que el bloque de título pasa a describir el alcance (periodo, clase, cuántas
 * secciones y cuántos alumnos).
 *
 * La RLS es el límite: un instructor solo ve sus secciones, de modo que su
 * "global" sería su propio conjunto. El alcance global de verdad lo usa la ruta
 * del admin.
 */
export async function cargarReporte(
  filtro: FiltroReporte,
  modo: ModoReporte
): Promise<Reporte | null> {
  const supabase = await createClient()

  let consulta = supabase
    .from('secciones')
    .select(
      'id, grupo, horario, laboratorios(nombre, clases(nombre)), periodos(nombre, year), perfiles(nombre)'
    )
    .order('id', { ascending: true })

  if (filtro.seccionId !== null) consulta = consulta.eq('id', filtro.seccionId)
  if (filtro.periodoId !== null) {
    consulta = consulta.eq('periodo_id', filtro.periodoId)
  }

  const { data: secciones } = await consulta
  const lista = (secciones ?? []) as unknown as SeccionCruda[]

  if (lista.length === 0) return null

  const ids = lista.map((seccion) => seccion.id)

  const [{ data: matriculas }, { data: sesiones }] = await Promise.all([
    supabase
      .from('matriculas')
      .select(
        'id, seccion_id, numero_cuenta, nombre, docente, nota_final, seccion_clase, clase_id, clases(nombre)'
      )
      .in('seccion_id', ids)
      .order('nombre', { ascending: true }),
    supabase
      .from('sesiones')
      .select('id, seccion_id, asistencias(matricula_id, presente)')
      .in('seccion_id', ids),
  ])

  // Presentes por alumno y total de sesiones de SU sección: es lo único que el
  // modo B agrega sobre el modo A.
  const presentes = new Map<number, number>()
  const totalPorSeccion = new Map<number, number>()
  for (const sesion of sesiones ?? []) {
    const seccionId = sesion.seccion_id as number
    totalPorSeccion.set(seccionId, (totalPorSeccion.get(seccionId) ?? 0) + 1)

    const marcas = (sesion.asistencias ?? []) as unknown as FilaAsistencia[]
    for (const marca of marcas) {
      if (marca.presente) {
        presentes.set(
          marca.matricula_id,
          (presentes.get(marca.matricula_id) ?? 0) + 1
        )
      }
    }
  }

  const meta = new Map<number, MetaSeccion>()
  for (const seccion of lista) {
    const laboratorio = aObjeto(
      seccion.laboratorios as { nombre: string; clases: unknown } | null
    )
    const periodo = aObjeto(
      seccion.periodos as { nombre: string; year: number } | null
    )
    const instructor = aObjeto(seccion.perfiles as { nombre: string } | null)
    const claseLaboratorio = laboratorio
      ? aObjeto(laboratorio.clases as { nombre: string } | null)
      : null

    meta.set(seccion.id, {
      laboratorio: laboratorio?.nombre ?? '',
      claseLaboratorio: claseLaboratorio?.nombre ?? '',
      periodo: periodo ? `${periodo.nombre} ${periodo.year}` : '',
      instructor: instructor?.nombre ?? '',
      grupo: seccion.grupo ?? '',
      horario: seccion.horario ?? '',
    })
  }

  const filas: FilaReporte[] = []
  for (const matricula of matriculas ?? []) {
    const seccionId = matricula.seccion_id as number
    const datos = meta.get(seccionId)
    if (!datos) continue

    // El filtro por clase va sobre lo que declaró el alumno, no sobre el
    // laboratorio: un mismo laboratorio puede tener clases distintas.
    if (
      filtro.claseId !== null &&
      (matricula.clase_id as number | null) !== filtro.claseId
    ) {
      continue
    }

    const clase = aObjeto(
      matricula.clases as unknown as { nombre: string } | null
    )

    filas.push({
      alumno: matricula.nombre,
      numero_cuenta: matricula.numero_cuenta,
      laboratorio: datos.laboratorio,
      // La sección del reporte es la de la CLASE del alumno, no la del
      // laboratorio. Si la matrícula es anterior y no la declaró, se cae a la
      // del laboratorio para no dejar la celda vacía.
      seccion: (matricula.seccion_clase as string | null) || datos.grupo,
      docente: (matricula.docente as string | null) ?? '',
      clase: clase?.nombre ?? datos.claseLaboratorio,
      horario: datos.horario,
      instructor: datos.instructor,
      nota_final: matricula.nota_final as number | null,
      presentes: presentes.get(matricula.id as number) ?? 0,
      total: totalPorSeccion.get(seccionId) ?? 0,
    })
  }

  // ---------- Bloque de título ----------
  if (filtro.seccionId !== null && lista.length === 1) {
    const datos = meta.get(lista[0].id)!

    return {
      modo,
      alcance: 'seccion',
      titulo: tituloDe(modo),
      // El docente va por alumno (columna DOCENTE), así que no puede salir acá.
      encabezado: [
        { etiqueta: 'Periodo', valor: datos.periodo || '—' },
        { etiqueta: 'Laboratorio', valor: datos.laboratorio || '—' },
        { etiqueta: 'Seccion', valor: datos.grupo || '—' },
        { etiqueta: 'Horario', valor: datos.horario || '—' },
        { etiqueta: 'Instructor', valor: datos.instructor || '—' },
      ],
      columnas: columnasDe(modo),
      filas,
    }
  }

  let etiquetaClase = 'Todas'
  if (filtro.claseId !== null) {
    const { data: clase } = await supabase
      .from('clases')
      .select('nombre')
      .eq('id', filtro.claseId)
      .maybeSingle()
    etiquetaClase = clase?.nombre ?? '—'
  }

  const periodos = [...new Set(lista.map((s) => meta.get(s.id)?.periodo ?? ''))]
  const etiquetaPeriodo =
    filtro.periodoId === null ? 'Todos' : periodos[0] || 'Todos'

  return {
    modo,
    alcance: 'global',
    titulo: tituloDe(modo),
    encabezado: [
      { etiqueta: 'Periodo', valor: etiquetaPeriodo },
      { etiqueta: 'Clase', valor: etiquetaClase },
      { etiqueta: 'Secciones', valor: String(lista.length) },
      { etiqueta: 'Alumnos', valor: String(filas.length) },
    ],
    columnas: columnasDe(modo),
    filas,
  }
}

/**
 * Reporte de una sola sección.
 *
 * Devuelve `null` si la sección no existe o no es visible para quien pide: la
 * RLS ya acota a las secciones propias en instructores, así que `null` se
 * convierte en un 404 claro en la ruta.
 */
export async function cargarReporteSeccion(
  seccionId: number,
  modo: ModoReporte
): Promise<Reporte | null> {
  return cargarReporte(
    { seccionId, periodoId: null, claseId: null },
    modo
  )
}

/** Un id de filtro: vacío, 0 o basura equivalen a "sin filtro". */
function idDe(valor: string | null): number | null {
  const numero = Number.parseInt(valor ?? '', 10)
  return Number.isInteger(numero) && numero > 0 ? numero : null
}

/** Filtros que llegan por la URL (descarga del Excel). */
export function filtroDesdeParametros(params: URLSearchParams): FiltroReporte {
  return {
    seccionId: idDe(params.get('seccion')),
    periodoId: idDe(params.get('periodo')),
    claseId: idDe(params.get('clase')),
  }
}

/** Filtros que llegan por el formulario (envío por correo). */
export function filtroDesdeFormData(formData: FormData): FiltroReporte {
  return {
    seccionId: idDe(formData.get('seccion')?.toString() ?? null),
    periodoId: idDe(formData.get('periodo')?.toString() ?? null),
    claseId: idDe(formData.get('clase')?.toString() ?? null),
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
