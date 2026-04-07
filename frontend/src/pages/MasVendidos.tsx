import { useEffect, useState } from 'react'
import api from '../services/api'
import { Producto } from '../types'
import TarjetaProducto from '../components/TarjetaProducto'

export default function MasVendidos() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    try {
      const res = await api.get('/productos?ordenar=ventas&limite=40')
      setProductos(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-8 mb-8 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <span className="text-6xl">&#x1F525;</span>
            <div>
              <h1 className="text-4xl font-bold">M&aacute;s vendidos</h1>
              <p className="mt-2 opacity-90">Los productos que m&aacute;s eligen nuestros compradores</p>
            </div>
          </div>
        </div>

        {cargando ? (
          <div className="text-center py-16">
            <div className="animate-spin text-4xl">&#x1F504;</div>
          </div>
        ) : productos.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm">
            <p className="text-6xl mb-4">&#x1F4E6;</p>
            <h2 className="text-xl font-semibold text-gray-800">A&uacute;n no hay ventas registradas</h2>
            <p className="text-gray-500 mt-2">Vuelve pronto, los rankings se actualizan con cada compra.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {productos.map((p, i) => (
              <div key={p._id} className="relative">
                {i < 3 && (
                  <div className={`absolute -top-2 -left-2 z-10 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg ${
                    i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : 'bg-orange-500'
                  }`}>
                    #{i + 1}
                  </div>
                )}
                <TarjetaProducto producto={p} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
