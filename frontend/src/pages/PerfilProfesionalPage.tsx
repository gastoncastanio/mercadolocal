import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

interface Perfil {
  _id: string
  usuarioId: string
  rubro: string
  descripcion: string
  localidad: string
  zonasCobertura: string[]
  verificado: boolean
  calificacion: number
  totalTrabajos: number
  conteoResenas: number
  media?: { fotos: string[]; logo: string }
  activo: boolean
}

interface Resena {
  _id: string
  clienteId: { nombre: string; avatar: string }
  calificacion: number
  comentario: string
  respuestaProfesional: string
  createdAt: string
}

export default function PerfilProfesionalPage() {
  const { usuarioId } = useParams<{ usuarioId: string }>()
  const navigate = useNavigate()
  const { estaLogueado } = useAuth()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [resenas, setResenas] = useState<Resena[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (usuarioId) cargarPerfil()
  }, [usuarioId])

  async function cargarPerfil() {
    setCargando(true)
    setError('')
    try {
      const [perfilRes, resenasRes] = await Promise.all([
        api.get(`/servicios/perfil/${usuarioId}`),
        api.get(`/servicios/resenas/${usuarioId}`)
      ])
      setPerfil(perfilRes.data)
      setResenas(resenasRes.data)
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error cargando perfil')
    } finally {
      setCargando(false)
    }
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    )
  }

  if (error || !perfil) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-lg text-red-600 mb-4">{error || 'Perfil no encontrado'}</p>
          <button
            onClick={() => navigate('/servicios')}
            className="mlbtn ml-grad text-white px-6 py-2 rounded-lg"
          >
            Volver a Servicios
          </button>
        </div>
      </div>
    )
  }

  const estrellas = '★'.repeat(Math.round(perfil.calificacion)) + '☆'.repeat(5 - Math.round(perfil.calificacion))

  return (
    <div className="min-h-screen bg-ml-bg">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/servicios')}
            className="text-white/80 hover:text-white mb-6 flex items-center gap-2"
          >
            ← Volver
          </button>
        </div>
      </div>

      {/* Perfil */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-ml-line overflow-hidden">
          {/* Banner */}
          <div className="h-48 bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
            {perfil.media?.logo ? (
              <img src={perfil.media.logo} alt={perfil.rubro} className="h-full w-full object-cover" />
            ) : (
              <div className="text-6xl">💼</div>
            )}
          </div>

          {/* Contenido */}
          <div className="p-8">
            {/* Encabezado */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-3xl font-extrabold text-ml-ink mb-2">
                  {perfil.rubro.charAt(0).toUpperCase() + perfil.rubro.slice(1)}
                </h1>
                <p className="text-ml-soft mb-4">📍 {perfil.localidad}</p>

                {/* Badges */}
                <div className="flex gap-3 mb-4 flex-wrap">
                  {perfil.verificado && (
                    <span className="bg-green-50 border border-green-200 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                      ✓ Verificado
                    </span>
                  )}
                  {perfil.totalTrabajos > 0 && (
                    <span className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                      {perfil.totalTrabajos} trabajo{perfil.totalTrabajos !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Calificación */}
                <div className="flex items-center gap-3">
                  <span className="text-2xl text-yellow-500">{estrellas}</span>
                  <span className="text-lg font-semibold text-ml-ink">{perfil.calificacion.toFixed(1)}</span>
                  <span className="text-ml-muted">({perfil.conteoResenas} reseña{perfil.conteoResenas !== 1 ? 's' : ''})</span>
                </div>
              </div>

              {/* Botón de Cotizar */}
              <button
                onClick={() => {
                  if (!estaLogueado) {
                    navigate('/login?redirect=/servicios')
                    return
                  }
                  navigate(`/servicios/solicitud/${usuarioId}`)
                }}
                className="mlbtn ml-grad text-white px-8 py-3 rounded-lg font-bold"
              >
                Solicitar Cotización
              </button>
            </div>

            {/* Descripción */}
            {perfil.descripcion && (
              <div className="mb-8 pb-8 border-b border-ml-line">
                <h2 className="text-lg font-bold text-ml-ink mb-3">Sobre mí</h2>
                <p className="text-ml-soft leading-relaxed">{perfil.descripcion}</p>
              </div>
            )}

            {/* Zonas de cobertura */}
            {perfil.zonasCobertura && perfil.zonasCobertura.length > 0 && (
              <div className="mb-8 pb-8 border-b border-ml-line">
                <h2 className="text-lg font-bold text-ml-ink mb-3">Zonas de cobertura</h2>
                <div className="flex gap-2 flex-wrap">
                  {perfil.zonasCobertura.map(zona => (
                    <span key={zona} className="bg-ml-bg border border-ml-line px-3 py-1 rounded-full text-sm">
                      📍 {zona}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Reseñas */}
            <div>
              <h2 className="text-lg font-bold text-ml-ink mb-4">
                Reseñas ({resenas.length})
              </h2>

              {resenas.length === 0 ? (
                <p className="text-ml-muted text-center py-8">Aún no hay reseñas</p>
              ) : (
                <div className="space-y-4">
                  {resenas.map(resena => (
                    <div key={resena._id} className="bg-ml-bg rounded-xl p-4 border border-ml-line">
                      {/* Cabecera reseña */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={resena.clienteId.avatar || 'https://via.placeholder.com/40'}
                            alt={resena.clienteId.nombre}
                            className="w-10 h-10 rounded-full"
                          />
                          <div>
                            <p className="font-semibold text-ml-ink">{resena.clienteId.nombre}</p>
                            <p className="text-xs text-ml-muted">
                              {new Date(resena.createdAt).toLocaleDateString('es-AR')}
                            </p>
                          </div>
                        </div>
                        <span className="text-yellow-500 text-lg">
                          {'★'.repeat(resena.calificacion)}{'☆'.repeat(5 - resena.calificacion)}
                        </span>
                      </div>

                      {/* Comentario */}
                      {resena.comentario && (
                        <p className="text-ml-soft mb-3">{resena.comentario}</p>
                      )}

                      {/* Respuesta */}
                      {resena.respuestaProfesional && (
                        <div className="bg-white border border-ml-line rounded-lg p-3 mt-3 text-sm">
                          <p className="text-ml-ink font-semibold mb-1">💬 Respuesta del profesional:</p>
                          <p className="text-ml-soft">{resena.respuestaProfesional}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
