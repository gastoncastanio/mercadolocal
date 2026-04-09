import { useState } from 'react'
import api from '../services/api'

interface OpcionEnvio {
  servicio: string
  precio: number
  diasMin: number
  diasMax: number
  tipo: string
  proveedor: string
}

interface Props {
  cpOrigen?: string
  pesoGr?: number
  alto?: number
  ancho?: number
  largo?: number
}

export default function CotizadorEnvio({ cpOrigen, pesoGr, alto, ancho, largo }: Props) {
  const [cpDestino, setCpDestino] = useState('')
  const [opciones, setOpciones] = useState<OpcionEnvio[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [nota, setNota] = useState('')
  const [cotizado, setCotizado] = useState(false)

  async function cotizar(e: React.FormEvent) {
    e.preventDefault()
    if (!cpDestino || cpDestino.length < 4) {
      setError('Ingres\u00e1 un c\u00f3digo postal v\u00e1lido')
      return
    }
    setCargando(true)
    setError('')
    setOpciones([])
    try {
      const res = await api.post('/envios/cotizar', {
        cpOrigen: cpOrigen || '1000',
        cpDestino,
        pesoGr: pesoGr || 1000,
        alto: alto || 15,
        ancho: ancho || 20,
        largo: largo || 30
      })
      setOpciones(res.data.opciones || [])
      setNota(res.data.nota || '')
      setCotizado(true)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cotizar')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">&#x1F69A;</span>
        <h3 className="font-bold text-gray-800 text-sm">Calcul&aacute; el costo de env&iacute;o</h3>
      </div>

      <form onSubmit={cotizar} className="flex gap-2 mb-3">
        <input
          type="text"
          value={cpDestino}
          onChange={e => { setCpDestino(e.target.value.replace(/\D/g, '').slice(0, 4)); setCotizado(false) }}
          placeholder="Tu c&oacute;digo postal"
          maxLength={4}
          className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
        <button
          type="submit"
          disabled={cargando}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shrink-0"
        >
          {cargando ? '...' : 'Calcular'}
        </button>
      </form>

      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}

      {cotizado && opciones.length > 0 && (
        <div className="space-y-2">
          {opciones.map((op, i) => (
            <div
              key={i}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                i === 0 ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {op.tipo === 'sucursal' ? '\u{1F3E2}' : '\u{1F3E0}'}
                  </span>
                  <p className="font-semibold text-sm text-gray-800 truncate">{op.servicio}</p>
                </div>
                <p className="text-xs text-gray-500 ml-6">
                  Llega en {op.diasMin === op.diasMax ? `${op.diasMin}` : `${op.diasMin} a ${op.diasMax}`} d&iacute;as h&aacute;biles
                </p>
                {op.proveedor !== 'estimado' && (
                  <p className="text-[10px] text-blue-500 ml-6 font-medium">
                    Cotizaci&oacute;n en tiempo real
                  </p>
                )}
              </div>
              <p className={`font-bold text-sm shrink-0 ${i === 0 ? 'text-green-700' : 'text-gray-700'}`}>
                ${op.precio.toLocaleString('es-AR')}
              </p>
            </div>
          ))}

          {nota && (
            <p className="text-[10px] text-gray-400 leading-snug mt-1">* {nota}</p>
          )}
        </div>
      )}

      {cotizado && opciones.length === 0 && !error && (
        <p className="text-sm text-gray-500">No se encontraron opciones de env&iacute;o para ese c&oacute;digo postal.</p>
      )}
    </div>
  )
}
