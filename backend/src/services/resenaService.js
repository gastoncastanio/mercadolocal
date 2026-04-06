import Resena from '../models/Resena.js'
import Orden from '../models/Orden.js'
import Producto from '../models/Producto.js'

// Crear resena
export async function crearResena(compradorId, { productoId, ordenId, calificacion, comentario }) {
  // Verificar que la orden pertenece al comprador
  const orden = await Orden.findById(ordenId)
  if (!orden) throw new Error('Orden no encontrada')
  if (orden.compradorId.toString() !== compradorId.toString()) {
    throw new Error('Esta orden no te pertenece')
  }

  // Verificar que el producto esta en la orden
  const tieneProducto = orden.items.some(
    item => item.productoId.toString() === productoId.toString()
  )
  if (!tieneProducto) {
    throw new Error('Este producto no esta en la orden')
  }

  // Verificar que no exista resena duplicada para esta orden y producto
  const resenaExistente = await Resena.findOne({ ordenId, productoId, compradorId })
  if (resenaExistente) {
    throw new Error('Ya dejaste una resena para este producto en esta orden')
  }

  const resena = new Resena({
    compradorId,
    productoId,
    ordenId,
    calificacion,
    comentario: comentario || ''
  })

  await resena.save()

  // Actualizar calificacion promedio del producto
  await calificacionPromedio(productoId)

  return resena
}

// Obtener resenas de un producto
export async function resenasDeProducto(productoId) {
  return await Resena.find({ productoId })
    .populate('compradorId', 'nombre avatar')
    .sort({ createdAt: -1 })
}

// Responder resena (vendedor)
export async function responderResena(resenaId, vendedorId, respuesta) {
  const resena = await Resena.findById(resenaId)
  if (!resena) throw new Error('Resena no encontrada')

  // Verificar que el vendedor es dueno del producto
  const producto = await Producto.findById(resena.productoId).populate('tiendaId')
  if (!producto) throw new Error('Producto no encontrado')
  if (producto.tiendaId.usuarioId.toString() !== vendedorId.toString()) {
    throw new Error('No tienes permiso para responder esta resena')
  }

  resena.respuestaVendedor = respuesta
  await resena.save()

  return resena
}

// Calcular y actualizar calificacion promedio
export async function calificacionPromedio(productoId) {
  const resenas = await Resena.find({ productoId })
  if (resenas.length === 0) return 0

  const promedio = resenas.reduce((sum, r) => sum + r.calificacion, 0) / resenas.length
  const promedioRedondeado = Math.round(promedio * 10) / 10

  await Producto.findByIdAndUpdate(productoId, { calificacion: promedioRedondeado })

  return promedioRedondeado
}
