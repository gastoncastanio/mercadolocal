import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function PublicarProducto() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    stock: '1',
    categorias: [] as string[],
    imagenes: [] as string[]
  })
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  const [previewImagen, setPreviewImagen] = useState<string | null>(null)

  const categorias = ['Electrónica', 'Ropa', 'Hogar', 'Alimentos', 'Belleza', 'Deportes', 'Juguetes', 'Otro']

  function toggleCategoria(cat: string) {
    setForm(prev => ({
      ...prev,
      categorias: prev.categorias.includes(cat)
        ? prev.categorias.filter(c => c !== cat)
        : [...prev.categorias, cat]
    }))
  }

  async function subirImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview local
    const reader = new FileReader()
    reader.onload = (ev) => setPreviewImagen(ev.target?.result as string)
    reader.readAsDataURL(file)

    setSubiendoImagen(true)
    try {
      const formData = new FormData()
      formData.append('imagen', file)

      const res = await api.post('/upload/imagen', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setForm(prev => ({ ...prev, imagenes: [res.data.url] }))
    } catch (err: any) {
      setError('Error al subir la imagen. Intentá de nuevo.')
      setPreviewImagen(null)
    } finally {
      setSubiendoImagen(false)
    }
  }

  function eliminarImagen() {
    setForm(prev => ({ ...prev, imagenes: [] }))
    setPreviewImagen(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre || !form.precio) {
      setError('Nombre y precio son obligatorios')
      return
    }

    setCargando(true)
    setError('')

    try {
      await api.post('/productos', {
        ...form,
        precio: Number(form.precio),
        stock: Number(form.stock)
      })
      navigate('/mi-tienda')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al publicar')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-lg mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Publicar Producto</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

          {/* Subida de imagen */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Foto del producto</label>

            {previewImagen || form.imagenes[0] ? (
              <div className="relative">
                <img
                  src={previewImagen || form.imagenes[0]}
                  alt="Preview"
                  className="w-full h-64 object-cover rounded-xl border border-gray-200"
                />
                {subiendoImagen && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-xl flex items-center justify-center">
                    <div className="text-white font-semibold animate-pulse">Subiendo...</div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={eliminarImagen}
                  className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 text-lg font-bold"
                >
                  x
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-48 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <span className="text-4xl mb-2">📷</span>
                <span className="text-gray-500 font-medium">Tocá para subir una foto</span>
                <span className="text-gray-400 text-sm mt-1">JPG, PNG (máx. 5MB)</span>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={subirImagen}
              className="hidden"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del producto *</label>
            <input type="text" required value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nombre del producto" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="Describe tu producto..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio *</label>
              <input type="number" required min="0" step="0.01" value={form.precio} onChange={e => setForm({...form, precio: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
              <input type="number" min="0" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="1" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Categorías</label>
            <div className="flex flex-wrap gap-2">
              {categorias.map(cat => (
                <button key={cat} type="button" onClick={() => toggleCategoria(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    form.categorias.includes(cat) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={cargando || subiendoImagen}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50">
            {cargando ? 'Publicando...' : 'Publicar Producto'}
          </button>
        </form>
      </div>
    </div>
  )
}
