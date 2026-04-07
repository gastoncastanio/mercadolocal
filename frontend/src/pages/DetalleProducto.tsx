import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../services/api'
import { Producto, Tienda } from '../types'
import { useAuth } from '../context/AuthContext'
import Resenas from '../components/Resenas'
import BotonCompartir from '../components/BotonCompartir'
import TarjetaProducto from '../components/TarjetaProducto'
import CalculadoraCuotas from '../components/CalculadoraCuotas'

export default function DetalleProducto() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { estaLogueado } = useAuth()
  const [producto, setProducto] = useState<Producto | null>(null)
  const [cantidad, setCantidad] = useState(1)
  const [agregando, setAgregando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [imagenActual, setImagenActual] = useState(0)
  const [esFavorito, setEsFavorito] = useState(false)
  const [togglingFav, setTogglingFav] = useState(false)
  const [productosTienda, setProductosTienda] = useState<Producto[]>([])

  useEffect(() => {
    cargarProducto()
    if (estaLogueado) chequearFavorito()
  }, [id, estaLogueado])

  useEffect(() => {
    if (producto && typeof producto.tiendaId === 'object') {
      cargarProductosTienda((producto.tiendaId as Tienda)._id)
    }
  }, [producto])

  async function cargarProductosTienda(tiendaId: string) {
    try {
      const res = await api.get(`/productos?tiendaId=${tiendaId}&limite=8`)
      setProductosTienda(res.data.filter((p: Producto) => p._id !== id))
    } catch {}
  }

  async function chequearFavorito() {
    try {
      const res = await api.get('/favoritos/ids')
      setEsFavorito(res.data.includes(id))
    } catch {}
  }

  async function toggleFavorito() {
    if (!estaLogueado) {
      navigate('/login')
      return
    }
    setTogglingFav(true)
    try {
      if (esFavorito) {
        await api.delete(`/favoritos/${id}`)
        setEsFavorito(false)
      } else {
        await api.post(`/favoritos/${id}`)
        setEsFavorito(true)
      }
    } catch (err: any) {
      console.error('Error favorito:', err)
    } finally {
      setTogglingFav(false)
    }
  }

  async function cargarProducto() {
    try {
      const res = await api.get(`/productos/${id}`)
      setProducto(res.data)
    } catch (error) {
      console.error('Error cargando producto:', error)
    }
  }

  async function agregarAlCarrito() {
    if (!estaLogueado) {
      navigate('/login')
      return
    }

    setAgregando(true)
    try {
      await api.post('/carrito', { productoId: producto?._id, cantidad })
      setMensaje('Agregado al carrito')
      setTimeout(() => setMensaje(''), 3000)
    } catch (err: any) {
      setMensaje(err.response?.data?.error || 'Error al agregar')
    } finally {
      setAgregando(false)
    }
  }

  if (!producto) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin text-4xl">&#x1F504;</div>
      </div>
    )
  }

  const tienda = producto.tiendaId as Tienda

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline mb-6 inline-block">
          &larr; Volver al cat&aacute;logo
        </button>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="grid md:grid-cols-2 gap-0">
            {/* Imagen */}
            <div className="aspect-square bg-gray-100 relative">
              {producto.imagenes && producto.imagenes.length > 0 ? (
                <>
                  <img src={producto.imagenes[imagenActual]} alt={producto.nombre} className="w-full h-full object-cover" />
                  {producto.imagenes.length > 1 && (
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                      {producto.imagenes.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setImagenActual(i)}
                          className={`w-3 h-3 rounded-full transition-colors ${i === imagenActual ? 'bg-blue-600' : 'bg-white/70 hover:bg-white'}`}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
                  <span className="text-8xl">&#x1F4E6;</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-5 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-2 gap-2">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex-1">{producto.nombre}</h1>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={toggleFavorito}
                      disabled={togglingFav}
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
                      aria-label={esFavorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                      title={esFavorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                    >
                      <span className="text-2xl">{esFavorito ? '\u2764\uFE0F' : '\u2661'}</span>
                    </button>
                    <BotonCompartir producto={producto} />
                  </div>
                </div>

                {tienda && typeof tienda === 'object' && (
                  <Link
                    to={`/tienda/${tienda._id}`}
                    className="flex items-center gap-3 p-3 mb-4 bg-gray-50 hover:bg-blue-50 rounded-xl border border-gray-100 transition-colors group"
                  >
                    {tienda.logo ? (
                      <img src={tienda.logo} alt={tienda.nombre} className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center text-2xl shrink-0">
                        &#x1F3EA;
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate group-hover:text-blue-600">{tienda.nombre}</p>
                      <p className="text-xs text-gray-500">&#x1F4CD; {tienda.ciudad}</p>
                      {(tienda.calificacion ?? 0) > 0 && (
                        <div className="flex items-center gap-1 text-xs mt-0.5">
                          <span className="text-yellow-500">&#x2B50;</span>
                          <span className="font-medium text-gray-700">{(tienda.calificacion ?? 0).toFixed(1)}</span>
                          {(tienda.totalVentas ?? 0) > 0 && (
                            <span className="text-gray-400">&middot; {tienda.totalVentas} ventas</span>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-blue-600 text-sm font-medium shrink-0 hidden sm:block">Ver tienda &rarr;</span>
                  </Link>
                )}

                <div className="flex items-center gap-3 mb-6">
                  <p className="text-4xl font-bold text-blue-600">
                    ${producto.precio.toLocaleString()}
                  </p>
                  {producto.calificacion > 0 && (
                    <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1 rounded-full">
                      <span className="text-yellow-500">&#x2B50;</span>
                      <span className="font-semibold text-yellow-700">{producto.calificacion.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                <div className="mb-6">
                  <CalculadoraCuotas precio={producto.precio} />
                </div>

                <p className="text-gray-600 mb-6 leading-relaxed">
                  {producto.descripcion || 'Sin descripci\u00f3n'}
                </p>

                {producto.categorias && producto.categorias.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {producto.categorias.map(cat => (
                      <span key={cat} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                        {cat}
                      </span>
                    ))}
                  </div>
                )}

                <p className={`text-sm mb-6 ${producto.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {producto.stock > 0 ? `\u2705 ${producto.stock} disponibles` : '\u274C Agotado'}
                </p>
              </div>

              {/* Agregar al carrito */}
              {producto.stock > 0 && (
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <label className="text-sm font-medium text-gray-700">Cantidad:</label>
                    <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100"
                      >-</button>
                      <span className="px-4 py-2 font-semibold">{cantidad}</span>
                      <button
                        onClick={() => setCantidad(Math.min(producto.stock, cantidad + 1))}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100"
                      >+</button>
                    </div>
                  </div>

                  <button
                    onClick={agregarAlCarrito}
                    disabled={agregando}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {agregando ? 'Agregando...' : '\ud83d\uded2 Agregar al Carrito'}
                  </button>

                  {mensaje && (
                    <p className="text-center mt-3 text-sm font-medium text-green-600">{mensaje}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Más productos del mismo vendedor */}
        {productosTienda.length > 0 && tienda && typeof tienda === 'object' && (
          <div className="mt-8 bg-white rounded-2xl shadow-sm p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                M&aacute;s productos de {tienda.nombre}
              </h2>
              <Link to={`/tienda/${tienda._id}`} className="text-blue-600 hover:underline text-xs sm:text-sm font-medium shrink-0">
                Ver todos &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {productosTienda.slice(0, 4).map(p => (
                <TarjetaProducto key={p._id} producto={p} />
              ))}
            </div>
          </div>
        )}

        {/* Resenas */}
        <div className="mt-8">
          <Resenas productoId={producto._id} puedeResenar={false} />
        </div>
      </div>
    </div>
  )
}
