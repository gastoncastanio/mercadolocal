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

// ===== DESREGISTRAR Service Workers viejos =====
// El SW de la PWA estaba cacheando JavaScript viejo y rompiendo deploys.
// Hasta que lo rediseñemos correctamente, lo desinstalamos en todos los
// navegadores que lo tengan instalado.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    for (const reg of regs) {
      reg.unregister().then(ok => {
        if (ok) console.log('🧹 Service Worker viejo desinstalado:', reg.scope)
      })
    }
  })
  // Limpiar también los caches del SW
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name))
    })
  }
}
