import { useState, useEffect } from 'react'
import { Coord } from '../utils/geo'

export interface WeatherAlert {
  lluvia: boolean
  temperatura: number
  precipitacionPorcentaje: number
  condicion: string
  icono: string
}

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'

/**
 * Hook que detecta lluvia/precipitación en las coords del usuario usando
 * Open-Meteo (API libre, sin key). Si llueve, activa el "Modo Lluvia" del Radar
 * y muestra una alerta sugiriendo delivery/merienda vía Comisionistas.
 *
 * Devuelve null si no llueve o si hay error (sin molestar al usuario).
 */
export function useWeatherAlert(coords: Coord | null) {
  const [alerta, setAlerta] = useState<WeatherAlert | null>(null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!coords) {
      setAlerta(null)
      return
    }

    // Verificar clima cada 15 minutos (no sobrecargar la API)
    async function verificarClima() {
      if (!coords) return
      setCargando(true)
      try {
        const res = await fetch(
          `${OPEN_METEO_URL}?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,weather_code,precipitation,precipitation_probability&temperature_unit=celsius`,
          { signal: AbortSignal.timeout(5000) } // timeout de 5s
        )
        if (!res.ok) throw new Error('API error')

        const data = await res.json()
        const current = data.current

        // WMO Weather Code: 51–67, 80–82 → lluvia/precipitación
        const lluvia = [51, 53, 55, 61, 63, 65, 71, 73, 75, 77, 80, 81, 82].includes(current.weather_code)
        const precipPorcentaje = current.precipitation_probability || 0

        if (lluvia || precipPorcentaje >= 60) {
          setAlerta({
            lluvia: true,
            temperatura: current.temperature_2m,
            precipitacionPorcentaje: precipPorcentaje,
            condicion: describeWeatherCode(current.weather_code),
            icono: weatherEmoji(current.weather_code)
          })
        } else {
          setAlerta(null)
        }
      } catch (e) {
        // Error de red o timeout: no es crítico, dejar sin alerta
        console.debug('Weather API error:', e)
      } finally {
        setCargando(false)
      }
    }

    verificarClima()
    const intervalo = setInterval(verificarClima, 15 * 60 * 1000)
    return () => clearInterval(intervalo)
  }, [coords])

  return { alerta, cargando }
}

/**
 * Interpreta el WMO Weather Code.
 */
function describeWeatherCode(code: number): string {
  if (code >= 51 && code <= 67) return 'Llovizna'
  if (code >= 71 && code <= 77) return 'Nieve'
  if (code >= 80 && code <= 82) return 'Lluvia fuerte'
  if (code === 85 || code === 86) return 'Chubascos de nieve'
  if (code >= 80 && code <= 90) return 'Lluvia'
  return 'Clima inestable'
}

/**
 * Emoji descriptivo del WMO code.
 */
function weatherEmoji(code: number): string {
  if (code >= 51 && code <= 67) return '🌧️'
  if (code >= 71 && code <= 77) return '❄️'
  if (code >= 80 && code <= 82) return '⛈️'
  return '🌧️'
}
