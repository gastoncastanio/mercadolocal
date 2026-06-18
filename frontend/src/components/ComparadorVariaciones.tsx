import { Logo } from '../types'

interface ComparadorVariacionesProps {
  logoOriginal: Logo;
  variaciones: Logo[];
  onSeleccionar?: (logo: Logo) => void;
}

export default function ComparadorVariaciones({
  logoOriginal,
  variaciones,
  onSeleccionar,
}: ComparadorVariacionesProps) {
  if (variaciones.length === 0) {
    return (
      <div className="text-center py-8 text-ml-muted">
        No hay variaciones disponibles
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-ml-ink">
        Variaciones ({variaciones.length})
      </h3>

      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-ml-ink mb-2">Original</p>
          <div className="bg-ml-bg rounded-lg p-4 h-48 flex items-center justify-center">
            <img
              src={logoOriginal.url}
              alt="Logo original"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-ml-ink mb-2">Variaciones</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {variaciones.map((variacion, index) => (
              <button
                key={index}
                onClick={() => onSeleccionar?.(variacion)}
                className="bg-ml-bg rounded-lg p-3 h-40 flex items-center justify-center hover:ring-2 hover:ring-blue-500 transition"
              >
                <img
                  src={variacion.url}
                  alt={`Variación ${index + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
