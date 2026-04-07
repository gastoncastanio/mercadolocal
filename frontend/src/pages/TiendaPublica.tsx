import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../services/api'
import { Producto, Tienda } from '../types'
import TarjetaProducto from '../components/TarjetaProducto'

interface TiendaExt extends Tienda {
  totalVentas?: number
  ganancias?: number
  calificacion?: number
  createdAt?: string
  telefono?: string
  descripcion?: string
}

export default function TiendaPublica() {
  const { id } = useParams()
  const [tienda, setTienda] = useState<TiendaExt | null>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargar()
  }, [id])

  async function cargar() {
    try {
      const [tiendaRes, productosRes] = await Promise.all([
        api.get(`/tienda/${id}`),
        api.get(`/productos?tiendaId=${id}`)
      ])
      setTienda(tiendaRes.data)
      setProductos(productosRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  function calcularNivel(calif: number, ventas: number) {
    if (ventas >= 100 && calif >= 4.8) return { nombre: 'Platino', color: 'from-cyan-400 to-blue-500', desc: 'MercadoL\u00edder Platino' }
    if (ventas >= 50 && calif >= 4.5) return { nombre: 'Oro', color: 'from-yellow-400 to-orange-500', desc: 'MercadoL\u00edder Oro' }
    if (ventas >= 20 && calif >= 4) return { nombre: 'Plata', color: 'from-gray-300 to-gray-500', desc: 'MercadoL\u00edder Plata' }
    if (ventas >= 5) return { nombre: 'Est\u00e1ndar', color: 'from-green-400 to-green-600', desc: 'Vendedor Est\u00e1ndar' }
    return { nombre: 'Nuevo', color: 'from-blue-400 to-purple-500', desc: 'Vendedor Nuevo' }
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin text-4xl">&#x1F504;</div>
      </div>
    )
  }

  if (!tienda) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-6xl mb-4">&#x1F3EA;</p>
          <h2 className="text-xl font-bold text-gray-800">Tienda no encontrada</h2>
          <Link to="/catalogo" className="mt-4 inline-block text-blue-600 hover:underline">Volver al cat&aacute;logo</Link>
        </div>
      </div>
    )
  }

  const ventas = tienda.totalVentas || 0
  const calif = tienda.calificacion || 0
  const nivel = calcularNivel(calif, ventas)
  const fechaAlta = tienda.createdAt ? new Date(tienda.createdAt) : null
  const mesesActivo = fechaAlta ? Math.max(1, Math.floor((Date.now() - fechaAlta.getTime()) / (1000 * 60 * 60 * 24 * 30))) : 0

  // Rellenos visuales para estrellas
  const estrellasLlenas = Math.floor(calif)
  const mediaEstrella = calif - estrellasLlenas >= 0.5

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header tienda */}
      <div className={`bg-gradient-to-br ${nivel.color} text-white`}>
        <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {tienda.logo ? (
              <img
                src={tienda.logo}
                alt={tienda.nombre}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-4 border-white shadow-xl shrink-0"
              />
            ) : (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white/20 border-4 border-white flex items-center justify-center text-5xl shrink-0">
                &#x1F3EA;
              </div>
            )}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold">{tienda.nombre}</h1>
                <span className="inline-block px-3 py-1 bg-white/25 backdrop-blur-sm rounded-full text-xs font-bold uppercase tracking-wide self-center sm:self-auto">
                  {nivel.desc}
                </span>
              </div>
              <p className="text-sm opacity-90">&#x1F4CD; {tienda.ciudad}</p>
              {tienda.descripcion && (
                <p className="text-sm opacity-90 mt-2 max-w-xl">{tienda.descripcion}</p>
              )}
              {/* Estrellas */}
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
                <div className="flex text-yellow-300 text-lg">
                  {[1, 2, 3, 4, 5].map(i => (
                    <span key={i}>
                      {i <= estrellasLlenas ? '\u2605' : (i === estrellasLlenas + 1 && mediaEstrella ? '\u272E' : '\u2606')}
                    </span>
                  ))}
                </div>
                <span className="font-bold text-sm">{calif.toFixed(1)}</span>
                <span className="text-xs opacity-80">&middot; {ventas} ventas</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats reputación */}
      <div className="max-w-6xl mx-auto px-3 sm:px-4 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>&#x1F4CA;</span> Reputaci&oacute;n e historial
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-blue-50 rounded-xl p-3 sm:p-4 border-l-4 border-blue-500">
              <p className="text-[11px] sm:text-xs text-gray-500 uppercase font-semibold">Ventas totales</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{ventas}</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-3 sm:p-4 border-l-4 border-yellow-500">
              <p className="text-[11px] sm:text-xs text-gray-500 uppercase font-semibold">Calificaci&oacute;n</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{calif.toFixed(1)}/5</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 sm:p-4 border-l-4 border-green-500">
              <p className="text-[11px] sm:text-xs text-gray-500 uppercase font-semibold">Productos</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{productos.length}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 sm:p-4 border-l-4 border-purple-500">
              <p className="text-[11px] sm:text-xs text-gray-500 uppercase font-semibold">Antig&uuml;edad</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">
                {mesesActivo} {mesesActivo === 1 ? 'mes' : 'meses'}
              </p>
            </div>
          </div>

          {/* Barras de reputación estilo ML */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-3">Distribuci&oacute;n de calificaciones</p>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map(estrellas => {
                const porcentaje = calif === 0 ? 0 :
                  estrellas === Math.round(calif) ? 70 :
                  estrellas === Math.round(calif) - 1 || estrellas === Math.round(calif) + 1 ? 15 : 0
                return (
                  <div key={estrellas} className="flex items-center gap-2 text-xs">
                    <span className="w-8 text-gray-600">{estrellas} &#x2605;</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full"
                        style={{ width: `${porcentaje}%` }}
                      ></div>
                    </div>
                    <span className="w-10 text-right text-gray-500">{porcentaje}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Productos de la tienda */}
      <div className="max-w-6xl mx-auto px-3 sm:px-4 mt-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">
          Productos de esta tienda ({productos.length})
        </h2>
        {productos.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <p className="text-5xl mb-3">&#x1F4E6;</p>
            <p className="text-gray-500">Esta tienda a&uacute;n no tiene productos publicados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {productos.map(p => (
              <TarjetaProducto key={p._id} producto={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
