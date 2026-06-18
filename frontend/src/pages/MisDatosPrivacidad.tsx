import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'

export default function MisDatosPrivacidad() {
  const toast = useToast()
  const { logout } = useAuth()
  const [perfilar, setPerfilar] = useState(true)
  const [cargando, setCargando] = useState(true)
  const [descargando, setDescargando] = useState(false)
  const [modalBaja, setModalBaja] = useState(false)
  const [passBaja, setPassBaja] = useState('')
  const [eliminando, setEliminando] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      const res = await api.get('/privacidad/preferencias')
      const valor = res.data?.perfilarPublicidad !== false
      setPerfilar(valor)
      // Sincronizar el flag local (para que el opt-out aplique también a lo anónimo)
      try { localStorage.setItem('ml_no_perfilar', valor ? '0' : '1') } catch { /* noop */ }
    } catch {
      /* si falla, dejamos el default */
    } finally {
      setCargando(false)
    }
  }

  async function cambiarPerfilado(nuevoValor: boolean) {
    setPerfilar(nuevoValor)
    try { localStorage.setItem('ml_no_perfilar', nuevoValor ? '0' : '1') } catch { /* noop */ }
    try {
      await api.put('/privacidad/preferencias', { perfilarPublicidad: nuevoValor })
      toast.exito(nuevoValor ? 'Activaste la personalización' : 'Desactivaste el uso de tu actividad para publicidad')
    } catch {
      setPerfilar(!nuevoValor) // revertir
      toast.error('No se pudo guardar la preferencia')
    }
  }

  async function descargarDatos() {
    setDescargando(true)
    try {
      const res = await api.get('/privacidad/exportar', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'mis-datos-mercadolocal.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.exito('Descargamos tus datos')
    } catch {
      toast.error('No se pudieron descargar tus datos')
    } finally {
      setDescargando(false)
    }
  }

  async function eliminarCuenta() {
    if (!passBaja) { toast.error('Ingresá tu contraseña para confirmar'); return }
    setEliminando(true)
    try {
      await api.post('/privacidad/eliminar-cuenta', { contraseña: passBaja })
      toast.exito('Tu cuenta fue dada de baja')
      await logout()
      window.location.href = '/'
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'No se pudo dar de baja la cuenta')
      setEliminando(false)
    }
  }

  if (cargando) {
    return <div className="min-h-screen bg-ml-bg flex items-center justify-center"><div className="spinner" /></div>
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <h1 className="font-display text-[26px] sm:text-[30px] font-extrabold text-ml-ink">🔒 Privacidad y mis datos</h1>
        <p className="text-ml-muted text-sm mt-1 mb-6">
          Ejercé tus derechos sobre los datos que guardamos de vos (Ley 25.326 de Protección de Datos Personales).
        </p>

        {/* Descargar datos */}
        <div className="bg-white rounded-2xl shadow-sm border border-ml-line2 p-5 mb-4">
          <h2 className="font-bold text-ml-ink mb-1">📥 Descargar mis datos</h2>
          <p className="text-sm text-ml-muted mb-3">
            Obtené una copia de todo lo que tenemos asociado a tu cuenta: perfil, compras,
            favoritos, comprobantes y el perfil de interés que usamos para la publicidad.
          </p>
          <button
            onClick={descargarDatos}
            disabled={descargando}
            className="px-5 py-2.5 ml-grad text-white rounded-xl font-semibold text-sm disabled:opacity-50"
          >
            {descargando ? 'Generando…' : 'Descargar mis datos (JSON)'}
          </button>
        </div>

        {/* Preferencia de perfilado */}
        <div className="bg-white rounded-2xl shadow-sm border border-ml-line2 p-5 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-bold text-ml-ink mb-1">🎯 Publicidad personalizada</h2>
              <p className="text-sm text-ml-muted">
                Usamos lo que mirás, buscás y comprás para mostrarte productos más relevantes.
                Podés oponerte cuando quieras: si lo desactivás, dejamos de usar tu actividad y
                borramos el perfil que teníamos.
              </p>
            </div>
            <button
              onClick={() => cambiarPerfilado(!perfilar)}
              className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${perfilar ? 'bg-ml-blue' : 'bg-gray-300'}`}
              aria-label="Activar o desactivar publicidad personalizada"
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${perfilar ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <p className="text-xs text-ml-muted mt-2">
            Estado: <span className="font-semibold text-ml-ink">{perfilar ? 'Activada' : 'Desactivada'}</span>
          </p>
        </div>

        {/* Libro de quejas */}
        <div className="bg-white rounded-2xl shadow-sm border border-ml-line2 p-5 mb-4">
          <h2 className="font-bold text-ml-ink mb-1">📕 Libro de Quejas online</h2>
          <p className="text-sm text-ml-muted mb-3">
            ¿Tenés un reclamo formal? Dejalo registrado y te respondemos. (Defensa del Consumidor)
          </p>
          <Link to="/libro-de-quejas" className="text-ml-blue hover:underline text-sm font-semibold">
            Ir al Libro de Quejas →
          </Link>
        </div>

        {/* Eliminar cuenta */}
        <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-5">
          <h2 className="font-bold text-red-600 mb-1">🗑️ Eliminar mi cuenta</h2>
          <p className="text-sm text-ml-muted mb-3">
            Damos de baja tu cuenta y borramos tus datos personales. Tus compras y facturas se
            conservan de forma desvinculada por obligación fiscal. <span className="font-semibold">Esta acción no se puede deshacer.</span>
          </p>
          <button
            onClick={() => setModalBaja(true)}
            className="px-5 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl font-semibold text-sm hover:bg-red-100"
          >
            Dar de baja mi cuenta
          </button>
        </div>
      </div>

      {/* Modal confirmación baja */}
      {modalBaja && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !eliminando && setModalBaja(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-ml-ink mb-2">¿Dar de baja tu cuenta?</h2>
            <p className="text-sm text-ml-muted mb-4">
              Ingresá tu contraseña para confirmar. Vas a perder el acceso y tus datos personales
              serán eliminados.
            </p>
            <input
              type="password"
              value={passBaja}
              onChange={e => setPassBaja(e.target.value)}
              placeholder="Tu contraseña"
              className="w-full px-3 py-2.5 border border-ml-line2 rounded-lg text-sm mb-4 outline-none focus:ring-2 focus:ring-red-200"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setModalBaja(false)}
                disabled={eliminando}
                className="px-4 py-2.5 text-sm font-semibold text-ml-muted hover:bg-ml-bg rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={eliminarCuenta}
                disabled={eliminando}
                className="px-5 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 disabled:opacity-50"
              >
                {eliminando ? 'Dando de baja…' : 'Sí, eliminar mi cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
