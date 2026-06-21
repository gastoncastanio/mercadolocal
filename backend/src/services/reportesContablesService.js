import AsientoContable from '../models/AsientoContable.js'
import GastoOperativo from '../models/GastoOperativo.js'
import AuditoriaFinanciera from '../models/AuditoriaFinanciera.js'
import Comprobante from '../models/Comprobante.js'
import Suscripcion from '../models/Suscripcion.js'
import ConfigSitio from '../models/ConfigSitio.js'
import * as contabilidadService from './contabilidadService.js'
import * as configService from './configService.js'

/**
 * SERVICIO DE REPORTES CONTABLES
 *
 * Arma las 7 secciones del Panel del Contador a partir del Libro Mayor
 * (AsientoContable) + fuentes complementarias (AuditoriaFinanciera para GMV
 * informativo, Comprobante para facturación).
 *
 * Distinción clave (decisión del usuario): "Saldos reales" (tu plata, del mayor)
 * vs "GMV transaccionado" (volumen informativo, NO es tu dinero — con split va
 * directo al vendedor).
 */

const CONFIG_CLAVE = 'contabilidad_config'

// Config por defecto (el contador la edita desde el panel)
const CONFIG_DEFAULT = {
  costosFijosMensuales: 1050000,   // pauta $1M + hosting + contable
  regimenFiscal: 'Monotributo',    // 'Monotributo' | 'Responsable Inscripto'
  alicuotaIVA: 21,                 // % IVA si RI
  costoProcesamientoMP: 2.9,       // % aprox que retiene MP (para margen bruto)
  metaGMVMensual: 21000000         // meta de break-even editable
}

/**
 * Lee la config contable (con defaults). Nunca falla.
 */
export async function obtenerConfigContable() {
  const cfg = { ...CONFIG_DEFAULT }
  try {
    const valor = await configService.obtenerConfig(CONFIG_CLAVE)
    if (valor) {
      const parsed = typeof valor === 'string' ? JSON.parse(valor) : valor
      Object.assign(cfg, parsed)
    }
  } catch (e) {
    console.warn('No se pudo leer config contable, usando defaults:', e.message)
  }
  return cfg
}

/**
 * Guarda la config contable (admin).
 */
export async function guardarConfigContable(datos = {}) {
  const limpio = { ...CONFIG_DEFAULT }
  for (const k of Object.keys(CONFIG_DEFAULT)) {
    if (datos[k] !== undefined) limpio[k] = datos[k]
  }
  // Upsert directo: actualizarConfig() lanza si la clave no existe todavía.
  await ConfigSitio.findOneAndUpdate(
    { clave: CONFIG_CLAVE },
    {
      clave: CONFIG_CLAVE,
      valor: JSON.stringify(limpio),
      tipo: 'html',
      categoria: 'contabilidad',
      descripcion: 'Configuración del panel del contador (costos fijos, régimen fiscal, meta GMV)'
    },
    { upsert: true, new: true }
  )
  return limpio
}

// ===== HELPERS de fecha (rango mensual en ART) =====

/**
 * Devuelve { inicio, fin } del mes pedido (o el actual) en ART.
 */
function rangoMes(anio, mes) {
  const ahora = new Date()
  const y = anio || ahora.getFullYear()
  const m = mes !== undefined && mes !== null ? mes : ahora.getMonth()
  const inicio = new Date(y, m, 1, 0, 0, 0, 0)
  const fin = new Date(y, m + 1, 0, 23, 59, 59, 999) // último día del mes
  return { inicio, fin }
}

// ===== SECCIÓN 1: FACTURACIÓN =====

/**
 * Grilla de comprobantes emitidos en el período (exportable).
 * Reusa el modelo Comprobante existente.
 */
export async function seccionFacturacion({ anio, mes } = {}) {
  const { inicio, fin } = rangoMes(anio, mes)

  const comprobantes = await Comprobante.find({
    fechaEmision: { $gte: inicio, $lte: fin },
    tipo: { $in: ['pauta', 'comision'] } // los que emite la plataforma
  }).sort({ fechaEmision: -1 }).lean()

  const filas = comprobantes.map(c => ({
    fecha: c.fechaEmision,
    numero: c.numeroFormateado,
    tipo: c.tipo,
    receptorNombre: c.receptor?.nombre || '',
    receptorCuit: c.receptor?.cuit || '',
    neto: c.neto,
    iva: c.iva,
    total: c.total,
    fiscal: c.fiscal,            // false = interno/borrador (sin CAE)
    origen: c.origen,
    estado: c.estado
  }))

  const totales = filas.reduce(
    (acc, f) => ({
      neto: acc.neto + (f.neto || 0),
      iva: acc.iva + (f.iva || 0),
      total: acc.total + (f.total || 0)
    }),
    { neto: 0, iva: 0, total: 0 }
  )

  return {
    periodo: { inicio, fin },
    cantidad: filas.length,
    // Aviso honesto: hoy los comprobantes son internos (sin CAE de ARCA)
    advertencia: filas.some(f => !f.fiscal)
      ? 'Algunos comprobantes son internos (sin CAE de ARCA). No son válidos fiscalmente hasta conectar el web service.'
      : null,
    filas,
    totales: {
      neto: Math.round(totales.neto * 100) / 100,
      iva: Math.round(totales.iva * 100) / 100,
      total: Math.round(totales.total * 100) / 100
    }
  }
}

// ===== SECCIÓN 2: MARGEN BRUTO =====

/**
 * Margen Bruto = Ingresos por comisión − Costo directo de procesar (MP fee).
 */
export async function seccionMargenBruto({ anio, mes } = {}) {
  const { inicio, fin } = rangoMes(anio, mes)
  const cfg = await obtenerConfigContable()

  // Ingresos por comisión del período (del mayor: cuentas 4.1.1 + 4.1.2).
  // Incluimos 'reverso' para netear reembolsos (que ponen 4.1.x al debe).
  const asientos = await AsientoContable.find({
    estado: 'confirmado',
    fechaContable: { $gte: inicio, $lte: fin },
    tipo: { $in: ['venta_split', 'venta_sin_split', 'reverso'] }
  }).lean()

  let ingresoComisiones = 0
  for (const a of asientos) {
    for (const l of a.lineas) {
      if (l.codigoCuenta === '4.1.1' || l.codigoCuenta === '4.1.2') {
        // Neto: haber (ingreso) menos debe (reverso de reembolso)
        ingresoComisiones += (l.haber || 0) - (l.debe || 0)
      }
    }
  }

  // GMV del período (informativo, desde auditoría) para estimar costo MP
  const auditorias = await AuditoriaFinanciera.find({
    tipo: 'pago_aprobado',
    createdAt: { $gte: inicio, $lte: fin }
  }).lean()

  const gmv = auditorias.reduce((sum, a) => sum + (a.monto || 0), 0)

  // Costo de procesamiento MP: estimado como % del GMV (lo retiene MP del collector).
  // En split, lo paga el vendedor; lo mostramos como referencia del costo del ecosistema.
  const costoMP = Math.round(gmv * (cfg.costoProcesamientoMP / 100) * 100) / 100

  const margenBruto = ingresoComisiones // tu costo directo real ≈ 0 en split
  const margenBrutoPorc = ingresoComisiones > 0
    ? Math.round((margenBruto / ingresoComisiones) * 10000) / 100
    : 0

  return {
    periodo: { inicio, fin },
    ingresoComisiones: Math.round(ingresoComisiones * 100) / 100,
    gmvInformativo: Math.round(gmv * 100) / 100,
    costoProcesamientoMP_estimado: costoMP,
    nota: 'En Split Payment, el fee de MercadoPago lo absorbe el vendedor (collector). Tu costo directo de procesamiento es ≈ 0; tu ingreso es la comisión casi neta.',
    margenBruto: Math.round(margenBruto * 100) / 100,
    margenBrutoPorc
  }
}

// ===== SECCIÓN 3: RENTABILIDAD NETA =====

/**
 * Rentabilidad Neta = (Ingresos Totales − (OPEX + Impuestos)) / Ingresos × 100
 */
export async function seccionRentabilidad({ anio, mes } = {}) {
  const { inicio, fin } = rangoMes(anio, mes)

  const asientos = await AsientoContable.find({
    estado: 'confirmado',
    fechaContable: { $gte: inicio, $lte: fin }
  }).lean()

  // Ingresos = suma de haber en cuentas REVENUE (4.x.x)
  // Egresos = suma de debe en cuentas EXPENSE (5.x.x)
  let ingresos = 0
  let egresos = 0
  const desglosIngresos = {}
  const desgloseEgresos = {}

  for (const a of asientos) {
    for (const l of a.lineas) {
      if (l.codigoCuenta.startsWith('4.')) {
        // INGRESO neto: haber − debe (un reverso de reembolso resta)
        const neto = (l.haber || 0) - (l.debe || 0)
        ingresos += neto
        desglosIngresos[l.codigoCuenta] = (desglosIngresos[l.codigoCuenta] || 0) + neto
      } else if (l.codigoCuenta.startsWith('5.')) {
        // EGRESO neto: debe − haber (un reverso de gasto resta)
        const neto = (l.debe || 0) - (l.haber || 0)
        egresos += neto
        desgloseEgresos[l.codigoCuenta] = (desgloseEgresos[l.codigoCuenta] || 0) + neto
      }
    }
  }

  const resultadoNeto = ingresos - egresos
  const rentabilidadNeta = ingresos > 0
    ? Math.round((resultadoNeto / ingresos) * 10000) / 100
    : 0

  return {
    periodo: { inicio, fin },
    ingresos: Math.round(ingresos * 100) / 100,
    egresos: Math.round(egresos * 100) / 100,
    resultadoNeto: Math.round(resultadoNeto * 100) / 100,
    rentabilidadNeta, // %
    desglosIngresos,
    desgloseEgresos
  }
}

// ===== SECCIÓN 4: PUNTO DE EQUILIBRIO =====

/**
 * Break-even = Costos Fijos / Margen de Contribución Promedio (%)
 * Devuelve la meta de GMV y qué tan cerca está el GMV real del mes.
 */
export async function seccionBreakEven({ anio, mes } = {}) {
  const { inicio, fin } = rangoMes(anio, mes)
  const cfg = await obtenerConfigContable()

  // GMV real del mes (informativo)
  const auditorias = await AuditoriaFinanciera.find({
    tipo: 'pago_aprobado',
    createdAt: { $gte: inicio, $lte: fin }
  }).lean()

  const gmvActual = auditorias.reduce((sum, a) => sum + (a.monto || 0), 0)
  const comisionesActual = auditorias.reduce((sum, a) => sum + (a.comision || 0), 0)

  // Margen de contribución = comisión / GMV (qué % del volumen es tu ingreso)
  const margenContribucion = gmvActual > 0
    ? (comisionesActual / gmvActual)
    : 0.05 // fallback 5% si no hay datos

  // Costos fijos: usar OPEX real del mes si existe, sino el configurado
  const opexReal = await GastoOperativo.aggregate([
    { $match: { fechaGasto: { $gte: inicio, $lte: fin }, activo: true } },
    { $group: { _id: null, total: { $sum: '$monto' } } }
  ])
  const costosFijos = opexReal[0]?.total || cfg.costosFijosMensuales

  // Break-even GMV = costos fijos / margen contribución
  const gmvBreakEven = margenContribucion > 0
    ? Math.round(costosFijos / margenContribucion)
    : 0

  const porcentajeAlcanzado = gmvBreakEven > 0
    ? Math.round((gmvActual / gmvBreakEven) * 10000) / 100
    : 0

  return {
    periodo: { inicio, fin },
    costosFijos: Math.round(costosFijos * 100) / 100,
    margenContribucionPorc: Math.round(margenContribucion * 10000) / 100,
    gmvBreakEven,
    gmvActual: Math.round(gmvActual * 100) / 100,
    comisionesActual: Math.round(comisionesActual * 100) / 100,
    porcentajeAlcanzado, // para el velocímetro (0-100+)
    faltante: Math.max(0, gmvBreakEven - gmvActual),
    superavit: Math.max(0, gmvActual - gmvBreakEven)
  }
}

// ===== SECCIÓN 5: CASH-FLOW (real vs informativo) =====

/**
 * Dos vistas separadas y etiquetadas:
 *  - Saldos REALES (tu plata, del mayor)
 *  - GMV transaccionado (volumen, NO es tu dinero)
 */
export async function seccionCashFlow() {
  const ahora = new Date()

  // Saldos reales (del mayor)
  const cuentas = ['1.1.1', '1.1.2', '1.1.3', '1.2.1']
  const saldosReales = {}
  for (const codigo of cuentas) {
    try {
      const bal = await contabilidadService.balanceCuenta(codigo, ahora)
      saldosReales[codigo] = bal.saldo
    } catch (e) {
      saldosReales[codigo] = 0
    }
  }

  const disponibleReal = (saldosReales['1.1.1'] || 0) + (saldosReales['1.1.3'] || 0)
  const aLiberar = saldosReales['1.1.2'] || 0

  // GMV transaccionado histórico (informativo) — del split, no es tu dinero
  const { inicio } = rangoMes()
  const auditoriasMes = await AuditoriaFinanciera.find({
    tipo: 'pago_aprobado',
    createdAt: { $gte: inicio }
  }).lean()
  const gmvMes = auditoriasMes.reduce((sum, a) => sum + (a.monto || 0), 0)
  const gmvSplit = auditoriasMes
    .filter(a => a.usaSplit)
    .reduce((sum, a) => sum + (a.monto || 0), 0)

  return {
    // BLOQUE 1: Tu plata real
    real: {
      disponible: Math.round(disponibleReal * 100) / 100,
      aLiberar: Math.round(aLiberar * 100) / 100,
      total: Math.round((disponibleReal + aLiberar) * 100) / 100,
      etiqueta: 'Dinero real disponible y en proceso de liberación (tu cuenta MP + banco)'
    },
    // BLOQUE 2: Volumen informativo (NO es tu dinero)
    informativo: {
      gmvTransaccionadoMes: Math.round(gmvMes * 100) / 100,
      gmvLiquidadoDirectoVendedor: Math.round(gmvSplit * 100) / 100,
      etiqueta: '⚠️ Volumen total transaccionado por compradores. Con Split Payment, esta plata se liquida DIRECTO al vendedor vía MercadoPago. NO pasa por tu cuenta ni es tu pasivo.'
    }
  }
}

// ===== SECCIÓN 6: POR COBRAR =====

/**
 * Dinero devengado que aún no está disponible:
 *  - MP a liberar (clearing 10-14 días)
 *  - Suscripciones en reintento de cobro
 */
export async function seccionPorCobrar() {
  const ahora = new Date()

  let mpALiberar = 0
  try {
    const bal = await contabilidadService.balanceCuenta('1.1.2', ahora)
    mpALiberar = bal.saldo
  } catch (e) { /* 0 */ }

  // Suscripciones en estado de reintento/pausada (cobro fallido)
  let suscripcionesReintento = []
  try {
    suscripcionesReintento = await Suscripcion.find({
      estado: { $in: ['pausada'] }
    }).select('usuarioId precioMensual proximoCobro estado').lean()
  } catch (e) {
    console.warn('No se pudieron leer suscripciones en reintento:', e.message)
  }

  const totalSuscripcionesReintento = suscripcionesReintento.reduce(
    (sum, s) => sum + (s.precioMensual || 0), 0
  )

  return {
    mpALiberar: Math.round(mpALiberar * 100) / 100,
    suscripcionesEnReintento: {
      cantidad: suscripcionesReintento.length,
      monto: Math.round(totalSuscripcionesReintento * 100) / 100,
      detalle: suscripcionesReintento
    },
    total: Math.round((mpALiberar + totalSuscripcionesReintento) * 100) / 100
  }
}

// ===== SECCIÓN 7: POR PAGAR =====

/**
 * Obligaciones pendientes:
 *  - Cuentas por Pagar a Vendedores (SOLO ventas sin-split, real)
 *  - Provisión de impuestos (IVA si RI + estimado ARCA)
 */
export async function seccionPorPagar({ anio, mes } = {}) {
  const ahora = new Date()
  const cfg = await obtenerConfigContable()

  // Por pagar a vendedores (cuenta 2.1.1)
  let porPagarVendedores = 0
  try {
    const bal = await contabilidadService.balanceCuenta('2.1.1', ahora)
    porPagarVendedores = bal.saldo
  } catch (e) { /* 0 */ }

  // IVA débito fiscal (cuenta 2.1.2) — solo relevante si RI
  let ivaPorPagar = 0
  if (cfg.regimenFiscal === 'Responsable Inscripto') {
    try {
      const bal = await contabilidadService.balanceCuenta('2.1.2', ahora)
      ivaPorPagar = bal.saldo
    } catch (e) { /* 0 */ }

    // Si no hay asientos de IVA todavía, estimamos sobre comisiones del mes
    if (ivaPorPagar === 0) {
      const { inicio, fin } = rangoMes(anio, mes)
      const rent = await seccionRentabilidad({ anio, mes })
      // IVA = ingresos × alícuota / (100 + alícuota) [IVA incluido en el ingreso]
      ivaPorPagar = Math.round(
        rent.ingresos * cfg.alicuotaIVA / (100 + cfg.alicuotaIVA) * 100
      ) / 100
    }
  }

  return {
    porPagarVendedores: Math.round(porPagarVendedores * 100) / 100,
    notaVendedores: porPagarVendedores > 0
      ? 'Corresponde SOLO a ventas sin-split (vendedor sin MP vinculado). Con split, el vendedor cobra directo y no es tu pasivo. ⚠️ Hoy no hay mecanismo de payout automático.'
      : 'Sin deudas a vendedores (todas las ventas usaron split → liquidación directa por MP).',
    ivaPorPagar,
    regimenFiscal: cfg.regimenFiscal,
    total: Math.round((porPagarVendedores + ivaPorPagar) * 100) / 100
  }
}

// ===== AGREGADOR: las 7 secciones de una =====

export async function panelCompleto({ anio, mes } = {}) {
  const [
    facturacion,
    margenBruto,
    rentabilidad,
    breakEven,
    cashFlow,
    porCobrar,
    porPagar,
    cuadre,
    config
  ] = await Promise.all([
    seccionFacturacion({ anio, mes }),
    seccionMargenBruto({ anio, mes }),
    seccionRentabilidad({ anio, mes }),
    seccionBreakEven({ anio, mes }),
    seccionCashFlow(),
    seccionPorCobrar(),
    seccionPorPagar({ anio, mes }),
    contabilidadService.cuadre(),
    obtenerConfigContable()
  ])

  return {
    generadoEn: new Date(),
    facturacion,
    margenBruto,
    rentabilidad,
    breakEven,
    cashFlow,
    porCobrar,
    porPagar,
    cuadre,
    config
  }
}

export default {
  obtenerConfigContable,
  guardarConfigContable,
  seccionFacturacion,
  seccionMargenBruto,
  seccionRentabilidad,
  seccionBreakEven,
  seccionCashFlow,
  seccionPorCobrar,
  seccionPorPagar,
  panelCompleto
}
