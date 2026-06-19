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
  },
  // Datos del envío (cuando el vendedor marca como "enviada")
  codigoSeguimiento: {
    type: String,
    default: ''
  },
  empresaEnvio: {
    type: String,
    default: '' // ej: "Andreani", "OCA", "Correo Argentino", "Entrega propia"
  },
  fechaEnvio: {
    type: Date,
    default: null
  },
  // Integración con módulo de comisionistas (envío "en vivo")
  comisionistaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    default: null
  },
  envioComisionistaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EnvioComisionista',
    default: null
  },
  ciudadEntrega: {
    type: String,
    default: '' // Extraída de direccionEntrega, usada para filtrar comisionistas
  }
}, {
  timestamps: true
})

// ===== Índices compuestos para queries frecuentes =====
// Órdenes del comprador, ordenadas por fecha
ordenSchema.index({ compradorId: 1, createdAt: -1 })
// Órdenes del vendedor por tienda + estado (panel de pedidos)
ordenSchema.index({ 'items.tiendaId': 1, estado: 1, createdAt: -1 })
// Limpieza de órdenes pendientes vencidas (cron)
ordenSchema.index({ estado: 1, createdAt: 1 })
// Búsqueda por referencia de MP (webhook callbacks)
ordenSchema.index({ mpPaymentId: 1 }, { sparse: true })
// Estadísticas de admin: órdenes pagadas en rango de fecha
ordenSchema.index({ estado: 1, fechaConfirmacion: -1 })

const Orden = mongoose.model('Orden', ordenSchema)

export default Orden
