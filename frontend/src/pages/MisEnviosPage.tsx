import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

interface Envio {
  _id: string
  estado: string
  cantidadBultos: number
  tamano: string
  precio: number
  descripcion: string
  comisionistaId?: { _id: string; nombre: string; avatar: string } | null
  viajeId?: { origen: { ciudad: string }; destino: { ciudad: string }; fechaSalida: string } | null
  pago?: { estadoPago: string }
  createdAt: string
}

const ESTADO_INFO: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: 'Esperando confirmación', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  aceptado: { texto: 'Aceptado', clase: 'bg-blue-50 text-blue-700 border-blue-200' },
  en_transito: { texto: 'En tránsito', clase: 'bg-violet-50 text-ml-violet border-violet-200' },
  entregado: { texto: 'Entregado', clase: 'bg-green-50 text-green-700 border-green-200' },
  cancelado: { texto: 'Cancelado', clase: 'bg-red-50 text-red-600 border-red-200' }
}

export default function MisEnviosPage() {
  const navigate = useNavigate()
  const [envios, setEnvios] = useState<Envio[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [accionando, setAccionando] = useState(false)
  const [envioPagando, setEnvioPagando] = useState<string | null>(null)
  // Reseñas: envíos ya reseñados + form abierto (envioId) + valores
  const [reseñados, setReseñados] = useState<string[]>([])
  const [reseñaAbierta, setReseñaAbierta] = useState<string | null>(null)
  const [estrellas, setEstrellas] = useState(5)
  const [comentario, setComentario] = useState('')

  useEffect(() => { cargar() }, [])

  async function pagarEnvio(envioId: string) {
    setEnvioPagando(envioId)
    setError('')
    try {
      const res = await api.post(`/comisionistas/envio/${envioId}/pagar`)
      if (res.data?.initPoint) {
        window.location.href = res.data.initPoint
      } else {
        setError('No se obtuvo URL de pago. Intentá de nuevo.')
        setEnvioPagando(null)
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo proceder al pago')
      setEnvioPagando(null)
    }
  }

  async function cargar() {
    setCargando(true)
    try {
      const [resEnvios, resReseñas] = await Promise.all([
        api.get('/comisionistas/mis-envios'),
        api.get('/comisionistas/mis-resenas-hechas').catch(() => ({ data: [] }))
      ])
      setEnvios(resEnvios.data || [])
      setReseñados(resReseñas.data || [])
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error cargando tus envíos')
    } finally {
      setCargando(false)
    }
  }

  function abrirReseña(envioId: string) {
    setReseñaAbierta(envioId)
    setEstrellas(5)
    setComentario('')
  }

  async function enviarReseña(envioId: string) {
    setAccionando(true)
    setError('')
    try {
      await api.post(`/comisionistas/envio/${envioId}/resena`, { calificacion: estrellas, comentario })
      setReseñaAbierta(null)
      setReseñados(prev => [...prev, envioId])
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo enviar la reseña')
    } finally {
      setAccionando(false)
    }
  }

  async function cancelar(envioId: string) {
    if (!confirm('¿Cancelar este envío?')) return
    setAccionando(true)
    try {
      await api.patch(`/comisionistas/envio/${envioId}/cancelar`)
      await cargar()
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo cancelar')
    } finally {
      setAccionando(false)
    }
  }

  async function coordinarChat(comisionistaId: string, nombre?: string) {
    try {
      await api.post('/mensajes', { receptorId: comisionistaId, mensaje: 'Hola! Coordinemos el envío.' })
    } catch { /* igual lo llevamos al chat */ }
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
          <button onClick={() => navigate('/comisionistas')} className="text-white/80 hover:text-white mb-3 flex items-center gap-2">← Buscar viajes</button>
          <h1 className="text-3xl font-extrabold">Mis envíos</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">{error}</p>}

        {envios.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-ml-line">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-ml-muted mb-4">Todavía no reservaste ningún envío.</p>
            <button onClick={() => navigate('/comisionistas')} className="mlbtn ml-grad text-white px-6 py-2 rounded-lg font-bold">Buscar viajes</button>
          </div>
        ) : (
          <div className="space-y-3">
            {envios.map(envio => {
              const info = ESTADO_INFO[envio.estado] || { texto: envio.estado, clase: 'bg-ml-bg text-ml-soft border-ml-line' }
              const codigo = localStorage.getItem(`ml_envio_codigo_${envio._id}`)
              const cancelable = !['entregado', 'cancelado'].includes(envio.estado)
              return (
                <div key={envio._id} className="bg-white rounded-2xl shadow-sm border border-ml-line p-5">
                  <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                    <div className="flex items-center gap-2 text-ml-ink font-bold">
                      <span>{envio.viajeId?.origen.ciudad || '—'}</span>
                      <span className="text-ml-violet">→</span>
                      <span>{envio.viajeId?.destino.ciudad || '—'}</span>
                    </div>
                    <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border ${info.clase}`}>{info.texto}</span>
                  </div>

                  <p className="text-sm text-ml-soft mb-1">
                    {envio.cantidadBultos} bulto(s) {envio.tamano} · <span className="font-bold text-ml-violet">${envio.precio.toLocaleString('es-AR')}</span>
                  </p>
                  {envio.comisionistaId && (
                    <p className="text-xs text-ml-muted mb-3">Comisionista: {envio.comisionistaId.nombre}</p>
                  )}

                  {/* Código de entrega (guardado en este dispositivo al reservar) */}
                  {codigo && envio.estado !== 'entregado' && envio.estado !== 'cancelado' && (
                    <div className="bg-ml-bg border border-ml-line rounded-lg p-3 mb-3 text-center">
                      <p className="text-xs text-ml-muted mb-1">Código de entrega (dáselo al comisionista al recibir)</p>
                      <p className="text-xl font-extrabold tracking-widest text-ml-ink">{codigo}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 justify-end">
                    {envio.estado === 'pendiente' && envio.pago?.estadoPago !== 'pagado' && (
                      <button onClick={() => pagarEnvio(envio._id)} disabled={envioPagando === envio._id} className="px-4 py-2 mlbtn ml-grad text-white rounded-lg text-sm font-bold disabled:opacity-60">
                        {envioPagando === envio._id ? 'Procesando...' : '💳 Pagar'}
                      </button>
                    )}
                    {/* Reseñar al comisionista (solo envíos entregados, sin reseña previa) */}
                    {envio.estado === 'entregado' && !reseñados.includes(envio._id) && reseñaAbierta !== envio._id && (
                      <button onClick={() => abrirReseña(envio._id)} className="px-4 py-2 border border-ml-violet text-ml-violet rounded-lg text-sm font-semibold hover:bg-violet-50">⭐ Calificar</button>
                    )}
                    {envio.estado === 'entregado' && reseñados.includes(envio._id) && (
                      <span className="px-3 py-2 text-sm text-green-700 font-semibold">✓ Reseñado</span>
                    )}
                    {envio.comisionistaId && envio.estado !== 'cancelado' && (
                      <button onClick={() => coordinarChat(envio.comisionistaId!._id, envio.comisionistaId!.nombre)} className="px-4 py-2 border border-ml-line rounded-lg text-sm font-semibold text-ml-ink hover:bg-ml-bg">💬 Chat</button>
                    )}
                    {cancelable && (
                      <button onClick={() => cancelar(envio._id)} disabled={accionando} className="px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-700">Cancelar</button>
                    )}
                  </div>

                  {/* Form de reseña */}
                  {reseñaAbierta === envio._id && (
                    <div className="mt-3 pt-3 border-t border-ml-line">
                      <p className="text-sm font-semibold text-ml-ink mb-2">¿Cómo fue tu experiencia con {envio.comisionistaId?.nombre || 'el comisionista'}?</p>
                      <div className="flex items-center gap-1 mb-3">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button key={n} type="button" onClick={() => setEstrellas(n)} className={`text-2xl ${n <= estrellas ? 'text-amber-400' : 'text-ml-line'}`}>★</button>
                        ))}
                      </div>
                      <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Contanos cómo fue (opcional)" className="w-full px-3 py-2 border border-ml-line rounded-lg text-sm mb-2 h-20" />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setReseñaAbierta(null)} className="px-4 py-2 text-sm font-semibold text-ml-muted">Cancelar</button>
                        <button onClick={() => enviarReseña(envio._id)} disabled={accionando} className="px-4 py-2 mlbtn ml-grad text-white rounded-lg text-sm font-bold disabled:opacity-60">{accionando ? 'Enviando...' : 'Enviar reseña'}</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
