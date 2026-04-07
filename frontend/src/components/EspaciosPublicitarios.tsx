import { Link } from 'react-router-dom'

/**
 * Espacios publicitarios que se venden a anunciantes externos
 * para generar ingresos adicionales al marketplace.
 * En producci\u00f3n estos espacios cargan campa\u00f1as desde la base de datos.
 */
interface Anuncio {
  id: string
  titulo: string
  descripcion: string
  anunciante: string
  color: string
  enlace: string
  emoji: string
}

// Placeholders hasta tener anunciantes reales. El admin puede reemplazarlos desde CMS.
const ANUNCIOS: Anuncio[] = [
  {
    id: 'slot1',
    titulo: 'Tu marca ac\u00e1',
    descripcion: 'Espacio publicitario disponible. Lleg\u00e1 a miles de compradores.',
    anunciante: 'MercadoLocal Ads',
    color: 'from-blue-500 to-indigo-600',
    enlace: '/central-vendedor',
    emoji: '\u{1F4E2}'
  },
  {
    id: 'slot2',
    titulo: 'Promocion\u00e1 tu tienda',
    descripcion: 'Destac\u00e1 tus productos en la p\u00e1gina principal.',
    anunciante: 'MercadoLocal Ads',
    color: 'from-emerald-500 to-teal-600',
    enlace: '/central-vendedor',
    emoji: '\u2B50'
  },
  {
    id: 'slot3',
    titulo: 'Vend\u00e9 m\u00e1s r\u00e1pido',
    descripcion: 'Publicidad dirigida a tu p\u00fablico ideal.',
    anunciante: 'MercadoLocal Ads',
    color: 'from-orange-500 to-pink-600',
    enlace: '/central-vendedor',
    emoji: '\u{1F680}'
  }
]

export default function EspaciosPublicitarios() {
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide font-semibold">
          Espacio publicitario
        </span>
        <Link to="/central-vendedor" className="text-[10px] sm:text-xs text-blue-600 hover:underline">
          Anunciate ac&aacute; &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ANUNCIOS.map(a => (
          <Link
            key={a.id}
            to={a.enlace}
            className={`relative block rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-gradient-to-r ${a.color} text-white p-4`}
          >
            <span className="absolute top-1 right-2 text-[9px] uppercase tracking-wide bg-white/20 px-1.5 py-0.5 rounded">
              Ad
            </span>
            <div className="flex items-center gap-3">
              <span className="text-3xl shrink-0">{a.emoji}</span>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{a.titulo}</p>
                <p className="text-xs text-white/90 leading-snug line-clamp-2">{a.descripcion}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
