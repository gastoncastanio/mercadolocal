import mongoose from 'mongoose'

const gastoOperativoSchema = new mongoose.Schema({
  // Categoría de gasto (para reportes)
  categoria: {
    type: String,
    enum: ['marketing', 'hosting', 'honorarios', 'infraestructura', 'otro'],
    required: true,
    index: true
  },

  // Concepto detallado (ej: "Pauta Meta Lobos - Junio")
  concepto: {
    type: String,
    required: true
  },

  // Monto del gasto
  monto: {
    type: Number,
    required: true,
    min: 0
  },

  // Moneda
  moneda: {
    type: String,
    enum: ['ARS', 'USD'],
    default: 'ARS'
  },

  // Fecha del gasto (contable)
  fechaGasto: {
    type: Date,
    required: true,
    index: true
  },

  // Quien cargó el gasto (audit trail)
  cargadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },

  // URL del comprobante (si existe)
  comprobanteUrl: {
    type: String,
    default: ''
  },

  // ¿Ya se generó el asiento contable?
  asientoGenerado: {
    type: Boolean,
    default: false
  },

  // Referencia al asiento si existe
  asientoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AsientoContable',
    default: null
  },

  // Notas internas
  notas: {
    type: String,
    default: ''
  },

  // ¿Está activo? (soft delete)
  activo: {
    type: Boolean,
    default: true,
    index: true
  }
}, { timestamps: true })

// Índices para filtrado rápido
gastoOperativoSchema.index({ categoria: 1, fechaGasto: -1 })
gastoOperativoSchema.index({ cargadoPor: 1, createdAt: -1 })
gastoOperativoSchema.index({ asientoGenerado: 1, activo: 1 }) // Para batch que genera asientos

export default mongoose.model('GastoOperativo', gastoOperativoSchema)
