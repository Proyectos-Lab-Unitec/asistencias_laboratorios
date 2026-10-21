import { celdasDe, nombreDeArchivo, type Reporte } from '@/lib/reportes'

const CLASE_BOTON =
  'inline-flex items-center gap-1.5 rounded-lg bg-[#06065c] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0f49b6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#06065c]'

/**
 * Preview de un reporte: bloque de título, tabla y descarga.
 *
 * Lo comparten el instructor (su sección) y el admin (global o por sección).
 * Muestra exactamente lo mismo que sale en el Excel porque las dos cosas salen
 * de `celdasDe`, no de dos maquetados distintos.
 */
export default function VistaReporte({
  reporte,
  descarga,
}: {
  reporte: Reporte
  /** URL del route handler que genera el .xlsx con estos mismos filtros. */
  descarga: string
}) {
  const vacio = reporte.filas.length === 0

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#06065c]">{reporte.titulo}</h2>
          <dl className="mt-2 grid gap-x-8 gap-y-1 text-sm text-gray-700 sm:grid-cols-2">
            {reporte.encabezado.map((dato) => (
              <div key={dato.etiqueta} className="flex gap-1.5">
                <dt className="font-semibold text-[#06065c]">
                  {dato.etiqueta}:
                </dt>
                <dd>{dato.valor}</dd>
              </div>
            ))}
          </dl>
        </div>

        {vacio ? (
          <span
            aria-disabled
            className={`${CLASE_BOTON} cursor-not-allowed opacity-45`}
          >
            Descargar Excel
          </span>
        ) : (
          <a href={descarga} download className={CLASE_BOTON}>
            Descargar Excel
            <span className="sr-only"> — {nombreDeArchivo(reporte)}</span>
          </a>
        )}
      </div>

      {vacio ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Con estos filtros no hay alumnos inscritos, así que el reporte sale
          vacío.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#06065c] text-white">
                {reporte.columnas.map((columna) => (
                  <th
                    key={columna}
                    scope="col"
                    className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide"
                  >
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reporte.filas.map((fila, i) => (
                <tr key={`${fila.numero_cuenta}-${i}`} className={i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                  {celdasDe(fila, reporte.modo).map((celda, j) => (
                    <td
                      key={j}
                      className="border-t border-gray-100 px-3 py-2 text-gray-900"
                    >
                      {celda === '' ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        celda
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
