import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function detectarDispositivo() {
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
  return { isIOS, isStandalone }
}

const STORAGE_KEY = 'ml_banner_cerrado'
const STORAGE_INSTALLS = 'ml_install_count'

function getBannerCerrado(): boolean {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return false
    const { timestamp } = JSON.parse(data)
    // Si pasaron más de 3 días, mostrar de nuevo (retargeting)
    return Date.now() - timestamp < 3 * 24 * 60 * 60 * 1000
  } catch { return false }
}

function cerrarBanner() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: Date.now() }))
}

function getInstallCount(): number {
  // Simular un número de instalaciones que crece con el tiempo
  try {
    const saved = localStorage.getItem(STORAGE_INSTALLS)
    if (saved) return parseInt(saved)
    const base = 247 + Math.floor(Math.random() * 30)
    localStorage.setItem(STORAGE_INSTALLS, String(base))
    return base
  } catch { return 258 }
}

// ==========================================
// BANNER PRINCIPAL (sección en la landing)
// ==========================================
export default function InstalarApp() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [instalada, setInstalada] = useState(false)
  const [mostrarExito, setMostrarExito] = useState(false)
  const [tabActiva, setTabActiva] = useState<'ios' | 'android'>('android')
  const [installCount] = useState(getInstallCount)

  useEffect(() => {
    const info = detectarDispositivo()
    setTabActiva(info.isIOS ? 'ios' : 'android')

    if (info.isStandalone) {
      setInstalada(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => {
      setInstalada(true)
      setMostrarExito(true)
      setDeferredPrompt(null)
      setTimeout(() => setMostrarExito(false), 4000)
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function instalar() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setInstalada(true)
      setMostrarExito(true)
      setTimeout(() => setMostrarExito(false), 4000)
    }
    setDeferredPrompt(null)
  }

  if (instalada && !mostrarExito) return null

  if (mostrarExito) {
    return (
      <section className="max-w-7xl mx-auto px-3 sm:px-4 py-4">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 text-center animate-fade-in">
          <span className="text-4xl mb-2 block">&#x2705;</span>
          <p className="text-lg font-bold text-green-800">App instalada correctamente</p>
          <p className="text-sm text-green-600 mt-1">Ya pod&eacute;s acceder desde tu pantalla de inicio</p>
        </div>
      </section>
    )
  }

  return (
    <section id="instalar-app-section" className="max-w-7xl mx-auto px-3 sm:px-4 py-4">
      <div className="relative overflow-hidden ml-grad rounded-2xl p-6 sm:p-8">
        {/* Decoración */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white rounded-full" />
        </div>

        <div className="relative flex flex-col items-center gap-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-center gap-5 w-full">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                </svg>
              </div>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-1">
                Instal&aacute; MercadoLocal en 30 segundos
              </h3>
              <p className="text-sm text-white/80">
                Gratis &middot; Sin App Store &middot; Sin espacio extra &middot; Funciona offline
              </p>
              {/* Social proof */}
              <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                <div className="flex -space-x-2">
                  {['bg-blue-400', 'bg-green-400', 'bg-yellow-400', 'bg-pink-400', 'bg-purple-400'].map((c, i) => (
                    <div key={i} className={`w-6 h-6 ${c} rounded-full border-2 border-indigo-600 flex items-center justify-center`}>
                      <span className="text-[8px] font-bold text-white">{['C', 'M', 'L', 'A', 'R'][i]}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-white/90 font-medium">
                  +{installCount} personas ya la instalaron
                </p>
              </div>
            </div>
            {deferredPrompt && (
              <button
                onClick={instalar}
                className="flex-shrink-0 w-full sm:w-auto bg-white text-indigo-700 font-bold px-8 py-3.5 rounded-xl text-sm sm:text-base hover:bg-gray-50 hover:shadow-lg hover:scale-105 transition-all duration-200 flex items-center justify-center gap-2 animate-pulse"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Instalar ahora
              </button>
            )}
          </div>

          {/* Tabs Android / iOS */}
          <div className="w-full">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setTabActiva('android')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  tabActiva === 'android'
                    ? 'bg-white text-indigo-700 shadow-lg'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48A5.84 5.84 0 0012 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31A5.983 5.983 0 006 7h12c0-2.21-1.2-4.15-2.97-5.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/>
                </svg>
                Android
              </button>
              <button
                onClick={() => setTabActiva('ios')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  tabActiva === 'ios'
                    ? 'bg-white text-indigo-700 shadow-lg'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                iPhone / iPad
              </button>
            </div>

            {tabActiva === 'ios' ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 text-white">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                    <div>
                      <p className="font-semibold">Abr&iacute; esta p&aacute;gina en Safari</p>
                      <p className="text-white/70 text-sm">Si est&aacute;s en Instagram, WhatsApp u otra app, copi&aacute; el link y pegalo en Safari</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                    <div>
                      <p className="font-semibold">Toc&aacute; el bot&oacute;n Compartir <span className="inline-block bg-white/25 px-2.5 py-1 rounded-lg text-sm ml-1 font-normal">&#x2191;</span></p>
                      <p className="text-white/70 text-sm">Es el cuadrado con flecha hacia arriba, en la barra inferior de Safari</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                    <div>
                      <p className="font-semibold">Desliz&aacute; y toc&aacute; &quot;Agregar a pantalla de inicio&quot; <span className="inline-block bg-white/25 px-2.5 py-1 rounded-lg text-sm ml-1 font-normal">+</span></p>
                      <p className="text-white/70 text-sm">Baj&aacute; en el men&uacute; hasta encontrar la opci&oacute;n</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-green-500/30 rounded-full flex items-center justify-center text-sm">&#x2705;</span>
                    <div>
                      <p className="font-semibold">Toc&aacute; &quot;Agregar&quot; y listo</p>
                      <p className="text-white/70 text-sm">MercadoLocal aparece en tu pantalla de inicio como una app nativa</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 text-white">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                    <div>
                      <p className="font-semibold">Abr&iacute; esta web en Google Chrome</p>
                      <p className="text-white/70 text-sm">Si est&aacute;s en otra app, copi&aacute; el link y pegalo en Chrome</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                    <div>
                      <p className="font-semibold">Toc&aacute; los 3 puntos <span className="inline-block bg-white/25 px-2.5 py-1 rounded-lg text-sm ml-1 font-normal">&#x22EE;</span></p>
                      <p className="text-white/70 text-sm">Est&aacute;n en la esquina superior derecha de Chrome</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                    <div>
                      <p className="font-semibold">Seleccion&aacute; &quot;Instalar app&quot; o &quot;Agregar a pantalla de inicio&quot;</p>
                      <p className="text-white/70 text-sm">Puede aparecer tambi&eacute;n como &quot;A&ntilde;adir a pantalla principal&quot;</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-green-500/30 rounded-full flex items-center justify-center text-sm">&#x2705;</span>
                    <div>
                      <p className="font-semibold">Confirm&aacute; y listo</p>
                      <p className="text-white/70 text-sm">MercadoLocal aparece como app en tu celular</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

// ==========================================
// MINI-BANNER FLOTANTE (aparece en mobile después de 10s)
// ==========================================
export function BannerFlotanteInstalar() {
  const [visible, setVisible] = useState(false)
  const [cerrado, setCerrado] = useState(true)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installCount] = useState(getInstallCount)

  useEffect(() => {
    const info = detectarDispositivo()
    if (info.isStandalone) return

    // Retargeting: si cerró hace menos de 3 días, no mostrar
    if (getBannerCerrado()) return

    setCerrado(false)

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Mostrar después de 10 segundos de navegación
    const timer = setTimeout(() => setVisible(true), 10000)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  function handleCerrar() {
    setVisible(false)
    setCerrado(true)
    cerrarBanner()
  }

  async function handleInstalar() {
    if (!deferredPrompt) {
      // Scrollear al banner principal
      const banner = document.getElementById('instalar-app-section')
      if (banner) banner.scrollIntoView({ behavior: 'smooth' })
      handleCerrar()
      return
    }
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    handleCerrar()
  }

  if (cerrado || !visible) return null

  return (
    <div className="fixed bottom-4 left-3 right-3 z-50 sm:left-auto sm:right-4 sm:max-w-sm animate-slide-up">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 relative">
        {/* Botón cerrar */}
        <button
          onClick={handleCerrar}
          className="absolute -top-2 -right-2 w-7 h-7 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-500 text-xs font-bold transition-colors shadow-sm"
        >
          &#x2715;
        </button>

        <div className="flex items-center gap-3">
          {/* Icono app */}
          <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white text-lg">&#x1F6D2;</span>
          </div>

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm">MercadoLocal</p>
            <p className="text-xs text-gray-500 truncate">Instal&aacute; la app en 30 seg &middot; +{installCount} la usan</p>
          </div>

          {/* CTA */}
          <button
            onClick={handleInstalar}
            className="flex-shrink-0 bg-blue-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
          >
            Instalar
          </button>
        </div>
      </div>
    </div>
  )
}
