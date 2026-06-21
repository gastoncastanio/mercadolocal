import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { ahoraServidor, formatearCuenta, guardarCodigo, GANCHO_ICON } from '../utils/canjes'
import { useRecompensaCruzada } from '../hooks/useRecompensaCruzada'
import CheckoutOferta from './CheckoutOferta'
import RecompensaCruzada from './RecompensaCruzada'

export interface OfertaFlash {
  _id: string
  comercioId: string
  titulo: string
  descripcion: string
  imagen?: string
  imagenPosicion?: string
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
  logoComercio?: string
  verificadoComercio?: boolean
}

export default function TarjetaOfertaFlash({ oferta, offsetMs, distanciaTexto, nombreComercio, logoComercio, verificadoComercio }: Props) {
  const { estaLogueado } = useAuth()
  const navigate = useNavigate()
  const [restanteMs, setRestanteMs] = useState(0)
  const [verCondiciones, setVerCondiciones] = useState(false)
  const [reclamando, setReclamando] = useState(false)
  const [error, setError] = useState('')
  const [mostrarCheckout, setMostrarCheckout] = useState(false)
  const { sugerencia, reservando, reserva, error: errorCruzada, buscar: buscarGancho, reservar: reservarGancho, cerrar: cerrarGancho } = useRecompensaCruzada()

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
      // Gamificación Cruzada: buscar gancho del bloque siguiente
      const tieneGancho = await buscarGancho(oferta.bloqueHorario)
      if (!tieneGancho) {
        navigate('/mis-canjes')
      }
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
      {/* Portada: foto del producto encuadrada (object-position) o gradiente fallback */}
      <div className="relative h-40 w-full overflow-hidden">
        {oferta.imagen ? (
          <img
            src={oferta.imagen}
            alt={oferta.titulo}
            width={400}
            height={160}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: oferta.imagenPosicion || '50% 50%' }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <span className="text-5xl opacity-80">{GANCHO_ICON[oferta.tipoGancho] || '🏷️'}</span>
          </div>
        )}
        {/* Velo para legibilidad del chip + countdown */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/10" />
        <div className="absolute top-0 inset-x-0 px-3 py-2 flex items-center justify-between">
          <span className="text-xs font-bold text-white flex items-center gap-1 bg-black/30 backdrop-blur px-2 py-0.5 rounded-lg">⚡ Oferta relámpago</span>
          <span className={`text-sm font-mono font-bold px-2 py-0.5 rounded-lg text-white ${urgente ? 'bg-red-600 animate-pulse' : 'bg-black/40 backdrop-blur'}`}>
            {expirada ? 'Finalizó' : `⏳ ${formatearCuenta(restanteMs)}`}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {/* Comercio: logo redondo + nombre (con verificado) + título del producto */}
        <div className="flex items-start gap-3">
          {logoComercio ? (
            <img src={logoComercio} alt={nombreComercio || ''} width={44} height={44} className="w-11 h-11 rounded-full object-cover border border-ml-line shrink-0" />
          ) : (
            <span className="w-11 h-11 rounded-full bg-ml-bg border border-ml-line flex items-center justify-center text-xl shrink-0">{GANCHO_ICON[oferta.tipoGancho] || '🏪'}</span>
          )}
          <div className="flex-1 min-w-0">
            {nombreComercio && (
              <p className="text-xs text-ml-muted flex items-center gap-1">
                {nombreComercio}
                {verificadoComercio && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-ml-blue font-semibold" title="Comercio verificado">
                    <span className="bg-ml-blue text-white rounded-full w-3.5 h-3.5 inline-flex items-center justify-center text-[8px]">✓</span>
                    Verificado
                  </span>
                )}
              </p>
            )}
            <h3 className="font-bold text-ml-ink leading-tight">{oferta.titulo}</h3>
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

        {/* Gamificación Cruzada (gancho del bloque siguiente) */}
        {sugerencia && (
          <RecompensaCruzada
            sugerencia={sugerencia}
            reserva={reserva}
            reservando={reservando}
            error={errorCruzada}
            onReservar={reservarGancho}
            onContinuar={() => {
              cerrarGancho()
              navigate('/mis-canjes')
            }}
          />
        )}
      </div>
    </div>
  )
}
