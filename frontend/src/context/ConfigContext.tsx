import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import api, { SOCKET_URL } from '../services/api'

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

  useEffect(() => {
    cargar()

    // Suscribirse a cambios de configuracion en tiempo real
    let s: Socket | null = null
    try {
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
    } catch (e) {
      console.error('Error conectando socket de config:', e)
    }

    return () => {
      if (s) s.disconnect()
    }
  }, [])

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
