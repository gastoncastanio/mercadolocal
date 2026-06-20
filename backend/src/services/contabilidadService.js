import CuentaContable from '../models/CuentaContable.js'
import AsientoContable from '../models/AsientoContable.js'
import GastoOperativo from '../models/GastoOperativo.js'
import ResumenDiarioContable from '../models/ResumenDiarioContable.js'

/**
 * SERVICIO DE CONTABILIDAD
 *
 * Responsable de:
 * - Registrar asientos contables con garantías de integridad (Σdebe === Σhaber)
 * - Mantener transacciones atómicas con Mongo
 * - Idempotencia: webhook duplicado no duplica ingreso
 * - Trazabilidad: audit trail completo
 */

// ===== HELPERS: Búsqueda de cuentas =====

export async function obtenerCuenta(codigo) {
  const cuenta = await CuentaContable.findOne({ codigo, activa: true }).lean()
  if (!cuenta) throw new Error(`Cuenta ${codigo} no encontrada o inactiva`)
  return cuenta
}

// ===== NÚCLEO: registrarAsiento (atómico, transaccional, idempotente) =====

/**
 * Registra un asiento contable de forma atómica.
 *
 * @param {Object} args
 * @param {String} args.referenciaId - Clave de idempotencia única (ej: "orden:64abc123")
 * @param {String} args.tipo - Tipo de asiento (venta_split, venta_sin_split, etc.)
 * @param {String} args.descripcion - Descripción del asiento
 * @param {Date} args.fechaContable - Fecha en ART
 * @param {Array} args.lineas - Array de { codigoCuenta, debe, haber, fuente?, metadata? }
 * @param {Object} args.referencias - {ordenId?, vendedorId?, tiendaId?, etc.}
 * @param {String} args.origen - 'webhook' | 'manual' | 'batch'
 * @param {String} args.ipAddress - IP de origen
 * @param {Object} args.creadoPor - Usuario que creó (para audit trail)
 *
 * @returns {Object} Asiento creado
 * @throws {Error} Si el asiento no cuadra o la transacción falla
 */
export async function registrarAsiento(args) {
  const {
    referenciaId,
    tipo = 'otro',
    descripcion,
    fechaContable,
    lineas,
    referencias = {},
    origen = 'manual',
    ipAddress = '',
    creadoPor = null
  } = args

  if (!referenciaId || !descripcion || !lineas || lineas.length < 2) {
    throw new Error('Datos insuficientes para registrar asiento')
  }

  // 1. IDEMPOTENCIA (lectura rápida): si ya existe, devolverlo sin reprocesar.
  const existente = await AsientoContable.findOne({ referenciaId })
  if (existente) return existente.toObject()

  // 2. Resolver códigos a IDs de cuenta + preparar líneas
  const lineasResueltas = []
  let totalDebe = 0
  let totalHaber = 0

  for (const linea of lineas) {
    const cuenta = await obtenerCuenta(linea.codigoCuenta)
    const debe = Math.round((linea.debe || 0) * 100) / 100
    const haber = Math.round((linea.haber || 0) * 100) / 100

    // Validar: debe XOR haber
    if ((debe > 0 && haber > 0) || (debe === 0 && haber === 0)) {
      throw new Error(`Línea ${linea.codigoCuenta}: debe ser débito XOR crédito`)
    }

    lineasResueltas.push({
      cuentaId: cuenta._id,
      codigoCuenta: cuenta.codigo,
      debe,
      haber,
      descripcion: linea.descripcion || '',
      fuente: linea.fuente || 'manual',
      metadata: linea.metadata || {}
    })

    totalDebe += debe
    totalHaber += haber
  }

  // 3. Validar que cuadre (el schema lo revalida igual antes de guardar)
  totalDebe = Math.round(totalDebe * 100) / 100
  totalHaber = Math.round(totalHaber * 100) / 100

  if (Math.abs(totalDebe - totalHaber) > 0.01) {
    throw new Error(`Asiento descuadrado: débito $${totalDebe} ≠ crédito $${totalHaber}`)
  }

  // 4. Crear y guardar el asiento. Es UN solo documento (líneas embebidas), así
  //    que el save es atómico de por sí: no hace falta una transacción multi-doc
  //    (que además requeriría replica set). La idempotencia ante carreras la
  //    garantiza el índice único de `referenciaId` (capturamos el E11000).
  let asiento
  try {
    asiento = await new AsientoContable({
      referenciaId,
      tipo,
      descripcion,
      fechaContable: fechaContable || new Date(),
      lineas: lineasResueltas,
      totalDebe,
      totalHaber,
      cuadra: true,
      origen,
      ipAddress,
      creadoPor,
      referencias
    }).save()
  } catch (err) {
    // Carrera: dos webhooks simultáneos con el mismo referenciaId. El índice
    // único hace fallar al segundo → devolvemos el que sí se guardó.
    if (err.code === 11000) {
      const yaGuardado = await AsientoContable.findOne({ referenciaId })
      if (yaGuardado) return yaGuardado.toObject()
    }
    throw err
  }

  // 5. Mantenimiento async (no bloquea, no rompe el registro si falla):
  actualizarSaldosCacheados(lineasResueltas.map(l => l.cuentaId)).catch(e =>
    console.warn('Error actualizando cache de saldos:', e.message))
  regenerarResumenDiario(asiento.fechaContable).catch(e =>
    console.warn('Error regenerando resumen diario:', e.message))
  detectarDescuadres().catch(e =>
    console.warn('Error detectando descuadres:', e.message))

  return asiento.toObject()
}

// ===== HELPERS: Asientos específicos por tipo de evento =====

/**
 * Asiento de venta con Split Payment.
 * Entra a tu cuenta SOLO la comisión; el vendedor recibe el resto directo en MP.
 */
export async function asientoVentaSplit({
  ordenId,
  tiendaId,
  vendedorId,
  montoComision,
  fecha,
  creadoPor
}) {
  return registrarAsiento({
    referenciaId: `venta_split:${ordenId}`,
    tipo: 'venta_split',
    descripcion: `Venta orden #${ordenId?.toString?.().slice(-8)} (Split) | Comisión: $${montoComision}`,
    fechaContable: fecha,
    lineas: [
      { codigoCuenta: '1.1.2', debe: montoComision }, // MP a liberar
      { codigoCuenta: '4.1.1', haber: montoComision } // Comisiones por venta
    ],
    referencias: { ordenId, tiendaId, vendedorId },
    origen: 'webhook',
    creadoPor
  })
}

/**
 * Asiento de venta sin Split Payment.
 * Entra a tu cuenta TODO el monto; le debés al vendedor.
 */
export async function asientoVentaSinSplit({
  ordenId,
  tiendaId,
  vendedorId,
  montoTotal,
  montoComision,
  montoPayout,
  fecha,
  creadoPor
}) {
  return registrarAsiento({
    referenciaId: `venta_sin_split:${ordenId}`,
    tipo: 'venta_sin_split',
    descripcion: `Venta orden #${ordenId?.toString?.().slice(-8)} (Sin Split) | Total: $${montoTotal}, Comisión: $${montoComision}, Payout: $${montoPayout}`,
    fechaContable: fecha,
    lineas: [
      { codigoCuenta: '1.1.2', debe: montoTotal }, // MP a liberar
      { codigoCuenta: '4.1.1', haber: montoComision }, // Comisiones por venta
      { codigoCuenta: '2.1.1', haber: montoPayout } // Cuentas por pagar vendedor
    ],
    referencias: { ordenId, tiendaId, vendedorId },
    origen: 'webhook',
    creadoPor
  })
}

/**
 * Asiento de suscripción (destacado, pauta, etc).
 */
export async function asientoSuscripcion({
  suscripcionId,
  vendedorId,
  monto,
  fecha,
  creadoPor
}) {
  return registrarAsiento({
    referenciaId: `suscripcion:${suscripcionId}`,
    tipo: 'suscripcion',
    descripcion: `Suscripción destacado | Monto: $${monto}`,
    fechaContable: fecha,
    lineas: [
      { codigoCuenta: '1.1.2', debe: monto }, // MP a liberar
      { codigoCuenta: '4.1.3', haber: monto } // Suscripciones
    ],
    referencias: { suscripcionId, vendedorId },
    origen: 'webhook',
    creadoPor
  })
}

/**
 * Asiento de reembolso/contracargo (reverso de ingreso).
 */
export async function asientoReembolso({
  ordenId,
  montoReembolsado,
  motivo,
  fecha,
  creadoPor
}) {
  return registrarAsiento({
    referenciaId: `reembolso:${ordenId}`,
    tipo: 'reverso',
    descripcion: `Reembolso orden #${ordenId?.toString?.().slice(-8)} | Motivo: ${motivo} | Monto: $${montoReembolsado}`,
    fechaContable: fecha,
    lineas: [
      { codigoCuenta: '4.1.1', debe: montoReembolsado }, // Reversa ingresos
      { codigoCuenta: '1.1.2', haber: montoReembolsado } // De caja disponible
    ],
    referencias: { ordenId },
    origen: 'webhook',
    creadoPor
  })
}

/**
 * Asiento de egreso (OPEX: pauta, hosting, honorarios).
 */
export async function asientoEgresoOPEX({
  gastoId,
  concepto,
  categoria,
  monto,
  fecha,
  creadoPor
}) {
  // Mapeo categoría → código de cuenta de gasto
  const mapaCategorias = {
    'marketing': '5.2.1',
    'hosting': '5.2.2',
    'honorarios': '5.2.3',
    'infraestructura': '5.2.2',
    'otro': '5.2.3'
  }

  const codigoGasto = mapaCategorias[categoria] || '5.2.3'

  return registrarAsiento({
    referenciaId: `egreso:${gastoId}`,
    tipo: 'egreso_opex',
    descripcion: `${concepto} | $${monto}`,
    fechaContable: fecha,
    lineas: [
      { codigoCuenta: codigoGasto, debe: monto }, // Gasto
      { codigoCuenta: '1.1.3', haber: monto } // Caja banco
    ],
    origen: 'manual',
    creadoPor
  })
}

/**
 * Asiento de liberación de MP (cuando dinero pasa de "a liberar" a "disponible").
 */
export async function asientoLiberacionMP({
  montoLiberado,
  fecha
}) {
  return registrarAsiento({
    referenciaId: `liberacion_mp:${fecha.toISOString()}`,
    tipo: 'liberacion_mp',
    descripcion: `Liberación de fondos MP | $${montoLiberado}`,
    fechaContable: fecha,
    lineas: [
      { codigoCuenta: '1.1.1', debe: montoLiberado }, // Caja MP disponible
      { codigoCuenta: '1.1.2', haber: montoLiberado } // MP a liberar
    ],
    origen: 'batch',
    creadoPor: null
  })
}

// ===== QUERIES: Saldos y balances =====

/**
 * Calcula el saldo de una cuenta en una fecha.
 * Saldo = Σ(haber) − Σ(debe) para ASSET | (Σ(debe) − Σ(haber)) para LIABILITY/REVENUE/EXPENSE
 */
export async function balanceCuenta(codigoCuenta, hastaFecha = new Date()) {
  const cuenta = await obtenerCuenta(codigoCuenta)

  const asientos = await AsientoContable.find({
    estado: 'confirmado',
    fechaContable: { $lte: hastaFecha },
    'lineas.codigoCuenta': codigoCuenta
  }).lean()

  let debe = 0
  let haber = 0

  for (const asiento of asientos) {
    for (const linea of asiento.lineas) {
      if (linea.codigoCuenta === codigoCuenta) {
        debe += linea.debe || 0
        haber += linea.haber || 0
      }
    }
  }

  // Para ASSET: saldo = debe − haber
  // Para LIABILITY/EQUITY/REVENUE/EXPENSE: saldo = haber − debe
  let saldo
  if (['ASSET'].includes(cuenta.tipo)) {
    saldo = debe - haber
  } else {
    saldo = haber - debe
  }

  return {
    cuenta: cuenta.codigo,
    saldo: Math.round(saldo * 100) / 100,
    debe: Math.round(debe * 100) / 100,
    haber: Math.round(haber * 100) / 100
  }
}

/**
 * Cuadre: verifica que el balance de activos = pasivos + patrimonio
 * y valida que no haya asientos descuadrados.
 */
export async function cuadre(hastaFecha = new Date()) {
  // 1. Verificar asientos descuadrados
  const descuadrados = await AsientoContable.find({
    cuadra: false,
    estado: 'confirmado'
  }).lean()

  if (descuadrados.length > 0) {
    return {
      cuadra: false,
      error: `${descuadrados.length} asiento(s) descuadrado(s)`,
      detalles: descuadrados.map(a => ({
        referenciaId: a.referenciaId,
        debe: a.totalDebe,
        haber: a.totalHaber
      }))
    }
  }

  // 2. Calcular ecuación contable: ACTIVO = PASIVO + PATRIMONIO
  const cuentasActivo = await CuentaContable.find({ tipo: 'ASSET', activa: true }).select('codigo').lean()
  const cuentasPasivo = await CuentaContable.find({ tipo: 'LIABILITY', activa: true }).select('codigo').lean()
  const cuentasPatrimonio = await CuentaContable.find({ tipo: 'EQUITY', activa: true }).select('codigo').lean()

  let totalActivos = 0
  let totalPasivos = 0
  let totalPatrimonio = 0

  for (const c of cuentasActivo) {
    const bal = await balanceCuenta(c.codigo, hastaFecha)
    totalActivos += bal.saldo
  }

  for (const c of cuentasPasivo) {
    const bal = await balanceCuenta(c.codigo, hastaFecha)
    totalPasivos += bal.saldo
  }

  for (const c of cuentasPatrimonio) {
    const bal = await balanceCuenta(c.codigo, hastaFecha)
    totalPatrimonio += bal.saldo
  }

  const diferencia = Math.abs(totalActivos - (totalPasivos + totalPatrimonio))
  const cuadra = diferencia < 0.02 // Tolerancia 2 centavos por redondeos

  return {
    cuadra,
    totalActivos: Math.round(totalActivos * 100) / 100,
    totalPasivos: Math.round(totalPasivos * 100) / 100,
    totalPatrimonio: Math.round(totalPatrimonio * 100) / 100,
    diferencia: Math.round(diferencia * 100) / 100,
    ecuacion: `${Math.round(totalActivos * 100) / 100} = ${Math.round((totalPasivos + totalPatrimonio) * 100) / 100}`
  }
}

// ===== HELPERS: Mantenimiento async (no bloquean) =====

async function actualizarSaldosCacheados(cuentaIds) {
  try {
    for (const cuentaId of cuentaIds) {
      const cuenta = await CuentaContable.findById(cuentaId)
      if (!cuenta) continue

      const bal = await balanceCuenta(cuenta.codigo)
      await CuentaContable.findByIdAndUpdate(cuentaId, {
        $set: {
          saldoEnCache: bal.saldo,
          saldoCacheActualizadoEn: new Date()
        }
      })
    }
  } catch (e) {
    console.error('Error en actualizarSaldosCacheados:', e.message)
  }
}

async function regenerarResumenDiario(fecha) {
  try {
    const inicio = new Date(fecha)
    inicio.setHours(0, 0, 0, 0)
    const fin = new Date(fecha)
    fin.setHours(23, 59, 59, 999)

    const asientos = await AsientoContable.find({
      estado: 'confirmado',
      fechaContable: { $gte: inicio, $lte: fin }
    }).lean()

    let ingresos = { comisiones: 0, comisionesTraslado: 0, suscripciones: 0, pautaPublicitaria: 0, otros: 0 }
    let egresos = { procesamientoMP: 0, marketing: 0, hosting: 0, honorarios: 0, otros: 0 }

    // Mapear asientos a categorías
    for (const asiento of asientos) {
      if (asiento.tipo === 'venta_split' || asiento.tipo === 'venta_sin_split') {
        ingresos.comisiones += asiento.totalHaber
      } else if (asiento.tipo === 'suscripcion') {
        ingresos.suscripciones += asiento.totalHaber
      } else if (asiento.tipo === 'pauta_publicitaria') {
        ingresos.pautaPublicitaria += asiento.totalHaber
      } else if (asiento.tipo === 'egreso_opex') {
        // Detectar subcategoría del asiento
        if (asiento.descripcion?.includes('Marketing') || asiento.descripcion?.includes('Pauta')) {
          egresos.marketing += asiento.totalDebe
        } else if (asiento.descripcion?.includes('Hosting')) {
          egresos.hosting += asiento.totalDebe
        } else {
          egresos.otros += asiento.totalDebe
        }
      }
    }

    const totalIngresos = Object.values(ingresos).reduce((a, b) => a + b, 0)
    const totalEgresos = Object.values(egresos).reduce((a, b) => a + b, 0)

    await ResumenDiarioContable.findOneAndUpdate(
      { fecha: inicio },
      {
        ingresos,
        egresos,
        totalIngresosHoy: totalIngresos,
        totalEgresosHoy: totalEgresos,
        resultadoNeto: totalIngresos - totalEgresos,
        actualizadoEn: new Date()
      },
      { upsert: true }
    )
  } catch (e) {
    console.error('Error en regenerarResumenDiario:', e.message)
  }
}

async function detectarDescuadres() {
  try {
    const resultado = await cuadre()
    if (!resultado.cuadra) {
      console.error('🚨 DESCUADRE CONTABLE DETECTADO:', resultado)
      // TODO: Notificar a admin por WebSocket o email
    }
  } catch (e) {
    console.error('Error en detectarDescuadres:', e.message)
  }
}

export default {
  registrarAsiento,
  asientoVentaSplit,
  asientoVentaSinSplit,
  asientoSuscripcion,
  asientoReembolso,
  asientoEgresoOPEX,
  asientoLiberacionMP,
  balanceCuenta,
  cuadre,
  obtenerCuenta
}
