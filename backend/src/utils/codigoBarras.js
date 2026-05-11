/**
 * Validador de códigos de barras EAN-13, EAN-8, UPC-A, GTIN-14.
 *
 * Verifica:
 * 1. Longitud válida (8, 12, 13 o 14 dígitos)
 * 2. Solo dígitos
 * 3. Dígito de control correcto (algoritmo módulo 10)
 *
 * Si un vendedor inventa un código random, casi seguro va a fallar
 * la verificación de checksum.
 */

/**
 * Normaliza el código: saca espacios, guiones, todo lo no-numérico.
 */
export function normalizarCodigoBarras(codigo) {
  if (!codigo || typeof codigo !== 'string') return ''
  return codigo.replace(/\D/g, '')
}

/**
 * Calcula el dígito de control con algoritmo módulo 10 (GS1).
 * Sirve para EAN-8, EAN-13, UPC-A y GTIN-14.
 */
function calcularDigitoControl(digitos) {
  let suma = 0
  // Recorrer de derecha a izquierda EXCLUYENDO el último (que es el dígito de control)
  // Posiciones impares (desde la derecha) → ×3, pares → ×1
  for (let i = digitos.length - 2, multiplicador = 3; i >= 0; i--, multiplicador = multiplicador === 3 ? 1 : 3) {
    suma += parseInt(digitos[i], 10) * multiplicador
  }
  const resto = suma % 10
  return resto === 0 ? 0 : 10 - resto
}

/**
 * Valida un código de barras.
 * @param {string} codigo
 * @returns {{ valido: boolean, formato?: string, motivo?: string }}
 */
export function validarCodigoBarras(codigo) {
  const limpio = normalizarCodigoBarras(codigo)
  if (!limpio) {
    return { valido: false, motivo: 'Código vacío' }
  }

  const LONGITUDES_VALIDAS = { 8: 'EAN-8', 12: 'UPC-A', 13: 'EAN-13', 14: 'GTIN-14' }
  const formato = LONGITUDES_VALIDAS[limpio.length]

  if (!formato) {
    return {
      valido: false,
      motivo: `Longitud inválida (${limpio.length} dígitos). Debe ser 8, 12, 13 o 14 dígitos.`
    }
  }

  // Verificar checksum
  const digitoEsperado = calcularDigitoControl(limpio)
  const digitoReal = parseInt(limpio[limpio.length - 1], 10)

  if (digitoEsperado !== digitoReal) {
    return {
      valido: false,
      motivo: 'El código de barras es inválido (dígito de control incorrecto). Verificá que esté bien tipeado.'
    }
  }

  return { valido: true, formato }
}
