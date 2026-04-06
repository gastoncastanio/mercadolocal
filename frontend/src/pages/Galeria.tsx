import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Proyecto } from '../types'
import GaleriaLogos from '../components/GaleriaLogos'

export default function Galeria() {
  const { projectId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [proyecto, setProyecto] = useState<Proyecto | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    // Si viene del flujo de creación
    if (location.state?.proyecto) {
      setProyecto(location.state.proyecto)
      setCargando(false)
    }
  }, [location])

  if (cargando) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="spinner" />
      </div>
    )
  }

  if (!proyecto) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Proyecto no encontrado</p>
          <button
            onClick={() => navigate('/')}
            className="btn btn-primary"
          >
            Volver a Inicio
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-blue-600">MercadoLocal</h1>
            <p className="text-sm text-gray-600">{proyecto.nombreMarca}</p>
          </div>
          <button
            onClick={() => navigate('/historial')}
            className="btn btn-secondary"
          >
            ← Volver
          </button>
        </div>
      </header>

      {/* Info del Proyecto */}
      <section className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {proyecto.nombreMarca}
          </h2>
          <p className="text-gray-600 mb-4">{proyecto.descripcion}</p>
          <div className="flex flex-wrap gap-2">
            {proyecto.valores?.map((valor, i) => (
              <span key={i} className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                {valor}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Galería de Logos */}
      <section className="container mx-auto px-4 py-12">
        <GaleriaLogos
          logos={proyecto.logos || []}
          cargando={false}
          onMarcarFavorito={(logoId, favorito) => {
            console.log('Marcar favorito:', logoId, favorito)
          }}
        />
      </section>

      {/* Acciones */}
      <section className="container mx-auto px-4 py-8 flex gap-4 justify-center">
        <button
          onClick={() => navigate('/crear')}
          className="btn btn-primary"
        >
          Crear Otro Logo
        </button>
        <button
          onClick={() => navigate('/')}
          className="btn btn-secondary"
        >
          Ir a Inicio
        </button>
      </section>
    </div>
  )
}
