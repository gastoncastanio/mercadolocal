import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import MapaRumbo from '../components/MapaRumbo'

interface PuntoViaje { ciudad: string; lat?: number | null; lng?: number | null }
interface Viaje {
  _id: string
  comisionistaId: string
  comisionista?: { _id: string; nombre: string; avatar: string } | null
  origen: PuntoViaje
  destino: PuntoViaje
  paradas?: PuntoViaje[]
  fechaSalida: string
  horaSalida: string
  tarifas: { bultoChico: number; bultoMediano: number; bultoGrande: number }
  capacidadTotal: number
  capacidadDisponible: number
  notas: string
  estado: string
}

const TAMANOS = [
  { value: 'chico', label: 'Chico', campo: 'bultoChico' as const },
  { value: 'mediano', label: 'Mediano', campo: 'bultoMediano' as const },
  { value: 'grande', label: 'Grande', campo: 'bultoGrande' as const }
]

export default function DetalleViajePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario, estaLogueado } = useAuth()
  const [viaje, setViaje] = useState<Viaje | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // Form de contratación
  const [tamano, setTamano] = useState('chico')
  const [cantidad, setCantidad] = useState(1)
  const [descripcion, setDescripcion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [codigoEntrega, setCodigoEntrega] = useState('')
  const [envioId, setEnvioId] = useState<string | null>(null) // para pagar después

  useEffect(() => { if (id) cargar() }, [id])

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      const res = await api.get(`/comisionistas/viaje/${id}`)
      setViaje(res.data)
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo cargar el viaje')
    } finally {
      setCargando(false)
    }
  }

  const tarifaActual = viaje
    ? viaje.tarifas[TAMANOS.find(t => t.value === tamano)!.campo]
    : 0
  const precioTotal = tarifaActual * cantidad

  async function pagarEnvio() {
    if (!envioId) return
    setEnviando(true)
    setError('')
    try {
      const res = await api.post(`/comisionistas/envio/${envioId}/pagar`)
      if (res.data?.initPoint) {
        window.location.href = res.data.initPoint
      } else {
        setError('No se obtuvo URL de pago. Intentá de nuevo.')
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo proceder al pago')
      setEnviando(false)
    }
  }

  async function contratar(e: React.FormEvent) {
    e.preventDefault()
    if (!estaLogueado) { navigate(`/login?redirect=/comisionistas/viaje/${id}`); return }
    setEnviando(true)
    setError('')
    try {
      const res = await api.post(`/comisionistas/viaje/${id}/contratar`, {
        tamano, cantidadBultos: cantidad, descripcion
      })
      const codigo = res.data.codigoEntrega
      const eid = res.data.envio?._id
      setCodigoEntrega(codigo)
      setEnvioId(eid || null)
      // Guardamos el código en este dispositivo para poder mostrarlo luego en Mis envíos.
      if (eid) {
        localStorage.setItem(`ml_envio_codigo_${eid}`, codigo)
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo reservar el envío')
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center"><div className="spinner" /></div>
  }

  if (error && !viaje) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-lg text-red-600 mb-4">{error}</p>
          <button onClick={() => navigate('/comisionistas')} className="mlbtn ml-grad text-white px-6 py-2 rounded-lg">Volver a viajes</button>
        </div>
      </div>
    )
  }

  if (!viaje) return null

  const esPropio = usuario?._id === viaje.comisionistaId
  const abierto = viaje.estado === 'programado' && viaje.capacidadDisponible > 0

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => navigate('/comisionistas')} className="text-white/80 hover:text-white mb-4 flex items-center gap-2">← Volver</button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

        {/* Detalle del viaje */}
        <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6">
          <div className="flex items-center gap-3 text-2xl font-extrabold text-ml-ink mb-2">
            <span>{viaje.origen.ciudad}</span>
            <span className="text-ml-violet">→</span>
            <span>{viaje.destino.ciudad}</span>
          </div>
          <p className="text-ml-soft mb-4">
            📅 {new Date(viaje.fechaSalida).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {viaje.horaSalida ? ` · ${viaje.horaSalida}` : ''}
          </p>

          {/* Ciudades en el camino */}
          {viaje.paradas && viaje.paradas.length > 0 && (
            <p className="text-sm text-ml-muted mb-3">
              🛣️ Pasa por: {viaje.paradas.map(p => p.ciudad).join(' · ')}
            </p>
          )}

          {/* Mapa del rumbo (solo si hay puntos geolocalizados) */}
          {(viaje.origen?.lat != null || viaje.destino?.lat != null || (viaje.paradas || []).some(p => p.lat != null)) && (
            <div className="mb-4">
              <MapaRumbo origen={viaje.origen} destino={viaje.destino} paradas={viaje.paradas || []} altura={260} />
            </div>
          )}

          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-ml-line">
            <img src={viaje.comisionista?.avatar || 'https://via.placeholder.com/40'} alt={viaje.comisionista?.nombre} className="w-10 h-10 rounded-full object-cover" />
            <div>
              <p className="text-sm font-semibold text-ml-ink">{viaje.comisionista?.nombre || 'Comisionista'}</p>
              <p className="text-xs text-ml-muted">Comisionista</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center mb-4">
            {TAMANOS.map(t => (
              <div key={t.value} className="bg-ml-bg rounded-lg py-3">
                <p className="text-xs text-ml-muted">{t.label}</p>
                <p className="font-bold text-ml-ink">${viaje.tarifas[t.campo].toLocaleString('es-AR')}</p>
              </div>
            ))}
          </div>

          <p className="text-sm text-ml-muted">{viaje.capacidadDisponible} de {viaje.capacidadTotal} bulto(s) disponibles</p>
          {viaje.notas && <p className="text-ml-soft text-sm mt-3 whitespace-pre-line">{viaje.notas}</p>}
        </div>

        {/* Código de entrega tras reservar */}
        {codigoEntrega ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <p className="text-green-800 font-semibold mb-2">✓ ¡Reserva confirmada!</p>
            <p className="text-sm text-ml-soft mb-3">Guardá este código de entrega. Se lo das al comisionista cuando recibas el bulto para cerrar el envío:</p>
            <p className="text-3xl font-extrabold tracking-widest text-ml-ink bg-white border border-green-200 rounded-xl py-3 mb-4">{codigoEntrega}</p>
            <div className="flex gap-2 justify-center flex-wrap">
              <button onClick={pagarEnvio} disabled={enviando} className="mlbtn ml-grad text-white px-5 py-2 rounded-lg font-bold disabled:opacity-60">
                {enviando ? 'Procesando...' : '💳 Proceder al pago'}
              </button>
              <button onClick={() => navigate('/comisionistas/mis-envios')} className="px-5 py-2 border border-ml-line rounded-lg font-bold hover:bg-ml-bg">Ver mis envíos</button>
            </div>
          </div>
        ) : esPropio ? (
          <div className="bg-white rounded-2xl border border-ml-line p-6 text-center text-ml-muted">Este es tu propio viaje.</div>
        ) : !abierto ? (
          <div className="bg-white rounded-2xl border border-ml-line p-6 text-center text-ml-muted">Este viaje ya no recibe reservas.</div>
        ) : (
          <form onSubmit={contratar} className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 space-y-4">
            <h2 className="text-lg font-bold text-ml-ink">Reservar un envío</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-ml-ink mb-2">Tamaño del bulto</label>
                <select value={tamano} onChange={(e) => setTamano(e.target.value)} className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet">
                  {TAMANOS.map(t => <option key={t.value} value={t.value}>{t.label} (${viaje.tarifas[t.campo].toLocaleString('es-AR')})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-ml-ink mb-2">Cantidad</label>
                <input type="number" min={1} max={viaje.capacidadDisponible} value={cantidad} onChange={(e) => setCantidad(Math.max(1, Number(e.target.value)))} className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">¿Qué enviás? (opcional)</label>
              <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: caja con repuestos" className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet" />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-ml-line">
              <span className="text-ml-muted">Total</span>
              <span className="text-2xl font-extrabold text-ml-violet">${precioTotal.toLocaleString('es-AR')}</span>
            </div>
            <button type="submit" disabled={enviando} className="w-full py-3 mlbtn ml-grad text-white rounded-lg font-bold disabled:opacity-60">
              {enviando ? 'Reservando...' : 'Reservar envío'}
            </button>
            <p className="text-xs text-ml-muted text-center">El comisionista confirma la reserva. Coordinan la entrega por chat.</p>
          </form>
        )}
      </div>
    </div>
  )
}
