import { useState, useEffect } from 'react'
import api from '../services/api'
import { useTarifasCuotas, costoMP, valorCuotaSinInteres, formatPesos } from '../utils/cuotas'

interface CalculadorProps {
  precioProducto: number
  vista?: 'comprador' | 'vendedor' | 'ambos'
  compact?: boolean
  // Cuotas SIN interés que ofrece el vendedor (máx: 1/3/6/12). Define el costo
  // de Mercado Pago que el vendedor absorbe. Default 1 (solo 1 pago).
  cuotasSinInteres?: number
}

// Valores por defecto (se sobreescriben con la config real del admin).
// El costo de MP (cobro + financiación de cuotas) sale de utils/cuotas.
const TARIFAS_DEFAULT = {
  comision_porcentaje: 10,
  tarifa_mp_plazo: 'al instante',
  tarifa_iva_comision: 0,
  tarifa_retenciones_aviso: ''
}

const r2 = (n: number) => Math.round(n * 100) / 100
const fmt = (n: number) => formatPesos(n)

export default function CalculadorCostos({
  precioProducto,
  vista = 'comprador',
  compact = false,
  cuotasSinInteres = 1
}: CalculadorProps) {
  const [tarifas, setTarifas] = useState(TARIFAS_DEFAULT)
  const tCuotas = useTarifasCuotas()

  useEffect(() => {
    let activo = true
    api.get('/config/tarifas')
      .then(res => {
        if (!activo || !res.data) return
        const d = res.data
        const num = (v: any, def: number) => (v !== undefined && v !== '' && !isNaN(parseFloat(v)) ? parseFloat(v) : def)
        setTarifas({
          comision_porcentaje: num(d.comision_porcentaje, TARIFAS_DEFAULT.comision_porcentaje),
          tarifa_mp_plazo: d.tarifa_mp_plazo || TARIFAS_DEFAULT.tarifa_mp_plazo,
          tarifa_iva_comision: num(d.tarifa_iva_comision, TARIFAS_DEFAULT.tarifa_iva_comision),
          tarifa_retenciones_aviso: d.tarifa_retenciones_aviso || TARIFAS_DEFAULT.tarifa_retenciones_aviso
        })
      })
      .catch(() => { /* usa los defaults */ })
    return () => { activo = false }
  }, [])

  const precio = precioProducto || 0
  const cuotas = [1, 3, 6, 12].includes(cuotasSinInteres) ? cuotasSinInteres : 1

  // ===== FLUJO REAL (cuotas SIN interés) =====
  // Comprador: paga el precio publicado, en 1 pago o en hasta N cuotas sin
  // interés (mismo total). No hay recargo.
  const valorCuota = valorCuotaSinInteres(precio, cuotas)

  // Vendedor: del precio se descuentan comisión ML + IVA de comisión + costo de
  // Mercado Pago (cobro + financiación de las cuotas sin interés que ofrece).
  const comisionBase = r2(precio * tarifas.comision_porcentaje / 100)
  const ivaComision = r2(comisionBase * tarifas.tarifa_iva_comision / 100)
  const costoMercadoPago = costoMP(precio, cuotas, tCuotas)
  const netoVendedor = r2(precio - comisionBase - ivaComision - costoMercadoPago)

  // ===== Vista compacta (carrito) =====
  if (compact) {
    return (
      <div className="text-xs space-y-1.5 text-ml-muted">
        <div className="flex justify-between">
          <span>Precio publicado</span>
          <span className="font-medium text-ml-ink">${fmt(precio)}</span>
        </div>
        <div className="flex justify-between text-ml-soft">
          <span>Costos de plataforma y pago</span>
          <span className="text-green-600">Incluidos en el precio</span>
        </div>
        <div className="pt-1.5 border-t border-ml-line flex justify-between font-semibold text-ml-ink">
          <span>Total a pagar</span>
          <span className="text-ml-mp">${fmt(precio)}</span>
        </div>
        <p className="text-[10px] text-ml-muted pt-1">
          Pag&aacute;s el precio publicado{cuotas > 1 ? `, hasta en ${cuotas} cuotas sin interés de $${fmt(valorCuota)}` : ''}. El env&iacute;o se coordina aparte.
        </p>
      </div>
    )
  }

  const verComprador = vista === 'comprador' || vista === 'ambos'
  const verVendedor = vista === 'vendedor' || vista === 'ambos'

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-5 border border-blue-100 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-ml-ink flex items-center gap-2">
          <span className="text-lg">💰</span> Desglose de costos
        </h3>
        {cuotas > 1 && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-semibold">
            Hasta {cuotas} cuotas sin interés
          </span>
        )}
      </div>

      {/* ===== COMPRADOR ===== */}
      {verComprador && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ml-soft uppercase tracking-wide">Lo que pagás vos (comprador)</p>
          <div className="bg-white rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-ml-ink">Precio del producto</span>
              <span className="text-base font-semibold text-ml-ink">${fmt(precio)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-ml-muted">Costos de plataforma y procesamiento</span>
              <span className="text-sm text-green-600">Ya incluidos en el precio</span>
            </div>
            <div className="pt-3 border-t border-blue-100 flex justify-between items-center">
              <span className="text-base font-bold text-ml-ink">TOTAL QUE PAGÁS</span>
              <span className="text-xl font-extrabold text-ml-mp">${fmt(precio)}</span>
            </div>
            {cuotas > 1 && (
              <p className="text-xs text-green-600 font-semibold text-right">{cuotas} cuotas sin interés de ${fmt(valorCuota)}</p>
            )}
          </div>
          {cuotas > 1 && (
            <p className="text-[11px] text-ml-muted px-1">
              Pagás el mismo total en 1 pago o en hasta {cuotas} cuotas sin interés. El vendedor ya absorbió el costo de financiación.
            </p>
          )}
        </div>
      )}

      {/* ===== VENDEDOR ===== */}
      {verVendedor && (
        <div className="space-y-2 pt-1">
          <p className="text-xs font-semibold text-ml-soft uppercase tracking-wide">Lo que recibís vos (vendedor)</p>
          <div className="bg-green-50 rounded-xl p-4 space-y-2 border border-green-100">
            <div className="flex justify-between items-center">
              <span className="text-sm text-ml-ink">Precio del producto</span>
              <span className="text-base font-semibold text-ml-ink">${fmt(precio)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-ml-muted">Comisión MercadoLocal ({tarifas.comision_porcentaje}%)</span>
              <span className="text-sm font-medium text-red-600">-${fmt(comisionBase)}</span>
            </div>
            {ivaComision > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-ml-muted">IVA sobre comisión ({tarifas.tarifa_iva_comision}%)</span>
                <span className="text-sm font-medium text-red-600">-${fmt(ivaComision)}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm text-ml-muted">
                Costo Mercado Pago{cuotas > 1 ? ` (cobro + ${cuotas} cuotas sin interés)` : ' (cobro)'}
              </span>
              <span className="text-sm font-medium text-red-600">-${fmt(costoMercadoPago)}</span>
            </div>
            <div className="pt-3 border-t border-green-200 flex justify-between items-center">
              <span className="text-base font-bold text-ml-ink">NETO QUE RECIBÍS</span>
              <span className="text-xl font-extrabold text-green-600">${fmt(netoVendedor)}</span>
            </div>
          </div>
          {tarifas.tarifa_retenciones_aviso && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              <strong>⚠️ Impuestos:</strong> {tarifas.tarifa_retenciones_aviso}
            </p>
          )}
        </div>
      )}

      {/* Envío */}
      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
        <p className="text-xs text-amber-800">
          <strong>📦 Envío:</strong> No está incluido. Se coordina aparte con el vendedor y varía según ubicación. MercadoLocal no cobra comisión sobre el envío.
        </p>
      </div>

      {/* Explicación */}
      <details className="text-xs text-ml-muted">
        <summary className="cursor-pointer font-semibold text-ml-soft hover:text-ml-ink transition-colors">
          ¿De dónde salen estos costos?
        </summary>
        <div className="pt-2 space-y-2 border-t border-blue-100 mt-2">
          <p><strong className="text-ml-ink">Comisión MercadoLocal ({tarifas.comision_porcentaje}%):</strong> lo que cobramos por conectar compradores y vendedores, hostear la plataforma, moderar y gestionar disputas. Se descuenta del vendedor.</p>
          <p><strong className="text-ml-ink">Costo Mercado Pago:</strong> lo que MP cobra por procesar el pago ({tarifas.tarifa_mp_plazo}) más, si ofrecés cuotas sin interés, el costo de esa financiación. Lo absorbe el vendedor (ya está en el precio), por eso el comprador no paga recargo.</p>
          <p><strong className="text-ml-ink">Envío e impuestos:</strong> el envío se paga aparte. Las retenciones impositivas dependen de la condición fiscal de cada vendedor.</p>
        </div>
      </details>
    </div>
  )
}
