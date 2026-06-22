import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { Producto, Tienda } from '../types'
import { imgCloudinary } from '../utils/cloudinary'

interface BannerDef {
  titulo: string
  subtitulo: string
  cta: string
  enlace: string
  gradiente: string
  emoji: string
  realce?: string        // texto grande del visual (ej. "12x")
  realceLabel?: string   // etiqueta chica bajo el realce (ej. "cuotas")
  nota?: string          // letra chica (disclaimer honesto)
  producto?: Producto | null
  destacadoId?: string
}

const BANNERS_BASE: BannerDef[] = [
  {
    titulo: 'Llevátelo hoy, pagalo en cuotas',
    subtitulo: 'Con todas las tarjetas y el respaldo de Mercado Pago.',
    cta: 'Ver productos',
    enlace: '/catalogo',
    gradiente: 'from-emerald-500 via-teal-600 to-cyan-700',
    emoji: '\u{1F4B3}',
    realce: 'Hasta 12',
    realceLabel: 'cuotas',
    nota: 'El costo de la financiación lo define tu banco.'
  },
  {
    titulo: 'Abr\u00ed tu tienda gratis',
    subtitulo: 'Empez\u00e1 a vender hoy. Solo pag\u00e1s cuando vend\u00e9s.',
    cta: 'Crear mi tienda',
    enlace: '/registro?rol=vendedor',
    gradiente: 'from-orange-500 via-red-500 to-pink-600',
    emoji: '\u{1F3EA}'
  },
  {
    titulo: 'Compra protegida con Mercado Pago',
    subtitulo: 'Pag\u00e1s seguro y, si algo sale mal, Mercado Pago te respalda',
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

  useEffect(() => { cargarDestacados() }, [])

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
        {/* Patron decorativo sutil */}
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }} />

        <div key={idx} className="banner-fade relative">
          <div className="grid md:grid-cols-2 gap-4 items-center p-5 sm:p-8 md:p-10 min-h-[180px] sm:min-h-[220px]">
            <div className="text-white">
              {banner.destacadoId && (
                <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full mb-3 font-semibold">
                  &#x2B50; Producto promocionado
                </span>
              )}
              <h2 className="text-xl sm:text-2xl md:text-4xl font-extrabold mb-2 sm:mb-3 leading-tight tracking-tight">
                {banner.titulo}
              </h2>
              <p className="text-sm sm:text-base text-white/90 mb-4 leading-relaxed">
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
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-ml-ink rounded-xl font-bold text-sm sm:text-base hover:shadow-xl hover:scale-[1.03] transition-all"
              >
                {banner.cta}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
              {banner.nota && (
                <p className="text-[11px] text-white/70 mt-2.5">{banner.nota}</p>
              )}
            </div>
            <div className="hidden md:flex justify-center items-center">
              {banner.producto?.imagenes?.[0] ? (
                <Link to={banner.enlace} onClick={handleClickPromo} className="group">
                  <img
                    src={imgCloudinary(banner.producto.imagenes[0], 320)}
                    alt={banner.producto.nombre}
                    loading="lazy"
                    width={160}
                    height={160}
                    className="w-40 h-40 lg:w-48 lg:h-48 object-cover rounded-2xl border-4 border-white/20 shadow-2xl group-hover:scale-105 group-hover:border-white/40 transition-all duration-300"
                  />
                </Link>
              ) : banner.realce ? (
                <div className="relative animate-float">
                  {/* Tarjeta glassy inclinada */}
                  <div className="w-56 h-36 rounded-2xl bg-gradient-to-br from-white/30 to-white/5 backdrop-blur-md border border-white/30 shadow-2xl -rotate-[8deg] flex flex-col justify-between p-4">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-7 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 shadow-inner" />
                      <span className="text-white/85 text-[11px] font-bold tracking-wide">mercado pago</span>
                    </div>
                    <div className="text-white/90 tracking-[0.2em] text-base font-semibold">{'•••• 4480'}</div>
                  </div>
                  {/* Badge de cuotas */}
                  <div className="absolute -bottom-5 -right-5 bg-white text-ml-ink rounded-2xl shadow-xl px-4 py-2.5 rotate-[6deg] text-center">
                    <span className="block text-2xl lg:text-3xl font-extrabold leading-none">{banner.realce}</span>
                    {banner.realceLabel && <span className="block text-[11px] font-bold text-ml-muted mt-0.5">{banner.realceLabel}</span>}
                  </div>
                </div>
              ) : (
                <div className="w-36 h-36 lg:w-44 lg:h-44 rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center animate-float">
                  <span className="text-7xl lg:text-8xl drop-shadow-lg">{banner.emoji}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dots mejorados */}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`rounded-full transition-all duration-300 ${
                i === idx ? 'w-7 h-2.5 bg-white shadow-sm' : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/70'
              }`}
              aria-label={`Banner ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
