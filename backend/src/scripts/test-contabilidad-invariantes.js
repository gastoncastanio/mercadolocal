/**
 * PRUEBA DE INVARIANTES CONTABLES (sin base de datos).
 *
 * La validación de Mongoose corre en memoria — no necesita conexión. Esto prueba
 * la propiedad más crítica del sistema: es matemáticamente IMPOSIBLE guardar un
 * asiento descuadrado (Σdebe ≠ Σhaber) o una línea inválida (debe Y haber a la vez).
 *
 * USO: node src/scripts/test-contabilidad-invariantes.js
 */

import AsientoContable from '../models/AsientoContable.js'

const ok = (s) => console.log(`  \x1b[32m✓\x1b[0m ${s}`)
const bad = (s) => console.log(`  \x1b[31m✗\x1b[0m ${s}`)
let pasaron = 0, fallaron = 0
function check(cond, msg) { cond ? (ok(msg), pasaron++) : (bad(msg), fallaron++) }

// Construye un AsientoContable de prueba (sin guardarlo)
function asiento(lineas, extra = {}) {
  return new AsientoContable({
    referenciaId: `test:${Math.random()}`,
    tipo: 'otro',
    descripcion: 'test',
    fechaContable: new Date(),
    lineas,
    ...extra
  })
}

// ¿validate() pasa o falla?
async function valida(doc) {
  try { await doc.validate(); return true } catch { return false }
}

async function main() {
  console.log('\n🧪 INVARIANTES CONTABLES (validación en memoria, sin DB)\n' + '='.repeat(55))

  // ===== 1. Asiento cuadrado: PASA =====
  console.log('\n\x1b[1m1. Asiento cuadrado ($2.500 = $2.500)\x1b[0m')
  const cuadrado = asiento([
    { cuentaId: '000000000000000000000001', codigoCuenta: '1.1.2', debe: 2500, haber: 0 },
    { cuentaId: '000000000000000000000002', codigoCuenta: '4.1.1', debe: 0, haber: 2500 }
  ])
  check(await valida(cuadrado), 'validate() PASA en asiento cuadrado')
  check(cuadrado.totalDebe === 2500, `totalDebe calculado = ${cuadrado.totalDebe} (esperado 2500)`)
  check(cuadrado.totalHaber === 2500, `totalHaber calculado = ${cuadrado.totalHaber} (esperado 2500)`)
  check(cuadrado.cuadra === true, `flag cuadra = ${cuadrado.cuadra} (esperado true)`)

  // ===== 2. Asiento descuadrado: FALLA =====
  console.log('\n\x1b[1m2. Asiento descuadrado ($100 ≠ $50)\x1b[0m')
  const descuadrado = asiento([
    { cuentaId: '000000000000000000000001', codigoCuenta: '1.1.2', debe: 100, haber: 0 },
    { cuentaId: '000000000000000000000002', codigoCuenta: '4.1.1', debe: 0, haber: 50 }
  ])
  check(!(await valida(descuadrado)), 'validate() FALLA en asiento descuadrado (rechazado)')
  check(descuadrado.cuadra === false, `flag cuadra = ${descuadrado.cuadra} (esperado false)`)

  // ===== 3. Línea con debe Y haber: FALLA =====
  console.log('\n\x1b[1m3. Línea con debe Y haber a la vez (inválido)\x1b[0m')
  const ambos = asiento([
    { cuentaId: '000000000000000000000001', codigoCuenta: '1.1.2', debe: 100, haber: 100 },
    { cuentaId: '000000000000000000000002', codigoCuenta: '4.1.1', debe: 0, haber: 0 }
  ])
  check(!(await valida(ambos)), 'validate() FALLA si una línea tiene debe Y haber')

  // ===== 4. Una sola línea: FALLA (mínimo 2) =====
  console.log('\n\x1b[1m4. Asiento con una sola línea (mínimo 2)\x1b[0m')
  const unaLinea = asiento([
    { cuentaId: '000000000000000000000001', codigoCuenta: '1.1.2', debe: 100, haber: 0 }
  ])
  check(!(await valida(unaLinea)), 'validate() FALLA con menos de 2 líneas')

  // ===== 5. Multi-línea cuadrada (venta sin split): PASA =====
  console.log('\n\x1b[1m5. Venta sin split: $30.000 = $3.000 comisión + $27.000 payout\x1b[0m')
  const sinSplit = asiento([
    { cuentaId: '000000000000000000000001', codigoCuenta: '1.1.2', debe: 30000, haber: 0 },
    { cuentaId: '000000000000000000000002', codigoCuenta: '4.1.1', debe: 0, haber: 3000 },
    { cuentaId: '000000000000000000000003', codigoCuenta: '2.1.1', debe: 0, haber: 27000 }
  ])
  check(await valida(sinSplit), 'validate() PASA en venta sin split (3 líneas)')
  check(sinSplit.totalDebe === 30000 && sinSplit.totalHaber === 30000, `$${sinSplit.totalDebe} = $${sinSplit.totalHaber}`)

  // ===== 6. Tolerancia ante error de punto flotante (0.1 + 0.2 = 0.300...04) =====
  console.log('\n\x1b[1m6. Error de punto flotante (0.1 + 0.2 vs 0.3)\x1b[0m')
  const fp = asiento([
    { cuentaId: '000000000000000000000001', codigoCuenta: '1.1.2', debe: 0.1, haber: 0 },
    { cuentaId: '000000000000000000000002', codigoCuenta: '1.1.3', debe: 0.2, haber: 0 },
    { cuentaId: '000000000000000000000003', codigoCuenta: '4.1.1', debe: 0, haber: 0.3 }
  ])
  check(await valida(fp), 'validate() PASA: el redondeo absorbe el error de punto flotante (0.1+0.2=0.3)')

  // ===== 7. Centavo real de descuadre: FALLA =====
  console.log('\n\x1b[1m7. Descuadre de 1 centavo real ($100.01 ≠ $100.00)\x1b[0m')
  const centavo = asiento([
    { cuentaId: '000000000000000000000001', codigoCuenta: '1.1.2', debe: 100.01, haber: 0 },
    { cuentaId: '000000000000000000000002', codigoCuenta: '4.1.1', debe: 0, haber: 100 }
  ])
  check(!(await valida(centavo)), 'validate() FALLA ante descuadre real de 1 centavo (no lo deja pasar)')

  // ===== Resumen =====
  console.log('\n' + '='.repeat(55))
  console.log(`\n\x1b[1mRESULTADO: ${pasaron} pasaron, ${fallaron} fallaron\x1b[0m`)
  if (fallaron === 0) {
    console.log('\x1b[32m\x1b[1m✅ La invariante contable es inviolable: no se puede guardar un asiento descuadrado.\x1b[0m\n')
  } else {
    console.log('\x1b[31m\x1b[1m❌ HAY FALLOS — revisar arriba\x1b[0m\n')
  }
  process.exit(fallaron === 0 ? 0 : 1)
}

main().catch(e => { console.error('Error:', e); process.exit(1) })
