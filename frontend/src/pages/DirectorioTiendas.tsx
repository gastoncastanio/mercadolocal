import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import BadgeVerificado from '../components/BadgeVerificado'
import { imgCloudinary } from '../utils/cloudinary'

interface TiendaItem {
  _id: string
  nombre: string
  nombreCorto?: string
  logo?: string
  ciudad?: string
  oficial?: boolean
  calificacion?: number
  totalVentas?: number
  descripcion?: string
}

/**
 * Directorio de Tiendas: vidriera de las marcas y comercios de MercadoLocal.
 * Las "Tiendas Oficiales" (verificadas) se muestran destacadas arriba; abajo,
 * todas las tiendas. Buscador por nombre. Diseño y textos propios.
 */
export default function DirectorioTiendas() {
  const [tiendas, setTiendas] = useState<TiendaItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    api.get('/tienda')
      .then(r => setTiendas(Array.isArray(r.data) ? r.data : []))
      .catch(() => setTiendas([]))
      .finally(() => setCargando(false))
  }, [])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return tiendas
    return tiendas.filter(t =>
      (t.nombre || '').toLowerCase().includes(q) ||
      (t.nombreCorto || '').toLowerCase().includes(q) ||
      (t.ciudad || '').toLowerCase().includes(q)
    )
  }, [tiendas, busqueda])

  const oficiales = filtradas.filter(t => t.oficial)
  const resto = filtradas.filter(t => !t.oficial)

  return (
    <div className="min-h-screen bg-ml-bg pb-12">
      {/* Hero */}
      <div className="bg-gradient-to-br from-ml-blue to-ml-violet text-white">
        <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14">
          <h1 className="font-display text-[28px] sm:text-[40px] font-extrabold tracking-[-0.02em]">Tiendas en MercadoLocal</h1>
          <p className="text-white/85 mt-2 text-sm sm:text-base max-w-xl">
            Descubrí las marcas y comercios de tu zona. Seguí tus favoritos y comprá directo de cada tienda.
          </p>
        </div>
      </div>

      {/* Buscador */}
      <div className="max-w-6xl mx-auto px-4 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg border border-ml-line p-2">
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar tienda por nombre o ciudad…"
            className="w-full px-4 py-3 rounded-xl outline-none text-ml-ink placeholder:text-ml-muted"
          />
        </div>
      </div>

      {cargando ? (
        <div className="flex justify-center py-20"><div className="spinner" /></div>
      ) : filtradas.length === 0 ? (
        <div className="max-w-6xl mx-auto px-4 mt-10">
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <p className="text-5xl mb-3">🏪</p>
            <p className="text-ml-muted">{busqueda ? 'No encontramos tiendas con ese nombre.' : 'Todavía no hay tiendas para mostrar.'}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Tiendas Oficiales */}
          {oficiales.length > 0 && (
            <div className="max-w-6xl mx-auto px-4 mt-10">
              <h2 className="text-xl sm:text-2xl font-extrabold text-ml-ink mb-4 flex items-center gap-2">
                Tiendas Oficiales <BadgeVerificado className="w-5 h-5" titulo="Tienda Oficial" />
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {oficiales.map(t => <TarjetaTienda key={t._id} t={t} />)}
              </div>
            </div>
          )}

          {/* Todas las tiendas */}
          {resto.length > 0 && (
            <div className="max-w-6xl mx-auto px-4 mt-10">
              <h2 className="text-xl sm:text-2xl font-extrabold text-ml-ink mb-4">
                {oficiales.length > 0 ? 'Más tiendas' : 'Todas las tiendas'} ({resto.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {resto.map(t => <TarjetaTienda key={t._id} t={t} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TarjetaTienda({ t }: { t: TiendaItem }) {
  const nombre = t.nombreCorto || t.nombre
  return (
    <Link
      to={`/tienda/${t._id}`}
      className="bg-white rounded-2xl border border-ml-line p-4 flex flex-col items-center text-center hover:shadow-md hover:border-ml-purple/40 transition-all"
    >
      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-ml-bg flex items-center justify-center mb-3 border border-ml-line2">
        {t.logo ? (
          <img src={imgCloudinary(t.logo, 160)} alt={nombre} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl font-bold text-ml-muted">{nombre.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="flex items-center justify-center gap-1 w-full min-w-0">
        <span className="font-bold text-ml-ink text-sm truncate min-w-0">{nombre}</span>
        {t.oficial && <BadgeVerificado className="w-4 h-4 shrink-0" titulo="Tienda Oficial" />}
      </div>
      {t.ciudad && <p className="text-xs text-ml-muted mt-0.5">📍 {t.ciudad}</p>}
      {((t.totalVentas || 0) > 0 || (t.calificacion || 0) > 0) && (
        <p className="text-[11px] text-ml-muted mt-1">⭐ {(t.calificacion || 0).toFixed(1)} · {t.totalVentas || 0} ventas</p>
      )}
    </Link>
  )
}
