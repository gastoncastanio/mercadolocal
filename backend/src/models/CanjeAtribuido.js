import mongoose from 'mongoose'

/**
 * CanjeAtribuido — registro de un reclamo de oferta flash y su posterior canje
 * en el mostrador. Es la "transacción atribuida" del Radar del Centro.
 *
 * Máquina de estados:
 *   emitido  → el usuario reclamó la oferta y tiene un código/QR vigente
 *   canjeado → el comercio validó el código en el mostrador (consume cupo)
 *   expirado → venció la ventana sin canjearse (lo marca un chequeo perezoso)
 *
 * Anti-fraude:
 *   - Guardamos solo el HASH del código (nunca el código en claro).
 *   - El canje es de un solo uso vía transición atómica emitido → canjeado.
 *   - Índice único parcial: un usuario no puede tener 2 reclamos "emitido"
 *     vigentes de la misma oferta (evita acaparar cupo).
 *
 * Privacidad (Ley 25.326): NO se guarda ninguna coordenada del usuario. Solo
 * registramos QUÉ se reclamó/canjeó y CUÁNDO, nunca DESDE DÓNDE.
 */
const canjeAtribuidoSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  comercioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ComercioCentro',
    required: true,
    index: true
  },
  ofertaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OfertaFlash',
    required: true,
    index: true
  },

  // Hash sha256 del código de canje (el código en claro vive solo en el cliente).
  codigoHash: { type: String, required: true, index: true },

  estado: {
    type: String,
    enum: ['emitido', 'canjeado', 'expirado'],
    default: 'emitido',
    index: true
  },

  emitidoEn: { type: Date, default: Date.now },
  // Ventana corta para presentarse en el mostrador (no queda "vivo" indefinido).
  expiraEn: { type: Date, required: true, index: true },
  canjeadoEn: { type: Date, default: null },

  // Métrica de ROI opcional que el comercio puede cargar al canjear.
  ticketValor: { type: Number, default: null }
}, { timestamps: true })

// Un usuario no puede tener 2 reclamos "emitido" de la misma oferta a la vez.
// Índice único PARCIAL: solo aplica a documentos en estado 'emitido'.
canjeAtribuidoSchema.index(
  { usuarioId: 1, ofertaId: 1 },
  { unique: true, partialFilterExpression: { estado: 'emitido' } }
)

/** ¿El reclamo sigue vigente para canjear? */
canjeAtribuidoSchema.methods.estaVigente = function (ahora = new Date()) {
  return this.estado === 'emitido' && ahora <= this.expiraEn
}

const CanjeAtribuido = mongoose.model('CanjeAtribuido', canjeAtribuidoSchema)
export default CanjeAtribuido
