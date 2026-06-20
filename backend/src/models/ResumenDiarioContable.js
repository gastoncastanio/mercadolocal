import mongoose from 'mongoose'

/**
 * Resumen diario cacheado de la contabilidad.
 * Se actualiza al cerrar el día (00:00 ART+1) con agregaciones de AsientoContable.
 * Esto permite que reportes diarios/mensuales sean rápidos sin recalcular desde cero.
 */

const resumenDiarioContableSchema = new mongoose.Schema({
  // Fecha del resumen (00:00 ART)
  fecha: {
    type: Date,
    required: true,
    unique: true // unique ya crea el índice
  },

  // Totales de ingresos por categoría
  ingresos: {
    comisiones: { type: Number, default: 0 },
    comisionesTraslado: { type: Number, default: 0 },
    suscripciones: { type: Number, default: 0 },
    pautaPublicitaria: { type: Number, default: 0 },
    otros: { type: Number, default: 0 }
  },

  // Totales de egresos por categoría
  egresos: {
    procesamientoMP: { type: Number, default: 0 },
    marketing: { type: Number, default: 0 },
    hosting: { type: Number, default: 0 },
    honorarios: { type: Number, default: 0 },
    otros: { type: Number, default: 0 }
  },

  // Saldos de cuentas principales (cache)
  saldos: {
    cajaMP: { type: Number, default: 0 },
    cajaMP_aLiberar: { type: Number, default: 0 },
    cajaBanco: { type: Number, default: 0 },
    cuentasPorCobrar: { type: Number, default: 0 },
    cuentasPorPagar: { type: Number, default: 0 },
    ivaDebitofiscal: { type: Number, default: 0 },
    provision_impuestos: { type: Number, default: 0 }
  },

  // Totales agregados
  totalIngresosHoy: { type: Number, default: 0 },
  totalEgresosHoy: { type: Number, default: 0 },
  resultadoNeto: { type: Number, default: 0 },

  // Estado de la reconciliación
  reconciliado: {
    type: Boolean,
    default: false
  },

  // Si está reconciliado, saldo real de MP en ese momento
  saldoRealMP_en_reconciliacion: {
    type: Number,
    default: null
  },

  // Diferencia entre mayor y realidad (0 si cuadra)
  diferencia: {
    type: Number,
    default: 0
  },

  // Notas si hay discrepancias
  notasReconciliacion: {
    type: String,
    default: ''
  },

  // Timestamp de la última actualización
  actualizadoEn: {
    type: Date,
    default: Date.now
  }
}, { timestamps: false })

export default mongoose.model('ResumenDiarioContable', resumenDiarioContableSchema)
