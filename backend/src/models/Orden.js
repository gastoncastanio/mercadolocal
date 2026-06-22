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
    enum: ['pendiente', 'pagada', 'enviada', 'completada', 'cancelada', 'reembolsada'],
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
  // Sobreventa: si al confirmar el pago no había stock suficiente para algún item
  // (otra compra concurrente lo agotó), se marca acá. El pago YA se cobró, así que
  // nunca rechazamos la orden: el vendedor repone o reembolsa estos items.
  incidenciaStock: {
    hay: { type: Boolean, default: false },
    items: [{
      productoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto' },
      nombre: String,
      pedido: Number,      // cuánto se vendió
      disponible: Number   // cuánto había realmente
    }]
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
  },
  // Entrega "comisionista en vivo": el comprador eligió en el checkout que un
  // comisionista activo retire y entregue HOY. Al confirmarse el pago, se hace
  // un BROADCAST a los comisionistas trabajando y compiten por el envío (ofertan
  // precio). El comprador elige la mejor. Si nadie oferta en la ventana, expira
  // y se le avisa al comprador para que use envío estándar.
  entregaEnVivo: {
    activa: { type: Boolean, default: false },
    estado: {
      type: String,
      enum: ['no_aplica', 'buscando', 'adjudicado', 'expirado'],
      default: 'no_aplica'
    },
    expiraEn: { type: Date, default: null }
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
