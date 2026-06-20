import { SugerenciaCruzada, ReservaCruzada } from '../hooks/useRecompensaCruzada'

const BLOQUE_EMOJI: Record<string, string> = {
  desayuno: '🥐', almuerzo: '🍽️', merienda: '☕', cena: '🌙', siesta: '🛍️'
}
const BLOQUE_NOMBRE: Record<string, string> = {
  desayuno: 'desayuno', almuerzo: 'almuerzo', merienda: 'merienda', cena: 'cena', siesta: 'siesta'
}

interface Props {
  sugerencia: SugerenciaCruzada
  reserva: ReservaCruzada | null
  reservando: boolean
  error: string
  onReservar: () => void
  onContinuar: () => void
}

/**
 * Modal "gancho de la cadena": aparece justo después de comprar/reclamar y ofrece
 * la promo del bloque gastronómico siguiente con un cupón extra que define el
 * vendedor. Si el cliente reserva, el comercio recibe el aviso para prepararse.
 */
export default function RecompensaCruzada({ sugerencia, reserva, reservando, error, onReservar, onContinuar }: Props) {
  const emoji = BLOQUE_EMOJI[sugerencia.bloque] || '✨'
  const nombreBloque = BLOQUE_NOMBRE[sugerencia.bloque] || 'la próxima'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden">
        {/* Encabezado festivo */}
        <div className="bg-gradient-to-br from-ml-violet to-ml-blue p-6 text-center text-white">
          <div className="text-5xl mb-2">{reserva ? '🪑' : emoji}</div>
          <h2 className="font-display text-xl font-extrabold leading-tight">
            {reserva ? '¡Reserva confirmada!' : `¿Ya terminaste? Te espera ${nombreBloque}`}
          </h2>
        </div>

        {reserva ? (
          // ===== Estado: ya reservó → mostramos código + aviso al local =====
          <div className="p-6 space-y-4 text-center">
            <p className="text-sm text-ml-soft">
              <strong className="text-ml-ink">{reserva.comercioNombre || 'El local'}</strong> ya recibió tu reserva y
              prepara la mesa con la <strong>invitación especial de Mercado Local</strong>.
            </p>
            <div className="bg-ml-bg border border-ml-line rounded-2xl p-4">
              <p className="text-[11px] text-ml-muted uppercase tracking-wide mb-1">Tu código</p>
              <p className="font-mono text-2xl font-extrabold text-ml-violet tracking-widest">{reserva.codigo}</p>
              {reserva.cuponPorcentaje > 0 && (
                <p className="text-xs text-green-600 font-semibold mt-2">🎁 Cupón {reserva.cuponPorcentaje}% al presentarlo</p>
              )}
            </div>
            <p className="text-[11px] text-ml-muted">Mostralo en el mostrador. También quedó guardado en "Mis canjes".</p>
            <button onClick={onContinuar} className="w-full py-3 ml-grad text-white rounded-2xl font-bold">
              Ver mi código
            </button>
          </div>
        ) : (
          // ===== Estado: oferta del gancho =====
          <div className="p-6 space-y-4">
            <p className="text-sm text-ml-soft text-center">
              <strong className="text-ml-ink">{sugerencia.comercioNombre || 'Un local cercano'}</strong> está ofreciendo{' '}
              <strong className="text-ml-ink">{sugerencia.titulo}</strong>
              {sugerencia.precioFinal > 0 && <> por <strong>${sugerencia.precioFinal.toLocaleString('es-AR')}</strong></>}.
            </p>

            {sugerencia.cuponPorcentaje > 0 && (
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/90">Y si lo confirmás acá</p>
                <p className="font-extrabold text-2xl">Cupón {sugerencia.cuponPorcentaje}% OFF</p>
                <p className="text-xs text-white/90 mt-0.5">que define el local especialmente para vos</p>
              </div>
            )}

            {sugerencia.mensaje && (
              <p className="text-xs text-center text-ml-violet bg-violet-50 border border-violet-100 rounded-xl p-2">
                ✨ {sugerencia.mensaje}
              </p>
            )}

            <p className="text-[11px] text-ml-muted text-center">
              Reservá ya así le avisamos que te preparen la mesa con la invitación especial de Mercado Local. 🍽️
            </p>

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 text-center">{error}</p>}

            <div className="flex flex-col gap-2">
              <button
                onClick={onReservar}
                disabled={reservando}
                className="w-full py-3 ml-grad text-white rounded-2xl font-bold disabled:opacity-60"
              >
                {reservando ? 'Reservando…' : '🪑 Reservar mi lugar'}
              </button>
              <button onClick={onContinuar} className="w-full py-2 text-sm font-semibold text-ml-muted hover:text-ml-ink">
                Ahora no, gracias
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
