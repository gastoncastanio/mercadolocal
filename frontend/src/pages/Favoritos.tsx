import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { Producto } from '../types'
import TarjetaProducto from '../components/TarjetaProducto'

export default function Favoritos() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    try {
      const res = await api.get('/favoritos')
      setProductos(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  async function quitar(productoId: string) {
    try {
      await api.delete(`/favoritos/${productoId}`)
      setProductos(prev => prev.filter(p => p._id !== productoId))
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">&#x2764;&#xFE0F;</span>
          <h1 className="text-3xl font-bold text-gray-800">Mis Favoritos</h1>
        </div>

        {cargando ? (
          <div className="text-center py-16">
            <div className="animate-spin text-4xl">&#x1F504;</div>
          </div>
        ) : productos.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm">
            <p className="text-6xl mb-4">&#x1F494;</p>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">A&uacute;n no tienes favoritos</h2>
            <p className="text-gray-500 mb-6">Guard&aacute; productos tocando el coraz&oacute;n en cada publicaci&oacute;n.</p>
            <Link to="/catalogo" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700">
              Explorar cat&aacute;logo
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {productos.map(p => (
              <div key={p._id} className="relative">
                <TarjetaProducto producto={p} />
                <button
                  onClick={() => quitar(p._id)}
                  className="absolute top-2 right-2 w-9 h-9 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-red-50 z-10"
                  aria-label="Quitar de favoritos"
                  title="Quitar"
                >
                  <span className="text-lg">&#x2764;&#xFE0F;</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
