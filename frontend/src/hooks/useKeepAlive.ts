import { useEffect } from 'react'
import { SOCKET_URL } from '../services/api'

/**
 * Mantiene "despierto" el backend mientras hay una sesión activa en la pestaña.
 *
 * Railway puede enfriar la instancia tras un rato sin tráfico: cuando llega el
 * siguiente request hay que esperar a que el runtime y el pool de Mongo se
 * reactiven (~1s extra que PageSpeed marcaba en el árbol de dependencias). Con
 * un ping liviano cada pocos minutos desde los usuarios activos, la instancia
 * no se enfría y los próximos visitantes cargan más rápido.
 *
 * - Solo corre si `activo` es true (lo atamos a haber iniciado sesión): la
 *   landing anónima NO genera pings.
 * - Usa `/api/health` (endpoint liviano ya existente), con keepalive para que el
 *   navegador no lo cancele si la pestaña pasa a segundo plano.
 * - Pausa los pings cuando la pestaña está oculta (no tiene sentido calentar el
 *   backend si nadie está mirando) y manda uno al volver a verla.
 */
export function useKeepAlive(activo: boolean) {
  useEffect(() => {
    if (!activo) return

    const INTERVALO = 1000 * 60 * 4 // 4 minutos

    const ping = () => {
      if (document.visibilityState !== 'visible') return
      fetch(`${SOCKET_URL}/api/health`, {
        method: 'GET',
        keepalive: true,
        cache: 'no-store'
      }).catch(() => {
        // Silencioso: es best-effort, un ping fallido no afecta al usuario.
      })
    }

    // Un ping al montar (cubre el caso del usuario que acaba de loguearse) y
    // luego en intervalo.
    ping()
    const id = window.setInterval(ping, INTERVALO)

    const onVisibilidad = () => {
      if (document.visibilityState === 'visible') ping()
    }
    document.addEventListener('visibilitychange', onVisibilidad)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibilidad)
    }
  }, [activo])
}
