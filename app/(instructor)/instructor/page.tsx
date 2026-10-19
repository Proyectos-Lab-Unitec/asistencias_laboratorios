// El layout redirige si el rol no corresponde (NEXT_REDIRECT), lo que rompe
// la validación de instant navigation. Se opta out de esa validación.
export const instant = false

export default async function InstructorPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Mis secciones</h1>
      <p className="mt-2 text-sm text-gray-500">
        Aquí crearás tus secciones de laboratorio y gestionarás su registro,
        asistencia y notas.
      </p>
    </div>
  )
}
