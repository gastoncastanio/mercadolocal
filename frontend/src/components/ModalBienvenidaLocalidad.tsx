import { useEffect, useState } from 'react'
import { LOCALIDADES, COBERTURA_TEXTO } from '../constants/localidades'

// Clave en localStorage con la localidad elegida por el visitante. La reusan los
// selectores (checkout, etc.) para prellenar y se muestra en el navbar.
export const LOCALIDAD_KEY = 'ml_localidad'
// Marca de que el visitante declaró NO estar en la zona (para no insistir).
const FUERA_KEY = 'ml_fuera_zona'

export function getLocalidadGuardada(): string {
  try { return localStorage.getItem(LOCALIDAD_KEY) || '' } catch { return '' }
}

/**
 * Validación de visitantes (capa de baja fricción): en la primera visita pedimos
 * la localidad. Es la forma más efectiva sin bloquear por error a vecinos reales
 * (la geo por IP en pueblos chicos suele fallar porque rutean por cabeceras). El
 * control "duro" sigue siendo que NO se puede comprar/operar fuera de las 5
 * localidades (los selectores de entrega son cerrados).
 */
export default function ModalBienvenidaLocalidad() {
  const [abierto, setAbierto] = useState(false)
  const [fuera, setFuera] = useState(false)

  useEffect(() => {
    try {
      const yaEligio = localStorage.getItem(LOCALIDAD_KEY)
      const yaDijoFuera = localStorage.getItem(FUERA_KEY)
      if (!yaEligio && !yaDijoFuera) setAbierto(true)
    } catch {
      // Sin acceso a localStorage (modo privado): mostramos igual una vez.
      setAbierto(true)
    }
  }, [])

  function elegir(localidad: string) {
    try {
      localStorage.setItem(LOCALIDAD_KEY, localidad)
      localStorage.removeItem(FUERA_KEY)
    } catch { /* noop */ }
    setAbierto(false)
    // Avisamos a la app que cambió la localidad (los selectores pueden refrescar).
    window.dispatchEvent(new CustomEvent('ml:localidad', { detail: localidad }))
  }

  function marcarFuera() {
    try { localStorage.setItem(FUERA_KEY, '1') } catch { /* noop */ }
    setFuera(true)
  }

  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        {!fuera ? (
          <>
            <div className="text-center mb-5">
              <div className="text-4xl mb-2">📍</div>
              <h2 className="font-display text-2xl font-extrabold text-ml-ink">¿De qué localidad nos visitás?</h2>
              <p className="text-sm text-ml-muted mt-1">
                Así te mostramos las tiendas, viajes y servicios de tu zona. {COBERTURA_TEXTO}
              </p>
            </div>
            <div className="space-y-2">
              {LOCALIDADES.map((l) => (
                <button
                  key={l}
                  onClick={() => elegir(l)}
                  className="w-full px-4 py-3 rounded-xl border border-ml-line text-ml-ink font-semibold hover:border-ml-violet hover:bg-ml-bg transition-colors text-left flex items-center gap-2"
                >
                  <span>📍</span> {l}
                </button>
              ))}
            </div>
            <button
              onClick={marcarFuera}
              className="w-full mt-4 text-sm text-ml-muted hover:text-ml-ink"
            >
              No estoy en ninguna de estas
            </button>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">🛣️</div>
            <h2 className="font-display text-2xl font-extrabold text-ml-ink mb-2">Todavía no llegamos a tu zona</h2>
            <p className="text-sm text-ml-soft mb-1">
              Por ahora operamos solo en <strong>General Las Heras, Cañuelas, Lobos, Navarro y Roque Pérez</strong>.
            </p>
            <p className="text-sm text-ml-muted mb-5">
              Podés mirar el catálogo igual, pero las compras y servicios solo se entregan en esas localidades. ¡Pronto sumamos más!
            </p>
            <button
              onClick={() => setAbierto(false)}
              className="w-full py-3 mlbtn ml-grad text-white rounded-xl font-bold"
            >
              Entendido, quiero mirar
            </button>
            <button
              onClick={() => setFuera(false)}
              className="w-full mt-2 text-sm text-ml-muted hover:text-ml-ink"
            >
              ← Elegir una localidad
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
