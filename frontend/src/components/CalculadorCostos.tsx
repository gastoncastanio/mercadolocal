import { useState, useEffect } from 'react'
import api from '../services/api'

type MedioPago = 'debito' | 'credito_1' | 'credito_3' | 'credito_6' | 'credito_12' | 'mp_credito'

interface CalculadorProps {
  precioProducto: number
  vista?: 'comprador' | 'vendedor' | 'ambos'
  compact?: boolean
}

// Valores por defecto (se sobreescriben con la config real del admin)
const TARIFAS_DEFAULT = {
  comision_porcentaje: 10,
  tarifa_mp_plazo: 'al instante',
  tarifa_mp_debito: 3.49,
  tarifa_mp_credito: 6.29,
  tarifa_mp_credito_cuotas: 6.29,
  tarifa_mp_mercadocredito: 6.29,
  tarifa_iva_comision: 0,
  tarifa_cuotas_3: 1.15,
  tarifa_cuotas_6: 1.30,
  tarifa_cuotas_12: 1.55,
  tarifa_retenciones_aviso: ''
}

const MEDIOS: { id: MedioPago; label: string; cuotas: number }[] = [
  { id: 'debito', label: '💳 Débito / dinero en cuenta', cuotas: 1 },
  { id: 'credito_1', label: '💳 Crédito en 1 pago', cuotas: 1 },
  { id: 'credito_3', label: '💳 Crédito en 3 cuotas', cuotas: 3 },
  { id: 'credito_6', label: '💳 Crédito en 6 cuotas', cuotas: 6 },
  { id: 'credito_12', label: '💳 Crédito en 12 cuotas', cuotas: 12 },
  { id: 'mp_credito', label: '💵 Mercado Crédito', cuotas: 1 }
]

const r2 = (n: number) => Math.round(n * 100) / 100
const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 })

export default function CalculadorCostos({
  precioProducto,
  vista = 'comprador',
  compact = false
}: CalculadorProps) {
  const [tarifas, setTarifas] = useState(TARIFAS_DEFAULT)
  const [medio, setMedio] = useState<MedioPago>('credito_1')

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
          tarifa_mp_debito: num(d.tarifa_mp_debito, TARIFAS_DEFAULT.tarifa_mp_debito),
          tarifa_mp_credito: num(d.tarifa_mp_credito, TARIFAS_DEFAULT.tarifa_mp_credito),
          tarifa_mp_credito_cuotas: num(d.tarifa_mp_credito_cuotas, TARIFAS_DEFAULT.tarifa_mp_credito_cuotas),
          tarifa_mp_mercadocredito: num(d.tarifa_mp_mercadocredito, TARIFAS_DEFAULT.tarifa_mp_mercadocredito),
          tarifa_iva_comision: num(d.tarifa_iva_comision, TARIFAS_DEFAULT.tarifa_iva_comision),
          tarifa_cuotas_3: num(d.tarifa_cuotas_3, TARIFAS_DEFAULT.tarifa_cuotas_3),
          tarifa_cuotas_6: num(d.tarifa_cuotas_6, TARIFAS_DEFAULT.tarifa_cuotas_6),
          tarifa_cuotas_12: num(d.tarifa_cuotas_12, TARIFAS_DEFAULT.tarifa_cuotas_12),
          tarifa_retenciones_aviso: d.tarifa_retenciones_aviso || TARIFAS_DEFAULT.tarifa_retenciones_aviso
        })
      })
      .catch(() => { /* usa los defaults */ })
    return () => { activo = false }
  }, [])

  const precio = precioProducto || 0

  // Fee de MP según el medio elegido
  const feeMpPct =
    medio === 'debito' ? tarifas.tarifa_mp_debito :
    medio === 'credito_1' ? tarifas.tarifa_mp_credito :
    medio === 'mp_credito' ? tarifas.tarifa_mp_mercadocredito :
    tarifas.tarifa_mp_credito_cuotas

  // Coeficiente de interés de cuotas (lo paga el COMPRADOR, va al banco/MP)
  const coefCuotas =
    medio === 'credito_3' ? tarifas.tarifa_cuotas_3 :
    medio === 'credito_6' ? tarifas.tarifa_cuotas_6 :
    medio === 'credito_12' ? tarifas.tarifa_cuotas_12 : 1
  const cuotasCount = MEDIOS.find(m => m.id === medio)?.cuotas || 1

  // ===== FLUJO REAL =====
  // Comprador: paga el precio publicado. Si elige cuotas con interés, paga el recargo del banco.
  const recargoFinanciacion = r2(precio * coefCuotas - precio)
  const totalComprador = r2(precio + recargoFinanciacion)
  const valorCuota = cuotasCount > 1 ? r2(totalComprador / cuotasCount) : totalComprador

  // Vendedor: del precio publicado se descuentan comisión + IVA de comisión + fee de MP
  const comisionBase = r2(precio * tarifas.comision_porcentaje / 100)
  const ivaComision = r2(comisionBase * tarifas.tarifa_iva_comision / 100)
  const feeMp = r2(precio * feeMpPct / 100)
  const netoVendedor = r2(precio - comisionBase - ivaComision - feeMp)

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
          Pagás el precio publicado. Si elegís cuotas con interés, el recargo del banco se suma al pagar. El envío se coordina aparte.
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
        <select value={medio} onChange={e => setMedio(e.target.value as MedioPago)}
          className="text-xs px-2 py-1.5 border border-ml-line rounded-lg bg-white focus:ring-2 focus:ring-ml-purple/30 outline-none">
          {MEDIOS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
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
            {recargoFinanciacion > 0 ? (
              <div className="flex justify-between items-center">
                <span className="text-sm text-ml-muted">Interés por financiación (banco / MP)</span>
                <span className="text-sm font-medium text-orange-600">+${fmt(recargoFinanciacion)}</span>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-sm text-ml-muted">Costos de plataforma y procesamiento</span>
                <span className="text-sm text-green-600">Ya incluidos en el precio</span>
              </div>
            )}
            <div className="pt-3 border-t border-blue-100 flex justify-between items-center">
              <span className="text-base font-bold text-ml-ink">TOTAL QUE PAGÁS</span>
              <span className="text-xl font-extrabold text-ml-mp">${fmt(totalComprador)}</span>
            </div>
            {cuotasCount > 1 && (
              <p className="text-xs text-ml-soft text-right">{cuotasCount} cuotas de ${fmt(valorCuota)}</p>
            )}
          </div>
          {recargoFinanciacion > 0 && (
            <p className="text-[11px] text-ml-muted px-1">
              El interés de las cuotas lo cobra tu banco o Mercado Pago, no MercadoLocal. Pagando en 1 pago o débito no tenés recargo.
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
              <span className="text-sm text-ml-muted">Fee Mercado Pago ({fmt(feeMpPct)}%, {tarifas.tarifa_mp_plazo})</span>
              <span className="text-sm font-medium text-red-600">-${fmt(feeMp)}</span>
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
          <p><strong className="text-ml-ink">Fee Mercado Pago:</strong> lo que Mercado Pago cobra por procesar el pago ({tarifas.tarifa_mp_plazo}). Varía según el medio de pago.</p>
          <p><strong className="text-ml-ink">Interés de cuotas:</strong> si el comprador paga en cuotas, el recargo lo define y cobra el banco / Mercado Pago. No lo recibe ni el vendedor ni MercadoLocal.</p>
          <p><strong className="text-ml-ink">Envío e impuestos:</strong> el envío se paga aparte. Las retenciones impositivas dependen de la condición fiscal de cada vendedor.</p>
        </div>
      </details>
    </div>
  )
}
