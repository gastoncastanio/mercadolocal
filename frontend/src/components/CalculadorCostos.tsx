
interface CalculadorProps {
  precioProducto: number
  medioPago?: 'debito' | 'credito_1' | 'credito_cuotas' | 'mp_credito' | null
  mostrarVendedor?: boolean
  compact?: boolean
}

const FEES_MERCADO_PAGO: Record<string, { rango: string; promedio: number }> = {
  debito: { rango: '1.5%-2%', promedio: 1.75 },
  credito_1: { rango: '2-3%', promedio: 2.5 },
  credito_cuotas: { rango: '3-7%', promedio: 5 },
  mp_credito: { rango: '1.5-2%', promedio: 1.75 }
}

const COMISION_MERCADOLOCAL = 10

export default function CalculadorCostos({
  precioProducto,
  medioPago = null,
  mostrarVendedor = false,
  compact = false
}: CalculadorProps) {
  const feeMP = medioPago && FEES_MERCADO_PAGO[medioPago] ? FEES_MERCADO_PAGO[medioPago].promedio : 2.5
  const comisionML = COMISION_MERCADOLOCAL

  const feeMontoMP = Math.round(precioProducto * feeMP / 100 * 100) / 100
  const comisionMontoML = Math.round(precioProducto * comisionML / 100 * 100) / 100
  const totalCostos = feeMontoMP + comisionMontoML
  const precioComprador = precioProducto + totalCostos
  const precioVendedor = precioProducto - comisionMontoML

  if (compact) {
    return (
      <div className="text-xs space-y-1 text-ml-muted">
        <div className="flex justify-between">
          <span>Precio</span>
          <span className="font-medium text-ml-ink">${precioProducto.toLocaleString()}</span>
        </div>
        {medioPago && (
          <div className="flex justify-between">
            <span>Fee Mercado Pago ({FEES_MERCADO_PAGO[medioPago]?.rango || '2.5%'})</span>
            <span>+${feeMontoMP.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Comisión plataforma (10%)</span>
          <span>+${comisionMontoML.toLocaleString()}</span>
        </div>
        <div className="pt-1 border-t border-ml-line flex justify-between font-semibold text-ml-ink">
          <span>Total a pagar</span>
          <span className="text-ml-mp">${precioComprador.toLocaleString()}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-5 border border-blue-100 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ml-ink flex items-center gap-2">
          <span className="text-lg">💰</span>
          Desglose de costos
        </h3>
        {medioPago && (
          <span className="text-xs bg-blue-100 text-ml-blue px-2 py-1 rounded-full">
            {medioPago === 'debito' && '💳 Débito'}
            {medioPago === 'credito_1' && '💳 Crédito 1 cuota'}
            {medioPago === 'credito_cuotas' && '💳 Crédito múltiples cuotas'}
            {medioPago === 'mp_credito' && '💵 Mercado Crédito'}
          </span>
        )}
      </div>

      {/* PARA COMPRADOR */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-ml-soft uppercase tracking-wide">Lo que pagás vos (comprador)</p>
        <div className="bg-white rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-ml-ink">Precio del producto</span>
            <span className="text-base font-semibold text-ml-ink">${precioProducto.toLocaleString()}</span>
          </div>

          {medioPago ? (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1">
                <span className="text-sm text-ml-muted">Fee Mercado Pago</span>
                <span className="text-[10px] bg-gray-100 text-ml-muted px-1.5 py-0.5 rounded">
                  {FEES_MERCADO_PAGO[medioPago]?.rango || '~2.5%'}
                </span>
              </div>
              <span className="text-sm font-medium text-orange-600">+${feeMontoMP.toLocaleString()}</span>
            </div>
          ) : (
            <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs text-amber-700">
                <strong>Consejo:</strong> selecciona un medio de pago para ver el fee exacto de Mercado Pago
              </p>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-sm text-ml-muted">Comisión plataforma</span>
            <span className="text-sm font-medium text-purple-600">+${comisionMontoML.toLocaleString()} (10%)</span>
          </div>

          <div className="pt-3 border-t border-blue-100 flex justify-between items-center">
            <span className="text-base font-bold text-ml-ink">TOTAL QUE PAGÁS</span>
            <span className="text-xl font-extrabold text-ml-mp">${precioComprador.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* PARA VENDEDOR - Mostrar solo si está habilitado */}
      {mostrarVendedor && (
        <div className="space-y-2 pt-2 border-t-2 border-blue-100">
          <p className="text-xs font-semibold text-ml-soft uppercase tracking-wide">Lo que cobra el vendedor</p>
          <div className="bg-green-50 rounded-xl p-4 space-y-2 border border-green-100">
            <div className="flex justify-between items-center">
              <span className="text-sm text-ml-ink">Precio del producto</span>
              <span className="text-base font-semibold text-ml-ink">${precioProducto.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-ml-muted">Menos: Comisión plataforma (10%)</span>
              <span className="text-sm font-medium text-red-600">-${comisionMontoML.toLocaleString()}</span>
            </div>

            <div className="pt-3 border-t border-green-100 flex justify-between items-center">
              <span className="text-base font-bold text-ml-ink">TOTAL QUE RECIBE</span>
              <span className="text-xl font-extrabold text-green-600">${precioVendedor.toLocaleString()}</span>
            </div>

            <p className="text-[11px] text-green-700 pt-1">
              💡 <strong>Nota:</strong> El fee de Mercado Pago ({medioPago ? FEES_MERCADO_PAGO[medioPago]?.rango : '~2.5%'}) ya está descontado por MP. La comisión de MercadoLocal se deduce aquí.
            </p>
          </div>
        </div>
      )}

      {/* Aviso de envío */}
      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
        <p className="text-xs text-amber-800">
          <strong>📦 Envío:</strong> El costo NO está incluido acá. Se coordina aparte con el vendedor y varía según ubicación.
        </p>
      </div>

      {/* Resumen de qué es cada costo */}
      {!compact && (
        <details className="text-xs text-ml-muted space-y-2">
          <summary className="cursor-pointer font-semibold text-ml-soft hover:text-ml-ink transition-colors">
            ¿Por qué hay estos costos?
          </summary>
          <div className="pt-2 space-y-2 border-t border-blue-100">
            <div>
              <p className="font-semibold text-ml-ink">Fee Mercado Pago</p>
              <p className="text-[11px] leading-relaxed">
                Es lo que Mercado Pago cobra por procesar el pago (seguridad, fraude, antillavado, etc). Varía según el medio: débito es más barato, cuotas es más caro.
              </p>
            </div>
            <div>
              <p className="font-semibold text-ml-ink">Comisión MercadoLocal (10%)</p>
              <p className="text-[11px] leading-relaxed">
                Es lo que MercadoLocal cobra por conectarte con compradores, hostear la plataforma, procesar disputas, moderar productos, etc.
              </p>
            </div>
            <div>
              <p className="font-semibold text-ml-ink">Envío</p>
              <p className="text-[11px] leading-relaxed">
                Lo negocias directo con el vendedor. MercadoLocal no toma comisión del envío.
              </p>
            </div>
          </div>
        </details>
      )}
    </div>
  )
}
