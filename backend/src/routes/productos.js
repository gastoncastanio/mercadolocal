import { Router } from 'express'
import { verificarToken, soloTieneVendedor, tokenOpcional } from '../middleware/auth.js'
import { crearProducto, obtenerProducto, listarProductos, listarProductosPorIds, actualizarProducto, eliminarProducto, productosDetienda, productosDeMiTienda, obtenerCiudadesDisponibles } from '../services/productoService.js'
import { obtenerMiTienda } from '../services/tiendaService.js'
import Destacado from '../models/Destacado.js'
import { resolverIdentidad, obtenerPerfil, scoreRelevancia } from '../services/targetingService.js'
import { emitNuevoProducto, emitProductoActualizado, emitProductoEliminado } from '../services/socketService.js'

// ¿El producto (ya enriquecido) cumple los filtros estructurados del catálogo?
// Se usa para no inyectar un promocionado que no corresponde al filtro activo.
function cumpleFiltros(p, filtros) {
  if (filtros.categoria && !(p.categorias || []).includes(filtros.categoria)) return false
  if (filtros.ciudad && p.ciudad !== filtros.ciudad) return false
  if (filtros.condicion && p.condicion !== filtros.condicion) return false
  if (filtros.precioMin && p.precio < Number(filtros.precioMin)) return false
  if (filtros.precioMax && p.precio > Number(filtros.precioMax)) return false
  if ((filtros.enOferta === 'true' || filtros.enOferta === true) &&
      !(p.precioAnterior && p.precioAnterior > p.precio)) return false
  return true
}

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
router.get('/', tokenOpcional, async (req, res) => {
  try {
    const filtros = {
      busqueda: req.query.busqueda,
      categoria: req.query.categoria,
      ciudad: req.query.ciudad,
      condicion: req.query.condicion,
      enOferta: req.query.enOferta,
      precioMin: req.query.precioMin,
      precioMax: req.query.precioMax,
      tiendaId: req.query.tiendaId,
      ordenar: req.query.ordenar,
      limite: req.query.limite,
      cursor: req.query.cursor
    }

    const { productos, siguienteCursor, hayMas } = await listarProductos(filtros)

    let listaFinal = productos

    // ===== PAUTA INTELIGENTE =====
    // Insertamos los productos promocionados al inicio (solo en la primera página),
    // pero ORDENADOS POR RELEVANCIA para este cliente: el que paga aparece, y lo
    // mostramos primero a quien tiene más chance de comprarlo. Un promocionado que
    // por su orden natural caería en otra página igual sube a la primera.
    // No aplicamos pauta cuando se navega el perfil de una tienda puntual
    // (mostraría productos de otra tienda) ni en páginas siguientes.
    if (!filtros.cursor && !filtros.tiendaId) {
      try {
        const ahora = new Date()
        // En una búsqueda priorizamos la pauta de "busqueda"; navegando, la de "catalogo".
        const ubic = filtros.busqueda ? 'busqueda' : 'catalogo'

        const destacados = await Destacado.find({
          activo: true,
          estado: 'activo',
          fechaFin: { $gt: ahora },
          fechaInicio: { $lte: ahora },
          ubicacion: ubic
        }).select('_id productoId plan segmentoCiudad segmentoCategoria').lean()

        // Respetar segmentación premium (ciudad/categoría) vs el filtro activo
        const aplicables = destacados.filter(d => {
          if (d.segmentoCategoria && filtros.categoria && d.segmentoCategoria !== filtros.categoria) return false
          if (d.segmentoCiudad && filtros.ciudad && d.segmentoCiudad !== filtros.ciudad) return false
          return true
        })

        if (aplicables.length > 0) {
          const planPorId = new Map()
          const destIdPorProd = new Map()
          aplicables.forEach(d => {
            const pid = d.productoId.toString()
            planPorId.set(pid, d.plan)
            destIdPorProd.set(pid, d._id)
          })
          const ids = [...planPorId.keys()]

          // Promocionados que ya están en la página (cumplen filtros por construcción)
          const enWindow = listaFinal.filter(p => planPorId.has(p._id.toString()))
          const idsEnWindow = new Set(enWindow.map(p => p._id.toString()))

          // Promocionados fuera de la página: los traemos y validamos contra los filtros.
          // En búsqueda por texto no los inyectamos (el match de texto no es confiable en JS).
          let fueraWindow = []
          if (!filtros.busqueda) {
            const faltantes = ids.filter(id => !idsEnWindow.has(id))
            const traidos = await listarProductosPorIds(faltantes)
            fueraWindow = traidos.filter(p => cumpleFiltros(p, filtros))
          }

          let promocionados = [...enWindow, ...fueraWindow]

          if (promocionados.length > 0) {
            // Ordenar por relevancia para este cliente (perfil de interés) × plan
            const identity = resolverIdentidad(req)
            const perfil = await obtenerPerfil(identity)
            const pesoPlan = { elite: 1, premium: 0.6, basico: 0.3 }
            promocionados.forEach(p => {
              const rel = scoreRelevancia(p, perfil)
              const plan = pesoPlan[planPorId.get(p._id.toString())] || 0.3
              p.promocionado = true
              p._rel = rel
              p._score = rel * 6 + plan * 2
            })
            promocionados.sort((a, b) => b._score - a._score)
            promocionados = promocionados.slice(0, 12)

            const idsProm = new Set(promocionados.map(p => p._id.toString()))
            const normales = listaFinal.filter(p => !idsProm.has(p._id.toString()))
            listaFinal = [...promocionados, ...normales]

            // Contabilizar impresiones (y relevantes cuando hubo match con el perfil)
            const idsDest = promocionados.map(p => destIdPorProd.get(p._id.toString())).filter(Boolean)
            const idsDestRelevantes = promocionados
              .filter(p => p._rel > 0)
              .map(p => destIdPorProd.get(p._id.toString())).filter(Boolean)
            if (idsDest.length > 0) {
              Destacado.updateMany({ _id: { $in: idsDest } }, { $inc: { impresiones: 1 } }).catch(() => {})
            }
            if (idsDestRelevantes.length > 0) {
              Destacado.updateMany({ _id: { $in: idsDestRelevantes } }, { $inc: { impresionesRelevantes: 1 } }).catch(() => {})
            }
            // Limpiar campos internos antes de responder
            promocionados.forEach(p => { delete p._score; delete p._rel })
          }
        }
      } catch (e) {
        console.warn('Pauta inteligente en catálogo falló:', e.message)
      }
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
