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
  peso: {
    type: Number,
    default: 0,
    min: 0
  },
  alto: {
    type: Number,
    default: 0,
    min: 0
  },
  ancho: {
    type: Number,
    default: 0,
    min: 0
  },
  largo: {
    type: Number,
    default: 0,
    min: 0
  },
  envioGratis: {
    type: Boolean,
    default: false
  },
  condicion: {
    type: String,
    enum: ['nuevo', 'usado', 'reacondicionado'],
    default: 'nuevo'
  },
  garantia: {
    type: String,
    default: ''
  },
  caracteristicas: {
    type: [{ clave: String, valor: String }],
    default: []
  },
  // ===== Identificación del producto (para catálogo central y verificación) =====
  // Código de barras universal (EAN-13, UPC-A, GTIN-12/14).
  // Opcional en general, pero obligatorio en categorías de alto riesgo (electrónica nueva,
  // alimentos envasados, cosmética). Si se pone, permite agrupar productos idénticos
  // de distintos vendedores en el catálogo y mostrar comparación de precios.
  codigoBarras: {
    type: String,
    default: '',
    trim: true,
    index: true // para búsqueda rápida cuando agrupamos productos iguales
  },
  // Marca del producto (Samsung, Apple, Dia, etc.) — útil para filtrado y SEO.
  // Distinto de la tienda que lo vende.
  marca: {
    type: String,
    default: '',
    trim: true
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

// Índices para búsqueda y performance
productoSchema.index({ nombre: 'text', descripcion: 'text', categorias: 'text' })
productoSchema.index({ tiendaId: 1, activo: 1 })
productoSchema.index({ activo: 1, totalVentas: -1 })
productoSchema.index({ activo: 1, calificacion: -1 })
productoSchema.index({ activo: 1, precio: 1 })

const Producto = mongoose.model('Producto', productoSchema)

export default Producto
