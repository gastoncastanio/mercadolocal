import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { pushSoportado, estadoPermiso, yaSuscripto, activarPush, desactivarPush } from '../utils/pushNotifications'

interface Notificacion {
  _id: string
  tipo: string
  titulo: string
  mensaje: string
  enlace: string
  leida: boolean
  createdAt: string
}

const ICONOS: Record<string, string> = {
  venta: '\u{1F4B0}',          // \uD83D\uDCB0
  venta_split: '\u{1F4B0}',
  venta_sin_split: '\u{1F4B0}',
  compra: '\u{1F4E6}',         // \uD83D\uDCE6
  mensaje: '\u{1F4AC}',        // \uD83D\uDCAC
  pregunta: '\u2753',          // \u2753
  resena: '\u2B50',            // \u2B50
  disputa: '\u26A0\uFE0F',     // \u26A0\uFE0F
  sistema: '\u{1F514}',        // \uD83D\uDD14
  tienda_novedad: '\u{1F3EA}', // \uD83C\uDFEA novedad de una tienda que segu\u00EDs
  pago: '\u{1F4B3}',           // \uD83D\uDCB3
  pago_aprobado: '\u2705',     // \u2705
  comprobante: '\u{1F9FE}',    // \uD83E\uDDFE
  producto: '\u{1F4E6}',       // \uD83D\uDCE6
  carrito: '\u{1F6D2}',        // \uD83D\uDED2
  reembolso: '\u{1F4B8}',      // \uD83D\uDCB8
  remis: '\u{1F695}',          // \uD83D\uDE95
  envio: '\u{1F4E6}',          // \uD83D\uDCE6
  cotizacion: '\u{1F4CB}',     // \uD83D\uDCCB
  comisionista: '\u{1F69A}',   // \uD83D\uDE9A
  incidente: '\u26A0\uFE0F',   // \u26A0\uFE0F
  servicio: '\u{1F527}',       // \uD83D\uDD27
  suscripcion: '\u2B50',       // \u2B50
  trabajo: '\u{1F4BC}',        // \uD83D\uDCBC
  trabajo_oferta: '\u{1F4BC}',
  trabajo_asignado: '\u{1F4BC}',
  trabajo_completado: '\u2705',
  pauta: '\u{1F4E2}',          // \uD83D\uDCE2
  oferta_compartida_propuesta: '\u{1F91D}', // \uD83E\uDD1D
  incidencia_stock: '\u26A0\uFE0F'
}

export default function Notificaciones() {
  const [items, setItems] = useState<Notificacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [pushActivo, setPushActivo] = useState(false)
  const [pushProcesando, setPushProcesando] = useState(false)
  const [pushError, setPushError] = useState('')

  useEffect(() => {
    cargar()
    yaSuscripto().then(setPushActivo)
  }, [])

  async function togglePush() {
    setPushError('')
    setPushProcesando(true)
    try {
      if (pushActivo) {
        await desactivarPush()
        setPushActivo(false)
      } else {
        const ok = await activarPush()
        setPushActivo(ok)
        if (!ok) {
          setPushError(
            estadoPermiso() === 'denied'
              ? 'Bloqueaste las notificaciones. Habilitalas en los ajustes del navegador.'
              : 'No se pudo activar. Probá de nuevo.'
          )
        }
      }
    } catch (err: any) {
      setPushError(err?.response?.data?.error || err?.message || 'No se pudo cambiar la configuración')
    } finally {
      setPushProcesando(false)
    }
  }

  async function cargar() {
    try {
      const res = await api.get('/notificaciones')
      setItems(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  async function leerTodas() {
    try {
      await api.put('/notificaciones/leer-todas')
      setItems(prev => prev.map(n => ({ ...n, leida: true })))
    } catch (err) {
      console.error(err)
    }
  }

  async function marcarLeida(id: string) {
    try {
      await api.put(`/notificaciones/${id}/leer`)
      setItems(prev => prev.map(n => n._id === id ? { ...n, leida: true } : n))
    } catch {}
  }

  async function eliminar(id: string) {
    try {
      await api.delete(`/notificaciones/${id}`)
      setItems(prev => prev.filter(n => n._id !== id))
    } catch {}
  }

  function formatFecha(fecha: string) {
    const d = new Date(fecha)
    const ahora = new Date()
    const diff = ahora.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'ahora'
    if (mins < 60) return `hace ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `hace ${hrs} h`
    const dias = Math.floor(hrs / 24)
    if (dias < 7) return `hace ${dias} d`
    return d.toLocaleDateString('es-AR')
  }

  const noLeidas = items.filter(n => !n.leida).length

  return (
    <div className="min-h-screen bg-ml-bg py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">&#x1F514;</span>
            <h1 className="font-display text-[28px] font-extrabold text-ml-ink">Notificaciones</h1>
            {noLeidas > 0 && (
              <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                {noLeidas} sin leer
              </span>
            )}
          </div>
          {noLeidas > 0 && (
            <button onClick={leerTodas} className="text-sm text-ml-blue hover:underline font-medium">
              Marcar todas como le&iacute;das
            </button>
          )}
        </div>

        {/* Activar notificaciones push (avisos con la app cerrada) */}
        {pushSoportado() && (
          <div className="mb-6 flex items-center justify-between gap-4 p-4 bg-white rounded-xl shadow-sm border border-ml-line2">
            <div className="min-w-0">
              <p className="font-semibold text-ml-ink flex items-center gap-2">
                <span>&#x1F514;</span> Notificaciones en tu celular
              </p>
              <p className="text-sm text-ml-muted mt-0.5">
                Recib&iacute; avisos de ventas, pagos y mensajes aunque tengas la app cerrada.
              </p>
              {pushError && <p className="text-xs text-red-500 mt-1">{pushError}</p>}
            </div>
            <button
              onClick={togglePush}
              disabled={pushProcesando}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                pushActivo
                  ? 'bg-ml-bg border border-ml-line text-ml-ink'
                  : 'mlbtn ml-grad text-white'
              }`}
            >
              {pushProcesando ? '...' : pushActivo ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        )}

        {cargando ? (
          <div className="text-center py-16">
            <div className="animate-spin text-4xl">&#x1F504;</div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-ml-line">
            <p className="text-6xl mb-4">&#x1F515;</p>
            <h2 className="text-xl font-semibold text-ml-ink mb-2">No tienes notificaciones</h2>
            <p className="text-ml-muted">Te avisaremos cuando pase algo importante.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(n => {
              const Contenido = (
                <div className={`flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm border ${n.leida ? 'border-ml-line2' : 'border-blue-200 bg-blue-50/30'}`}>
                  <div className="text-3xl shrink-0">{ICONOS[n.tipo] || '\u{1F514}'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`font-semibold ${n.leida ? 'text-ml-ink' : 'text-ml-ink'}`}>
                        {n.titulo}
                      </h3>
                      <span className="text-xs text-ml-muted shrink-0">{formatFecha(n.createdAt)}</span>
                    </div>
                    {n.mensaje && <p className="text-sm text-ml-soft mt-1">{n.mensaje}</p>}
                    {!n.leida && (
                      <span className="inline-block mt-2 w-2 h-2 rounded-full bg-ml-blue"></span>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); eliminar(n._id) }}
                    className="text-ml-muted hover:text-red-500 text-sm px-2"
                    aria-label="Eliminar"
                  >&#x2715;</button>
                </div>
              )
              return n.enlace ? (
                <Link key={n._id} to={n.enlace} onClick={() => marcarLeida(n._id)} className="block">
                  {Contenido}
                </Link>
              ) : (
                <div key={n._id} onClick={() => marcarLeida(n._id)} className="cursor-pointer">
                  {Contenido}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
