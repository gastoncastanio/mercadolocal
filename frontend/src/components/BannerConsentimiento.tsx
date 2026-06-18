import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

/**
 * Banner de consentimiento (Ley 25.326 + buenas prácticas de privacidad).
 *
 * Como perfilamos el comportamiento del visitante para la pauta inteligente,
 * tenemos que informarlo y pedir consentimiento, dando la opción de rechazar.
 * Si rechaza, guardamos `ml_no_perfilar=1` y el resto de la app deja de enviar
 * señales y no manda el id anónimo (ver api.ts y tracking.ts).
 */
export default function BannerConsentimiento() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const decidido = localStorage.getItem('ml_consent')
      if (!decidido) setVisible(true)
    } catch {
      /* si no hay storage, no molestamos */
    }
  }, [])

  function decidir(aceptar: boolean) {
    try {
      localStorage.setItem('ml_consent', aceptar ? 'aceptado' : 'rechazado')
      localStorage.setItem('ml_no_perfilar', aceptar ? '0' : '1')
    } catch { /* noop */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-[60] p-3 sm:p-4">
      <div className="max-w-3xl mx-auto bg-white border border-ml-line2 rounded-2xl shadow-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="font-bold text-ml-ink text-sm mb-1">🍪 Tu privacidad</p>
            <p className="text-xs text-ml-muted leading-snug">
              Usamos tu actividad (lo que mirás y buscás) para mostrarte productos más relevantes.
              Podés aceptar o rechazar. Cambiás esto cuando quieras en{' '}
              <Link to="/privacidad-datos" className="text-ml-blue hover:underline">Privacidad y mis datos</Link>.
              Más info en nuestra{' '}
              <Link to="/privacidad" className="text-ml-blue hover:underline">Política de Privacidad</Link>.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => decidir(false)}
              className="px-4 py-2.5 text-sm font-semibold text-ml-muted border border-ml-line2 rounded-xl hover:bg-ml-bg"
            >
              Rechazar
            </button>
            <button
              onClick={() => decidir(true)}
              className="px-5 py-2.5 text-sm font-bold text-white ml-grad rounded-xl"
            >
              Aceptar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
