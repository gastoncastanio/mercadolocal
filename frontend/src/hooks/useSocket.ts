import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { SOCKET_URL } from '../services/api'

let socketInstance: Socket | null = null

/**
 * Hook para conectarse a WebSocket.
 * Comparte una sola conexion global para toda la app.
 */
export function useSocket(userId?: string) {
  const callbacksRef = useRef<Map<string, (data: any) => void>>(new Map())

  useEffect(() => {
    // Sin userId (visitante anónimo) no abrimos socket: no hay sala personal a
    // la que unirse y evitamos una conexión inútil en páginas públicas como la
    // landing (además de posibles errores de consola si el WS no resuelve en
    // ciertos entornos). Al loguearse, el efecto re-corre con userId y conecta.
    if (!userId) return

    // Crear conexion solo si no existe
    if (!socketInstance) {
      socketInstance = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        timeout: 30000
      })

      socketInstance.on('connect', () => {
        console.log('⚡ WebSocket conectado')
      })

      socketInstance.on('disconnect', (reason) => {
        console.log('🔌 WebSocket desconectado:', reason)
      })

      socketInstance.on('connect_error', (err) => {
        console.warn('WebSocket error:', err.message)
      })
    }

    // Para unirnos a la sala personal mandamos el JWT (el server lo verifica
    // y extrae el userId). Nunca el userId crudo: eso permitiría espiar la
    // sala de otro usuario.
    const enviarAuth = () => {
      const token = localStorage.getItem('token')
      if (userId && token) {
        socketInstance?.emit('auth', token)
      }
    }

    if (socketInstance.connected) enviarAuth()

    // Si se conecta (o reconecta) después, reenviar auth
    socketInstance.on('connect', enviarAuth)

    return () => {
      socketInstance?.off('connect', enviarAuth)
    }
  }, [userId])

  const on = useCallback((evento: string, callback: (data: any) => void) => {
    if (!socketInstance) return
    callbacksRef.current.set(evento, callback)
    socketInstance.on(evento, callback)
  }, [])

  const off = useCallback((evento: string) => {
    if (!socketInstance) return
    const cb = callbacksRef.current.get(evento)
    if (cb) {
      socketInstance.off(evento, cb)
      callbacksRef.current.delete(evento)
    }
  }, [])

  const emit = useCallback((evento: string, data?: any) => {
    if (!socketInstance) return
    socketInstance.emit(evento, data)
  }, [])

  // Limpiar todos los listeners al desmontar
  useEffect(() => {
    return () => {
      callbacksRef.current.forEach((cb, evento) => {
        socketInstance?.off(evento, cb)
      })
      callbacksRef.current.clear()
    }
  }, [])

  return { on, off, emit, socket: socketInstance }
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
