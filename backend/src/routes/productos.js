import { Router } from 'express'
import { verificarToken, soloTieneVendedor } from '../middleware/auth.js'
import { crearProducto, obtenerProducto, listarProductos, actualizarProducto, eliminarProducto, productosDetienda, productosDeMiTienda, obtenerCiudadesDisponibles } from '../services/productoService.js'
import { obtenerMiTienda } from '../services/tiendaService.js'
import Destacado from '../models/Destacado.js'
import { emitNuevoProducto, emitProductoActualizado, emitProductoEliminado } from '../services/socketService.js'

const router = Router()

// GET /api/productos - Listar productos del catálogo público (paginado por cursor)
//
// Query params:
//   busqueda, categoria, ciudad, precioMin, precioMax, tiendaId, ordenar
//   limite (default 24, máx 100)
//   cursor (opcional, _id del último producto de la página anterior)
//
// Respuesta:
//   {
//     productos: [...],
//     siguienteCursor: 'objectId' | null,
//     hayMas: boolean
//   }
//
// Para retrocompatibilidad: si no se pasa cursor, devuelve array directo
// (los clientes viejos siguen funcionando).
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
      limite: req.query.limite,
      cursor: req.query.cursor
    }

    const { productos, siguienteCursor, hayMas } = await listarProductos(filtros)

    let listaFinal = productos

    // Insertar productos destacados al inicio del listado (solo en la primera página)
    if (!filtros.cursor) {
      try {
        const ahora = new Date()
        const destacados = await Destacado.find({
          activo: true,
          estado: 'activo',
          fechaFin: { $gt: ahora },
          fechaInicio: { $lte: ahora },
          ubicacion: 'catalogo'
        }).select('productoId').lean()

        const idsDestacados = new Set(destacados.map(d => d.productoId.toString()))

        if (idsDestacados.size > 0) {
          const prodsDestacados = listaFinal.filter(p => idsDestacados.has(p._id.toString()))
          const prodsNormales = listaFinal.filter(p => !idsDestacados.has(p._id.toString()))
          // Marcar como destacado (objeto plano porque viene de aggregate, no doc)
          prodsDestacados.forEach(p => { p.esDestacado = true })
          listaFinal = [...prodsDestacados, ...prodsNormales]
        }
      } catch {}
    }

    // Retrocompatibilidad: si no usan cursor, devolver array directo
    // (frontend viejo que espera Producto[] sigue funcionando)
    if (!req.query.cursor && req.query.formato !== 'paginado') {
      return res.json(listaFinal)
    }

    res.json({ productos: listaFinal, siguienteCursor, hayMas })
  } catch (error) {
    console.error('Error listando productos:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/productos/mis-productos - Productos del vendedor logueado (sin filtro de MP)
// IMPORTANTE: debe ir ANTES de /:id para que no choque con esa ruta
router.get('/mis-productos', verificarToken, soloTieneVendedor, async (req, res) => {
  try {
    const tienda = await obtenerMiTienda(req.usuario.id)
    if (!tienda) {
      return res.status(400).json({ error: 'No tenés una tienda' })
    }
    const productos = await productosDeMiTienda(tienda._id)
    res.json(productos)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/productos/ciudades - Ciudades con productos disponibles (público)
// Devuelve [{ ciudad, cantidad }] para poblar el selector de ciudad del catálogo.
// IMPORTANTE: debe ir ANTES de /:id para que no choque con esa ruta.
router.get('/ciudades', async (_req, res) => {
  try {
    const ciudades = await obtenerCiudadesDisponibles()
    res.json(ciudades)
  } catch (error) {
    console.error('Error obteniendo ciudades:', error)
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
router.post('/', verificarToken, soloTieneVendedor, async (req, res) => {
  try {
    const tienda = await obtenerMiTienda(req.usuario.id)
    if (!tienda) {
      return res.status(400).json({ error: 'Primero debes crear una tienda' })
    }

    // Bloqueo: sin MP vinculado no se puede publicar (evita pagos sin trazabilidad)
    if (!tienda.mpVinculado) {
      return res.status(403).json({
        error: 'Debés vincular tu cuenta de Mercado Pago antes de publicar productos. Ingresá a "Central Vendedor" → "Vincular Mercado Pago".',
        code: 'MP_NO_VINCULADO'
      })
    }

    const producto = await crearProducto(tienda._id, req.body)
    console.log(`✅ Nuevo producto: "${producto.nombre}" en tienda "${tienda.nombre}"`)
    emitNuevoProducto(producto)
    res.status(201).json(producto)
  } catch (error) {
    if (error.code === 'MP_NO_VINCULADO') {
      return res.status(403).json({ error: error.message, code: 'MP_NO_VINCULADO' })
    }
    if (error.code === 'CONTENIDO_INVALIDO') {
      return res.status(400).json({ error: error.message, code: 'CONTENIDO_INVALIDO' })
    }
    if (error.code === 'CODIGO_BARRAS_REQUERIDO' || error.code === 'CODIGO_BARRAS_INVALIDO') {
      return res.status(400).json({ error: error.message, code: error.code })
    }
    if (error.code === 'CATEGORIA_INVALIDA') {
      return res.status(400).json({ error: error.message, code: 'CATEGORIA_INVALIDA' })
    }
    if (error.code === 'CAMPOS_OBLIGATORIOS_FALTANTES') {
      return res.status(400).json({
        error: error.message,
        code: 'CAMPOS_OBLIGATORIOS_FALTANTES',
        faltantes: error.faltantes || []
      })
    }
    if (error.code === 'ENTREGA_INVALIDA') {
      return res.status(400).json({ error: error.message, code: 'ENTREGA_INVALIDA' })
    }
    res.status(400).json({ error: error.message })
  }
})

// PUT /api/productos/:id - Actualizar (solo dueño)
// Permite editar productos existentes aunque no esté MP vinculado.
// Los productos quedan ocultos del catálogo público vía listarProductos hasta que vincule.
router.put('/:id', verificarToken, soloTieneVendedor, async (req, res) => {
  try {
    const tienda = await obtenerMiTienda(req.usuario.id)
    if (!tienda) {
      return res.status(400).json({ error: 'No tienes una tienda' })
    }

    const producto = await actualizarProducto(req.params.id, tienda._id, req.body)
    emitProductoActualizado(producto)
    res.json(producto)
  } catch (error) {
    if (error.code === 'CONTENIDO_INVALIDO') {
      return res.status(400).json({ error: error.message, code: 'CONTENIDO_INVALIDO' })
    }
    if (error.code === 'CODIGO_BARRAS_INVALIDO') {
      return res.status(400).json({ error: error.message, code: 'CODIGO_BARRAS_INVALIDO' })
    }
    if (error.code === 'CATEGORIA_INVALIDA') {
      return res.status(400).json({ error: error.message, code: 'CATEGORIA_INVALIDA' })
    }
    if (error.code === 'CAMPOS_OBLIGATORIOS_FALTANTES') {
      return res.status(400).json({
        error: error.message,
        code: 'CAMPOS_OBLIGATORIOS_FALTANTES',
        faltantes: error.faltantes || []
      })
    }
    if (error.code === 'ENTREGA_INVALIDA') {
      return res.status(400).json({ error: error.message, code: 'ENTREGA_INVALIDA' })
    }
    res.status(400).json({ error: error.message })
  }
})

// DELETE /api/productos/:id - Eliminar (solo dueño)
router.delete('/:id', verificarToken, soloTieneVendedor, async (req, res) => {
  try {
    const tienda = await obtenerMiTienda(req.usuario.id)
    if (!tienda) {
      return res.status(400).json({ error: 'No tienes una tienda' })
    }

    await eliminarProducto(req.params.id, tienda._id)
    emitProductoEliminado(req.params.id)
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
