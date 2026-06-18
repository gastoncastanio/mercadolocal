import { useState, useEffect } from 'react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'

interface Solicitud {
  _id: string
  tipo: string
  estado: string
  detalle: string
  emailContacto: string
  respuesta?: string
  ordenId?: string
  createdAt: string
}

const TIPO_META: Record<string, { label: string; icon: string; clase: string }> = {
  acceso: { label: 'Acceso a datos', icon: '📥', clase: 'bg-ml-blue/10 text-ml-blue' },
  supresion: { label: 'Baja de cuenta', icon: '🗑️', clase: 'bg-red-100 text-red-700' },
  oposicion: { label: 'Oposición perfilado', icon: '🎯', clase: 'bg-purple-100 text-purple-700' },
  rectificacion: { label: 'Rectificación', icon: '✏️', clase: 'bg-amber-100 text-amber-700' },
  arrepentimiento: { label: 'Arrepentimiento', icon: '↩️', clase: 'bg-orange-100 text-orange-700' },
  queja: { label: 'Queja', icon: '📕', clase: 'bg-green-100 text-green-700' }
}

const ESTADO_CLASE: Record<string, string> = {
  recibida: 'bg-amber-100 text-amber-700',
  en_proceso: 'bg-blue-100 text-blue-700',
  resuelta: 'bg-green-100 text-green-700',
  rechazada: 'bg-gray-100 text-ml-muted'
}

export default function SolicitudesLegales() {
  const toast = useToast()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [filtroTipo, setFiltroTipo] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => { cargar() }, [filtroTipo])

  async function cargar() {
    setCargando(true)
    try {
      const res = await api.get('/privacidad/solicitudes', { params: filtroTipo ? { tipo: filtroTipo } : {} })
      setSolicitudes(res.data || [])
    } catch {
      toast.error('No se pudieron cargar las solicitudes')
    } finally {
      setCargando(false)
    }
  }

  async function marcarResuelta(id: string) {
    try {
      await api.put(`/privacidad/solicitudes/${id}`, { estado: 'resuelta' })
      setSolicitudes(prev => prev.map(s => s._id === id ? { ...s, estado: 'resuelta' } : s))
      toast.exito('Marcada como resuelta')
    } catch {
      toast.error('No se pudo actualizar')
    }
  }

  const pendientes = solicitudes.filter(s => s.estado === 'recibida' || s.estado === 'en_proceso').length

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <h1 className="font-display text-[24px] font-extrabold text-ml-ink mb-1">⚖️ Solicitudes legales</h1>
        <p className="text-ml-muted text-sm mb-4">
          Registro auditable de los derechos ejercidos por los usuarios (datos personales y consumidor).
          {pendientes > 0 && <span className="ml-1 font-semibold text-amber-600">{pendientes} pendiente(s).</span>}
        </p>

        <div className="flex gap-2 flex-wrap mb-4">
          <button onClick={() => setFiltroTipo('')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${!filtroTipo ? 'ml-grad text-white' : 'bg-white border border-ml-line2 text-ml-soft'}`}>Todas</button>
          {Object.entries(TIPO_META).map(([k, m]) => (
            <button key={k} onClick={() => setFiltroTipo(k)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filtroTipo === k ? 'ml-grad text-white' : 'bg-white border border-ml-line2 text-ml-soft'}`}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {cargando ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : solicitudes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-ml-line2">
            <p className="text-ml-muted text-sm">No hay solicitudes para este filtro.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {solicitudes.map(s => {
              const meta = TIPO_META[s.tipo] || { label: s.tipo, icon: '📄', clase: 'bg-gray-100 text-ml-muted' }
              const pendiente = s.estado === 'recibida' || s.estado === 'en_proceso'
              return (
                <div key={s._id} className="bg-white rounded-xl shadow-sm p-4 border border-ml-line2">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${meta.clase}`}>{meta.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_CLASE[s.estado] || ''}`}>{s.estado}</span>
                        <span className="text-xs text-ml-muted">{new Date(s.createdAt).toLocaleString('es-AR')}</span>
                      </div>
                      <p className="text-sm text-ml-ink mt-1">{s.emailContacto}</p>
                      {s.detalle && <p className="text-sm text-ml-muted mt-1 whitespace-pre-wrap">{s.detalle}</p>}
                      {s.ordenId && <p className="text-xs text-ml-muted mt-1">Orden #{s.ordenId.slice(-8)}</p>}
                    </div>
                    {pendiente && (
                      <button onClick={() => marcarResuelta(s._id)} className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg font-semibold hover:bg-green-100 shrink-0">
                        Marcar resuelta
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
