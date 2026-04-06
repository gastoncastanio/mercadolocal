import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FormularioMarca from '../components/FormularioMarca'
import SelectorEstilo from '../components/SelectorEstilo'
import PersonalizadorEstilo from '../components/PersonalizadorEstilo'
import { Proyecto, EstiloPredefinido, ParametrosPersonalizacion } from '../types'
import { logosAPI } from '../services/api'

type Paso = 'formulario' | 'estilo' | 'personalizar'

export default function Crear() {
  const navigate = useNavigate()
  const [paso, setPaso] = useState<Paso>('formulario')
  const [proyecto, setProyecto] = useState<Partial<Proyecto>>({})
  const [estiloSeleccionado, setEstiloSeleccionado] = useState<EstiloPredefinido>('moderno')
  const [generando, setGenerando] = useState(false)

  const handleFormulario = (datos: Partial<Proyecto>) => {
    setProyecto(datos)
    setPaso('estilo')
  }

  const handleEstilo = (estilo: EstiloPredefinido) => {
    setEstiloSeleccionado(estilo)
    setPaso('personalizar')
  }

  const handlePersonalizar = async (parametros: ParametrosPersonalizacion) => {
    setGenerando(true)
    try {
      const response = await logosAPI.generarLogos({
        nombreMarca: proyecto.nombreMarca!,
        descripcion: proyecto.descripcion!,
        valores: proyecto.valores || [],
        estilo: estiloSeleccionado,
        parametros,
        cantidadLogos: 12,
      })

      // Guardar el proyecto con los logos generados
      setProyecto({
        ...proyecto,
        estilo: estiloSeleccionado,
        parametros,
        logos: response.data,
      })

      // Redirigir a galería
      navigate('/galeria/temp', { state: { proyecto: { ...proyecto, estilo: estiloSeleccionado, parametros, logos: response.data } } })
    } catch (error) {
      console.error('Error al generar logos:', error)
      alert('Error al generar logos. Intenta de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
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

      {/* Progreso */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {(['formulario', 'estilo', 'personalizar'] as const).map((p, i) => (
              <div key={p} className="flex items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    paso === p || (i < (['formulario', 'estilo', 'personalizar'] as const).indexOf(paso))
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {i + 1}
                </div>
                {i < 2 && <div className="flex-1 h-1 mx-2 bg-gray-200" />}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm text-gray-600 mt-2">
            <span>Tu Marca</span>
            <span>Elige Estilo</span>
            <span>Personaliza</span>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {paso === 'formulario' && (
            <FormularioMarca onSubmit={handleFormulario} loading={generando} />
          )}

          {paso === 'estilo' && (
            <div className="space-y-6">
              <SelectorEstilo
                onSelect={handleEstilo}
                estiloSeleccionado={estiloSeleccionado}
              />
              <button
                onClick={() => setPaso('formulario')}
                className="w-full btn btn-secondary"
              >
                ← Atrás
              </button>
            </div>
          )}

          {paso === 'personalizar' && (
            <div className="space-y-6">
              <PersonalizadorEstilo
                parametrosIniciales={{
                  coloresPrimarios: ['#000000', '#FFFFFF'],
                  complejidad: 'medio',
                  orientacion: 'cuadrado',
                }}
                onPersonalizar={handlePersonalizar}
              />
              <button
                onClick={() => setPaso('estilo')}
                className="w-full btn btn-secondary"
                disabled={generando}
              >
                ← Atrás
              </button>
            </div>
          )}

          {generando && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="spinner" />
              </div>
              <p className="text-center text-gray-600">
                Generando tus logos... esto puede tomar unos momentos
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
