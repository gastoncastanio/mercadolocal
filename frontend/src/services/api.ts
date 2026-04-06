import axios from 'axios'
import { Proyecto, Logo, GeneracionRequest } from '../types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

console.log('🔌 API_URL configurada:', API_URL)

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor para debug
api.interceptors.request.use(
  (config) => {
    console.log('📤 Request enviado a:', config.baseURL + config.url)
    return config
  },
  (error) => {
    console.error('❌ Error en request:', error)
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => {
    console.log('📥 Response recibido:', response.status)
    return response
  },
  (error) => {
    console.error('❌ Error en response:', error.message)
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
  generarLogos: (request: GeneracionRequest) => {
    console.log('🎨 Generando logos con request:', request)
    return api.post<Logo[]>('/logos/generar', request)
  },
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
