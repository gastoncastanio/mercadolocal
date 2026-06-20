import mongoose from 'mongoose'

/**
 * BloqueHorarioConfig — Define las franjas horarias del despachador dinámico.
 * Permite al admin configurar horarios sin cambiar código.
 */
const bloqueHorarioConfigSchema = new mongoose.Schema({
  // Identificador único del modo temático del Radar Camaleón.
  // El Radar muta su interfaz según cuál esté activo a la hora del usuario.
  nombre: {
    type: String,
    required: true,
    unique: true,
    enum: ['desayuno', 'almuerzo', 'siesta', 'merienda', 'cena', 'manana', 'tarde', 'noche'],
    index: true
  },

  // Horario de apertura y cierre (formato HH:MM en ART/Buenos Aires).
  // Soporta cruce de medianoche: si horaFin < horaInicio (ej. 22:00–02:00),
  // la franja envuelve la medianoche (ver utils/bloqueHorario.js).
  horaInicio: {
    type: String,
    required: true,
    match: /^\d{2}:\d{2}$/
  },
  horaFin: {
    type: String,
    required: true,
    match: /^\d{2}:\d{2}$/
  },

  // Textos para UI
  titulo: {
    type: String,
    required: true,
    // ej. "Fast-Track Urbano", "Desconexión e Impulso"
  },
  descripcion: {
    type: String,
    default: ''
  },

  // Estrategia de despacho
  tipoDispatcher: {
    type: String,
    enum: ['cercania', 'cruzada', 'general', 'shopping'],
    default: 'general'
    // cercania: ordena por proximidad (< 300m prioritario)
    // cruzada: muestra ofertas con desbloquea (carrusel de "Rutas")
    // general: todas las ofertas del bloque, sin orden especial
    // shopping: modo siesta — prioriza productos online del marketplace
    //           mientras el local físico está cerrado
  },

  // ===== TEMA VISUAL DEL CAMALEÓN =====
  // El Radar muta sus colores según el bloque activo. Se guardan como HEX
  // (NO clases Tailwind, que se purgan en build); el frontend los aplica con
  // `style` inline para mutar la interfaz en runtime.
  tema: {
    emoji: { type: String, default: '📍' },
    colorDesde: { type: String, default: '#7C3AED' }, // gradiente hero (inicio)
    colorHasta: { type: String, default: '#2563EB' }, // gradiente hero (fin)
    acento: { type: String, default: '#7C3AED' },     // botones / acentos
    // Rubros que este modo prioriza arriba del feed
    rubrosPrioritarios: { type: [String], default: [] }
  },

  // ¿Está activo?
  activo: { type: Boolean, default: true },

  // Límite de proximidad para "cercania" (metros)
  distanciaMaxima: { type: Number, default: 300 }
}, { timestamps: true })

const BloqueHorarioConfig = mongoose.model('BloqueHorarioConfig', bloqueHorarioConfigSchema)
export default BloqueHorarioConfig
