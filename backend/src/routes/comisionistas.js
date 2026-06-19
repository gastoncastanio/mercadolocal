import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import * as comisionistaService from '../services/comisionistaService.js'

const router = Router()

// ===== PerfilComisionista =====

// POST /api/comisionistas/perfil - Crear perfil de comisionista
router.post('/perfil', verificarToken, async (req, res) => {
  try {
    const perfil = await comisionistaService.crearPerfilComisionista(req.usuario.id, req.body)
    res.status(201).json(perfil)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/comisionistas/perfil/me - Mi perfil (debe ir ANTES de /:usuarioId)
router.get('/perfil/me', verificarToken, async (req, res) => {
  try {
    const perfil = await comisionistaService.obtenerPerfilComisionista(req.usuario.id)
    if (!perfil) return res.status(404).json({ error: 'Todavía no tenés un perfil de comisionista' })
    res.json(perfil.toPublic())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/comisionistas/perfil/:usuarioId - Perfil público
router.get('/perfil/:usuarioId', async (req, res) => {
  try {
    const perfil = await comisionistaService.obtenerPerfilComisionista(req.params.usuarioId)
    if (!perfil) return res.status(404).json({ error: 'Perfil no encontrado' })
    res.json(perfil.toPublic())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PATCH /api/comisionistas/perfil - Actualizar mi perfil
router.patch('/perfil', verificarToken, async (req, res) => {
  try {
    const perfil = await comisionistaService.actualizarPerfilComisionista(req.usuario.id, req.body)
    res.json(perfil)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// ===== Viaje =====

// POST /api/comisionistas/viaje - Publicar un viaje (requiere perfil)
router.post('/viaje', verificarToken, async (req, res) => {
  try {
    const viaje = await comisionistaService.publicarViaje(req.usuario.id, req.body)
    res.status(201).json(viaje.toPublic())
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/comisionistas/viajes?origen=&destino=&fecha= - Buscar viajes abiertos
router.get('/viajes', async (req, res) => {
  try {
    const { origen, destino, fecha, skip, limit } = req.query
    const resultado = await comisionistaService.buscarViajes({
      origen,
      destino,
      fecha,
      skip: skip ? Number(skip) : 0,
      limit: limit ? Number(limit) : 20
    })
    res.json({
      viajes: resultado.viajes.map(v => v.toPublic()),
      total: resultado.total
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/comisionistas/mis-viajes - Viajes que publiqué (comisionista)
router.get('/mis-viajes', verificarToken, async (req, res) => {
  try {
    const viajes = await comisionistaService.misViajes(req.usuario.id)
    res.json(viajes.map(v => v.toPublic()))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/comisionistas/viaje/:id - Detalle de un viaje
router.get('/viaje/:id', async (req, res) => {
  try {
    const viaje = await comisionistaService.obtenerViaje(req.params.id)
    if (!viaje) return res.status(404).json({ error: 'Viaje no encontrado' })
    res.json(viaje.toPublic())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Transiciones de estado del viaje (solo el comisionista dueño)
router.patch('/viaje/:id/iniciar', verificarToken, async (req, res) => {
  try {
    const viaje = await comisionistaService.cambiarEstadoViaje(req.usuario.id, req.params.id, 'en_curso')
    res.json(viaje.toPublic())
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.patch('/viaje/:id/completar', verificarToken, async (req, res) => {
  try {
    const viaje = await comisionistaService.cambiarEstadoViaje(req.usuario.id, req.params.id, 'completado')
    res.json(viaje.toPublic())
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.patch('/viaje/:id/cancelar', verificarToken, async (req, res) => {
  try {
    const viaje = await comisionistaService.cambiarEstadoViaje(req.usuario.id, req.params.id, 'cancelado')
    res.json(viaje.toPublic())
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// ===== EnvioComisionista =====

// POST /api/comisionistas/viaje/:id/contratar - Reservar cupo en un viaje
router.post('/viaje/:id/contratar', verificarToken, async (req, res) => {
  try {
    const { envio, codigoEntrega } = await comisionistaService.contratarEnvio(
      req.usuario.id,
      req.params.id,
      req.body
    )
    // El código de entrega se devuelve UNA sola vez (en BD solo queda el hash).
    res.status(201).json({ envio, codigoEntrega })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/comisionistas/mis-envios - Envíos que contraté (como contratante)
router.get('/mis-envios', verificarToken, async (req, res) => {
  try {
    const envios = await comisionistaService.misEnviosContratante(req.usuario.id)
    res.json(envios)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/comisionistas/envios-recibidos - Envíos en mis viajes (como comisionista)
router.get('/envios-recibidos', verificarToken, async (req, res) => {
  try {
    const envios = await comisionistaService.enviosRecibidos(req.usuario.id)
    res.json(envios)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.patch('/envio/:id/aceptar', verificarToken, async (req, res) => {
  try {
    const envio = await comisionistaService.aceptarEnvio(req.usuario.id, req.params.id)
    res.json(envio)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.patch('/envio/:id/transito', verificarToken, async (req, res) => {
  try {
    const envio = await comisionistaService.marcarEnTransito(req.usuario.id, req.params.id)
    res.json(envio)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PATCH /api/comisionistas/envio/:id/entregar - Confirmar entrega con código
router.patch('/envio/:id/entregar', verificarToken, async (req, res) => {
  try {
    const envio = await comisionistaService.confirmarEntrega(req.usuario.id, req.params.id, req.body.codigo)
    res.json(envio)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.patch('/envio/:id/cancelar', verificarToken, async (req, res) => {
  try {
    const envio = await comisionistaService.cancelarEnvio(req.usuario.id, req.params.id)
    res.json(envio)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

export default router
