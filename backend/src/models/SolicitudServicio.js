import mongoose from 'mongoose'

const solicitudServicioSchema = new mongoose.Schema({
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
  rubro: {
    type: String,
    required: true
  },
  descripcion: {
    type: String,
    required: true
  },
  zona: {
    type: String,
    required: true
  },
  fechaSolicitada: {
    type: Date,
    default: Date.now
  },
  cotizacion: {
    monto: {
      type: Number,
      default: null
    },
    notas: {
      type: String,
      default: ''
    },
    fecha: {
      type: Date,
      default: null
    }
  },
  estado: {
    type: String,
    enum: ['solicitada', 'cotizada', 'aceptada', 'en_curso', 'completada', 'cancelada'],
    default: 'solicitada'
  }
}, {
  timestamps: true
})

// ===== Índices =====
// Solicitudes del cliente por estado
solicitudServicioSchema.index({ clienteId: 1, estado: 1, createdAt: -1 })
// Solicitudes del profesional por estado (panel profesional)
solicitudServicioSchema.index({ profesionalId: 1, estado: 1, createdAt: -1 })
// Búsqueda por rubro y localidad
solicitudServicioSchema.index({ rubro: 1, zona: 1, createdAt: -1 })

const SolicitudServicio = mongoose.model('SolicitudServicio', solicitudServicioSchema)

export default SolicitudServicio
