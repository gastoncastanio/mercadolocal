import mongoose from 'mongoose'

const itemOrdenSchema = new mongoose.Schema({
  productoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producto',
    required: true
  },
  tiendaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tienda',
    required: true
  },
  nombre: {
    type: String,
    required: true
  },
  cantidad: {
    type: Number,
    required: true,
    min: 1
  },
  precioUnitario: {
    type: Number,
    required: true
  },
  subtotal: {
    type: Number,
    required: true
  }
}, { _id: false })

const ordenSchema = new mongoose.Schema({
  compradorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  items: [itemOrdenSchema],
  total: {
    type: Number,
    required: true
  },
  comision: {
    type: Number,
    required: true
  },
  porcentajeComision: {
    type: Number,
    default: 10
  },
  gananciaVendedor: {
    type: Number,
    required: true
  },
  estado: {
    type: String,
    enum: ['pendiente', 'pagada', 'enviada', 'completada', 'cancelada'],
    default: 'pendiente'
  },
  direccionEntrega: {
    type: String,
    required: [true, 'La dirección de entrega es obligatoria']
  },
  notasComprador: {
    type: String,
    default: ''
  },
  nombreComprador: {
    type: String,
    default: ''
  },
  telefonoComprador: {
    type: String,
    default: ''
  },
  mpPreferenceId: {
    type: String,
    default: ''
  },
  mpPaymentId: {
    type: String,
    default: ''
  },
  mpStatus: {
    type: String,
    default: ''
  },
  usaSplit: {
    type: Boolean,
    default: false
  },
  fechaConfirmacion: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
})

const Orden = mongoose.model('Orden', ordenSchema)

export default Orden
