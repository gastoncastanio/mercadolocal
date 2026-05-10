import { createContext, useContext, useState, ReactNode, useCallback } from 'react'

// Tipos de notificacion soportados
type ToastTipo = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: number
  mensaje: string
  tipo: ToastTipo
}

interface ToastContextType {
  mostrar: (mensaje: string, tipo?: ToastTipo) => void
  exito: (mensaje: string) => void
  error: (mensaje: string) => void
  info: (mensaje: string) => void
  warning: (mensaje: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const mostrar = useCallback((mensaje: string, tipo: ToastTipo = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, mensaje, tipo }])
    // Auto-cierre a los 4 segundos
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const exito = useCallback((m: string) => mostrar(m, 'success'), [mostrar])
  const error = useCallback((m: string) => mostrar(m, 'error'), [mostrar])
  const info = useCallback((m: string) => mostrar(m, 'info'), [mostrar])
  const warning = useCallback((m: string) => mostrar(m, 'warning'), [mostrar])

  // Estilos por tipo
  const colores: Record<ToastTipo, string> = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    warning: 'bg-orange-500'
  }
  const iconos: Record<ToastTipo, string> = {
    success: '✓',
    error: '✕',
    info: 'i',
    warning: '!'
  }

  return (
    <ToastContext.Provider value={{ mostrar, exito, error, info, warning }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`${colores[t.tipo]} text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 pointer-events-auto animate-slide-in min-w-[280px] max-w-md`}
          >
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
              {iconos[t.tipo]}
            </div>
            <span className="text-sm font-medium flex-1">{t.mensaje}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="text-white/70 hover:text-white text-lg leading-none"
              aria-label="Cerrar notificacion"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
