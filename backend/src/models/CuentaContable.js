import mongoose from 'mongoose'

const cuentaContableSchema = new mongoose.Schema({
  // Código de cuenta (ej: "1.1.1", "4.1.1")
  codigo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },

  // Nombre de la cuenta (ej: "Caja MercadoPago")
  nombre: {
    type: String,
    required: true,
    trim: true
  },

  // Tipo de cuenta (determina débito/crédito natural)
  tipo: {
    type: String,
    enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
    required: true,
    index: true
  },

  // Descripción extendida para la documentación
  descripcion: {
    type: String,
    default: ''
  },

  // ¿Es una cuenta del sistema que no se puede borrar?
  esSistema: {
    type: Boolean,
    default: false
  },

  // ¿Está activa?
  activa: {
    type: Boolean,
    default: true,
    index: true
  },

  // Moneda por defecto (extensible para futuro multimoneda)
  moneda: {
    type: String,
    enum: ['ARS', 'USD'],
    default: 'ARS'
  },

  // Saldo actual (calculado, pero cacheado para performance)
  saldoEnCache: {
    type: Number,
    default: 0
  },

  // Timestamp de la última actualización del cache
  saldoCacheActualizadoEn: {
    type: Date,
    default: null
  },

  // Metadata para extensión futura
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true })

// Índices para búsqueda rápida
cuentaContableSchema.index({ tipo: 1, activa: 1 })
cuentaContableSchema.index({ codigo: 1, activa: 1 })

export default mongoose.model('CuentaContable', cuentaContableSchema)
