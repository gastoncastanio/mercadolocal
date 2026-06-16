import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import Notificacion from '../models/Notificacion.js'
import { getVapidPublicKey, guardarSuscripcion, eliminarSuscripcion, enviarPush } from '../services/pushService.js'

const router = Router()

// ===== WEB PUSH (notificaciones con la app cerrada) =====

// GET /api/notificaciones/push/clave-publica - VAPID public key para suscribirse
router.get('/push/clave-publica', (req, res) => {
  const clave = getVapidPublicKey()
  if (!clave) return res.status(503).json({ error: 'Push no configurado en el servidor' })
  res.json({ clave })
})

// POST /api/notificaciones/push/suscribir - Registrar la suscripción del dispositivo
router.post('/push/suscribir', verificarToken, async (req, res) => {
  try {
    await guardarSuscripcion(req.usuario.id, req.body.suscripcion)
    res.json({ ok: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// POST /api/notificaciones/push/desuscribir - Quitar la suscripción del dispositivo
router.post('/push/desuscribir', verificarToken, async (req, res) => {
  try {
    await eliminarSuscripcion(req.body.endpoint)
    res.json({ ok: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// POST /api/notificaciones/push/test - Push de bienvenida tras activar
// Verifica el flujo completo (VAPID → push service → dispositivo). Lo dispara
// el frontend apenas el usuario se suscribe. enviarPush es fire-and-forget.
router.post('/push/test', verificarToken, async (req, res) => {
  try {
    await enviarPush(req.usuario.id, {
      tipo: 'sistema',
      titulo: '\u{1F514} ¡Notificaciones activadas!',
      mensaje: 'Activaste correctamente tus notificaciones de MercadoLocal. Te avisaremos de tus ventas, pagos y mensajes.',
      enlace: '/notificaciones'
    })
    res.json({ ok: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

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
