import { useState, useEffect } from 'react'

const CLAVE_CORRECTA = 'mercadolocal2026'
const STORAGE_KEY = 'mercadolocal_acceso'

export default function PortonPrivado({ children }: { children: React.ReactNode }) {
  const [autorizado, setAutorizado] = useState(false)
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === 'ok') {
      setAutorizado(true)
    }
  }, [])

  const intentar = (e: React.FormEvent) => {
    e.preventDefault()
    if (clave === CLAVE_CORRECTA) {
      localStorage.setItem(STORAGE_KEY, 'ok')
      setAutorizado(true)
      setError('')
    } else {
      setError('Clave incorrecta')
      setClave('')
    }
  }

  if (autorizado) return <>{children}</>

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">🔒</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">MercadoLocal</h1>
          <p className="text-gray-500">Sitio en pruebas. Ingresá la clave de acceso.</p>
        </div>
        <form onSubmit={intentar} className="space-y-4">
          <input
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder="Clave de acceso"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
            autoFocus
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 rounded-lg hover:opacity-90 transition"
          >
            Ingresar
          </button>
        </form>
      </div>
    </div>
  )
}
