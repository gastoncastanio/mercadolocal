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
  descuentoTotal: number
  aporteVendedor: number
  aportePlataforma: number
  presupuestoPlataforma: number
  presupuestoRestante: number
  finEn: string
  estado: string
  ventasGeneradas: number
  notaPlataforma: string
  producto?: Producto
}

const ESTADO_INFO: Record<string, { texto: string; clase: string }> = {
  propuesta: { texto: 'Propuesta nueva', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  activa: { texto: 'Activa', clase: 'bg-green-50 text-green-700 border-green-200' },
  pausada: { texto: 'Pausada', clase: 'bg-blue-50 text-blue-700 border-blue-200' },
  finalizada: { texto: 'Finalizada', clase: 'bg-ml-bg text-ml-soft border-ml-line' },
  rechazada: { texto: 'Rechazada', clase: 'bg-red-50 text-red-600 border-red-200' }
}

export default function OfertasCompartidasVendedor() {
  const navigate = useNavigate()
  const [lista, setLista] = useState<Oferta[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [accionando, setAccionando] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    try {
      const res = await api.get('/ofertas-compartidas/mias')
      setLista(res.data || [])
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error cargando tus ofertas compartidas')
    } finally {
      setCargando(false)
    }
  }

  async function aceptar(id: string) {
    setAccionando(true)
    setError('')
    try {
      await api.patch(`/ofertas-compartidas/${id}/aceptar`)
      await cargar()
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo aceptar')
    } finally {
      setAccionando(false)
    }
  }

  async function rechazar(id: string) {
    if (!confirm('¿Rechazar esta propuesta de oferta compartida?')) return
    setAccionando(true)
    setError('')
    try {
      await api.patch(`/ofertas-compartidas/${id}/rechazar`)
      await cargar()
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo rechazar')
    } finally {
      setAccionando(false)
    }
  }

  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center"><div className="spinner" /></div>
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate('/mi-tienda')} className="text-white/80 hover:text-white mb-3 flex items-center gap-2">← Mi tienda</button>
          <h1 className="text-3xl font-extrabold">🤝 Ofertas Compartidas</h1>
          <p className="text-white/90 mt-1">La plataforma co-financia descuentos con vos para vender más. Vos ponés una parte, nosotros la otra.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-6">{error}</p>}

        {lista.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-ml-line">
            <p className="text-4xl mb-3">🤝</p>
            <p className="text-ml-muted mb-2">Todavía no recibiste propuestas de oferta compartida.</p>
            <p className="text-xs text-ml-soft">Cuando la plataforma detecte un producto con potencial, te va a proponer co-financiar un descuento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lista.map(o => {
              const info = ESTADO_INFO[o.estado] || { texto: o.estado, clase: 'bg-ml-bg text-ml-soft border-ml-line' }
              return (
                <div key={o._id} className="bg-white rounded-2xl shadow-sm border border-ml-line p-5">
                  <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      {o.producto?.imagenes?.[0] && (
                        <img src={o.producto.imagenes[0]} alt="" className="w-14 h-14 rounded-lg object-cover" />
                      )}
                      <div>
                        <p className="font-bold text-ml-ink">{o.producto?.nombre || 'Producto'}</p>
                        <p className="text-xs text-ml-muted">Precio original: ${o.precioOriginal.toLocaleString('es-AR')}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border ${info.clase}`}>{info.texto}</span>
                  </div>

                  {o.notaPlataforma && (
                    <p className="text-sm text-ml-soft bg-ml-bg border border-ml-line rounded-lg p-3 mb-3">💬 {o.notaPlataforma}</p>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    <div className="bg-rose-50 border border-rose-100 rounded-lg p-3">
                      <p className="text-xs text-ml-muted">Descuento al comprador</p>
                      <p className="text-lg font-extrabold text-rose-600">{o.descuentoPorcentaje}%</p>
                    </div>
                    <div className="bg-ml-bg border border-ml-line rounded-lg p-3">
                      <p className="text-xs text-ml-muted">Precio final</p>
                      <p className="text-lg font-extrabold text-ml-ink">${o.precioConDescuento.toLocaleString('es-AR')}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                      <p className="text-xs text-ml-muted">Vos ponés ({o.aporteVendedorPct}%)</p>
                      <p className="text-lg font-extrabold text-amber-600">${o.aporteVendedor.toLocaleString('es-AR')}</p>
                      <p className="text-[10px] text-ml-soft">por unidad</p>
                    </div>
                    <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                      <p className="text-xs text-ml-muted">Plataforma pone ({o.aportePlataformaPct}%)</p>
                      <p className="text-lg font-extrabold text-green-600">${o.aportePlataforma.toLocaleString('es-AR')}</p>
                      <p className="text-[10px] text-ml-soft">por unidad</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-ml-muted mb-3">
                    <span>📅 Hasta {new Date(o.finEn).toLocaleDateString('es-AR')}</span>
                    <span>💰 Presupuesto plataforma: ${o.presupuestoPlataforma.toLocaleString('es-AR')}</span>
                    {o.estado === 'activa' && <span>📊 Restante: ${o.presupuestoRestante.toLocaleString('es-AR')}</span>}
                    {o.ventasGeneradas > 0 && <span>✅ {o.ventasGeneradas} vendidas con la oferta</span>}
                  </div>

                  {o.estado === 'propuesta' && (
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button onClick={() => rechazar(o._id)} disabled={accionando} className="px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-50">Rechazar</button>
                      <button onClick={() => aceptar(o._id)} disabled={accionando} className="px-5 py-2 text-sm font-bold rounded-lg mlbtn ml-grad text-white disabled:opacity-50">Aceptar y aplicar descuento</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
