import webpush from 'web-push'
import PushSubscription from '../models/PushSubscription.js'

// Configuración perezosa de las claves VAPID. Si no están seteadas,
// el push queda como no-op silencioso (no rompe el resto de la app).
let configurado = false
function configurar() {
  if (configurado) return true
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:admmercadolocal@gmail.com'
  if (!pub || !priv) return false
  try {
    webpush.setVapidDetails(subject, pub, priv)
    configurado = true
    return true
  } catch (err) {
    console.warn('⚠️ VAPID mal configurado, push deshabilitado:', err.message)
    return false
  }
}

// Clave pública que el frontend necesita para suscribirse.
export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null
}

// Guardar (o actualizar) la suscripción de un dispositivo.
export async function guardarSuscripcion(usuarioId, suscripcion) {
  if (!suscripcion || !suscripcion.endpoint || !suscripcion.keys) {
    throw new Error('Suscripción inválida')
  }
  await PushSubscription.findOneAndUpdate(
    { endpoint: suscripcion.endpoint },
    {
      usuarioId,
      endpoint: suscripcion.endpoint,
      keys: { p256dh: suscripcion.keys.p256dh, auth: suscripcion.keys.auth }
    },
    { upsert: true, new: true }
  )
}

// Eliminar una suscripción (logout / el usuario deshabilita push).
export async function eliminarSuscripcion(endpoint) {
  if (!endpoint) return
  await PushSubscription.deleteOne({ endpoint })
}

// Enviar un push a TODOS los dispositivos de un usuario.
// Fire-and-forget: nunca lanza (no debe romper el flujo que lo llama).
export async function enviarPush(usuarioId, payload) {
  if (!configurar()) return

  let subs
  try {
    subs = await PushSubscription.find({ usuarioId })
  } catch {
    return
  }
  if (!subs || !subs.length) return

  const data = JSON.stringify({
    titulo: payload.titulo || 'MercadoLocal',
    mensaje: payload.mensaje || '',
    enlace: payload.enlace || '/',
    tipo: payload.tipo || 'sistema'
  })

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
        data
      )
    } catch (err) {
      // 404/410 = suscripción muerta (el usuario desinstaló / revocó) → limpiar
      if (err.statusCode === 404 || err.statusCode === 410) {
        await PushSubscription.deleteOne({ endpoint: sub.endpoint }).catch(() => {})
      } else {
        console.warn('Error enviando push:', err.statusCode || err.message)
      }
    }
  }))
}
