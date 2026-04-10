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
      <div className="min-h-screen bg-[#ebebeb] flex items-center justify-center">
        <div className="animate-spin text-4xl">&#x1F504;</div>
      </div>
    )
  }

  const tienda = producto.tiendaId as Tienda
  const condicionLabel: Record<string, string> = { nuevo: 'Nuevo', usado: 'Usado', reacondicionado: 'Reacondicionado' }

  // ML-style discount simulation
  const tieneDescuento = producto.totalVentas > 5
  const precioAnterior = tieneDescuento ? Math.round(producto.precio * 1.35) : null
  const porcentajeOff = precioAnterior ? Math.round((1 - producto.precio / precioAnterior) * 100) : null
  const cuota6 = Math.round(producto.precio / 6)
  const cuota12 = Math.round(producto.precio / 12)

  return (
    <div className="min-h-screen bg-[#ebebeb]">
      <div className="max-w-[1200px] mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[13px] text-gray-500 mb-3">
          <Link to="/" className="hover:text-blue-500">Volver al listado</Link>
          <span className="text-gray-300">|</span>
          <Link to="/catalogo" className="hover:text-blue-500">Cat&aacute;logo</Link>
          {producto.categorias?.[0] && (
            <>
              <span className="text-gray-300">&rsaquo;</span>
              <Link to={`/catalogo?categoria=${producto.categorias[0]}`} className="hover:text-blue-500">{producto.categorias[0]}</Link>
            </>
          )}
        </div>

        {/* Main card */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Top section: 3 columns - images | info | buy panel */}
          <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_350px]">
            {/* LEFT: Images + Product Info */}
            <div className="grid md:grid-cols-[1fr_1fr] border-r border-gray-100">
              {/* Image gallery */}
              <div className="p-4">
                <div className="flex gap-2">
                  {/* Thumbnails column */}
                  {producto.imagenes?.length > 1 && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {producto.imagenes.map((img, i) => (
                        <button
                          key={i}
                          onMouseEnter={() => setImagenActual(i)}
                          onClick={() => setImagenActual(i)}
                          className={`w-[44px] h-[44px] rounded border overflow-hidden shrink-0 transition-colors ${
                            i === imagenActual ? 'border-blue-500' : 'border-gray-200 hover:border-blue-400'
                          }`}
                        >
                          <img src={img} alt="" className="w-full h-full object-contain" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Main image */}
                  <div className="flex-1 aspect-square flex items-center justify-center overflow-hidden relative">
                    {producto.imagenes?.length > 0 ? (
                      <img
                        src={producto.imagenes[imagenActual]}
                        alt={producto.nombre}
                        className="max-w-full max-h-full object-contain cursor-pointer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-50">
                        <span className="text-8xl">&#x1F4E6;</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Share & favorite row */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <BotonCompartir producto={producto} />
                  <button
                    onClick={toggleFavorito}
                    disabled={togglingFav}
                    className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 disabled:opacity-50"
                  >
                    <span className="text-lg">{esFavorito ? '\u2764\uFE0F' : '\u2661'}</span>
                    <span>{esFavorito ? 'Favorito' : 'Agregar a favoritos'}</span>
                  </button>
                </div>
              </div>

              {/* Product info center column */}
              <div className="p-5 border-l border-gray-100">
                {/* Condition + sales */}
                <div className="flex items-center gap-1 text-[13px] text-gray-500 mb-2">
                  <span>{condicionLabel[producto.condicion || 'nuevo']}</span>
                  {producto.totalVentas > 0 && (
                    <>
                      <span className="mx-1">-</span>
                      <span>+{producto.totalVentas} vendidos</span>
                    </>
                  )}
                </div>

                {/* Title */}
                <h1 className="text-[22px] font-normal text-gray-800 leading-snug mb-4">{producto.nombre}</h1>

                {/* Rating */}
                {producto.calificacion > 0 && (
                  <div className="flex items-center gap-1 mb-4">
                    <span className="text-sm font-medium text-gray-800">{producto.calificacion.toFixed(1)}</span>
                    <div className="flex">
                      {[1,2,3,4,5].map(s => (
                        <span key={s} className={`text-xs ${s <= Math.round(producto.calificacion) ? 'text-blue-500' : 'text-gray-300'}`}>
                          &#x2605;
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price section - ML style */}
                <div className="mb-5">
                  {precioAnterior && (
                    <p className="text-sm text-gray-400 line-through mb-0.5">
                      ${precioAnterior.toLocaleString('es-AR')}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <p className="text-[36px] font-light text-gray-900 leading-none">
                      ${producto.precio.toLocaleString('es-AR')}
                    </p>
                    {porcentajeOff && (
                      <span className="text-lg font-medium text-green-500">{porcentajeOff}% OFF</span>
                    )}
                  </div>
                  <p className="text-[15px] text-green-600 font-normal mt-2">
                    en 12x ${cuota12.toLocaleString('es-AR')}
                  </p>
                  <Link to="#cuotas" className="text-[13px] text-blue-500 hover:text-blue-600">
                    Ver los medios de pago
                  </Link>
                </div>

                {/* Envio gratis */}
                {producto.envioGratis && (
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                    </svg>
                    <div>
                      <p className="text-sm text-green-600 font-semibold">Env&iacute;o gratis a todo el pa&iacute;s</p>
                      <p className="text-[11px] text-gray-400">Conoce los tiempos y formas de env&iacute;o.</p>
                    </div>
                  </div>
                )}

                {/* Stock */}
                <div className="mb-4">
                  {producto.stock > 0 ? (
                    <p className="text-sm text-gray-700">
                      Stock disponible
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-red-500">Sin stock</p>
                  )}
                </div>

                {/* Description short */}
                {producto.descripcion && (
                  <div className="mb-4">
                    <h3 className="font-semibold text-sm text-gray-800 mb-1">Lo que ten&eacute;s que saber</h3>
                    <p className="text-[13px] text-gray-600 leading-relaxed line-clamp-4">{producto.descripcion}</p>
                  </div>
                )}

                {/* Caracteristicas preview */}
                {producto.caracteristicas && producto.caracteristicas.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm text-gray-800 mb-2">Caracter&iacute;sticas principales</h3>
                    <ul className="space-y-1">
                      {producto.caracteristicas.slice(0, 5).map((c, i) => (
                        <li key={i} className="flex text-[13px]">
                          <span className="text-gray-400 mr-2">&bull;</span>
                          <span className="text-gray-500">{c.clave}:</span>
                          <span className="ml-1 text-gray-800">{c.valor}</span>
                        </li>
                      ))}
                    </ul>
                    {producto.caracteristicas.length > 5 && (
                      <button className="text-[13px] text-blue-500 hover:text-blue-600 mt-2">Ver todas las caracter&iacute;sticas</button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Buy panel (sticky on desktop) */}
            <div className="p-5 lg:border-l border-gray-100">
              <div className="lg:sticky lg:top-[80px]">
                {/* Seller info mini */}
                {tienda && typeof tienda === 'object' && (
                  <div className="mb-4 pb-4 border-b border-gray-100">
                    <p className="text-[13px] text-gray-500 mb-1">Vendido por</p>
                    <Link to={`/tienda/${tienda._id}`} className="text-sm text-blue-500 hover:text-blue-600 font-medium">
                      {tienda.nombre}
                    </Link>
                    {(tienda.calificacion ?? 0) > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        {[1,2,3,4,5].map(s => (
                          <span key={s} className={`text-xs ${s <= Math.round(tienda.calificacion ?? 0) ? 'text-blue-500' : 'text-gray-300'}`}>
                            &#x2605;
                          </span>
                        ))}
                        {(tienda.totalVentas ?? 0) > 0 && (
                          <span className="text-xs text-gray-400 ml-1">{tienda.totalVentas} ventas</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Price in buy panel */}
                <div className="mb-4">
                  {precioAnterior && (
                    <p className="text-xs text-gray-400 line-through">${precioAnterior.toLocaleString('es-AR')}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <p className="text-[32px] font-light text-gray-900 leading-none">
                      ${producto.precio.toLocaleString('es-AR')}
                    </p>
                    {porcentajeOff && (
                      <span className="text-base font-medium text-green-500">{porcentajeOff}% OFF</span>
                    )}
                  </div>
                  <p className="text-sm text-green-600 mt-1">
                    en 6x ${cuota6.toLocaleString('es-AR')} sin inter&eacute;s
                  </p>
                </div>

                {/* Envio */}
                {producto.envioGratis && (
                  <div className="flex items-start gap-2 mb-4 pb-4 border-b border-gray-100">
                    <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                    </svg>
                    <div>
                      <p className="text-sm text-green-600 font-semibold">Env&iacute;o gratis</p>
                      <p className="text-[11px] text-gray-400">a todo el pa&iacute;s</p>
                    </div>
                  </div>
                )}

                {/* Stock info */}
                <p className={`text-sm mb-3 ${producto.stock > 0 ? 'text-gray-800' : 'text-red-600 font-semibold'}`}>
                  {producto.stock > 0 ? (
                    <>
                      Stock disponible
                      <span className="text-gray-400 text-xs ml-1">({producto.stock} {producto.stock === 1 ? 'unidad' : 'disponibles'})</span>
                    </>
                  ) : 'Sin stock'}
                </p>

                {producto.stock > 0 && (
                  <>
                    {/* Quantity selector */}
                    <div className="flex items-center gap-2 mb-5">
                      <span className="text-sm text-gray-600">Cantidad:</span>
                      <select
                        value={cantidad}
                        onChange={e => setCantidad(Number(e.target.value))}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                      >
                        {Array.from({ length: Math.min(producto.stock, 10) }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n} {n === 1 ? 'unidad' : 'unidades'}</option>
                        ))}
                      </select>
                      <span className="text-xs text-gray-400">({producto.stock} disponibles)</span>
                    </div>

                    {/* Buy buttons - ML style */}
                    <button
                      onClick={() => { agregarAlCarrito().then(() => navigate('/carrito')) }}
                      className="w-full py-3.5 bg-blue-500 text-white rounded-md font-medium text-[15px] hover:bg-blue-600 transition-colors mb-2"
                    >
                      Comprar ahora
                    </button>
                    <button
                      onClick={agregarAlCarrito}
                      disabled={agregando}
                      className="w-full py-3.5 bg-blue-50 text-blue-500 rounded-md font-medium text-[15px] hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                      {agregando ? 'Agregando...' : 'Agregar al carrito'}
                    </button>

                    {mensaje && (
                      <div className="mt-2 p-2 bg-green-50 rounded text-center">
                        <p className="text-xs font-medium text-green-600">{mensaje}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Garantia & devoluciones */}
                <div className="mt-5 pt-4 border-t border-gray-100 space-y-3">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <div>
                      <p className="text-[13px] text-gray-800">Compra Protegida</p>
                      <p className="text-[11px] text-gray-400">recib&iacute; el producto que esperabas o te devolvemos tu dinero</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <div>
                      <p className="text-[13px] text-gray-800">Devoluci&oacute;n gratis</p>
                      <p className="text-[11px] text-gray-400">Ten&eacute;s 30 d&iacute;as desde que lo recib&iacute;s</p>
                    </div>
                  </div>
                  {producto.garantia && (
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                      <div>
                        <p className="text-[13px] text-gray-800">Garant&iacute;a</p>
                        <p className="text-[11px] text-gray-400">{producto.garantia}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Below main card sections */}
        <div className="grid lg:grid-cols-[1fr_350px] gap-4 mt-4">
          <div className="space-y-4">
            {/* Caracteristicas tabla completa */}
            {producto.caracteristicas && producto.caracteristicas.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-5 sm:p-6">
                <h2 className="text-[22px] font-normal text-gray-800 mb-5">Caracter&iacute;sticas del producto</h2>
                <div className="divide-y divide-gray-100">
                  {producto.caracteristicas.map((c, i) => (
                    <div key={i} className={`grid grid-cols-2 py-2.5 text-sm ${i % 2 === 0 ? 'bg-gray-50' : ''} -mx-2 px-2 rounded`}>
                      <span className="text-gray-500">{c.clave}</span>
                      <span className="text-gray-800">{c.valor}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Descripcion completa */}
            {producto.descripcion && (
              <div className="bg-white rounded-lg shadow-sm p-5 sm:p-6">
                <h2 className="text-[22px] font-normal text-gray-800 mb-3">Descripci&oacute;n</h2>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{producto.descripcion}</p>
              </div>
            )}

            {/* Resenas */}
            <div className="bg-white rounded-lg shadow-sm p-5 sm:p-6">
              <Resenas productoId={producto._id} puedeResenar={false} />
            </div>

            {/* Mas productos del vendedor */}
            {productosTienda.length > 0 && tienda && typeof tienda === 'object' && (
              <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[22px] font-normal text-gray-800">
                    Publicaciones del vendedor
                  </h2>
                  <Link to={`/tienda/${tienda._id}`} className="text-sm text-blue-500 hover:text-blue-600 font-medium shrink-0">
                    Ver m&aacute;s
                  </Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  {productosTienda.slice(0, 4).map(p => (
                    <TarjetaProducto key={p._id} producto={p} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar below */}
          <div className="space-y-4">
            {/* Tienda vendedora card */}
            {tienda && typeof tienda === 'object' && (
              <Link
                to={`/tienda/${tienda._id}`}
                className="block bg-white rounded-lg shadow-sm p-5 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-3 mb-3">
                  {tienda.logo ? (
                    <img src={tienda.logo} alt={tienda.nombre} className="w-12 h-12 rounded-full object-cover border border-gray-200 shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-xl shrink-0">&#x1F3EA;</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate group-hover:text-blue-500">{tienda.nombre}</p>
                    <p className="text-xs text-gray-400">&#x1F4CD; {tienda.ciudad}</p>
                  </div>
                </div>
                {(tienda.calificacion ?? 0) > 0 && (
                  <div className="flex items-center gap-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                    <span>&#x2B50; {(tienda.calificacion ?? 0).toFixed(1)}</span>
                    {(tienda.totalVentas ?? 0) > 0 && <span>{tienda.totalVentas} ventas</span>}
                    <span className="text-blue-500 ml-auto font-medium">Ver tienda</span>
                  </div>
                )}
              </Link>
            )}

            {/* Cotizador de envio */}
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
          </div>
        </div>
      </div>
    </div>
  )
}
