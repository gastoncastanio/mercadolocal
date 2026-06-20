import mongoose from 'mongoose'

/**
 * Oferta Compartida (descuento coopérativo / co-op marketing).
 *
 * La plataforma PROPONE a un vendedor co-financiar un descuento sobre un
 * producto: el vendedor pone una parte del descuento y la plataforma la otra
 * (con un presupuesto tope, financiado desde nuestras comisiones de venta).
 *
 * Flujo:
 *   1. La plataforma (admin) crea una propuesta  → estado 'propuesta'
 *   2. El vendedor la acepta                      → estado 'activa' (precio baja)
 *      o la rechaza                               → estado 'rechazada'
 *   3. Mientras está activa, el producto se vende al precio con descuento.
 *      En cada venta, la plataforma absorbe su aporte (se descuenta del
 *      presupuesto) y el vendedor recibe como si vendiera al precio que le
 *      corresponde (precioOriginal − aporteVendedor).
 *   4. Cuando vence la ventana o se agota el presupuesto → 'finalizada'
 *      (el precio del producto vuelve al original).
 */
const ofertaCompartidaSchema = new mongoose.Schema({
  productoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producto',
    required: true,
    index: true
  },
  tiendaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tienda',
    required: true
  },
  vendedorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },

  // ===== Precios (snapshot al crear la propuesta) =====
  // Precio del producto antes del descuento. Se congela acá para que cambios
  // posteriores del catálogo no rompan el cálculo del split.
  precioOriginal: {
    type: Number,
    required: true,
    min: 0
  },
  // Descuento total al comprador, en porcentaje (1-90).
  descuentoPorcentaje: {
    type: Number,
    required: true,
    min: 1,
    max: 90
  },
  // Qué parte del descuento financia el vendedor (0-100). El resto lo pone la
  // plataforma. Ej: 40 = el vendedor pone el 40% del descuento, nosotros el 60%.
  aporteVendedorPct: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 50
  },

  // ===== Presupuesto de la plataforma =====
  // Tope total en ARS que la plataforma destina a esta oferta (sale de
  // nuestras comisiones). Cuando lo gastado lo alcanza, la oferta se finaliza.
  presupuestoPlataforma: {
    type: Number,
    required: true,
    min: 0
  },
  // Acumulado de lo que la plataforma ya aportó (incrementa con cada venta).
  gastado: {
    type: Number,
    default: 0,
    min: 0
  },

  // ===== Ventana temporal =====
  inicioEn: {
    type: Date,
    default: Date.now
  },
  finEn: {
    type: Date,
    required: true
  },

  // ===== Estado =====
  estado: {
    type: String,
    enum: ['propuesta', 'activa', 'pausada', 'finalizada', 'rechazada'],
    default: 'propuesta',
    index: true
  },

  // ===== Métricas =====
  // Unidades vendidas mientras la oferta estuvo activa.
  ventasGeneradas: {
    type: Number,
    default: 0
  },

  // Mensaje opcional de la plataforma al vendedor (pitch de la propuesta).
  notaPlataforma: {
    type: String,
    default: '',
    maxlength: 300
  }
}, {
  timestamps: true
})

// La consulta más común: ofertas activas de un producto (al armar el precio).
ofertaCompartidaSchema.index({ productoId: 1, estado: 1, finEn: 1 })
// Propuestas/activas de un vendedor (panel del vendedor).
ofertaCompartidaSchema.index({ vendedorId: 1, estado: 1 })

// ===== Campos derivados =====

// Precio que paga el comprador (redondeado a entero, como el resto del catálogo).
ofertaCompartidaSchema.methods.precioConDescuento = function () {
  return Math.round(this.precioOriginal * (1 - this.descuentoPorcentaje / 100))
}

// Descuento total en ARS.
ofertaCompartidaSchema.methods.descuentoTotal = function () {
  return this.precioOriginal - this.precioConDescuento()
}

// Lo que pone el vendedor de su bolsillo por unidad.
ofertaCompartidaSchema.methods.aporteVendedor = function () {
  return Math.round(this.descuentoTotal() * this.aporteVendedorPct / 100)
}

// Lo que pone la plataforma por unidad (el resto del descuento).
ofertaCompartidaSchema.methods.aportePlataforma = function () {
  return this.descuentoTotal() - this.aporteVendedor()
}

// Presupuesto que todavía queda disponible.
ofertaCompartidaSchema.methods.presupuestoRestante = function () {
  return Math.max(0, this.presupuestoPlataforma - this.gastado)
}

// ¿La oferta puede aplicarse a una venta ahora mismo?
ofertaCompartidaSchema.methods.estaVigente = function (ahora = new Date()) {
  if (this.estado !== 'activa') return false
  if (ahora < this.inicioEn || ahora > this.finEn) return false
  // Necesitamos presupuesto para cubrir al menos un aporte más.
  return this.presupuestoRestante() >= this.aportePlataforma()
}

ofertaCompartidaSchema.methods.toPublic = function () {
  return {
    _id: this._id,
    productoId: this.productoId,
    tiendaId: this.tiendaId,
    vendedorId: this.vendedorId,
    precioOriginal: this.precioOriginal,
    descuentoPorcentaje: this.descuentoPorcentaje,
    aporteVendedorPct: this.aporteVendedorPct,
    aportePlataformaPct: 100 - this.aporteVendedorPct,
    precioConDescuento: this.precioConDescuento(),
    descuentoTotal: this.descuentoTotal(),
    aporteVendedor: this.aporteVendedor(),
    aportePlataforma: this.aportePlataforma(),
    presupuestoPlataforma: this.presupuestoPlataforma,
    gastado: this.gastado,
    presupuestoRestante: this.presupuestoRestante(),
    inicioEn: this.inicioEn,
    finEn: this.finEn,
    estado: this.estado,
    ventasGeneradas: this.ventasGeneradas,
    notaPlataforma: this.notaPlataforma,
    createdAt: this.createdAt
  }
}

const OfertaCompartida = mongoose.model('OfertaCompartida', ofertaCompartidaSchema)

export default OfertaCompartida
