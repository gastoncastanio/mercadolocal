import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

export default function RecuperarPassword() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)

    try {
      await api.post('/auth/recuperar-password', { email })
      setEnviado(true)
    } catch (err: any) {
      // Mostramos el mismo mensaje de exito por seguridad (no revelar si el email existe)
      setEnviado(true)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <span className="text-4xl">🔑</span>
          <h1 className="text-3xl font-bold text-gray-800 mt-2">Recuperar Contrasena</h1>
          <p className="text-gray-500 mt-2">
            Ingresa tu email y te enviaremos instrucciones para restablecer tu contrasena.
          </p>
        </div>

        {enviado ? (
          <div className="text-center">
            <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">
              Si el email existe en nuestro sistema, te enviamos instrucciones para recuperar tu contrasena.
              Revisa tu bandeja de entrada y la carpeta de spam.
            </div>
            <Link
              to="/login"
              className="inline-block mt-4 text-blue-600 font-medium hover:underline"
            >
              Volver a Iniciar Sesion
            </Link>
          </div>
        ) : (
          <>
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

              <button
                type="submit"
                disabled={cargando}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
              >
                {cargando ? 'Enviando...' : 'Enviar enlace de recuperacion'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              <Link to="/login" className="text-blue-600 font-medium hover:underline">
                Volver a Iniciar Sesion
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
