import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { Coord, obtenerUbicacion, ordenarPorCercania, formatearDistancia } from '../utils/geo'
import TarjetaOfertaFlash, { OfertaFlash } from '../components/TarjetaOfertaFlash'
import DespatxadorBloqueHorario from '../components/DespatxadorBloqueHorario'
import RetornoPagoOferta from '../components/RetornoPagoOferta'
import { calcularOffset } from '../utils/canjes'
import { useBloqueHorario } from '../hooks/useBloqueHorario'

interface Comercio {
  _id: string
  nombre: string
  rubro: string
  descripcion: string
  ubicacion: Coord & { direccion: string; ciudad: string }
  estadoPrograma: string
  bloqueHorarioPrioritario: string
  media: { videoLoopUrl: string; posterUrl: string; fotos: string[] }
  tiempoPrepEstimado: number | null
  contacto: { whatsapp: string; instagram: string }
}

const RUBRO_ICON: Record<string, string> = {
  cafeteria: '☕', libreria: '📚', indumentaria: '👕',
  gastronomia: '🍽️', belleza: '💅', otro: '🏬'
}

type Estado = 'intro' | 'pidiendo' | 'listo' | 'error'

export default function RadarCentro() {
  // El consentimiento se recuerda en el navegador (no en el server)
  const [estado, setEstado] = useState<Estado>('intro')
  const [radarOn, setRadarOn] = useState(true)
  const [mayoria, setMayoria] = useState(false)
  const [error, setError] = useState('')
  const [comercios, setComercios] = useState<(Comercio & { distancia: number })[]>([])
  const [ofertas, setOfertas] = useState<OfertaFlash[]>([])
  const [offsetMs, setOffsetMs] = useState(0)
  const [cargandoComercios, setCargandoComercios] = useState(false)
  const [coords, setCoords] = useState<Coord | null>(null)
  const { bloqueActual, cargando: cargandoBloque } = useBloqueHorario()

  // Si ya dio consentimiento antes, lo recordamos
  useEffect(() => {
    if (localStorage.getItem('ml_radar_consent') === 'si') {
      setMayoria(true)
    }
  }, [])

  async function activarRadar() {
    setError('')
    if (!radarOn) {
      setError('Activá el interruptor del Radar para continuar.')
      return
    }
    if (!mayoria) {
      setError('Necesitás confirmar que sos mayor de 18 años.')
      return
    }
    localStorage.setItem('ml_radar_consent', 'si')
    setEstado('pidiendo')
    try {
      const ubic = await obtenerUbicacion()
      setCoords(ubic)
      setEstado('listo')
      cargarComercios(ubic)
    } catch (e: any) {
      setError(e.message || 'No pudimos acceder a tu ubicación.')
      setEstado('error')
    }
  }

  async function cargarComercios(coords: Coord) {
    setCargandoComercios(true)
    try {
      // El server manda las coords de los COMERCIOS. La distancia se calcula acá,
      // en tu navegador. Tu ubicación nunca se envía ni se guarda.
      const [comerciosRes, ofertasRes] = await Promise.all([
        api.get('/centro/comercios'),
        api.get('/centro/ofertas')
      ])
      const ordenados = ordenarPorCercania<Comercio>(comerciosRes.data || [], coords)
      setComercios(ordenados)
      // Las ofertas llegan con la hora del server: calculamos el offset para que
      // el countdown sea fiel a la realidad y no al reloj (posiblemente mal) del celu.
      setOffsetMs(calcularOffset(ofertasRes.data.serverNow))
      setOfertas(ofertasRes.data.ofertas || [])
    } catch {
      setError('No pudimos cargar los comercios del centro.')
    } finally {
      setCargandoComercios(false)
    }
  }

  // Datos del comercio (nombre + distancia) para mostrar en cada oferta flash.
  function infoComercio(comercioId: string) {
    const c = comercios.find(x => x._id === comercioId)
    return {
      nombre: c?.nombre,
      distanciaTexto: c ? formatearDistancia(c.distancia) : undefined
    }
  }

  function apagarRadar() {
    setEstado('intro')
    setComercios([])
  }

  // ===== Pantalla de pre-autorización (estilo lifestyle) =====
  if (estado === 'intro' || estado === 'pidiendo' || estado === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-ml-violet/10 via-ml-bg to-ml-bg flex items-center justify-center px-4 py-10">
        {/* Retorno de pago de MercadoPago (overlay si volvió de un checkout) */}
        <RetornoPagoOferta />
        <div className="max-w-md w-full bg-white rounded-3xl shadow-lg border border-ml-line overflow-hidden">
          {/* Hero */}
          <div className="bg-gradient-to-br from-ml-violet to-ml-blue p-8 text-center text-white">
            <div className="text-5xl mb-3">📍</div>
            <h1 className="font-display text-2xl font-extrabold">Radar del Centro</h1>
            <p className="text-white/90 text-sm mt-2">
              Descubrí cafeterías, descuentos y ofertas relámpago cerca tuyo, ahora mismo.
            </p>
          </div>

          <div className="p-6 space-y-5">
            {/* Toggle gigante */}
            <button
              onClick={() => setRadarOn(v => !v)}
              className="w-full flex items-center justify-between bg-ml-bg rounded-2xl p-4 border border-ml-line hover:border-ml-violet/40 transition-colors"
            >
              <div className="text-left">
                <p className="font-bold text-ml-ink">Activar Radar</p>
                <p className="text-xs text-ml-muted">Usa tu ubicación solo mientras lo tengas encendido</p>
              </div>
              <span className={`relative inline-flex h-9 w-16 shrink-0 items-center rounded-full transition-colors ${radarOn ? 'bg-green-500' : 'bg-gray-300'}`}>
                <span className={`inline-block h-7 w-7 transform rounded-full bg-white shadow transition-transform ${radarOn ? 'translate-x-8' : 'translate-x-1'}`} />
              </span>
            </button>

            {/* Transparencia */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
              <p className="text-xs text-ml-ink font-semibold flex items-center gap-1">🔒 Transparencia total</p>
              <ul className="text-[11px] text-ml-soft space-y-1 leading-relaxed">
                <li>• Tu ubicación se procesa <strong>solo en tu teléfono</strong> para medir la distancia.</li>
                <li>• <strong>No guardamos</strong> tus coordenadas en ningún servidor.</li>
                <li>• Podés apagar el Radar cuando quieras.</li>
                <li>• Navegás sin cuenta; solo te pedimos registro al canjear un beneficio.</li>
              </ul>
            </div>

            {/* Mayoría de edad */}
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={mayoria} onChange={e => setMayoria(e.target.checked)} className="mt-0.5 w-4 h-4 accent-ml-violet" />
              <span className="text-xs text-ml-soft">Confirmo que soy <strong>mayor de 18 años</strong> y acepto el uso de mi ubicación según la <Link to="/privacidad" className="text-ml-blue hover:underline">Política de Privacidad</Link>.</span>
            </label>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}

            <button
              onClick={activarRadar}
              disabled={estado === 'pidiendo'}
              className="w-full py-4 mlbtn ml-grad text-white rounded-2xl font-bold text-lg disabled:opacity-60"
            >
              {estado === 'pidiendo' ? 'Buscando comercios cerca...' : '📡 Encender Radar'}
            </button>
            <p className="text-center text-[11px] text-ml-muted">El navegador te va a pedir permiso de ubicación.</p>
          </div>
        </div>
      </div>
    )
  }

  // ===== Feed por cercanía =====
  // Ciudad vacía = el backend devuelve todas las localidades. El selector
  // multi-ciudad (módulo aparte) la setea más adelante; en el piloto (Lobos)
  // todas las ofertas son de la misma localidad.
  const ciudad = ''

  return (
    <div className="min-h-screen bg-ml-bg">
      {/* Retorno de pago de MercadoPago (overlay si volvió de un checkout) */}
      <RetornoPagoOferta />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-ml-ink">📍 Radar del Centro</h1>
            <p className="text-sm text-ml-muted">Ordenado por cercanía a vos</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => coords && cargarComercios(coords)}
              disabled={cargandoComercios}
              className="text-xs px-3 py-2 bg-white border border-ml-line rounded-xl font-semibold text-ml-soft hover:border-ml-violet disabled:opacity-50"
            >
              🔄 Actualizar
            </button>
            <Link to="/mis-canjes" className="text-xs px-3 py-2 bg-white border border-ml-line rounded-xl font-semibold text-ml-soft hover:border-ml-violet">
              🎟️ Mis canjes
            </Link>
            <button onClick={apagarRadar} className="text-xs px-3 py-2 bg-white border border-ml-line rounded-xl font-semibold text-ml-soft hover:border-red-300 hover:text-red-600">
              Apagar
            </button>
          </div>
        </div>

        {/* FASE 3: Despachador dinámico por bloque horario */}
        {!cargandoBloque && bloqueActual && (
          <DespatxadorBloqueHorario
            bloque={bloqueActual}
            coords={coords}
            ciudad={ciudad}
            cargando={cargandoComercios}
          />
        )}

        {/* Ofertas relámpago vigentes (solo si no hay bloque activo) */}
        {!cargandoComercios && !bloqueActual && ofertas.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-bold text-ml-soft uppercase tracking-wide mb-2">⚡ Ofertas relámpago cerca</h2>
            <div className="space-y-3">
              {ofertas.map(o => {
                const info = infoComercio(o.comercioId)
                return (
                  <TarjetaOfertaFlash
                    key={o._id}
                    oferta={o}
                    offsetMs={offsetMs}
                    nombreComercio={info.nombre}
                    distanciaTexto={info.distanciaTexto}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Feed de comercios (solo si no hay bloque activo) */}
        {!bloqueActual && (
          <>
            {cargandoComercios ? (
              <div className="flex justify-center py-16"><div className="spinner" /></div>
            ) : comercios.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-ml-line">
                <p className="text-4xl mb-3">🗺️</p>
                <p className="text-ml-muted text-sm">Todavía no hay comercios cargados en el Radar de tu zona.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {comercios.map(c => (
                  <div key={c._id} className="bg-white rounded-2xl shadow-sm border border-ml-line overflow-hidden">
                    <div className="flex">
                      {/* Media / poster */}
                      <div className="w-24 sm:w-28 bg-ml-bg flex items-center justify-center shrink-0 overflow-hidden">
                        {c.media?.posterUrl ? (
                          <img src={c.media.posterUrl} alt={c.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-4xl">{RUBRO_ICON[c.rubro] || '🏬'}</span>
                        )}
                      </div>
                      <div className="flex-1 p-3 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-ml-ink truncate">{c.nombre}</h3>
                          {c.estadoPrograma === 'fundador' && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">⭐ Fundador</span>
                          )}
                        </div>
                        <p className="text-xs text-ml-muted line-clamp-1">{c.descripcion || c.ubicacion.direccion}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className="font-semibold text-ml-violet">📍 {formatearDistancia(c.distancia)}</span>
                          {c.tiempoPrepEstimado && (
                            <span className="text-green-600">⏱️ listo en ~{c.tiempoPrepEstimado} min</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <p className="text-center text-[11px] text-ml-muted mt-6">
          🔒 Tu ubicación se usa solo en este dispositivo y no se almacena.
        </p>
      </div>
    </div>
  )
}
