import { useState, useEffect } from 'react'
import { formatearDistancia } from '../utils/geo'

export interface Liquidacion {
  ofertaId: string
  titulo: string
  descripcion?: string
  valorDescuento?: number
  finEn: string
  cupoTotal?: number
  comercio: { _id: string; nombre: string; lat: number; lng: number }
  radioMetros?: number
  distancia?: number
}

/**
 * Banner urgente que aparece en el Radar cuando un comercio cercano lanza una
 * "Liquidación Relámpago". Escasez real: countdown a la hora de fin del server.
 */
export default function AlertaLiquidacion({ liquidacion, onCerrar }: { liquidacion: Liquidacion; onCerrar: () => void }) {
  const [restante, setRestante] = useState('')

  useEffect(() => {
    function tick() {
      const ms = new Date(liquidacion.finEn).getTime() - Date.now()
      if (ms <= 0) { setRestante(''); onCerrar(); return }
      const min = Math.floor(ms / 60000)
      const seg = Math.floor((ms % 60000) / 1000)
      setRestante(`${min}:${String(seg).padStart(2, '0')}`)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [liquidacion.finEn, onCerrar])

  return (
    <div className="mb-5 rounded-2xl overflow-hidden border border-red-300 shadow-md">
      <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-white/90">⚡ Liquidación Relámpago cerca tuyo</p>
            <p className="font-extrabold text-lg leading-tight mt-0.5">{liquidacion.titulo}</p>
            <p className="text-sm text-white/90 mt-0.5">
              {liquidacion.comercio.nombre}
              {liquidacion.distancia != null && <> · 📍 {formatearDistancia(liquidacion.distancia)}</>}
            </p>
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
