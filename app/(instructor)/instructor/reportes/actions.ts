'use server'

import { requiereInstructor } from '@/lib/auth'
import { RE_CORREO, enviarPorPowerAutomate } from '@/lib/correo'
import {
  asuntoDe,
  cargarReporteSeccion,
  modoValido,
  reporteAHtml,
} from '@/lib/reportes'
import type { EstadoAccion } from '@/lib/types'

const SIN_PERMISO: EstadoAccion = {
  ok: false,
  error: 'No tienes permiso para hacer esto.',
}

/**
 * Envía el reporte de una sección por Power Automate.
 *
 * El cliente manda tres cosas y nada más: el id de la sección, el modo y el
 * correo del destinatario. El contenido del reporte se vuelve a armar del lado
 * del servidor con `cargarReporteSeccion`, que además está acotado por RLS:
 * una sección ajena regresa `null` y se responde sin permiso, igual que en la
 * descarga.
 */
export async function enviarReporte(
  _previo: EstadoAccion,
  formData: FormData
): Promise<EstadoAccion> {
  const instructor = await requiereInstructor()
  if (!instructor) return SIN_PERMISO

  const seccionId = Number(formData.get('seccion'))
  if (!Number.isInteger(seccionId) || seccionId <= 0) {
    return { ok: false, error: 'Sección no válida.' }
  }

  const modo = modoValido(String(formData.get('modo') ?? ''))
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

  const reporte = await cargarReporteSeccion(seccionId, modo)
  if (!reporte) return SIN_PERMISO

  if (reporte.filas.length === 0) {
    return {
      ok: false,
      error: 'Esta sección no tiene alumnos inscritos, así que no hay nada que enviar.',
    }
  }

  return await enviarPorPowerAutomate({
    destinatario,
    asunto: asuntoDe(reporte),
    cuerpo: reporteAHtml(reporte),
  })
}
