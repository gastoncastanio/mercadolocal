import mongoose from 'mongoose'

const resenaServicioSchema = new mongoose.Schema({
  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  profesionalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  solicitudId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SolicitudServicio',
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
  respuestaProfesional: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
})

// ===== Índices =====
// Reseñas del profesional (para calcular calificación promedio)
resenaServicioSchema.index({ profesionalId: 1, createdAt: -1 })
// Validar que un cliente solo reseñe una vez por solicitud
resenaServicioSchema.index({ clienteId: 1, solicitudId: 1 }, { unique: true })

const ResenaServicio = mongoose.model('ResenaServicio', resenaServicioSchema)

export default ResenaServicio
