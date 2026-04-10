import { Link } from 'react-router-dom'
import { Producto, Tienda } from '../types'

interface Props {
  producto: Producto
}

export default function TarjetaProducto({ producto }: Props) {
  const tienda = producto.tiendaId as Tienda

  // Simular precio anterior (para mostrar descuento) si el producto tiene totalVentas > 5
  const tieneDescuento = producto.totalVentas > 5
  const precioAnterior = tieneDescuento ? Math.round(producto.precio * 1.35) : null
  const porcentajeOff = precioAnterior ? Math.round((1 - producto.precio / precioAnterior) * 100) : null

  const cuota6 = Math.round(producto.precio / 6)

  return (
    <Link
      to={`/producto/${producto._id}`}
      className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group flex flex-col"
    >
      {/* Imagen */}
      <div className="aspect-square bg-white relative overflow-hidden flex items-center justify-center p-4">
        {producto.imagenes && producto.imagenes.length > 0 ? (
          <img
            src={producto.imagenes[0]}
            alt={producto.nombre}
            className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <span className="text-5xl">📦</span>
          </div>
        )}
        {(producto as any).esDestacado && (
          <div className="absolute top-2 left-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase">
            MÁS VENDIDO
          </div>
        )}
        {producto.stock <= 0 && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="text-sm font-semibold text-gray-500">Sin stock</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 pt-2 flex-1 flex flex-col">
        {/* Precio */}
        <div className="mb-1">
          {precioAnterior && (
            <p className="text-xs text-gray-400 line-through">${precioAnterior.toLocaleString()}</p>
          )}
          <div className="flex items-center gap-2">
            <p className="text-[22px] font-normal text-gray-900">${producto.precio.toLocaleString()}</p>
            {porcentajeOff && (
              <span className="text-sm font-medium text-green-600">{porcentajeOff}% OFF</span>
            )}
          </div>
        </div>

        {/* Cuotas */}
        <p className="text-xs text-green-600 font-medium mb-2">
          en 6x ${cuota6.toLocaleString()} sin interés
        </p>

        {/* Envío gratis */}
        {producto.envioGratis && (
          <p className="text-xs text-green-600 font-bold mb-2">Envío gratis</p>
        )}

        {/* Nombre */}
        <h3 className="text-[13px] text-gray-700 leading-snug line-clamp-2 flex-1">{producto.nombre}</h3>

        {/* Tienda */}
        {tienda && typeof tienda === 'object' && tienda.ciudad && (
          <p className="text-[11px] text-gray-400 mt-2">
            por {tienda.nombre} · {tienda.ciudad}
          </p>
        )}
      </div>
    </Link>
  )
}
