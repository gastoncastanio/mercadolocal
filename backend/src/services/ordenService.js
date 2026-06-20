import Orden from '../models/Orden.js'
import Carrito from '../models/Carrito.js'
import Producto from '../models/Producto.js'
import Tienda from '../models/Tienda.js'
import Notificacion from '../models/Notificacion.js'
import * as configService from './configService.js'

// Crear orden desde carrito
export async function crearOrden(usuarioId, datosEntrega) {
  const carrito = await Carrito.findOne({ usuarioId })
  if (!carrito || carrito.items.length === 0) {
    throw new Error('El carrito está vacío')
  }

  // Validar que todos los productos existan, estén activos, tengan stock y precio correcto
  // Además, verificar que cada tienda tenga Mercado Pago vinculado (no se puede vender sin eso)
  for (const item of carrito.items) {
    const producto = await Producto.findById(item.productoId)
    if (!producto || !producto.activo) {
      throw new Error(`"${item.nombre}" ya no está disponible. Eliminalo del carrito.`)
    }
    if (producto.stock < item.cantidad) {
      throw new Error(`Stock insuficiente para "${item.nombre}". Disponible: ${producto.stock}`)
    }
    // Tolerancia para comparación de floats: diferencia menor a 1 centavo se considera igual
    if (Math.abs(producto.precio - item.precio) > 0.01) {
      throw new Error(`El precio de "${item.nombre}" cambió. Actualizá tu carrito.`)
    }
    // Verificar que la tienda del producto tenga MP vinculado
    // Mensaje genérico para no exponer info comercial al comprador
    const tienda = await Tienda.findById(item.tiendaId).select('mpVinculado')
    if (!tienda || !tienda.mpVinculado) {
      throw new Error('Lo sentimos, este producto no está disponible para compra en este momento.')
    }
  }

  // Agrupar los items por tienda: una orden (y un pago) por vendedor.
  const gruposPorTienda = new Map() // tiendaId -> items[]
  for (const item of carrito.items) {
    const key = item.tiendaId.toString()
    if (!gruposPorTienda.has(key)) gruposPorTienda.set(key, [])
    gruposPorTienda.get(key).push({
      productoId: item.productoId,
      tiendaId: item.tiendaId,
      nombre: item.nombre,
      cantidad: item.cantidad,
      precioUnitario: item.precio,
      subtotal: item.precio * item.cantidad
    })
  }

  // Crear una orden por cada vendedor, con su propio total y comisión.
  const ordenesCreadas = []
  const porcentajeComision = await configService.obtenerPorcentajeComision('venta')
  for (const items of gruposPorTienda.values()) {
    const total = items.reduce((sum, i) => sum + i.subtotal, 0)
    const comision = Math.round(total * porcentajeComision / 100 * 100) / 100
    const gananciaVendedor = total - comision

    const orden = new Orden({
      compradorId: usuarioId,
      items,
      total,
      comision,
      porcentajeComision,
      gananciaVendedor,
      estado: 'pendiente',
      direccionEntrega: datosEntrega.direccion,
      ciudadEntrega: datosEntrega.ciudad || '',
      notasComprador: datosEntrega.notas || '',
      nombreComprador: datosEntrega.nombre || '',
      telefonoComprador: datosEntrega.telefono || ''
    })
    await orden.save()
    ordenesCreadas.push(orden)
  }

  // Stock y stats de tienda se actualizan cuando el pago se aprueba (webhook)
  // NO descontar stock aquí porque el pago aún no se realizó

  const totalCombinado = ordenesCreadas.reduce((sum, o) => sum + o.total, 0)
  const esMultiple = ordenesCreadas.length > 1

  console.log(`OK ${ordenesCreadas.length} orden(es) creada(s) (pendiente de pago): $${totalCombinado}`)

  // Notificar al comprador que debe completar el/los pago(s)
  try {
    await new Notificacion({
      usuarioId,
      tipo: 'compra',
      titulo: esMultiple
        ? `Compra creada (${ordenesCreadas.length} vendedores) - Completá los pagos`
        : 'Orden creada - Completá el pago',
      mensaje: esMultiple
        ? `Tu compra por $${totalCombinado.toLocaleString('es-AR')} se divide en ${ordenesCreadas.length} pagos, uno por vendedor. Completá cada pago para confirmarla.`
        : `Tu orden por $${totalCombinado.toLocaleString('es-AR')} fue creada. Completá el pago para confirmarla.`,
      enlace: '/mis-ordenes'
    }).save()
  } catch (e) {
    console.error('Error notificación compra:', e.message)
  }

  // Devolver SIEMPRE un array (1 elemento si es un solo vendedor).
  return ordenesCreadas
}

// Obtener órdenes del comprador.
// Hacemos populate de productos (para mostrar fotos) y tiendas (para mostrar
// nombre, logo y teléfono del vendedor — el comprador necesita poder
// contactarlo y saber a quién le compró).
export async function ordenesDelComprador(usuarioId) {
  return await Orden.find({ compradorId: usuarioId })
    .populate('items.productoId', 'imagenes nombre')
    .populate('items.tiendaId', 'nombre logo telefono ciudad')
    .sort({ createdAt: -1 })
}

// Obtener órdenes PAGADAS para un vendedor (por tienda)
// Solo muestra órdenes con pago confirmado - no muestra pendientes de pago
export async function ordenesDelVendedor(tiendaId) {
  return await Orden.find({
    'items.tiendaId': tiendaId,
    estado: { $in: ['pagada', 'enviada', 'completada'] }
  })
    .populate('compradorId', 'nombre email telefono avatar')
    .populate('items.productoId', 'imagenes')
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

// Actualizar estado de orden.
// Acepta opcionalmente datos de envío (codigoSeguimiento, empresaEnvio)
// que se guardan cuando se transiciona a "enviada".
export async function actualizarEstadoOrden(ordenId, nuevoEstado, tiendaId, datosEnvio = {}) {
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

  // Cuando se marca como enviada, guardar datos del envío y la fecha
  if (nuevoEstado === 'enviada') {
    orden.fechaEnvio = new Date()
    if (datosEnvio.codigoSeguimiento) {
      orden.codigoSeguimiento = String(datosEnvio.codigoSeguimiento).trim().slice(0, 100)
    }
    if (datosEnvio.empresaEnvio) {
      orden.empresaEnvio = String(datosEnvio.empresaEnvio).trim().slice(0, 50)
    }
  }

  await orden.save()

  // Notificar al comprador del cambio de estado
  const mensajesEstado = {
    pagada: 'Tu pago fue confirmado. El vendedor preparar\u00e1 tu pedido.',
    enviada: orden.codigoSeguimiento
      ? `\u00a1Tu pedido fue enviado! Seguimiento: ${orden.codigoSeguimiento}${orden.empresaEnvio ? ` (${orden.empresaEnvio})` : ''}`
      : '\u00a1Tu pedido fue enviado!',
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
