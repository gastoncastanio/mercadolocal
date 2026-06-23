import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { imgCloudinary } from '../utils/cloudinary'
import BadgeVerificado from './BadgeVerificado'

/**
 * Vidriera de marcas: muestra las "Tiendas Oficiales" (marcas verificadas) que
 * venden DENTRO de MercadoLocal, MÁS las tiendas que pagan publicidad de marca
 * (plan "Marca", ubicación 'marcas'). Las pautadas van primero y se etiquetan
 * según su estado real (Oficial o Promocionada). No renderiza nada si no hay.
 */
interface ItemTienda {
  _id: string
  nombre: string
  marca?: string
  nombreCorto?: string
  logo?: string
  ciudad?: string
  oficial?: boolean
  destacadoId?: string  // si vino de un anuncio pagado
}

export default function VidrieraMarcas() {
  const [tiendas, setTiendas] = useState<ItemTienda[]>([])

  useEffect(() => {
    Promise.all([
      api.get('/tienda/oficiales').then(r => r.data || []).catch(() => []),
      api.get('/destacados/activos?ubicacion=marcas').then(r => r.data || []).catch(() => [])
    ]).then(([oficiales, ads]: [ItemTienda[], any[]]) => {
      const merged: ItemTienda[] = []
      const vistos = new Set<string>()
      // Las pautadas van primero (pagaron por estar acá)
      for (const d of ads) {
        const t = d.tiendaId
        if (t && typeof t === 'object' && t._id && !vistos.has(t._id)) {
          merged.push({ ...t, destacadoId: d._id })
          vistos.add(t._id)
        }
      }
      for (const t of oficiales) {
        if (t?._id && !vistos.has(t._id)) {
          merged.push(t)
          vistos.add(t._id)
        }
      }
      setTiendas(merged)
    })
  }, [])

  if (!tiendas.length) return null

  function registrarClick(destacadoId?: string) {
    if (destacadoId) api.post(`/destacados/click/${destacadoId}`).catch(() => {})
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-ml-ink">Tiendas Oficiales</h2>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
            <BadgeVerificado className="w-3.5 h-3.5" titulo="verificada" /> marcas verificadas
          </span>
        </div>
        <Link to="/tiendas" className="text-xs text-ml-blue hover:underline shrink-0">Ver todas &rarr;</Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {tiendas.map(t => (
          <Link
            key={t._id}
            to={`/tienda/${t._id}`}
            onClick={() => registrarClick(t.destacadoId)}
            className="snap-start shrink-0 w-36 bg-white rounded-2xl border border-ml-line p-4 flex flex-col items-center text-center hover:shadow-md hover:border-blue-300 transition-all"
          >
            <div className="w-16 h-16 rounded-xl bg-ml-bg flex items-center justify-center overflow-hidden mb-2">
              {t.logo ? (
                <img src={imgCloudinary(t.logo, 120)} alt={t.nombre} loading="lazy" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-extrabold ml-grad bg-clip-text text-transparent">
                  {(t.marca || t.nombreCorto || t.nombre).charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-[13px] font-bold text-ml-ink truncate w-full">{t.marca || t.nombreCorto || t.nombre}</p>
            {t.oficial ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 mt-1">
                <BadgeVerificado className="w-3 h-3" titulo="Oficial" /> Oficial
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 mt-1">
                &#x2B50; Promocionada
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}
