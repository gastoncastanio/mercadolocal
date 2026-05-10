import Producto from '../models/Producto.js'
import Tienda from '../models/Tienda.js'

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

  const producto = new Producto({
    tiendaId,
    nombre: datos.nombre,
    descripcion: datos.descripcion || '',
    precio: datos.precio,
    stock: datos.stock || 1,
    imagenes: datos.imagenes || [],
    categorias: datos.categorias || [],
    ciudad: tienda.ciudad
  })

  await producto.save()
  return producto
}

// Obtener producto por ID
export async function obtenerProducto(productoId) {
  const producto = await Producto.findById(productoId).populate('tiendaId', 'nombre ciudad logo')
  if (!producto) throw new Error('Producto no encontrado')
  return producto
}

// Listar todos los productos (con filtros)
export async function listarProductos(filtros = {}) {
  const query = { activo: true }

  if (filtros.busqueda) {
    query.$text = { $search: filtros.busqueda }
  }

  if (filtros.categoria) {
    query.categorias = { $in: [filtros.categoria] }
  }

  if (filtros.ciudad) {
    query.ciudad = filtros.ciudad
  }

  if (filtros.precioMin || filtros.precioMax) {
    query.precio = {}
    if (filtros.precioMin) query.precio.$gte = Number(filtros.precioMin)
    if (filtros.precioMax) query.precio.$lte = Number(filtros.precioMax)
  }

  if (filtros.tiendaId) {
    query.tiendaId = filtros.tiendaId
  }

  let productos = await Producto.find(query)
    .populate('tiendaId', 'nombre ciudad logo mpVinculado')
    .sort(filtros.ordenar === 'precio_asc' ? { precio: 1 } :
          filtros.ordenar === 'precio_desc' ? { precio: -1 } :
          filtros.ordenar === 'ventas' ? { totalVentas: -1 } :
          filtros.ordenar === 'calificacion' ? { calificacion: -1 } :
          { createdAt: -1 })
    .limit(filtros.limite ? Number(filtros.limite) : 50)

  // Filtrar productos cuya tienda no tenga MP vinculado
  // (no aparecen en catálogo público hasta que el vendedor conecte su cuenta)
  productos = productos.filter(p => p.tiendaId?.mpVinculado === true)

  return productos
}

// Productos de una tienda (público): solo si la tienda tiene MP vinculado
export async function productosDetienda(tiendaId) {
  const tienda = await Tienda.findById(tiendaId).select('mpVinculado')
  if (!tienda || !tienda.mpVinculado) return []
  return await Producto.find({ tiendaId, activo: true }).sort({ createdAt: -1 })
}

// Productos de la tienda del vendedor logueado (sin filtro de MP ni activo)
// Se usa para que el dueño pueda ver/editar sus productos aunque no haya vinculado MP
// y también los pausados (activo: false) para poder reactivarlos desde MiTienda.
export async function productosDeMiTienda(tiendaId) {
  return await Producto.find({ tiendaId }).sort({ createdAt: -1 })
}

// Actualizar producto
export async function actualizarProducto(productoId, tiendaId, datos) {
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
