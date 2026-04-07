import { useState, useMemo } from 'react'

/**
 * Calculadora de cuotas estilo Mercado Pago.
 * Las tasas son referenciales y est\u00e1n basadas en los rangos p\u00fablicos
 * de Mercado Pago Argentina al momento de la implementaci\u00f3n.
 * El monto final exacto depende de la tarjeta y el banco del comprador.
 */
interface Props {
  precio: number
  compacto?: boolean
}

// Tasas mensuales de financiaci\u00f3n (aproximadas, referenciales)
// Fuente p\u00fablica de Mercado Pago - revisar peri\u00f3dicamente
const TASAS: Record<number, number> = {
  1: 0,
  3: 0.085,   // ~8.5% mensual aprox
  6: 0.10,    // ~10% mensual aprox
  9: 0.11,
  12: 0.115,
  18: 0.12
}

function calcularCuota(precio: number, cuotas: number): { valorCuota: number, totalFinal: number, recargo: number } {
  const tasa = TASAS[cuotas] ?? 0
  if (tasa === 0) {
    return { valorCuota: precio / cuotas, totalFinal: precio, recargo: 0 }
  }
  // F\u00f3rmula de cuota francesa
  const valorCuota = precio * (tasa * Math.pow(1 + tasa, cuotas)) / (Math.pow(1 + tasa, cuotas) - 1)
  const totalFinal = valorCuota * cuotas
  const recargo = totalFinal - precio
  return { valorCuota, totalFinal, recargo }
}

function formatMoney(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function CalculadoraCuotas({ precio, compacto = false }: Props) {
  const [cuotasSel, setCuotasSel] = useState(3)
  const opciones = [1, 3, 6, 9, 12, 18]

  const resultado = useMemo(() => calcularCuota(precio, cuotasSel), [precio, cuotasSel])
  const cuota3SinInteres = useMemo(() => calcularCuota(precio, 3), [precio])

  if (compacto) {
    // Vista compacta para tarjeta de producto: muestra solo la mejor opci\u00f3n
    const mejor = calcularCuota(precio, 3)
    return (
      <p className="text-xs text-green-600 font-medium">
        3x ${formatMoney(mejor.valorCuota)}
      </p>
    )
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">&#x1F4B3;</span>
        <h3 className="font-bold text-gray-800 text-sm sm:text-base">Calculadora de cuotas</h3>
      </div>

      <p className="text-xs text-gray-600 mb-3">
        En 3 cuotas de <strong className="text-green-700">${formatMoney(cuota3SinInteres.valorCuota)}</strong>
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-3">
        {opciones.map(c => (
          <button
            key={c}
            onClick={() => setCuotasSel(c)}
            className={`py-2 px-1 rounded-lg text-xs font-semibold transition-colors ${
              c === cuotasSel
                ? 'bg-green-600 text-white shadow'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-green-500'
            }`}
          >
            {c}x
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg p-3 border border-gray-100">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Valor de cada cuota:</span>
          <span className="font-bold text-green-700 text-sm">${formatMoney(resultado.valorCuota)}</span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Total a pagar:</span>
          <span className="font-semibold text-gray-800">${formatMoney(resultado.totalFinal)}</span>
        </div>
        {resultado.recargo > 0 && (
          <div className="flex justify-between text-xs text-gray-400">
            <span>Costo de financiaci&oacute;n:</span>
            <span>+${formatMoney(resultado.recargo)}</span>
          </div>
        )}
        {resultado.recargo === 0 && cuotasSel > 1 && (
          <p className="text-xs text-green-600 font-semibold mt-1">&#x2705; Sin inter&eacute;s</p>
        )}
      </div>

      <p className="text-[10px] text-gray-400 mt-2 leading-snug">
        * Valores estimados. El costo final depende de tu tarjeta y banco emisor.
        Financiaci&oacute;n a trav&eacute;s de Mercado Pago.
      </p>
    </div>
  )
}
