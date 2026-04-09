import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

export default function RecuperarContrase\u00f1a() {
  const [paso, setPaso] = useState<'email' | 'codigo' | 'listo'>('email')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [nuevaContrase\u00f1a, setNuevaContrase\u00f1a] = useState('')
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
      setError(err.response?.data?.error || 'Error al enviar el c\u00f3digo')
    } finally {
      setCargando(false)
    }
  }

  async function restablecerContrase\u00f1a(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (nuevaContrase\u00f1a.length < 6) {
      setError('La contrase\u00f1a debe tener al menos 6 caracteres')
      return
    }
    if (nuevaContrase\u00f1a !== confirmar) {
      setError('Las contrase\u00f1as no coinciden')
      return
    }

    setCargando(true)
    try {
      await api.post('/auth/reset', {
        email,
        token,
        nuevaContrase\u00f1a
      })
      setPaso('listo')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al restablecer la contrase\u00f1a')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <span className="text-4xl">{paso === 'listo' ? '\u2705' : '\u{1F511}'}</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mt-2">
            {paso === 'email' && 'Recuperar contrase\u00f1a'}
            {paso === 'codigo' && 'Ingres\u00e1 el c\u00f3digo'}
            {paso === 'listo' && '\u00a1Listo!'}
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            {paso === 'email' && 'Te enviaremos un c\u00f3digo de 6 d\u00edgitos a tu email'}
            {paso === 'codigo' && `Enviamos un c\u00f3digo a ${email}`}
            {paso === 'listo' && 'Tu contrase\u00f1a fue actualizada'}
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
              {cargando ? 'Enviando...' : 'Enviar c\u00f3digo'}
            </button>
          </form>
        )}

        {paso === 'codigo' && (
          <form onSubmit={restablecerContrase\u00f1a} className="space-y-4">
            {devToken && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
                <strong>Modo desarrollo</strong> &mdash; Tu c&oacute;digo es: <code className="font-bold text-lg">{devToken}</code>
                <p className="mt-1 text-[10px] text-yellow-600">En producci&oacute;n esto se env&iacute;a por email.</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">C&oacute;digo de 6 d&iacute;gitos</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contrase&ntilde;a</label>
              <input
                type="password"
                required
                value={nuevaContrase\u00f1a}
                onChange={e => { setNuevaContrase\u00f1a(e.target.value); setError('') }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="M&iacute;nimo 6 caracteres"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contrase&ntilde;a</label>
              <input
                type="password"
                required
                value={confirmar}
                onChange={e => { setConfirmar(e.target.value); setError('') }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Repetir contrase&ntilde;a"
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {cargando ? 'Restableciendo...' : 'Restablecer contrase\u00f1a'}
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
            <p className="text-green-600 font-medium mb-6">Tu contrase&ntilde;a fue actualizada correctamente.</p>
            <Link
              to="/login"
              className="inline-block w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all text-center"
            >
              Iniciar sesi&oacute;n
            </Link>
          </div>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link to="/login" className="text-blue-600 font-medium hover:underline">
            &larr; Volver al login
          </Link>
        </p>
      </div>
    </div>
  )
}
