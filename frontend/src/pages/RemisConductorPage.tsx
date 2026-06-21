import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useNotificacionesSocket } from '../hooks/useSocket'

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
  pasajero?: { _id: string; nombre: string; avatar: string } | null
  comisionista?: { _id: string; nombre: string; avatar: string } | null
  pago?: { estadoPago: string }
  createdAt: string
}

const TIPO_LABEL: Record<string, string> = {
  traslado: 'Traslado', ida_vuelta: 'Ida y vuelta', dia_compras: 'Día de compras'
}

const ESTADO_INFO: Record<string, { texto: string; clase: string }> = {
  aceptado: { texto: 'Aceptado', clase: 'bg-blue-50 text-blue-700 border-blue-200' },
  en_camino: { texto: 'En camino', clase: 'bg-blue-50 text-blue-700 border-blue-200' },
  a_bordo: { texto: 'En curso', clase: 'bg-violet-50 text-ml-violet border-violet-200' },
  finalizado: { texto: 'Finalizado', clase: 'bg-green-50 text-green-700 border-green-200' },
  cancelado: { texto: 'Cancelado', clase: 'bg-red-50 text-red-600 border-red-200' }
}

export default function RemisConductorPage() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [tab, setTab] = useState<'pedidos' | 'activos'>('pedidos')
  const [pedidos, setPedidos] = useState<ViajeRemis[]>([])
  const [viajes, setViajes] = useState<ViajeRemis[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [accionando, setAccionando] = useState('')

  useEffect(() => { cargar() }, [])

  // Tiempo real: cuando llega una notificación de remis, refrescamos la cola.
  const onNotif = useCallback((n: any) => {
    if (n?.tipo === 'remis') cargar()
  }, [])
  useNotificacionesSocket(usuario?._id, onNotif)

  async function cargar() {
    setCargando(true)
    try {
      const [resPedidos, resViajes] = await Promise.all([
        api.get('/remis/conductor/pedidos').catch(() => ({ data: [] })),
        api.get('/remis/conductor/viajes').catch(() => ({ data: [] }))
      ])
      setPedidos(resPedidos.data || [])
      setViajes(resViajes.data || [])
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error cargando tus viajes')
    } finally {
      setCargando(false)
    }
  }

  async function aceptar(id: string) {
    setAccionando(id)
    setError('')
    try {
      await api.patch(`/remis/viaje/${id}/aceptar`)
      setTab('activos')
      await cargar()
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo aceptar (quizás otro lo tomó)')
      await cargar()
    } finally {
      setAccionando('')
    }
  }

  async function avanzar(id: string, accion: 'en-camino' | 'a-bordo' | 'finalizar', precioFinal?: number) {
    setAccionando(id)
    setError('')
    try {
      await api.patch(`/remis/viaje/${id}/${accion}`, accion === 'finalizar' ? { precioFinal } : {})
      await cargar()
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo actualizar el viaje')
    } finally {
      setAccionando('')
    }
  }

  async function finalizar(v: ViajeRemis) {
    const sugerido = v.precioEstimado || 0
    const entrada = prompt(`Precio final del viaje (estimado: $${sugerido.toLocaleString('es-AR')}).\nAjustalo si el día se extendió o hubo más km:`, String(sugerido))
    if (entrada === null) return
    const precioFinal = Number(entrada)
    if (!Number.isFinite(precioFinal) || precioFinal < 0) { setError('Precio inválido'); return }
    avanzar(v._id, 'finalizar', precioFinal)
  }

  async function cancelar(id: string) {
    if (!confirm('¿Cancelar este viaje?')) return
    setAccionando(id)
    try {
      await api.patch(`/remis/viaje/${id}/cancelar`)
      await cargar()
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo cancelar')
    } finally {
      setAccionando('')
    }
  }

  async function coordinarChat(pasajeroId: string, nombre?: string) {
    try {
      await api.post('/mensajes', { receptorId: pasajeroId, mensaje: 'Hola! Soy tu conductor, coordinemos el punto de encuentro.' })
    } catch { /* igual lo llevamos al chat */ }
    const q = new URLSearchParams({ con: pasajeroId })
    if (nombre) q.append('nombre', nombre)
    navigate(`/chat?${q.toString()}`)
  }

  const activos = viajes.filter(v => !['finalizado', 'cancelado'].includes(v.estado))
  const historial = viajes.filter(v => ['finalizado', 'cancelado'].includes(v.estado))

  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center"><div className="spinner" /></div>
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white py-8 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-3xl font-extrabold flex items-center gap-2">🧑‍✈️ Panel de remis</h1>
          <button onClick={() => navigate('/comisionistas/mi-perfil')} className="px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-bold">⚙️ Tarifas y disponibilidad</button>
        </div>
      </div>

      <div className="bg-white border-b border-ml-line px-4">
        <div className="max-w-3xl mx-auto flex gap-6">
          <button onClick={() => setTab('pedidos')} className={`py-3 px-1 font-semibold border-b-2 transition ${tab === 'pedidos' ? 'border-ml-violet text-ml-violet' : 'border-transparent text-ml-muted'}`}>
            📥 Pedidos {pedidos.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-ml-violet text-white rounded-full text-xs">{pedidos.length}</span>}
          </button>
          <button onClick={() => setTab('activos')} className={`py-3 px-1 font-semibold border-b-2 transition ${tab === 'activos' ? 'border-ml-violet text-ml-violet' : 'border-transparent text-ml-muted'}`}>
            🚗 Mis viajes {activos.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-ml-violet text-white rounded-full text-xs">{activos.length}</span>}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">{error}</p>}

        {/* Pedidos abiertos para tomar */}
        {tab === 'pedidos' && (
          pedidos.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-ml-line">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-ml-muted mb-2">No hay pedidos abiertos ahora.</p>
              <p className="text-ml-muted text-xs">Cuando alguien pida un remis en tu zona te va a aparacer acá (y te llega una notificación).</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pedidos.map(p => (
                <div key={p._id} className="bg-white rounded-2xl shadow-sm border border-ml-line p-5">
                  <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                    <span className="text-xs font-semibold text-ml-violet bg-violet-50 px-2 py-1 rounded-full">{TIPO_LABEL[p.tipoServicio] || p.tipoServicio}</span>
                    {p.precioEstimado > 0 && <span className="font-extrabold text-ml-violet">${p.precioEstimado.toLocaleString('es-AR')}</span>}
                  </div>
                  <div className="space-y-1 mb-3">
                    <p className="text-sm text-ml-ink"><span className="text-ml-muted">📍 Buscar en:</span> {p.origen.direccion}{p.origen.ciudad ? `, ${p.origen.ciudad}` : ''} {p.origen.referencia && <span className="text-ml-muted">({p.origen.referencia})</span>}</p>
                    <p className="text-sm text-ml-ink"><span className="text-ml-muted">🏁 Destino:</span> {p.destino.direccion}{p.destino.ciudad ? `, ${p.destino.ciudad}` : ''}</p>
                    <p className="text-xs text-ml-muted">
                      {p.pasajeros} pasajero(s)
                      {p.distanciaKm > 0 && ` · ${p.distanciaKm} km`}
                      {p.horasEspera > 0 && ` · ${p.horasEspera}h espera`}
                    </p>
                    {p.notas && <p className="text-xs text-ml-soft italic">"{p.notas}"</p>}
                  </div>
                  <div className="flex justify-end">
                    <button onClick={() => aceptar(p._id)} disabled={accionando === p._id} className="px-5 py-2 mlbtn ml-grad text-white rounded-lg text-sm font-bold disabled:opacity-60">
                      {accionando === p._id ? 'Tomando...' : '✋ Tomar este viaje'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Viajes activos + historial */}
        {tab === 'activos' && (
          <>
            {activos.length === 0 && historial.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-ml-line">
                <p className="text-4xl mb-3">🚗</p>
                <p className="text-ml-muted">Todavía no tomaste ningún viaje.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...activos, ...historial].map(v => {
                  const info = ESTADO_INFO[v.estado] || { texto: v.estado, clase: 'bg-ml-bg text-ml-soft border-ml-line' }
                  const precio = v.precioFinal != null ? v.precioFinal : v.precioEstimado
                  return (
                    <div key={v._id} className="bg-white rounded-2xl shadow-sm border border-ml-line p-5">
                      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                        <span className="text-xs font-semibold text-ml-muted">{TIPO_LABEL[v.tipoServicio] || v.tipoServicio}</span>
                        <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border ${info.clase}`}>{info.texto}</span>
                      </div>
                      <div className="space-y-1 mb-3">
                        <p className="text-sm text-ml-ink"><span className="text-ml-muted">📍 Buscar en:</span> {v.origen.direccion}{v.origen.referencia && <span className="text-ml-muted"> ({v.origen.referencia})</span>}</p>
                        <p className="text-sm text-ml-ink"><span className="text-ml-muted">🏁 Destino:</span> {v.destino.direccion}</p>
                        <p className="text-sm">
                          {precio > 0 && <span className="font-bold text-ml-violet">${precio.toLocaleString('es-AR')}</span>}
                          {v.pago?.estadoPago === 'pagado' && <span className="ml-2 text-xs text-green-700 font-semibold">✓ Pagado</span>}
                        </p>
                        {v.pasajero && <p className="text-xs text-ml-muted">Pasajero: {v.pasajero.nombre}</p>}
                      </div>

                      <div className="flex flex-wrap gap-2 justify-end">
                        {v.estado === 'aceptado' && (
                          <button onClick={() => avanzar(v._id, 'en-camino')} disabled={accionando === v._id} className="px-4 py-2 mlbtn ml-grad text-white rounded-lg text-sm font-bold disabled:opacity-60">🚗 Voy en camino</button>
                        )}
                        {v.estado === 'en_camino' && (
                          <button onClick={() => avanzar(v._id, 'a-bordo')} disabled={accionando === v._id} className="px-4 py-2 mlbtn ml-grad text-white rounded-lg text-sm font-bold disabled:opacity-60">✅ Pasajero a bordo</button>
                        )}
                        {v.estado === 'a_bordo' && (
                          <button onClick={() => finalizar(v)} disabled={accionando === v._id} className="px-4 py-2 mlbtn ml-grad text-white rounded-lg text-sm font-bold disabled:opacity-60">🏁 Finalizar viaje</button>
                        )}
                        {v.pasajero && v.estado !== 'cancelado' && (
                          <button onClick={() => coordinarChat(v.pasajero!._id, v.pasajero!.nombre)} className="px-4 py-2 border border-ml-line rounded-lg text-sm font-semibold text-ml-ink hover:bg-ml-bg">💬 Chat</button>
                        )}
                        {!['finalizado', 'cancelado'].includes(v.estado) && (
                          <button onClick={() => cancelar(v._id)} disabled={accionando === v._id} className="px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-700">Cancelar</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
