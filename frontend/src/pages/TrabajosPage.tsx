import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

interface Trabajo {
  _id: string
  clienteId: { _id: string; nombre: string; avatar: string }
  titulo: string
  descripcion: string
  rubro: string
  localidad: string
  presupuestoMin: number | null
  presupuestoMax: number | null
  plazoEntrega: string | null
  skills: string[]
  estado: string
  bidCount: number
  createdAt: string
}

const rubros = ['sanitarios', 'electricista', 'gasista', 'carpintero', 'plomero', 'pintor', 'limpieza', 'otros']

function formatoPresupuesto(min: number | null, max: number | null) {
  if (min != null && max != null) return `$${min.toLocaleString('es-AR')} – $${max.toLocaleString('es-AR')}`
  if (min != null) return `Desde $${min.toLocaleString('es-AR')}`
  if (max != null) return `Hasta $${max.toLocaleString('es-AR')}`
  return 'A convenir'
}

export default function TrabajosPage() {
  const navigate = useNavigate()
  const { estaLogueado } = useAuth()
  const [rubro, setRubro] = useState('')
  const [localidad, setLocalidad] = useState('')
  const [trabajos, setTrabajos] = useState<Trabajo[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarTrabajos()
  }, [rubro, localidad])

  async function cargarTrabajos() {
    setCargando(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (rubro) params.append('rubro', rubro)
      if (localidad) params.append('localidad', localidad)
      const res = await api.get(`/servicios/trabajos?${params}`)
      setTrabajos(res.data.trabajos || [])
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error cargando trabajos')
      setTrabajos([])
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-extrabold mb-3">Bolsa de Trabajo</h1>
          <p className="text-lg text-white/90 mb-6">Publicá lo que necesitás y recibí ofertas de profesionales. Ellos compiten, vos elegís.</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate(estaLogueado ? '/trabajos/publicar' : '/login?redirect=/trabajos/publicar')}
              className="bg-white text-ml-violet px-5 py-2.5 rounded-lg font-bold hover:bg-white/90 transition"
            >
              + Publicar un trabajo
            </button>
            {estaLogueado && (
              <button
                onClick={() => navigate('/trabajos/mis-publicaciones')}
                className="bg-white/20 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-white/30 transition border border-white/40"
              >
                Mis publicaciones
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border-b border-ml-line sticky top-0 z-40 py-4 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-ml-ink mb-2">Rubro</label>
            <select
              value={rubro}
              onChange={(e) => setRubro(e.target.value)}
              className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
            >
              <option value="">Todos los rubros</option>
              {rubros.map(r => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-ml-ink mb-2">Localidad</label>
            <input
              type="text"
              placeholder="Ej: La Plata, Mar del Plata"
              value={localidad}
              onChange={(e) => setLocalidad(e.target.value)}
              className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
            />
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">{error}</p>}

        {cargando ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : trabajos.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-ml-line">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-ml-muted mb-4">No hay trabajos publicados con esos filtros</p>
            <button
              onClick={() => navigate(estaLogueado ? '/trabajos/publicar' : '/login?redirect=/trabajos/publicar')}
              className="mlbtn ml-grad text-white px-6 py-2.5 rounded-lg font-bold"
            >
              Publicar el primero
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {trabajos.map(t => (
              <div key={t._id} className="bg-white rounded-2xl shadow-sm border border-ml-line p-5 hover:shadow-md transition flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-bold text-ml-ink text-lg leading-tight">{t.titulo}</h3>
                  <span className="shrink-0 bg-violet-50 text-ml-violet border border-violet-100 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize">{t.rubro}</span>
                </div>
                <p className="text-sm text-ml-soft mb-3 line-clamp-2">{t.descripcion}</p>

                {/* Skills */}
                {t.skills && t.skills.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mb-3">
                    {t.skills.slice(0, 4).map(s => (
                      <span key={s} className="bg-ml-bg border border-ml-line px-2 py-0.5 rounded-full text-xs text-ml-soft">{s}</span>
                    ))}
                  </div>
                )}

                {/* Meta */}
                <div className="text-sm text-ml-soft space-y-1 mb-4">
                  <p>💰 <span className="font-semibold text-ml-ink">{formatoPresupuesto(t.presupuestoMin, t.presupuestoMax)}</span></p>
                  <p>📍 {t.localidad}</p>
                  {t.plazoEntrega && <p>📅 Hasta {new Date(t.plazoEntrega).toLocaleDateString('es-AR')}</p>}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-ml-line">
                  <div className="flex items-center gap-2">
                    <img
                      src={t.clienteId?.avatar || 'https://via.placeholder.com/32'}
                      alt={t.clienteId?.nombre}
                      className="w-7 h-7 rounded-full object-cover"
                    />
                    <div>
                      <p className="text-xs font-semibold text-ml-ink leading-none">{t.clienteId?.nombre}</p>
                      <p className="text-[11px] text-ml-muted">{t.bidCount} oferta{t.bidCount !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(estaLogueado ? `/trabajos/${t._id}` : `/login?redirect=/trabajos/${t._id}`)}
                    className="mlbtn ml-grad text-white px-4 py-2 rounded-lg text-sm font-semibold"
                  >
                    Ver y ofertar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
