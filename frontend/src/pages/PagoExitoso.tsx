import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

export default function PagoExitoso() {
  const [params] = useSearchParams()
  const paymentId = params.get('payment_id')
  const externalReference = params.get('external_reference')

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center bg-white rounded-2xl shadow-lg p-12 max-w-md">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">&#10003;</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-3">Pago Exitoso!</h1>
        <p className="text-gray-500 mb-2">Tu pedido fue procesado correctamente.</p>
        {paymentId && (
          <p className="text-sm text-gray-400 mb-6">ID de pago: {paymentId}</p>
        )}
        <div className="space-y-3">
          <Link to="/mis-ordenes"
            className="block w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors">
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
