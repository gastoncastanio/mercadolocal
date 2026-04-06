import { Router } from 'express'
import { verificarToken, soloVendedor } from '../middleware/auth.js'
import { crearOrden, ordenesDelComprador, ordenesDelVendedor, actualizarEstadoOrden } from '../services/ordenService.js'
import { obtenerMiTienda } from '../services/tiendaService.js'

const router = Router()

// POST /api/ordenes/crear - Crear orden desde carrito
router.post('/crear', verificarToken, async (req, res) => {
  try {
    const { direccion, notas, nombre, telefono } = req.body
    if (!direccion) {
      return res.status(400).json({ error: 'La dirección de entrega es obligatoria' })
    }
    const orden = await crearOrden(req.usuario.id, { direccion, notas, nombre, telefono })
    res.status(201).json(orden)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/ordenes - Ver mis órdenes (comprador)
router.get('/', verificarToken, async (req, res) => {
  try {
    const ordenes = await ordenesDelComprador(req.usuario.id)
    res.json(ordenes)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/ordenes/vendedor - Ver órdenes recibidas (vendedor)
router.get('/vendedor', verificarToken, soloVendedor, async (req, res) => {
  try {
    const tienda = await obtenerMiTienda(req.usuario.id)
    if (!tienda) {
      return res.status(400).json({ error: 'No tienes una tienda' })
    }
    const ordenes = await ordenesDelVendedor(tienda._id)
    res.json(ordenes)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/ordenes/:ordenId/estado - Actualizar estado (vendedor)
router.put('/:ordenId/estado', verificarToken, soloVendedor, async (req, res) => {
  try {
    const { estado } = req.body
    const tienda = await obtenerMiTienda(req.usuario.id)
    if (!tienda) {
      return res.status(400).json({ error: 'No tienes una tienda' })
    }
    const orden = await actualizarEstadoOrden(req.params.ordenId, estado, tienda._id)
    res.json(orden)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

export default router
