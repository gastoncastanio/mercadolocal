import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function SolicitudServicioPage() {
  const { profesionalId } = useParams<{ profesionalId: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [rubro, setRubro] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [zona, setZona] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const rubros = ['sanitarios', 'electricista', 'gasista', 'carpintero', 'plomero', 'pintor', 'limpieza', 'otros']

  async function enviarSolicitud(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!rubro || !descripcion || !zona) {
      setError('Completa todos los campos')
      return
    }

    setEnviando(true)
    try {
      await api.post('/servicios/solicitud', {
        profesionalId,
        rubro,
        descripcion,
        zona
      })

      // Redirigir a chat o mensajes
      navigate('/mensajes')
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al enviar solicitud')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="text-white/80 hover:text-white mb-6 flex items-center gap-2"
          >
            ← Volver
          </button>
          <h1 className="text-3xl font-extrabold">Solicitar Cotización</h1>
        </div>
      </div>

      {/* Formulario */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-8">
          <form onSubmit={enviarSolicitud} className="space-y-6">
            {/* Rubro */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">
                Rubro de servicio
              </label>
              <select
                value={rubro}
                onChange={(e) => setRubro(e.target.value)}
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
              >
                <option value="">Selecciona un rubro</option>
                {rubros.map(r => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">
                Describe tu necesidad
              </label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Necesito reparar una llave que gotea en la cocina..."
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet h-32"
              />
            </div>

            {/* Zona */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">
                Zona o localidad
              </label>
              <input
                type="text"
                value={zona}
                onChange={(e) => setZona(e.target.value)}
                placeholder="Ej: Centro, Zona norte, Casco"
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </p>
            )}

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-ml-soft">
              <p className="mb-2">✓ El profesional recibirá tu solicitud</p>
              <p className="mb-2">✓ Podrá enviarte una cotización</p>
              <p>✓ Una vez aceptada, podrás chatear directamente</p>
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 py-3 bg-white border border-ml-line rounded-lg font-bold text-ml-soft hover:bg-ml-bg transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviando}
                className="flex-1 py-3 mlbtn ml-grad text-white rounded-lg font-bold disabled:opacity-60"
              >
                {enviando ? 'Enviando...' : 'Enviar Solicitud'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
