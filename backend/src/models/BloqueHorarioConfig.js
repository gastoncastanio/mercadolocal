import mongoose from 'mongoose'

/**
 * BloqueHorarioConfig — Define las franjas horarias del despachador dinámico.
 * Permite al admin configurar horarios sin cambiar código.
 */
const bloqueHorarioConfigSchema = new mongoose.Schema({
  // Identificador único (manana, tarde, noche, etc.)
  nombre: {
    type: String,
    required: true,
    unique: true,
    enum: ['manana', 'tarde', 'noche'],
    index: true
  },

  // Horario de apertura y cierre (formato HH:MM en ART/Buenos Aires)
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
    enum: ['cercania', 'cruzada', 'general'],
    default: 'general'
    // cercania: ordena por proximidad (< 300m prioritario)
    // cruzada: muestra ofertas con desbloquea (carrusel de "Rutas")
    // general: todas las ofertas del bloque, sin orden especial
  },

  // ¿Está activo?
  activo: { type: Boolean, default: true },

  // Límite de proximidad para "cercania" (metros)
  distanciaMaxima: { type: Number, default: 300 }
}, { timestamps: true })

const BloqueHorarioConfig = mongoose.model('BloqueHorarioConfig', bloqueHorarioConfigSchema)
export default BloqueHorarioConfig
