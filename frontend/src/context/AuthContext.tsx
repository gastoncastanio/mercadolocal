import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Usuario, Tienda } from '../types'
import api from '../services/api'

interface AuthContextType {
  usuario: Usuario | null
  tienda: Tienda | null
  token: string | null
  cargando: boolean
  login: (email: string, contraseña: string) => Promise<void>
  registro: (datos: any) => Promise<void>
  logout: () => Promise<void>
  actualizarTienda: (tienda: Tienda) => void
  refreshAccessToken: () => Promise<string | null>
  estaLogueado: boolean
  esVendedor: boolean
  tieneVendedor: boolean
  esAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [tienda, setTienda] = useState<Tienda | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [cargando, setCargando] = useState(true)

  // Cargar usuario al iniciar
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      cargarPerfil()
    } else {
      setCargando(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function cargarPerfil() {
    try {
      const res = await api.get('/auth/perfil')
      setUsuario(res.data.usuario)
      setTienda(res.data.tienda)
    } catch (error: any) {
      console.error('Error cargando perfil:', error)
      // Solo hacer logout si el servidor respondió 401 (token inválido/expirado)
      // El interceptor de api.ts ya intentó refrescar el token automáticamente.
      if (error.response?.status === 401) {
        await logout()
      }
      // Si es timeout/red, mantener el token en localStorage para reintentar después
    } finally {
      setCargando(false)
    }
  }

  // Refrescar manualmente el access token (expuesto por contexto si algún componente lo necesita)
  async function refreshAccessToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) return null
    try {
      const res = await api.post('/auth/refresh', { refreshToken })
      const nuevoToken = res.data?.token
      const nuevoRefresh = res.data?.refreshToken
      if (nuevoToken) {
        localStorage.setItem('token', nuevoToken)
        api.defaults.headers.common['Authorization'] = `Bearer ${nuevoToken}`
        setToken(nuevoToken)
      }
      if (nuevoRefresh) {
        localStorage.setItem('refreshToken', nuevoRefresh)
      }
      return nuevoToken || null
    } catch {
      return null
    }
  }

  async function login(email: string, contraseña: string) {
    const res = await api.post('/auth/login', { email, contraseña })
    const { usuario: u, tienda: t, token: tk, refreshToken: rt } = res.data

    setUsuario(u)
    setTienda(t)
    setToken(tk)
    localStorage.setItem('token', tk)
    if (rt) localStorage.setItem('refreshToken', rt)
    api.defaults.headers.common['Authorization'] = `Bearer ${tk}`
  }

  async function registro(datos: any) {
    const res = await api.post('/auth/registro', datos)
    const { usuario: u, tienda: t, token: tk, refreshToken: rt } = res.data

    setUsuario(u)
    setTienda(t)
    setToken(tk)
    localStorage.setItem('token', tk)
    if (rt) localStorage.setItem('refreshToken', rt)
    api.defaults.headers.common['Authorization'] = `Bearer ${tk}`
  }

  async function logout() {
    // Avisar al backend para que invalide el refresh token (best-effort)
    const refreshToken = localStorage.getItem('refreshToken')
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refreshToken })
      } catch {
        // Ignorar errores: igual cerramos sesión local
      }
    }
    setUsuario(null)
    setTienda(null)
    setToken(null)
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    delete api.defaults.headers.common['Authorization']
  }

  function actualizarTienda(t: Tienda) {
    setTienda(t)
  }

  const estaLogueado = !!usuario
  // Tiene capacidad de vender si: tiene el flag nuevo, YA tiene una tienda
  // (cubre vendedores existentes sin migración), o es rol legacy 'vendedor'.
  const tieneVendedor = (usuario?.tieneVendedor ?? false) || !!tienda || usuario?.rol === 'vendedor'
  const esVendedor = tieneVendedor || usuario?.rol === 'admin'
  const esAdmin = usuario?.rol === 'admin'

  return (
    <AuthContext.Provider value={{
      usuario, tienda, token, cargando,
      login, registro, logout, actualizarTienda, refreshAccessToken,
      estaLogueado, esVendedor, tieneVendedor, esAdmin
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider')
  }
  return context
}
