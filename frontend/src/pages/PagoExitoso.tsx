import { useEffect, useState, useRef } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import api from '../services/api'

type EstadoVisual = 'verificando' | 'pagada' | 'pendiente_demorado' | 'sin_referencia' | 'error'

const MAX_INTENTOS = 15      // 15 intentos
const INTERVALO_MS = 2000    // cada 2 segundos = 30 seg total

// Estructura de la "cola de pagos" para carritos con varios vendedores.
// Cada vendedor se cobra por separado, así que el comprador paga uno por uno.
interface ItemCola { ordenId: string; total: number; tienda: string }
interface ColaPagos { ordenes: ItemCola[]; pagados: string[] }

export default function PagoExitoso() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const paymentId = params.get('payment_id')
  const externalReference = params.get('external_reference')

  const [estado, setEstado] = useState<EstadoVisual>(externalReference ? 'verificando' : 'sin_referencia')
  const [intentos, setIntentos] = useState(0)
  const timeoutRef = useRef<number | null>(null)
  const cancelado = useRef(false)

  // --- Cola de pagos multi-vendedor ---
  const [colaSiguiente, setColaSiguiente] = useState<ItemCola | null>(null)
  const [colaProgreso, setColaProgreso] = useState<{ pagados: number; total: number } | null>(null)
  const [continuando, setContinuando] = useState(false)
  const [errorCola, setErrorCola] = useState('')

  // Procesar la cola de pagos al volver de Mercado Pago.
  useEffect(() => {
    const raw = localStorage.getItem('ml_cola_pagos')
    if (!raw) return
    try {
      const cola: ColaPagos = JSON.parse(raw)
      if (!cola?.ordenes?.length) {
        localStorage.removeItem('ml_cola_pagos')
        return
      }
      // Marcar como pagada la orden que se acaba de pagar
      if (externalReference && !cola.pagados.includes(externalReference)) {
        cola.pagados.push(externalReference)
      }
      const pendientes = cola.ordenes.filter(o => !cola.pagados.includes(o.ordenId))
      setColaProgreso({ pagados: cola.pagados.length, total: cola.ordenes.length })

      if (pendientes.length > 0) {
        localStorage.setItem('ml_cola_pagos', JSON.stringify(cola))
        setColaSiguiente(pendientes[0])
      } else {
        // Ya se pagaron todos los vendedores: limpiar la cola
        localStorage.removeItem('ml_cola_pagos')
        setColaSiguiente(null)
      }
    } catch {
      localStorage.removeItem('ml_cola_pagos')
    }
  }, [externalReference])

  // Continuar con el pago del siguiente vendedor
  async function continuarPago() {
    if (!colaSiguiente) return
    setContinuando(true)
    setErrorCola('')
    try {
      const resPago = await api.post('/pagos/crear-preferencia', { ordenId: colaSiguiente.ordenId })
      const mpUrl = resPago.data.initPoint
      if (mpUrl && mpUrl.startsWith('https://') && mpUrl.includes('mercadopago.com')) {
        window.location.href = mpUrl
      } else {
        setErrorCola('No se pudo generar el pago. Probá de nuevo.')
        setContinuando(false)
      }
    } catch (err: any) {
      setErrorCola(err.response?.data?.error || 'No se pudo generar el pago. Probá de nuevo.')
      setContinuando(false)
    }
  }

  useEffect(() => {
    cancelado.current = false

    // Sin external_reference: mostrar éxito genérico (caso fallback)
    if (!externalReference) {
      setEstado('sin_referencia')
      return
    }

    let intentoActual = 0

    async function consultarEstado() {
      if (cancelado.current) return
      try {
        const res = await api.get(`/pagos/estado/${externalReference}`)
        const estadoOrden = res.data?.estado
        const mpStatus = res.data?.mpStatus

        if (cancelado.current) return

        if (estadoOrden === 'pagada' || estadoOrden === 'enviada' || estadoOrden === 'completada') {
          setEstado('pagada')
          return
        }

        if (estadoOrden === 'cancelada' || mpStatus === 'rejected') {
          navigate('/pago-fallido', { replace: true })
          return
        }

        // Aún pendiente: reintentar
        intentoActual += 1
        setIntentos(intentoActual)
        if (intentoActual >= MAX_INTENTOS) {
          setEstado('pendiente_demorado')
          return
        }
        timeoutRef.current = window.setTimeout(consultarEstado, INTERVALO_MS)
      } catch (err: any) {
        // Si no se puede consultar (401, etc.), igual mostrar pantalla genérica de éxito
        if (cancelado.current) return
        intentoActual += 1
        setIntentos(intentoActual)
        if (intentoActual >= MAX_INTENTOS) {
          setEstado('pendiente_demorado')
          return
        }
        timeoutRef.current = window.setTimeout(consultarEstado, INTERVALO_MS)
      }
    }

    consultarEstado()

    return () => {
      cancelado.current = true
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [externalReference, navigate])

  // ===== Pantalla de "continuar pago" (carrito con varios vendedores) =====
  if (colaSiguiente) {
    return (
      <div className="min-h-screen bg-ml-bg flex items-center justify-center px-4">
        <div className="text-center bg-white rounded-2xl shadow-lg p-8 sm:p-12 max-w-md w-full">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          {colaProgreso && (
            <p className="text-sm font-semibold text-green-600 mb-1">
              Pago {colaProgreso.pagados} de {colaProgreso.total} listo
            </p>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">¡Falta un pago más!</h1>
          <p className="text-gray-500 mb-4">
            Como compraste a varios vendedores, cada uno cobra por separado.
          </p>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-4">
            <p className="text-sm text-blue-900">
              Te queda pagar a <strong>{colaSiguiente.tienda}</strong>
            </p>
            <p className="text-2xl font-bold text-blue-700 mt-1">
              ${colaSiguiente.total.toLocaleString('es-AR')}
            </p>
          </div>

          {errorCola && <p className="text-sm text-red-500 mb-3">{errorCola}</p>}

          <div className="space-y-3">
            <button
              onClick={continuarPago}
              disabled={continuando}
              className="block w-full py-4 bg-[#009ee3] text-white rounded-xl font-bold hover:bg-[#0087c9] transition-colors disabled:opacity-50"
            >
              {continuando ? 'Redirigiendo a Mercado Pago...' : `Pagar a ${colaSiguiente.tienda}`}
            </button>
            <Link
              to="/mis-ordenes"
              className="block w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Lo hago después
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ml-bg flex items-center justify-center px-4">
      <div className="text-center bg-white rounded-2xl shadow-lg p-8 sm:p-12 max-w-md w-full">
        {estado === 'verificando' && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">Verificando tu pago...</h1>
            <p className="text-gray-500 mb-2">Estamos confirmando con Mercado Pago.</p>
            <p className="text-xs text-gray-400 mb-6">Intento {intentos + 1} de {MAX_INTENTOS}. No cierres esta ventana.</p>
          </>
        )}

        {estado === 'pagada' && (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
              <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">¡Pago confirmado!</h1>
            {colaProgreso && colaProgreso.total > 1 ? (
              <p className="text-gray-500 mb-2">¡Listo! Pagaste a los {colaProgreso.total} vendedores de tu compra.</p>
            ) : (
              <p className="text-gray-500 mb-2">Tu pedido fue procesado correctamente.</p>
            )}
            {paymentId && (
              <p className="text-xs text-gray-400 mb-6">ID de pago: {paymentId}</p>
            )}
          </>
        )}

        {estado === 'pendiente_demorado' && (
          <>
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">⏳</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">Tu pago está siendo procesado</h1>
            <p className="text-gray-500 mb-6">
              Te avisaremos por email cuando se confirme. Podés ver el estado actualizado en "Mis pedidos".
            </p>
          </>
        )}

        {estado === 'sin_referencia' && (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">¡Pago Exitoso!</h1>
            <p className="text-gray-500 mb-2">Tu pedido fue procesado correctamente.</p>
            {paymentId && (
              <p className="text-xs text-gray-400 mb-6">ID de pago: {paymentId}</p>
            )}
          </>
        )}

        <div className="space-y-3 mt-6">
          <Link
            to="/mis-ordenes"
            className="block w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
          >
            Ver mis pedidos
          </Link>
          <Link
            to="/catalogo"
            className="block w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
          >
            Seguir comprando
          </Link>
        </div>
      </div>
    </div>
  )
}
