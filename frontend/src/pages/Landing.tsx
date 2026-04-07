import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Producto } from '../types'
import TarjetaProducto from '../components/TarjetaProducto'

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
      {/* Hero banner */}
      <section className="bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
                El marketplace de <span className="text-yellow-300">tu ciudad</span>
              </h1>
              <p className="text-lg text-blue-100 mb-6">
                Compr&aacute; y vend&eacute; productos locales sin intermediarios. Todas las tiendas, un solo lugar.
              </p>
              <div className="flex flex-wrap gap-3">
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
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {CATEGORIAS.map(cat => (
              <Link
                key={cat.slug}
                to={`/catalogo?categoria=${cat.slug}`}
                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-blue-50 transition-colors group"
              >
                <span className="text-3xl group-hover:scale-110 transition-transform">{cat.icon}</span>
                <span className="text-xs text-gray-700 font-medium text-center">{cat.nombre}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: '\u{1F69A}', titulo: 'Env\u00edo r\u00e1pido', desc: 'Entregas en tu ciudad' },
            { icon: '\u{1F512}', titulo: 'Compra segura', desc: 'Pagos protegidos' },
            { icon: '\u{1F504}', titulo: 'Devoluci\u00f3n', desc: 'Hasta 7 d\u00edas' },
            { icon: '\u{1F4AC}', titulo: 'Soporte', desc: 'Atenci\u00f3n al cliente' }
          ].map(b => (
            <div key={b.titulo} className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3">
              <span className="text-3xl">{b.icon}</span>
              <div>
                <p className="font-semibold text-gray-800 text-sm">{b.titulo}</p>
                <p className="text-xs text-gray-500">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Más vendidos */}
      {masVendidos.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span>&#x1F525;</span> Los m&aacute;s vendidos
            </h2>
            <Link to="/mas-vendidos" className="text-blue-600 hover:underline font-medium text-sm">
              Ver todos &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {masVendidos.slice(0, 4).map(p => (
              <TarjetaProducto key={p._id} producto={p} />
            ))}
          </div>
        </section>
      )}

      {/* Destacados */}
      {destacados.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span>&#x2B50;</span> Destacados
            </h2>
            <Link to="/catalogo" className="text-blue-600 hover:underline font-medium text-sm">
              Ver cat&aacute;logo &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {destacados.slice(0, 4).map(p => (
              <TarjetaProducto key={p._id} producto={p} />
            ))}
          </div>
        </section>
      )}

      {/* CTA vendedor */}
      {!estaLogueado && (
        <section className="max-w-7xl mx-auto px-4 py-10">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 md:p-12 text-white">
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-3">&iquest;Ten&eacute;s productos para vender?</h2>
                <p className="text-blue-100 mb-6">
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
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-lg font-bold text-white mb-2">&#x1F6D2; MercadoLocal</p>
          <p className="text-sm">El marketplace de tu ciudad</p>
          <div className="mt-4 flex justify-center gap-6 text-xs">
            <Link to="/terminos" className="hover:text-white">T&eacute;rminos</Link>
            <Link to="/privacidad" className="hover:text-white">Privacidad</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
