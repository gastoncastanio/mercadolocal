import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/index.css'
import { ToastProvider } from './context/ToastContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
)

// ===== Ocultar el splash screen con marca =====
// El splash (en index.html) se ve al instante al abrir la app. Lo desvanecemos
// recién cuando la app ya pintó al menos un frame, con un tiempo mínimo visible
// para que no titile en conexiones rápidas.
function ocultarSplash() {
  const splash = document.getElementById('splash-screen')
  if (!splash) return
  splash.classList.add('splash-oculto')
  // Quitarlo del DOM cuando termina el fade (la transición dura .45s)
  splash.addEventListener('transitionend', () => splash.remove(), { once: true })
  // Red de seguridad por si transitionend no dispara
  window.setTimeout(() => splash.remove(), 800)
}

const SPLASH_MIN_MS = 600
const arranque = performance.now()
// Doble requestAnimationFrame: garantiza que el primer render de la app ya pintó.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const restante = Math.max(0, SPLASH_MIN_MS - (performance.now() - arranque))
    window.setTimeout(ocultarSplash, restante)
  })
})

// ===== Service Worker SOLO para Web Push =====
// El SW de push (/push-sw.js) NO cachea assets, así que NO reintroduce el bug
// histórico de servir JavaScript viejo. Solo escucha eventos de push.
// Reemplaza al kill-switch anterior (que se autodesinstalaba).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/push-sw.js').catch(err => {
      console.warn('No se pudo registrar el SW de push:', err)
    })
  })
}
