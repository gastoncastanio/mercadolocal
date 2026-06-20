import { useState, useEffect } from 'react'
import api from '../services/api'

export interface TemaBloque {
  emoji: string
  colorDesde: string
  colorHasta: string
  acento: string
  rubrosPrioritarios: string[]
}

export interface BloqueHorario {
  nombre: string
  horaInicio: string
  horaFin: string
  titulo: string
  descripcion: string
  tipoDispatcher: 'cercania' | 'cruzada' | 'general' | 'shopping'
  distanciaMaxima: number
  activo: boolean
  tema?: TemaBloque | null
}

// Tema neutro para los gaps horarios (cuando no hay bloque activo).
export const TEMA_NEUTRO: TemaBloque = {
  emoji: '📍',
  colorDesde: '#7C3AED',
  colorHasta: '#2563EB',
  acento: '#7C3AED',
  rubrosPrioritarios: []
}

export function useBloqueHorario() {
  const [bloqueActual, setBloqueActual] = useState<BloqueHorario | null>(null)
  const [bloques, setBloques] = useState<BloqueHorario[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    cargar()
    // Recarga cada minuto por si cambió el horario
    const timer = setInterval(cargar, 60000)
    return () => clearInterval(timer)
  }, [])

  async function cargar() {
    try {
      const [resBloque, resBloques] = await Promise.all([
        api.get('/centro/bloque/actual'),
        api.get('/centro/bloques')
      ])
      setBloqueActual(resBloque.data.bloque || null)
      setBloques(resBloques.data || [])
    } catch (e) {
      setError('No pudimos cargar los bloques horarios.')
      console.error(e)
    } finally {
      setCargando(false)
    }
  }

  return {
    bloqueActual,
    bloques,
    cargando,
    error,
    refrescar: cargar
  }
}
