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
  // Origen de la reseña: una solicitud de servicio o un trabajo de la bolsa.
  tipo: {
    type: String,
    enum: ['servicio', 'trabajo'],
    default: 'servicio'
  },
  // Requerido solo cuando tipo='servicio'
  solicitudId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SolicitudServicio',
    default: null
  },
  // Requerido solo cuando tipo='trabajo'
  trabajoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrabajoBuscado',
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
// Un cliente solo reseña una vez por solicitud (sparse: ignora docs sin solicitudId)
resenaServicioSchema.index({ clienteId: 1, solicitudId: 1 }, { unique: true, sparse: true })
// Un cliente solo reseña una vez por trabajo (sparse: ignora docs sin trabajoId)
resenaServicioSchema.index({ clienteId: 1, trabajoId: 1 }, { unique: true, sparse: true })

const ResenaServicio = mongoose.model('ResenaServicio', resenaServicioSchema)

export default ResenaServicio
