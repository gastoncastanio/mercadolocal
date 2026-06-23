import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import api from '../services/api'
import { useSocket } from '../hooks/useSocket'

const CATEGORIAS_NAV = [
  { nombre: 'Tecnología', slug: 'tecnologia' },
  { nombre: 'Moda', slug: 'moda' },
  { nombre: 'Hogar', slug: 'hogar' },
  { nombre: 'Deportes', slug: 'deportes' },
]

/**
 * Sección colapsable (acordeón) para el menú del avatar. Mantiene las verticales
 * (Radar, Servicios, Comisionistas, Vendedor) plegadas por defecto así el menú
 * no se hace eterno; el usuario expande solo la que necesita.
 */
function GrupoMenu({ id, titulo, abierto, onToggle, children }: {
  id: string
  titulo: string
  abierto: boolean
  onToggle: (id: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="border-t border-ml-line2">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between px-4 pt-2.5 pb-1.5 hover:bg-ml-bg transition-colors"
        aria-expanded={abierto}
      >
        <span className="text-[10px] text-ml-muted uppercase font-semibold tracking-wider">{titulo}</span>
        <svg className={`w-3.5 h-3.5 text-ml-muted transition-transform ${abierto ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {abierto && <div className="pb-1">{children}</div>}
    </div>
  )
}

export default function Navbar() {
  const { usuario, estaLogueado, esVendedor, esAdmin, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [busqueda, setBusqueda] = useState('')
  const [menuVendedor, setMenuVendedor] = useState(false)
  const [menuUsuario, setMenuUsuario] = useState(false)
  const [menuCompras, setMenuCompras] = useState(false)
  const [menuCategorias, setMenuCategorias] = useState(false)
  const [menuMas, setMenuMas] = useState(false)
  const [menuMobile, setMenuMobile] = useState(false)
  // Qué vertical del menú del avatar está expandida (acordeón: solo una a la vez).
  const [grupoMenu, setGrupoMenu] = useState<string | null>(null)
  // Ídem para el menú hamburguesa mobile.
  const [grupoMobile, setGrupoMobile] = useState<string | null>(null)
  const [notifsNoLeidas, setNotifsNoLeidas] = useState(0)
  const refVendedor = useRef<HTMLDivElement>(null)
  const refUsuario = useRef<HTMLDivElement>(null)
  const refCompras = useRef<HTMLDivElement>(null)
  const refCategorias = useRef<HTMLDivElement>(null)
  const refMas = useRef<HTMLDivElement>(null)

  // WebSocket para notificaciones en tiempo real
  const { on, off } = useSocket(usuario?._id)

  useEffect(() => {
    if (!estaLogueado) return
    cargarNotifs()
    // Polling como fallback cada 2 minutos (WebSocket es el principal)
    const interval = setInterval(cargarNotifs, 120000)
    return () => clearInterval(interval)
  }, [estaLogueado])

  // Escuchar notificaciones via WebSocket
  useEffect(() => {
    if (!estaLogueado || !usuario?._id) return
    // Notificación con contenido: subimos el badge Y mostramos un toast con el
    // título/mensaje, así el usuario ve DE QUÉ es al instante (no solo un número).
    const handlerNotif = (data?: { titulo?: string; mensaje?: string }) => {
      setNotifsNoLeidas(prev => prev + 1)
      if (data?.titulo) {
        toast.info(data.mensaje ? `${data.titulo} — ${data.mensaje}` : data.titulo)
      }
    }
    // Señales sin contenido (pago/venta/estado): solo actualizan el badge.
    const handlerBadge = () => setNotifsNoLeidas(prev => prev + 1)
    on('notificacion', handlerNotif)
    on('pago:aprobado', handlerBadge)
    on('venta:confirmada', handlerBadge)
    on('orden:estado', handlerBadge)
    return () => {
      off('notificacion')
      off('pago:aprobado')
      off('venta:confirmada')
      off('orden:estado')
    }
  }, [estaLogueado, usuario?._id, on, off, toast])

  // Cerrar menú mobile al cambiar de ruta
  useEffect(() => { setMenuMobile(false) }, [location.pathname])

  // Al cerrar el menú del avatar, colapsar las verticales: la próxima vez que se
  // abra arranca compacto.
  useEffect(() => { if (!menuUsuario) setGrupoMenu(null) }, [menuUsuario])

  // Al cerrar el hamburguesa mobile, colapsar sus grupos también.
  useEffect(() => { if (!menuMobile) setGrupoMobile(null) }, [menuMobile])

  const cerrarMenuUsuario = () => setMenuUsuario(false)
  const toggleGrupoMenu = (id: string) => setGrupoMenu(prev => (prev === id ? null : id))
  const toggleGrupoMobile = (id: string) => setGrupoMobile(prev => (prev === id ? null : id))

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (refVendedor.current && !refVendedor.current.contains(e.target as Node)) setMenuVendedor(false)
      if (refUsuario.current && !refUsuario.current.contains(e.target as Node)) setMenuUsuario(false)
      if (refCompras.current && !refCompras.current.contains(e.target as Node)) setMenuCompras(false)
      if (refCategorias.current && !refCategorias.current.contains(e.target as Node)) setMenuCategorias(false)
      if (refMas.current && !refMas.current.contains(e.target as Node)) setMenuMas(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function cargarNotifs() {
    try {
      const res = await api.get('/notificaciones/no-leidas')
      setNotifsNoLeidas(res.data.cantidad || 0)
    } catch {}
  }

  function handleLogout() {
    logout()
    setMenuUsuario(false)
    navigate('/')
  }

  function buscar(e: React.FormEvent) {
    e.preventDefault()
    if (busqueda.trim()) {
      navigate(`/catalogo?busqueda=${encodeURIComponent(busqueda)}`)
    }
  }

  // Helper: abre un menú específico cerrando todos los demás.
  // Si el menú ya está abierto, lo cierra (toggle).
  function toggleMenu(cual: 'vendedor' | 'usuario' | 'compras' | 'categorias' | 'mas') {
    setMenuVendedor(cual === 'vendedor' ? v => !v : false)
    setMenuUsuario(cual === 'usuario' ? v => !v : false)
    setMenuCompras(cual === 'compras' ? v => !v : false)
    setMenuCategorias(cual === 'categorias' ? v => !v : false)
    setMenuMas(cual === 'mas' ? v => !v : false)
  }

  return (
    <>
      {/* ===== TOP BAR ===== */}
      <header className="bg-white/85 backdrop-blur-md border-b border-ml-line2 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Hamburger mobile */}
            <button
              onClick={() => setMenuMobile(!menuMobile)}
              className="md:hidden text-ml-slate hover:text-ml-ink p-1"
              aria-label="Menú"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {menuMobile ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 ml-grad rounded-[10px] flex items-center justify-center shrink-0 shadow-sm">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
              </div>
              <span className="text-base sm:text-lg font-display font-extrabold text-ml-ink tracking-tight truncate">MercadoLocal</span>
            </Link>

            {/* Buscador */}
            <form onSubmit={buscar} className="flex-1 max-w-2xl hidden sm:block">
              <div className="relative">
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar productos, marcas y más..."
                  className="w-full px-4 py-2 pr-10 rounded-xl border border-ml-line text-ml-ink text-sm focus:ring-2 focus:ring-ml-purple/25 focus:border-ml-purple/40 outline-none bg-ml-bg placeholder-ml-muted transition-colors"
                />
                <button type="submit" className="absolute right-0 top-0 bottom-0 px-3 text-ml-muted hover:text-ml-blue" aria-label="Buscar">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </form>

            {/* Acciones derecha */}
            <div className="flex items-center gap-1 sm:gap-2 ml-auto shrink-0">
              {estaLogueado ? (
                <>
                  <Link to="/notificaciones" className="relative text-ml-slate hover:text-ml-ink p-2 rounded-xl hover:bg-ml-bg transition-colors" aria-label="Notificaciones">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {notifsNoLeidas > 0 && (
                      <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 ml-grad text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {notifsNoLeidas > 9 ? '9+' : notifsNoLeidas}
                      </span>
                    )}
                  </Link>
                  <Link to="/favoritos" className="hidden sm:flex text-ml-slate hover:text-ml-ink p-2 rounded-xl hover:bg-ml-bg transition-colors" aria-label="Favoritos">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </Link>
                  <Link to="/carrito" className="text-ml-slate hover:text-ml-ink p-2 rounded-xl hover:bg-ml-bg transition-colors" aria-label="Carrito">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </Link>
                  {/* Avatar */}
                  <div ref={refUsuario} className="relative">
                    <button
                      onClick={() => toggleMenu('usuario')}
                      className="flex items-center gap-2 p-1 rounded-xl hover:bg-ml-bg transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full ml-grad flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                        {usuario?.nombre?.charAt(0).toUpperCase()}
                      </div>
                      <span className="hidden md:block text-ml-slate text-sm font-semibold max-w-[100px] truncate">
                        {usuario?.nombre?.split(' ')[0]}
                      </span>
                      <svg className="w-3 h-3 text-ml-muted hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {menuUsuario && (
                      <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-white rounded-xl shadow-2xl border border-ml-line2 overflow-hidden z-50">
                        <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                          <p className="font-semibold text-ml-ink truncate">{usuario?.nombre}</p>
                          <p className="text-xs text-ml-muted truncate">{usuario?.email}</p>
                        </div>
                        <div className="py-1">
                          <Link to="/mi-cuenta" onClick={() => setMenuUsuario(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink font-semibold hover:bg-ml-bg border-b border-ml-line2">
                            <svg className="w-4 h-4 text-ml-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                            ⚙️ Mi Cuenta
                          </Link>
                          <Link to="/chat" onClick={() => setMenuUsuario(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                            <svg className="w-4 h-4 text-ml-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                            Mensajes
                          </Link>
                          <Link to="/mis-ordenes" onClick={() => setMenuUsuario(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                            <svg className="w-4 h-4 text-ml-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                            Mis pedidos
                          </Link>
                          <Link to="/favoritos" onClick={() => setMenuUsuario(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                            <svg className="w-4 h-4 text-ml-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                            Favoritos
                          </Link>
                          <Link to="/mis-disputas" onClick={() => setMenuUsuario(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                            <svg className="w-4 h-4 text-ml-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                            Mis reclamos
                          </Link>
                          {/* Verticales en acordeón: plegadas por defecto para que el menú
                              no se haga eterno. El usuario expande solo la que necesita. */}
                          <GrupoMenu id="radar" titulo="Radar del Centro" abierto={grupoMenu === 'radar'} onToggle={toggleGrupoMenu}>
                            <Link to="/mis-canjes" onClick={cerrarMenuUsuario} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                              🎟️ Mis canjes
                            </Link>
                            <Link to="/comercio" onClick={cerrarMenuUsuario} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                              🏬 Mi comercio
                            </Link>
                          </GrupoMenu>
                          <GrupoMenu id="servicios" titulo="Servicios profesionales" abierto={grupoMenu === 'servicios'} onToggle={toggleGrupoMenu}>
                            <Link to="/servicios" onClick={cerrarMenuUsuario} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                              🔧 Buscar servicios
                            </Link>
                            <Link to="/servicios/mi-perfil" onClick={cerrarMenuUsuario} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                              💼 Mi perfil profesional
                            </Link>
                            <Link to="/servicios/panel" onClick={cerrarMenuUsuario} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                              📋 Solicitudes recibidas
                            </Link>
                            <Link to="/trabajos" onClick={cerrarMenuUsuario} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                              📣 Bolsa de trabajo
                            </Link>
                            <Link to="/trabajos/mis-publicaciones" onClick={cerrarMenuUsuario} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                              🗂️ Mis publicaciones
                            </Link>
                          </GrupoMenu>
                          <GrupoMenu id="comisionistas" titulo="Comisionistas / Envíos" abierto={grupoMenu === 'comisionistas'} onToggle={toggleGrupoMenu}>
                            <Link to="/comisionistas" onClick={cerrarMenuUsuario} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                              🚚 Buscar viajes
                            </Link>
                            <Link to="/comisionistas/mi-perfil" onClick={cerrarMenuUsuario} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                              🧳 Mi perfil de comisionista
                            </Link>
                            <Link to="/comisionistas/mis-envios" onClick={cerrarMenuUsuario} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                              📦 Mis envíos
                            </Link>
                            <Link to="/comisionistas/mis-cotizaciones" onClick={cerrarMenuUsuario} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                              🚚 Mis cotizaciones
                            </Link>
                          </GrupoMenu>
                          <GrupoMenu id="remis" titulo="Remis" abierto={grupoMenu === 'remis'} onToggle={toggleGrupoMenu}>
                            <Link to="/remis" onClick={cerrarMenuUsuario} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                              🚕 Pedir un remis
                            </Link>
                            <Link to="/remis/mis-viajes" onClick={cerrarMenuUsuario} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                              🧳 Mis viajes
                            </Link>
                            <Link to="/remis/conductor" onClick={cerrarMenuUsuario} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                              🧑‍✈️ Conducir (panel)
                            </Link>
                          </GrupoMenu>
                          {esVendedor && (
                            <GrupoMenu id="vendedor" titulo="Vendedor" abierto={grupoMenu === 'vendedor'} onToggle={toggleGrupoMenu}>
                              <Link to="/publicar" onClick={cerrarMenuUsuario} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-blue font-medium hover:bg-blue-50">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                                Publicar producto
                              </Link>
                              <Link to="/mi-tienda" onClick={cerrarMenuUsuario} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                                <svg className="w-4 h-4 text-ml-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                                Mi tienda
                              </Link>
                              <Link to="/pedidos-vendedor" onClick={cerrarMenuUsuario} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                                <svg className="w-4 h-4 text-ml-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                                Mis ventas
                              </Link>
                              <Link to="/central-vendedor" onClick={cerrarMenuUsuario} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                                <svg className="w-4 h-4 text-ml-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                                Central vendedor
                              </Link>
                            </GrupoMenu>
                          )}
                          {esAdmin && (
                            <>
                              <div className="border-t my-1 mx-3 border-ml-line2"></div>
                              <Link to="/admin" onClick={cerrarMenuUsuario} className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 font-medium hover:bg-red-50">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                Panel Admin
                              </Link>
                            </>
                          )}
                          <div className="border-t my-1 mx-3 border-ml-line2"></div>
                          <Link to="/privacidad-datos" onClick={() => setMenuUsuario(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">
                            <svg className="w-4 h-4 text-ml-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                            Privacidad y mis datos
                          </Link>
                          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-ml-muted hover:bg-ml-bg">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                            Cerrar sesión
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-ml-slate hover:text-ml-ink text-xs sm:text-sm font-semibold px-2 sm:px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                    <span className="hidden sm:inline">Ingresar</span>
                    <span className="sm:hidden">Entrar</span>
                  </Link>
                  <Link to="/registro" className="mlbtn ml-grad text-white text-xs sm:text-sm font-bold px-3 sm:px-5 py-2 rounded-xl transition-all whitespace-nowrap shadow-sm">
                    <span className="hidden sm:inline">Creá tu cuenta</span>
                    <span className="sm:hidden">Registrarse</span>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Buscador mobile */}
          <form onSubmit={buscar} className="sm:hidden mt-2">
            <div className="relative">
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar productos..."
                className="w-full px-3 py-2 pr-10 rounded-xl border border-ml-line text-ml-ink text-sm focus:ring-2 focus:ring-ml-purple/25 focus:border-ml-purple/40 outline-none bg-ml-bg placeholder-ml-muted"
              />
              <button type="submit" className="absolute right-0 top-0 bottom-0 px-3 text-ml-muted" aria-label="Buscar">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </header>

      {/* ===== NAV SECUNDARIO ===== */}
      <nav className="bg-white/85 backdrop-blur-md border-b border-ml-line2 sticky top-[52px] sm:top-[52px] z-40 hidden md:block">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center h-10 text-[13px] gap-1">
            {/* Categorías dropdown */}
            <div ref={refCategorias} className="relative">
              <button
                onClick={() => toggleMenu('categorias')}
                className="flex items-center gap-1.5 text-ml-ink hover:text-ml-blue font-medium px-3 py-1.5 rounded-md hover:bg-ml-bg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Categorías
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {menuCategorias && (
                <div className="absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-ml-line2 overflow-hidden py-1 z-50">
                  {CATEGORIAS_NAV.map(cat => (
                    <Link
                      key={cat.slug}
                      to={`/catalogo?categoria=${cat.slug}`}
                      onClick={() => setMenuCategorias(false)}
                      className="block px-4 py-2 text-sm text-ml-ink hover:bg-blue-50 hover:text-ml-blue"
                    >
                      {cat.nombre}
                    </Link>
                  ))}
                  <div className="border-t my-1"></div>
                  <Link to="/catalogo" onClick={() => setMenuCategorias(false)} className="block px-4 py-2 text-sm text-ml-blue font-medium hover:bg-blue-50">
                    Ver todo el catálogo
                  </Link>
                </div>
              )}
            </div>

            <span className="text-gray-200">|</span>

            <Link to="/catalogo" className="text-ml-soft hover:text-ml-blue font-medium px-3 py-1.5 rounded-md hover:bg-ml-bg transition-colors whitespace-nowrap">
              Catálogo
            </Link>
            <Link to="/tiendas" className="text-ml-soft hover:text-ml-blue font-medium px-3 py-1.5 rounded-md hover:bg-ml-bg transition-colors whitespace-nowrap">
              Tiendas
            </Link>
            <Link to="/usados" className="text-ml-soft hover:text-ml-blue font-medium px-3 py-1.5 rounded-md hover:bg-ml-bg transition-colors whitespace-nowrap">
              Usados
            </Link>
            <Link to="/ofertas" className="text-ml-violet hover:text-ml-purple font-semibold px-3 py-1.5 rounded-md hover:bg-ml-bg transition-colors whitespace-nowrap">
              Ofertas
            </Link>
            <Link to="/mas-vendidos" className="text-ml-soft hover:text-ml-blue font-medium px-3 py-1.5 rounded-md hover:bg-ml-bg transition-colors whitespace-nowrap">
              Más vendidos
            </Link>

            {/* "Más": agrupa los verticales secundarios para no recargar la barra */}
            <div ref={refMas} className="relative">
              <button
                onClick={() => toggleMenu('mas')}
                className="flex items-center gap-1 text-ml-soft hover:text-ml-blue font-medium px-3 py-1.5 rounded-md hover:bg-ml-bg transition-colors whitespace-nowrap"
              >
                Más
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {menuMas && (
                <div className="absolute left-0 mt-1 w-52 bg-white rounded-lg shadow-xl border border-ml-line2 overflow-hidden py-1 z-50">
                  <Link to="/radar" onClick={() => setMenuMas(false)} className="block px-4 py-2.5 text-sm text-ml-ink hover:bg-blue-50 hover:text-ml-blue">📍 Radar del Centro</Link>
                  <Link to="/servicios" onClick={() => setMenuMas(false)} className="block px-4 py-2.5 text-sm text-ml-ink hover:bg-blue-50 hover:text-ml-blue">🔧 Servicios profesionales</Link>
                  <Link to="/comisionistas" onClick={() => setMenuMas(false)} className="block px-4 py-2.5 text-sm text-ml-ink hover:bg-blue-50 hover:text-ml-blue">🚚 Envíos y comisionistas</Link>
                </div>
              )}
            </div>

            {estaLogueado && esVendedor && (
              <>
                <span className="text-gray-200">|</span>
                <div ref={refVendedor} className="relative">
                  <button
                    onClick={() => toggleMenu('vendedor')}
                    className="flex items-center gap-1.5 text-ml-soft hover:text-ml-blue font-medium px-3 py-1.5 rounded-md hover:bg-ml-bg transition-colors"
                  >
                    Vender
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {menuVendedor && (
                    <div className="absolute left-0 mt-1 w-64 bg-white rounded-xl shadow-2xl border border-ml-line2 overflow-hidden z-50">
                      <div className="py-1">
                        <Link to="/publicar" onClick={() => setMenuVendedor(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-ml-bg">
                          <svg className="w-4 h-4 text-ml-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                          <span className="font-medium text-ml-ink">Publicar producto</span>
                        </Link>
                        <Link to="/dashboard-vendedor" onClick={() => setMenuVendedor(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-ml-bg">
                          <svg className="w-4 h-4 text-ml-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                          <span className="text-ml-ink">Dashboard</span>
                        </Link>
                        <Link to="/mi-tienda" onClick={() => setMenuVendedor(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-ml-bg">
                          <svg className="w-4 h-4 text-ml-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                          <span className="text-ml-ink">Mis publicaciones</span>
                        </Link>
                        <Link to="/pedidos-vendedor" onClick={() => setMenuVendedor(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-ml-bg">
                          <svg className="w-4 h-4 text-ml-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                          <span className="text-ml-ink">Ventas</span>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Comprador sin tienda: invitación a empezar a vender (cuenta unificada) */}
            {estaLogueado && !esVendedor && (
              <>
                <span className="text-gray-200">|</span>
                <Link to="/mi-tienda" className="flex items-center gap-1.5 text-ml-blue hover:text-blue-700 font-semibold px-3 py-1.5 rounded-md hover:bg-blue-50 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                  Vendé
                </Link>
              </>
            )}

            {estaLogueado && (
              <>
                <span className="text-gray-200">|</span>
                <div ref={refCompras} className="relative">
                  <button
                    onClick={() => toggleMenu('compras')}
                    className="flex items-center gap-1.5 text-ml-soft hover:text-ml-blue font-medium px-3 py-1.5 rounded-md hover:bg-ml-bg transition-colors"
                  >
                    Mis compras
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {menuCompras && (
                    <div className="absolute left-0 mt-1 w-52 bg-white rounded-lg shadow-xl border border-ml-line2 overflow-hidden py-1 z-50">
                      <Link to="/mis-ordenes" onClick={() => setMenuCompras(false)} className="block px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">Mis pedidos</Link>
                      <Link to="/favoritos" onClick={() => setMenuCompras(false)} className="block px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">Favoritos</Link>
                      <Link to="/carrito" onClick={() => setMenuCompras(false)} className="block px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">Carrito</Link>
                      <Link to="/mis-disputas" onClick={() => setMenuCompras(false)} className="block px-4 py-2.5 text-sm text-ml-ink hover:bg-ml-bg">Mis reclamos</Link>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="ml-auto">
              <Link to="/ayuda" className="text-ml-muted hover:text-ml-blue font-medium px-3 py-1.5 rounded-md hover:bg-ml-bg transition-colors">
                Ayuda
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ===== MENÚ MOBILE ===== */}
      {menuMobile && (
        <div className="md:hidden fixed inset-0 z-50 top-[96px] sm:top-[52px]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuMobile(false)} />
          <div className="relative bg-white w-72 max-w-[80vw] h-full overflow-y-auto shadow-2xl animate-slide-in-left">
            <div className="py-3">
              {/* Explorar: lo básico del marketplace, siempre visible y plano. */}
              <p className="px-4 py-2 text-[10px] text-ml-muted uppercase font-semibold tracking-wider">Explorar</p>
              <Link to="/catalogo" className="block px-4 py-3 text-ml-ink font-medium hover:bg-ml-bg">Catálogo completo</Link>
              <Link to="/tiendas" className="block px-4 py-3 text-ml-ink font-medium hover:bg-ml-bg">Tiendas</Link>
              <Link to="/usados" className="block px-4 py-3 text-ml-ink font-medium hover:bg-ml-bg">Usados</Link>
              <Link to="/ofertas" className="block px-4 py-3 text-ml-violet font-semibold hover:bg-ml-bg">Ofertas</Link>
              <Link to="/mas-vendidos" className="block px-4 py-3 text-ml-ink font-medium hover:bg-ml-bg">Más vendidos</Link>

              {/* Verticales y categorías en acordeón para no alargar el menú. */}
              <GrupoMenu id="categorias" titulo="Categorías" abierto={grupoMobile === 'categorias'} onToggle={toggleGrupoMobile}>
                {CATEGORIAS_NAV.map(cat => (
                  <Link key={cat.slug} to={`/catalogo?categoria=${cat.slug}`} className="block px-4 py-3 text-ml-ink hover:bg-ml-bg">
                    {cat.nombre}
                  </Link>
                ))}
              </GrupoMenu>

              <GrupoMenu id="radar" titulo="Radar del Centro" abierto={grupoMobile === 'radar'} onToggle={toggleGrupoMobile}>
                <Link to="/radar" className="block px-4 py-3 text-ml-ink hover:bg-ml-bg">📍 Ver Radar del Centro</Link>
                {estaLogueado && (
                  <>
                    <Link to="/mis-canjes" className="block px-4 py-3 text-ml-ink hover:bg-ml-bg">🎟️ Mis canjes</Link>
                    <Link to="/comercio" className="block px-4 py-3 text-ml-ink hover:bg-ml-bg">🏬 Mi comercio</Link>
                  </>
                )}
              </GrupoMenu>

              <GrupoMenu id="servicios" titulo="Servicios profesionales" abierto={grupoMobile === 'servicios'} onToggle={toggleGrupoMobile}>
                <Link to="/servicios" className="block px-4 py-3 text-ml-ink hover:bg-ml-bg">🔧 Buscar servicios</Link>
                <Link to="/trabajos" className="block px-4 py-3 text-ml-ink hover:bg-ml-bg">📣 Bolsa de trabajo</Link>
                {estaLogueado && (
                  <>
                    <Link to="/servicios/mi-perfil" className="block px-4 py-3 text-ml-ink hover:bg-ml-bg">💼 Mi perfil profesional</Link>
                    <Link to="/servicios/panel" className="block px-4 py-3 text-ml-ink hover:bg-ml-bg">📋 Solicitudes recibidas</Link>
                    <Link to="/trabajos/mis-publicaciones" className="block px-4 py-3 text-ml-ink hover:bg-ml-bg">🗂️ Mis publicaciones</Link>
                  </>
                )}
              </GrupoMenu>

              <GrupoMenu id="comisionistas" titulo="Comisionistas / Envíos" abierto={grupoMobile === 'comisionistas'} onToggle={toggleGrupoMobile}>
                <Link to="/comisionistas" className="block px-4 py-3 text-ml-ink hover:bg-ml-bg">🚚 Buscar viajes</Link>
                {estaLogueado && (
                  <>
                    <Link to="/comisionistas/mi-perfil" className="block px-4 py-3 text-ml-ink hover:bg-ml-bg">🧳 Mi perfil de comisionista</Link>
                    <Link to="/comisionistas/mis-envios" className="block px-4 py-3 text-ml-ink hover:bg-ml-bg">📦 Mis envíos</Link>
                    <Link to="/comisionistas/mis-cotizaciones" className="block px-4 py-3 text-ml-ink hover:bg-ml-bg">🚚 Mis cotizaciones</Link>
                  </>
                )}
              </GrupoMenu>

              {estaLogueado && (
                <GrupoMenu id="remis" titulo="Remis" abierto={grupoMobile === 'remis'} onToggle={toggleGrupoMobile}>
                  <Link to="/remis" className="block px-4 py-3 text-ml-ink hover:bg-ml-bg">🚕 Pedir un remis</Link>
                  <Link to="/remis/mis-viajes" className="block px-4 py-3 text-ml-ink hover:bg-ml-bg">🧳 Mis viajes</Link>
                  <Link to="/remis/conductor" className="block px-4 py-3 text-ml-ink hover:bg-ml-bg">🧑‍✈️ Conducir (panel)</Link>
                </GrupoMenu>
              )}

              {estaLogueado && esVendedor && (
                <GrupoMenu id="vendedor" titulo="Vendedor" abierto={grupoMobile === 'vendedor'} onToggle={toggleGrupoMobile}>
                  <Link to="/publicar" className="block px-4 py-3 text-ml-blue font-medium hover:bg-blue-50">Publicar producto</Link>
                  <Link to="/mi-tienda" className="block px-4 py-3 text-ml-ink hover:bg-ml-bg">Mi tienda</Link>
                  <Link to="/pedidos-vendedor" className="block px-4 py-3 text-ml-ink hover:bg-ml-bg">Mis ventas</Link>
                  <Link to="/central-vendedor" className="block px-4 py-3 text-ml-ink hover:bg-ml-bg">Central vendedor</Link>
                </GrupoMenu>
              )}

              {/* Comprador sin tienda: invitación a vender (cuenta unificada) */}
              {estaLogueado && !esVendedor && (
                <Link to="/mi-tienda" className="block px-4 py-3 mt-2 text-ml-blue font-semibold hover:bg-blue-50">
                  Vendé — abrí tu tienda
                </Link>
              )}

              <div className="border-t my-2 mx-3"></div>
              <Link to="/ayuda" className="block px-4 py-3 text-ml-soft hover:bg-ml-bg">Centro de ayuda</Link>

              {!estaLogueado && (
                <>
                  <div className="border-t my-2 mx-3"></div>
                  <div className="px-4 py-3 space-y-2">
                    <Link to="/login" className="block w-full text-center py-2.5 text-sm text-ml-blue font-semibold border border-ml-line rounded-xl hover:bg-ml-bg">
                      Ingresá
                    </Link>
                    <Link to="/registro" className="block w-full text-center py-2.5 text-sm text-white font-bold ml-grad rounded-xl shadow-sm">
                      Creá tu cuenta
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
