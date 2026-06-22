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
    const { tipo, desde, hasta } = req.query

    // Saneamiento de paginación: enteros válidos, con tope máximo (anti-DoS).
    const TIPOS_VALIDOS = AsientoContable.schema.path('tipo').enumValues
    let limit = parseInt(req.query.limit, 10)
    if (!Number.isFinite(limit) || limit <= 0) limit = 50
    limit = Math.min(limit, 200)
    let skip = parseInt(req.query.skip, 10)
    if (!Number.isFinite(skip) || skip < 0) skip = 0

    const filtro = {}
    if (tipo && TIPOS_VALIDOS.includes(tipo)) filtro.tipo = tipo
    if (desde || hasta) {
      filtro.fechaContable = {}
      const d = desde ? new Date(desde) : null
      const h = hasta ? new Date(hasta) : null
      if (d && !isNaN(d.getTime())) filtro.fechaContable.$gte = d
      if (h && !isNaN(h.getTime())) filtro.fechaContable.$lte = h
      if (Object.keys(filtro.fechaContable).length === 0) delete filtro.fechaContable
    }

    const asientos = await AsientoContable.find(filtro)
      .sort({ fechaContable: -1 })
      .limit(limit)
      .skip(skip)
      .lean()

    const total = await AsientoContable.countDocuments(filtro)

    res.json({
      total,
      asientos,
      pagina: Math.floor(skip / limit) + 1,
      porPagina: limit
    })
  } catch (error) {
    console.error('Error en GET /asientos:', error)
    res.status(500).json({ error: 'No se pudieron obtener los asientos' })
  }
})

/**
 * POST /api/contador/gasto
 * Carga manual de OPEX (pauta, hosting, honorarios)
 */
router.post('/gasto', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { categoria, concepto, monto, fechaGasto, comprobanteUrl, notas } = req.body

    // Validación estricta: es plata que entra al libro mayor.
    const CATEGORIAS = ['marketing', 'hosting', 'honorarios', 'infraestructura', 'otro']
    if (!categoria || !CATEGORIAS.includes(categoria)) {
      return res.status(400).json({ error: `Categoría inválida. Usá una de: ${CATEGORIAS.join(', ')}` })
    }
    if (typeof concepto !== 'string' || concepto.trim().length < 2 || concepto.length > 200) {
      return res.status(400).json({ error: 'El concepto debe tener entre 2 y 200 caracteres' })
    }
    const montoNum = Number(monto)
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      return res.status(400).json({ error: 'El monto debe ser un número mayor a 0' })
    }
    if (montoNum > 1e12) {
      return res.status(400).json({ error: 'El monto es demasiado grande' })
    }
    const fecha = new Date(fechaGasto)
    if (isNaN(fecha.getTime())) {
      return res.status(400).json({ error: 'Fecha inválida' })
    }
    // No permitir fechas futuras (más de 1 día de margen por husos horarios)
    if (fecha.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: 'La fecha del gasto no puede ser futura' })
    }
    if (notas !== undefined && (typeof notas !== 'string' || notas.length > 1000)) {
      return res.status(400).json({ error: 'Notas demasiado largas' })
    }

    const conceptoLimpio = concepto.trim()
    const montoRedondeado = Math.round(montoNum * 100) / 100

    const gasto = new GastoOperativo({
      categoria,
      concepto: conceptoLimpio,
      monto: montoRedondeado,
      fechaGasto: fecha,
      cargadoPor: req.usuario.id,
      comprobanteUrl: typeof comprobanteUrl === 'string' ? comprobanteUrl : '',
      notas: typeof notas === 'string' ? notas : ''
    })

    await gasto.save()

    // Generar asiento contable automáticamente
    try {
      const asiento = await contabilidadService.asientoEgresoOPEX({
        gastoId: gasto._id,
        concepto: conceptoLimpio,
        categoria,
        monto: montoRedondeado,
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
    console.error('Error en POST /gasto:', error)
    res.status(500).json({ error: 'No se pudo registrar el gasto' })
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

/** GET /api/contador/conciliacion-mp — reconstrucción del mayor vs saldo real de MP */
router.get('/conciliacion-mp', verificarToken, soloAdmin, async (req, res) => {
  try {
    res.json(await reportesService.seccionConciliacionMP())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/** POST /api/contador/conciliacion-mp — cargar a mano el saldo real de MP */
router.post('/conciliacion-mp', verificarToken, soloAdmin, async (req, res) => {
  try {
    await reportesService.guardarSaldoMPManual(req.body.saldoMP)
    res.json(await reportesService.seccionConciliacionMP())
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

export default router
