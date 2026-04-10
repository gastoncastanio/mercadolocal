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

export default function PedidosVendedor() {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarOrdenes()
  }, [])

  async function cargarOrdenes() {
    try {
      const res = await api.get('/ordenes/vendedor')
      setOrdenes(res.data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setCargando(false)
    }
  }

  async function cambiarEstado(ordenId: string, estado: string) {
    try {
      await api.put(`/ordenes/${ordenId}/estado`, { estado })
      cargarOrdenes()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al actualizar')
    }
  }

  if (cargando) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin text-4xl">🔄</div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">📋 Pedidos Recibidos</h1>

        {ordenes.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm">
            <p className="text-5xl mb-4">📋</p>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No tienes pedidos todavía</h3>
            <p className="text-gray-500">Cuando un comprador haga un pedido, aparecerá aquí</p>
          </div>
        ) : (
          <div className="space-y-4">
            {ordenes.map(orden => (
              <div key={orden._id} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-400">Pedido #{orden._id.slice(-8)}</p>
                    <p className="text-sm text-gray-500">{new Date(orden.createdAt!).toLocaleDateString()}</p>
                    {orden.nombreComprador && <p className="text-sm font-medium text-gray-700 mt-1">Cliente: {orden.nombreComprador}</p>}
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

                <div className="border-t pt-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">📍 {orden.direccionEntrega}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm text-gray-500">Total: </span>
                      <span className="font-bold text-lg">${orden.total.toLocaleString()}</span>
                      <span className="text-sm text-gray-400 ml-2">(comisión: ${orden.comision.toLocaleString()})</span>
                    </div>

                    <div className="flex gap-2">
                      {orden.estado === 'pagada' && (
                        <button onClick={() => cambiarEstado(orden._id, 'enviada')}
                          className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg font-medium hover:bg-purple-700">
                          Marcar Enviado
                        </button>
                      )}
                      {orden.estado === 'enviada' && (
                        <button onClick={() => cambiarEstado(orden._id, 'completada')}
                          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-700">
                          Completar
                        </button>
                      )}
                    </div>
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
