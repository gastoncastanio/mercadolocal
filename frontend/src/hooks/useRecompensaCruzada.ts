import { useState } from 'react'
import api from '../services/api'
import { guardarCodigo } from '../utils/canjes'

/**
 * Gamificación Cruzada: tras comprar/reclamar en un bloque, buscamos la promo del
 * bloque gastronómico siguiente con "cupón cruzado" para engancharla. Si el cliente
 * reserva, el comercio recibe el aviso para preparar la mesa.
 */
export interface SugerenciaCruzada {
  ofertaId: string
  titulo: string
  descripcion: string
  precioFinal: number
  valorDescuento: number
  cuponPorcentaje: number
  mensaje: string
  comercioNombre?: string
  bloque: string
  inicioEn: string
  finEn: string
}

export interface ReservaCruzada {
  canjeId: string
  codigo: string
  expiraEn: string
  cuponPorcentaje: number
  comercioNombre?: string
  titulo: string
}

export function useRecompensaCruzada() {
  const [sugerencia, setSugerencia] = useState<SugerenciaCruzada | null>(null)
  const [reservando, setReservando] = useState(false)
  const [reserva, setReserva] = useState<ReservaCruzada | null>(null)
  const [error, setError] = useState('')

  // Busca el gancho del bloque siguiente. `desde` = bloque recién completado
  // (si se omite, el server lo infiere de la hora). Devuelve true si hay sugerencia.
  async function buscar(desde?: string): Promise<boolean> {
    try {
      const res = await api.get('/centro/cruzada/sugerencias', {
        params: desde ? { desde } : {}
      })
      if (res.data?.sugerencia) {
        setSugerencia(res.data.sugerencia)
        return true
      }
    } catch {
      /* sin gancho: no es un error que valga molestar al usuario */
    }
    return false
  }

  async function reservar() {
    if (!sugerencia) return
    setReservando(true)
    setError('')
    try {
      const res = await api.post('/centro/cruzada/reservar', { ofertaId: sugerencia.ofertaId })
      guardarCodigo(res.data.canjeId, res.data.codigo, res.data.expiraEn)
      setReserva(res.data)
    } catch (e: any) {
      setError(e.response?.data?.error || 'No pudimos reservar. Probá de nuevo.')
    } finally {
      setReservando(false)
    }
  }

  function cerrar() {
    setSugerencia(null)
    setReserva(null)
    setError('')
  }

  return { sugerencia, reservando, reserva, error, buscar, reservar, cerrar }
}
