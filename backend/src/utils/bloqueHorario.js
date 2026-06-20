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
    if (enFranja(minutosAhora, bloque.horaInicio, bloque.horaFin)) {
      return {
        nombre: bloque.nombre,
        titulo: bloque.titulo,
        descripcion: bloque.descripcion,
        tipoDispatcher: bloque.tipoDispatcher,
        distanciaMaxima: bloque.distanciaMaxima,
        tema: bloque.tema || null
      }
    }
  }

  // Ninguno activo ahora (gap horario) → el feed cae al fallback genérico.
  return null
}

/**
 * ¿`minutos` cae dentro de la franja [inicio, fin)? Maneja cruce de medianoche:
 * si fin <= inicio (ej. 22:00–02:00), la franja envuelve la medianoche.
 */
function enFranja(minutos, horaInicio, horaFin) {
  const minInicio = horaAMinutos(horaInicio)
  const minFin = horaAMinutos(horaFin)
  if (minFin > minInicio) {
    // Franja intra-día normal (ej. 08:00–11:30)
    return minutos >= minInicio && minutos < minFin
  }
  // Franja que cruza medianoche (ej. 22:00–02:00): activa si estás después
  // del inicio O antes del fin.
  return minutos >= minInicio || minutos < minFin
}

/**
 * Obtiene todos los bloques horarios disponibles (para CLI/admin config).
 */
export async function obtenerBloques() {
  return await BloqueHorarioConfig.find().sort({ horaInicio: 1 }).lean()
}

/**
 * Cadena de "ganchos" gastronómicos del día (Gamificación Cruzada). La idea: el
 * comercio del bloque N engancha al cliente con la promo del bloque N+1 (la
 * cafetería del desayuno → el restaurante del almuerzo → la merienda → la cena).
 * La siesta es shopping, no comida, así que NO está en la cadena: quien viene de
 * la siesta engancha con la merienda.
 */
export const SECUENCIA_GANCHO = ['desayuno', 'almuerzo', 'merienda', 'cena']

/**
 * Dado el bloque recién completado (o el actual), devuelve el NOMBRE del bloque
 * gastronómico siguiente al que enganchar, o null si no hay (ej. después de la
 * cena). Normaliza los bloques que no son comida (siesta / legacy mañana-tarde-noche).
 */
export function bloqueSiguienteGancho(nombre) {
  const equivalencias = {
    siesta: 'almuerzo', // viene del shopping de siesta → ofrecé merienda
    manana: 'desayuno',
    tarde: 'almuerzo',
    noche: 'merienda'
  }
  const base = equivalencias[nombre] || nombre
  const i = SECUENCIA_GANCHO.indexOf(base)
  if (i === -1 || i === SECUENCIA_GANCHO.length - 1) return null
  return SECUENCIA_GANCHO[i + 1]
}
