import mongoose from 'mongoose'
import { encriptar, desencriptar, estaEncriptado } from '../utils/crypto.js'

const suscripcionSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  tipo: {
    type: String,
    enum: ['profesional_destacado'],
    required: true
  },
  referenciaId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  plan: {
    type: String,
    required: true
  },
  precioMensual: {
    type: Number,
    required: true
  },
  estado: {
    type: String,
    enum: ['activa', 'pausada', 'cancelada'],
    default: 'activa'
  },
  mpPreapprovalId: {
    type: String,
    default: ''
  },
  proximoCobro: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
})

// ===== Índices =====
// Búsqueda de suscripciones activas del usuario
suscripcionSchema.index({ usuarioId: 1, estado: 1, tipo: 1 })
// Búsqueda por tipo y referencias (p.ej., destacados activos)
suscripcionSchema.index({ tipo: 1, estado: 1, proximoCobro: 1 })

// Encriptar mpPreapprovalId antes de guardar
suscripcionSchema.pre('save', function (next) {
  try {
    if (this.isModified('mpPreapprovalId') && this.mpPreapprovalId && !estaEncriptado(this.mpPreapprovalId)) {
      this.mpPreapprovalId = encriptar(this.mpPreapprovalId)
    }
    next()
  } catch (error) {
    console.error('❌ Error al encriptar mpPreapprovalId:', error.message)
    next(error)
  }
})

// Método para obtener mpPreapprovalId desencriptado
suscripcionSchema.methods.getMpPreapprovalId = function () {
  return desencriptar(this.mpPreapprovalId)
}

const Suscripcion = mongoose.model('Suscripcion', suscripcionSchema)

export default Suscripcion
