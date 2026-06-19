import Mensaje from '../models/Mensaje.js'
import Orden from '../models/Orden.js'
import Tienda from '../models/Tienda.js'
import SolicitudServicio from '../models/SolicitudServicio.js'
import { censurarContacto } from '../utils/validacionContenido.js'

/**
 * Verifica si entre dos usuarios ya existe una orden PAGADA (comprador-vendedor).
 * Si existe, el chat se desbloquea (ya pueden compartir contacto directo).
 * Si NO existe, los mensajes se censuran para evitar evasión del marketplace.
 *
 * @returns {Promise<boolean>}
 */
async function existeOrdenPagadaEntre(userA, userB) {
  // Buscar todas las tiendas de A y de B (cada uno puede ser comprador o vendedor)
  const [tiendaA, tiendaB] = await Promise.all([
    Tienda.findOne({ usuarioId: userA }).select('_id'),
    Tienda.findOne({ usuarioId: userB }).select('_id')
  ])

  const tiendaIds = []
  if (tiendaA) tiendaIds.push(tiendaA._id)
  if (tiendaB) tiendaIds.push(tiendaB._id)

  if (tiendaIds.length === 0) return false // ninguno tiene tienda, no hay venta posible

  // Buscar una orden pagada donde el comprador sea uno y un item sea de tienda del otro
  const orden = await Orden.findOne({
    $or: [
      // userA comprador, userB vendedor
      { compradorId: userA, 'items.tiendaId': { $in: tiendaIds }, estado: { $in: ['pagada', 'enviada', 'completada'] } },
      // userB comprador, userA vendedor
      { compradorId: userB, 'items.tiendaId': { $in: tiendaIds }, estado: { $in: ['pagada', 'enviada', 'completada'] } }
    ]
  }).select('_id').lean()

  return !!orden
}

/**
 * Verifica si entre dos usuarios existe una SolicitudServicio aceptada/en_curso/completada.
 * Si existe, el chat se desbloquea (ya pueden compartir contacto directo).
 * Si NO existe, los mensajes se censuran.
 *
 * @returns {Promise<boolean>}
 */
export async function existeServicioContratadoEntre(userA, userB) {
  const solicitud = await SolicitudServicio.findOne({
    $or: [
      // userA es cliente, userB es profesional
      { clienteId: userA, profesionalId: userB, estado: { $in: ['aceptada', 'en_curso', 'completada'] } },
      // userB es cliente, userA es profesional
      { clienteId: userB, profesionalId: userA, estado: { $in: ['aceptada', 'en_curso', 'completada'] } }
    ]
  }).select('_id').lean()

  return !!solicitud
}

// Enviar mensaje
export async function enviarMensaje(emisorId, { receptorId, productoId, mensaje }) {
  const conversacionId = productoId
    ? `${[emisorId, receptorId].sort().join('_')}_${productoId}`
    : `${[emisorId, receptorId].sort().join('_')}`

  // Censurar contacto externo si NO hay venta/servicio concretado entre los dos
  // (estilo Mercado Libre: el chat se desbloquea recién cuando se paga o se acepta un servicio)
  const [hayVenta, hayServicio] = await Promise.all([
    existeOrdenPagadaEntre(emisorId, receptorId),
    existeServicioContratadoEntre(emisorId, receptorId)
  ])
  const chatDesbloqueado = hayVenta || hayServicio

  let mensajeFinal = mensaje
  let mensajeOriginal = ''
  let huboCensura = false

  if (!chatDesbloqueado) {
    const resultado = censurarContacto(mensaje)
    if (resultado.huboCensura) {
      mensajeOriginal = mensaje
      mensajeFinal = resultado.textoCensurado
      huboCensura = true
      console.log(`🔒 Mensaje censurado (${resultado.motivos.join(', ')}) — emisor ${emisorId}`)
    }
  }

  const nuevoMensaje = new Mensaje({
    conversacionId,
    emisorId,
    receptorId,
    productoId: productoId || undefined,
    mensaje: mensajeFinal,
    mensajeOriginal: huboCensura ? mensajeOriginal : '',
    huboCensura
  })

  await nuevoMensaje.save()

  return nuevoMensaje
}

// Obtener mensajes de una conversacion
export async function obtenerConversacion(conversacionId, usuarioId) {
  // Verificar que el usuario es parte de la conversacion
  const partes = conversacionId.split('_')
  if (!partes.includes(usuarioId.toString())) {
    throw new Error('No tienes acceso a esta conversacion')
  }

  return await Mensaje.find({ conversacionId })
    .populate('emisorId', 'nombre avatar')
    .populate('receptorId', 'nombre avatar')
    .sort({ createdAt: 1 })
}

// Obtener mis conversaciones con ultimo mensaje
export async function misConversaciones(usuarioId) {
  const mensajes = await Mensaje.find({
    $or: [
      { emisorId: usuarioId },
      { receptorId: usuarioId }
    ]
  }).sort({ createdAt: -1 })

  // Agrupar por conversacionId y obtener el ultimo mensaje
  const conversacionesMap = new Map()
  for (const msg of mensajes) {
    if (!conversacionesMap.has(msg.conversacionId)) {
      conversacionesMap.set(msg.conversacionId, msg)
    }
  }

  // Poblar los datos de usuario
  const conversacionIds = [...conversacionesMap.keys()]
  const ultimosMensajes = []

  for (const convId of conversacionIds) {
    const msg = await Mensaje.findById(conversacionesMap.get(convId)._id)
      .populate('emisorId', 'nombre avatar')
      .populate('receptorId', 'nombre avatar')
      .populate('productoId', 'nombre imagenes')

    const noLeidos = await Mensaje.countDocuments({
      conversacionId: convId,
      receptorId: usuarioId,
      leido: false
    })

    ultimosMensajes.push({
      conversacionId: convId,
      ultimoMensaje: msg,
      noLeidos
    })
  }

  return ultimosMensajes
}

// Marcar mensajes como leidos
export async function marcarLeidos(conversacionId, usuarioId) {
  await Mensaje.updateMany(
    { conversacionId, receptorId: usuarioId, leido: false },
    { leido: true }
  )
}
