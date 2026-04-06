import { Router } from 'express'
import { verificarToken, soloVendedor } from '../middleware/auth.js'
import { crearTienda, obtenerTienda, obtenerMiTienda, actualizarTienda, listarTiendas } from '../services/tiendaService.js'

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

// GET /api/tienda/mi-tienda - Mi tienda (vendedor)
router.get('/mi-tienda', verificarToken, soloVendedor, async (req, res) => {
  try {
    const tienda = await obtenerMiTienda(req.usuario.id)
    if (!tienda) {
      return res.status(404).json({ error: 'No tienes una tienda todavía' })
    }
    res.json(tienda)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/tienda - Crear tienda (vendedor)
router.post('/', verificarToken, soloVendedor, async (req, res) => {
  try {
    const tienda = await crearTienda(req.usuario.id, req.body)
    console.log(`✅ Nueva tienda creada: "${tienda.nombre}" por ${req.usuario.nombre}`)
    res.status(201).json(tienda)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PUT /api/tienda - Actualizar mi tienda (vendedor)
router.put('/', verificarToken, soloVendedor, async (req, res) => {
  try {
    const tienda = await actualizarTienda(req.usuario.id, req.body)
    res.json(tienda)
  } catch (error) {
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

export default router
