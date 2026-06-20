import { Link } from 'react-router-dom'
import { WeatherAlert } from '../hooks/useWeatherAlert'

interface Props {
  alerta: WeatherAlert
  onCerrar: () => void
}

/**
 * Alerta "Modo Lluvia": cuando detectamos precipitación, mostramos un banner
 * que promociona delivery/merienda vía Comisionistas. No modifica precios;
 * es solo un gancho para impulsar la categoría de servicios de envío.
 */
export default function AlertaClima({ alerta, onCerrar }: Props) {
  return (
    <div className="mb-5 rounded-2xl overflow-hidden border border-blue-300 shadow-md">
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-white/90">
              {alerta.icono} Alerta del Clima
            </p>
            <p className="font-extrabold text-lg leading-tight mt-0.5">{alerta.condicion}</p>
            <p className="text-sm text-white/90 mt-0.5">
              {alerta.temperatura}°C · {alerta.precipitacionPorcentaje}% probabilidad de lluvia
            </p>
          </div>
          <button onClick={onCerrar} className="shrink-0 text-white/70 hover:text-white text-lg leading-none">
            ✕
          </button>
        </div>
      </div>

      <div className="bg-white p-4 space-y-3">
        <p className="text-sm text-ml-ink font-semibold">
          ☔ ¿Día de lluvia? Elegí {alerta.icono} <strong>merienda o cena a domicilio</strong> sin salir.
        </p>

        <div className="flex items-center gap-2 text-xs text-ml-soft">
          <span>🚚 Que te lo traigan en tu barrio</span>
        </div>

        <Link
          to="/comisionistas"
          className="block text-center text-sm font-bold text-white px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 transition-colors"
        >
          Explorar entregadores →
        </Link>

        <p className="text-[11px] text-ml-muted text-center">
          Mercado Local conecta locales y clientes en tu barrio. Precios originales, sin sorpresas.
        </p>
      </div>
    </div>
  )
}
