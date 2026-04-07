import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { Producto } from '../types'

interface BannerDef {
  titulo: string
  subtitulo: string
  cta: string
  enlace: string
  gradiente: string
  emoji: string
}

const BANNERS_BASE: BannerDef[] = [
  {
    titulo: 'Env\u00edos a todo el pa\u00eds',
    subtitulo: 'Comprale a vendedores locales de forma segura',
    cta: 'Explorar cat\u00e1logo',
    enlace: '/catalogo',
    gradiente: 'from-blue-600 via-indigo-600 to-purple-700',
    emoji: '\u{1F69A}'
  },
  {
    titulo: 'Pag\u00e1 hasta en 12 cuotas',
    subtitulo: 'Financiaci\u00f3n con Mercado Pago',
    cta: 'Ver productos',
    enlace: '/catalogo',
    gradiente: 'from-emerald-500 via-teal-600 to-cyan-700',
    emoji: '\u{1F4B3}'
  },
  {
    titulo: 'Vend\u00e9 en MercadoLocal',
    subtitulo: 'Abr\u00ed tu tienda gratis y empez\u00e1 hoy mismo',
    cta: 'Crear mi tienda',
    enlace: '/registro?rol=vendedor',
    gradiente: 'from-orange-500 via-red-500 to-pink-600',
    emoji: '\u{1F3EA}'
  },
  {
    titulo: 'Compra protegida',
    subtitulo: 'Tu dinero queda retenido hasta que confirmes la entrega',
    cta: '\u00bfC\u00f3mo funciona?',
    enlace: '/devoluciones',
    gradiente: 'from-fuchsia-600 via-purple-600 to-indigo-700',
    emoji: '\u{1F6E1}\uFE0F'
  }
]

export default function BannersRotativos() {
  const [idx, setIdx] = useState(0)
  const [productoDestacado, setProductoDestacado] = useState<Producto | null>(null)

  useEffect(() => {
    api.get('/productos?ordenar=ventas&limite=1')
      .then(r => r.data[0] && setProductoDestacado(r.data[0]))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setIdx(i => (i + 1) % BANNERS_BASE.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const banner = BANNERS_BASE[idx]

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 pt-4">
      <div className={`relative bg-gradient-to-br ${banner.gradiente} rounded-2xl overflow-hidden shadow-lg`}>
        <div key={idx} className="banner-fade">
          <div className="grid md:grid-cols-2 gap-4 items-center p-5 sm:p-8 md:p-10 min-h-[180px] sm:min-h-[220px]">
            <div className="text-white">
              <h2 className="text-xl sm:text-2xl md:text-4xl font-extrabold mb-2 sm:mb-3 leading-tight">
                {banner.titulo}
              </h2>
              <p className="text-sm sm:text-base text-white/90 mb-4">
                {banner.subtitulo}
              </p>
              <Link
                to={banner.enlace}
                className="inline-block px-5 py-2.5 bg-white text-gray-900 rounded-lg font-bold text-sm sm:text-base hover:shadow-xl transition-all"
              >
                {banner.cta} &rarr;
              </Link>
            </div>
            <div className="hidden md:flex justify-center items-center">
              {idx === 0 && productoDestacado?.imagenes?.[0] ? (
                <Link to={`/producto/${productoDestacado._id}`} className="group">
                  <img
                    src={productoDestacado.imagenes[0]}
                    alt={productoDestacado.nombre}
                    className="w-40 h-40 lg:w-48 lg:h-48 object-cover rounded-xl border-4 border-white/30 shadow-2xl group-hover:scale-105 transition-transform"
                  />
                </Link>
              ) : (
                <span className="text-8xl lg:text-9xl opacity-90 drop-shadow-lg">{banner.emoji}</span>
              )}
            </div>
          </div>
        </div>

        {/* Dots */}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
          {BANNERS_BASE.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-2 rounded-full transition-all ${
                i === idx ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
              }`}
              aria-label={`Banner ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
