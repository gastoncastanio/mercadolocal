/**
 * BACKFILL: Genera asientos contables retroactivos desde AuditoriaFinanciera + Comprobante.
 *
 * USO: node scripts/backfill-asientos-historicos.js
 *
 * IDEMPOTENCIA: Si un asiento ya existe (referenciaId duplicada), se salta.
 * Se puede re-ejecutar sin problemas.
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import AuditoriaFinanciera from '../models/AuditoriaFinanciera.js'
import Comprobante from '../models/Comprobante.js'
import AsientoContable from '../models/AsientoContable.js'
import CuentaContable from '../models/CuentaContable.js'
import Orden from '../models/Orden.js'

dotenv.config()

// ===== CONEXIÓN =====

async function conectar() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no configurado')
  }
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('✅ Conectado a MongoDB')
}

async function desconectar() {
  await mongoose.disconnect()
  console.log('✅ Desconectado')
}

// ===== HELPERS =====

async function obtenerCuenta(codigo) {
  const cuenta = await CuentaContable.findOne({ codigo, activa: true })
  if (!cuenta) throw new Error(`Cuenta ${codigo} no encontrada`)
  return cuenta
}

async function crearAsientoIdempotente(referenciaId, lineas, tipo, descripcion, fechaContable, referencias) {
  // Verificar idempotencia
  const existe = await AsientoContable.findOne({ referenciaId })
  if (existe) {
    return { creado: false, razon: 'ya existe', asientoId: existe._id }
  }

  // Calcular totales y validar que cuadre
  let totalDebe = 0
  let totalHaber = 0

  for (const linea of lineas) {
    totalDebe += linea.debe || 0
    totalHaber += linea.haber || 0
  }

  totalDebe = Math.round(totalDebe * 100) / 100
  totalHaber = Math.round(totalHaber * 100) / 100

  if (Math.abs(totalDebe - totalHaber) > 0.01) {
    return {
      creado: false,
      razon: `descuadrado (debe $${totalDebe} ≠ haber $${totalHaber})`,
      asientoId: null
    }
  }

  // Crear
  try {
    const asiento = new AsientoContable({
      referenciaId,
      tipo,
      descripcion,
      fechaContable: fechaContable || new Date(),
      lineas,
      totalDebe,
      totalHaber,
      cuadra: true,
      origen: 'import',
      estado: 'confirmado'
    })

    await asiento.save()
    return { creado: true, razon: 'ok', asientoId: asiento._id }
  } catch (error) {
    return { creado: false, razon: error.message, asientoId: null }
  }
}

// ===== BACKFILL =====

async function backfillDesdeAuditoria() {
  console.log('\n📋 Procesando AuditoriaFinanciera...')

  const auditorias = await AuditoriaFinanciera.find({}).sort({ createdAt: 1 })
  console.log(`  → Encontradas ${auditorias.length} auditoras`)

  let procesadas = 0
  let saltadas = 0
  let errores = 0

  for (const aud of auditorias) {
    try {
      // Obtener fecha de creación (es más confiable que usar createdAt UTC)
      const orden = await Orden.findById(aud.ordenId).select('createdAt')
      const fechaContable = orden?.createdAt || aud.createdAt

      if (aud.tipo === 'pago_aprobado') {
        const lineas = []

        // Si usaSplit: solo entra la comisión
        if (aud.usaSplit) {
          const cuentaMP = await obtenerCuenta('1.1.2')
          const cuentaComisiones = await obtenerCuenta('4.1.1')

          lineas.push({
            cuentaId: cuentaMP._id,
            codigoCuenta: '1.1.2',
            debe: aud.comision,
            haber: 0,
            descripcion: `Venta orden #${aud.ordenId.toString().slice(-8)}`,
            fuente: 'webhook',
            metadata: { mpPaymentId: aud.mpPaymentId }
          })

          lineas.push({
            cuentaId: cuentaComisiones._id,
            codigoCuenta: '4.1.1',
            debe: 0,
            haber: aud.comision,
            descripcion: `Comisión venta`,
            fuente: 'webhook'
          })
        } else {
          // Sin split: entra todo, le debés al vendedor
          const cuentaMP = await obtenerCuenta('1.1.2')
          const cuentaComisiones = await obtenerCuenta('4.1.1')
          const cuentaPorPagar = await obtenerCuenta('2.1.1')

          const montoTotal = aud.monto
          const comision = aud.comision
          const payout = montoTotal - comision

          lineas.push({
            cuentaId: cuentaMP._id,
            codigoCuenta: '1.1.2',
            debe: montoTotal,
            haber: 0,
            fuente: 'webhook'
          })

          lineas.push({
            cuentaId: cuentaComisiones._id,
            codigoCuenta: '4.1.1',
            debe: 0,
            haber: comision,
            fuente: 'webhook'
          })

          lineas.push({
            cuentaId: cuentaPorPagar._id,
            codigoCuenta: '2.1.1',
            debe: 0,
            haber: payout,
            fuente: 'webhook',
            metadata: { vendedorId: aud.tiendaIds?.[0] }
          })
        }

        const resultado = await crearAsientoIdempotente(
          `auditoria:${aud._id}`,
          lineas,
          aud.usaSplit ? 'venta_split' : 'venta_sin_split',
          `Venta orden #${aud.ordenId.toString().slice(-8)} | ${aud.usaSplit ? 'Split' : 'Sin split'} | Comisión: $${aud.comision}`,
          fechaContable,
          { ordenId: aud.ordenId }
        )

        if (resultado.creado) procesadas++
        else saltadas++
      } else if (aud.tipo === 'pago_rechazado' || aud.tipo === 'reembolso') {
        // Skip por ahora (los rechazos no generan asiento; los reembolsos se manejan aparte)
        saltadas++
      }
    } catch (error) {
      console.error(`  ⚠️ Error procesando auditoría ${aud._id}: ${error.message}`)
      errores++
    }
  }

  console.log(
    `  → Procesadas: ${procesadas} | Saltadas: ${saltadas} | Errores: ${errores}`
  )

  return { procesadas, saltadas, errores }
}

async function backfillDesdeComprobantes() {
  console.log('\n📄 Procesando Comprobantes (Pauta + Comisión)...')

  // Solo pauta y comisión (no venta, que ya viene de auditoría)
  const comprobantes = await Comprobante.find({
    tipo: { $in: ['pauta', 'comision'] }
  }).sort({ createdAt: 1 })

  console.log(`  → Encontrados ${comprobantes.length} comprobantes`)

  let procesadas = 0
  let saltadas = 0
  let errores = 0

  for (const comp of comprobantes) {
    try {
      const lineas = []

      if (comp.tipo === 'pauta') {
        const cuentaMP = await obtenerCuenta('1.1.2')
        const cuentaPauta = await obtenerCuenta('4.1.4')

        lineas.push({
          cuentaId: cuentaMP._id,
          codigoCuenta: '1.1.2',
          debe: comp.total,
          haber: 0,
          fuente: 'webhook',
          metadata: { comprobanteId: comp._id }
        })

        lineas.push({
          cuentaId: cuentaPauta._id,
          codigoCuenta: '4.1.4',
          debe: 0,
          haber: comp.total,
          fuente: 'webhook'
        })

        const resultado = await crearAsientoIdempotente(
          `comprobante:${comp._id}`,
          lineas,
          'pauta_publicitaria',
          `Pauta publicitaria | $${comp.total}`,
          comp.fechaEmision,
          { comprobanteId: comp._id, vendedorId: comp.vendedorId }
        )

        if (resultado.creado) procesadas++
        else saltadas++
      } else if (comp.tipo === 'comision') {
        // Las comisiones ya vienen de auditoría, así que saltamos
        saltadas++
      }
    } catch (error) {
      console.error(`  ⚠️ Error procesando comprobante ${comp._id}: ${error.message}`)
      errores++
    }
  }

  console.log(
    `  → Procesadas: ${procesadas} | Saltadas: ${saltadas} | Errores: ${errores}`
  )

  return { procesadas, saltadas, errores }
}

// ===== MAIN =====

async function main() {
  console.log('\n🔄 BACKFILL: Generando asientos contables retroactivos...\n')

  try {
    await conectar()

    // Verificar que existan las cuentas necesarias
    console.log('✓ Verificando plan de cuentas...')
    await obtenerCuenta('1.1.1')
    await obtenerCuenta('1.1.2')
    await obtenerCuenta('4.1.1')
    await obtenerCuenta('4.1.4')
    await obtenerCuenta('2.1.1')
    console.log('  ✓ Todas las cuentas existen')

    const resultAuditoria = await backfillDesdeAuditoria()
    const resultComprobantes = await backfillDesdeComprobantes()

    const totalProcesadas = resultAuditoria.procesadas + resultComprobantes.procesadas
    const totalSaltadas = resultAuditoria.saltadas + resultComprobantes.saltadas
    const totalErrores = resultAuditoria.errores + resultComprobantes.errores

    console.log(`\n✅ Backfill completado:`)
    console.log(`   Asientos creados: ${totalProcesadas}`)
    console.log(`   Saltadas (ya existían): ${totalSaltadas}`)
    console.log(`   Errores: ${totalErrores}`)

    if (totalErrores > 0) {
      console.log(`\n⚠️  Revisar los errores arriba`)
    }
  } catch (error) {
    console.error('\n❌ Error en backfill:', error.message)
    process.exit(1)
  } finally {
    await desconectar()
  }
}

main()
