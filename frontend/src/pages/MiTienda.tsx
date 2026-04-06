import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Producto } from '../types'

export default function MiTienda() {
  const { tienda, actualizarTienda } = useAuth()
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({
    nombre: tienda?.nombre || '',
    descripcion: tienda?.descripcion || '',
    ciudad: tienda?.ciudad || '',
    tipo: tienda?.tipo || 'online',
    telefono: tienda?.telefono || '',
    logo: tienda?.logo || ''
  })
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [previewLogo, setPreviewLogo] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    cargarProductos()
  }, [tienda])

  async function cargarProductos() {
    if (!tienda) { setCargando(false); return }
    try {
      const res = await api.get(`/productos?tiendaId=${tienda._id}`)
      setProductos(res.data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setCargando(false)
    }
  }

  async function subirLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => setPreviewLogo(ev.target?.result as string)
    reader.readAsDataURL(file)

    setSubiendoLogo(true)
    try {
      const formData = new FormData()
      formData.append('imagen', file)
      const res = await api.post('/upload/imagen', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setForm(prev => ({ ...prev, logo: res.data.url }))
    } catch (err: any) {
      alert('Error al subir el logo. Intentá de nuevo.')
      setPreviewLogo(null)
    } finally {
      setSubiendoLogo(false)
    }
  }

  function eliminarLogo() {
    setForm(prev => ({ ...prev, logo: '' }))
    setPreviewLogo(null)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  async function guardarTienda(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (tienda) {
        const res = await api.put('/tienda', form)
        actualizarTienda(res.data)
      } else {
        const res = await api.post('/tienda', form)
        actualizarTienda(res.data)
      }
      setEditando(false)
      setPreviewLogo(null)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al guardar')
    }
  }

  if (!tienda && !editando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-lg p-12 max-w-md">
          <p className="text-5xl mb-4">&#x1F3EA;</p>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Crea tu Tienda</h2>
          <p className="text-gray-500 mb-6">Configura tu tienda para empezar a vender</p>
          <button onClick={() => setEditando(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
            Crear Mi Tienda
          </button>
        </div>
      </div>
    )
  }

  if (editando) {
    const logoSrc = previewLogo || form.logo
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-lg mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">{tienda ? 'Editar' : 'Crear'} Tienda</h1>
          <form onSubmit={guardarTienda} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">

            {/* Logo upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Logo de la tienda</label>
              {logoSrc ? (
                <div className="relative inline-block">
                  <img
                    src={logoSrc}
                    alt="Logo"
                    className="w-32 h-32 rounded-2xl object-cover border-2 border-gray-200"
                  />
                  {subiendoLogo && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-2xl flex items-center justify-center">
                      <div className="text-white font-semibold animate-pulse text-sm">Subiendo...</div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={eliminarLogo}
                    className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 text-sm font-bold"
                  >x</button>
                </div>
              ) : (
                <div
                  onClick={() => logoInputRef.current?.click()}
                  className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <span className="text-3xl mb-1">&#x1F4F7;</span>
                  <span className="text-gray-400 text-xs text-center">Subir logo</span>
                </div>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={subirLogo}
                className="hidden"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la tienda</label>
              <input type="text" required value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
              <input type="text" required value={form.ciudad} onChange={e => setForm({...form, ciudad: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripci&oacute;n</label>
              <textarea value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tel&eacute;fono</label>
              <input type="text" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: +54 11 1234-5678" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="online">Solo Online</option>
                <option value="fisica">Tienda F&iacute;sica</option>
                <option value="ambas">Ambas</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={subiendoLogo} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50">
                {subiendoLogo ? 'Esperando logo...' : 'Guardar'}
              </button>
              <button type="button" onClick={() => { setEditando(false); setPreviewLogo(null) }} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  const logoUrl = tienda?.logo

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Info tienda */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img src={logoUrl} alt={tienda?.nombre} className="w-20 h-20 rounded-2xl object-cover border-2 border-gray-200" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center text-4xl">
                  &#x1F3EA;
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold text-gray-800">{tienda?.nombre}</h1>
                <p className="text-gray-500 mt-1">&#x1F4CD; {tienda?.ciudad} &middot; {tienda?.tipo}</p>
                <p className="text-gray-600 mt-1">{tienda?.descripcion}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Ventas totales</p>
              <p className="text-2xl font-bold text-green-600">${tienda?.ganancias?.toLocaleString() || 0}</p>
              <button onClick={() => { setForm({nombre: tienda?.nombre||'', descripcion: tienda?.descripcion||'', ciudad: tienda?.ciudad||'', tipo: tienda?.tipo||'online', telefono: tienda?.telefono||'', logo: tienda?.logo||''}); setEditando(true) }}
                className="mt-2 text-sm text-blue-600 hover:underline">Editar tienda</button>
            </div>
          </div>
        </div>

        {/* Productos */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">Mis Productos ({productos.length})</h2>
          <Link to="/publicar" className="px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
            + Publicar Producto
          </Link>
        </div>

        {productos.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
            <p className="text-5xl mb-4">&#x1F4E6;</p>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No tienes productos</h3>
            <Link to="/publicar" className="inline-block mt-4 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold">
              Publicar Mi Primer Producto
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {productos.map(p => (
              <div key={p._id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                  {p.imagenes[0] ? <img src={p.imagenes[0]} alt={p.nombre} className="w-full h-full object-cover" /> : <span className="text-4xl">&#x1F4E6;</span>}
                </div>
                <h3 className="font-semibold text-gray-800 truncate">{p.nombre}</h3>
                <p className="text-blue-600 font-bold">${p.precio.toLocaleString()}</p>
                <p className="text-xs text-gray-400">Stock: {p.stock} &middot; Ventas: {p.totalVentas}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
