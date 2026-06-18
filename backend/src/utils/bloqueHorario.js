import BloqueHorarioConfig from '../models/BloqueHorarioConfig.js'

/**
 * Obtiene la hora actual en zona horaria Argentina (ART = UTC-3, o ARST = UTC-2 en verano).
 * Returns: Date object en zona Argentina (leer .getHours(), .getMinutes()).
 */
export function ahoraART() {
  // Siempre usa UTC-3 (ART, invierno). En verano ARST sería -2, pero mantener consistencia.
  // Alternativa: usar Intl.DateTimeFormat si se necesita verano/invierno automático.
  const ahora = new Date()
  return new Date(ahora.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }))
}

/**
 * Convierte HH:MM a minutos desde medianoche.
 */
function horaAMinutos(hh_mm) {
  const [h, m] = hh_mm.split(':').map(Number)
  return h * 60 + m
}

/**
 * Determina qué bloque horario está activo AHORA.
 * Returns: { bloqueId, nombre, titulo, descripcion, tipoDispatcher } o null si ninguno.
 */
export async function bloqueActual() {
  const ahora = ahoraART()
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes()

  const bloques = await BloqueHorarioConfig.find({ activo: true }).lean()
  if (!bloques.length) return null

  // Busca cuál bloque contiene minutosAhora
  for (const bloque of bloques) {
    const minInicio = horaAMinutos(bloque.horaInicio)
    const minFin = horaAMinutos(bloque.horaFin)

    // Nota: si la franja cruza medianoche (ej. 22:00–07:00), usar lógica especial si es necesario
    // Por ahora asumimos franjas intra-día (mañana < tarde < noche)
    if (minutosAhora >= minInicio && minutosAhora < minFin) {
      return {
        nombre: bloque.nombre,
        titulo: bloque.titulo,
        descripcion: bloque.descripcion,
        tipoDispatcher: bloque.tipoDispatcher,
        distanciaMaxima: bloque.distanciaMaxima
      }
    }
  }

  // Ninguno activo ahora
  return null
}

/**
 * Obtiene todos los bloques horarios disponibles (para CLI/admin config).
 */
export async function obtenerBloques() {
  return await BloqueHorarioConfig.find().sort({ horaInicio: 1 }).lean()
}
