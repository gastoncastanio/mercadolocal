import { useState, useEffect } from 'react'
import api from '../services/api'

interface Disputa {
  _id: string
  ordenId: string | { _id: string }
  motivo: string
  descripcion: string
  estado: 'abierta' | 'en_revision' | 'resuelta_comprador' | 'resuelta_vendedor' | 'cerrada'
  resolucion?: string
  createdAt: string
}

interface OrdenSimple {
  _id: string
  items: { nombre: string }[]
  total: number
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

export default function MisDisputas() {
  const [disputas, setDisputas] = useState<Disputa[]>([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [ordenes, setOrdenes] = useState<OrdenSimple[]>([])
  const [ordenId, setOrdenId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    cargarDisputas()
  }, [])

  async function cargarDisputas() {
    try {
      const res = await api.get('/disputas/mis-disputas')
      setDisputas(res.data)
    } catch (error) {
      console.error('Error cargando disputas:', error)
    } finally {
      setCargando(false)
    }
  }

  async function abrirFormulario() {
    setMostrarForm(true)
    try {
      const res = await api.get('/ordenes')
      setOrdenes(res.data)
    } catch (error) {
      console.error('Error cargando ordenes:', error)
    }
  }

  async function enviarDisputa(e: React.FormEvent) {
    e.preventDefault()
    if (!ordenId || !motivo || !descripcion.trim()) {
      setMensaje('Completa todos los campos')
      return
    }
    setEnviando(true)
    try {
      await api.post('/disputas', { ordenId, motivo, descripcion })
      setMostrarForm(false)
      setOrdenId('')
      setMotivo('')
      setDescripcion('')
      setMensaje('Disputa creada correctamente')
      cargarDisputas()
      setTimeout(() => setMensaje(''), 3000)
    } catch (err: any) {
      setMensaje(err.response?.data?.error || 'Error al crear disputa')
    } finally {
      setEnviando(false)
    }
  }

  function getOrdenDisplay(ordenId: string | { _id: string }) {
    if (typeof ordenId === 'object') return ordenId._id.slice(-8)
    return ordenId.slice(-8)
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin text-4xl">🔄</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-800">⚖️ Mis Disputas</h1>
          <button
            onClick={abrirFormulario}
            className="px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
          >
            Abrir Disputa
          </button>
        </div>

        {mensaje && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-xl text-sm font-medium">
            {mensaje}
          </div>
        )}

        {/* Modal/Formulario */}
        {mostrarForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">Nueva Disputa</h2>
                <button
                  onClick={() => setMostrarForm(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={enviarDisputa} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
                  <select
                    value={ordenId}
                    onChange={(e) => setOrdenId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecciona una orden</option>
                    {ordenes.map((o) => (
                      <option key={o._id} value={o._id}>
                        #{o._id.slice(-8)} - ${o.total.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                  <select
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecciona un motivo</option>
                    <option value="producto_dañado">Producto danado</option>
                    <option value="no_recibido">No recibido</option>
                    <option value="diferente_descripcion">Diferente a la descripcion</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Describe tu problema en detalle..."
                    rows={4}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setMostrarForm(false)}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={enviando}
                    className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {enviando ? 'Enviando...' : 'Enviar Disputa'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Lista de disputas */}
        {disputas.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <p className="text-6xl mb-4">✅</p>
            <p className="text-gray-500 text-lg">No tienes disputas</p>
          </div>
        ) : (
          <div className="space-y-4">
            {disputas.map((d) => {
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
                  <p className="text-gray-600 text-sm">{d.descripcion}</p>
                  {d.resolucion && (
                    <div className="mt-3 p-3 bg-green-50 rounded-xl">
                      <p className="text-xs font-semibold text-green-700 mb-1">Resolucion</p>
                      <p className="text-sm text-green-800">{d.resolucion}</p>
                    </div>
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
