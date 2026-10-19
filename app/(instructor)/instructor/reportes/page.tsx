// El layout redirige si el rol no corresponde (NEXT_REDIRECT), lo que rompe
// la validación de instant navigation. Se opta out de esa validación.
export const instant = false

export default async function InstructorReportesPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Reportes</h1>
      <p className="mt-2 text-sm text-gray-500">
        Genera el reporte de una sección, prévisualízalo y envíalo por correo.
      </p>
    </div>
  )
}
