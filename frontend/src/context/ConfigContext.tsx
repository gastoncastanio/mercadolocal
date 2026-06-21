import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Socket } from 'socket.io-client'
import api, { SOCKET_URL } from '../services/api'
import { useAuth } from './AuthContext'

// Mapa simple clave -> valor para configuraciones publicas
type ConfigMap = Record<string, string>

interface ConfigContextType {
  config: ConfigMap
  cargando: boolean
  getConfig: (clave: string, valorDefecto?: string) => string
  recargar: () => Promise<void>
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined)

export function ConfigProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  const [config, setConfig] = useState<ConfigMap>({})
  const [cargando, setCargando] = useState(true)

  async function cargar() {
    try {
      const res = await api.get('/config/publica')
      setConfig(res.data || {})
    } catch (e) {
      console.error('Error cargando configuracion publica:', e)
    } finally {
      setCargando(false)
    }
  }

  // El fetch HTTP de config corre siempre (también para visitantes anónimos).
  useEffect(() => {
    cargar()
  }, [])

  // El socket de config en vivo solo se abre cuando hay sesión iniciada. En la
  // landing anónima no aporta valor (el visitante ya tiene la config del fetch)
  // y, de abrirlo para todos, sumaba una conexión en la home + un posible error
  // de consola en entornos donde el WS no resuelve. Reconecta al loguearse.
  useEffect(() => {
    if (!usuario) return

    let s: Socket | null = null
    let cancelado = false

    // Import dinámico de socket.io-client: así la librería NO entra al bundle
    // inicial (la home anónima no la necesita) y solo se descarga al iniciar
    // sesión, cuando de verdad abrimos la conexión en vivo.
    import('socket.io-client')
      .then(({ io }) => {
        if (cancelado) return
        s = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
        s.on('config:actualizado', (data: { cambios: Array<{ clave: string; valor: string }> }) => {
          setConfig(prev => {
            const nuevo = { ...prev }
            if (Array.isArray(data?.cambios)) {
              data.cambios.forEach(c => {
                if (c && c.clave) nuevo[c.clave] = c.valor
              })
            }
            return nuevo
          })
        })
      })
      .catch(e => console.error('Error conectando socket de config:', e))

    return () => {
      cancelado = true
      if (s) s.disconnect()
    }
  }, [usuario])

  const getConfig = (clave: string, valorDefecto = '') => config[clave] ?? valorDefecto

  return (
    <ConfigContext.Provider value={{ config, cargando, getConfig, recargar: cargar }}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig() {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig debe usarse dentro de ConfigProvider')
  return ctx
}
