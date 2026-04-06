import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

interface Conversacion {
  _id: string
  participantes: { _id: string; nombre: string; avatar?: string }[]
  productoId?: { _id: string; nombre: string; imagenes?: string[] }
  ultimoMensaje?: string
  noLeidos: number
  updatedAt: string
}

interface Mensaje {
  _id: string
  emisorId: string
  receptorId: string
  mensaje: string
  leido: boolean
  createdAt: string
}

export default function Chat() {
  const { usuario } = useAuth()
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [conversacionActiva, setConversacionActiva] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const mensajesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    cargarConversaciones()
  }, [])

  useEffect(() => {
    if (conversacionActiva) {
      cargarMensajes(conversacionActiva)
      marcarLeidos(conversacionActiva)
    }
  }, [conversacionActiva])

  useEffect(() => {
    if (mensajesRef.current) {
      mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight
    }
  }, [mensajes])

  async function cargarConversaciones() {
    try {
      const res = await api.get('/mensajes/conversaciones')
      setConversaciones(res.data)
    } catch (error) {
      console.error('Error cargando conversaciones:', error)
    } finally {
      setCargando(false)
    }
  }

  async function cargarMensajes(conversacionId: string) {
    try {
      const res = await api.get(`/mensajes/conversacion/${conversacionId}`)
      setMensajes(res.data)
    } catch (error) {
      console.error('Error cargando mensajes:', error)
    }
  }

  async function marcarLeidos(conversacionId: string) {
    try {
      await api.put(`/mensajes/leer/${conversacionId}`)
      setConversaciones((prev) =>
        prev.map((c) => (c._id === conversacionId ? { ...c, noLeidos: 0 } : c))
      )
    } catch (error) {
      console.error('Error marcando leidos:', error)
    }
  }

  async function enviarMensaje(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevoMensaje.trim() || !conversacionActiva) return

    const conv = conversaciones.find((c) => c._id === conversacionActiva)
    if (!conv) return

    const receptor = conv.participantes.find((p) => p._id !== usuario?._id)
    if (!receptor) return

    setEnviando(true)
    try {
      await api.post('/mensajes', {
        receptorId: receptor._id,
        productoId: conv.productoId?._id,
        mensaje: nuevoMensaje,
      })
      setNuevoMensaje('')
      cargarMensajes(conversacionActiva)
      cargarConversaciones()
    } catch (error) {
      console.error('Error enviando mensaje:', error)
    } finally {
      setEnviando(false)
    }
  }

  const convActiva = conversaciones.find((c) => c._id === conversacionActiva)
  const otroUsuario = convActiva?.participantes.find((p) => p._id !== usuario?._id)

  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin text-4xl">🔄</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar de conversaciones */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">💬 Mensajes</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversaciones.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">No hay conversaciones</p>
          ) : (
            conversaciones.map((conv) => {
              const otro = conv.participantes.find((p) => p._id !== usuario?._id)
              return (
                <button
                  key={conv._id}
                  onClick={() => setConversacionActiva(conv._id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    conversacionActiva === conv._id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800 text-sm">
                      {otro?.nombre || 'Usuario'}
                    </span>
                    <div className="flex items-center gap-2">
                      {conv.noLeidos > 0 && (
                        <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(conv.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {conv.productoId && (
                    <p className="text-xs text-blue-500 mt-0.5 truncate">
                      {conv.productoId.nombre}
                    </p>
                  )}
                  {conv.ultimoMensaje && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{conv.ultimoMensaje}</p>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Area de mensajes */}
      <div className="flex-1 flex flex-col">
        {!conversacionActiva ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <p className="text-6xl mb-4">💬</p>
              <p className="text-lg">Selecciona una conversacion</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
              {convActiva?.productoId?.imagenes?.[0] && (
                <img
                  src={convActiva.productoId.imagenes[0]}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover"
                />
              )}
              <div>
                <p className="font-semibold text-gray-800">{otroUsuario?.nombre || 'Usuario'}</p>
                {convActiva?.productoId && (
                  <p className="text-xs text-gray-500">{convActiva.productoId.nombre}</p>
                )}
              </div>
            </div>

            {/* Mensajes */}
            <div ref={mensajesRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {mensajes.map((msg) => {
                const esMio = msg.emisorId === usuario?._id
                return (
                  <div
                    key={msg._id}
                    className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl ${
                        esMio
                          ? 'bg-blue-500 text-white rounded-br-md'
                          : 'bg-gray-200 text-gray-800 rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm">{msg.mensaje}</p>
                      <p
                        className={`text-xs mt-1 ${
                          esMio ? 'text-blue-100' : 'text-gray-400'
                        }`}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Input */}
            <form onSubmit={enviarMensaje} className="bg-white border-t border-gray-200 px-6 py-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={nuevoMensaje}
                  onChange={(e) => setNuevoMensaje(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={enviando || !nuevoMensaje.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {enviando ? '...' : 'Enviar'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
