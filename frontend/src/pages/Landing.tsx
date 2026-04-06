import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Landing() {
  const { estaLogueado } = useAuth()

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold mb-6">
            🛒 MercadoLocal
          </h1>
          <p className="text-xl md:text-2xl text-blue-100 mb-4 max-w-3xl mx-auto">
            El marketplace de tu ciudad. Compra y vende productos locales sin intermediarios.
          </p>
          <p className="text-lg text-blue-200 mb-10 max-w-2xl mx-auto">
            Conectamos emprendedores y tiendas locales con compradores de tu zona.
            Todas las tiendas, un solo lugar.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {!estaLogueado ? (
              <>
                <Link
                  to="/registro?rol=vendedor"
                  className="px-8 py-4 bg-white text-blue-600 rounded-xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all"
                >
                  Quiero Vender
                </Link>
                <Link
                  to="/registro?rol=comprador"
                  className="px-8 py-4 bg-blue-500 bg-opacity-30 border-2 border-white text-white rounded-xl font-bold text-lg hover:bg-opacity-50 transition-all"
                >
                  Quiero Comprar
                </Link>
              </>
            ) : (
              <Link
                to="/catalogo"
                className="px-8 py-4 bg-white text-blue-600 rounded-xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all"
              >
                Ver Catálogo
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Estadísticas */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-3xl font-bold text-blue-600">10%</p>
            <p className="text-gray-500 mt-1">Comisión justa</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-purple-600">24/7</p>
            <p className="text-gray-500 mt-1">Siempre abierto</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-green-600">Local</p>
            <p className="text-gray-500 mt-1">De tu ciudad</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-orange-600">Gratis</p>
            <p className="text-gray-500 mt-1">Crear tu tienda</p>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
            ¿Cómo funciona?
          </h2>
          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
              <h3 className="text-xl font-bold text-blue-600 mb-6 flex items-center gap-2">🏪 Para Vendedores</h3>
              <div className="space-y-4">
                {[
                  { paso: '1', titulo: 'Crea tu cuenta', desc: 'Regístrate como vendedor gratis' },
                  { paso: '2', titulo: 'Arma tu tienda', desc: 'Personaliza nombre, logo y descripción' },
                  { paso: '3', titulo: 'Publica productos', desc: 'Sube fotos, precios y descripciones' },
                  { paso: '4', titulo: 'Recibe pedidos', desc: 'Los compradores te encuentran y compran' },
                ].map(item => (
                  <div key={item.paso} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0">{item.paso}</div>
                    <div>
                      <p className="font-semibold text-gray-800">{item.titulo}</p>
                      <p className="text-sm text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
              <h3 className="text-xl font-bold text-purple-600 mb-6 flex items-center gap-2">🛍️ Para Compradores</h3>
              <div className="space-y-4">
                {[
                  { paso: '1', titulo: 'Explora el catálogo', desc: 'Ve todos los productos disponibles' },
                  { paso: '2', titulo: 'Agrega al carrito', desc: 'Selecciona lo que quieras comprar' },
                  { paso: '3', titulo: 'Haz tu pedido', desc: 'Ingresa tu dirección de entrega' },
                  { paso: '4', titulo: 'Recibe tu compra', desc: 'El vendedor te envía el producto' },
                ].map(item => (
                  <div key={item.paso} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm flex-shrink-0">{item.paso}</div>
                    <div>
                      <p className="font-semibold text-gray-800">{item.titulo}</p>
                      <p className="text-sm text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">Empieza a vender hoy mismo</h2>
          <p className="text-blue-100 mb-8 text-lg">Crea tu tienda en menos de 5 minutos. Sin costo de apertura. Solo pagas cuando vendes.</p>
          <Link to="/registro?rol=vendedor" className="inline-block px-8 py-4 bg-white text-blue-600 rounded-xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all">
            Crear Mi Tienda Gratis
          </Link>
        </div>
      </section>

      <footer className="bg-gray-900 text-gray-400 py-10">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-lg font-bold text-white mb-2">🛒 MercadoLocal</p>
          <p className="text-sm">El marketplace de tu ciudad</p>
        </div>
      </footer>
    </div>
  )
}
