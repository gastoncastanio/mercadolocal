import mongoose from 'mongoose'

const resenaSchema = new mongoose.Schema({
  compradorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  productoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producto',
    required: true
  },
  ordenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Orden',
    required: true
  },
  calificacion: {
    type: Number,
    required: [true, 'La calificacion es obligatoria'],
    min: 1,
    max: 5
  },
  comentario: {
    type: String,
    default: ''
  },
  respuestaVendedor: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
})

const Resena = mongoose.model('Resena', resenaSchema)

export default Resena
