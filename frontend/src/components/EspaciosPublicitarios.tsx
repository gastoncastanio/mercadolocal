import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { Producto, Tienda } from '../types'

interface Destacado {
  _id: string
  productoId: Producto
  plan: string
}

const PLACEHOLDERS = [
  { titulo: 'Tu marca ac\u00e1', desc: 'Espacio publicitario disponible.', color: 'from-blue-500 to-indigo-600', emoji: '\u{1F4E2}' },
  { titulo: 'Promocion\u00e1 tu tienda', desc: 'Destac\u00e1 tus productos.', color: 'from-emerald-500 to-teal-600', emoji: '\u2B50' },
  { titulo: 'Vend\u00e9 m\u00e1s r\u00e1pido', desc: 'Publicidad dirigida a tu p\u00fablico.', color: 'from-orange-500 to-pink-600', emoji: '\u{1F680}' }
]

export default function EspaciosPublicitarios() {
  const [destacados, setDestacados] = useState<Destacado[]>([])

  useEffect(() => {
    api.get('/destacados/activos?ubicacion=publicidad')
      .then(r => setDestacados((r.data || []).slice(0, 3)))
      .catch(() => {})
  }, [])

  function registrarClick(id: string) {
    api.post(`/destacados/click/${id}`).catch(() => {})
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide font-semibold">
          {destacados.length > 0 ? 'Productos promocionados' : 'Espacio publicitario'}
        </span>
        <Link to="/promover" className="text-[10px] sm:text-xs text-blue-600 hover:underline">
          Anunciate ac&aacute; &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[0, 1, 2].map(i => {
          const dest = destacados[i]

          if (dest?.productoId) {
            const prod = dest.productoId
            const tienda = prod.tiendaId as Tienda

            return (
              <Link
                key={dest._id}
                to={`/producto/${prod._id}`}
                onClick={() => registrarClick(dest._id)}
                className="relative block rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white border border-gray-100 group"
              >
                <span className="absolute top-1.5 right-2 text-[9px] uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold z-10">
                  &#x2B50; Promo
                </span>
                <div className="flex items-center gap-3 p-3">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                    {prod.imagenes?.[0] ? (
                      <img src={prod.imagenes[0]} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl bg-gradient-to-br from-blue-50 to-purple-50">&#x1F4E6;</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-gray-800 truncate group-hover:text-blue-600">{prod.nombre}</p>
                    <p className="text-lg font-bold text-blue-600">${prod.precio.toLocaleString('es-AR')}</p>
                    {tienda && typeof tienda === 'object' && (
                      <p className="text-[10px] text-gray-400 truncate">{tienda.nombre}</p>
                    )}
                  </div>
                </div>
              </Link>
            )
          }

          // Placeholder si no hay destacado para este slot
          const ph = PLACEHOLDERS[i]
          return (
            <Link
              key={`ph-${i}`}
              to="/promover"
              className={`relative block rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-gradient-to-r ${ph.color} text-white p-4`}
            >
              <span className="absolute top-1 right-2 text-[9px] uppercase tracking-wide bg-white/20 px-1.5 py-0.5 rounded">
                Ad
              </span>
              <div className="flex items-center gap-3">
                <span className="text-3xl shrink-0">{ph.emoji}</span>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{ph.titulo}</p>
                  <p className="text-xs text-white/90 leading-snug">{ph.desc}</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
