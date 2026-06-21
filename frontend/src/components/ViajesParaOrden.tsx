import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

interface PuntoViaje { ciudad: string; lat?: number | null; lng?: number | null }
interface Viaje {
  _id: string
  comisionista?: { _id: string; nombre: string; avatar: string } | null
  origen: PuntoViaje
  destino: PuntoViaje
  paradas?: PuntoViaje[]
  fechaSalida: string
  horaSalida: string
  tarifas: { bultoChico: number; bultoMediano: number; bultoGrande: number }
  capacidadDisponible: number
}

interface Props {
  ordenId: string
  onContratado?: () => void
}

const TAMANOS = [
  { value: 'chico', label: 'Chico', campo: 'bultoChico' as const },
  { value: 'mediano', label: 'Mediano', campo: 'bultoMediano' as const },
  { value: 'grande', label: 'Grande', campo: 'bultoGrande' as const }
]

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * Cross-checkout: lista los viajes programados que van de la ciudad del vendedor
 * a la ciudad de entrega de la orden, y permite contratar uno (crea un
 * EnvioComisionista ligado a la orden). Tras contratar, lleva a pagar.
 */
export default function ViajesParaOrden({ ordenId, onContratado }: Props) {
  const navigate = useNavigate()
  const [viajes, setViajes] = useState<Viaje[]>([])
  const [ciudades, setCiudades] = useState<{ origen: string; destino: string }>({ origen: '', destino: '' })
  const [yaAsignado, setYaAsignado] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [tamano, setTamano] = useState('chico')
  const [contratando, setContratando] = useState(false)

  useEffect(() => { cargar() }, [ordenId])

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      const res = await api.get(`/comisionistas/viajes-para-orden/${ordenId}`)
      setViajes(res.data.viajes || [])
      setCiudades({ origen: res.data.ciudadOrigen || '', destino: res.data.ciudadDestino || '' })
      setYaAsignado(!!res.data.yaAsignado)
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudieron cargar los viajes')
    } finally {
      setCargando(false)
    }
  }

  async function contratar(viaje: Viaje) {
    setContratando(true)
    setError('')
    try {
      const res = await api.post(`/comisionistas/viaje/${viaje._id}/contratar`, {
        ordenId,
        tamano,
        cantidadBultos: 1
      })
      const eid = res.data.envio?._id
      const codigo = res.data.codigoEntrega
      if (eid && codigo) localStorage.setItem(`ml_envio_codigo_${eid}`, codigo)
      onContratado?.()
      // Llevar a pagar el envío (mis envíos tiene el botón de pago).
      navigate('/comisionistas/mis-envios')
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo contratar el envío')
      setContratando(false)
    }
  }

  if (cargando) {
    return <div className="py-6 text-center text-ml-muted text-sm">Buscando viajes disponibles...</div>
  }

  if (yaAsignado) {
    return (
      <div className="text-center py-6 bg-green-50 rounded-xl border border-green-200">
        <p className="text-sm text-green-800 font-semibold">✓ Esta orden ya tiene un envío de comisionista asignado.</p>
        <button onClick={() => navigate('/comisionistas/mis-envios')} className="text-xs text-ml-blue hover:underline mt-2">Ver mis envíos →</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

      {ciudades.origen && ciudades.destino && (
        <p className="text-sm text-ml-soft">
          🗺️ Viajes de <strong>{ciudades.origen}</strong> a <strong>{ciudades.destino}</strong>
        </p>
      )}

      {viajes.length === 0 ? (
        <div className="text-center py-8 bg-ml-bg rounded-xl border border-ml-line">
          <p className="text-3xl mb-2">🛣️</p>
          <p className="text-ml-muted text-sm">
            {(!ciudades.origen || !ciudades.destino)
              ? 'No pudimos determinar las ciudades de origen y destino de esta orden.'
              : 'No hay viajes programados en esta ruta por ahora.'}
          </p>
          <p className="text-ml-muted text-xs mt-1">Probá con "Comisionista en vivo" o coordiná con el vendedor.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {viajes.map(v => (
            <div key={v._id} className="rounded-xl border border-ml-line bg-white p-4">
              <div className="flex items-start gap-3">
                <img src={v.comisionista?.avatar || 'https://via.placeholder.com/48'} alt="" width={48} height={48} className="w-12 h-12 rounded-full object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ml-ink">{v.comisionista?.nombre || 'Comisionista'}</p>
                  <p className="text-xs text-ml-muted mt-0.5">
                    📅 {fmtFecha(v.fechaSalida)}{v.horaSalida ? ` · ${v.horaSalida}` : ''} · {v.capacidadDisponible} cupo(s)
                  </p>
                  <p className="text-xs text-ml-soft mt-0.5">{v.origen.ciudad} → {v.destino.ciudad}</p>
                </div>
                <button
                  onClick={() => { setSeleccionado(seleccionado === v._id ? null : v._id); setError('') }}
                  className="shrink-0 px-3 py-2 text-sm font-bold rounded-lg mlbtn ml-grad text-white"
                >
                  {seleccionado === v._id ? 'Cerrar' : 'Contratar'}
                </button>
              </div>

              {/* Form de contratación inline */}
              {seleccionado === v._id && (
                <div className="mt-4 pt-4 border-t border-ml-line space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-ml-ink mb-1">Tamaño del bulto</label>
                    <select value={tamano} onChange={(e) => setTamano(e.target.value)} className="w-full px-3 py-2 text-sm border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet">
                      {TAMANOS.map(t => <option key={t.value} value={t.value}>{t.label} (${v.tarifas[t.campo].toLocaleString('es-AR')})</option>)}
                    </select>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ml-muted">Precio del traslado</span>
                    <span className="font-extrabold text-ml-violet">${v.tarifas[TAMANOS.find(t => t.value === tamano)!.campo].toLocaleString('es-AR')}</span>
                  </div>
                  <button onClick={() => contratar(v)} disabled={contratando} className="w-full py-2.5 text-sm font-bold rounded-lg mlbtn ml-grad text-white disabled:opacity-50">
                    {contratando ? 'Contratando...' : 'Contratar y pagar'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
