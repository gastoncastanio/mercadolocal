import mongoose from 'mongoose'

/**
 * COMPROBANTE / FACTURA
 *
 * Modela los tres flujos fiscales del marketplace:
 *
 *   tipo='pauta'    → la PLATAFORMA le factura al VENDEDOR el servicio de pauta.
 *   tipo='comision' → la PLATAFORMA le factura al VENDEDOR la comisión por venta.
 *   tipo='venta'    → el VENDEDOR le factura a su COMPRADOR el producto.
 *
 * Para los dos primeros, la plataforma es Monotributo → emite SIEMPRE Factura C
 * (sin IVA discriminado). El tercero depende de la condición fiscal del vendedor
 * (C si monotributo; A/B si responsable inscripto), por eso `letra` es flexible.
 *
 * Diseño preparado para fiscal real (ARCA/ex-AFIP):
 *   - `cae` + `caeVencimiento` se completan cuando se integra el web service o un
 *     proveedor (TusFacturas, Facturante, etc.). Hasta entonces `fiscal=false` y
 *     el comprobante es un documento interno/borrador (no válido ante ARCA).
 *   - `pdfUrl` guarda el PDF cuando lo genera un proveedor o lo sube el vendedor;
 *     si está vacío, el comprobante se imprime desde la vista estructurada.
 */

const datosFiscalesSchema = new mongoose.Schema({
  nombre: { type: String, default: '' },        // razón social o nombre y apellido
  cuit: { type: String, default: '' },          // CUIT/CUIL/DNI
  docTipo: { type: String, default: 'CUIT' },   // CUIT | CUIL | DNI | CF (consumidor final)
  condicionIVA: { type: String, default: '' },  // Monotributo | Responsable Inscripto | Exento | Consumidor Final
  domicilio: { type: String, default: '' },
  email: { type: String, default: '' }
}, { _id: false })

const itemComprobanteSchema = new mongoose.Schema({
  descripcion: { type: String, required: true },
  cantidad: { type: Number, default: 1 },
  precioUnitario: { type: Number, required: true },
  importe: { type: Number, required: true }
}, { _id: false })

const comprobanteSchema = new mongoose.Schema({
  // ===== Qué tipo de comprobante =====
  tipo: {
    type: String,
    enum: ['pauta', 'comision', 'venta'],
    required: true,
    index: true
  },

  // Clave de idempotencia: evita emitir dos veces el mismo comprobante si un
  // webhook o reintento se dispara más de una vez. Ej: "comision:<ordenId>:<tiendaId>".
  claveIdempotencia: {
    type: String,
    required: true,
    unique: true
  },

  // ===== Numeración fiscal =====
  letra: { type: String, enum: ['A', 'B', 'C'], default: 'C' },
  puntoVenta: { type: Number, default: 1 },
  numero: { type: Number, default: 0 },
  numeroFormateado: { type: String, default: '' }, // "C 0001-00000123"

  // ===== Partes =====
  emisor: { type: datosFiscalesSchema, default: () => ({}) },
  receptor: { type: datosFiscalesSchema, default: () => ({}) },

  // ===== Importes =====
  // Monotributo (Factura C): no se discrimina IVA, neto = total, iva = 0.
  items: { type: [itemComprobanteSchema], default: [] },
  neto: { type: Number, default: 0 },
  iva: { type: Number, default: 0 },
  total: { type: Number, required: true },

  // ===== Referencias a entidades del sistema =====
  destacadoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Destacado', default: null },
  ordenId: { type: mongoose.Schema.Types.ObjectId, ref: 'Orden', default: null },
  tiendaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tienda', default: null },
  vendedorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
  compradorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },

  // ===== Fiscal real (ARCA) — se completa al integrar el web service/proveedor =====
  fiscal: { type: Boolean, default: false }, // true sólo si tiene CAE válido
  cae: { type: String, default: '' },
  caeVencimiento: { type: Date, default: null },
  origen: {
    type: String,
    enum: ['interno', 'arca', 'proveedor', 'manual'],
    default: 'interno'
  },

  // Archivo del comprobante (provisto por proveedor o subido por el vendedor)
  pdfUrl: { type: String, default: '' },

  estado: {
    type: String,
    enum: ['emitido', 'pendiente', 'error', 'anulado'],
    default: 'emitido',
    index: true
  },
  errorMensaje: { type: String, default: '' },

  fechaEmision: { type: Date, default: Date.now }
}, { timestamps: true })

// ===== Índices =====
// Comprobantes que la plataforma le emitió a un vendedor (panel del vendedor)
comprobanteSchema.index({ vendedorId: 1, tipo: 1, fechaEmision: -1 })
// Factura de venta asociada a una orden (panel del comprador)
comprobanteSchema.index({ ordenId: 1, tipo: 1 })

export default mongoose.model('Comprobante', comprobanteSchema)
