'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Si la llamada a autenticación no responde, cortamos para no dejar el botón
// clavado en "Iniciando..." para siempre.
const TIMEOUT_MS = 20_000

async function conTimeout<T>(
  promesa: PromiseLike<T>,
  ms: number = TIMEOUT_MS
): Promise<T> {
  // Los builders de Postgrest (p. ej. .single()) son thenables pero no
  // Promise, así que los normalizamos antes de la carrera.
  const promesaReal = Promise.resolve(promesa)

  let timer: ReturnType<typeof setTimeout> | undefined

  const expira = new Promise<never>((_ok, ko) => {
    timer = setTimeout(
      () =>
        ko(
          new Error(
            'El servidor de autenticación no responde. Intenta nuevamente.'
          )
        ),
      ms
    )
  })

  // Evita un "unhandled rejection" si la promesa pierde la carrera y falla
  // después de que ya devolvimos el timeout.
  promesaReal.catch(() => {})

  try {
    return await Promise.race([promesaReal, expira])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export default function LoginPage() {
  const router = useRouter()
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')

  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (loginLoading) return

    setLoginLoading(true)
    setAlertMessage('')

    try {
      const supabase = createClient()

      const { data: sesion, error: loginError } = await conTimeout(
        supabase.auth.signInWithPassword({
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword,
        })
      )

      if (loginError) throw loginError

      const { data: perfil, error: perfilError } = await conTimeout(
        supabase
          .from('perfiles')
          .select('rol, activo')
          .eq('id', sesion.user.id)
          .single()
      )

      if (perfilError) throw perfilError

      if (!perfil.activo) {
        throw new Error('Tu cuenta está desactivada. Contacta al administrador.')
      }

      if (perfil.rol !== 'admin' && perfil.rol !== 'instructor') {
        throw new Error('Tu cuenta no tiene permisos para acceder.')
      }

      setLoginPassword('')
      router.push(perfil.rol === 'admin' ? '/admin' : '/instructor')
      router.refresh()
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Error al iniciar sesión.'
      setAlertMessage(
        msg.includes('Invalid login credentials')
          ? 'Correo o contraseña incorrectos.'
          : msg
      )

      // Limpieza best-effort de una sesión a medias. Va con timeout corto:
      // si esta llamada se colgara, el finally de abajo nunca se ejecutaría
      // y el botón volvería a quedarse clavado.
      try {
        await conTimeout(createClient().auth.signOut(), 5_000)
      } catch {
        // se ignora: lo importante es que el botón quede habilitado
      }
    } finally {
      // SIEMPRE se reinicia, incluso si el catch lanza. Sin esto el botón
      // queda en "Iniciando..." y el guard de arriba bloquea todo lo demás.
      setLoginLoading(false)
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-[#07065d] bg-cover bg-center px-4"
      style={{ backgroundImage: 'url(/fondo2.webp)' }}
    >
      <h1 className="mb-8 text-center text-6xl font-extrabold leading-tight text-white shadow-lg">
        Asistencias de Laboratorio
      </h1>
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h2 className="mb-6 text-center text-2xl font-bold text-gray-800">
          Acceso Personal
        </h2>
        <p className="mb-6 text-center text-gray-600">
          Ingresa tus credenciales para gestionar tus laboratorios.
        </p>
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <input
            type="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            placeholder="Correo electrónico"
            disabled={loginLoading}
            className="w-full rounded-lg border text-black border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-[#06065c]"
          />
          <input
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            placeholder="Contraseña"
            disabled={loginLoading}
            className="w-full rounded-lg border text-black border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-[#06065c]"
          />
          <button
            type="submit"
            disabled={loginLoading}
            className="w-full rounded-lg bg-[#06065c] py-3 text-lg text-white transition-all duration-300 hover:bg-[#0f49b6] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loginLoading ? 'Iniciando...' : 'Iniciar sesión'}
          </button>
        </form>
        {alertMessage && (
          <p className="mt-4 text-center text-sm text-red-600">{alertMessage}</p>
        )}
      </div>
    </div>
  )
}
