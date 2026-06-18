// Utilidades de geolocalización — TODO el cálculo ocurre en el navegador.
// La ubicación del usuario NUNCA se envía ni se almacena en ningún servidor.

export interface Coord {
  lat: number
  lng: number
}

const RADIO_TIERRA_M = 6371000 // metros

/**
 * Distancia entre dos puntos sobre la superficie terrestre (fórmula de Haversine).
 * Devuelve metros. Correcta para lat/long (a diferencia de la distancia euclidiana,
 * que da error grande en estas latitudes).
 */
export function distanciaMetros(a: Coord, b: Coord): number {
  const toRad = (g: number) => (g * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(h))
}

/** Formatea una distancia en metros a algo legible: "120 m" / "1,4 km". */
export function formatearDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)} m`
  return `${(metros / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} km`
}

/**
 * Pide la ubicación actual del usuario vía API nativa del navegador.
 * Resuelve con las coords; rechaza con un mensaje claro si falla o se deniega.
 * No persiste nada: el resultado vive solo en memoria del cliente.
 */
export function obtenerUbicacion(): Promise<Coord> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Tu navegador no soporta geolocalización.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Necesitamos tu ubicación para mostrarte el Radar. Activala cuando quieras.'))
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          reject(new Error('No pudimos obtener tu ubicación. Probá de nuevo.'))
        } else {
          reject(new Error('Se agotó el tiempo para obtener tu ubicación.'))
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  })
}

/** Ordena una lista de items con coords por cercanía a un origen, agregando `distancia` (m). */
export function ordenarPorCercania<T extends { ubicacion: Coord }>(
  items: T[],
  origen: Coord
): (T & { distancia: number })[] {
  return items
    .map(item => ({ ...item, distancia: distanciaMetros(origen, item.ubicacion) }))
    .sort((a, b) => a.distancia - b.distancia)
}
