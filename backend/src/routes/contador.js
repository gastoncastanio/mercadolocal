import { Router } from 'express'
import { verificarToken, soloAdmin } from '../middleware/auth.js'
import CuentaContable from '../models/CuentaContable.js'
import AsientoContable from '../models/AsientoContable.js'
import GastoOperativo from '../models/GastoOperativo.js'
import ResumenDiarioContable from '../models/ResumenDiarioContable.js'
import * as contabilidadService from '../services/contabilidadService.js'
import * as reportesService from '../services/reportesContablesService.js'

const router = Router()

// Parsea {anio, mes} de la query (mes 1-12 → 0-11). Si no vienen, mes actual.
function parsearPeriodo(query) {
  const out = {}
  if (query.anio) out.anio = parseInt(query.anio)
  if (query.mes) out.mes = parseInt(query.mes) - 1 // 1-12 → 0-11
  return out
}

/**
 * POST /api/contador/init-plan-cuentas
 * Admin: Seed del plan de cuentas (SOLO primera vez)
 */
router.post('/init-plan-cuentas', verificarToken, soloAdmin, async (req, res) => {
  try {
    const resultado = await contabilidadService.seedPlanCuentas()
    res.json({
      mensaje: 'Plan de cuentas inicializado',
      creadas: resultado.creadas,
      actualizadas: resultado.existentes
    })
  } catch (error) {
    console.error('Error inicializando plan de cuentas:', error)
    res.status(500).json({ error: 'No se pudo inicializar el plan de cuentas' })
  }
})

/**
 * POST /api/contador/backfill
 * Importa el histórico: genera asientos retroactivos desde auditoría + comprobantes.
 * Idempotente (no duplica). Pensado para el botón de "Importar histórico".
 */
router.post('/backfill', verificarToken, soloAdmin, async (req, res) => {
  try {
    const resultado = await contabilidadService.backfillAsientos()
    res.json({ mensaje: 'Histórico importado', ...resultado })
  } catch (error) {
    console.error('Error en POST /backfill:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/contador/estado-setup
 * Indica si el sistema contable ya está inicializado (plan de cuentas + asientos).
 */
router.get('/estado-setup', verificarToken, soloAdmin, async (req, res) => {
  try {
    const cuentas = await CuentaContable.countDocuments()
    const asientos = await AsientoContable.estimatedDocumentCount()
    res.json({
      planInicializado: cuentas > 0,
      cantidadCuentas: cuentas,
      cantidadAsientos: asientos
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/contador/resumen
 * Resumen financiero del mes actual
 */
router.get('/resumen', verificarToken, soloAdmin, async (req, res) => {
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
router.get('/cuadre', verificarToken, soloAdmin, async (req, res) => {
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
router.get('/asientos', verificarToken, soloAdmin, async (req, res) => {
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
router.post('/gasto', verificarToken, soloAdmin, async (req, res) => {
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

// ===== FASE 3: Las 7 secciones del panel =====

/**
 * GET /api/contador/panel?anio=&mes=
 * Devuelve las 7 secciones de una sola vez (para el dashboard).
 */
router.get('/panel', verificarToken, soloAdmin, async (req, res) => {
  try {
    const panel = await reportesService.panelCompleto(parsearPeriodo(req.query))
    res.json(panel)
  } catch (error) {
    console.error('Error en GET /panel:', error)
    res.status(500).json({ error: error.message })
  }
})

/** GET /api/contador/facturacion?anio=&mes= */
router.get('/facturacion', verificarToken, soloAdmin, async (req, res) => {
  try {
    res.json(await reportesService.seccionFacturacion(parsearPeriodo(req.query)))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/** GET /api/contador/margen-bruto?anio=&mes= */
router.get('/margen-bruto', verificarToken, soloAdmin, async (req, res) => {
  try {
    res.json(await reportesService.seccionMargenBruto(parsearPeriodo(req.query)))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/** GET /api/contador/rentabilidad?anio=&mes= */
router.get('/rentabilidad', verificarToken, soloAdmin, async (req, res) => {
  try {
    res.json(await reportesService.seccionRentabilidad(parsearPeriodo(req.query)))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/** GET /api/contador/break-even?anio=&mes= */
router.get('/break-even', verificarToken, soloAdmin, async (req, res) => {
  try {
    res.json(await reportesService.seccionBreakEven(parsearPeriodo(req.query)))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/** GET /api/contador/cash-flow */
router.get('/cash-flow', verificarToken, soloAdmin, async (req, res) => {
  try {
    res.json(await reportesService.seccionCashFlow())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/** GET /api/contador/por-cobrar */
router.get('/por-cobrar', verificarToken, soloAdmin, async (req, res) => {
  try {
    res.json(await reportesService.seccionPorCobrar())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/** GET /api/contador/por-pagar?anio=&mes= */
router.get('/por-pagar', verificarToken, soloAdmin, async (req, res) => {
  try {
    res.json(await reportesService.seccionPorPagar(parsearPeriodo(req.query)))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/contador/config — config contable (costos fijos, régimen fiscal)
 * PUT /api/contador/config — actualizar config
 */
router.get('/config', verificarToken, soloAdmin, async (req, res) => {
  try {
    res.json(await reportesService.obtenerConfigContable())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.put('/config', verificarToken, soloAdmin, async (req, res) => {
  try {
    const actualizada = await reportesService.guardarConfigContable(req.body)
    res.json({ mensaje: 'Configuración actualizada', config: actualizada })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
