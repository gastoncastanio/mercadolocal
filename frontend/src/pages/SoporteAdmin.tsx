/**
 * Panel admin para revisar y responder tickets escalados por el AGENTE-SOPORTE.
 *
 * Solo accesible para usuarios con rol "admin".
 *
 * Funcionalidades:
 * - Lista de tickets filtrados por estado y prioridad
 * - Detalle del ticket con historial completo de mensajes
 * - Responder manualmente (queda como mensaje "admin")
 * - Cerrar el ticket marcándolo como resuelto
 */

import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'

interface MensajeTicket {
  rol: 'usuario' | 'agente' | 'admin'
  texto: string
  fecha: string
}

interface TicketAdmin {
  _id: string
  usuarioId: { _id: string; nombre: string; email: string; rol: string }
  asunto: string
  estado: 'abierto' | 'resuelto' | 'escalado' | 'cerrado'
  prioridad: 'baja' | 'media' | 'alta' | 'urgente'
  mensajes: MensajeTicket[]
  motivoEscalado?: string
  tags?: string[]
  resueltoPorIA?: boolean
  fechaEscalado?: string
  createdAt: string
  ultimaActividad: string
}

const PRIORIDAD_COLOR: Record<string, string> = {
  urgente: 'bg-red-100 text-red-700 border-red-200',
  alta: 'bg-orange-100 text-orange-700 border-orange-200',
  media: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  baja: 'bg-gray-100 text-gray-600 border-gray-200'
}

const ESTADO_COLOR: Record<string, string> = {
  abierto: 'bg-blue-100 text-blue-700',
  resuelto: 'bg-green-100 text-green-700',
  escalado: 'bg-orange-100 text-orange-700',
  cerrado: 'bg-gray-100 text-gray-500'
}

const ASUNTO_ICONO: Record<string, string> = {
  compra: '🛒', venta: '💰', pago: '💳', envio: '📦',
  cuenta: '👤', producto: '🏷️', otro: '❓'
}

function tiempoRelativo(iso?: string): string {
  if (!iso) return ''
  const segs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (segs < 60) return 'recién'
  if (segs < 3600) return `hace ${Math.floor(segs / 60)} min`
  if (segs < 86400) return `hace ${Math.floor(segs / 3600)} h`
  if (segs < 604800) return `hace ${Math.floor(segs / 86400)} días`
  return new Date(iso).toLocaleDateString('es-AR')
}

export default function SoporteAdmin() {
  const toast = useToast()
  const [tickets, setTickets] = useState<TicketAdmin[]>([])
  const [filtroEstado, setFiltroEstado] = useState<string>('escalado')
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>('')
  const [ticketActivo, setTicketActivo] = useState<TicketAdmin | null>(null)
  const [respuesta, setRespuesta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [cerrarAlEnviar, setCerrarAlEnviar] = useState(false)
  const [cargando, setCargando] = useState(true)

  const mensajesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    cargarTickets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado, filtroPrioridad])

  useEffect(() => {
    if (mensajesRef.current) {
      mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight
    }
  }, [ticketActivo?.mensajes])

  async function cargarTickets() {
    setCargando(true)
    try {
      const params: any = { estado: filtroEstado }
      if (filtroPrioridad) params.prioridad = filtroPrioridad

      const res = await api.get('/soporte/admin/tickets', { params })
      setTickets(res.data)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al cargar tickets')
    } finally {
      setCargando(false)
    }
  }

  async function responder(e: React.FormEvent) {
    e.preventDefault()
    if (!ticketActivo || !respuesta.trim() || enviando) return

    setEnviando(true)
    try {
      await api.post(`/soporte/admin/responder/${ticketActivo._id}`, {
        mensaje: respuesta.trim(),
        cerrar: cerrarAlEnviar
      })

      toast.exito(cerrarAlEnviar ? 'Respuesta enviada y ticket cerrado' : 'Respuesta enviada')
      setRespuesta('')
      setCerrarAlEnviar(false)

      // Recargar el ticket activo y la lista
      const refrescado = await api.get(`/soporte/${ticketActivo._id}`)
      setTicketActivo(refrescado.data)
      cargarTickets()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al enviar respuesta')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-3xl font-bold text-gray-800">Centro de Soporte · Admin</h1>
          <p className="text-gray-500 text-sm mt-1">
            Tickets escalados por el AGENTE-SOPORTE que requieren atención humana.
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 mb-4 flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Estado:</span>
            {['escalado', 'abierto', 'resuelto', 'cerrado'].map(e => (
              <button
                key={e}
                onClick={() => setFiltroEstado(e)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filtroEstado === e ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {e === 'escalado' ? 'En revisión' : e.charAt(0).toUpperCase() + e.slice(1)}
              </button>
            ))}
          </div>
          <div className="border-l border-gray-200 mx-2" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Prioridad:</span>
            <button
              onClick={() => setFiltroPrioridad('')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                !filtroPrioridad ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todas
            </button>
            {['urgente', 'alta', 'media', 'baja'].map(p => (
              <button
                key={p}
                onClick={() => setFiltroPrioridad(p)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  filtroPrioridad === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Lista de tickets */}
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-700">{tickets.length} ticket{tickets.length === 1 ? '' : 's'}</h2>
                <button onClick={cargarTickets} className="text-xs text-blue-600 font-medium hover:underline">
                  ↻ Refrescar
                </button>
              </div>

              <div className="max-h-[calc(100vh-260px)] overflow-y-auto divide-y divide-gray-100">
                {cargando ? (
                  <div className="p-6 text-center text-sm text-gray-400">Cargando...</div>
                ) : tickets.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-400">
                    🎉 No hay tickets pendientes
                  </div>
                ) : (
                  tickets.map(t => (
                    <button
                      key={t._id}
                      onClick={() => setTicketActivo(t)}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                        ticketActivo?._id === t._id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1.5 gap-2">
                        <span className="text-sm font-semibold text-gray-800 flex items-center gap-1.5 truncate">
                          <span>{ASUNTO_ICONO[t.asunto] || '❓'}</span>
                          <span className="truncate">{t.usuarioId?.nombre || 'Usuario'}</span>
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border whitespace-nowrap ${PRIORIDAD_COLOR[t.prioridad]}`}>
                          {t.prioridad}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {t.mensajes && t.mensajes.length > 0 ? t.mensajes[t.mensajes.length - 1].texto.slice(0, 120) : '(sin mensajes)'}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-[10px] text-gray-400">{tiempoRelativo(t.ultimaActividad)}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${ESTADO_COLOR[t.estado]}`}>
                          {t.estado === 'escalado' ? 'En revisión' : t.estado}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Detalle del ticket */}
          <div className="lg:col-span-7 xl:col-span-8">
            {!ticketActivo ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                <p className="text-5xl mb-3">📋</p>
                <p className="text-sm text-gray-500">Seleccioná un ticket de la lista para ver el detalle</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col" style={{ height: 'calc(100vh - 260px)' }}>
                {/* Header del detalle */}
                <div className="px-5 py-3 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-1">
                        <span>{ASUNTO_ICONO[ticketActivo.asunto]}</span>
                        <span className="capitalize">{ticketActivo.asunto}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${PRIORIDAD_COLOR[ticketActivo.prioridad]}`}>
                          {ticketActivo.prioridad}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${ESTADO_COLOR[ticketActivo.estado]}`}>
                          {ticketActivo.estado === 'escalado' ? 'En revisión' : ticketActivo.estado}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        👤 {ticketActivo.usuarioId?.nombre} ({ticketActivo.usuarioId?.rol}) · {ticketActivo.usuarioId?.email}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        #{ticketActivo._id.slice(-8).toUpperCase()} · Creado {tiempoRelativo(ticketActivo.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Motivo de escalado destacado */}
                  {ticketActivo.motivoEscalado && (
                    <div className="mt-3 p-2.5 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-[10px] font-bold text-orange-700 mb-0.5">MOTIVO DE ESCALADO</p>
                      <p className="text-xs text-orange-900">{ticketActivo.motivoEscalado}</p>
                    </div>
                  )}

                  {/* Tags */}
                  {ticketActivo.tags && ticketActivo.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {ticketActivo.tags.map(t => (
                        <span key={t} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mensajes */}
                <div ref={mensajesRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50/50">
                  {ticketActivo.mensajes.map((m, i) => {
                    const esUsuario = m.rol === 'usuario'
                    const esAgente = m.rol === 'agente'
                    const esAdmin = m.rol === 'admin'
                    return (
                      <div key={i} className={`flex ${esUsuario ? 'justify-start' : 'justify-end'}`}>
                        <div className="max-w-[80%] flex items-start gap-2">
                          {esUsuario && (
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs">
                              👤
                            </div>
                          )}
                          <div className={`px-4 py-2.5 rounded-2xl ${
                            esUsuario ? 'bg-white border border-gray-200 rounded-bl-md' :
                            esAgente ? 'bg-blue-50 border border-blue-100 rounded-br-md' :
                            'bg-green-50 border border-green-200 rounded-br-md'
                          }`}>
                            <p className={`text-[10px] font-bold mb-1 ${
                              esUsuario ? 'text-blue-600' :
                              esAgente ? 'text-blue-700' :
                              'text-green-700'
                            }`}>
                              {esUsuario ? `${ticketActivo.usuarioId?.nombre || 'Usuario'}` :
                               esAgente ? '🤖 Agente IA' :
                               '👤 Vos (admin)'}
                            </p>
                            <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{m.texto}</p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {new Date(m.fecha).toLocaleString('es-AR', {
                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                              })}
                            </p>
                          </div>
                          {esAdmin && (
                            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs">
                              👨‍💼
                            </div>
                          )}
                          {esAgente && (
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs">
                              🤖
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Form de respuesta (solo si el ticket está activo) */}
                {ticketActivo.estado !== 'cerrado' && (
                  <form onSubmit={responder} className="border-t border-gray-100 p-3">
                    <textarea
                      value={respuesta}
                      onChange={e => setRespuesta(e.target.value)}
                      placeholder="Escribí tu respuesta al usuario..."
                      disabled={enviando}
                      rows={3}
                      maxLength={4000}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cerrarAlEnviar}
                          onChange={e => setCerrarAlEnviar(e.target.checked)}
                          className="rounded text-blue-600"
                        />
                        Cerrar ticket como resuelto
                      </label>
                      <button
                        type="submit"
                        disabled={enviando || !respuesta.trim()}
                        className="px-5 py-2 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        {enviando ? 'Enviando...' : (cerrarAlEnviar ? 'Responder y cerrar' : 'Responder')}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
