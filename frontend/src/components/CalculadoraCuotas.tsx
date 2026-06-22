import { useState } from 'react'
import { OPCIONES_CUOTAS, calcularCuota, formatPesos, useCoeficientesCuotas } from '../utils/cuotas'

/**
 * Calculadora de cuotas. Usa la FUENTE DE VERDAD ÚNICA (coeficientes de
 * /config/tarifas vía useCoeficientesCuotas) para que coincida con el resto de
 * la app (línea bajo el precio, checkout, etc.).
 *
 * Controlable: si se pasan `value` + `onChange`, el padre maneja la cuota
 * elegida (para sincronizar la línea "en Nx $X" del precio). Si no, usa estado
 * interno.
 */
interface Props {
  precio: number
  compacto?: boolean
  value?: number
  onChange?: (cuotas: number) => void
}

export default function CalculadoraCuotas({ precio, compacto = false, value, onChange }: Props) {
  const coef = useCoeficientesCuotas()
  const [interno, setInterno] = useState<number>(value ?? 6)
  const cuotasSel = value !== undefined ? value : interno

  function elegir(n: number) {
    setInterno(n)
    onChange?.(n)
  }

  const resultado = calcularCuota(precio, cuotasSel, coef)

  if (compacto) {
    const tres = calcularCuota(precio, 3, coef)
    return (
      <p className="text-xs text-green-600 font-medium">
        3x ${formatPesos(tres.valorCuota)}
      </p>
    )
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">&#x1F4B3;</span>
        <h3 className="font-bold text-ml-ink text-sm sm:text-base">Calculadora de cuotas</h3>
      </div>

      <p className="text-xs text-ml-soft mb-3">
        En {cuotasSel === 1 ? '1 pago' : `${cuotasSel} cuotas`} de <strong className="text-green-700">${formatPesos(resultado.valorCuota)}</strong>
      </p>

      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {OPCIONES_CUOTAS.map(c => (
          <button
            key={c}
            onClick={() => elegir(c)}
            className={`py-2 px-1 rounded-lg text-xs font-semibold transition-colors ${
              c === cuotasSel
                ? 'bg-green-600 text-white shadow'
                : 'bg-white text-ml-ink border border-ml-line hover:border-green-500'
            }`}
          >
            {c}x
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg p-3 border border-ml-line2">
        <div className="flex justify-between text-xs text-ml-muted mb-1">
          <span>Valor de cada cuota:</span>
          <span className="font-bold text-green-700 text-sm">${formatPesos(resultado.valorCuota)}</span>
        </div>
        <div className="flex justify-between text-xs text-ml-muted mb-1">
          <span>Total a pagar:</span>
          <span className="font-semibold text-ml-ink">${formatPesos(resultado.total)}</span>
        </div>
        {resultado.recargo > 0 ? (
          <div className="flex justify-between text-xs text-ml-muted">
            <span>Costo de financiaci&oacute;n:</span>
            <span>+${formatPesos(resultado.recargo)}</span>
          </div>
        ) : (
          <p className="text-xs text-green-600 font-semibold mt-1">&#x2705; Sin inter&eacute;s</p>
        )}
      </div>

      <p className="text-[10px] text-ml-muted mt-2 leading-snug">
        * Valores estimados. El costo final depende de tu tarjeta y banco emisor.
        Financiaci&oacute;n a trav&eacute;s de Mercado Pago.
      </p>
    </div>
  )
}
