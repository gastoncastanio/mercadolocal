import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { imgCloudinary } from '../utils/cloudinary'
import BadgeVerificado from './BadgeVerificado'

/**
 * Vidriera de marcas: muestra las "Tiendas Oficiales" (marcas verificadas) que
 * venden DENTRO de MercadoLocal (con su split de MP), a diferencia de un afiliado
 * que manda al usuario afuera. Se nutre de GET /api/tienda/oficiales.
 * No renderiza nada si todavía no hay tiendas oficiales.
 */
interface TiendaOficial {
  _id: string
  nombre: string
  marca?: string
  logo?: string
  ciudad?: string
}

export default function VidrieraMarcas() {
  const [tiendas, setTiendas] = useState<TiendaOficial[]>([])

  useEffect(() => {
    api.get('/tienda/oficiales').then(r => setTiendas(r.data || [])).catch(() => {})
  }, [])

  if (!tiendas.length) return null

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-bold text-ml-ink">Tiendas Oficiales</h2>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
          <BadgeVerificado className="w-3.5 h-3.5" titulo="verificada" /> marcas verificadas
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {tiendas.map(t => (
          <Link
            key={t._id}
            to={`/tienda/${t._id}`}
            className="snap-start shrink-0 w-36 bg-white rounded-2xl border border-ml-line p-4 flex flex-col items-center text-center hover:shadow-md hover:border-blue-300 transition-all"
          >
            <div className="w-16 h-16 rounded-xl bg-ml-bg flex items-center justify-center overflow-hidden mb-2">
              {t.logo ? (
                <img src={imgCloudinary(t.logo, 120)} alt={t.nombre} loading="lazy" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-extrabold ml-grad bg-clip-text text-transparent">
                  {(t.marca || t.nombre).charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-[13px] font-bold text-ml-ink truncate w-full">{t.marca || t.nombre}</p>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 mt-1">
              <BadgeVerificado className="w-3 h-3" titulo="Oficial" /> Oficial
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
