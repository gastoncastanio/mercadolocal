import { Router } from 'express'
import { verificarToken, soloVendedor, soloAdmin } from '../middleware/auth.js'
import { crearDisputa, disputasDelComprador, disputasDelVendedor, resolverDisputa, disputasPendientes } from '../services/disputaService.js'

const router = Router()

// POST /api/disputas - Crear disputa
router.post('/', verificarToken, async (req, res) => {
  try {
    const { ordenId, motivo, descripcion } = req.body
    if (!ordenId || !motivo || !descripcion) {
      return res.status(400).json({ error: 'ordenId, motivo y descripcion son obligatorios' })
    }
    const disputa = await crearDisputa(req.usuario.id, { ordenId, motivo, descripcion })
    res.status(201).json(disputa)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/disputas/mis-disputas - Disputas del comprador
router.get('/mis-disputas', verificarToken, async (req, res) => {
  try {
    const disputas = await disputasDelComprador(req.usuario.id)
    res.json(disputas)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/disputas/vendedor - Disputas del vendedor
router.get('/vendedor', verificarToken, soloVendedor, async (req, res) => {
  try {
    const disputas = await disputasDelVendedor(req.usuario.id)
    res.json(disputas)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/disputas/admin - Todas las disputas pendientes (admin)
router.get('/admin', verificarToken, soloAdmin, async (req, res) => {
  try {
    const disputas = await disputasPendientes()
    res.json(disputas)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/disputas/:disputaId/resolver - Resolver disputa (admin)
router.put('/:disputaId/resolver', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { resolucion, estadoFinal } = req.body
    if (!resolucion || !estadoFinal) {
      return res.status(400).json({ error: 'resolucion y estadoFinal son obligatorios' })
    }
    const disputa = await resolverDisputa(req.params.disputaId, resolucion, estadoFinal)
    res.json(disputa)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

export default router
