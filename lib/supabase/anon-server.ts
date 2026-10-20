import { createClient as crearClienteSupabase } from '@supabase/supabase-js'
import 'server-only'

/**
 * Cliente Supabase SIN sesión, para la ruta pública /registro/[token].
 *
 * Los RPC `get_seccion_by_token` y `registrar_alumno` están revocados de
 * `authenticated` y concedidos únicamente a `anon`. Si acá usáramos el cliente
 * con cookies, un instructor o admin que abra el enlace del QR recibiría un
 * error de permisos: su sesión los haría ejecutar como `authenticated`. Este
 * cliente no lleva JWT de usuario, así que siempre resuelve como anon, tanto
 * para un alumno como para el propio docente.
 */
export function crearClienteAnon() {
  return crearClienteSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
