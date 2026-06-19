import mongoose from 'mongoose'

// Oferta (puja) de un profesional sobre un TrabajoBuscado. Compiten por precio.
const bidSchema = new mongoose.Schema({
  trabajoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrabajoBuscado',
    required: true
  },
  // Profesional que oferta. Debe tener un PerfilProfesional.
  profesionalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  precioOfrecido: {
    type: Number,
    required: [true, 'El precio ofrecido es obligatorio'],
    min: 0
  },
  // Pitch / propuesta del profesional
  notas: {
    type: String,
    default: ''
  },
  estado: {
    type: String,
    enum: ['activa', 'aceptada', 'rechazada'],
    default: 'activa'
  }
}, {
  timestamps: true
})

// ===== Índices =====
// Todas las ofertas de un trabajo (vista del cliente)
bidSchema.index({ trabajoId: 1, createdAt: -1 })
// Ofertas de un profesional por estado
bidSchema.index({ profesionalId: 1, estado: 1 })
// Un profesional no puede ofertar dos veces en el mismo trabajo
bidSchema.index({ trabajoId: 1, profesionalId: 1 }, { unique: true })

const Bid = mongoose.model('Bid', bidSchema)

export default Bid
