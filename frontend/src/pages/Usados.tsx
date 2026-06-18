import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { Producto } from '../types'
import TarjetaProducto from '../components/TarjetaProducto'

// Categorías reales del catálogo (las mismas que filtra el backend)
const CATEGORIAS = ['Electrónica', 'Ropa', 'Hogar', 'Alimentos', 'Belleza', 'Deportes', 'Juguetes', 'Otro']

export default function Usados() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [categoria, setCategoria] = useState('')
  const [ordenar, setOrdenar] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoria, ordenar])

  async function cargar() {
    setCargando(true)
    try {
      const params: any = { condicion: 'usado', limite: 48 }
      if (categoria) params.categoria = categoria
      if (ordenar) params.ordenar = ordenar
      const res = await api.get('/productos', { params })
      setProductos(Array.isArray(res.data) ? res.data : (res.data.productos || []))
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
        {/* Breadcrumb */}
        <nav className="text-[13px] text-ml-muted mb-4 flex items-center gap-1.5">
          <Link to="/" className="hover:text-ml-ink">Inicio</Link>
          <span>›</span>
          <span className="font-semibold text-ml-ink">Usados</span>
        </nav>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6 sm:pb-8 border-b border-ml-line">
          <div className="max-w-2xl">
            <h1 className="font-display font-extrabold text-[28px] sm:text-[40px] leading-[1.05] tracking-[-0.025em] text-ml-ink">
              Usados de vecinos de tu zona
            </h1>
            <p className="text-ml-soft text-[15px] sm:text-[16px] leading-[1.5] mt-2.5 sm:mt-3">
              Oportunidades a buen precio cerca tuyo. Coordinás la entrega y pagás cuando lo tenés enfrente. Dale otra vida a las cosas.
            </p>
          </div>
          <Link
            to="/publicar?condicion=usado"
            className="mlbtn shrink-0 inline-flex items-center gap-2 bg-ml-ink text-white font-display font-bold text-[14px] sm:text-[15px] px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
            Publicar un usado
          </Link>
        </div>

        {/* Filtros de categoría */}
        <div className="flex flex-wrap gap-2 mt-6">
          <button
            onClick={() => setCategoria('')}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              !categoria ? 'ml-grad text-white shadow-sm' : 'bg-white text-ml-soft border border-ml-line hover:border-ml-purple/40'
            }`}
          >
            Todo
          </button>
          {CATEGORIAS.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoria(cat)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                categoria === cat ? 'ml-grad text-white shadow-sm' : 'bg-white text-ml-soft border border-ml-line hover:border-ml-purple/40'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Banner de confianza */}
        <div className="mt-5 flex items-start gap-3 bg-[#f3edff] border border-[#e2d6ff] rounded-2xl px-4 sm:px-5 py-3.5 sm:py-4">
          <span className="shrink-0 w-9 h-9 rounded-xl bg-white flex items-center justify-center">
            <svg className="w-5 h-5 text-ml-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.6 1a9 9 0 11-3.2-6.9L12 3" />
            </svg>
          </span>
          <p className="text-[13.5px] sm:text-[14px] text-ml-slate leading-relaxed">
            <span className="font-bold text-ml-ink">Comprá con confianza.</span> Coordiná la entrega en un lugar público, revisá el producto y recién ahí pagá. MercadoLocal te da el chat seguro y el perfil verificado del vendedor.
          </p>
        </div>

        {/* Toolbar: contador + orden */}
        <div className="flex items-center justify-between gap-3 mt-7 mb-5">
          <p className="text-sm text-ml-muted">
            {cargando ? 'Cargando…' : <><span className="font-bold text-ml-ink">{productos.length}</span> usados cerca tuyo</>}
          </p>
          <label className="inline-flex items-center gap-2 bg-white border border-ml-line rounded-xl px-3 py-2">
            <span className="text-[12px] text-ml-muted font-semibold hidden sm:inline">Ordenar:</span>
            <select
              value={ordenar}
              onChange={e => setOrdenar(e.target.value)}
              className="bg-transparent outline-none text-sm font-bold text-ml-ink cursor-pointer"
            >
              <option value="">Más recientes</option>
              <option value="precio_asc">Menor precio</option>
              <option value="precio_desc">Mayor precio</option>
              <option value="calificacion">Mejor calificación</option>
            </select>
          </label>
        </div>

        {/* Grid */}
        {cargando ? (
          <div className="text-center py-20">
            <div className="animate-spin text-4xl mb-4">&#x1F504;</div>
            <p className="text-ml-muted">Cargando usados…</p>
          </div>
        ) : productos.length === 0 ? (
          <div className="text-center py-20 bg-ml-bg rounded-2xl border border-ml-line">
            <p className="text-5xl mb-4">&#x267B;&#xFE0F;</p>
            <h3 className="font-display text-xl font-bold text-ml-ink mb-2">Todavía no hay usados publicados</h3>
            <p className="text-ml-muted mb-6">Sé el primero en darle otra vida a algo que ya no usás.</p>
            <Link to="/publicar?condicion=usado" className="mlbtn inline-block px-6 py-3 ml-grad text-white rounded-xl font-bold shadow-sm">
              Publicar un usado
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
            {productos.map(p => (
              <TarjetaProducto key={p._id} producto={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
