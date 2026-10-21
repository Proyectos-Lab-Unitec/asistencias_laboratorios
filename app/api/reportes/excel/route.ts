import { requiereAdmin, requiereInstructor } from '@/lib/auth'
import { construirExcel } from '@/lib/excel'
import { cargarReporteSeccion, modoValido, nombreDeArchivo } from '@/lib/reportes'

/**
 * Descarga del Excel de una sección.
 *
 * Va por route handler y no por server action porque un archivo necesita una
 * respuesta binaria con `Content-Disposition`, que una action no puede
 * devolver. El navegador solo la abre como enlace, sin JS.
 *
 * Quien pide puede ser instructor (de su sección) o admin (de cualquier una):
 * en ambos casos la RLS de `cargarReporteSeccion` hace de límite, así que una
 * sección ajena responde 404 igual que una que no existe.
 */
export async function GET(request: Request) {
  const usuario = (await requiereAdmin()) ?? (await requiereInstructor())
  if (!usuario) {
    return new Response('No autorizado', { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const seccionId = Number(searchParams.get('seccion'))
  if (!Number.isInteger(seccionId) || seccionId <= 0) {
    return new Response('Sección no válida', { status: 400 })
  }

  const modo = modoValido(searchParams.get('modo') ?? '')
  const reporte = await cargarReporteSeccion(seccionId, modo)

  if (!reporte) return new Response('No encontrado', { status: 404 })
  if (reporte.filas.length === 0) {
    return new Response('La sección no tiene alumnos inscritos', { status: 400 })
  }

  const buffer = await construirExcel(reporte)

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreDeArchivo(
        reporte
      )}"`,
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'no-store',
    },
  })
}
