// Utilidades para ofertas flash y canjes del Radar del Centro.
// El countdown SIEMPRE se calcula contra la hora del SERVER, no contra el reloj
// del dispositivo (que puede estar mal y generaría urgencia falsa — algo prohibido
// por la Ley de Lealtad Comercial).

/**
 * Offset (ms) entre el reloj del server y el del cliente, medido al recibir la
 * respuesta. Para estimar "ahora" según el server: Date.now() + offset.
 */
export function calcularOffset(serverNow: string | Date): number {
  return new Date(serverNow).getTime() - Date.now()
}

/** Hora estimada del server, en ms. */
export function ahoraServidor(offsetMs: number): number {
  return Date.now() + offsetMs
}

/** Formatea milisegundos restantes como "MM:SS" o "HH:MM:SS". */
export function formatearCuenta(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSeg = Math.floor(ms / 1000)
  const h = Math.floor(totalSeg / 3600)
  const m = Math.floor((totalSeg % 3600) / 60)
  const s = totalSeg % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

// ===== Caché local de códigos de canje =====
// El código en claro lo devuelve el server UNA sola vez (al reclamar). Lo
// guardamos en el navegador para poder mostrarlo en "Mis canjes" hasta que expire.
// Es un secreto de portador de vida corta (30 min); guardarlo localmente es aceptable.

const CLAVE_CACHE = 'ml_canjes_codigos'

interface CodigoCacheado {
  codigo: string
  expiraEn: string
}

type CacheCanjes = Record<string, CodigoCacheado>

function leerCache(): CacheCanjes {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_CACHE) || '{}')
  } catch {
    return {}
  }
}

/** Guarda el código de un canje y limpia los ya expirados. */
export function guardarCodigo(canjeId: string, codigo: string, expiraEn: string): void {
  const cache = leerCache()
  cache[canjeId] = { codigo, expiraEn }
  // Limpieza de expirados
  const ahora = Date.now()
  for (const id of Object.keys(cache)) {
    if (new Date(cache[id].expiraEn).getTime() < ahora) delete cache[id]
  }
  try {
    localStorage.setItem(CLAVE_CACHE, JSON.stringify(cache))
  } catch {
    /* almacenamiento lleno: no es crítico */
  }
}

/** Devuelve el código cacheado de un canje, o null si no está / expiró. */
export function obtenerCodigo(canjeId: string): string | null {
  const cache = leerCache()
  const item = cache[canjeId]
  if (!item) return null
  if (new Date(item.expiraEn).getTime() < Date.now()) return null
  return item.codigo
}

export const GANCHO_ICON: Record<string, string> = {
  descuento: '🏷️',
  '2x1': '🎁',
  regalo: '🎉',
  combo: '🍔'
}
