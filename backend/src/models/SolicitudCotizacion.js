import mongoose from 'mongoose'

/**
 * SolicitudCotizacion — pedido de cotización "en vivo" que un comprador le envía
 * a un comisionista para trasladar una compra del marketplace desde la ciudad
 * del vendedor hasta la suya. Espejo simplificado de SolicitudServicio.
 *
 * IMPORTANTE (deslinde legal): MercadoLocal SOLO conecta. El traslado, su precio
 * y cualquier problema (rotura, accidente, demora, etc.) quedan 100% a cargo del
 * comisionista y el vendedor. La plataforma no es responsable. Si el comisionista
 * reporta una rotura, el vendedor reintegra al comprador (o le ofrece un producto
 * igual/similar). Ver campos `incidente` y `terminosAceptados`.
 *
 * Máquina de estados:
 *   pendiente   → el comprador envió la solicitud (espera cotización)
 *   cotizada    → el comisionista respondió con un precio
 *   aceptada    → el comprador aceptó la cotización (desbloquea coordinación)
 *   en_transito → traslado pagado y el comisionista ya retiró el paquete
 *   entregado   → se validó el código de entrega en destino (CIERRA el flujo)
 *   rechazada   → el comisionista no puede / el comprador no aceptó
 *   cancelada   → alguna de las partes la dio de baja
 *
 * Anti-fraude entrega (igual que EnvioComisionista): guardamos solo el HASH del
 * código de entrega. El comprador recibe el código en claro una sola vez (vive en
 * su dispositivo) y se lo da al comisionista al recibir; el comisionista lo ingresa
 * para pasar a 'entregado'. Así "el comprador confirma recepción" sin que el
 * comisionista pueda cerrar el traslado sin haber entregado de verdad.
 */
const solicitudCotizacionSchema = new mongoose.Schema({
  // Orden del marketplace que se quiere trasladar.
  ordenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Orden',
    required: true,
    index: true
  },
  compradorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  // Comisionista al que se le pide la cotización (ref Usuario).
  comisionistaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  // Vendedor del producto (para que el comisionista coordine el retiro).
  vendedorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    default: null
  },
  ciudadOrigen: { type: String, default: '' },   // ciudad del vendedor (retiro)
  ciudadDestino: { type: String, default: '' },   // ciudad del comprador (entrega)
  descripcionCarga: { type: String, default: '' },
  estado: {
    type: String,
    enum: ['pendiente', 'cotizada', 'aceptada', 'en_transito', 'entregado', 'rechazada', 'cancelada'],
    default: 'pendiente',
    index: true
  },
  cotizacion: {
    monto: { type: Number, default: null },
    notas: { type: String, default: '' },
    fecha: { type: Date, default: null }
  },
  // Pago del traslado (split: el comisionista cobra, la plataforma retiene su fee).
  pago: {
    mpPreferenceId: { type: String, default: '' },
    mpPaymentId: { type: String, default: '' },
    comisionPlataforma: { type: Number, default: 0 },
    estadoPago: {
      type: String,
      enum: ['no_iniciado', 'pendiente_pago', 'pagado', 'reembolsado'],
      default: 'no_iniciado'
    }
  },
  // Hash sha256 del código de entrega (el código en claro vive solo en el cliente
  // del comprador). Se genera al confirmarse el pago del traslado.
  codigoEntregaHash: {
    type: String,
    default: null
  },
  entregadoEn: {
    type: Date,
    default: null
  },
  // El comprador debió aceptar el deslinde de responsabilidad de la plataforma.
  terminosAceptados: {
    type: Boolean,
    default: false
  },
  // Si el comisionista reporta un incidente (rotura, accidente). El vendedor
  // resuelve el reintegro con el comprador. MercadoLocal solo deja constancia.
  incidente: {
    reportado: { type: Boolean, default: false },
    descripcion: { type: String, default: '' },
    fecha: { type: Date, default: null }
  }
}, {
  timestamps: true
})

solicitudCotizacionSchema.index({ compradorId: 1, estado: 1 })
solicitudCotizacionSchema.index({ comisionistaId: 1, estado: 1 })
// Evita que el comprador spamee al mismo comisionista por la misma orden.
solicitudCotizacionSchema.index({ ordenId: 1, comisionistaId: 1 }, { unique: true })

const SolicitudCotizacion = mongoose.model('SolicitudCotizacion', solicitudCotizacionSchema)
export default SolicitudCotizacion
