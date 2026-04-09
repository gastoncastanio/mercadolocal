import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../services/api'
import { Producto, Tienda } from '../types'
import { useAuth } from '../context/AuthContext'
import Resenas from '../components/Resenas'
import BotonCompartir from '../components/BotonCompartir'
import TarjetaProducto from '../components/TarjetaProducto'
import CalculadoraCuotas from '../components/CalculadoraCuotas'
import CotizadorEnvio from '../components/CotizadorEnvio'

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
    if (!estaLogueado) { navigate('/login'); return }
    setTogglingFav(true)
    try {
      if (esFavorito) {
        await api.delete(`/favoritos/${id}`)
        setEsFavorito(false)
      } else {
        await api.post(`/favoritos/${id}`)
        setEsFavorito(true)
      }
    } catch {} finally { setTogglingFav(false) }
  }

  async function cargarProducto() {
    try {
      const res = await api.get(`/productos/${id}`)
      setProducto(res.data)
    } catch { console.error('Error cargando producto') }
  }

  async function agregarAlCarrito() {
    if (!estaLogueado) { navigate('/login'); return }
    setAgregando(true)
    try {
      await api.post('/carrito', { productoId: producto?._id, cantidad })
      setMensaje('Agregado al carrito')
      setTimeout(() => setMensaje(''), 3000)
    } catch (err: any) {
      setMensaje(err.response?.data?.error || 'Error al agregar')
    } finally { setAgregando(false) }
  }

  if (!producto) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin text-4xl">&#x1F504;</div>
      </div>
    )
  }

  const tienda = producto.tiendaId as Tienda
  const condicionLabel: Record<string, string> = { nuevo: 'Nuevo', usado: 'Usado', reacondicionado: 'Reacondicionado' }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
          <Link to="/" className="hover:text-blue-600">Inicio</Link>
          <span>&rsaquo;</span>
          <Link to="/catalogo" className="hover:text-blue-600">Cat&aacute;logo</Link>
          {producto.categorias?.[0] && (
            <>
              <span>&rsaquo;</span>
              <Link to={`/catalogo?categoria=${producto.categorias[0]}`} className="hover:text-blue-600">{producto.categorias[0]}</Link>
            </>
          )}
        </div>

        {/* Main layout: 2 columnas en desktop */}
        <div className="grid lg:grid-cols-[1fr_380px] gap-4">
          {/* IZQUIERDA: imagen + info */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="grid md:grid-cols-2 gap-0">
                {/* Galer&iacute;a de im&aacute;genes */}
                <div className="relative">
                  <div className="aspect-square bg-gray-100 relative overflow-hidden">
                    {producto.imagenes?.length > 0 ? (
                      <img src={producto.imagenes[imagenActual]} alt={producto.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
                        <span className="text-8xl">&#x1F4E6;</span>
                      </div>
                    )}
                  </div>
                  {producto.imagenes?.length > 1 && (
                    <div className="flex gap-1.5 p-3 overflow-x-auto scrollbar-hide">
                      {producto.imagenes.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setImagenActual(i)}
                          className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-colors ${
                            i === imagenActual ? 'border-blue-500' : 'border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Info principal */}
                <div className="p-5 sm:p-6">
                  {/* Condici&oacute;n + ventas */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    <span className="px-2 py-0.5 bg-gray-100 rounded">{condicionLabel[producto.condicion || 'nuevo']}</span>
                    {producto.totalVentas > 0 && <span>| +{producto.totalVentas} vendidos</span>}
                  </div>

                  {/* T&iacute;tulo */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 leading-tight flex-1">{producto.nombre}</h1>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={toggleFavorito}
                        disabled={togglingFav}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
                      >
                        <span className="text-xl">{esFavorito ? '\u2764\uFE0F' : '\u2661'}</span>
                      </button>
                      <BotonCompartir producto={producto} />
                    </div>
                  </div>

                  {/* Rating */}
                  {producto.calificacion > 0 && (
                    <div className="flex items-center gap-1.5 mb-4">
                      <span className="text-blue-600 font-bold text-sm">{producto.calificacion.toFixed(1)}</span>
                      <div className="flex">
                        {[1,2,3,4,5].map(s => (
                          <span key={s} className={`text-sm ${s <= Math.round(producto.calificacion) ? 'text-blue-500' : 'text-gray-300'}`}>
                            &#x2605;
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Precio */}
                  <div className="mb-4">
                    <p className="text-3xl sm:text-4xl font-light text-gray-900">
                      ${producto.precio.toLocaleString('es-AR')}
                    </p>
                    <p className="text-sm text-green-600 font-medium mt-1">
                      &#x1F4B3; en 3x ${Math.round(producto.precio / 3).toLocaleString('es-AR')} sin inter&eacute;s
                    </p>
                    <Link to="#cuotas" className="text-xs text-blue-600 hover:underline">Ver los medios de pago</Link>
                  </div>

                  {/* Descripci&oacute;n corta */}
                  {producto.descripcion && (
                    <div className="mb-4">
                      <h3 className="font-semibold text-sm text-gray-800 mb-1">Lo que ten&eacute;s que saber de este producto</h3>
                      <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">{producto.descripcion}</p>
                    </div>
                  )}

                  {/* Caracter&iacute;sticas */}
                  {producto.caracteristicas && producto.caracteristicas.length > 0 && (
                    <div className="mb-4">
                      <h3 className="font-semibold text-sm text-gray-800 mb-2">Caracter&iacute;sticas principales</h3>
                      <ul className="space-y-1">
                        {producto.caracteristicas.slice(0, 6).map((c, i) => (
                          <li key={i} className="flex text-sm">
                            <span className="text-gray-500 mr-2">&bull;</span>
                            <span className="text-gray-500">{c.clave}:</span>
                            <span className="ml-1 text-gray-800 font-medium">{c.valor}</span>
                          </li>
                        ))}
                      </ul>
                      {producto.caracteristicas.length > 6 && (
                        <button className="text-xs text-blue-600 hover:underline mt-1">Ver todas las caracter&iacute;sticas</button>
                      )}
                    </div>
                  )}

                  {/* Garant&iacute;a */}
                  {producto.garantia && (
                    <p className="text-sm text-gray-600">
                      &#x1F6E1;&#xFE0F; Garant&iacute;a: <strong>{producto.garantia}</strong>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Tabla de caracter&iacute;sticas completa */}
            {producto.caracteristicas && producto.caracteristicas.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Caracter&iacute;sticas del producto</h2>
                <div className="divide-y divide-gray-100">
                  {producto.caracteristicas.map((c, i) => (
                    <div key={i} className={`grid grid-cols-2 py-2.5 text-sm ${i % 2 === 0 ? 'bg-gray-50' : ''} -mx-2 px-2 rounded`}>
                      <span className="text-gray-500">{c.clave}</span>
                      <span className="text-gray-800 font-medium">{c.valor}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Descripci&oacute;n completa */}
            {producto.descripcion && (
              <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-3">Descripci&oacute;n</h2>
                <p className="text-gray-600 leading-relaxed whitespace-pre-line">{producto.descripcion}</p>
              </div>
            )}

            {/* M&aacute;s productos del vendedor */}
            {productosTienda.length > 0 && tienda && typeof tienda === 'object' && (
              <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-800">
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

            {/* Rese&ntilde;as */}
            <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6">
              <Resenas productoId={producto._id} puedeResenar={false} />
            </div>
          </div>

          {/* DERECHA: panel de compra (sticky) */}
          <div className="lg:sticky lg:top-[140px] lg:self-start space-y-4">
            {/* Card de compra */}
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
              {/* Env&iacute;o gratis badge */}
              {producto.envioGratis && (
                <div className="flex items-center gap-2 text-green-600 font-semibold text-sm mb-3">
                  <span>&#x1F69A;</span>
                  Env&iacute;o gratis a todo el pa&iacute;s
                </div>
              )}

              {/* Precio */}
              <p className="text-3xl font-light text-gray-900 mb-1">
                ${producto.precio.toLocaleString('es-AR')}
              </p>
              <p className="text-sm text-green-600 font-medium mb-4">
                en 6x ${Math.round(producto.precio / 6).toLocaleString('es-AR')} sin inter&eacute;s
              </p>

              {/* Stock */}
              <p className={`text-sm mb-4 font-medium ${producto.stock > 0 ? 'text-gray-700' : 'text-red-600'}`}>
                {producto.stock > 0 ? (
                  <>
                    <span className="text-green-600">Stock disponible</span>
                    <span className="text-gray-500 ml-1">({producto.stock} {producto.stock === 1 ? 'unidad' : 'unidades'})</span>
                  </>
                ) : (
                  <>&#x274C; Agotado</>
                )}
              </p>

              {producto.stock > 0 && (
                <>
                  {/* Cantidad */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm text-gray-600">Cantidad:</span>
                    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                        className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 text-lg"
                      >-</button>
                      <span className="px-4 py-1.5 font-semibold text-sm border-x border-gray-300">{cantidad}</span>
                      <button
                        onClick={() => setCantidad(Math.min(producto.stock, cantidad + 1))}
                        className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 text-lg"
                      >+</button>
                    </div>
                  </div>

                  {/* Botones */}
                  <button
                    onClick={() => { agregarAlCarrito().then(() => navigate('/carrito')) }}
                    className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors mb-2"
                  >
                    Comprar ahora
                  </button>
                  <button
                    onClick={agregarAlCarrito}
                    disabled={agregando}
                    className="w-full py-3 bg-blue-100 text-blue-600 rounded-lg font-semibold hover:bg-blue-200 transition-colors disabled:opacity-50"
                  >
                    {agregando ? 'Agregando...' : 'Agregar al carrito'}
                  </button>
                  {mensaje && (
                    <p className="text-center mt-2 text-xs font-medium text-green-600">{mensaje}</p>
                  )}
                </>
              )}
            </div>

            {/* Tienda vendedora */}
            {tienda && typeof tienda === 'object' && (
              <Link
                to={`/tienda/${tienda._id}`}
                className="block bg-white rounded-2xl shadow-sm p-4 border border-gray-100 hover:border-blue-200 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  {tienda.logo ? (
                    <img src={tienda.logo} alt={tienda.nombre} className="w-11 h-11 rounded-full object-cover border border-gray-200 shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center text-xl shrink-0">&#x1F3EA;</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate group-hover:text-blue-600 text-sm">{tienda.nombre}</p>
                    <p className="text-xs text-gray-500">&#x1F4CD; {tienda.ciudad}</p>
                  </div>
                </div>
                {(tienda.calificacion ?? 0) > 0 && (
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-xs">
                    <span>&#x2B50; {(tienda.calificacion ?? 0).toFixed(1)}</span>
                    {(tienda.totalVentas ?? 0) > 0 && <span className="text-gray-400">{tienda.totalVentas} ventas</span>}
                    <span className="text-blue-600 ml-auto font-medium">Ver tienda &rarr;</span>
                  </div>
                )}
              </Link>
            )}

            {/* Cotizador de env&iacute;o */}
            <CotizadorEnvio
              cpOrigen={(tienda as any)?.codigoPostal || ''}
              pesoGr={producto.peso ? producto.peso * 1000 : undefined}
              alto={producto.alto}
              ancho={producto.ancho}
              largo={producto.largo}
            />

            {/* Medios de pago */}
            <div id="cuotas" className="scroll-mt-40">
              <CalculadoraCuotas precio={producto.precio} />
            </div>

            {/* Garant&iacute;a y devoluci&oacute;n */}
            <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">&#x1F6E1;&#xFE0F;</span>
                <div>
                  <p className="font-semibold text-gray-800">Compra Protegida</p>
                  <p className="text-xs text-gray-500">Tu dinero queda retenido hasta que confirmes la entrega</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">&#x1F504;</span>
                <div>
                  <p className="font-semibold text-gray-800">Devoluci&oacute;n</p>
                  <p className="text-xs text-gray-500">Reembolso en 48 hs una vez que el vendedor verifica el producto</p>
                  <Link to="/devoluciones" className="text-xs text-blue-600 hover:underline">Conocer m&aacute;s</Link>
                </div>
              </div>
              {producto.garantia && (
                <div className="flex items-start gap-3">
                  <span className="text-lg shrink-0">&#x2705;</span>
                  <div>
                    <p className="font-semibold text-gray-800">Garant&iacute;a</p>
                    <p className="text-xs text-gray-500">{producto.garantia}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
