import mongoose from 'mongoose'

// Esquema de línea individual (debe/haber)
const lineaAsientoSchema = new mongoose.Schema({
  // Referencia a la cuenta
  cuentaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CuentaContable',
    required: true
  },

  // Código de cuenta (desnormalizado para rapidez)
  codigoCuenta: {
    type: String,
    required: true
  },

  // Monto de débito (0 si es crédito)
  debe: {
    type: Number,
    default: 0,
    min: 0
  },

  // Monto de crédito (0 si es débito)
  haber: {
    type: Number,
    default: 0,
    min: 0
  },

  // Validación inline: debe ser débito XOR crédito, nunca ambos
  // (se valida en pre-save del padre)
  descripcion: {
    type: String,
    default: ''
  },

  // Fuente de la línea (para trazabilidad)
  fuente: {
    type: String,
    enum: ['webhook', 'manual', 'reconciliacion', 'reverso'],
    default: 'manual'
  },

  // Metadata de la línea (ej: orderIds, referencias externas)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { _id: false })

const asientoContableSchema = new mongoose.Schema({
  // Clave de idempotencia: si un webhook duplicado intenta crear el mismo asiento,
  // findOne + upsert evita la duplicación. Ej: "orden:64abc123" o "suscripcion:456"
  referenciaId: {
    type: String,
    required: true,
    unique: true, // unique ya crea el índice
    trim: true
  },

  // Tipo de transacción (para categorizar y filtrar)
  tipo: {
    type: String,
    enum: [
      'venta_split',
      'venta_sin_split',
      'suscripcion',
      'pauta_publicitaria',
      'liberacion_mp',
      'payout_vendedor',
      'reembolso',
      'egreso_opex',
      'ajuste_reconciliacion',
      'reverso',
      'otro'
    ],
    default: 'otro',
    index: true
  },

  // Estado del asiento
  estado: {
    type: String,
    enum: ['borrador', 'confirmado', 'anulado', 'revertido'],
    default: 'confirmado', // Por defecto se crea confirmado (puede cambiar a borrador si queremos approval)
    index: true
  },

  // Descripción del asiento (ej: "Venta Orden #3240 | Fee: $2.500")
  descripcion: {
    type: String,
    required: true
  },

  // Fecha contable (en zona ART, no UTC)
  fechaContable: {
    type: Date,
    required: true,
    index: true,
    // Default: hoy a las 00:00 ART
    default: () => {
      const now = new Date()
      const formatter = new Intl.DateTimeFormat('es-AR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires'
      })
      const [day, month, year] = formatter.format(now).split('/')
      return new Date(`${year}-${month}-${day}T00:00:00`)
    }
  },

  // Líneas del asiento (debe/haber embebidas)
  lineas: {
    type: [lineaAsientoSchema],
    required: true,
    validate: {
      validator(lineas) {
        if (!lineas || lineas.length < 2) return false // Min 2 líneas
        // Validar que cada línea sea debe XOR haber
        for (const linea of lineas) {
          const esDebito = linea.debe > 0
          const esCredito = linea.haber > 0
          // Debe ser uno u otro, no ambos ni ninguno
          if ((esDebito && esCredito) || (!esDebito && !esCredito)) return false
        }
        return true
      },
      message: 'Las líneas deben tener debe XOR haber (nunca ambos)'
    }
  },

  // Totales (para validación rápida sin recalcular)
  totalDebe: {
    type: Number,
    required: true,
    default: 0
  },

  totalHaber: {
    type: Number,
    required: true,
    default: 0
  },

  // ¿El asiento cuadra? (débito === crédito)
  cuadra: {
    type: Boolean,
    default: false
  },

  // Moneda del asiento
  moneda: {
    type: String,
    enum: ['ARS', 'USD'],
    default: 'ARS'
  },

  // Si el asiento vino de un webhook (idempotencia + trazabilidad)
  origen: {
    type: String,
    enum: ['webhook', 'manual', 'batch', 'import'],
    default: 'manual'
  },

  // ID del webhook/referencia externa (para reconciliación)
  idWebhook: {
    type: String,
    default: ''
  },

  // Audit trail: quién creó este asiento
  creadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    default: null
  },

  // IP de donde vino (si webhook, IP de MP; si manual, IP del usuario)
  ipAddress: {
    type: String,
    default: ''
  },

  // Persona (usuario) que aprobó (si requiere approval)
  aprobadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    default: null
  },

  fechaAprobacion: {
    type: Date,
    default: null
  },

  // Referencias cruzadas (para búsqueda y trazabilidad)
  referencias: {
    ordenId: { type: mongoose.Schema.Types.ObjectId, ref: 'Orden', default: null },
    suscripcionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Suscripcion', default: null },
    comprobantePautaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Destacado', default: null },
    vendedorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
    tiendaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tienda', default: null }
  },

  // Notas internas del contador
  notas: {
    type: String,
    default: ''
  },

  // Metadata extensible (para futuro)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true })

// ===== PRE-SAVE: Validaciones críticas =====
asientoContableSchema.pre('validate', function(next) {
  // Calcular totales desde las líneas
  let debe = 0
  let haber = 0

  for (const linea of this.lineas || []) {
    debe += linea.debe || 0
    haber += linea.haber || 0
  }

  this.totalDebe = Math.round(debe * 100) / 100
  this.totalHaber = Math.round(haber * 100) / 100
  this.cuadra = Math.abs(this.totalDebe - this.totalHaber) < 0.01 // Tolerancia de 1 centavo

  if (!this.cuadra) {
    this.invalidate('lineas', `Asiento descuadrado: debe $${this.totalDebe} ≠ haber $${this.totalHaber}`)
  }

  next()
})

// ===== ÍNDICES para búsqueda rápida =====
// (referenciaId ya tiene índice único por `unique: true` en el campo)
asientoContableSchema.index({ tipo: 1, fechaContable: -1 })
asientoContableSchema.index({ estado: 1, cuadra: 1 })
asientoContableSchema.index({ 'referencias.ordenId': 1 })
asientoContableSchema.index({ 'referencias.vendedorId': 1 })
asientoContableSchema.index({ createdAt: -1 }) // Para auditoria
asientoContableSchema.index({ fechaContable: 1, estado: 1 }) // Para reportes diarios

export default mongoose.model('AsientoContable', asientoContableSchema)
