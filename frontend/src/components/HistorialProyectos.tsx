import { Proyecto } from '../types'
import { useNavigate } from 'react-router-dom'

interface HistorialProyectosProps {
  proyectos: Proyecto[];
  cargando?: boolean;
  onEliminar?: (id: string) => void;
}

export default function HistorialProyectos({
  proyectos,
  cargando = false,
  onEliminar,
}: HistorialProyectosProps) {
  const navigate = useNavigate()

  if (cargando) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="spinner" />
      </div>
    )
  }

  if (proyectos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Aún no tienes proyectos</p>
        <button
          onClick={() => navigate('/crear')}
          className="btn btn-primary"
        >
          Crear primer proyecto
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {proyectos.map((proyecto) => (
        <div
          key={proyecto._id}
          className="card p-6 flex items-start justify-between"
        >
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900">{proyecto.nombreMarca}</h4>
            <p className="text-sm text-gray-600 mb-2">{proyecto.descripcion}</p>
            <div className="flex gap-2 flex-wrap">
              {proyecto.valores.slice(0, 3).map((valor, i) => (
                <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {valor}
                </span>
              ))}
              {proyecto.valores.length > 3 && (
                <span className="text-xs text-gray-500">+{proyecto.valores.length - 3}</span>
              )}
            </div>
          </div>

          <div className="flex gap-2 ml-4">
            <button
              onClick={() => navigate(`/galeria/${proyecto._id}`)}
              className="btn btn-primary"
            >
              Ver Logos
            </button>
            <button
              onClick={() => {
                if (confirm('¿Eliminar este proyecto?')) {
                  onEliminar?.(proyecto._id || '')
                }
              }}
              className="btn bg-red-50 text-red-600 hover:bg-red-100"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
