import mongoose from 'mongoose'

// Bolsa de trabajo inversa: un cliente publica un trabajo a realizar y los
// profesionales con perfil compiten ofertando un precio (ver Bid.js).
const trabajoBuscadoSchema = new mongoose.Schema({
  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  titulo: {
    type: String,
    required: [true, 'El título es obligatorio'],
    trim: true
  },
  descripcion: {
    type: String,
    required: [true, 'La descripción es obligatoria']
  },
  rubro: {
    type: String,
    enum: ['sanitarios', 'electricista', 'gasista', 'carpintero', 'plomero', 'pintor', 'limpieza', 'otros'],
    required: true
  },
  localidad: {
    type: String,
    required: [true, 'La localidad es obligatoria'],
    trim: true
  },
  presupuestoMin: {
    type: Number,
    default: null,
    min: 0
  },
  presupuestoMax: {
    type: Number,
    default: null,
    min: 0
  },
  plazoEntrega: {
    type: Date,
    default: null
  },
  // Habilidades sugeridas / requeridas (tags)
  skills: [String],
  estado: {
    type: String,
    enum: ['activo', 'en_revision', 'asignado', 'completado', 'cancelado'],
    default: 'activo'
  },
  // Profesional al que se le asigna el trabajo. Ref a Usuario (NO a
  // PerfilProfesional) para reusar directo el desbloqueo de chat seguro.
  profesionalAsignadoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    default: null
  },
  bidGanadora: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bid',
    default: null
  }
}, {
  timestamps: true
})

// ===== Índices =====
// Mis trabajos como cliente, por estado
trabajoBuscadoSchema.index({ clienteId: 1, estado: 1, createdAt: -1 })
// Búsqueda de trabajos abiertos por rubro y localidad (browse del profesional)
trabajoBuscadoSchema.index({ rubro: 1, localidad: 1, estado: 1, createdAt: -1 })
// Trabajos asignados a un profesional
trabajoBuscadoSchema.index({ profesionalAsignadoId: 1, estado: 1 })

const TrabajoBuscado = mongoose.model('TrabajoBuscado', trabajoBuscadoSchema)

export default TrabajoBuscado
