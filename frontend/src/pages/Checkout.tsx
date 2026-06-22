import { useState, useEffect } from 'react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import CalculadorCostos from '../components/CalculadorCostos'
import { LOCALIDADES, COBERTURA_TEXTO } from '../constants/localidades'
import { getLocalidadGuardada } from '../components/ModalBienvenidaLocalidad'

export default function Checkout() {
  const { usuario } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [direccion, setDireccion] = useState(usuario?.direccion || '')
  const [ciudad, setCiudad] = useState((usuario as any)?.ciudad || getLocalidadGuardada())
  const [nombre, setNombre] = useState(usuario?.nombre || '')
  const [telefono, setTelefono] = useState(usuario?.telefono || '')
  const [notas, setNotas] = useState('')
  // Método de entrega: 'estandar' (lo coordina el vendedor) o 'comisionista_vivo'
  // (al pagar, se hace un broadcast a los comisionistas para que compitan por el envío).
  const [tipoEnvio, setTipoEnvio] = useState<'estandar' | 'comisionista_vivo'>('estandar')
  const [error, setError] = useState('')
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    cargarCarrito()
  }, [])

  async function cargarCarrito() {
    try {
      const res = await api.get('/carrito')
      setItems(res.data.carrito.items)
      setTotal(res.data.total)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  // Cantidad de vendedores distintos en el carrito (cada uno = un pago aparte)
  const cantidadVendedores = new Set(
    items.map((i: any) => String(i.tiendaId?._id || i.tiendaId))
  ).size

  // Crear la preferencia de una orden y redirigir a Mercado Pago.
  async function iniciarPagoOrden(ordenId: string) {
    const resPago = await api.post('/pagos/crear-preferencia', { ordenId })
    const mpUrl = resPago.data.initPoint
    if (mpUrl && mpUrl.startsWith('https://') && mpUrl.includes('mercadopago.com')) {
      window.location.href = mpUrl
    } else {
      throw new Error('URL de pago inválida. Intentá de nuevo.')
    }
  }

  async function crearOrdenYPagar(e: React.FormEvent) {
    e.preventDefault()
    if (!direccion.trim()) {
      setError('La dirección de entrega es obligatoria')
      return
    }

    setProcesando(true)
    setError('')

    try {
      // 1. Crear la(s) orden(es). El backend separa el carrito por vendedor,
      //    así que puede devolver varias órdenes (una por vendedor).
      const resOrden = await api.post('/ordenes/crear', { direccion, ciudad, nombre, telefono, notas, tipoEnvio })
      const ordenes: any[] = resOrden.data?.ordenes || []

      if (ordenes.length === 0) {
        setError('No se pudo crear la orden. Intentá de nuevo.')
        setProcesando(false)
        return
      }

      // Limpiar cualquier cola de pagos vieja (de un checkout abandonado)
      localStorage.removeItem('ml_cola_pagos')

      // 2. Si hay varios vendedores, guardamos una "cola de pagos" para ir
      //    pagando uno por uno. La página de pago-exitoso continúa la cola.
      if (ordenes.length > 1) {
        localStorage.setItem('ml_cola_pagos', JSON.stringify({
          ordenes: ordenes.map(o => ({ ordenId: o._id, total: o.total, tienda: o.tiendaNombre })),
          pagados: []
        }))
      }

      // 3. Empezar a pagar por la primera orden (redirige a Mercado Pago)
      await iniciarPagoOrden(ordenes[0]._id)

    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Error al procesar el pago')
      setProcesando(false)
    }
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="font-display text-[28px] font-extrabold text-ml-ink mb-8">Checkout</h1>

        <div className="grid md:grid-cols-5 gap-8">
          {/* Formulario */}
          <div className="md:col-span-3">
            <form onSubmit={crearOrdenYPagar} className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 space-y-4">
              <h2 className="text-lg font-semibold text-ml-ink mb-2">Datos de Entrega</h2>

              {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-200">{error}</div>}

              {/* Aviso multi-vendedor: cada vendedor cobra por separado */}
              {cantidadVendedores > 1 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-xs text-ml-ink leading-relaxed">
                    <span className="font-semibold">🛒 Tu carrito tiene productos de {cantidadVendedores} vendedores.</span>{' '}
                    Como cada uno cobra por separado, vas a hacer <strong>{cantidadVendedores} pagos seguidos</strong> (uno por vendedor).
                    Te vamos guiando paso a paso después de cada pago.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-ml-ink mb-1">Nombre completo</label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} required
                  className="w-full px-4 py-3 border border-ml-line rounded-xl focus:ring-2 focus:ring-ml-purple/30 focus:border-ml-purple/40 outline-none" placeholder="Tu nombre" />
              </div>

              <div>
                <label className="block text-sm font-medium text-ml-ink mb-1">Dirección de entrega</label>
                <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} required
                  className="w-full px-4 py-3 border border-ml-line rounded-xl focus:ring-2 focus:ring-ml-purple/30 focus:border-ml-purple/40 outline-none" placeholder="Calle y número" />
              </div>

              <div>
                <label className="block text-sm font-medium text-ml-ink mb-1">Localidad de entrega</label>
                <select value={ciudad} onChange={e => setCiudad(e.target.value)}
                  className="w-full px-4 py-3 border border-ml-line rounded-xl focus:ring-2 focus:ring-ml-purple/30 focus:border-ml-purple/40 outline-none bg-white">
                  <option value="">Elegí tu localidad</option>
                  {LOCALIDADES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <p className="text-xs text-ml-muted mt-1">{COBERTURA_TEXTO}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-ml-ink mb-1">Teléfono</label>
                <input type="text" value={telefono} onChange={e => setTelefono(e.target.value)}
                  className="w-full px-4 py-3 border border-ml-line rounded-xl focus:ring-2 focus:ring-ml-purple/30 focus:border-ml-purple/40 outline-none" placeholder="Tu teléfono" />
              </div>

              <div>
                <label className="block text-sm font-medium text-ml-ink mb-1">Notas (opcional)</label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
                  className="w-full px-4 py-3 border border-ml-line rounded-xl focus:ring-2 focus:ring-ml-purple/30 focus:border-ml-purple/40 outline-none resize-none" placeholder="Instrucciones especiales..." />
              </div>

              {/* Método de entrega */}
              <div>
                <label className="block text-sm font-medium text-ml-ink mb-2">¿Cómo querés recibirlo?</label>
                <div className="grid gap-2">
                  <button type="button" onClick={() => setTipoEnvio('estandar')}
                    className={`text-left p-3 rounded-xl border transition-colors ${tipoEnvio === 'estandar' ? 'border-ml-purple bg-ml-bg ring-2 ring-ml-purple/30' : 'border-ml-line hover:border-ml-purple/40'}`}>
                    <p className="text-sm font-semibold text-ml-ink">📦 Lo coordino con el vendedor</p>
                    <p className="text-xs text-ml-muted mt-0.5">El vendedor te despacha o coordinás el retiro por WhatsApp. El costo del envío no está incluido en este pago.</p>
                  </button>
                  <button type="button" onClick={() => setTipoEnvio('comisionista_vivo')}
                    className={`text-left p-3 rounded-xl border transition-colors ${tipoEnvio === 'comisionista_vivo' ? 'border-ml-purple bg-ml-bg ring-2 ring-ml-purple/30' : 'border-ml-line hover:border-ml-purple/40'}`}>
                    <p className="text-sm font-semibold text-ml-ink">🚚 Comisionista en vivo <span className="text-[10px] font-bold text-white ml-grad px-2 py-0.5 rounded-full align-middle">HOY</span></p>
                    <p className="text-xs text-ml-muted mt-0.5">Apenas pagás, avisamos a los comisionistas que están trabajando ahora y compiten por llevarte la compra. Vos elegís la mejor oferta en "Mis cotizaciones".</p>
                  </button>
                </div>
                {tipoEnvio === 'comisionista_vivo' && (
                  <p className="text-[11px] text-ml-muted mt-2 leading-relaxed">
                    MercadoLocal solo conecta: el precio y el traslado los acordás con el comisionista. El pago del traslado es aparte, cuando aceptás una oferta.
                  </p>
                )}
              </div>

              {/* Botón Mercado Pago */}
              <button type="submit" disabled={procesando}
                className="w-full py-4 mlbtn bg-ml-mp text-white rounded-xl font-bold text-lg disabled:opacity-50 flex items-center justify-center gap-3">
                {procesando ? (
                  'Redirigiendo a Mercado Pago...'
                ) : (
                  <>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l7 4.5-7 4.5z"/>
                    </svg>
                    Pagar con Mercado Pago - ${total.toLocaleString()}
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-ml-muted mt-2">
                <span>Pago seguro con</span>
                <span className="font-semibold text-ml-mp">Mercado Pago</span>
                <span>| Tarjetas, cuotas, Mercado Crédito</span>
              </div>

              <div className="mt-3 p-3 bg-green-50 rounded-xl border border-green-200">
                <p className="text-xs text-ml-ink flex items-center gap-2">
                  <span className="text-base">🛡️</span>
                  <span><strong>Compra protegida:</strong> pagás con Mercado Pago y tu compra queda respaldada por su Programa de Protección al Comprador. Si algo sale mal o te arrepentís, gestionás la devolución con Mercado Pago.</span>
                </p>
              </div>
            </form>
          </div>

          {/* Resumen con calculador */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-ml-line p-6 sticky top-24 space-y-4">
              <h2 className="text-lg font-semibold text-ml-ink">Resumen y costos</h2>

              <div className="space-y-3 bg-ml-bg rounded-xl p-4">
                {items.map((item: any) => (
                  <div key={item._id} className="flex justify-between text-sm">
                    <span className="text-ml-soft">{item.nombre} x{item.cantidad}</span>
                    <span className="font-medium text-ml-ink">${(item.precio * item.cantidad).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Calculador de costos (incluye selector de medio de pago) */}
              <CalculadorCostos
                precioProducto={total}
                vista="comprador"
                compact={false}
              />

              {/* Medios de pago disponibles */}
              <div className="pt-3 border-t border-ml-line2">
                <p className="text-xs text-ml-muted mb-2">Todos estos medios se aceptan a través de Mercado Pago:</p>
                <div className="flex flex-wrap gap-1 text-xs">
                  <span className="px-2 py-1 bg-blue-50 text-ml-blue rounded-full">Visa</span>
                  <span className="px-2 py-1 bg-red-50 text-red-600 rounded-full">Mastercard</span>
                  <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded-full">Naranja</span>
                  <span className="px-2 py-1 bg-green-50 text-green-600 rounded-full">Débito</span>
                  <span className="px-2 py-1 bg-sky-50 text-sky-600 rounded-full">MP Crédito</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
