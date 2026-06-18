/**
 * Panel admin para revisar productos pendientes y el historial del
 * AGENTE-MODERACIÓN.
 *
 * Tabs:
 *   - Pendientes (productos en estado "revision")
 *   - Historial (todas las decisiones del agente)
 *   - Métricas (cantidad por día, banderas top, costo de tokens)
 */

import { useState, useEffect } from 'react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'

interface Tienda {
  _id: string
  nombre: string
  ciudad: string
  calificacion?: number
}

interface ProductoModeracion {
  _id: string
  nombre: string
  descripcion: string
  precio: number
  categorias: string[]
  imagenes: string[]
  marca?: string
  codigoBarras?: string
  tiendaId: Tienda | string
  moderacion: {
    estado: 'aprobado' | 'revision' | 'rechazado'
    motivo: string
    confianza: number
    fecha: string
  }
  createdAt: string
}

interface DecisionHistorial {
  _id: string
  productoId?: { _id: string; nombre: string; activo: boolean; moderacion?: any }
  tiendaId?: Tienda
  decision: 'aprobado' | 'rechazado' | 'revision'
  confianza: number
  motivos: string[]
  banderas: string[]
  snapshot: {
    nombre: string
    precio: number
    categorias: string[]
    cantidadImagenes: number
    marca?: string
  }
  tokens: { entrada: number; salida: number; entradaCached: number }
  duracionMs: number
  revisionAdmin?: {
    realizada: boolean
    decisionFinal?: 'aprobado' | 'rechazado'
    comentario?: string
  }
  createdAt: string
}

interface Metricas {
  dias: number
  porDecision: Array<{ _id: string; count: number }>
  banderasTop: Array<{ _id: string; count: number }>
  totales: {
    total: number
    tokensEntrada: number
    tokensSalida: number
    tokensCached: number
    duracionPromedio: number
  } | null
  costoEstimadoUSD: number
}

const DECISION_COLOR: Record<string, string> = {
  aprobado: 'bg-green-100 text-green-700',
  revision: 'bg-yellow-100 text-yellow-700',
  rechazado: 'bg-red-100 text-red-700'
}

const DECISION_ICONO: Record<string, string> = {
  aprobado: '✅',
  revision: '⏳',
  rechazado: '🚫'
}

function tiempoRelativo(iso?: string): string {
  if (!iso) return ''
  const segs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (segs < 60) return 'recién'
  if (segs < 3600) return `hace ${Math.floor(segs / 60)} min`
  if (segs < 86400) return `hace ${Math.floor(segs / 3600)} h`
  if (segs < 604800) return `hace ${Math.floor(segs / 86400)} días`
  return new Date(iso).toLocaleDateString('es-AR')
}

function formatearPrecio(n: number): string {
  return '$ ' + (n || 0).toLocaleString('es-AR')
}

export default function ModeracionAdmin() {
  const toast = useToast()
  const [tab, setTab] = useState<'pendientes' | 'historial' | 'metricas'>('pendientes')

  // Pendientes
  const [pendientes, setPendientes] = useState<ProductoModeracion[]>([])
  const [productoActivo, setProductoActivo] = useState<ProductoModeracion | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [cargandoPendientes, setCargandoPendientes] = useState(false)

  // Historial
  const [historial, setHistorial] = useState<DecisionHistorial[]>([])
  const [filtroDecision, setFiltroDecision] = useState<string>('')
  const [cargandoHistorial, setCargandoHistorial] = useState(false)

  // Métricas
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [cargandoMetricas, setCargandoMetricas] = useState(false)

  useEffect(() => {
    if (tab === 'pendientes') cargarPendientes()
    if (tab === 'historial') cargarHistorial()
    if (tab === 'metricas') cargarMetricas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filtroDecision])

  async function cargarPendientes() {
    setCargandoPendientes(true)
    try {
      const { data } = await api.get('/moderacion/pendientes?limit=50')
      setPendientes(data.productos || [])
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al cargar pendientes')
    } finally {
      setCargandoPendientes(false)
    }
  }

  async function cargarHistorial() {
    setCargandoHistorial(true)
    try {
      const params = filtroDecision ? `?decision=${filtroDecision}&limit=50` : '?limit=50'
      const { data } = await api.get(`/moderacion/historial${params}`)
      setHistorial(data.items || [])
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al cargar historial')
    } finally {
      setCargandoHistorial(false)
    }
  }

  async function cargarMetricas() {
    setCargandoMetricas(true)
    try {
      const { data } = await api.get('/moderacion/metricas?dias=30')
      setMetricas(data)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al cargar métricas')
    } finally {
      setCargandoMetricas(false)
    }
  }

  async function aprobarProducto(productoId: string) {
    setProcesando(true)
    try {
      await api.post(`/moderacion/${productoId}/aprobar`, { comentario: 'Aprobado tras revisión manual' })
      toast.exito('Producto aprobado')
      setProductoActivo(null)
      await cargarPendientes()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al aprobar')
    } finally {
      setProcesando(false)
    }
  }

  async function rechazarProducto(productoId: string) {
    if (motivoRechazo.trim().length < 5) {
      toast.error('El motivo debe tener al menos 5 caracteres')
      return
    }
    setProcesando(true)
    try {
      await api.post(`/moderacion/${productoId}/rechazar`, { motivo: motivoRechazo.trim() })
      toast.exito('Producto rechazado y vendedor notificado')
      setProductoActivo(null)
      setMotivoRechazo('')
      await cargarPendientes()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al rechazar')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="font-display text-[28px] font-extrabold text-ml-ink">Moderación de productos</h1>
        <p className="text-sm text-ml-soft mt-1">
          Panel del AGENTE-MODERACIÓN. Revisá productos marcados para revisión humana.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-ml-line mb-6">
        {[
          { id: 'pendientes', label: 'Pendientes', icono: '⏳' },
          { id: 'historial', label: 'Historial', icono: '📋' },
          { id: 'metricas', label: 'Métricas', icono: '📊' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-ml-blue'
                : 'border-transparent text-ml-muted hover:text-ml-ink'
            }`}
          >
            {t.icono} {t.label}
          </button>
        ))}
      </div>

      {/* PENDIENTES */}
      {tab === 'pendientes' && (
        <div>
          {cargandoPendientes ? (
            <div className="text-center py-12 text-ml-muted">Cargando...</div>
          ) : pendientes.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-ml-line">
              <div className="text-5xl mb-2">🎉</div>
              <p className="text-ml-soft">No hay productos pendientes de revisión</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendientes.map(p => (
                <div key={p._id} className="bg-white rounded-lg border border-ml-line overflow-hidden hover:shadow-md transition-shadow">
                  <div className="aspect-video bg-gray-100 overflow-hidden">
                    {p.imagenes?.[0] ? (
                      <img src={p.imagenes[0]} alt={p.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-ml-muted">
                        Sin imagen
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-ml-ink line-clamp-2 flex-1">{p.nombre}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${DECISION_COLOR.revision}`}>
                        revisión
                      </span>
                    </div>
                    <p className="text-lg font-bold text-ml-ink mb-2">{formatearPrecio(p.precio)}</p>
                    <p className="text-xs text-ml-muted mb-2">
                      {typeof p.tiendaId === 'object' && p.tiendaId.nombre} · {tiempoRelativo(p.createdAt)}
                    </p>
                    {p.moderacion?.motivo && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-3">
                        <p className="text-xs text-yellow-800">
                          <strong>Agente:</strong> {p.moderacion.motivo}
                        </p>
                        <p className="text-[10px] text-yellow-700 mt-1">
                          Confianza: {p.moderacion.confianza}%
                        </p>
                      </div>
                    )}
                    <button
                      onClick={() => { setProductoActivo(p); setMotivoRechazo('') }}
                      className="w-full mlbtn ml-grad text-white text-sm py-2 rounded-md font-medium"
                    >
                      Revisar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* HISTORIAL */}
      {tab === 'historial' && (
        <div>
          <div className="mb-4 flex gap-2 flex-wrap">
            <button
              onClick={() => setFiltroDecision('')}
              className={`px-3 py-1 rounded-full text-sm ${
                filtroDecision === '' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-ml-ink'
              }`}
            >
              Todas
            </button>
            {['aprobado', 'revision', 'rechazado'].map(d => (
              <button
                key={d}
                onClick={() => setFiltroDecision(d)}
                className={`px-3 py-1 rounded-full text-sm capitalize ${
                  filtroDecision === d ? 'bg-gray-900 text-white' : 'bg-gray-100 text-ml-ink'
                }`}
              >
                {DECISION_ICONO[d]} {d}
              </button>
            ))}
          </div>

          {cargandoHistorial ? (
            <div className="text-center py-12 text-ml-muted">Cargando...</div>
          ) : historial.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-ml-line">
              <p className="text-ml-muted">Sin decisiones para mostrar</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-ml-line overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium text-ml-soft">Producto</th>
                    <th className="px-4 py-3 font-medium text-ml-soft">Tienda</th>
                    <th className="px-4 py-3 font-medium text-ml-soft">Decisión</th>
                    <th className="px-4 py-3 font-medium text-ml-soft">Confianza</th>
                    <th className="px-4 py-3 font-medium text-ml-soft">Banderas</th>
                    <th className="px-4 py-3 font-medium text-ml-soft">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map(h => (
                    <tr key={h._id} className="border-t border-ml-line2 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-ml-ink">{h.snapshot.nombre}</div>
                        <div className="text-xs text-ml-muted">{formatearPrecio(h.snapshot.precio)}</div>
                      </td>
                      <td className="px-4 py-3 text-ml-ink">
                        {h.tiendaId?.nombre || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${DECISION_COLOR[h.decision]}`}>
                          {DECISION_ICONO[h.decision]} {h.decision}
                        </span>
                        {h.revisionAdmin?.realizada && (
                          <div className="text-[10px] text-ml-blue mt-1">
                            Admin: {h.revisionAdmin.decisionFinal}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ml-ink">{h.confianza}%</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap max-w-xs">
                          {h.banderas?.slice(0, 3).map(b => (
                            <span key={b} className="text-[10px] bg-gray-100 text-ml-ink px-1.5 py-0.5 rounded">
                              {b}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ml-muted text-xs">{tiempoRelativo(h.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MÉTRICAS */}
      {tab === 'metricas' && (
        <div>
          {cargandoMetricas ? (
            <div className="text-center py-12 text-ml-muted">Cargando...</div>
          ) : !metricas ? (
            <div className="text-center py-12 text-ml-muted">Sin datos</div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-ml-line p-4">
                  <div className="text-xs text-ml-muted uppercase">Total {metricas.dias}d</div>
                  <div className="font-display text-[24px] font-extrabold text-ml-ink mt-1">
                    {metricas.totales?.total || 0}
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-ml-line p-4">
                  <div className="text-xs text-ml-muted uppercase">Costo estimado</div>
                  <div className="font-display text-[24px] font-extrabold text-ml-ink mt-1">
                    US${metricas.costoEstimadoUSD.toFixed(4)}
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-ml-line p-4">
                  <div className="text-xs text-ml-muted uppercase">Tokens cacheados</div>
                  <div className="font-display text-[24px] font-extrabold text-ml-ink mt-1">
                    {((metricas.totales?.tokensCached || 0) / 1000).toFixed(1)}k
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-ml-line p-4">
                  <div className="text-xs text-ml-muted uppercase">Duración promedio</div>
                  <div className="font-display text-[24px] font-extrabold text-ml-ink mt-1">
                    {Math.round(metricas.totales?.duracionPromedio || 0)}ms
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg border border-ml-line p-4">
                  <h3 className="font-semibold mb-3">Decisiones</h3>
                  <div className="space-y-2">
                    {metricas.porDecision.map(d => (
                      <div key={d._id} className="flex items-center justify-between">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${DECISION_COLOR[d._id]}`}>
                          {DECISION_ICONO[d._id]} {d._id}
                        </span>
                        <span className="font-medium">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-ml-line p-4">
                  <h3 className="font-semibold mb-3">Banderas más frecuentes</h3>
                  <div className="space-y-2">
                    {metricas.banderasTop.length === 0 ? (
                      <p className="text-sm text-ml-muted">Sin banderas registradas</p>
                    ) : (
                      metricas.banderasTop.map(b => (
                        <div key={b._id} className="flex items-center justify-between text-sm">
                          <span className="text-ml-ink">{b._id}</span>
                          <span className="font-medium">{b.count}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL DE REVISIÓN */}
      {productoActivo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-ml-line p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Revisar producto</h2>
              <button
                onClick={() => { setProductoActivo(null); setMotivoRechazo('') }}
                className="text-ml-muted hover:text-ml-soft"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Galería */}
              {productoActivo.imagenes?.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {productoActivo.imagenes.slice(0, 6).map((img, i) => (
                    <div key={i} className="aspect-square bg-gray-100 rounded overflow-hidden">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              {/* Info */}
              <div>
                <h3 className="text-xl font-bold text-ml-ink">{productoActivo.nombre}</h3>
                <p className="font-display text-[24px] font-extrabold text-ml-ink mt-1">{formatearPrecio(productoActivo.precio)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-ml-muted">Categoría:</span>{' '}
                  <span className="font-medium">{productoActivo.categorias?.join(', ') || '—'}</span>
                </div>
                <div>
                  <span className="text-ml-muted">Marca:</span>{' '}
                  <span className="font-medium">{productoActivo.marca || '—'}</span>
                </div>
                <div>
                  <span className="text-ml-muted">Código barras:</span>{' '}
                  <span className="font-medium">{productoActivo.codigoBarras || '—'}</span>
                </div>
                <div>
                  <span className="text-ml-muted">Tienda:</span>{' '}
                  <span className="font-medium">
                    {typeof productoActivo.tiendaId === 'object' ? productoActivo.tiendaId.nombre : '—'}
                  </span>
                </div>
              </div>

              <div>
                <div className="text-sm text-ml-muted mb-1">Descripción</div>
                <p className="text-sm text-ml-ink whitespace-pre-wrap bg-gray-50 rounded p-3">
                  {productoActivo.descripcion || '(sin descripción)'}
                </p>
              </div>

              {productoActivo.moderacion?.motivo && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <div className="text-xs font-medium text-yellow-800 mb-1">
                    Análisis del agente (confianza: {productoActivo.moderacion.confianza}%)
                  </div>
                  <p className="text-sm text-yellow-900">{productoActivo.moderacion.motivo}</p>
                </div>
              )}

              {/* Rechazo */}
              <div>
                <label className="block text-sm font-medium text-ml-ink mb-1">
                  Motivo de rechazo (si corresponde)
                </label>
                <textarea
                  value={motivoRechazo}
                  onChange={e => setMotivoRechazo(e.target.value)}
                  placeholder="Ej: las imágenes están borrosas, el precio es sospechoso, etc."
                  rows={3}
                  className="w-full border border-ml-line rounded-md p-2 text-sm focus:ring-2 focus:ring-ml-purple/30 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-ml-line p-4 flex gap-2 justify-end">
              <button
                onClick={() => { setProductoActivo(null); setMotivoRechazo('') }}
                className="px-4 py-2 text-ml-ink hover:bg-ml-bg rounded-md text-sm"
                disabled={procesando}
              >
                Cancelar
              </button>
              <button
                onClick={() => rechazarProducto(productoActivo._id)}
                disabled={procesando || motivoRechazo.trim().length < 5}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium"
              >
                {procesando ? 'Procesando...' : 'Rechazar'}
              </button>
              <button
                onClick={() => aprobarProducto(productoActivo._id)}
                disabled={procesando}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-md text-sm font-medium"
              >
                {procesando ? 'Procesando...' : 'Aprobar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
