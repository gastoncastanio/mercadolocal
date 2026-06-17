import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { Orden, Usuario } from '../types'

const estadoColores: Record<string, string> = {
  pagada: 'bg-blue-100 text-blue-700',
  enviada: 'bg-purple-100 text-purple-700',
  completada: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-700',
}

const estadoLabel: Record<string, string> = {
  pagada: 'Pagado · Enviar',
  enviada: 'En camino',
  completada: 'Entregado',
  cancelada: 'Cancelado',
}

// Helpers de formato
function formatearFechaHora(fechaIso?: string): string {
  if (!fechaIso) return '—'
  const f = new Date(fechaIso)
  return f.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function tiempoRelativo(fechaIso?: string): string {
  if (!fechaIso) return ''
  const ahora = Date.now()
  const fecha = new Date(fechaIso).getTime()
  const segs = Math.floor((ahora - fecha) / 1000)
  if (segs < 60) return 'hace unos segundos'
  if (segs < 3600) return `hace ${Math.floor(segs / 60)} min`
  if (segs < 86400) return `hace ${Math.floor(segs / 3600)} h`
  if (segs < 604800) return `hace ${Math.floor(segs / 86400)} días`
  return formatearFechaHora(fechaIso)
}

// Limpiar teléfono: dejar solo dígitos para WhatsApp/llamada
function limpiarTelefono(tel?: string): string {
  if (!tel) return ''
  return tel.replace(/[^\d+]/g, '')
}

// Construir link de WhatsApp con mensaje pre-cargado
function linkWhatsApp(tel: string, mensaje: string): string {
  const limpio = limpiarTelefono(tel)
  // Si no tiene código país, asumir Argentina (54)
  const numero = limpio.startsWith('+') ? limpio.slice(1) : (limpio.startsWith('54') ? limpio : `54${limpio}`)
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}

export default function PedidosVendedor() {
  const toast = useToast()
  const { tienda } = useAuth()
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'pagada' | 'enviada' | 'completada'>('todos')

  // Modal de envío
  const [modalEnvio, setModalEnvio] = useState<Orden | null>(null)
  const [empresaEnvio, setEmpresaEnvio] = useState('')
  const [codigoSeguimiento, setCodigoSeguimiento] = useState('')
  const [enviandoMarca, setEnviandoMarca] = useState(false)

  useEffect(() => {
    cargarOrdenes()
  }, [])

  // Socket.IO: refrescar lista cuando llega una venta nueva
  useEffect(() => {
    const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api\/?$/, '')
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })

    socket.on('venta:confirmada', () => {
      cargarOrdenes()
      toast.exito('¡Nueva venta!')
    })

    return () => { socket.disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function cargarOrdenes() {
    try {
      const res = await api.get('/ordenes/vendedor')
      setOrdenes(res.data)
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('No pudimos cargar tus pedidos')
    } finally {
      setCargando(false)
    }
  }

  function abrirModalEnvio(orden: Orden) {
    setModalEnvio(orden)
    setEmpresaEnvio('')
    setCodigoSeguimiento('')
  }

  function cerrarModalEnvio() {
    setModalEnvio(null)
    setEmpresaEnvio('')
    setCodigoSeguimiento('')
  }

  async function confirmarEnvio() {
    if (!modalEnvio) return
    setEnviandoMarca(true)
    try {
      await api.put(`/ordenes/${modalEnvio._id}/estado`, {
        estado: 'enviada',
        empresaEnvio: empresaEnvio.trim() || undefined,
        codigoSeguimiento: codigoSeguimiento.trim() || undefined
      })
      toast.exito('Pedido marcado como enviado. Le avisamos al comprador.')
      cerrarModalEnvio()
      cargarOrdenes()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'No pudimos actualizar el estado')
    } finally {
      setEnviandoMarca(false)
    }
  }

  async function marcarCompletada(ordenId: string) {
    if (!confirm('¿Confirmás que el comprador recibió el producto?')) return
    try {
      await api.put(`/ordenes/${ordenId}/estado`, { estado: 'completada' })
      toast.exito('Pedido marcado como completado')
      cargarOrdenes()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al actualizar')
    }
  }

  async function copiarTexto(texto: string, mensajeExito: string) {
    try {
      await navigator.clipboard.writeText(texto)
      toast.info(mensajeExito)
    } catch {
      toast.error('No pudimos copiar')
    }
  }

  // Filtrar
  const ordenesVisibles = filtro === 'todos'
    ? ordenes
    : ordenes.filter(o => o.estado === filtro)

  // Contadores
  const cuentaPorEstado = {
    pagada: ordenes.filter(o => o.estado === 'pagada').length,
    enviada: ordenes.filter(o => o.estado === 'enviada').length,
    completada: ordenes.filter(o => o.estado === 'completada').length,
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-ml-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-3">🔄</div>
          <p className="text-gray-500 text-sm">Cargando tus pedidos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Pedidos recibidos</h1>
            <p className="text-gray-500 text-sm mt-1">
              {tienda?.nombre || 'Tu tienda'} · {ordenes.length} pedido{ordenes.length === 1 ? '' : 's'} totales
            </p>
          </div>
          <button
            onClick={cargarOrdenes}
            className="text-sm text-blue-600 font-medium hover:underline"
            title="Refrescar"
          >
            ↻ Actualizar
          </button>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setFiltro('todos')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filtro === 'todos' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            Todos ({ordenes.length})
          </button>
          <button
            onClick={() => setFiltro('pagada')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filtro === 'pagada' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            Por enviar ({cuentaPorEstado.pagada})
          </button>
          <button
            onClick={() => setFiltro('enviada')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filtro === 'enviada' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            En camino ({cuentaPorEstado.enviada})
          </button>
          <button
            onClick={() => setFiltro('completada')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filtro === 'completada' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            Entregados ({cuentaPorEstado.completada})
          </button>
        </div>

        {ordenesVisibles.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
            <p className="text-5xl mb-4">📦</p>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              {filtro === 'todos' ? 'Todavía no recibiste pedidos' : 'No hay pedidos en este estado'}
            </h3>
            <p className="text-gray-500 text-sm">
              {filtro === 'todos'
                ? 'Cuando alguien te compre algo, vas a verlo acá con todos los datos para enviar.'
                : 'Probá con otro filtro.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {ordenesVisibles.map(orden => {
              // Datos del comprador (snapshot tiene prioridad sobre populated)
              const compradorPop = typeof orden.compradorId === 'object'
                ? orden.compradorId as Usuario
                : null
              const nombreFinal = orden.nombreComprador || compradorPop?.nombre || 'Comprador'
              const emailFinal = compradorPop?.email || ''
              const telFinal = orden.telefonoComprador || compradorPop?.telefono || ''

              // Filtrar items de MI tienda y calcular totales propios
              const tiendaIdActual = tienda?._id
              const itemsMios = tiendaIdActual
                ? orden.items.filter(i => i.tiendaId === tiendaIdActual)
                : orden.items

              const subtotalMio = itemsMios.reduce((acc, i) => acc + i.subtotal, 0)
              const comisionMia = Math.round(subtotalMio * (orden.porcentajeComision || 10)) / 100
              const gananciaMia = subtotalMio - comisionMia

              const mensajeWA = `Hola ${nombreFinal.split(' ')[0]}, soy de ${tienda?.nombre || 'tu compra'}. Te confirmo el pedido #${orden._id.slice(-8).toUpperCase()} y coordino el envío.`

              return (
                <div key={orden._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Header */}
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-xs text-gray-400 font-medium">
                        Pedido #{orden._id.slice(-8).toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {tiempoRelativo(orden.createdAt)} · {formatearFechaHora(orden.createdAt)}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${estadoColores[orden.estado]}`}>
                      {estadoLabel[orden.estado] || orden.estado}
                    </span>
                  </div>

                  {/* Comprador */}
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Comprador</p>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                        {nombreFinal.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{nombreFinal}</p>
                        {emailFinal && <p className="text-xs text-gray-500 truncate">{emailFinal}</p>}
                      </div>
                    </div>

                    {/* Botones de contacto */}
                    <div className="flex flex-wrap gap-2">
                      {telFinal && (
                        <>
                          <a
                            href={linkWhatsApp(telFinal, mensajeWA)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                            </svg>
                            WhatsApp
                          </a>
                          <a
                            href={`tel:${limpiarTelefono(telFinal)}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition-colors"
                          >
                            📞 Llamar
                          </a>
                          <button
                            onClick={() => copiarTexto(telFinal, 'Teléfono copiado')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                          >
                            📋 {telFinal}
                          </button>
                        </>
                      )}
                      {!telFinal && (
                        <span className="text-xs text-orange-600 font-medium px-3 py-1.5 bg-orange-50 rounded-lg">
                          ⚠️ Sin teléfono
                        </span>
                      )}
                      {emailFinal && (
                        <a
                          href={`mailto:${emailFinal}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                          ✉️ Email
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Dirección */}
                  <div className="px-5 py-4 border-b border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Enviar a</p>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm text-gray-800 font-medium leading-snug">📍 {orden.direccionEntrega}</p>
                        {orden.notasComprador && (
                          <p className="text-xs text-gray-600 mt-2 bg-yellow-50 border-l-2 border-yellow-300 px-3 py-2 rounded">
                            <span className="font-semibold">Nota del comprador:</span> {orden.notasComprador}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => copiarTexto(orden.direccionEntrega, 'Dirección copiada')}
                        className="text-xs text-blue-600 font-medium hover:underline whitespace-nowrap mt-0.5"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>

                  {/* Productos vendidos */}
                  <div className="px-5 py-4 border-b border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Productos</p>
                    <div className="space-y-3">
                      {itemsMios.map((item, i) => {
                        const productoPop = typeof item.productoId === 'object' ? item.productoId : null
                        const imagen = productoPop?.imagenes?.[0]
                        return (
                          <div key={i} className="flex items-center gap-3">
                            {imagen ? (
                              <img src={imagen} alt={item.nombre} className="w-14 h-14 object-cover rounded-lg border border-gray-200" />
                            ) : (
                              <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
                                📦
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{item.nombre}</p>
                              <p className="text-xs text-gray-500">
                                {item.cantidad} unid. × ${item.precioUnitario.toLocaleString('es-AR')}
                              </p>
                            </div>
                            <p className="text-sm font-bold text-gray-800">
                              ${item.subtotal.toLocaleString('es-AR')}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Datos del envío (si ya está enviado) */}
                  {orden.estado === 'enviada' && (orden.codigoSeguimiento || orden.empresaEnvio) && (
                    <div className="px-5 py-3 bg-purple-50 border-b border-purple-100">
                      <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-1">Envío</p>
                      <p className="text-sm text-purple-900">
                        {orden.empresaEnvio && <span className="font-semibold">{orden.empresaEnvio}</span>}
                        {orden.codigoSeguimiento && (
                          <span> · Código: <span className="font-mono font-bold">{orden.codigoSeguimiento}</span></span>
                        )}
                      </p>
                      {orden.fechaEnvio && (
                        <p className="text-xs text-purple-700 mt-0.5">Enviado {tiempoRelativo(orden.fechaEnvio)}</p>
                      )}
                    </div>
                  )}

                  {/* Totales y acción */}
                  <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Tu ganancia neta</p>
                      <p className="text-2xl font-bold text-green-600">
                        ${gananciaMia.toLocaleString('es-AR')}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Subtotal ${subtotalMio.toLocaleString('es-AR')} · Comisión ${comisionMia.toLocaleString('es-AR')} ({orden.porcentajeComision || 10}%)
                      </p>
                    </div>

                    <div className="flex gap-2">
                      {orden.estado === 'pagada' && (
                        <button
                          onClick={() => abrirModalEnvio(orden)}
                          className="px-5 py-3 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 transition-colors shadow-sm"
                        >
                          📦 Marcar como enviado
                        </button>
                      )}
                      {orden.estado === 'enviada' && (
                        <button
                          onClick={() => marcarCompletada(orden._id)}
                          className="px-5 py-3 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors shadow-sm"
                        >
                          ✓ Marcar como entregado
                        </button>
                      )}
                      {orden.estado === 'completada' && (
                        <span className="px-4 py-3 bg-green-50 text-green-700 text-sm font-semibold rounded-xl">
                          ✓ Pedido completado
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ===== Modal Marcar como Enviado ===== */}
      {modalEnvio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={cerrarModalEnvio} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Marcar como enviado</h2>
              <button onClick={cerrarModalEnvio} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <p className="text-sm text-gray-600 mb-5">
              Le vamos a avisar al comprador que su pedido fue enviado.
              Si pusiste un código de seguimiento, también lo va a recibir.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ¿Cómo lo enviás? <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <select
                  value={empresaEnvio}
                  onChange={e => setEmpresaEnvio(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-ml-purple/30 outline-none bg-white"
                >
                  <option value="">Elegir empresa...</option>
                  <option value="Andreani">Andreani</option>
                  <option value="OCA">OCA</option>
                  <option value="Correo Argentino">Correo Argentino</option>
                  <option value="Mercado Envíos">Mercado Envíos</option>
                  <option value="Vía Cargo">Vía Cargo</option>
                  <option value="Entrega propia">Entrega propia / Moto</option>
                  <option value="Otra">Otra</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código de seguimiento <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={codigoSeguimiento}
                  onChange={e => setCodigoSeguimiento(e.target.value)}
                  placeholder="Ej: AND123456789"
                  maxLength={100}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-ml-purple/30 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  El comprador podrá usarlo para rastrear su pedido.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={cerrarModalEnvio}
                disabled={enviandoMarca}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEnvio}
                disabled={enviandoMarca}
                className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {enviandoMarca ? 'Marcando...' : 'Confirmar envío'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
