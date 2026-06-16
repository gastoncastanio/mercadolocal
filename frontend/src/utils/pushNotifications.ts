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
export async function activarPush(): Promise<boolean> {
  if (!pushSoportado()) {
    throw new Error('Tu navegador no soporta notificaciones push')
  }

  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return false

  const reg = await navigator.serviceWorker.ready

  // Desuscribir cualquier suscripción anterior (importante para múltiples cuentas)
  try {
    const subVieja = await reg.pushManager.getSubscription()
    if (subVieja) {
      await api.post('/notificaciones/push/desuscribir', { endpoint: subVieja.endpoint }).catch(() => {})
      await subVieja.unsubscribe().catch(() => {})
    }
  } catch (err) {
    console.warn('Error desuscribiendo push anterior:', err)
  }

  // Clave pública VAPID del backend
  const { data } = await api.get('/notificaciones/push/clave-publica')
  const clavePublica = data.clave
  if (!clavePublica) throw new Error('El servidor no tiene push configurado')

  // Crear nueva suscripción para este usuario
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(clavePublica) as BufferSource
  })

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
