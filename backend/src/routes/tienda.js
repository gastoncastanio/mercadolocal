import { Router } from 'express'
import { verificarToken, soloTieneVendedor, tokenOpcional } from '../middleware/auth.js'
import { crearTienda, obtenerTienda, obtenerMiTienda, actualizarTienda, listarTiendas, listarTiendasOficiales } from '../services/tiendaService.js'
import { emitNuevaTienda, emitTiendaActualizada } from '../services/socketService.js'
import SeguidorTienda from '../models/SeguidorTienda.js'

const router = Router()

// GET /api/tienda - Listar todas las tiendas (público)
router.get('/', async (req, res) => {
  try {
    const tiendas = await listarTiendas()
    res.json(tiendas)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/tienda/oficiales - Vidriera de marcas (tiendas oficiales verificadas).
// IMPORTANTE: definida ANTES de /:id para que no la capture como un id.
router.get('/oficiales', async (req, res) => {
  try {
    res.json(await listarTiendasOficiales())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/tienda/mi-tienda - Mi tienda (comprador que tiene tienda)
router.get('/mi-tienda', verificarToken, soloTieneVendedor, async (req, res) => {
  try {    const tienda = await obtenerMiTienda(req.usuario.id)
    if (!tienda) {
      return res.status(404).json({ error: 'No tienes una tienda todavía' })
    }
    res.json(tienda)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/tienda - Crear tienda (cualquier usuario autenticado)
router.post('/', verificarToken, async (req, res) => {
  try {
    const tienda = await crearTienda(req.usuario.id, req.body)
    console.log(`✅ Nueva tienda creada: "${tienda.nombre}" por ${req.usuario.nombre}`)
    emitNuevaTienda(tienda)
    emitTiendaActualizada(tienda)
    res.status(201).json(tienda)
  } catch (error) {
    if (error.code === 'CONTENIDO_INVALIDO') {
      return res.status(400).json({ error: error.message, code: 'CONTENIDO_INVALIDO' })
    }
    res.status(400).json({ error: error.message })
  }
})

// PUT /api/tienda - Actualizar mi tienda (comprador que tiene tienda)
router.put('/', verificarToken, soloTieneVendedor, async (req, res) => {
  try {
    const tienda = await actualizarTienda(req.usuario.id, req.body)
    emitTiendaActualizada(tienda)
    res.json(tienda)
  } catch (error) {
    if (error.code === 'CONTENIDO_INVALIDO') {
      return res.status(400).json({ error: error.message, code: 'CONTENIDO_INVALIDO' })
    }
    res.status(400).json({ error: error.message })
  }
})

// GET /api/tienda/:id - Ver tienda (público)
router.get('/:id', async (req, res) => {
  try {
    const tienda = await obtenerTienda(req.params.id)
    res.json(tienda)
  } catch (error) {
    res.status(404).json({ error: error.message })
  }
})

// GET /api/tienda/:id/seguidores - Cantidad de seguidores + si el usuario sigue
router.get('/:id/seguidores', tokenOpcional, async (req, res) => {
  try {
    const tiendaId = req.params.id
    const seguidores = await SeguidorTienda.countDocuments({ tiendaId })
    let siguiendo = false
    if (req.usuario?.id) {
      siguiendo = !!(await SeguidorTienda.findOne({ usuarioId: req.usuario.id, tiendaId }))
    }
    res.json({ seguidores, siguiendo })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/tienda/:id/seguir - Seguir / dejar de seguir (toggle)
router.post('/:id/seguir', verificarToken, async (req, res) => {
  try {
    const tiendaId = req.params.id
    const usuarioId = req.usuario.id
    const existe = await SeguidorTienda.findOne({ usuarioId, tiendaId })
    let siguiendo
    if (existe) {
      await SeguidorTienda.deleteOne({ _id: existe._id })
      siguiendo = false
    } else {
      try {
        await SeguidorTienda.create({ usuarioId, tiendaId })
      } catch (e) {
        // Carrera de doble click contra el índice único: lo tratamos como ya seguido
        if (e.code !== 11000) throw e
      }
      siguiendo = true
    }
    const seguidores = await SeguidorTienda.countDocuments({ tiendaId })
    res.json({ siguiendo, seguidores })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
