import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

interface Perfil {
  _id: string
  usuarioId: string
  usuario?: { _id: string; nombre: string; avatar: string }
  nombreNegocio?: string
  rubro: string
  descripcion: string
  experiencia?: string
  habilidades?: string[]
  añosExperiencia?: number
  localidad: string
  zonasCobertura: string[]
  telefonoContacto?: string
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

  // Nombre y avatar a mostrar: nombre del negocio o del usuario; avatar del usuario o logo
  const nombreMostrar = perfil.nombreNegocio || perfil.usuario?.nombre || 'Profesional'

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
          {/* Contenido */}
          <div className="p-6 sm:p-8">
            {/* Encabezado tipo Instagram */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-6">
              {/* Avatar del profesional */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center overflow-hidden shrink-0 ring-4 ring-violet-50">
                {perfil.usuario?.avatar ? (
                  <img src={perfil.usuario.avatar} alt={nombreMostrar} className="w-full h-full object-cover" />
                ) : perfil.media?.logo ? (
                  <img src={perfil.media.logo} alt={nombreMostrar} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">👤</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-ml-ink">{nombreMostrar}</h1>
                  {perfil.verificado && (
                    <span className="bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                      ✓ Verificado
                    </span>
                  )}
                </div>
                <p className="text-ml-violet font-semibold capitalize mb-1">{perfil.rubro}</p>
                <p className="text-ml-soft mb-4">📍 {perfil.localidad}</p>

                {/* Stats */}
                <div className="flex items-center justify-center sm:justify-start gap-8">
                  <div className="text-center">
                    <p className="text-lg font-extrabold text-ml-ink">
                      <span className="text-yellow-500">★</span> {perfil.calificacion ? perfil.calificacion.toFixed(1) : '—'}
                    </p>
                    <p className="text-xs text-ml-muted">{perfil.conteoResenas} reseña{perfil.conteoResenas !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-extrabold text-ml-ink">{perfil.totalTrabajos}</p>
                    <p className="text-xs text-ml-muted">trabajos</p>
                  </div>
                  {!!perfil.añosExperiencia && (
                    <div className="text-center">
                      <p className="text-lg font-extrabold text-ml-ink">{perfil.añosExperiencia}</p>
                      <p className="text-xs text-ml-muted">años exp.</p>
                    </div>
                  )}
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
                className="mlbtn ml-grad text-white px-6 py-3 rounded-lg font-bold shrink-0 w-full sm:w-auto"
              >
                Solicitar Cotización
              </button>
            </div>

            {/* Habilidades */}
            {perfil.habilidades && perfil.habilidades.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-6">
                {perfil.habilidades.map(h => (
                  <span key={h} className="bg-violet-50 text-ml-violet border border-violet-100 px-3 py-1 rounded-full text-sm font-medium">
                    {h}
                  </span>
                ))}
              </div>
            )}

            {/* Descripción */}
            {perfil.descripcion && (
              <div className="mb-6 pb-6 border-b border-ml-line">
                <h2 className="text-lg font-bold text-ml-ink mb-3">Sobre mí</h2>
                <p className="text-ml-soft leading-relaxed">{perfil.descripcion}</p>
              </div>
            )}

            {/* Experiencia / CV */}
            {perfil.experiencia && (
              <div className="mb-6 pb-6 border-b border-ml-line">
                <h2 className="text-lg font-bold text-ml-ink mb-3">📋 Experiencia y trayectoria</h2>
                <p className="text-ml-soft leading-relaxed whitespace-pre-line">{perfil.experiencia}</p>
              </div>
            )}

            {/* Galería de trabajos */}
            {perfil.media?.fotos && perfil.media.fotos.length > 0 && (
              <div className="mb-6 pb-6 border-b border-ml-line">
                <h2 className="text-lg font-bold text-ml-ink mb-3">📸 Trabajos realizados</h2>
                <div className="grid grid-cols-3 gap-2">
                  {perfil.media.fotos.map((url, idx) => (
                    <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-ml-bg">
                      <img src={url} alt={`Trabajo ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition" />
                    </div>
                  ))}
                </div>
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
