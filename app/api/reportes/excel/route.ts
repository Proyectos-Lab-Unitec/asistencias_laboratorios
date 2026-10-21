import { requiereUsuario } from '@/lib/auth'
import { construirExcel } from '@/lib/excel'
import {
  cargarReporte,
  filtroDesdeParametros,
  modoValido,
  nombreDeArchivo,
} from '@/lib/reportes'

/**
 * Descarga del Excel.
 *
 * Acepta los dos ámbitos con los mismos parámetros que la pantalla:
 * `?seccion=4` para una sección y `?periodo=1&clase=2` para el global. Va por
 * route handler y no por server action porque un archivo necesita una
 * respuesta binaria con `Content-Disposition`, que una action no puede
 * devolver; el navegador solo la abre como enlace, sin JS.
 *
 * Quien pide puede ser instructor (de su sección) o admin (de cualquiera): en
 * ambos casos la RLS de `cargarReporte` hace de límite, así que una sección
 * ajena responde 404 igual que una que no existe.
 */
export async function GET(request: Request) {
  const usuario = await requiereUsuario()
  if (!usuario) {
    return new Response('No autorizado', { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const modo = modoValido(searchParams.get('modo') ?? '')
  const reporte = await cargarReporte(filtroDesdeParametros(searchParams), modo)

  if (!reporte) return new Response('No encontrado', { status: 404 })
  if (reporte.filas.length === 0) {
    return new Response('El reporte no tiene alumnos con esos filtros', {
      status: 400,
    })
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
