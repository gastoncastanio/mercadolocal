import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'https://mercadolocal-production.up.railway.app/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 segundos (Render free tier tarda 30-60s en cold start)
})

// Interceptor de reintentos: si falla por timeout o error de red, reintentar 1 vez
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config

    // Reintentar 1 vez si es timeout o error de red (no si es error HTTP como 401/500)
    if (!config._retry && !error.response && (error.code === 'ECONNABORTED' || error.message?.includes('Network Error'))) {
      config._retry = true
      console.log('🔄 Reintentando request:', config.url)
      // Esperar 2 segundos antes de reintentar (dar tiempo al backend para despertar)
      await new Promise(resolve => setTimeout(resolve, 2000))
      return api(config)
    }

    // Manejar 401 (token expirado/inválido) - solo si es respuesta real del servidor
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      delete api.defaults.headers.common['Authorization']
      const path = window.location.pathname
      if (path !== '/login' && path !== '/registro' && path !== '/recuperar') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
