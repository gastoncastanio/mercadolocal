import { Router } from 'express'
import { verificarToken, soloVendedor } from '../middleware/auth.js'
import { crearResena, resenasDeProducto, responderResena } from '../services/resenaService.js'

const router = Router()

// POST /api/resenas - Crear resena
router.post('/', verificarToken, async (req, res) => {
  try {
    const { productoId, ordenId, calificacion, comentario } = req.body
    if (!productoId || !ordenId || !calificacion) {
      return res.status(400).json({ error: 'productoId, ordenId y calificacion son obligatorios' })
    }
    const resena = await crearResena(req.usuario.id, { productoId, ordenId, calificacion, comentario })
    res.status(201).json(resena)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/resenas/producto/:productoId - Resenas de un producto (publico)
router.get('/producto/:productoId', async (req, res) => {
  try {
    const resenas = await resenasDeProducto(req.params.productoId)
    res.json(resenas)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/resenas/:resenaId/respuesta - Responder resena (vendedor)
router.post('/:resenaId/respuesta', verificarToken, soloVendedor, async (req, res) => {
  try {
    const { respuesta } = req.body
    if (!respuesta) {
      return res.status(400).json({ error: 'La respuesta es obligatoria' })
    }
    const resena = await responderResena(req.params.resenaId, req.usuario.id, respuesta)
    res.json(resena)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

export default router
