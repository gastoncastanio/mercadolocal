import { Router } from 'express'
import { verificarToken, soloVendedor } from '../middleware/auth.js'
import { crearProducto, obtenerProducto, listarProductos, actualizarProducto, eliminarProducto, productosDetienda } from '../services/productoService.js'
import { obtenerMiTienda } from '../services/tiendaService.js'

const router = Router()

// GET /api/productos - Listar todos (público)
router.get('/', async (req, res) => {
  try {
    const filtros = {
      busqueda: req.query.busqueda,
      categoria: req.query.categoria,
      ciudad: req.query.ciudad,
      precioMin: req.query.precioMin,
      precioMax: req.query.precioMax,
      tiendaId: req.query.tiendaId,
      ordenar: req.query.ordenar,
      limite: req.query.limite
    }

    const productos = await listarProductos(filtros)
    res.json(productos)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/productos/:id - Ver detalle (público)
router.get('/:id', async (req, res) => {
  try {
    const producto = await obtenerProducto(req.params.id)
    res.json(producto)
  } catch (error) {
    res.status(404).json({ error: error.message })
  }
})

// POST /api/productos - Crear (solo vendedor)
router.post('/', verificarToken, soloVendedor, async (req, res) => {
  try {
    const tienda = await obtenerMiTienda(req.usuario.id)
    if (!tienda) {
      return res.status(400).json({ error: 'Primero debes crear una tienda' })
    }

    const producto = await crearProducto(tienda._id, req.body)
    console.log(`✅ Nuevo producto: "${producto.nombre}" en tienda "${tienda.nombre}"`)
    res.status(201).json(producto)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// PUT /api/productos/:id - Actualizar (solo dueño)
router.put('/:id', verificarToken, soloVendedor, async (req, res) => {
  try {
    const tienda = await obtenerMiTienda(req.usuario.id)
    if (!tienda) {
      return res.status(400).json({ error: 'No tienes una tienda' })
    }

    const producto = await actualizarProducto(req.params.id, tienda._id, req.body)
    res.json(producto)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// DELETE /api/productos/:id - Eliminar (solo dueño)
router.delete('/:id', verificarToken, soloVendedor, async (req, res) => {
  try {
    const tienda = await obtenerMiTienda(req.usuario.id)
    if (!tienda) {
      return res.status(400).json({ error: 'No tienes una tienda' })
    }

    await eliminarProducto(req.params.id, tienda._id)
    res.json({ mensaje: 'Producto eliminado' })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// GET /api/productos/tienda/:tiendaId - Productos de una tienda
router.get('/tienda/:tiendaId', async (req, res) => {
  try {
    const productos = await productosDetienda(req.params.tiendaId)
    res.json(productos)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
