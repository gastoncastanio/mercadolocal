import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { obtenerUbicacion } from '../utils/geo'
import { GANCHO_ICON } from '../utils/canjes'

interface Comercio {
  _id: string
  nombre: string
  rubro: string
  descripcion: string
  ubicacion: { lat: number; lng: number; direccion: string; ciudad: string }
  estadoPrograma: string
  activo: boolean
  contacto?: { whatsapp?: string; instagram?: string }
}

interface Oferta {
  _id: string
  titulo: string
  descripcion: string
  tipoGancho: string
  valorDescuento: number
  inicioEn: string
  finEn: string
  cupoTotal: number
  cupoUsado: number
  activa: boolean
  bloqueHorario: string
  condiciones: string
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
  { v: 'desayuno', t: '🥐 Desayuno (08–11:30)' },
  { v: 'almuerzo', t: '🍽️ Almuerzo (12–14:30)' },
  { v: 'siesta', t: '🛍️ Siesta (14:30–17)' },
  { v: 'merienda', t: '☕ Merienda (17:30–19:30)' },
  { v: 'cena', t: '🌙 Cena / Bar (20–23:30)' }
]

const pad = (n: number) => String(n).padStart(2, '0')
// datetime-local necesita "YYYY-MM-DDTHH:mm" en hora local
function ahoraLocalInput(offsetMin = 0): string {
  const d = new Date(Date.now() + offsetMin * 60000)
  d.setSeconds(0, 0)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function isoALocalInput(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Estado REAL de una oferta, igual que lo evalúa el server. El badge debe coincidir
// con lo que pasa en el Radar: una oferta "Programada" (inicio futuro) NO se ve aún.
function estadoOferta(o: Oferta): { txt: string; cls: string; programada: boolean; finalizada: boolean } {
  const ahora = Date.now()
  const inicio = new Date(o.inicioEn).getTime()
  const fin = new Date(o.finEn).getTime()
  if (fin <= ahora) return { txt: 'Finalizada', cls: 'bg-gray-100 text-gray-500', programada: false, finalizada: true }
  if (!o.activa) return { txt: 'Pausada', cls: 'bg-amber-100 text-amber-700', programada: false, finalizada: false }
  if (inicio > ahora) return { txt: 'Programada', cls: 'bg-blue-100 text-blue-700', programada: true, finalizada: false }
  if (o.cupoTotal > 0 && o.cupoUsado >= o.cupoTotal) return { txt: 'Agotada', cls: 'bg-gray-100 text-gray-500', programada: false, finalizada: false }
  return { txt: '✓ En el Radar', cls: 'bg-green-100 text-green-700', programada: false, finalizada: false }
}

export default function PanelComercio() {
  const [comercios, setComercios] = useState<Comercio[]>([])
  const [sel, setSel] = useState<Comercio | null>(null)
  const [ofertas, setOfertas] = useState<Oferta[]>([])
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mostrarFormComercio, setMostrarFormComercio] = useState(false)
  const [editandoComercio, setEditandoComercio] = useState(false)
  const [mostrarFormOferta, setMostrarFormOferta] = useState(false)
  const [ofertaEditando, setOfertaEditando] = useState<Oferta | null>(null)

  useEffect(() => { cargarComercios() }, [])

  async function cargarComercios() {
    setCargando(true)
    try {
      const res = await api.get('/centro/mis-comercios')
      setComercios(res.data || [])
      if (res.data?.length) seleccionar(res.data[0])
      else setMostrarFormComercio(true)
    } catch {
      setError('No pudimos cargar tus comercios.')
    } finally {
      setCargando(false)
    }
  }

  async function seleccionar(c: Comercio) {
    setSel(c)
    setEditandoComercio(false)
    setMostrarFormOferta(false)
    setOfertaEditando(null)
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

  async function eliminarOferta(o: Oferta) {
    if (!window.confirm(`¿Eliminar la oferta "${o.titulo}"? Esta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/centro/ofertas/${o._id}`)
      setOfertas(ofertas.filter(x => x._id !== o._id))
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo eliminar la oferta.')
    }
  }

  async function eliminarComercio() {
    if (!sel) return
    if (!window.confirm(`¿Eliminar el local "${sel.nombre}" y TODAS sus ofertas? Esta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/centro/comercios/${sel._id}`)
      const restantes = comercios.filter(c => c._id !== sel._id)
      setComercios(restantes)
      if (restantes.length) seleccionar(restantes[0])
      else { setSel(null); setMostrarFormComercio(true) }
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo eliminar el local.')
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

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

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
                <button onClick={() => { setMostrarFormComercio(v => !v); setEditandoComercio(false) }} className="px-3 py-2 rounded-xl text-sm font-semibold border border-dashed border-ml-line text-ml-violet">
                  + Nuevo local
                </button>
              </div>
            )}

            {mostrarFormComercio && (
              <FormComercio
                onGuardado={(c) => { setComercios([...comercios, c]); setMostrarFormComercio(false); seleccionar(c) }}
                onCancelar={comercios.length ? () => setMostrarFormComercio(false) : undefined}
              />
            )}

            {sel && !mostrarFormComercio && (
              <>
                {/* Datos del local + acciones */}
                <div className="bg-white rounded-2xl border border-ml-line p-4">
                  {editandoComercio ? (
                    <FormComercio
                      inicial={sel}
                      onGuardado={(c) => {
                        setComercios(comercios.map(x => x._id === c._id ? c : x))
                        setSel(c)
                        setEditandoComercio(false)
                      }}
                      onCancelar={() => setEditandoComercio(false)}
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-ml-ink">{sel.nombre} <span className="text-xs font-normal text-ml-muted">· {sel.rubro}</span></p>
                        <p className="text-xs text-ml-muted">{sel.ubicacion.direccion} · {sel.ubicacion.ciudad}</p>
                        {sel.descripcion && <p className="text-sm text-ml-soft mt-1">{sel.descripcion}</p>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => setEditandoComercio(true)} className="text-xs px-3 py-1.5 border border-ml-line rounded-lg text-ml-soft hover:border-ml-violet">✏️ Editar</button>
                        <button onClick={eliminarComercio} className="text-xs px-3 py-1.5 border border-red-200 rounded-lg text-red-600 hover:bg-red-50">🗑️ Eliminar</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Métricas */}
                {metricas && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Metrica label="Reclamos" valor={metricas.reclamos} />
                    <Metrica label="Canjeados" valor={metricas.canjeados} />
                    <Metrica label="Conversión" valor={`${metricas.tasaConversion}%`} />
                    <Metrica label="Ingreso atrib." valor={`$${metricas.ingresoAtribuido.toLocaleString('es-AR')}`} />
                  </div>
                )}

                {/* Botón de pánico anti-desperdicio */}
                <LiquidacionRelampago
                  comercioId={sel._id}
                  onLanzada={(o) => setOfertas([o, ...ofertas])}
                />

                {/* Ofertas */}
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-ml-ink">Ofertas relámpago</h2>
                  <button
                    onClick={() => { setMostrarFormOferta(v => !v); setOfertaEditando(null) }}
                    className="text-sm px-3 py-1.5 ml-grad text-white rounded-lg font-semibold"
                  >
                    {mostrarFormOferta ? 'Cerrar' : '+ Nueva oferta'}
                  </button>
                </div>

                {mostrarFormOferta && (
                  <FormOferta
                    comercioId={sel._id}
                    onGuardado={(o) => { setOfertas([o, ...ofertas]); setMostrarFormOferta(false) }}
                    onCancelar={() => setMostrarFormOferta(false)}
                  />
                )}

                {ofertaEditando && (
                  <FormOferta
                    comercioId={sel._id}
                    inicial={ofertaEditando}
                    onGuardado={(o) => { setOfertas(ofertas.map(x => x._id === o._id ? o : x)); setOfertaEditando(null) }}
                    onCancelar={() => setOfertaEditando(null)}
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
                      const est = estadoOferta(o)
                      return (
                        <div key={o._id} className="bg-white rounded-xl border border-ml-line p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-ml-ink text-sm truncate">
                                {GANCHO_ICON[o.tipoGancho] || '🏷️'} {o.titulo}
                              </p>
                              <p className="text-xs text-ml-muted">
                                Cupo {o.cupoTotal === 0 ? '∞' : `${o.cupoUsado}/${o.cupoTotal}`} ·
                                {' '}vence {fin.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </p>
                              {est.programada && (
                                <p className="text-[11px] text-blue-600 mt-0.5">
                                  ⏰ Empieza {new Date(o.inicioEn).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} — recién ahí aparece en el Radar.
                                </p>
                              )}
                            </div>
                            <span className={`text-[10px] px-2 py-1 rounded-full font-semibold shrink-0 ${est.cls}`}>
                              {est.txt}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-ml-line2">
                            {!est.finalizada && (
                              <button onClick={() => togglePausaOferta(o)} className="text-xs px-2 py-1 border border-ml-line rounded-lg text-ml-soft hover:border-ml-violet">
                                {o.activa ? '⏸️ Pausar' : '▶️ Activar'}
                              </button>
                            )}
                            <button onClick={() => { setOfertaEditando(o); setMostrarFormOferta(false) }} className="text-xs px-2 py-1 border border-ml-line rounded-lg text-ml-soft hover:border-ml-violet">
                              ✏️ Editar
                            </button>
                            <button onClick={() => eliminarOferta(o)} className="text-xs px-2 py-1 border border-red-200 rounded-lg text-red-600 hover:bg-red-50">
                              🗑️ Eliminar
                            </button>
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

// ===== Form de alta / edición de comercio =====
function FormComercio({ inicial, onGuardado, onCancelar }: { inicial?: Comercio; onGuardado: (c: Comercio) => void; onCancelar?: () => void }) {
  const edicion = !!inicial
  const [f, setF] = useState({
    nombre: inicial?.nombre || '',
    rubro: inicial?.rubro || 'cafeteria',
    descripcion: inicial?.descripcion || '',
    direccion: inicial?.ubicacion.direccion || '',
    ciudad: inicial?.ubicacion.ciudad || '',
    lat: inicial ? String(inicial.ubicacion.lat) : '',
    lng: inicial ? String(inicial.ubicacion.lng) : '',
    whatsapp: inicial?.contacto?.whatsapp || '',
    instagram: inicial?.contacto?.instagram || ''
  })
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
    const payload = {
      nombre: f.nombre,
      rubro: f.rubro,
      descripcion: f.descripcion,
      ubicacion: { lat: Number(f.lat), lng: Number(f.lng), direccion: f.direccion, ciudad: f.ciudad },
      contacto: { whatsapp: f.whatsapp, instagram: f.instagram }
    }
    try {
      const res = edicion
        ? await api.put(`/centro/comercios/${inicial!._id}`, payload)
        : await api.post('/centro/comercios', payload)
      onGuardado(res.data)
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo guardar el local.')
    } finally {
      setGuardando(false)
    }
  }

  const inp = 'w-full px-3 py-2 border border-ml-line rounded-xl focus:border-ml-violet outline-none text-sm'
  return (
    <form onSubmit={guardar} className="space-y-3">
      <h3 className="font-bold text-ml-ink">{edicion ? 'Editar local' : 'Nuevo local'}</h3>
      <input className={inp} placeholder="Nombre del local" value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <select className={inp} value={f.rubro} onChange={e => setF({ ...f, rubro: e.target.value })}>
          {RUBROS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input className={inp} placeholder="Ciudad" value={f.ciudad} onChange={e => setF({ ...f, ciudad: e.target.value })} />
      </div>
      <input className={inp} placeholder="Dirección" value={f.direccion} onChange={e => setF({ ...f, direccion: e.target.value })} />
      <textarea className={inp} placeholder="Descripción corta" rows={2} value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <input className={inp} placeholder="WhatsApp (opcional)" value={f.whatsapp} onChange={e => setF({ ...f, whatsapp: e.target.value })} />
        <input className={inp} placeholder="Instagram (opcional)" value={f.instagram} onChange={e => setF({ ...f, instagram: e.target.value })} />
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={usarUbicacion} className="text-sm px-3 py-2 border border-ml-line rounded-xl text-ml-violet font-semibold">
          📍 Usar mi ubicación actual
        </button>
        <span className="text-xs text-ml-muted">{f.lat && f.lng ? `${Number(f.lat).toFixed(4)}, ${Number(f.lng).toFixed(4)}` : 'Sin coords'}</span>
      </div>
      <p className="text-[11px] text-ml-muted">Las coordenadas son del LOCAL (dato público) y se redondean a ~11 m.</p>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={guardando} className="flex-1 py-2.5 ml-grad text-white rounded-xl font-bold disabled:opacity-60">
          {guardando ? 'Guardando...' : edicion ? 'Guardar cambios' : 'Crear local'}
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} className="px-4 py-2.5 border border-ml-line rounded-xl font-semibold text-ml-soft">Cancelar</button>
        )}
      </div>
    </form>
  )
}

// ===== Form de alta / edición de oferta =====
function FormOferta({ comercioId, inicial, onGuardado, onCancelar }: { comercioId: string; inicial?: Oferta; onGuardado: (o: Oferta) => void; onCancelar?: () => void }) {
  const edicion = !!inicial
  // En edición: "empieza ahora" si el inicio guardado ya pasó.
  const inicioYaPaso = inicial ? new Date(inicial.inicioEn).getTime() <= Date.now() : true
  const [empiezaAhora, setEmpiezaAhora] = useState(inicioYaPaso)
  const [f, setF] = useState({
    titulo: inicial?.titulo || '',
    descripcion: inicial?.descripcion || '',
    tipoGancho: inicial?.tipoGancho || 'descuento',
    valorDescuento: inicial?.valorDescuento ? String(inicial.valorDescuento) : '',
    inicioEn: inicial ? isoALocalInput(inicial.inicioEn) : ahoraLocalInput(),
    finEn: inicial ? isoALocalInput(inicial.finEn) : ahoraLocalInput(60),
    cupoTotal: inicial?.cupoTotal ? String(inicial.cupoTotal) : '',
    bloqueHorario: inicial?.bloqueHorario || 'todos',
    condiciones: inicial?.condiciones || ''
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!f.titulo || !f.finEn) {
      setError('Título y fin son obligatorios.')
      return
    }
    // Si "empieza ahora", arrancamos 1 minuto en el pasado para que sea vigente ya
    // mismo (evita el borde en que el inicio queda unos segundos en el futuro).
    const inicioISO = empiezaAhora
      ? new Date(Date.now() - 60000).toISOString()
      : new Date(f.inicioEn).toISOString()
    if (new Date(f.finEn) <= new Date(inicioISO)) {
      setError('El fin debe ser posterior al inicio.')
      return
    }
    setGuardando(true)
    const payload = {
      comercioId,
      titulo: f.titulo,
      descripcion: f.descripcion,
      tipoGancho: f.tipoGancho,
      valorDescuento: f.valorDescuento ? Number(f.valorDescuento) : 0,
      inicioEn: inicioISO,
      finEn: new Date(f.finEn).toISOString(),
      cupoTotal: f.cupoTotal ? Number(f.cupoTotal) : 0,
      bloqueHorario: f.bloqueHorario,
      condiciones: f.condiciones
    }
    try {
      const res = edicion
        ? await api.put(`/centro/ofertas/${inicial!._id}`, payload)
        : await api.post('/centro/ofertas', payload)
      onGuardado(res.data)
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo guardar la oferta.')
    } finally {
      setGuardando(false)
    }
  }

  const inp = 'w-full px-3 py-2 border border-ml-line rounded-xl focus:border-ml-violet outline-none text-sm'
  return (
    <form onSubmit={guardar} className="bg-white rounded-2xl border border-ml-violet/30 p-4 space-y-3">
      <h3 className="font-bold text-ml-ink">{edicion ? 'Editar oferta' : 'Nueva oferta'}</h3>
      <input className={inp} placeholder='Título (ej. "2x1 en Macchiato")' value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} />
      <textarea className={inp} placeholder="Descripción" rows={2} value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <select className={inp} value={f.tipoGancho} onChange={e => setF({ ...f, tipoGancho: e.target.value })}>
          <option value="descuento">Descuento %</option>
          <option value="2x1">2x1</option>
          <option value="regalo">Regalo</option>
          <option value="combo">Combo</option>
        </select>
        {f.tipoGancho === 'descuento' && (
          <input className={inp} placeholder="% desc." inputMode="numeric" value={f.valorDescuento} onChange={e => setF({ ...f, valorDescuento: e.target.value })} />
        )}
      </div>
      <input className={inp} placeholder="Cupo total (0 = ilimitado)" inputMode="numeric" value={f.cupoTotal} onChange={e => setF({ ...f, cupoTotal: e.target.value })} />
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={empiezaAhora} onChange={e => setEmpiezaAhora(e.target.checked)} className="w-4 h-4 accent-ml-violet" />
        <span className="text-sm text-ml-ink font-semibold">Empieza ahora</span>
        <span className="text-xs text-ml-muted">(aparece en el Radar al instante)</span>
      </label>
      <div className={`grid gap-3 ${empiezaAhora ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {!empiezaAhora && (
          <div>
            <label className="block text-[11px] text-ml-muted mb-1">Inicia (programada)</label>
            <input type="datetime-local" className={inp} value={f.inicioEn} onChange={e => setF({ ...f, inicioEn: e.target.value })} />
          </div>
        )}
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
      <div className="flex gap-2">
        <button type="submit" disabled={guardando} className="flex-1 py-2.5 ml-grad text-white rounded-xl font-bold disabled:opacity-60">
          {guardando ? 'Guardando...' : edicion ? 'Guardar cambios' : 'Publicar oferta'}
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} className="px-4 py-2.5 border border-ml-line rounded-xl font-semibold text-ml-soft">Cancelar</button>
        )}
      </div>
    </form>
  )
}

// ===== Botón de pánico anti-desperdicio: "Liquidación Relámpago" =====
// El comercio liquida stock que sobra (facturas, platos del día) en una ventana
// corta. Crea una oferta de duración limitada y la difunde EN VIVO al Radar.
function LiquidacionRelampago({ comercioId, onLanzada }: { comercioId: string; onLanzada: (o: Oferta) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [f, setF] = useState({ titulo: '', descripcion: '', valorDescuento: 50, cupoTotal: 0, duracionMin: 45 })
  const [lanzando, setLanzando] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  async function lanzar() {
    if (!f.titulo.trim()) { setError('Poné un título, ej: "3 docenas de facturas al 50%".'); return }
    setLanzando(true)
    setError('')
    try {
      const res = await api.post('/centro/ofertas/liquidacion-relampago', { comercioId, ...f })
      onLanzada(res.data)
      setOk(true)
      setTimeout(() => { setAbierto(false); setOk(false); setF({ titulo: '', descripcion: '', valorDescuento: 50, cupoTotal: 0, duracionMin: 45 }) }, 2500)
    } catch (e: any) {
      setError(e.response?.data?.error || 'No pudimos lanzar la liquidación.')
    } finally {
      setLanzando(false)
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-sm transition-colors"
      >
        ⚡ Liquidación Relámpago
        <span className="text-xs font-normal text-white/80">— vaciá lo que sobra ya</span>
      </button>
    )
  }

  return (
    <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-red-700">⚡ Liquidación Relámpago</h3>
        <button onClick={() => setAbierto(false)} className="text-xs text-ml-soft hover:text-ml-ink">Cerrar</button>
      </div>
      <p className="text-xs text-ml-soft">Avisás EN VIVO a los vecinos del Radar a la redonda (~15 cuadras). Ideal para vaciar stock antes de cerrar el turno.</p>

      {ok ? (
        <p className="text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          🚀 ¡Lanzada! Ya está sonando en el Radar de los vecinos.
        </p>
      ) : (
        <>
          <input
            value={f.titulo}
            onChange={e => setF({ ...f, titulo: e.target.value })}
            placeholder='Ej: 3 docenas de facturas al 50%'
            maxLength={80}
            className="w-full px-3 py-2.5 rounded-xl border border-ml-line text-sm"
          />
          <input
            value={f.descripcion}
            onChange={e => setF({ ...f, descripcion: e.target.value })}
            placeholder="Detalle opcional (ej: retirar en mostrador)"
            maxLength={200}
            className="w-full px-3 py-2.5 rounded-xl border border-ml-line text-sm"
          />
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs text-ml-soft">
              Descuento %
              <input type="number" min={0} max={100} value={f.valorDescuento}
                onChange={e => setF({ ...f, valorDescuento: Number(e.target.value) })}
                className="w-full mt-1 px-2 py-2 rounded-lg border border-ml-line text-sm" />
            </label>
            <label className="text-xs text-ml-soft">
              Cupo (0 = libre)
              <input type="number" min={0} value={f.cupoTotal}
                onChange={e => setF({ ...f, cupoTotal: Number(e.target.value) })}
                className="w-full mt-1 px-2 py-2 rounded-lg border border-ml-line text-sm" />
            </label>
            <label className="text-xs text-ml-soft">
              Dura (min)
              <input type="number" min={15} max={180} value={f.duracionMin}
                onChange={e => setF({ ...f, duracionMin: Number(e.target.value) })}
                className="w-full mt-1 px-2 py-2 rounded-lg border border-ml-line text-sm" />
            </label>
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}

          <button
            onClick={lanzar}
            disabled={lanzando}
            className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 disabled:opacity-60 transition-colors"
          >
            {lanzando ? 'Lanzando...' : `🚀 Lanzar ya (${f.duracionMin} min)`}
          </button>
        </>
      )}
    </div>
  )
}
