// El layout redirige si el rol no corresponde (NEXT_REDIRECT), lo que rompe
// la validación de instant navigation. Se opta out de esa validación.
export const instant = false

export default async function InstructoresPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Instructores</h1>
      <p className="mt-2 text-sm text-gray-500">
        Aquí se crearán y administrarán las cuentas de los instructores.
      </p>
    </div>
  )
}
