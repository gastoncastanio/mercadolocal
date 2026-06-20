import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

type Estado = 'verificando' | 'activa' | 'pendiente'

const MAX_INTENTOS = 6
const INTERVALO_MS = 2000

/**
 * Página de retorno tras el checkout de la suscripción "Destacado" (back_url del
 * preapproval de MercadoPago). No confiamos en el redirect: verificamos el pago
 * contra MP llamando a /servicios/suscripcion/:id/verificar (que consulta MP y,
 * si está autorizado, activa la suscripción y destaca el perfil). Hacemos polling
 * porque la autorización puede tardar unos segundos en propagarse.
 */
export default function SuscripcionConfirmadaPage() {
  const navigate = useNavigate()
  const [estado, setEstado] = useState<Estado>('verificando')
  const intentos = useRef(0)

  useEffect(() => {
    const suscripcionId = localStorage.getItem('ml_suscripcion_pendiente')
    if (!suscripcionId) {
      // Sin id no podemos verificar (p.ej. volvió en otro dispositivo). Mostramos
      // estado pendiente con un mensaje tranquilizador.
      setEstado('pendiente')
      return
    }

    let cancelado = false
    let timer: ReturnType<typeof setTimeout>

    async function verificar() {
      try {
        const res = await api.post(`/servicios/suscripcion/${suscripcionId}/verificar`)
        if (cancelado) return
        if (res.data?.estado === 'activa') {
          localStorage.removeItem('ml_suscripcion_pendiente')
          setEstado('activa')
          return
        }
      } catch {
        // Reintentamos abajo.
      }
      intentos.current += 1
      if (intentos.current >= MAX_INTENTOS) {
        if (!cancelado) setEstado('pendiente')
        return
      }
      timer = setTimeout(verificar, INTERVALO_MS)
    }

    verificar()
    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [])

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 bg-ml-bg">
      <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-8 max-w-md w-full text-center">
        {estado === 'verificando' && (
          <>
            <div className="spinner mx-auto mb-4" />
            <h1 className="font-display text-xl font-extrabold text-ml-ink mb-2">Confirmando tu pago…</h1>
            <p className="text-ml-muted">Estamos verificando la suscripción con MercadoPago. Esto puede tardar unos segundos.</p>
          </>
        )}

        {estado === 'activa' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="font-display text-2xl font-extrabold text-ml-ink mb-2">¡Ya sos Destacado! ⭐</h1>
            <p className="text-ml-muted mb-6">Tu suscripción está activa. Vas a aparecer arriba en los resultados de tu rubro y localidad.</p>
            <button
              onClick={() => navigate('/servicios/mi-perfil')}
              className="w-full py-3 mlbtn ml-grad text-white rounded-lg font-bold"
            >
              Ver mi perfil
            </button>
          </>
        )}

        {estado === 'pendiente' && (
          <>
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="font-display text-xl font-extrabold text-ml-ink mb-2">Tu pago se está procesando</h1>
            <p className="text-ml-muted mb-6">Apenas MercadoPago confirme el pago, tu perfil va a aparecer destacado automáticamente. Te avisamos por notificación.</p>
            <button
              onClick={() => navigate('/servicios/mi-perfil')}
              className="w-full py-3 border border-ml-line text-ml-ink rounded-lg font-medium hover:bg-ml-bg"
            >
              Volver a mi perfil
            </button>
          </>
        )}
      </div>
    </div>
  )
}
