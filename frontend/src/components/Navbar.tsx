import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function Navbar() {
  const { usuario, estaLogueado, esVendedor, esAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [menuVendedor, setMenuVendedor] = useState(false)
  const [menuUsuario, setMenuUsuario] = useState(false)
  const [menuCompras, setMenuCompras] = useState(false)
  const [menuAyuda, setMenuAyuda] = useState(false)
  const [notifsNoLeidas, setNotifsNoLeidas] = useState(0)
  const refVendedor = useRef<HTMLDivElement>(null)
  const refUsuario = useRef<HTMLDivElement>(null)
  const refCompras = useRef<HTMLDivElement>(null)
  const refAyuda = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!estaLogueado) return
    cargarNotifs()
    const interval = setInterval(cargarNotifs, 60000)
    return () => clearInterval(interval)
  }, [estaLogueado])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (refVendedor.current && !refVendedor.current.contains(e.target as Node)) setMenuVendedor(false)
      if (refUsuario.current && !refUsuario.current.contains(e.target as Node)) setMenuUsuario(false)
      if (refCompras.current && !refCompras.current.contains(e.target as Node)) setMenuCompras(false)
      if (refAyuda.current && !refAyuda.current.contains(e.target as Node)) setMenuAyuda(false)
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

  return (
    <>
      {/* Top bar - gradiente azul/púrpura estilo MercadoLocal */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <span className="text-2xl">&#x1F6D2;</span>
              <span className="hidden sm:block text-xl font-bold text-white">
                MercadoLocal
              </span>
            </Link>

            {/* Buscador */}
            <form onSubmit={buscar} className="flex-1 max-w-3xl min-w-0">
              <div className="relative">
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar productos..."
                  className="w-full px-3 sm:px-4 py-2.5 pr-11 rounded-lg border-0 text-gray-800 text-sm sm:text-base focus:ring-2 focus:ring-purple-300 outline-none shadow-sm"
                />
                <button
                  type="submit"
                  className="absolute right-0 top-0 bottom-0 px-3 sm:px-4 text-gray-500 hover:text-blue-600 border-l border-gray-200"
                  aria-label="Buscar"
                >
                  &#x1F50D;
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Secondary nav bar - blanco */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-[64px] sm:top-[68px] z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="flex items-center justify-between h-12 text-sm gap-2">
            {/* Izquierda - navegación */}
            <div className="flex items-center gap-3 sm:gap-5 overflow-x-auto scrollbar-hide min-w-0 flex-1">
              <Link to="/catalogo" className="text-gray-700 hover:text-blue-600 font-medium whitespace-nowrap">
                Cat&aacute;logo
              </Link>
              <Link to="/mas-vendidos" className="text-gray-700 hover:text-blue-600 font-medium whitespace-nowrap">
                &#x1F525; M&aacute;s vendidos
              </Link>
              <Link to="/catalogo?categoria=ofertas" className="text-gray-700 hover:text-blue-600 font-medium whitespace-nowrap">
                Ofertas
              </Link>
              <Link to="/catalogo?categoria=envio-gratis" className="hidden md:block text-gray-700 hover:text-blue-600 font-medium whitespace-nowrap">
                Env&iacute;o gratis
              </Link>
              <Link to="/catalogo?categoria=tendencias" className="hidden md:block text-gray-700 hover:text-blue-600 font-medium whitespace-nowrap">
                Tendencias
              </Link>
              <div ref={refAyuda} className="relative">
                <button
                  onClick={() => { setMenuAyuda(!menuAyuda); setMenuUsuario(false); setMenuVendedor(false); setMenuCompras(false) }}
                  className="flex items-center gap-1 text-gray-700 hover:text-blue-600 font-medium whitespace-nowrap"
                >
                  Ayuda
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5.5 7.5L10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  </svg>
                </button>
                {menuAyuda && (
                  <div className="absolute left-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden py-2 z-50">
                    <Link to="/devoluciones" onClick={() => setMenuAyuda(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                      <span className="text-xl">&#x1F504;</span>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">Pol&iacute;tica de devoluciones</p>
                        <p className="text-xs text-gray-500">Reembolsos en 48 hs</p>
                      </div>
                    </Link>
                    <Link to="/privacidad" onClick={() => setMenuAyuda(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                      <span className="text-xl">&#x1F512;</span>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">Pol&iacute;tica de privacidad</p>
                        <p className="text-xs text-gray-500">C&oacute;mo protegemos tus datos</p>
                      </div>
                    </Link>
                    <Link to="/terminos" onClick={() => setMenuAyuda(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                      <span className="text-xl">&#x1F4C4;</span>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">T&eacute;rminos y condiciones</p>
                        <p className="text-xs text-gray-500">Reglas del marketplace</p>
                      </div>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Derecha - usuario + menús */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {estaLogueado ? (
                <>
                  {/* Vender / Central Vendedor (oculto en mobile, accesible desde menú usuario) */}
                  {esVendedor && (
                    <div ref={refVendedor} className="relative hidden md:block">
                      <button
                        onClick={() => { setMenuVendedor(!menuVendedor); setMenuUsuario(false); setMenuCompras(false) }}
                        className="flex items-center gap-1 text-gray-700 hover:text-blue-600 font-medium whitespace-nowrap"
                      >
                        Vender
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M5.5 7.5L10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                        </svg>
                      </button>
                      {menuVendedor && (
                        <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden">
                          <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b">
                            <p className="text-xs text-gray-500 uppercase font-semibold">Central de Vendedores</p>
                          </div>
                          <div className="py-2">
                            <Link to="/publicar" onClick={() => setMenuVendedor(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                              <span className="text-xl">&#x1F4E6;</span>
                              <div>
                                <p className="font-semibold text-gray-800">Vender un producto</p>
                                <p className="text-xs text-gray-500">Publicar nueva publicaci&oacute;n</p>
                              </div>
                            </Link>
                            <Link to="/dashboard-vendedor" onClick={() => setMenuVendedor(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                              <span className="text-xl">&#x1F4CA;</span>
                              <div>
                                <p className="font-semibold text-gray-800">Resumen</p>
                                <p className="text-xs text-gray-500">M&eacute;tricas y ganancias</p>
                              </div>
                            </Link>
                            <Link to="/mi-tienda" onClick={() => setMenuVendedor(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                              <span className="text-xl">&#x1F4DD;</span>
                              <div>
                                <p className="font-semibold text-gray-800">Mis publicaciones</p>
                                <p className="text-xs text-gray-500">Administrar productos</p>
                              </div>
                            </Link>
                            <Link to="/pedidos-vendedor" onClick={() => setMenuVendedor(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                              <span className="text-xl">&#x1F4B0;</span>
                              <div>
                                <p className="font-semibold text-gray-800">Ventas</p>
                                <p className="text-xs text-gray-500">Pedidos recibidos</p>
                              </div>
                            </Link>
                            <Link to="/chat" onClick={() => setMenuVendedor(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                              <span className="text-xl">&#x2753;</span>
                              <div>
                                <p className="font-semibold text-gray-800">Preguntas</p>
                                <p className="text-xs text-gray-500">Mensajes de clientes</p>
                              </div>
                            </Link>
                            <Link to="/mi-tienda" onClick={() => setMenuVendedor(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                              <span className="text-xl">&#x1F3EA;</span>
                              <div>
                                <p className="font-semibold text-gray-800">Mi p&aacute;gina</p>
                                <p className="text-xs text-gray-500">Perfil de tu tienda</p>
                              </div>
                            </Link>
                            <Link to="/central-vendedor" onClick={() => setMenuVendedor(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                              <span className="text-xl">&#x2B50;</span>
                              <div>
                                <p className="font-semibold text-gray-800">Reputaci&oacute;n</p>
                                <p className="text-xs text-gray-500">Tu nivel como vendedor</p>
                              </div>
                            </Link>
                            <Link to="/promover" onClick={() => setMenuVendedor(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                              <span className="text-xl">&#x1F4E2;</span>
                              <div>
                                <p className="font-semibold text-gray-800">Publicidad</p>
                                <p className="text-xs text-gray-500">Promocionar productos</p>
                              </div>
                            </Link>
                            <Link to="/central-vendedor" onClick={() => setMenuVendedor(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                              <span className="text-xl">&#x1F195;</span>
                              <div>
                                <p className="font-semibold text-gray-800">Novedades</p>
                                <p className="text-xs text-gray-500">Avisos y actualizaciones</p>
                              </div>
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mis compras dropdown (oculto en mobile, accesible desde menú usuario) */}
                  <div ref={refCompras} className="relative hidden md:block">
                    <button
                      onClick={() => { setMenuCompras(!menuCompras); setMenuUsuario(false); setMenuVendedor(false) }}
                      className="flex items-center gap-1 text-gray-700 hover:text-blue-600 font-medium whitespace-nowrap"
                    >
                      Mis compras
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5.5 7.5L10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                      </svg>
                    </button>
                    {menuCompras && (
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden py-2">
                        <Link to="/mis-ordenes" onClick={() => setMenuCompras(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                          <span className="text-xl">&#x1F4E6;</span>
                          <p className="font-semibold text-gray-800">Mis pedidos</p>
                        </Link>
                        <Link to="/favoritos" onClick={() => setMenuCompras(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                          <span className="text-xl">&#x2764;&#xFE0F;</span>
                          <p className="font-semibold text-gray-800">Favoritos</p>
                        </Link>
                        <Link to="/carrito" onClick={() => setMenuCompras(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                          <span className="text-xl">&#x1F6D2;</span>
                          <p className="font-semibold text-gray-800">Carrito</p>
                        </Link>
                        <Link to="/mis-disputas" onClick={() => setMenuCompras(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                          <span className="text-xl">&#x26A0;&#xFE0F;</span>
                          <p className="font-semibold text-gray-800">Mis reclamos</p>
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Notificaciones */}
                  <Link to="/notificaciones" className="relative text-gray-700 hover:text-blue-600" aria-label="Notificaciones">
                    <span className="text-xl">&#x1F514;</span>
                    {notifsNoLeidas > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                        {notifsNoLeidas > 9 ? '9+' : notifsNoLeidas}
                      </span>
                    )}
                  </Link>

                  {/* Favoritos */}
                  <Link to="/favoritos" className="hidden sm:block text-gray-700 hover:text-red-500" aria-label="Favoritos">
                    <span className="text-xl">&#x2764;&#xFE0F;</span>
                  </Link>

                  {/* Carrito */}
                  <Link to="/carrito" className="text-gray-700 hover:text-blue-600 relative" aria-label="Carrito">
                    <span className="text-xl">&#x1F6D2;</span>
                  </Link>

                  {/* Usuario dropdown */}
                  <div ref={refUsuario} className="relative">
                    <button
                      onClick={() => { setMenuUsuario(!menuUsuario); setMenuVendedor(false); setMenuCompras(false) }}
                      className="flex items-center gap-2"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                        {usuario?.nombre?.charAt(0).toUpperCase()}
                      </div>
                      <span className="hidden md:block text-gray-700 font-medium">
                        {usuario?.nombre?.split(' ')[0]}
                      </span>
                    </button>
                    {menuUsuario && (
                      <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden">
                        <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b">
                          <p className="font-semibold text-gray-800 truncate">{usuario?.nombre}</p>
                          <p className="text-xs text-gray-500 truncate">{usuario?.email}</p>
                          <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase font-bold">
                            {usuario?.rol}
                          </span>
                        </div>
                        <div className="py-1">
                          <Link to="/mis-ordenes" onClick={() => setMenuUsuario(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            &#x1F4E6; Mis pedidos
                          </Link>
                          <Link to="/favoritos" onClick={() => setMenuUsuario(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            &#x2764;&#xFE0F; Favoritos
                          </Link>
                          <Link to="/notificaciones" onClick={() => setMenuUsuario(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            &#x1F514; Notificaciones
                            {notifsNoLeidas > 0 && (
                              <span className="ml-2 text-xs bg-red-500 text-white px-1.5 rounded-full">{notifsNoLeidas}</span>
                            )}
                          </Link>
                          <Link to="/carrito" onClick={() => setMenuUsuario(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 md:hidden">
                            &#x1F6D2; Carrito
                          </Link>
                          <Link to="/mis-disputas" onClick={() => setMenuUsuario(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 md:hidden">
                            &#x26A0;&#xFE0F; Mis reclamos
                          </Link>
                          {esVendedor && (
                            <>
                              <div className="border-t my-1"></div>
                              <Link to="/publicar" onClick={() => setMenuUsuario(false)} className="block px-4 py-2 text-sm text-blue-600 font-semibold hover:bg-blue-50 md:hidden">
                                &#x1F4E6; Vender producto
                              </Link>
                              <Link to="/mi-tienda" onClick={() => setMenuUsuario(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 md:hidden">
                                &#x1F3EA; Mi tienda
                              </Link>
                              <Link to="/pedidos-vendedor" onClick={() => setMenuUsuario(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 md:hidden">
                                &#x1F4B0; Mis ventas
                              </Link>
                              <Link to="/central-vendedor" onClick={() => setMenuUsuario(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                &#x1F4CA; Central de vendedores
                              </Link>
                            </>
                          )}
                          {esAdmin && (
                            <>
                              <Link to="/admin" onClick={() => setMenuUsuario(false)} className="block px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-semibold">
                                &#x1F6E1;&#xFE0F; Panel Admin
                              </Link>
                              <Link to="/admin/cms" onClick={() => setMenuUsuario(false)} className="block px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-semibold">
                                &#x1F4DD; CMS
                              </Link>
                            </>
                          )}
                          <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 border-t">
                            &#x1F6AA; Cerrar sesi&oacute;n
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-gray-700 hover:text-blue-600 font-medium">
                    Iniciar sesi&oacute;n
                  </Link>
                  <Link to="/registro" className="px-4 py-1.5 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700">
                    Registrarse
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    </>
  )
}
