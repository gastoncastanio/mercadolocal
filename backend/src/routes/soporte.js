/**
 * Routes del AGENTE-SOPORTE.
 *
 * Endpoints:
 * - POST /api/soporte/preguntar      → crea ticket o continúa uno existente, llama al agente
 * - GET  /api/soporte/mis-tickets    → lista tickets del usuario logueado
 * - GET  /api/soporte/:ticketId      → trae un ticket completo con mensajes
 * - GET  /api/soporte/admin/tickets  → admin: lista tickets escalados/abiertos
 * - POST /api/soporte/admin/responder/:ticketId → admin responde manualmente y resuelve
 */

import { Router } from 'express'
import { verificarToken, soloAdmin } from '../middleware/auth.js'
import Ticket from '../models/Ticket.js'
import Notificacion from '../models/Notificacion.js'
import Usuario from '../models/Usuario.js'
import { procesarConsulta } from '../services/agenteSoporte.js'
import { emitNotificacion } from '../services/socketService.js'

const router = Router()

/**
 * POST /api/soporte/preguntar
 * Body: { mensaje: string, ticketId?: string }
 *
 * Si se manda ticketId → continúa ese ticket
 * Si NO se manda → crea uno nuevo
 *
 * Llama al agente IA y devuelve la respuesta inmediatamente.
 * Si el agente escala, marca el ticket y notifica a los admins.
 */
router.post('/preguntar', verificarToken, async (req, res) => {
  try {
    const { mensaje, ticketId } = req.body

    if (!mensaje || typeof mensaje !== 'string' || mensaje.trim().length < 2) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío.' })
    }

    if (mensaje.length > 2000) {
      return res.status(400).json({ error: 'El mensaje es demasiado largo (máx. 2000 caracteres).' })
    }

    const textoLimpio = mensaje.trim()

    // Cargar o crear el ticket
    let ticket
    if (ticketId) {
      ticket = await Ticket.findById(ticketId)
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket no encontrado.' })
      }
      // Validar que el usuario sea dueño del ticket (o admin)
      if (ticket.usuarioId.toString() !== req.usuario.id && req.usuario.rol !== 'admin') {
        return res.status(403).json({ error: 'No tenés acceso a este ticket.' })
      }
      // No permitir reabrir tickets cerrados desde el chat
      if (ticket.estado === 'cerrado') {
        return res.status(400).json({ error: 'Este ticket está cerrado. Iniciá uno nuevo.' })
      }
    } else {
      ticket = new Ticket({
        usuarioId: req.usuario.id,
        estado: 'abierto',
        mensajes: []
      })
    }

    // Agregar el mensaje del usuario al ticket
    ticket.mensajes.push({
      rol: 'usuario',
      texto: textoLimpio,
      fecha: new Date()
    })

    // Procesar con el agente IA
    const respuesta = await procesarConsulta(ticket, textoLimpio)

    // Actualizar el ticket con la respuesta
    ticket.mensajes.push({
      rol: 'agente',
      texto: respuesta.respuesta,
      fecha: new Date()
    })

    // En el primer turno, fijar el asunto del ticket
    if (ticket.mensajes.length <= 2) {
      ticket.asunto = respuesta.asunto
    }

    // Actualizar prioridad si el agente la subió
    const prioridadesOrden = { baja: 0, media: 1, alta: 2, urgente: 3 }
    if (prioridadesOrden[respuesta.prioridad] > prioridadesOrden[ticket.prioridad]) {
      ticket.prioridad = respuesta.prioridad
    }

    // Acumular tags (sin duplicar)
    const tagsExistentes = new Set(ticket.tags)
    respuesta.tags.forEach(t => tagsExistentes.add(t))
    ticket.tags = [...tagsExistentes].slice(0, 15)

    // Si el agente decide escalar, marcar el ticket
    if (respuesta.escalar) {
      ticket.estado = 'escalado'
      ticket.fechaEscalado = new Date()
      ticket.motivoEscalado = respuesta.motivoEscalado || 'Escalado por el agente IA'

      // Notificar a los admins (en paralelo, no bloqueamos la respuesta)
      try {
        const admins = await Usuario.find({ rol: 'admin' }).select('_id').lean()
        const usuario = await Usuario.findById(req.usuario.id).select('nombre').lean()
        const nombreUsuario = usuario?.nombre || 'Un usuario'

        for (const admin of admins) {
          const notif = await new Notificacion({
            usuarioId: admin._id,
            tipo: 'sistema',
            titulo: `Ticket de soporte escalado · ${ticket.prioridad}`,
            mensaje: `${nombreUsuario}: ${textoLimpio.slice(0, 100)}${textoLimpio.length > 100 ? '...' : ''}`,
            enlace: `/admin/soporte/${ticket._id}`
          }).save()
          emitNotificacion(admin._id.toString(), notif)
        }
      } catch (e) {
        console.error('Error notificando a admins:', e.message)
      }
    } else if (ticket.estado === 'escalado') {
      // El agente respondió pero el ticket sigue escalado (esperando admin)
      // No cambiamos el estado
    } else {
      // Conversación normal con la IA
      ticket.resueltoPorIA = true
    }

    await ticket.save()

    res.json({
      ticketId: ticket._id,
      respuesta: respuesta.respuesta,
      estado: ticket.estado,
      escalado: respuesta.escalar
    })
  } catch (error) {
    console.error('Error en /soporte/preguntar:', error)
    res.status(500).json({ error: 'Ocurrió un error procesando tu consulta. Intentá de nuevo.' })
  }
})

/**
 * GET /api/soporte/mis-tickets
 * Lista los tickets del usuario logueado (más recientes primero).
 */
router.get('/mis-tickets', verificarToken, async (req, res) => {
  try {
    const tickets = await Ticket.find({ usuarioId: req.usuario.id })
      .sort({ ultimaActividad: -1 })
      .limit(30)
      .select('asunto estado prioridad ultimaActividad createdAt mensajes')
      .lean()

    // Para cada ticket, sacar solo el último mensaje (preview)
    const tickets_resumen = tickets.map(t => ({
      _id: t._id,
      asunto: t.asunto,
      estado: t.estado,
      prioridad: t.prioridad,
      ultimaActividad: t.ultimaActividad,
      createdAt: t.createdAt,
      cantidadMensajes: t.mensajes?.length || 0,
      ultimoMensaje: t.mensajes?.length ? {
        rol: t.mensajes[t.mensajes.length - 1].rol,
        texto: t.mensajes[t.mensajes.length - 1].texto.slice(0, 150)
      } : null
    }))

    res.json(tickets_resumen)
  } catch (error) {
    console.error('Error listando tickets:', error)
    res.status(500).json({ error: 'Error al cargar tus tickets.' })
  }
})

/**
 * GET /api/soporte/:ticketId
 * Trae un ticket completo con todos sus mensajes.
 */
router.get('/:ticketId', verificarToken, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId).lean()
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado.' })
    }

    // Solo el dueño o admin puede ver el ticket
    if (ticket.usuarioId.toString() !== req.usuario.id && req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'No tenés acceso a este ticket.' })
    }

    res.json(ticket)
  } catch (error) {
    console.error('Error obteniendo ticket:', error)
    res.status(500).json({ error: 'Error al cargar el ticket.' })
  }
})

/**
 * GET /api/soporte/admin/tickets
 * Solo admin. Lista tickets escalados y abiertos, priorizados.
 *
 * Query params:
 *   - estado=escalado|abierto|resuelto|cerrado (default: escalado)
 *   - prioridad=urgente|alta|media|baja (opcional)
 *   - limit=20 (default 20, max 100)
 */
router.get('/admin/tickets', verificarToken, soloAdmin, async (req, res) => {
  try {
    const filtro = {}
    const estadoSolicitado = req.query.estado || 'escalado'
    if (['abierto', 'resuelto', 'escalado', 'cerrado'].includes(estadoSolicitado)) {
      filtro.estado = estadoSolicitado
    }
    if (['urgente', 'alta', 'media', 'baja'].includes(req.query.prioridad)) {
      filtro.prioridad = req.query.prioridad
    }

    const limit = Math.min(parseInt(req.query.limit) || 20, 100)

    // Orden: prioridad descendente, luego última actividad descendente
    // (urgentes y recientes primero)
    const tickets = await Ticket.find(filtro)
      .populate('usuarioId', 'nombre email rol')
      .sort({ ultimaActividad: -1 })
      .limit(limit)
      .lean()

    // Ordenamos manualmente por prioridad (urgente > alta > media > baja)
    const prioridadOrden = { urgente: 3, alta: 2, media: 1, baja: 0 }
    tickets.sort((a, b) => (prioridadOrden[b.prioridad] || 0) - (prioridadOrden[a.prioridad] || 0))

    res.json(tickets)
  } catch (error) {
    console.error('Error listando tickets admin:', error)
    res.status(500).json({ error: 'Error al cargar tickets.' })
  }
})

/**
 * POST /api/soporte/admin/responder/:ticketId
 * Solo admin. Responde manualmente a un ticket escalado.
 * Body: { mensaje: string, cerrar?: boolean }
 */
router.post('/admin/responder/:ticketId', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { mensaje, cerrar } = req.body
    if (!mensaje || typeof mensaje !== 'string' || mensaje.trim().length < 2) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío.' })
    }

    const ticket = await Ticket.findById(req.params.ticketId)
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado.' })
    }

    ticket.mensajes.push({
      rol: 'admin',
      texto: mensaje.trim().slice(0, 4000),
      fecha: new Date()
    })

    if (cerrar) {
      ticket.estado = 'resuelto'
    }

    await ticket.save()

    // Notificar al usuario que recibió respuesta
    try {
      const notif = await new Notificacion({
        usuarioId: ticket.usuarioId,
        tipo: 'sistema',
        titulo: 'Te respondieron tu consulta de soporte',
        mensaje: mensaje.trim().slice(0, 100) + (mensaje.length > 100 ? '...' : ''),
        enlace: `/soporte/${ticket._id}`
      }).save()
      emitNotificacion(ticket.usuarioId.toString(), notif)
    } catch (e) {
      console.error('Error notificando respuesta admin:', e.message)
    }

    res.json({ ticketId: ticket._id, estado: ticket.estado })
  } catch (error) {
    console.error('Error respondiendo admin:', error)
    res.status(500).json({ error: 'Error al responder.' })
  }
})

/**
 * POST /api/soporte/:ticketId/cerrar
 * El usuario marca el ticket como resuelto desde su lado.
 */
router.post('/:ticketId/cerrar', verificarToken, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId)
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado.' })
    }
    if (ticket.usuarioId.toString() !== req.usuario.id && req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado.' })
    }

    ticket.estado = 'cerrado'
    await ticket.save()
    res.json({ ticketId: ticket._id, estado: ticket.estado })
  } catch (error) {
    console.error('Error cerrando ticket:', error)
    res.status(500).json({ error: 'Error al cerrar el ticket.' })
  }
})

export default router
