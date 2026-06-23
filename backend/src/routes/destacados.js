import { Router } from 'express'
import { verificarToken, soloTieneVendedor, soloAdmin, tokenOpcional } from '../middleware/auth.js'
import Destacado from '../models/Destacado.js'
import Tienda from '../models/Tienda.js'
import {
  obtenerPlanes,
  guardarPrecios,
  crearPautaMercadoPago,
  crearPautaSaldo,
  obtenerPlanesTienda,
  guardarPreciosTienda,
  crearPautaTiendaMercadoPago,
  crearPautaTiendaSaldo,
  infoCreditoPauta
} from '../services/pautaService.js'
import {
  resolverIdentidad,
  obtenerPerfil,
  ordenarDestacadosPorRelevancia,
  registrarAudienciaClick
} from '../services/targetingService.js'

const router = Router()

// GET /api/destacados/planes - Planes y precios (editables por admin)
router.get('/planes', async (_req, res) => {
  try {
    res.json(await obtenerPlanes())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/destacados/planes-tienda - Planes de publicidad de TIENDA (plan "Marca")
router.get('/planes-tienda', async (_req, res) => {
  try {
    res.json(await obtenerPlanesTienda())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/destacados/credito - Crédito de publicidad del vendedor (para el flujo)
router.get('/credito', verificarToken, soloTieneVendedor, async (req, res) => {
  try {
    res.json(await infoCreditoPauta(req.usuario.id))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/destacados/activos - Productos destacados activos (público)
// Usado por banners y espacios publicitarios de la home.
router.get('/activos', tokenOpcional, async (req, res) => {
  try {
    const ahora = new Date()
    const { ubicacion, ciudad, categoria } = req.query

    const filtro = {
      activo: true,
      estado: 'activo',
      fechaFin: { $gt: ahora },
      fechaInicio: { $lte: ahora }
    }
    if (ubicacion) filtro.ubicacion = ubicacion

    // Respetar segmentación: si la pauta está segmentada por ciudad/categoría,
    // solo se muestra cuando coincide (o cuando no se filtra por eso).
    if (ciudad) {
      filtro.$or = [{ segmentoCiudad: '' }, { segmentoCiudad: ciudad }]
    } else {
      // Sin contexto de ciudad: no mostrar las que están segmentadas a una ciudad puntual
      filtro.segmentoCiudad = ''
    }

    let destacados = await Destacado.find(filtro)
      .populate({
        path: 'productoId',
        populate: { path: 'tiendaId', select: 'nombre ciudad logo calificacion totalVentas' }
      })
      // Para anuncios de TIENDA (sin producto): poblamos la tienda directo, así
      // el front arma el creativo (logo + nombre) y linkea a /tienda/:id.
      .populate('tiendaId', 'nombre nombreCorto ciudad logo portada calificacion totalVentas oficial')
      .sort({ plan: -1, createdAt: -1 })
      .limit(40)

    // Filtro de categoría (a nivel app porque depende del producto poblado)
    if (categoria) {
      destacados = destacados.filter(d =>
        !d.segmentoCategoria || d.segmentoCategoria === categoria
      )
    }

    // Ordenar por RELEVANCIA para este cliente (pauta inteligente) y recortar
    const identity = resolverIdentidad(req)
    const perfil = await obtenerPerfil(identity)
    destacados = ordenarDestacadosPorRelevancia(destacados, perfil).slice(0, 20)

    // Incrementar impresiones
    const ids = destacados.map(d => d._id)
    if (ids.length > 0) {
      await Destacado.updateMany({ _id: { $in: ids } }, { $inc: { impresiones: 1 } })
    }

    res.json(destacados)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/destacados/click/:id - Registrar click en destacado
router.post('/click/:id', tokenOpcional, async (req, res) => {
  try {
    await Destacado.findByIdAndUpdate(req.params.id, { $inc: { clicks: 1 } })
    // Sumar la categoría/ciudad del que hizo clic a la audiencia del anuncio
    // (métricas para el vendedor). No bloquea la respuesta.
    registrarAudienciaClick(req.params.id, resolverIdentidad(req)).catch(() => {})
    res.json({ ok: true })
  } catch {
    res.status(400).json({ error: 'Error registrando click' })
  }
})

// GET /api/destacados/mis-promociones - Promociones del vendedor
router.get('/mis-promociones', verificarToken, soloTieneVendedor, async (req, res) => {
  try {
    const tienda = await Tienda.findOne({ usuarioId: req.usuario.id })
    if (!tienda) return res.status(404).json({ error: 'Tienda no encontrada' })

    const promociones = await Destacado.find({ tiendaId: tienda._id })
      .populate('productoId', 'nombre precio imagenes')
      .sort({ createdAt: -1 })

    res.json(promociones)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Mapea los códigos de error del servicio a respuestas HTTP claras
function responderErrorPauta(res, error) {
  const map = {
    PLAN_INVALIDO: 400, DURACION_INVALIDA: 400, SIN_TIENDA: 404,
    PRODUCTO_INVALIDO: 404, YA_PROMOCIONADO: 400, SALDO_INSUFICIENTE: 400,
    SIN_MP: 400, NETEO_DESHABILITADO: 400, CREDITO_INSUFICIENTE: 400
  }
  const status = map[error.code] || 500
  if (status === 500) console.error('Error en pauta:', error)
  return res.status(status).json({ error: error.message, code: error.code })
}

// POST /api/destacados - Crear promoción (pago con Mercado Pago o con saldo)
// Body: { productoId, plan, duracionDias, metodoPago, segmentoCiudad?, segmentoCategoria?, puja? }
router.post('/', verificarToken, soloTieneVendedor, async (req, res) => {
  try {
    const { productoId, plan, duracionDias, metodoPago, segmentoCiudad, segmentoCategoria, puja } = req.body
    const args = {
      usuarioId: req.usuario.id,
      productoId, plan, duracionDias, metodoPago, segmentoCiudad, segmentoCategoria, puja
    }

    // Pago con Mercado Pago (dinero real → cuenta de la plataforma)
    if (metodoPago === 'mercadopago') {
      const { destacado, initPoint } = await crearPautaMercadoPago(args)
      return res.status(201).json({
        metodoPago: 'mercadopago',
        destacadoId: destacado._id,
        initPoint,
        mensaje: 'Te llevamos a Mercado Pago para completar el pago.'
      })
    }

    // Pago con saldo acumulado (activa al instante)
    const { destacado, planInfo } = await crearPautaSaldo(args)
    return res.status(201).json({
      metodoPago: 'saldo',
      destacado,
      mensaje: `Producto promocionado con plan ${planInfo.nombre} por ${destacado.duracionDias} días. Se descontaron $${destacado.precioTotal.toLocaleString('es-AR')} de tu saldo.`
    })
  } catch (error) {
    return responderErrorPauta(res, error)
  }
})

// POST /api/destacados/tienda - Crear publicidad de TIENDA (marca en banner/home/marcas)
// Body: { plan, duracionDias, metodoPago, puja? }  (sin productoId)
router.post('/tienda', verificarToken, soloTieneVendedor, async (req, res) => {
  try {
    const { plan, duracionDias, metodoPago, puja } = req.body
    const args = { usuarioId: req.usuario.id, plan: plan || 'marca', duracionDias, metodoPago, puja }

    if (metodoPago === 'mercadopago') {
      const { destacado, initPoint } = await crearPautaTiendaMercadoPago(args)
      return res.status(201).json({
        metodoPago: 'mercadopago',
        destacadoId: destacado._id,
        initPoint,
        mensaje: 'Te llevamos a Mercado Pago para completar el pago.'
      })
    }

    const { destacado, planInfo } = await crearPautaTiendaSaldo(args)
    return res.status(201).json({
      metodoPago: 'saldo',
      destacado,
      mensaje: `Tu tienda se está promocionando con el plan ${planInfo.nombre} por ${destacado.duracionDias} días. Se descontaron $${destacado.precioTotal.toLocaleString('es-AR')} de tu saldo.`
    })
  } catch (error) {
    return responderErrorPauta(res, error)
  }
})

// DELETE /api/destacados/:id - Cancelar promoción (no reembolsa)
router.delete('/:id', verificarToken, soloTieneVendedor, async (req, res) => {
  try {
    const destacado = await Destacado.findById(req.params.id)
    if (!destacado) return res.status(404).json({ error: 'Promoción no encontrada' })
    if (destacado.vendedorId.toString() !== req.usuario.id) {
      return res.status(403).json({ error: 'No tenés permiso' })
    }

    destacado.estado = 'cancelado'
    destacado.activo = false
    await destacado.save()

    res.json({ mensaje: 'Promoción cancelada' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ===================== ADMIN =====================

// GET /api/destacados/admin/stats - Estadísticas de publicidad
router.get('/admin/stats', verificarToken, soloAdmin, async (req, res) => {
  try {
    const todas = await Destacado.find()
    const ahora = new Date()
    const activas = todas.filter(d => d.activo && d.estado === 'activo' && d.fechaFin > ahora)

    // Solo cuentan como ingreso las pautas efectivamente cobradas:
    // las pagadas con saldo, y las de MP que se confirmaron (no pendientes/canceladas).
    const cobradas = todas.filter(d =>
      d.metodoPago === 'saldo' || (d.metodoPago === 'mercadopago' && d.mpStatus === 'approved')
    )
    const ingresosTotales = cobradas.reduce((sum, d) => sum + d.precioTotal, 0)
    const ingresosMes = cobradas
      .filter(d => d.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      .reduce((sum, d) => sum + d.precioTotal, 0)
    const ingresosMercadoPago = cobradas
      .filter(d => d.metodoPago === 'mercadopago')
      .reduce((sum, d) => sum + d.precioTotal, 0)
    const ingresosSaldo = cobradas
      .filter(d => d.metodoPago === 'saldo')
      .reduce((sum, d) => sum + d.precioTotal, 0)

    const totalImpresiones = todas.reduce((sum, d) => sum + d.impresiones, 0)
    const totalClicks = todas.reduce((sum, d) => sum + d.clicks, 0)
    const ctr = totalImpresiones > 0 ? ((totalClicks / totalImpresiones) * 100).toFixed(2) : 0

    const porPlan = {
      basico: todas.filter(d => d.plan === 'basico').length,
      premium: todas.filter(d => d.plan === 'premium').length,
      elite: todas.filter(d => d.plan === 'elite').length
    }

    res.json({
      promocionesActivas: activas.length,
      promocionesTotales: todas.length,
      pendientesPago: todas.filter(d => d.estado === 'pendiente').length,
      ingresosTotales,
      ingresosMes,
      ingresosMercadoPago,
      ingresosSaldo,
      totalImpresiones,
      totalClicks,
      ctr: `${ctr}%`,
      porPlan
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/destacados/admin/campanas - Lista de campañas para el panel de pauta
router.get('/admin/campanas', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { estado } = req.query
    const filtro = {}
    if (estado && estado !== 'todas') filtro.estado = estado

    const campanas = await Destacado.find(filtro)
      .populate('productoId', 'nombre precio imagenes')
      .populate('tiendaId', 'nombre ciudad')
      .sort({ createdAt: -1 })
      .limit(200)

    res.json(campanas)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/destacados/admin/precios - Precios actuales (para editar)
router.get('/admin/precios', verificarToken, soloAdmin, async (_req, res) => {
  try {
    res.json(await obtenerPlanes())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/destacados/admin/precios - Guardar precios editados
// Body: { basico: {3,7,15,30}, premium: {...}, elite: {...} }
router.put('/admin/precios', verificarToken, soloAdmin, async (req, res) => {
  try {
    const planes = await guardarPrecios(req.body || {})
    res.json({ mensaje: 'Precios actualizados', planes })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/destacados/admin/precios-tienda - Precios del plan "Marca" (para editar)
router.get('/admin/precios-tienda', verificarToken, soloAdmin, async (_req, res) => {
  try {
    res.json(await obtenerPlanesTienda())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/destacados/admin/precios-tienda - Guardar precios del plan "Marca"
// Body: { marca: {7,15,30} }
router.put('/admin/precios-tienda', verificarToken, soloAdmin, async (req, res) => {
  try {
    const planes = await guardarPreciosTienda(req.body || {})
    res.json({ mensaje: 'Precios de tienda actualizados', planes })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
