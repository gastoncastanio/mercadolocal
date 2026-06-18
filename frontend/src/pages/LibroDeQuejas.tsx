import { useState } from 'react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function LibroDeQuejas() {
  const { estaLogueado, usuario } = useAuth()
  const [texto, setTexto] = useState('')
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [numero, setNumero] = useState('')
  const [error, setError] = useState('')

  async function enviar() {
    setError('')
    if (texto.trim().length < 10) { setError('Contanos un poco más para poder ayudarte.'); return }
    if (!estaLogueado && !email.trim()) { setError('Necesitamos un email de contacto.'); return }
    setEnviando(true)
    try {
      const res = await api.post('/privacidad/queja', { texto, email })
      setNumero(res.data.numero)
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo registrar la queja')
    } finally {
      setEnviando(false)
    }
  }

  if (numero) {
    return (
      <div className="min-h-screen bg-ml-bg flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-ml-line2 p-8 max-w-md text-center">
          <p className="text-5xl mb-4">✅</p>
          <h1 className="font-bold text-ml-ink text-xl mb-2">Queja registrada</h1>
          <p className="text-sm text-ml-muted">
            Tu número de seguimiento es <span className="font-mono font-bold text-ml-ink">#{numero}</span>.
            Te vamos a responder al email indicado.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <h1 className="font-display text-[26px] sm:text-[30px] font-extrabold text-ml-ink">📕 Libro de Quejas online</h1>
        <p className="text-ml-muted text-sm mt-1 mb-6">
          Dejá tu reclamo formal. Queda registrado con fecha y número de seguimiento, conforme a
          las normas de Defensa del Consumidor.
        </p>

        <div className="bg-white rounded-2xl shadow-sm border border-ml-line2 p-5">
          {!estaLogueado && (
            <div className="mb-4">
              <label className="block text-sm font-semibold text-ml-ink mb-1">Tu email de contacto *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-3 py-2.5 border border-ml-line2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-ml-purple/30"
              />
            </div>
          )}
          {estaLogueado && (
            <p className="text-xs text-ml-muted mb-3">Te responderemos a <span className="font-semibold text-ml-ink">{usuario?.email}</span></p>
          )}

          <label className="block text-sm font-semibold text-ml-ink mb-1">Tu reclamo *</label>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={6}
            placeholder="Describí lo que pasó con el mayor detalle posible…"
            className="w-full px-3 py-2.5 border border-ml-line2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-ml-purple/30 resize-none"
            maxLength={2000}
          />
          <p className="text-[11px] text-ml-muted mt-1">{texto.length}/2000</p>

          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

          <button
            onClick={enviar}
            disabled={enviando}
            className="mt-4 px-6 py-2.5 ml-grad text-white rounded-xl font-semibold text-sm disabled:opacity-50"
          >
            {enviando ? 'Enviando…' : 'Registrar queja'}
          </button>
        </div>
      </div>
    </div>
  )
}
