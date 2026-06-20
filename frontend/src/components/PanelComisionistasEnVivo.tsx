import { useState, useEffect } from 'react'
import api from '../services/api'
import DeslindeComisionista from './DeslindeComisionista'

interface ComisionistaVivo {
  _id: string
  usuarioId: string
  usuario?: { _id: string; nombre: string; avatar: string } | null
  nombreServicio: string
  descripcion: string
  vehiculo: { tipo: string; patente: string; capacidadBultos: number }
  zonasHabituales: string[]
  calificacion: number
  totalViajes: number
  dniVerificado: boolean
  cubreDestino?: boolean
}

interface Props {
  ordenId: string
  ciudadDestino?: string
  onSolicitado?: () => void
}

/**
 * Panel "Comisionista en vivo": lista los comisionistas que están trabajando
 * AHORA (documento verificado) y permite enviarles una solicitud de cotización
 * para trasladar la compra. Requiere aceptar el deslinde de responsabilidad.
 */
export default function PanelComisionistasEnVivo({ ordenId, ciudadDestino, onSolicitado }: Props) {
  const [lista, setLista] = useState<ComisionistaVivo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [seleccionado, setSeleccionado] = useState<ComisionistaVivo | null>(null)
  const [aceptado, setAceptado] = useState(false)
  const [descripcion, setDescripcion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviados, setEnviados] = useState<string[]>([])

  useEffect(() => { cargar() }, [ciudadDestino])

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      const q = ciudadDestino ? `?ciudadDestino=${encodeURIComponent(ciudadDestino)}` : ''
      const res = await api.get(`/comisionistas/en-vivo${q}`)
      setLista(res.data || [])
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudieron cargar los comisionistas')
    } finally {
      setCargando(false)
    }
  }

  async function solicitar() {
    if (!seleccionado) return
    if (!aceptado) { setError('Tenés que aceptar los términos para continuar'); return }
    setEnviando(true)
    setError('')
    try {
      await api.post('/comisionistas/cotizacion', {
        ordenId,
        comisionistaId: seleccionado.usuarioId,
        descripcionCarga: descripcion,
        terminosAceptados: true
      })
      setEnviados(prev => [...prev, seleccionado.usuarioId])
      setSeleccionado(null)
      setAceptado(false)
      setDescripcion('')
      onSolicitado?.()
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo enviar la solicitud')
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) {
    return <div className="py-6 text-center text-ml-muted text-sm">Buscando comisionistas activos...</div>
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

      {lista.length === 0 ? (
        <div className="text-center py-8 bg-ml-bg rounded-xl border border-ml-line">
          <p className="text-3xl mb-2">🚚</p>
          <p className="text-ml-muted text-sm">No hay comisionistas trabajando en este momento.</p>
          <p className="text-ml-muted text-xs mt-1">Volvé a intentar más tarde o coordiná el envío con el vendedor.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="font-semibold text-ml-ink">{lista.length} comisionista(s) trabajando ahora</span>
          </div>

          <div className="space-y-3">
            {lista.map(c => {
              const yaEnviado = enviados.includes(c.usuarioId)
              return (
                <div key={c._id} className={`rounded-xl border p-4 ${c.cubreDestino ? 'border-green-300 bg-green-50/40' : 'border-ml-line bg-white'}`}>
                  <div className="flex items-start gap-3">
                    <img
                      src={c.usuario?.avatar || 'https://via.placeholder.com/48'}
                      alt={c.usuario?.nombre}
                      className="w-12 h-12 rounded-full object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-ml-ink">{c.nombreServicio || c.usuario?.nombre || 'Comisionista'}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">✓ Vehículo verificado</span>
                        {c.dniVerificado && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-ml-violet border border-violet-200 font-semibold">DNI ✓</span>}
                        {c.cubreDestino && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">Cubre tu zona</span>}
                      </div>
                      <p className="text-xs text-ml-muted mt-0.5">
                        🚗 {c.vehiculo?.tipo} · ⭐ {c.calificacion?.toFixed(1) || '—'} · {c.totalViajes} viaje(s)
                      </p>
                      {c.zonasHabituales?.length > 0 && (
                        <p className="text-xs text-ml-soft mt-1 truncate">📍 {c.zonasHabituales.join(', ')}</p>
                      )}
                    </div>
                    <button
                      onClick={() => { setSeleccionado(seleccionado?._id === c._id ? null : c); setError('') }}
                      disabled={yaEnviado}
                      className="shrink-0 px-3 py-2 text-sm font-bold rounded-lg mlbtn ml-grad text-white disabled:opacity-50"
                    >
                      {yaEnviado ? '✓ Enviada' : 'Pedir cotización'}
                    </button>
                  </div>

                  {/* Form de solicitud inline */}
                  {seleccionado?._id === c._id && !yaEnviado && (
                    <div className="mt-4 pt-4 border-t border-ml-line space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-ml-ink mb-1">¿Qué hay que trasladar? (opcional)</label>
                        <input
                          type="text"
                          value={descripcion}
                          onChange={(e) => setDescripcion(e.target.value)}
                          placeholder="Ej: caja mediana, frágil"
                          className="w-full px-3 py-2 text-sm border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
                        />
                      </div>
                      <DeslindeComisionista requiereAceptacion aceptado={aceptado} onAceptar={setAceptado} />
                      <button
                        onClick={solicitar}
                        disabled={enviando || !aceptado}
                        className="w-full py-2.5 text-sm font-bold rounded-lg mlbtn ml-grad text-white disabled:opacity-50"
                      >
                        {enviando ? 'Enviando...' : 'Enviar solicitud de cotización'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
