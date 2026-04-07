import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

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
  venta: '\u{1F4B0}',
  compra: '\u{1F4E6}',
  mensaje: '\u{1F4AC}',
  pregunta: '\u2753',
  resena: '\u2B50',
  disputa: '\u26A0\uFE0F',
  sistema: '\u{1F514}',
  pago: '\u{1F4B3}'
}

export default function Notificaciones() {
  const [items, setItems] = useState<Notificacion[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargar()
  }, [])

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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">&#x1F514;</span>
            <h1 className="text-3xl font-bold text-gray-800">Notificaciones</h1>
            {noLeidas > 0 && (
              <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                {noLeidas} sin leer
              </span>
            )}
          </div>
          {noLeidas > 0 && (
            <button onClick={leerTodas} className="text-sm text-blue-600 hover:underline font-medium">
              Marcar todas como le&iacute;das
            </button>
          )}
        </div>

        {cargando ? (
          <div className="text-center py-16">
            <div className="animate-spin text-4xl">&#x1F504;</div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm">
            <p className="text-6xl mb-4">&#x1F515;</p>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">No tienes notificaciones</h2>
            <p className="text-gray-500">Te avisaremos cuando pase algo importante.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(n => {
              const Contenido = (
                <div className={`flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm border ${n.leida ? 'border-gray-100' : 'border-blue-200 bg-blue-50/30'}`}>
                  <div className="text-3xl shrink-0">{ICONOS[n.tipo] || '\u{1F514}'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`font-semibold ${n.leida ? 'text-gray-700' : 'text-gray-900'}`}>
                        {n.titulo}
                      </h3>
                      <span className="text-xs text-gray-400 shrink-0">{formatFecha(n.createdAt)}</span>
                    </div>
                    {n.mensaje && <p className="text-sm text-gray-600 mt-1">{n.mensaje}</p>}
                    {!n.leida && (
                      <span className="inline-block mt-2 w-2 h-2 rounded-full bg-blue-500"></span>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); eliminar(n._id) }}
                    className="text-gray-400 hover:text-red-500 text-sm px-2"
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
