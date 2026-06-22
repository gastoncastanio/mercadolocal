import mongoose from 'mongoose'

const notificacionSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  // Categoría libre (no enum): cada vertical usa la suya (venta, compra, pago,
  // remis, envio, cotizacion, comisionista, servicio, trabajo, disputa, resena,
  // mensaje, sistema...). El frontend mapea las conocidas a un ícono y cae a uno
  // por defecto si no la reconoce. Un enum rígido hacía que la persistencia
  // fallara en silencio cuando un servicio nuevo usaba un tipo no listado.
  tipo: {
    type: String,
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
