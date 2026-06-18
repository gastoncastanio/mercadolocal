import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

interface Stats {
  promocionesActivas: number
  promocionesTotales: number
  pendientesPago: number
  ingresosTotales: number
  ingresosMes: number
  ingresosMercadoPago: number
  ingresosSaldo: number
  totalImpresiones: number
  totalClicks: number
  ctr: string
  porPlan: { basico: number; premium: number; elite: number }
}

interface Campana {
  _id: string
  productoId?: { _id: string; nombre: string; imagenes?: string[] }
  tiendaId?: { _id: string; nombre: string; ciudad?: string }
  plan: string
  estado: string
  metodoPago?: string
  precioTotal: number
  duracionDias: number
  fechaFin: string
  impresiones: number
  impresionesRelevantes?: number
  clicks: number
}

interface Plan {
  nombre: string
  precios: Record<number, number>
}

const DURACIONES = [3, 7, 15, 30]
const PLANES_KEYS = ['basico', 'premium', 'elite']

export default function PautaAdmin() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [planes, setPlanes] = useState<Record<string, Plan>>({})
  const [precios, setPrecios] = useState<Record<string, Record<number, number>>>({})
  const [filtro, setFiltro] = useState('todas')
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { cargar() }, [])
  useEffect(() => { cargarCampanas() }, [filtro])

  async function cargar() {
    try {
      const [s, p] = await Promise.all([
        api.get('/destacados/admin/stats'),
        api.get('/destacados/admin/precios')
      ])
      setStats(s.data)
      setPlanes(p.data)
      const pr: Record<string, Record<number, number>> = {}
      for (const k of PLANES_KEYS) pr[k] = { ...(p.data[k]?.precios || {}) }
      setPrecios(pr)
    } catch (e) { console.error(e) }
  }

  async function cargarCampanas() {
    try {
      const res = await api.get(`/destacados/admin/campanas?estado=${filtro}`)
      setCampanas(res.data)
    } catch (e) { console.error(e) }
  }

  async function guardarPrecios() {
    setGuardando(true)
    setMsg('')
    try {
      await api.put('/destacados/admin/precios', precios)
      setMsg('Precios actualizados ✓')
      setTimeout(() => setMsg(''), 3000)
    } catch (e: any) {
      setMsg(e.response?.data?.error || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  function setPrecio(plan: string, dias: number, valor: string) {
    setPrecios(prev => ({ ...prev, [plan]: { ...prev[plan], [dias]: Number(valor) } }))
  }

  const tarjetas = stats ? [
    { label: 'Ingresos totales', valor: `$${stats.ingresosTotales.toLocaleString('es-AR')}`, color: 'text-green-600' },
    { label: 'Ingresos del mes', valor: `$${stats.ingresosMes.toLocaleString('es-AR')}`, color: 'text-ml-ink' },
    { label: 'Por Mercado Pago', valor: `$${stats.ingresosMercadoPago.toLocaleString('es-AR')}`, color: 'text-ml-blue' },
    { label: 'Por saldo', valor: `$${stats.ingresosSaldo.toLocaleString('es-AR')}`, color: 'text-ml-purple' },
    { label: 'Campañas activas', valor: stats.promocionesActivas, color: 'text-ml-ink' },
    { label: 'Pendientes de pago', valor: stats.pendientesPago, color: 'text-amber-600' },
    { label: 'Impresiones', valor: stats.totalImpresiones.toLocaleString('es-AR'), color: 'text-ml-ink' },
    { label: 'CTR', valor: stats.ctr, color: 'text-ml-ink' }
  ] : []

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-[26px] sm:text-[30px] font-extrabold text-ml-ink">📢 Pauta publicitaria</h1>
            <p className="text-ml-muted text-sm mt-1">Control de la publicidad: facturación, campañas y precios.</p>
          </div>
          <Link to="/admin" className="text-ml-blue hover:underline text-sm shrink-0">← Admin</Link>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {tarjetas.map(t => (
            <div key={t.label} className="bg-white rounded-2xl border border-ml-line2 p-4">
              <p className="text-[11px] text-ml-muted uppercase tracking-wide">{t.label}</p>
              <p className={`font-display text-[22px] font-extrabold mt-1 ${t.color}`}>{t.valor}</p>
            </div>
          ))}
        </div>

        {/* Editor de precios */}
        <div className="bg-white rounded-2xl border border-ml-line2 p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-ml-ink">Precios de los planes</h2>
            <div className="flex items-center gap-3">
              {msg && <span className="text-xs text-green-600">{msg}</span>}
              <button onClick={guardarPrecios} disabled={guardando}
                className="mlbtn px-4 py-2 ml-grad text-white rounded-lg text-sm font-bold disabled:opacity-50">
                {guardando ? 'Guardando…' : 'Guardar precios'}
              </button>
            </div>
          </div>
          <p className="text-xs text-ml-muted mb-4">Editá los precios sin tocar código. Se aplican al instante a toda la plataforma.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ml-muted">
                  <th className="py-2 pr-4">Plan</th>
                  {DURACIONES.map(d => <th key={d} className="py-2 px-2 text-center">{d} días</th>)}
                </tr>
              </thead>
              <tbody>
                {PLANES_KEYS.map(k => (
                  <tr key={k} className="border-t border-ml-line2">
                    <td className="py-2 pr-4 font-semibold text-ml-ink capitalize">
                      {k === 'elite' ? '👑' : k === 'premium' ? '⭐' : '📌'} {planes[k]?.nombre || k}
                    </td>
                    {DURACIONES.map(d => (
                      <td key={d} className="py-2 px-2">
                        <div className="flex items-center justify-center">
                          <span className="text-ml-muted mr-1">$</span>
                          <input
                            type="number"
                            value={precios[k]?.[d] ?? ''}
                            onChange={e => setPrecio(k, d, e.target.value)}
                            className="w-24 border border-ml-line2 rounded-lg px-2 py-1.5 text-right"
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Campañas */}
        <div className="bg-white rounded-2xl border border-ml-line2 p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="font-bold text-ml-ink">Campañas</h2>
            <div className="flex gap-1 bg-ml-bg rounded-lg p-1">
              {['todas', 'activo', 'pendiente', 'finalizado', 'cancelado'].map(f => (
                <button key={f} onClick={() => setFiltro(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${filtro === f ? 'bg-white text-ml-ink shadow-sm' : 'text-ml-soft'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {campanas.length === 0 ? (
            <p className="text-ml-muted text-sm text-center py-8">No hay campañas en este estado.</p>
          ) : (
            <div className="space-y-2">
              {campanas.map(c => {
                const ctr = c.impresiones > 0 ? ((c.clicks / c.impresiones) * 100).toFixed(1) : '0'
                return (
                  <div key={c._id} className="flex items-center gap-3 p-3 rounded-xl border border-ml-line2">
                    <div className="w-11 h-11 rounded-lg overflow-hidden bg-ml-bg shrink-0">
                      {c.productoId?.imagenes?.[0]
                        ? <img src={c.productoId.imagenes[0]} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center">📦</div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-ml-ink truncate">{c.productoId?.nombre || 'Producto'}</p>
                      <p className="text-xs text-ml-muted truncate">
                        {c.tiendaId?.nombre || 'Tienda'} · {c.plan} · {c.metodoPago === 'mercadopago' ? '💳 MP' : '🏦 saldo'}
                      </p>
                    </div>
                    <div className="hidden sm:block text-center px-3">
                      <p className="text-sm font-bold text-ml-ink">{c.impresiones}</p>
                      <p className="text-[10px] text-ml-muted">impr.</p>
                    </div>
                    <div className="hidden sm:block text-center px-3">
                      <p className="text-sm font-bold text-ml-ink">{ctr}%</p>
                      <p className="text-[10px] text-ml-muted">CTR</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-ml-ink text-sm">${c.precioTotal.toLocaleString('es-AR')}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        c.estado === 'activo' ? 'bg-green-100 text-green-700' :
                        c.estado === 'pendiente' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-ml-muted'
                      }`}>{c.estado}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
