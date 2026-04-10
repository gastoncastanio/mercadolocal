import { useState, useEffect } from 'react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Orden } from '../types'

interface TiendaStats {
  _id: string
  nombre: string
  calificacion: number
  totalVentas: number
  ganancias: number
}

export default function DashboardVendedor() {
  const { tienda } = useAuth()
  const [stats, setStats] = useState<TiendaStats | null>(null)
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    try {
      const [tiendaRes, ordenesRes] = await Promise.all([
        api.get('/tienda/mi-tienda'),
        api.get('/ordenes/vendedor'),
      ])
      setStats(tiendaRes.data)
      setOrdenes(ordenesRes.data)
    } catch (error) {
      console.error('Error cargando dashboard:', error)
    } finally {
      setCargando(false)
    }
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin text-4xl">🔄</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Error cargando dashboard</p>
      </div>
    )
  }

  // Solo contar órdenes con pago confirmado
  const ordenesPorEnviar = ordenes.filter(o => o.estado === 'pagada').length

  // Calcular ventas reales desde las órdenes pagadas (no desde stats que podrían estar desactualizados)
  const ventasReales = ordenes.reduce((sum, o) => sum + o.total, 0)
  const comisionesReales = ordenes.reduce((sum, o) => sum + o.comision, 0)
  const gananciasReales = ventasReales - comisionesReales

  const cards = [
    { titulo: 'Ventas Confirmadas', valor: `$${ventasReales.toLocaleString()}`, icono: '💰', color: 'from-green-400 to-green-600' },
    { titulo: 'Ganancias Netas', valor: `$${gananciasReales.toLocaleString()}`, icono: '📈', color: 'from-blue-400 to-blue-600' },
    { titulo: 'Ventas Totales', valor: ordenes.length.toString(), icono: '📦', color: 'from-purple-400 to-purple-600' },
    { titulo: 'Por Enviar', valor: ordenesPorEnviar.toString(), icono: '🕐', color: ordenesPorEnviar > 0 ? 'from-red-400 to-pink-500' : 'from-gray-300 to-gray-400' },
    { titulo: 'Calificación', valor: (stats.calificacion || 0).toFixed(1), icono: '⭐', color: 'from-yellow-400 to-orange-500' },
  ]

  // Simple last 7 days sales chart
  const hoy = new Date()
  const ultimos7Dias = Array.from({ length: 7 }, (_, i) => {
    const dia = new Date(hoy)
    dia.setDate(hoy.getDate() - (6 - i))
    return dia
  })

  const ventasPorDia = ultimos7Dias.map((dia) => {
    const diaStr = dia.toISOString().split('T')[0]
    // Solo contar ventas con pago confirmado (el endpoint ya filtra solo pagadas)
    const ventasDelDia = ordenes.filter((o) => {
      if (!o.createdAt) return false
      return o.createdAt.split('T')[0] === diaStr
    })
    return {
      label: dia.toLocaleDateString('es', { weekday: 'short' }),
      total: ventasDelDia.reduce((acc, o) => acc + o.total, 0),
    }
  })

  const maxVenta = Math.max(...ventasPorDia.map((v) => v.total), 1)

  const ordenesRecientes = ordenes.slice(0, 5)

  const estadoColor: Record<string, string> = {
    pendiente: 'text-yellow-600 bg-yellow-50',
    pagada: 'text-blue-600 bg-blue-50',
    enviada: 'text-purple-600 bg-purple-50',
    completada: 'text-green-600 bg-green-50',
    cancelada: 'text-red-600 bg-red-50',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          🏪 Dashboard - {tienda?.nombre || stats.nombre}
        </h1>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {cards.map((card) => (
            <div
              key={card.titulo}
              className={`bg-gradient-to-r ${card.color} rounded-2xl p-5 text-white shadow-lg`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-80">{card.titulo}</p>
                  <p className="text-2xl font-bold mt-1">{card.valor}</p>
                </div>
                <span className="text-3xl">{card.icono}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar chart */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Ventas - Ultimos 7 dias</h3>
            <div className="flex items-end gap-3 h-48">
              {ventasPorDia.map((dia, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                  <p className="text-xs text-gray-500 mb-1">
                    {dia.total > 0 ? `$${dia.total.toLocaleString()}` : ''}
                  </p>
                  <div
                    className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all"
                    style={{
                      height: `${dia.total > 0 ? (dia.total / maxVenta) * 100 : 4}%`,
                      minHeight: '4px',
                    }}
                  />
                  <p className="text-xs text-gray-400 mt-2 capitalize">{dia.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent orders */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Ordenes Recientes</h3>
            {ordenesRecientes.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No hay ordenes aun</p>
            ) : (
              <div className="space-y-3">
                {ordenesRecientes.map((orden) => (
                  <div
                    key={orden._id}
                    className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        #{orden._id.slice(-8)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {orden.items.length} producto{orden.items.length !== 1 ? 's' : ''} ·{' '}
                        {orden.createdAt
                          ? new Date(orden.createdAt).toLocaleDateString()
                          : ''}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <span className="font-semibold text-gray-800">
                        ${orden.total.toLocaleString()}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          estadoColor[orden.estado] || 'text-gray-600 bg-gray-50'
                        }`}
                      >
                        {orden.estado}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
