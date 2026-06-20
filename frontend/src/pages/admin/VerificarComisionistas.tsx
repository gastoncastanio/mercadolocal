import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

interface DocPendiente {
  _id: string
  nombreServicio: string
  vehiculo: { tipo: string; patente: string }
  documentoVehiculo: { url: string; tipoDocumento: string; nombreArchivo: string }
  usuarioId?: { _id: string; nombre: string; email: string; avatar: string } | null
  updatedAt: string
}

const TIPO_DOC: Record<string, string> = {
  titulo_propiedad: 'Título de propiedad',
  'cédula_estacionamiento': 'Cédula azul / autorización',
  licencia_conducir: 'Licencia de conducir'
}

export default function VerificarComisionistas() {
  const [lista, setLista] = useState<DocPendiente[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [accionando, setAccionando] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    try {
      const res = await api.get('/admin/comisionistas/documentos')
      setLista(res.data || [])
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error cargando documentos')
    } finally {
      setCargando(false)
    }
  }

  async function verificar(perfilId: string, aprobado: boolean) {
    if (!aprobado && !confirm('¿Rechazar este documento? El comisionista deberá subir uno nuevo.')) return
    setAccionando(perfilId)
    try {
      await api.patch(`/admin/comisionistas/${perfilId}/verificar`, { aprobado })
      setLista(prev => prev.filter(d => d._id !== perfilId))
    } catch (e: any) {
      setError(e.response?.data?.error || 'No se pudo procesar')
    } finally {
      setAccionando('')
    }
  }

  if (cargando) {
    return <div className="text-center py-20"><div className="animate-spin text-3xl mb-3">🪪</div><p className="text-ml-muted text-sm">Cargando...</p></div>
  }

  return (
    <div className="min-h-screen bg-ml-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="font-display text-[24px] font-extrabold text-ml-ink">🪪 Verificar comisionistas</h1>
          <Link to="/admin" className="text-sm text-ml-blue hover:underline">← Volver al panel</Link>
        </div>

        <p className="text-sm text-ml-muted mb-6">
          Revisá que el documento sea legible y que el vehículo esté <strong>a nombre del comisionista</strong> o
          que tenga <strong>permiso para conducirlo</strong>. Solo los verificados aparecen en el panel en vivo del checkout.
        </p>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">{error}</p>}

        {lista.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-ml-line">
            <p className="text-4xl mb-3">✓</p>
            <p className="text-ml-muted">No hay documentos pendientes de verificación.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {lista.map(d => (
              <div key={d._id} className="bg-white rounded-2xl shadow-sm border border-ml-line p-5">
                <div className="flex items-center gap-3 mb-3">
                  <img src={d.usuarioId?.avatar || 'https://via.placeholder.com/40'} alt="" className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <p className="font-bold text-ml-ink">{d.nombreServicio || d.usuarioId?.nombre || 'Comisionista'}</p>
                    <p className="text-xs text-ml-muted">{d.usuarioId?.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div>
                    <p className="text-xs text-ml-muted">Vehículo</p>
                    <p className="font-semibold text-ml-ink capitalize">{d.vehiculo?.tipo} · {d.vehiculo?.patente || 'sin patente'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ml-muted">Tipo de documento</p>
                    <p className="font-semibold text-ml-ink">{TIPO_DOC[d.documentoVehiculo?.tipoDocumento] || d.documentoVehiculo?.tipoDocumento}</p>
                  </div>
                </div>

                {d.documentoVehiculo?.url && (
                  <a href={d.documentoVehiculo.url} target="_blank" rel="noopener noreferrer" className="block mb-3">
                    <img src={d.documentoVehiculo.url} alt="Documento" className="w-full max-h-80 object-contain rounded-lg border border-ml-line bg-ml-bg" />
                    <p className="text-xs text-ml-blue text-center mt-1 hover:underline">Abrir en tamaño completo ↗</p>
                  </a>
                )}

                <div className="flex gap-2 justify-end">
                  <button onClick={() => verificar(d._id, false)} disabled={!!accionando} className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50">Rechazar</button>
                  <button onClick={() => verificar(d._id, true)} disabled={!!accionando} className="px-5 py-2 text-sm font-bold text-white rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50">{accionando === d._id ? '...' : '✓ Verificar'}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
