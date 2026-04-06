import { Logo } from '../types'
import { useNavigate } from 'react-router-dom'

interface GaleriaLogosProps {
  logos: Logo[];
  onMarcarFavorito?: (logoId: string, favorito: boolean) => void;
  cargando?: boolean;
}

export default function GaleriaLogos({
  logos,
  onMarcarFavorito,
  cargando = false,
}: GaleriaLogosProps) {
  const navigate = useNavigate()

  if (cargando) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="spinner" />
      </div>
    )
  }

  if (logos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No hay logos generados aún</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">
        Logos Generados ({logos.length})
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {logos.map((logo, index) => (
          <div
            key={logo._id || index}
            className="card-lg overflow-hidden hover:scale-105 transition-transform"
          >
            <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
              <img
                src={logo.url}
                alt={`Logo ${index + 1}`}
                className="w-full h-full object-contain p-4"
              />
            </div>

            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/editor/${logo._id}`)}
                  className="flex-1 btn btn-primary text-sm"
                >
                  Editar
                </button>
                <button
                  onClick={() =>
                    onMarcarFavorito?.(logo._id || '', !logo.favorito)
                  }
                  className={`px-4 btn text-lg ${
                    logo.favorito
                      ? 'bg-yellow-50 text-yellow-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  ★
                </button>
              </div>

              <button
                onClick={() => navigate(`/exportar/${logo._id}`)}
                className="w-full btn btn-outline text-sm"
              >
                Descargar
              </button>

              <p className="text-xs text-gray-500">
                Estilo: <span className="capitalize">{logo.estilo}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
