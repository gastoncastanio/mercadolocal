import { useState, useEffect } from 'react'
import api from '../services/api'

interface Resena {
  _id: string
  compradorId: { _id: string; nombre: string }
  calificacion: number
  comentario: string
  respuestaVendedor?: string
  createdAt: string
}

interface ResenasProps {
  productoId: string
  puedeResenar: boolean
  ordenId?: string
}

export default function Resenas({ productoId, puedeResenar, ordenId }: ResenasProps) {
  const [resenas, setResenas] = useState<Resena[]>([])
  const [cargando, setCargando] = useState(true)
  const [calificacion, setCalificacion] = useState(0)
  const [hoverCalificacion, setHoverCalificacion] = useState(0)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    cargarResenas()
  }, [productoId])

  async function cargarResenas() {
    try {
      const res = await api.get(`/resenas/producto/${productoId}`)
      setResenas(res.data)
    } catch (error) {
      console.error('Error cargando resenas:', error)
    } finally {
      setCargando(false)
    }
  }

  async function enviarResena(e: React.FormEvent) {
    e.preventDefault()
    if (calificacion === 0) {
      setMensaje('Selecciona una calificacion')
      return
    }
    setEnviando(true)
    try {
      await api.post('/resenas', {
        productoId,
        ordenId,
        calificacion,
        comentario,
      })
      setCalificacion(0)
      setComentario('')
      setMensaje('Resena enviada correctamente')
      cargarResenas()
      setTimeout(() => setMensaje(''), 3000)
    } catch (err: any) {
      setMensaje(err.response?.data?.error || 'Error al enviar resena')
    } finally {
      setEnviando(false)
    }
  }

  const promedio =
    resenas.length > 0
      ? resenas.reduce((acc, r) => acc + r.calificacion, 0) / resenas.length
      : 0

  function renderEstrellas(valor: number) {
    return (
      <span className="text-yellow-400">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i}>{i <= Math.round(valor) ? '★' : '☆'}</span>
        ))}
      </span>
    )
  }

  if (cargando) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="animate-pulse text-center text-gray-400">Cargando resenas...</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">Resenas</h3>

      {/* Promedio */}
      <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100">
        <span className="text-4xl font-bold text-gray-800">{promedio.toFixed(1)}</span>
        <div>
          <div className="text-2xl">{renderEstrellas(promedio)}</div>
          <p className="text-sm text-gray-500">{resenas.length} resena{resenas.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Formulario */}
      {puedeResenar && (
        <form onSubmit={enviarResena} className="mb-6 pb-6 border-b border-gray-100">
          <h4 className="font-semibold text-gray-700 mb-3">Deja tu resena</h4>
          <div className="mb-3">
            <label className="block text-sm text-gray-600 mb-1">Calificacion</label>
            <div className="flex gap-1 text-3xl cursor-pointer">
              {[1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  onClick={() => setCalificacion(i)}
                  onMouseEnter={() => setHoverCalificacion(i)}
                  onMouseLeave={() => setHoverCalificacion(0)}
                  className={
                    i <= (hoverCalificacion || calificacion)
                      ? 'text-yellow-400'
                      : 'text-gray-300'
                  }
                >
                  ★
                </span>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Escribe tu comentario..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={enviando}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {enviando ? 'Enviando...' : 'Enviar Resena'}
          </button>
          {mensaje && (
            <p className="mt-2 text-sm font-medium text-green-600">{mensaje}</p>
          )}
        </form>
      )}

      {/* Lista de resenas */}
      {resenas.length === 0 ? (
        <p className="text-gray-400 text-center py-4">Aun no hay resenas</p>
      ) : (
        <div className="space-y-4">
          {resenas.map((r) => (
            <div key={r._id} className="border-b border-gray-50 pb-4 last:border-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">
                    {r.compradorId?.nombre || 'Usuario'}
                  </span>
                  <span className="text-sm">{renderEstrellas(r.calificacion)}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-gray-600 text-sm">{r.comentario}</p>
              {r.respuestaVendedor && (
                <div className="mt-2 ml-4 pl-3 border-l-2 border-blue-200 bg-blue-50 rounded-r-lg py-2 px-3">
                  <p className="text-xs font-semibold text-blue-600 mb-1">Respuesta del vendedor</p>
                  <p className="text-sm text-gray-700">{r.respuestaVendedor}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
