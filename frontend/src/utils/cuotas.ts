import { useEffect, useState } from 'react'
import api from '../services/api'

/**
 * FUENTE DE VERDAD ÚNICA de las cuotas — modelo "cuotas SIN interés".
 *
 * El vendedor absorbe el costo de financiación de Mercado Pago metiéndolo en el
 * precio publicado. Por eso el comprador paga el MISMO total (el precio) tanto
 * en 1 pago como en hasta N cuotas: cada cuota = precio / N, sin recargo. Recién
 * así podemos afirmar "sin interés" de verdad.
 *
 * Las tasas son las REALES de Mercado Pago (acreditación "en el momento"), y el
 * admin las puede ajustar desde /config/tarifas. La cuenta del vendedor:
 *
 *   cobrar = recibir / (1 − (cobro% + cuota%) × (1 + IVA))
 *
 * Ej. 6 cuotas: recibir $85 → cobrar 85 / (1 − (6,60%+19,09%)×1,21) = $123,35.
 */

export const OPCIONES_CUOTAS = [1, 3, 6, 12] as const

export const IVA = 0.21 // IVA argentino sobre los costos de MP

// Tasas reales de MP (en %, ANTES de IVA), acreditación "en el momento".
// Costo por cobro: se paga en toda venta (incluido 1 pago).
export const TASA_COBRO_DEFAULT = 6.60
// Costo por ofrecer N cuotas sin interés (además del cobro).
export const TASAS_CUOTAS_DEFAULT: Record<number, number> = {
  1: 0,
  3: 12.19,
  6: 19.09,
  12: 32.29
}

export interface TarifasCuotas {
  cobro: number                  // % costo por cobro (antes de IVA)
  cuotas: Record<number, number> // % costo por ofrecer N cuotas sin interés
}

export const TARIFAS_CUOTAS_DEFAULT: TarifasCuotas = {
  cobro: TASA_COBRO_DEFAULT,
  cuotas: TASAS_CUOTAS_DEFAULT
}

/**
 * Fracción del monto cobrado que se queda Mercado Pago al ofrecer `n` cuotas
 * sin interés (cobro + financiación, con IVA). Para `n = 1` es solo el cobro.
 */
export function fraccionCostoMP(n: number, t: TarifasCuotas = TARIFAS_CUOTAS_DEFAULT): number {
  const cuota = t.cuotas[n] ?? 0
  return ((t.cobro + cuota) / 100) * (1 + IVA)
}

/** Lo que paga el comprador por cada cuota (sin interés: precio / n). */
export function valorCuotaSinInteres(precio: number, n: number): number {
  const p = Math.max(0, precio || 0)
  return n > 0 ? Math.round((p / n) * 100) / 100 : p
}

/**
 * Precio a PUBLICAR para que el vendedor RECIBA `neto` ofreciendo hasta `n`
 * cuotas sin interés (cuenta el costo de MP, no la comisión de la plataforma).
 */
export function precioParaRecibir(neto: number, n: number, t: TarifasCuotas = TARIFAS_CUOTAS_DEFAULT): number {
  const f = fraccionCostoMP(n, t)
  const r = Math.max(0, neto || 0)
  return f < 1 ? Math.round((r / (1 - f)) * 100) / 100 : 0
}

/**
 * Neto que recibe el vendedor (después del costo de MP) si publica `precio`
 * ofreciendo hasta `n` cuotas sin interés. No incluye la comisión de la
 * plataforma (de eso se encarga CalculadorCostos).
 */
export function netoPorCobroMP(precio: number, n: number, t: TarifasCuotas = TARIFAS_CUOTAS_DEFAULT): number {
  const p = Math.max(0, precio || 0)
  return Math.round(p * (1 - fraccionCostoMP(n, t)) * 100) / 100
}

/** Costo de MP (en $) por ofrecer hasta `n` cuotas sin interés sobre `precio`. */
export function costoMP(precio: number, n: number, t: TarifasCuotas = TARIFAS_CUOTAS_DEFAULT): number {
  const p = Math.max(0, precio || 0)
  return Math.round(p * fraccionCostoMP(n, t) * 100) / 100
}

export function formatPesos(n: number): string {
  return (n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })
}

/**
 * Hook que trae las tasas reales de cuotas desde la config del admin (con los
 * defaults reales de MP). Todos los componentes que muestren o calculen cuotas
 * deben usarlo para que coincidan entre sí.
 */
export function useTarifasCuotas(): TarifasCuotas {
  const [t, setT] = useState<TarifasCuotas>(TARIFAS_CUOTAS_DEFAULT)
  useEffect(() => {
    let activo = true
    api.get('/config/tarifas')
      .then(res => {
        if (!activo || !res.data) return
        const d = res.data
        const num = (v: any, def: number) => (v !== undefined && v !== '' && !isNaN(parseFloat(v)) ? parseFloat(v) : def)
        setT({
          cobro: num(d.tarifa_cobro, TASA_COBRO_DEFAULT),
          cuotas: {
            1: 0,
            3: num(d.tarifa_cuota_si_3, TASAS_CUOTAS_DEFAULT[3]),
            6: num(d.tarifa_cuota_si_6, TASAS_CUOTAS_DEFAULT[6]),
            12: num(d.tarifa_cuota_si_12, TASAS_CUOTAS_DEFAULT[12])
          }
        })
      })
      .catch(() => { /* defaults reales de MP */ })
    return () => { activo = false }
  }, [])
  return t
}
