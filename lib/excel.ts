import 'server-only'
import ExcelJS from 'exceljs'
import { celdasDe, type Reporte } from '@/lib/reportes'

const AZUL = 'FF06065C'
const GRIS_BORDE = 'FFBFBFBF'

/**
 * Genera el `.xlsx` de un reporte.
 *
 * El bloque de título ocupa las primeras filas y las columnas recién arrancan
 * después: ese es el requisito de la spec (el periodo y los datos de la
 * sección van en la cabecera, no repetidos en cada fila de datos).
 *
 * El título y los renglones del encabezado van con celdas combinadas para que
 * el texto no se corte aunque la columna debajo sea angosta.
 */
export async function construirExcel(reporte: Reporte): Promise<Buffer> {
  const libro = new ExcelJS.Workbook()
  const hoja = libro.addWorksheet(
    reporte.modo === 'notas' ? 'Notas' : 'Asistencia'
  )

  const anchoTotal = reporte.columnas.length
  const mitad = Math.max(1, Math.floor(anchoTotal / 2))

  // ---------- Bloque de título ----------
  hoja.mergeCells(1, 1, 1, anchoTotal)
  const titulo = hoja.getCell(1, 1)
  titulo.value = reporte.titulo
  titulo.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
  titulo.alignment = { horizontal: 'center', vertical: 'middle' }
  hoja.getRow(1).height = 26

  // Dos datos por renglón mientras alcance el ancho; el que sobra va solo.
  const renglones: { izquierda: number; derecha: number | null }[] = []
  for (let i = 0; i < reporte.encabezado.length; i += 2) {
    renglones.push({
      izquierda: i,
      derecha: i + 1 < reporte.encabezado.length ? i + 1 : null,
    })
  }

  renglones.forEach((renglon, indice) => {
    const fila = indice + 2
    // El rango se define una sola vez: combinar dos veces la misma fila deja
    // el archivo ilegible y hace fallar la generación.
    if (renglon.derecha !== null) {
      escribirPar(hoja, fila, 1, mitad, reporte.encabezado[renglon.izquierda])
      escribirPar(
        hoja,
        fila,
        mitad + 1,
        anchoTotal,
        reporte.encabezado[renglon.derecha]
      )
    } else {
      escribirPar(hoja, fila, 1, anchoTotal, reporte.encabezado[renglon.izquierda])
    }
    hoja.getRow(fila).height = 18
  })

  // ---------- Encabezado de columnas ----------
  const filaColumnas = renglones.length + 3 // +1 de título, +1 de fila en blanco
  const celdasPorFila = reporte.filas.map((f) => celdasDe(f, reporte.modo))

  const renglonColumnas = hoja.getRow(filaColumnas)
  reporte.columnas.forEach((columna, i) => {
    const celda = renglonColumnas.getCell(i + 1)
    celda.value = columna
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
    celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    celda.border = borde()
  })
  renglonColumnas.height = 30

  // ---------- Filas de datos ----------
  celdasPorFila.forEach((celdas, indice) => {
    const renglon = hoja.getRow(filaColumnas + 1 + indice)
    celdas.forEach((valor, i) => {
      const celda = renglon.getCell(i + 1)
      celda.value = valor === '' ? null : valor
      celda.border = borde()
      celda.alignment = { vertical: 'middle' }
      // Los números (cuenta, porcentajes) van pegados a la derecha; los textos,
      // a la izquierda, que es como se lee un padrón.
      celda.alignment = {
        vertical: 'middle',
        horizontal: i === 1 ? 'center' : 'left',
      }
    })
    if (indice % 2 === 1) {
      renglon.eachCell((celda) => {
        celda.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F5FB' },
        }
      })
    }
  })

  // ---------- Anchos, filtros y panel congelado ----------
  reporte.columnas.forEach((columna, i) => {
    let largo = columna.length
    for (const celdas of celdasPorFila) {
      largo = Math.max(largo, (celdas[i] ?? '').length)
    }
    hoja.getColumn(i + 1).width = Math.min(46, Math.max(12, largo + 3))
  })

  if (reporte.filas.length > 0) {
    hoja.autoFilter = {
      from: { row: filaColumnas, column: 1 },
      to: { row: filaColumnas + celdasPorFila.length, column: anchoTotal },
    }
  }

  hoja.views = [{ state: 'frozen', ySplit: filaColumnas, xSplit: 1 }]

  const salida: unknown = await libro.xlsx.writeBuffer()
  return Buffer.from(salida as Uint8Array)
}

function escribirPar(
  hoja: ExcelJS.Worksheet,
  fila: number,
  desde: number,
  hasta: number,
  dato: { etiqueta: string; valor: string }
) {
  hoja.mergeCells(fila, desde, fila, hasta)
  const celda = hoja.getCell(fila, desde)
  // Rich text: la etiqueta en negrita y el valor normal, como se ve en el
  // mock de la spec.
  celda.value = {
    richText: [
      { text: `${dato.etiqueta}: `, font: { bold: true } },
      { text: dato.valor },
    ],
  }
  celda.alignment = { vertical: 'middle' }
}

function borde(): Partial<ExcelJS.Borders> {
  const trazo: Partial<ExcelJS.Border> = {
    style: 'thin',
    color: { argb: GRIS_BORDE },
  }
  return { top: trazo, left: trazo, bottom: trazo, right: trazo }
}
