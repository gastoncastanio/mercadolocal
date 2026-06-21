import { useState } from 'react'
import api from '../services/api'

interface CheckoutOfertaProps {
  ofertaId: string
  titulo: string
  precioFinal: number
  comisionPorcentaje: number
  onClose: () => void
}

export default function CheckoutOferta({
  ofertaId,
  titulo,
  precioFinal,
  comisionPorcentaje,
  onClose
}: CheckoutOfertaProps) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function iniciarCheckout() {
    setCargando(true)
    setError('')
    try {
      // 1. Crear canje y obtener preference de MercadoPago
      const res = await api.post(`/centro/ofertas/${ofertaId}/checkout`)
      const { initPoint, sandboxInitPoint } = res.data

      // 2. Redirigir a MercadoPago (en producción: initPoint, en sandbox: sandboxInitPoint)
      const urlMP = process.env.NODE_ENV === 'production' ? initPoint : sandboxInitPoint
      window.location.href = urlMP
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al iniciar el pago')
      setCargando(false)
    }
  }

  const comisionARS = (precioFinal * comisionPorcentaje) / 100
  const precioSinComision = precioFinal - comisionARS

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-extrabold text-ml-ink">Comprar Oferta</h2>
          <button
            onClick={onClose}
            disabled={cargando}
            className="text-2xl text-ml-muted hover:text-ml-ink disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Detalle de la oferta */}
        <div className="bg-ml-bg rounded-2xl p-4 mb-6">
          <p className="font-bold text-ml-ink mb-2">{titulo}</p>
          <p className="text-xs text-ml-muted">Se te entrega un código en el local</p>
        </div>

        {/* Desglose de precios */}
        <div className="space-y-3 mb-6 pb-6 border-b border-ml-line">
          <div className="flex justify-between items-center">
            <span className="text-sm text-ml-soft">Precio</span>
            <span className="font-semibold text-ml-ink">${precioSinComision.toLocaleString('es-AR')}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-ml-soft">Comisión plataforma ({comisionPorcentaje}%)</span>
            <span className="text-xs text-ml-muted">${comisionARS.toLocaleString('es-AR')}</span>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="font-bold text-ml-ink">Total a pagar</span>
            <span className="font-display text-2xl font-extrabold text-ml-violet">
              ${precioFinal.toLocaleString('es-AR')}
            </span>
          </div>
        </div>

        {/* Información */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-6 text-[11px] text-ml-soft space-y-1">
          <p>✓ Pago seguro con MercadoPago</p>
          <p>✓ Recibirás un código de 8 caracteres</p>
          <p>✓ Válido por 30 minutos para canjear</p>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">{error}</p>}

        {/* Botones */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={cargando}
            className="flex-1 py-3 bg-white border border-ml-line rounded-2xl font-bold text-ml-ink hover:border-ml-violet disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={iniciarCheckout}
            disabled={cargando}
            className="flex-1 py-3 ml-grad text-white rounded-2xl font-bold disabled:opacity-60"
          >
            {cargando ? 'Procesando...' : 'Ir a MercadoPago'}
          </button>
        </div>

        <p className="text-[10px] text-ml-muted text-center mt-4">
          Al continuar aceptas nuestros Términos de Servicio
        </p>
      </div>
    </div>
  )
}
