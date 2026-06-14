export function validarDNI(dni: string | number): boolean {
  const dniLimpio = String(dni).replace(/\D/g, '')

  // Debe tener exactamente 8 dígitos
  if (dniLimpio.length !== 8) {
    return false
  }

  // Rechazar secuencias repetidas (00000000, 11111111, etc.)
  if (/^(\d)\1{7}$/.test(dniLimpio)) {
    return false
  }

  // Validar con módulo 11 (solo primeros 7 dígitos)
  const multiplicadores = [2, 3, 4, 5, 6, 7, 8]
  let suma = 0

  for (let i = 0; i < 7; i++) {
    suma += parseInt(dniLimpio[i]) * multiplicadores[i]
  }

  const resto = suma % 11
  const digitoVerificador = 11 - resto

  // Si el resultado es 11, es 0; si es 10, es 9
  const digitoValido =
    digitoVerificador === 11 ? 0 : digitoVerificador === 10 ? 9 : digitoVerificador

  // El 8vo dígito debe coincidir con el dígito verificador calculado
  return parseInt(dniLimpio[7]) === digitoValido
}
