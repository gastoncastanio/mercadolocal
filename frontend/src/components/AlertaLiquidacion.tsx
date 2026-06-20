import { useState, useEffect } from 'react'
import { formatearDistancia } from '../utils/geo'

export interface Liquidacion {
  ofertaId: string
  titulo: string
  descripcion?: string
  imagen?: string
  imagenPosicion?: string
  valorDescuento?: number
  finEn: string
  cupoTotal?: number
  comercio: { _id: string; nombre: string; logo?: string; verificado?: boolean; lat: number; lng: number }
  radioMetros?: number
  distancia?: number
}

/**
 * Banner urgente que aparece en el Radar cuando un comercio cercano lanza una
 * "Liquidación Relámpago". Escasez real: countdown a la hora de fin del server.
 *
 * El countdown se calcula contra la hora del SERVER (Date.now() + offsetMs), no
 * contra el reloj del dispositivo. Sin esto, un celular con la hora adelantada
 * vería ms<=0 y descartaría la alerta al instante (y un reloj atrasado mostraría
 * urgencia falsa, prohibida por la Ley de Lealtad Comercial).
 */
export default function AlertaLiquidacion({ liquidacion, onCerrar, offsetMs = 0 }: { liquidacion: Liquidacion; onCerrar: () => void; offsetMs?: number }) {
  const [restante, setRestante] = useState('')

  useEffect(() => {
    function tick() {
      const ms = new Date(liquidacion.finEn).getTime() - (Date.now() + offsetMs)
      if (ms <= 0) { setRestante(''); onCerrar(); return }
      const min = Math.floor(ms / 60000)
      const seg = Math.floor((ms % 60000) / 1000)
      setRestante(`${min}:${String(seg).padStart(2, '0')}`)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [liquidacion.finEn, onCerrar, offsetMs])

  return (
    <div className="mb-5 rounded-2xl overflow-hidden border border-red-300 shadow-md">
      {/* Portada: foto del producto que se liquida (encuadrada) */}
      {liquidacion.imagen && (
        <div className="relative h-32 w-full overflow-hidden">
          <img
            src={liquidacion.imagen}
            alt={liquidacion.titulo}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: liquidacion.imagenPosicion || '50% 50%' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      )}
      <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* Logo redondo del comercio que liquida */}
            {liquidacion.comercio.logo && (
              <img src={liquidacion.comercio.logo} alt={liquidacion.comercio.nombre} className="w-10 h-10 rounded-full object-cover border-2 border-white/70 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-white/90">⚡ Liquidación Relámpago cerca tuyo</p>
              <p className="font-extrabold text-lg leading-tight mt-0.5">{liquidacion.titulo}</p>
              <p className="text-sm text-white/90 mt-0.5 flex items-center gap-1 flex-wrap">
                {liquidacion.comercio.nombre}
                {liquidacion.comercio.verificado && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-white/25 px-1.5 py-0.5 rounded-full" title="Comercio verificado">✓ Verificado</span>
                )}
                {liquidacion.distancia != null && <> · 📍 {formatearDistancia(liquidacion.distancia)}</>}
              </p>
            </div>
          </div>
          <button onClick={onCerrar} className="shrink-0 text-white/70 hover:text-white text-lg leading-none">✕</button>
        </div>
      </div>

      <div className="bg-white p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          {restante && (
            <span className="font-bold text-red-600 tabular-nums">⏱️ {restante}</span>
          )}
          {liquidacion.valorDescuento ? (
            <span className="font-semibold text-ml-ink">{liquidacion.valorDescuento}% OFF</span>
          ) : null}
          {liquidacion.cupoTotal ? (
            <span className="text-xs text-ml-soft">Cupo: {liquidacion.cupoTotal}</span>
          ) : null}
        </div>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${liquidacion.comercio.lat},${liquidacion.comercio.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-sm font-bold text-white px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 transition-colors"
        >
          Cómo llegar →
        </a>
      </div>
    </div>
  )
}
