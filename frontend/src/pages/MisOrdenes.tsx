import { useState, useEffect } from 'react'
import api from '../services/api'
import { Orden } from '../types'

const estadoColores: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  pagada: 'bg-blue-100 text-blue-700',
  enviada: 'bg-purple-100 text-purple-700',
  completada: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-700',
}

export default function MisOrdenes() {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      try {
        const res = await api.get('/ordenes')
        setOrdenes(res.data)
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  if (cargando) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin text-4xl">🔄</div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">📦 Mis Pedidos</h1>

        {ordenes.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm">
            <p className="text-5xl mb-4">📦</p>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No tienes pedidos todavía</h3>
          </div>
        ) : (
          <div className="space-y-4">
            {ordenes.map(orden => (
              <div key={orden._id} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-400">Pedido #{orden._id.slice(-8)}</p>
                    <p className="text-sm text-gray-500">{new Date(orden.createdAt!).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${estadoColores[orden.estado]}`}>
                    {orden.estado.charAt(0).toUpperCase() + orden.estado.slice(1)}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {orden.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-600">{item.nombre} x{item.cantidad}</span>
                      <span className="font-medium">${item.subtotal.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="text-sm text-gray-500">📍 {orden.direccionEntrega}</span>
                  <span className="text-xl font-bold text-blue-600">${orden.total.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
