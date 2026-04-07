import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import Notificacion from '../models/Notificacion.js'

const router = Router()

// GET /api/notificaciones - Listar mis notificaciones
router.get('/', verificarToken, async (req, res) => {
  try {
    const notificaciones = await Notificacion.find({ usuarioId: req.usuario.id })
      .sort({ createdAt: -1 })
      .limit(50)
    res.json(notificaciones)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/notificaciones/no-leidas - Contar sin leer
router.get('/no-leidas', verificarToken, async (req, res) => {
  try {
    const cantidad = await Notificacion.countDocuments({
      usuarioId: req.usuario.id,
      leida: false
    })
    res.json({ cantidad })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/notificaciones/leer-todas - Marcar todas como leídas
router.put('/leer-todas', verificarToken, async (req, res) => {
  try {
    await Notificacion.updateMany(
      { usuarioId: req.usuario.id, leida: false },
      { leida: true }
    )
    res.json({ mensaje: 'Todas marcadas como leídas' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/notificaciones/:id/leer - Marcar una como leída
router.put('/:id/leer', verificarToken, async (req, res) => {
  try {
    const n = await Notificacion.findOneAndUpdate(
      { _id: req.params.id, usuarioId: req.usuario.id },
      { leida: true },
      { new: true }
    )
    if (!n) return res.status(404).json({ error: 'No encontrada' })
    res.json(n)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// DELETE /api/notificaciones/:id - Eliminar una
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    await Notificacion.findOneAndDelete({
      _id: req.params.id,
      usuarioId: req.usuario.id
    })
    res.json({ mensaje: 'Eliminada' })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

export default router
