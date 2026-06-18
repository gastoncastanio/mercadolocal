import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { obtenerUbicacion } from '../utils/geo'
import { GANCHO_ICON } from '../utils/canjes'

interface Comercio {
  _id: string
  nombre: string
  rubro: string
  ubicacion: { lat: number; lng: number; direccion: string; ciudad: string }
  estadoPrograma: string
  activo: boolean
}

interface Oferta {
  _id: string
  titulo: string
  descripcion: string
  tipoGancho: string
  inicioEn: string
  finEn: string
  cupoTotal: number
  cupoUsado: number
  activa: boolean
  bloqueHorario: string
}

interface Metricas {
  reclamos: number
  canjeados: number
  tasaConversion: number
  ticketPromedio: number | null
  ingresoAtribuido: number
}

const RUBROS = ['cafeteria', 'libreria', 'indumentaria', 'gastronomia', 'belleza', 'otro']
const BLOQUES = [
  { v: 'todos', t: 'Todo el día' },
  { v: 'manana', t: 'Mañana' },
  { v: 'tarde', t: 'Tarde' },
  { v: 'noche', t: 'Noche' }
]

// datetime-local necesita "YYYY-MM-DDTHH:mm" en hora local
function ahoraLocalInput(offsetMin = 0): string {
  const d = new Date(Date.now() + offsetMin * 60000)
  d.setSeconds(0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function PanelComercio() {
  const [comercios, setComercios] = useState<Comercio[]>([])
  const [sel, setSel] = useState<Comercio | null>(null)
  const [ofertas, setOfertas] = useState<Oferta[]>([])
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mostrarFormComercio, setMostrarFormComercio] = useState(false)
  const [mostrarFormOferta, setMostrarFormOferta] = useState(false)

  useEffect(() => { cargarComercios() }, [])

  async function cargarComercios() {
    setCargando(true)
    try {
      const res = await api.get('/centro/mis-comercios')
      setComercios(res.data || [])
      if (res.data?.length && !sel) seleccionar(res.data[0])
      else if (!res.data?.length) setMostrarFormComercio(true)
    } catch {
      setError('No pudimos cargar tus comercios.')
    } finally {
      setCargando(false)
    }
  }

  async function seleccionar(c: Comercio) {
    setSel(c)
    setMetricas(null)
    try {
      const [ofRes, mtRes] = await Promise.all([
        api.get(`/centro/mis-ofertas?comercioId=${c._id}`),
        api.get(`/centro/metricas/${c._id}`)
      ])
      setOfertas(ofRes.data || [])
      setMetricas(mtRes.data)
    } catch {
      setOfertas([])
    }
  }

  async function togglePausaOferta(o: Oferta) {
    try {
      const res = await api.put(`/centro/ofertas/${o._id}`, { activa: !o.activa })
      setOfertas(ofertas.map(x => x._id === o._id ? res.data : x))
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo actualizar la oferta.')
    }
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-ml-ink">🏬 Panel del Comercio</h1>
            <p className="text-sm text-ml-muted">Gestioná tus locales y ofertas del Radar del Centro</p>
          </div>
          <Link to="/comercio/canjear" className="px-3 py-2 ml-grad text-white rounded-xl font-bold text-sm">🧾 Validar canje</Link>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">{error}</p>}

        {cargando ? (
          <div className="flex justify-center py-16"><div className="spinner" /></div>
        ) : (
          <div className="space-y-5">
            {/* Selector de comercios */}
            {comercios.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {comercios.map(c => (
                  <button
                    key={c._id}
                    onClick={() => seleccionar(c)}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold border ${sel?._id === c._id ? 'ml-grad text-white border-transparent' : 'bg-white text-ml-soft border-ml-line'}`}
                  >
                    {c.nombre}
                  </button>
                ))}
                <button onClick={() => setMostrarFormComercio(v => !v)} className="px-3 py-2 rounded-xl text-sm font-semibold border border-dashed border-ml-line text-ml-violet">
                  + Nuevo local
                </button>
              </div>
            )}

            {mostrarFormComercio && (
              <FormComercio onCreado={(c) => { setComercios([...comercios, c]); setMostrarFormComercio(false); seleccionar(c) }} />
            )}

            {sel && (
              <>
                {/* Métricas */}
                {metricas && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Metrica label="Reclamos" valor={metricas.reclamos} />
                    <Metrica label="Canjeados" valor={metricas.canjeados} />
                    <Metrica label="Conversión" valor={`${metricas.tasaConversion}%`} />
                    <Metrica label="Ingreso atrib." valor={`$${metricas.ingresoAtribuido.toLocaleString('es-AR')}`} />
                  </div>
                )}

                {/* Ofertas */}
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-ml-ink">Ofertas relámpago</h2>
                  <button onClick={() => setMostrarFormOferta(v => !v)} className="text-sm px-3 py-1.5 ml-grad text-white rounded-lg font-semibold">
                    {mostrarFormOferta ? 'Cerrar' : '+ Nueva oferta'}
                  </button>
                </div>

                {mostrarFormOferta && (
                  <FormOferta
                    comercioId={sel._id}
                    onCreada={(o) => { setOfertas([o, ...ofertas]); setMostrarFormOferta(false) }}
                  />
                )}

                {ofertas.length === 0 ? (
                  <p className="text-center text-sm text-ml-muted py-8 bg-white rounded-2xl border border-ml-line">
                    Todavía no creaste ofertas para este local.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {ofertas.map(o => {
                      const fin = new Date(o.finEn)
                      const finalizada = fin < new Date()
                      return (
                        <div key={o._id} className="bg-white rounded-xl border border-ml-line p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-ml-ink text-sm truncate">
                              {GANCHO_ICON[o.tipoGancho] || '🏷️'} {o.titulo}
                            </p>
                            <p className="text-xs text-ml-muted">
                              Cupo {o.cupoTotal === 0 ? '∞' : `${o.cupoUsado}/${o.cupoTotal}`} ·
                              {' '}vence {fin.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${
                              finalizada ? 'bg-gray-100 text-gray-500' : o.activa ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {finalizada ? 'Finalizada' : o.activa ? 'Activa' : 'Pausada'}
                            </span>
                            {!finalizada && (
                              <button onClick={() => togglePausaOferta(o)} className="text-xs px-2 py-1 border border-ml-line rounded-lg text-ml-soft hover:border-ml-violet">
                                {o.activa ? 'Pausar' : 'Activar'}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Metrica({ label, valor }: { label: string; valor: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-ml-line p-3 text-center">
      <p className="text-xl font-extrabold text-ml-ink">{valor}</p>
      <p className="text-[11px] text-ml-muted">{label}</p>
    </div>
  )
}

// ===== Form de alta de comercio =====
function FormComercio({ onCreado }: { onCreado: (c: Comercio) => void }) {
  const [f, setF] = useState({ nombre: '', rubro: 'cafeteria', descripcion: '', direccion: '', ciudad: '', lat: '', lng: '' })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function usarUbicacion() {
    setError('')
    try {
      const coords = await obtenerUbicacion()
      setF(prev => ({ ...prev, lat: String(coords.lat), lng: String(coords.lng) }))
    } catch (e: any) {
      setError(e.message || 'No pudimos obtener la ubicación.')
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!f.nombre || !f.ciudad || !f.lat || !f.lng) {
      setError('Nombre, ciudad y coordenadas son obligatorios. Usá "Mi ubicación actual" parado en el local.')
      return
    }
    setGuardando(true)
    try {
      const res = await api.post('/centro/comercios', {
        nombre: f.nombre,
        rubro: f.rubro,
        descripcion: f.descripcion,
        ubicacion: { lat: Number(f.lat), lng: Number(f.lng), direccion: f.direccion, ciudad: f.ciudad }
      })
      onCreado(res.data)
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo crear el comercio.')
    } finally {
      setGuardando(false)
    }
  }

  const inp = 'w-full px-3 py-2 border border-ml-line rounded-xl focus:border-ml-violet outline-none text-sm'
  return (
    <form onSubmit={guardar} className="bg-white rounded-2xl border border-ml-line p-4 space-y-3">
      <h3 className="font-bold text-ml-ink">Nuevo local</h3>
      <input className={inp} placeholder="Nombre del local" value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <select className={inp} value={f.rubro} onChange={e => setF({ ...f, rubro: e.target.value })}>
          {RUBROS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input className={inp} placeholder="Ciudad" value={f.ciudad} onChange={e => setF({ ...f, ciudad: e.target.value })} />
      </div>
      <input className={inp} placeholder="Dirección" value={f.direccion} onChange={e => setF({ ...f, direccion: e.target.value })} />
      <textarea className={inp} placeholder="Descripción corta" rows={2} value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} />
      <div className="flex items-center gap-2">
        <button type="button" onClick={usarUbicacion} className="text-sm px-3 py-2 border border-ml-line rounded-xl text-ml-violet font-semibold">
          📍 Usar mi ubicación actual
        </button>
        <span className="text-xs text-ml-muted">{f.lat && f.lng ? `${Number(f.lat).toFixed(4)}, ${Number(f.lng).toFixed(4)}` : 'Sin coords'}</span>
      </div>
      <p className="text-[11px] text-ml-muted">Las coordenadas son del LOCAL (dato público) y se redondean a ~11 m.</p>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
      <button type="submit" disabled={guardando} className="w-full py-2.5 ml-grad text-white rounded-xl font-bold disabled:opacity-60">
        {guardando ? 'Guardando...' : 'Crear local'}
      </button>
    </form>
  )
}

// ===== Form de alta de oferta =====
function FormOferta({ comercioId, onCreada }: { comercioId: string; onCreada: (o: Oferta) => void }) {
  const [f, setF] = useState({
    titulo: '', descripcion: '', tipoGancho: 'descuento', valorDescuento: '',
    inicioEn: ahoraLocalInput(), finEn: ahoraLocalInput(60), cupoTotal: '', bloqueHorario: 'todos', condiciones: ''
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!f.titulo || !f.inicioEn || !f.finEn) {
      setError('Título, inicio y fin son obligatorios.')
      return
    }
    if (new Date(f.finEn) <= new Date(f.inicioEn)) {
      setError('El fin debe ser posterior al inicio.')
      return
    }
    setGuardando(true)
    try {
      const res = await api.post('/centro/ofertas', {
        comercioId,
        titulo: f.titulo,
        descripcion: f.descripcion,
        tipoGancho: f.tipoGancho,
        valorDescuento: f.valorDescuento ? Number(f.valorDescuento) : 0,
        inicioEn: new Date(f.inicioEn).toISOString(),
        finEn: new Date(f.finEn).toISOString(),
        cupoTotal: f.cupoTotal ? Number(f.cupoTotal) : 0,
        bloqueHorario: f.bloqueHorario,
        condiciones: f.condiciones
      })
      onCreada(res.data)
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo crear la oferta.')
    } finally {
      setGuardando(false)
    }
  }

  const inp = 'w-full px-3 py-2 border border-ml-line rounded-xl focus:border-ml-violet outline-none text-sm'
  return (
    <form onSubmit={guardar} className="bg-white rounded-2xl border border-ml-line p-4 space-y-3">
      <input className={inp} placeholder='Título (ej. "2x1 en Macchiato")' value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} />
      <textarea className={inp} placeholder="Descripción" rows={2} value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <select className={inp} value={f.tipoGancho} onChange={e => setF({ ...f, tipoGancho: e.target.value })}>
          <option value="descuento">Descuento %</option>
          <option value="2x1">2x1</option>
          <option value="regalo">Regalo</option>
          <option value="combo">Combo</option>
        </select>
        {f.tipoGancho === 'descuento' ? (
          <input className={inp} placeholder="% desc." inputMode="numeric" value={f.valorDescuento} onChange={e => setF({ ...f, valorDescuento: e.target.value })} />
        ) : (
          <input className={inp} placeholder="Cupo total (0 = ∞)" inputMode="numeric" value={f.cupoTotal} onChange={e => setF({ ...f, cupoTotal: e.target.value })} />
        )}
      </div>
      {f.tipoGancho === 'descuento' && (
        <input className={inp} placeholder="Cupo total (0 = ilimitado)" inputMode="numeric" value={f.cupoTotal} onChange={e => setF({ ...f, cupoTotal: e.target.value })} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] text-ml-muted mb-1">Inicia</label>
          <input type="datetime-local" className={inp} value={f.inicioEn} onChange={e => setF({ ...f, inicioEn: e.target.value })} />
        </div>
        <div>
          <label className="block text-[11px] text-ml-muted mb-1">Termina</label>
          <input type="datetime-local" className={inp} value={f.finEn} onChange={e => setF({ ...f, finEn: e.target.value })} />
        </div>
      </div>
      <select className={inp} value={f.bloqueHorario} onChange={e => setF({ ...f, bloqueHorario: e.target.value })}>
        {BLOQUES.map(b => <option key={b.v} value={b.v}>{b.t}</option>)}
      </select>
      <textarea className={inp} placeholder="Condiciones / letra chica (exclusiones, vigencia)" rows={2} value={f.condiciones} onChange={e => setF({ ...f, condiciones: e.target.value })} />
      <p className="text-[11px] text-ml-muted">⚖️ El cupo y el horario son reales: el sistema impide vender más cupos de los cargados. Sin urgencia falsa.</p>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
      <button type="submit" disabled={guardando} className="w-full py-2.5 ml-grad text-white rounded-xl font-bold disabled:opacity-60">
        {guardando ? 'Publicando...' : 'Publicar oferta'}
      </button>
    </form>
  )
}
