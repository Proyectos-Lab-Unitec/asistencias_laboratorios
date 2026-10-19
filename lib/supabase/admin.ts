import 'server-only'
import { createClient as crearSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente con la service role key: salta el RLS.
 *
 * SOLO se usa en server actions y únicamente después de verificar que quien
 * llama es un admin activo. El import 'server-only' hace que el bundler del
 * cliente falle si alguien lo importa en un componente del navegador.
 */
export function createAdminClient() {
  return crearSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  )
}
