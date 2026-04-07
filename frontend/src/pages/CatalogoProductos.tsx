import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { Producto } from '../types'
import TarjetaProducto from '../components/TarjetaProducto'

export default function CatalogoProductos() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [precioMin, setPrecioMin] = useState('')
  const [precioMax, setPrecioMax] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [ordenar, setOrdenar] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarProductos()
  }, [categoria, ordenar])

  async function cargarProductos() {
    setCargando(true)
    try {
      const params: any = {}
      if (busqueda) params.busqueda = busqueda
      if (categoria) params.categoria = categoria
      if (precioMin) params.precioMin = precioMin
      if (precioMax) params.precioMax = precioMax
      if (ciudad) params.ciudad = ciudad
      if (ordenar) params.ordenar = ordenar

      const res = await api.get('/productos', { params })
      setProductos(res.data)
    } catch (error) {
      console.error('Error cargando productos:', error)
    } finally {
      setCargando(false)
    }
  }

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    cargarProductos()
  }

  function limpiarFiltros() {
    setPrecioMin('')
    setPrecioMax('')
    setCiudad('')
    setOrdenar('')
    setCategoria('')
    setBusqueda('')
    setTimeout(() => cargarProductos(), 0)
  }

  const categorias = ['Electrónica', 'Ropa', 'Hogar', 'Alimentos', 'Belleza', 'Deportes', 'Juguetes', 'Otro']

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Catálogo de Productos</h1>
          <p className="text-gray-500 mt-1">Encuentra lo que buscas de tiendas locales</p>
        </div>

        {/* Barra de búsqueda */}
        <form onSubmit={handleBuscar} className="flex gap-3 mb-4">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar productos..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            Buscar
          </button>
          <button
            type="button"
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
            className={`px-4 py-3 rounded-xl font-semibold transition-colors ${
              mostrarFiltros ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Filtros
          </button>
        </form>

        {/* Filtros avanzados */}
        {mostrarFiltros && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Precio mínimo</label>
              <input
                type="number"
                value={precioMin}
                onChange={e => setPrecioMin(e.target.value)}
                placeholder="$0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Precio máximo</label>
              <input
                type="number"
                value={precioMax}
                onChange={e => setPrecioMax(e.target.value)}
                placeholder="$999999"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ciudad</label>
              <input
                type="text"
                value={ciudad}
                onChange={e => setCiudad(e.target.value)}
                placeholder="Ej: Buenos Aires"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ordenar por</label>
              <select
                value={ordenar}
                onChange={e => setOrdenar(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Más recientes</option>
                <option value="precio_asc">Menor precio</option>
                <option value="precio_desc">Mayor precio</option>
                <option value="ventas">Más vendidos</option>
                <option value="calificacion">Mejor calificación</option>
              </select>
            </div>
            <div className="col-span-2 md:col-span-4 flex gap-2">
              <button
                onClick={() => cargarProductos()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
              >
                Aplicar filtros
              </button>
              <button
                onClick={limpiarFiltros}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-200"
              >
                Limpiar
              </button>
            </div>
          </div>
        )}

        {/* Chips de filtros rápidos */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setOrdenar(ordenar === 'ventas' ? '' : 'ventas')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              ordenar === 'ventas' ? 'bg-orange-500 text-white border border-orange-500' : 'bg-white text-gray-600 border border-gray-300 hover:bg-orange-50'
            }`}
          >
            &#x1F525; M&aacute;s vendidos
          </button>
          <button
            onClick={() => setOrdenar(ordenar === 'precio_asc' ? '' : 'precio_asc')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              ordenar === 'precio_asc' ? 'bg-green-600 text-white border border-green-600' : 'bg-white text-gray-600 border border-gray-300 hover:bg-green-50'
            }`}
          >
            &#x1F4B0; Menor precio
          </button>
          <button
            onClick={() => setOrdenar(ordenar === 'precio_desc' ? '' : 'precio_desc')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              ordenar === 'precio_desc' ? 'bg-blue-600 text-white border border-blue-600' : 'bg-white text-gray-600 border border-gray-300 hover:bg-blue-50'
            }`}
          >
            &#x1F4B5; Mayor precio
          </button>
          <button
            onClick={() => { setPrecioMax(precioMax === '50000' ? '' : '50000'); setTimeout(cargarProductos, 0) }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              precioMax === '50000' ? 'bg-emerald-600 text-white border border-emerald-600' : 'bg-white text-gray-600 border border-gray-300 hover:bg-emerald-50'
            }`}
          >
            &#x1F4B3; 3 cuotas sin inter&eacute;s
          </button>
          <button
            onClick={() => setOrdenar(ordenar === 'calificacion' ? '' : 'calificacion')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              ordenar === 'calificacion' ? 'bg-yellow-500 text-white border border-yellow-500' : 'bg-white text-gray-600 border border-gray-300 hover:bg-yellow-50'
            }`}
          >
            &#x2B50; Mejor calificados
          </button>
        </div>

        {/* Categorías */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setCategoria('')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              !categoria ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Todos
          </button>
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoria(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                categoria === cat ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Resultados count */}
        {!cargando && (
          <p className="text-sm text-gray-400 mb-4">{productos.length} productos encontrados</p>
        )}

        {/* Grid de productos */}
        {cargando ? (
          <div className="text-center py-20">
            <div className="animate-spin text-4xl mb-4">&#x1F504;</div>
            <p className="text-gray-500">Cargando productos...</p>
          </div>
        ) : productos.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm">
            <p className="text-5xl mb-4">&#x1F4E6;</p>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No hay productos</h3>
            <p className="text-gray-500 mb-6">Probá con otros filtros o sé el primero en publicar</p>
            <Link
              to="/registro?rol=vendedor"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              Crear Mi Tienda
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {productos.map(producto => (
              <TarjetaProducto key={producto._id} producto={producto} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
