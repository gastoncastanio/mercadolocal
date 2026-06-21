import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

interface Viaje {
  _id: string
  comisionista?: { _id: string; nombre: string; avatar: string } | null
  origen: { ciudad: string }
  destino: { ciudad: string }
  paradas?: { ciudad: string }[]
  fechaSalida: string
  horaSalida: string
  tarifas: { bultoChico: number; bultoMediano: number; bultoGrande: number }
  capacidadTotal: number
  capacidadDisponible: number
  estado: string
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function ComisionistasPage() {
  const navigate = useNavigate()
  const [origen, setOrigen] = useState('')
  const [destino, setDestino] = useState('')
  const [fecha, setFecha] = useState('')
  const [viajes, setViajes] = useState<Viaje[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (origen) params.append('origen', origen)
      if (destino) params.append('destino', destino)
      if (fecha) params.append('fecha', fecha)
      const res = await api.get(`/comisionistas/viajes?${params}`)
      setViajes(res.data.viajes || [])
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error cargando viajes')
      setViajes([])
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold mb-2">Comisionistas / Envíos</h1>
            <p className="text-lg text-white/90">Viajeros que llevan tus bultos entre ciudades</p>
          </div>
          <button
            onClick={() => navigate('/comisionistas/mi-perfil')}
            className="bg-white/15 hover:bg-white/25 border border-white/30 rounded-xl px-5 py-2.5 font-semibold backdrop-blur-sm self-start sm:self-auto"
          >
            🚚 ¿Viajás seguido? Publicá tu viaje
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border-b border-ml-line sticky top-0 z-40 py-4 px-4">
        <div className="max-w-6xl mx-auto">
          <form
            onSubmit={(e) => { e.preventDefault(); cargar() }}
            className="grid grid-cols-1 md:grid-cols-4 gap-3"
          >
            <input
              type="text"
              placeholder="Origen (ej: Neuquén)"
              value={origen}
              onChange={(e) => setOrigen(e.target.value)}
              className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
            />
            <input
              type="text"
              placeholder="Destino (ej: Bariloche)"
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
            />
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
            />
            <button type="submit" className="mlbtn ml-grad text-white rounded-lg font-bold py-2">Buscar</button>
          </form>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">{error}</p>}

        {cargando ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : viajes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-ml-line">
            <p className="text-4xl mb-3">🚚</p>
            <p className="text-ml-muted">No hay viajes disponibles con esos filtros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {viajes.map(v => (
              <div key={v._id} className="bg-white rounded-2xl shadow-sm border border-ml-line p-5 flex flex-col">
                {/* Ruta */}
                <div className="flex items-center gap-2 text-ml-ink font-bold text-lg mb-1">
                  <span>{v.origen.ciudad}</span>
                  <span className="text-ml-violet">→</span>
                  <span>{v.destino.ciudad}</span>
                </div>
                <p className="text-sm text-ml-muted mb-1">📅 {fmtFecha(v.fechaSalida)}{v.horaSalida ? ` · ${v.horaSalida}` : ''}</p>
                {v.paradas && v.paradas.length > 0 && (
                  <p className="text-xs text-ml-muted mb-3 truncate" title={v.paradas.map(p => p.ciudad).join(' · ')}>🛣️ Pasa por: {v.paradas.map(p => p.ciudad).join(' · ')}</p>
                )}

                {/* Comisionista */}
                <div className="flex items-center gap-2 mb-3">
                  <img src={v.comisionista?.avatar || 'https://via.placeholder.com/32'} alt={v.comisionista?.nombre} className="w-8 h-8 rounded-full object-cover" />
                  <span className="text-sm text-ml-soft">{v.comisionista?.nombre || 'Comisionista'}</span>
                </div>

                {/* Tarifas */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                  <div className="bg-ml-bg rounded-lg py-2">
                    <p className="text-ml-muted">Chico</p>
                    <p className="font-bold text-ml-ink">${v.tarifas.bultoChico.toLocaleString('es-AR')}</p>
                  </div>
                  <div className="bg-ml-bg rounded-lg py-2">
                    <p className="text-ml-muted">Mediano</p>
                    <p className="font-bold text-ml-ink">${v.tarifas.bultoMediano.toLocaleString('es-AR')}</p>
                  </div>
                  <div className="bg-ml-bg rounded-lg py-2">
                    <p className="text-ml-muted">Grande</p>
                    <p className="font-bold text-ml-ink">${v.tarifas.bultoGrande.toLocaleString('es-AR')}</p>
                  </div>
                </div>

                <p className="text-xs text-ml-muted mb-4">
                  {v.capacidadDisponible} de {v.capacidadTotal} bulto{v.capacidadTotal !== 1 ? 's' : ''} disponibles
                </p>

                <button
                  onClick={() => navigate(`/comisionistas/viaje/${v._id}`)}
                  className="mt-auto w-full py-2 mlbtn ml-grad text-white rounded-lg text-sm font-semibold"
                >
                  Ver y reservar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
