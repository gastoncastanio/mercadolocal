import mongoose from 'mongoose'

/**
 * ResenaComisionista — reseña 1-5 que un contratante/pasajero deja sobre un
 * comisionista. Recalcula PerfilComisionista.calificacion (promedio).
 *
 * Cubre dos verticales del mismo conductor:
 *   - Envíos (EnvioComisionista) → campo envioId
 *   - Remis (ViajeRemis)         → campo viajeRemisId
 * Exactamente uno de los dos está presente. Índices sparse unique para que el
 * contratante reseñe una sola vez por envío y el pasajero una sola vez por viaje.
 */
const resenaComisionistaSchema = new mongoose.Schema({
  contratanteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  comisionistaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  // Reseña de envío (presente solo si la reseña es de un EnvioComisionista).
  envioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EnvioComisionista',
    default: null
  },
  // Reseña de remis (presente solo si la reseña es de un ViajeRemis).
  viajeRemisId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ViajeRemis',
    default: null
  },
  calificacion: {
    type: Number,
    required: [true, 'La calificación es obligatoria'],
    min: 1,
    max: 5
  },
  comentario: {
    type: String,
    default: ''
  },
  respuestaComisionista: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
})

// ===== Índices =====
// Reseñas del comisionista (para calcular calificación promedio y listar)
resenaComisionistaSchema.index({ comisionistaId: 1, createdAt: -1 })
// Un contratante reseña una sola vez por envío (sparse: ignora docs sin envioId)
resenaComisionistaSchema.index({ contratanteId: 1, envioId: 1 }, { unique: true, sparse: true })
// Un pasajero reseña una sola vez por viaje de remis
resenaComisionistaSchema.index({ contratanteId: 1, viajeRemisId: 1 }, { unique: true, sparse: true })

const ResenaComisionista = mongoose.model('ResenaComisionista', resenaComisionistaSchema)

export default ResenaComisionista
