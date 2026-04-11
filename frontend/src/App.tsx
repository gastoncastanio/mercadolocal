import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import MarqueeBanner from './components/MarqueeBanner'
import PortonPrivado from './components/PortonPrivado'

// Landing se carga eager (es la primera pagina)
import Landing from './pages/Landing'

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
const RecuperarContraseña = lazy(() => import('./pages/RecuperarContraseña'))
const PromoverProducto = lazy(() => import('./pages/PromoverProducto'))
const Chat = lazy(() => import('./pages/Chat'))
const MisDisputas = lazy(() => import('./pages/MisDisputas'))
const DisputasAdmin = lazy(() => import('./pages/DisputasAdmin'))
const DashboardVendedor = lazy(() => import('./pages/DashboardVendedor'))
const RecuperarPassword = lazy(() => import('./pages/RecuperarPassword'))
const AdminCMS = lazy(() => import('./pages/AdminCMS'))
const Favoritos = lazy(() => import('./pages/Favoritos'))
const Notificaciones = lazy(() => import('./pages/Notificaciones'))
const MasVendidos = lazy(() => import('./pages/MasVendidos'))
const CentralVendedor = lazy(() => import('./pages/CentralVendedor'))
const TiendaPublica = lazy(() => import('./pages/TiendaPublica'))
const Ayuda = lazy(() => import('./pages/Ayuda'))
const CarritosAbandonados = lazy(() => import('./pages/CarritosAbandonados'))
const ChatbotSoporte = lazy(() => import('./components/ChatbotSoporte'))

function LoadingSpinner() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="spinner" />
    </div>
  )
}

function RutaPrivada({ children, roles }: { children: React.ReactNode, roles?: string[] }) {
  const { estaLogueado, usuario, cargando } = useAuth()

  if (cargando) return <LoadingSpinner />
  if (!estaLogueado) return <Navigate to="/login" />
  if (roles && usuario && !roles.includes(usuario.rol)) return <Navigate to="/catalogo" />

  return <>{children}</>
}

function ConNavbar({ children }: { children: React.ReactNode }) {
  return <><MarqueeBanner /><Navbar />{children}</>
}

function AppContent() {
  return (
    <Router>
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

          {/* Requieren login */}
          <Route path="/carrito" element={<ConNavbar><RutaPrivada><Carrito /></RutaPrivada></ConNavbar>} />
          <Route path="/checkout" element={<ConNavbar><RutaPrivada><Checkout /></RutaPrivada></ConNavbar>} />
          <Route path="/mis-ordenes" element={<ConNavbar><RutaPrivada><MisOrdenes /></RutaPrivada></ConNavbar>} />
          <Route path="/pago-exitoso" element={<ConNavbar><RutaPrivada><PagoExitoso /></RutaPrivada></ConNavbar>} />
          <Route path="/pago-fallido" element={<ConNavbar><RutaPrivada><PagoFallido /></RutaPrivada></ConNavbar>} />
          <Route path="/pago-pendiente" element={<ConNavbar><RutaPrivada><PagoPendiente /></RutaPrivada></ConNavbar>} />
          <Route path="/favoritos" element={<ConNavbar><RutaPrivada><Favoritos /></RutaPrivada></ConNavbar>} />
          <Route path="/notificaciones" element={<ConNavbar><RutaPrivada><Notificaciones /></RutaPrivada></ConNavbar>} />

          {/* Solo vendedores */}
          <Route path="/mi-tienda" element={<ConNavbar><RutaPrivada roles={['vendedor', 'admin']}><MiTienda /></RutaPrivada></ConNavbar>} />
          <Route path="/publicar" element={<ConNavbar><RutaPrivada roles={['vendedor', 'admin']}><PublicarProducto /></RutaPrivada></ConNavbar>} />
          <Route path="/pedidos-vendedor" element={<ConNavbar><RutaPrivada roles={['vendedor', 'admin']}><PedidosVendedor /></RutaPrivada></ConNavbar>} />
          <Route path="/carritos-abandonados" element={<ConNavbar><RutaPrivada roles={['vendedor', 'admin']}><CarritosAbandonados /></RutaPrivada></ConNavbar>} />

          {/* Mensajes y disputas */}
          <Route path="/chat" element={<ConNavbar><RutaPrivada><Chat /></RutaPrivada></ConNavbar>} />
          <Route path="/chat/:conversacionId" element={<ConNavbar><RutaPrivada><Chat /></RutaPrivada></ConNavbar>} />
          <Route path="/mis-disputas" element={<ConNavbar><RutaPrivada><MisDisputas /></RutaPrivada></ConNavbar>} />

          {/* Dashboard vendedor */}
          <Route path="/dashboard-vendedor" element={<ConNavbar><RutaPrivada roles={['vendedor', 'admin']}><DashboardVendedor /></RutaPrivada></ConNavbar>} />
          <Route path="/central-vendedor" element={<ConNavbar><RutaPrivada roles={['vendedor', 'admin']}><CentralVendedor /></RutaPrivada></ConNavbar>} />
          <Route path="/promover" element={<ConNavbar><RutaPrivada roles={['vendedor', 'admin']}><PromoverProducto /></RutaPrivada></ConNavbar>} />

          {/* Solo admin */}
          <Route path="/admin" element={<RutaPrivada roles={['admin']}><DashboardAdmin /></RutaPrivada>} />
          <Route path="/admin/cms" element={<ConNavbar><RutaPrivada roles={['admin']}><AdminCMS /></RutaPrivada></ConNavbar>} />
          <Route path="/admin/disputas" element={<ConNavbar><RutaPrivada roles={['admin']}><DisputasAdmin /></RutaPrivada></ConNavbar>} />

          {/* Ayuda */}
          <Route path="/ayuda" element={<ConNavbar><Ayuda /></ConNavbar>} />

          {/* Publicas legales */}
          <Route path="/terminos" element={<ConNavbar><Terminos /></ConNavbar>} />
          <Route path="/privacidad" element={<ConNavbar><Privacidad /></ConNavbar>} />
          <Route path="/devoluciones" element={<ConNavbar><Devoluciones /></ConNavbar>} />
          <Route path="/recuperar" element={<Suspense fallback={<LoadingSpinner />}><RecuperarContraseña /></Suspense>} />
          <Route path="/recuperar-password" element={<ConNavbar><RecuperarPassword /></ConNavbar>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </Router>
  )
}

export default function App() {
  return (
    <PortonPrivado>
      <AuthProvider>
        <AppContent />
        <Suspense fallback={null}>
          <ChatbotSoporte />
        </Suspense>
      </AuthProvider>
    </PortonPrivado>
  )
}
