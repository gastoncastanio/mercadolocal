import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Proyecto } from '../types'
import { proyectosAPI } from '../services/api'
import HistorialProyectos from '../components/HistorialProyectos'

export default function Historial() {
  const navigate = useNavigate()
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarProyectos()
  }, [])

  const cargarProyectos = async () => {
    try {
      // TODO: Descomentar cuando el backend esté listo
      // const response = await proyectosAPI.listar()
      // setProyectos(response.data)

      // Por ahora, mostrar proyectos de ejemplo
      setProyectos([])
    } catch (error) {
      console.error('Error al cargar proyectos:', error)
    } finally {
      setCargando(false)
    }
  }

  const handleEliminar = async (id: string) => {
    try {
      await proyectosAPI.eliminar(id)
      setProyectos(proyectos.filter((p) => p._id !== id))
    } catch (error) {
      console.error('Error al eliminar:', error)
      alert('Error al eliminar el proyecto')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-600">MercadoLocal</h1>
          <button
            onClick={() => navigate('/')}
            className="btn btn-secondary"
          >
            ← Volver
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Mis Proyectos
          </h2>
          <p className="text-gray-600">
            Gestiona todos tus proyectos de logos
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <HistorialProyectos
            proyectos={proyectos}
            cargando={cargando}
            onEliminar={handleEliminar}
          />
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/crear')}
            className="btn btn-primary px-8 py-3"
          >
            + Crear Nuevo Logo
          </button>
        </div>
      </div>
    </div>
  )
}
