import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { Producto } from '../types'
import TarjetaProducto from '../components/TarjetaProducto'

// Cuenta regresiva hasta el final del día (las "ofertas del día" cierran a la medianoche)
function useCuentaRegresiva() {
  const calcular = () => {
    const ahora = new Date()
    const finDia = new Date(ahora)
    finDia.setHours(23, 59, 59, 999)
    const diff = Math.max(0, finDia.getTime() - ahora.getTime())
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return { h, m, s }
  }
  const [t, setT] = useState(calcular())
  useEffect(() => {
    const id = setInterval(() => setT(calcular()), 1000)
    return () => clearInterval(id)
  }, [])
  return t
}

function Bloque({ valor }: { valor: number }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[44px] sm:min-w-[52px] px-2 py-1.5 sm:py-2 rounded-xl bg-white text-ml-ink font-display font-extrabold text-[20px] sm:text-[24px] tabular-nums">
      {String(valor).padStart(2, '0')}
    </span>
  )
}

export default function Ofertas() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const { h, m, s } = useCuentaRegresiva()

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    try {
      const res = await api.get('/productos', { params: { enOferta: true, limite: 48 } })
      setProductos(Array.isArray(res.data) ? res.data : (res.data.productos || []))
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  // Dividimos en "ofertas del día" (primeras) y "más ofertas"
  const destacadas = productos.slice(0, 8)
  const masOfertas = productos.slice(8)

  return (
    <div className="min-h-screen bg-white">
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(125deg,#3b32d6 0%,#5b21d6 55%,#7c3aed 100%)' }}>
        <div className="pointer-events-none absolute -top-20 -right-20 w-[420px] h-[420px] rounded-full" style={{ background: 'radial-gradient(circle,rgba(255,255,255,.16),transparent 70%)' }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
          <nav className="text-[13px] text-white/70 mb-4 flex items-center gap-1.5">
            <Link to="/" className="hover:text-white">Inicio</Link>
            <span>›</span>
            <span className="font-semibold text-white">Ofertas</span>
          </nav>

          <span className="inline-block text-[11px] sm:text-[12px] font-extrabold tracking-[0.08em] uppercase text-white bg-white/15 border border-white/25 px-3 py-1.5 rounded-full mb-4">
            Ofertas del día
          </span>

          <h1 className="font-display font-extrabold text-[30px] sm:text-[48px] leading-[1.04] tracking-[-0.025em] text-white max-w-[640px]">
            Los mejores precios de tu ciudad, por tiempo limitado
          </h1>
          <p className="text-white/80 text-[15px] sm:text-[17px] leading-[1.5] mt-3 max-w-[520px]">
            Descuentos reales de tiendas locales. Pagás con Mercado Pago y recibís hoy.
          </p>

          {/* Cuenta regresiva */}
          <div className="flex items-center gap-2.5 sm:gap-3 mt-6 sm:mt-8">
            <span className="text-white/70 text-[13px] sm:text-[14px] font-semibold mr-1">Termina en</span>
            <Bloque valor={h} />
            <span className="text-white font-extrabold text-[20px]">:</span>
            <Bloque valor={m} />
            <span className="text-white font-extrabold text-[20px]">:</span>
            <Bloque valor={s} />
          </div>
        </div>
      </section>

      {/* ===== CONTENIDO ===== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-10">
        {cargando ? (
          <div className="text-center py-20">
            <div className="animate-spin text-4xl mb-4">&#x1F504;</div>
            <p className="text-ml-muted">Buscando las mejores ofertas…</p>
          </div>
        ) : productos.length === 0 ? (
          <div className="text-center py-20 bg-ml-bg rounded-2xl border border-ml-line">
            <p className="text-5xl mb-4">&#x1F3F7;&#xFE0F;</p>
            <h3 className="font-display text-xl font-bold text-ml-ink mb-2">No hay ofertas activas ahora mismo</h3>
            <p className="text-ml-muted mb-6">Volvé pronto: las tiendas locales publican descuentos todos los días.</p>
            <Link to="/catalogo" className="mlbtn inline-block px-6 py-3 ml-grad text-white rounded-xl font-bold shadow-sm">
              Ver todo el catálogo
            </Link>
          </div>
        ) : (
          <>
            {/* Ofertas destacadas */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
              {destacadas.map(p => (
                <TarjetaProducto key={p._id} producto={p} />
              ))}
            </div>

            {/* Más ofertas */}
            {masOfertas.length > 0 && (
              <section className="mt-12">
                <h2 className="font-display font-bold text-[20px] sm:text-[26px] tracking-[-0.01em] text-ml-ink mb-5">
                  Más ofertas cerca tuyo
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
                  {masOfertas.map(p => (
                    <TarjetaProducto key={p._id} producto={p} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
