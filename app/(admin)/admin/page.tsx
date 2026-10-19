// El layout redirige si el rol no corresponde (NEXT_REDIRECT), lo que rompe
// la validación de instant navigation. Se opta out de esa validación.
export const instant = false

export default async function AdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">
        Panel de administración
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Gestiona los laboratorios, las cuentas de instructores y genera reportes
        globales.
      </p>
    </div>
  )
}
