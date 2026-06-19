import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

interface PerfilMini {
  calificacion: number
  totalTrabajos: number
  conteoResenas: number
  rubro: string
}

interface Bid {
  _id: string
  profesionalId: { _id: string; nombre: string; avatar: string } | string
  precioOfrecido: number
  notas: string
  estado: string
  perfilProfesional?: PerfilMini | null
  createdAt: string
}

interface Trabajo {
  _id: string
  clienteId: { _id: string; nombre: string; avatar: string }
  titulo: string
  descripcion: string
  rubro: string
  localidad: string
  presupuestoMin: number | null
  presupuestoMax: number | null
  plazoEntrega: string | null
  skills: string[]
  estado: string
  profesionalAsignadoId: string | null
  bidGanadora: string | null
}

function formatoPresupuesto(min: number | null, max: number | null) {
  if (min != null && max != null) return `$${min.toLocaleString('es-AR')} – $${max.toLocaleString('es-AR')}`
  if (min != null) return `Desde $${min.toLocaleString('es-AR')}`
  if (max != null) return `Hasta $${max.toLocaleString('es-AR')}`
  return 'A convenir'
}

const etiquetaEstado: Record<string, { texto: string; clase: string }> = {
  activo: { texto: 'Recibiendo ofertas', clase: 'bg-green-50 text-green-700 border-green-200' },
  asignado: { texto: 'Asignado', clase: 'bg-blue-50 text-blue-700 border-blue-200' },
  completado: { texto: 'Completado', clase: 'bg-violet-50 text-ml-violet border-violet-200' },
  cancelado: { texto: 'Cancelado', clase: 'bg-red-50 text-red-700 border-red-200' },
  en_revision: { texto: 'En revisión', clase: 'bg-amber-50 text-amber-700 border-amber-200' }
}

export default function DetalleTrabajoPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [trabajo, setTrabajo] = useState<Trabajo | null>(null)
  const [bids, setBids] = useState<Bid[]>([])
  const [esDueno, setEsDueno] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [accionando, setAccionando] = useState(false)

  // Form de oferta (profesional)
  const [precio, setPrecio] = useState('')
  const [notas, setNotas] = useState('')

  // Modal de reseña
  const [mostrarResena, setMostrarResena] = useState(false)
  const [calificacion, setCalificacion] = useState(5)
  const [comentario, setComentario] = useState('')
  const [resenaEnviada, setResenaEnviada] = useState(false)

  useEffect(() => {
    if (id) cargar()
  }, [id])

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      const res = await api.get(`/servicios/trabajo/${id}`)
      setTrabajo(res.data.trabajo)
      setBids(res.data.bids || [])
      setEsDueno(res.data.esDueno)
      if (res.data.yaResenado) setResenaEnviada(true)
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo cargar el trabajo')
    } finally {
      setCargando(false)
    }
  }

  // Oferta propia del profesional (cuando no es dueño)
  const miOferta = !esDueno ? bids.find(b => {
    const pid = typeof b.profesionalId === 'string' ? b.profesionalId : b.profesionalId?._id
    return pid === usuario?._id
  }) : null

  const soyAsignado = trabajo?.profesionalAsignadoId === usuario?._id

  async function ofertar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!precio || Number(precio) <= 0) {
      setError('Ingresá un precio válido')
      return
    }
    setAccionando(true)
    try {
      await api.post(`/servicios/trabajo/${id}/bid`, { precioOfrecido: Number(precio), notas })
      setPrecio('')
      setNotas('')
      await cargar()
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al enviar la oferta')
    } finally {
      setAccionando(false)
    }
  }

  async function aceptarBid(bidId: string) {
    setAccionando(true)
    setError('')
    try {
      await api.patch(`/servicios/trabajo/${id}/bid/${bidId}/aceptar`)
      await cargar()
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al aceptar la oferta')
    } finally {
      setAccionando(false)
    }
  }

  async function cancelar() {
    if (!confirm('¿Seguro que querés cancelar este trabajo?')) return
    setAccionando(true)
    try {
      await api.patch(`/servicios/trabajo/${id}/cancelar`)
      await cargar()
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al cancelar')
    } finally {
      setAccionando(false)
    }
  }

  async function completar() {
    setAccionando(true)
    try {
      await api.patch(`/servicios/trabajo/${id}/completar`)
      await cargar()
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al completar')
    } finally {
      setAccionando(false)
    }
  }

  async function enviarResena(e: React.FormEvent) {
    e.preventDefault()
    setAccionando(true)
    try {
      await api.post(`/servicios/resena/trabajo/${id}`, { calificacion, comentario })
      setResenaEnviada(true)
      setMostrarResena(false)
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al enviar la reseña')
    } finally {
      setAccionando(false)
    }
  }

  // Inicia el chat con la otra parte enviando un primer mensaje
  async function coordinarChat(otroUsuarioId: string) {
    try {
      await api.post('/mensajes', {
        receptorId: otroUsuarioId,
        mensaje: `Hola! Coordinemos por el trabajo "${trabajo?.titulo}".`
      })
    } catch {
      // Si falla el primer mensaje igual lo llevamos al chat
    }
    navigate('/chat')
  }

  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center"><div className="spinner" /></div>
  }

  if (error && !trabajo) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-lg text-red-600 mb-4">{error}</p>
          <button onClick={() => navigate('/trabajos')} className="mlbtn ml-grad text-white px-6 py-2 rounded-lg">Volver a la bolsa</button>
        </div>
      </div>
    )
  }

  if (!trabajo) return null

  const estadoInfo = etiquetaEstado[trabajo.estado] || { texto: trabajo.estado, clase: 'bg-ml-bg text-ml-soft border-ml-line' }

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate('/trabajos')} className="text-white/80 hover:text-white mb-4 flex items-center gap-2">← Volver</button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

        {/* Detalle del trabajo */}
        <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
            <h1 className="text-2xl font-extrabold text-ml-ink">{trabajo.titulo}</h1>
            <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border ${estadoInfo.clase}`}>{estadoInfo.texto}</span>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <img src={trabajo.clienteId?.avatar || 'https://via.placeholder.com/36'} alt={trabajo.clienteId?.nombre} className="w-9 h-9 rounded-full object-cover" />
            <div>
              <p className="text-sm font-semibold text-ml-ink leading-none">{trabajo.clienteId?.nombre}</p>
              <p className="text-xs text-ml-muted mt-0.5 capitalize">{trabajo.rubro} · 📍 {trabajo.localidad}</p>
            </div>
          </div>

          <p className="text-ml-soft leading-relaxed whitespace-pre-line mb-4">{trabajo.descripcion}</p>

          {trabajo.skills && trabajo.skills.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-4">
              {trabajo.skills.map(s => (
                <span key={s} className="bg-ml-bg border border-ml-line px-3 py-1 rounded-full text-sm text-ml-soft">{s}</span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm border-t border-ml-line pt-4">
            <div>
              <p className="text-ml-muted">Presupuesto</p>
              <p className="font-bold text-ml-ink">{formatoPresupuesto(trabajo.presupuestoMin, trabajo.presupuestoMax)}</p>
            </div>
            {trabajo.plazoEntrega && (
              <div>
                <p className="text-ml-muted">Fecha límite</p>
                <p className="font-bold text-ml-ink">{new Date(trabajo.plazoEntrega).toLocaleDateString('es-AR')}</p>
              </div>
            )}
          </div>
        </div>

        {/* === VISTA PROFESIONAL (no dueño) === */}
        {!esDueno && (
          <>
            {soyAsignado && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
                <p className="text-blue-800 font-semibold mb-3">🎉 ¡Te asignaron este trabajo!</p>
                <button onClick={() => coordinarChat(trabajo.clienteId._id)} className="mlbtn ml-grad text-white px-6 py-2.5 rounded-lg font-bold">
                  💬 Coordinar por chat
                </button>
              </div>
            )}

            {miOferta ? (
              <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6">
                <h2 className="text-lg font-bold text-ml-ink mb-3">Tu oferta</h2>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-extrabold text-ml-violet">${miOferta.precioOfrecido.toLocaleString('es-AR')}</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    miOferta.estado === 'aceptada' ? 'bg-green-50 text-green-700 border-green-200' :
                    miOferta.estado === 'rechazada' ? 'bg-red-50 text-red-600 border-red-200' :
                    'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {miOferta.estado === 'aceptada' ? 'Aceptada' : miOferta.estado === 'rechazada' ? 'No seleccionada' : 'Pendiente'}
                  </span>
                </div>
                {miOferta.notas && <p className="text-ml-soft mt-3 text-sm">{miOferta.notas}</p>}
              </div>
            ) : trabajo.estado === 'activo' ? (
              <form onSubmit={ofertar} className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 space-y-4">
                <h2 className="text-lg font-bold text-ml-ink">Hacé tu oferta</h2>
                <div>
                  <label className="block text-sm font-semibold text-ml-ink mb-2">Precio ofrecido *</label>
                  <input
                    type="number"
                    min="1"
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                    placeholder="$"
                    className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-ml-ink mb-2">Propuesta / notas</label>
                  <textarea
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Contale por qué sos la mejor opción, qué incluye tu precio, plazos, etc."
                    className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet h-24"
                  />
                </div>
                <button type="submit" disabled={accionando} className="w-full py-3 mlbtn ml-grad text-white rounded-lg font-bold disabled:opacity-60">
                  {accionando ? 'Enviando...' : 'Enviar oferta'}
                </button>
              </form>
            ) : (
              <div className="bg-white rounded-2xl border border-ml-line p-6 text-center text-ml-muted">
                Este trabajo ya no recibe ofertas.
              </div>
            )}
          </>
        )}

        {/* === VISTA CLIENTE (dueño) === */}
        {esDueno && (
          <>
            {/* Acciones de estado */}
            {trabajo.estado === 'activo' && (
              <div className="flex justify-end">
                <button onClick={cancelar} disabled={accionando} className="text-sm text-red-600 hover:text-red-700 font-semibold">
                  Cancelar trabajo
                </button>
              </div>
            )}

            {trabajo.estado === 'asignado' && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-blue-800 font-semibold">Trabajo asignado. Coordiná los detalles con el profesional.</p>
                <div className="flex gap-2">
                  {trabajo.profesionalAsignadoId && (
                    <button onClick={() => coordinarChat(trabajo.profesionalAsignadoId!)} className="px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg font-semibold hover:bg-blue-100">💬 Chat</button>
                  )}
                  <button onClick={completar} disabled={accionando} className="mlbtn ml-grad text-white px-4 py-2 rounded-lg font-bold">Marcar completado</button>
                </div>
              </div>
            )}

            {trabajo.estado === 'completado' && (
              <div className="bg-violet-50 border border-violet-200 rounded-2xl p-6 text-center">
                {resenaEnviada ? (
                  <p className="text-ml-violet font-semibold">✓ ¡Gracias por tu reseña!</p>
                ) : (
                  <>
                    <p className="text-ml-ink font-semibold mb-3">El trabajo está completado. ¿Cómo fue tu experiencia?</p>
                    <button onClick={() => setMostrarResena(true)} className="mlbtn ml-grad text-white px-6 py-2.5 rounded-lg font-bold">⭐ Dejar reseña</button>
                  </>
                )}
              </div>
            )}

            {/* Lista de ofertas */}
            <div>
              <h2 className="text-lg font-bold text-ml-ink mb-4">
                Ofertas recibidas ({bids.length})
              </h2>
              {bids.length === 0 ? (
                <div className="bg-white rounded-2xl border border-ml-line p-8 text-center text-ml-muted">
                  Todavía no recibiste ofertas. Compartí tu publicación para llegar a más profesionales.
                </div>
              ) : (
                <div className="space-y-3">
                  {bids.map(bid => {
                    const prof = typeof bid.profesionalId === 'string' ? null : bid.profesionalId
                    const perfil = bid.perfilProfesional
                    return (
                      <div key={bid._id} className={`bg-white rounded-2xl shadow-sm border p-5 ${bid.estado === 'aceptada' ? 'border-green-300 ring-1 ring-green-200' : 'border-ml-line'}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <img src={prof?.avatar || 'https://via.placeholder.com/44'} alt={prof?.nombre} className="w-11 h-11 rounded-full object-cover" />
                            <div>
                              <button onClick={() => prof && navigate(`/servicios/perfil/${prof._id}`)} className="font-semibold text-ml-ink hover:text-ml-violet">
                                {prof?.nombre || 'Profesional'}
                              </button>
                              {perfil && (
                                <p className="text-xs text-ml-muted">
                                  <span className="text-yellow-500">★</span> {perfil.calificacion ? perfil.calificacion.toFixed(1) : '—'} · {perfil.totalTrabajos} trabajos · <span className="capitalize">{perfil.rubro}</span>
                                </p>
                              )}
                            </div>
                          </div>
                          <p className="text-xl font-extrabold text-ml-violet shrink-0">${bid.precioOfrecido.toLocaleString('es-AR')}</p>
                        </div>

                        {bid.notas && <p className="text-ml-soft text-sm mt-3 pl-14">{bid.notas}</p>}

                        {/* Acción aceptar (solo si trabajo activo) */}
                        {trabajo.estado === 'activo' && bid.estado === 'activa' && (
                          <div className="flex justify-end mt-3">
                            <button onClick={() => aceptarBid(bid._id)} disabled={accionando} className="mlbtn ml-grad text-white px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-60">
                              Aceptar esta oferta
                            </button>
                          </div>
                        )}
                        {bid.estado === 'aceptada' && (
                          <p className="text-right text-sm font-semibold text-green-700 mt-2">✓ Oferta aceptada</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal de reseña */}
      {mostrarResena && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center px-4 z-50" onClick={() => setMostrarResena(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={enviarResena} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-ml-ink">Reseñar al profesional</h3>
            <div>
              <p className="text-sm font-semibold text-ml-ink mb-2">Calificación</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setCalificacion(n)} className={`text-3xl ${n <= calificacion ? 'text-yellow-500' : 'text-ml-line'}`}>★</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Comentario (opcional)</label>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet h-24"
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setMostrarResena(false)} className="flex-1 py-2.5 border border-ml-line rounded-lg font-semibold text-ml-soft hover:bg-ml-bg">Cancelar</button>
              <button type="submit" disabled={accionando} className="flex-1 py-2.5 mlbtn ml-grad text-white rounded-lg font-bold disabled:opacity-60">Enviar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
