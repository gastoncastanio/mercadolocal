import { useState, useEffect } from 'react'
import api from '../services/api'

interface Disputa {
  _id: string
  ordenId: string | { _id: string }
  compradorId: { _id: string; nombre: string }
  vendedorId?: { _id: string; nombre: string }
  motivo: string
  descripcion: string
  estado: 'abierta' | 'en_revision' | 'resuelta_comprador' | 'resuelta_vendedor' | 'cerrada'
  resolucion?: string
  createdAt: string
}

const estadoBadge: Record<string, { bg: string; text: string; label: string }> = {
  abierta: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Abierta' },
  en_revision: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'En Revision' },
  resuelta_comprador: { bg: 'bg-green-100', text: 'text-green-700', label: 'Resuelta (Comprador)' },
  resuelta_vendedor: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Resuelta (Vendedor)' },
  cerrada: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Cerrada' },
}

const motivoLabels: Record<string, string> = {
  producto_dañado: 'Producto danado',
  no_recibido: 'No recibido',
  diferente_descripcion: 'Diferente a descripcion',
  otro: 'Otro',
}

type Filtro = 'todas' | 'abiertas' | 'resueltas'

export default function DisputasAdmin() {
  const [disputas, setDisputas] = useState<Disputa[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [resolviendoId, setResolviendoId] = useState<string | null>(null)
  const [resolucion, setResolucion] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    cargarDisputas()
  }, [])

  async function cargarDisputas() {
    try {
      const res = await api.get('/disputas/admin')
      setDisputas(res.data)
    } catch (error) {
      console.error('Error cargando disputas:', error)
    } finally {
      setCargando(false)
    }
  }

  async function resolver(disputaId: string, estado: 'resuelta_comprador' | 'resuelta_vendedor') {
    if (!resolucion.trim()) return
    setEnviando(true)
    try {
      await api.put(`/disputas/${disputaId}/resolver`, { resolucion, estado })
      setResolviendoId(null)
      setResolucion('')
      cargarDisputas()
    } catch (error) {
      console.error('Error resolviendo disputa:', error)
    } finally {
      setEnviando(false)
    }
  }

  function getOrdenDisplay(ordenId: string | { _id: string }) {
    if (typeof ordenId === 'object') return ordenId._id.slice(-8)
    return ordenId.slice(-8)
  }

  const disputasFiltradas = disputas.filter((d) => {
    if (filtro === 'abiertas') return d.estado === 'abierta' || d.estado === 'en_revision'
    if (filtro === 'resueltas')
      return d.estado === 'resuelta_comprador' || d.estado === 'resuelta_vendedor' || d.estado === 'cerrada'
    return true
  })

  const tabs: { key: Filtro; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'abiertas', label: 'Abiertas' },
    { key: 'resueltas', label: 'Resueltas' },
  ]

  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin text-4xl">🔄</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">👑 Gestion de Disputas</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFiltro(tab.key)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors ${
                filtro === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {disputasFiltradas.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <p className="text-gray-400 text-lg">No hay disputas en esta categoria</p>
          </div>
        ) : (
          <div className="space-y-4">
            {disputasFiltradas.map((d) => {
              const badge = estadoBadge[d.estado] || estadoBadge.cerrada
              return (
                <div key={d._id} className="bg-white rounded-2xl shadow-sm p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-gray-500">
                        Orden #{getOrdenDisplay(d.ordenId)}
                      </p>
                      <p className="font-semibold text-gray-800 mt-1">
                        {motivoLabels[d.motivo] || d.motivo}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(d.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-4 mb-3 text-sm">
                    <span className="text-gray-500">
                      Comprador: <span className="font-medium text-gray-700">{d.compradorId?.nombre || 'N/A'}</span>
                    </span>
                    <span className="text-gray-500">
                      Vendedor: <span className="font-medium text-gray-700">{d.vendedorId?.nombre || 'N/A'}</span>
                    </span>
                  </div>

                  <p className="text-gray-600 text-sm mb-3">{d.descripcion}</p>

                  {d.resolucion && (
                    <div className="p-3 bg-green-50 rounded-xl mb-3">
                      <p className="text-xs font-semibold text-green-700 mb-1">Resolucion</p>
                      <p className="text-sm text-green-800">{d.resolucion}</p>
                    </div>
                  )}

                  {(d.estado === 'abierta' || d.estado === 'en_revision') && (
                    <>
                      {resolviendoId === d._id ? (
                        <div className="border-t border-gray-100 pt-4 mt-3">
                          <textarea
                            value={resolucion}
                            onChange={(e) => setResolucion(e.target.value)}
                            placeholder="Escribe la resolucion..."
                            rows={3}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-3"
                          />
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                setResolviendoId(null)
                                setResolucion('')
                              }}
                              className="px-4 py-2 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50 transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => resolver(d._id, 'resuelta_comprador')}
                              disabled={enviando || !resolucion.trim()}
                              className="px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                            >
                              Resolver a favor del comprador
                            </button>
                            <button
                              onClick={() => resolver(d._id, 'resuelta_vendedor')}
                              disabled={enviando || !resolucion.trim()}
                              className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
                            >
                              Resolver a favor del vendedor
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setResolviendoId(d._id)}
                          className="mt-2 px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          Resolver
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
