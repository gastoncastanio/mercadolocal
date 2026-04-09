import { Router } from 'express'
import { verificarToken, soloVendedor, soloAdmin } from '../middleware/auth.js'
import Destacado from '../models/Destacado.js'
import Producto from '../models/Producto.js'
import Tienda from '../models/Tienda.js'

const router = Router()

// Planes disponibles con precios y ubicaciones
const PLANES = {
  basico: {
    nombre: 'B\u00e1sico',
    ubicacion: ['catalogo', 'busqueda'],
    precios: { 3: 1500, 7: 3000, 15: 5500, 30: 9000 },
    descripcion: 'Tu producto aparece primero en el cat\u00e1logo y b\u00fasquedas'
  },
  premium: {
    nombre: 'Premium',
    ubicacion: ['catalogo', 'busqueda', 'publicidad'],
    precios: { 3: 3000, 7: 6000, 15: 10000, 30: 17000 },
    descripcion: 'Cat\u00e1logo + b\u00fasquedas + espacios publicitarios en la p\u00e1gina principal'
  },
  elite: {
    nombre: 'Elite',
    ubicacion: ['catalogo', 'busqueda', 'publicidad', 'banner'],
    precios: { 3: 5000, 7: 9000, 15: 16000, 30: 28000 },
    descripcion: 'M\u00e1xima visibilidad: banner principal + cat\u00e1logo + publicidad + b\u00fasquedas'
  }
}

// GET /api/destacados/planes - Obtener planes y precios
router.get('/planes', (req, res) => {
  res.json(PLANES)
})

// GET /api/destacados/activos - Productos destacados activos (p\u00fablico)
router.get('/activos', async (req, res) => {
  try {
    const ahora = new Date()
    const { ubicacion } = req.query

    const filtro = {
      activo: true,
      estado: 'activo',
      fechaFin: { $gt: ahora },
      fechaInicio: { $lte: ahora }
    }

    if (ubicacion) {
      filtro.ubicacion = ubicacion
    }

    const destacados = await Destacado.find(filtro)
      .populate({
        path: 'productoId',
        populate: { path: 'tiendaId', select: 'nombre ciudad logo calificacion totalVentas' }
      })
      .sort({ plan: -1, createdAt: -1 })
      .limit(20)

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
router.post('/click/:id', async (req, res) => {
  try {
    await Destacado.findByIdAndUpdate(req.params.id, { $inc: { clicks: 1 } })
    res.json({ ok: true })
  } catch {
    res.status(400).json({ error: 'Error registrando click' })
  }
})

// GET /api/destacados/mis-promociones - Promociones del vendedor
router.get('/mis-promociones', verificarToken, soloVendedor, async (req, res) => {
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

// POST /api/destacados - Crear promoci\u00f3n
router.post('/', verificarToken, soloVendedor, async (req, res) => {
  try {
    const { productoId, plan, duracionDias } = req.body

    // Validar plan
    if (!PLANES[plan]) {
      return res.status(400).json({ error: 'Plan no v\u00e1lido' })
    }

    const planInfo = PLANES[plan]

    // Validar duraci\u00f3n
    if (!planInfo.precios[duracionDias]) {
      return res.status(400).json({ error: 'Duraci\u00f3n no disponible para este plan' })
    }

    // Validar que el producto pertenece al vendedor
    const tienda = await Tienda.findOne({ usuarioId: req.usuario.id })
    if (!tienda) return res.status(404).json({ error: 'Tienda no encontrada' })

    const producto = await Producto.findOne({ _id: productoId, tiendaId: tienda._id, activo: true })
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado o no te pertenece' })

    // Verificar si ya tiene promoci\u00f3n activa
    const promoExistente = await Destacado.findOne({
      productoId,
      activo: true,
      estado: 'activo',
      fechaFin: { $gt: new Date() }
    })
    if (promoExistente) {
      return res.status(400).json({ error: 'Este producto ya tiene una promoci\u00f3n activa' })
    }

    const precioTotal = planInfo.precios[duracionDias]
    const fechaFin = new Date()
    fechaFin.setDate(fechaFin.getDate() + duracionDias)

    // Descontar del saldo de la tienda (ganancias acumuladas)
    if (tienda.ganancias < precioTotal) {
      return res.status(400).json({
        error: `Saldo insuficiente. Ten\u00e9s $${tienda.ganancias.toLocaleString('es-AR')} y el plan cuesta $${precioTotal.toLocaleString('es-AR')}. Necesit\u00e1s m\u00e1s ventas para acumular saldo.`
      })
    }

    tienda.ganancias -= precioTotal
    await tienda.save()

    const destacado = new Destacado({
      productoId,
      tiendaId: tienda._id,
      vendedorId: req.usuario.id,
      plan,
      ubicacion: planInfo.ubicacion,
      duracionDias,
      precioTotal,
      fechaFin,
      estado: 'activo'
    })

    await destacado.save()

    console.log(`\u2B50 Nueva promoci\u00f3n: ${producto.nombre} - Plan ${plan} (${duracionDias} d\u00edas) - $${precioTotal}`)

    res.status(201).json({
      destacado,
      mensaje: `Producto promocionado con plan ${planInfo.nombre} por ${duracionDias} d\u00edas. Se descontaron $${precioTotal.toLocaleString('es-AR')} de tu saldo.`
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/destacados/:id - Cancelar promoci\u00f3n (no reembolsa)
router.delete('/:id', verificarToken, soloVendedor, async (req, res) => {
  try {
    const destacado = await Destacado.findById(req.params.id)
    if (!destacado) return res.status(404).json({ error: 'Promoci\u00f3n no encontrada' })
    if (destacado.vendedorId.toString() !== req.usuario.id) {
      return res.status(403).json({ error: 'No ten\u00e9s permiso' })
    }

    destacado.estado = 'cancelado'
    destacado.activo = false
    await destacado.save()

    res.json({ mensaje: 'Promoci\u00f3n cancelada' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/destacados/admin/stats - Estad\u00edsticas de publicidad (admin)
router.get('/admin/stats', verificarToken, soloAdmin, async (req, res) => {
  try {
    const todas = await Destacado.find()
    const activas = todas.filter(d => d.activo && d.estado === 'activo' && d.fechaFin > new Date())

    const ingresosTotales = todas.reduce((sum, d) => sum + d.precioTotal, 0)
    const ingresosMes = todas
      .filter(d => d.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
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
      ingresosTotales,
      ingresosMes,
      totalImpresiones,
      totalClicks,
      ctr: `${ctr}%`,
      porPlan
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
