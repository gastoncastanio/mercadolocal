import Orden from '../models/Orden.js'
import Carrito from '../models/Carrito.js'
import Producto from '../models/Producto.js'
import Tienda from '../models/Tienda.js'
import { calcularTotal } from './carritoService.js'

const PORCENTAJE_COMISION = 10 // 10%

// Crear orden desde carrito
export async function crearOrden(usuarioId, datosEntrega) {
  const carrito = await Carrito.findOne({ usuarioId })
  if (!carrito || carrito.items.length === 0) {
    throw new Error('El carrito está vacío')
  }

  // Crear items de la orden
  const items = carrito.items.map(item => ({
    productoId: item.productoId,
    tiendaId: item.tiendaId,
    nombre: item.nombre,
    cantidad: item.cantidad,
    precioUnitario: item.precio,
    subtotal: item.precio * item.cantidad
  }))

  const total = calcularTotal(carrito)
  const comision = Math.round(total * PORCENTAJE_COMISION) / 100
  const gananciaVendedor = total - comision

  const orden = new Orden({
    compradorId: usuarioId,
    items,
    total,
    comision,
    porcentajeComision: PORCENTAJE_COMISION,
    gananciaVendedor,
    estado: 'pendiente',
    direccionEntrega: datosEntrega.direccion,
    notasComprador: datosEntrega.notas || '',
    nombreComprador: datosEntrega.nombre || '',
    telefonoComprador: datosEntrega.telefono || ''
  })

  await orden.save()

  // Actualizar stock de productos
  for (const item of carrito.items) {
    await Producto.findByIdAndUpdate(item.productoId, {
      $inc: { stock: -item.cantidad, totalVentas: item.cantidad }
    })
  }

  // Actualizar estadísticas de tiendas
  const tiendaIds = [...new Set(items.map(i => i.tiendaId.toString()))]
  for (const tiendaId of tiendaIds) {
    const totalTienda = items
      .filter(i => i.tiendaId.toString() === tiendaId)
      .reduce((sum, i) => sum + i.subtotal, 0)

    await Tienda.findByIdAndUpdate(tiendaId, {
      $inc: {
        totalVentas: 1,
        ganancias: totalTienda - (totalTienda * PORCENTAJE_COMISION / 100)
      }
    })
  }

  // Vaciar carrito
  carrito.items = []
  await carrito.save()

  console.log(`✅ Nueva orden creada: $${total} (comisión: $${comision})`)

  return orden
}

// Obtener órdenes del comprador
export async function ordenesDelComprador(usuarioId) {
  return await Orden.find({ compradorId: usuarioId }).sort({ createdAt: -1 })
}

// Obtener órdenes para un vendedor (por tienda)
export async function ordenesDelVendedor(tiendaId) {
  return await Orden.find({ 'items.tiendaId': tiendaId })
    .populate('compradorId', 'nombre email telefono')
    .sort({ createdAt: -1 })
}

// Actualizar estado de orden
export async function actualizarEstadoOrden(ordenId, nuevoEstado, tiendaId) {
  const orden = await Orden.findById(ordenId)
  if (!orden) throw new Error('Orden no encontrada')

  // Verificar que la tienda del vendedor está en la orden
  const tienePermiso = orden.items.some(
    item => item.tiendaId.toString() === tiendaId.toString()
  )

  if (!tienePermiso) throw new Error('No tienes permiso para modificar esta orden')

  const estadosValidos = ['pendiente', 'pagada', 'enviada', 'completada', 'cancelada']
  if (!estadosValidos.includes(nuevoEstado)) {
    throw new Error('Estado no válido')
  }

  orden.estado = nuevoEstado
  await orden.save()

  return orden
}

// Obtener todas las órdenes (admin)
export async function todasLasOrdenes() {
  return await Orden.find()
    .populate('compradorId', 'nombre email')
    .sort({ createdAt: -1 })
}

// Estadísticas de admin
export async function estadisticasAdmin() {
  const totalOrdenes = await Orden.countDocuments()
  const ordenes = await Orden.find()

  const totalVentas = ordenes.reduce((sum, o) => sum + o.total, 0)
  const totalComisiones = ordenes.reduce((sum, o) => sum + o.comision, 0)
  const ordenesCompletadas = ordenes.filter(o => o.estado === 'completada').length

  return {
    totalOrdenes,
    totalVentas,
    totalComisiones,
    ordenesCompletadas,
    ordenesPendientes: totalOrdenes - ordenesCompletadas
  }
}
