import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

interface Cotizacion {
  _id: string
  estado: string
  ciudadOrigen: string
  ciudadDestino: string
  descripcionCarga: string
  cotizacion: { monto: number | null; notas: string; fecha: string | null }
  incidente?: { reportado: boolean; descripcion: string; fecha: string | null }
  comisionistaId?: { _id: string; nombre: string; avatar: string } | null
  createdAt: string
}

const ESTADO_INFO: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: 'Esperando cotización', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  cotizada: { texto: 'Cotizada', clase: 'bg-blue-50 text-blue-700 border-blue-200' },
  aceptada: { texto: 'Aceptada', clase: 'bg-green-50 text-green-700 border-green-200' },
  rechazada: { texto: 'Rechazada', clase: 'bg-red-50 text-red-600 border-red-200' },
  cancelada: { texto: 'Cancelada', clase: 'bg-ml-bg text-ml-soft border-ml-line' }
}

export default function MisCotizacionesPage() {
  const navigate = useNavigate()
  const [lista, setLista] = useState<Cotizacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [accionando, setAccionando] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    try {
      const res = await api.get('/comisionistas/mis-cotizaciones')
      setLista(res.data || [])
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error cargando tus cotizaciones')
    } finally {
      setCargando(false)
    }
  }

  async function aceptar(id: string) {
    setAccionando(true)
    try {
      await api.patch(`/comisionistas/cotizacion/${id}/aceptar`)
      await cargar()
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo aceptar')
    } finally {
      setAccionando(false)
    }
  }

  async function cancelar(id: string) {
    if (!confirm('¿Cancelar esta solicitud?')) return
    setAccionando(true)
    try {
      await api.patch(`/comisionistas/cotizacion/${id}/cancelar`)
      await cargar()
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo cancelar')
    } finally {
      setAccionando(false)
    }
  }

  async function coordinarChat(comisionistaId: string, nombre?: string) {
    try {
      await api.post('/mensajes', { receptorId: comisionistaId, mensaje: 'Hola! Coordinemos el traslado.' })
    } catch { /* igual abrimos el chat */ }
    const q = new URLSearchParams({ con: comisionistaId })
    if (nombre) q.append('nombre', nombre)
    navigate(`/chat?${q.toString()}`)
  }

  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center"><div className="spinner" /></div>
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate('/mis-ordenes')} className="text-white/80 hover:text-white mb-3 flex items-center gap-2">← Mis pedidos</button>
          <h1 className="text-3xl font-extrabold">Mis cotizaciones de traslado</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">{error}</p>}

        {lista.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-ml-line">
            <p className="text-4xl mb-3">🚚</p>
            <p className="text-ml-muted mb-4">Todavía no pediste ninguna cotización a un comisionista.</p>
            <button onClick={() => navigate('/mis-ordenes')} className="mlbtn ml-grad text-white px-6 py-2 rounded-lg font-bold">Ver mis pedidos</button>
          </div>
        ) : (
          <div className="space-y-3">
            {lista.map(c => {
              const info = ESTADO_INFO[c.estado] || { texto: c.estado, clase: 'bg-ml-bg text-ml-soft border-ml-line' }
              return (
                <div key={c._id} className="bg-white rounded-2xl shadow-sm border border-ml-line p-5">
                  <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                    <div className="flex items-center gap-2 text-ml-ink font-bold">
                      <span>{c.ciudadOrigen || '—'}</span>
                      <span className="text-ml-violet">→</span>
                      <span>{c.ciudadDestino || '—'}</span>
                    </div>
                    <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border ${info.clase}`}>{info.texto}</span>
                  </div>

                  {c.comisionistaId && (
                    <div className="flex items-center gap-2 mb-2">
                      <img src={c.comisionistaId.avatar || 'https://via.placeholder.com/28'} alt="" className="w-7 h-7 rounded-full object-cover" />
                      <p className="text-sm text-ml-soft">{c.comisionistaId.nombre}</p>
                    </div>
                  )}

                  {c.descripcionCarga && <p className="text-xs text-ml-muted mb-2">📦 {c.descripcionCarga}</p>}

                  {/* Cotización recibida */}
                  {c.cotizacion?.monto != null && (
                    <div className="bg-ml-bg border border-ml-line rounded-lg p-3 mb-3">
                      <p className="text-sm text-ml-ink">
                        Precio cotizado: <span className="font-extrabold text-ml-violet">${c.cotizacion.monto.toLocaleString('es-AR')}</span>
                      </p>
                      {c.cotizacion.notas && <p className="text-xs text-ml-muted mt-1">{c.cotizacion.notas}</p>}
                    </div>
                  )}

                  {/* Incidente reportado por el comisionista */}
                  {c.incidente?.reportado && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                      <p className="text-sm font-semibold text-red-700">⚠️ El comisionista reportó un problema</p>
                      {c.incidente.descripcion && <p className="text-xs text-red-600 mt-1">{c.incidente.descripcion}</p>}
                      <p className="text-xs text-ml-muted mt-1">El vendedor coordina el reintegro de tu dinero o el reemplazo del producto.</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 justify-end">
                    {c.estado === 'cotizada' && (
                      <button onClick={() => aceptar(c._id)} disabled={accionando} className="px-4 py-2 text-sm font-bold rounded-lg mlbtn ml-grad text-white disabled:opacity-50">Aceptar cotización</button>
                    )}
                    {c.comisionistaId && ['cotizada', 'aceptada'].includes(c.estado) && (
                      <button onClick={() => coordinarChat(c.comisionistaId!._id, c.comisionistaId!.nombre)} className="px-4 py-2 border border-ml-line rounded-lg text-sm font-semibold text-ml-ink hover:bg-ml-bg">💬 Chat</button>
                    )}
                    {!['rechazada', 'cancelada'].includes(c.estado) && (
                      <button onClick={() => cancelar(c._id)} disabled={accionando} className="px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-700">Cancelar</button>
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
