import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import Favorito from '../models/Favorito.js'
import Producto from '../models/Producto.js'

const router = Router()

// GET /api/favoritos - Listar mis favoritos
router.get('/', verificarToken, async (req, res) => {
  try {
    const favoritos = await Favorito.find({ usuarioId: req.usuario.id })
      .populate({
        path: 'productoId',
        populate: { path: 'tiendaId', select: 'nombre ciudad logo' }
      })
      .sort({ createdAt: -1 })

    // Filtrar los que tengan producto vivo
    const productos = favoritos
      .filter(f => f.productoId && f.productoId.activo !== false)
      .map(f => f.productoId)

    res.json(productos)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/favoritos/ids - Solo IDs (para chequear rápido)
router.get('/ids', verificarToken, async (req, res) => {
  try {
    const favoritos = await Favorito.find({ usuarioId: req.usuario.id }).select('productoId')
    res.json(favoritos.map(f => f.productoId.toString()))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/favoritos/:productoId - Agregar a favoritos
router.post('/:productoId', verificarToken, async (req, res) => {
  try {
    const { productoId } = req.params

    const producto = await Producto.findById(productoId)
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' })

    try {
      const fav = await Favorito.create({ usuarioId: req.usuario.id, productoId })
      res.status(201).json({ mensaje: 'Agregado a favoritos', favorito: fav })
    } catch (e) {
      if (e.code === 11000) {
        return res.status(200).json({ mensaje: 'Ya estaba en favoritos' })
      }
      throw e
    }
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// DELETE /api/favoritos/:productoId - Quitar de favoritos
router.delete('/:productoId', verificarToken, async (req, res) => {
  try {
    await Favorito.findOneAndDelete({
      usuarioId: req.usuario.id,
      productoId: req.params.productoId
    })
    res.json({ mensaje: 'Eliminado de favoritos' })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

export default router
