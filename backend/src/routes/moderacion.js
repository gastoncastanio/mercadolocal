/**
 * Rutas del panel de MODERACIÓN para administradores.
 *
 * Permite a los admins:
 *  - Ver productos en estado "revision" (marcados por el agente IA)
 *  - Ver el historial de decisiones del AGENTE-MODERACIÓN
 *  - Aprobar manualmente un producto en revisión
 *  - Rechazar manualmente (incluso uno que el agente aprobó)
 *  - Ver métricas: cantidad de moderaciones por día, costo de tokens, etc.
 */

import { Router } from 'express'
import { verificarToken, soloAdmin } from '../middleware/auth.js'
import Producto from '../models/Producto.js'
import Moderacion from '../models/Moderacion.js'
import Notificacion from '../models/Notificacion.js'
import { emitNotificacion } from '../services/socketService.js'

const router = Router()

/**
 * GET /api/moderacion/pendientes
 * Lista productos en estado "revision" para revisión humana.
 * Query: ?limit=20&pagina=1
 */
router.get('/pendientes', verificarToken, soloAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const pagina = Math.max(parseInt(req.query.pagina) || 1, 1)
    const skip = (pagina - 1) * limit

    const [productos, total] = await Promise.all([
      Producto.find({ 'moderacion.estado': 'revision' })
        .populate('tiendaId', 'nombre ciudad calificacion')
        .sort({ 'moderacion.fecha': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Producto.countDocuments({ 'moderacion.estado': 'revision' })
    ])

    res.json({
      productos,
      pagina,
      limit,
      total,
      totalPaginas: Math.ceil(total / limit)
    })
  } catch (error) {
    console.error('Error listando pendientes de moderación:', error)
    res.status(500).json({ error: 'Error al cargar productos pendientes.' })
  }
})

/**
 * GET /api/moderacion/historial
 * Historial de decisiones del agente (filtros opcionales).
 * Query: ?decision=aprobado|rechazado|revision&bandera=X&limit=20&pagina=1
 */
router.get('/historial', verificarToken, soloAdmin, async (req, res) => {
  try {
    const filtro = {}
    if (['aprobado', 'rechazado', 'revision'].includes(req.query.decision)) {
      filtro.decision = req.query.decision
    }
    if (req.query.bandera) {
      filtro.banderas = req.query.bandera
    }
    if (req.query.tiendaId) {
      filtro.tiendaId = req.query.tiendaId
    }

    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const pagina = Math.max(parseInt(req.query.pagina) || 1, 1)
    const skip = (pagina - 1) * limit

    const [items, total] = await Promise.all([
      Moderacion.find(filtro)
        .populate('tiendaId', 'nombre ciudad')
        .populate('productoId', 'nombre activo moderacion')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Moderacion.countDocuments(filtro)
    ])

    res.json({ items, pagina, limit, total, totalPaginas: Math.ceil(total / limit) })
  } catch (error) {
    console.error('Error historial moderación:', error)
    res.status(500).json({ error: 'Error al cargar historial.' })
  }
})

/**
 * GET /api/moderacion/metricas
 * Métricas agregadas del agente: cantidad por día, banderas más frecuentes, tokens.
 */
router.get('/metricas', verificarToken, soloAdmin, async (req, res) => {
  try {
    const dias = Math.min(parseInt(req.query.dias) || 7, 90)
    const desde = new Date()
    desde.setDate(desde.getDate() - dias)

    const [porDecision, banderasTop, totales] = await Promise.all([
      Moderacion.aggregate([
        { $match: { createdAt: { $gte: desde } } },
        { $group: { _id: '$decision', count: { $sum: 1 } } }
      ]),
      Moderacion.aggregate([
        { $match: { createdAt: { $gte: desde } } },
        { $unwind: '$banderas' },
        { $group: { _id: '$banderas', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      Moderacion.aggregate([
        { $match: { createdAt: { $gte: desde } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            tokensEntrada: { $sum: '$tokens.entrada' },
            tokensSalida: { $sum: '$tokens.salida' },
            tokensCached: { $sum: '$tokens.entradaCached' },
            duracionPromedio: { $avg: '$duracionMs' }
          }
        }
      ])
    ])

    // Costo estimado (Haiku 4.5):
    //   $1 / 1M tokens entrada (no cached)
    //   $0.10 / 1M tokens entrada (cached)
    //   $5 / 1M tokens salida
    const t = totales[0] || { tokensEntrada: 0, tokensSalida: 0, tokensCached: 0 }
    const costoEstimadoUSD =
      (t.tokensEntrada / 1_000_000) * 1.0 +
      (t.tokensCached / 1_000_000) * 0.10 +
      (t.tokensSalida / 1_000_000) * 5.0

    res.json({
      dias,
      porDecision,
      banderasTop,
      totales: totales[0] || null,
      costoEstimadoUSD: Math.round(costoEstimadoUSD * 10000) / 10000
    })
  } catch (error) {
    console.error('Error métricas moderación:', error)
    res.status(500).json({ error: 'Error al cargar métricas.' })
  }
})

/**
 * POST /api/moderacion/:productoId/aprobar
 * Admin aprueba manualmente un producto que estaba en revisión (o rechazado).
 */
router.post('/:productoId/aprobar', verificarToken, soloAdmin, async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.productoId)
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado.' })
    }

    const estadoAnterior = producto.moderacion?.estado || 'aprobado'

    producto.moderacion = {
      estado: 'aprobado',
      motivo: req.body.comentario || 'Aprobado por administrador',
      confianza: 100,
      fecha: new Date()
    }
    await producto.save()

    // Registramos la revisión del admin sobre la moderación más reciente
    await Moderacion.findOneAndUpdate(
      { productoId: producto._id },
      {
        $set: {
          'revisionAdmin.realizada': true,
          'revisionAdmin.adminId': req.usuario.id,
          'revisionAdmin.fecha': new Date(),
          'revisionAdmin.decisionFinal': 'aprobado',
          'revisionAdmin.comentario': req.body.comentario || ''
        }
      },
      { sort: { createdAt: -1 } }
    )

    // Notificar al vendedor solo si el estado cambió (no si ya estaba aprobado)
    if (estadoAnterior !== 'aprobado') {
      try {
        const notif = await new Notificacion({
          usuarioId: producto.tiendaId, // ajustamos abajo si la tienda tiene usuarioId distinto
          tipo: 'sistema',
          titulo: 'Tu producto fue aprobado',
          mensaje: `"${producto.nombre.slice(0, 60)}" ya está visible en el catálogo.`,
          enlace: `/producto/${producto._id}`
        }).save()
        emitNotificacion(producto.tiendaId.toString(), notif)
      } catch (e) {
        console.warn('No se pudo notificar aprobación:', e.message)
      }
    }

    res.json({ ok: true, producto })
  } catch (error) {
    console.error('Error aprobando producto:', error)
    res.status(500).json({ error: 'Error al aprobar el producto.' })
  }
})

/**
 * POST /api/moderacion/:productoId/rechazar
 * Admin rechaza manualmente un producto (lo saca del catálogo).
 * Body: { motivo: string }
 */
router.post('/:productoId/rechazar', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { motivo } = req.body
    if (!motivo || motivo.trim().length < 5) {
      return res.status(400).json({ error: 'El motivo es obligatorio (mínimo 5 caracteres).' })
    }

    const producto = await Producto.findById(req.params.productoId)
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado.' })
    }

    producto.moderacion = {
      estado: 'rechazado',
      motivo: motivo.trim().slice(0, 1000),
      confianza: 100,
      fecha: new Date()
    }
    await producto.save()

    // Registrar la revisión del admin
    await Moderacion.findOneAndUpdate(
      { productoId: producto._id },
      {
        $set: {
          'revisionAdmin.realizada': true,
          'revisionAdmin.adminId': req.usuario.id,
          'revisionAdmin.fecha': new Date(),
          'revisionAdmin.decisionFinal': 'rechazado',
          'revisionAdmin.comentario': motivo.trim()
        }
      },
      { sort: { createdAt: -1 } }
    )

    // Notificar al vendedor del rechazo
    try {
      const notif = await new Notificacion({
        usuarioId: producto.tiendaId,
        tipo: 'sistema',
        titulo: 'Tu producto fue rechazado',
        mensaje: motivo.trim().slice(0, 150),
        enlace: `/mi-tienda`
      }).save()
      emitNotificacion(producto.tiendaId.toString(), notif)
    } catch (e) {
      console.warn('No se pudo notificar rechazo:', e.message)
    }

    res.json({ ok: true, producto })
  } catch (error) {
    console.error('Error rechazando producto:', error)
    res.status(500).json({ error: 'Error al rechazar el producto.' })
  }
})

export default router
