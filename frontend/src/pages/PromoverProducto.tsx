import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { Producto, Tienda } from '../types'
import { useAuth } from '../context/AuthContext'

interface Plan {
  nombre: string
  ubicacion: string[]
  precios: Record<number, number>
  descripcion: string
}

interface Promocion {
  _id: string
  productoId: { _id: string; nombre: string; precio: number; imagenes: string[] }
  plan: string
  duracionDias: number
  precioTotal: number
  fechaInicio: string
  fechaFin: string
  estado: string
  impresiones: number
  clicks: number
}

export default function PromoverProducto() {
  const { tienda } = useAuth()
  const [productos, setProductos] = useState<Producto[]>([])
  const [planes, setPlanes] = useState<Record<string, Plan>>({})
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [productoSel, setProductoSel] = useState('')
  const [planSel, setPlanSel] = useState('basico')
  const [duracionSel, setDuracionSel] = useState(7)
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'nueva' | 'activas'>('nueva')

  useEffect(() => {
    if (tienda) cargarDatos()
  }, [tienda])

  async function cargarDatos() {
    try {
      const [planesRes, productosRes, promosRes] = await Promise.all([
        api.get('/destacados/planes'),
        api.get(`/productos?tiendaId=${(tienda as Tienda)._id}`),
        api.get('/destacados/mis-promociones')
      ])
      setPlanes(planesRes.data)
      setProductos(productosRes.data)
      setPromociones(promosRes.data)
      if (productosRes.data.length > 0 && !productoSel) setProductoSel(productosRes.data[0]._id)
    } catch (err: any) {
      console.error('Error cargando datos:', err)
    }
  }

  async function crearPromocion() {
    if (!productoSel) { setError('Seleccion\u00e1 un producto'); return }
    setError('')
    setMensaje('')
    setCargando(true)
    try {
      const res = await api.post('/destacados', {
        productoId: productoSel,
        plan: planSel,
        duracionDias: duracionSel
      })
      setMensaje(res.data.mensaje)
      cargarDatos()
      setTab('activas')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear promoci\u00f3n')
    } finally {
      setCargando(false)
    }
  }

  async function cancelarPromocion(id: string) {
    try {
      await api.delete(`/destacados/${id}`)
      cargarDatos()
    } catch {}
  }

  const planActual = planes[planSel]
  const precioActual = planActual?.precios?.[duracionSel] || 0
  const promosActivas = promociones.filter(p => p.estado === 'activo' && new Date(p.fechaFin) > new Date())

  const ubicacionLabels: Record<string, string> = {
    catalogo: '\u{1F4CB} Cat\u00e1logo (1er puesto)',
    busqueda: '\u{1F50D} Resultados de b\u00fasqueda',
    publicidad: '\u{1F4E2} Espacios publicitarios',
    banner: '\u{1F3AF} Banner principal'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">&#x1F4E2; Promocionar productos</h1>
            <p className="text-gray-500 text-sm mt-1">Destac&aacute; tus productos para vender m&aacute;s r&aacute;pido</p>
          </div>
          <Link to="/central-vendedor" className="text-blue-600 hover:underline text-sm">&larr; Volver</Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-200 rounded-lg p-1 mb-6">
          <button
            onClick={() => setTab('nueva')}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${tab === 'nueva' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600'}`}
          >
            Nueva promoci&oacute;n
          </button>
          <button
            onClick={() => setTab('activas')}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${tab === 'activas' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600'}`}
          >
            Mis promociones ({promosActivas.length})
          </button>
        </div>

        {tab === 'nueva' && (
          <div className="space-y-6">
            {/* Seleccionar producto */}
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
              <h2 className="font-bold text-gray-800 mb-3">1. Eleg&iacute; el producto a promocionar</h2>
              {productos.length === 0 ? (
                <p className="text-gray-500 text-sm">No ten&eacute;s productos publicados. <Link to="/publicar" className="text-blue-600 hover:underline">Public&aacute; uno</Link></p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {productos.map(p => (
                    <button
                      key={p._id}
                      onClick={() => setProductoSel(p._id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                        productoSel === p._id ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-300'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        {p.imagenes?.[0] ? (
                          <img src={p.imagenes[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl">&#x1F4E6;</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-gray-800 truncate">{p.nombre}</p>
                        <p className="text-xs text-blue-600 font-bold">${p.precio.toLocaleString('es-AR')}</p>
                      </div>
                      {productoSel === p._id && <span className="text-blue-500 text-lg shrink-0">&#x2705;</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Seleccionar plan */}
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
              <h2 className="font-bold text-gray-800 mb-3">2. Eleg&iacute; el plan</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Object.entries(planes).map(([key, plan]) => (
                  <button
                    key={key}
                    onClick={() => setPlanSel(key)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      planSel === key
                        ? key === 'elite' ? 'border-purple-500 bg-purple-50' : key === 'premium' ? 'border-blue-500 bg-blue-50' : 'border-green-500 bg-green-50'
                        : 'border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-gray-800">
                        {key === 'elite' ? '\u{1F451}' : key === 'premium' ? '\u2B50' : '\u{1F4CC}'} {plan.nombre}
                      </span>
                      {planSel === key && <span className="text-sm">&#x2705;</span>}
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{plan.descripcion}</p>
                    <div className="space-y-1">
                      {plan.ubicacion.map(u => (
                        <p key={u} className="text-xs text-gray-600">{ubicacionLabels[u] || u}</p>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Seleccionar duraci&oacute;n */}
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
              <h2 className="font-bold text-gray-800 mb-3">3. Eleg&iacute; la duraci&oacute;n</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {planActual && Object.entries(planActual.precios).map(([dias, precio]) => (
                  <button
                    key={dias}
                    onClick={() => setDuracionSel(Number(dias))}
                    className={`p-4 rounded-xl border-2 text-center transition-colors ${
                      duracionSel === Number(dias)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-2xl font-bold text-gray-800">{dias}</p>
                    <p className="text-xs text-gray-500 mb-2">d&iacute;as</p>
                    <p className="text-sm font-bold text-blue-600">${(precio as number).toLocaleString('es-AR')}</p>
                    <p className="text-[10px] text-gray-400">${Math.round((precio as number) / Number(dias)).toLocaleString('es-AR')}/d&iacute;a</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Resumen y confirmar */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-5 text-white">
              <h2 className="font-bold text-lg mb-3">Resumen de tu promoci&oacute;n</h2>
              <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                <div>
                  <p className="text-white/70 text-xs">Plan</p>
                  <p className="font-bold">{planActual?.nombre || '-'}</p>
                </div>
                <div>
                  <p className="text-white/70 text-xs">Duraci&oacute;n</p>
                  <p className="font-bold">{duracionSel} d&iacute;as</p>
                </div>
                <div>
                  <p className="text-white/70 text-xs">Costo total</p>
                  <p className="font-bold text-xl">${precioActual.toLocaleString('es-AR')}</p>
                </div>
              </div>
              <p className="text-xs text-white/70 mb-4">
                Se descuenta de tu saldo de ventas acumulado en la plataforma.
              </p>

              {error && <div className="bg-red-500/20 border border-red-300/30 rounded-lg p-3 text-sm mb-3">{error}</div>}
              {mensaje && <div className="bg-green-500/20 border border-green-300/30 rounded-lg p-3 text-sm mb-3">{mensaje}</div>}

              <button
                onClick={crearPromocion}
                disabled={cargando || !productoSel}
                className="w-full py-3 bg-white text-blue-700 rounded-xl font-bold text-base hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {cargando ? 'Procesando...' : `Promocionar por $${precioActual.toLocaleString('es-AR')}`}
              </button>
            </div>
          </div>
        )}

        {tab === 'activas' && (
          <div className="space-y-3">
            {promociones.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
                <p className="text-5xl mb-4">&#x1F4E2;</p>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Sin promociones a&uacute;n</h3>
                <p className="text-gray-500 text-sm">Cre&aacute; tu primera promoci&oacute;n para destacar tus productos</p>
              </div>
            ) : (
              promociones.map(promo => {
                const activa = promo.estado === 'activo' && new Date(promo.fechaFin) > new Date()
                const diasRestantes = activa ? Math.ceil((new Date(promo.fechaFin).getTime() - Date.now()) / (1000*60*60*24)) : 0
                const ctr = promo.impresiones > 0 ? ((promo.clicks / promo.impresiones) * 100).toFixed(1) : '0'

                return (
                  <div key={promo._id} className={`bg-white rounded-xl shadow-sm p-4 border ${activa ? 'border-green-200' : 'border-gray-100'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        {promo.productoId?.imagenes?.[0] ? (
                          <img src={promo.productoId.imagenes[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">&#x1F4E6;</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{promo.productoId?.nombre || 'Producto'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            promo.plan === 'elite' ? 'bg-purple-100 text-purple-700' :
                            promo.plan === 'premium' ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {promo.plan === 'elite' ? '\u{1F451}' : promo.plan === 'premium' ? '\u2B50' : '\u{1F4CC}'} {promo.plan}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${activa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {activa ? `${diasRestantes}d restantes` : promo.estado}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-gray-800">${promo.precioTotal.toLocaleString('es-AR')}</p>
                        <p className="text-[10px] text-gray-400">{promo.duracionDias} d&iacute;as</p>
                      </div>
                    </div>

                    {/* M&eacute;tricas */}
                    <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100 text-center">
                      <div>
                        <p className="text-lg font-bold text-gray-800">{promo.impresiones.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-400">Impresiones</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-800">{promo.clicks.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-400">Clicks</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-800">{ctr}%</p>
                        <p className="text-[10px] text-gray-400">CTR</p>
                      </div>
                    </div>

                    {activa && (
                      <button
                        onClick={() => cancelarPromocion(promo._id)}
                        className="mt-3 text-xs text-red-500 hover:underline"
                      >
                        Cancelar promoci&oacute;n
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
