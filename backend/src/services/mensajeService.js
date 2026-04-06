import Mensaje from '../models/Mensaje.js'

// Enviar mensaje
export async function enviarMensaje(emisorId, { receptorId, productoId, mensaje }) {
  const conversacionId = productoId
    ? `${[emisorId, receptorId].sort().join('_')}_${productoId}`
    : `${[emisorId, receptorId].sort().join('_')}`

  const nuevoMensaje = new Mensaje({
    conversacionId,
    emisorId,
    receptorId,
    productoId: productoId || undefined,
    mensaje
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
