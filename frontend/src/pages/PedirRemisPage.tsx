import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { LOCALIDADES } from '../constants/localidades'

interface Remisero {
  usuarioId: string
  usuario?: { _id: string; nombre: string; avatar: string } | null
  nombreServicio: string
  vehiculo?: { tipo: string }
  calificacion: number
  totalViajes: number
  precioEstimado: number
  cubreCiudad?: boolean
}

const TIPOS = [
  { id: 'traslado', titulo: 'Traslado simple', desc: 'Te llevo de un punto a otro', icono: '🚗' },
  { id: 'ida_vuelta', titulo: 'Ida y vuelta', desc: 'Te llevo, espero un rato y te traigo', icono: '🔁' },
  { id: 'dia_compras', titulo: 'Día de compras', desc: 'Te llevo, te acompaño/espero y te devuelvo a casa', icono: '🛍️' }
]

export default function PedirRemisPage() {
  const navigate = useNavigate()

  // Datos del viaje
  const [origenDir, setOrigenDir] = useState('')
  const [origenCiudad, setOrigenCiudad] = useState('')
  const [origenRef, setOrigenRef] = useState('')
  const [destinoDir, setDestinoDir] = useState('')
  const [destinoCiudad, setDestinoCiudad] = useState('')
  const [destinoRef, setDestinoRef] = useState('')
  const [tipoServicio, setTipoServicio] = useState('traslado')
  const [distanciaKm, setDistanciaKm] = useState('')
  const [horasEspera, setHorasEspera] = useState('')
  const [pasajeros, setPasajeros] = useState(1)
  const [notas, setNotas] = useState('')
  const [pagoEfectivo, setPagoEfectivo] = useState(false)

  // Conductores disponibles
  const [remiseros, setRemiseros] = useState<Remisero[]>([])
  const [buscando, setBuscando] = useState(false)
  const [busco, setBusco] = useState(false)
  const [pidiendo, setPidiendo] = useState(false)
  const [error, setError] = useState('')

  const requiereEspera = tipoServicio !== 'traslado'

  async function buscarRemiseros() {
    if (!origenDir.trim() || !destinoDir.trim()) {
      setError('Completá origen y destino para ver conductores')
      return
    }
    setError('')
    setBuscando(true)
    try {
      const params = new URLSearchParams()
      if (origenCiudad) params.append('ciudad', origenCiudad)
      if (distanciaKm) params.append('distanciaKm', distanciaKm)
      if (horasEspera && requiereEspera) params.append('horasEspera', horasEspera)
      const res = await api.get(`/remis/disponibles?${params.toString()}`)
      setRemiseros(res.data || [])
      setBusco(true)
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudieron cargar los conductores')
    } finally {
      setBuscando(false)
    }
  }

  async function pedir(comisionistaIdPreferido?: string) {
    if (!origenDir.trim() || !destinoDir.trim()) {
      setError('Completá origen y destino')
      return
    }
    setPidiendo(true)
    setError('')
    try {
      const payload: any = {
        origen: { direccion: origenDir, ciudad: origenCiudad, referencia: origenRef },
        destino: { direccion: destinoDir, ciudad: destinoCiudad, referencia: destinoRef },
        tipoServicio,
        distanciaKm: distanciaKm ? Number(distanciaKm) : 0,
        horasEspera: requiereEspera && horasEspera ? Number(horasEspera) : 0,
        pasajeros,
        notas,
        pagoEfectivo
      }
      if (comisionistaIdPreferido) payload.comisionistaIdPreferido = comisionistaIdPreferido
      await api.post('/remis/pedir', payload)
      navigate('/remis/mis-viajes')
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo pedir el remis')
      setPidiendo(false)
    }
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => navigate(-1)} className="text-white/80 hover:text-white mb-3 flex items-center gap-2">← Volver</button>
          <h1 className="text-3xl font-extrabold flex items-center gap-2">🚕 Pedir un remis</h1>
          <p className="text-white/90 mt-2">Sin llamadas ni mensajes. Pedí desde acá y seguí tu viaje en vivo.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

        {/* Tipo de servicio */}
        <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6">
          <label className="block text-sm font-bold text-ml-ink mb-3">¿Qué necesitás?</label>
          <div className="grid sm:grid-cols-3 gap-3">
            {TIPOS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTipoServicio(t.id)}
                className={`text-left p-4 rounded-xl border-2 transition ${tipoServicio === t.id ? 'border-ml-violet bg-violet-50' : 'border-ml-line hover:border-ml-violet/40'}`}
              >
                <div className="text-2xl mb-1">{t.icono}</div>
                <div className="font-bold text-ml-ink text-sm">{t.titulo}</div>
                <div className="text-xs text-ml-muted mt-1">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Origen y destino */}
        <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-ml-ink mb-2">📍 Te paso a buscar en</label>
            <input value={origenDir} onChange={e => setOrigenDir(e.target.value)} placeholder="Dirección (calle y número)" className="w-full px-3 py-2 border border-ml-line rounded-lg text-sm mb-2" />
            <div className="grid grid-cols-2 gap-2">
              <select value={origenCiudad} onChange={e => setOrigenCiudad(e.target.value)} className="px-3 py-2 border border-ml-line rounded-lg text-sm bg-white">
                <option value="">Localidad</option>
                {LOCALIDADES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <input value={origenRef} onChange={e => setOrigenRef(e.target.value)} placeholder="Referencia (portón, timbre)" className="px-3 py-2 border border-ml-line rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-ml-ink mb-2">🏁 Destino</label>
            <input value={destinoDir} onChange={e => setDestinoDir(e.target.value)} placeholder="Dirección (calle y número)" className="w-full px-3 py-2 border border-ml-line rounded-lg text-sm mb-2" />
            <div className="grid grid-cols-2 gap-2">
              <select value={destinoCiudad} onChange={e => setDestinoCiudad(e.target.value)} className="px-3 py-2 border border-ml-line rounded-lg text-sm bg-white">
                <option value="">Localidad</option>
                {LOCALIDADES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <input value={destinoRef} onChange={e => setDestinoRef(e.target.value)} placeholder="Referencia" className="px-3 py-2 border border-ml-line rounded-lg text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ml-muted mb-1">Distancia aprox. (km)</label>
              <input type="number" min={0} value={distanciaKm} onChange={e => setDistanciaKm(e.target.value)} placeholder="Opcional" className="w-full px-3 py-2 border border-ml-line rounded-lg text-sm" />
            </div>
            {requiereEspera && (
              <div>
                <label className="block text-xs font-semibold text-ml-muted mb-1">Horas de espera</label>
                <input type="number" min={0} value={horasEspera} onChange={e => setHorasEspera(e.target.value)} placeholder="Ej: 3" className="w-full px-3 py-2 border border-ml-line rounded-lg text-sm" />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-ml-muted mb-1">Pasajeros</label>
              <input type="number" min={1} max={8} value={pasajeros} onChange={e => setPasajeros(Math.max(1, Number(e.target.value) || 1))} className="w-full px-3 py-2 border border-ml-line rounded-lg text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ml-muted mb-1">Notas para el conductor</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej: tengo dos bolsos, voy con un nene" className="w-full px-3 py-2 border border-ml-line rounded-lg text-sm h-16" />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={pagoEfectivo} onChange={e => setPagoEfectivo(e.target.checked)} className="mt-1 w-4 h-4" />
              <div>
                <div className="font-semibold text-sm text-amber-900">¿Querés pagar en efectivo?</div>
                <div className="text-xs text-amber-800 mt-1">
                  ℹ️ Es excepcional. El conductor debe aceptarlo. Si acepta, le quedarás debiendo la comisión de la plataforma que podrá cobrar después.
                  <strong className="block mt-1">Atención:</strong> Si el conductor acumula más de 3 semanas sin pagar la comisión, su cuenta se bloquea.
                </div>
              </div>
            </label>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <button onClick={buscarRemiseros} disabled={buscando} className="px-5 py-2.5 border border-ml-violet text-ml-violet rounded-lg text-sm font-bold hover:bg-violet-50 disabled:opacity-60">
              {buscando ? 'Buscando...' : '🔎 Ver conductores y precios'}
            </button>
            <button onClick={() => pedir()} disabled={pidiendo} className="px-5 py-2.5 mlbtn ml-grad text-white rounded-lg text-sm font-bold disabled:opacity-60">
              {pidiendo ? 'Pidiendo...' : '🚕 Pedir a cualquiera disponible'}
            </button>
          </div>
        </div>

        {/* Conductores disponibles */}
        {busco && (
          <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6">
            <h2 className="text-lg font-extrabold text-ml-ink mb-4">Conductores disponibles ahora</h2>
            {remiseros.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-3xl mb-2">😕</p>
                <p className="text-ml-muted text-sm mb-3">No hay conductores conectados en este momento.</p>
                <p className="text-ml-muted text-xs">Igual podés dejar el pedido abierto: el primero que se conecte y lo tome te avisa.</p>
                <button onClick={() => pedir()} disabled={pidiendo} className="mt-3 px-5 py-2 mlbtn ml-grad text-white rounded-lg text-sm font-bold disabled:opacity-60">Dejar pedido abierto</button>
              </div>
            ) : (
              <div className="space-y-3">
                {remiseros.map(r => (
                  <div key={r.usuarioId} className="flex items-center gap-3 p-3 border border-ml-line rounded-xl">
                    <div className="w-12 h-12 rounded-full bg-ml-bg overflow-hidden flex items-center justify-center shrink-0">
                      {r.usuario?.avatar ? <img src={r.usuario.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-xl">🧑‍✈️</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-ml-ink text-sm truncate">{r.nombreServicio || r.usuario?.nombre || 'Conductor'}</p>
                      <p className="text-xs text-ml-muted">⭐ {r.calificacion?.toFixed(1) || '—'} · {r.totalViajes || 0} viajes {r.cubreCiudad ? '· 📍 cubre tu zona' : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {r.precioEstimado > 0 && <p className="font-extrabold text-ml-violet">${r.precioEstimado.toLocaleString('es-AR')}</p>}
                      <button onClick={() => pedir(r.usuario?._id || r.usuarioId)} disabled={pidiendo} className="mt-1 px-3 py-1.5 mlbtn ml-grad text-white rounded-lg text-xs font-bold disabled:opacity-60">Pedir a este</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-ml-muted mt-4">El precio es una estimación según las tarifas del conductor (bajada de bandera + km + horas de espera). El precio final lo confirma el conductor al terminar.</p>
          </div>
        )}
      </div>
    </div>
  )
}
