import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

interface Sesion {
  id: number
  dispositivo: string
  ultimoAcceso: string
  actual: boolean
}

export default function MiCuentaPage() {
  const navigate = useNavigate()
  const { usuario, logout, esVendedor } = useAuth()
  const [tab, setTab] = useState<'personal' | 'modos' | 'seguridad' | 'privacidad'>('personal')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  // Tab Personal
  const [nombre, setNombre] = useState(usuario?.nombre || '')
  const email = usuario?.email || ''
  const [telefono, setTelefono] = useState(usuario?.telefono || '')
  const [direccion, setDireccion] = useState(usuario?.direccion || '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState(usuario?.avatar || '')

  // Tab Seguridad - Password
  const [contraseñaActual, setContraseñaActual] = useState('')
  const [contraseñaNueva, setContraseñaNueva] = useState('')
  const [contraseñaConfirm, setContraseñaConfirm] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)

  // Tab Seguridad - Email
  const [emailNuevo, setEmailNuevo] = useState('')
  const [contraseñaEmail, setContraseñaEmail] = useState('')

  // Tab Seguridad - Sesiones
  const [sesiones, setSesiones] = useState<Sesion[]>([])

  // Tab Privacidad - Perfilado publicidad (activado por defecto)
  const [perfilar, setPerfilar] = useState(true)

  useEffect(() => {
    cargarPreferenciaPerfilado()
  }, [])

  useEffect(() => {
    if (tab === 'seguridad') {
      cargarSesiones()
    }
  }, [tab])

  async function cargarPreferenciaPerfilado() {
    try {
      const res = await api.get('/privacidad/preferencias')
      // Por defecto activado: solo se desactiva si el valor es explícitamente false
      setPerfilar(res.data?.perfilarPublicidad !== false)
    } catch {
      setPerfilar(true)
    }
  }

  async function cambiarPerfilado(nuevoValor: boolean) {
    setPerfilar(nuevoValor)
    try { localStorage.setItem('ml_no_perfilar', nuevoValor ? '0' : '1') } catch { /* noop */ }
    try {
      await api.put('/privacidad/preferencias', { perfilarPublicidad: nuevoValor })
      setExito(nuevoValor ? 'Activaste la publicidad personalizada' : 'Desactivaste la publicidad personalizada')
      setTimeout(() => setExito(''), 3000)
    } catch {
      setPerfilar(!nuevoValor) // revertir
      setError('No se pudo guardar la preferencia')
    }
  }

  async function cargarSesiones() {
    try {
      const res = await api.get('/auth/sesiones')
      setSesiones(res.data.sesiones)
    } catch (e: any) {
      console.error('Error cargando sesiones:', e)
    }
  }

  async function guardarPerfil(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError('')
    setExito('')

    try {
      const datosActualizar: any = {
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        direccion: direccion.trim()
      }

      if (avatarFile) {
        const reader = new FileReader()
        reader.onload = async (event) => {
          datosActualizar.avatar = event.target?.result
          await api.put('/auth/perfil', datosActualizar)
          setExito('Perfil actualizado correctamente')
          setCargando(false)
          setTimeout(() => setExito(''), 3000)
        }
        reader.readAsDataURL(avatarFile)
        return
      }

      await api.put('/auth/perfil', datosActualizar)
      setExito('Perfil actualizado correctamente')
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al guardar el perfil')
    } finally {
      setCargando(false)
    }
  }

  async function cambiarContraseña(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError('')
    setExito('')

    try {
      await api.patch('/auth/contrasena', {
        contraseñaActual,
        contraseñaNueva,
        contraseñaConfirm
      })
      setContraseñaActual('')
      setContraseñaNueva('')
      setContraseñaConfirm('')
      setExito('Contraseña actualizada correctamente')
      setTimeout(() => setExito(''), 3000)
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al cambiar la contraseña')
    } finally {
      setCargando(false)
    }
  }

  async function cambiarEmail(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError('')
    setExito('')

    try {
      await api.patch('/auth/email', {
        emailNuevo,
        contraseña: contraseñaEmail
      })
      setEmailNuevo('')
      setContraseñaEmail('')
      setExito('Email actualizado correctamente')
      setTimeout(() => {
        setExito('')
        logout()
        navigate('/login')
      }, 2000)
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al cambiar el email')
    } finally {
      setCargando(false)
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onload = (event) => {
        setAvatarPreview(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  if (!usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-ml-muted mb-4">Por favor inicia sesión</p>
          <button
            onClick={() => navigate('/login')}
            className="mlbtn ml-grad text-white px-6 py-2 rounded-lg"
          >
            Ir a Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-extrabold">Mi Cuenta</h1>
          <p className="text-white/90 mt-2">Administra tu perfil y configuración de seguridad</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-ml-line px-4">
        <div className="max-w-4xl mx-auto flex gap-8">
          <button
            onClick={() => setTab('personal')}
            className={`py-4 px-2 font-semibold border-b-2 transition ${
              tab === 'personal'
                ? 'border-ml-violet text-ml-violet'
                : 'border-transparent text-ml-muted hover:text-ml-ink'
            }`}
          >
            👤 Información Personal
          </button>
          <button
            onClick={() => setTab('modos')}
            className={`py-4 px-2 font-semibold border-b-2 transition ${
              tab === 'modos'
                ? 'border-ml-violet text-ml-violet'
                : 'border-transparent text-ml-muted hover:text-ml-ink'
            }`}
          >
            🚀 Vender y Ofrecer
          </button>
          <button
            onClick={() => setTab('seguridad')}
            className={`py-4 px-2 font-semibold border-b-2 transition ${
              tab === 'seguridad'
                ? 'border-ml-violet text-ml-violet'
                : 'border-transparent text-ml-muted hover:text-ml-ink'
            }`}
          >
            🔒 Seguridad
          </button>
          <button
            onClick={() => setTab('privacidad')}
            className={`py-4 px-2 font-semibold border-b-2 transition ${
              tab === 'privacidad'
                ? 'border-ml-violet text-ml-violet'
                : 'border-transparent text-ml-muted hover:text-ml-ink'
            }`}
          >
            🔐 Privacidad & Datos
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
            {error}
          </p>
        )}
        {exito && (
          <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg p-3 mb-6">
            ✓ {exito}
          </p>
        )}

        {/* Tab: Información Personal */}
        {tab === 'personal' && (
          <form onSubmit={guardarPerfil} className="bg-white rounded-2xl shadow-sm border border-ml-line p-8 space-y-6">
            {/* Avatar */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-3">Avatar</label>
              <div className="flex gap-6 items-start">
                <div className="w-24 h-24 rounded-full bg-ml-bg flex items-center justify-center overflow-hidden">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-3xl">👤</div>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="block w-full text-sm text-ml-soft
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-violet-50 file:text-ml-violet
                      hover:file:bg-violet-100"
                  />
                  <p className="text-xs text-ml-muted mt-2">JPG, PNG o GIF. Máx 5MB</p>
                </div>
              </div>
            </div>

            {/* Nombre */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Nombre</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
                placeholder="Tu nombre completo"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-4 py-2 border border-ml-line rounded-lg bg-ml-bg text-ml-muted cursor-not-allowed"
              />
              <p className="text-xs text-ml-muted mt-2">El email se cambia en la sección de Seguridad</p>
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Teléfono</label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
                placeholder="Ej: +54 9 11 1234 5678"
              />
            </div>

            {/* Dirección */}
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Dirección</label>
              <textarea
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet h-24"
                placeholder="Tu dirección"
              />
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 py-3 bg-white border border-ml-line rounded-lg font-bold text-ml-soft hover:bg-ml-bg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={cargando}
                className="flex-1 py-3 mlbtn ml-grad text-white rounded-lg font-bold disabled:opacity-60"
              >
                {cargando ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        )}

        {/* Tab: Vender y Ofrecer (Modos de cuenta) */}
        {tab === 'modos' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6">
              <h2 className="text-lg font-bold text-ml-ink mb-1">Activá nuevos modos en tu cuenta</h2>
              <p className="text-sm text-ml-soft">
                Con la misma cuenta podés comprar, vender productos y ofrecer tus servicios profesionales. Activá lo que necesites.
              </p>
            </div>

            {/* Modo Comprador (siempre activo) */}
            <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 flex items-start gap-4">
              <div className="text-3xl">🛍️</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-ml-ink">Comprador</h3>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Activo</span>
                </div>
                <p className="text-sm text-ml-muted">Comprá productos y contratá servicios en MercadoLocal.</p>
              </div>
            </div>

            {/* Modo Vendedor */}
            <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 flex items-start gap-4">
              <div className="text-3xl">🏪</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-ml-ink">Vender productos</h3>
                  {esVendedor && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Activo</span>
                  )}
                </div>
                <p className="text-sm text-ml-muted mb-3">
                  Abrí tu tienda y publicá productos para vender a toda la comunidad.
                </p>
                <button
                  onClick={() => navigate('/mi-tienda')}
                  className={`px-5 py-2 rounded-lg font-semibold text-sm ${
                    esVendedor
                      ? 'border border-ml-violet text-ml-violet hover:bg-violet-50'
                      : 'mlbtn ml-grad text-white'
                  }`}
                >
                  {esVendedor ? 'Gestionar mi tienda' : 'Abrir mi tienda'}
                </button>
              </div>
            </div>

            {/* Modo Profesional */}
            <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 flex items-start gap-4">
              <div className="text-3xl">🔧</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-ml-ink">Ofrecer servicios profesionales</h3>
                  {usuario?.esProfesional && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Activo</span>
                  )}
                </div>
                <p className="text-sm text-ml-muted mb-3">
                  Creá tu perfil profesional (plomero, electricista, pintor, etc.) y recibí solicitudes de presupuesto de clientes en tu zona. Publicar es gratis.
                </p>
                <button
                  onClick={() => navigate('/servicios/mi-perfil')}
                  className={`px-5 py-2 rounded-lg font-semibold text-sm ${
                    usuario?.esProfesional
                      ? 'border border-ml-violet text-ml-violet hover:bg-violet-50'
                      : 'mlbtn ml-grad text-white'
                  }`}
                >
                  {usuario?.esProfesional ? 'Gestionar mi perfil profesional' : 'Activar y crear mi perfil'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Seguridad */}
        {tab === 'seguridad' && (
          <div className="space-y-6">
            {/* Cambiar Contraseña */}
            <form onSubmit={cambiarContraseña} className="bg-white rounded-2xl shadow-sm border border-ml-line p-8">
              <h2 className="text-lg font-bold text-ml-ink mb-6">Cambiar Contraseña</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-ml-ink mb-2">Contraseña Actual</label>
                  <input
                    type="password"
                    value={contraseñaActual}
                    onChange={(e) => setContraseñaActual(e.target.value)}
                    className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
                    placeholder="Tu contraseña actual"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-ml-ink mb-2">Nueva Contraseña</label>
                  <div className="relative">
                    <input
                      type={mostrarPassword ? 'text' : 'password'}
                      value={contraseñaNueva}
                      onChange={(e) => setContraseñaNueva(e.target.value)}
                      className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
                      placeholder="Mínimo 8 caracteres + 1 número"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarPassword(!mostrarPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ml-muted hover:text-ml-ink"
                    >
                      {mostrarPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-ml-ink mb-2">Confirmar Nueva Contraseña</label>
                  <input
                    type={mostrarPassword ? 'text' : 'password'}
                    value={contraseñaConfirm}
                    onChange={(e) => setContraseñaConfirm(e.target.value)}
                    className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
                    placeholder="Confirma tu nueva contraseña"
                  />
                </div>

                <button
                  type="submit"
                  disabled={cargando}
                  className="w-full py-3 mlbtn ml-grad text-white rounded-lg font-bold disabled:opacity-60"
                >
                  {cargando ? 'Actualizando...' : 'Cambiar Contraseña'}
                </button>
              </div>
            </form>

            {/* Cambiar Email */}
            <form onSubmit={cambiarEmail} className="bg-white rounded-2xl shadow-sm border border-ml-line p-8">
              <h2 className="text-lg font-bold text-ml-ink mb-6">Cambiar Email</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-ml-ink mb-2">Email Actual</label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full px-4 py-2 border border-ml-line rounded-lg bg-ml-bg text-ml-muted cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-ml-ink mb-2">Nuevo Email</label>
                  <input
                    type="email"
                    value={emailNuevo}
                    onChange={(e) => setEmailNuevo(e.target.value)}
                    className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
                    placeholder="Tu nuevo email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-ml-ink mb-2">Contraseña</label>
                  <input
                    type="password"
                    value={contraseñaEmail}
                    onChange={(e) => setContraseñaEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet"
                    placeholder="Confirma tu contraseña"
                  />
                </div>

                <p className="text-xs text-ml-muted">Se cerrará tu sesión después de actualizar el email</p>

                <button
                  type="submit"
                  disabled={cargando}
                  className="w-full py-3 mlbtn ml-grad text-white rounded-lg font-bold disabled:opacity-60"
                >
                  {cargando ? 'Actualizando...' : 'Cambiar Email'}
                </button>
              </div>
            </form>

            {/* Sesiones Activas */}
            <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-8">
              <h2 className="text-lg font-bold text-ml-ink mb-6">Sesiones Activas</h2>

              {sesiones.length === 0 ? (
                <p className="text-ml-muted">No hay sesiones activas</p>
              ) : (
                <div className="space-y-3">
                  {sesiones.map((sesion) => (
                    <div key={sesion.id} className="flex items-center justify-between p-3 bg-ml-bg rounded-lg border border-ml-line">
                      <div>
                        <p className="font-semibold text-ml-ink">
                          {sesion.dispositivo}
                          {sesion.actual && <span className="text-xs ml-2 bg-green-100 text-green-700 px-2 py-1 rounded-full">Este dispositivo</span>}
                        </p>
                        <p className="text-xs text-ml-muted">Último acceso: {sesion.ultimoAcceso}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Privacidad & Datos */}
        {tab === 'privacidad' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-8">
              <h2 className="text-lg font-bold text-ml-ink mb-4">Privacidad & Datos</h2>
              <p className="text-ml-soft mb-6">
                Configura cómo usamos tus datos personales en MercadoLocal. Cumplimos con la Ley 25.326 de Protección de Datos Personales.
              </p>

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4 p-4 border border-ml-line rounded-lg">
                  <div>
                    <p className="font-semibold text-ml-ink">Perfilado para Publicidad</p>
                    <p className="text-sm text-ml-muted">Permitir análisis de comportamiento para publicidad personalizada</p>
                    <p className="text-xs text-ml-muted mt-2">
                      Estado: <span className="font-semibold text-ml-ink">{perfilar ? 'Activada' : 'Desactivada'}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => cambiarPerfilado(!perfilar)}
                    className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${perfilar ? 'bg-ml-violet' : 'bg-gray-300'}`}
                    aria-label="Activar o desactivar publicidad personalizada"
                  >
                    <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${perfilar ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-ml-line space-y-3">
                <button
                  onClick={() => window.open('/privacidad-datos', '_blank')}
                  className="w-full py-3 border border-ml-violet text-ml-violet rounded-lg font-bold hover:bg-violet-50"
                >
                  📥 Descargar Mis Datos
                </button>
                <button
                  onClick={() => window.open('/privacidad-datos', '_blank')}
                  className="w-full py-3 border border-red-300 text-red-600 rounded-lg font-bold hover:bg-red-50"
                >
                  ⚠️ Eliminar Mi Cuenta
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
