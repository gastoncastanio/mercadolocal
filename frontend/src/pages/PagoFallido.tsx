import { Link } from 'react-router-dom'

export default function PagoFallido() {
  return (
    <div className="min-h-screen bg-ml-bg flex items-center justify-center">
      <div className="text-center bg-white rounded-2xl shadow-lg p-12 max-w-md">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">&#10007;</span>
        </div>
        <h1 className="text-3xl font-bold text-ml-ink mb-3">Pago No Procesado</h1>
        <p className="text-ml-muted mb-6">Hubo un problema con tu pago. No se realizó ningún cargo.</p>
        <div className="space-y-3">
          <Link to="/carrito"
            className="block w-full py-3 mlbtn ml-grad text-white rounded-xl font-semibold ">
            Volver al Carrito
          </Link>
          <Link to="/catalogo"
            className="block w-full py-3 bg-gray-100 text-ml-ink rounded-xl font-semibold hover:bg-ml-bg transition-colors">
            Ir al Catálogo
          </Link>
        </div>
      </div>
    </div>
  )
}
