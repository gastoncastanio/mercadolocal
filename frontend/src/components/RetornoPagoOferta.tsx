import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { guardarCodigo } from '../utils/canjes'

// Overlay que aparece cuando MercadoPago redirige de vuelta a /radar?pago=...&canje=...
// Confirma el pago contra el backend (que a su vez valida con MP) y, si está aprobado,
// guarda el código en el caché local y lleva a "Mis canjes".
type Estado = 'idle' | 'procesando' | 'ok' | 'pendiente' | 'error'

export default function RetornoPagoOferta() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [estado, setEstado] = useState<Estado>('idle')
  const yaCorrio = useRef(false)

  const pago = params.get('pago')
  const canje = params.get('canje')

  useEffect(() => {
    if (yaCorrio.current) return
    if (!pago) return
    yaCorrio.current = true

    if (pago === 'error') { setEstado('error'); return }
    if (pago === 'pendiente') { setEstado('pendiente'); return }
    if (pago === 'ok' && canje) { confirmar(canje) }
  }, [pago, canje])

  async function confirmar(canjeId: string) {
    setEstado('procesando')
    // El pago puede tardar unos segundos en acreditarse: reintentamos algunas veces.
    for (let intento = 0; intento < 6; intento++) {
      try {
        const res = await api.post(`/centro/canje/${canjeId}/confirmar-pago`)
        const d = res.data
        if (d.codigo) {
          guardarCodigo(canjeId, d.codigo, d.expiraEn)
          setEstado('ok')
          setTimeout(() => navigate('/mis-canjes'), 1200)
          return
        }
        if (d.yaConfirmado) {
          setEstado('ok')
          setTimeout(() => navigate('/mis-canjes'), 800)
          return
        }
        // pagado === false → todavía no se acreditó; esperar y reintentar
      } catch {
        /* error de red puntual: reintentamos */
      }
      await new Promise(r => setTimeout(r, 2000))
    }
    setEstado('pendiente')
  }

  function cerrar() {
    // Limpia los query params para no re-disparar el overlay
    params.delete('pago')
    params.delete('canje')
    setParams(params, { replace: true })
    setEstado('idle')
  }

  if (estado === 'idle' || !pago) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center">
        {estado === 'procesando' && (
          <>
            <div className="spinner mx-auto mb-4" />
            <h2 className="font-display text-xl font-extrabold text-ml-ink mb-1">Confirmando tu pago…</h2>
            <p className="text-sm text-ml-muted">Estamos validando con MercadoPago. No cierres esta pantalla.</p>
          </>
        )}

        {estado === 'ok' && (
          <>
            <div className="text-5xl mb-3">✅</div>
            <h2 className="font-display text-xl font-extrabold text-ml-ink mb-1">¡Pago confirmado!</h2>
            <p className="text-sm text-ml-muted">Te llevamos a tu código de canje…</p>
          </>
        )}

        {estado === 'pendiente' && (
          <>
            <div className="text-5xl mb-3">⏳</div>
            <h2 className="font-display text-xl font-extrabold text-ml-ink mb-1">Pago en proceso</h2>
            <p className="text-sm text-ml-muted mb-5">
              MercadoPago todavía no acreditó el pago. Apenas se confirme, tu código aparece en "Mis canjes".
            </p>
            <div className="flex gap-3">
              <button onClick={cerrar} className="flex-1 py-3 bg-white border border-ml-line rounded-2xl font-bold text-ml-soft">
                Cerrar
              </button>
              <button onClick={() => navigate('/mis-canjes')} className="flex-1 py-3 ml-grad text-white rounded-2xl font-bold">
                Ver mis canjes
              </button>
            </div>
          </>
        )}

        {estado === 'error' && (
          <>
            <div className="text-5xl mb-3">❌</div>
            <h2 className="font-display text-xl font-extrabold text-ml-ink mb-1">El pago no se completó</h2>
            <p className="text-sm text-ml-muted mb-5">No se realizó ningún cobro. Podés intentar reclamar la oferta de nuevo.</p>
            <button onClick={cerrar} className="w-full py-3 ml-grad text-white rounded-2xl font-bold">
              Volver al Radar
            </button>
          </>
        )}
      </div>
    </div>
  )
}
