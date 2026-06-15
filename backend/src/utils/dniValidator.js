// Validación de DNI argentino.
//
// IMPORTANTE: el DNI argentino NO tiene dígito verificador. Es un número
// secuencial de 7 u 8 dígitos asignado por el RENAPER. El algoritmo de
// módulo 11 que se usaba antes pertenece al CUIL/CUIT (ej: 20-42949528-3),
// NO al DNI suelto, y rechazaba la mayoría de los DNIs reales.
// Acá solo validamos longitud y que no sea basura obvia.
export function validarDNI(dni) {
  const dniLimpio = String(dni).replace(/\D/g, '')

  // Debe tener 7 u 8 dígitos
  if (dniLimpio.length < 7 || dniLimpio.length > 8) {
    return false
  }

  // Rechazar todos los dígitos iguales (00000000, 11111111, etc.): nunca es real
  if (/^(\d)\1+$/.test(dniLimpio)) {
    return false
  }

  return true
}
