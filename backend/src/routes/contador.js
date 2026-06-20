import { Router } from 'express'
import { verificarToken, esAdmin } from '../middleware/auth.js'
import CuentaContable from '../models/CuentaContable.js'
import AsientoContable from '../models/AsientoContable.js'
import GastoOperativo from '../models/GastoOperativo.js'
import ResumenDiarioContable from '../models/ResumenDiarioContable.js'
import * as contabilidadService from '../services/contabilidadService.js'

const router = Router()

/**
 * POST /api/contador/init-plan-cuentas
 * Admin: Seed del plan de cuentas (SOLO primera vez)
 */
router.post('/init-plan-cuentas', verificarToken, esAdmin, async (req, res) => {
  try {
    const PLAN_CUENTAS = [
      { codigo: '1.1.1', nombre: 'Caja MercadoPago (Disponible)', tipo: 'ASSET', esSistema: true, moneda: 'ARS' },
      { codigo: '1.1.2', nombre: 'MercadoPago a Liberar (Clearing)', tipo: 'ASSET', esSistema: true, moneda: 'ARS' },
      { codigo: '1.1.3', nombre: 'Caja Banco', tipo: 'ASSET', esSistema: true, moneda: 'ARS' },
      { codigo: '1.2.1', nombre: 'Cuentas por Cobrar', tipo: 'ASSET', esSistema: false, moneda: 'ARS' },
      { codigo: '2.1.1', nombre: 'Cuentas por Pagar a Vendedores', tipo: 'LIABILITY', esSistema: true, moneda: 'ARS' },
      { codigo: '2.1.2', nombre: 'IVA Débito Fiscal', tipo: 'LIABILITY', esSistema: false, moneda: 'ARS' },
      { codigo: '2.1.3', nombre: 'Provisión Impuestos (ARCA/IIBB)', tipo: 'LIABILITY', esSistema: false, moneda: 'ARS' },
      { codigo: '3.1.1', nombre: 'Capital', tipo: 'EQUITY', esSistema: false, moneda: 'ARS' },
      { codigo: '3.1.2', nombre: 'Resultados Acumulados', tipo: 'EQUITY', esSistema: false, moneda: 'ARS' },
      { codigo: '4.1.1', nombre: 'Comisiones por Venta', tipo: 'REVENUE', esSistema: true, moneda: 'ARS' },
      { codigo: '4.1.2', nombre: 'Comisiones por Traslado', tipo: 'REVENUE', esSistema: true, moneda: 'ARS' },
      { codigo: '4.1.3', nombre: 'Suscripciones Destacado', tipo: 'REVENUE', esSistema: true, moneda: 'ARS' },
      { codigo: '4.1.4', nombre: 'Pauta Publicitaria', tipo: 'REVENUE', esSistema: true, moneda: 'ARS' },
      { codigo: '4.1.5', nombre: 'Otros Ingresos', tipo: 'REVENUE', esSistema: false, moneda: 'ARS' },
      { codigo: '5.1.1', nombre: 'Costo Procesamiento MercadoPago', tipo: 'EXPENSE', esSistema: true, moneda: 'ARS' },
      { codigo: '5.2.1', nombre: 'Marketing / Pauta Publicitaria', tipo: 'EXPENSE', esSistema: true, moneda: 'ARS' },
      { codigo: '5.2.2', nombre: 'Hosting e Infraestructura', tipo: 'EXPENSE', esSistema: true, moneda: 'ARS' },
      { codigo: '5.2.3', nombre: 'Honorarios Contables / Bancarios', tipo: 'EXPENSE', esSistema: true, moneda: 'ARS' },
      { codigo: '5.2.4', nombre: 'Otros Gastos Operativos', tipo: 'EXPENSE', esSistema: false, moneda: 'ARS' }
    ]

    let creadas = 0
    let actualizadas = 0

    for (const cuenta of PLAN_CUENTAS) {
      const resultado = await CuentaContable.findOneAndUpdate(
        { codigo: cuenta.codigo },
        cuenta,
        { upsert: true, new: true }
      )
      resultado.isNew ? creadas++ : actualizadas++
    }

    res.json({
      mensaje: 'Plan de cuentas inicializado',
      creadas,
      actualizadas
    })
  } catch (error) {
    console.error('Error inicializando plan de cuentas:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/contador/resumen
 * Resumen financiero del mes actual
 */
router.get('/resumen', verificarToken, esAdmin, async (req, res) => {
  try {
    const ahora = new Date()
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1)

    const resumen = await ResumenDiarioContable.find({
      fecha: { $gte: inicio }
    }).lean()

    const totales = resumen.reduce(
      (acc, dia) => ({
        ingresos: acc.ingresos + (dia.totalIngresosHoy || 0),
        egresos: acc.egresos + (dia.totalEgresosHoy || 0),
        resultado: acc.resultado + (dia.resultadoNeto || 0)
      }),
      { ingresos: 0, egresos: 0, resultado: 0 }
    )

    // Saldos principales
    const saldos = {
      cajaMP: 0,
      cajaBanco: 0,
      cuentasPorPagar: 0
    }

    try {
      const balMP = await contabilidadService.balanceCuenta('1.1.1', ahora)
      saldos.cajaMP = balMP.saldo
    } catch (e) {
      console.warn('Error calculando saldo Caja MP:', e.message)
    }

    try {
      const balBanco = await contabilidadService.balanceCuenta('1.1.3', ahora)
      saldos.cajaBanco = balBanco.saldo
    } catch (e) {
      console.warn('Error calculando saldo Caja Banco:', e.message)
    }

    try {
      const balPorPagar = await contabilidadService.balanceCuenta('2.1.1', ahora)
      saldos.cuentasPorPagar = balPorPagar.saldo
    } catch (e) {
      console.warn('Error calculando saldo Cuentas por Pagar:', e.message)
    }

    res.json({
      periodo: {
        desde: inicio.toISOString().split('T')[0],
        hasta: ahora.toISOString().split('T')[0]
      },
      ingresos: Math.round(totales.ingresos * 100) / 100,
      egresos: Math.round(totales.egresos * 100) / 100,
      resultado: Math.round(totales.resultado * 100) / 100,
      saldos
    })
  } catch (error) {
    console.error('Error en GET /resumen:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/contador/cuadre
 * Verifica que el balance contable cuadre (Activos = Pasivos + Patrimonio)
 */
router.get('/cuadre', verificarToken, esAdmin, async (req, res) => {
  try {
    const resultado = await contabilidadService.cuadre()
    res.json(resultado)
  } catch (error) {
    console.error('Error en GET /cuadre:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/contador/asientos
 * Listar asientos (con filtros opcionales)
 */
router.get('/asientos', verificarToken, esAdmin, async (req, res) => {
  try {
    const { tipo, desde, hasta, limit = 50, skip = 0 } = req.query

    const filtro = {}
    if (tipo) filtro.tipo = tipo
    if (desde || hasta) {
      filtro.fechaContable = {}
      if (desde) filtro.fechaContable.$gte = new Date(desde)
      if (hasta) filtro.fechaContable.$lte = new Date(hasta)
    }

    const asientos = await AsientoContable.find(filtro)
      .sort({ fechaContable: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean()

    const total = await AsientoContable.countDocuments(filtro)

    res.json({
      total,
      asientos,
      pagina: Math.floor(parseInt(skip) / parseInt(limit)) + 1,
      porPagina: parseInt(limit)
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/contador/gasto
 * Carga manual de OPEX (pauta, hosting, honorarios)
 */
router.post('/gasto', verificarToken, esAdmin, async (req, res) => {
  try {
    const { categoria, concepto, monto, fechaGasto, comprobanteUrl, notas } = req.body

    if (!categoria || !concepto || !monto || !fechaGasto) {
      return res.status(400).json({ error: 'Campos requeridos: categoria, concepto, monto, fechaGasto' })
    }

    const gasto = new GastoOperativo({
      categoria,
      concepto,
      monto,
      fechaGasto: new Date(fechaGasto),
      cargadoPor: req.usuario.id,
      comprobanteUrl: comprobanteUrl || '',
      notas: notas || ''
    })

    await gasto.save()

    // Generar asiento contable automáticamente
    try {
      const asiento = await contabilidadService.asientoEgresoOPEX({
        gastoId: gasto._id,
        concepto,
        categoria,
        monto,
        fecha: gasto.fechaGasto,
        creadoPor: req.usuario.id
      })

      await GastoOperativo.findByIdAndUpdate(gasto._id, {
        asientoGenerado: true,
        asientoId: asiento._id || null
      })
    } catch (asientoErr) {
      console.warn('Error generando asiento del gasto:', asientoErr.message)
      // No fallar; el gasto se guardó, el asiento se puede regenerar después
    }

    res.json({ gasto: gasto.toObject(), mensaje: 'Gasto registrado' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
