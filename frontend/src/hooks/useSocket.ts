import { useEffect, useRef, useCallback, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { SOCKET_URL } from '../services/api'

// Instancia única compartida por toda la app.
let socketInstance: Socket | null = null
// Promesa de creación en curso (guard para no crear dos sockets en paralelo).
let creando: Promise<Socket> | null = null
// Suscriptores que quieren enterarse cuando el socket queda creado (para que el
// hook re-renderice y exponga el socket "vivo" a quienes lo leen directo).
const suscriptores = new Set<(s: Socket) => void>()

/**
 * Crea (una sola vez) la conexión WebSocket, importando socket.io-client de
 * forma dinámica. Así la librería NO entra al bundle inicial: la home anónima
 * no la descarga, y solo se trae cuando de verdad hace falta abrir el socket
 * (al haber sesión). Devuelve siempre la misma instancia.
 */
function asegurarSocket(): Promise<Socket> {
  if (socketInstance) return Promise.resolve(socketInstance)
  if (!creando) {
    creando = import('socket.io-client').then(({ io }) => {
      const s = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        timeout: 30000
      })

      s.on('connect', () => {
        console.log('⚡ WebSocket conectado')
      })
      s.on('disconnect', (reason) => {
        console.log('🔌 WebSocket desconectado:', reason)
      })
      s.on('connect_error', (err) => {
        console.warn('WebSocket error:', err.message)
      })

      socketInstance = s
      suscriptores.forEach(fn => fn(s))
      return s
    })
  }
  return creando
}

/**
 * Hook para conectarse a WebSocket.
 * Comparte una sola conexion global para toda la app.
 */
export function useSocket(userId?: string) {
  const callbacksRef = useRef<Map<string, (data: any) => void>>(new Map())
  // Exponemos el socket como estado para que el componente re-renderice cuando
  // se crea (la creación es asíncrona por el import dinámico).
  const [socket, setSocket] = useState<Socket | null>(socketInstance)

  // Mantener `socket` al día: si ya existe lo tomamos; si no, nos suscribimos a
  // su creación.
  useEffect(() => {
    if (socketInstance) {
      setSocket(socketInstance)
      return
    }
    const fn = (s: Socket) => setSocket(s)
    suscriptores.add(fn)
    return () => { suscriptores.delete(fn) }
  }, [])

  useEffect(() => {
    // Sin userId (visitante anónimo) no abrimos socket: no hay sala personal a
    // la que unirse y evitamos una conexión inútil en páginas públicas como la
    // landing (además de posibles errores de consola si el WS no resuelve en
    // ciertos entornos). Al loguearse, el efecto re-corre con userId y conecta.
    if (!userId) return

    let cancelado = false
    let limpiarAuth: (() => void) | undefined

    asegurarSocket().then((s) => {
      if (cancelado) return

      // Para unirnos a la sala personal mandamos el JWT (el server lo verifica
      // y extrae el userId). Nunca el userId crudo: eso permitiría espiar la
      // sala de otro usuario.
      const enviarAuth = () => {
        const token = localStorage.getItem('token')
        if (userId && token) s.emit('auth', token)
      }

      if (s.connected) enviarAuth()
      // Si se conecta (o reconecta) después, reenviar auth
      s.on('connect', enviarAuth)
      limpiarAuth = () => s.off('connect', enviarAuth)
    })

    return () => {
      cancelado = true
      if (limpiarAuth) limpiarAuth()
    }
  }, [userId])

  const on = useCallback((evento: string, callback: (data: any) => void) => {
    callbacksRef.current.set(evento, callback)
    if (socketInstance) {
      socketInstance.on(evento, callback)
    } else if (creando) {
      // Hay una creación en curso (la disparó algún efecto con userId): nos
      // enganchamos cuando el socket esté listo, salvo que mientras tanto se
      // haya quitado o reemplazado este listener.
      creando.then(s => {
        if (callbacksRef.current.get(evento) === callback) s.on(evento, callback)
      })
    }
    // Si no hay socket ni creación en curso (anónimo sin sesión), no hacemos
    // nada: igual que antes, sin abrir una conexión.
  }, [])

  const off = useCallback((evento: string) => {
    const cb = callbacksRef.current.get(evento)
    if (cb && socketInstance) socketInstance.off(evento, cb)
    callbacksRef.current.delete(evento)
  }, [])

  const emit = useCallback((evento: string, data?: any) => {
    if (socketInstance) socketInstance.emit(evento, data)
  }, [])

  // Limpiar todos los listeners al desmontar
  useEffect(() => {
    const callbacks = callbacksRef.current
    return () => {
      callbacks.forEach((cb, evento) => {
        socketInstance?.off(evento, cb)
      })
      callbacks.clear()
    }
  }, [])

  return { on, off, emit, socket }
}

/**
 * Hook simplificado para escuchar notificaciones en tiempo real
 */
export function useNotificacionesSocket(
  userId: string | undefined,
  onNotificacion: (data: any) => void
) {
  const { on, off } = useSocket(userId)

  useEffect(() => {
    if (!userId) return
    on('notificacion', onNotificacion)
    on('pago:aprobado', onNotificacion)
    on('venta:confirmada', onNotificacion)
    on('orden:estado', onNotificacion)

    return () => {
      off('notificacion')
      off('pago:aprobado')
      off('venta:confirmada')
      off('orden:estado')
    }
  }, [userId, on, off, onNotificacion])
}
