import { useState } from 'react'
import { OPCIONES_CUOTAS, valorCuotaSinInteres, formatPesos } from '../utils/cuotas'

/**
 * Calculadora de cuotas SIN interés. El comprador paga el MISMO total (el precio
 * publicado) en 1 pago o en hasta `maxCuotas` cuotas: cada cuota = precio / N,
 * sin recargo (el vendedor ya absorbió el costo de financiación en el precio).
 *
 * `maxCuotas` = cuántas cuotas sin interés ofrece el vendedor en ESTE producto
 * (Producto.cuotasSinInteres). Solo se muestran opciones hasta ese tope.
 *
 * Controlable: si se pasan `value` + `onChange`, el padre maneja la cuota
 * elegida (para sincronizar la línea "en Nx $X" del precio).
 */
interface Props {
  precio: number
  maxCuotas?: number
  compacto?: boolean
  value?: number
  onChange?: (cuotas: number) => void
}

export default function CalculadoraCuotas({ precio, maxCuotas = 12, compacto = false, value, onChange }: Props) {
  const opciones = OPCIONES_CUOTAS.filter(c => c <= maxCuotas)
  const tope = opciones[opciones.length - 1] ?? 1
  const [interno, setInterno] = useState<number>(value ?? tope)
  const cuotasSel = value !== undefined ? value : interno
  const sel = opciones.includes(cuotasSel as any) ? cuotasSel : tope

  function elegir(n: number) {
    setInterno(n)
    onChange?.(n)
  }

  const valorCuota = valorCuotaSinInteres(precio, sel)

  if (compacto) {
    return (
      <p className="text-xs text-green-600 font-medium">
        {tope}x sin interés de ${formatPesos(valorCuotaSinInteres(precio, tope))}
      </p>
    )
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">&#x1F4B3;</span>
        <h3 className="font-bold text-ml-ink text-sm sm:text-base">Cuotas sin inter&eacute;s</h3>
      </div>

      <p className="text-xs text-ml-soft mb-3">
        {sel === 1
          ? <>En <strong className="text-green-700">1 pago</strong> de ${formatPesos(valorCuota)}</>
          : <>En <strong className="text-green-700">{sel} cuotas sin inter&eacute;s</strong> de ${formatPesos(valorCuota)}</>}
      </p>

      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {opciones.map(c => (
          <button
            key={c}
            onClick={() => elegir(c)}
            className={`py-2 px-1 rounded-lg text-xs font-semibold transition-colors ${
              c === sel
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
          <span className="font-bold text-green-700 text-sm">${formatPesos(valorCuota)}</span>
        </div>
        <div className="flex justify-between text-xs text-ml-muted mb-1">
          <span>Total a pagar:</span>
          <span className="font-semibold text-ml-ink">${formatPesos(precio)}</span>
        </div>
        <p className="text-xs text-green-600 font-semibold mt-1">&#x2705; Sin inter&eacute;s &mdash; pag&aacute;s lo mismo que en 1 pago</p>
      </div>

      <p className="text-[10px] text-ml-muted mt-2 leading-snug">
        * Cuotas sin inter&eacute;s con tarjeta de cr&eacute;dito v&iacute;a Mercado Pago. El total es el mismo precio publicado.
      </p>
    </div>
  )
}
