import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

// FORZAMOS Railway como backend único. La variable de entorno VITE_API_URL
// en Vercel todavía apuntaba a un backend viejo en Render que NO tiene
// los agentes IA ni los últimos cambios. Hasta que limpiemos esa variable
// en Vercel, hardcodeamos la URL correcta.
const API_URL = 'https://mercadolocal-production.up.railway.app/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 segundos (Render free tier tarda 30-60s en cold start)
})

// ===== Identidad anónima (pauta inteligente) =====
// Para perfilar el interés de los visitantes SIN cuenta, generamos un id
// aleatorio y lo guardamos en el navegador. No tiene relación con datos
// personales: solo sirve para que la publicidad sea relevante (categorías
// que mira) y mejore con el tiempo. Se envía en el header 'x-anon-id'.
function obtenerAnonId(): string {
  try {
    let id = localStorage.getItem('ml_anon_id')
    if (!id) {
      const rnd = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, '')
        : Math.random().toString(36).slice(2) + Date.now().toString(36)
      id = `a_${rnd}`.slice(0, 48)
      localStorage.setItem('ml_anon_id', id)
    }
    return id
  } catch {
    return ''
  }
}

// Interceptor de request: adjunta el id anónimo a todas las llamadas, salvo que
// el visitante haya rechazado el perfilado (derecho de oposición, Ley 25.326).
api.interceptors.request.use((config) => {
  let rechazado = false
  try { rechazado = localStorage.getItem('ml_no_perfilar') === '1' } catch { /* noop */ }
  if (!rechazado) {
    const anon = obtenerAnonId()
    if (anon) config.headers.set?.('x-anon-id', anon)
  }
  return config
})

// Estado del refresh: evita disparar múltiples /refresh en paralelo cuando varios requests
// fallan con 401 al mismo tiempo. Encolamos los requests pendientes y los reanudamos cuando
// el refresh termina.
let refreshPromesa: Promise<string | null> | null = null
let suscriptores: Array<(token: string | null) => void> = []

function notificarSuscriptores(token: string | null) {
  suscriptores.forEach((cb) => cb(token))
  suscriptores = []
}

function agregarSuscriptor(cb: (token: string | null) => void) {
  suscriptores.push(cb)
}

async function refrescarAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken')
  if (!refreshToken) return null

  try {
    // Usamos axios "crudo" (no la instancia api) para no caer en el interceptor
    const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken }, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' }
    })
    const nuevoToken = res.data?.token
    const nuevoRefresh = res.data?.refreshToken
    if (nuevoToken) {
      localStorage.setItem('token', nuevoToken)
      api.defaults.headers.common['Authorization'] = `Bearer ${nuevoToken}`
    }
    if (nuevoRefresh) {
      localStorage.setItem('refreshToken', nuevoRefresh)
    }
    return nuevoToken || null
  } catch {
    return null
  }
}

// Interceptor de respuesta: manejo de timeouts, errores de red y refresh de token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _refreshRetry?: boolean }
    if (!config) return Promise.reject(error)

    // Reintentar 1 vez si es timeout o error de red (no si es error HTTP como 401/500)
    if (!config._retry && !error.response && (error.code === 'ECONNABORTED' || error.message?.includes('Network Error'))) {
      config._retry = true
      console.log('Reintentando request:', config.url)
      await new Promise((resolve) => setTimeout(resolve, 2000))
      return api(config)
    }

    // Manejar 401: intentar refrescar el token y reintentar el request original
    if (error.response?.status === 401 && !config._refreshRetry) {
      const url = (config.url || '').toString()
      const esRequestDeRefresh = url.includes('/auth/refresh')
      const esRequestDeLogin = url.includes('/auth/login') || url.includes('/auth/registro')

      // No intentar refresh para los endpoints de auth (evita loops)
      if (esRequestDeRefresh || esRequestDeLogin) {
        if (esRequestDeRefresh) {
          // Si /refresh falló, limpiar tokens
          localStorage.removeItem('token')
          localStorage.removeItem('refreshToken')
          delete api.defaults.headers.common['Authorization']
        }
        return Promise.reject(error)
      }

      config._refreshRetry = true

      // Si ya hay un refresh en curso, esperar a que termine
      if (refreshPromesa) {
        return new Promise((resolve, reject) => {
          agregarSuscriptor((token) => {
            if (token) {
              if (config.headers) {
                config.headers.Authorization = `Bearer ${token}`
              }
              resolve(api(config))
            } else {
              reject(error)
            }
          })
        })
      }

      // Iniciar el refresh
      refreshPromesa = refrescarAccessToken()
      try {
        const nuevoToken = await refreshPromesa
        notificarSuscriptores(nuevoToken)

        if (nuevoToken) {
          if (config.headers) {
            config.headers.Authorization = `Bearer ${nuevoToken}`
          }
          return api(config)
        }

        // Refresh falló: limpiar y redirigir a login
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        delete api.defaults.headers.common['Authorization']
        const path = window.location.pathname
        if (path !== '/login' && path !== '/registro' && path !== '/recuperar' && path !== '/recuperar-password' && path !== '/') {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      } finally {
        refreshPromesa = null
      }
    }

    return Promise.reject(error)
  }
)

export default api
