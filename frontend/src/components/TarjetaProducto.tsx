import { Link } from 'react-router-dom'
import { Producto, Tienda } from '../types'

interface Props {
  producto: Producto
}

export default function TarjetaProducto({ producto }: Props) {
  const tienda = producto.tiendaId as Tienda

  const tieneDescuento = producto.totalVentas > 5
  const precioAnterior = tieneDescuento ? Math.round(producto.precio * 1.35) : null
  const porcentajeOff = precioAnterior ? Math.round((1 - producto.precio / precioAnterior) * 100) : null

  const cuota6 = Math.round(producto.precio / 6)

  return (
    <Link
      to={`/producto/${producto._id}`}
      className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group flex flex-col relative"
    >
      {/* Imagen */}
      <div className="aspect-square bg-white relative overflow-hidden flex items-center justify-center p-4">
        {producto.imagenes && producto.imagenes.length > 0 ? (
          <img
            src={producto.imagenes[0]}
            alt={producto.nombre}
            loading="lazy"
            className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <span className="text-5xl opacity-60">{'\u{1F4E6}'}</span>
          </div>
        )}

        {(producto as any).esDestacado && (
          <div className="absolute top-2 left-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-md uppercase shadow-sm">
            {'\u{1F525}'} Top ventas
          </div>
        )}

        {porcentajeOff && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-[11px] font-bold px-2 py-1 rounded-md shadow-sm">
            {porcentajeOff}% OFF
          </div>
        )}

        {producto.stock <= 0 && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex items-center justify-center">
            <span className="text-sm font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Sin stock</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 pt-2 flex-1 flex flex-col border-t border-gray-50">
        {/* Precio */}
        <div className="mb-1">
          {precioAnterior && (
            <p className="text-xs text-gray-400 line-through">${precioAnterior.toLocaleString()}</p>
          )}
          <p className="text-[22px] font-normal text-gray-900">${producto.precio.toLocaleString()}</p>
        </div>

        {/* Cuotas */}
        <p className="text-xs text-green-600 font-medium mb-1.5">
          en 6x ${cuota6.toLocaleString()} sin inter&eacute;s
        </p>

        {/* Envio gratis */}
        {producto.envioGratis && (
          <p className="text-xs text-green-600 font-bold mb-1.5 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Env&iacute;o gratis
          </p>
        )}

        {/* Nombre */}
        <h3 className="text-[13px] text-gray-700 leading-snug line-clamp-2 flex-1 group-hover:text-blue-600 transition-colors">{producto.nombre}</h3>

        {/* Tienda */}
        {tienda && typeof tienda === 'object' && tienda.ciudad && (
          <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
            {tienda.nombre} &middot; {tienda.ciudad}
          </p>
        )}
      </div>
    </Link>
  )
}
