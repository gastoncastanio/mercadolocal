import { Router } from 'express'
import { tokenOpcional } from '../middleware/auth.js'
import Producto from '../models/Producto.js'
import { resolverIdentidad, registrarVista, registrarBusqueda, recomendarParaCliente } from '../services/targetingService.js'

const router = Router()

/**
 * Rutas de SEÑALES DE INTERÉS (pauta inteligente).
 * Funcionan para clientes logueados y anónimos (id en header 'x-anon-id').
 * Son fire-and-forget: responden rápido y registran en segundo plano. Nunca
 * deben frenar la navegación ni romper si falla el tracking.
 */

// POST /api/senales/vista  { productoId }
// Registra que el cliente vio el detalle de un producto.
router.post('/vista', tokenOpcional, async (req, res) => {
  // Respondemos ya; el registro va en segundo plano.
  res.json({ ok: true })

  try {
    const identity = resolverIdentidad(req)
    if (!identity.usuarioId && !identity.anonId) return
    const { productoId } = req.body || {}
    if (!productoId) return
    const producto = await Producto.findById(productoId).select('categorias ciudad precio').lean()
    if (producto) {
      producto._id = productoId
      await registrarVista(identity, producto)
    }
  } catch {
    // tracking nunca debe romper
  }
})

// POST /api/senales/busqueda  { termino, categoria }
// Registra una búsqueda o navegación por categoría.
router.post('/busqueda', tokenOpcional, async (req, res) => {
  res.json({ ok: true })

  try {
    const identity = resolverIdentidad(req)
    if (!identity.usuarioId && !identity.anonId) return
    const { termino, categoria } = req.body || {}
    if (!termino && !categoria) return
    await registrarBusqueda(identity, termino, categoria)
  } catch {
    // noop
  }
})

// GET /api/senales/para-vos
// Recomendaciones personalizadas + "Seguí viendo" según el historial del cliente
// (logueado o anónimo vía x-anon-id). Es la cara visible del algoritmo de intención.
router.get('/para-vos', tokenOpcional, async (req, res) => {
  try {
    const identity = resolverIdentidad(req)
    const limite = Math.min(24, Math.max(4, Number(req.query.limite) || 12))
    const data = await recomendarParaCliente(identity, { limite })
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
