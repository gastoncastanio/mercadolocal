import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

interface Perfil {
  _id: string
  nombreServicio: string
  descripcion: string
  vehiculo: { tipo: string; patente: string; capacidadBultos: number }
  zonasHabituales: string[]
  telefonoContacto: string
  dniVerificado: boolean
  calificacion: number
  totalViajes: number
}

interface Viaje {
  _id: string
  origen: { ciudad: string }
  destino: { ciudad: string }
  fechaSalida: string
  horaSalida: string
  capacidadTotal: number
  capacidadDisponible: number
  estado: string
}

interface Envio {
  _id: string
  estado: string
  cantidadBultos: number
  tamano: string
  precio: number
  descripcion: string
  contratanteId?: { _id: string; nombre: string; avatar: string } | null
  viajeId?: { origen: { ciudad: string }; destino: { ciudad: string } } | null
}

const TIPOS_VEHICULO = ['auto', 'camioneta', 'utilitario', 'camion', 'moto', 'otro']

const ESTADO_ENVIO: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: 'Pendiente', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  aceptado: { texto: 'Aceptado', clase: 'bg-blue-50 text-blue-700 border-blue-200' },
  en_transito: { texto: 'En tránsito', clase: 'bg-violet-50 text-ml-violet border-violet-200' },
  entregado: { texto: 'Entregado', clase: 'bg-green-50 text-green-700 border-green-200' },
  cancelado: { texto: 'Cancelado', clase: 'bg-red-50 text-red-600 border-red-200' }
}

export default function MiPerfilComisionistaPage() {
  const navigate = useNavigate()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [viajes, setViajes] = useState<Viaje[]>([])
  const [envios, setEnvios] = useState<Envio[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [accionando, setAccionando] = useState(false)
  const [codigos, setCodigos] = useState<Record<string, string>>({})

  // Form de perfil
  const [pf, setPf] = useState({
    nombreServicio: '', descripcion: '', tipo: 'auto', patente: '',
    capacidadBultos: 0, zonas: '', telefonoContacto: ''
  })

  // Form de viaje
  const [vf, setVf] = useState({
    origen: '', destino: '', fecha: '', hora: '',
    chico: 0, mediano: 0, grande: 0, capacidad: 1, notas: ''
  })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      const res = await api.get('/comisionistas/perfil/me')
      setPerfil(res.data)
      setPf({
        nombreServicio: res.data.nombreServicio || '',
        descripcion: res.data.descripcion || '',
        tipo: res.data.vehiculo?.tipo || 'auto',
        patente: res.data.vehiculo?.patente || '',
        capacidadBultos: res.data.vehiculo?.capacidadBultos || 0,
        zonas: (res.data.zonasHabituales || []).join(', '),
        telefonoContacto: res.data.telefonoContacto || ''
      })
      await Promise.all([cargarViajes(), cargarEnvios()])
    } catch (e: any) {
      if (e.response?.status === 404) {
        setPerfil(null) // todavía no tiene perfil → mostrar form de creación
      } else {
        setError(e.response?.data?.error || 'Error cargando tu perfil')
      }
    } finally {
      setCargando(false)
    }
  }

  async function cargarViajes() {
    try { const r = await api.get('/comisionistas/mis-viajes'); setViajes(r.data || []) } catch {}
  }
  async function cargarEnvios() {
    try { const r = await api.get('/comisionistas/envios-recibidos'); setEnvios(r.data || []) } catch {}
  }

  async function guardarPerfil(e: React.FormEvent) {
    e.preventDefault()
    setAccionando(true)
    setError('')
    const payload = {
      nombreServicio: pf.nombreServicio,
      descripcion: pf.descripcion,
      vehiculo: { tipo: pf.tipo, patente: pf.patente, capacidadBultos: Number(pf.capacidadBultos) },
      zonasHabituales: pf.zonas.split(',').map(z => z.trim()).filter(Boolean),
      telefonoContacto: pf.telefonoContacto
    }
    try {
      if (perfil) await api.patch('/comisionistas/perfil', payload)
      else await api.post('/comisionistas/perfil', payload)
      await cargar()
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al guardar el perfil')
    } finally {
      setAccionando(false)
    }
  }

  async function publicarViaje(e: React.FormEvent) {
    e.preventDefault()
    setAccionando(true)
    setError('')
    try {
      await api.post('/comisionistas/viaje', {
        origen: { ciudad: vf.origen },
        destino: { ciudad: vf.destino },
        fechaSalida: vf.fecha,
        horaSalida: vf.hora,
        tarifas: { bultoChico: Number(vf.chico), bultoMediano: Number(vf.mediano), bultoGrande: Number(vf.grande) },
        capacidadTotal: Number(vf.capacidad),
        notas: vf.notas
      })
      setVf({ origen: '', destino: '', fecha: '', hora: '', chico: 0, mediano: 0, grande: 0, capacidad: 1, notas: '' })
      await cargarViajes()
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al publicar el viaje')
    } finally {
      setAccionando(false)
    }
  }

  async function accionViaje(viajeId: string, accion: 'iniciar' | 'completar' | 'cancelar') {
    setAccionando(true)
    try {
      await api.patch(`/comisionistas/viaje/${viajeId}/${accion}`)
      await cargarViajes()
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al actualizar el viaje')
    } finally {
      setAccionando(false)
    }
  }

  async function accionEnvio(envioId: string, accion: 'aceptar' | 'transito' | 'cancelar') {
    setAccionando(true)
    try {
      await api.patch(`/comisionistas/envio/${envioId}/${accion}`)
      await Promise.all([cargarEnvios(), cargarViajes()])
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al actualizar el envío')
    } finally {
      setAccionando(false)
    }
  }

  async function confirmarEntrega(envioId: string) {
    const codigo = codigos[envioId]
    if (!codigo) { setError('Ingresá el código de entrega'); return }
    setAccionando(true)
    try {
      await api.patch(`/comisionistas/envio/${envioId}/entregar`, { codigo })
      setCodigos(prev => ({ ...prev, [envioId]: '' }))
      await Promise.all([cargarEnvios(), cargarViajes()])
    } catch (e: any) {
      setError(e.response?.data?.error || 'Código inválido')
    } finally {
      setAccionando(false)
    }
  }

  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center"><div className="spinner" /></div>
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white py-8 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold">{perfil ? 'Panel de comisionista' : 'Creá tu perfil de comisionista'}</h1>
          <button onClick={() => navigate('/comisionistas')} className="text-white/80 hover:text-white text-sm">Buscar viajes →</button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

        {/* Perfil (crear / editar) */}
        <form onSubmit={guardarPerfil} className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-ml-ink">{perfil ? 'Mi perfil' : 'Datos del comisionista'}</h2>
            {perfil && (
              <span className="text-sm text-ml-muted">⭐ {perfil.calificacion ? perfil.calificacion.toFixed(1) : '—'} · {perfil.totalViajes} viajes</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Nombre del servicio</label>
              <input value={pf.nombreServicio} onChange={(e) => setPf({ ...pf, nombreServicio: e.target.value })} placeholder="Ej: Envíos del Valle" className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Teléfono de contacto</label>
              <input value={pf.telefonoContacto} onChange={(e) => setPf({ ...pf, telefonoContacto: e.target.value })} className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-ml-ink mb-2">Descripción</label>
            <textarea value={pf.descripcion} onChange={(e) => setPf({ ...pf, descripcion: e.target.value })} placeholder="Contá qué zonas cubrís, con qué frecuencia viajás, etc." className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet h-20" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Vehículo</label>
              <select value={pf.tipo} onChange={(e) => setPf({ ...pf, tipo: e.target.value })} className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet">
                {TIPOS_VEHICULO.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Patente</label>
              <input value={pf.patente} onChange={(e) => setPf({ ...pf, patente: e.target.value })} className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ml-ink mb-2">Capacidad (bultos)</label>
              <input type="number" min={0} value={pf.capacidadBultos} onChange={(e) => setPf({ ...pf, capacidadBultos: Number(e.target.value) })} className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-ml-ink mb-2">Zonas habituales (separadas por coma)</label>
            <input value={pf.zonas} onChange={(e) => setPf({ ...pf, zonas: e.target.value })} placeholder="Ej: Neuquén, Cipolletti, Bariloche" className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet" />
          </div>
          <button type="submit" disabled={accionando} className="w-full py-3 mlbtn ml-grad text-white rounded-lg font-bold disabled:opacity-60">
            {accionando ? 'Guardando...' : perfil ? 'Guardar cambios' : 'Crear perfil'}
          </button>
        </form>

        {/* Resto del panel solo si ya tiene perfil */}
        {perfil && (
          <>
            {/* Publicar viaje */}
            <form onSubmit={publicarViaje} className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 space-y-4">
              <h2 className="text-lg font-bold text-ml-ink">Publicar un viaje</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input value={vf.origen} onChange={(e) => setVf({ ...vf, origen: e.target.value })} placeholder="Origen (ciudad)" className="px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet" />
                <input value={vf.destino} onChange={(e) => setVf({ ...vf, destino: e.target.value })} placeholder="Destino (ciudad)" className="px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet" />
                <input type="date" value={vf.fecha} onChange={(e) => setVf({ ...vf, fecha: e.target.value })} className="px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet" />
                <input value={vf.hora} onChange={(e) => setVf({ ...vf, hora: e.target.value })} placeholder="Hora (ej: 14:30)" className="px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ml-muted mb-1">Tarifa chico</label>
                  <input type="number" min={0} value={vf.chico} onChange={(e) => setVf({ ...vf, chico: Number(e.target.value) })} className="w-full px-3 py-2 border border-ml-line rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ml-muted mb-1">Tarifa mediano</label>
                  <input type="number" min={0} value={vf.mediano} onChange={(e) => setVf({ ...vf, mediano: Number(e.target.value) })} className="w-full px-3 py-2 border border-ml-line rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ml-muted mb-1">Tarifa grande</label>
                  <input type="number" min={0} value={vf.grande} onChange={(e) => setVf({ ...vf, grande: Number(e.target.value) })} className="w-full px-3 py-2 border border-ml-line rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ml-muted mb-1">Cap. (bultos)</label>
                  <input type="number" min={1} value={vf.capacidad} onChange={(e) => setVf({ ...vf, capacidad: Number(e.target.value) })} className="w-full px-3 py-2 border border-ml-line rounded-lg" />
                </div>
              </div>
              <input value={vf.notas} onChange={(e) => setVf({ ...vf, notas: e.target.value })} placeholder="Notas (opcional)" className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet" />
              <button type="submit" disabled={accionando} className="w-full py-2.5 mlbtn ml-grad text-white rounded-lg font-bold disabled:opacity-60">
                {accionando ? 'Publicando...' : 'Publicar viaje'}
              </button>
            </form>

            {/* Mis viajes */}
            <div>
              <h2 className="text-lg font-bold text-ml-ink mb-3">Mis viajes ({viajes.length})</h2>
              {viajes.length === 0 ? (
                <div className="bg-white rounded-2xl border border-ml-line p-6 text-center text-ml-muted">Todavía no publicaste viajes.</div>
              ) : (
                <div className="space-y-3">
                  {viajes.map(v => (
                    <div key={v._id} className="bg-white rounded-2xl shadow-sm border border-ml-line p-4 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-bold text-ml-ink">{v.origen.ciudad} → {v.destino.ciudad}</p>
                        <p className="text-xs text-ml-muted">
                          {new Date(v.fechaSalida).toLocaleDateString('es-AR')} · {v.capacidadDisponible}/{v.capacidadTotal} libres · <span className="capitalize">{v.estado}</span>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {v.estado === 'programado' && <button onClick={() => accionViaje(v._id, 'iniciar')} disabled={accionando} className="px-3 py-1.5 text-sm border border-ml-line rounded-lg font-semibold hover:bg-ml-bg">Iniciar</button>}
                        {v.estado === 'en_curso' && <button onClick={() => accionViaje(v._id, 'completar')} disabled={accionando} className="px-3 py-1.5 text-sm mlbtn ml-grad text-white rounded-lg font-semibold">Completar</button>}
                        {(v.estado === 'programado' || v.estado === 'en_curso') && <button onClick={() => accionViaje(v._id, 'cancelar')} disabled={accionando} className="px-3 py-1.5 text-sm text-red-600 font-semibold">Cancelar</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Envíos recibidos */}
            <div>
              <h2 className="text-lg font-bold text-ml-ink mb-3">Reservas en mis viajes ({envios.length})</h2>
              {envios.length === 0 ? (
                <div className="bg-white rounded-2xl border border-ml-line p-6 text-center text-ml-muted">Todavía no te reservaron envíos.</div>
              ) : (
                <div className="space-y-3">
                  {envios.map(envio => {
                    const info = ESTADO_ENVIO[envio.estado] || { texto: envio.estado, clase: 'bg-ml-bg text-ml-soft border-ml-line' }
                    return (
                      <div key={envio._id} className="bg-white rounded-2xl shadow-sm border border-ml-line p-5">
                        <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <img src={envio.contratanteId?.avatar || 'https://via.placeholder.com/36'} alt={envio.contratanteId?.nombre} className="w-9 h-9 rounded-full object-cover" />
                            <div>
                              <p className="text-sm font-semibold text-ml-ink">{envio.contratanteId?.nombre || 'Cliente'}</p>
                              <p className="text-xs text-ml-muted">{envio.viajeId?.origen.ciudad} → {envio.viajeId?.destino.ciudad}</p>
                            </div>
                          </div>
                          <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border ${info.clase}`}>{info.texto}</span>
                        </div>
                        <p className="text-sm text-ml-soft mb-3">{envio.cantidadBultos} bulto(s) {envio.tamano} · <span className="font-bold text-ml-violet">${envio.precio.toLocaleString('es-AR')}</span>{envio.descripcion ? ` · ${envio.descripcion}` : ''}</p>

                        {/* Acciones según estado */}
                        {envio.estado === 'en_transito' ? (
                          <div className="flex gap-2 items-end flex-wrap">
                            <div className="flex-1 min-w-[160px]">
                              <label className="block text-xs font-semibold text-ml-muted mb-1">Código de entrega (te lo da el cliente)</label>
                              <input value={codigos[envio._id] || ''} onChange={(e) => setCodigos(prev => ({ ...prev, [envio._id]: e.target.value }))} placeholder="ABCD-2345" className="w-full px-3 py-2 border border-ml-line rounded-lg uppercase" />
                            </div>
                            <button onClick={() => confirmarEntrega(envio._id)} disabled={accionando} className="px-4 py-2 mlbtn ml-grad text-white rounded-lg text-sm font-bold">Confirmar entrega</button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2 justify-end">
                            {envio.contratanteId && envio.estado !== 'cancelado' && (
                              <button onClick={() => navigate(`/chat?con=${envio.contratanteId!._id}&nombre=${encodeURIComponent(envio.contratanteId!.nombre)}`)} className="px-4 py-2 border border-ml-line rounded-lg text-sm font-semibold text-ml-ink hover:bg-ml-bg">💬 Chat</button>
                            )}
                            {envio.estado === 'pendiente' && <button onClick={() => accionEnvio(envio._id, 'aceptar')} disabled={accionando} className="px-4 py-2 mlbtn ml-grad text-white rounded-lg text-sm font-bold">Aceptar</button>}
                            {envio.estado === 'aceptado' && <button onClick={() => accionEnvio(envio._id, 'transito')} disabled={accionando} className="px-4 py-2 mlbtn ml-grad text-white rounded-lg text-sm font-bold">Marcar en tránsito</button>}
                            {['pendiente', 'aceptado'].includes(envio.estado) && <button onClick={() => accionEnvio(envio._id, 'cancelar')} disabled={accionando} className="px-4 py-2 text-sm font-semibold text-red-600">Cancelar</button>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
