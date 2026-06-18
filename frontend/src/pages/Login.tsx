import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [contraseña, setContraseña] = useState('')
  const [verContraseña, setVerContraseña] = useState(false)
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
      // Distinguir entre error de red/timeout y error de credenciales
      if (!err.response && (err.code === 'ECONNABORTED' || err.message?.includes('Network Error'))) {
        setError('El servidor está cargando. Esperá unos segundos e intentá de nuevo.')
      } else {
        setError(err.response?.data?.error || 'Error al iniciar sesión. Verificá tu email y contraseña.')
      }
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-ml-bg flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-ml-line shadow-[0_30px_60px_-40px_rgba(20,20,45,.35)] p-8">
        <div className="text-center mb-8">
          <span className="inline-flex w-12 h-12 ml-grad rounded-[14px] items-center justify-center shadow-sm">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
          </span>
          <h1 className="font-display text-[28px] font-extrabold text-ml-ink mt-3">Iniciar sesión</h1>
          <p className="text-ml-muted mt-1.5">Bienvenido de nuevo a MercadoLocal</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-ml-slate mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError('') }}
              className="w-full px-4 py-3 border border-ml-line rounded-xl focus:ring-2 focus:ring-ml-purple/25 focus:border-ml-purple/40 outline-none"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-ml-slate mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={verContraseña ? 'text' : 'password'}
                required
                value={contraseña}
                onChange={(e) => { setContraseña(e.target.value); setError('') }}
                className="w-full px-4 py-3 pr-12 border border-ml-line rounded-xl focus:ring-2 focus:ring-ml-purple/25 focus:border-ml-purple/40 outline-none"
                placeholder="Tu contraseña"
              />
              <button
                type="button"
                onClick={() => setVerContraseña(v => !v)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-ml-muted hover:text-ml-soft"
                aria-label={verContraseña ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={-1}
              >
                {verContraseña ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-3 mlbtn ml-grad text-white rounded-xl font-bold transition-all disabled:opacity-50"
          >
            {cargando ? 'Ingresando...' : 'Iniciar Sesi\u00f3n'}
          </button>
        </form>

        <div className="text-center mt-4">
          <Link to="/recuperar" className="text-sm text-ml-blue font-semibold hover:underline">
            &iquest;Olvidaste tu contrase&ntilde;a?
          </Link>
        </div>

        <p className="text-center text-sm text-ml-muted mt-4">
          &iquest;No ten&eacute;s cuenta?{' '}
          <Link to="/registro" className="text-ml-blue font-bold hover:underline">
            Registrarse
          </Link>
        </p>
      </div>
    </div>
  )
}
