import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { useSocket } from '../hooks/useSocket'

const CATEGORIAS_NAV = [
  { nombre: 'Tecnología', slug: 'tecnologia' },
  { nombre: 'Moda', slug: 'moda' },
  { nombre: 'Hogar', slug: 'hogar' },
  { nombre: 'Deportes', slug: 'deportes' },
]

export default function Navbar() {
  const { usuario, estaLogueado, esVendedor, esAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [busqueda, setBusqueda] = useState('')
  const [menuVendedor, setMenuVendedor] = useState(false)
  const [menuUsuario, setMenuUsuario] = useState(false)
  const [menuCompras, setMenuCompras] = useState(false)
  const [menuCategorias, setMenuCategorias] = useState(false)
  const [menuMobile, setMenuMobile] = useState(false)
  const [notifsNoLeidas, setNotifsNoLeidas] = useState(0)
  const refVendedor = useRef<HTMLDivElement>(null)
  const refUsuario = useRef<HTMLDivElement>(null)
  const refCompras = useRef<HTMLDivElement>(null)
  const refCategorias = useRef<HTMLDivElement>(null)

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
    const handler = () => {
      setNotifsNoLeidas(prev => prev + 1)
    }
    on('notificacion', handler)
    on('pago:aprobado', handler)
    on('venta:confirmada', handler)
    on('orden:estado', handler)
    return () => {
      off('notificacion')
      off('pago:aprobado')
      off('venta:confirmada')
      off('orden:estado')
    }
  }, [estaLogueado, usuario?._id, on, off])

  // Cerrar menú mobile al cambiar de ruta
  useEffect(() => { setMenuMobile(false) }, [location.pathname])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (refVendedor.current && !refVendedor.current.contains(e.target as Node)) setMenuVendedor(false)
      if (refUsuario.current && !refUsuario.current.contains(e.target as Node)) setMenuUsuario(false)
      if (refCompras.current && !refCompras.current.contains(e.target as Node)) setMenuCompras(false)
      if (refCategorias.current && !refCategorias.current.contains(e.target as Node)) setMenuCategorias(false)
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
  function toggleMenu(cual: 'vendedor' | 'usuario' | 'compras' | 'categorias') {
    setMenuVendedor(cual === 'vendedor' ? v => !v : false)
    setMenuUsuario(cual === 'usuario' ? v => !v : false)
    setMenuCompras(cual === 'compras' ? v => !v : false)
    setMenuCategorias(cual === 'categorias' ? v => !v : false)
  }

  return (
    <>
      {/* ===== TOP BAR ===== */}
      <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5">
          <div className="flex items-center gap-3">
            {/* Hamburger mobile */}
            <button
              onClick={() => setMenuMobile(!menuMobile)}
              className="md:hidden text-white/80 hover:text-white p-1"
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
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-white tracking-tight">MercadoLocal</span>
            </Link>

            {/* Buscador */}
            <form onSubmit={buscar} className="flex-1 max-w-2xl hidden sm:block">
              <div className="relative">
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar productos, marcas y más..."
                  className="w-full px-4 py-2 pr-10 rounded-lg border-0 text-gray-800 text-sm focus:ring-2 focus:ring-white/30 outline-none bg-white/95 placeholder-gray-400"
                />
                <button type="submit" className="absolute right-0 top-0 bottom-0 px-3 text-gray-400 hover:text-blue-600" aria-label="Buscar">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </form>

            {/* Acciones derecha */}
            <div className="flex items-center gap-1 sm:gap-2 ml-auto">
              {estaLogueado ? (
                <>
                  <Link to="/notificaciones" className="relative text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Notificaciones">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {notifsNoLeidas > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {notifsNoLeidas > 9 ? '9+' : notifsNoLeidas}
                      </span>
                    )}
                  </Link>
                  <Link to="/favoritos" className="hidden sm:flex text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Favoritos">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </Link>
                  <Link to="/carrito" className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Carrito">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </Link>
                  {/* Avatar */}
                  <div ref={refUsuario} className="relative">
                    <button
                      onClick={() => toggleMenu('usuario')}
                      className="flex items-center gap-2 p-1 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-semibold border border-white/30">
                        {usuario?.nombre?.charAt(0).toUpperCase()}
                      </div>
                      <span className="hidden md:block text-white/90 text-sm font-medium max-w-[100px] truncate">
                        {usuario?.nombre?.split(' ')[0]}
                      </span>
                      <svg className="w-3 h-3 text-white/60 hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {menuUsuario && (
                      <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50">
                        <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                          <p className="font-semibold text-gray-900 truncate">{usuario?.nombre}</p>
                          <p className="text-xs text-gray-500 truncate">{usuario?.email}</p>
                        </div>
                        <div className="py-1">
                          <Link to="/mis-ordenes" onClick={() => setMenuUsuario(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                            Mis pedidos
                          </Link>
                          <Link to="/favoritos" onClick={() => setMenuUsuario(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                            Favoritos
                          </Link>
                          <Link to="/mis-disputas" onClick={() => setMenuUsuario(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                            Mis reclamos
                          </Link>
                          {esVendedor && (
                            <>
                              <div className="border-t my-1 mx-3 border-gray-100"></div>
                              <p className="px-4 pt-2 pb-1 text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Vendedor</p>
                              <Link to="/publicar" onClick={() => setMenuUsuario(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-blue-600 font-medium hover:bg-blue-50">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                                Publicar producto
                              </Link>
                              <Link to="/mi-tienda" onClick={() => setMenuUsuario(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                                Mi tienda
                              </Link>
                              <Link to="/pedidos-vendedor" onClick={() => setMenuUsuario(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                                Mis ventas
                              </Link>
                              <Link to="/central-vendedor" onClick={() => setMenuUsuario(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                                Central vendedor
                              </Link>
                            </>
                          )}
                          {esAdmin && (
                            <>
                              <div className="border-t my-1 mx-3 border-gray-100"></div>
                              <Link to="/admin" onClick={() => setMenuUsuario(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 font-medium hover:bg-red-50">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                Panel Admin
                              </Link>
                            </>
                          )}
                          <div className="border-t my-1 mx-3 border-gray-100"></div>
                          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50">
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
                  <Link to="/login" className="text-white/80 hover:text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors hidden sm:block">
                    Ingresá
                  </Link>
                  <Link to="/registro" className="bg-white text-indigo-700 text-sm font-semibold px-4 py-1.5 rounded-lg hover:bg-white/90 transition-colors">
                    Creá tu cuenta
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
                className="w-full px-3 py-2 pr-10 rounded-lg border-0 text-gray-800 text-sm focus:ring-2 focus:ring-white/30 outline-none bg-white/95 placeholder-gray-400"
              />
              <button type="submit" className="absolute right-0 top-0 bottom-0 px-3 text-gray-400" aria-label="Buscar">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </header>

      {/* ===== NAV SECUNDARIO ===== */}
      <nav className="bg-white border-b border-gray-200 sticky top-[52px] sm:top-[52px] z-40 hidden md:block">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center h-10 text-[13px] gap-1">
            {/* Categorías dropdown */}
            <div ref={refCategorias} className="relative">
              <button
                onClick={() => toggleMenu('categorias')}
                className="flex items-center gap-1.5 text-gray-700 hover:text-blue-600 font-medium px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
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
                <div className="absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden py-1 z-50">
                  {CATEGORIAS_NAV.map(cat => (
                    <Link
                      key={cat.slug}
                      to={`/catalogo?categoria=${cat.slug}`}
                      onClick={() => setMenuCategorias(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                    >
                      {cat.nombre}
                    </Link>
                  ))}
                  <div className="border-t my-1"></div>
                  <Link to="/catalogo" onClick={() => setMenuCategorias(false)} className="block px-4 py-2 text-sm text-blue-600 font-medium hover:bg-blue-50">
                    Ver todo el catálogo
                  </Link>
                </div>
              )}
            </div>

            <span className="text-gray-200">|</span>

            <Link to="/catalogo" className="text-gray-600 hover:text-blue-600 font-medium px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors">
              Catálogo
            </Link>
            <Link to="/mas-vendidos" className="text-gray-600 hover:text-blue-600 font-medium px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors">
              Más vendidos
            </Link>

            {estaLogueado && esVendedor && (
              <>
                <span className="text-gray-200">|</span>
                <div ref={refVendedor} className="relative">
                  <button
                    onClick={() => toggleMenu('vendedor')}
                    className="flex items-center gap-1.5 text-gray-600 hover:text-blue-600 font-medium px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Vender
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {menuVendedor && (
                    <div className="absolute left-0 mt-1 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50">
                      <div className="py-1">
                        <Link to="/publicar" onClick={() => setMenuVendedor(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50">
                          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                          <span className="font-medium text-gray-800">Publicar producto</span>
                        </Link>
                        <Link to="/dashboard-vendedor" onClick={() => setMenuVendedor(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50">
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                          <span className="text-gray-700">Dashboard</span>
                        </Link>
                        <Link to="/mi-tienda" onClick={() => setMenuVendedor(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50">
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                          <span className="text-gray-700">Mis publicaciones</span>
                        </Link>
                        <Link to="/pedidos-vendedor" onClick={() => setMenuVendedor(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50">
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                          <span className="text-gray-700">Ventas</span>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {estaLogueado && (
              <>
                <span className="text-gray-200">|</span>
                <div ref={refCompras} className="relative">
                  <button
                    onClick={() => toggleMenu('compras')}
                    className="flex items-center gap-1.5 text-gray-600 hover:text-blue-600 font-medium px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Mis compras
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {menuCompras && (
                    <div className="absolute left-0 mt-1 w-52 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden py-1 z-50">
                      <Link to="/mis-ordenes" onClick={() => setMenuCompras(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">Mis pedidos</Link>
                      <Link to="/favoritos" onClick={() => setMenuCompras(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">Favoritos</Link>
                      <Link to="/carrito" onClick={() => setMenuCompras(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">Carrito</Link>
                      <Link to="/mis-disputas" onClick={() => setMenuCompras(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">Mis reclamos</Link>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="ml-auto">
              <Link to="/ayuda" className="text-gray-500 hover:text-blue-600 font-medium px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors">
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
              <p className="px-4 py-2 text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Explorar</p>
              <Link to="/catalogo" className="block px-4 py-3 text-gray-800 font-medium hover:bg-gray-50">Catálogo completo</Link>
              <Link to="/mas-vendidos" className="block px-4 py-3 text-gray-800 font-medium hover:bg-gray-50">Más vendidos</Link>

              <p className="px-4 py-2 mt-2 text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Categorías</p>
              {CATEGORIAS_NAV.map(cat => (
                <Link key={cat.slug} to={`/catalogo?categoria=${cat.slug}`} className="block px-4 py-3 text-gray-700 hover:bg-gray-50">
                  {cat.nombre}
                </Link>
              ))}

              {estaLogueado && esVendedor && (
                <>
                  <p className="px-4 py-2 mt-2 text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Vendedor</p>
                  <Link to="/publicar" className="block px-4 py-3 text-blue-600 font-medium hover:bg-blue-50">Publicar producto</Link>
                  <Link to="/mi-tienda" className="block px-4 py-3 text-gray-700 hover:bg-gray-50">Mi tienda</Link>
                  <Link to="/pedidos-vendedor" className="block px-4 py-3 text-gray-700 hover:bg-gray-50">Mis ventas</Link>
                  <Link to="/central-vendedor" className="block px-4 py-3 text-gray-700 hover:bg-gray-50">Central vendedor</Link>
                </>
              )}

              <div className="border-t my-2 mx-3"></div>
              <Link to="/ayuda" className="block px-4 py-3 text-gray-600 hover:bg-gray-50">Centro de ayuda</Link>

              {!estaLogueado && (
                <>
                  <div className="border-t my-2 mx-3"></div>
                  <div className="px-4 py-3 space-y-2">
                    <Link to="/login" className="block w-full text-center py-2.5 text-sm text-blue-600 font-medium border border-blue-600 rounded-lg hover:bg-blue-50">
                      Ingresá
                    </Link>
                    <Link to="/registro" className="block w-full text-center py-2.5 text-sm text-white font-medium bg-blue-600 rounded-lg hover:bg-blue-700">
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
