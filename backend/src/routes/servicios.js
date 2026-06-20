import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import * as serviciosService from '../services/serviciosService.js'
import * as preapprovalService from '../services/mercadoPagoPreapprovalService.js'
import { obtenerConfig } from '../services/configService.js'
import Suscripcion from '../models/Suscripcion.js'
import Usuario from '../models/Usuario.js'

const router = Router()

// ===== PerfilProfesional =====

// POST /api/servicios/perfil - Crear perfil profesional
router.post('/perfil', verificarToken, async (req, res) => {
  try {
    const { rubro, nombreNegocio, descripcion, experiencia, habilidades, añosExperiencia,
      localidad, zonasCobertura, matricula, telefonoContacto, fotos, logo } = req.body
    if (!rubro || !localidad) {
      return res.status(400).json({ error: 'rubro y localidad son obligatorios' })
    }
    const perfil = await serviciosService.crearPerfilProfesional(req.usuario.id, {
      rubro,
      nombreNegocio,
      descripcion,
      experiencia,
      habilidades,
      añosExperiencia,
      localidad,
      zonasCobertura,
      matricula,
      telefonoContacto,
      fotos,
      logo
    })
    res.status(201).json(perfil.toPublic())
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/servicios/perfil/me - Obtener mi perfil (logueado)
router.get('/perfil/me', verificarToken, async (req, res) => {
  try {
    const perfil = await serviciosService.obtenerPerfilProfesional(req.usuario.id)
    if (!perfil) {
      return res.status(404).json({ error: 'No tienes un perfil profesional creado' })
    }
    res.json(perfil)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/servicios/perfil/:usuarioId - Obtener perfil público
router.get('/perfil/:usuarioId', async (req, res) => {
  try {
    const perfil = await serviciosService.obtenerPerfilProfesional(req.params.usuarioId)
    if (!perfil) {
      return res.status(404).json({ error: 'Perfil no encontrado' })
    }
    res.json(perfil.toPublic())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PATCH /api/servicios/perfil - Actualizar perfil del usuario logueado
router.patch('/perfil', verificarToken, async (req, res) => {
  try {
    const { rubro, nombreNegocio, descripcion, experiencia, habilidades, añosExperiencia,
      localidad, zonasCobertura, matricula, telefonoContacto, fotos, logo } = req.body
    const datos = {
      rubro, nombreNegocio, descripcion, experiencia, habilidades, añosExperiencia,
      localidad, zonasCobertura, matricula, telefonoContacto
    }
    // Solo actualizar media si vino algo de fotos/logo
    if (fotos !== undefined || logo !== undefined) {
      datos.media = { fotos: fotos || [], logo: logo || '' }
    }
    const perfilActualizado = await serviciosService.actualizarPerfilProfesional(req.usuario.id, datos)
    res.json(perfilActualizado.toPublic())
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/servicios/buscar - Listar profesionales (destacados arriba)
router.get('/buscar', async (req, res) => {
  try {
    const { rubro, localidad, skip = 0, limit = 20 } = req.query
    const { perfiles, total } = await serviciosService.buscarProfesionales({
      rubro,
      localidad,
      skip: parseInt(skip),
      limit: parseInt(limit)
    })
    res.json({
      perfiles: perfiles.map(p => p.toPublic()),
      total
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ===== Bolsa de Trabajo Inversa (TrabajoBuscado + Bid) =====

// POST /api/servicios/trabajo - Cliente publica un trabajo
router.post('/trabajo', verificarToken, async (req, res) => {
  try {
    const { titulo, descripcion, rubro, localidad, presupuestoMin, presupuestoMax, plazoEntrega, skills } = req.body
    if (!titulo || !descripcion || !rubro || !localidad) {
      return res.status(400).json({ error: 'titulo, descripcion, rubro y localidad son obligatorios' })
    }
    const trabajo = await serviciosService.crearTrabajo(req.usuario.id, {
      titulo, descripcion, rubro, localidad, presupuestoMin, presupuestoMax, plazoEntrega, skills
    })
    res.status(201).json(trabajo)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/servicios/trabajos - Listar trabajos abiertos (browse del profesional)
router.get('/trabajos', async (req, res) => {
  try {
    const { rubro, localidad, estado, skip = 0, limit = 20 } = req.query
    const { trabajos, total } = await serviciosService.buscarTrabajos({
      rubro, localidad, estado, skip: parseInt(skip), limit: parseInt(limit)
    })
    res.json({ trabajos, total })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/servicios/mis-trabajos - Mis trabajos publicados (dashboard cliente)
router.get('/mis-trabajos', verificarToken, async (req, res) => {
  try {
    const { estado, skip = 0, limit = 50 } = req.query
    const { trabajos, total } = await serviciosService.trabajosPorCliente(req.usuario.id, {
      estado, skip: parseInt(skip), limit: parseInt(limit)
    })
    res.json({ trabajos, total })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/servicios/trabajo/:id - Detalle del trabajo + ofertas (según rol)
router.get('/trabajo/:id', verificarToken, async (req, res) => {
  try {
    const data = await serviciosService.obtenerTrabajoConBids(req.params.id, req.usuario.id)
    res.json(data)
  } catch (error) {
    res.status(404).json({ error: error.message })
  }
})

// POST /api/servicios/trabajo/:id/bid - Profesional oferta por un trabajo
router.post('/trabajo/:id/bid', verificarToken, async (req, res) => {
  try {
    const { precioOfrecido, notas } = req.body
    const bid = await serviciosService.crearBid(req.params.id, req.usuario.id, { precioOfrecido, notas })
    res.status(201).json(bid)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PATCH /api/servicios/trabajo/:id/bid/:bidId/aceptar - Cliente acepta una oferta
router.patch('/trabajo/:id/bid/:bidId/aceptar', verificarToken, async (req, res) => {
  try {
    const trabajo = await serviciosService.aceptarBid(req.params.id, req.params.bidId, req.usuario.id)
    res.json(trabajo)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PATCH /api/servicios/trabajo/:id/cancelar - Cliente cancela el trabajo
router.patch('/trabajo/:id/cancelar', verificarToken, async (req, res) => {
  try {
    const trabajo = await serviciosService.cancelarTrabajo(req.params.id, req.usuario.id)
    res.json(trabajo)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PATCH /api/servicios/trabajo/:id/completar - Cliente marca trabajo completado
router.patch('/trabajo/:id/completar', verificarToken, async (req, res) => {
  try {
    const trabajo = await serviciosService.completarTrabajo(req.params.id, req.usuario.id)
    res.json(trabajo)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// POST /api/servicios/resena/trabajo/:trabajoId - Reseñar trabajo completado
router.post('/resena/trabajo/:trabajoId', verificarToken, async (req, res) => {
  try {
    const { calificacion, comentario } = req.body
    if (!calificacion) {
      return res.status(400).json({ error: 'calificacion es obligatoria' })
    }
    const resena = await serviciosService.crearResenaTrabajo(req.usuario.id, req.params.trabajoId, {
      calificacion, comentario
    })
    res.status(201).json(resena)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// ===== SolicitudServicio =====

// POST /api/servicios/solicitud - Crear solicitud de servicio
router.post('/solicitud', verificarToken, async (req, res) => {
  try {
    const { profesionalId, rubro, descripcion, zona } = req.body
    if (!profesionalId || !rubro || !descripcion || !zona) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' })
    }
    const solicitud = await serviciosService.crearSolicitud(req.usuario.id, profesionalId, {
      rubro,
      descripcion,
      zona
    })
    res.status(201).json(solicitud)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/servicios/solicitud/:id - Obtener detalles de solicitud
router.get('/solicitud/:id', async (req, res) => {
  try {
    const solicitud = await serviciosService.obtenerSolicitud(req.params.id)
    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' })
    }
    res.json(solicitud)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PATCH /api/servicios/solicitud/:id - Cambiar estado de solicitud (profesional)
router.patch('/solicitud/:id', verificarToken, async (req, res) => {
  try {
    const { estado, cotizacion } = req.body
    if (!estado) {
      return res.status(400).json({ error: 'estado es obligatorio' })
    }
    const solicitudActualizada = await serviciosService.actualizarEstadoSolicitud(
      req.params.id,
      req.usuario.id,
      estado,
      cotizacion
    )
    res.json(solicitudActualizada)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/servicios/mis-solicitudes - Mis solicitudes como profesional
router.get('/mis-solicitudes', verificarToken, async (req, res) => {
  try {
    const { estado, skip = 0, limit = 20 } = req.query
    const { solicitudes, total } = await serviciosService.solicitudesPorProfesional(
      req.usuario.id,
      { estado, skip: parseInt(skip), limit: parseInt(limit) }
    )
    res.json({ solicitudes, total })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ===== ResenaServicio =====

// POST /api/servicios/resena - Crear reseña de servicio
router.post('/resena', verificarToken, async (req, res) => {
  try {
    const { solicitudId, calificacion, comentario } = req.body
    if (!solicitudId || !calificacion) {
      return res.status(400).json({ error: 'solicitudId y calificacion son obligatorios' })
    }
    const resena = await serviciosService.crearResenaServicio(req.usuario.id, solicitudId, {
      calificacion,
      comentario
    })
    res.status(201).json(resena)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// POST /api/servicios/resena/:resenaId/respuesta - Responder reseña (profesional)
router.post('/resena/:resenaId/respuesta', verificarToken, async (req, res) => {
  try {
    const { respuesta } = req.body
    if (!respuesta) {
      return res.status(400).json({ error: 'La respuesta es obligatoria' })
    }
    const resena = await serviciosService.responderResenaServicio(
      req.params.resenaId,
      req.usuario.id,
      respuesta
    )
    res.json(resena)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/servicios/resenas/:profesionalId - Reseñas de un profesional
router.get('/resenas/:profesionalId', async (req, res) => {
  try {
    const resenas = await serviciosService.resenasPorProfesional(req.params.profesionalId)
    res.json(resenas)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ===== Suscripcion =====

// POST /api/servicios/suscribir - Crear suscripción (destacado)
router.post('/suscribir', verificarToken, async (req, res) => {
  try {
    const { plan } = req.body
    if (!plan) {
      return res.status(400).json({ error: 'plan es obligatorio' })
    }

    // Obtener usuario y perfil profesional
    const usuario = await Usuario.findById(req.usuario.id)
    const perfil = await serviciosService.obtenerPerfilProfesional(req.usuario.id)

    if (!usuario || !perfil) {
      return res.status(404).json({ error: 'Usuario o perfil no encontrado' })
    }

    // Obtener precio del plan desde ConfigSitio
    const preciosJsonStr = await obtenerConfig('suscripcion_profesional_precios')
    let precioMensual = 500 // Fallback
    if (preciosJsonStr) {
      try {
        const precios = JSON.parse(preciosJsonStr)
        precioMensual = precios[plan]?.precio || 500
      } catch (parseError) {
        console.warn('⚠️ Error parseando suscripcion_profesional_precios:', parseError.message)
      }
    }

    // Crear suscripción en estado PAUSADA: el beneficio (destacar el perfil) se
    // otorga SOLO cuando MercadoPago confirma el pago — via webhook o via la
    // verificación al volver del checkout. Así evitamos que alguien aparezca
    // destacado sin haber pagado.
    const suscripcion = new Suscripcion({
      usuarioId: req.usuario.id,
      tipo: 'profesional_destacado',
      referenciaId: perfil._id,
      plan,
      precioMensual,
      estado: 'pausada'
    })

    await suscripcion.save()

    // Crear preapproval en MercadoPago
    try {
      const preapprovalResponse = await preapprovalService.crearPreapproval(suscripcion, usuario.email)

      // Guardar mpPreapprovalId encriptado. NO seteamos proximoCobro ni
      // destacadoHasta acá: eso ocurre al confirmarse el pago (activación).
      suscripcion.mpPreapprovalId = preapprovalResponse.id
      await suscripcion.save()

      res.status(201).json({
        suscripcionId: suscripcion._id,
        initPoint: preapprovalResponse.init_point,
        sandboxInitPoint: preapprovalResponse.sandbox_init_point
      })
    } catch (mpError) {
      // Si falla la creación en MP, eliminar la suscripción local
      await Suscripcion.deleteOne({ _id: suscripcion._id })
      res.status(500).json({ error: `Error en MercadoPago: ${mpError.message}` })
    }
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/servicios/suscripcion/:id - Obtener estado de suscripción
router.get('/suscripcion/:id', verificarToken, async (req, res) => {
  try {
    const suscripcion = await Suscripcion.findById(req.params.id)
    if (!suscripcion) {
      return res.status(404).json({ error: 'Suscripción no encontrada' })
    }

    // Validar que pertenece al usuario
    if (suscripcion.usuarioId.toString() !== req.usuario.id) {
      return res.status(403).json({ error: 'No tienes acceso a esta suscripción' })
    }

    res.json({
      _id: suscripcion._id,
      plan: suscripcion.plan,
      estado: suscripcion.estado,
      precioMensual: suscripcion.precioMensual,
      proximoCobro: suscripcion.proximoCobro,
      createdAt: suscripcion.createdAt
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/servicios/suscripcion/:id/verificar - Confirmar el pago contra MP.
// Camino robusto que NO depende de que el webhook llegue: cuando el usuario
// vuelve del checkout, el frontend llama acá; consultamos el preapproval a MP y,
// si está autorizado, activamos la suscripción y destacamos el perfil.
router.post('/suscripcion/:id/verificar', verificarToken, async (req, res) => {
  try {
    const suscripcion = await Suscripcion.findById(req.params.id)
    if (!suscripcion) {
      return res.status(404).json({ error: 'Suscripción no encontrada' })
    }
    if (suscripcion.usuarioId.toString() !== req.usuario.id) {
      return res.status(403).json({ error: 'No tenés acceso a esta suscripción' })
    }

    const preapprovalId = suscripcion.getMpPreapprovalId()
    if (!preapprovalId) {
      return res.status(400).json({ error: 'La suscripción no tiene preapproval asociado' })
    }

    // Consultar el estado real en MercadoPago.
    let estadoMP = null
    try {
      const preapproval = await preapprovalService.obtenerPreapproval(preapprovalId)
      estadoMP = preapproval?.status // 'authorized' | 'pending' | 'paused' | 'cancelled'
    } catch (e) {
      console.warn('Verificar suscripción: no se pudo consultar a MP:', e.message)
    }

    // Aplicar el estado de MP (idempotente vía los helpers del service).
    if (estadoMP === 'authorized') {
      await serviciosService.activarSuscripcionDestacado(suscripcion._id)
    } else if (estadoMP === 'cancelled') {
      await serviciosService.cambiarEstadoSuscripcion(suscripcion._id, 'cancelada')
    } else if (estadoMP === 'paused') {
      await serviciosService.cambiarEstadoSuscripcion(suscripcion._id, 'pausada')
    }

    const actualizada = await Suscripcion.findById(suscripcion._id)
    res.json({
      _id: actualizada._id,
      estado: actualizada.estado,
      estadoMP,
      proximoCobro: actualizada.proximoCobro
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Webhook de preapproval: implementado en routes/pagos.js
// (POST /api/pagos/webhook/preapproval). El notification_url del preapproval
// apunta ahí; ver mercadoPagoPreapprovalService.crearPreapproval().

export default router
