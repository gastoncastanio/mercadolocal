import { useState, useEffect } from 'react'
import api from '../services/api'

interface OrdenAbandonada {
  _id: string
  compradorId: { _id: string; nombre: string; email: string }
  items: { nombre: string; cantidad: number; subtotal: number }[]
  total: number
  createdAt: string
}

export default function CarritosAbandonados() {
  const [ordenes, setOrdenes] = useState<OrdenAbandonada[]>([])
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<Record<string, string>>({})

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    try {
      const res = await api.get('/ordenes/abandonadas')
      setOrdenes(res.data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setCargando(false)
    }
  }

  async function enviarRecordatorio(ordenId: string) {
    setEnviando(ordenId)
    try {
      await api.post(`/ordenes/recordatorio/${ordenId}`)
      setMensajes(prev => ({ ...prev, [ordenId]: 'Recordatorio enviado' }))
    } catch (err: any) {
      setMensajes(prev => ({ ...prev, [ordenId]: err.response?.data?.error || 'Error al enviar' }))
    } finally {
      setEnviando(null)
    }
  }

  function tiempoDesde(fecha: string) {
    const diff = Date.now() - new Date(fecha).getTime()
    const horas = Math.floor(diff / (1000 * 60 * 60))
    if (horas < 1) return 'Hace menos de 1 hora'
    if (horas < 24) return `Hace ${horas} hora${horas !== 1 ? 's' : ''}`
    const dias = Math.floor(horas / 24)
    return `Hace ${dias} dia${dias !== 1 ? 's' : ''}`
  }

  if (cargando) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin text-4xl">🔄</div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Compras sin completar</h1>
            <p className="text-gray-500 mt-1">Ordenes creadas sin pago confirmado (ultimas 48hs)</p>
          </div>
          <div className="bg-orange-100 text-orange-700 px-4 py-2 rounded-xl font-bold text-2xl">
            {ordenes.length}
          </div>
        </div>

        {ordenes.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm">
            <p className="text-5xl mb-4">🎉</p>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No hay compras abandonadas</h3>
            <p className="text-gray-500">Todos tus compradores completaron el pago</p>
          </div>
        ) : (
          <div className="space-y-4">
            {ordenes.map(orden => (
              <div key={orden._id} className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-400">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-800">
                      {orden.compradorId?.nombre || 'Comprador'}
                    </p>
                    <p className="text-sm text-gray-400">{orden.compradorId?.email}</p>
                    <p className="text-xs text-orange-600 mt-1">{tiempoDesde(orden.createdAt)}</p>
                  </div>
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                    Sin pagar
                  </span>
                </div>

                <div className="space-y-1 mb-3">
                  {orden.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-600">{item.nombre} x{item.cantidad}</span>
                      <span className="font-medium">${item.subtotal.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-3 flex items-center justify-between">
                  <span className="font-bold text-lg text-gray-800">${orden.total.toLocaleString()}</span>
                  <div className="flex items-center gap-3">
                    {mensajes[orden._id] && (
                      <span className={`text-sm ${mensajes[orden._id].includes('Error') ? 'text-red-500' : 'text-green-600'}`}>
                        {mensajes[orden._id]}
                      </span>
                    )}
                    <button
                      onClick={() => enviarRecordatorio(orden._id)}
                      disabled={enviando === orden._id || mensajes[orden._id] === 'Recordatorio enviado'}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {enviando === orden._id ? (
                        'Enviando...'
                      ) : mensajes[orden._id] === 'Recordatorio enviado' ? (
                        'Enviado'
                      ) : (
                        <>
                          <span>📧</span>
                          Enviar recordatorio
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
