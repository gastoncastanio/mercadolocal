import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Producto } from '../types'
import TarjetaProducto from '../components/TarjetaProducto'
import BannersRotativos from '../components/BannersRotativos'
import EspaciosPublicitarios from '../components/EspaciosPublicitarios'

const CATEGORIAS = [
  { nombre: 'Tecnolog\u00eda', icon: '\u{1F4F1}', slug: 'tecnologia', color: 'from-blue-500 to-indigo-600' },
  { nombre: 'Hogar', icon: '\u{1F6CB}\uFE0F', slug: 'hogar', color: 'from-amber-400 to-orange-500' },
  { nombre: 'Moda', icon: '\u{1F455}', slug: 'moda', color: 'from-pink-500 to-rose-600' },
  { nombre: 'Deportes', icon: '\u26BD', slug: 'deportes', color: 'from-green-500 to-emerald-600' },
  { nombre: 'Belleza', icon: '\u{1F484}', slug: 'belleza', color: 'from-fuchsia-500 to-purple-600' },
  { nombre: 'Juguetes', icon: '\u{1F9F8}', slug: 'juguetes', color: 'from-yellow-400 to-amber-500' },
  { nombre: 'Libros', icon: '\u{1F4DA}', slug: 'libros', color: 'from-teal-500 to-cyan-600' },
  { nombre: 'Autos', icon: '\u{1F697}', slug: 'autos', color: 'from-slate-500 to-gray-700' }
]

const TESTIMONIOS = [
  { nombre: 'Camila R.', ciudad: 'C\u00f3rdoba', texto: 'Vend\u00ed m\u00e1s de 50 productos en el primer mes. La plataforma es s\u00faper intuitiva y el pago cae directo.', rol: 'Vendedora' },
  { nombre: 'Mart\u00edn L.', ciudad: 'Rosario', texto: 'Compr\u00e9 un celular y lleg\u00f3 perfecto. Me gusta que la plata queda retenida hasta que confirmo.', rol: 'Comprador' },
  { nombre: 'Luc\u00eda G.', ciudad: 'Buenos Aires', texto: 'Abr\u00ed mi tienda de ropa vintage y ya tengo clientes fieles. Cero complicaciones.', rol: 'Vendedora' }
]

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

function AnimatedCounter({ end, suffix = '' }: { end: number; suffix?: string }) {
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
  return <span ref={ref as any}>{count.toLocaleString('es-AR')}{suffix}</span>
}

export default function Landing() {
  const { estaLogueado } = useAuth()
  const [destacados, setDestacados] = useState<Producto[]>([])
  const [masVendidos, setMasVendidos] = useState<Producto[]>([])
  const hero = useInView(0.2)
  const beneficios = useInView(0.15)
  const escrow = useInView(0.1)
  const cats = useInView(0.15)
  const testimonios = useInView(0.15)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      const [d, mv] = await Promise.all([
        api.get('/productos?ordenar=calificacion&limite=8'),
        api.get('/productos?ordenar=ventas&limite=8')
      ])
      setDestacados(d.data)
      setMasVendidos(mv.data)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banners rotativos */}
      <BannersRotativos />

      {/* Espacios publicitarios */}
      <EspaciosPublicitarios />

      {/* ========== PRUEBA SOCIAL ========== */}
      <section className="max-w-7xl mx-auto px-3 sm:px-4 mt-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center">
            {[
              { valor: 1200, sufijo: '+', label: 'Productos publicados', icon: '\u{1F4E6}' },
              { valor: 350, sufijo: '+', label: 'Vendedores activos', icon: '\u{1F3EA}' },
              { valor: 2800, sufijo: '+', label: 'Compras realizadas', icon: '\u{1F6D2}' },
              { valor: 98, sufijo: '%', label: 'Compradores satisfechos', icon: '\u2B50' }
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center">
                <span className="text-2xl mb-1">{stat.icon}</span>
                <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                  <AnimatedCounter end={stat.valor} suffix={stat.sufijo} />
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== HERO PRINCIPAL ========== */}
      <section
        ref={hero.ref as any}
        className="relative mt-8 sm:mt-10 mx-3 sm:mx-4 md:mx-6 rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Fondo con gradiente animado */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 animate-gradient" />

        {/* Patron decorativo */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-20">
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-center">
            {/* Texto */}
            <div
              className="text-center md:text-left transition-all duration-1000 ease-out"
              style={{
                transform: hero.visible ? 'translateX(0)' : 'translateX(-60px)',
                opacity: hero.visible ? 1 : 0
              }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-full text-sm text-white/90 mb-4">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                +350 vendedores ya venden ac&aacute;
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.4rem] font-extrabold text-white mb-4 leading-[1.1] tracking-tight">
                Lo que busc&aacute;s est&aacute; cerca.
                <span className="block text-yellow-300 mt-1">Compralo seguro.</span>
              </h1>

              <p className="text-base sm:text-lg text-blue-100 mb-6 max-w-lg mx-auto md:mx-0 leading-relaxed">
                El marketplace que conecta compradores y vendedores de tu ciudad. Pago protegido, env&iacute;os locales, y cero riesgo.
              </p>

              <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center md:justify-start">
                <Link
                  to="/catalogo"
                  className="px-7 py-3.5 bg-yellow-400 text-gray-900 rounded-xl font-bold text-base hover:bg-yellow-300 hover:shadow-xl hover:scale-[1.03] transition-all pulse-glow"
                >
                  Explorar productos
                </Link>
                {!estaLogueado && (
                  <Link
                    to="/registro?rol=vendedor"
                    className="px-7 py-3.5 bg-white/10 backdrop-blur-sm border-2 border-white/40 text-white rounded-xl font-bold text-base hover:bg-white/20 hover:scale-[1.03] transition-all"
                  >
                    Crear mi tienda gratis
                  </Link>
                )}
              </div>

              {/* Trust badges inline */}
              <div className="flex flex-wrap items-center gap-4 mt-6 justify-center md:justify-start text-white/70 text-xs">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                  Pago protegido
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                  100% local
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                  Env&iacute;o a todo el pa&iacute;s
                </span>
              </div>
            </div>

            {/* Ilustracion derecha */}
            <div
              className="hidden md:flex flex-col items-center justify-center transition-all duration-1000 ease-out delay-200"
              style={{
                transform: hero.visible ? 'translateX(0) scale(1)' : 'translateX(80px) scale(0.9)',
                opacity: hero.visible ? 1 : 0
              }}
            >
              <div className="relative">
                <div className="w-48 h-48 lg:w-56 lg:h-56 rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center animate-float">
                  <span className="text-8xl lg:text-9xl drop-shadow-xl">&#x1F6D2;</span>
                </div>
                {/* Badges flotantes */}
                <div className="absolute -top-3 -right-3 bg-green-400 text-green-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg animate-float" style={{ animationDelay: '0.5s' }}>
                  Pago seguro &#x2705;
                </div>
                <div className="absolute -bottom-2 -left-4 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg animate-float" style={{ animationDelay: '1s' }}>
                  Env&iacute;o gratis &#x1F69A;
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== CATEGORIAS ========== */}
      <section ref={cats.ref as any} className="max-w-7xl mx-auto px-3 sm:px-4 mt-8 sm:mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">Explor&aacute; por categor&iacute;a</h2>
          <Link to="/catalogo" className="text-blue-600 hover:underline text-xs sm:text-sm font-medium">Ver todas &rarr;</Link>
        </div>
        <div
          className={`grid grid-cols-4 md:grid-cols-8 gap-2 sm:gap-3 ${cats.visible ? 'stagger-in' : ''}`}
        >
          {CATEGORIAS.map(cat => (
            <Link
              key={cat.slug}
              to={`/catalogo?categoria=${cat.slug}`}
              className="group flex flex-col items-center gap-2 p-3 sm:p-4 rounded-2xl bg-white border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all"
            >
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center text-2xl sm:text-3xl shadow-sm group-hover:scale-110 group-hover:shadow-md transition-all`}>
                {cat.icon}
              </div>
              <span className="text-[11px] sm:text-xs text-gray-700 font-medium text-center leading-tight">{cat.nombre}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ========== BENEFICIOS ========== */}
      <section ref={beneficios.ref as any} className="max-w-7xl mx-auto px-3 sm:px-4 mt-8 sm:mt-10">
        <div
          className={`grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 ${beneficios.visible ? 'stagger-in' : ''}`}
        >
          {[
            {
              icon: (
                <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              ),
              titulo: 'Pago protegido',
              desc: 'Tu dinero queda retenido hasta que confirmes la entrega',
              color: 'bg-blue-50 border-blue-100'
            },
            {
              icon: (
                <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              ),
              titulo: '100% local',
              desc: 'Vendedores reales de tu ciudad, cerca tuyo',
              color: 'bg-emerald-50 border-emerald-100'
            },
            {
              icon: (
                <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
              ),
              titulo: 'Confirm\u00e1 y listo',
              desc: 'Revis\u00e1s el producto, aprob\u00e1s y se libera el pago',
              color: 'bg-purple-50 border-purple-100'
            },
            {
              icon: (
                <svg className="w-7 h-7 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              ),
              titulo: 'Soporte directo',
              desc: 'Chat directo con el vendedor y asistencia 24/7',
              color: 'bg-orange-50 border-orange-100'
            }
          ].map(b => (
            <div key={b.titulo} className={`${b.color} border rounded-2xl p-4 sm:p-5 hover-lift`}>
              <div className="mb-3">{b.icon}</div>
              <p className="font-bold text-gray-800 text-sm sm:text-base mb-1">{b.titulo}</p>
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ========== COMO FUNCIONA - ESCROW ========== */}
      <section ref={escrow.ref as any} className="max-w-7xl mx-auto px-3 sm:px-4 py-10 sm:py-14">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8 md:p-12">
          <div className="text-center mb-8 sm:mb-10">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wide mb-3">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
              Compra sin riesgo
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">&iquest;C&oacute;mo funciona MercadoLocal?</h2>
            <p className="text-sm sm:text-base text-gray-500 mt-3 max-w-2xl mx-auto leading-relaxed">
              Tu plata est&aacute; protegida en cada paso. No le pagamos al vendedor hasta que confirmes que todo est&aacute; bien.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-4 relative">
            {/* Linea conectora (solo desktop) */}
            <div className="hidden md:block absolute top-10 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200" />

            {[
              { n: 1, icon: '\u{1F4B3}', titulo: 'Pag\u00e1s tu compra', desc: 'El dinero queda retenido en MercadoLocal de forma segura. El vendedor no lo recibe a\u00fan.', color: 'from-blue-500 to-blue-600' },
              { n: 2, icon: '\u{1F4E6}', titulo: 'Recib\u00eds el producto', desc: 'El vendedor prepara y te env\u00eda el producto a tu direcci\u00f3n. Segu\u00ed el estado desde "Mis pedidos".', color: 'from-indigo-500 to-indigo-600' },
              { n: 3, icon: '\u2705', titulo: 'Confirm\u00e1s la entrega', desc: 'Revis\u00e1s que sea lo que esperabas. Si algo no est\u00e1 bien, abr\u00eds un reclamo.', color: 'from-purple-500 to-purple-600' },
              { n: 4, icon: '\u{1F4B0}', titulo: 'Se libera el pago', desc: 'A las 24hs de tu confirmaci\u00f3n, el vendedor recibe el dinero en su Mercado Pago.', color: 'from-green-500 to-emerald-600' }
            ].map((paso) => (
              <div
                key={paso.n}
                className="relative text-center transition-all duration-700 ease-out"
                style={{
                  transform: escrow.visible ? 'translateY(0)' : 'translateY(20px)',
                  opacity: escrow.visible ? 1 : 0,
                  transitionDelay: `${paso.n * 150}ms`
                }}
              >
                <div className="relative inline-flex mb-4">
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br ${paso.color} text-white flex items-center justify-center text-3xl sm:text-4xl shadow-lg`}>
                    {paso.icon}
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-yellow-400 text-gray-900 flex items-center justify-center font-extrabold text-sm shadow-md ring-2 ring-white">
                    {paso.n}
                  </div>
                </div>
                <h3 className="font-bold text-gray-900 text-base sm:text-lg mb-2">{paso.titulo}</h3>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed max-w-[220px] mx-auto">{paso.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 sm:mt-10 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl shrink-0">&#x1F512;</div>
            <div>
              <p className="font-bold text-blue-900 text-sm sm:text-base">Tu dinero est&aacute; protegido al 100%</p>
              <p className="text-xs sm:text-sm text-blue-700 mt-1 leading-relaxed">
                Si el producto no llega, no coincide con lo publicado o tiene alg&uacute;n defecto, pod&eacute;s abrir un reclamo antes de confirmar la entrega y te devolvemos el total. Sin excusas, sin demoras.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== MAS VENDIDOS ========== */}
      {masVendidos.length > 0 && (
        <section className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 flex items-center gap-2">
                <span>&#x1F525;</span> Los m&aacute;s vendidos
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">Lo que m&aacute;s eligen los compradores esta semana</p>
            </div>
            <Link to="/mas-vendidos" className="text-blue-600 hover:text-blue-700 font-semibold text-xs sm:text-sm flex items-center gap-1">
              Ver todos
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {masVendidos.slice(0, 4).map(p => (
              <TarjetaProducto key={p._id} producto={p} />
            ))}
          </div>
        </section>
      )}

      {/* ========== DESTACADOS ========== */}
      {destacados.length > 0 && (
        <section className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 flex items-center gap-2">
                <span>&#x2B50;</span> Mejor calificados
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">Los productos con mejores rese&ntilde;as de la comunidad</p>
            </div>
            <Link to="/catalogo" className="text-blue-600 hover:text-blue-700 font-semibold text-xs sm:text-sm flex items-center gap-1">
              Ver cat&aacute;logo
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {destacados.slice(0, 4).map(p => (
              <TarjetaProducto key={p._id} producto={p} />
            ))}
          </div>
        </section>
      )}

      {/* ========== TESTIMONIOS ========== */}
      <section ref={testimonios.ref as any} className="max-w-7xl mx-auto px-3 sm:px-4 py-8 sm:py-10">
        <div className="text-center mb-6">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900">Lo que dicen nuestros usuarios</h2>
          <p className="text-sm text-gray-500 mt-1">Historias reales de compradores y vendedores</p>
        </div>
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${testimonios.visible ? 'stagger-in' : ''}`}>
          {TESTIMONIOS.map((t, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 hover-lift">
              {/* Estrellas */}
              <div className="flex gap-0.5 mb-3">
                {[1,2,3,4,5].map(s => (
                  <svg key={s} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                ))}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed mb-4 italic">&ldquo;{t.texto}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                  {t.nombre.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{t.nombre}</p>
                  <p className="text-xs text-gray-500">{t.rol} &middot; {t.ciudad}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========== CTA VENDEDOR ========== */}
      {!estaLogueado && (
        <section className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-3xl p-6 sm:p-8 md:p-12 text-white">
            {/* Patron decorativo */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '24px 24px'
            }} />

            <div className="relative grid md:grid-cols-2 gap-6 items-center">
              <div className="text-center md:text-left">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-3 leading-tight">
                  &iquest;Ten&eacute;s productos para vender?
                </h2>
                <p className="text-base sm:text-lg text-blue-100 mb-4 leading-relaxed">
                  Cre&aacute; tu tienda en menos de 5 minutos. Sin costo de apertura. Solo pag&aacute;s una comisi&oacute;n del 10% cuando vend&eacute;s.
                </p>
                <ul className="flex flex-col gap-2 mb-6 text-sm text-blue-100">
                  {['Publicaciones ilimitadas', 'Cobr&aacute;s directo en tu Mercado Pago', 'Panel de vendedor con m&eacute;tricas'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2" dangerouslySetInnerHTML={{
                      __html: `<svg class="w-5 h-5 text-green-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg><span>${item}</span>`
                    }} />
                  ))}
                </ul>
                <Link
                  to="/registro?rol=vendedor"
                  className="inline-block px-8 py-4 bg-yellow-400 text-gray-900 rounded-xl font-extrabold text-lg hover:bg-yellow-300 hover:shadow-xl hover:scale-[1.03] transition-all pulse-glow"
                >
                  Crear mi tienda gratis &rarr;
                </Link>
              </div>
              <div className="hidden md:flex justify-center">
                <div className="w-40 h-40 lg:w-48 lg:h-48 rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center animate-float">
                  <span className="text-8xl lg:text-9xl drop-shadow-xl">&#x1F3EA;</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========== BANNER COMUNIDAD ========== */}
      <section className="max-w-7xl mx-auto px-3 sm:px-4 py-6">
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-6 sm:p-8 text-center">
          <span className="text-4xl mb-3 block">&#x1F91D;</span>
          <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 mb-2">Cada compra fortalece tu comunidad</h3>
          <p className="text-sm text-gray-600 max-w-xl mx-auto leading-relaxed">
            Cuando compr&aacute;s en MercadoLocal, apoy&aacute;s a emprendedores y comerciantes de tu ciudad. Cada transacci&oacute;n es un voto por la econom&iacute;a local.
          </p>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="bg-gray-900 text-gray-400 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-10 sm:py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            {/* Columna 1 - Marca */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">&#x1F6D2;</span>
                <span className="text-xl font-bold text-white">MercadoLocal</span>
              </div>
              <p className="text-sm leading-relaxed">El marketplace que conecta compradores y vendedores de tu ciudad.</p>
            </div>

            {/* Columna 2 - Compradores */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-3">Compradores</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/catalogo" className="hover:text-white transition-colors">Cat&aacute;logo</Link></li>
                <li><Link to="/mas-vendidos" className="hover:text-white transition-colors">M&aacute;s vendidos</Link></li>
                <li><Link to="/ayuda" className="hover:text-white transition-colors">Centro de ayuda</Link></li>
                <li><Link to="/devoluciones" className="hover:text-white transition-colors">Devoluciones</Link></li>
              </ul>
            </div>

            {/* Columna 3 - Vendedores */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-3">Vendedores</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/registro?rol=vendedor" className="hover:text-white transition-colors">Crear tienda</Link></li>
                <li><Link to="/ayuda" className="hover:text-white transition-colors">Gu&iacute;a para vendedores</Link></li>
                <li><Link to="/ayuda" className="hover:text-white transition-colors">Comisiones</Link></li>
                <li><Link to="/ayuda" className="hover:text-white transition-colors">Mercado Pago</Link></li>
              </ul>
            </div>

            {/* Columna 4 - Legal */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-3">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/terminos" className="hover:text-white transition-colors">T&eacute;rminos y Condiciones</Link></li>
                <li><Link to="/privacidad" className="hover:text-white transition-colors">Pol&iacute;tica de Privacidad</Link></li>
                <li><Link to="/devoluciones" className="hover:text-white transition-colors">Pol&iacute;tica de Devoluciones</Link></li>
                <li><a href="mailto:soporte@mercadolocal.com.ar" className="hover:text-white transition-colors">Contacto</a></li>
              </ul>
            </div>
          </div>

          {/* Separador */}
          <div className="border-t border-gray-800 pt-6">
            <div className="text-[11px] leading-relaxed text-gray-500 max-w-4xl mx-auto text-center">
              <p className="mb-2">
                <strong className="text-gray-300">MercadoLocal</strong> es una plataforma intermediaria que facilita la conexi&oacute;n entre compradores y vendedores independientes.
                No somos propietarios, fabricantes, importadores ni distribuidores de los productos publicados.
                La responsabilidad sobre los productos corresponde a cada vendedor.
              </p>
              <p className="mb-2">
                Los pagos son procesados por <strong className="text-gray-300">Mercado Pago</strong> bajo sus propios t&eacute;rminos.
                Las operaciones se rigen por la Ley 24.240 de Defensa del Consumidor y la Ley 25.326 de Protecci&oacute;n de Datos Personales.
              </p>
              <p className="text-gray-600">&copy; {new Date().getFullYear()} MercadoLocal. Todos los derechos reservados.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
