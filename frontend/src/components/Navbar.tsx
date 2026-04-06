import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { usuario, estaLogueado, esVendedor, esAdmin, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🛒</span>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              MercadoLocal
            </span>
          </Link>

          {/* Links centrales */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/catalogo" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">
              Catálogo
            </Link>
            {esVendedor && (
              <>
                <Link to="/mi-tienda" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">
                  Mi Tienda
                </Link>
                <Link to="/publicar" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">
                  Publicar
                </Link>
                <Link to="/pedidos-vendedor" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">
                  Pedidos
                </Link>
                <Link to="/dashboard-vendedor" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">
                  Dashboard
                </Link>
              </>
            )}
            {esAdmin && (
              <>
                <Link to="/admin" className="text-gray-600 hover:text-red-600 font-medium transition-colors">
                  Admin
                </Link>
                <Link to="/admin/cms" className="text-gray-600 hover:text-red-600 font-medium transition-colors">
                  CMS
                </Link>
              </>
            )}
          </div>

          {/* Derecha */}
          <div className="flex items-center gap-4">
            {estaLogueado ? (
              <>
                <Link to="/carrito" className="relative text-gray-600 hover:text-blue-600 transition-colors">
                  <span className="text-xl">🛒</span>
                </Link>
                <Link to="/mis-ordenes" className="text-gray-600 hover:text-blue-600 transition-colors">
                  <span className="text-xl">&#x1F4E6;</span>
                </Link>
                <Link to="/chat" className="text-gray-600 hover:text-blue-600 transition-colors">
                  <span className="text-xl">&#x1F4AC;</span>
                </Link>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                    {usuario?.nombre?.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden md:block text-sm font-medium text-gray-700">
                    {usuario?.nombre}
                  </span>
                  <span className="hidden md:block text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {usuario?.rol}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-500 hover:text-red-500 transition-colors"
                >
                  Salir
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
                >
                  Iniciar Sesión
                </Link>
                <Link
                  to="/registro"
                  className="text-sm font-medium px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
                >
                  Registrarse
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
