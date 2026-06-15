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
