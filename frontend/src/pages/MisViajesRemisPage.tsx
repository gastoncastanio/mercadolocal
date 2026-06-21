import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

interface ViajeRemis {
  _id: string
  estado: string
  tipoServicio: string
  origen: { direccion: string; ciudad: string; referencia: string }
  destino: { direccion: string; ciudad: string; referencia: string }
  distanciaKm: number
  horasEspera: number
  pasajeros: number
  precioEstimado: number
  precioFinal: number | null
  notas: string
  comisionista?: { _id: string; nombre: string; avatar: string } | null
  comisionistaId?: string | null
  pago?: { estadoPago: string }
  createdAt: string
}

// Línea de tiempo del viaje (la "sensación Uber").
const PASOS = ['buscando', 'aceptado', 'en_camino', 'a_bordo', 'finalizado']
const PASO_LABEL: Record<string, string> = {
  buscando: 'Buscando conductor',
  aceptado: 'Conductor asignado',
  en_camino: 'En camino a buscarte',
  a_bordo: 'Viaje en curso',
  finalizado: 'Finalizado'
}

const TIPO_LABEL: Record<string, string> = {
  traslado: 'Traslado', ida_vuelta: 'Ida y vuelta', dia_compras: 'Día de compras'
}

const ESTADO_INFO: Record<string, { texto: string; clase: string }> = {
  buscando: { texto: 'Buscando conductor', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  aceptado: { texto: 'Conductor asignado', clase: 'bg-blue-50 text-blue-700 border-blue-200' },
  en_camino: { texto: 'En camino', clase: 'bg-blue-50 text-blue-700 border-blue-200' },
  a_bordo: { texto: 'En curso', clase: 'bg-violet-50 text-ml-violet border-violet-200' },
  finalizado: { texto: 'Finalizado', clase: 'bg-green-50 text-green-700 border-green-200' },
  cancelado: { texto: 'Cancelado', clase: 'bg-red-50 text-red-600 border-red-200' }
}

export default function MisViajesRemisPage() {
  const navigate = useNavigate()
  const [viajes, setViajes] = useState<ViajeRemis[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [accionando, setAccionando] = useState(false)
  const [pagando, setPagando] = useState<string | null>(null)
  const [reseñados, setReseñados] = useState<string[]>([])
  const [reseñaAbierta, setReseñaAbierta] = useState<string | null>(null)
  const [estrellas, setEstrellas] = useState(5)
  const [comentario, setComentario] = useState('')

  useEffect(() => {
    cargar()
    // Al volver del checkout de MP, verificar el pago.
    const params = new URLSearchParams(window.location.search)
    if (params.get('pago') === 'ok') verificarPagosPendientes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function cargar() {
    setCargando(true)
    try {
      const [resViajes, resReseñas] = await Promise.all([
        api.get('/remis/mis-viajes'),
        api.get('/remis/mis-resenas-hechas').catch(() => ({ data: [] }))
      ])
      setViajes(resViajes.data || [])
      setReseñados(resReseñas.data || [])
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error cargando tus viajes')
    } finally {
      setCargando(false)
    }
  }

  async function verificarPagosPendientes() {
    try {
      const res = await api.get('/remis/mis-viajes')
      const pendientes = (res.data || []).filter((v: ViajeRemis) => v.estado === 'finalizado' && v.pago?.estadoPago !== 'pagado')
      await Promise.all(pendientes.map((v: ViajeRemis) => api.post(`/remis/viaje/${v._id}/verificar-pago`).catch(() => {})))
      cargar()
    } catch { /* noop */ }
  }

  async function pagar(id: string) {
    setPagando(id)
    setError('')
    try {
      const res = await api.post(`/remis/viaje/${id}/pagar`)
      if (res.data?.initPoint) {
        window.location.href = res.data.initPoint
      } else {
        setError('No se obtuvo URL de pago. Intentá de nuevo.')
        setPagando(null)
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo proceder al pago')
      setPagando(null)
    }
  }

  async function cancelar(id: string) {
    if (!confirm('¿Cancelar este viaje?')) return
    setAccionando(true)
    try {
      await api.patch(`/remis/viaje/${id}/cancelar`)
      await cargar()
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo cancelar')
    } finally {
      setAccionando(false)
    }
  }

  async function enviarReseña(id: string) {
    setAccionando(true)
    setError('')
    try {
      await api.post(`/remis/viaje/${id}/resena`, { calificacion: estrellas, comentario })
      setReseñaAbierta(null)
      setReseñados(prev => [...prev, id])
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo enviar la reseña')
    } finally {
      setAccionando(false)
    }
  }

  async function coordinarChat(comisionistaId: string, nombre?: string) {
    try {
      await api.post('/mensajes', { receptorId: comisionistaId, mensaje: 'Hola! Coordinemos el punto de encuentro.' })
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
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-extrabold">Mis viajes de remis</h1>
          </div>
          <button onClick={() => navigate('/remis')} className="px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-bold">+ Pedir remis</button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">{error}</p>}

        {viajes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-ml-line">
            <p className="text-4xl mb-3">🚕</p>
            <p className="text-ml-muted mb-4">Todavía no pediste ningún remis.</p>
            <button onClick={() => navigate('/remis')} className="mlbtn ml-grad text-white px-6 py-2 rounded-lg font-bold">Pedir un remis</button>
          </div>
        ) : (
          <div className="space-y-3">
            {viajes.map(v => {
              const info = ESTADO_INFO[v.estado] || { texto: v.estado, clase: 'bg-ml-bg text-ml-soft border-ml-line' }
              const pasoActual = PASOS.indexOf(v.estado)
              const activo = !['finalizado', 'cancelado'].includes(v.estado)
              const precio = v.precioFinal != null ? v.precioFinal : v.precioEstimado
              return (
                <div key={v._id} className="bg-white rounded-2xl shadow-sm border border-ml-line p-5">
                  <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                    <div>
                      <span className="text-xs font-semibold text-ml-muted">{TIPO_LABEL[v.tipoServicio] || v.tipoServicio}</span>
                      <div className="flex items-center gap-2 text-ml-ink font-bold mt-0.5">
                        <span className="truncate max-w-[140px]">{v.origen.direccion}</span>
                        <span className="text-ml-violet">→</span>
                        <span className="truncate max-w-[140px]">{v.destino.direccion}</span>
                      </div>
                    </div>
                    <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border ${info.clase}`}>{info.texto}</span>
                  </div>

                  {/* Línea de tiempo en vivo */}
                  {v.estado !== 'cancelado' && (
                    <div className="flex items-center gap-1 mb-3">
                      {PASOS.map((p, i) => (
                        <div key={p} className="flex-1 flex flex-col items-center">
                          <div className={`w-full h-1.5 rounded-full ${i <= pasoActual ? 'bg-ml-violet' : 'bg-ml-line'}`} />
                          <span className={`text-[9px] mt-1 text-center leading-tight ${i === pasoActual ? 'text-ml-violet font-bold' : 'text-ml-muted'}`}>{PASO_LABEL[p]}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-sm text-ml-soft mb-1">
                    {precio > 0 && <span className="font-bold text-ml-violet">${precio.toLocaleString('es-AR')}</span>}
                    {v.precioFinal == null && v.estado !== 'finalizado' && precio > 0 && <span className="text-xs text-ml-muted"> (estimado)</span>}
                    {v.distanciaKm > 0 && <span className="text-xs text-ml-muted"> · {v.distanciaKm} km</span>}
                    {v.horasEspera > 0 && <span className="text-xs text-ml-muted"> · {v.horasEspera}h espera</span>}
                  </p>
                  {v.comisionista && <p className="text-xs text-ml-muted mb-3">Conductor: {v.comisionista.nombre}</p>}

                  <div className="flex flex-wrap gap-2 justify-end">
                    {v.estado === 'finalizado' && v.pago?.estadoPago !== 'pagado' && (
                      <button onClick={() => pagar(v._id)} disabled={pagando === v._id} className="px-4 py-2 mlbtn ml-grad text-white rounded-lg text-sm font-bold disabled:opacity-60">
                        {pagando === v._id ? 'Procesando...' : `💳 Pagar $${precio.toLocaleString('es-AR')}`}
                      </button>
                    )}
                    {v.estado === 'finalizado' && v.pago?.estadoPago === 'pagado' && !reseñados.includes(v._id) && reseñaAbierta !== v._id && (
                      <button onClick={() => { setReseñaAbierta(v._id); setEstrellas(5); setComentario('') }} className="px-4 py-2 border border-ml-violet text-ml-violet rounded-lg text-sm font-semibold hover:bg-violet-50">⭐ Calificar</button>
                    )}
                    {reseñados.includes(v._id) && <span className="px-3 py-2 text-sm text-green-700 font-semibold">✓ Reseñado</span>}
                    {v.comisionista && v.estado !== 'cancelado' && (
                      <button onClick={() => coordinarChat(v.comisionista!._id, v.comisionista!.nombre)} className="px-4 py-2 border border-ml-line rounded-lg text-sm font-semibold text-ml-ink hover:bg-ml-bg">💬 Chat</button>
                    )}
                    {activo && (
                      <button onClick={() => cancelar(v._id)} disabled={accionando} className="px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-700">Cancelar</button>
                    )}
                  </div>

                  {reseñaAbierta === v._id && (
                    <div className="mt-3 pt-3 border-t border-ml-line">
                      <p className="text-sm font-semibold text-ml-ink mb-2">¿Cómo fue tu viaje con {v.comisionista?.nombre || 'el conductor'}?</p>
                      <div className="flex items-center gap-1 mb-3">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button key={n} type="button" onClick={() => setEstrellas(n)} className={`text-2xl ${n <= estrellas ? 'text-amber-400' : 'text-ml-line'}`}>★</button>
                        ))}
                      </div>
                      <textarea value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Contanos cómo fue (opcional)" className="w-full px-3 py-2 border border-ml-line rounded-lg text-sm mb-2 h-20" />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setReseñaAbierta(null)} className="px-4 py-2 text-sm font-semibold text-ml-muted">Cancelar</button>
                        <button onClick={() => enviarReseña(v._id)} disabled={accionando} className="px-4 py-2 mlbtn ml-grad text-white rounded-lg text-sm font-bold disabled:opacity-60">{accionando ? 'Enviando...' : 'Enviar reseña'}</button>
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
