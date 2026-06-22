// Localidades donde MercadoLocal opera — ESPEJO BACKEND de
// frontend/src/constants/localidades.ts. Es la fuente de verdad del servidor
// para validar ubicaciones: nunca confiar solo en el front (un cliente podría
// mandar una ciudad fuera de cobertura por API directa).
//
// Si en el futuro se suma una localidad, agregarla ACÁ y en el archivo del front.

export const LOCALIDADES = [
  'General Las Heras',
  'Cañuelas',
  'Lobos',
  'Navarro',
  'Roque Pérez',
]

// Texto reutilizable para aclarar la cobertura en mensajes de error.
export const COBERTURA_TEXTO =
  'Por ahora operamos solo en General Las Heras, Cañuelas, Lobos, Navarro y Roque Pérez.'

// Normaliza para comparar (sin acentos, minúsculas, sin espacios extra).
function normalizar(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // marcas diacríticas combinantes
    .trim()
    .toLowerCase()
}

// ¿La localidad ingresada es una de las que operamos?
export function esLocalidadValida(valor) {
  const n = normalizar(valor)
  return LOCALIDADES.some((l) => normalizar(l) === n)
}
