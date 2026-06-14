import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { validarDNI } from '../utils/dniValidator'

export default function Registro() {
  const navigate = useNavigate()
  const { registro } = useAuth()

  // Cuenta unificada: todos se registran igual. La capacidad de vender
  // se activa luego desde la cuenta abriendo una tienda (sin re-loguearse).
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    dni: '',
    contraseña: '',
    confirmarContraseña: '',
    telefono: '',
    direccion: ''
  })

  const [mayorDeEdad, setMayorDeEdad] = useState(false)
  const [aceptaTerminos, setAceptaTerminos] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.dni && !validarDNI(form.dni)) {
      setError('El DNI debe tener 8 dígitos válidos (no puede ser una secuencia repetida)')
      return
    }

    if (form.contraseña !== form.confirmarContraseña) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (form.contraseña.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (!mayorDeEdad) {
      setError('Debés declarar que sos mayor de 18 años para registrarte')
      return
    }

    if (!aceptaTerminos) {
      setError('Debés aceptar los Términos y Condiciones')
      return
    }

    setCargando(true)

    try {
      await registro({ ...form, mayorDeEdad, aceptaTerminos })
      navigate('/catalogo')
    } catch (err: any) {
      if (!err.response && (err.code === 'ECONNABORTED' || err.message?.includes('Network Error'))) {
        setError('El servidor está cargando. Esperá unos segundos e intentá de nuevo.')
      } else {
        setError(err.response?.data?.error || 'Error al registrarse. Intentá de nuevo.')
      }
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Crear Cuenta</h1>
          <p className="text-gray-500 mt-2">
            Únete a MercadoLocal
          </p>
        </div>

        {/* Cuenta unificada: comprás y vendés con la misma cuenta */}
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
          <p className="text-sm text-gray-700 text-center">
            <span className="font-semibold">Una sola cuenta para todo.</span> Comprá desde ya y,
            cuando quieras, abrí tu tienda para vender — sin crear otra cuenta.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
            <input
              name="nombre"
              type="text"
              required
              value={form.nombre}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="Tu nombre"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DNI</label>
            <input
              name="dni"
              type="text"
              required
              inputMode="numeric"
              maxLength={10}
              value={form.dni}
              onChange={(e) => {
                const val = e.target.value.replace(/[^\d.]/g, '')
                setForm({ ...form, dni: val })
                setError('')
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="Ej: 35.123.456"
            />
            <p className="text-xs text-gray-400 mt-1">Requerido para verificar tu identidad. No se comparte públicamente.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              name="telefono"
              type="text"
              value={form.telefono}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="Tu teléfono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input
              name="direccion"
              type="text"
              value={form.direccion}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="Tu dirección"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              name="contraseña"
              type="password"
              required
              value={form.contraseña}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
            <input
              name="confirmarContraseña"
              type="password"
              required
              value={form.confirmarContraseña}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="Repetir contraseña"
            />
          </div>

          {/* Declaraciones legales */}
          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={mayorDeEdad}
                onChange={(e) => { setMayorDeEdad(e.target.checked); setError('') }}
                className="mt-0.5 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
              />
              <span className="text-sm text-gray-600">
                Declaro bajo juramento ser <strong>mayor de 18 años</strong>. Entiendo que proporcionar información falsa puede resultar en la suspensión de mi cuenta.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={aceptaTerminos}
                onChange={(e) => { setAceptaTerminos(e.target.checked); setError('') }}
                className="mt-0.5 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
              />
              <span className="text-sm text-gray-600">
                Acepto los{' '}
                <Link to="/terminos" target="_blank" className="text-blue-600 hover:underline font-medium">Términos y Condiciones</Link>
                {' '}y la{' '}
                <Link to="/privacidad" target="_blank" className="text-blue-600 hover:underline font-medium">Política de Privacidad</Link>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={cargando || !mayorDeEdad || !aceptaTerminos}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
          >
            {cargando ? 'Creando cuenta...' : 'Crear Cuenta'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">
            Iniciar Sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
