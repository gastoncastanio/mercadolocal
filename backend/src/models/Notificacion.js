import mongoose from 'mongoose'

const notificacionSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  tipo: {
    type: String,
    enum: ['venta', 'compra', 'mensaje', 'pregunta', 'resena', 'disputa', 'sistema', 'pago'],
    default: 'sistema'
  },
  titulo: {
    type: String,
    required: true
  },
  mensaje: {
    type: String,
    default: ''
  },
  enlace: {
    type: String,
    default: ''
  },
  leida: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
})

notificacionSchema.index({ usuarioId: 1, leida: 1, createdAt: -1 })

const Notificacion = mongoose.model('Notificacion', notificacionSchema)

export default Notificacion
