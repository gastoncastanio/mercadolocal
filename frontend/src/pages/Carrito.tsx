import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { ItemCarrito } from '../types'

export default function Carrito() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ItemCarrito[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)

  useEffect(() => { cargarCarrito() }, [])

  async function cargarCarrito() {
    try {
      const res = await api.get('/carrito')
      setItems(res.data.carrito.items)
      setTotal(res.data.total)
    } catch (error) {
      console.error('Error cargando carrito:', error)
    } finally {
      setCargando(false)
    }
  }

  async function eliminarItem(itemId: string) {
    try {
      const res = await api.delete(`/carrito/${itemId}`)
      setItems(res.data.carrito.items)
      setTotal(res.data.total)
    } catch (error) {
      console.error('Error eliminando item:', error)
    }
  }

  async function actualizarCantidad(itemId: string, cantidad: number) {
    try {
      const res = await api.put(`/carrito/${itemId}`, { cantidad })
      setItems(res.data.carrito.items)
      setTotal(res.data.total)
    } catch (error) {
      console.error('Error actualizando cantidad:', error)
    }
  }

  if (cargando) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin text-4xl">🔄</div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">🛒 Mi Carrito</h1>

        {items.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm">
            <p className="text-5xl mb-4">🛒</p>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Tu carrito está vacío</h3>
            <Link to="/catalogo" className="inline-block mt-4 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold">
              Ver Catálogo
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-8">
              {items.map(item => (
                <div key={item._id} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.imagen ? (
                      <img src={item.imagen} alt={item.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">📦</span>
                    )}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">{item.nombre}</h3>
                    <p className="text-blue-600 font-bold">${item.precio.toLocaleString()}</p>
                  </div>

                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                    <button onClick={() => actualizarCantidad(item._id, item.cantidad - 1)} className="px-3 py-1 hover:bg-gray-100">-</button>
                    <span className="px-3 py-1 font-semibold">{item.cantidad}</span>
                    <button onClick={() => actualizarCantidad(item._id, item.cantidad + 1)} className="px-3 py-1 hover:bg-gray-100">+</button>
                  </div>

                  <p className="font-bold text-gray-800 w-24 text-right">
                    ${(item.precio * item.cantidad).toLocaleString()}
                  </p>

                  <button onClick={() => eliminarItem(item._id)} className="text-red-400 hover:text-red-600 text-xl">
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Resumen */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg text-gray-600">Total</span>
                <span className="text-3xl font-bold text-gray-800">${total.toLocaleString()}</span>
              </div>
              <button
                onClick={() => navigate('/checkout')}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all"
              >
                Ir al Checkout
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
