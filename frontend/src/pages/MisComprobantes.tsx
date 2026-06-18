import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

interface Comprobante {
  _id: string
  tipo: 'pauta' | 'comision' | 'venta'
  letra: string
  numeroFormateado: string
  total: number
  fechaEmision: string
  fiscal: boolean
  pdfUrl?: string
}

interface DatosFiscales {
  razonSocial?: string
  cuit?: string
  condicionIVA?: string
  domicilio?: string
}

const CONDICIONES = ['Monotributo', 'Responsable Inscripto', 'Exento']

const ETIQUETA_TIPO: Record<string, { label: string; icon: string; clase: string }> = {
  pauta: { label: 'Pauta publicitaria', icon: '📢', clase: 'bg-ml-blue/10 text-ml-blue' },
  comision: { label: 'Comisión por venta', icon: '🧾', clase: 'bg-ml-purple/10 text-ml-purple' },
  venta: { label: 'Venta', icon: '🛍️', clase: 'bg-green-100 text-green-700' }
}

export default function MisComprobantes() {
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([])
  const [datos, setDatos] = useState<DatosFiscales>({})
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      const [compRes, datosRes] = await Promise.all([
        api.get('/comprobantes/mios'),
        api.get('/comprobantes/datos-fiscales')
      ])
      setComprobantes(compRes.data || [])
      setDatos(datosRes.data || {})
    } catch (err) {
      console.error('Error cargando comprobantes:', err)
    } finally {
      setCargando(false)
    }
  }

  async function guardarDatos() {
    setGuardando(true)
    setMensaje('')
    try {
      const res = await api.put('/comprobantes/datos-fiscales', datos)
      setDatos(res.data)
      setMensaje('Datos fiscales guardados.')
    } catch {
      setMensaje('No se pudieron guardar los datos. Intentá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const datosIncompletos = !datos.cuit || !datos.condicionIVA

  if (cargando) {
    return <div className="min-h-screen bg-ml-bg flex items-center justify-center"><div className="spinner" /></div>
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-[26px] sm:text-[30px] font-extrabold text-ml-ink">🧾 Facturación</h1>
            <p className="text-ml-muted text-sm mt-1">Tus comprobantes y datos fiscales en un solo lugar.</p>
          </div>
          <Link to="/central-vendedor" className="text-ml-blue hover:underline text-sm shrink-0">← Volver</Link>
        </div>

        {/* Datos fiscales del vendedor */}
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-ml-line2 mb-6">
          <h2 className="font-bold text-ml-ink mb-1">Tus datos fiscales</h2>
          <p className="text-xs text-ml-muted mb-4">
            Se usan para las facturas que <span className="font-semibold">vos</span> le emitís a tus compradores
            y para las facturas que <span className="font-semibold">nosotros</span> te emitimos por pauta y comisión.
          </p>

          {datosIncompletos && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-sm mb-4">
              Completá tu CUIT y condición fiscal para que las facturas salgan con tus datos correctos.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ml-soft">Razón social / Nombre</label>
              <input
                value={datos.razonSocial || ''}
                onChange={e => setDatos({ ...datos, razonSocial: e.target.value })}
                className="mt-1 w-full border border-ml-line2 rounded-lg px-3 py-2 text-sm"
                placeholder="Nombre y apellido o razón social"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ml-soft">CUIT / CUIL</label>
              <input
                value={datos.cuit || ''}
                onChange={e => setDatos({ ...datos, cuit: e.target.value.replace(/[^\d]/g, '') })}
                className="mt-1 w-full border border-ml-line2 rounded-lg px-3 py-2 text-sm"
                placeholder="11 dígitos, sin guiones"
                maxLength={11}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ml-soft">Condición fiscal</label>
              <select
                value={datos.condicionIVA || ''}
                onChange={e => setDatos({ ...datos, condicionIVA: e.target.value })}
                className="mt-1 w-full border border-ml-line2 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Elegí una opción</option>
                {CONDICIONES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ml-soft">Domicilio fiscal</label>
              <input
                value={datos.domicilio || ''}
                onChange={e => setDatos({ ...datos, domicilio: e.target.value })}
                className="mt-1 w-full border border-ml-line2 rounded-lg px-3 py-2 text-sm"
                placeholder="Calle, número, ciudad"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={guardarDatos}
              disabled={guardando}
              className="px-5 py-2.5 ml-grad text-white rounded-xl font-semibold text-sm disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : 'Guardar datos fiscales'}
            </button>
            {mensaje && <span className="text-sm text-ml-muted">{mensaje}</span>}
          </div>
        </div>

        {/* Comprobantes que la plataforma te emitió */}
        <h2 className="font-bold text-ml-ink mb-3">Comprobantes recibidos de Mercado Local</h2>
        {comprobantes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-ml-line2">
            <p className="text-4xl mb-3">🧾</p>
            <p className="text-ml-muted text-sm">
              Todavía no tenés comprobantes. Cuando promociones un producto o concretes una venta,
              vas a recibir acá la factura por la pauta y por la comisión.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {comprobantes.map(c => {
              const meta = ETIQUETA_TIPO[c.tipo]
              return (
                <div key={c._id} className="bg-white rounded-xl shadow-sm p-4 border border-ml-line2 flex items-center gap-3">
                  <span className="text-2xl shrink-0">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${meta.clase}`}>{meta.label}</span>
                      <span className="text-xs text-ml-muted">Factura {c.letra} · {c.numeroFormateado}</span>
                      {!c.fiscal && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-ml-muted" title="Comprobante interno, sin CAE de ARCA todavía">
                          interno
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ml-muted mt-1">
                      {new Date(c.fechaEmision).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-ml-ink">${c.total.toLocaleString('es-AR')}</p>
                    <Link to={`/comprobante/${c._id}`} className="text-xs text-ml-blue hover:underline">Ver / descargar</Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-[11px] text-ml-muted mt-6">
          Las facturas marcadas como <span className="font-semibold">interno</span> son comprobantes de la
          operación. La emisión fiscal con CAE de ARCA se activa en la próxima etapa.
        </p>
      </div>
    </div>
  )
}
