import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { DashboardAdmin as DashboardData } from '../types'

// ===================== TIPOS =====================
interface Usuario {
  _id: string; email: string; nombre: string; rol: string; activo: boolean; createdAt: string
}
interface Tienda {
  _id: string; nombre: string; ciudad: string; tipo: string; calificacion: number
  totalVentas: number; ganancias: number; activo: boolean; usuarioId: { nombre: string; email: string }
}
interface Producto {
  _id: string; nombre: string; precio: number; stock: number; totalVentas: number
  activo: boolean; tiendaId: { nombre: string; ciudad: string }; createdAt: string
}
interface Orden {
  _id: string; total: number; comision: number; estado: string
  nombreComprador: string; direccionEntrega: string; createdAt: string
  items: { nombre: string; cantidad: number; precioUnitario: number }[]
}
interface ConfigItem {
  _id: string; clave: string; valor: string
  tipo: 'texto' | 'numero' | 'boolean' | 'imagen' | 'html' | 'color'
  categoria: string; descripcion: string
}

type Seccion = 'inicio' | 'usuarios' | 'vendedores' | 'productos' | 'ordenes' | 'config'

const SECCIONES: { id: Seccion; nombre: string; icono: string }[] = [
  { id: 'inicio', nombre: 'Inicio', icono: '🏠' },
  { id: 'usuarios', nombre: 'Usuarios', icono: '👥' },
  { id: 'vendedores', nombre: 'Vendedores', icono: '🏪' },
  { id: 'productos', nombre: 'Productos', icono: '🛒' },
  { id: 'ordenes', nombre: 'Órdenes', icono: '📦' },
  { id: 'config', nombre: 'Configuración', icono: '⚙️' },
]

export default function DashboardAdmin() {
  const navigate = useNavigate()
  const [seccion, setSeccion] = useState<Seccion>('inicio')
  const [menuAbierto, setMenuAbierto] = useState(false)

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 min-h-screen">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">👑 Admin Panel</h2>
          <p className="text-xs text-gray-400 mt-1">MercadoLocal</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {SECCIONES.map(s => (
            <button
              key={s.id}
              onClick={() => setSeccion(s.id)}
              className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-colors text-sm font-medium ${
                seccion === s.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-lg">{s.icono}</span>
              {s.nombre}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <button onClick={() => navigate('/catalogo')} className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:text-blue-600">
            ← Volver al sitio
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b z-50 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setMenuAbierto(!menuAbierto)} className="text-2xl">&#9776;</button>
        <span className="font-bold text-gray-800">👑 Admin</span>
        <span className="text-lg">{SECCIONES.find(s => s.id === seccion)?.icono}</span>
      </div>

      {/* Mobile menu overlay */}
      {menuAbierto && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMenuAbierto(false)}>
          <div className="w-64 bg-white h-full p-4 space-y-1" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4 px-4">👑 Admin Panel</h2>
            {SECCIONES.map(s => (
              <button
                key={s.id}
                onClick={() => { setSeccion(s.id); setMenuAbierto(false) }}
                className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium ${
                  seccion === s.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
                }`}
              >
                <span className="text-lg">{s.icono}</span>
                {s.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 md:p-8 p-4 pt-16 md:pt-8 overflow-auto">
        {seccion === 'inicio' && <SeccionInicio />}
        {seccion === 'usuarios' && <SeccionUsuarios />}
        {seccion === 'vendedores' && <SeccionVendedores />}
        {seccion === 'productos' && <SeccionProductos />}
        {seccion === 'ordenes' && <SeccionOrdenes />}
        {seccion === 'config' && <SeccionConfig />}
      </main>
    </div>
  )
}

// ===================== INICIO =====================
function SeccionInicio() {
  const [stats, setStats] = useState<DashboardData | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    api.get('/admin/dashboard').then(r => setStats(r.data)).catch(console.error).finally(() => setCargando(false))
  }, [])

  if (cargando) return <Cargando />
  if (!stats) return <p className="text-gray-500">Error cargando datos</p>

  const cards = [
    { t: 'Ventas Totales', v: `$${stats.totalVentas.toLocaleString()}`, c: 'from-green-400 to-green-600', i: '💰' },
    { t: 'Comisiones (tu ganancia)', v: `$${stats.totalComisiones.toLocaleString()}`, c: 'from-blue-400 to-blue-600', i: '🏦' },
    { t: 'Órdenes', v: stats.totalOrdenes.toString(), c: 'from-purple-400 to-purple-600', i: '📦' },
    { t: 'Productos', v: stats.totalProductos.toString(), c: 'from-orange-400 to-orange-600', i: '🛒' },
    { t: 'Vendedores', v: stats.totalVendedores.toString(), c: 'from-indigo-400 to-indigo-600', i: '🏪' },
    { t: 'Compradores', v: stats.totalCompradores.toString(), c: 'from-pink-400 to-pink-600', i: '👥' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Resumen General</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {cards.map(c => (
          <div key={c.t} className={`bg-gradient-to-r ${c.c} rounded-2xl p-5 text-white shadow-lg`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">{c.t}</p>
                <p className="text-2xl font-bold mt-1">{c.v}</p>
              </div>
              <span className="text-3xl">{c.i}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-700 mb-2">✅ Completadas</h3>
          <p className="text-3xl font-bold text-green-600">{stats.ordenesCompletadas}</p>
          <p className="text-sm text-gray-400">de {stats.totalOrdenes} órdenes</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-700 mb-2">⏳ Pendientes</h3>
          <p className="text-3xl font-bold text-yellow-600">{stats.ordenesPendientes}</p>
          <p className="text-sm text-gray-400">requieren atención</p>
        </div>
      </div>
    </div>
  )
}

// ===================== USUARIOS =====================
function SeccionUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    api.get('/admin/usuarios').then(r => setUsuarios(r.data)).catch(console.error).finally(() => setCargando(false))
  }, [])

  async function toggleActivo(id: string, activo: boolean) {
    try {
      const res = await api.put(`/admin/usuarios/${id}/estado`, { activo: !activo })
      setUsuarios(prev => prev.map(u => u._id === id ? res.data : u))
    } catch (err) { console.error(err) }
  }

  if (cargando) return <Cargando />

  const filtrados = usuarios.filter(u =>
    u.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
    u.email.toLowerCase().includes(filtro.toLowerCase()) ||
    u.rol.includes(filtro.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Usuarios ({usuarios.length})</h1>
      </div>

      <input
        type="text"
        placeholder="Buscar por nombre, email o rol..."
        value={filtro}
        onChange={e => setFiltro(e.target.value)}
        className="w-full mb-4 px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Usuario</th>
              <th className="px-4 py-3 text-left">Rol</th>
              <th className="px-4 py-3 text-left">Registro</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.map(u => (
              <tr key={u._id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{u.nombre}</p>
                  <p className="text-gray-400 text-xs">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    u.rol === 'admin' ? 'bg-red-100 text-red-700' :
                    u.rol === 'vendedor' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>{u.rol}</span>
                </td>
                <td className="px-4 py-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString('es-AR')}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${u.activo ? 'bg-green-500' : 'bg-red-500'}`} />
                </td>
                <td className="px-4 py-3 text-center">
                  {u.rol !== 'admin' && (
                    <button
                      onClick={() => toggleActivo(u._id, u.activo)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium ${
                        u.activo ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                      }`}
                    >
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length === 0 && <p className="text-center py-8 text-gray-400">No se encontraron usuarios</p>}
      </div>
    </div>
  )
}

// ===================== VENDEDORES =====================
function SeccionVendedores() {
  const [tiendas, setTiendas] = useState<Tienda[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    api.get('/admin/vendedores').then(r => setTiendas(r.data)).catch(console.error).finally(() => setCargando(false))
  }, [])

  if (cargando) return <Cargando />

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Vendedores y Tiendas ({tiendas.length})</h1>

      {tiendas.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <p className="text-4xl mb-3">🏪</p>
          <p className="text-gray-500">Todavía no hay vendedores registrados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tiendas.map(t => (
            <div key={t._id} className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-800">{t.nombre}</h3>
                  <p className="text-sm text-gray-400">📍 {t.ciudad} · {t.tipo}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {t.activo ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-400">Ventas</p>
                  <p className="font-bold text-gray-800">{t.totalVentas}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-400">Ganancia</p>
                  <p className="font-bold text-green-600">${t.ganancias?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-400">Rating</p>
                  <p className="font-bold text-yellow-600">⭐ {t.calificacion?.toFixed(1) || '0.0'}</p>
                </div>
              </div>
              {t.usuarioId && typeof t.usuarioId === 'object' && (
                <p className="text-xs text-gray-400 mt-3">Dueño: {t.usuarioId.nombre} ({t.usuarioId.email})</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ===================== PRODUCTOS =====================
function SeccionProductos() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    api.get('/admin/productos').then(r => setProductos(r.data)).catch(console.error).finally(() => setCargando(false))
  }, [])

  async function toggleActivo(id: string, activo: boolean) {
    try {
      const res = await api.put(`/admin/productos/${id}/estado`, { activo: !activo })
      setProductos(prev => prev.map(p => p._id === id ? { ...p, activo: res.data.activo } : p))
    } catch (err) { console.error(err) }
  }

  if (cargando) return <Cargando />

  const filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(filtro.toLowerCase())
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Productos ({productos.length})</h1>

      <input
        type="text"
        placeholder="Buscar producto..."
        value={filtro}
        onChange={e => setFiltro(e.target.value)}
        className="w-full mb-4 px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Producto</th>
              <th className="px-4 py-3 text-left">Tienda</th>
              <th className="px-4 py-3 text-right">Precio</th>
              <th className="px-4 py-3 text-center">Stock</th>
              <th className="px-4 py-3 text-center">Ventas</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.map(p => (
              <tr key={p._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{p.nombre}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {p.tiendaId && typeof p.tiendaId === 'object' ? `${p.tiendaId.nombre}` : '-'}
                </td>
                <td className="px-4 py-3 text-right font-medium text-blue-600">${p.precio.toLocaleString()}</td>
                <td className="px-4 py-3 text-center">{p.stock}</td>
                <td className="px-4 py-3 text-center">{p.totalVentas}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${p.activo ? 'bg-green-500' : 'bg-red-500'}`} />
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActivo(p._id, p.activo)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium ${
                      p.activo ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {p.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length === 0 && <p className="text-center py-8 text-gray-400">No hay productos</p>}
      </div>
    </div>
  )
}

// ===================== ORDENES =====================
function SeccionOrdenes() {
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    api.get('/admin/transacciones').then(r => setOrdenes(r.data)).catch(console.error).finally(() => setCargando(false))
  }, [])

  const ESTADOS: Record<string, { color: string; texto: string }> = {
    pendiente: { color: 'bg-yellow-100 text-yellow-700', texto: 'Pendiente' },
    pagada: { color: 'bg-blue-100 text-blue-700', texto: 'Pagada' },
    enviada: { color: 'bg-purple-100 text-purple-700', texto: 'Enviada' },
    completada: { color: 'bg-green-100 text-green-700', texto: 'Completada' },
    cancelada: { color: 'bg-red-100 text-red-700', texto: 'Cancelada' },
  }

  async function cambiarEstado(id: string, estado: string) {
    try {
      await api.put(`/admin/ordenes/${id}/estado`, { estado })
      setOrdenes(prev => prev.map(o => o._id === id ? { ...o, estado } : o))
    } catch (err) { console.error(err) }
  }

  if (cargando) return <Cargando />

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Órdenes ({ordenes.length})</h1>

      {ordenes.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-gray-500">No hay órdenes todavía</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ordenes.map(o => {
            const est = ESTADOS[o.estado] || ESTADOS.pendiente
            return (
              <div key={o._id} className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-800">Orden #{o._id.slice(-6).toUpperCase()}</p>
                    <p className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleString('es-AR')}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${est.color}`}>{est.texto}</span>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  {o.items?.map((item, i) => (
                    <p key={i} className="text-sm text-gray-600">
                      {item.cantidad}x {item.nombre} - ${item.precioUnitario?.toLocaleString()}
                    </p>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-4 text-sm">
                    <span className="text-gray-500">Total: <strong className="text-gray-800">${o.total?.toLocaleString()}</strong></span>
                    <span className="text-gray-500">Comisión: <strong className="text-green-600">${o.comision?.toLocaleString()}</strong></span>
                  </div>
                  <select
                    value={o.estado}
                    onChange={e => cambiarEstado(o._id, e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="pagada">Pagada</option>
                    <option value="enviada">Enviada</option>
                    <option value="completada">Completada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>

                {o.nombreComprador && (
                  <p className="text-xs text-gray-400 mt-2">👤 {o.nombreComprador} · 📍 {o.direccionEntrega}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ===================== CONFIGURACION =====================
const ICONOS_CAT: Record<string, string> = {
  'General': '⚙️', 'Landing': '🏠', 'Negocio': '💰',
  'Contacto': '📞', 'SEO': '🔍', 'Mensajes': '💬', 'Funcionalidades': '⚡',
}

function SeccionConfig() {
  const [configs, setConfigs] = useState<ConfigItem[]>([])
  const [categoriaActiva, setCategoriaActiva] = useState('General')
  const [cambios, setCambios] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarConfigs()
  }, [])

  async function cargarConfigs() {
    setCargando(true)
    try {
      const res = await api.get('/config')
      setConfigs(res.data)
    } catch {
      try {
        await api.post('/config/inicializar')
        const res = await api.get('/config')
        setConfigs(res.data)
      } catch { console.error('Error cargando configuraciones') }
    } finally { setCargando(false) }
  }

  function handleChange(clave: string, valor: string) {
    setCambios(prev => ({ ...prev, [clave]: valor }))
  }

  function getValor(config: ConfigItem) {
    return cambios[config.clave] !== undefined ? cambios[config.clave] : config.valor
  }

  async function guardarCambios() {
    const arr = Object.entries(cambios).map(([clave, valor]) => ({ clave, valor }))
    if (arr.length === 0) return
    setGuardando(true)
    try {
      await api.put('/config', { cambios: arr })
      setMensaje(`✅ ${arr.length} cambios guardados`)
      setCambios({})
      await cargarConfigs()
    } catch (err: any) {
      setMensaje('❌ Error: ' + (err.response?.data?.error || err.message))
    } finally {
      setGuardando(false)
      setTimeout(() => setMensaje(''), 4000)
    }
  }

  if (cargando) return <Cargando />

  const categorias = [...new Set(configs.map(c => c.categoria))]
  const configsFiltradas = configs.filter(c => c.categoria === categoriaActiva)
  const totalCambios = Object.keys(cambios).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Configuración del Sitio</h1>
          <p className="text-sm text-gray-400">Cambiá textos, colores y funciones fácilmente</p>
        </div>
        {totalCambios > 0 && (
          <button onClick={guardarCambios} disabled={guardando}
            className="px-5 py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50">
            {guardando ? 'Guardando...' : `💾 Guardar (${totalCambios})`}
          </button>
        )}
      </div>

      {mensaje && (
        <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${mensaje.includes('❌') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {mensaje}
        </div>
      )}

      {/* Tabs de categorías */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categorias.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoriaActiva(cat)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 ${
              categoriaActiva === cat ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <span>{ICONOS_CAT[cat] || '📄'}</span>
            {cat}
            {configs.filter(c => c.categoria === cat && cambios[c.clave] !== undefined).length > 0 && (
              <span className="w-2 h-2 bg-orange-400 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Campos */}
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
        {configsFiltradas.map(config => (
          <div key={config._id} className="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
            <label className="block text-sm font-semibold text-gray-700 mb-1">{config.descripcion}</label>
            <p className="text-xs text-gray-400 mb-2">{config.clave}</p>

            {config.tipo === 'boolean' ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleChange(config.clave, getValor(config) === 'true' ? 'false' : 'true')}
                  className={`relative w-14 h-7 rounded-full transition-colors ${getValor(config) === 'true' ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${getValor(config) === 'true' ? 'translate-x-7' : 'translate-x-0.5'}`} />
                </button>
                <span className={`text-sm font-medium ${getValor(config) === 'true' ? 'text-green-600' : 'text-gray-400'}`}>
                  {getValor(config) === 'true' ? 'Activado' : 'Desactivado'}
                </span>
              </div>
            ) : config.tipo === 'color' ? (
              <div className="flex items-center gap-3">
                <input type="color" value={getValor(config) || '#000000'} onChange={e => handleChange(config.clave, e.target.value)}
                  className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer" />
                <input type="text" value={getValor(config)} onChange={e => handleChange(config.clave, e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ) : config.tipo === 'numero' ? (
              <input type="number" value={getValor(config)} onChange={e => handleChange(config.clave, e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
            ) : config.tipo === 'imagen' ? (
              <div className="space-y-2">
                <input type="text" value={getValor(config)} onChange={e => handleChange(config.clave, e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="URL de la imagen" />
                {getValor(config) && <img src={getValor(config)} alt="Preview" className="h-16 rounded-lg object-cover" />}
              </div>
            ) : (
              <input type="text" value={getValor(config)} onChange={e => handleChange(config.clave, e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder={config.descripcion} />
            )}

            {cambios[config.clave] !== undefined && (
              <p className="text-xs text-orange-500 mt-1">⚠️ Modificado (sin guardar)</p>
            )}
          </div>
        ))}
      </div>

      {totalCambios > 0 && (
        <button onClick={guardarCambios} disabled={guardando}
          className="w-full mt-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg disabled:opacity-50">
          {guardando ? 'Guardando...' : `💾 Guardar ${totalCambios} cambio${totalCambios > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  )
}

// ===================== CARGANDO =====================
function Cargando() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="animate-spin text-3xl mb-3">⚙️</div>
        <p className="text-gray-400 text-sm">Cargando...</p>
      </div>
    </div>
  )
}
