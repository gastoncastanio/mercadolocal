import mongoose from 'mongoose'

const mensajeSchema = new mongoose.Schema({
  conversacionId: {
    type: String,
    required: true
  },
  emisorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  receptorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  productoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producto'
  },
  mensaje: {
    type: String,
    required: [true, 'El mensaje es obligatorio'],
    maxlength: 1000
  },
  // Si el mensaje fue censurado (contenía contacto externo pre-venta),
  // guardamos el texto original para auditoría y detección de evasores sistemáticos.
  // El comprador/vendedor NUNCA ve este campo — es solo para moderación interna.
  mensajeOriginal: {
    type: String,
    default: '',
    maxlength: 1000
  },
  huboCensura: {
    type: Boolean,
    default: false
  },
  leido: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
})

// Índice para que el panel de moderación pueda buscar evasores rápidamente
mensajeSchema.index({ emisorId: 1, huboCensura: 1, createdAt: -1 })

// IMPORTANTE: nunca exponer el mensaje original al frontend.
// Solo el panel de moderación interno puede leerlo.
mensajeSchema.methods.toJSON = function () {
  const obj = this.toObject()
  delete obj.mensajeOriginal
  return obj
}

const Mensaje = mongoose.model('Mensaje', mensajeSchema)

export default Mensaje
