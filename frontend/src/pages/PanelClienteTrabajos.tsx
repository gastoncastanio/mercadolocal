import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

interface Trabajo {
  _id: string
  titulo: string
  rubro: string
  localidad: string
  estado: string
  bidCount: number
  profesionalAsignadoId: { _id: string; nombre: string; avatar: string } | null
  createdAt: string
}

const etiquetaEstado: Record<string, { texto: string; clase: string }> = {
  activo: { texto: 'Recibiendo ofertas', clase: 'bg-green-50 text-green-700 border-green-200' },
  asignado: { texto: 'Asignado', clase: 'bg-blue-50 text-blue-700 border-blue-200' },
  completado: { texto: 'Completado', clase: 'bg-violet-50 text-ml-violet border-violet-200' },
  cancelado: { texto: 'Cancelado', clase: 'bg-red-50 text-red-600 border-red-200' },
  en_revision: { texto: 'En revisión', clase: 'bg-amber-50 text-amber-700 border-amber-200' }
}

export default function PanelClienteTrabajos() {
  const navigate = useNavigate()
  const [trabajos, setTrabajos] = useState<Trabajo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    try {
      const res = await api.get('/servicios/mis-trabajos')
      setTrabajos(res.data.trabajos || [])
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error cargando tus trabajos')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white py-12 px-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <button onClick={() => navigate('/trabajos')} className="text-white/80 hover:text-white mb-3 flex items-center gap-2">← Bolsa de trabajo</button>
            <h1 className="text-3xl font-extrabold">Mis publicaciones</h1>
          </div>
          <button onClick={() => navigate('/trabajos/publicar')} className="bg-white text-ml-violet px-5 py-2.5 rounded-lg font-bold hover:bg-white/90">+ Publicar trabajo</button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">{error}</p>}

        {cargando ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : trabajos.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-ml-line">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-ml-muted mb-4">Todavía no publicaste ningún trabajo</p>
            <button onClick={() => navigate('/trabajos/publicar')} className="mlbtn ml-grad text-white px-6 py-2.5 rounded-lg font-bold">Publicar el primero</button>
          </div>
        ) : (
          <div className="space-y-3">
            {trabajos.map(t => {
              const estadoInfo = etiquetaEstado[t.estado] || { texto: t.estado, clase: 'bg-ml-bg text-ml-soft border-ml-line' }
              return (
                <button
                  key={t._id}
                  onClick={() => navigate(`/trabajos/${t._id}`)}
                  className="w-full text-left bg-white rounded-2xl shadow-sm border border-ml-line p-5 hover:shadow-md transition flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-ml-ink truncate">{t.titulo}</h3>
                      <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${estadoInfo.clase}`}>{estadoInfo.texto}</span>
                    </div>
                    <p className="text-xs text-ml-muted capitalize">{t.rubro} · 📍 {t.localidad}</p>
                    {t.profesionalAsignadoId && (
                      <p className="text-xs text-ml-soft mt-1">Asignado a <span className="font-semibold">{t.profesionalAsignadoId.nombre}</span></p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-extrabold text-ml-violet leading-none">{t.bidCount}</p>
                    <p className="text-xs text-ml-muted">oferta{t.bidCount !== 1 ? 's' : ''}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
