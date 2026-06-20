/**
 * SEED: Carga el plan de cuentas (Chart of Accounts) en la BD.
 *
 * USO: node scripts/seed-plan-cuentas.js
 *
 * IDEMPOTENCIA: Las cuentas se crean con upsert, así que re-ejecutar es seguro.
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import CuentaContable from '../models/CuentaContable.js'

dotenv.config()

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

// Plan de cuentas
const PLAN_CUENTAS = [
  // ===== ACTIVO =====
  {
    codigo: '1.1.1',
    nombre: 'Caja MercadoPago (Disponible)',
    tipo: 'ASSET',
    descripcion: 'Dinero líquido disponible en tu cuenta de MercadoPago',
    esSistema: true,
    moneda: 'ARS'
  },
  {
    codigo: '1.1.2',
    nombre: 'MercadoPago a Liberar (Clearing)',
    tipo: 'ASSET',
    descripcion: 'Dinero acreditado pero aún en período de liberación (10-14 días)',
    esSistema: true,
    moneda: 'ARS'
  },
  {
    codigo: '1.1.3',
    nombre: 'Caja Banco',
    tipo: 'ASSET',
    descripcion: 'Dinero en tu cuenta bancaria (retiros de MercadoPago)',
    esSistema: true,
    moneda: 'ARS'
  },
  {
    codigo: '1.2.1',
    nombre: 'Cuentas por Cobrar',
    tipo: 'ASSET',
    descripcion: 'Dinero que vendedores/profesionales aún no pagaron (suscripciones en reintento)',
    esSistema: false,
    moneda: 'ARS'
  },

  // ===== PASIVO =====
  {
    codigo: '2.1.1',
    nombre: 'Cuentas por Pagar a Vendedores',
    tipo: 'LIABILITY',
    descripcion: 'Dinero que debés a vendedores (solo ventas sin-split que pagó el comprador)',
    esSistema: true,
    moneda: 'ARS'
  },
  {
    codigo: '2.1.2',
    nombre: 'IVA Débito Fiscal',
    tipo: 'LIABILITY',
    descripcion: 'IVA a pagar al fisco sobre comisiones (solo si eres Responsable Inscripto)',
    esSistema: false,
    moneda: 'ARS'
  },
  {
    codigo: '2.1.3',
    nombre: 'Provisión Impuestos (ARCA/IIBB)',
    tipo: 'LIABILITY',
    descripcion: 'Provisión para impuestos nacionales/municipales mensuales',
    esSistema: false,
    moneda: 'ARS'
  },

  // ===== PATRIMONIO =====
  {
    codigo: '3.1.1',
    nombre: 'Capital',
    tipo: 'EQUITY',
    descripcion: 'Inversión inicial en la plataforma',
    esSistema: false,
    moneda: 'ARS'
  },
  {
    codigo: '3.1.2',
    nombre: 'Resultados Acumulados',
    tipo: 'EQUITY',
    descripcion: 'Ganancias/pérdidas acumuladas en períodos anteriores',
    esSistema: false,
    moneda: 'ARS'
  },

  // ===== INGRESOS =====
  {
    codigo: '4.1.1',
    nombre: 'Comisiones por Venta',
    tipo: 'REVENUE',
    descripcion: 'Tu porcentaje de cada transacción de producto (5-10%)',
    esSistema: true,
    moneda: 'ARS'
  },
  {
    codigo: '4.1.2',
    nombre: 'Comisiones por Traslado (Comisionistas)',
    tipo: 'REVENUE',
    descripcion: 'Tu porcentaje de cada traslado cotizado via comisionistas',
    esSistema: true,
    moneda: 'ARS'
  },
  {
    codigo: '4.1.3',
    nombre: 'Suscripciones Destacado',
    tipo: 'REVENUE',
    descripcion: 'Ingresos mensuales de profesionales destacados ($6.000/mes)',
    esSistema: true,
    moneda: 'ARS'
  },
  {
    codigo: '4.1.4',
    nombre: 'Pauta Publicitaria',
    tipo: 'REVENUE',
    descripcion: 'Ingresos por planes de pauta que pagan los vendedores',
    esSistema: true,
    moneda: 'ARS'
  },
  {
    codigo: '4.1.5',
    nombre: 'Otros Ingresos',
    tipo: 'REVENUE',
    descripcion: 'Ingresos varios',
    esSistema: false,
    moneda: 'ARS'
  },

  // ===== EGRESOS =====
  {
    codigo: '5.1.1',
    nombre: 'Costo Procesamiento MercadoPago',
    tipo: 'EXPENSE',
    descripcion: 'Fee que MercadoPago retiene de cada transacción (~2-2.9%)',
    esSistema: true,
    moneda: 'ARS'
  },
  {
    codigo: '5.2.1',
    nombre: 'Marketing / Pauta Publicitaria',
    tipo: 'EXPENSE',
    descripcion: 'Gastos en Meta, Google Ads y otras campañas ($1M/mes aprox)',
    esSistema: true,
    moneda: 'ARS'
  },
  {
    codigo: '5.2.2',
    nombre: 'Hosting e Infraestructura',
    tipo: 'EXPENSE',
    descripcion: 'Railway, Vercel, Atlas MongoDB, Cloudinary, etc.',
    esSistema: true,
    moneda: 'ARS'
  },
  {
    codigo: '5.2.3',
    nombre: 'Honorarios Contables / Bancarios',
    tipo: 'EXPENSE',
    descripcion: 'Gastos contables, asesoramiento fiscal, comisiones bancarias',
    esSistema: true,
    moneda: 'ARS'
  },
  {
    codigo: '5.2.4',
    nombre: 'Otros Gastos Operativos',
    tipo: 'EXPENSE',
    descripcion: 'Telefonía, software, licencias, etc.',
    esSistema: false,
    moneda: 'ARS'
  }
]

async function seed() {
  console.log('\n📊 Seeding Plan de Cuentas...\n')

  let creadas = 0
  let actualizadas = 0
  let errores = 0

  for (const cuenta of PLAN_CUENTAS) {
    try {
      const resultado = await CuentaContable.findOneAndUpdate(
        { codigo: cuenta.codigo },
        cuenta,
        { upsert: true, new: true }
      )

      if (resultado.isNew) {
        console.log(`✓ Creada: ${cuenta.codigo} - ${cuenta.nombre}`)
        creadas++
      } else {
        console.log(`↻ Actualizada: ${cuenta.codigo} - ${cuenta.nombre}`)
        actualizadas++
      }
    } catch (error) {
      console.error(`✗ Error en ${cuenta.codigo}: ${error.message}`)
      errores++
    }
  }

  console.log(`\n✅ Seed completado:`)
  console.log(`   Creadas: ${creadas}`)
  console.log(`   Actualizadas: ${actualizadas}`)
  console.log(`   Errores: ${errores}`)
}

async function main() {
  try {
    await conectar()
    await seed()
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  } finally {
    await desconectar()
  }
}

main()
