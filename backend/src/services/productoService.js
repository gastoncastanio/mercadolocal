import mongoose from 'mongoose'
import Producto from '../models/Producto.js'
import Tienda from '../models/Tienda.js'
import Moderacion from '../models/Moderacion.js'
import { validarPublicacion, construirMensajeRechazo } from '../utils/validacionContenido.js'
import { validarCodigoBarras, normalizarCodigoBarras } from '../utils/codigoBarras.js'
import { validarCamposObligatoriosCategoria, categoriaValida } from '../constants/categoriasMeta.js'
import { normalizarEntrega, validarEntrega, construirMensajeEntregaInvalida } from '../utils/entrega.js'
import { moderarProducto } from './agenteModeracion.js'

/**
 * Modalidad de entrega por defecto para productos viejos que no tenían
 * este campo. Se asume "envío por correo a coordinar" para no romper nada.
 */
const ENTREGA_DEFAULT_LEGACY = {
  retiroEnLocal: { activo: false, direccion: '', horarios: '' },
  envioPropio: { activo: false, zonas: '', notas: '' },
  envioCorreo: { activo: true, empresas: '' }
}

// Categorías que REQUIEREN código de barras obligatorio (alto riesgo legal/fraude)
// - Electrónica: detecta IMEI bloqueados y permite verificar contra catálogo
// - Alimentos: RNPA va en el código, sirve para trazabilidad
// - Belleza: verificación ANMAT
// - Electrodomésticos: garantía oficial requiere serie/código
const CATEGORIAS_REQUIEREN_CODIGO_BARRAS = new Set([
  'electronica',
  'alimentos',
  'belleza',
  'electrodomesticos'
])

// Crear producto
export async function crearProducto(tiendaId, datos) {
  const tienda = await Tienda.findById(tiendaId)
  if (!tienda) throw new Error('Tienda no encontrada')

  // Bloqueo crítico: no se permite publicar sin Mercado Pago vinculado
  // (los pagos caerían en cuenta admin sin trazabilidad)
  if (!tienda.mpVinculado) {
    const error = new Error('Debés vincular tu cuenta de Mercado Pago antes de publicar productos. Ingresá a "Central Vendedor" → "Vincular Mercado Pago".')
    error.code = 'MP_NO_VINCULADO'
    throw error
  }

  // Validación de contenido: no permitir teléfonos, emails, URLs, redes sociales
  // ni frases que inviten a contactar fuera del marketplace
  const validacion = validarPublicacion({
    titulo: datos.nombre,
    descripcion: datos.descripcion
  })
  if (!validacion.valido) {
    const error = new Error(construirMensajeRechazo(validacion.motivos))
    error.code = 'CONTENIDO_INVALIDO'
    throw error
  }

  // ===== Validación de código de barras =====
  // En categorías de alto riesgo (electrónica, alimentos, belleza, electrodomésticos)
  // el código es OBLIGATORIO. En el resto es opcional.
  const categoriaPrincipal = (datos.categorias && datos.categorias[0]) || ''
  const requiereCodigo = CATEGORIAS_REQUIEREN_CODIGO_BARRAS.has(categoriaPrincipal)
  let codigoBarrasNormalizado = ''

  if (datos.codigoBarras) {
    const validacionCodigo = validarCodigoBarras(datos.codigoBarras)
    if (!validacionCodigo.valido) {
      const error = new Error(validacionCodigo.motivo)
      error.code = 'CODIGO_BARRAS_INVALIDO'
      throw error
    }
    codigoBarrasNormalizado = normalizarCodigoBarras(datos.codigoBarras)
  } else if (requiereCodigo) {
    const error = new Error(
      'Para esta categoría es obligatorio el código de barras del producto. ' +
      'Lo encontrás en la etiqueta del producto (EAN-13 o UPC). ' +
      'Esto permite verificar el producto y agruparlo con otros vendedores que lo tienen.'
    )
    error.code = 'CODIGO_BARRAS_REQUERIDO'
    throw error
  }

  // ===== Validación de categoría válida =====
  if (categoriaPrincipal && !categoriaValida(categoriaPrincipal)) {
    const error = new Error(`La categoría "${categoriaPrincipal}" no existe.`)
    error.code = 'CATEGORIA_INVALIDA'
    throw error
  }

  // ===== Validación de campos personalizados obligatorios =====
  const validacionCampos = validarCamposObligatoriosCategoria(
    datos.categorias || [],
    datos.caracteristicas || []
  )
  if (!validacionCampos.valido) {
    const error = new Error(
      `Faltan datos obligatorios para esta categoría: ${validacionCampos.faltantes.join(', ')}`
    )
    error.code = 'CAMPOS_OBLIGATORIOS_FALTANTES'
    error.faltantes = validacionCampos.faltantes
    throw error
  }

  // Normalizar características: solo guardar items con valor válido,
  // limitar tamaño para evitar abuso de memoria
  const caracteristicasLimpias = (Array.isArray(datos.caracteristicas) ? datos.caracteristicas : [])
    .filter(c => c && c.clave && typeof c.valor === 'string' && c.valor.trim() !== '')
    .slice(0, 30) // máx 30 características por producto
    .map(c => ({
      clave: String(c.clave).trim().slice(0, 50),
      valor: String(c.valor).trim().slice(0, 200)
    }))

  // ===== Validación de modalidades de entrega =====
  // Al menos una modalidad debe estar activa para publicar
  const entregaNormalizada = normalizarEntrega(datos.entrega)
  const validacionEntrega = validarEntrega(entregaNormalizada)
  if (!validacionEntrega.valido) {
    const error = new Error(construirMensajeEntregaInvalida(validacionEntrega.motivos))
    error.code = 'ENTREGA_INVALIDA'
    throw error
  }

  // ===== AGENTE-MODERACIÓN =====
  // Antes de guardar, el agente IA decide si aprobar, mandar a revisión o rechazar.
  // Si rechaza con alta confianza, el producto ni siquiera se crea.
  // Si aprueba, sale al catálogo de inmediato.
  // Si pasa a revisión, se publica pero queda marcado para revisión humana
  // (filosofía Mercado Libre: no frustrar al vendedor, pero auditar).
  const totalProductos = await Producto.countDocuments({ tiendaId })
  const moderacionResultado = await moderarProducto(
    {
      nombre: datos.nombre,
      descripcion: datos.descripcion || '',
      precio: datos.precio,
      categorias: datos.categorias || [],
      marca: datos.marca,
      codigoBarras: codigoBarrasNormalizado,
      cantidadImagenes: (datos.imagenes || []).length
    },
    {
      vendedorNuevo: totalProductos === 0,
      totalProductos,
      calificacionTienda: tienda.calificacion || 0
    }
  )

  // Si el agente rechaza con alta confianza, bloqueamos la publicación
  if (moderacionResultado.decision === 'rechazado' && moderacionResultado.confianza >= 70) {
    // Registramos el rechazo para auditoría (aunque no se haya creado el producto)
    try {
      await new Moderacion({
        productoId: new (await import('mongoose')).default.Types.ObjectId(), // placeholder
        tiendaId,
        decision: 'rechazado',
        confianza: moderacionResultado.confianza,
        motivos: moderacionResultado.motivos,
        banderas: moderacionResultado.banderas,
        snapshot: {
          nombre: datos.nombre,
          descripcion: (datos.descripcion || '').slice(0, 500),
          precio: datos.precio,
          categorias: datos.categorias || [],
          cantidadImagenes: (datos.imagenes || []).length,
          marca: datos.marca || ''
        },
        tokens: moderacionResultado.tokens,
        duracionMs: moderacionResultado.duracionMs
      }).save()
    } catch (e) {
      console.warn('No se pudo registrar rechazo de moderación:', e.message)
    }

    const error = new Error(
      moderacionResultado.motivos.join(' ') ||
      'Tu producto no pudo ser publicado. Verificá los datos e intentá nuevamente.'
    )
    error.code = 'MODERACION_RECHAZADO'
    error.banderas = moderacionResultado.banderas
    throw error
  }

  // Si el agente decide "revision" o "aprobado", se crea el producto
  const estadoModeracion = moderacionResultado.decision === 'aprobado' ? 'aprobado' : 'revision'

  // Condición (nuevo/usado/reacondicionado) — sección Usados
  const condicionNormalizada = ['nuevo', 'usado', 'reacondicionado'].includes(datos.condicion)
    ? datos.condicion
    : 'nuevo'
  // Precio anterior (tachado) — solo válido si es mayor al precio actual (oferta real)
  const precioAnteriorNum = Number(datos.precioAnterior)
  const precioAnteriorNormalizado = (precioAnteriorNum > 0 && precioAnteriorNum > Number(datos.precio))
    ? precioAnteriorNum
    : null

  const producto = new Producto({
    tiendaId,
    nombre: datos.nombre,
    descripcion: datos.descripcion || '',
    precio: datos.precio,
    precioAnterior: precioAnteriorNormalizado,
    condicion: condicionNormalizada,
    stock: datos.stock || 1,
    imagenes: datos.imagenes || [],
    categorias: datos.categorias || [],
    ciudad: tienda.ciudad,
    codigoBarras: codigoBarrasNormalizado,
    marca: (datos.marca || '').trim().slice(0, 80),
    caracteristicas: caracteristicasLimpias,
    entrega: entregaNormalizada,
    cuotasSinInteres: [1, 3, 6, 12].includes(Number(datos.cuotasSinInteres)) ? Number(datos.cuotasSinInteres) : 1,
    moderacion: {
      estado: estadoModeracion,
      motivo: moderacionResultado.motivos.join(' ').slice(0, 1000),
      confianza: moderacionResultado.confianza,
      fecha: new Date()
    }
  })

  await producto.save()

  // Registramos la moderación para auditoría
  try {
    await new Moderacion({
      productoId: producto._id,
      tiendaId,
      decision: moderacionResultado.decision,
      confianza: moderacionResultado.confianza,
      motivos: moderacionResultado.motivos,
      banderas: moderacionResultado.banderas,
      snapshot: {
        nombre: datos.nombre,
        descripcion: (datos.descripcion || '').slice(0, 500),
        precio: datos.precio,
        categorias: datos.categorias || [],
        cantidadImagenes: (datos.imagenes || []).length,
        marca: datos.marca || ''
      },
      tokens: moderacionResultado.tokens,
      duracionMs: moderacionResultado.duracionMs
    }).save()
  } catch (e) {
    console.warn('No se pudo registrar moderación aprobada:', e.message)
  }

  // Disparar evento del cerebro: Sofía postea en sala común si hay
  // bandera relevante. Es async pero NO await — no bloquea la creación.
  if (moderacionResultado.decision !== 'aprobado' && moderacionResultado.confianza >= 70) {
    import('./eventosCerebro.js')
      .then(m => m.disparoSofiaModeracionAlerta(producto, moderacionResultado))
      .catch(err => console.warn('Evento Sofía no disparó:', err.message))
  }

  return producto
}

// Obtener producto por ID
export async function obtenerProducto(productoId) {
  const producto = await Producto.findById(productoId).populate('tiendaId', 'nombre nombreCorto ciudad logo oficial marca')
  if (!producto) throw new Error('Producto no encontrado')
  return producto
}

/**
 * Listar productos del catálogo público con filtros y paginación.
 *
 * IMPORTANTE: solo retorna productos cuya tienda tenga MP vinculado.
 *
 * Usa aggregation pipeline ($lookup) en lugar de populate + filter en RAM
 * para escalar a 10.000+ productos sin problemas de performance.
 *
 * Soporta paginación por cursor (más eficiente que skip/limit a escala).
 *
 * @param {Object} filtros
 * @param {string} filtros.busqueda - texto a buscar
 * @param {string} filtros.categoria - id de categoría
 * @param {string} filtros.ciudad - ciudad
 * @param {number} filtros.precioMin
 * @param {number} filtros.precioMax
 * @param {string} filtros.tiendaId - filtrar productos de una tienda específica
 * @param {string} filtros.ordenar - 'precio_asc' | 'precio_desc' | 'ventas' | 'calificacion' | 'recientes'
 * @param {number} filtros.limite - default 24, máx 100
 * @param {string} filtros.cursor - id del último producto de la página anterior
 * @returns {Promise<{ productos: Array, siguienteCursor: string|null, hayMas: boolean }>}
 */
export async function listarProductos(filtros = {}) {
  const limite = Math.min(Number(filtros.limite) || 24, 100)

  // ===== Match inicial (queries indexadas) =====
  // Excluimos productos rechazados por moderación. Los "revision" SÍ se muestran
  // (siguiendo la filosofía Mercado Libre: no penalizar al vendedor mientras
  // el admin revisa). Si después se confirma el rechazo, se sacan del catálogo.
  const matchProducto = {
    activo: true,
    'moderacion.estado': { $ne: 'rechazado' }
  }

  if (filtros.busqueda) {
    matchProducto.$text = { $search: filtros.busqueda }
  }
  if (filtros.categoria) {
    matchProducto.categorias = filtros.categoria
  }
  if (filtros.ciudad) {
    matchProducto.ciudad = filtros.ciudad
  }
  // Sección Usados: condicion = 'usado' | 'reacondicionado' | 'nuevo'
  if (filtros.condicion) {
    matchProducto.condicion = filtros.condicion
  }
  // Sección Ofertas: solo productos con precioAnterior real mayor al precio
  // actual (descuento genuino, no inventado).
  if (filtros.enOferta === true || filtros.enOferta === 'true') {
    matchProducto.$expr = { $gt: ['$precioAnterior', '$precio'] }
  }
  if (filtros.precioMin || filtros.precioMax) {
    matchProducto.precio = {}
    if (filtros.precioMin) matchProducto.precio.$gte = Number(filtros.precioMin)
    if (filtros.precioMax) matchProducto.precio.$lte = Number(filtros.precioMax)
  }
  if (filtros.tiendaId) {
    // Filtrar por una tienda específica (perfil público de la tienda)
    // Convertir string a ObjectId
    matchProducto.tiendaId = filtros.tiendaId
  }

  // ===== Cursor (paginación) =====
  // El cursor es el _id del último producto de la página anterior.
  // Como ordenamos por createdAt DESC por defecto, queremos productos con _id menor.
  // Esto es MUCHO más eficiente que skip a escala (skip recorre todos los anteriores).
  if (filtros.cursor) {
    // Solo aplicamos cursor cuando el orden default está activo
    // (para otros órdenes, paginación por cursor requiere más complejidad)
    try {
      matchProducto._id = { $lt: filtros.cursor }
    } catch (e) {
      // cursor inválido, ignorar
    }
  }

  // ===== Definir orden =====
  const ordenarPor = (() => {
    switch (filtros.ordenar) {
      case 'precio_asc':    return { precio: 1, _id: -1 }
      case 'precio_desc':   return { precio: -1, _id: -1 }
      case 'ventas':        return { totalVentas: -1, _id: -1 }
      case 'calificacion':  return { calificacion: -1, _id: -1 }
      default:              return { _id: -1 } // recientes (más eficiente que createdAt)
    }
  })()

  // ===== Aggregation pipeline =====
  // 1. Match inicial (usa índices)
  // 2. Sort (también usa índices)
  // 3. Limit + 1 (para saber si hay más páginas)
  // 4. Lookup de tienda (JOIN en BD, no en RAM)
  // 5. Match: solo tiendas con MP vinculado
  // 6. Project: limitar campos para reducir tráfico
  const pipeline = [
    { $match: matchProducto },
    { $sort: ordenarPor },
    // Traemos 1 extra para saber si hay más páginas sin pedir total
    { $limit: limite + 1 },
    {
      $lookup: {
        from: 'tiendas',
        localField: 'tiendaId',
        foreignField: '_id',
        as: 'tienda'
      }
    },
    { $unwind: { path: '$tienda', preserveNullAndEmptyArrays: false } },
    { $match: { 'tienda.mpVinculado': true, 'tienda.activo': true } },
    {
      // Reemplazar tiendaId con un objeto compacto
      $addFields: {
        tiendaId: {
          _id: '$tienda._id',
          nombre: '$tienda.nombre',
          nombreCorto: '$tienda.nombreCorto',
          ciudad: '$tienda.ciudad',
          logo: '$tienda.logo',
          calificacion: '$tienda.calificacion',
          oficial: '$tienda.oficial',
          marca: '$tienda.marca'
        }
      }
    },
    { $project: { tienda: 0 } } // sacar el objeto tienda completo, ya tenemos lo necesario
  ]

  const resultados = await Producto.aggregate(pipeline)

  // Si trajimos 1 más del límite, significa que hay siguiente página
  const hayMas = resultados.length > limite
  const productos = hayMas ? resultados.slice(0, limite) : resultados
  const siguienteCursor = hayMas ? productos[productos.length - 1]._id : null

  return { productos, siguienteCursor, hayMas }
}

/**
 * Trae productos puntuales por _id, enriquecidos igual que el catálogo público
 * (solo activos, no rechazados y de tiendas con Mercado Pago vinculado).
 *
 * Se usa para los PRODUCTOS PROMOCIONADOS (pauta): garantiza que un producto
 * destacado aparezca en la primera página del catálogo aunque por su orden
 * natural (precio/ventas/recientes) cayera más abajo. Mantiene el orden en que
 * se pasan los ids (que viene priorizado por plan).
 *
 * @param {string[]} ids - lista de _id de productos
 * @returns {Promise<Array>} productos enriquecidos (puede ser menos que ids si
 *   alguno no cumple los filtros de visibilidad)
 */
export async function listarProductosPorIds(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) return []

  const objectIds = ids
    .map(id => { try { return new mongoose.Types.ObjectId(String(id)) } catch { return null } })
    .filter(Boolean)
  if (objectIds.length === 0) return []

  const pipeline = [
    {
      $match: {
        _id: { $in: objectIds },
        activo: true,
        'moderacion.estado': { $ne: 'rechazado' }
      }
    },
    {
      $lookup: { from: 'tiendas', localField: 'tiendaId', foreignField: '_id', as: 'tienda' }
    },
    { $unwind: { path: '$tienda', preserveNullAndEmptyArrays: false } },
    { $match: { 'tienda.mpVinculado': true, 'tienda.activo': true } },
    {
      $addFields: {
        tiendaId: {
          _id: '$tienda._id',
          nombre: '$tienda.nombre',
          nombreCorto: '$tienda.nombreCorto',
          ciudad: '$tienda.ciudad',
          logo: '$tienda.logo',
          calificacion: '$tienda.calificacion',
          oficial: '$tienda.oficial',
          marca: '$tienda.marca'
        }
      }
    },
    { $project: { tienda: 0 } }
  ]

  const docs = await Producto.aggregate(pipeline)

  // Reordenar según el orden de `ids` (priorizado por plan en el llamador)
  const porId = new Map(docs.map(d => [d._id.toString(), d]))
  return ids.map(id => porId.get(String(id))).filter(Boolean)
}

/**
 * Devuelve las ciudades que realmente tienen productos disponibles para comprar.
 * Se usa para poblar el selector de ciudad del catálogo (en vez de un input de
 * texto libre). Agrupa por Producto.ciudad — la misma fuente que usa el filtro
 * de listarProductos — para que cada ciudad listada devuelva resultados al
 * seleccionarla. Solo cuenta productos activos, no rechazados, de tiendas con
 * Mercado Pago vinculado (las únicas que pueden vender).
 *
 * @returns {Promise<Array<{ ciudad: string, cantidad: number }>>} ordenado por cantidad desc
 */
export async function obtenerCiudadesDisponibles() {
  const pipeline = [
    {
      $match: {
        activo: true,
        'moderacion.estado': { $ne: 'rechazado' },
        ciudad: { $nin: [null, ''] }
      }
    },
    {
      $lookup: {
        from: 'tiendas',
        localField: 'tiendaId',
        foreignField: '_id',
        as: 'tienda'
      }
    },
    { $unwind: { path: '$tienda', preserveNullAndEmptyArrays: false } },
    { $match: { 'tienda.mpVinculado': true, 'tienda.activo': true } },
    {
      $group: {
        _id: '$ciudad',
        cantidad: { $sum: 1 }
      }
    },
    { $sort: { cantidad: -1, _id: 1 } },
    { $project: { _id: 0, ciudad: '$_id', cantidad: 1 } }
  ]

  return await Producto.aggregate(pipeline)
}

// Productos de una tienda (público): solo si la tienda tiene MP vinculado
// y solo los aprobados/en revisión (no los rechazados)
export async function productosDetienda(tiendaId) {
  const tienda = await Tienda.findById(tiendaId).select('mpVinculado')
  if (!tienda || !tienda.mpVinculado) return []
  return await Producto.find({
    tiendaId,
    activo: true,
    'moderacion.estado': { $ne: 'rechazado' }
  }).sort({ createdAt: -1 })
}

// Productos de la tienda del vendedor logueado (sin filtro de MP ni activo)
// Se usa para que el dueño pueda ver/editar sus productos aunque no haya vinculado MP
// y también los pausados (activo: false) para poder reactivarlos desde MiTienda.
export async function productosDeMiTienda(tiendaId) {
  return await Producto.find({ tiendaId }).sort({ createdAt: -1 })
}

// Actualizar producto
export async function actualizarProducto(productoId, tiendaId, datos) {
  // Validar contenido SOLO si se está editando título o descripción
  // (las ediciones inline de precio/stock no necesitan revalidación)
  if (datos.nombre !== undefined || datos.descripcion !== undefined) {
    const validacion = validarPublicacion({
      titulo: datos.nombre,
      descripcion: datos.descripcion
    })
    if (!validacion.valido) {
      const error = new Error(construirMensajeRechazo(validacion.motivos))
      error.code = 'CONTENIDO_INVALIDO'
      throw error
    }
  }

  // Validar código de barras si se está editando
  if (datos.codigoBarras !== undefined && datos.codigoBarras !== '') {
    const validacionCodigo = validarCodigoBarras(datos.codigoBarras)
    if (!validacionCodigo.valido) {
      const error = new Error(validacionCodigo.motivo)
      error.code = 'CODIGO_BARRAS_INVALIDO'
      throw error
    }
  }

  // Validar categoría y campos obligatorios si se está editando categoría o características
  if (datos.categorias !== undefined || datos.caracteristicas !== undefined) {
    const catPrincipal = (datos.categorias && datos.categorias[0]) || ''
    if (catPrincipal && !categoriaValida(catPrincipal)) {
      const error = new Error(`La categoría "${catPrincipal}" no existe.`)
      error.code = 'CATEGORIA_INVALIDA'
      throw error
    }

    const validacionCampos = validarCamposObligatoriosCategoria(
      datos.categorias || [],
      datos.caracteristicas || []
    )
    if (!validacionCampos.valido) {
      const error = new Error(
        `Faltan datos obligatorios para esta categoría: ${validacionCampos.faltantes.join(', ')}`
      )
      error.code = 'CAMPOS_OBLIGATORIOS_FALTANTES'
      error.faltantes = validacionCampos.faltantes
      throw error
    }
  }

  // Validar entrega si se está editando
  if (datos.entrega !== undefined) {
    const entregaNorm = normalizarEntrega(datos.entrega)
    const vEntrega = validarEntrega(entregaNorm)
    if (!vEntrega.valido) {
      const error = new Error(construirMensajeEntregaInvalida(vEntrega.motivos))
      error.code = 'ENTREGA_INVALIDA'
      throw error
    }
  }

  const update = {
    nombre: datos.nombre,
    descripcion: datos.descripcion,
    precio: datos.precio,
    stock: datos.stock,
    imagenes: datos.imagenes,
    categorias: datos.categorias
  }
  // Soporte para pausar/reactivar producto: solo se actualiza si viene definido
  if (datos.activo !== undefined) update.activo = datos.activo
  // Modalidades de entrega solo se actualizan si vienen definidas
  if (datos.entrega !== undefined) {
    update.entrega = normalizarEntrega(datos.entrega)
  }
  // Características solo se actualizan si vienen definidas (normalizadas y limitadas)
  if (datos.caracteristicas !== undefined) {
    update.caracteristicas = (Array.isArray(datos.caracteristicas) ? datos.caracteristicas : [])
      .filter(c => c && c.clave && typeof c.valor === 'string' && c.valor.trim() !== '')
      .slice(0, 30)
      .map(c => ({
        clave: String(c.clave).trim().slice(0, 50),
        valor: String(c.valor).trim().slice(0, 200)
      }))
  }
  // Código de barras y marca solo se actualizan si vienen definidos
  if (datos.codigoBarras !== undefined) {
    update.codigoBarras = normalizarCodigoBarras(datos.codigoBarras)
  }
  if (datos.marca !== undefined) {
    update.marca = String(datos.marca).trim().slice(0, 80)
  }
  // Condición (sección Usados) solo si viene y es válida
  if (datos.condicion !== undefined && ['nuevo', 'usado', 'reacondicionado'].includes(datos.condicion)) {
    update.condicion = datos.condicion
  }
  // Precio anterior (sección Ofertas) solo si viene definido. Vacío/0/menor al
  // precio actual => null (quita la oferta). El filtro de ofertas igual exige
  // precioAnterior > precio, así que un valor inconsistente no genera oferta falsa.
  if (datos.precioAnterior !== undefined) {
    const pa = Number(datos.precioAnterior)
    update.precioAnterior = pa > 0 ? pa : null
  }
  // Cuotas sin interés (máx ofrecidas) solo si viene y es válida
  if (datos.cuotasSinInteres !== undefined) {
    update.cuotasSinInteres = [1, 3, 6, 12].includes(Number(datos.cuotasSinInteres))
      ? Number(datos.cuotasSinInteres)
      : 1
  }

  const producto = await Producto.findOneAndUpdate(
    { _id: productoId, tiendaId },
    update,
    { new: true }
  )

  if (!producto) throw new Error('Producto no encontrado o no tienes permiso')
  return producto
}

// Eliminar producto (soft delete)
export async function eliminarProducto(productoId, tiendaId) {
  const producto = await Producto.findOneAndUpdate(
    { _id: productoId, tiendaId },
    { activo: false },
    { new: true }
  )

  if (!producto) throw new Error('Producto no encontrado o no tienes permiso')
  return producto
}
