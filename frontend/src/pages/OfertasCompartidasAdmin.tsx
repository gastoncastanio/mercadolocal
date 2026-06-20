import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

interface Producto {
  _id: string
  nombre: string
  imagenes: string[]
  precio: number
}

interface Oferta {
  _id: string
  precioOriginal: number
  descuentoPorcentaje: number
  aporteVendedorPct: number
  aportePlataformaPct: number
  precioConDescuento: number
  aporteVendedor: number
  aportePlataforma: number
  presupuestoPlataforma: number
  presupuestoRestante: number
  gastado: number
  finEn: string
  estado: string
  ventasGeneradas: number
  producto?: Producto
  tienda?: { nombre: string }
}

const ESTADOS = ['propuesta', 'activa', 'finalizada', 'rechazada']

export default function OfertasCompartidasAdmin() {
  const navigate = useNavigate()
  const [lista, setLista] = useState<Oferta[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  // Buscador de producto
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Producto[]>([])
  const [buscando, setBuscando] = useState(false)
  const [seleccionado, setSeleccionado] = useState<Producto | null>(null)

  // Formulario
  const [descuento, setDescuento] = useState('15')
  const [aporteVendedor, setAporteVendedor] = useState('50')
  const [presupuesto, setPresupuesto] = useState('10000')
  const [finEn, setFinEn] = useState('')
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => { cargar() }, [filtroEstado])

  async function cargar() {
    setCargando(true)
    try {
      const res = await api.get('/ofertas-compartidas/admin', { params: filtroEstado ? { estado: filtroEstado } : {} })
      setLista(res.data || [])
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error cargando ofertas')
    } finally {
      setCargando(false)
    }
  }

  async function buscarProductos() {
    if (!busqueda.trim()) return
    setBuscando(true)
    try {
      const res = await api.get('/productos', { params: { busqueda: busqueda.trim(), limite: 8 } })
      setResultados(res.data?.productos || res.data || [])
    } catch {
      setResultados([])
    } finally {
      setBuscando(false)
    }
  }

  // Previsualización de los números (espejo del cálculo del backend)
  const preview = (() => {
    if (!seleccionado) return null
    const pct = Number(descuento) || 0
    const aporteVendPct = Number(aporteVendedor) || 0
    const precioFinal = Math.round(seleccionado.precio * (1 - pct / 100))
    const descTotal = seleccionado.precio - precioFinal
    const aporteVend = Math.round(descTotal * aporteVendPct / 100)
    const aportePlat = descTotal - aporteVend
    const presup = Number(presupuesto) || 0
    const ventasCubiertas = aportePlat > 0 ? Math.floor(presup / aportePlat) : 0
    return { precioFinal, descTotal, aporteVend, aportePlat, ventasCubiertas }
  })()

  async function proponer() {
    setError(''); setOk('')
    if (!seleccionado) { setError('Elegí un producto primero'); return }
    if (!finEn) { setError('Indicá la fecha de fin'); return }
    setEnviando(true)
    try {
      await api.post('/ofertas-compartidas/proponer', {
        productoId: seleccionado._id,
        descuentoPorcentaje: Number(descuento),
        aporteVendedorPct: Number(aporteVendedor),
        presupuestoPlataforma: Number(presupuesto),
        finEn,
        notaPlataforma: nota
      })
      setOk(`Propuesta enviada al vendedor de "${seleccionado.nombre}"`)
      setSeleccionado(null); setBusqueda(''); setResultados([]); setNota('')
      await cargar()
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo crear la propuesta')
    } finally {
      setEnviando(false)
    }
  }

  async function finalizar(id: string) {
    if (!confirm('¿Finalizar esta oferta? El precio del producto vuelve al original.')) return
    try {
      await api.post(`/ofertas-compartidas/finalizar/${id}`)
      await cargar()
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo finalizar')
    }
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-[28px] font-extrabold text-ml-ink">🤝 Ofertas Compartidas</h1>
            <p className="text-ml-muted mt-1">Proponé descuentos co-financiados a tus vendedores (se financia desde la comisión).</p>
          </div>
          <button onClick={() => navigate('/admin')} className="px-4 py-2 bg-white border border-ml-line text-ml-soft rounded-xl hover:bg-gray-50 font-medium">← Dashboard</button>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">{error}</p>}
        {ok && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 mb-4">{ok}</p>}

        {/* Crear propuesta */}
        <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 mb-8">
          <h2 className="text-lg font-bold text-ml-ink mb-4">Nueva propuesta</h2>

          {!seleccionado ? (
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-1">Buscar producto</label>
              <div className="flex gap-2">
                <input
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && buscarProductos()}
                  placeholder="Nombre del producto..."
                  className="flex-1 px-4 py-2 border border-ml-line rounded-xl outline-none focus:ring-2 focus:ring-ml-purple/30"
                />
                <button onClick={buscarProductos} disabled={buscando} className="px-5 py-2 mlbtn ml-grad text-white rounded-xl font-bold disabled:opacity-50">
                  {buscando ? '...' : 'Buscar'}
                </button>
              </div>
              {resultados.length > 0 && (
                <div className="mt-3 space-y-2">
                  {resultados.map(p => (
                    <button key={p._id} onClick={() => { setSeleccionado(p); setResultados([]) }} className="w-full flex items-center gap-3 p-2 rounded-lg border border-ml-line hover:bg-ml-bg text-left">
                      {p.imagenes?.[0] && <img src={p.imagenes[0]} alt="" className="w-10 h-10 rounded object-cover" />}
                      <span className="flex-1 text-sm text-ml-ink">{p.nombre}</span>
                      <span className="text-sm font-bold text-ml-violet">${p.precio.toLocaleString('es-AR')}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-4 p-3 bg-ml-bg rounded-lg border border-ml-line">
                {seleccionado.imagenes?.[0] && <img src={seleccionado.imagenes[0]} alt="" className="w-12 h-12 rounded object-cover" />}
                <div className="flex-1">
                  <p className="font-bold text-ml-ink">{seleccionado.nombre}</p>
                  <p className="text-sm text-ml-muted">Precio actual: ${seleccionado.precio.toLocaleString('es-AR')}</p>
                </div>
                <button onClick={() => setSeleccionado(null)} className="text-sm text-red-600 hover:text-red-700">Cambiar</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-ml-ink mb-1">Descuento al comprador (%)</label>
                  <input type="number" min="1" max="90" value={descuento} onChange={e => setDescuento(e.target.value)} className="w-full px-4 py-2 border border-ml-line rounded-xl outline-none focus:ring-2 focus:ring-ml-purple/30" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-ml-ink mb-1">Aporte del vendedor (%)</label>
                  <input type="number" min="0" max="100" value={aporteVendedor} onChange={e => setAporteVendedor(e.target.value)} className="w-full px-4 py-2 border border-ml-line rounded-xl outline-none focus:ring-2 focus:ring-ml-purple/30" />
                  <p className="text-xs text-ml-muted mt-1">El resto ({100 - (Number(aporteVendedor) || 0)}%) lo pone la plataforma.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-ml-ink mb-1">Presupuesto plataforma ($)</label>
                  <input type="number" min="0" value={presupuesto} onChange={e => setPresupuesto(e.target.value)} className="w-full px-4 py-2 border border-ml-line rounded-xl outline-none focus:ring-2 focus:ring-ml-purple/30" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-ml-ink mb-1">Vigente hasta</label>
                  <input type="date" value={finEn} onChange={e => setFinEn(e.target.value)} className="w-full px-4 py-2 border border-ml-line rounded-xl outline-none focus:ring-2 focus:ring-ml-purple/30" />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-semibold text-ml-ink mb-1">Nota al vendedor (opcional)</label>
                <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} maxLength={300} placeholder="Ej: Tu producto tiene mucha demanda, sumemos un empujón..." className="w-full px-4 py-2 border border-ml-line rounded-xl outline-none focus:ring-2 focus:ring-ml-purple/30 resize-none" />
              </div>

              {preview && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-ml-bg border border-ml-line rounded-lg p-3"><p className="text-xs text-ml-muted">Precio final</p><p className="font-extrabold text-ml-ink">${preview.precioFinal.toLocaleString('es-AR')}</p></div>
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3"><p className="text-xs text-ml-muted">Vendedor/u</p><p className="font-extrabold text-amber-600">${preview.aporteVend.toLocaleString('es-AR')}</p></div>
                  <div className="bg-green-50 border border-green-100 rounded-lg p-3"><p className="text-xs text-ml-muted">Plataforma/u</p><p className="font-extrabold text-green-600">${preview.aportePlat.toLocaleString('es-AR')}</p></div>
                  <div className="bg-rose-50 border border-rose-100 rounded-lg p-3"><p className="text-xs text-ml-muted">Ventas cubiertas</p><p className="font-extrabold text-rose-600">~{preview.ventasCubiertas}</p></div>
                </div>
              )}

              <button onClick={proponer} disabled={enviando} className="mt-5 w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50">
                {enviando ? 'Enviando...' : '🤝 Enviar propuesta al vendedor'}
              </button>
            </div>
          )}
        </div>

        {/* Listado */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button onClick={() => setFiltroEstado('')} className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${filtroEstado === '' ? 'bg-ml-violet text-white border-ml-violet' : 'bg-white text-ml-soft border-ml-line'}`}>Todas</button>
          {ESTADOS.map(e => (
            <button key={e} onClick={() => setFiltroEstado(e)} className={`px-3 py-1.5 rounded-full text-sm font-semibold border capitalize ${filtroEstado === e ? 'bg-ml-violet text-white border-ml-violet' : 'bg-white text-ml-soft border-ml-line'}`}>{e}</button>
          ))}
        </div>

        {cargando ? (
          <div className="py-12 flex justify-center"><div className="spinner" /></div>
        ) : lista.length === 0 ? (
          <p className="text-center text-ml-muted py-8">No hay ofertas con este filtro.</p>
        ) : (
          <div className="space-y-2">
            {lista.map(o => (
              <div key={o._id} className="bg-white rounded-xl border border-ml-line p-4 flex items-center gap-4 flex-wrap">
                {o.producto?.imagenes?.[0] && <img src={o.producto.imagenes[0]} alt="" className="w-12 h-12 rounded object-cover" />}
                <div className="flex-1 min-w-[160px]">
                  <p className="font-bold text-ml-ink">{o.producto?.nombre || 'Producto'}</p>
                  <p className="text-xs text-ml-muted">{o.tienda?.nombre} · {o.descuentoPorcentaje}% dto · vendedor {o.aporteVendedorPct}% / plataforma {o.aportePlataformaPct}%</p>
                </div>
                <div className="text-right text-xs text-ml-muted">
                  <p>Presup: ${o.presupuestoPlataforma.toLocaleString('es-AR')} · gastado ${o.gastado.toLocaleString('es-AR')}</p>
                  <p>{o.ventasGeneradas} ventas · hasta {new Date(o.finEn).toLocaleDateString('es-AR')}</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-ml-bg text-ml-soft border-ml-line capitalize">{o.estado}</span>
                {['propuesta', 'activa', 'pausada'].includes(o.estado) && (
                  <button onClick={() => finalizar(o._id)} className="text-sm text-red-600 hover:text-red-700 font-semibold">Finalizar</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
