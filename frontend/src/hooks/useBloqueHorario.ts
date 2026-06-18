import { useState, useEffect } from 'react'
import api from '../services/api'

export interface BloqueHorario {
  nombre: string
  horaInicio: string
  horaFin: string
  titulo: string
  descripcion: string
  tipoDispatcher: 'cercania' | 'cruzada' | 'general'
  distanciaMaxima: number
  activo: boolean
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
