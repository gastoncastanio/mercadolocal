import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'

// Páginas
import Landing from './pages/Landing'
import Registro from './pages/Registro'
import Login from './pages/Login'
import CatalogoProductos from './pages/CatalogoProductos'
import DetalleProducto from './pages/DetalleProducto'
import Carrito from './pages/Carrito'
import Checkout from './pages/Checkout'
import MisOrdenes from './pages/MisOrdenes'
import MiTienda from './pages/MiTienda'
import PublicarProducto from './pages/PublicarProducto'
import PedidosVendedor from './pages/PedidosVendedor'
import DashboardAdmin from './pages/DashboardAdmin'
import PagoExitoso from './pages/PagoExitoso'
import PagoFallido from './pages/PagoFallido'
import PagoPendiente from './pages/PagoPendiente'
import Terminos from './pages/Terminos'
import Privacidad from './pages/Privacidad'
import Chat from './pages/Chat'
import MisDisputas from './pages/MisDisputas'
import DisputasAdmin from './pages/DisputasAdmin'
import DashboardVendedor from './pages/DashboardVendedor'
import RecuperarPassword from './pages/RecuperarPassword'
import AdminCMS from './pages/AdminCMS'

// Ruta protegida
function RutaPrivada({ children, roles }: { children: React.ReactNode, roles?: string[] }) {
  const { estaLogueado, usuario, cargando } = useAuth()

  if (cargando) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin text-4xl">🔄</div></div>
  if (!estaLogueado) return <Navigate to="/login" />
  if (roles && usuario && !roles.includes(usuario.rol)) return <Navigate to="/catalogo" />

  return <>{children}</>
}

function ConNavbar({ children }: { children: React.ReactNode }) {
  return <><Navbar />{children}</>
}

function AppContent() {
  return (
    <Router>
      <Routes>
        {/* Públicas */}
        <Route path="/" element={<ConNavbar><Landing /></ConNavbar>} />
        <Route path="/registro" element={<ConNavbar><Registro /></ConNavbar>} />
        <Route path="/login" element={<ConNavbar><Login /></ConNavbar>} />
        <Route path="/catalogo" element={<ConNavbar><CatalogoProductos /></ConNavbar>} />
        <Route path="/producto/:id" element={<ConNavbar><DetalleProducto /></ConNavbar>} />

        {/* Requieren login */}
        <Route path="/carrito" element={<ConNavbar><RutaPrivada><Carrito /></RutaPrivada></ConNavbar>} />
        <Route path="/checkout" element={<ConNavbar><RutaPrivada><Checkout /></RutaPrivada></ConNavbar>} />
        <Route path="/mis-ordenes" element={<ConNavbar><RutaPrivada><MisOrdenes /></RutaPrivada></ConNavbar>} />
        <Route path="/pago-exitoso" element={<ConNavbar><RutaPrivada><PagoExitoso /></RutaPrivada></ConNavbar>} />
        <Route path="/pago-fallido" element={<ConNavbar><RutaPrivada><PagoFallido /></RutaPrivada></ConNavbar>} />
        <Route path="/pago-pendiente" element={<ConNavbar><RutaPrivada><PagoPendiente /></RutaPrivada></ConNavbar>} />

        {/* Solo vendedores */}
        <Route path="/mi-tienda" element={<ConNavbar><RutaPrivada roles={['vendedor', 'admin']}><MiTienda /></RutaPrivada></ConNavbar>} />
        <Route path="/publicar" element={<ConNavbar><RutaPrivada roles={['vendedor', 'admin']}><PublicarProducto /></RutaPrivada></ConNavbar>} />
        <Route path="/pedidos-vendedor" element={<ConNavbar><RutaPrivada roles={['vendedor', 'admin']}><PedidosVendedor /></RutaPrivada></ConNavbar>} />

        {/* Mensajes y disputas */}
        <Route path="/chat" element={<ConNavbar><RutaPrivada><Chat /></RutaPrivada></ConNavbar>} />
        <Route path="/chat/:conversacionId" element={<ConNavbar><RutaPrivada><Chat /></RutaPrivada></ConNavbar>} />
        <Route path="/mis-disputas" element={<ConNavbar><RutaPrivada><MisDisputas /></RutaPrivada></ConNavbar>} />

        {/* Dashboard vendedor */}
        <Route path="/dashboard-vendedor" element={<ConNavbar><RutaPrivada roles={['vendedor', 'admin']}><DashboardVendedor /></RutaPrivada></ConNavbar>} />

        {/* Solo admin - SIN navbar, tiene su propia sidebar */}
        <Route path="/admin" element={<RutaPrivada roles={['admin']}><DashboardAdmin /></RutaPrivada>} />

        {/* Públicas legales */}
        <Route path="/terminos" element={<ConNavbar><Terminos /></ConNavbar>} />
        <Route path="/privacidad" element={<ConNavbar><Privacidad /></ConNavbar>} />
        <Route path="/recuperar-password" element={<ConNavbar><RecuperarPassword /></ConNavbar>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
