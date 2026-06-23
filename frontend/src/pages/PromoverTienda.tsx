import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { Tienda } from '../types'
import { useAuth } from '../context/AuthContext'

interface Plan {
  nombre: string
  ubicacion: string[]
  precios: Record<number, number>
  descripcion: string
}

const BOOSTS = [0, 1500, 3000, 6000]
const fmt = (n: number) => n.toLocaleString('es-AR')

/**
 * Publicidad de TIENDA (plan "Marca"): el vendedor paga para que su marca
 * (logo + nombre) aparezca en el banner, la home y la vidriera de marcas,
 * linkeando a su tienda. Diseño y textos propios.
 */
export default function PromoverTienda() {
  const { tienda } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [planes, setPlanes] = useState<Record<string, Plan>>({})
  const [duracionSel, setDuracionSel] = useState(15)
  const [metodoPago, setMetodoPago] = useState<'mercadopago' | 'saldo'>('mercadopago')
  const [puja, setPuja] = useState(0)
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  const saldo = (tienda as Tienda)?.ganancias || 0
  const plan = planes.marca
  const duraciones = plan ? Object.keys(plan.precios).map(Number).sort((a, b) => a - b) : []
  const precioPlan = plan?.precios[duracionSel] || 0
  const total = precioPlan + puja

  useEffect(() => {
    api.get('/destacados/planes-tienda')
      .then(r => {
        setPlanes(r.data || {})
        const ds = r.data?.marca?.precios ? Object.keys(r.data.marca.precios).map(Number) : []
        if (ds.length && !ds.includes(duracionSel)) setDuracionSel(ds.includes(15) ? 15 : ds[0])
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Retorno desde Mercado Pago
  useEffect(() => {
    const pago = searchParams.get('pago')
    if (!pago) return
    if (pago === 'ok') setMensaje('¡Pago aprobado! Tu tienda empieza a promocionarse en unos segundos.')
    else if (pago === 'pendiente') setMensaje('Tu pago quedó pendiente. La publicidad se activará al confirmarse.')
    else if (pago === 'error') setError('El pago no se completó. Podés intentar de nuevo.')
    searchParams.delete('pago')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function crear() {
    setError(''); setMensaje(''); setCargando(true)
    try {
      const res = await api.post('/destacados/tienda', { plan: 'marca', duracionDias: duracionSel, metodoPago, puja })
      if (res.data.metodoPago === 'mercadopago' && res.data.initPoint) {
        window.location.href = res.data.initPoint
        return
      }
      setMensaje(res.data.mensaje || 'Tu tienda se está promocionando.')
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo crear la publicidad.')
    } finally {
      setCargando(false)
    }
  }

  // Sin tienda: invitamos a crearla primero
  if (tienda === null) {
    return (
      <div className="min-h-screen bg-ml-bg py-12 px-4">
        <div className="max-w-lg mx-auto bg-white rounded-2xl border border-ml-line p-8 text-center">
          <p className="text-4xl mb-3">🏪</p>
          <h1 className="text-xl font-bold text-ml-ink mb-2">Necesitás una tienda</h1>
          <p className="text-ml-muted mb-4">Creá tu tienda para poder promocionar tu marca.</p>
          <Link to="/mi-tienda" className="inline-block px-6 py-3 mlbtn ml-grad text-white rounded-xl font-semibold">Crear mi tienda</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ml-bg py-6">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-display text-[26px] sm:text-[32px] font-extrabold text-ml-ink flex items-center gap-2">
            📢 Promocioná tu tienda
          </h1>
          <Link to="/promover" className="text-sm text-ml-blue hover:underline">← Promover productos</Link>
        </div>
        <p className="text-ml-soft mb-6">Tu marca aparece en el <strong>banner</strong>, la <strong>home</strong> y la <strong>vidriera de marcas</strong>, linkeando a tu tienda.</p>

        {mensaje && <div className="mb-4 bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-sm">{mensaje}</div>}
        {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}

        {/* Tienda */}
        <div className="bg-white rounded-2xl border border-ml-line p-5 mb-4 flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-ml-bg flex items-center justify-center shrink-0 border border-ml-line2">
            {(tienda as Tienda)?.logo
              ? <img src={(tienda as Tienda).logo} alt="" className="w-full h-full object-cover" />
              : <span className="text-2xl">🏪</span>}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-ml-ink truncate">{(tienda as Tienda)?.nombre}</p>
            <p className="text-xs text-ml-muted">{(tienda as Tienda)?.ciudad}</p>
          </div>
        </div>

        {/* Duración */}
        <div className="bg-white rounded-2xl border border-ml-line p-5 mb-4">
          <h2 className="font-bold text-ml-ink mb-3">1. ¿Cuántos días?</h2>
          <div className="grid grid-cols-3 gap-2">
            {duraciones.map(d => (
              <button
                key={d}
                onClick={() => setDuracionSel(d)}
                className={`py-3 rounded-xl text-sm font-semibold border transition-colors ${
                  d === duracionSel ? 'bg-ml-purple text-white border-ml-purple shadow' : 'bg-white text-ml-ink border-ml-line hover:border-ml-purple'
                }`}
              >
                {d} días
                <span className="block text-[11px] font-normal opacity-80">${fmt(plan?.precios[d] || 0)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Pago */}
        <div className="bg-white rounded-2xl border border-ml-line p-5 mb-4">
          <h2 className="font-bold text-ml-ink mb-3">2. ¿Cómo querés pagar?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setMetodoPago('mercadopago')}
              className={`text-left p-4 rounded-xl border transition-colors ${metodoPago === 'mercadopago' ? 'border-ml-blue bg-blue-50' : 'border-ml-line hover:border-ml-blue'}`}
            >
              <p className="font-bold text-ml-ink">💳 Mercado Pago</p>
              <p className="text-xs text-ml-muted mt-0.5">Con tarjeta o dinero en cuenta. Disponible siempre.</p>
            </button>
            <button
              onClick={() => setMetodoPago('saldo')}
              disabled={saldo < total}
              className={`text-left p-4 rounded-xl border transition-colors disabled:opacity-50 ${metodoPago === 'saldo' ? 'border-ml-blue bg-blue-50' : 'border-ml-line hover:border-ml-blue'}`}
            >
              <p className="font-bold text-ml-ink">🏦 Saldo de ventas</p>
              <p className="text-xs text-ml-muted mt-0.5">Disponible: <strong>${fmt(saldo)}</strong></p>
            </button>
          </div>
        </div>

        {/* Boost */}
        <div className="bg-white rounded-2xl border border-ml-line p-5 mb-4">
          <h2 className="font-bold text-ml-ink mb-1">🚀 Boost premium <span className="text-ml-muted font-normal text-sm">(opcional)</span></h2>
          <p className="text-xs text-ml-soft mb-3">Sumá una puja para subir más alto en los lugares competidos. El puesto se decide por tu puja × qué tan relevante sos. Se cobra una sola vez, junto con el plan.</p>
          <div className="grid grid-cols-4 gap-2">
            {BOOSTS.map(b => (
              <button
                key={b}
                onClick={() => setPuja(b)}
                className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  b === puja ? 'bg-ml-purple/10 text-ml-purple border-ml-purple' : 'bg-white text-ml-ink border-ml-line hover:border-ml-purple'
                }`}
              >
                {b === 0 ? 'Sin boost' : `$${fmt(b)}`}
              </button>
            ))}
          </div>
        </div>

        {/* Total + CTA */}
        <div className="bg-white rounded-2xl border border-ml-line p-5 sticky bottom-2 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-ml-soft">Total a pagar</span>
            <span className="text-2xl font-extrabold text-ml-ink">${fmt(total)}</span>
          </div>
          <button
            onClick={crear}
            disabled={cargando || !plan || total <= 0}
            className="w-full py-4 mlbtn ml-grad text-white rounded-xl font-bold text-lg disabled:opacity-60"
          >
            {cargando ? 'Procesando…' : metodoPago === 'mercadopago' ? 'Pagar con Mercado Pago' : 'Promocionar con mi saldo'}
          </button>
        </div>
      </div>
    </div>
  )
}
