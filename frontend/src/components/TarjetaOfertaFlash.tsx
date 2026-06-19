import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { ahoraServidor, formatearCuenta, guardarCodigo, GANCHO_ICON } from '../utils/canjes'
import CheckoutOferta from './CheckoutOferta'

export interface OfertaFlash {
  _id: string
  comercioId: string
  titulo: string
  descripcion: string
  tipoGancho: string
  valorDescuento: number
  inicioEn: string
  finEn: string
  cupoTotal: number
  cupoRestante: number | null
  bloqueHorario: string
  condiciones: string
  desbloquea: { descripcion: string } | null
  vigente: boolean
  // FASE 3: campos de monetización
  precioFinal?: number
  comisionPorcentaje?: number
  requierePrepagoApp?: boolean
}

interface Props {
  oferta: OfertaFlash
  offsetMs: number          // diferencia reloj server-cliente
  distanciaTexto?: string
  nombreComercio?: string
}

export default function TarjetaOfertaFlash({ oferta, offsetMs, distanciaTexto, nombreComercio }: Props) {
  const { estaLogueado } = useAuth()
  const navigate = useNavigate()
  const [restanteMs, setRestanteMs] = useState(0)
  const [verCondiciones, setVerCondiciones] = useState(false)
  const [reclamando, setReclamando] = useState(false)
  const [error, setError] = useState('')
  const [mostrarCheckout, setMostrarCheckout] = useState(false)

  // Countdown contra la hora del SERVER (reloj local + offset). Nunca confiamos
  // en el reloj del dispositivo para decidir si la oferta sigue viva.
  useEffect(() => {
    const finMs = new Date(oferta.finEn).getTime()
    const tick = () => setRestanteMs(finMs - ahoraServidor(offsetMs))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [oferta.finEn, offsetMs])

  const expirada = restanteMs <= 0
  const sinCupo = oferta.cupoRestante !== null && oferta.cupoRestante <= 0
  const deshabilitada = expirada || sinCupo || reclamando

  function reclamar() {
    setError('')
    if (!estaLogueado) {
      // Fricción cero hasta acá: recién al reclamar/comprar pedimos cuenta.
      navigate('/login?redirect=/radar')
      return
    }

    // FASE 3: si requiere prepago, abre modal de checkout
    if (oferta.requierePrepagoApp && oferta.precioFinal && oferta.comisionPorcentaje !== undefined) {
      setMostrarCheckout(true)
      return
    }

    // Legacy: flujo de código QR postpago (Phase 2)
    reclamarCodigoLegacy()
  }

  async function reclamarCodigoLegacy() {
    setReclamando(true)
    try {
      const res = await api.post(`/centro/ofertas/${oferta._id}/reclamar`)
      const { canjeId, codigo, expiraEn } = res.data
      guardarCodigo(canjeId, codigo, expiraEn)
      navigate('/mis-canjes')
    } catch (e: any) {
      setError(e.response?.data?.error || 'No pudimos generar tu código. Probá de nuevo.')
    } finally {
      setReclamando(false)
    }
  }

  // Color de urgencia del countdown (sin mentir: refleja el tiempo real)
  const urgente = restanteMs > 0 && restanteMs < 5 * 60 * 1000

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-ml-line overflow-hidden">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 flex items-center justify-between text-white">
        <span className="text-xs font-bold flex items-center gap-1">⚡ Oferta relámpago</span>
        <span className={`text-sm font-mono font-bold px-2 py-0.5 rounded-lg ${urgente ? 'bg-red-600 animate-pulse' : 'bg-black/20'}`}>
          {expirada ? 'Finalizó' : `⏳ ${formatearCuenta(restanteMs)}`}
        </span>
      </div>

      <div className="p-4 space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-2xl">{GANCHO_ICON[oferta.tipoGancho] || '🏷️'}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-ml-ink leading-tight">{oferta.titulo}</h3>
            {nombreComercio && <p className="text-xs text-ml-muted">{nombreComercio}</p>}
            {oferta.descripcion && <p className="text-sm text-ml-soft mt-1">{oferta.descripcion}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs flex-wrap">
          {distanciaTexto && <span className="font-semibold text-ml-violet">📍 {distanciaTexto}</span>}
          {oferta.cupoRestante !== null ? (
            <span className={`font-semibold ${sinCupo ? 'text-red-600' : 'text-green-600'}`}>
              {sinCupo ? 'Sin cupos' : `🎟️ ${oferta.cupoRestante} cupos`}
            </span>
          ) : (
            <span className="text-ml-muted">Cupos: sin límite</span>
          )}
        </div>

        {oferta.desbloquea?.descripcion && (
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-2 text-xs text-ml-violet">
            🔗 Recompensa cruzada: {oferta.desbloquea.descripcion}
          </div>
        )}

        {oferta.condiciones && (
          <button onClick={() => setVerCondiciones(v => !v)} className="text-[11px] text-ml-blue hover:underline">
            {verCondiciones ? 'Ocultar condiciones' : 'Ver condiciones'}
          </button>
        )}
        {verCondiciones && oferta.condiciones && (
          <p className="text-[11px] text-ml-muted bg-ml-bg rounded-lg p-2 leading-relaxed">{oferta.condiciones}</p>
        )}

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}

        <button
          onClick={reclamar}
          disabled={deshabilitada}
          className="w-full py-3 mlbtn ml-grad text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {reclamando ? 'Generando código...' : expirada ? 'Oferta finalizada' : sinCupo ? 'Sin cupos' : oferta.requierePrepagoApp ? `💳 Comprar $${oferta.precioFinal?.toLocaleString('es-AR')}` : '🎟️ Reclamar oferta'}
        </button>

        {/* Modal de checkout (Fase 3) */}
        {mostrarCheckout && oferta.precioFinal && oferta.comisionPorcentaje !== undefined && (
          <CheckoutOferta
            ofertaId={oferta._id}
            titulo={oferta.titulo}
            precioFinal={oferta.precioFinal}
            comisionPorcentaje={oferta.comisionPorcentaje}
            onClose={() => setMostrarCheckout(false)}
          />
        )}
      </div>
    </div>
  )
}
