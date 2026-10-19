// El layout redirige si el rol no corresponde (NEXT_REDIRECT), lo que rompe
// la validación de instant navigation. Se opta out de esa validación.
export const instant = false

export default async function AdminReportesPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Reportes</h1>
      <p className="mt-2 text-sm text-gray-500">
        Genera reportes globales o por sección, del trimestre actual o de todos.
      </p>
    </div>
  )
}
