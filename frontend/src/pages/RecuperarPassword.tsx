import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

// Página unificada de recuperación de contraseña.
// Flujo en 3 pasos: pedir email -> ingresar código + nueva contraseña -> listo.
export default function RecuperarPassword() {
  const [paso, setPaso] = useState<'email' | 'codigo' | 'listo'>('email')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [nuevaContraseña, setNuevaContraseña] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [devToken, setDevToken] = useState('')

  async function solicitarCodigo(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      const res = await api.post('/auth/recuperar', { email })
      // En dev, la API devuelve el token para testing
      if (res.data._devToken) {
        setDevToken(res.data._devToken)
      }
      setPaso('codigo')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al enviar el código')
    } finally {
      setCargando(false)
    }
  }

  async function restablecerContraseña(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (nuevaContraseña.length < 8 || !/\d/.test(nuevaContraseña)) {
      setError('La contraseña debe tener al menos 8 caracteres y un número')
      return
    }
    if (nuevaContraseña !== confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }

    setCargando(true)
    try {
      await api.post('/auth/reset', {
        email,
        token,
        nuevaContraseña
      })
      setPaso('listo')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al restablecer la contraseña')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <span className="text-4xl">{paso === 'listo' ? '✅' : '🔑'}</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mt-2">
            {paso === 'email' && 'Recuperar contraseña'}
            {paso === 'codigo' && 'Ingresá el código'}
            {paso === 'listo' && '¡Listo!'}
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            {paso === 'email' && 'Te enviaremos un código de 6 dígitos a tu email'}
            {paso === 'codigo' && `Enviamos un código a ${email}`}
            {paso === 'listo' && 'Tu contraseña fue actualizada'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        {paso === 'email' && (
          <form onSubmit={solicitarCodigo} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email de tu cuenta</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="tu@email.com"
              />
            </div>
            <button
              type="submit"
              disabled={cargando}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {cargando ? 'Enviando...' : 'Enviar código'}
            </button>
          </form>
        )}

        {paso === 'codigo' && (
          <form onSubmit={restablecerContraseña} className="space-y-4">
            {devToken && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
                <strong>Modo desarrollo</strong> — Tu código es: <code className="font-bold text-lg">{devToken}</code>
                <p className="mt-1 text-[10px] text-yellow-600">En producción esto se envía por email.</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código de 6 dígitos</label>
              <input
                type="text"
                required
                maxLength={6}
                value={token}
                onChange={e => { setToken(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-center text-2xl tracking-[0.5em] font-bold"
                placeholder="000000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
              <input
                type="password"
                required
                value={nuevaContraseña}
                onChange={e => { setNuevaContraseña(e.target.value); setError('') }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Mínimo 8 caracteres y un número"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
              <input
                type="password"
                required
                value={confirmar}
                onChange={e => { setConfirmar(e.target.value); setError('') }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Repetir contraseña"
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {cargando ? 'Restableciendo...' : 'Restablecer contraseña'}
            </button>

            <button
              type="button"
              onClick={() => { setPaso('email'); setError('') }}
              className="w-full text-sm text-blue-600 hover:underline"
            >
              Usar otro email
            </button>
          </form>
        )}

        {paso === 'listo' && (
          <div className="text-center">
            <p className="text-green-600 font-medium mb-6">Tu contraseña fue actualizada correctamente.</p>
            <Link
              to="/login"
              className="inline-block w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all text-center"
            >
              Iniciar sesión
            </Link>
          </div>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link to="/login" className="text-blue-600 font-medium hover:underline">
            ← Volver al login
          </Link>
        </p>
      </div>
    </div>
  )
}
