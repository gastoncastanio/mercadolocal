import BloqueHorarioConfig from '../models/BloqueHorarioConfig.js'

// Versión del set de bloques. Subir este número documenta migraciones futuras.
const SEED_VERSION = 2

/**
 * Los 5 modos temáticos del "Radar Camaleón". El Radar muta su interfaz
 * (colores, emoji, rubros priorizados) según cuál esté activo a la hora del
 * usuario. Colores en HEX para aplicarse con `style` inline en el frontend.
 *
 * Gaps intencionales entre bloques (11:30–12, 17–17:30, 19:30–20, 23:30–08):
 * en esas franjas no hay modo activo y el Radar cae al feed genérico por
 * cercanía (fallback neutro).
 */
const BLOQUES_CAMALEON = [
  {
    nombre: 'desayuno',
    horaInicio: '08:00',
    horaFin: '11:30',
    titulo: '🥐 Modo Desayuno',
    descripcion: 'Medialunas calentitas, café de especialidad y el diario local. Arrancá el día cerca tuyo.',
    tipoDispatcher: 'cercania',
    distanciaMaxima: 400,
    tema: {
      emoji: '🥐',
      colorDesde: '#B45309', // ámbar tostado (café)
      colorHasta: '#92400E',
      acento: '#B45309',
      rubrosPrioritarios: ['cafeteria', 'gastronomia']
    }
  },
  {
    nombre: 'almuerzo',
    horaInicio: '12:00',
    horaFin: '14:30',
    titulo: '🍽️ Modo Almuerzo',
    descripcion: 'El menú del día de rotiserías, restaurantes y viandas rápidas. Listo para retirar o pedir.',
    tipoDispatcher: 'cercania',
    distanciaMaxima: 600,
    tema: {
      emoji: '🍽️',
      colorDesde: '#EA580C', // naranja apetito
      colorHasta: '#DC2626',
      acento: '#EA580C',
      rubrosPrioritarios: ['gastronomia', 'cafeteria']
    }
  },
  {
    nombre: 'siesta',
    horaInicio: '14:30',
    horaFin: '17:00',
    titulo: '🛍️ Shopping de Siesta',
    descripcion: 'El local del centro está cerrado, pero el Radar no. Descuentos agresivos en indumentaria, tecnología y calzado para comprar online ahora.',
    tipoDispatcher: 'shopping',
    distanciaMaxima: 1000,
    tema: {
      emoji: '🛍️',
      colorDesde: '#7C3AED', // violeta retail
      colorHasta: '#C026D3',
      acento: '#9333EA',
      rubrosPrioritarios: ['indumentaria', 'otro']
    }
  },
  {
    nombre: 'merienda',
    horaInicio: '17:30',
    horaFin: '19:30',
    titulo: '☕ Modo Merienda',
    descripcion: 'Vuelve lo dulce: cafeterías, pastelería y la pausa de la tarde. Descubrí rutas de recompensa cruzada.',
    tipoDispatcher: 'cruzada',
    distanciaMaxima: 500,
    tema: {
      emoji: '☕',
      colorDesde: '#DB2777', // rosa merienda
      colorHasta: '#9333EA',
      acento: '#DB2777',
      rubrosPrioritarios: ['cafeteria', 'gastronomia']
    }
  },
  {
    nombre: 'cena',
    horaInicio: '20:00',
    horaFin: '23:30',
    titulo: '🌙 Modo Cena / Bar',
    descripcion: 'Prioridad absoluta para cervecerías, pizzerías y delivery local. Cerrá la noche cerca tuyo.',
    tipoDispatcher: 'general',
    distanciaMaxima: 800,
    tema: {
      emoji: '🌙',
      colorDesde: '#1E3A8A', // azul noche
      colorHasta: '#312E81',
      acento: '#4F46E5',
      rubrosPrioritarios: ['gastronomia', 'cafeteria']
    }
  }
]

/**
 * Inicializa / migra los bloques del Radar Camaleón.
 *
 * Migración (problema de config #2): el seed original solo corría con la
 * colección vacía, así que en producción los 3 bloques viejos (manana/tarde/
 * noche) nunca se actualizaban a los 5 modos nuevos. Ahora detectamos si
 * faltan los modos nuevos y re-sembramos, preservando el flag `activo` que el
 * admin haya configurado por nombre cuando coincide.
 */
export async function sembrarBloqueHorario() {
  try {
    const existentes = await BloqueHorarioConfig.find().lean()
    const nombresExistentes = new Set(existentes.map(b => b.nombre))
    const yaTieneCamaleon = BLOQUES_CAMALEON.every(b => nombresExistentes.has(b.nombre))

    if (yaTieneCamaleon) {
      console.log('✓ BloqueHorarioConfig (Camaleón) ya inicializado.')
      return
    }

    // Preservar el estado activo/inactivo configurado por el admin, por nombre.
    const activoPorNombre = new Map(existentes.map(b => [b.nombre, b.activo]))

    // Reemplazar los bloques legacy (manana/tarde/noche) por los 5 modos temáticos.
    await BloqueHorarioConfig.deleteMany({})
    const bloques = BLOQUES_CAMALEON.map(b => ({
      ...b,
      activo: activoPorNombre.has(b.nombre) ? activoPorNombre.get(b.nombre) : true
    }))
    await BloqueHorarioConfig.insertMany(bloques)

    console.log(`✓ Radar Camaleón sembrado: 5 modos (desayuno, almuerzo, siesta, merienda, cena) [seed v${SEED_VERSION}].`)
  } catch (error) {
    console.error('✗ Error al inicializar BloqueHorarioConfig:', error.message)
  }
}

export default sembrarBloqueHorario
