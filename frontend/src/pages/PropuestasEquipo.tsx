/**
 * PROPUESTAS DEL EQUIPO IA — panel del fundador para decidir.
 *
 * Los agentes (Sofía, Tomás, Diego) generan propuestas autónomas
 * cada 6 horas basadas en datos REALES del marketplace. Esta página
 * permite al fundador:
 *
 * - Ver las propuestas con su evidencia
 * - Aprobar / Rechazar / Modificar / Posponer
 * - Forzar una ronda de análisis bajo demanda
 *
 * REGLA CLAVE: aprobar una propuesta NO la ejecuta. Solo la deja lista
 * para que Claude (programador) la implemente en código en la próxima
 * sesión de desarrollo.
 */

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useToast } from '../context/ToastContext'

interface EvidenciaItem {
  tipo: string
  referenciaId?: string
  descripcion: string
  datos?: any
}

interface Propuesta {
  _id: string
  titulo: string
  problema: string
  evidencia: EvidenciaItem[]
  propuesta: string
  impactoEstimado: string
  riesgos: string
  categoria: string
  prioridad: 'baja' | 'media' | 'alta' | 'urgente'
  proponente: string
  cosignan: string[]
  estado: 'esperando_admin' | 'en_revision' | 'aprobada' | 'en_ejecucion' | 'completada' | 'rechazada' | 'pospuesta' | 'modificada'
  decisionFundador?: {
    decidida: boolean
    fecha?: string
    comentario?: string
  }
  createdAt: string
}

const COLOR_PRIORIDAD: Record<string, string> = {
  urgente: 'bg-red-100 text-red-700 border-red-300',
  alta: 'bg-orange-100 text-orange-700 border-orange-300',
  media: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  baja: 'bg-gray-100 text-ml-soft border-ml-line'
}

const COLOR_ESTADO: Record<string, string> = {
  esperando_admin: 'bg-ml-bg text-blue-700',
  en_revision: 'bg-indigo-100 text-indigo-700',
  aprobada: 'bg-green-100 text-green-700',
  en_ejecucion: 'bg-purple-100 text-purple-700',
  completada: 'bg-emerald-100 text-emerald-700',
  rechazada: 'bg-red-100 text-red-700',
  pospuesta: 'bg-gray-100 text-ml-soft',
  modificada: 'bg-amber-100 text-amber-700'
}

const ICONO_CATEGORIA: Record<string, string> = {
  seguridad: '🛡️',
  producto: '🛒',
  soporte: '💬',
  crecimiento: '📈',
  finanzas: '💰',
  legal: '⚖️',
  operaciones: '⚙️',
  tecnica: '🔧'
}

const ICONO_AGENTE: Record<string, string> = {
  diego_ceo: '🎩',
  sofia_cmo: '🛡️',
  tomas_cto: '💬'
}

function tiempoRelativo(iso: string): string {
  const segs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (segs < 60) return 'recién'
  if (segs < 3600) return `hace ${Math.floor(segs / 60)} min`
  if (segs < 86400) return `hace ${Math.floor(segs / 3600)} h`
  return new Date(iso).toLocaleDateString('es-AR')
}

export default function PropuestasEquipo() {
  const toast = useToast()
  const [propuestas, setPropuestas] = useState<Propuesta[]>([])
  const [filtroEstado, setFiltroEstado] = useState<string>('esperando_admin')
  const [cargando, setCargando] = useState(false)
  const [propuestaActiva, setPropuestaActiva] = useState<Propuesta | null>(null)
  const [comentarioDecision, setComentarioDecision] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [forzando, setForzando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const query = filtroEstado === 'todas' ? '' : `?estado=${filtroEstado}`
      const { data } = await api.get(`/cerebro/propuestas${query}`)
      setPropuestas(data || [])
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al cargar propuestas')
    } finally {
      setCargando(false)
    }
  }, [filtroEstado, toast])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function decidir(estado: 'aprobada' | 'rechazada' | 'pospuesta' | 'en_revision') {
    if (!propuestaActiva) return
    if (estado === 'rechazada' && comentarioDecision.trim().length < 3) {
      toast.warning('Si rechazás, agregá un comentario breve para el equipo')
      return
    }

    setProcesando(true)
    try {
      await api.post(`/cerebro/propuestas/${propuestaActiva._id}/decidir`, {
        decision: estado,
        comentario: comentarioDecision.trim()
      })
      toast.exito(`Propuesta ${estado}`)
      setPropuestaActiva(null)
      setComentarioDecision('')
      await cargar()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al decidir')
    } finally {
      setProcesando(false)
    }
  }

  async function forzarRonda() {
    setForzando(true)
    try {
      toast.info('Pidiéndole al equipo que analice los datos... puede tardar 30 seg')
      const { data } = await api.post('/cerebro/propuestas/forzar-ronda')
      toast.exito(`Ronda terminada. ${data.nuevas} propuestas nuevas.`)
      await cargar()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error en la ronda')
    } finally {
      setForzando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              📋 Propuestas del equipo IA
            </h1>
            <p className="text-sm text-ml-muted mt-1">
              Los agentes analizan datos reales cada 6 horas y proponen mejoras. Vos decidís.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/admin/cerebro"
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm"
            >
              ← Volver al cerebro
            </Link>
            <button
              onClick={forzarRonda}
              disabled={forzando}
              className="bg-blue-600  disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium"
            >
              {forzando ? 'Analizando...' : '🔄 Forzar análisis ahora'}
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'esperando_admin', label: '⏳ Esperando tu decisión' },
            { id: 'en_revision', label: '🔍 En revisión' },
            { id: 'aprobada', label: '✅ Aprobadas' },
            { id: 'rechazada', label: '🚫 Rechazadas' },
            { id: 'pospuesta', label: '⏸️ Pospuestas' },
            { id: 'todas', label: 'Todas' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFiltroEstado(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filtroEstado === f.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de propuestas */}
      <div className="max-w-6xl mx-auto">
        {cargando ? (
          <div className="text-center py-12 text-ml-muted">Cargando...</div>
        ) : propuestas.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
            <div className="text-5xl mb-3">🎉</div>
            <p className="text-gray-300">
              {filtroEstado === 'esperando_admin'
                ? 'No hay propuestas esperando tu decisión.'
                : 'No hay propuestas con este filtro.'}
            </p>
            <p className="text-xs text-ml-muted mt-2">
              El equipo analiza los datos cada 6 horas. Si no detectan un patrón, no inventan propuestas.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {propuestas.map(p => (
              <button
                key={p._id}
                onClick={() => setPropuestaActiva(p)}
                className="w-full text-left bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 rounded-xl p-4 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl flex-shrink-0">{ICONO_CATEGORIA[p.categoria] || '📋'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${COLOR_PRIORIDAD[p.prioridad]}`}>
                        {p.prioridad}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${COLOR_ESTADO[p.estado]}`}>
                        {p.estado.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-ml-muted">
                        {ICONO_AGENTE[p.proponente]} {p.proponente.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-ml-muted">· {tiempoRelativo(p.createdAt)}</span>
                    </div>
                    <h3 className="font-semibold text-gray-100 mb-1">{p.titulo}</h3>
                    <p className="text-sm text-ml-muted line-clamp-2">{p.problema}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal de detalle */}
      {propuestaActiva && (
        <ModalDetalle
          propuesta={propuestaActiva}
          comentario={comentarioDecision}
          onChangeComentario={setComentarioDecision}
          procesando={procesando}
          onClose={() => { setPropuestaActiva(null); setComentarioDecision('') }}
          onDecidir={decidir}
        />
      )}
    </div>
  )
}

function ModalDetalle({
  propuesta,
  comentario,
  onChangeComentario,
  procesando,
  onClose,
  onDecidir
}: {
  propuesta: Propuesta
  comentario: string
  onChangeComentario: (v: string) => void
  procesando: boolean
  onClose: () => void
  onDecidir: (estado: 'aprobada' | 'rechazada' | 'pospuesta' | 'en_revision') => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const yaDecidida = ['aprobada', 'rechazada', 'pospuesta', 'completada', 'en_ejecucion'].includes(propuesta.estado)

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white text-ml-ink rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 bg-white/90 hover:bg-white text-ml-ink rounded-full w-9 h-9 flex items-center justify-center text-2xl leading-none shadow-md"
        >
          ×
        </button>

        {/* Header */}
        <div className="px-6 py-4 pr-14 ml-grad text-white">
          <div className="flex items-center gap-2 mb-1 flex-wrap text-xs">
            <span className={`px-2 py-0.5 rounded-full ${COLOR_PRIORIDAD[propuesta.prioridad]} text-ml-ink`}>
              {propuesta.prioridad}
            </span>
            <span className="bg-white/20 px-2 py-0.5 rounded-full">
              {ICONO_CATEGORIA[propuesta.categoria]} {propuesta.categoria}
            </span>
            <span className="bg-white/20 px-2 py-0.5 rounded-full">
              {ICONO_AGENTE[propuesta.proponente]} {propuesta.proponente}
            </span>
            <span className={`px-2 py-0.5 rounded-full ${COLOR_ESTADO[propuesta.estado]}`}>
              {propuesta.estado.replace('_', ' ')}
            </span>
          </div>
          <h2 className="text-xl font-bold">{propuesta.titulo}</h2>
        </div>

        <div className="p-6 space-y-5">
          {/* Problema */}
          <section>
            <h3 className="font-bold text-ml-ink mb-2 text-sm uppercase tracking-wide">🔎 Problema detectado</h3>
            <p className="text-sm text-ml-ink whitespace-pre-wrap">{propuesta.problema}</p>
          </section>

          {/* Evidencia */}
          {propuesta.evidencia && propuesta.evidencia.length > 0 && (
            <section>
              <h3 className="font-bold text-ml-ink mb-2 text-sm uppercase tracking-wide">
                📊 Evidencia ({propuesta.evidencia.length} casos)
              </h3>
              <div className="space-y-2">
                {propuesta.evidencia.map((ev, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 border border-ml-line">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-ml-bg text-ml-ink px-2 py-0.5 rounded">
                        {ev.tipo}
                      </span>
                      {ev.referenciaId && (
                        <span className="text-xs text-ml-muted font-mono">{ev.referenciaId.slice(-8)}</span>
                      )}
                    </div>
                    <p className="text-sm text-ml-ink">{ev.descripcion}</p>
                    {ev.datos && Object.keys(ev.datos).length > 0 && (
                      <pre className="text-[10px] text-ml-muted mt-1 overflow-x-auto">
                        {JSON.stringify(ev.datos, null, 2).slice(0, 300)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Propuesta */}
          <section>
            <h3 className="font-bold text-ml-ink mb-2 text-sm uppercase tracking-wide">💡 Propuesta</h3>
            <p className="text-sm text-ml-ink whitespace-pre-wrap bg-blue-50 rounded-lg p-3 border border-blue-200">
              {propuesta.propuesta}
            </p>
          </section>

          {/* Impacto */}
          {propuesta.impactoEstimado && (
            <section>
              <h3 className="font-bold text-ml-ink mb-2 text-sm uppercase tracking-wide">📈 Impacto esperado</h3>
              <p className="text-sm text-ml-ink whitespace-pre-wrap">{propuesta.impactoEstimado}</p>
            </section>
          )}

          {/* Riesgos */}
          {propuesta.riesgos && (
            <section>
              <h3 className="font-bold text-ml-ink mb-2 text-sm uppercase tracking-wide">⚠️ Riesgos / contraargumentos</h3>
              <p className="text-sm text-ml-ink whitespace-pre-wrap bg-orange-50 rounded-lg p-3 border border-orange-200">
                {propuesta.riesgos}
              </p>
            </section>
          )}

          {/* Decisión previa */}
          {yaDecidida && propuesta.decisionFundador?.decidida && (
            <section className="bg-gray-50 rounded-lg p-3 border border-ml-line">
              <div className="text-xs text-ml-muted uppercase tracking-wide font-semibold mb-1">
                Tu decisión previa ({new Date(propuesta.decisionFundador.fecha || '').toLocaleString('es-AR')})
              </div>
              {propuesta.decisionFundador.comentario && (
                <p className="text-sm text-ml-ink italic">"{propuesta.decisionFundador.comentario}"</p>
              )}
            </section>
          )}

          {/* Comentario + acciones */}
          {!yaDecidida && (
            <section className="border-t border-ml-line pt-4">
              <label className="block text-sm font-semibold text-ml-ink mb-2">
                Comentario para el equipo (opcional, obligatorio si rechazás)
              </label>
              <textarea
                value={comentario}
                onChange={e => onChangeComentario(e.target.value)}
                placeholder="Ej: Buena idea pero esperá a Q2; o: No coincido, mirá X dato..."
                rows={3}
                className="w-full border border-ml-line rounded-lg p-2 text-sm focus:ring-2 focus:ring-ml-purple/30"
              />

              <div className="flex gap-2 mt-4 flex-wrap">
                <button
                  onClick={() => onDecidir('aprobada')}
                  disabled={procesando}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                >
                  ✅ Aprobar
                </button>
                <button
                  onClick={() => onDecidir('rechazada')}
                  disabled={procesando}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                >
                  🚫 Rechazar
                </button>
                <button
                  onClick={() => onDecidir('pospuesta')}
                  disabled={procesando}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                >
                  ⏸️ Posponer
                </button>
                <button
                  onClick={() => onDecidir('en_revision')}
                  disabled={procesando}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm"
                >
                  🔍 En revisión
                </button>
              </div>
              <p className="text-xs text-ml-muted mt-3">
                ⚠️ Aprobar NO ejecuta la propuesta. Solo la deja lista para que Claude la implemente en código.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
