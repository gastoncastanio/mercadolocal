import { Router } from 'express'
import { verificarToken, soloAdmin } from '../middleware/auth.js'
import { todasLasOrdenes, estadisticasAdmin } from '../services/ordenService.js'
import { listarTiendas } from '../services/tiendaService.js'
import Producto from '../models/Producto.js'
import Usuario from '../models/Usuario.js'

const router = Router()

// POST /api/admin/seed - Hacer admin a un usuario por email
router.post('/seed', async (req, res) => {
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

export default router
