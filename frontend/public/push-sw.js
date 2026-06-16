// ===== Service Worker SOLO para Web Push =====
// NO cachea NADA de la app. Esto es deliberado: el SW anterior cacheaba el
// JavaScript y rompía deploys (servía código viejo). Este solo escucha
// eventos de push y clicks en notificaciones. Todo el resto va directo a la red.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Limpiar caches que pudo dejar cualquier SW anterior (defensivo)
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    } catch (e) {}
    await self.clients.claim()
  })())
})

// NO interceptar fetch: nunca cacheamos assets (evita servir JS viejo)
self.addEventListener('fetch', () => {})

// Llega un push del servidor → mostrar la notificación
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { titulo: 'MercadoLocal', mensaje: event.data ? event.data.text() : '' }
  }

  const titulo = data.titulo || 'MercadoLocal'
  const opciones = {
    body: data.mensaje || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-192x192.png',
    data: { enlace: data.enlace || '/' },
    tag: data.tipo || 'mercadolocal',
    renotify: false
  }

  event.waitUntil(self.registration.showNotification(titulo, opciones))
})

// Click en la notificación → enfocar/abrir la app en el enlace
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const enlace = (event.notification.data && event.notification.data.enlace) || '/'

  event.waitUntil((async () => {
    const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of clientes) {
      if ('focus' in client) {
        await client.focus()
        if ('navigate' in client) {
          try { await client.navigate(enlace) } catch (e) {}
        }
        return
      }
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow(enlace)
    }
  })())
})
