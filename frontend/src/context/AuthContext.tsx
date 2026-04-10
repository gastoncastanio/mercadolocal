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
  logout: () => void
  actualizarTienda: (tienda: Tienda) => void
  estaLogueado: boolean
  esVendedor: boolean
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
    } catch (error) {
      console.error('Error cargando perfil:', error)
      logout()
    } finally {
      setCargando(false)
    }
  }

  async function login(email: string, contraseña: string) {
    const res = await api.post('/auth/login', { email, contraseña })
    const { usuario: u, tienda: t, token: tk } = res.data

    setUsuario(u)
    setTienda(t)
    setToken(tk)
    localStorage.setItem('token', tk)
    api.defaults.headers.common['Authorization'] = `Bearer ${tk}`
  }

  async function registro(datos: any) {
    const res = await api.post('/auth/registro', datos)
    const { usuario: u, tienda: t, token: tk } = res.data

    setUsuario(u)
    setTienda(t)
    setToken(tk)
    localStorage.setItem('token', tk)
    api.defaults.headers.common['Authorization'] = `Bearer ${tk}`
  }

  function logout() {
    setUsuario(null)
    setTienda(null)
    setToken(null)
    localStorage.removeItem('token')
    delete api.defaults.headers.common['Authorization']
  }

  function actualizarTienda(t: Tienda) {
    setTienda(t)
  }

  const estaLogueado = !!usuario
  const esVendedor = usuario?.rol === 'vendedor'
  const esAdmin = usuario?.rol === 'admin'

  return (
    <AuthContext.Provider value={{
      usuario, tienda, token, cargando,
      login, registro, logout, actualizarTienda,
      estaLogueado, esVendedor, esAdmin
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
