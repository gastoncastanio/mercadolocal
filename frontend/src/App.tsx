import { lazy as lazyReact, Suspense, ComponentType } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ConfigProvider } from './context/ConfigContext'
import Navbar from './components/Navbar'
import MarqueeBanner from './components/MarqueeBanner'
import ErrorBoundary from './components/ErrorBoundary'
import { BannerFlotanteInstalar } from './components/InstalarApp'
import BannerConsentimiento from './components/BannerConsentimiento'

// Landing se carga eager (es la primera pagina)
import Landing from './pages/Landing'

// Auto-recuperación de chunks viejos tras un deploy nuevo.
// Cuando se publica una versión nueva en Vercel, los archivos .js de cada
// página cambian de nombre (hash). Si un usuario tenía la app abierta con la
// versión vieja y navega a una página que se carga "lazy", el navegador busca
// el chunk viejo (que ya no existe) y el import falla con un error tipo
// "NotFoundError / The object can not be found here". Para evitar la pantalla
// de error, ante un fallo de import forzamos UN reload completo que trae el
// index.html y los chunks frescos. El flag en sessionStorage evita un loop
// infinito de recargas si el problema fuese otro.
function lazy<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazyReact(async () => {
    try {
      const mod = await factory()
      sessionStorage.removeItem('ml_chunk_reload') // carga OK: resetear el flag
      return mod
    } catch (err) {
      if (!sessionStorage.getItem('ml_chunk_reload')) {
        sessionStorage.setItem('ml_chunk_reload', '1')
        window.location.reload()
        // Devolver una promesa que nunca resuelve: la página se va a recargar.
        return new Promise<{ default: T }>(() => {})
      }
      throw err
    }
  })
}

// Todas las demas paginas se cargan lazy
const Registro = lazy(() => import('./pages/Registro'))
const Login = lazy(() => import('./pages/Login'))
const CatalogoProductos = lazy(() => import('./pages/CatalogoProductos'))
const DetalleProducto = lazy(() => import('./pages/DetalleProducto'))
const Carrito = lazy(() => import('./pages/Carrito'))
const Checkout = lazy(() => import('./pages/Checkout'))
const MisOrdenes = lazy(() => import('./pages/MisOrdenes'))
const MiTienda = lazy(() => import('./pages/MiTienda'))
const PublicarProducto = lazy(() => import('./pages/PublicarProducto'))
const PedidosVendedor = lazy(() => import('./pages/PedidosVendedor'))
const DashboardAdmin = lazy(() => import('./pages/DashboardAdmin'))
const PagoExitoso = lazy(() => import('./pages/PagoExitoso'))
const PagoFallido = lazy(() => import('./pages/PagoFallido'))
const PagoPendiente = lazy(() => import('./pages/PagoPendiente'))
const Terminos = lazy(() => import('./pages/Terminos'))
const Privacidad = lazy(() => import('./pages/Privacidad'))
const Devoluciones = lazy(() => import('./pages/Devoluciones'))
// RecuperarContraseña re-exporta a RecuperarPassword (componente unificado)
const PromoverProducto = lazy(() => import('./pages/PromoverProducto'))
const Chat = lazy(() => import('./pages/Chat'))
const MisDisputas = lazy(() => import('./pages/MisDisputas'))
const DisputasAdmin = lazy(() => import('./pages/DisputasAdmin'))
const DashboardVendedor = lazy(() => import('./pages/DashboardVendedor'))
const RecuperarPassword = lazy(() => import('./pages/RecuperarPassword'))
const AdminCMS = lazy(() => import('./pages/AdminCMS'))
const PautaAdmin = lazy(() => import('./pages/PautaAdmin'))
const Favoritos = lazy(() => import('./pages/Favoritos'))
const Notificaciones = lazy(() => import('./pages/Notificaciones'))
const MasVendidos = lazy(() => import('./pages/MasVendidos'))
const Usados = lazy(() => import('./pages/Usados'))
const Ofertas = lazy(() => import('./pages/Ofertas'))
const CentralVendedor = lazy(() => import('./pages/CentralVendedor'))
const TiendaPublica = lazy(() => import('./pages/TiendaPublica'))
const Ayuda = lazy(() => import('./pages/Ayuda'))
const Soporte = lazy(() => import('./pages/Soporte'))
const SoporteAdmin = lazy(() => import('./pages/SoporteAdmin'))
const ModeracionAdmin = lazy(() => import('./pages/ModeracionAdmin'))
const Cerebro = lazy(() => import('./pages/Cerebro'))
const PropuestasEquipo = lazy(() => import('./pages/PropuestasEquipo'))
const CarritosAbandonados = lazy(() => import('./pages/CarritosAbandonados'))
const MisComprobantes = lazy(() => import('./pages/MisComprobantes'))
const ComprobanteView = lazy(() => import('./pages/ComprobanteView'))
const ConfiguracionFiscal = lazy(() => import('./pages/admin/ConfiguracionFiscal'))
const MisDatosPrivacidad = lazy(() => import('./pages/MisDatosPrivacidad'))
const LibroDeQuejas = lazy(() => import('./pages/LibroDeQuejas'))
const RadarCentro = lazy(() => import('./pages/RadarCentro'))
const MisCanjes = lazy(() => import('./pages/MisCanjes'))
const PanelComercio = lazy(() => import('./pages/PanelComercio'))
const CanjearOferta = lazy(() => import('./pages/CanjearOferta'))
const SolicitudesLegales = lazy(() => import('./pages/admin/SolicitudesLegales'))
const ChatbotSoporte = lazy(() => import('./components/ChatbotSoporte'))

// Servicios Locales (Paso 2)
const ServiciosPage = lazy(() => import('./pages/ServiciosPage'))
const PerfilProfesionalPage = lazy(() => import('./pages/PerfilProfesionalPage'))
const SolicitudServicioPage = lazy(() => import('./pages/SolicitudServicioPage'))
const PanelProfesionalPage = lazy(() => import('./pages/PanelProfesionalPage'))
const MiPerfilProfesionalPage = lazy(() => import('./pages/MiPerfilProfesionalPage'))

// Bolsa de Trabajo Inversa (Paso 2b)
const TrabajosPage = lazy(() => import('./pages/TrabajosPage'))
const PostarTrabajoPage = lazy(() => import('./pages/PostarTrabajoPage'))
const DetalleTrabajoPage = lazy(() => import('./pages/DetalleTrabajoPage'))
const PanelClienteTrabajos = lazy(() => import('./pages/PanelClienteTrabajos'))

// Mi Cuenta (Paso 2.5)
const MiCuentaPage = lazy(() => import('./pages/MiCuentaPage'))

function LoadingSpinner() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="spinner" />
    </div>
  )
}

function RutaPrivada({ children, roles, requiereVendedor }: { children: React.ReactNode, roles?: string[], requiereVendedor?: boolean }) {
  const { estaLogueado, usuario, esVendedor, cargando } = useAuth()

  if (cargando) return <LoadingSpinner />
  if (!estaLogueado) return <Navigate to="/login" />
  // Cuenta unificada: la capacidad de vender se mide por esVendedor (flag
  // tieneVendedor, tener tienda, o rol legacy), NO por el rol exclusivo.
  // Un comprador sin tienda se manda a /mi-tienda para que abra la suya.
  if (requiereVendedor && !esVendedor) return <Navigate to="/mi-tienda" />
  if (roles && usuario && !roles.includes(usuario.rol)) return <Navigate to="/catalogo" />

  return <>{children}</>
}

function ConNavbar({ children }: { children: React.ReactNode }) {
  return <><MarqueeBanner /><Navbar />{children}</>
}

function RutasConBoundary() {
  const location = useLocation()
  return (
    // Boundary por-ruta: si UNA página crashea, mostramos un fallback acotado en
    // el área de contenido y, al navegar a otra ruta, se resetea solo (resetKeys
    // sigue al pathname). Así un error de una página no obliga a recargar toda la
    // app — el boundary de arriba (en App) queda como red de seguridad global.
    <ErrorBoundary inline resetKeys={[location.pathname]}>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Publicas */}
          <Route path="/" element={<ConNavbar><Landing /></ConNavbar>} />
          <Route path="/registro" element={<ConNavbar><Registro /></ConNavbar>} />
          <Route path="/login" element={<ConNavbar><Login /></ConNavbar>} />
          <Route path="/catalogo" element={<ConNavbar><CatalogoProductos /></ConNavbar>} />
          <Route path="/producto/:id" element={<ConNavbar><DetalleProducto /></ConNavbar>} />
          <Route path="/tienda/:id" element={<ConNavbar><TiendaPublica /></ConNavbar>} />
          <Route path="/mas-vendidos" element={<ConNavbar><MasVendidos /></ConNavbar>} />
          <Route path="/usados" element={<ConNavbar><Usados /></ConNavbar>} />
          <Route path="/ofertas" element={<ConNavbar><Ofertas /></ConNavbar>} />

          {/* Requieren login */}
          <Route path="/carrito" element={<ConNavbar><RutaPrivada><Carrito /></RutaPrivada></ConNavbar>} />
          <Route path="/checkout" element={<ConNavbar><RutaPrivada><Checkout /></RutaPrivada></ConNavbar>} />
          <Route path="/mis-ordenes" element={<ConNavbar><RutaPrivada><MisOrdenes /></RutaPrivada></ConNavbar>} />
          <Route path="/pago-exitoso" element={<ConNavbar><RutaPrivada><PagoExitoso /></RutaPrivada></ConNavbar>} />
          <Route path="/pago-fallido" element={<ConNavbar><RutaPrivada><PagoFallido /></RutaPrivada></ConNavbar>} />
          <Route path="/pago-pendiente" element={<ConNavbar><RutaPrivada><PagoPendiente /></RutaPrivada></ConNavbar>} />
          <Route path="/favoritos" element={<ConNavbar><RutaPrivada><Favoritos /></RutaPrivada></ConNavbar>} />
          <Route path="/notificaciones" element={<ConNavbar><RutaPrivada><Notificaciones /></RutaPrivada></ConNavbar>} />

          {/* Tienda: cualquier usuario logueado puede entrar a /mi-tienda
              para abrir la suya (cuenta unificada). El resto requiere ya ser vendedor. */}
          <Route path="/mi-tienda" element={<ConNavbar><RutaPrivada><MiTienda /></RutaPrivada></ConNavbar>} />
          <Route path="/publicar" element={<ConNavbar><RutaPrivada requiereVendedor><PublicarProducto /></RutaPrivada></ConNavbar>} />
          <Route path="/pedidos-vendedor" element={<ConNavbar><RutaPrivada requiereVendedor><PedidosVendedor /></RutaPrivada></ConNavbar>} />
          <Route path="/carritos-abandonados" element={<ConNavbar><RutaPrivada requiereVendedor><CarritosAbandonados /></RutaPrivada></ConNavbar>} />

          {/* Mensajes y disputas */}
          <Route path="/chat" element={<ConNavbar><RutaPrivada><Chat /></RutaPrivada></ConNavbar>} />
          <Route path="/chat/:conversacionId" element={<ConNavbar><RutaPrivada><Chat /></RutaPrivada></ConNavbar>} />
          <Route path="/mis-disputas" element={<ConNavbar><RutaPrivada><MisDisputas /></RutaPrivada></ConNavbar>} />

          {/* Dashboard vendedor */}
          <Route path="/dashboard-vendedor" element={<ConNavbar><RutaPrivada requiereVendedor><DashboardVendedor /></RutaPrivada></ConNavbar>} />
          <Route path="/central-vendedor" element={<ConNavbar><RutaPrivada requiereVendedor><CentralVendedor /></RutaPrivada></ConNavbar>} />
          <Route path="/promover" element={<ConNavbar><RutaPrivada roles={['vendedor', 'admin']}><PromoverProducto /></RutaPrivada></ConNavbar>} />
          <Route path="/mis-comprobantes" element={<ConNavbar><RutaPrivada requiereVendedor><MisComprobantes /></RutaPrivada></ConNavbar>} />
          <Route path="/comprobante/:id" element={<ConNavbar><RutaPrivada><ComprobanteView /></RutaPrivada></ConNavbar>} />
          <Route path="/privacidad-datos" element={<ConNavbar><RutaPrivada><MisDatosPrivacidad /></RutaPrivada></ConNavbar>} />
          <Route path="/libro-de-quejas" element={<ConNavbar><LibroDeQuejas /></ConNavbar>} />
          <Route path="/radar" element={<ConNavbar><RadarCentro /></ConNavbar>} />
          <Route path="/mis-canjes" element={<ConNavbar><RutaPrivada><MisCanjes /></RutaPrivada></ConNavbar>} />
          <Route path="/comercio" element={<ConNavbar><RutaPrivada><PanelComercio /></RutaPrivada></ConNavbar>} />
          <Route path="/comercio/canjear" element={<ConNavbar><RutaPrivada><CanjearOferta /></RutaPrivada></ConNavbar>} />

          {/* Servicios Locales (Paso 2) */}
          <Route path="/servicios" element={<ConNavbar><ServiciosPage /></ConNavbar>} />
          <Route path="/servicios/perfil/:usuarioId" element={<ConNavbar><PerfilProfesionalPage /></ConNavbar>} />
          <Route path="/servicios/solicitud/:profesionalId" element={<ConNavbar><RutaPrivada><SolicitudServicioPage /></RutaPrivada></ConNavbar>} />
          <Route path="/servicios/panel" element={<ConNavbar><RutaPrivada><PanelProfesionalPage /></RutaPrivada></ConNavbar>} />
          <Route path="/servicios/mi-perfil" element={<ConNavbar><RutaPrivada><MiPerfilProfesionalPage /></RutaPrivada></ConNavbar>} />

          {/* Bolsa de Trabajo Inversa (Paso 2b) — rutas estáticas antes de :id */}
          <Route path="/trabajos" element={<ConNavbar><TrabajosPage /></ConNavbar>} />
          <Route path="/trabajos/publicar" element={<ConNavbar><RutaPrivada><PostarTrabajoPage /></RutaPrivada></ConNavbar>} />
          <Route path="/trabajos/mis-publicaciones" element={<ConNavbar><RutaPrivada><PanelClienteTrabajos /></RutaPrivada></ConNavbar>} />
          <Route path="/trabajos/:id" element={<ConNavbar><RutaPrivada><DetalleTrabajoPage /></RutaPrivada></ConNavbar>} />

          {/* Mi Cuenta (Paso 2.5) */}
          <Route path="/mi-cuenta" element={<ConNavbar><RutaPrivada><MiCuentaPage /></RutaPrivada></ConNavbar>} />

          {/* Solo admin */}
          <Route path="/admin" element={<RutaPrivada roles={['admin']}><DashboardAdmin /></RutaPrivada>} />
          <Route path="/admin/cms" element={<ConNavbar><RutaPrivada roles={['admin']}><AdminCMS /></RutaPrivada></ConNavbar>} />
          <Route path="/admin/pauta" element={<ConNavbar><RutaPrivada roles={['admin']}><PautaAdmin /></RutaPrivada></ConNavbar>} />
          <Route path="/admin/configuracion-fiscal" element={<ConNavbar><RutaPrivada roles={['admin']}><ConfiguracionFiscal /></RutaPrivada></ConNavbar>} />
          <Route path="/admin/solicitudes-legales" element={<ConNavbar><RutaPrivada roles={['admin']}><SolicitudesLegales /></RutaPrivada></ConNavbar>} />
          <Route path="/admin/disputas" element={<ConNavbar><RutaPrivada roles={['admin']}><DisputasAdmin /></RutaPrivada></ConNavbar>} />

          {/* Ayuda */}
          <Route path="/ayuda" element={<ConNavbar><Ayuda /></ConNavbar>} />
          <Route path="/soporte" element={<ConNavbar><Soporte /></ConNavbar>} />
          <Route path="/soporte/:ticketId" element={<ConNavbar><Soporte /></ConNavbar>} />
          <Route path="/admin/soporte" element={<ConNavbar><RutaPrivada roles={['admin']}><SoporteAdmin /></RutaPrivada></ConNavbar>} />
          <Route path="/admin/moderacion" element={<ConNavbar><RutaPrivada roles={['admin']}><ModeracionAdmin /></RutaPrivada></ConNavbar>} />
          <Route path="/admin/cerebro" element={<ConNavbar><RutaPrivada roles={['admin']}><Cerebro /></RutaPrivada></ConNavbar>} />
          <Route path="/admin/cerebro/propuestas" element={<ConNavbar><RutaPrivada roles={['admin']}><PropuestasEquipo /></RutaPrivada></ConNavbar>} />

          {/* Publicas legales */}
          <Route path="/terminos" element={<ConNavbar><Terminos /></ConNavbar>} />
          <Route path="/privacidad" element={<ConNavbar><Privacidad /></ConNavbar>} />
          <Route path="/devoluciones" element={<ConNavbar><Devoluciones /></ConNavbar>} />
          <Route path="/recuperar" element={<ConNavbar><RecuperarPassword /></ConNavbar>} />
          <Route path="/recuperar-password" element={<ConNavbar><RecuperarPassword /></ConNavbar>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

function AppContent() {
  return (
    <Router>
      <RutasConBoundary />
      <BannerConsentimiento />
    </Router>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ConfigProvider>
          <AppContent />
          <Suspense fallback={null}>
            <ChatbotSoporte />
          </Suspense>
          <BannerFlotanteInstalar />
        </ConfigProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
