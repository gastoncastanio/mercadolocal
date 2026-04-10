import Orden from '../models/Orden.js'
import Carrito from '../models/Carrito.js'
import Producto from '../models/Producto.js'
import Tienda from '../models/Tienda.js'
import Notificacion from '../models/Notificacion.js'
import { calcularTotal } from './carritoService.js'

const PORCENTAJE_COMISION = 10 // 10%

// Crear orden desde carrito
export async function crearOrden(usuarioId, datosEntrega) {
  const carrito = await Carrito.findOne({ usuarioId })
  if (!carrito || carrito.items.length === 0) {
    throw new Error('El carrito está vacío')
  }

  // Validar que todos los productos existan, estén activos, tengan stock y precio correcto
  for (const item of carrito.items) {
    const producto = await Producto.findById(item.productoId)
    if (!producto || !producto.activo) {
      throw new Error(`"${item.nombre}" ya no está disponible. Eliminalo del carrito.`)
    }
    if (producto.stock < item.cantidad) {
      throw new Error(`Stock insuficiente para "${item.nombre}". Disponible: ${producto.stock}`)
    }
    if (producto.precio !== item.precio) {
      throw new Error(`El precio de "${item.nombre}" cambió. Actualizá tu carrito.`)
    }
  }

  // Crear items de la orden con precios verificados
  const items = carrito.items.map(item => ({
    productoId: item.productoId,
    tiendaId: item.tiendaId,
    nombre: item.nombre,
    cantidad: item.cantidad,
    precioUnitario: item.precio,
    subtotal: item.precio * item.cantidad
  }))

  const total = calcularTotal(carrito)
  const comision = Math.round(total * PORCENTAJE_COMISION / 100 * 100) / 100
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

  // Stock y stats de tienda se actualizan cuando el pago se aprueba (webhook)
  // NO descontar stock aquí porque el pago aún no se realizó

  const tiendaIds = [...new Set(items.map(i => i.tiendaId.toString()))]

  // Vaciar carrito
  carrito.items = []
  await carrito.save()

  console.log(`\u2705 Orden creada (pendiente de pago): $${total}`)

  // Solo notificar al comprador que debe completar el pago
  // NO notificar al vendedor ni al admin hasta que el pago sea aprobado
  try {
    await new Notificacion({
      usuarioId,
      tipo: 'compra',
      titulo: 'Orden creada - Completá el pago',
      mensaje: `Tu orden por $${total.toLocaleString('es-AR')} fue creada. Completá el pago para confirmarla.`,
      enlace: '/mis-ordenes'
    }).save()
  } catch (e) {
    console.error('Error notificación compra:', e.message)
  }

  return orden
}

// Obtener órdenes del comprador
export async function ordenesDelComprador(usuarioId) {
  return await Orden.find({ compradorId: usuarioId }).sort({ createdAt: -1 })
}

// Obtener órdenes PAGADAS para un vendedor (por tienda)
// Solo muestra órdenes con pago confirmado - no muestra pendientes de pago
export async function ordenesDelVendedor(tiendaId) {
  return await Orden.find({
    'items.tiendaId': tiendaId,
    estado: { $in: ['pagada', 'enviada', 'completada'] }
  })
    .populate('compradorId', 'nombre email telefono')
    .sort({ createdAt: -1 })
}

// Obtener órdenes pendientes de pago (para tracking de carritos abandonados)
export async function ordenesPendientesPago(tiendaId) {
  const hace48hs = new Date(Date.now() - 48 * 60 * 60 * 1000)
  return await Orden.find({
    'items.tiendaId': tiendaId,
    estado: 'pendiente',
    mpStatus: { $in: ['', 'pending', 'in_process'] },
    createdAt: { $gte: hace48hs }
  })
    .populate('compradorId', 'nombre email')
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

  // Máquina de estados: solo transiciones válidas
  const transicionesValidas = {
    pagada: ['enviada', 'cancelada'],
    enviada: ['completada']
  }

  const permitidas = transicionesValidas[orden.estado]
  if (!permitidas || !permitidas.includes(nuevoEstado)) {
    throw new Error(`No se puede cambiar de "${orden.estado}" a "${nuevoEstado}"`)
  }

  orden.estado = nuevoEstado
  await orden.save()

  // Notificar al comprador del cambio de estado
  const mensajesEstado = {
    pagada: 'Tu pago fue confirmado. El vendedor preparar\u00e1 tu pedido.',
    enviada: '\u00a1Tu pedido fue enviado! Revis\u00e1 los datos de seguimiento.',
    completada: 'Tu pedido fue completado. \u00a1Gracias por tu compra!',
    cancelada: 'Tu pedido fue cancelado. Si ten\u00e9s dudas, contact\u00e1 soporte.'
  }
  try {
    if (mensajesEstado[nuevoEstado]) {
      await new Notificacion({
        usuarioId: orden.compradorId,
        tipo: 'compra',
        titulo: `Pedido ${nuevoEstado}`,
        mensaje: mensajesEstado[nuevoEstado],
        enlace: '/mis-ordenes'
      }).save()
    }
  } catch (e) {
    console.error('Error notificaci\u00f3n estado:', e.message)
  }

  return orden
}

// Obtener todas las órdenes (admin)
export async function todasLasOrdenes() {
  return await Orden.find()
    .populate('compradorId', 'nombre email')
    .sort({ createdAt: -1 })
}

// Cancelar órdenes pendientes que tienen más de 2 horas sin pagar
export async function limpiarOrdenesPendientes() {
  const hace2hs = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const resultado = await Orden.updateMany(
    {
      estado: 'pendiente',
      createdAt: { $lt: hace2hs },
      mpPaymentId: { $in: ['', null] }
    },
    {
      $set: { estado: 'cancelada', mpStatus: 'expired' }
    }
  )
  return resultado.modifiedCount
}

// Estadísticas de admin - SOLO ordenes con pago confirmado
export async function estadisticasAdmin() {
  const ordenesPagadas = await Orden.find({
    estado: { $in: ['pagada', 'enviada', 'completada'] }
  })
  const ordenesPendientes = await Orden.countDocuments({ estado: 'pendiente' })

  const totalVentas = ordenesPagadas.reduce((sum, o) => sum + o.total, 0)
  const totalComisiones = ordenesPagadas.reduce((sum, o) => sum + o.comision, 0)
  const ordenesCompletadas = ordenesPagadas.filter(o => o.estado === 'completada').length

  return {
    totalOrdenes: ordenesPagadas.length,
    totalVentas,
    totalComisiones,
    ordenesCompletadas,
    ordenesPendientes,
    ordenesPagadasEnProceso: ordenesPagadas.filter(o => o.estado === 'pagada' || o.estado === 'enviada').length
  }
}
