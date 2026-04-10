import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

interface Stats {
  totalProductos: number
  totalVentas: number
  ganancias: number
  calificacion: number
}

interface MpEstado {
  vinculado: boolean
  mpUserId?: string
  vinculadoEn?: string
}

export default function CentralVendedor() {
  const { tienda, usuario } = useAuth()
  const [searchParams] = useSearchParams()
  const [stats, setStats] = useState<Stats>({ totalProductos: 0, totalVentas: 0, ganancias: 0, calificacion: 0 })
  const [cargando, setCargando] = useState(true)
  const [mpEstado, setMpEstado] = useState<MpEstado>({ vinculado: false })
  const [mpMensaje, setMpMensaje] = useState('')
  const [vinculandoMp, setVinculandoMp] = useState(false)

  useEffect(() => {
    cargarStats()
    cargarEstadoMp()
    // Verificar resultado de OAuth callback
    const mpResult = searchParams.get('mp')
    if (mpResult === 'ok') {
      setMpMensaje('Mercado Pago vinculado exitosamente')
      setMpEstado({ vinculado: true })
    } else if (mpResult === 'error') {
      setMpMensaje('Error al vincular Mercado Pago. Intentá de nuevo.')
    }
  }, [tienda])

  async function cargarEstadoMp() {
    try {
      const res = await api.get('/mp/estado')
      setMpEstado(res.data)
    } catch (err) {
      console.error('Error cargando estado MP:', err)
    }
  }

  async function vincularMp() {
    setVinculandoMp(true)
    try {
      const res = await api.get('/mp/auth-url')
      window.location.href = res.data.authUrl
    } catch (err: any) {
      setMpMensaje(err.response?.data?.error || 'Error al generar enlace')
      setVinculandoMp(false)
    }
  }

  async function desvincularMp() {
    try {
      await api.post('/mp/desvincular')
      setMpEstado({ vinculado: false })
      setMpMensaje('Mercado Pago desvinculado')
    } catch (err) {
      setMpMensaje('Error al desvincular')
    }
  }

  async function cargarStats() {
    if (!tienda) { setCargando(false); return }
    try {
      const res = await api.get(`/productos?tiendaId=${tienda._id}`)
      const productos = res.data
      setStats({
        totalProductos: productos.length,
        totalVentas: tienda.totalVentas || 0,
        ganancias: tienda.ganancias || 0,
        calificacion: tienda.calificacion || 0
      })
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  const nivelReputacion = stats.calificacion >= 4.5 ? 'Platino' : stats.calificacion >= 4 ? 'Oro' : stats.calificacion >= 3 ? 'Plata' : 'Nuevo'
  const colorNivel = nivelReputacion === 'Platino' ? 'from-cyan-400 to-blue-500' :
                     nivelReputacion === 'Oro' ? 'from-yellow-400 to-orange-500' :
                     nivelReputacion === 'Plata' ? 'from-gray-300 to-gray-500' :
                     'from-blue-400 to-purple-500'

  const secciones = [
    { to: '/publicar', icon: '\u{1F4E6}', titulo: 'Vender', desc: 'Publicar nuevo producto' },
    { to: '/dashboard-vendedor', icon: '\u{1F4CA}', titulo: 'Resumen', desc: 'M\u00e9tricas y estad\u00edsticas' },
    { to: '/mi-tienda', icon: '\u{1F4DD}', titulo: 'Publicaciones', desc: 'Administrar productos' },
    { to: '/pedidos-vendedor', icon: '\u{1F4B0}', titulo: 'Ventas', desc: 'Pedidos y env\u00edos' },
    { to: '/chat', icon: '\u2753', titulo: 'Preguntas', desc: 'Mensajes de clientes' },
    { to: '/mi-tienda', icon: '\u{1F3EA}', titulo: 'Mi p\u00e1gina', desc: 'Perfil de la tienda' },
    { to: '/dashboard-vendedor', icon: '\u{1F4C8}', titulo: 'M\u00e9tricas', desc: 'Estad\u00edsticas avanzadas' },
    { to: '/mis-disputas', icon: '\u26A0\uFE0F', titulo: 'Reclamos', desc: 'Gesti\u00f3n de disputas' },
    { to: '/promover', icon: '\u{1F4E2}', titulo: 'Publicidad', desc: 'Promocionar productos' }
  ]

  if (!tienda) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-lg p-12 max-w-md">
          <p className="text-6xl mb-4">&#x1F3EA;</p>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Necesit&aacute;s una tienda</h2>
          <p className="text-gray-500 mb-6">Cre&aacute; tu tienda para acceder a la Central de Vendedores</p>
          <Link to="/mi-tienda" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700">
            Crear mi tienda
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header con bienvenida + reputación */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {tienda.logo ? (
                <img src={tienda.logo} alt={tienda.nombre} className="w-20 h-20 rounded-2xl object-cover border-2 border-gray-200" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center text-4xl">
                  &#x1F3EA;
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Bienvenido,</p>
                <h1 className="text-2xl font-bold text-gray-800">{usuario?.nombre?.split(' ')[0]}</h1>
                <p className="text-gray-600">{tienda.nombre}</p>
              </div>
            </div>
            <div className={`bg-gradient-to-r ${colorNivel} text-white rounded-2xl p-4 shadow-lg`}>
              <p className="text-xs uppercase opacity-90 font-semibold">Reputaci&oacute;n</p>
              <p className="text-2xl font-bold">{nivelReputacion}</p>
              <p className="text-sm opacity-90">&#x2B50; {stats.calificacion.toFixed(1)} / 5</p>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-blue-500">
            <p className="text-sm text-gray-500 mb-1">Productos</p>
            <p className="text-3xl font-bold text-gray-800">{stats.totalProductos}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-green-500">
            <p className="text-sm text-gray-500 mb-1">Ventas</p>
            <p className="text-3xl font-bold text-gray-800">{stats.totalVentas}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-purple-500">
            <p className="text-sm text-gray-500 mb-1">Ganancias</p>
            <p className="text-3xl font-bold text-gray-800">${stats.ganancias.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-yellow-500">
            <p className="text-sm text-gray-500 mb-1">Reputaci&oacute;n</p>
            <p className="text-3xl font-bold text-gray-800">{stats.calificacion.toFixed(1)}</p>
          </div>
        </div>

        {/* Mercado Pago - Vinculación */}
        <div className={`rounded-2xl shadow-sm p-6 mb-6 border ${mpEstado.vinculado ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#009ee3] flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l7 4.5-7 4.5z"/></svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">Mercado Pago</h3>
                {mpEstado.vinculado ? (
                  <p className="text-sm text-green-700">
                    Cuenta vinculada {mpEstado.vinculadoEn && `desde ${new Date(mpEstado.vinculadoEn).toLocaleDateString()}`}
                  </p>
                ) : (
                  <p className="text-sm text-yellow-700">
                    Vinculá tu cuenta para recibir pagos automáticamente
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {mpEstado.vinculado ? (
                <>
                  <span className="px-4 py-2 bg-green-100 text-green-700 rounded-xl font-semibold text-sm flex items-center gap-2">
                    Vinculado
                  </span>
                  <button onClick={desvincularMp}
                    className="px-4 py-2 bg-white text-gray-600 rounded-xl text-sm border border-gray-300 hover:bg-gray-50">
                    Desvincular
                  </button>
                </>
              ) : (
                <button onClick={vincularMp} disabled={vinculandoMp}
                  className="px-6 py-3 bg-[#009ee3] text-white rounded-xl font-bold hover:bg-[#0087c9] transition-all disabled:opacity-50 flex items-center gap-2">
                  {vinculandoMp ? 'Redirigiendo...' : 'Vincular Mercado Pago'}
                </button>
              )}
            </div>
          </div>
          {mpMensaje && (
            <p className={`mt-3 text-sm ${mpMensaje.includes('error') || mpMensaje.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
              {mpMensaje}
            </p>
          )}
          {!mpEstado.vinculado && (
            <p className="mt-3 text-xs text-gray-500">
              Al vincular tu cuenta, los pagos de tus ventas se acreditarán directamente en tu billetera de Mercado Pago. Solo recibiremos nuestra comisión (10%).
            </p>
          )}
        </div>

        {/* Grid de secciones */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">Accesos r&aacute;pidos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {secciones.map(s => (
            <Link
              key={s.titulo}
              to={s.to}
              className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all border border-gray-100"
            >
              <div className="text-4xl mb-3">{s.icon}</div>
              <h3 className="font-bold text-gray-800">{s.titulo}</h3>
              <p className="text-xs text-gray-500 mt-1">{s.desc}</p>
            </Link>
          ))}
        </div>

        {/* Novedades */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100">
          <div className="flex items-start gap-4">
            <span className="text-3xl">&#x1F195;</span>
            <div>
              <h3 className="font-bold text-gray-800 text-lg">Novedades para vendedores</h3>
              <p className="text-gray-600 text-sm mt-1">
                Pr&oacute;ximamente: sistema de publicidad, cupones de descuento y promociones destacadas. &iexcl;Mantente atento!
              </p>
            </div>
          </div>
        </div>

        {cargando && <div className="text-center mt-4 text-gray-400">Cargando...</div>}
      </div>
    </div>
  )
}
