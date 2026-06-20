import mongoose from 'mongoose'

/**
 * OfertaFlash — promoción relámpago de un ComercioCentro dentro del "Radar del Centro".
 *
 * Principio legal (Ley 24.240 + Lealtad Comercial, Dto 274/2019):
 * el countdown y el cupo son la FUENTE DE VERDAD en el servidor. No se permite
 * urgencia ni escasez falsa: si el server dice que quedan 3 cupos, quedan 3 de verdad.
 * Las condiciones (letra chica) son obligatorias y visibles antes de reclamar.
 */
const ofertaFlashSchema = new mongoose.Schema({
  comercioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ComercioCentro',
    required: true,
    index: true
  },

  titulo: {
    type: String,
    required: [true, 'El título de la oferta es obligatorio'],
    trim: true,
    maxlength: 80
  },
  descripcion: { type: String, default: '', maxlength: 300 },

  // Tipo de gancho (solo informativo / para iconos del feed)
  tipoGancho: {
    type: String,
    enum: ['descuento', '2x1', 'regalo', 'combo'],
    default: 'descuento'
  },
  // % de descuento si tipoGancho === 'descuento' (0–100)
  valorDescuento: { type: Number, default: 0, min: 0, max: 100 },

  // Ventana temporal — FUENTE DE VERDAD. inicioEn ≤ ahora ≤ finEn ⇒ vigente.
  inicioEn: { type: Date, required: true },
  finEn: {
    type: Date,
    required: true,
    validate: {
      validator: function (v) {
        return v > this.inicioEn
      },
      message: 'finEn debe ser posterior a inicioEn'
    }
  },

  // Cupo REAL. cupoTotal = 0 significa ilimitado. cupoUsado se incrementa de
  // forma ATÓMICA solo cuando un canje se concreta en el mostrador.
  cupoTotal: { type: Number, default: 0, min: 0 },
  cupoUsado: { type: Number, default: 0, min: 0 },

  // El comercio puede pausar la oferta sin borrarla
  activa: { type: Boolean, default: true },

  // Bloque horario al que pertenece (despachador de Fase 3 / Radar Camaleón).
  // Incluye los modos temáticos nuevos + los legacy (retrocompat con datos viejos).
  bloqueHorario: {
    type: String,
    enum: ['desayuno', 'almuerzo', 'siesta', 'merienda', 'cena', 'manana', 'tarde', 'noche', 'todos'],
    default: 'todos'
  },

  // Recompensa cruzada (Fase 3): al canjear esta, se sugiere otra. Solo informativo.
  desbloquea: {
    comercioId: { type: mongoose.Schema.Types.ObjectId, ref: 'ComercioCentro', default: null },
    descripcion: { type: String, default: '' }
  },

  // Gamificación Cruzada (gancho de la cadena gastronómica): el comercio define
  // un cupón EXTRA de descuento que se le ofrece a quien acaba de comprar en el
  // bloque anterior (ej. la cafetería del desayuno engancha al restaurante del
  // almuerzo). Si el cliente reserva en la app, el comercio recibe el aviso para
  // "preparar la mesa con invitación especial de Mercado Local".
  cuponCruzado: {
    activo: { type: Boolean, default: false },
    // % de descuento adicional que define el vendedor según su costo (0–100).
    porcentaje: { type: Number, default: 0, min: 0, max: 100 },
    // Mensaje gancho opcional (ej. "Mesa lista con copa de bienvenida").
    mensaje: { type: String, default: '', maxlength: 200 }
  },

  // Letra chica obligatoria (exclusiones, vigencia, etc.)
  condiciones: { type: String, default: '', maxlength: 500 },

  // Ciudad denormalizada desde el comercio, para filtrar el feed sin populate.
  ciudad: { type: String, default: '', index: true },

  // FASE 3: Monetización prepago
  // Precio final que paga el usuario en la app (incluye comisión visible)
  precioFinal: { type: Number, default: 0, min: 0 },
  // % de comisión que nos quedamos (6% mañana, 9% tarde, 5% noche)
  comisionPorcentaje: { type: Number, default: 7, min: 0, max: 100 },
  // Si requiere pago prepago en app (vs legacy: código QR postpago)
  requierePrepagoApp: { type: Boolean, default: true }
}, { timestamps: true })

// Feed público: ofertas activas por ciudad ordenadas por fin de ventana
ofertaFlashSchema.index({ activa: 1, ciudad: 1, finEn: 1 })

/**
 * ¿Está vigente AHORA? (ventana temporal abierta, activa y con cupo).
 * Recibe `ahora` para usar siempre la hora del server (no la del request).
 */
ofertaFlashSchema.methods.estaVigente = function (ahora = new Date()) {
  if (!this.activa) return false
  if (ahora < this.inicioEn || ahora > this.finEn) return false
  if (this.cupoTotal > 0 && this.cupoUsado >= this.cupoTotal) return false
  return true
}

/** Cupo restante (null = ilimitado). */
ofertaFlashSchema.methods.cupoRestante = function () {
  if (this.cupoTotal === 0) return null
  return Math.max(0, this.cupoTotal - this.cupoUsado)
}

/**
 * Versión pública para el feed. Incluye `serverNow` para que el cliente
 * sincronice el countdown con la hora del server (no con el reloj del celular).
 */
ofertaFlashSchema.methods.toPublic = function (ahora = new Date()) {
  return {
    _id: this._id,
    comercioId: this.comercioId,
    titulo: this.titulo,
    descripcion: this.descripcion,
    tipoGancho: this.tipoGancho,
    valorDescuento: this.valorDescuento,
    inicioEn: this.inicioEn,
    finEn: this.finEn,
    cupoTotal: this.cupoTotal,
    cupoRestante: this.cupoRestante(),
    bloqueHorario: this.bloqueHorario,
    desbloquea: this.desbloquea?.descripcion ? this.desbloquea : null,
    cuponCruzado: this.cuponCruzado?.activo ? this.cuponCruzado : null,
    condiciones: this.condiciones,
    vigente: this.estaVigente(ahora),
    // FASE 3: datos de monetización
    precioFinal: this.precioFinal,
    comisionPorcentaje: this.comisionPorcentaje,
    requierePrepagoApp: this.requierePrepagoApp,
    serverNow: ahora
  }
}

const OfertaFlash = mongoose.model('OfertaFlash', ofertaFlashSchema)
export default OfertaFlash
