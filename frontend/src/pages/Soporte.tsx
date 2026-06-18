/**
 * Página de Soporte — chat con el AGENTE-SOPORTE (Claude Haiku 4.5).
 *
 * El usuario puede:
 * - Ver sus tickets anteriores (lista a la izquierda)
 * - Iniciar un ticket nuevo (chat a la derecha)
 * - Continuar conversaciones existentes
 *
 * Flujo:
 * 1. Usuario escribe mensaje → POST /api/soporte/preguntar
 * 2. Backend llama a Claude Haiku con system prompt cacheado
 * 3. Claude responde en español rioplatense
 * 4. Si la consulta excede capacidades de la IA, escala al admin automático
 */

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

interface MensajeTicket {
  rol: 'usuario' | 'agente' | 'admin'
  texto: string
  fecha: string
}

interface TicketResumen {
  _id: string
  asunto: string
  estado: 'abierto' | 'resuelto' | 'escalado' | 'cerrado'
  prioridad: 'baja' | 'media' | 'alta' | 'urgente'
  ultimaActividad: string
  createdAt: string
  cantidadMensajes: number
  ultimoMensaje: { rol: string; texto: string } | null
}

interface TicketCompleto {
  _id: string
  asunto: string
  estado: 'abierto' | 'resuelto' | 'escalado' | 'cerrado'
  prioridad: 'baja' | 'media' | 'alta' | 'urgente'
  mensajes: MensajeTicket[]
  motivoEscalado?: string
  createdAt: string
}

const ASUNTO_ICONO: Record<string, string> = {
  compra: '🛒',
  venta: '💰',
  pago: '💳',
  envio: '📦',
  cuenta: '👤',
  producto: '🏷️',
  otro: '❓'
}

const ESTADO_COLOR: Record<string, string> = {
  abierto: 'bg-ml-bg text-blue-700',
  resuelto: 'bg-green-100 text-green-700',
  escalado: 'bg-orange-100 text-orange-700',
  cerrado: 'bg-gray-100 text-ml-muted'
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

export default function Soporte() {
  const { usuario } = useAuth()
  const toast = useToast()

  const [tickets, setTickets] = useState<TicketResumen[]>([])
  const [ticketActivo, setTicketActivo] = useState<TicketCompleto | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [cargandoTickets, setCargandoTickets] = useState(true)

  const mensajesRef = useRef<HTMLDivElement>(null)

  // Cargar tickets al iniciar
  useEffect(() => {
    cargarTickets()
  }, [])

  // Scroll automático al final cuando llega un mensaje nuevo
  useEffect(() => {
    if (mensajesRef.current) {
      mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight
    }
  }, [ticketActivo?.mensajes])

  async function cargarTickets() {
    try {
      const res = await api.get('/soporte/mis-tickets')
      setTickets(res.data)
    } catch (error) {
      console.error('Error cargando tickets:', error)
    } finally {
      setCargandoTickets(false)
    }
  }

  async function abrirTicket(ticketId: string) {
    try {
      const res = await api.get(`/soporte/${ticketId}`)
      setTicketActivo(res.data)
    } catch (error) {
      toast.error('No pudimos cargar la conversación')
    }
  }

  function iniciarConversacionNueva() {
    setTicketActivo(null)
    setMensaje('')
  }

  async function enviarMensaje(e: React.FormEvent) {
    e.preventDefault()
    const texto = mensaje.trim()
    if (!texto || enviando) return

    setEnviando(true)
    const textoOriginal = mensaje
    setMensaje('')

    try {
      const res = await api.post('/soporte/preguntar', {
        mensaje: texto,
        ticketId: ticketActivo?._id
      })

      // Recargar el ticket completo para mostrar el nuevo mensaje + respuesta
      const ticketRes = await api.get(`/soporte/${res.data.ticketId}`)
      setTicketActivo(ticketRes.data)

      // Recargar lista de tickets (preview puede haber cambiado)
      cargarTickets()

      if (res.data.escalado) {
        toast.info('Tu consulta fue derivada a un agente humano. Te respondemos pronto.')
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al enviar el mensaje')
      setMensaje(textoOriginal) // recuperar el texto si falló
    } finally {
      setEnviando(false)
    }
  }

  async function cerrarTicket() {
    if (!ticketActivo) return
    if (!confirm('¿Cerrar este ticket? Vas a poder consultarlo después pero no agregar mensajes.')) return

    try {
      await api.post(`/soporte/${ticketActivo._id}/cerrar`)
      toast.exito('Ticket cerrado')
      setTicketActivo(null)
      cargarTickets()
    } catch (error) {
      toast.error('Error al cerrar el ticket')
    }
  }

  // Si no está logueado, redirigir mensaje
  if (!usuario) {
    return (
      <div className="min-h-screen bg-ml-bg flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-5xl mb-4">🔒</p>
          <h2 className="text-xl font-bold text-ml-ink mb-2">Iniciá sesión para usar el soporte</h2>
          <p className="text-ml-muted text-sm mb-6">Necesitamos saber quién sos para ayudarte mejor.</p>
          <Link to="/login" className="inline-block px-6 py-3 mlbtn ml-grad text-white rounded-xl font-semibold ">
            Iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="font-display text-[28px] font-extrabold text-ml-ink">Soporte</h1>
          <p className="text-ml-muted text-sm mt-1">
            Hablá con nuestro asistente para resolver cualquier duda. Si necesitamos, te derivamos a un humano.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* ===== Lista de tickets (sidebar) ===== */}
          <div className="md:col-span-4 lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-ml-line2 overflow-hidden">
              <div className="px-4 py-3 border-b border-ml-line2 flex items-center justify-between">
                <h2 className="text-sm font-bold text-ml-ink">Tus consultas</h2>
                <button
                  onClick={iniciarConversacionNueva}
                  className="text-xs text-ml-blue font-medium hover:underline"
                >
                  + Nueva
                </button>
              </div>

              <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
                {cargandoTickets ? (
                  <div className="p-6 text-center text-sm text-ml-muted">Cargando...</div>
                ) : tickets.length === 0 ? (
                  <div className="p-6 text-center text-sm text-ml-muted">
                    Todavía no tenés consultas. ¡Empezá una nueva!
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {tickets.map(t => (
                      <button
                        key={t._id}
                        onClick={() => abrirTicket(t._id)}
                        className={`w-full px-4 py-3 text-left hover:bg-ml-bg transition-colors ${
                          ticketActivo?._id === t._id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-ml-ink flex items-center gap-1.5">
                            <span>{ASUNTO_ICONO[t.asunto] || '❓'}</span>
                            <span className="capitalize">{t.asunto}</span>
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[t.estado]}`}>
                            {t.estado === 'escalado' ? 'En revisión' : t.estado}
                          </span>
                        </div>
                        {t.ultimoMensaje && (
                          <p className="text-xs text-ml-muted truncate">
                            {t.ultimoMensaje.rol === 'usuario' ? 'Vos: ' : ''}
                            {t.ultimoMensaje.texto}
                          </p>
                        )}
                        <p className="text-[10px] text-ml-muted mt-0.5">{tiempoRelativo(t.ultimaActividad)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ===== Chat (panel principal) ===== */}
          <div className="md:col-span-8 lg:col-span-9">
            <div className="bg-white rounded-2xl shadow-sm border border-ml-line2 flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>

              {/* Header del chat */}
              <div className="px-5 py-3 border-b border-ml-line2 flex items-center justify-between">
                {ticketActivo ? (
                  <>
                    <div>
                      <p className="text-sm font-bold text-ml-ink flex items-center gap-2">
                        <span>{ASUNTO_ICONO[ticketActivo.asunto]}</span>
                        <span className="capitalize">{ticketActivo.asunto}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${ESTADO_COLOR[ticketActivo.estado]}`}>
                          {ticketActivo.estado === 'escalado' ? 'En revisión humana' : ticketActivo.estado}
                        </span>
                      </p>
                      <p className="text-[11px] text-ml-muted">
                        Ticket #{ticketActivo._id.slice(-8).toUpperCase()} · {tiempoRelativo(ticketActivo.createdAt)}
                      </p>
                    </div>
                    {ticketActivo.estado !== 'cerrado' && (
                      <button
                        onClick={cerrarTicket}
                        className="text-xs text-ml-muted hover:text-red-600 font-medium"
                      >
                        Cerrar ticket
                      </button>
                    )}
                  </>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-ml-ink">Nueva consulta</p>
                    <p className="text-[11px] text-ml-muted">Escribí lo que necesitás y te respondemos al toque</p>
                  </div>
                )}
              </div>

              {/* Mensajes */}
              <div ref={mensajesRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-ml-bg/50">
                {!ticketActivo || ticketActivo.mensajes.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-ml-bg to-ml-bg rounded-2xl flex items-center justify-center mb-4 text-3xl">
                      💬
                    </div>
                    <h3 className="font-bold text-ml-ink mb-1">Hola {usuario.nombre.split(' ')[0]}</h3>
                    <p className="text-sm text-ml-muted max-w-xs">
                      Escribí tu consulta y te respondemos al toque. Si necesitamos, te derivamos a un agente humano.
                    </p>
                    <div className="mt-4 space-y-1.5 text-xs text-ml-muted">
                      <p>💡 Ejemplos:</p>
                      <p>"¿Cómo vinculo Mercado Pago?"</p>
                      <p>"Mi pedido tarda mucho, ¿qué hago?"</p>
                      <p>"¿Cuánto cobran de comisión?"</p>
                    </div>
                  </div>
                ) : (
                  ticketActivo.mensajes.map((m, i) => {
                    const esUsuario = m.rol === 'usuario'
                    const esAgente = m.rol === 'agente'
                    return (
                      <div key={i} className={`flex ${esUsuario ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] ${esUsuario ? '' : 'flex items-start gap-2'}`}>
                          {!esUsuario && (
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs ${
                              esAgente ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {esAgente ? '🤖' : '👤'}
                            </div>
                          )}
                          <div className={`px-4 py-2.5 rounded-2xl ${
                            esUsuario
                              ? 'bg-blue-500 text-white rounded-br-md'
                              : 'bg-white text-ml-ink rounded-bl-md border border-ml-line2 shadow-sm'
                          }`}>
                            {!esUsuario && (
                              <p className={`text-[10px] font-bold mb-1 ${esAgente ? 'text-ml-blue' : 'text-orange-600'}`}>
                                {esAgente ? 'Asistente IA' : 'Soporte humano'}
                              </p>
                            )}
                            <p className="text-sm whitespace-pre-line leading-relaxed">{m.texto}</p>
                            <p className={`text-[10px] mt-1 ${esUsuario ? 'text-blue-100' : 'text-ml-muted'}`}>
                              {new Date(m.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}

                {/* Indicador de escalado */}
                {ticketActivo?.estado === 'escalado' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-900 max-w-md mx-auto">
                    <p className="font-semibold mb-1">👤 En revisión humana</p>
                    <p className="text-xs text-orange-700">
                      Derivamos tu consulta a un agente humano. Te respondemos lo antes posible.
                    </p>
                  </div>
                )}
              </div>

              {/* Input */}
              {(!ticketActivo || ticketActivo.estado !== 'cerrado') && (
                <form onSubmit={enviarMensaje} className="border-t border-ml-line2 p-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={mensaje}
                      onChange={e => setMensaje(e.target.value)}
                      placeholder={enviando ? 'Esperando respuesta...' : 'Escribí tu consulta...'}
                      disabled={enviando}
                      maxLength={2000}
                      className="flex-1 px-4 py-3 border border-ml-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ml-purple/30 disabled:bg-ml-bg"
                    />
                    <button
                      type="submit"
                      disabled={enviando || !mensaje.trim()}
                      className="px-5 py-3 mlbtn ml-grad text-white rounded-xl font-semibold text-sm  disabled:opacity-50 flex-shrink-0"
                    >
                      {enviando ? '...' : 'Enviar'}
                    </button>
                  </div>
                  <p className="text-[10px] text-ml-muted mt-1.5 text-center">
                    Nuestro asistente está disponible 24/7. Las consultas complejas se derivan a un humano.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
