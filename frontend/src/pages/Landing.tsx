import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Producto } from '../types'
import TarjetaProducto from '../components/TarjetaProducto'
import BannersRotativos from '../components/BannersRotativos'
import EspaciosPublicitarios from '../components/EspaciosPublicitarios'
import InstalarApp from '../components/InstalarApp'

// ============================================================
// Categorías: usan los NOMBRES REALES del catálogo (exactamente
// como los filtra CatalogoProductos) para que el link filtre de
// verdad. El estilo es el de tiles del diseño Futuro.
// ============================================================
const CATEGORIAS = [
  {
    nombre: 'Electrónica', tint: 'bg-[#eef2ff]', stroke: '#2563eb',
    icon: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8" /></>
  },
  {
    nombre: 'Ropa', tint: 'bg-[#f3edff]', stroke: '#7c3aed',
    icon: <><path d="M16 4l4 3-3 3-1-1v11H8V9L7 10 4 7l4-3 2 2h4l2-2Z" /></>
  },
  {
    nombre: 'Hogar', tint: 'bg-[#eef2ff]', stroke: '#2563eb',
    icon: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /></>
  },
  {
    nombre: 'Alimentos', tint: 'bg-[#f3edff]', stroke: '#7c3aed',
    icon: <><path d="M4 4h2l1 12h11l2-8H7" /><circle cx="9" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /></>
  },
  {
    nombre: 'Belleza', tint: 'bg-[#eef2ff]', stroke: '#2563eb',
    icon: <><path d="M12 3l1.8 4.7L18 9l-4.2 1.3L12 15l-1.8-4.7L6 9l4.2-1.3L12 3Z" /><path d="M5 18l1 3M19 18l-1 3" /></>
  },
  {
    nombre: 'Deportes', tint: 'bg-[#f3edff]', stroke: '#7c3aed',
    icon: <><circle cx="5.5" cy="17" r="3" /><circle cx="18.5" cy="17" r="3" /><path d="M8 17h6l3-7-4-2-2 4H6" /></>
  },
  {
    nombre: 'Juguetes', tint: 'bg-[#eef2ff]', stroke: '#2563eb',
    icon: <><rect x="3" y="11" width="8" height="8" rx="2" /><circle cx="17" cy="7" r="4" /><path d="M14 17h6M17 14v6" /></>
  },
  {
    nombre: 'Otro', tint: 'bg-[#f3edff]', stroke: '#7c3aed',
    icon: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>
  }
]

const TESTIMONIOS = [
  { nombre: 'Camila R.', ciudad: 'Córdoba', texto: 'Vendí más de 50 productos en el primer mes. La plataforma es súper intuitiva y el pago cae directo.', rol: 'Vendedora' },
  { nombre: 'Martín L.', ciudad: 'Rosario', texto: 'Compré un celular y llegó perfecto. Pagué con Mercado Pago, súper seguro y rápido.', rol: 'Comprador' },
  { nombre: 'Lucía G.', ciudad: 'Buenos Aires', texto: 'Abrí mi tienda de ropa vintage y ya tengo clientes fieles. Cero complicaciones.', rol: 'Vendedora' }
]

const TIENDAS_MARQUEE = ['TecnoStore', 'Mueblería Centro', 'AudioCenter', 'DeporLocal', 'Ferretería Norte', 'Bazar Lobos', 'Granja Don Pedro', 'Farmacia Central']

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) setVisible(true) },
      { threshold }
    )
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function AnimatedCounter({ end, prefix = '', suffix = '' }: { end: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0)
  const { ref, visible } = useInView(0.3)
  useEffect(() => {
    if (!visible) return
    let start = 0
    const step = Math.max(1, Math.floor(end / 40))
    const timer = setInterval(() => {
      start += step
      if (start >= end) { setCount(end); clearInterval(timer) }
      else setCount(start)
    }, 30)
    return () => clearInterval(timer)
  }, [visible, end])
  return <span ref={ref as any}>{prefix}{count.toLocaleString('es-AR')}{suffix}</span>
}

/**
 * Canvas de "red de ciudad": nodos que se mueven y se conectan.
 * Es 100% autocontenido (no usa librerías externas) y limpia el
 * requestAnimationFrame al desmontar. Respeta prefers-reduced-motion.
 */
function CityNetworkCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0, h = 0, raf = 0
    const N = 44
    const build = () => {
      const r = cv.getBoundingClientRect()
      w = cv.width = Math.max(1, r.width * DPR)
      h = cv.height = Math.max(1, r.height * DPR)
    }
    build()
    const onResize = () => build()
    window.addEventListener('resize', onResize)
    const nodes = Array.from({ length: N }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - .5) * .28 * DPR, vy: (Math.random() - .5) * .28 * DPR,
      r: (Math.random() * 1.6 + 1) * DPR, hub: Math.random() < .18
    }))
    const max = 150 * DPR
    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (const a of nodes) {
        a.x += a.vx; a.y += a.vy
        if (a.x < 0 || a.x > w) a.vx *= -1
        if (a.y < 0 || a.y > h) a.vy *= -1
      }
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const a = nodes[i], b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy)
        if (d < max) {
          ctx.strokeStyle = 'rgba(150,130,255,' + (1 - d / max) * .42 + ')'
          ctx.lineWidth = DPR
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
        }
      }
      for (const a of nodes) {
        ctx.beginPath(); ctx.arc(a.x, a.y, a.hub ? a.r * 2.2 : a.r, 0, 6.2832)
        if (a.hub) { ctx.shadowColor = 'rgba(124,58,237,.9)'; ctx.shadowBlur = 14 * DPR; ctx.fillStyle = 'rgba(167,139,250,.95)' }
        else { ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.7)' }
        ctx.fill(); ctx.shadowBlur = 0
      }
      if (!reduce) raf = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])
  return <canvas ref={ref} className="absolute inset-0 w-full h-full block" />
}

export default function Landing() {
  const { estaLogueado } = useAuth()
  const navigate = useNavigate()
  const [destacados, setDestacados] = useState<Producto[]>([])
  const [masVendidos, setMasVendidos] = useState<Producto[]>([])
  const [stats, setStats] = useState({ productosPublicados: 0, vendedoresActivos: 0, comprasRealizadas: 0, satisfaccion: 0 })
  const [busqueda, setBusqueda] = useState('')

  const hero = useInView(0.2)
  const red = useInView(0.15)
  const cats = useInView(0.15)
  const escrow = useInView(0.1)
  const testimonios = useInView(0.15)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      const [d, mv, s] = await Promise.all([
        api.get('/productos?ordenar=calificacion&limite=8').catch(() => ({ data: [] })),
        api.get('/productos?ordenar=ventas&limite=8').catch(() => ({ data: [] })),
        api.get('/stats').catch(() => ({ data: null }))
      ])
      setDestacados(d.data)
      setMasVendidos(mv.data)
      if (s.data && s.data.productosPublicados !== undefined) {
        setStats(s.data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  function buscar(e: React.FormEvent) {
    e.preventDefault()
    if (busqueda.trim()) navigate(`/catalogo?busqueda=${encodeURIComponent(busqueda)}`)
    else navigate('/catalogo')
  }

  // Stats reales para el hero / sección de red (con fallback a claims de marca)
  const nProductos = stats.productosPublicados || 1200
  const nTiendas = stats.vendedoresActivos || 80
  const pctAhorro = 17

  return (
    <div className="bg-white text-ml-ink overflow-x-hidden">
      {/* ===== BARRA DE ANUNCIO ===== */}
      <div className="ml-grad text-white text-center text-[13.5px] font-semibold py-2 px-5">
        Una búsqueda&nbsp; ·&nbsp; toda la ciudad compite por tu compra&nbsp; ·&nbsp; vos pagás menos
      </div>

      {/* Banners rotativos (integración existente) */}
      <BannersRotativos />

      {/* ===== HERO ===== */}
      <section ref={hero.ref as any} className="relative overflow-hidden">
        {/* Glows decorativos - hidden on small screens for mobile optimization */}
        <div className="pointer-events-none absolute -top-32 -left-20 w-[540px] h-[540px] rounded-full ml-blob hidden sm:block"
          style={{ background: 'radial-gradient(circle,rgba(37,99,235,.22),transparent 64%)', filter: 'blur(8px)' }} />
        <div className="pointer-events-none absolute -top-16 -right-16 w-[520px] h-[520px] rounded-full ml-blob-rev hidden sm:block"
          style={{ background: 'radial-gradient(circle,rgba(124,58,237,.26),transparent 62%)', filter: 'blur(8px)' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-16 md:py-20 grid md:grid-cols-[1.05fr_.95fr] gap-8 md:gap-12 items-center">
          {/* Columna texto — SIN animación de entrada: está above-the-fold y es
              el elemento LCP. Renderizarla oculta (opacity 0 + fade de 1s vía
              IntersectionObserver) retrasaba el LCP varios cientos de ms. */}
          <div>
            <span className="inline-flex items-center gap-2 text-[12px] sm:text-[13px] font-bold text-ml-violet bg-white/70 backdrop-blur-sm border border-[#e7dcff] px-3 sm:px-4 py-1.5 sm:py-2 rounded-full mb-3 sm:mb-5">
              <span className="w-[6px] h-[6px] rounded-full bg-green-500 ring-4 ring-green-500/20" />
              El marketplace que pone a competir a tu ciudad
            </span>

            <h1 className="font-display font-extrabold text-[32px] sm:text-[48px] lg:text-[62px] leading-[1.04] tracking-[-0.025em] m-0">
              <span className="block">Comprá una vez.</span>
              <span className="block ml-grad-text">Que compita la ciudad.</span>
            </h1>

            <p className="text-[15px] sm:text-[17px] leading-[1.5] text-ml-soft max-w-[500px] mt-3 sm:mt-4">
              El mismo producto, de todas las tiendas de tu zona, con todos los precios a la vista. Elegís el más barato, pagás con Mercado Pago y recibís hoy. Dejá de recorrer 10 negocios.
            </p>

            {/* Buscador funcional */}
            <form onSubmit={buscar} className="mt-5 sm:mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white border border-ml-line rounded-2xl p-2 max-w-[560px]"
              style={{ boxShadow: '0 26px 50px -26px rgba(37,99,235,.45)' }}>
              <div className="flex-1 flex items-center gap-2 text-ml-muted pl-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
                <input
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscá un producto…"
                  className="w-full bg-transparent outline-none text-[14px] sm:text-[15px] text-ml-ink placeholder-ml-muted py-2.5 sm:py-1"
                />
              </div>
              <button type="submit" className="mlbtn ml-grad text-white font-display font-bold text-[14px] sm:text-[15px] px-5 sm:px-8 py-2.5 sm:py-3 rounded-lg sm:rounded-xl shrink-0">
                Comparar
              </button>
            </form>

            {/* Stats reales */}
            <div className="flex flex-wrap gap-5 sm:gap-8 mt-5 sm:mt-7">
              <div>
                <div className="font-display font-extrabold text-[24px] sm:text-[28px]"><AnimatedCounter end={nProductos} prefix="+" /></div>
                <div className="text-[12px] sm:text-[13px] text-ml-muted font-semibold">productos</div>
              </div>
              <div className="w-px bg-ml-line self-stretch" />
              <div>
                <div className="font-display font-extrabold text-[24px] sm:text-[28px]"><AnimatedCounter end={nTiendas} prefix="+" /></div>
                <div className="text-[12px] sm:text-[13px] text-ml-muted font-semibold">tiendas</div>
              </div>
              <div className="w-px bg-ml-line self-stretch" />
              <div>
                <div className="font-display font-extrabold text-[24px] sm:text-[28px] ml-grad-text">-{pctAhorro}%</div>
                <div className="text-[12px] sm:text-[13px] text-ml-muted font-semibold">ahorro medio</div>
              </div>
            </div>
          </div>

          {/* Columna collage flotante (decorativo, solo desktop) */}
          <div className="relative h-[450px] hidden md:block">
            <div className="absolute top-0 right-2 w-[250px] bg-white border border-[#eeeef3] rounded-[20px] p-3.5 ml-float"
              style={{ boxShadow: '0 30px 60px -28px rgba(20,20,45,.42)' }}>
              <div className="aspect-[4/3] rounded-[13px] overflow-hidden bg-[#f1f1f8] mb-3">
                <img className="ph w-full h-full object-cover" src="https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=460&q=70" alt="" width={460} height={345} />
              </div>
              <span className="text-[10px] font-bold text-white ml-grad px-2.5 py-1 rounded-full">Mejor precio</span>
              <div className="font-display font-semibold text-sm mt-2">Notebook Lenovo i5</div>
              <div className="font-display font-extrabold text-[18px]">$ 540.000</div>
            </div>

            <div className="absolute top-[158px] left-0 w-[230px] bg-white border border-[#eeeef3] rounded-[20px] p-3.5 ml-float2"
              style={{ boxShadow: '0 30px 60px -28px rgba(20,20,45,.42)', animationDelay: '1s' }}>
              <div className="aspect-[4/3] rounded-[13px] overflow-hidden bg-[#f1f1f8] mb-3">
                <img className="ph w-full h-full object-cover" src="https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=460&q=70" alt="" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display font-semibold text-sm">Bici MTB R29</div>
                  <div className="font-display font-extrabold text-[18px]">$ 240.000</div>
                </div>
                <span className="text-[10px] font-bold text-ml-slate bg-[#f1f1f6] px-2.5 py-1 rounded-full">Usado</span>
              </div>
            </div>

            <div className="absolute bottom-1.5 right-14 w-[212px] bg-white border border-[#eeeef3] rounded-[20px] p-3.5 ml-float"
              style={{ boxShadow: '0 30px 60px -28px rgba(20,20,45,.42)', animationDelay: '.5s' }}>
              <div className="aspect-[4/3] rounded-[13px] overflow-hidden bg-[#f1f1f8] mb-3">
                <img className="ph w-full h-full object-cover" src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=460&q=70" alt="" />
              </div>
              <div className="font-display font-semibold text-sm">Auriculares Sony</div>
              <div className="font-display font-extrabold text-[18px]">$ 285.000</div>
            </div>

            <div className="absolute bottom-[70px] left-3.5 flex items-center gap-2.5 bg-white border border-[#eeeef3] rounded-[13px] px-4 py-2.5 ml-float2"
              style={{ boxShadow: '0 24px 44px -24px rgba(0,158,227,.55)', animationDelay: '.3s' }}>
              <span className="w-[30px] h-[30px] rounded-[9px] bg-ml-mp flex items-center justify-center">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20" /></svg>
              </span>
              <div>
                <div className="text-[11px] text-ml-muted font-semibold leading-none">Pago protegido</div>
                <div className="font-display font-bold text-[13px] text-ml-ink">Mercado Pago</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MARQUEE DE TIENDAS ===== */}
      <div className="border-y border-ml-line2 bg-ml-bg overflow-hidden py-[14px] sm:py-[18px]">
        <div className="ml-marq-track">
          {[...TIENDAS_MARQUEE, ...TIENDAS_MARQUEE].map((t, i) => (
            <span key={i} className="whitespace-nowrap font-display font-bold text-sm text-[#6b6b7b] bg-white border border-ml-line2 rounded-full px-[18px] py-2.5">{t}</span>
          ))}
        </div>
      </div>

      {/* ===== RED DE CIUDAD (visión) ===== */}
      <div ref={red.ref as any} className="relative mt-12 sm:mt-16 md:mt-20 bg-ml-night overflow-hidden">
        <CityNetworkCanvas />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(700px 360px at 50% 18%,rgba(124,58,237,.28),transparent 70%)' }} />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-12 sm:py-16 md:py-[92px] text-center text-white">
          <span className="inline-block text-[13px] font-bold text-[#c4b5fd] bg-white/10 border border-white/15 px-3.5 py-[7px] rounded-full mb-5">La visión</span>
          <h2 className="font-display font-extrabold text-[34px] sm:text-[48px] leading-[1.06] tracking-[-0.02em] max-w-[820px] mx-auto">
            El futuro de las ciudades<br className="hidden sm:block" /> compra local.
          </h2>
          <p className="text-[16px] sm:text-[18px] leading-[1.6] text-white/70 max-w-[640px] mx-auto mt-5">
            Una red que conecta cada negocio y cada vecino. Hoy electro, hogar y usados. Mañana, también el supermercado: el mismo producto de todas las cadenas, compitiendo por darte el mejor precio.
          </p>
          <div className={`grid grid-cols-3 gap-6 max-w-[740px] mx-auto mt-12 ${red.visible ? 'stagger-in' : ''}`}>
            <div>
              <div className="font-display font-extrabold text-[28px] sm:text-[40px] text-white"><AnimatedCounter end={nProductos} prefix="+" /></div>
              <div className="text-[12px] sm:text-[13.5px] text-white/60 font-semibold">productos en tu ciudad</div>
            </div>
            <div>
              <div className="font-display font-extrabold text-[28px] sm:text-[40px] text-white"><AnimatedCounter end={nTiendas} prefix="+" /></div>
              <div className="text-[12px] sm:text-[13.5px] text-white/60 font-semibold">tiendas compitiendo</div>
            </div>
            <div>
              <div className="font-display font-extrabold text-[28px] sm:text-[40px]" style={{ backgroundImage: 'linear-gradient(95deg,#60a5fa,#c4b5fd)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                <AnimatedCounter end={pctAhorro} suffix="%" />
              </div>
              <div className="text-[12px] sm:text-[13.5px] text-white/60 font-semibold">de ahorro promedio</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== CATEGORÍAS ===== */}
      <section ref={cats.ref as any} className="max-w-7xl mx-auto px-5 sm:px-8 pt-10 sm:pt-14 pb-1 md:pb-2">
        <h2 className="font-display font-bold text-[18px] sm:text-[24px] md:text-[27px] tracking-[-0.01em] mb-4 sm:mb-5">Explorá por categoría</h2>
        <div className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-2 sm:gap-3.5 ${cats.visible ? 'stagger-in' : ''}`}>
          {CATEGORIAS.map(cat => (
            <Link key={cat.nombre} to={`/catalogo?categoria=${encodeURIComponent(cat.nombre)}`}
              className="mlt text-center px-2 py-3 sm:py-4 border border-ml-line rounded-xl sm:rounded-2xl bg-white">
              <span className={`inline-flex w-[40px] h-[40px] sm:w-[46px] sm:h-[46px] rounded-[11px] sm:rounded-[13px] ${cat.tint} items-center justify-center mb-1.5 sm:mb-2.5`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cat.stroke} strokeWidth={2} className="sm:scale-110">{cat.icon}</svg>
              </span>
              <div className="text-[11px] sm:text-[13px] font-semibold text-ml-slate">{cat.nombre}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Espacios publicitarios (integración existente) */}
      <div className="max-w-7xl mx-auto px-5 sm:px-8 mt-10">
        <EspaciosPublicitarios />
      </div>

      {/* ===== DESTACADOS (productos reales) ===== */}
      {destacados.length > 0 && (
        <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-8 sm:pt-10 md:pt-12 pb-2">
          <div className="flex items-end justify-between mb-4 sm:mb-5">
            <div>
              <h2 className="font-display font-bold text-[18px] sm:text-[24px] md:text-[27px] tracking-[-0.01em]">Destacados cerca tuyo</h2>
              <p className="mt-1 sm:mt-1.5 text-ml-muted text-[13px] sm:text-[14.5px]">De tiendas verificadas</p>
            </div>
            <Link to="/catalogo" className="mllink text-xs sm:text-sm font-bold text-ml-blue whitespace-nowrap">Ver todo →</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5 md:gap-5">
            {destacados.slice(0, 8).map(p => <TarjetaProducto key={p._id} producto={p} />)}
          </div>
        </section>
      )}

      {/* ===== MÁS VENDIDOS (productos reales) ===== */}
      {masVendidos.length > 0 && (
        <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-6 sm:pt-8 pb-2">
          <div className="flex items-end justify-between mb-4 sm:mb-5">
            <div>
              <h2 className="font-display font-bold text-[18px] sm:text-[24px] md:text-[27px] tracking-[-0.01em]">Los más vendidos</h2>
              <p className="mt-1 sm:mt-1.5 text-ml-muted text-[13px] sm:text-[14.5px]">Favoritos esta semana</p>
            </div>
            <Link to="/mas-vendidos" className="mllink text-xs sm:text-sm font-bold text-ml-blue whitespace-nowrap">Ver todos →</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5 md:gap-5">
            {masVendidos.slice(0, 4).map(p => <TarjetaProducto key={p._id} producto={p} />)}
          </div>
        </section>
      )}

      {/* ===== TEASER SUPERMERCADO ===== */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-10 sm:pt-14 md:pt-16">
        <div className="border border-ml-line rounded-[20px] sm:rounded-[24px] overflow-hidden" style={{ background: 'linear-gradient(160deg,#fafaff,#fff)' }}>
          <div className="grid md:grid-cols-[1fr_1.05fr] items-center">
            <div className="p-6 sm:p-8 md:p-12">
              {/* Azul MP oscurecido (#036aa2) para pasar contraste AA sobre el fondo
                  celeste claro: el #009ee3 original daba ~2.8:1 (falla). */}
              <span className="inline-block text-[11px] sm:text-[12px] font-extrabold tracking-[0.06em] uppercase text-[#036aa2] bg-[#e7f6fd] border border-[#c5ecfa] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full mb-3 sm:mb-4">Próximamente</span>
              <h2 className="font-display font-extrabold text-[22px] sm:text-[28px] md:text-[36px] leading-[1.08] tracking-[-0.02em]">Tu supermercado,<br />en competencia.</h2>
              <p className="text-[14px] sm:text-[15px] md:text-[16.5px] leading-[1.5] sm:leading-[1.6] text-ml-soft mt-3 sm:mt-4 max-w-[440px]">
                El mismo producto de todas las cadenas, lado a lado. Armás el changuito una vez y cada artículo se compra donde está más barato. Menos vueltas, más ahorro — y ese ahorro vuelve a tu ciudad.
              </p>
            </div>
            <div className="p-5 sm:p-6 md:pr-12 md:py-8 flex flex-col gap-2.5 sm:gap-3">
              {[
                { p: 'Leche entera 1 L', c: '6 cadenas compiten', precio: '$ 1.190', off: '-14%', tint: 'bg-[#f3edff]', stroke: '#7c3aed' },
                { p: 'Arroz largo fino 1 kg', c: '5 cadenas compiten', precio: '$ 1.640', off: '-11%', tint: 'bg-[#eef2ff]', stroke: '#2563eb' },
                { p: 'Yerba mate 1 kg', c: '7 cadenas compiten', precio: '$ 3.250', off: '-18%', tint: 'bg-[#f3edff]', stroke: '#7c3aed' }
              ].map(item => (
                <div key={item.p} className="flex items-center gap-2.5 sm:gap-3.5 bg-white border border-ml-line rounded-[13px] sm:rounded-[15px] px-3 sm:px-4 py-2.5 sm:py-3.5"
                  style={{ boxShadow: '0 12px 30px -22px rgba(20,20,45,.4)' }}>
                  <span className={`shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-[10px] sm:rounded-[11px] ${item.tint} flex items-center justify-center`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={item.stroke} strokeWidth={2} className="sm:scale-110"><path d="M4 4h2l1 12h11l2-8H7" /><circle cx="9" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /></svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-[13px] sm:text-[14.5px]">{item.p}</div>
                    <div className="text-[11px] sm:text-[12px] text-ml-muted">{item.c}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display font-extrabold text-[15px] sm:text-[17px]">{item.precio}</div>
                    <div className="text-[10px] sm:text-[11px] font-bold text-[#0a7d34]">{item.off}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== CÓMO FUNCIONA — Compra protegida por Mercado Pago ===== */}
      <section ref={escrow.ref as any} className="relative max-w-7xl mx-auto px-5 sm:px-8 py-12 sm:py-16 md:py-20">
        {/* Halo de fondo tech */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[760px] max-w-full aspect-square rounded-full bg-gradient-to-br from-ml-blue/[0.07] via-ml-purple/[0.06] to-transparent blur-3xl" />
        </div>

        <div className="text-center mb-10 sm:mb-14">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-ml-line shadow-sm text-ml-blue rounded-full text-xs font-bold uppercase tracking-wide mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" /><path d="M9 12l2 2 4-4" /></svg>
            Compra protegida por Mercado Pago
          </span>
          <h2 className="font-display font-extrabold text-[28px] sm:text-[40px] tracking-[-0.02em]">¿Cómo funciona <span className="ml-grad-text">MercadoLocal</span>?</h2>
          <p className="text-[15px] sm:text-lg text-ml-soft mt-3 max-w-2xl mx-auto leading-relaxed">
            Comprás en tu ciudad con el respaldo de <strong className="text-ml-ink">Mercado Pago</strong>. Pagás de forma segura y, si algo sale mal, ellos median y te devuelven la plata.
          </p>
        </div>

        {/* Timeline de 4 pasos */}
        <div className="relative">
          {/* Línea conectora (desktop) */}
          <div className="hidden md:block absolute top-[52px] left-[14%] right-[14%] h-[2px] bg-gradient-to-r from-ml-blue/15 via-ml-purple/40 to-ml-blue/15" aria-hidden="true" />

          <div className={`relative grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 sm:gap-6 ${escrow.visible ? 'stagger-in' : ''}`}>
            {[
              {
                n: 1, titulo: 'Pagás seguro', desc: 'Checkout encriptado de Mercado Pago: tarjeta, cuotas o el medio que prefieras. No compartís tus datos con el vendedor.',
                icon: (<svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2.5" /><path d="M2 10h20" /><path d="M6 15h4" /></svg>)
              },
              {
                n: 2, titulo: 'El vendedor despacha', desc: 'Recibe tu pago y prepara el envío al instante. Seguí cada estado en vivo desde "Mis compras".',
                icon: (<svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 7.5h11V17H3z" /><path d="M14 10.5h4l3 3V17h-7z" /><circle cx="7" cy="18.5" r="1.7" /><circle cx="17.5" cy="18.5" r="1.7" /></svg>)
              },
              {
                n: 3, titulo: 'Recibís y revisás', desc: 'Te llega el producto y confirmás que sea tal cual lo publicado. Todo desde la app.',
                icon: (<svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 4h6v3H9z" /><path d="M9 13l2 2 4-4" /></svg>)
              },
              {
                n: 4, titulo: 'Mercado Pago te respalda', desc: '¿Algo salió mal o te arrepentiste? Activás el reclamo o el botón de arrepentimiento en Mercado Pago. Ellos median y te devuelven el dinero.',
                icon: (<svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" /><path d="M9 12l2 2 4-4" /></svg>)
              }
            ].map(paso => (
              <div key={paso.n} className="group text-center bg-white border border-ml-line rounded-[20px] p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_18px_40px_-18px_rgba(37,99,235,0.35)] hover:border-ml-purple/30">
                <div className="relative inline-flex mb-4">
                  <div className="w-[68px] h-[68px] rounded-2xl ml-grad text-white flex items-center justify-center shadow-lg shadow-ml-blue/25 transition-transform duration-300 group-hover:scale-105">{paso.icon}</div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white text-ml-violet border border-ml-line flex items-center justify-center font-extrabold text-sm shadow-sm">{paso.n}</div>
                </div>
                <h3 className="font-display font-bold text-ml-ink text-base mb-2">{paso.titulo}</h3>
                <p className="text-[13px] text-ml-soft leading-relaxed max-w-[230px] mx-auto">{paso.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Banner de protección — derecho de arrepentimiento + protección al comprador */}
        <div className="mt-10 sm:mt-12 rounded-[22px] p-[1.5px] bg-gradient-to-r from-ml-blue/30 via-ml-purple/40 to-ml-blue/30">
          <div className="rounded-[21px] bg-white p-6 sm:p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl ml-grad text-white flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" /><path d="M9 12l2 2 4-4" /></svg>
              </div>
              <p className="font-display font-extrabold text-ml-ink text-base sm:text-lg">Tu compra protegida de punta a punta</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#eef2ff] text-ml-blue flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
                </div>
                <div>
                  <p className="font-display font-bold text-ml-ink text-sm">Botón de arrepentimiento</p>
                  <p className="text-[13px] text-ml-soft mt-0.5 leading-relaxed">¿Te arrepentiste? Cancelás tu compra desde el botón de arrepentimiento de Mercado Pago y recuperás tu dinero según sus plazos.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#eef2ff] text-ml-blue flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" /><path d="M9 12l2 2 4-4" /></svg>
                </div>
                <div>
                  <p className="font-display font-bold text-ml-ink text-sm">Protección al Comprador</p>
                  <p className="text-[13px] text-ml-soft mt-0.5 leading-relaxed">Si el producto no llega, no coincide o tiene defectos, abrís el reclamo en Mercado Pago. Ellos median y gestionan la devolución.</p>
                </div>
              </div>
            </div>
            <p className="text-[12px] text-ml-muted mt-5 pt-4 border-t border-ml-line leading-relaxed">
              MercadoLocal te conecta con vendedores de tu ciudad. El pago y la protección los procesa y garantiza <strong className="text-ml-soft">Mercado Pago</strong> a través de su Programa de Protección al Comprador.
            </p>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIOS (sección de confianza conservada) ===== */}
      <section ref={testimonios.ref as any} className="max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-12 pb-6 sm:pb-8">
        <div className="text-center mb-5 sm:mb-7">
          <h2 className="font-display font-bold text-[18px] sm:text-[24px] md:text-[27px] tracking-[-0.01em]">Lo que dicen nuestros usuarios</h2>
          <p className="text-xs sm:text-sm text-ml-muted mt-1 sm:mt-1.5">Historias reales de compradores y vendedores</p>
        </div>
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-5 ${testimonios.visible ? 'stagger-in' : ''}`}>
          {TESTIMONIOS.map((t, i) => (
            <div key={i} className="bg-white border border-ml-line rounded-[18px] p-6 mlc">
              <div className="flex gap-0.5 mb-3">
                {[1, 2, 3, 4, 5].map(s => (
                  <svg key={s} className="w-4 h-4 text-[#f5b301]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                ))}
              </div>
              <p className="text-sm text-ml-slate leading-relaxed mb-4 italic">&ldquo;{t.texto}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full ml-grad flex items-center justify-center text-white font-bold text-sm">{t.nombre.charAt(0)}</div>
                <div>
                  <p className="font-semibold text-ml-ink text-sm">{t.nombre}</p>
                  <p className="text-xs text-ml-muted">{t.rol} · {t.ciudad}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CREAR TIENDA ===== */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-14 md:py-16">
        <div className="relative overflow-hidden rounded-[20px] sm:rounded-[28px] p-6 sm:p-8 md:p-14 grid md:grid-cols-[1.2fr_.8fr] gap-6 md:gap-10 items-center"
          style={{ background: 'linear-gradient(125deg,#3b32d6 0%,#6d28d9 52%,#7c3aed 100%)' }}>
          <div className="pointer-events-none absolute -top-24 -right-12 w-[360px] h-[360px] rounded-full" style={{ background: 'radial-gradient(circle,rgba(255,255,255,.16),transparent 70%)' }} />
          <div className="relative">
            <span className="inline-block text-[11px] sm:text-[13px] font-semibold text-white bg-white/15 border border-white/25 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full mb-3 sm:mb-4">Para comercios</span>
            <h2 className="font-display font-extrabold text-[22px] sm:text-[30px] md:text-[40px] leading-[1.08] tracking-[-0.02em] text-white">Sumá tu negocio.<br />Competí y vendé más.</h2>
            <p className="text-[14px] sm:text-[15px] md:text-[16px] leading-[1.5] sm:leading-[1.55] text-white/90 max-w-[520px] mt-3 sm:mt-4 mb-5 sm:mb-6 md:mb-7">
              Publicás en minutos, cobrás con Mercado Pago y te ponés frente a todos los compradores de tu zona. Sin costos de alta.
            </p>
            <div className="flex flex-wrap gap-2.5 sm:gap-3 items-center">
              <Link to={estaLogueado ? '/mi-tienda' : '/registro?rol=vendedor'} className="mlbtn font-display font-bold text-sm sm:text-base text-ml-indigo bg-white px-5 sm:px-7 py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl">Crear mi tienda</Link>
              <Link to="/ayuda" className="font-display font-bold text-[13px] sm:text-[15px] text-white border border-white/40 px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl hover:bg-white/10 transition-colors">Cómo funciona</Link>
            </div>
          </div>
          <div className="relative flex flex-col gap-2.5 sm:gap-3.5">
            <div className="bg-white/12 backdrop-blur-sm border border-white/20 rounded-[16px] sm:rounded-2xl p-3.5 sm:p-4 flex items-center gap-3">
              <span className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-white flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={2} className="sm:scale-110"><path d="M12 2v20M5 7l7-5 7 5" /></svg>
              </span>
              <div className="min-w-0">
                <div className="font-display font-bold text-sm sm:text-base text-white">Publicá en 2 minutos</div>
                <div className="text-[12px] sm:text-[13px] text-white/80">Foto, precio y listo</div>
              </div>
            </div>
            <div className="bg-white/12 backdrop-blur-sm border border-white/20 rounded-[16px] sm:rounded-2xl p-3.5 sm:p-4 flex items-center gap-3">
              <span className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-ml-mp flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} className="sm:scale-110"><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20" /></svg>
              </span>
              <div className="min-w-0">
                <div className="font-display font-bold text-sm sm:text-base text-white">Cobrás con Mercado Pago</div>
                <div className="text-[12px] sm:text-[13px] text-white/80">Acreditación protegida</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Descargar app (integración existente) */}
      <InstalarApp />

      {/* ===== FOOTER ===== */}
      <footer className="bg-ml-dark text-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-14 pb-7 grid grid-cols-2 md:grid-cols-[1.6fr_1fr_1fr_1fr] gap-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 ml-grad rounded-[10px] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
              </span>
              <span className="font-display font-extrabold text-lg text-white">MercadoLocal</span>
            </div>
            <p className="text-sm leading-relaxed text-white/60 max-w-[300px]">El marketplace que pone a competir a tu ciudad. Comprá y vendé cerca tuyo, al mejor precio.</p>
          </div>
          <div>
            <div className="font-display font-bold text-sm mb-3.5">Comprar</div>
            <div className="flex flex-col gap-2.5 text-[13.5px] text-white/60">
              <Link to="/catalogo" className="mllink">Categorías</Link>
              <Link to="/usados" className="mllink">Usados</Link>
              <Link to="/ofertas" className="mllink">Ofertas</Link>
              <Link to="/mas-vendidos" className="mllink">Más vendidos</Link>
            </div>
          </div>
          <div>
            <div className="font-display font-bold text-sm mb-3.5">Vender</div>
            <div className="flex flex-col gap-2.5 text-[13.5px] text-white/60">
              <Link to="/registro?rol=vendedor" className="mllink">Creá tu tienda</Link>
              <Link to="/ayuda" className="mllink">Cómo vender</Link>
              <Link to="/ayuda" className="mllink">Mercado Pago</Link>
              <Link to="/ayuda" className="mllink">Comisiones</Link>
            </div>
          </div>
          <div>
            <div className="font-display font-bold text-sm mb-3.5">Ayuda</div>
            <div className="flex flex-col gap-2.5 text-[13.5px] text-white/60">
              <Link to="/ayuda" className="mllink">Centro de ayuda</Link>
              <Link to="/devoluciones" className="mllink">Devoluciones</Link>
              <Link to="/libro-de-quejas" className="mllink">Libro de Quejas</Link>
              <Link to="/mis-ordenes" className="mllink">Botón de Arrepentimiento</Link>
              <Link to="/terminos" className="mllink">Términos</Link>
              <Link to="/privacidad" className="mllink">Privacidad</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[12.5px] text-white/50">
            <span>© {new Date().getFullYear()} MercadoLocal · Comprá y vendé en tu ciudad</span>
            <span className="flex gap-4">
              <Link to="/terminos" className="mllink">Términos</Link>
              <Link to="/privacidad" className="mllink">Privacidad</Link>
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
