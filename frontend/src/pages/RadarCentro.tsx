import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { Coord, obtenerUbicacion, ordenarPorCercania, formatearDistancia, distanciaMetros } from '../utils/geo'
import TarjetaOfertaFlash, { OfertaFlash } from '../components/TarjetaOfertaFlash'
import DespatxadorBloqueHorario from '../components/DespatxadorBloqueHorario'
import RetornoPagoOferta from '../components/RetornoPagoOferta'
import AlertaLiquidacion, { Liquidacion } from '../components/AlertaLiquidacion'
import AlertaClima from '../components/AlertaClima'
import { calcularOffset } from '../utils/canjes'
import { useBloqueHorario, TEMA_NEUTRO } from '../hooks/useBloqueHorario'
import { useWeatherAlert } from '../hooks/useWeatherAlert'
import { useSocket } from '../hooks/useSocket'

interface Comercio {
  _id: string
  nombre: string
  rubro: string
  descripcion: string
  ubicacion: Coord & { direccion: string; ciudad: string }
  estadoPrograma: string
  verificado?: boolean
  bloqueHorarioPrioritario: string
  media: { logo?: string; videoLoopUrl: string; posterUrl: string; fotos: string[] }
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
  const [liquidacion, setLiquidacion] = useState<Liquidacion | null>(null)
  const { bloqueActual, cargando: cargandoBloque } = useBloqueHorario()
  const { alerta: alertaClima, cargando: cargandoClima } = useWeatherAlert(coords)
  const { on, off, emit } = useSocket()

  // Si ya dio consentimiento antes, activar radar automáticamente
  useEffect(() => {
    if (localStorage.getItem('ml_radar_consent') === 'si') {
      setMayoria(true)
      activarRadarAuto()
    }
  }, [])

  // Anti-desperdicio EN VIVO: nos unimos al Radar de la ciudad y escuchamos
  // "Liquidación Relámpago". El server difunde las coords del comercio; nosotros
  // decidimos si mostrar la alerta según NUESTRA distancia (privacy-first).
  useEffect(() => {
    if (estado !== 'listo' || !coords) return
    emit('radar:join', '')

    const onLiquidacion = (data: Liquidacion & { comercio: Coord & { nombre: string }; radioMetros: number }) => {
      if (!data?.comercio) return
      const dist = distanciaMetros(coords, { lat: data.comercio.lat, lng: data.comercio.lng })
      if (dist > (data.radioMetros || 1500)) return // fuera de las ~15 cuadras
      setLiquidacion({ ...data, distancia: dist })
      // Vibración háptica si el dispositivo lo soporta
      if ('vibrate' in navigator) navigator.vibrate?.([120, 60, 120])
    }

    on('liquidacion:nueva', onLiquidacion)
    return () => {
      off('liquidacion:nueva')
      emit('radar:leave', '')
    }
  }, [estado, coords, on, off, emit])

  async function activarRadarAuto() {
    setRadarOn(true)
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

  // Datos del comercio (nombre, logo, verificado + distancia) para cada oferta flash.
  function infoComercio(comercioId: string) {
    const c = comercios.find(x => x._id === comercioId)
    return {
      nombre: c?.nombre,
      logo: c?.media?.logo,
      verificado: c?.verificado || c?.estadoPrograma === 'fundador',
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

  // Radar Camaleón: el hero muta sus colores según el modo activo (desayuno,
  // almuerzo, siesta, merienda, cena). En los gaps horarios usa el tema neutro.
  const tema = bloqueActual?.tema || TEMA_NEUTRO
  const subtituloModo = bloqueActual
    ? `${tema.emoji} ${bloqueActual.titulo} · activo ahora`
    : 'Ordenado por cercanía a vos'

  return (
    <div className="min-h-screen bg-ml-bg">
      {/* Retorno de pago de MercadoPago (overlay si volvió de un checkout) */}
      <RetornoPagoOferta />

      {/* Hero Camaleón — muta de color según la hora del día */}
      <div
        className="text-white transition-colors duration-700"
        style={{ background: `linear-gradient(135deg, ${tema.colorDesde}, ${tema.colorHasta})` }}
      >
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-extrabold flex items-center gap-2">
                <span className="text-3xl leading-none">{tema.emoji}</span>
                Radar del Centro
              </h1>
              <p className="text-sm text-white/90 mt-1">{subtituloModo}</p>
            </div>
            <button
              onClick={apagarRadar}
              className="shrink-0 text-xs px-3 py-2 bg-white/15 hover:bg-white/25 backdrop-blur rounded-xl font-semibold text-white transition-colors"
            >
              Apagar
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Alerta del Clima (Modo Lluvia) */}
        {alertaClima && !cargandoClima && (
          <AlertaClima alerta={alertaClima} onCerrar={() => {}} />
        )}

        {/* Alerta EN VIVO de Liquidación Relámpago (anti-desperdicio) */}
        {liquidacion && (
          <AlertaLiquidacion liquidacion={liquidacion} onCerrar={() => setLiquidacion(null)} />
        )}

        <div className="flex items-center justify-end gap-2 mb-5">
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
                    logoComercio={info.logo}
                    verificadoComercio={info.verificado}
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
                  <div key={c._id} className="bg-white rounded-2xl shadow-sm border border-ml-line overflow-hidden hover:shadow-md transition-shadow">
                    <div className="flex flex-col sm:flex-row">
                      {/* Media / poster */}
                      <div className="w-full sm:w-28 h-28 sm:h-auto bg-gradient-to-br from-ml-violet/10 to-ml-blue/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {c.media?.posterUrl ? (
                          <img src={c.media.posterUrl} alt={c.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-5xl">{RUBRO_ICON[c.rubro] || '🏬'}</span>
                        )}
                      </div>
                      <div className="flex-1 p-4 min-w-0">
                        {/* Encabezado */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0 flex-1 flex items-start gap-2">
                            {/* Logo redondo del comercio */}
                            {c.media?.logo ? (
                              <img src={c.media.logo} alt={c.nombre} className="w-10 h-10 rounded-full object-cover border border-ml-line shrink-0" />
                            ) : (
                              <span className="w-10 h-10 rounded-full bg-ml-bg border border-ml-line flex items-center justify-center text-lg shrink-0">{RUBRO_ICON[c.rubro] || '🏬'}</span>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-ml-ink text-base">{c.nombre}</h3>
                                {(c.verificado || c.estadoPrograma === 'fundador') && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-ml-blue font-semibold" title="Comercio verificado">
                                    <span className="bg-ml-blue text-white rounded-full w-3.5 h-3.5 inline-flex items-center justify-center text-[8px]">✓</span>
                                    Verificado
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-ml-soft mt-0.5">{c.rubro}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-ml-violet text-sm">📍 {formatearDistancia(c.distancia)}</p>
                            {c.tiempoPrepEstimado && (
                              <p className="text-[11px] text-green-600 mt-1">⏱️ ~{c.tiempoPrepEstimado}m</p>
                            )}
                          </div>
                        </div>

                        {/* Descripción */}
                        <p className="text-xs text-ml-muted line-clamp-2 mb-3">{c.descripcion || c.ubicacion.direccion}</p>

                        {/* Dirección y contacto */}
                        <div className="space-y-2 mb-3">
                          <p className="text-[11px] text-ml-soft">📍 {c.ubicacion.direccion}</p>
                          <div className="flex flex-wrap gap-2">
                            {c.contacto?.whatsapp && (
                              <a href={`https://wa.me/${c.contacto.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-[11px] bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-100 transition-colors">
                                💬 WhatsApp
                              </a>
                            )}
                            {c.contacto?.instagram && (
                              <a href={`https://instagram.com/${c.contacto.instagram}`} target="_blank" rel="noopener noreferrer" className="text-[11px] bg-pink-50 text-pink-700 border border-pink-200 px-2 py-1 rounded-lg hover:bg-pink-100 transition-colors">
                                📸 Instagram
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Fotos galería */}
                        {c.media?.fotos && c.media.fotos.length > 0 && (
                          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                            {c.media.fotos.slice(0, 4).map((foto, idx) => (
                              <img key={idx} src={foto} alt={`${c.nombre} ${idx + 1}`} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                            ))}
                            {c.media.fotos.length > 4 && (
                              <div className="w-12 h-12 rounded-lg bg-ml-bg border border-ml-line flex items-center justify-center flex-shrink-0 text-xs font-bold text-ml-muted">
                                +{c.media.fotos.length - 4}
                              </div>
                            )}
                          </div>
                        )}
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
