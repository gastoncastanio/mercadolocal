import { Router } from 'express'
import { verificarToken, soloAdmin } from '../middleware/auth.js'
import { todasLasOrdenes, estadisticasAdmin } from '../services/ordenService.js'
import { listarTiendas } from '../services/tiendaService.js'
import Producto from '../models/Producto.js'
import Usuario from '../models/Usuario.js'

const router = Router()

// POST /api/admin/seed - Hacer admin a un usuario por email (protegido)
router.post('/seed', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email requerido' })
    const usuario = await Usuario.findOneAndUpdate({ email }, { rol: 'admin' }, { new: true })
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json({ mensaje: `${usuario.nombre} ahora es administrador`, usuario: { nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/admin/dashboard
router.get('/dashboard', verificarToken, soloAdmin, async (req, res) => {
  try {
    const stats = await estadisticasAdmin()
    const totalProductos = await Producto.countDocuments({ activo: true })
    const totalUsuarios = await Usuario.countDocuments({ activo: true })
    const totalVendedores = await Usuario.countDocuments({ rol: 'vendedor', activo: true })
    const totalCompradores = await Usuario.countDocuments({ rol: 'comprador', activo: true })

    res.json({
      ...stats,
      totalProductos,
      totalUsuarios,
      totalVendedores,
      totalCompradores
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/admin/vendedores
router.get('/vendedores', verificarToken, soloAdmin, async (req, res) => {
  try {
    const tiendas = await listarTiendas()
    res.json(tiendas)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/admin/transacciones
router.get('/transacciones', verificarToken, soloAdmin, async (req, res) => {
  try {
    const ordenes = await todasLasOrdenes()
    res.json(ordenes)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/admin/usuarios
router.get('/usuarios', verificarToken, soloAdmin, async (req, res) => {
  try {
    const usuarios = await Usuario.find().select('-contraseña').sort({ createdAt: -1 })
    res.json(usuarios)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/admin/usuarios/:id/estado - Activar/Desactivar usuario
router.put('/usuarios/:id/estado', verificarToken, soloAdmin, async (req, res) => {
  try {
    const usuario = await Usuario.findByIdAndUpdate(
      req.params.id,
      { activo: req.body.activo },
      { new: true }
    ).select('-contraseña')
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json(usuario)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/admin/productos
router.get('/productos', verificarToken, soloAdmin, async (req, res) => {
  try {
    const productos = await Producto.find().populate('tiendaId', 'nombre ciudad').sort({ createdAt: -1 })
    res.json(productos)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/admin/productos/:id/estado - Activar/Desactivar producto
router.put('/productos/:id/estado', verificarToken, soloAdmin, async (req, res) => {
  try {
    const producto = await Producto.findByIdAndUpdate(
      req.params.id,
      { activo: req.body.activo },
      { new: true }
    )
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json(producto)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PUT /api/admin/ordenes/:id/estado - Cambiar estado de orden
router.put('/ordenes/:id/estado', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { default: Orden } = await import('../models/Orden.js')
    const orden = await Orden.findByIdAndUpdate(
      req.params.id,
      { estado: req.body.estado },
      { new: true }
    )
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' })
    res.json(orden)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/admin/ordenes-limpieza/preview
// Muestra qué orden se conservaría (la más reciente) y cuántas se borrarían.
// Es de solo lectura: no toca nada. Sirve para confirmar antes de ejecutar.
router.get('/ordenes-limpieza/preview', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { default: Orden } = await import('../models/Orden.js')
    const total = await Orden.countDocuments()
    // La que se conserva: la más reciente por fecha de creación
    const masReciente = await Orden.findOne().sort({ createdAt: -1 })

    res.json({
      totalOrdenes: total,
      seBorraran: Math.max(0, total - (masReciente ? 1 : 0)),
      seConserva: masReciente ? {
        id: masReciente._id,
        total: masReciente.total,
        estado: masReciente.estado,
        nombreComprador: masReciente.nombreComprador,
        fecha: masReciente.createdAt
      } : null
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/admin/ordenes-limpieza/ejecutar
// Borra TODAS las órdenes menos la más reciente (o la indicada en mantenerOrdenId)
// y recalcula los contadores denormalizados para que ningún número quede inflado.
// Requiere { confirmar: true } para evitar ejecuciones accidentales.
// NO toca el stock de productos (se verifica manualmente).
router.post('/ordenes-limpieza/ejecutar', verificarToken, soloAdmin, async (req, res) => {
  try {
    if (req.body?.confirmar !== true) {
      return res.status(400).json({ error: 'Falta confirmación explícita (confirmar: true)' })
    }

    const { default: Orden } = await import('../models/Orden.js')
    const { default: Tienda } = await import('../models/Tienda.js')
    const { default: AuditoriaFinanciera } = await import('../models/AuditoriaFinanciera.js')

    // Determinar la orden a conservar: la indicada, o la más reciente
    let ordenAConservar
    if (req.body.mantenerOrdenId) {
      ordenAConservar = await Orden.findById(req.body.mantenerOrdenId)
      if (!ordenAConservar) {
        return res.status(404).json({ error: 'La orden a conservar no existe' })
      }
    } else {
      ordenAConservar = await Orden.findOne().sort({ createdAt: -1 })
    }

    if (!ordenAConservar) {
      return res.json({ mensaje: 'No hay órdenes para limpiar', borradas: 0, conservada: null })
    }

    const idConservar = ordenAConservar._id.toString()

    // 1. Borrar todas las órdenes excepto la conservada
    const resultadoBorrado = await Orden.deleteMany({ _id: { $ne: ordenAConservar._id } })

    // 2. Limpiar auditoría financiera de las órdenes borradas
    await AuditoriaFinanciera.deleteMany({ ordenId: { $ne: ordenAConservar._id } }).catch(() => {})

    // 3. Recalcular contadores denormalizados desde las órdenes que quedan.
    //    Reseteamos a 0 y reaplicamos solo desde las órdenes pagadas restantes.
    await Tienda.updateMany({}, { $set: { totalVentas: 0, ganancias: 0 } })
    await Producto.updateMany({}, { $set: { totalVentas: 0 } })

    const ordenesRestantes = await Orden.find({
      estado: { $in: ['pagada', 'enviada', 'completada'] }
    })

    for (const orden of ordenesRestantes) {
      // Por tienda: +1 venta y +ganancia del subtotal de esa tienda (comisión 10%)
      const tiendaIds = [...new Set(orden.items.map(i => i.tiendaId.toString()))]
      for (const tiendaId of tiendaIds) {
        const itemsTienda = orden.items.filter(i => i.tiendaId.toString() === tiendaId)
        const subtotalTienda = itemsTienda.reduce((sum, i) => sum + i.subtotal, 0)
        const comisionTienda = Math.round(subtotalTienda * 0.10 * 100) / 100
        const gananciaTienda = subtotalTienda - comisionTienda
        await Tienda.findByIdAndUpdate(tiendaId, {
          $inc: { totalVentas: 1, ganancias: gananciaTienda }
        })
      }
      // Por producto: +cantidad vendida
      for (const item of orden.items) {
        await Producto.findByIdAndUpdate(item.productoId, {
          $inc: { totalVentas: item.cantidad }
        })
      }
    }

    res.json({
      mensaje: 'Historial limpiado correctamente',
      borradas: resultadoBorrado.deletedCount,
      conservada: {
        id: idConservar,
        total: ordenAConservar.total,
        estado: ordenAConservar.estado,
        nombreComprador: ordenAConservar.nombreComprador,
        fecha: ordenAConservar.createdAt
      },
      nota: 'El stock de productos no se modificó. Verificalo manualmente si hace falta.'
    })
  } catch (error) {
    console.error('Error limpiando órdenes:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
