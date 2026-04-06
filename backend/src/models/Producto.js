import mongoose from 'mongoose'

const productoSchema = new mongoose.Schema({
  tiendaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tienda',
    required: true
  },
  nombre: {
    type: String,
    required: [true, 'El nombre del producto es obligatorio'],
    trim: true
  },
  descripcion: {
    type: String,
    default: ''
  },
  precio: {
    type: Number,
    required: [true, 'El precio es obligatorio'],
    min: [0, 'El precio no puede ser negativo']
  },
  stock: {
    type: Number,
    default: 1,
    min: [0, 'El stock no puede ser negativo']
  },
  imagenes: {
    type: [String],
    default: []
  },
  categorias: {
    type: [String],
    default: []
  },
  ciudad: {
    type: String,
    default: ''
  },
  calificacion: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalVentas: {
    type: Number,
    default: 0
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

// Índice de texto para búsqueda
productoSchema.index({ nombre: 'text', descripcion: 'text', categorias: 'text' })

const Producto = mongoose.model('Producto', productoSchema)

export default Producto
