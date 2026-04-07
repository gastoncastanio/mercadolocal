import { Link } from 'react-router-dom'
import { Producto, Tienda } from '../types'
import CalculadoraCuotas from './CalculadoraCuotas'

interface Props {
  producto: Producto
}

export default function TarjetaProducto({ producto }: Props) {
  const tienda = producto.tiendaId as Tienda

  return (
    <Link
      to={`/producto/${producto._id}`}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all group"
    >
      {/* Imagen */}
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        {producto.imagenes && producto.imagenes.length > 0 ? (
          <img
            src={producto.imagenes[0]}
            alt={producto.nombre}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
            <span className="text-5xl">📦</span>
          </div>
        )}
        {producto.stock <= 0 && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
            Agotado
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-800 truncate">{producto.nombre}</h3>

        {tienda && typeof tienda === 'object' && (
          <p className="text-xs text-gray-400 mt-1 truncate">
            🏪 {tienda.nombre} - {tienda.ciudad}
          </p>
        )}

        <div className="flex items-center justify-between mt-3">
          <p className="text-xl font-bold text-blue-600">${producto.precio.toLocaleString()}</p>
          {producto.stock > 0 && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              En stock
            </span>
          )}
        </div>
        <div className="mt-1">
          <CalculadoraCuotas precio={producto.precio} compacto />
        </div>

        {producto.categorias && producto.categorias.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {producto.categorias.slice(0, 2).map(cat => (
              <span key={cat} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {cat}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
