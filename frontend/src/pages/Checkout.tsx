import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function Checkout() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [direccion, setDireccion] = useState(usuario?.direccion || '')
  const [nombre, setNombre] = useState(usuario?.nombre || '')
  const [telefono, setTelefono] = useState(usuario?.telefono || '')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState('')
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    cargarCarrito()
  }, [])

  async function cargarCarrito() {
    try {
      const res = await api.get('/carrito')
      setItems(res.data.carrito.items)
      setTotal(res.data.total)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  async function crearOrdenYPagar(e: React.FormEvent) {
    e.preventDefault()
    if (!direccion.trim()) {
      setError('La dirección de entrega es obligatoria')
      return
    }

    setProcesando(true)
    setError('')

    try {
      // 1. Crear la orden
      const resOrden = await api.post('/ordenes/crear', { direccion, nombre, telefono, notas })
      const orden = resOrden.data

      // 2. Crear preferencia de Mercado Pago
      const resPago = await api.post('/pagos/crear-preferencia', { ordenId: orden._id })

      // 3. Redirigir a Mercado Pago (validar origen)
      const mpUrl = resPago.data.initPoint
      if (mpUrl && (mpUrl.startsWith('https://www.mercadopago.com') || mpUrl.startsWith('https://sandbox.mercadopago.com'))) {
        window.location.href = mpUrl
      } else {
        setError('URL de pago inválida. Intentá de nuevo.')
        setProcesando(false)
      }

    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al procesar el pago')
      setProcesando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Checkout</h1>

        <div className="grid md:grid-cols-5 gap-8">
          {/* Formulario */}
          <div className="md:col-span-3">
            <form onSubmit={crearOrdenYPagar} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Datos de Entrega</h2>

              {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Tu nombre" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección de entrega</label>
                <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Calle, número, ciudad" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input type="text" value={telefono} onChange={e => setTelefono(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Tu teléfono" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="Instrucciones especiales..." />
              </div>

              {/* Botón Mercado Pago */}
              <button type="submit" disabled={procesando}
                className="w-full py-4 bg-[#009ee3] text-white rounded-xl font-bold text-lg hover:bg-[#0087c9] transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                {procesando ? (
                  'Redirigiendo a Mercado Pago...'
                ) : (
                  <>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l7 4.5-7 4.5z"/>
                    </svg>
                    Pagar con Mercado Pago - ${total.toLocaleString()}
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mt-2">
                <span>Pago seguro con</span>
                <span className="font-semibold text-[#009ee3]">Mercado Pago</span>
                <span>| Tarjetas, cuotas, Mercado Crédito</span>
              </div>

              <div className="mt-3 p-3 bg-green-50 rounded-xl border border-green-200">
                <p className="text-xs text-green-700 flex items-center gap-2">
                  <span className="text-base">🛡️</span>
                  <span><strong>Compra protegida:</strong> tu dinero se retiene hasta que confirmes que recibiste el producto en las condiciones esperadas.</span>
                </p>
              </div>
            </form>
          </div>

          {/* Resumen */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Resumen</h2>

              <div className="space-y-3 mb-4">
                {items.map((item: any) => (
                  <div key={item._id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.nombre} x{item.cantidad}</span>
                    <span className="font-medium">${(item.precio * item.cantidad).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>${total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Envío</span>
                  <span className="text-green-600">A coordinar</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span className="text-[#009ee3]">${total.toLocaleString()}</span>
                </div>
              </div>

              {/* Medios de pago */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2">Medios de pago disponibles:</p>
                <div className="flex flex-wrap gap-1 text-xs">
                  <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded">Visa</span>
                  <span className="px-2 py-1 bg-red-50 text-red-600 rounded">Mastercard</span>
                  <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded">Naranja</span>
                  <span className="px-2 py-1 bg-green-50 text-green-600 rounded">Débito</span>
                  <span className="px-2 py-1 bg-sky-50 text-sky-600 rounded">MP Crédito</span>
                  <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded">Cuotas</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
