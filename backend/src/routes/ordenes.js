import { Router } from 'express'
import { verificarToken, soloVendedor } from '../middleware/auth.js'
import { crearOrden, ordenesDelComprador, ordenesDelVendedor, ordenesPendientesPago, actualizarEstadoOrden } from '../services/ordenService.js'
import { obtenerMiTienda } from '../services/tiendaService.js'
import { enviarRecordatorioCompra } from '../services/emailService.js'
import Usuario from '../models/Usuario.js'
import Orden from '../models/Orden.js'

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

// GET /api/ordenes/abandonadas - Órdenes pendientes de pago (carritos abandonados)
router.get('/abandonadas', verificarToken, soloVendedor, async (req, res) => {
  try {
    const tienda = await obtenerMiTienda(req.usuario.id)
    if (!tienda) {
      return res.status(400).json({ error: 'No tienes una tienda' })
    }
    const ordenes = await ordenesPendientesPago(tienda._id)
    res.json(ordenes)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/ordenes/recordatorio/:ordenId - Enviar email recordatorio al comprador
router.post('/recordatorio/:ordenId', verificarToken, soloVendedor, async (req, res) => {
  try {
    const tienda = await obtenerMiTienda(req.usuario.id)
    if (!tienda) {
      return res.status(400).json({ error: 'No tienes una tienda' })
    }

    const orden = await Orden.findById(req.params.ordenId)
    if (!orden) {
      return res.status(404).json({ error: 'Orden no encontrada' })
    }

    if (orden.estado !== 'pendiente') {
      return res.status(400).json({ error: 'Esta orden ya fue pagada' })
    }

    const tienePermiso = orden.items.some(
      item => item.tiendaId.toString() === tienda._id.toString()
    )
    if (!tienePermiso) {
      return res.status(403).json({ error: 'No autorizado' })
    }

    const comprador = await Usuario.findById(orden.compradorId)
    if (!comprador) {
      return res.status(404).json({ error: 'Comprador no encontrado' })
    }

    await enviarRecordatorioCompra(comprador.email, comprador.nombre, orden)
    res.json({ mensaje: 'Recordatorio enviado' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
