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
  leido: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
})

const Mensaje = mongoose.model('Mensaje', mensajeSchema)

export default Mensaje
