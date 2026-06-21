import { useState, useEffect, ReactNode } from 'react'

/**
 * Difiere el montaje de sus hijos hasta que el navegador esté ocioso
 * (requestIdleCallback) o hasta que pase un timeout de respaldo.
 *
 * Sirve para sacar widgets no críticos (chat de soporte, banner flotante de
 * instalación) de la ruta crítica de carga: su chunk "lazy" deja de descargarse
 * durante el primer render, así no compite con el JS/CSS que sí necesita la
 * primera pintura. Mejora FCP/LCP sin perder la funcionalidad (el widget
 * aparece un instante después, cuando ya no estorba).
 */
export default function DeferMount({
  children,
  timeout = 2500
}: {
  children: ReactNode
  timeout?: number
}) {
  const [listo, setListo] = useState(false)

  useEffect(() => {
    let idleId: number | undefined
    let timerId: number | undefined
    const activar = () => setListo(true)

    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined

    if (typeof ric === 'function') {
      idleId = ric(activar, { timeout })
    } else {
      // Safari/iOS no tienen requestIdleCallback: usamos un timeout simple.
      timerId = window.setTimeout(activar, timeout)
    }

    return () => {
      const cic = (window as any).cancelIdleCallback as ((id: number) => void) | undefined
      if (idleId !== undefined && typeof cic === 'function') cic(idleId)
      if (timerId !== undefined) clearTimeout(timerId)
    }
  }, [timeout])

  return listo ? <>{children}</> : null
}
