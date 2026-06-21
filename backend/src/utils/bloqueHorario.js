import BloqueHorarioConfig from '../models/BloqueHorarioConfig.js'

/**
 * Obtiene la hora actual en zona horaria Argentina, robusta ante la zona horaria
 * del servidor (Railway corre en UTC). Returns: Date cuyas .getHours()/.getMinutes()
 * son la hora de Argentina.
 *
 * IMPORTANTE: NO usar `new Date(d.toLocaleString('es-AR', ...))`. El locale es-AR
 * formatea DD/MM/YYYY y `new Date("20/6/2026")` es Invalid Date (mes 20 inválido)
 * todos los días > 12 → getHours() = NaN → bloqueActual() null siempre. Usamos
 * formatToParts, que extrae los números sin pasar por un parseo ambiguo de string.
 */
export function ahoraART() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  })
  const p = {}
  for (const part of fmt.formatToParts(new Date())) {
    if (part.type !== 'literal') p[part.type] = Number(part.value)
  }
  // A medianoche, hour12:false puede devolver "24" en algunos entornos → normalizar a 0.
  const hora = p.hour === 24 ? 0 : p.hour
  return new Date(p.year, p.month - 1, p.day, hora, p.minute, p.second)
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
 * Cuando estamos en un gap horario (ningún bloque activo), devuelve el PRÓXIMO
 * bloque que va a arrancar, para que el Radar muestre "Falta poco para ☕ Modo
 * Merienda · 17:30" en vez de caer al tema neutro (que parece que está roto).
 * Elige el bloque con el menor tiempo hasta su horaInicio, envolviendo la
 * medianoche (ej. a las 23:45 el próximo es el desayuno de las 08:00).
 * Returns: { nombre, titulo, horaInicio, tema, ... } o null si no hay bloques.
 */
export async function bloqueProximo() {
  const ahora = ahoraART()
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes()

  const bloques = await BloqueHorarioConfig.find({ activo: true }).lean()
  if (!bloques.length) return null

  let mejor = null
  let mejorDelta = Infinity
  for (const bloque of bloques) {
    let delta = horaAMinutos(bloque.horaInicio) - minutosAhora
    if (delta <= 0) delta += 24 * 60 // ya pasó hoy → arranca mañana
    if (delta < mejorDelta) {
      mejorDelta = delta
      mejor = bloque
    }
  }
  if (!mejor) return null

  return {
    nombre: mejor.nombre,
    titulo: mejor.titulo,
    descripcion: mejor.descripcion,
    horaInicio: mejor.horaInicio,
    tipoDispatcher: mejor.tipoDispatcher,
    distanciaMaxima: mejor.distanciaMaxima,
    tema: mejor.tema || null
  }
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
