/**
 * Rutas del CEREBRO — el panel de la organización IA de MercadoLocal.
 *
 * Solo accesible para administradores.
 *
 * Endpoints:
 *   GET  /api/cerebro/agentes              → lista todos los agentes con métricas
 *   GET  /api/cerebro/agentes/:slug        → detalle de un agente
 *   GET  /api/cerebro/mensajes/:canal      → últimos mensajes de un canal
 *   POST /api/cerebro/mensajes/:canal      → admin manda un mensaje (los agentes responden)
 *   POST /api/cerebro/reacciones/:msgId    → reaccionar a un mensaje
 *   POST /api/cerebro/reporte-ahora        → forzar reporte diario del CEO
 *   POST /api/cerebro/ascensos             → procesar ascensos automáticos
 *   GET  /api/cerebro/no-leidos            → cantidad de mensajes no leídos por canal
 *   POST /api/cerebro/marcar-leido/:canal  → marcar canal como leído
 */

import { Router } from 'express'
import { verificarToken, soloAdmin } from '../middleware/auth.js'
import Agente from '../models/Agente.js'
import MensajeOrganizacion from '../models/MensajeOrganizacion.js'
import MemoriaFundador from '../models/MemoriaFundador.js'
import {
  procesarMensajeAdmin,
  procesarMensajeAdminBackground,
  generarReporteDiarioCEO,
  procesarAscensosAutomaticos
} from '../services/cerebro.js'

const router = Router()

// Todas las rutas requieren admin
router.use(verificarToken, soloAdmin)

const CANALES_VALIDOS = ['general', 'privado_ceo', 'reporte', 'ascensos']

/**
 * GET /api/cerebro/agentes
 * Lista todos los agentes con métricas resumidas.
 */
router.get('/agentes', async (req, res) => {
  try {
    const agentes = await Agente.find({})
      .sort({ rango: 1, 'metricas.xp': -1 })
      .lean()
    res.json(agentes)
  } catch (e) {
    console.error('Error listando agentes:', e)
    res.status(500).json({ error: 'Error al cargar agentes' })
  }
})

/**
 * GET /api/cerebro/agentes/:slug
 * Detalle completo de un agente.
 */
router.get('/agentes/:slug', async (req, res) => {
  try {
    const agente = await Agente.findOne({ slug: req.params.slug })
      .populate('reportaA', 'slug nombre titulo')
      .lean()
    if (!agente) return res.status(404).json({ error: 'Agente no encontrado' })
    res.json(agente)
  } catch (e) {
    res.status(500).json({ error: 'Error al cargar agente' })
  }
})

/**
 * GET /api/cerebro/mensajes/:canal?limit=50&antes=ISO
 * Últimos mensajes de un canal (paginación inversa por fecha).
 */
router.get('/mensajes/:canal', async (req, res) => {
  try {
    const { canal } = req.params
    if (!CANALES_VALIDOS.includes(canal)) {
      return res.status(400).json({ error: 'Canal inválido' })
    }
    const limit = Math.min(parseInt(req.query.limit) || 50, 200)
    const filtro = { canal }
    if (req.query.antes) {
      filtro.createdAt = { $lt: new Date(req.query.antes) }
    }
    const mensajes = await MensajeOrganizacion
      .find(filtro)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
    // Devolvemos en orden cronológico ascendente (para el render del chat)
    res.json(mensajes.reverse())
  } catch (e) {
    console.error('Error mensajes canal:', e)
    res.status(500).json({ error: 'Error al cargar mensajes' })
  }
})

/**
 * POST /api/cerebro/mensajes/:canal
 * El admin manda un mensaje y los agentes responden (en cadena).
 * Body: { contenido: string }
 */
router.post('/mensajes/:canal', async (req, res) => {
  const inicio = Date.now()
  console.log(`📨 [CEREBRO] ${req.params.canal} ← "${req.body?.contenido?.slice(0, 80)}"`)
  try {
    const { canal } = req.params
    const { contenido } = req.body

    if (!CANALES_VALIDOS.includes(canal)) {
      return res.status(400).json({ error: 'Canal inválido' })
    }
    if (!contenido || typeof contenido !== 'string' || contenido.trim().length < 1) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío' })
    }
    if (contenido.length > 4000) {
      return res.status(400).json({ error: 'Máximo 4000 caracteres' })
    }

    // ARQUITECTURA SÍNCRONA: esperamos las respuestas de los agentes y las
    // devolvemos en el response. Tarda 2-6 segundos (Gemini Flash).
    //
    // El frontend muestra "X está escribiendo..." mientras espera, y cuando
    // llega el response pinta las respuestas. Sin polling, sin race
    // conditions, sin setImmediate frágil.
    const resultado = await procesarMensajeAdmin(canal, contenido.trim())
    const duracion = Date.now() - inicio
    console.log(`✅ [CEREBRO] ${canal} | ${resultado.respuestas.length} respuesta(s) en ${duracion}ms`)
    res.json({
      ok: true,
      mensajeAdmin: resultado.mensajeAdmin,
      respuestas: resultado.respuestas,
      duracionMs: duracion
    })
  } catch (e) {
    console.error(`❌ [CEREBRO] ${req.params.canal} falló en ${Date.now() - inicio}ms:`, e.message)
    console.error('Stack:', e.stack?.split('\n').slice(0, 5).join('\n'))
    res.status(500).json({
      error: 'Error al procesar tu mensaje',
      detalle: e.message,
      tipo: e.name
    })
  }
})

/**
 * POST /api/cerebro/reacciones/:msgId
 * El admin reacciona a un mensaje con un emoji.
 * Body: { emoji: string }
 */
router.post('/reacciones/:msgId', async (req, res) => {
  try {
    const { emoji } = req.body
    if (!emoji || emoji.length > 8) {
      return res.status(400).json({ error: 'Emoji inválido' })
    }
    const mensaje = await MensajeOrganizacion.findById(req.params.msgId)
    if (!mensaje) return res.status(404).json({ error: 'Mensaje no encontrado' })

    // Si el admin ya reaccionó con este emoji, lo quitamos (toggle)
    const idx = mensaje.reacciones.findIndex(
      r => r.agenteSlug === 'admin' && r.emoji === emoji
    )
    if (idx >= 0) {
      mensaje.reacciones.splice(idx, 1)
    } else {
      mensaje.reacciones.push({ agenteSlug: 'admin', emoji, fecha: new Date() })
    }
    await mensaje.save()
    res.json(mensaje)
  } catch (e) {
    res.status(500).json({ error: 'Error al reaccionar' })
  }
})

/**
 * POST /api/cerebro/reporte-ahora
 * Fuerza la generación del reporte diario del CEO en este momento.
 * Útil para testear o para reportes bajo demanda.
 */
router.post('/reporte-ahora', async (req, res) => {
  try {
    const mensaje = await generarReporteDiarioCEO()
    if (!mensaje) {
      return res.status(500).json({ error: 'No se pudo generar el reporte (verificá ANTHROPIC_API_KEY)' })
    }
    res.json({ ok: true, mensaje })
  } catch (e) {
    console.error('Error generando reporte:', e)
    res.status(500).json({ error: 'Error generando reporte' })
  }
})

/**
 * POST /api/cerebro/ascensos
 * Ejecuta el proceso de ascensos automáticos.
 */
router.post('/ascensos', async (req, res) => {
  try {
    const ascendidos = await procesarAscensosAutomaticos()
    res.json({ ok: true, ascendidos })
  } catch (e) {
    res.status(500).json({ error: 'Error procesando ascensos' })
  }
})

/**
 * GET /api/cerebro/no-leidos
 * Cantidad de mensajes no leídos por canal (para los badges).
 */
router.get('/no-leidos', async (req, res) => {
  try {
    const conteo = await MensajeOrganizacion.aggregate([
      { $match: { leidoPorAdmin: false, autorTipo: { $ne: 'admin' } } },
      { $group: { _id: '$canal', count: { $sum: 1 } } }
    ])
    const resultado = { general: 0, privado_ceo: 0, reporte: 0, ascensos: 0 }
    conteo.forEach(c => { resultado[c._id] = c.count })
    res.json(resultado)
  } catch (e) {
    res.status(500).json({ error: 'Error contando no leídos' })
  }
})

/**
 * POST /api/cerebro/marcar-leido/:canal
 * Marca todos los mensajes de un canal como leídos por el admin.
 */
router.post('/marcar-leido/:canal', async (req, res) => {
  try {
    const { canal } = req.params
    if (!CANALES_VALIDOS.includes(canal)) {
      return res.status(400).json({ error: 'Canal inválido' })
    }
    await MensajeOrganizacion.updateMany(
      { canal, leidoPorAdmin: false },
      { $set: { leidoPorAdmin: true } }
    )
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Error al marcar como leído' })
  }
})

// ============================================================
// MEMORIA DEL FUNDADOR — hechos que TODOS los agentes recuerdan
// ============================================================

/**
 * GET /api/cerebro/memoria
 * Lista todos los hechos de la memoria, ordenados por importancia.
 */
router.get('/memoria', async (req, res) => {
  try {
    const hechos = await MemoriaFundador
      .find({})
      .sort({ importancia: -1, createdAt: 1 })
      .lean()
    res.json(hechos)
  } catch (e) {
    res.status(500).json({ error: 'Error al cargar la memoria' })
  }
})

/**
 * POST /api/cerebro/memoria
 * Agrega un hecho nuevo a la memoria persistente.
 * Body: { hecho, categoria, importancia }
 */
router.post('/memoria', async (req, res) => {
  try {
    const { hecho, categoria, importancia } = req.body
    if (!hecho || typeof hecho !== 'string' || hecho.trim().length < 5) {
      return res.status(400).json({ error: 'El hecho debe tener al menos 5 caracteres' })
    }
    const nuevo = await new MemoriaFundador({
      hecho: hecho.trim().slice(0, 500),
      categoria: categoria || 'identidad',
      importancia: Math.max(1, Math.min(10, parseInt(importancia) || 5)),
      creadoPor: 'admin'
    }).save()
    res.json(nuevo)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/**
 * PUT /api/cerebro/memoria/:id
 * Actualiza un hecho existente.
 */
router.put('/memoria/:id', async (req, res) => {
  try {
    const { hecho, categoria, importancia, activo } = req.body
    const update = {}
    if (hecho !== undefined) update.hecho = String(hecho).trim().slice(0, 500)
    if (categoria !== undefined) update.categoria = categoria
    if (importancia !== undefined) update.importancia = Math.max(1, Math.min(10, parseInt(importancia)))
    if (activo !== undefined) update.activo = Boolean(activo)
    const actualizado = await MemoriaFundador.findByIdAndUpdate(req.params.id, update, { new: true })
    if (!actualizado) return res.status(404).json({ error: 'Hecho no encontrado' })
    res.json(actualizado)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/**
 * DELETE /api/cerebro/memoria/:id
 * Elimina un hecho de la memoria (físicamente, no es soft delete).
 */
router.delete('/memoria/:id', async (req, res) => {
  try {
    const borrado = await MemoriaFundador.findByIdAndDelete(req.params.id)
    if (!borrado) return res.status(404).json({ error: 'Hecho no encontrado' })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
