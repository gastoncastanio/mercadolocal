import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import { obtenerCarrito, agregarAlCarrito, actualizarCantidad, eliminarDelCarrito, vaciarCarrito, calcularTotal } from '../services/carritoService.js'

const router = Router()

// GET /api/carrito - Ver mi carrito
router.get('/', verificarToken, async (req, res) => {
  try {
    const carrito = await obtenerCarrito(req.usuario.id)
    const total = calcularTotal(carrito)
    res.json({ carrito, total })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/carrito - Agregar al carrito
router.post('/', verificarToken, async (req, res) => {
  try {
    const { productoId, cantidad } = req.body
    if (!productoId) {
      return res.status(400).json({ error: 'productoId es obligatorio' })
    }
    const carrito = await agregarAlCarrito(req.usuario.id, productoId, cantidad || 1)
    const total = calcularTotal(carrito)
    res.json({ carrito, total })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PUT /api/carrito/:itemId - Actualizar cantidad
router.put('/:itemId', verificarToken, async (req, res) => {
  try {
    const { cantidad } = req.body
    const carrito = await actualizarCantidad(req.usuario.id, req.params.itemId, cantidad)
    const total = calcularTotal(carrito)
    res.json({ carrito, total })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// DELETE /api/carrito/:itemId - Eliminar del carrito
router.delete('/:itemId', verificarToken, async (req, res) => {
  try {
    const carrito = await eliminarDelCarrito(req.usuario.id, req.params.itemId)
    const total = calcularTotal(carrito)
    res.json({ carrito, total })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// DELETE /api/carrito - Vaciar carrito
router.delete('/', verificarToken, async (req, res) => {
  try {
    const carrito = await vaciarCarrito(req.usuario.id)
    res.json({ carrito, total: 0 })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

export default router
