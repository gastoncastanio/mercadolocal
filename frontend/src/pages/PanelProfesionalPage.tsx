import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

interface Solicitud {
  _id: string
  clienteId: { _id: string; nombre: string; avatar: string } | null
  rubro: string
  descripcion: string
  zona: string
  cotizacion?: { monto: number; notas: string; fecha: string }
  estado: string
  createdAt: string
}

export default function PanelProfesionalPage() {
  const navigate = useNavigate()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [cotizandoId, setCotizandoId] = useState<string | null>(null)
  const [montoCotizacion, setMontoCotizacion] = useState('')
  const [notasCotizacion, setNotasCotizacion] = useState('')

  useEffect(() => {
    cargarSolicitudes()
  }, [estadoFiltro])

  async function cargarSolicitudes() {
    setCargando(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (estadoFiltro) params.append('estado', estadoFiltro)

      const res = await api.get(`/servicios/mis-solicitudes?${params}`)
      setSolicitudes(res.data.solicitudes || [])
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error cargando solicitudes')
    } finally {
      setCargando(false)
    }
  }

  async function cambiarEstado(solicitudId: string, nuevoEstado: string) {
    try {
      const datos: any = { estado: nuevoEstado }
      if (nuevoEstado === 'cotizada' && montoCotizacion) {
        datos.cotizacion = {
          monto: parseFloat(montoCotizacion),
          notas: notasCotizacion
        }
      }

      await api.patch(`/servicios/solicitud/${solicitudId}`, datos)
      setCotizandoId(null)
      setMontoCotizacion('')
      setNotasCotizacion('')
      cargarSolicitudes()
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error al actualizar')
    }
  }

  const estadosValidos: { [key: string]: string[] } = {
    'solicitada': ['cotizada', 'cancelada'],
    'cotizada': ['aceptada', 'cancelada'],
    'aceptada': ['en_curso', 'cancelada'],
    'en_curso': ['completada', 'cancelada'],
    'completada': [],
    'cancelada': []
  }

  const estadoLabels: { [key: string]: string } = {
    'solicitada': '📝 Solicitada',
    'cotizada': '💬 Cotizada',
    'aceptada': '✓ Aceptada',
    'en_curso': '🔧 En Curso',
    'completada': '✅ Completada',
    'cancelada': '❌ Cancelada'
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-extrabold">Panel Profesional</h1>
          <p className="text-white/90 mt-2">Gestiona tus solicitudes de servicio</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border-b border-ml-line py-4 px-4">
        <div className="max-w-6xl mx-auto">
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
          >
            <option value="">Todos los estados</option>
            <option value="solicitada">Solicitadas</option>
            <option value="cotizada">Cotizadas</option>
            <option value="aceptada">Aceptadas</option>
            <option value="en_curso">En Curso</option>
            <option value="completada">Completadas</option>
          </select>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">{error}</p>}

        {cargando ? (
          <div className="flex justify-center py-12">
            <div className="spinner" />
          </div>
        ) : solicitudes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-ml-line">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-ml-muted">No hay solicitudes con ese filtro</p>
          </div>
        ) : (
          <div className="space-y-4">
            {solicitudes.map(sol => (
              <div key={sol._id} className="bg-white rounded-2xl shadow-sm border border-ml-line p-6">
                {/* Encabezado */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <img
                        src={sol.clienteId?.avatar || 'https://via.placeholder.com/40'}
                        alt={sol.clienteId?.nombre || 'Cliente'}
                        className="w-12 h-12 rounded-full object-cover bg-ml-bg"
                      />
                      <div>
                        <p className="font-semibold text-ml-ink">{sol.clienteId?.nombre || 'Cliente'}</p>
                        <p className="text-xs text-ml-muted">{sol.rubro} • {sol.zona}</p>
                      </div>
                    </div>
                  </div>

                  {/* Estado */}
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    sol.estado === 'completada' ? 'bg-green-50 text-green-700' :
                    sol.estado === 'cancelada' ? 'bg-red-50 text-red-700' :
                    sol.estado === 'aceptada' ? 'bg-blue-50 text-blue-700' :
                    'bg-yellow-50 text-yellow-700'
                  }`}>
                    {estadoLabels[sol.estado]}
                  </span>
                </div>

                {/* Descripción */}
                <p className="text-ml-soft mb-4">{sol.descripcion}</p>

                {/* Cotización */}
                {sol.cotizacion && typeof sol.cotizacion.monto === 'number' && (
                  <div className="bg-ml-bg border border-ml-line rounded-lg p-3 mb-4">
                    <p className="font-semibold text-ml-ink mb-1">Cotización: ${sol.cotizacion.monto.toLocaleString('es-AR')}</p>
                    {sol.cotizacion.notas && <p className="text-sm text-ml-soft">{sol.cotizacion.notas}</p>}
                  </div>
                )}

                {/* Acciones */}
                <div className="flex gap-2 flex-wrap">
                  {/* Chat */}
                  {['aceptada', 'en_curso', 'completada'].includes(sol.estado) && (
                    <button
                      onClick={() => navigate(`/mensajes`)}
                      className="px-4 py-2 border border-ml-line rounded-lg text-sm font-semibold text-ml-ink hover:bg-ml-bg"
                    >
                      💬 Chat
                    </button>
                  )}

                  {/* Cotizar */}
                  {sol.estado === 'solicitada' && (
                    <>
                      {cotizandoId === sol._id ? (
                        <div className="flex gap-2 w-full">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Monto"
                            value={montoCotizacion}
                            onChange={(e) => setMontoCotizacion(e.target.value)}
                            className="flex-1 px-3 py-2 border border-ml-line rounded-lg text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Notas (opcional)"
                            value={notasCotizacion}
                            onChange={(e) => setNotasCotizacion(e.target.value)}
                            className="flex-1 px-3 py-2 border border-ml-line rounded-lg text-sm"
                          />
                          <button
                            onClick={() => cambiarEstado(sol._id, 'cotizada')}
                            className="px-4 py-2 mlbtn ml-grad text-white rounded-lg text-sm font-semibold"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setCotizandoId(null)}
                            className="px-4 py-2 border border-ml-line rounded-lg text-sm font-semibold"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setCotizandoId(sol._id)}
                          className="px-4 py-2 border border-ml-violet text-ml-violet rounded-lg text-sm font-semibold hover:bg-violet-50"
                        >
                          💬 Cotizar
                        </button>
                      )}
                    </>
                  )}

                  {/* Cambiar estado */}
                  {estadosValidos[sol.estado]?.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value === 'cotizada') {
                          setCotizandoId(sol._id)
                        } else {
                          cambiarEstado(sol._id, e.target.value)
                        }
                        e.target.value = ''
                      }}
                      className="px-4 py-2 border border-ml-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ml-violet"
                    >
                      <option value="">Cambiar estado...</option>
                      {estadosValidos[sol.estado].map(est => (
                        <option key={est} value={est}>{estadoLabels[est]}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
