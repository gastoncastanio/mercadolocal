import mongoose from 'mongoose'

const disputaSchema = new mongoose.Schema({
  ordenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Orden',
    required: true
  },
  compradorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  vendedorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  motivo: {
    type: String,
    enum: ['producto_dañado', 'no_recibido', 'diferente_descripcion', 'otro'],
    required: true
  },
  descripcion: {
    type: String,
    required: [true, 'La descripcion es obligatoria']
  },
  estado: {
    type: String,
    enum: ['abierta', 'en_revision', 'resuelta_comprador', 'resuelta_vendedor', 'cerrada'],
    default: 'abierta'
  },
  resolucion: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
})

const Disputa = mongoose.model('Disputa', disputaSchema)

export default Disputa
