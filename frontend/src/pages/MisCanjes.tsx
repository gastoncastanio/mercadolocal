import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import api from '../services/api'
import { calcularOffset, ahoraServidor, formatearCuenta, obtenerCodigo, guardarCodigo, GANCHO_ICON } from '../utils/canjes'

interface Canje {
  _id: string
  estado: 'emitido' | 'canjeado' | 'expirado' | 'pagado_sin_codigo'
  emitidoEn: string
  expiraEn: string
  canjeadoEn: string | null
  vigente: boolean
  estadoPago?: string
  pagadoSinCodigo?: boolean
  comercio: { _id: string; nombre: string; rubro: string; ubicacion: { direccion: string; ciudad: string } } | null
  oferta: { _id: string; titulo: string; descripcion: string; tipoGancho: string } | null
}

// QR generado 100% en el navegador (sin servicio externo → privacidad).
function QrCanje({ codigo }: { codigo: string }) {
  const [dataUrl, setDataUrl] = useState('')
  useEffect(() => {
    // El QR codifica una URL que el comercio abre con la CÁMARA NATIVA de su
    // celular (no necesitamos un escáner dentro de la app). Cae en la pantalla
    // de canje con el código precargado. También se puede tipear a mano.
    const url = `${window.location.origin}/comercio/canjear?codigo=${encodeURIComponent(codigo)}`
    QRCode.toDataURL(url, { width: 220, margin: 1 })
      .then(setDataUrl)
      .catch(() => setDataUrl(''))
  }, [codigo])

  if (!dataUrl) return <div className="w-[220px] h-[220px] bg-ml-bg rounded-xl flex items-center justify-center"><div className="spinner" /></div>
  return <img src={dataUrl} alt="QR de canje" width={220} height={220} className="w-[220px] h-[220px] rounded-xl" />
}

function CuentaRegresiva({ expiraEn, offsetMs }: { expiraEn: string; offsetMs: number }) {
  const [ms, setMs] = useState(0)
  useEffect(() => {
    const fin = new Date(expiraEn).getTime()
    const tick = () => setMs(fin - ahoraServidor(offsetMs))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiraEn, offsetMs])
  if (ms <= 0) return <span className="text-red-600 font-semibold">Expirado</span>
  return <span className="font-mono font-bold text-amber-600">⏳ {formatearCuenta(ms)}</span>
}

export default function MisCanjes() {
  const [canjes, setCanjes] = useState<Canje[]>([])
  const [offsetMs, setOffsetMs] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [recuperando, setRecuperando] = useState<string | null>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    try {
      const res = await api.get('/centro/mis-canjes')
      setOffsetMs(calcularOffset(res.data.serverNow))
      setCanjes(res.data.canjes || [])
    } catch {
      setError('No pudimos cargar tus canjes.')
    } finally {
      setCargando(false)
    }
  }

  // Pagó pero el código nunca se generó (cerró el navegador al volver de MP).
  // confirmar-pago lo regenera y renueva la ventana de canje.
  async function recuperarCodigo(canjeId: string) {
    setRecuperando(canjeId)
    setError('')
    try {
      const res = await api.post(`/centro/canje/${canjeId}/confirmar-pago`)
      if (res.data.codigo) guardarCodigo(canjeId, res.data.codigo, res.data.expiraEn)
      await cargar()
    } catch {
      setError('No pudimos recuperar tu código. Probá de nuevo en un momento.')
    } finally {
      setRecuperando(null)
    }
  }

  const recuperables = canjes.filter(c => c.pagadoSinCodigo)
  const activos = canjes.filter(c => !c.pagadoSinCodigo && c.estado === 'emitido' && c.vigente)
  const historial = canjes.filter(c => !c.pagadoSinCodigo && !(c.estado === 'emitido' && c.vigente))

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-display text-2xl font-extrabold text-ml-ink">🎟️ Mis canjes</h1>
          <Link to="/radar" className="text-xs px-3 py-2 bg-white border border-ml-line rounded-xl font-semibold text-ml-ink hover:border-ml-violet">
            📍 Ir al Radar
          </Link>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">{error}</p>}

        {cargando ? (
          <div className="flex justify-center py-16"><div className="spinner" /></div>
        ) : canjes.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-ml-line">
            <p className="text-4xl mb-3">🎟️</p>
            <p className="text-ml-muted text-sm">Todavía no reclamaste ninguna oferta.</p>
            <Link to="/radar" className="inline-block mt-4 px-4 py-2 ml-grad text-white rounded-xl font-bold text-sm">Explorar el Radar</Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pagados sin código — el usuario pagó pero no llegó a confirmar */}
            {recuperables.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-ml-soft uppercase tracking-wide">Pago confirmado — recuperá tu código</h2>
                {recuperables.map(c => (
                  <div key={c._id} className="bg-white rounded-2xl border border-green-300 overflow-hidden">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 text-white">
                      <span className="text-sm font-bold">{GANCHO_ICON[c.oferta?.tipoGancho || ''] || '🏷️'} {c.oferta?.titulo}</span>
                    </div>
                    <div className="p-4 text-center">
                      <p className="text-xs text-ml-muted mb-3">
                        ✅ Tu pago se acreditó en <span className="font-semibold">{c.comercio?.nombre}</span>, pero no llegaste a ver tu código. Recuperalo acá:
                      </p>
                      <button
                        onClick={() => recuperarCodigo(c._id)}
                        disabled={recuperando === c._id}
                        className="w-full py-3 ml-grad text-white rounded-xl font-bold disabled:opacity-60"
                      >
                        {recuperando === c._id ? 'Recuperando…' : '🎟️ Recuperar mi código'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Activos — mostramos QR + código */}
            {activos.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-ml-soft uppercase tracking-wide">Listos para canjear</h2>
                {activos.map(c => {
                  const codigo = obtenerCodigo(c._id)
                  return (
                    <div key={c._id} className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-white flex items-center justify-between">
                        <span className="text-sm font-bold">{GANCHO_ICON[c.oferta?.tipoGancho || ''] || '🏷️'} {c.oferta?.titulo}</span>
                        <CuentaRegresiva expiraEn={c.expiraEn} offsetMs={offsetMs} />
                      </div>
                      <div className="p-4 flex flex-col items-center text-center">
                        <p className="text-xs text-ml-muted mb-3">{c.comercio?.nombre} · {c.comercio?.ubicacion?.direccion}</p>
                        {codigo ? (
                          <>
                            <QrCanje codigo={codigo} />
                            <p className="text-xs text-ml-muted mt-3">Mostrá este QR o dictá el código:</p>
                            <p className="text-2xl font-mono font-extrabold tracking-widest text-ml-ink mt-1">{codigo}</p>
                            <p className="text-[11px] text-ml-muted mt-2">El comercio lo escanea con la cámara o lo tipea para validarlo.</p>
                          </>
                        ) : (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                            ⚠️ Este código se generó en otro dispositivo y no puede mostrarse acá por seguridad.
                            Reclamá la oferta de nuevo desde el Radar si la necesitás.
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Historial */}
            {historial.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-bold text-ml-soft uppercase tracking-wide">Historial</h2>
                {historial.map(c => (
                  <div key={c._id} className="bg-white rounded-xl border border-ml-line p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-ml-ink text-sm truncate">{c.oferta?.titulo || 'Oferta'}</p>
                      <p className="text-xs text-ml-muted truncate">{c.comercio?.nombre}</p>
                    </div>
                    <span className={`text-[11px] px-2 py-1 rounded-full font-semibold shrink-0 ${
                      c.estado === 'canjeado' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {c.estado === 'canjeado' ? '✅ Canjeado' : '⌛ Expirado'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
