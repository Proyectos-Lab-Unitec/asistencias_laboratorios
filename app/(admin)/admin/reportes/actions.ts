'use server'

import { requiereAdmin } from '@/lib/auth'
import { RE_CORREO, enviarPorPowerAutomate } from '@/lib/correo'
import {
  asuntoDe,
  cargarReporte,
  filtroDesdeFormData,
  modoValido,
  reporteAHtml,
} from '@/lib/reportes'
import type { EstadoAccion } from '@/lib/types'

const SIN_PERMISO: EstadoAccion = {
  ok: false,
  error: 'No tienes permiso para hacer esto.',
}

/**
 * Envía por correo el reporte del admin, global o de una sección.
 *
 * Igual que el del instructor: el cliente manda los filtros y el destinatario,
 * y el contenido se vuelve a armar acá con `cargarReporte`, así que el
 * navegador nunca decide qué tabla viaja.
 */
export async function enviarReporteAdmin(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const admin = await requiereAdmin()
  if (!admin) return SIN_PERMISO

  const destinatario = String(formData.get('destinatario') ?? '').trim()

  if (!destinatario) {
    return { ok: false, error: 'El correo del destinatario es obligatorio.' }
  }
  if (destinatario.length > 254) {
    return { ok: false, error: 'El correo es demasiado largo.' }
  }
  if (!RE_CORREO.test(destinatario)) {
    return { ok: false, error: 'El correo no tiene un formato válido.' }
  }

  const modo = modoValido(String(formData.get('modo') ?? ''))
  const reporte = await cargarReporte(filtroDesdeFormData(formData), modo)

  if (!reporte) {
    return { ok: false, error: 'No hay secciones para esos filtros.' }
  }
  if (reporte.filas.length === 0) {
    return {
      ok: false,
      error:
        'El reporte no tiene alumnos con esos filtros, así que no hay nada que enviar.',
    }
  }

  return await enviarPorPowerAutomate({
    destinatario,
    asunto: asuntoDe(reporte),
    cuerpo: reporteAHtml(reporte),
  })
}
