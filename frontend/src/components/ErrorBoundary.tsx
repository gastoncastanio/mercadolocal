import { Component, ReactNode } from 'react'
import { reportarError } from '../services/monitoring'

interface Props {
  children: ReactNode
  /**
   * Cuando alguno de estos valores cambia, el boundary se "cura" solo
   * (resetea el estado de error). Útil para pasar el pathname: al navegar a
   * otra ruta, un error de la página anterior se limpia sin recargar todo.
   */
  resetKeys?: unknown[]
  /**
   * `true` → fallback acotado (encaja dentro del área de contenido, no pantalla
   * completa). Se usa para el boundary por-ruta, así el error de una página no
   * tapa toda la app.
   */
  inline?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
}

function clavesIguales(a?: unknown[], b?: unknown[]): boolean {
  if (a === b) return true
  if (!a || !b || a.length !== b.length) return false
  return a.every((v, i) => Object.is(v, b[i]))
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Reporte centralizado (consola hoy, Sentry cuando se enchufe).
    reportarError(error, { componentStack: errorInfo?.componentStack })
  }

  componentDidUpdate(prevProps: Props) {
    // Si estamos en error y cambiaron las resetKeys (ej: el usuario navegó),
    // nos curamos solos para volver a intentar renderizar.
    if (this.state.hasError && !clavesIguales(prevProps.resetKeys, this.props.resetKeys)) {
      this.setState({ hasError: false, error: null })
    }
  }

  render() {
    if (this.state.hasError) {
      // Fallback acotado: para boundaries por-ruta. No ocupa toda la pantalla y
      // ofrece reintentar (re-render) sin recargar la app entera.
      if (this.props.inline) {
        return (
          <div className="min-h-[60vh] flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 max-w-md w-full text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="font-display text-lg font-extrabold text-ml-ink mb-1">Esta sección tuvo un problema</h2>
              <p className="text-ml-muted text-sm mb-4">
                El resto de la app sigue funcionando. Probá de nuevo o volvé al inicio.
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => this.setState({ hasError: false, error: null })}
                  className="px-4 py-2 ml-grad text-white rounded-lg text-sm font-semibold"
                >
                  Reintentar
                </button>
                <button
                  onClick={() => { window.location.href = '/' }}
                  className="px-4 py-2 border border-ml-line text-ml-ink rounded-lg text-sm font-medium hover:bg-ml-bg"
                >
                  Ir al inicio
                </button>
              </div>
            </div>
          </div>
        )
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="font-display text-[24px] font-extrabold text-ml-ink mb-2">Algo no carga bien</h1>
            <p className="text-ml-muted mb-6">
              Hubo un error inesperado. Esto puede pasar si el servidor estaba cargando.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.reload()
                }}
                className="w-full py-3 ml-grad text-white rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                Recargar la pagina
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.href = '/'
                }}
                className="w-full py-3 border border-ml-line text-ml-ink rounded-xl font-medium hover:bg-ml-bg transition-all"
              >
                Ir al inicio
              </button>
            </div>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-xs text-ml-muted cursor-pointer">Detalle del error</summary>
                <pre className="mt-2 text-xs text-red-400 bg-red-50 p-3 rounded-lg overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
