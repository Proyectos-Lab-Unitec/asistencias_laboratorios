import 'server-only'
import type { EstadoAccion } from '@/lib/types'

/**
 * Envío de correos por Power Automate.
 *
 * Es el mismo mecanismo de proyectoReserva: un POST plano al trigger HTTP del
 * flujo con el payload `{ destinatario, asunto, cuerpo }`, sin librería de
 * correo ni credenciales nuestras — el SMTP lo resuelve el flujo en Power
 * Automate. Por eso acá no hay nodemailer ni Resend.
 *
 * Diferencias con el original, a propósito:
 * - La URL vive en el servidor (`POWERAPPS_URL`, sin prefijo NEXT_PUBLIC_) y
 *   solo se usa desde server actions, así que no se filtra al navegador.
 * - Un fallo se devuelve en vez de solo mandarlo a console: el instructor
 *   tiene que saber que su reporte no salió.
 * - Sin URL configurada no se intenta siquiera: es el equivalente a dejar
 *   VITE_POWERAPPS_URL vacío en proyectoReserva para no mandar correos reales
 *   en desarrollo.
 */

export const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function enviarPorPowerAutomate({
  destinatario,
  asunto,
  cuerpo,
}: {
  destinatario: string
  asunto: string
  cuerpo: string
}): Promise<EstadoAccion> {
  const url = (process.env.POWERAPPS_URL ?? '').trim()

  if (!url) {
    return {
      ok: false,
      error:
        'El envío no está configurado: falta POWERAPPS_URL en .env.local con el enlace del flujo de Power Automate. El reporte se puede descargar igual.',
    }
  }

  let respuesta: Response
  try {
    respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinatario, asunto, cuerpo }),
    })
  } catch (error) {
    return {
      ok: false,
      error: `No se pudo contactar el flujo de Power Automate: ${mensaje(
        error
      )}`,
    }
  }

  if (respuesta.ok) return { ok: true, error: null }

  const detalle = await respuesta.text().catch(() => '')
  return {
    ok: false,
    error: `El flujo de Power Automate respondió HTTP ${respuesta.status}.${
      detalle ? ` ${detalle.slice(0, 300)}` : ''
    }`,
  }
}

function mensaje(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
