import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Logo } from '../types'
import EditorLogos from '../components/EditorLogos'

export default function Editor() {
  const { logoId } = useParams()
  const navigate = useNavigate()
  const [logo, setLogo] = useState<Logo | null>(null)
  const [guardando, setGuardando] = useState(false)

  const handleGuardar = async (cambios: Partial<Logo>) => {
    setGuardando(true)
    try {
      // TODO: Llamar a API para guardar
      setTimeout(() => {
        alert('Cambios guardados')
        navigate(-1)
      }, 1000)
    } catch (error) {
      console.error('Error al guardar:', error)
      alert('Error al guardar los cambios')
    } finally {
      setGuardando(false)
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
        <div className="bg-white rounded-xl shadow-lg p-8">
          {logo ? (
            <EditorLogos logo={logo} onGuardar={handleGuardar} />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">Cargando editor...</p>
              <div className="spinner mx-auto" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
