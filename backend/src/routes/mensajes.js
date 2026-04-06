import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import { enviarMensaje, obtenerConversacion, misConversaciones, marcarLeidos } from '../services/mensajeService.js'

const router = Router()

// POST /api/mensajes - Enviar mensaje
router.post('/', verificarToken, async (req, res) => {
  try {
    const { receptorId, productoId, mensaje } = req.body
    if (!receptorId || !mensaje) {
      return res.status(400).json({ error: 'receptorId y mensaje son obligatorios' })
    }
    const nuevoMensaje = await enviarMensaje(req.usuario.id, { receptorId, productoId, mensaje })
    res.status(201).json(nuevoMensaje)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/mensajes/conversaciones - Mis conversaciones
router.get('/conversaciones', verificarToken, async (req, res) => {
  try {
    const conversaciones = await misConversaciones(req.usuario.id)
    res.json(conversaciones)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/mensajes/conversacion/:conversacionId - Mensajes de una conversacion
router.get('/conversacion/:conversacionId', verificarToken, async (req, res) => {
  try {
    const mensajes = await obtenerConversacion(req.params.conversacionId, req.usuario.id)
    res.json(mensajes)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PUT /api/mensajes/leer/:conversacionId - Marcar como leidos
router.put('/leer/:conversacionId', verificarToken, async (req, res) => {
  try {
    await marcarLeidos(req.params.conversacionId, req.usuario.id)
    res.json({ mensaje: 'Mensajes marcados como leidos' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
