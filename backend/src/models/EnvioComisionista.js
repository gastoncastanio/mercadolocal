import mongoose from 'mongoose'

/**
 * EnvioComisionista — una reserva/contratación de un bulto (o varios) en un
 * Viaje. Vincula al contratante con el comisionista y desbloquea el chat seguro.
 *
 * Máquina de estados:
 *   pendiente   → el contratante reservó cupo (espera que el comisionista acepte)
 *   aceptado    → el comisionista confirmó que lo lleva
 *   en_transito → el bulto está en viaje
 *   entregado   → se validó el código de entrega en destino (cierra el envío)
 *   cancelado   → contratante o comisionista lo cancela (devuelve cupo al viaje)
 *
 * Anti-fraude entrega: guardamos solo el HASH del código de entrega (igual que
 * el código de canje del Radar). El contratante recibe el código en claro una
 * sola vez; el comisionista lo ingresa al entregar para pasar a 'entregado'.
 */
const envioComisionistaSchema = new mongoose.Schema({
  viajeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Viaje',
    required: true,
    index: true
  },
  // Denormalizado desde el viaje para lookups rápidos y desbloqueo de chat.
  comisionistaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  contratanteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  // Si el envío nace de una compra de producto a otra localidad, se liga la orden.
  ordenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Orden',
    default: null
  },
  cantidadBultos: {
    type: Number,
    required: true,
    min: 1
  },
  tamano: {
    type: String,
    enum: ['chico', 'mediano', 'grande'],
    required: true
  },
  // Qué se envía (descripción del contenido, sin datos sensibles).
  descripcion: {
    type: String,
    default: ''
  },
  precio: {
    type: Number,
    required: true,
    min: 0
  },
  estado: {
    type: String,
    enum: ['pendiente', 'aceptado', 'en_transito', 'entregado', 'cancelado'],
    default: 'pendiente',
    index: true
  },
  // Hash sha256 del código de entrega (el código en claro vive solo en el cliente).
  codigoEntregaHash: {
    type: String,
    default: null
  },
  entregadoEn: {
    type: Date,
    default: null
  },
  // Pago (split al comisionista). Se completa en el chunk de integración de pago.
  pago: {
    mpPaymentId: { type: String, default: null },
    estadoPago: {
      type: String,
      enum: ['no_aplica', 'pendiente_pago', 'pagado', 'reembolsado'],
      default: 'pendiente_pago'
    }
  }
}, {
  timestamps: true
})

// Listados habituales
envioComisionistaSchema.index({ contratanteId: 1, estado: 1 })
envioComisionistaSchema.index({ comisionistaId: 1, estado: 1 })

const EnvioComisionista = mongoose.model('EnvioComisionista', envioComisionistaSchema)
export default EnvioComisionista
