import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { subirImagenOptimizada } from '../utils/imageUpload'

interface OtroUsuario {
  _id: string
  nombre: string
  avatar?: string
}

interface Conversacion {
  conversacionId: string
  otroUsuario: OtroUsuario
  productoId?: string
  productoNombre?: string
  productoImagen?: string
  ultimoTexto?: string
  ultimoFueImagen?: boolean
  noLeidos: number
  fecha?: string
  pendiente?: boolean // conversación recién abierta sin mensajes todavía
}

interface Mensaje {
  _id: string
  emisorId: string | { _id: string }
  mensaje: string
  imagenUrl?: string
  huboCensura?: boolean
  createdAt: string
}

// Normaliza un campo poblado o no: devuelve el _id como string
function idDe(valor: string | { _id: string } | undefined | null): string {
  if (!valor) return ''
  return typeof valor === 'object' ? valor._id : valor
}

export default function Chat() {
  const { usuario } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [conversacionActiva, setConversacionActiva] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [nuevoMensaje, setNuevoMensaje] = useState('')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  const mensajesRef = useRef<HTMLDivElement>(null)

  // Transforma la respuesta del backend ({ conversacionId, ultimoMensaje, noLeidos })
  // al shape que usa la UI, derivando "el otro usuario" del último mensaje.
  function mapearConversaciones(data: any[]): Conversacion[] {
    const miId = usuario?._id
    return (data || []).map((c: any) => {
      const um = c.ultimoMensaje || {}
      const emisor = um.emisorId || {}
      const receptor = um.receptorId || {}
      const otro = idDe(emisor) === miId ? receptor : emisor
      return {
        conversacionId: c.conversacionId,
        otroUsuario: {
          _id: idDe(otro),
          nombre: (otro && otro.nombre) || 'Usuario',
          avatar: (otro && otro.avatar) || ''
        },
        productoId: idDe(um.productoId) || undefined,
        productoNombre: um.productoId?.nombre,
        productoImagen: um.productoId?.imagenes?.[0],
        ultimoTexto: um.mensaje,
        ultimoFueImagen: !!um.imagenUrl && !um.mensaje,
        noLeidos: c.noLeidos || 0,
        fecha: um.createdAt
      }
    })
  }

  useEffect(() => {
    cargarConversaciones()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (conversacionActiva) {
      cargarMensajes(conversacionActiva)
      marcarLeidos(conversacionActiva)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversacionActiva])

  useEffect(() => {
    if (mensajesRef.current) {
      mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight
    }
  }, [mensajes])

  async function cargarConversaciones() {
    try {
      const res = await api.get('/mensajes/conversaciones')
      const mapeadas = mapearConversaciones(res.data)
      setConversaciones(mapeadas)
      abrirConversacionPorParam(mapeadas)
    } catch (error) {
      console.error('Error cargando conversaciones:', error)
    } finally {
      setCargando(false)
    }
  }

  // Si venimos con ?con=USERID&nombre=NOMBRE (ej: "Coordinar por chat" desde un
  // trabajo/solicitud), abrimos esa conversación aunque todavía no tenga mensajes.
  function abrirConversacionPorParam(existentes: Conversacion[]) {
    const con = searchParams.get('con')
    const nombre = searchParams.get('nombre') || 'Cliente'
    const miId = usuario?._id
    if (!con || !miId || con === miId) return

    const convId = [miId, con].sort().join('_')
    const yaExiste = existentes.find(c => c.conversacionId === convId)

    if (!yaExiste) {
      const pendiente: Conversacion = {
        conversacionId: convId,
        otroUsuario: { _id: con, nombre, avatar: '' },
        noLeidos: 0,
        pendiente: true
      }
      setConversaciones(prev => [pendiente, ...prev])
    }
    setConversacionActiva(convId)
    // Limpiar los query params para no reabrir al recargar conversaciones
    setSearchParams({}, { replace: true })
  }

  async function cargarMensajes(conversacionId: string) {
    try {
      const res = await api.get(`/mensajes/conversacion/${conversacionId}`)
      setMensajes(res.data)
    } catch (error) {
      console.error('Error cargando mensajes:', error)
      setMensajes([])
    }
  }

  async function marcarLeidos(conversacionId: string) {
    try {
      await api.put(`/mensajes/leer/${conversacionId}`)
      setConversaciones((prev) =>
        prev.map((c) => (c.conversacionId === conversacionId ? { ...c, noLeidos: 0 } : c))
      )
    } catch (error) {
      console.error('Error marcando leidos:', error)
    }
  }

  async function enviar(texto: string, imagenUrl?: string) {
    if (!conversacionActiva) return
    const conv = conversaciones.find((c) => c.conversacionId === conversacionActiva)
    if (!conv) return

    setEnviando(true)
    try {
      await api.post('/mensajes', {
        receptorId: conv.otroUsuario._id,
        productoId: conv.productoId,
        mensaje: texto,
        imagenUrl: imagenUrl || undefined
      })
      setNuevoMensaje('')
      await cargarMensajes(conversacionActiva)
      // Refrescar lista (y quitar el flag "pendiente" una vez que hay mensajes)
      const res = await api.get('/mensajes/conversaciones')
      setConversaciones(mapearConversaciones(res.data))
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error enviando mensaje')
    } finally {
      setEnviando(false)
    }
  }

  async function enviarTexto(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevoMensaje.trim()) return
    enviar(nuevoMensaje.trim())
  }

  async function enviarImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setSubiendoImagen(true)
    try {
      const { url } = await subirImagenOptimizada(archivo)
      await enviar('', url)
    } catch (err: any) {
      alert(err.message || 'No se pudo subir la imagen')
    } finally {
      setSubiendoImagen(false)
    }
  }

  const convActiva = conversaciones.find((c) => c.conversacionId === conversacionActiva)
  const otroUsuario = convActiva?.otroUsuario

  if (cargando) {
    return (
      <div className="min-h-screen bg-ml-bg flex items-center justify-center">
        <div className="animate-spin text-4xl">🔄</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ml-bg flex">
      {/* Sidebar de conversaciones */}
      <div className={`w-full md:w-80 bg-white border-r border-ml-line flex-col ${conversacionActiva ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-ml-line2">
          <h2 className="text-lg font-bold text-ml-ink">💬 Mensajes</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversaciones.length === 0 ? (
            <p className="text-center text-ml-muted py-8 text-sm">No hay conversaciones</p>
          ) : (
            conversaciones.map((conv) => (
              <button
                key={conv.conversacionId}
                onClick={() => setConversacionActiva(conv.conversacionId)}
                className={`w-full text-left px-4 py-3 border-b border-ml-line2 hover:bg-ml-bg transition-colors ${
                  conversacionActiva === conv.conversacionId ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ml-ink text-sm">
                    {conv.otroUsuario.nombre}
                  </span>
                  <div className="flex items-center gap-2">
                    {conv.noLeidos > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 bg-ml-blue text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {conv.noLeidos}
                      </span>
                    )}
                    {conv.fecha && (
                      <span className="text-xs text-ml-muted">
                        {new Date(conv.fecha).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                {conv.productoNombre && (
                  <p className="text-xs text-ml-blue mt-0.5 truncate">{conv.productoNombre}</p>
                )}
                {(conv.ultimoTexto || conv.ultimoFueImagen) && (
                  <p className="text-xs text-ml-muted mt-0.5 truncate">
                    {conv.ultimoFueImagen ? '📷 Foto' : conv.ultimoTexto}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Area de mensajes */}
      <div className={`flex-1 flex-col ${conversacionActiva ? 'flex' : 'hidden md:flex'}`}>
        {!conversacionActiva ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-ml-muted">
              <p className="text-6xl mb-4">💬</p>
              <p className="text-lg">Selecciona una conversacion</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-white border-b border-ml-line px-4 sm:px-6 py-4 flex items-center gap-3">
              <button
                onClick={() => setConversacionActiva(null)}
                className="md:hidden text-ml-muted hover:text-ml-ink"
                aria-label="Volver"
              >
                ←
              </button>
              {convActiva?.productoImagen && (
                <img src={convActiva.productoImagen} alt="" className="w-10 h-10 rounded-lg object-cover" />
              )}
              <div>
                <p className="font-semibold text-ml-ink">{otroUsuario?.nombre || 'Usuario'}</p>
                {convActiva?.productoNombre && (
                  <p className="text-xs text-ml-muted">{convActiva.productoNombre}</p>
                )}
              </div>
            </div>

            {/* Mensajes */}
            <div ref={mensajesRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
              {mensajes.length === 0 && (
                <p className="text-center text-ml-muted text-sm py-8">
                  Enviá el primer mensaje para empezar a coordinar.
                </p>
              )}
              {mensajes.map((msg) => {
                const esMio = idDe(msg.emisorId) === usuario?._id
                return (
                  <div key={msg._id} className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl ${
                        esMio
                          ? 'bg-ml-blue text-white rounded-br-md'
                          : 'bg-ml-bg text-ml-ink rounded-bl-md'
                      }`}
                    >
                      {msg.imagenUrl && (
                        <a href={msg.imagenUrl} target="_blank" rel="noreferrer">
                          <img
                            src={msg.imagenUrl}
                            alt="Imagen adjunta"
                            className="rounded-lg mb-1 max-h-64 w-auto object-cover"
                          />
                        </a>
                      )}
                      {msg.mensaje && <p className="text-sm whitespace-pre-line">{msg.mensaje}</p>}

                      {msg.huboCensura && (
                        <p className={`text-[10px] mt-1 italic ${esMio ? 'text-blue-100' : 'text-ml-muted'}`}>
                          🔒 Por seguridad, el contacto se desbloquea al concretar el trabajo
                        </p>
                      )}

                      <p className={`text-xs mt-1 ${esMio ? 'text-blue-100' : 'text-ml-muted'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Input */}
            <form onSubmit={enviarTexto} className="bg-white border-t border-ml-line px-4 sm:px-6 py-3">
              <p className="text-[11px] text-ml-muted text-center mb-2 leading-tight">
                🔒 Por tu seguridad, los teléfonos, emails y links se ocultan hasta que se concrete el trabajo
              </p>
              <div className="flex gap-2 sm:gap-3 items-center">
                {/* Adjuntar imagen */}
                <label className="shrink-0 w-11 h-11 flex items-center justify-center border border-ml-line rounded-xl cursor-pointer hover:bg-ml-bg text-xl" title="Enviar foto">
                  {subiendoImagen ? <span className="animate-spin text-base">🔄</span> : '📷'}
                  <input
                    type="file"
                    accept="image/*,.heic,.heif"
                    onChange={enviarImagen}
                    disabled={subiendoImagen || enviando}
                    className="hidden"
                  />
                </label>
                <input
                  type="text"
                  value={nuevoMensaje}
                  onChange={(e) => setNuevoMensaje(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 border border-ml-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ml-purple/30"
                />
                <button
                  type="submit"
                  disabled={enviando || subiendoImagen || !nuevoMensaje.trim()}
                  className="px-5 sm:px-6 py-3 mlbtn ml-grad text-white rounded-xl font-medium disabled:opacity-50"
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
