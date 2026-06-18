import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { Producto, Tienda } from '../types'
import { useAuth } from '../context/AuthContext'

interface Plan {
  nombre: string
  ubicacion: string[]
  precios: Record<number, number>
  descripcion: string
  permiteSegmentar?: boolean
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
  metodoPago?: string
  impresiones: number
  impresionesRelevantes?: number
  clicks: number
  segmentoCiudad?: string
  segmentoCategoria?: string
  audiencia?: { categorias?: Record<string, number>; ciudades?: Record<string, number> }
}

const CATEGORIAS = ['Electrónica', 'Ropa', 'Hogar', 'Alimentos', 'Belleza', 'Deportes', 'Juguetes', 'Otro']

function topEntradas(obj?: Record<string, number>, n = 3): [string, number][] {
  if (!obj) return []
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n)
}

export default function PromoverProducto() {
  const { tienda } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [productos, setProductos] = useState<Producto[]>([])
  const [planes, setPlanes] = useState<Record<string, Plan>>({})
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [ciudades, setCiudades] = useState<{ ciudad: string; cantidad: number }[]>([])
  const [productoSel, setProductoSel] = useState('')
  const [planSel, setPlanSel] = useState('basico')
  const [duracionSel, setDuracionSel] = useState(7)
  const [metodoPago, setMetodoPago] = useState<'mercadopago' | 'saldo'>('mercadopago')
  const [segmentoCiudad, setSegmentoCiudad] = useState('')
  const [segmentoCategoria, setSegmentoCategoria] = useState('')
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'nueva' | 'activas'>('nueva')

  const saldo = (tienda as Tienda)?.ganancias || 0

  useEffect(() => {
    if (tienda) cargarDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tienda])

  // Volvemos de Mercado Pago: mostramos el resultado del pago
  useEffect(() => {
    const pago = searchParams.get('pago')
    if (!pago) return
    if (pago === 'ok') { setMensaje('¡Pago aprobado! Tu campaña se activa en unos segundos.'); setTab('activas') }
    else if (pago === 'pendiente') { setMensaje('Tu pago quedó pendiente. La campaña se activará al confirmarse.'); setTab('activas') }
    else if (pago === 'error') { setError('El pago no se completó. Podés intentar de nuevo.') }
    searchParams.delete('pago')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function cargarDatos() {
    try {
      const [planesRes, productosRes, promosRes, ciudadesRes] = await Promise.all([
        api.get('/destacados/planes'),
        api.get('/productos/mis-productos'),
        api.get('/destacados/mis-promociones'),
        api.get('/productos/ciudades').catch(() => ({ data: [] }))
      ])
      setPlanes(planesRes.data)
      setProductos(productosRes.data)
      setPromociones(promosRes.data)
      setCiudades(ciudadesRes.data || [])
      if (productosRes.data.length > 0 && !productoSel) setProductoSel(productosRes.data[0]._id)
    } catch (err) {
      console.error('Error cargando datos:', err)
    }
  }

  async function crearPromocion() {
    if (!productoSel) { setError('Seleccioná un producto'); return }
    setError('')
    setMensaje('')
    setCargando(true)
    try {
      const res = await api.post('/destacados', {
        productoId: productoSel,
        plan: planSel,
        duracionDias: duracionSel,
        metodoPago,
        segmentoCiudad: planActual?.permiteSegmentar ? segmentoCiudad : '',
        segmentoCategoria: planActual?.permiteSegmentar ? segmentoCategoria : ''
      })

      // Pago con Mercado Pago: redirigimos al checkout
      if (res.data.metodoPago === 'mercadopago' && res.data.initPoint) {
        window.location.href = res.data.initPoint
        return
      }

      // Pago con saldo: se activó al instante
      setMensaje(res.data.mensaje)
      await cargarDatos()
      setTab('activas')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear la promoción')
    } finally {
      setCargando(false)
    }
  }

  async function cancelarPromocion(id: string) {
    try {
      await api.delete(`/destacados/${id}`)
      cargarDatos()
    } catch { /* noop */ }
  }

  const planActual = planes[planSel]
  const precioActual = planActual?.precios?.[duracionSel] || 0
  const promosActivas = promociones.filter(p => p.estado === 'activo' && new Date(p.fechaFin) > new Date())
  const saldoInsuficiente = metodoPago === 'saldo' && saldo < precioActual

  const ubicacionLabels: Record<string, string> = {
    catalogo: '📋 Catálogo (primeros puestos)',
    busqueda: '🔍 Resultados de búsqueda',
    publicidad: '📢 Espacios publicitarios',
    banner: '🎯 Banner principal',
    home: '🏠 Destacado en la home'
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-[26px] sm:text-[30px] font-extrabold text-ml-ink">📢 Promocionar productos</h1>
            <p className="text-ml-muted text-sm mt-1">Pauta inteligente: tu anuncio se muestra <span className="font-semibold text-ml-ink">primero y a quien más chance tiene de comprarlo</span>.</p>
          </div>
          <Link to="/central-vendedor" className="text-ml-blue hover:underline text-sm shrink-0">← Volver</Link>
        </div>

        {/* Banner valor pauta inteligente */}
        <div className="rounded-2xl p-4 mb-6 text-white" style={{ background: 'linear-gradient(120deg,#3b32d6,#7c3aed)' }}>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <p className="font-bold text-sm">No es solo aparecer primero</p>
              <p className="text-white/85 text-[13px] leading-snug mt-0.5">
                Estudiamos qué busca cada cliente (lo que mira, busca y compra) y mostramos tu
                producto a los <span className="font-semibold">compradores ideales</span>. Incluso les avisamos
                por notificación cuando sos justo lo que estaban buscando.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-ml-line2 rounded-lg p-1 mb-6">
          <button
            onClick={() => setTab('nueva')}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${tab === 'nueva' ? 'ml-grad text-white shadow-sm' : 'text-ml-soft'}`}
          >
            Nueva campaña
          </button>
          <button
            onClick={() => setTab('activas')}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${tab === 'activas' ? 'ml-grad text-white shadow-sm' : 'text-ml-soft'}`}
          >
            Mis campañas ({promosActivas.length})
          </button>
        </div>

        {mensaje && <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-sm mb-4">{mensaje}</div>}

        {tab === 'nueva' && (
          <div className="space-y-6">
            {/* 1. Producto */}
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-ml-line2">
              <h2 className="font-bold text-ml-ink mb-3">1. Elegí el producto a promocionar</h2>
              {productos.length === 0 ? (
                <p className="text-ml-muted text-sm">No tenés productos publicados. <Link to="/publicar" className="text-ml-blue hover:underline">Publicá uno</Link></p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {productos.map(p => (
                    <button
                      key={p._id}
                      onClick={() => setProductoSel(p._id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                        productoSel === p._id ? 'border-ml-purple bg-ml-purple/5' : 'border-ml-line2 hover:border-ml-line'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-ml-bg shrink-0">
                        {p.imagenes?.[0]
                          ? <img src={p.imagenes[0]} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-xl">📦</div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-ml-ink truncate">{p.nombre}</p>
                        <p className="text-xs text-ml-blue font-bold">${p.precio.toLocaleString('es-AR')}</p>
                      </div>
                      {productoSel === p._id && <span className="text-ml-purple text-lg shrink-0">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Plan */}
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-ml-line2">
              <h2 className="font-bold text-ml-ink mb-3">2. Elegí el plan</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Object.entries(planes).map(([key, plan]) => (
                  <button
                    key={key}
                    onClick={() => setPlanSel(key)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      planSel === key
                        ? key === 'elite' ? 'border-ml-purple bg-ml-purple/5' : key === 'premium' ? 'border-ml-blue bg-ml-blue/5' : 'border-green-500 bg-green-50'
                        : 'border-ml-line2 hover:border-ml-line'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-ml-ink">
                        {key === 'elite' ? '👑' : key === 'premium' ? '⭐' : '📌'} {plan.nombre}
                      </span>
                      {planSel === key && <span className="text-sm">✓</span>}
                    </div>
                    <p className="text-xs text-ml-muted mb-3">{plan.descripcion}</p>
                    <div className="space-y-1">
                      {plan.ubicacion.map(u => (
                        <p key={u} className="text-xs text-ml-soft">{ubicacionLabels[u] || u}</p>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Duración */}
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-ml-line2">
              <h2 className="font-bold text-ml-ink mb-3">3. Elegí la duración</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {planActual && Object.entries(planActual.precios).map(([dias, precio]) => (
                  <button
                    key={dias}
                    onClick={() => setDuracionSel(Number(dias))}
                    className={`p-4 rounded-xl border-2 text-center transition-colors ${
                      duracionSel === Number(dias) ? 'border-ml-purple bg-ml-purple/5' : 'border-ml-line2 hover:border-ml-line'
                    }`}
                  >
                    <p className="font-display text-[24px] font-extrabold text-ml-ink">{dias}</p>
                    <p className="text-xs text-ml-muted mb-2">días</p>
                    <p className="text-sm font-bold text-ml-blue">${(precio as number).toLocaleString('es-AR')}</p>
                    <p className="text-[10px] text-ml-muted">${Math.round((precio as number) / Number(dias)).toLocaleString('es-AR')}/día</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Segmentación (solo premium/elite) */}
            {planActual?.permiteSegmentar && (
              <div className="bg-white rounded-2xl shadow-sm p-5 border border-ml-line2">
                <h2 className="font-bold text-ml-ink mb-1">4. Segmentá tu audiencia <span className="text-ml-muted font-normal text-sm">(opcional)</span></h2>
                <p className="text-xs text-ml-muted mb-3">Enfocá el anuncio en una ciudad o categoría puntual para llegar más afilado.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-ml-soft">Ciudad objetivo</label>
                    <select value={segmentoCiudad} onChange={e => setSegmentoCiudad(e.target.value)}
                      className="mt-1 w-full border border-ml-line2 rounded-lg px-3 py-2 text-sm">
                      <option value="">Todas las ciudades</option>
                      {ciudades.map(c => <option key={c.ciudad} value={c.ciudad}>{c.ciudad} ({c.cantidad})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ml-soft">Categoría objetivo</label>
                    <select value={segmentoCategoria} onChange={e => setSegmentoCategoria(e.target.value)}
                      className="mt-1 w-full border border-ml-line2 rounded-lg px-3 py-2 text-sm">
                      <option value="">Todas las categorías</option>
                      {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Método de pago */}
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-ml-line2">
              <h2 className="font-bold text-ml-ink mb-3">{planActual?.permiteSegmentar ? '5' : '4'}. ¿Cómo querés pagar?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setMetodoPago('mercadopago')}
                  className={`p-4 rounded-xl border-2 text-left transition-colors ${metodoPago === 'mercadopago' ? 'border-ml-blue bg-ml-blue/5' : 'border-ml-line2 hover:border-ml-line'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ml-ink">💳 Mercado Pago</span>
                    {metodoPago === 'mercadopago' && <span>✓</span>}
                  </div>
                  <p className="text-xs text-ml-muted mt-1">Pagás con tarjeta o dinero en cuenta. Disponible siempre.</p>
                </button>
                <button
                  onClick={() => setMetodoPago('saldo')}
                  className={`p-4 rounded-xl border-2 text-left transition-colors ${metodoPago === 'saldo' ? 'border-ml-purple bg-ml-purple/5' : 'border-ml-line2 hover:border-ml-line'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ml-ink">🏦 Saldo de ventas</span>
                    {metodoPago === 'saldo' && <span>✓</span>}
                  </div>
                  <p className="text-xs text-ml-muted mt-1">Disponible: <span className="font-semibold text-ml-ink">${saldo.toLocaleString('es-AR')}</span></p>
                </button>
              </div>
              {saldoInsuficiente && (
                <p className="text-xs text-ml-mp mt-2">Saldo insuficiente para este plan. Pagá con Mercado Pago o elegí una duración menor.</p>
              )}
            </div>

            {/* Resumen y confirmar */}
            <div className="ml-grad rounded-2xl p-5 text-white">
              <h2 className="font-bold text-lg mb-3">Resumen de tu campaña</h2>
              <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                <div>
                  <p className="text-white/70 text-xs">Plan</p>
                  <p className="font-bold">{planActual?.nombre || '-'}</p>
                </div>
                <div>
                  <p className="text-white/70 text-xs">Duración</p>
                  <p className="font-bold">{duracionSel} días</p>
                </div>
                <div>
                  <p className="text-white/70 text-xs">Costo total</p>
                  <p className="font-bold text-xl">${precioActual.toLocaleString('es-AR')}</p>
                </div>
              </div>

              {error && <div className="bg-red-500/20 border border-red-300/30 rounded-lg p-3 text-sm mb-3">{error}</div>}

              <button
                onClick={crearPromocion}
                disabled={cargando || !productoSel || saldoInsuficiente}
                className="w-full py-3 bg-white text-ml-purple rounded-xl font-bold text-base hover:bg-ml-bg transition-colors disabled:opacity-50"
              >
                {cargando ? 'Procesando…'
                  : metodoPago === 'mercadopago'
                    ? `Pagar $${precioActual.toLocaleString('es-AR')} con Mercado Pago`
                    : `Promocionar por $${precioActual.toLocaleString('es-AR')}`}
              </button>
            </div>
          </div>
        )}

        {tab === 'activas' && (
          <div className="space-y-3">
            {promociones.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
                <p className="text-5xl mb-4">📢</p>
                <h3 className="text-lg font-semibold text-ml-ink mb-2">Sin campañas aún</h3>
                <p className="text-ml-muted text-sm">Creá tu primera campaña para destacar tus productos</p>
              </div>
            ) : (
              promociones.map(promo => {
                const activa = promo.estado === 'activo' && new Date(promo.fechaFin) > new Date()
                const pendiente = promo.estado === 'pendiente'
                const diasRestantes = activa ? Math.ceil((new Date(promo.fechaFin).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0
                const ctr = promo.impresiones > 0 ? ((promo.clicks / promo.impresiones) * 100).toFixed(1) : '0'
                const audCat = topEntradas(promo.audiencia?.categorias)
                const audCiu = topEntradas(promo.audiencia?.ciudades)

                return (
                  <div key={promo._id} className={`bg-white rounded-xl shadow-sm p-4 border ${activa ? 'border-green-200' : pendiente ? 'border-amber-200' : 'border-ml-line2'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-ml-bg shrink-0">
                        {promo.productoId?.imagenes?.[0]
                          ? <img src={promo.productoId.imagenes[0]} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-ml-ink truncate">{promo.productoId?.nombre || 'Producto'}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            promo.plan === 'elite' ? 'bg-ml-purple/10 text-ml-purple' :
                            promo.plan === 'premium' ? 'bg-ml-blue/10 text-ml-blue' : 'bg-green-100 text-green-700'
                          }`}>
                            {promo.plan === 'elite' ? '👑' : promo.plan === 'premium' ? '⭐' : '📌'} {promo.plan}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${activa ? 'bg-green-100 text-green-700' : pendiente ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-ml-muted'}`}>
                            {activa ? `${diasRestantes}d restantes` : pendiente ? 'Esperando pago' : promo.estado}
                          </span>
                          {promo.metodoPago === 'mercadopago' && <span className="text-[10px] text-ml-muted">💳 MP</span>}
                          {(promo.segmentoCiudad || promo.segmentoCategoria) && (
                            <span className="text-[10px] text-ml-muted">🎯 {[promo.segmentoCiudad, promo.segmentoCategoria].filter(Boolean).join(' · ')}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-ml-ink">${promo.precioTotal.toLocaleString('es-AR')}</p>
                        <p className="text-[10px] text-ml-muted">{promo.duracionDias} días</p>
                      </div>
                    </div>

                    {/* Métricas */}
                    <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-ml-line2 text-center">
                      <div>
                        <p className="text-lg font-bold text-ml-ink">{promo.impresiones.toLocaleString()}</p>
                        <p className="text-[10px] text-ml-muted">Impresiones</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-ml-purple">{(promo.impresionesRelevantes || 0).toLocaleString()}</p>
                        <p className="text-[10px] text-ml-muted">A cliente ideal</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-ml-ink">{promo.clicks.toLocaleString()}</p>
                        <p className="text-[10px] text-ml-muted">Clicks</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-ml-ink">{ctr}%</p>
                        <p className="text-[10px] text-ml-muted">CTR</p>
                      </div>
                    </div>

                    {/* Audiencia (a quién le llegó) */}
                    {(audCat.length > 0 || audCiu.length > 0) && (
                      <div className="mt-3 pt-3 border-t border-ml-line2">
                        <p className="text-[11px] font-semibold text-ml-soft mb-1.5">Tu audiencia (quiénes hicieron clic)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {audCat.map(([k, v]) => (
                            <span key={`c${k}`} className="text-[11px] bg-ml-blue/10 text-ml-blue px-2 py-0.5 rounded-full">📂 {k} · {v}</span>
                          ))}
                          {audCiu.map(([k, v]) => (
                            <span key={`u${k}`} className="text-[11px] bg-ml-purple/10 text-ml-purple px-2 py-0.5 rounded-full">📍 {k} · {v}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {(activa || pendiente) && (
                      <button onClick={() => cancelarPromocion(promo._id)} className="mt-3 text-xs text-ml-mp hover:underline">
                        Cancelar campaña
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
