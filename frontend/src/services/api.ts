import axios from 'axios'
import { Proyecto, Logo, GeneracionRequest } from '../types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 segundos máximo por request
})

// Interceptor: manejar 401 (token expirado/inválido)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token inválido o expirado - limpiar sesión
      localStorage.removeItem('token')
      delete api.defaults.headers.common['Authorization']
      // Redirigir a login solo si no estamos ya en login/registro
      const path = window.location.pathname
      if (path !== '/login' && path !== '/registro' && path !== '/recuperar') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Proyectos
export const proyectosAPI = {
  crear: (proyecto: Partial<Proyecto>) =>
    api.post<Proyecto>('/proyectos', proyecto),
  obtener: (id: string) =>
    api.get<Proyecto>(`/proyectos/${id}`),
  listar: () =>
    api.get<Proyecto[]>('/proyectos'),
  actualizar: (id: string, datos: Partial<Proyecto>) =>
    api.put<Proyecto>(`/proyectos/${id}`, datos),
  eliminar: (id: string) =>
    api.delete(`/proyectos/${id}`),
}

// Logos
export const logosAPI = {
  generarLogos: (request: GeneracionRequest) =>
    api.post<Logo[]>('/logos/generar', request),
  obtener: (id: string) =>
    api.get<Logo>(`/logos/${id}`),
  marcarFavorito: (id: string, favorito: boolean) =>
    api.put<Logo>(`/logos/${id}/favorito`, { favorito }),
  generarVariaciones: (logoId: string, cantidad: number) =>
    api.post(`/logos/${logoId}/variaciones`, { cantidad }),
  descargar: (logoId: string, formato: 'png' | 'svg' | 'pdf') =>
    api.get(`/logos/${logoId}/descargar?formato=${formato}`, { responseType: 'blob' }),
}

export default api
