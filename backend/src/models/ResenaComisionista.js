import mongoose from 'mongoose'

/**
 * ResenaComisionista — reseña 1-5 que un contratante deja sobre un comisionista
 * tras un envío entregado. Recalcula PerfilComisionista.calificacion (promedio).
 *
 * Espejo de ResenaServicio: el contratante solo puede reseñar una vez por envío
 * (índice unique sparse) y solo si el envío llegó a estado 'entregado'.
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
  envioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EnvioComisionista',
    required: true
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
// Un contratante reseña una sola vez por envío
resenaComisionistaSchema.index({ contratanteId: 1, envioId: 1 }, { unique: true })

const ResenaComisionista = mongoose.model('ResenaComisionista', resenaComisionistaSchema)

export default ResenaComisionista
