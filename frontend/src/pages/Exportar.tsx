import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { logosAPI } from '../services/api'

type Formato = 'png' | 'svg' | 'pdf'

export default function Exportar() {
  const { logoId } = useParams()
  const navigate = useNavigate()
  const [descargando, setDescargando] = useState<Formato | null>(null)
  const [logoUrl, setLogoUrl] = useState<string>(
    'https://via.placeholder.com/400x400/3B82F6/FFFFFF?text=Logo'
  )

  const handleDescargar = async (formato: Formato) => {
    setDescargando(formato)
    try {
      const response = await logosAPI.descargar(logoId || '', formato)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `logo.${formato}`)
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
    } catch (error) {
      console.error('Error al descargar:', error)
      alert('Error al descargar el logo')
    } finally {
      setDescargando(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="btn btn-secondary"
          >
            ← Volver
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Vista previa */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Vista Previa
            </h3>
            <div className="bg-gray-100 rounded-lg p-8 h-64 flex items-center justify-center mb-4">
              <img
                src={logoUrl}
                alt="Logo"
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-gray-600">Tamaño: 400x400px</p>
              <p className="text-gray-600">Formato: PNG</p>
            </div>
          </div>

          {/* Opciones de descarga */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Descargar Logo
            </h3>
            <div className="space-y-4">
              {['png', 'svg', 'pdf'].map((formato) => (
                <button
                  key={formato}
                  onClick={() => handleDescargar(formato as Formato)}
                  disabled={descargando === formato as Formato}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {formato.toUpperCase()}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {formato === 'png' && 'Mejor para web e impresión'}
                        {formato === 'svg' && 'Escalable sin pérdida de calidad'}
                        {formato === 'pdf' && 'Ideal para impresoras profesionales'}
                      </p>
                    </div>
                    <div>
                      {descargando === (formato as Formato) ? (
                        <div className="spinner" />
                      ) : (
                        <span className="text-2xl">↓</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-8 space-y-2">
              <h4 className="font-semibold text-gray-800">
                Recomendaciones
              </h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✓ Descarga en PNG para redes sociales</li>
                <li>✓ Descarga en SVG para ampliaciones</li>
                <li>✓ Descarga en PDF para imprenta</li>
              </ul>
            </div>

            <button
              onClick={() => navigate('/historial')}
              className="w-full btn btn-secondary mt-8"
            >
              Volver a Proyectos
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
