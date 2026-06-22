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

// POST /api/comisionistas/perfil/documento - Cargar documento del vehículo
router.post('/perfil/documento', verificarToken, async (req, res) => {
  try {
    const perfil = await comisionistaService.cargarDocumentoVehiculo(req.usuario.id, req.body)
    res.json(perfil)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PATCH /api/comisionistas/perfil/trabajando - Marcar/desmarcar "estoy trabajando ahora"
router.patch('/perfil/trabajando', verificarToken, async (req, res) => {
  try {
    const perfil = await comisionistaService.marcarTrabajandoHoy(req.usuario.id, req.body.activo)
    res.json(perfil)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/comisionistas/en-vivo?ciudadDestino= - Comisionistas trabajando ahora (panel checkout)
router.get('/en-vivo', async (req, res) => {
  try {
    const lista = await comisionistaService.comisionistasEnVivo({ ciudadDestino: req.query.ciudadDestino })
    res.json(lista)
  } catch (error) {
    res.status(500).json({ error: error.message })
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

// GET /api/comisionistas/viajes-para-orden/:ordenId - Viajes que matchean una orden (cross-checkout)
router.get('/viajes-para-orden/:ordenId', verificarToken, async (req, res) => {
  try {
    const r = await comisionistaService.viajesParaOrden(req.usuario.id, req.params.ordenId)
    res.json({
      viajes: r.viajes.map(v => v.toPublic()),
      ciudadOrigen: r.ciudadOrigen,
      ciudadDestino: r.ciudadDestino,
      yaAsignado: r.yaAsignado
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
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

// POST /api/comisionistas/envio/:id/pagar - Contratante paga envío (split al comisionista)
router.post('/envio/:id/pagar', verificarToken, async (req, res) => {
  try {
    const { initPoint, preferenceId } = await comisionistaService.pagarEnvio(
      req.usuario.id,
      req.params.id,
      req.usuario.email || ''
    )
    res.json({ initPoint, preferenceId })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// POST /api/comisionistas/envio/:id/verificar-pago - Verificar pago al volver del checkout
router.post('/envio/:id/verificar-pago', verificarToken, async (req, res) => {
  try {
    const envio = await comisionistaService.verificarPagoEnvio(req.usuario.id, req.params.id)
    res.json(envio)
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

// ===== Reseñas de comisionista =====

// POST /api/comisionistas/envio/:id/resena - Reseñar al comisionista tras la entrega
router.post('/envio/:id/resena', verificarToken, async (req, res) => {
  try {
    const resena = await comisionistaService.reseñarComisionista(req.usuario.id, req.params.id, req.body)
    res.status(201).json(resena)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/comisionistas/mis-resenas-hechas - IDs de envíos que ya reseñé
router.get('/mis-resenas-hechas', verificarToken, async (req, res) => {
  try {
    const ids = await comisionistaService.enviosReseñadosPor(req.usuario.id)
    res.json(ids)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/comisionistas/:usuarioId/resenas - Reseñas públicas de un comisionista
router.get('/:usuarioId/resenas', async (req, res) => {
  try {
    const { skip = 0, limit = 20 } = req.query
    const { resenas, total } = await comisionistaService.resenasComisionista(req.params.usuarioId, {
      skip: parseInt(skip), limit: parseInt(limit)
    })
    res.json({ resenas, total })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ===== Subasta "comisionista en vivo" (broadcast competitivo) =====

// GET /api/comisionistas/envios-vivo-abiertos - Envíos en vivo disponibles AHORA
// para que el comisionista compita (los que aún no ofertó).
router.get('/envios-vivo-abiertos', verificarToken, async (req, res) => {
  try {
    const lista = await comisionistaService.enviosEnVivoAbiertos(req.usuario.id)
    res.json(lista)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/comisionistas/envio-vivo/:ordenId/ofertar - El comisionista oferta
// Body: { monto, tiempoEstimado? }
router.post('/envio-vivo/:ordenId/ofertar', verificarToken, async (req, res) => {
  try {
    const solicitud = await comisionistaService.ofertarEnvioEnVivo(req.usuario.id, req.params.ordenId, req.body)
    res.status(201).json(solicitud)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// POST /api/comisionistas/envio-vivo/:ordenId/tomar - "Agarrar ya" (claim atómico)
// Body: { monto, tiempoEstimado? }
router.post('/envio-vivo/:ordenId/tomar', verificarToken, async (req, res) => {
  try {
    const solicitud = await comisionistaService.tomarEnvioEnVivo(req.usuario.id, req.params.ordenId, req.body)
    res.status(201).json(solicitud)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/comisionistas/mi-dia - Resumen del día (ganancias + envíos) del comisionista
router.get('/mi-dia', verificarToken, async (req, res) => {
  try {
    const resumen = await comisionistaService.resumenDiaComisionista(req.usuario.id)
    res.json(resumen)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ===== SolicitudCotizacion (comisionista en vivo desde el checkout) =====

// POST /api/comisionistas/cotizacion - El comprador pide cotización a un comisionista
router.post('/cotizacion', verificarToken, async (req, res) => {
  try {
    const solicitud = await comisionistaService.solicitarCotizacion(req.usuario.id, req.body)
    res.status(201).json(solicitud)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/comisionistas/cotizaciones-recibidas - Cotizaciones que recibió el comisionista
router.get('/cotizaciones-recibidas', verificarToken, async (req, res) => {
  try {
    const lista = await comisionistaService.cotizacionesRecibidas(req.usuario.id)
    res.json(lista)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/comisionistas/mis-cotizaciones - Cotizaciones que pidió el comprador
router.get('/mis-cotizaciones', verificarToken, async (req, res) => {
  try {
    const lista = await comisionistaService.misCotizaciones(req.usuario.id)
    res.json(lista)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/comisionistas/cotizaciones-de-mis-ventas - Cotizaciones en vivo que afectan
// a las ventas del vendedor (para que sepa que el retiro lo hace un comisionista)
router.get('/cotizaciones-de-mis-ventas', verificarToken, async (req, res) => {
  try {
    const lista = await comisionistaService.cotizacionesDeMisVentas(req.usuario.id)
    res.json(lista)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PATCH /api/comisionistas/cotizacion/:id/responder - El comisionista cotiza un precio
router.patch('/cotizacion/:id/responder', verificarToken, async (req, res) => {
  try {
    const solicitud = await comisionistaService.responderCotizacion(req.usuario.id, req.params.id, req.body)
    res.json(solicitud)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PATCH /api/comisionistas/cotizacion/:id/aceptar - El comprador acepta la cotización
router.patch('/cotizacion/:id/aceptar', verificarToken, async (req, res) => {
  try {
    const solicitud = await comisionistaService.aceptarCotizacion(req.usuario.id, req.params.id)
    res.json(solicitud)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// POST /api/comisionistas/cotizacion/:id/pagar - El comprador paga el traslado (split a MP del comisionista)
router.post('/cotizacion/:id/pagar', verificarToken, async (req, res) => {
  try {
    const { default: Usuario } = await import('../models/Usuario.js')
    const usuario = await Usuario.findById(req.usuario.id).select('email')
    const resultado = await comisionistaService.pagarTraslado(req.usuario.id, req.params.id, usuario?.email)
    res.json(resultado)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// POST /api/comisionistas/cotizacion/:id/verificar-pago - Verificar el pago al volver del checkout
router.post('/cotizacion/:id/verificar-pago', verificarToken, async (req, res) => {
  try {
    const solicitud = await comisionistaService.verificarPagoTraslado(req.usuario.id, req.params.id)
    res.json(solicitud)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PATCH /api/comisionistas/cotizacion/:id/cancelar - Cancelar/rechazar (cualquiera de las partes)
router.patch('/cotizacion/:id/cancelar', verificarToken, async (req, res) => {
  try {
    const solicitud = await comisionistaService.cancelarCotizacion(req.usuario.id, req.params.id)
    res.json(solicitud)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PATCH /api/comisionistas/cotizacion/:id/incidente - El comisionista reporta una rotura/accidente
router.patch('/cotizacion/:id/incidente', verificarToken, async (req, res) => {
  try {
    const solicitud = await comisionistaService.reportarIncidente(req.usuario.id, req.params.id, req.body.descripcion)
    res.json(solicitud)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

export default router
