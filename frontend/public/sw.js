// ===== SW kill-switch =====
// Este Service Worker reemplaza al viejo que cacheaba JavaScript y rompía
// los deploys. No cachea NADA: solo se desinstala a sí mismo y limpia los
// caches que pudo haber dejado el SW anterior.
//
// Una vez que todos los usuarios cargaron este SW, podemos eliminar el
// archivo entero del proyecto.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', async (event) => {
  event.waitUntil((async () => {
    // Limpiar todos los caches creados por el SW anterior
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    } catch (e) {}

    // Desinstalar este SW para que en próximas visitas el navegador
    // cargue directo de Vercel (sin intermediarios).
    try {
      await self.registration.unregister()
    } catch (e) {}

    // Forzar reload de todas las pestañas abiertas para que tomen
    // el código fresco sin SW.
    try {
      const clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach(client => client.navigate(client.url))
    } catch (e) {}
  })())
})

// IMPORTANTE: no registramos handler de 'fetch'. Un listener vacío hace que el
// navegador rutee TODAS las requests a través del SW sin motivo (overhead no-op
// que Chrome/Lighthouse advierten). Sin listener, los fetch van directo a la red.
