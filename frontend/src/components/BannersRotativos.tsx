import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { Producto, Tienda } from '../types'

interface BannerDef {
  titulo: string
  subtitulo: string
  cta: string
  enlace: string
  gradiente: string
  emoji: string
  producto?: Producto | null
  destacadoId?: string
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

const GRADIENTES_PROMO = [
  'from-rose-500 via-pink-600 to-fuchsia-700',
  'from-violet-500 via-purple-600 to-indigo-700',
  'from-cyan-500 via-blue-600 to-indigo-700',
  'from-amber-500 via-orange-600 to-red-700'
]

export default function BannersRotativos() {
  const [idx, setIdx] = useState(0)
  const [banners, setBanners] = useState<BannerDef[]>(BANNERS_BASE)

  useEffect(() => {
    cargarDestacados()
  }, [])

  async function cargarDestacados() {
    try {
      const res = await api.get('/destacados/activos?ubicacion=banner')
      const destacados = res.data || []

      if (destacados.length > 0) {
        const bannersPromo: BannerDef[] = destacados.slice(0, 3).map((d: any, i: number) => {
          const prod = d.productoId as Producto
          const tienda = prod?.tiendaId as Tienda
          return {
            titulo: prod?.nombre || 'Producto destacado',
            subtitulo: tienda ? `por ${tienda.nombre} \u2022 ${tienda.ciudad}` : 'Producto promocionado',
            cta: 'Ver producto',
            enlace: `/producto/${prod?._id}`,
            gradiente: GRADIENTES_PROMO[i % GRADIENTES_PROMO.length],
            emoji: '\u2B50',
            producto: prod,
            destacadoId: d._id
          }
        })
        // Intercalar: promo, base, promo, base...
        const mezclados: BannerDef[] = []
        const maxLen = Math.max(bannersPromo.length, BANNERS_BASE.length)
        for (let i = 0; i < maxLen; i++) {
          if (i < bannersPromo.length) mezclados.push(bannersPromo[i])
          if (i < BANNERS_BASE.length) mezclados.push(BANNERS_BASE[i])
        }
        setBanners(mezclados)
      }
    } catch {}
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setIdx(i => (i + 1) % banners.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [banners.length])

  const banner = banners[idx]

  function handleClickPromo() {
    if (banner.destacadoId) {
      api.post(`/destacados/click/${banner.destacadoId}`).catch(() => {})
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 pt-4">
      <div className={`relative bg-gradient-to-br ${banner.gradiente} rounded-2xl overflow-hidden shadow-lg`}>
        <div key={idx} className="banner-fade">
          <div className="grid md:grid-cols-2 gap-4 items-center p-5 sm:p-8 md:p-10 min-h-[180px] sm:min-h-[220px]">
            <div className="text-white">
              {banner.destacadoId && (
                <span className="inline-block text-[10px] uppercase tracking-wide bg-white/20 px-2 py-0.5 rounded mb-2 font-semibold">
                  &#x2B50; Producto promocionado
                </span>
              )}
              <h2 className="text-xl sm:text-2xl md:text-4xl font-extrabold mb-2 sm:mb-3 leading-tight">
                {banner.titulo}
              </h2>
              <p className="text-sm sm:text-base text-white/90 mb-4">
                {banner.subtitulo}
              </p>
              {banner.producto && (
                <p className="text-lg sm:text-2xl font-bold text-white mb-3">
                  ${banner.producto.precio.toLocaleString('es-AR')}
                </p>
              )}
              <Link
                to={banner.enlace}
                onClick={handleClickPromo}
                className="inline-block px-5 py-2.5 bg-white text-gray-900 rounded-lg font-bold text-sm sm:text-base hover:shadow-xl transition-all"
              >
                {banner.cta} &rarr;
              </Link>
            </div>
            <div className="hidden md:flex justify-center items-center">
              {banner.producto?.imagenes?.[0] ? (
                <Link to={banner.enlace} onClick={handleClickPromo} className="group">
                  <img
                    src={banner.producto.imagenes[0]}
                    alt={banner.producto.nombre}
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
          {banners.map((_, i) => (
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
