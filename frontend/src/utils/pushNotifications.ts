import api from '../services/api'

// ¿El navegador soporta Web Push?
export function pushSoportado(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// Estado actual del permiso de notificaciones
export function estadoPermiso(): NotificationPermission {
  return typeof Notification !== 'undefined' ? Notification.permission : 'denied'
}

// La clave VAPID viene en base64url; el navegador la necesita como Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

// ¿Este usuario está suscripto? (chequea en el backend, no solo el navegador)
// Importante para múltiples cuentas en el mismo dispositivo: verifica que la
// suscripción pertenezca al usuario logueado, no a una cuenta vieja.
export async function yaSuscripto(): Promise<boolean> {
  if (!pushSoportado()) return false
  try {
    const { data } = await api.get('/notificaciones/push/estado')
    return data.suscripto === true
  } catch {
    return false
  }
}

// Activar push en este dispositivo. Devuelve true si quedó suscripto.
//
// IMPORTANTE: en un mismo dispositivo solo puede existir UNA suscripción push
// (una por service worker). No se puede tener dos cuentas recibiendo push a la
// vez en el mismo teléfono. Al activar, reasignamos la suscripción del
// dispositivo al usuario logueado: la última cuenta que activa es la que recibe.
//
// NO desuscribimos/re-suscribimos: en iOS eso devuelve un endpoint que Apple
// rechaza (410 Gone) y la notificación nunca llega. Reutilizamos la suscripción
// existente y solo la reasignamos en el backend.
export async function activarPush(): Promise<boolean> {
  if (!pushSoportado()) {
    throw new Error('Tu navegador no soporta notificaciones push')
  }

  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return false

  const reg = await navigator.serviceWorker.ready

  // Clave pública VAPID del backend
  const { data } = await api.get('/notificaciones/push/clave-publica')
  const clavePublica = data.clave
  if (!clavePublica) throw new Error('El servidor no tiene push configurado')

  // Reutilizar la suscripción del dispositivo si ya existe; si no, crearla.
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(clavePublica) as BufferSource
    })
  }

  // Guardar/reasignar esta suscripción al usuario logueado. El backend la
  // mueve al usuario actual (findOneAndUpdate por endpoint), así la cuenta
  // anterior deja de recibir y la nueva empieza a recibir.
  await api.post('/notificaciones/push/suscribir', { suscripcion: sub })

  // Pedir al servidor que envíe un push de bienvenida. Esto verifica el flujo
  // completo end-to-end (VAPID → push service → este dispositivo). Es
  // fire-and-forget: si falla, la suscripción igual quedó guardada.
  api.post('/notificaciones/push/test').catch(() => {})

  return true
}

// Desactivar push en este dispositivo
export async function desactivarPush(): Promise<void> {
  if (!pushSoportado()) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await api.post('/notificaciones/push/desuscribir', { endpoint: sub.endpoint }).catch(() => {})
      await sub.unsubscribe().catch(() => {})
    }
  } catch {
    // best-effort
  }
}
