import express from 'express'
import Producto from '../models/Producto.js'
import Tienda from '../models/Tienda.js'
import Orden from '../models/Orden.js'

const router = express.Router()

// Cache en memoria para no bombardear la DB en cada visita
let cache = null
let cacheTimestamp = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

// GET /api/stats - Estadisticas publicas para la landing
router.get('/', async (req, res) => {
  try {
    const ahora = Date.now()

    // Devolver cache si es reciente
    if (cache && (ahora - cacheTimestamp) < CACHE_TTL) {
      return res.json(cache)
    }

    const [totalProductos, totalVendedores, totalCompras, ordenesCompletadas, totalOrdenes] = await Promise.all([
      Producto.countDocuments({ activo: true }),
      Tienda.countDocuments({ activo: true }),
      Orden.countDocuments({ estado: { $in: ['pagada', 'enviada', 'completada'] } }),
      Orden.countDocuments({ estado: 'completada' }),
      Orden.countDocuments({ estado: { $in: ['pagada', 'enviada', 'completada', 'cancelada'] } })
    ])

    // Calcular satisfaccion: completadas sin disputa / total completadas
    const satisfaccion = totalOrdenes > 0
      ? Math.round((ordenesCompletadas / totalOrdenes) * 100)
      : 98

    cache = {
      productosPublicados: totalProductos,
      vendedoresActivos: totalVendedores,
      comprasRealizadas: totalCompras,
      satisfaccion: Math.min(satisfaccion, 100)
    }
    cacheTimestamp = ahora

    res.json(cache)
  } catch (err) {
    console.error('Error en stats:', err)
    // Fallback con datos por defecto si falla la DB
    res.json({
      productosPublicados: 0,
      vendedoresActivos: 0,
      comprasRealizadas: 0,
      satisfaccion: 0
    })
  }
})

export default router
