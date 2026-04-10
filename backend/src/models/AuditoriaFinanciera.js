import mongoose from 'mongoose'

const auditoriaFinancieraSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['pago_aprobado', 'pago_rechazado', 'pago_pendiente', 'reembolso', 'disputa', 'comision'],
    required: true
  },
  ordenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Orden',
    required: true
  },
  mpPaymentId: {
    type: String,
    default: ''
  },
  monto: {
    type: Number,
    default: 0
  },
  comision: {
    type: Number,
    default: 0
  },
  gananciaVendedor: {
    type: Number,
    default: 0
  },
  usaSplit: {
    type: Boolean,
    default: false
  },
  compradorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  },
  tiendaIds: [{
    type: String
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
})

auditoriaFinancieraSchema.index({ ordenId: 1 })
auditoriaFinancieraSchema.index({ tipo: 1, createdAt: -1 })
auditoriaFinancieraSchema.index({ compradorId: 1 })
auditoriaFinancieraSchema.index({ mpPaymentId: 1 })

const AuditoriaFinanciera = mongoose.model('AuditoriaFinanciera', auditoriaFinancieraSchema)

export default AuditoriaFinanciera
