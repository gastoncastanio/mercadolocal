import mongoose from 'mongoose'

const favoritoSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  productoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producto',
    required: true
  }
}, {
  timestamps: true
})

favoritoSchema.index({ usuarioId: 1, productoId: 1 }, { unique: true })

const Favorito = mongoose.model('Favorito', favoritoSchema)

export default Favorito
