import mongoose from 'mongoose'

/**
 * ViajeRemis — un pedido de traslado de PERSONAS estilo app (Uber/Cabify),
 * dentro del vertical "MercadoLocal Remis". El pasajero pide desde el teléfono y
 * un conductor verificado (PerfilComisionista con ofreceRemis=true) lo toma.
 *
 * Reemplaza al remis tradicional que muere por fricción: nada de llamar ni
 * mandar mensajes; el pasajero ve conductores disponibles, pide y sigue el
 * estado en tiempo real.
 *
 * Tipos de servicio:
 *   - traslado    → punto A a punto B (viaje simple)
 *   - ida_vuelta  → ida, espera corta, vuelta al origen
 *   - dia_compras → te lleva, te espera/acompaña mientras hacés tus compras y te
 *                   devuelve a casa. Se cobra banderita + km + horas de espera.
 *
 * Máquina de estados:
 *   buscando  → el pasajero pidió; visible a los remiseros disponibles
 *   aceptado  → un conductor lo tomó (claim atómico buscando→aceptado)
 *   en_camino → el conductor va hacia el punto de origen a buscar al pasajero
 *   a_bordo   → el pasajero subió; el viaje (o el día de compras) está en curso
 *   finalizado→ el conductor cerró el viaje (precio final confirmado)
 *   cancelado → cualquiera de las partes lo canceló antes de finalizar
 */
const viajeRemisSchema = new mongoose.Schema({
  // Pasajero que pide el remis.
  pasajeroId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  // Conductor que lo toma. null mientras está en 'buscando'.
  comisionistaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    default: null,
    index: true
  },
  // Origen y destino. La dirección de texto es la fuente de verdad; lat/lng son
  // opcionales para dibujar en un mapa (presentación), igual que en Viaje.
  origen: {
    direccion: { type: String, required: true, trim: true },
    ciudad: { type: String, default: '', trim: true },
    referencia: { type: String, default: '' }, // "portón verde", "timbre 2B"
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },
  destino: {
    direccion: { type: String, required: true, trim: true },
    ciudad: { type: String, default: '', trim: true },
    referencia: { type: String, default: '' },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },
  tipoServicio: {
    type: String,
    enum: ['traslado', 'ida_vuelta', 'dia_compras'],
    default: 'traslado'
  },
  // Distancia estimada en km (la ingresa el pasajero o se calcula de lat/lng).
  // Sirve para estimar el precio antes de pedir.
  distanciaKm: { type: Number, default: 0, min: 0 },
  // Horas estimadas de espera/acompañamiento (ida_vuelta / dia_compras).
  horasEspera: { type: Number, default: 0, min: 0 },
  // Cantidad de pasajeros (referencial).
  pasajeros: { type: Number, default: 1, min: 1 },
  // Precio estimado al pedir (banderita + km + espera, según tarifas del conductor).
  precioEstimado: { type: Number, default: 0, min: 0 },
  // Precio final que confirma el conductor al cerrar (puede diferir del estimado
  // si el día de compras se extendió, hubo más km, etc.).
  precioFinal: { type: Number, default: null },
  // Programado para una fecha/hora futura, o null = "ahora".
  programadoPara: { type: Date, default: null },
  notas: { type: String, default: '' },
  estado: {
    type: String,
    enum: ['buscando', 'aceptado', 'en_camino', 'a_bordo', 'finalizado', 'cancelado'],
    default: 'buscando',
    index: true
  },
  aceptadoEn: { type: Date, default: null },
  finalizadoEn: { type: Date, default: null },
  // Quién canceló y por qué (para métricas y reputación).
  canceladoPor: {
    type: String,
    enum: ['pasajero', 'comisionista', null],
    default: null
  },
  // Pago con split al conductor (mismo patrón que EnvioComisionista).
  pago: {
    mpPreferenceId: { type: String, default: null },
    mpPaymentId: { type: String, default: null },
    comisionPlataforma: { type: Number, default: 0 },
    estadoPago: {
      type: String,
      enum: ['no_aplica', 'pendiente_pago', 'pagado', 'reembolsado'],
      default: 'pendiente_pago'
    },
    // Método de pago del viaje.
    //   app      → el pasajero paga online; split automático al conductor y la
    //              plataforma retiene su comisión (camino por defecto y preferido).
    //   efectivo → EXCEPCIÓN: el pasajero lo solicitó y el conductor lo aceptó.
    //              El conductor cobra la tarifa en mano y QUEDA DEBIENDO la comisión
    //              de la plataforma, que paga después (diaria/semanalmente).
    metodo: {
      type: String,
      enum: ['app', 'efectivo'],
      default: 'app'
    },
    // El pasajero pidió pagar en efectivo (requiere que el conductor lo acepte).
    efectivoSolicitado: { type: Boolean, default: false },
    // El conductor aceptó cobrar este viaje en efectivo.
    efectivoAceptado: { type: Boolean, default: false },
    // Estado de la comisión que el conductor nos debe por un viaje cobrado en
    // efectivo. Sólo aplica cuando metodo='efectivo'.
    //   no_aplica → viaje pagado por app (la comisión ya se retuvo en el split)
    //   adeudada  → el conductor cobró en efectivo y nos debe la comisión
    //   en_pago   → el conductor inició el pago de su comisión (esperando a MP)
    //   pagada    → el conductor ya nos abonó la comisión de este viaje
    comisionEfectivoEstado: {
      type: String,
      enum: ['no_aplica', 'adeudada', 'en_pago', 'pagada'],
      default: 'no_aplica'
    },
    // Cuándo el conductor saldó la comisión de este viaje en efectivo.
    comisionEfectivoPagadaEn: { type: Date, default: null }
  }
}, {
  timestamps: true
})

// Búsqueda de pedidos abiertos por ciudad de origen (los remiseros ven los suyos).
viajeRemisSchema.index({ estado: 1, 'origen.ciudad': 1, createdAt: -1 })
// Listados por pasajero / conductor + estado.
viajeRemisSchema.index({ pasajeroId: 1, estado: 1 })
viajeRemisSchema.index({ comisionistaId: 1, estado: 1 })
// Deuda de comisión por viajes cobrados en efectivo (para calcular cuánto debe
// el conductor y desde cuándo, y disparar el bloqueo a las 3 semanas).
viajeRemisSchema.index({ comisionistaId: 1, 'pago.comisionEfectivoEstado': 1, finalizadoEn: 1 })

viajeRemisSchema.methods.toPublic = function () {
  const poblar = (ref) =>
    ref && typeof ref === 'object' && ref.nombre
      ? { _id: ref._id, nombre: ref.nombre, avatar: ref.avatar || '' }
      : null

  return {
    _id: this._id,
    pasajeroId: poblar(this.pasajeroId)?._id || this.pasajeroId,
    pasajero: poblar(this.pasajeroId),
    comisionistaId: poblar(this.comisionistaId)?._id || this.comisionistaId,
    comisionista: poblar(this.comisionistaId),
    origen: this.origen,
    destino: this.destino,
    tipoServicio: this.tipoServicio,
    distanciaKm: this.distanciaKm,
    horasEspera: this.horasEspera,
    pasajeros: this.pasajeros,
    precioEstimado: this.precioEstimado,
    precioFinal: this.precioFinal,
    programadoPara: this.programadoPara,
    notas: this.notas,
    estado: this.estado,
    aceptadoEn: this.aceptadoEn,
    finalizadoEn: this.finalizadoEn,
    pago: {
      estadoPago: this.pago?.estadoPago || 'pendiente_pago',
      metodo: this.pago?.metodo || 'app',
      efectivoSolicitado: !!this.pago?.efectivoSolicitado,
      efectivoAceptado: !!this.pago?.efectivoAceptado,
      comisionEfectivoEstado: this.pago?.comisionEfectivoEstado || 'no_aplica',
      comisionPlataforma: this.pago?.comisionPlataforma || 0
    },
    createdAt: this.createdAt
  }
}

const ViajeRemis = mongoose.model('ViajeRemis', viajeRemisSchema)
export default ViajeRemis
