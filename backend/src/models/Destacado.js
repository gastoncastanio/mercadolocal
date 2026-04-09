import mongoose from 'mongoose'

/**
 * Productos destacados / promovidos por vendedores.
 * El vendedor paga para que su producto aparezca con prioridad
 * en el cat\u00e1logo, banners y espacios publicitarios.
 */
const destacadoSchema = new mongoose.Schema({
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
  vendedorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  plan: {
    type: String,
    enum: ['basico', 'premium', 'elite'],
    required: true
  },
  ubicacion: {
    type: [String],
    default: ['catalogo'],
    enum: ['catalogo', 'banner', 'publicidad', 'busqueda']
  },
  duracionDias: {
    type: Number,
    required: true
  },
  precioTotal: {
    type: Number,
    required: true
  },
  fechaInicio: {
    type: Date,
    default: Date.now
  },
  fechaFin: {
    type: Date,
    required: true
  },
  activo: {
    type: Boolean,
    default: true
  },
  impresiones: {
    type: Number,
    default: 0
  },
  clicks: {
    type: Number,
    default: 0
  },
  estado: {
    type: String,
    enum: ['pendiente', 'activo', 'pausado', 'finalizado', 'cancelado'],
    default: 'activo'
  }
}, {
  timestamps: true
})

destacadoSchema.index({ fechaFin: 1, activo: 1, estado: 1 })
destacadoSchema.index({ productoId: 1, activo: 1 })

const Destacado = mongoose.model('Destacado', destacadoSchema)

export default Destacado
