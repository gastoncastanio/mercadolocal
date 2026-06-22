// Localidades donde MercadoLocal opera.
// IMPORTANTE: la app SOLO está disponible en estas 5 localidades. Todos los
// selectores de ubicación (viajes de comisionista, remis, tienda, perfil
// profesional, checkout, etc.) deben ofrecer únicamente estas opciones.
// Si en el futuro se suma una localidad, se agrega acá (con sus coordenadas) y
// queda disponible en toda la app de forma centralizada.

export interface LocalidadInfo {
  nombre: string
  lat: number
  lng: number
}

// Coordenadas aproximadas del centro de cada localidad (para dibujar el mapa de
// rumbo de los viajes). Todas en la provincia de Buenos Aires, Argentina.
export const LOCALIDADES_INFO: LocalidadInfo[] = [
  { nombre: 'General Las Heras', lat: -34.9269, lng: -58.9436 },
  { nombre: 'Cañuelas', lat: -35.0522, lng: -58.7594 },
  { nombre: 'Lobos', lat: -35.1856, lng: -59.0997 },
  { nombre: 'Navarro', lat: -35.0036, lng: -59.2783 },
  { nombre: 'Roque Pérez', lat: -35.3886, lng: -59.3339 },
]

export const LOCALIDADES = LOCALIDADES_INFO.map((l) => l.nombre) as readonly string[]

export type Localidad = (typeof LOCALIDADES_INFO)[number]['nombre']

// Texto reutilizable para aclarar la cobertura en avisos y ayudas.
export const COBERTURA_TEXTO =
  'Por ahora operamos solo en General Las Heras, Cañuelas, Lobos, Navarro y Roque Pérez.'

// Normaliza para comparar (sin acentos, minúsculas, sin espacios extra).
function normalizar(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

// ¿La localidad ingresada es una de las que operamos?
export function esLocalidadValida(valor: string): boolean {
  const n = normalizar(valor)
  return LOCALIDADES_INFO.some((l) => normalizar(l.nombre) === n)
}

// Devuelve la info (con coordenadas) de una localidad por nombre, o null.
export function buscarLocalidad(valor: string): LocalidadInfo | null {
  const n = normalizar(valor)
  return LOCALIDADES_INFO.find((l) => normalizar(l.nombre) === n) || null
}
