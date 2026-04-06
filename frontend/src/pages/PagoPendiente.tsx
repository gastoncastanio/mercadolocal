import { Link } from 'react-router-dom'

export default function PagoPendiente() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center bg-white rounded-2xl shadow-lg p-12 max-w-md">
        <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">&#8987;</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-3">Pago Pendiente</h1>
        <p className="text-gray-500 mb-6">Tu pago está siendo procesado. Te notificaremos cuando se confirme.</p>
        <div className="space-y-3">
          <Link to="/mis-ordenes"
            className="block w-full py-3 bg-yellow-500 text-white rounded-xl font-semibold hover:bg-yellow-600 transition-colors">
            Ver Mis Pedidos
          </Link>
          <Link to="/catalogo"
            className="block w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors">
            Seguir Comprando
          </Link>
        </div>
      </div>
    </div>
  )
}
