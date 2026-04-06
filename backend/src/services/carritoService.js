import Carrito from '../models/Carrito.js'
import Producto from '../models/Producto.js'

// Obtener carrito del usuario
export async function obtenerCarrito(usuarioId) {
  let carrito = await Carrito.findOne({ usuarioId })
  if (!carrito) {
    carrito = new Carrito({ usuarioId, items: [] })
    await carrito.save()
  }
  return carrito
}

// Agregar al carrito
export async function agregarAlCarrito(usuarioId, productoId, cantidad = 1) {
  const producto = await Producto.findById(productoId)
  if (!producto) throw new Error('Producto no encontrado')
  if (!producto.activo) throw new Error('Producto no disponible')
  if (producto.stock < cantidad) throw new Error('Stock insuficiente')

  let carrito = await Carrito.findOne({ usuarioId })
  if (!carrito) {
    carrito = new Carrito({ usuarioId, items: [] })
  }

  // Verificar si ya está en el carrito
  const itemExistente = carrito.items.find(
    item => item.productoId.toString() === productoId
  )

  if (itemExistente) {
    itemExistente.cantidad += cantidad
  } else {
    carrito.items.push({
      productoId: producto._id,
      tiendaId: producto.tiendaId,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad,
      imagen: producto.imagenes[0] || ''
    })
  }

  await carrito.save()
  return carrito
}

// Actualizar cantidad
export async function actualizarCantidad(usuarioId, itemId, cantidad) {
  const carrito = await Carrito.findOne({ usuarioId })
  if (!carrito) throw new Error('Carrito no encontrado')

  const item = carrito.items.id(itemId)
  if (!item) throw new Error('Item no encontrado en el carrito')

  if (cantidad <= 0) {
    carrito.items.pull(itemId)
  } else {
    item.cantidad = cantidad
  }

  await carrito.save()
  return carrito
}

// Eliminar del carrito
export async function eliminarDelCarrito(usuarioId, itemId) {
  const carrito = await Carrito.findOne({ usuarioId })
  if (!carrito) throw new Error('Carrito no encontrado')

  carrito.items.pull(itemId)
  await carrito.save()
  return carrito
}

// Vaciar carrito
export async function vaciarCarrito(usuarioId) {
  const carrito = await Carrito.findOne({ usuarioId })
  if (!carrito) throw new Error('Carrito no encontrado')

  carrito.items = []
  await carrito.save()
  return carrito
}

// Calcular total del carrito
export function calcularTotal(carrito) {
  return carrito.items.reduce((total, item) => {
    return total + (item.precio * item.cantidad)
  }, 0)
}
