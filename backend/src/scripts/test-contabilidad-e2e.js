/**
 * PRUEBA END-TO-END del sistema contable (sin tocar producción).
 *
 * Levanta un MongoDB en memoria, siembra el plan de cuentas, simula historia
 * real (ventas split, sin-split, suscripción, pauta, OPEX, reembolso) usando
 * los MISMOS servicios que usa producción, y verifica que el mayor cuadre.
 *
 * USO: node src/scripts/test-contabilidad-e2e.js
 */

import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import CuentaContable from '../models/CuentaContable.js'
import AsientoContable from '../models/AsientoContable.js'
import * as contabilidadService from '../services/contabilidadService.js'

let mongod

// Colores para la salida
const ok = (s) => console.log(`  \x1b[32m✓\x1b[0m ${s}`)
const fail = (s) => console.log(`  \x1b[31m✗\x1b[0m ${s}`)
const titulo = (s) => console.log(`\n\x1b[1m${s}\x1b[0m`)

let pasaron = 0
let fallaron = 0

function assert(cond, mensaje) {
  if (cond) { ok(mensaje); pasaron++ }
  else { fail(mensaje); fallaron++ }
}

function casiIgual(a, b, tol = 0.01) {
  return Math.abs(a - b) < tol
}

// Plan de cuentas mínimo para la prueba
const PLAN = [
  { codigo: '1.1.1', nombre: 'Caja MP Disponible', tipo: 'ASSET' },
  { codigo: '1.1.2', nombre: 'MP a Liberar', tipo: 'ASSET' },
  { codigo: '1.1.3', nombre: 'Caja Banco', tipo: 'ASSET' },
  { codigo: '2.1.1', nombre: 'Por Pagar Vendedores', tipo: 'LIABILITY' },
  { codigo: '3.1.1', nombre: 'Capital', tipo: 'EQUITY' },
  { codigo: '4.1.1', nombre: 'Comisiones Venta', tipo: 'REVENUE' },
  { codigo: '4.1.3', nombre: 'Suscripciones', tipo: 'REVENUE' },
  { codigo: '4.1.4', nombre: 'Pauta', tipo: 'REVENUE' },
  { codigo: '5.2.1', nombre: 'Marketing', tipo: 'EXPENSE' }
]

async function main() {
  console.log('\n🧪 PRUEBA E2E — Sistema Contable de MercadoLocal\n' + '='.repeat(50))

  // ===== Setup =====
  // Si pasás MONGODB_TEST_URI (ej: una base de test local o Atlas), la usamos.
  // Si no, intentamos levantar Mongo en memoria (requiere descargar el binario,
  // que en algunos sandboxes está bloqueado por la política de red).
  if (process.env.MONGODB_TEST_URI) {
    await mongoose.connect(process.env.MONGODB_TEST_URI)
    ok(`Conectado a MONGODB_TEST_URI (${process.env.MONGODB_TEST_URI.slice(0, 24)}…)`)
    // Limpieza de colecciones contables para una prueba limpia (NO toca otras)
    await CuentaContable.deleteMany({})
    await AsientoContable.deleteMany({})
    ok('Colecciones contables limpiadas para la prueba')
  } else {
    mongod = await MongoMemoryServer.create()
    await mongoose.connect(mongod.getUri())
    ok('MongoDB en memoria levantado')
  }

  for (const c of PLAN) await CuentaContable.create({ ...c, esSistema: true })
  ok(`Plan de cuentas sembrado (${PLAN.length} cuentas)`)

  // ===== TEST 1: Venta con split (solo entra la comisión) =====
  titulo('TEST 1 — Venta con Split ($50.000, comisión $2.500)')
  await contabilidadService.asientoVentaSplit({
    ordenId: new mongoose.Types.ObjectId(),
    tiendaId: new mongoose.Types.ObjectId(),
    vendedorId: new mongoose.Types.ObjectId(),
    montoComision: 2500,
    fecha: new Date()
  })
  let balComisiones = await contabilidadService.balanceCuenta('4.1.1')
  let balMP = await contabilidadService.balanceCuenta('1.1.2')
  assert(casiIgual(balComisiones.saldo, 2500), `Comisiones = $${balComisiones.saldo} (esperado $2.500)`)
  assert(casiIgual(balMP.saldo, 2500), `MP a liberar = $${balMP.saldo} (esperado $2.500 — solo el fee, NO los $50k)`)

  // ===== TEST 2: Venta sin split (entra todo, le debés al vendedor) =====
  titulo('TEST 2 — Venta sin Split ($30.000, comisión $3.000, payout $27.000)')
  await contabilidadService.asientoVentaSinSplit({
    ordenId: new mongoose.Types.ObjectId(),
    tiendaId: new mongoose.Types.ObjectId(),
    vendedorId: new mongoose.Types.ObjectId(),
    montoTotal: 30000,
    montoComision: 3000,
    montoPayout: 27000,
    fecha: new Date()
  })
  balMP = await contabilidadService.balanceCuenta('1.1.2')
  let balPorPagar = await contabilidadService.balanceCuenta('2.1.1')
  balComisiones = await contabilidadService.balanceCuenta('4.1.1')
  assert(casiIgual(balMP.saldo, 32500), `MP a liberar = $${balMP.saldo} (esperado $32.500 = $2.500 + $30.000)`)
  assert(casiIgual(balPorPagar.saldo, 27000), `Por pagar vendedor = $${balPorPagar.saldo} (esperado $27.000)`)
  assert(casiIgual(balComisiones.saldo, 5500), `Comisiones acumuladas = $${balComisiones.saldo} (esperado $5.500)`)

  // ===== TEST 3: Suscripción + Pauta =====
  titulo('TEST 3 — Suscripción ($6.000) + Pauta ($10.000)')
  await contabilidadService.asientoSuscripcion({
    suscripcionId: new mongoose.Types.ObjectId(),
    vendedorId: new mongoose.Types.ObjectId(),
    monto: 6000,
    fecha: new Date()
  })
  await contabilidadService.registrarAsiento({
    referenciaId: `pauta:${new mongoose.Types.ObjectId()}`,
    tipo: 'pauta_publicitaria',
    descripcion: 'Pauta test',
    fechaContable: new Date(),
    lineas: [
      { codigoCuenta: '1.1.2', debe: 10000 },
      { codigoCuenta: '4.1.4', haber: 10000 }
    ]
  })
  let balSusc = await contabilidadService.balanceCuenta('4.1.3')
  let balPauta = await contabilidadService.balanceCuenta('4.1.4')
  assert(casiIgual(balSusc.saldo, 6000), `Suscripciones = $${balSusc.saldo} (esperado $6.000)`)
  assert(casiIgual(balPauta.saldo, 10000), `Pauta = $${balPauta.saldo} (esperado $10.000)`)

  // ===== TEST 4: OPEX (pauta de marketing $1.000.000) =====
  titulo('TEST 4 — OPEX Marketing ($1.000.000)')
  await contabilidadService.asientoEgresoOPEX({
    gastoId: new mongoose.Types.ObjectId(),
    concepto: 'Pauta Meta Lobos',
    categoria: 'marketing',
    monto: 1000000,
    fecha: new Date()
  })
  let balMarketing = await contabilidadService.balanceCuenta('5.2.1')
  assert(casiIgual(balMarketing.saldo, 1000000), `Marketing = $${balMarketing.saldo} (esperado $1.000.000)`)

  // ===== TEST 5: Idempotencia (webhook duplicado) =====
  titulo('TEST 5 — Idempotencia (mismo referenciaId 2 veces)')
  const refDup = `venta_split:${new mongoose.Types.ObjectId()}`
  await contabilidadService.registrarAsiento({
    referenciaId: refDup, tipo: 'venta_split', descripcion: 'dup test', fechaContable: new Date(),
    lineas: [{ codigoCuenta: '1.1.2', debe: 100 }, { codigoCuenta: '4.1.1', haber: 100 }]
  })
  await contabilidadService.registrarAsiento({
    referenciaId: refDup, tipo: 'venta_split', descripcion: 'dup test', fechaContable: new Date(),
    lineas: [{ codigoCuenta: '1.1.2', debe: 100 }, { codigoCuenta: '4.1.1', haber: 100 }]
  })
  const countDup = await AsientoContable.countDocuments({ referenciaId: refDup })
  assert(countDup === 1, `Asientos con ese ref = ${countDup} (esperado 1, no duplicó)`)

  // ===== TEST 6: Asiento descuadrado debe RECHAZARSE =====
  titulo('TEST 6 — Rechazo de asiento descuadrado')
  let rechazado = false
  try {
    await contabilidadService.registrarAsiento({
      referenciaId: `malo:${new mongoose.Types.ObjectId()}`,
      tipo: 'otro', descripcion: 'descuadrado', fechaContable: new Date(),
      lineas: [{ codigoCuenta: '1.1.2', debe: 100 }, { codigoCuenta: '4.1.1', haber: 50 }]
    })
  } catch (e) {
    rechazado = true
  }
  assert(rechazado, 'Asiento con debe≠haber fue rechazado correctamente')

  // ===== TEST 7: CUADRE GLOBAL (la prueba de fuego) =====
  titulo('TEST 7 — CUADRE GLOBAL (Activos = Pasivos + Patrimonio + Resultado)')
  const resultadoCuadre = await contabilidadService.cuadre()
  // En contabilidad: Activos = Pasivos + Patrimonio + (Ingresos − Egresos)
  // Como no hay cuenta de resultado, verificamos la suma manual:
  const activos = (await contabilidadService.balanceCuenta('1.1.1')).saldo
    + (await contabilidadService.balanceCuenta('1.1.2')).saldo
    + (await contabilidadService.balanceCuenta('1.1.3')).saldo
  const pasivos = (await contabilidadService.balanceCuenta('2.1.1')).saldo
  const ingresos = (await contabilidadService.balanceCuenta('4.1.1')).saldo
    + (await contabilidadService.balanceCuenta('4.1.3')).saldo
    + (await contabilidadService.balanceCuenta('4.1.4')).saldo
  const egresos = (await contabilidadService.balanceCuenta('5.2.1')).saldo
  const resultado = ingresos - egresos

  console.log(`     Activos:   $${activos.toLocaleString('es-AR')}`)
  console.log(`     Pasivos:   $${pasivos.toLocaleString('es-AR')}`)
  console.log(`     Ingresos:  $${ingresos.toLocaleString('es-AR')}`)
  console.log(`     Egresos:   $${egresos.toLocaleString('es-AR')}`)
  console.log(`     Resultado: $${resultado.toLocaleString('es-AR')}`)
  // Ecuación: Activos = Pasivos + Resultado (sin capital inicial)
  assert(casiIgual(activos, pasivos + resultado),
    `Ecuación contable: Activos ($${activos.toLocaleString('es-AR')}) = Pasivos + Resultado ($${(pasivos + resultado).toLocaleString('es-AR')})`)

  // Verificar que NO haya asientos descuadrados
  const descuadrados = await AsientoContable.countDocuments({ cuadra: false })
  assert(descuadrados === 0, `Asientos descuadrados en BD = ${descuadrados} (esperado 0)`)

  // ===== Resumen =====
  console.log('\n' + '='.repeat(50))
  const totalAsientos = await AsientoContable.countDocuments()
  console.log(`\n📊 Asientos creados: ${totalAsientos}`)
  console.log(`\n\x1b[1mRESULTADO: ${pasaron} pasaron, ${fallaron} fallaron\x1b[0m`)
  if (fallaron === 0) {
    console.log('\x1b[32m\x1b[1m✅ TODOS LOS TESTS PASARON — el mayor cuadra al peso\x1b[0m\n')
  } else {
    console.log('\x1b[31m\x1b[1m❌ HAY FALLOS — revisar arriba\x1b[0m\n')
  }
}

main()
  .catch(e => { console.error('\n❌ Error en la prueba:', e); fallaron++ })
  .finally(async () => {
    await mongoose.disconnect()
    if (mongod) await mongod.stop()
    process.exit(fallaron === 0 ? 0 : 1)
  })
