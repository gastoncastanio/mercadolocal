import { useEffect, useState } from 'react'
import api from '../services/api'

/**
 * FUENTE DE VERDAD ÚNICA de las cuotas en toda la app.
 *
 * Antes había tres lógicas distintas para el mismo producto: la línea "en Nx $X"
 * bajo el precio (división simple, sin interés), la "Calculadora de cuotas"
 * (fórmula francesa hardcodeada) y el "Desglose de costos" (coeficientes de
 * /config/tarifas). Daban números distintos. Unificamos en los COEFICIENTES
 * configurables por el admin (los del desglose), que son la fuente correcta.
 *
 * coef[n] = total a pagar / precio. Ej. coef[6]=1.30 => 6 cuotas suman precio*1.30.
 */

export const OPCIONES_CUOTAS = [1, 3, 6, 12] as const

export type Coeficientes = Record<number, number>

// Defaults (coinciden con TARIFAS_DEFAULT de CalculadorCostos). Se sobreescriben
// con la config real del admin vía /config/tarifas.
export const COEF_DEFAULT: Coeficientes = { 1: 1, 3: 1.15, 6: 1.30, 12: 1.55 }

export interface ResultadoCuota {
  cuotas: number
  valorCuota: number
  total: number
  recargo: number
  sinInteres: boolean
}

export function calcularCuota(precio: number, cuotas: number, coef: Coeficientes = COEF_DEFAULT): ResultadoCuota {
  const p = Math.max(0, precio || 0)
  const c = coef[cuotas] ?? 1
  const total = Math.round(p * c * 100) / 100
  const recargo = Math.round((total - p) * 100) / 100
  const valorCuota = cuotas > 0 ? Math.round((total / cuotas) * 100) / 100 : total
  return { cuotas, valorCuota, total, recargo, sinInteres: recargo <= 0 }
}

/**
 * Hook que trae los coeficientes de cuotas desde la config del admin (con
 * defaults). Todos los componentes que muestren cuotas deben usarlo para que
 * coincidan entre sí.
 */
export function useCoeficientesCuotas(): Coeficientes {
  const [coef, setCoef] = useState<Coeficientes>(COEF_DEFAULT)
  useEffect(() => {
    let activo = true
    api.get('/config/tarifas')
      .then(res => {
        if (!activo || !res.data) return
        const d = res.data
        const num = (v: any, def: number) => (v !== undefined && v !== '' && !isNaN(parseFloat(v)) ? parseFloat(v) : def)
        setCoef({
          1: 1,
          3: num(d.tarifa_cuotas_3, COEF_DEFAULT[3]),
          6: num(d.tarifa_cuotas_6, COEF_DEFAULT[6]),
          12: num(d.tarifa_cuotas_12, COEF_DEFAULT[12])
        })
      })
      .catch(() => { /* defaults */ })
    return () => { activo = false }
  }, [])
  return coef
}

export function formatPesos(n: number): string {
  return n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
}
