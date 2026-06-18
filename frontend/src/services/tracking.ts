import api from './api'

/**
 * Señales de interés para la PAUTA INTELIGENTE.
 * Todo es fire-and-forget: nunca debe frenar la navegación ni mostrar errores.
 * El id anónimo viaja automáticamente en el header (ver api.ts).
 */

// Derecho de oposición (Ley 25.326): si el visitante rechazó el perfilado, no
// enviamos ninguna señal. Se guarda en el navegador para los anónimos; los
// logueados además la tienen registrada en el backend.
export function perfiladoRechazado(): boolean {
  try {
    return localStorage.getItem('ml_no_perfilar') === '1'
  } catch {
    return false
  }
}

// Evita registrar la misma vista repetidas veces en la misma sesión de navegación
const vistasEnviadas = new Set<string>()

export function trackVista(productoId: string) {
  if (perfiladoRechazado()) return
  if (!productoId || vistasEnviadas.has(productoId)) return
  vistasEnviadas.add(productoId)
  api.post('/senales/vista', { productoId }).catch(() => {})
}

let ultimaBusqueda = 0
export function trackBusqueda(termino?: string, categoria?: string) {
  if (perfiladoRechazado()) return
  if (!termino && !categoria) return
  // Throttle suave para no spamear mientras tipea
  const ahora = Date.now()
  if (ahora - ultimaBusqueda < 800) return
  ultimaBusqueda = ahora
  api.post('/senales/busqueda', { termino, categoria }).catch(() => {})
}
