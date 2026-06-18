import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import api from '../services/api'

interface Resultado {
  ok: boolean
  mensaje: string
  oferta: { titulo: string; cupoRestante: number | null }
  canjeadoEn: string
}

export default function CanjearOferta() {
  const [params] = useSearchParams()
  const [codigo, setCodigo] = useState('')
  const [ticket, setTicket] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error, setError] = useState('')

  // Si llega desde el QR (?codigo=ABCD-2345), precargamos el campo.
  useEffect(() => {
    const c = params.get('codigo')
    if (c) setCodigo(c.toUpperCase())
  }, [params])

  async function canjear(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResultado(null)
    if (!codigo.trim()) {
      setError('Ingresá el código del cliente.')
      return
    }
    setProcesando(true)
    try {
      const body: any = { codigo: codigo.trim() }
      if (ticket && !isNaN(Number(ticket))) body.ticketValor = Number(ticket)
      const res = await api.post('/centro/canjear', body)
      setResultado(res.data)
      setCodigo('')
      setTicket('')
    } catch (e: any) {
      setError(e.response?.data?.error || 'No pudimos validar el código.')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="min-h-screen bg-ml-bg flex items-start justify-center px-4 py-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-lg border border-ml-line overflow-hidden">
          <div className="bg-gradient-to-br from-ml-violet to-ml-blue p-6 text-center text-white">
            <div className="text-4xl mb-2">🧾</div>
            <h1 className="font-display text-xl font-extrabold">Validar canje</h1>
            <p className="text-white/90 text-xs mt-1">Escaneá el QR del cliente o ingresá su código</p>
          </div>

          <form onSubmit={canjear} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ml-soft mb-1">Código del cliente</label>
              <input
                value={codigo}
                onChange={e => setCodigo(e.target.value.toUpperCase())}
                placeholder="ABCD-2345"
                autoFocus
                className="w-full px-4 py-3 border border-ml-line rounded-xl font-mono text-lg tracking-widest text-center uppercase focus:border-ml-violet outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ml-soft mb-1">
                Monto del ticket <span className="text-ml-muted font-normal">(opcional, para tus métricas)</span>
              </label>
              <input
                value={ticket}
                onChange={e => setTicket(e.target.value)}
                placeholder="$ 0"
                inputMode="numeric"
                className="w-full px-4 py-3 border border-ml-line rounded-xl focus:border-ml-violet outline-none"
              />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}

            {resultado && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-2xl mb-1">✅</p>
                <p className="font-bold text-green-700">{resultado.mensaje}</p>
                <p className="text-sm text-ml-soft mt-1">{resultado.oferta.titulo}</p>
                {resultado.oferta.cupoRestante !== null && (
                  <p className="text-xs text-ml-muted mt-1">Cupos restantes: {resultado.oferta.cupoRestante}</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={procesando}
              className="w-full py-3 mlbtn ml-grad text-white rounded-xl font-bold disabled:opacity-60"
            >
              {procesando ? 'Validando...' : 'Validar canje'}
            </button>
          </form>
        </div>

        <p className="text-center mt-4">
          <Link to="/comercio" className="text-xs text-ml-blue hover:underline">← Volver al panel del comercio</Link>
        </p>
      </div>
    </div>
  )
}
