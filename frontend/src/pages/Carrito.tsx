import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import CalculadorCostos from '../components/CalculadorCostos'
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

  if (cargando) return <div className="min-h-screen bg-ml-bg flex items-center justify-center"><div className="animate-spin text-4xl">🔄</div></div>

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-display text-[28px] font-extrabold text-ml-ink mb-8">🛒 Mi Carrito</h1>

        {items.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-ml-line">
            <p className="text-5xl mb-4">🛒</p>
            <h3 className="text-xl font-semibold text-ml-ink mb-2">Tu carrito está vacío</h3>
            <Link to="/catalogo" className="inline-block mt-4 px-6 py-3 mlbtn ml-grad text-white rounded-xl font-semibold">
              Ver Catálogo
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-8">
              {items.map(item => (
                <div key={item._id} className="bg-white rounded-2xl shadow-sm border border-ml-line p-4 flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg bg-ml-bg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.imagen ? (
                      <img src={item.imagen} alt={item.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">📦</span>
                    )}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-semibold text-ml-ink">{item.nombre}</h3>
                    <p className="text-ml-blue font-bold">${item.precio.toLocaleString()}</p>
                  </div>

                  <div className="flex items-center border border-ml-line rounded-lg overflow-hidden">
                    <button onClick={() => actualizarCantidad(item._id, item.cantidad - 1)} className="px-3 py-1 hover:bg-gray-100">-</button>
                    <span className="px-3 py-1 font-semibold">{item.cantidad}</span>
                    <button onClick={() => actualizarCantidad(item._id, item.cantidad + 1)} className="px-3 py-1 hover:bg-gray-100">+</button>
                  </div>

                  <p className="font-bold text-ml-ink w-24 text-right">
                    ${(item.precio * item.cantidad).toLocaleString()}
                  </p>

                  <button onClick={() => eliminarItem(item._id)} className="text-red-400 hover:text-red-600 text-xl">
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Resumen con calculador de costos */}
            <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 space-y-4">
              <h2 className="text-lg font-semibold text-ml-ink">Desglose de costos</h2>
              <CalculadorCostos
                precioProducto={total}
                vista="comprador"
                compact={true}
              />
              <button
                onClick={() => navigate('/checkout')}
                className="w-full py-4 mlbtn ml-grad text-white rounded-xl font-bold text-lg"
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
