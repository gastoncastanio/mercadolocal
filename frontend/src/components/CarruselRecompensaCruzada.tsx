import { useState, useRef, useEffect } from 'react'
import { OfertaFlash } from './TarjetaOfertaFlash'

interface CarruselRecompensaCruzadaProps {
  ofertas: (OfertaFlash & { comercioNombre?: string })[]
  offsetMs: number
  titulo?: string
}

export default function CarruselRecompensaCruzada({ ofertas, offsetMs, titulo = '🔗 Rutas de Recompensa Cruzada' }: CarruselRecompensaCruzadaProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = () => {
    if (scrollRef.current) {
      setCanScrollLeft(scrollRef.current.scrollLeft > 0)
      setCanScrollRight(scrollRef.current.scrollLeft < scrollRef.current.scrollWidth - scrollRef.current.clientWidth - 10)
    }
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [ofertas])

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = 300
      scrollRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
      setTimeout(checkScroll, 100)
    }
  }

  // Filtra solo ofertas con desbloquea (recompensa cruzada)
  const ofertasConDesbloquea = ofertas.filter(o => o.desbloquea)

  if (!ofertasConDesbloquea.length) {
    return null
  }

  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold text-ml-soft uppercase tracking-wide mb-3">{titulo}</h2>
      <p className="text-xs text-ml-muted mb-3">Canjea en un lugar, desbloquea sorpresas en otro</p>
      <div className="relative">
        {/* Carrusel scrollable */}
        <div
          ref={scrollRef}
          className="overflow-x-auto flex gap-3 pb-2 scrollbar-hide"
          onScroll={checkScroll}
        >
          {ofertasConDesbloquea.map(o => (
            <div key={o._id} className="flex-shrink-0 w-72">
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-4 h-full">
                {/* Oferta A */}
                <div className="mb-3 pb-3 border-b border-purple-200">
                  <p className="text-xs text-ml-muted mb-1">Canjeá acá:</p>
                  <p className="font-bold text-ml-ink text-sm">{o.titulo}</p>
                  <p className="text-xs text-ml-soft mt-1">{o.comercioNombre || 'Comercio'}</p>
                </div>

                {/* Flecha de recompensa */}
                <div className="flex items-center justify-center my-3 text-purple-500">
                  <span className="text-2xl">→</span>
                </div>

                {/* Oferta B (desbloquea) */}
                <div className="bg-white rounded-xl p-3 border border-purple-100">
                  <p className="text-xs text-purple-600 font-semibold mb-1">✨ Desbloquea:</p>
                  <p className="text-sm font-bold text-ml-ink">{o.desbloquea?.descripcion}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Botones de navegación */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-4 bg-white rounded-full p-2 shadow-md z-10 hover:bg-ml-bg"
          >
            ‹
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-4 bg-white rounded-full p-2 shadow-md z-10 hover:bg-ml-bg"
          >
            ›
          </button>
        )}
      </div>
    </div>
  )
}
