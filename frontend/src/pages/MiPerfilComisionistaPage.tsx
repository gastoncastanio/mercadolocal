import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { subirImagenOptimizada } from '../utils/imageUpload'
import DeslindeComisionista from '../components/DeslindeComisionista'
import SelectorLocalidad, { LugarSeleccionado } from '../components/SelectorLocalidad'
import { LOCALIDADES, COBERTURA_TEXTO } from '../constants/localidades'
import MapaRumbo from '../components/MapaRumbo'
import { useSocket } from '../hooks/useSocket'
import { useAuth } from '../context/AuthContext'

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
  documentoVehiculo?: { verificado: boolean }
  estadoDocumento?: string
  estaTrabajandoHoy?: boolean
  horariosActivos?: Record<string, { desde?: string; hasta?: string }>
  mpVinculado?: boolean
  ofreceRemis?: boolean
  tarifasRemis?: { banderita: number; porKm: number; porHoraEspera: number; minimo: number }
}

interface Cotizacion {
  _id: string
  estado: string
  ciudadOrigen: string
  ciudadDestino: string
  descripcionCarga: string
  cotizacion: { monto: number | null; notas: string }
  incidente?: { reportado: boolean }
  compradorId?: { _id: string; nombre: string; avatar: string } | null
  vendedorId?: { _id: string; nombre: string; avatar: string } | null
  ordenId?: { total: number } | null
}

const DIAS = [
  { key: 'lunes', label: 'Lun' },
  { key: 'martes', label: 'Mar' },
  { key: 'miercoles', label: 'Mié' },
  { key: 'jueves', label: 'Jue' },
  { key: 'viernes', label: 'Vie' },
  { key: 'sabado', label: 'Sáb' },
  { key: 'domingo', label: 'Dom' }
]

interface PuntoViaje { ciudad: string; lat?: number | null; lng?: number | null }
interface Viaje {
  _id: string
  origen: PuntoViaje
  destino: PuntoViaje
  paradas?: PuntoViaje[]
  fechaSalida: string
  horaSalida: string
  capacidadTotal: number
  capacidadDisponible: number
  estado: string
}

const LUGAR_VACIO: LugarSeleccionado = { ciudad: '', lat: null, lng: null }

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

// Cuenta regresiva hasta que expira la subasta del envío (urgencia visible).
function CuentaRegresiva({ expiraEn }: { expiraEn: string }) {
  const [restante, setRestante] = useState(() => new Date(expiraEn).getTime() - Date.now())
  useEffect(() => {
    const t = setInterval(() => setRestante(new Date(expiraEn).getTime() - Date.now()), 1000)
    return () => clearInterval(t)
  }, [expiraEn])
  if (restante <= 0) return <span className="text-[11px] font-bold text-red-600">Cerrando…</span>
  const min = Math.floor(restante / 60000)
  const seg = Math.floor((restante % 60000) / 1000)
  const urgente = restante < 5 * 60 * 1000
  return (
    <span className={`text-[11px] font-bold tabular-nums ${urgente ? 'text-red-600 animate-pulse' : 'text-orange-700'}`}>
      ⏳ {min}:{String(seg).padStart(2, '0')}
    </span>
  )
}

export default function MiPerfilComisionistaPage() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const { on, off, emit } = useSocket(usuario?._id)
  const [params, setParams] = useSearchParams()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [viajes, setViajes] = useState<Viaje[]>([])
  const [envios, setEnvios] = useState<Envio[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [accionando, setAccionando] = useState(false)
  const [codigos, setCodigos] = useState<Record<string, string>>({})

  // Documento, horarios y cotizaciones (integración con el checkout)
  const [subiendoDoc, setSubiendoDoc] = useState(false)
  const [tipoDoc, setTipoDoc] = useState('titulo_propiedad')
  const [horarios, setHorarios] = useState<Record<string, { desde: string; hasta: string }>>({})
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [montos, setMontos] = useState<Record<string, string>>({})
  const [notasCot, setNotasCot] = useState<Record<string, string>>({})
  const [avisoMp, setAvisoMp] = useState('')
  // Subasta "comisionista en vivo": envíos disponibles ahora para competir.
  const [enviosVivo, setEnviosVivo] = useState<any[]>([])
  const [montoVivo, setMontoVivo] = useState<Record<string, string>>({})
  const [tiempoVivo, setTiempoVivo] = useState<Record<string, string>>({})
  // "Día rentable": ganancias y envíos del día (contador motivacional).
  const [miDia, setMiDia] = useState<{ ganancia: number; cantidad: number; oportunidades: number } | null>(null)

  // Remis (traslado de personas): tarifas configurables del conductor.
  const [tarifasRemis, setTarifasRemis] = useState({ banderita: 0, porKm: 0, porHoraEspera: 0, minimo: 0 })
  const [guardandoRemis, setGuardandoRemis] = useState(false)

  // Form de perfil
  const [pf, setPf] = useState({
    nombreServicio: '', descripcion: '', tipo: 'auto', patente: '',
    capacidadBultos: 0, zonas: '', telefonoContacto: ''
  })

  // Form de viaje
  const [vf, setVf] = useState({
    fecha: '', hora: '',
    chico: 0, mediano: 0, grande: 0, capacidad: 1, notas: ''
  })
  // Lugares del rumbo (con coordenadas para el mapa)
  const [origenViaje, setOrigenViaje] = useState<LugarSeleccionado>(LUGAR_VACIO)
  const [destinoViaje, setDestinoViaje] = useState<LugarSeleccionado>(LUGAR_VACIO)
  const [paradasViaje, setParadasViaje] = useState<LugarSeleccionado[]>([])

  useEffect(() => { cargar() }, [])

  // 🦈 Subasta en vivo en TIEMPO REAL: los envíos aparecen/desaparecen solos y
  // suena/vibra cuando entra uno nuevo (frenesí estilo apps de delivery).
  useEffect(() => {
    if (!usuario?._id) return
    emit('comisionista:vivo:join')

    const onNuevo = (e: any) => {
      // No mostrar mi propia compra ni duplicados.
      if (e.compradorId && e.compradorId === usuario._id) return
      setEnviosVivo(prev => {
        if (prev.some(x => x.ordenId === e.ordenId)) return prev
        avisarNuevoEnvio()
        return [e, ...prev]
      })
    }
    const onCerrado = (e: any) => {
      setEnviosVivo(prev => prev.filter(x => x.ordenId !== e.ordenId))
    }
    const onActualizado = (e: any) => {
      setEnviosVivo(prev => prev.map(x => x.ordenId === e.ordenId ? { ...x, ofertasActuales: e.ofertasActuales } : x))
    }

    on('envio_vivo:nuevo', onNuevo)
    on('envio_vivo:cerrado', onCerrado)
    on('envio_vivo:actualizado', onActualizado)
    return () => {
      emit('comisionista:vivo:leave')
      off('envio_vivo:nuevo'); off('envio_vivo:cerrado'); off('envio_vivo:actualizado')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?._id, on, off, emit])

  // Sonido + vibración al entrar un envío nuevo (gancho de atención).
  function avisarNuevoEnvio() {
    try { navigator.vibrate?.([120, 60, 120]) } catch { /* noop */ }
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'; osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(); osc.stop(ctx.currentTime + 0.36)
    } catch { /* el navegador puede bloquear audio sin interacción; no pasa nada */ }
  }

  // Feedback al volver del OAuth de Mercado Pago.
  useEffect(() => {
    const mp = params.get('mp')
    if (!mp) return
    if (mp === 'ok') setAvisoMp('✓ Mercado Pago vinculado correctamente.')
    else setAvisoMp('No se pudo vincular Mercado Pago. Probá de nuevo.')
    params.delete('mp'); params.delete('msg'); setParams(params, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      // Horarios activos
      const h: Record<string, { desde: string; hasta: string }> = {}
      for (const d of DIAS) {
        h[d.key] = {
          desde: res.data.horariosActivos?.[d.key]?.desde || '',
          hasta: res.data.horariosActivos?.[d.key]?.hasta || ''
        }
      }
      setHorarios(h)
      // Tarifas de remis
      setTarifasRemis({
        banderita: res.data.tarifasRemis?.banderita || 0,
        porKm: res.data.tarifasRemis?.porKm || 0,
        porHoraEspera: res.data.tarifasRemis?.porHoraEspera || 0,
        minimo: res.data.tarifasRemis?.minimo || 0
      })
      await Promise.all([cargarViajes(), cargarEnvios(), cargarCotizaciones(), cargarEnviosVivo()])
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
  async function cargarCotizaciones() {
    try { const r = await api.get('/comisionistas/cotizaciones-recibidas'); setCotizaciones(r.data || []) } catch {}
  }
  async function cargarEnviosVivo() {
    try { const r = await api.get('/comisionistas/envios-vivo-abiertos'); setEnviosVivo(r.data || []) } catch {}
    try { const d = await api.get('/comisionistas/mi-dia'); setMiDia(d.data) } catch {}
  }

  async function tomarVivo(ordenId: string) {
    const monto = Number(montoVivo[ordenId])
    if (!monto || monto <= 0) { setError('Ingresá un precio para agarrar el envío'); return }
    setAccionando(true)
    try {
      await api.post(`/comisionistas/envio-vivo/${ordenId}/tomar`, {
        monto, tiempoEstimado: tiempoVivo[ordenId] || ''
      })
      setEnviosVivo(prev => prev.filter(x => x.ordenId !== ordenId))
      await Promise.all([cargarEnviosVivo(), cargarCotizaciones()])
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo tomar el envío (puede que otro se haya adelantado)')
      await cargarEnviosVivo()
    } finally {
      setAccionando(false)
    }
  }

  async function ofertarVivo(ordenId: string) {
    const monto = Number(montoVivo[ordenId])
    if (!monto || monto <= 0) { setError('Ingresá un precio para ofertar'); return }
    setAccionando(true)
    try {
      await api.post(`/comisionistas/envio-vivo/${ordenId}/ofertar`, {
        monto, tiempoEstimado: tiempoVivo[ordenId] || ''
      })
      setMontoVivo(prev => ({ ...prev, [ordenId]: '' }))
      setTiempoVivo(prev => ({ ...prev, [ordenId]: '' }))
      await Promise.all([cargarEnviosVivo(), cargarCotizaciones()])
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo enviar la oferta')
    } finally {
      setAccionando(false)
    }
  }

  // Subir documento del vehículo (foto del título / cédula / licencia).
  async function subirDocumento(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendoDoc(true)
    setError('')
    try {
      const { url } = await subirImagenOptimizada(archivo)
      await api.post('/comisionistas/perfil/documento', {
        url, tipoDocumento: tipoDoc, nombreArchivo: archivo.name
      })
      await cargar()
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'No se pudo subir el documento')
    } finally {
      setSubiendoDoc(false)
      e.target.value = ''
    }
  }

  // Botón "estoy trabajando ahora".
  async function toggleTrabajando() {
    if (!perfil) return
    setAccionando(true)
    setError('')
    try {
      await api.patch('/comisionistas/perfil/trabajando', { activo: !perfil.estaTrabajandoHoy })
      await cargar()
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo actualizar tu estado')
    } finally {
      setAccionando(false)
    }
  }

  async function guardarHorarios() {
    setAccionando(true)
    setError('')
    // Solo enviar días con desde y hasta completos.
    const payload: Record<string, { desde: string; hasta: string }> = {}
    for (const d of DIAS) {
      const h = horarios[d.key]
      if (h?.desde && h?.hasta) payload[d.key] = { desde: h.desde, hasta: h.hasta }
    }
    try {
      await api.patch('/comisionistas/perfil', { horariosActivos: payload })
      await cargar()
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudieron guardar los horarios')
    } finally {
      setAccionando(false)
    }
  }

  // Activar/desactivar remis y guardar tarifas (traslado de personas).
  async function guardarRemis(activar: boolean) {
    setGuardandoRemis(true)
    setError('')
    try {
      await api.patch('/remis/configuracion', { ofreceRemis: activar, tarifasRemis })
      await cargar()
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo guardar la configuración de remis')
    } finally {
      setGuardandoRemis(false)
    }
  }

  // Responder una cotización con un precio.
  async function responderCotizacion(id: string) {
    const monto = Number(montos[id])
    if (!Number.isFinite(monto) || monto < 0) { setError('Ingresá un monto válido'); return }
    setAccionando(true)
    setError('')
    try {
      await api.patch(`/comisionistas/cotizacion/${id}/responder`, { monto, notas: notasCot[id] || '' })
      setMontos(prev => ({ ...prev, [id]: '' }))
      setNotasCot(prev => ({ ...prev, [id]: '' }))
      await cargarCotizaciones()
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo cotizar')
    } finally {
      setAccionando(false)
    }
  }

  async function cancelarCotizacion(id: string) {
    setAccionando(true)
    try {
      await api.patch(`/comisionistas/cotizacion/${id}/cancelar`)
      await cargarCotizaciones()
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo cancelar')
    } finally {
      setAccionando(false)
    }
  }

  async function reportarIncidente(id: string) {
    const descripcion = prompt('Describí brevemente qué pasó (rotura, accidente, etc.). El vendedor coordinará el reintegro al cliente:')
    if (descripcion === null) return
    setAccionando(true)
    try {
      await api.patch(`/comisionistas/cotizacion/${id}/incidente`, { descripcion })
      await cargarCotizaciones()
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo reportar el incidente')
    } finally {
      setAccionando(false)
    }
  }

  // Vincular Mercado Pago para cobrar los traslados (OAuth, split).
  async function vincularMercadoPago() {
    setAccionando(true)
    setError('')
    try {
      const res = await api.get(`/mp/comisionista/auth-url?origin=${encodeURIComponent(window.location.origin)}`)
      if (res.data?.authUrl) window.location.href = res.data.authUrl
      else setError('No se pudo iniciar la vinculación con Mercado Pago')
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo iniciar la vinculación')
    } finally {
      setAccionando(false)
    }
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
    if (!origenViaje.ciudad.trim() || !destinoViaje.ciudad.trim()) {
      setError('Indicá origen y destino del viaje')
      return
    }
    setAccionando(true)
    setError('')
    try {
      await api.post('/comisionistas/viaje', {
        origen: origenViaje,
        destino: destinoViaje,
        paradas: paradasViaje.filter(p => p.ciudad.trim()),
        fechaSalida: vf.fecha,
        horaSalida: vf.hora,
        tarifas: { bultoChico: Number(vf.chico), bultoMediano: Number(vf.mediano), bultoGrande: Number(vf.grande) },
        capacidadTotal: Number(vf.capacidad),
        notas: vf.notas
      })
      setVf({ fecha: '', hora: '', chico: 0, mediano: 0, grande: 0, capacidad: 1, notas: '' })
      setOrigenViaje(LUGAR_VACIO)
      setDestinoViaje(LUGAR_VACIO)
      setParadasViaje([])
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
        {avisoMp && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">{avisoMp}</p>}
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
            <label className="block text-sm font-semibold text-ml-ink mb-2">Localidades que cubrís</label>
            <p className="text-xs text-ml-muted mb-2">{COBERTURA_TEXTO}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {LOCALIDADES.map((loc) => {
                const seleccionadas = pf.zonas.split(',').map(z => z.trim()).filter(Boolean)
                const activa = seleccionadas.includes(loc)
                return (
                  <button
                    type="button"
                    key={loc}
                    onClick={() => {
                      const nuevas = activa
                        ? seleccionadas.filter(z => z !== loc)
                        : [...seleccionadas, loc]
                      setPf({ ...pf, zonas: nuevas.join(', ') })
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${activa ? 'bg-ml-violet text-white border-ml-violet' : 'bg-white text-ml-ink border-ml-line hover:border-ml-violet'}`}
                  >
                    {activa ? '✓ ' : ''}{loc}
                  </button>
                )
              })}
            </div>
          </div>
          <button type="submit" disabled={accionando} className="w-full py-3 mlbtn ml-grad text-white rounded-lg font-bold disabled:opacity-60">
            {accionando ? 'Guardando...' : perfil ? 'Guardar cambios' : 'Crear perfil'}
          </button>
        </form>

        {/* Resto del panel solo si ya tiene perfil */}
        {perfil && (
          <>
            {/* Documentación legal del vehículo + estado de trabajo */}
            <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 space-y-4">
              <h2 className="text-lg font-bold text-ml-ink">Documentación del vehículo</h2>
              <p className="text-xs text-ml-muted leading-relaxed">
                Para poder trabajar trasladando compras del marketplace tenés que cargar la documentación de tu vehículo.
                Verificamos que el vehículo esté <strong>a tu nombre</strong> o que tengas <strong>permiso para conducirlo</strong>.
                Hasta que un administrador lo verifique, no vas a aparecer en el panel de comisionistas en vivo.
              </p>

              {/* Estado del documento */}
              {perfil.estadoDocumento === 'verificado' ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 font-semibold">✓ Documento verificado. Ya podés trabajar.</div>
              ) : perfil.estadoDocumento === 'pendiente' && perfil.documentoVehiculo && !perfil.documentoVehiculo.verificado ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">⏳ Tu documento está en revisión. Te avisamos cuando se verifique.</div>
              ) : perfil.estadoDocumento === 'rechazado' ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">✕ Tu documento fue rechazado. Subí uno nuevo, válido y legible.</div>
              ) : (
                <div className="bg-ml-bg border border-ml-line rounded-lg p-3 text-sm text-ml-muted">Todavía no cargaste la documentación de tu vehículo.</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-ml-ink mb-2">Tipo de documento</label>
                  <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)} className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet">
                    <option value="titulo_propiedad">Título de propiedad (a mi nombre)</option>
                    <option value="cédula_estacionamiento">Cédula azul / autorización para conducir</option>
                    <option value="licencia_conducir">Licencia de conducir</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="w-full">
                    <span className="block w-full text-center py-2 border-2 border-dashed border-ml-line rounded-lg cursor-pointer text-sm font-semibold text-ml-violet hover:bg-violet-50">
                      {subiendoDoc ? 'Subiendo...' : '📎 Subir foto del documento'}
                    </span>
                    <input type="file" accept="image/*" onChange={subirDocumento} disabled={subiendoDoc} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Botón de trabajar */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-ml-line flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-ml-ink">Estado de trabajo</p>
                  <p className="text-xs text-ml-muted">{perfil.estaTrabajandoHoy ? 'Estás visible para los compradores ahora.' : 'No estás trabajando ahora.'}</p>
                </div>
                <button
                  onClick={toggleTrabajando}
                  disabled={accionando || perfil.estadoDocumento !== 'verificado'}
                  className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 ${perfil.estaTrabajandoHoy ? 'bg-green-600 text-white hover:bg-green-700' : 'mlbtn ml-grad text-white'}`}
                  title={perfil.estadoDocumento !== 'verificado' ? 'Necesitás el documento verificado' : ''}
                >
                  {perfil.estaTrabajandoHoy ? '🟢 Trabajando — Tocá para parar' : '▶ Empezar a trabajar'}
                </button>
              </div>

              {/* Cobro de traslados: vinculación de Mercado Pago */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-ml-line flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-ml-ink">Cobro de traslados</p>
                  <p className="text-xs text-ml-muted">
                    {perfil.mpVinculado
                      ? 'Mercado Pago vinculado. Vas a cobrar los traslados directo en tu cuenta.'
                      : 'Vinculá tu Mercado Pago para poder cobrar los traslados online.'}
                  </p>
                </div>
                {perfil.mpVinculado ? (
                  <span className="px-4 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm font-semibold">✓ MP vinculado</span>
                ) : (
                  <button onClick={vincularMercadoPago} disabled={accionando} className="px-5 py-2.5 rounded-lg font-bold text-sm bg-ml-mp text-white disabled:opacity-50">Vincular Mercado Pago</button>
                )}
              </div>
            </div>

            {/* ===== MercadoLocal Remis (traslado de personas) ===== */}
            <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-bold text-ml-ink flex items-center gap-2">🚕 MercadoLocal Remis</h2>
                  <p className="text-xs text-ml-muted mt-1 max-w-md">Con el mismo vehículo verificado podés ofrecer traslado de personas: la gente te pide desde la app, sin llamadas. Sumá viajes simples, ida y vuelta o "días de compras".</p>
                </div>
                {perfil.ofreceRemis ? (
                  <span className="px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-200 text-xs font-semibold shrink-0">🟢 Remis activo</span>
                ) : (
                  <span className="px-3 py-1.5 rounded-full bg-ml-bg text-ml-muted border border-ml-line text-xs font-semibold shrink-0">Desactivado</span>
                )}
              </div>

              {perfil.estadoDocumento !== 'verificado' && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  Necesitás el documento del vehículo verificado para ofrecer remis (misma verificación que para los envíos).
                </p>
              )}

              {/* Tarifas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ml-muted mb-1">Bajada de bandera ($)</label>
                  <input type="number" min={0} value={tarifasRemis.banderita || ''} onChange={e => setTarifasRemis(t => ({ ...t, banderita: Number(e.target.value) || 0 }))} placeholder="Base fija" className="w-full px-3 py-2 border border-ml-line rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ml-muted mb-1">Por kilómetro ($)</label>
                  <input type="number" min={0} value={tarifasRemis.porKm || ''} onChange={e => setTarifasRemis(t => ({ ...t, porKm: Number(e.target.value) || 0 }))} placeholder="Por km" className="w-full px-3 py-2 border border-ml-line rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ml-muted mb-1">Por hora de espera ($)</label>
                  <input type="number" min={0} value={tarifasRemis.porHoraEspera || ''} onChange={e => setTarifasRemis(t => ({ ...t, porHoraEspera: Number(e.target.value) || 0 }))} placeholder="Día de compras / ida y vuelta" className="w-full px-3 py-2 border border-ml-line rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ml-muted mb-1">Tarifa mínima ($)</label>
                  <input type="number" min={0} value={tarifasRemis.minimo || ''} onChange={e => setTarifasRemis(t => ({ ...t, minimo: Number(e.target.value) || 0 }))} placeholder="Mínimo por viaje" className="w-full px-3 py-2 border border-ml-line rounded-lg text-sm" />
                </div>
              </div>
              <p className="text-xs text-ml-muted">Precio estimado = bajada de bandera + (km × por km) + (horas de espera × por hora), nunca menor a la mínima.</p>

              <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-ml-line">
                {perfil.ofreceRemis && (
                  <button onClick={() => navigate('/remis/conductor')} className="px-4 py-2 border border-ml-violet text-ml-violet rounded-lg text-sm font-semibold hover:bg-violet-50">📥 Ver pedidos de remis</button>
                )}
                {perfil.ofreceRemis ? (
                  <>
                    <button onClick={() => guardarRemis(true)} disabled={guardandoRemis} className="px-4 py-2 mlbtn ml-grad text-white rounded-lg text-sm font-bold disabled:opacity-60">{guardandoRemis ? 'Guardando...' : 'Guardar tarifas'}</button>
                    <button onClick={() => guardarRemis(false)} disabled={guardandoRemis} className="px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-700">Desactivar remis</button>
                  </>
                ) : (
                  <button onClick={() => guardarRemis(true)} disabled={guardandoRemis || perfil.estadoDocumento !== 'verificado'} className="px-5 py-2.5 mlbtn ml-grad text-white rounded-lg text-sm font-bold disabled:opacity-50" title={perfil.estadoDocumento !== 'verificado' ? 'Necesitás el documento verificado' : ''}>
                    {guardandoRemis ? 'Activando...' : '🚕 Activar remis'}
                  </button>
                )}
              </div>
            </div>

            {/* Horarios activos */}
            <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 space-y-4">
              <h2 className="text-lg font-bold text-ml-ink">Mis horarios</h2>
              <p className="text-xs text-ml-muted">Indicá en qué franja horaria solés estar disponible cada día (opcional, informativo para los compradores).</p>
              <div className="space-y-2">
                {DIAS.map(d => (
                  <div key={d.key} className="flex items-center gap-3">
                    <span className="w-10 text-sm font-semibold text-ml-ink">{d.label}</span>
                    <input type="time" value={horarios[d.key]?.desde || ''} onChange={(e) => setHorarios(prev => ({ ...prev, [d.key]: { ...prev[d.key], desde: e.target.value } }))} className="px-2 py-1.5 border border-ml-line rounded-lg text-sm" />
                    <span className="text-ml-muted text-sm">a</span>
                    <input type="time" value={horarios[d.key]?.hasta || ''} onChange={(e) => setHorarios(prev => ({ ...prev, [d.key]: { ...prev[d.key], hasta: e.target.value } }))} className="px-2 py-1.5 border border-ml-line rounded-lg text-sm" />
                  </div>
                ))}
              </div>
              <button onClick={guardarHorarios} disabled={accionando} className="px-5 py-2 border border-ml-line rounded-lg font-semibold text-sm hover:bg-ml-bg disabled:opacity-50">Guardar horarios</button>
            </div>

            {/* Deslinde legal informativo */}
            <DeslindeComisionista />

            {/* 💸 Día rentable: contador motivacional de ganancias del día */}
            {miDia && (
              <div className="bg-gradient-to-r from-ml-violet to-ml-purple text-white rounded-2xl p-5 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs text-white/80 font-semibold uppercase tracking-wider">Tu día</p>
                  <p className="text-3xl font-extrabold">${miDia.ganancia.toLocaleString('es-AR')}</p>
                  <p className="text-sm text-white/90">{miDia.cantidad} envío{miDia.cantidad === 1 ? '' : 's'} completado{miDia.cantidad === 1 ? '' : 's'} hoy</p>
                </div>
                {miDia.oportunidades > 0 && (
                  <div className="text-right">
                    <p className="text-2xl font-extrabold">🔥 {miDia.oportunidades}</p>
                    <p className="text-xs text-white/90">envío{miDia.oportunidades === 1 ? '' : 's'} esperando ahora</p>
                  </div>
                )}
              </div>
            )}

            {/* 🔥 Envíos en vivo disponibles AHORA — competí por ellos */}
            {enviosVivo.length > 0 && (
              <div className="border-2 border-orange-300 bg-orange-50 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-bold text-ml-ink">🔥 Envíos disponibles ahora ({enviosVivo.length})</h2>
                  <button onClick={cargarEnviosVivo} className="text-xs font-semibold text-ml-violet hover:underline">↻ Actualizar</button>
                </div>
                <p className="text-xs text-ml-muted mb-3">Ofertá tu precio. El comprador elige: el más rápido y conveniente se lleva el envío.</p>
                <div className="space-y-3">
                  {enviosVivo.map(e => (
                    <div key={e.ordenId} className="bg-white rounded-xl border border-orange-200 p-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-bold text-ml-ink">{e.ciudadOrigen || '—'} → {e.ciudadDestino || '—'}</p>
                          <p className="text-xs text-ml-muted">{e.totalProductos} producto(s): {e.descripcionCarga}</p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          {e.expiraEn && <CuentaRegresiva expiraEn={e.expiraEn} />}
                          {e.ofertasActuales > 0 && (
                            <span className="text-[11px] font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded-full">
                              🦈 {e.ofertasActuales} compitiendo
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                        <input type="number" min={0} value={montoVivo[e.ordenId] || ''} onChange={ev => setMontoVivo(prev => ({ ...prev, [e.ordenId]: ev.target.value }))} placeholder="Tu precio $" className="px-3 py-2 border border-ml-line rounded-lg text-sm" />
                        <input value={tiempoVivo[e.ordenId] || ''} onChange={ev => setTiempoVivo(prev => ({ ...prev, [e.ordenId]: ev.target.value }))} placeholder="Ej: 2 horas" className="px-3 py-2 border border-ml-line rounded-lg text-sm" />
                        <button onClick={() => tomarVivo(e.ordenId)} disabled={accionando} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-bold hover:bg-orange-700 disabled:opacity-60">
                          🦈 Agarrar YA
                        </button>
                        <button onClick={() => ofertarVivo(e.ordenId)} disabled={accionando} className="px-4 py-2 border border-ml-violet text-ml-violet rounded-lg text-sm font-bold hover:bg-violet-50 disabled:opacity-60">
                          Ofertar
                        </button>
                      </div>
                      <p className="text-[10px] text-ml-muted mt-1">
                        <strong>Agarrar YA</strong>: te lo quedás al instante (el primero gana). <strong>Ofertar</strong>: competís y el comprador elige.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cotizaciones recibidas (comisionista en vivo) */}
            {cotizaciones.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-ml-ink mb-3">Solicitudes de cotización ({cotizaciones.length})</h2>
                <div className="space-y-3">
                  {cotizaciones.map(c => (
                    <div key={c._id} className="bg-white rounded-2xl shadow-sm border border-ml-line p-5">
                      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <img src={c.compradorId?.avatar || 'https://via.placeholder.com/36'} alt="" className="w-9 h-9 rounded-full object-cover" />
                          <div>
                            <p className="text-sm font-semibold text-ml-ink">{c.compradorId?.nombre || 'Comprador'}</p>
                            <p className="text-xs text-ml-muted">{c.ciudadOrigen || '—'} → {c.ciudadDestino || '—'}</p>
                          </div>
                        </div>
                        <span className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold border bg-ml-bg text-ml-soft border-ml-line capitalize">{c.estado}</span>
                      </div>
                      {c.descripcionCarga && <p className="text-xs text-ml-muted mb-2">📦 {c.descripcionCarga}</p>}

                      {/* Formulario de cotización */}
                      {['pendiente', 'cotizada'].includes(c.estado) && (
                        <div className="flex gap-2 items-end flex-wrap pt-2 border-t border-ml-line">
                          <div className="w-28">
                            <label className="block text-xs font-semibold text-ml-muted mb-1">Precio $</label>
                            <input type="number" min={0} value={montos[c._id] || ''} onChange={(e) => setMontos(prev => ({ ...prev, [c._id]: e.target.value }))} className="w-full px-3 py-2 border border-ml-line rounded-lg" />
                          </div>
                          <div className="flex-1 min-w-[140px]">
                            <label className="block text-xs font-semibold text-ml-muted mb-1">Notas (opcional)</label>
                            <input value={notasCot[c._id] || ''} onChange={(e) => setNotasCot(prev => ({ ...prev, [c._id]: e.target.value }))} placeholder="Ej: paso a la tarde" className="w-full px-3 py-2 border border-ml-line rounded-lg" />
                          </div>
                          <button onClick={() => responderCotizacion(c._id)} disabled={accionando} className="px-4 py-2 mlbtn ml-grad text-white rounded-lg text-sm font-bold">{c.estado === 'cotizada' ? 'Actualizar' : 'Cotizar'}</button>
                        </div>
                      )}

                      {c.estado === 'aceptada' && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2 text-sm text-green-800">
                          ✓ El comprador aceptó tu cotización de <strong>${c.cotizacion?.monto?.toLocaleString('es-AR')}</strong>. Coordiná el traslado por chat.
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 justify-end mt-2">
                        {c.compradorId && ['cotizada', 'aceptada'].includes(c.estado) && (
                          <button onClick={() => navigate(`/chat?con=${c.compradorId!._id}&nombre=${encodeURIComponent(c.compradorId!.nombre)}`)} className="px-4 py-2 border border-ml-line rounded-lg text-sm font-semibold text-ml-ink hover:bg-ml-bg">💬 Chat comprador</button>
                        )}
                        {c.vendedorId && c.estado === 'aceptada' && (
                          <button onClick={() => navigate(`/chat?con=${c.vendedorId!._id}&nombre=${encodeURIComponent(c.vendedorId!.nombre)}`)} className="px-4 py-2 border border-amber-300 bg-amber-50 rounded-lg text-sm font-semibold text-amber-800 hover:bg-amber-100">📍 Coordinar retiro</button>
                        )}
                        {c.estado === 'aceptada' && !c.incidente?.reportado && (
                          <button onClick={() => reportarIncidente(c._id)} disabled={accionando} className="px-4 py-2 text-sm font-semibold text-amber-700 hover:text-amber-800">⚠️ Reportar problema</button>
                        )}
                        {!['rechazada', 'cancelada'].includes(c.estado) && (
                          <button onClick={() => cancelarCotizacion(c._id)} disabled={accionando} className="px-4 py-2 text-sm font-semibold text-red-600">Rechazar</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Publicar viaje */}
            <form onSubmit={publicarViaje} className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 space-y-4">
              <h2 className="text-lg font-bold text-ml-ink">Publicar un viaje</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ml-muted mb-1">Origen</label>
                  <SelectorLocalidad valor={origenViaje} onChange={setOrigenViaje} placeholder="Localidad de origen" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ml-muted mb-1">Destino</label>
                  <SelectorLocalidad valor={destinoViaje} onChange={setDestinoViaje} placeholder="Localidad de destino" />
                </div>
              </div>

              {/* Ciudades en el camino (paradas) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-ml-muted">Localidades en el camino (opcional)</label>
                  <button type="button" onClick={() => setParadasViaje(prev => [...prev, { ...LUGAR_VACIO }])} className="text-xs font-semibold text-ml-violet hover:underline">+ Agregar parada</button>
                </div>
                {paradasViaje.length === 0 ? (
                  <p className="text-xs text-ml-muted">Agregá las localidades por las que pasás para que más gente encuentre tu viaje.</p>
                ) : (
                  <div className="space-y-2">
                    {paradasViaje.map((p, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <div className="flex-1">
                          <SelectorLocalidad
                            valor={p}
                            onChange={(lugar) => setParadasViaje(prev => prev.map((x, j) => j === i ? lugar : x))}
                            placeholder={`Parada ${i + 1}`}
                          />
                        </div>
                        <button type="button" onClick={() => setParadasViaje(prev => prev.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700 text-lg px-1" title="Quitar parada">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Vista previa del rumbo en el mapa */}
              {(origenViaje.lat != null || destinoViaje.lat != null || paradasViaje.some(p => p.lat != null)) && (
                <div>
                  <label className="block text-xs font-semibold text-ml-muted mb-1">Rumbo en el mapa</label>
                  <MapaRumbo origen={origenViaje} destino={destinoViaje} paradas={paradasViaje} altura={240} />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ml-muted mb-1">Fecha de salida</label>
                  <input type="date" value={vf.fecha} onChange={(e) => setVf({ ...vf, fecha: e.target.value })} className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ml-muted mb-1">Hora</label>
                  <input value={vf.hora} onChange={(e) => setVf({ ...vf, hora: e.target.value })} placeholder="Ej: 14:30" className="w-full px-4 py-2 border border-ml-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ml-violet" />
                </div>
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
