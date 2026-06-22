import { useEffect, useState } from 'react'
import api from '../services/api'
import { perfiladoRechazado } from '../services/tracking'
import { Producto } from '../types'
import TarjetaProducto from './TarjetaProducto'

/**
 * Sección "Para vos" / "Seguí viendo": muestra recomendaciones basadas en el
 * historial de intención del cliente (lo último que miró, su afinidad de
 * categoría/precio). Es la cara visible del algoritmo. Si el visitante rechazó
 * el perfilado (Ley 25.326), no la mostramos.
 */
export default function ParaVos() {
  const [vistos, setVistos] = useState<Producto[]>([])
  const [recomendados, setRecomendados] = useState<Producto[]>([])
  const [personalizado, setPersonalizado] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (perfiladoRechazado()) { setCargando(false); return }
    api.get('/senales/para-vos?limite=8')
      .then(res => {
        setVistos(res.data.vistosRecientes || [])
        setRecomendados(res.data.recomendados || [])
        setPersonalizado(!!res.data.personalizado)
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  if (cargando) return null
  // Sin nada que mostrar (visitante nuevo sin historial y sin catálogo): no renderiza.
  if (vistos.length === 0 && recomendados.length === 0) return null

  return (
    <div className="space-y-8">
      {vistos.length > 0 && (
        <section>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ml-ink mb-3">Seguí viendo</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {vistos.map(p => <TarjetaProducto key={p._id} producto={p} />)}
          </div>
        </section>
      )}
      {recomendados.length > 0 && (
        <section>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ml-ink mb-1">
            {personalizado ? 'Para vos' : 'Te puede interesar'}
          </h2>
          {personalizado && (
            <p className="text-sm text-ml-muted mb-3">Elegidos según lo que venís mirando.</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {recomendados.map(p => <TarjetaProducto key={p._id} producto={p} />)}
          </div>
        </section>
      )}
    </div>
  )
}
