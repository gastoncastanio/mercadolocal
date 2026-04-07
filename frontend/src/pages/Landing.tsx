import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Producto } from '../types'
import TarjetaProducto from '../components/TarjetaProducto'
import BannersRotativos from '../components/BannersRotativos'
import EspaciosPublicitarios from '../components/EspaciosPublicitarios'

const CATEGORIAS = [
  { nombre: 'Tecnolog\u00eda', icon: '\u{1F4F1}', slug: 'tecnologia' },
  { nombre: 'Hogar', icon: '\u{1F6CB}\uFE0F', slug: 'hogar' },
  { nombre: 'Moda', icon: '\u{1F455}', slug: 'moda' },
  { nombre: 'Deportes', icon: '\u26BD', slug: 'deportes' },
  { nombre: 'Belleza', icon: '\u{1F484}', slug: 'belleza' },
  { nombre: 'Juguetes', icon: '\u{1F9F8}', slug: 'juguetes' },
  { nombre: 'Libros', icon: '\u{1F4DA}', slug: 'libros' },
  { nombre: 'Autos', icon: '\u{1F697}', slug: 'autos' }
]

export default function Landing() {
  const { estaLogueado } = useAuth()
  const [destacados, setDestacados] = useState<Producto[]>([])
  const [masVendidos, setMasVendidos] = useState<Producto[]>([])

  useEffect(() => {
    cargar()
  }, [])

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

      {/* Hero banner */}
      <section className="bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-10 sm:py-12 md:py-16">
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-center">
            <div className="text-center md:text-left">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
                El marketplace de <span className="text-yellow-300">tu ciudad</span>
              </h1>
              <p className="text-base sm:text-lg text-blue-100 mb-6">
                Compr&aacute; y vend&eacute; productos locales con pago protegido. Todas las tiendas, un solo lugar.
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center md:justify-start">
                <Link to="/catalogo" className="px-6 py-3 bg-white text-blue-700 rounded-lg font-bold hover:shadow-xl transition-all">
                  Explorar cat&aacute;logo
                </Link>
                {!estaLogueado && (
                  <Link to="/registro?rol=vendedor" className="px-6 py-3 bg-blue-500/30 border-2 border-white text-white rounded-lg font-bold hover:bg-blue-500/50 transition-all">
                    Vender ahora
                  </Link>
                )}
              </div>
            </div>
            <div className="hidden md:flex justify-center text-9xl opacity-90">
              &#x1F6D2;
            </div>
          </div>
        </div>
      </section>

      {/* Categorías */}
      <section className="bg-white shadow-sm -mt-1">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-5 sm:py-6">
          <div className="grid grid-cols-4 md:grid-cols-8 gap-1 sm:gap-2">
            {CATEGORIAS.map(cat => (
              <Link
                key={cat.slug}
                to={`/catalogo?categoria=${cat.slug}`}
                className="flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-3 rounded-xl hover:bg-blue-50 transition-colors group"
              >
                <span className="text-2xl sm:text-3xl group-hover:scale-110 transition-transform">{cat.icon}</span>
                <span className="text-[11px] sm:text-xs text-gray-700 font-medium text-center leading-tight">{cat.nombre}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section className="max-w-7xl mx-auto px-3 sm:px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          {[
            { icon: '\u{1F6E1}\uFE0F', titulo: 'Pago protegido', desc: 'Retenemos el pago hasta que confirmes' },
            { icon: '\u{1F4CD}', titulo: '100% local', desc: 'Vendedores de tu ciudad' },
            { icon: '\u2705', titulo: 'Confirm\u00e1 y list\u00f3', desc: 'Aprob\u00e1s la entrega y liberamos' },
            { icon: '\u{1F4AC}', titulo: 'Soporte directo', desc: 'Chat con el vendedor' }
          ].map(b => (
            <div key={b.titulo} className="bg-white rounded-xl p-3 sm:p-4 shadow-sm flex items-center gap-2 sm:gap-3">
              <span className="text-2xl sm:text-3xl shrink-0">{b.icon}</span>
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 text-xs sm:text-sm leading-tight">{b.titulo}</p>
                <p className="text-[11px] sm:text-xs text-gray-500 leading-snug mt-0.5">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona - sistema escrow */}
      <section className="max-w-7xl mx-auto px-3 sm:px-4 py-8 sm:py-10">
        <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6 md:p-10">
          <div className="text-center mb-6 sm:mb-8">
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wide mb-3">
              Compra sin riesgo
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">&iquest;C&oacute;mo funciona MercadoLocal?</h2>
            <p className="text-sm sm:text-base text-gray-500 mt-2 max-w-2xl mx-auto">
              Somos el intermediario seguro entre comprador y vendedor. Tu plata est&aacute; protegida hasta que confirmes que todo est&aacute; bien.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 sm:gap-6">
            {[
              { n: 1, icon: '\u{1F4B3}', titulo: 'Pag\u00e1s tu compra', desc: 'El dinero queda retenido en MercadoLocal de forma segura.' },
              { n: 2, icon: '\u{1F4E6}', titulo: 'Recib\u00eds el producto', desc: 'El vendedor te env\u00eda el producto a tu direcci\u00f3n.' },
              { n: 3, icon: '\u2705', titulo: 'Confirm\u00e1s la entrega', desc: 'Revis\u00e1s que sea lo que esperabas y lo aprob\u00e1s.' },
              { n: 4, icon: '\u{1F4B0}', titulo: 'Se libera el pago', desc: 'A las 24hs de tu confirmaci\u00f3n, el vendedor cobra.' }
            ].map((paso, i) => (
              <div key={paso.n} className="relative">
                <div className="flex sm:flex-col items-center sm:text-center gap-4 sm:gap-0">
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center text-2xl sm:text-3xl sm:mb-3 shadow-lg">
                      {paso.icon}
                    </div>
                    <div className="absolute -top-2 -right-2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-yellow-400 text-gray-800 flex items-center justify-center font-bold text-xs sm:text-sm shadow">
                      {paso.n}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 sm:flex-none">
                    <h3 className="font-bold text-gray-800 mb-1 text-base sm:text-base">{paso.titulo}</h3>
                    <p className="text-xs sm:text-sm text-gray-500 leading-snug">{paso.desc}</p>
                  </div>
                </div>
                {i < 3 && (
                  <div className="hidden md:block absolute top-8 -right-3 text-gray-300 text-2xl">&rarr;</div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 sm:mt-8 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
            <span className="text-2xl shrink-0">&#x1F512;</span>
            <div className="min-w-0">
              <p className="font-semibold text-blue-900 text-sm">Tu dinero est&aacute; protegido</p>
              <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                Si el producto no llega o no coincide con lo publicado, pod&eacute;s abrir un reclamo antes de confirmar la entrega y te devolvemos el 100%.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Más vendidos */}
      {masVendidos.length > 0 && (
        <section className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span>&#x1F525;</span> Los m&aacute;s vendidos
            </h2>
            <Link to="/mas-vendidos" className="text-blue-600 hover:underline font-medium text-xs sm:text-sm">
              Ver todos &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {masVendidos.slice(0, 4).map(p => (
              <TarjetaProducto key={p._id} producto={p} />
            ))}
          </div>
        </section>
      )}

      {/* Destacados */}
      {destacados.length > 0 && (
        <section className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span>&#x2B50;</span> Destacados
            </h2>
            <Link to="/catalogo" className="text-blue-600 hover:underline font-medium text-xs sm:text-sm">
              Ver cat&aacute;logo &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {destacados.slice(0, 4).map(p => (
              <TarjetaProducto key={p._id} producto={p} />
            ))}
          </div>
        </section>
      )}

      {/* CTA vendedor */}
      {!estaLogueado && (
        <section className="max-w-7xl mx-auto px-3 sm:px-4 py-8 sm:py-10">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 sm:p-8 md:p-12 text-white">
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div className="text-center md:text-left">
                <h2 className="text-2xl sm:text-3xl font-bold mb-3">&iquest;Ten&eacute;s productos para vender?</h2>
                <p className="text-sm sm:text-base text-blue-100 mb-6">
                  Cre&aacute; tu tienda en menos de 5 minutos. Sin costo de apertura. Solo pag&aacute;s cuando vend&eacute;s.
                </p>
                <Link to="/registro?rol=vendedor" className="inline-block px-6 py-3 bg-white text-blue-700 rounded-lg font-bold hover:shadow-xl transition-all">
                  Crear mi tienda gratis
                </Link>
              </div>
              <div className="hidden md:flex justify-center text-9xl opacity-80">
                &#x1F3EA;
              </div>
            </div>
          </div>
        </section>
      )}

      <footer className="bg-gray-900 text-gray-400 py-10 mt-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <p className="text-lg font-bold text-white mb-2">&#x1F6D2; MercadoLocal</p>
            <p className="text-sm">El marketplace de tu ciudad</p>
            <div className="mt-4 flex flex-wrap justify-center gap-4 sm:gap-6 text-xs">
              <Link to="/terminos" className="hover:text-white">T&eacute;rminos y Condiciones</Link>
              <Link to="/privacidad" className="hover:text-white">Pol&iacute;tica de Privacidad</Link>
              <Link to="/devoluciones" className="hover:text-white">Pol&iacute;tica de Devoluciones</Link>
              <a href="mailto:soporte@mercadolocal.com.ar" className="hover:text-white">Contacto</a>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-800 text-[11px] leading-relaxed text-gray-500 max-w-4xl mx-auto text-center">
            <p className="mb-2">
              <strong className="text-gray-300">MercadoLocal</strong> es una plataforma intermediaria que facilita la conexi&oacute;n entre compradores y vendedores independientes.
              No somos propietarios, fabricantes, importadores ni distribuidores de los productos publicados.
              La responsabilidad por la veracidad, calidad, legalidad y entrega de los productos corresponde &uacute;nica y exclusivamente a cada vendedor.
            </p>
            <p className="mb-2">
              Los pagos son procesados por <strong className="text-gray-300">Mercado Pago</strong> bajo sus propios t&eacute;rminos y condiciones.
              Las operaciones se rigen por la Ley 24.240 de Defensa del Consumidor, la Ley 25.326 de Protecci&oacute;n de Datos Personales
              y la Ley 26.388 de Delitos Inform&aacute;ticos de la Rep&uacute;blica Argentina.
            </p>
            <p>&copy; {new Date().getFullYear()} MercadoLocal. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
