import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../services/api'

interface Parte {
  nombre?: string
  cuit?: string
  docTipo?: string
  condicionIVA?: string
  domicilio?: string
  email?: string
}
interface Item {
  descripcion: string
  cantidad: number
  precioUnitario: number
  importe: number
}
interface Comprobante {
  _id: string
  tipo: string
  letra: string
  numeroFormateado: string
  emisor: Parte
  receptor: Parte
  items: Item[]
  neto: number
  iva: number
  total: number
  fiscal: boolean
  cae?: string
  caeVencimiento?: string
  pdfUrl?: string
  fechaEmision: string
}

const TITULO_TIPO: Record<string, string> = {
  pauta: 'Servicio de pauta publicitaria',
  comision: 'Comisión por intermediación de venta',
  venta: 'Venta de productos'
}

export default function ComprobanteView() {
  const { id } = useParams()
  const [comp, setComp] = useState<Comprobante | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    api.get(`/comprobantes/${id}`)
      .then(res => setComp(res.data))
      .catch(() => setError('No se pudo cargar el comprobante.'))
      .finally(() => setCargando(false))
  }, [id])

  if (cargando) return <div className="min-h-screen bg-ml-bg flex items-center justify-center"><div className="spinner" /></div>
  if (error || !comp) {
    return (
      <div className="min-h-screen bg-ml-bg flex flex-col items-center justify-center gap-3">
        <p className="text-ml-muted">{error || 'Comprobante no encontrado'}</p>
        <Link to="/mis-comprobantes" className="text-ml-blue hover:underline text-sm">← Volver</Link>
      </div>
    )
  }

  const fecha = new Date(comp.fechaEmision).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="min-h-screen bg-ml-bg py-6 px-3">
      {/* Barra de acciones (no se imprime) */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <Link to="/mis-comprobantes" className="text-ml-blue hover:underline text-sm">← Volver</Link>
        <div className="flex gap-2">
          {comp.pdfUrl && (
            <a href={comp.pdfUrl} target="_blank" rel="noreferrer"
              className="px-4 py-2 bg-white border border-ml-line2 rounded-lg text-sm font-semibold text-ml-ink">
              Ver PDF oficial
            </a>
          )}
          <button onClick={() => window.print()}
            className="px-4 py-2 ml-grad text-white rounded-lg text-sm font-semibold">
            Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      {/* Documento */}
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-ml-line2 p-6 sm:p-8 print:shadow-none print:border-0">
        {/* Encabezado */}
        <div className="flex items-start justify-between border-b border-ml-line2 pb-4 mb-4">
          <div>
            <p className="font-display text-2xl font-extrabold text-ml-ink">{comp.emisor.nombre || 'Mercado Local'}</p>
            {comp.emisor.condicionIVA && <p className="text-xs text-ml-muted mt-0.5">{comp.emisor.condicionIVA}</p>}
            {comp.emisor.cuit && <p className="text-xs text-ml-muted">CUIT: {comp.emisor.cuit}</p>}
            {comp.emisor.domicilio && <p className="text-xs text-ml-muted">{comp.emisor.domicilio}</p>}
          </div>
          <div className="text-right">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg border-2 border-ml-ink font-display text-2xl font-extrabold text-ml-ink">
              {comp.letra}
            </div>
            <p className="text-sm font-bold text-ml-ink mt-2">{comp.numeroFormateado}</p>
            <p className="text-xs text-ml-muted">Fecha: {fecha}</p>
            {!comp.fiscal && <p className="text-[10px] text-amber-600 mt-1">Comprobante interno (sin CAE)</p>}
          </div>
        </div>

        {/* Receptor */}
        <div className="mb-4 text-sm">
          <p className="text-xs font-semibold text-ml-soft uppercase tracking-wide mb-1">Cliente</p>
          <p className="font-semibold text-ml-ink">{comp.receptor.nombre || '—'}</p>
          <p className="text-ml-muted text-xs">
            {comp.receptor.condicionIVA || 'Consumidor Final'}
            {comp.receptor.cuit ? ` · CUIT ${comp.receptor.cuit}` : ''}
          </p>
          {comp.receptor.domicilio && <p className="text-ml-muted text-xs">{comp.receptor.domicilio}</p>}
        </div>

        {/* Detalle */}
        <p className="text-xs font-semibold text-ml-soft uppercase tracking-wide mb-2">{TITULO_TIPO[comp.tipo] || 'Detalle'}</p>
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b border-ml-line2 text-left text-ml-soft">
              <th className="py-2 font-semibold">Descripción</th>
              <th className="py-2 font-semibold text-center w-16">Cant.</th>
              <th className="py-2 font-semibold text-right w-28">P. unit.</th>
              <th className="py-2 font-semibold text-right w-28">Importe</th>
            </tr>
          </thead>
          <tbody>
            {comp.items.map((it, i) => (
              <tr key={i} className="border-b border-ml-line2/60">
                <td className="py-2 text-ml-ink">{it.descripcion}</td>
                <td className="py-2 text-center text-ml-muted">{it.cantidad}</td>
                <td className="py-2 text-right text-ml-muted">${it.precioUnitario.toLocaleString('es-AR')}</td>
                <td className="py-2 text-right text-ml-ink">${it.importe.toLocaleString('es-AR')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div className="flex justify-end">
          <div className="w-full sm:w-64 space-y-1 text-sm">
            {comp.letra !== 'C' && (
              <>
                <div className="flex justify-between text-ml-muted">
                  <span>Neto</span><span>${comp.neto.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between text-ml-muted">
                  <span>IVA</span><span>${comp.iva.toLocaleString('es-AR')}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-bold text-ml-ink text-base border-t border-ml-line2 pt-1">
              <span>Total</span><span>${comp.total.toLocaleString('es-AR')}</span>
            </div>
          </div>
        </div>

        {/* Pie CAE */}
        {comp.fiscal && comp.cae && (
          <div className="mt-6 pt-3 border-t border-ml-line2 text-xs text-ml-muted">
            <p>CAE: {comp.cae}</p>
            {comp.caeVencimiento && <p>Vto. CAE: {new Date(comp.caeVencimiento).toLocaleDateString('es-AR')}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
