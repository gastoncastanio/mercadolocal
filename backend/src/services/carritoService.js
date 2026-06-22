import Carrito from '../models/Carrito.js'
import Producto from '../models/Producto.js'
import { emitNotificacion } from './socketService.js'

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

  // Al sumar algo nuevo arranca un ciclo de intención fresco: reseteamos el
  // throttle de recordatorios para poder volver a recuperarlo si lo abandona.
  carrito.recordatorios = { enviados: 0, ultimo: null }

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

/**
 * RECUPERACIÓN DE CARRITO ABANDONADO (cron).
 *
 * Detecta carritos con productos que el cliente dejó sin comprar y le manda un
 * recordatorio escalonado (push + centro de notificaciones + tiempo real) con
 * enlace directo al checkout. No spamea: máximo 2 recordatorios por ciclo, con
 * al menos ~20h entre uno y otro. Es transaccional (es SU propio carrito), no
 * publicidad, así que no depende del consentimiento de perfilado.
 *
 * Ventanas:
 *   - Etapa 1 (suave): el carrito quedó quieto > 4 h.
 *   - Etapa 2 (con gancho): pasaron > 20 h del primer aviso y sigue sin comprar.
 *   - No molestamos carritos más viejos de 7 días (intención ya fría).
 */
export async function recuperarCarritosAbandonados() {
  const ahora = Date.now()
  const haceMin = new Date(ahora - 4 * 60 * 60 * 1000)        // quieto al menos 4 h
  const haceMax = new Date(ahora - 7 * 24 * 60 * 60 * 1000)   // no más de 7 días
  const gap = 20 * 60 * 60 * 1000                              // 20 h entre avisos

  const candidatos = await Carrito.find({
    'items.0': { $exists: true },                 // tiene al menos un item
    updatedAt: { $lt: haceMin, $gt: haceMax },
    'recordatorios.enviados': { $lt: 2 }
  }).limit(200)

  let enviados = 0
  for (const carrito of candidatos) {
    const ultimo = carrito.recordatorios?.ultimo ? new Date(carrito.recordatorios.ultimo).getTime() : 0
    if (ultimo && ahora - ultimo < gap) continue   // respetar el intervalo entre avisos

    const etapa = carrito.recordatorios?.enviados || 0
    const primerItem = carrito.items[0]
    const cantTotal = carrito.items.reduce((n, i) => n + i.cantidad, 0)
    const total = calcularTotal(carrito)

    // Mensaje escalonado: suave primero, con gancho después.
    const notif = etapa === 0
      ? {
          tipo: 'carrito',
          titulo: '🛒 Te quedaron cosas en el carrito',
          mensaje: `Tenés ${cantTotal} producto(s) esperándote, como "${primerItem.nombre}". Terminá tu compra en un toque.`,
          enlace: '/carrito'
        }
      : {
          tipo: 'carrito',
          titulo: '🛒 ¿Lo terminamos?',
          mensaje: `"${primerItem.nombre}"${cantTotal > 1 ? ' y más' : ''} siguen en tu carrito ($${total.toLocaleString('es-AR')}). Puede agotarse: completá la compra antes de que vuele.`,
          enlace: '/carrito'
        }

    emitNotificacion(carrito.usuarioId.toString(), notif)

    carrito.recordatorios = {
      enviados: etapa + 1,
      ultimo: new Date()
    }
    // No tocar updatedAt de los items: guardamos solo el throttle.
    await Carrito.updateOne(
      { _id: carrito._id },
      { $set: { recordatorios: carrito.recordatorios } },
      { timestamps: false }
    )
    enviados++
  }

  return enviados
}
