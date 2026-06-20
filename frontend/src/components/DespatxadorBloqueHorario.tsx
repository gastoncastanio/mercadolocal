import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { Coord } from '../utils/geo'
import { OfertaFlash } from './TarjetaOfertaFlash'
import CarruselRecompensaCruzada from './CarruselRecompensaCruzada'
import { BloqueHorario } from '../hooks/useBloqueHorario'

interface DespatxadorBloqueHorarioProps {
  bloque: BloqueHorario | null
  coords: Coord | null
  ciudad: string
  cargando?: boolean
}

interface OfertaPorBloque extends OfertaFlash {
  comercioNombre?: string
  comercioLat?: number
  comercioLng?: number
  distancia?: number
}

export default function DespatxadorBloqueHorario({ bloque, coords, ciudad, cargando = false }: DespatxadorBloqueHorarioProps) {
  const [ofertas, setOfertas] = useState<OfertaPorBloque[]>([])
  const [cargandoOfertas, setCargandoOfertas] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (bloque) {
      cargarOfertasPorBloque()
    }
  }, [bloque, coords, ciudad])

  async function cargarOfertasPorBloque() {
    if (!bloque) return
    setCargandoOfertas(true)
    try {
      const params = new URLSearchParams()
      params.append('ciudad', ciudad)
      if (bloque.tipoDispatcher === 'cercania' && coords) {
        params.append('lat', String(coords.lat))
        params.append('lng', String(coords.lng))
      }

      const res = await api.get(`/centro/ofertas/bloque/${bloque.nombre}?${params}`)
      setOfertas(res.data.ofertas || [])
      setError('')
    } catch (e: any) {
      setError(e.response?.data?.error || 'No pudimos cargar las ofertas.')
      setOfertas([])
    } finally {
      setCargandoOfertas(false)
    }
  }

  if (!bloque) {
    return null
  }

  // El header muta con el tema del bloque (Camaleón). Fallback a violeta/azul.
  const tema = bloque.tema || null
  const gradiente = tema
    ? `linear-gradient(135deg, ${tema.colorDesde}, ${tema.colorHasta})`
    : 'linear-gradient(135deg, #A855F7, #3B82F6)'

  return (
    <div className="mb-8">
      {/* Encabezado del bloque */}
      <div
        className="text-white rounded-2xl p-6 mb-6 transition-colors duration-700"
        style={{ background: gradiente }}
      >
        <h2 className="font-display text-3xl font-extrabold mb-1">{bloque.titulo}</h2>
        <p className="text-sm text-white/90">{bloque.descripcion}</p>
      </div>

      {/* Modo Siesta / Shopping: el local físico está cerrado → empujamos compra online */}
      {bloque.tipoDispatcher === 'shopping' && (
        <Link
          to="/catalogo"
          className="flex items-center justify-between gap-3 bg-white rounded-2xl border border-ml-line p-4 mb-6 hover:shadow-md transition-shadow"
        >
          <div>
            <p className="font-bold text-ml-ink">🛍️ El centro está en siesta, pero las ofertas no</p>
            <p className="text-xs text-ml-muted mt-0.5">Comprá online indumentaria, tecnología y calzado con descuentos de siesta.</p>
          </div>
          <span className="shrink-0 text-sm font-bold text-white px-4 py-2 rounded-xl" style={{ background: tema?.acento || '#9333EA' }}>
            Ver tienda →
          </span>
        </Link>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">{error}</p>}

      {cargandoOfertas || cargando ? (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      ) : ofertas.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-ml-line">
          <p className="text-4xl mb-3">🌫️</p>
          <p className="text-ml-muted text-sm">No hay ofertas disponibles en este momento.</p>
        </div>
      ) : bloque.tipoDispatcher === 'cruzada' ? (
        <>
          {/* Carrusel de recompensa cruzada */}
          <CarruselRecompensaCruzada ofertas={ofertas} />

          {/* Feed regular de todas las ofertas */}
          <div className="mt-8">
            <h3 className="text-sm font-bold text-ml-soft uppercase tracking-wide mb-3">📋 Todas las ofertas</h3>
            <div className="space-y-3">
              {ofertas.map(o => (
                <div key={o._id} className="bg-white rounded-2xl shadow-sm border border-ml-line p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-ml-ink">{o.titulo}</p>
                      <p className="text-xs text-ml-muted">{o.comercioNombre}</p>
                    </div>
                    {o.distancia && <p className="text-xs font-semibold text-ml-violet ml-3">📍 {(o.distancia / 1000).toFixed(1)}km</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        // Dispatch 'cercania' o 'general': lista simple
        <div className="space-y-3">
          {ofertas.map(o => (
            <div key={o._id} className="bg-white rounded-2xl shadow-sm border border-ml-line p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ml-ink">{o.titulo}</p>
                  <p className="text-xs text-ml-muted">{o.comercioNombre}</p>
                </div>
                {o.distancia && <p className="text-xs font-semibold text-ml-violet ml-3">📍 {(o.distancia / 1000).toFixed(1)}km</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
