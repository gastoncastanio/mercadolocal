import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [contraseña, setContraseña] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)

    try {
      await login(email, contraseña)
      navigate('/catalogo')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <span className="text-4xl">🛒</span>
          <h1 className="text-3xl font-bold text-gray-800 mt-2">Iniciar Sesión</h1>
          <p className="text-gray-500 mt-2">Bienvenido de nuevo a MercadoLocal</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError('') }}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={contraseña}
              onChange={(e) => { setContraseña(e.target.value); setError('') }}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="Tu contraseña"
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
          >
            {cargando ? 'Ingresando...' : 'Iniciar Sesi\u00f3n'}
          </button>
        </form>

        <div className="text-center mt-4">
          <Link to="/recuperar" className="text-sm text-blue-600 hover:underline">
            &iquest;Olvidaste tu contrase&ntilde;a?
          </Link>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          &iquest;No ten&eacute;s cuenta?{' '}
          <Link to="/registro" className="text-blue-600 font-medium hover:underline">
            Registrarse
          </Link>
        </p>
      </div>
    </div>
  )
}
