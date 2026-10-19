'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  FiMenu,
  FiLogOut,
  FiX,
  FiLayout,
  FiBox,
  FiUsers,
  FiFileText,
} from 'react-icons/fi'
import type { IconType } from 'react-icons'
import { createClient } from '@/lib/supabase/client'

// Mapa de iconos: los layouts pasan solo el nombre (serializable),
// y acá lo resolvemos al componente real. No cruzamos funciones
// de servidor a cliente.
const ICONOS = {
  layout: FiLayout,
  box: FiBox,
  users: FiUsers,
  file: FiFileText,
} as const

export type NombreIcono = keyof typeof ICONOS

export type NavItem = {
  href: string
  label: string
  icon: NombreIcono
  end?: boolean
}

type Perfil = {
  nombre: string
  correo: string
  rol: string
  created_at?: string | null
}

export function DashboardShell({
  titulo,
  perfil,
  navItems,
  children,
}: {
  titulo: string
  perfil: Perfil
  navItems: NavItem[]
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [colapsado, setColapsado] = useState(true)
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false)
  const [perfilAbierto, setPerfilAbierto] = useState(false)

  const cerrarSesion = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const claseTexto = (contraido: boolean) =>
    `overflow-hidden whitespace-nowrap transition-[width,opacity] duration-300 ${
      contraido ? 'w-0 opacity-0' : 'w-auto opacity-100'
    }`

  const estilosEnlace = (activo: boolean) =>
    `flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors ${
      activo
        ? 'bg-white/15 text-white'
        : 'text-white/75 hover:bg-white/10 hover:text-white'
    }`

  const sidebarContenido = (contraido: boolean) => (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/UT2.png"
            alt="Logo"
            className="h-10 w-10 shrink-0 rounded-lg object-cover"
          />
          <div className="min-w-0">
            <p
              className={`truncate text-lg font-bold text-white ${claseTexto(
                contraido
              )}`}
            >
              {titulo}
            </p>
            <p
              className={`truncate text-xs text-white/60 ${claseTexto(contraido)}`}
            >
              Asistencias de Laboratorio
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMenuMovilAbierto(false)}
          className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white md:hidden"
          aria-label="Cerrar menú"
        >
          <FiX size={20} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => {
          const activo = item.end
            ? pathname === item.href
            : pathname.startsWith(item.href)
          const Icono = ICONOS[item.icon]
          return (
            <Link
              key={item.href}
              href={item.href}
              className={estilosEnlace(activo)}
              title={contraido ? item.label : undefined}
              onClick={() => setMenuMovilAbierto(false)}
            >
              <Icono size={20} className="shrink-0" />
              <span className={`truncate ${claseTexto(contraido)}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      <div className="space-y-1 border-t border-white/10 px-3 py-3">
        <button
          type="button"
          onClick={() => setPerfilAbierto(true)}
          className="flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
          title={contraido ? perfil.nombre || perfil.correo : undefined}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white">
            {perfil.nombre
              ? perfil.nombre
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join('')
                  .toUpperCase()
              : (perfil.correo || 'U').slice(0, 2).toUpperCase()}
          </span>
          <span
            className={`flex min-w-0 flex-col items-start text-left ${
              contraido ? 'w-0 overflow-hidden' : ''
            }`}
          >
            <span
              className={`truncate text-sm font-medium text-white ${claseTexto(
                contraido
              )}`}
            >
              {perfil.nombre || 'Mi perfil'}
            </span>
            <span
              className={`truncate text-xs text-white/60 ${claseTexto(contraido)}`}
            >
              {perfil.correo}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={cerrarSesion}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 hover:text-red-100"
          title={contraido ? 'Cerrar sesión' : undefined}
        >
          <FiLogOut size={20} className="shrink-0" />
          <span className={`truncate ${claseTexto(contraido)}`}>
            Cerrar sesión
          </span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Espaciador que reserva el ancho del sidebar contraído */}
      <div className="hidden w-16 shrink-0 md:block" />

      {/* Sidebar escritorio (se expande al hover) */}
      <aside
        onMouseEnter={() => setColapsado(false)}
        onMouseLeave={() => setColapsado(true)}
        className={`fixed inset-y-0 left-0 z-40 hidden overflow-y-auto bg-[#06065c] transition-all duration-300 md:block ${
          colapsado ? 'w-16' : 'w-64'
        }`}
      >
        {sidebarContenido(colapsado)}
      </aside>

      {/* Drawer móvil */}
      <AnimatePresence>
        {menuMovilAbierto && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuMovilAbierto(false)}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 w-64 bg-[#06065c] md:hidden"
            >
              {sidebarContenido(false)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Barra superior móvil */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center gap-3 bg-[#0f49b6] px-3 py-3 text-white md:hidden">
        <button
          type="button"
          onClick={() => setMenuMovilAbierto(true)}
          className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
          aria-label="Abrir menú"
        >
          <FiMenu size={22} />
        </button>
        <span className="text-sm font-semibold">{titulo}</span>
      </div>

      {/* Contenido */}
      <main className="flex-1 overflow-x-hidden px-4 pb-8 pt-16 md:pt-0">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>

      {/* Modal de perfil */}
      <AnimatePresence>
        {perfilAbierto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setPerfilAbierto(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Mi perfil</h2>
                <button
                  type="button"
                  onClick={() => setPerfilAbierto(false)}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Cerrar modal de perfil"
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Nombre
                  </p>
                  <p className="mt-1 text-gray-800">{perfil.nombre || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Correo
                  </p>
                  <p className="mt-1 break-words text-gray-800">
                    {perfil.correo || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Rol
                  </p>
                  <p className="mt-1 capitalize text-gray-800">{perfil.rol}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Miembro desde
                  </p>
                  <p className="mt-1 text-gray-800">
                    {perfil.created_at
                      ? new Date(perfil.created_at).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : '—'}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
