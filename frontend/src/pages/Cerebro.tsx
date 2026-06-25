/**
 * CEREBRO — Panel del equipo IA de MercadoLocal.
 *
 * Vista única en /admin/cerebro. Solo accesible para administradores.
 *
 * Layout:
 *   - Canvas central (n8n-style): nodos de cada agente con métricas en vivo,
 *     conexiones de jerarquía, animación cuando un agente "habla".
 *   - Chat lateral derecho (WhatsApp-style): muestra el canal activo
 *     (general, reporte, ascensos). El admin puede mandar mensajes y los
 *     agentes responden.
 *   - Botón flotante "Chat privado con Diego" → abre modal con el canal
 *     privado_ceo.
 *
 * Polling: cada 5 segundos chequea mensajes nuevos. Sin WebSockets dedicados
 * por ahora — para un panel admin el polling alcanza y simplifica el deploy.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'

// ===================== TIPOS =====================

interface Agente {
  _id: string
  slug: string
  nombre: string
  titulo: string
  area: string
  rango: 'trainee' | 'junior' | 'senior' | 'manager' | 'director' | 'c_level'
  avatar: string
  color: string
  salarioARS: number
  reportaA?: { _id: string; slug: string } | string | null
  personalidad: {
    descripcion: string
    tono: string
    muletillas: string[]
    fortalezas: string[]
    debilidades: string[]
  }
  manifiesto: string
  trasfondo?: string
  metricas: {
    xp: number
    reputacion: number
    decisionesTotales: number
    decisionesAcertadas: number
    decisionesRevocadas: number
    ahorroGenerado: number
    mencionesRecibidas: number
    propuestasAceptadas: number
  }
  activo: boolean
  estado: string
}

interface MensajeOrg {
  _id: string
  canal: 'general' | 'privado_ceo' | 'reporte' | 'ascensos'
  autorSlug: string
  autorTipo: 'agente' | 'admin' | 'sistema'
  contenido: string
  menciones: string[]
  tipo: string
  contexto?: any
  tokens?: { entrada: number; salida: number; entradaCached: number }
  reacciones: { agenteSlug: string; emoji: string; fecha: string }[]
  createdAt: string
}

type Canal = 'general' | 'privado_ceo' | 'reporte' | 'ascensos'

const CANALES: { id: Canal; nombre: string; icono: string; descripcion: string }[] = [
  { id: 'general', nombre: 'Sala común', icono: '💬', descripcion: 'Donde habla todo el equipo' },
  { id: 'reporte', nombre: 'Reportes', icono: '📊', descripcion: 'Reportes diarios del CEO' },
  { id: 'ascensos', nombre: 'Ascensos', icono: '🎖️', descripcion: 'Promociones y cambios' }
]

const RANGO_LABEL: Record<string, string> = {
  trainee: 'Trainee',
  junior: 'Junior',
  senior: 'Senior',
  manager: 'Manager',
  director: 'Director',
  c_level: 'C-Level'
}

const RANGO_COLOR: Record<string, string> = {
  trainee: '#9ca3af',
  junior: '#60a5fa',
  senior: '#3b82f6',
  manager: '#7c3aed',
  director: '#c026d3',
  c_level: '#f59e0b'
}

// ===================== UTILS =====================

function tiempoRelativo(iso: string): string {
  const segs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (segs < 60) return 'recién'
  if (segs < 3600) return `${Math.floor(segs / 60)} min`
  if (segs < 86400) return `${Math.floor(segs / 3600)} h`
  return new Date(iso).toLocaleDateString('es-AR')
}

function renderConMenciones(texto: string, agentes: Map<string, Agente>): React.ReactNode {
  // Reemplazar @slug por chip con color del agente
  const partes = texto.split(/(@[a-z][a-z0-9_]+)/gi)
  return partes.map((parte, i) => {
    if (parte.startsWith('@')) {
      const slug = parte.slice(1).toLowerCase()
      const agente = agentes.get(slug)
      if (agente) {
        return (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: agente.color + '20', color: agente.color }}
          >
            {agente.avatar} {agente.nombre}
          </span>
        )
      }
    }
    return <span key={i}>{parte}</span>
  })
}

// ===================== COMPONENTE PRINCIPAL =====================

export default function Cerebro() {
  const toast = useToast()

  // Estado global
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [canalActivo, setCanalActivo] = useState<Canal>('general')
  const [mensajes, setMensajes] = useState<MensajeOrg[]>([])
  const [textoInput, setTextoInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [chatPrivadoAbierto, setChatPrivadoAbierto] = useState(false)
  const [mensajesPrivado, setMensajesPrivado] = useState<MensajeOrg[]>([])
  const [textoPrivado, setTextoPrivado] = useState('')
  const [enviandoPrivado, setEnviandoPrivado] = useState(false)
  const [noLeidos, setNoLeidos] = useState<Record<string, number>>({})
  const [agenteSeleccionado, setAgenteSeleccionado] = useState<Agente | null>(null)
  const [slugsActivos, setSlugsActivos] = useState<Set<string>>(new Set())
  const [propuestasPendientes, setPropuestasPendientes] = useState<number>(0)
  const [estudioAbierto, setEstudioAbierto] = useState(false)

  // Map slug → agente para lookups rápidos
  const agentesMap = new Map<string, Agente>()
  agentes.forEach(a => agentesMap.set(a.slug, a))

  // Para auto-scroll del chat
  const chatRef = useRef<HTMLDivElement>(null)
  const chatPrivadoRef = useRef<HTMLDivElement>(null)

  // ===== Carga inicial =====
  const cargarAgentes = useCallback(async () => {
    try {
      const { data } = await api.get('/cerebro/agentes')
      setAgentes(data)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'No se pudieron cargar los agentes')
    }
  }, [toast])

  const cargarMensajes = useCallback(async (canal: Canal) => {
    try {
      const { data } = await api.get(`/cerebro/mensajes/${canal}?limit=80`)
      // Reemplazamos completamente con los mensajes oficiales de la base.
      // Cualquier mensaje optimista con _id "temp_*" se elimina automáticamente
      // porque la base ya tiene la versión real con su _id final.
      if (canal === 'privado_ceo') setMensajesPrivado(Array.isArray(data) ? data : [])
      else setMensajes(Array.isArray(data) ? data : [])
    } catch (e: any) {
      // Silencioso durante polling
    }
  }, [])

  const cargarNoLeidos = useCallback(async () => {
    try {
      const { data } = await api.get('/cerebro/no-leidos')
      setNoLeidos(data)
    } catch {}
  }, [])

  const cargarPropuestasPendientes = useCallback(async () => {
    try {
      const { data } = await api.get('/cerebro/propuestas/no-decididas-count')
      setPropuestasPendientes(data?.count || 0)
    } catch {}
  }, [])

  // Marca un canal como leído cuando lo abro
  const marcarLeido = useCallback(async (canal: Canal) => {
    try {
      await api.post(`/cerebro/marcar-leido/${canal}`)
      setNoLeidos(prev => ({ ...prev, [canal]: 0 }))
    } catch {}
  }, [])

  // Polling cada 20s para "no leídos" y mantener actualizado el canal
  // si otro admin estuviera escribiendo en simultáneo (raro pero posible).
  // Las respuestas a tus mensajes vienen sincrónicamente — no dependemos
  // del polling para verlas.
  useEffect(() => {
    cargarAgentes()
    cargarMensajes(canalActivo)
    cargarNoLeidos()
    cargarPropuestasPendientes()

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      cargarMensajes(canalActivo)
      if (chatPrivadoAbierto) cargarMensajes('privado_ceo')
      cargarNoLeidos()
      cargarPropuestasPendientes()
    }, 20000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canalActivo, chatPrivadoAbierto])

  // Cuando cambia el canal, marcarlo leído y scroll abajo
  useEffect(() => {
    marcarLeido(canalActivo)
  }, [canalActivo, marcarLeido])

  // Auto-scroll cuando llegan mensajes nuevos
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [mensajes])

  useEffect(() => {
    if (chatPrivadoRef.current) {
      chatPrivadoRef.current.scrollTop = chatPrivadoRef.current.scrollHeight
    }
  }, [mensajesPrivado])

  // Animar nodos cuando llega un mensaje nuevo
  useEffect(() => {
    if (mensajes.length === 0) return
    const ultimo = mensajes[mensajes.length - 1]
    if (ultimo.autorTipo === 'agente') {
      setSlugsActivos(prev => new Set([...prev, ultimo.autorSlug]))
      const t = setTimeout(() => {
        setSlugsActivos(prev => {
          const nuevo = new Set(prev)
          nuevo.delete(ultimo.autorSlug)
          return nuevo
        })
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [mensajes])

  // ===== Adivinar qué agentes van a responder =====
  // Heurística para mostrar "X está escribiendo..." mientras esperamos.
  // Replica la lógica del backend para mostrar feedback instantáneo.
  function adivinarRespondedores(texto: string, canal: Canal): string[] {
    const lower = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

    // 1. Buscar menciones (cortas o completas)
    const matches = lower.match(/@([a-z][a-z0-9_]*)/g) || []
    const slugsEncontrados: string[] = []
    for (const m of matches) {
      const palabra = m.slice(1)
      if (palabra === 'todos' || palabra === 'equipo') {
        return agentes.filter(a => a.activo).map(a => a.slug)
      }
      // ¿Coincide con un slug completo?
      if (agentesMap.has(palabra)) {
        slugsEncontrados.push(palabra)
        continue
      }
      // ¿Coincide con el primer nombre o el slug corto?
      const ag = agentes.find(a => {
        const slugCorto = a.slug.split('_')[0]
        const nombreCorto = a.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(' ')[0]
        return slugCorto === palabra || nombreCorto === palabra
      })
      if (ag) slugsEncontrados.push(ag.slug)
    }
    if (slugsEncontrados.length > 0) return slugsEncontrados

    // 2. Sin menciones: default según canal
    if (canal === 'privado_ceo') return ['diego_ceo']
    return ['diego_ceo'] // fallback (en general el backend decide por keywords pero acá no lo replicamos)
  }

  // ===== Estado: agentes pensando =====
  const [pensando, setPensando] = useState<Set<string>>(new Set())

  function marcarPensando(slugs: string[]) {
    setPensando(prev => new Set([...prev, ...slugs]))
  }
  function quitarPensando() {
    setPensando(new Set())
  }

  // ===== Enviar mensaje =====
  async function enviarMensaje() {
    const texto = textoInput.trim()
    if (!texto || enviando) return

    setEnviando(true)
    setTextoInput('')

    // Optimistic UI: tu mensaje aparece al instante
    const optimista: MensajeOrg = {
      _id: 'temp_' + Date.now(),
      canal: canalActivo,
      autorSlug: 'admin',
      autorTipo: 'admin',
      contenido: texto,
      menciones: [],
      tipo: 'conversacion',
      reacciones: [],
      createdAt: new Date().toISOString()
    }
    setMensajes(prev => [...prev, optimista])

    // Indicador "X está escribiendo..."
    const respondedores = adivinarRespondedores(texto, canalActivo)
    marcarPensando(respondedores)

    try {
      // Backend espera a los agentes (2-6 seg) y devuelve respuestas en
      // el mismo response. Sin polling, sin race conditions.
      await api.post(`/cerebro/mensajes/${canalActivo}`, { contenido: texto })
      // Recargar mensajes para ver todo en orden con los _id reales
      await cargarMensajes(canalActivo)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'No se pudo enviar el mensaje')
      setTextoInput(texto)
    } finally {
      setEnviando(false)
      quitarPensando()
    }
  }

  async function enviarMensajePrivado() {
    const texto = textoPrivado.trim()
    if (!texto || enviandoPrivado) return

    setEnviandoPrivado(true)
    setTextoPrivado('')

    const optimista: MensajeOrg = {
      _id: 'temp_' + Date.now(),
      canal: 'privado_ceo',
      autorSlug: 'admin',
      autorTipo: 'admin',
      contenido: texto,
      menciones: [],
      tipo: 'conversacion',
      reacciones: [],
      createdAt: new Date().toISOString()
    }
    setMensajesPrivado(prev => [...prev, optimista])
    marcarPensando(['diego_ceo'])

    try {
      await api.post('/cerebro/mensajes/privado_ceo', { contenido: texto })
      await cargarMensajes('privado_ceo')
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'No se pudo enviar el mensaje')
      setTextoPrivado(texto)
    } finally {
      setEnviandoPrivado(false)
      quitarPensando()
    }
  }

  // ===== Acciones admin =====
  async function generarReporteAhora() {
    try {
      toast.info('Generando reporte... puede tardar unos segundos')
      await api.post('/cerebro/reporte-ahora')
      toast.exito('Reporte generado y enviado por email')
      setCanalActivo('reporte')
      cargarMensajes('reporte')
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error generando reporte')
    }
  }

  // ===== Render =====
  return (
    <div className="fixed inset-0 top-32 bg-gray-900 text-gray-100 flex overflow-hidden">
      {/* CANVAS CENTRAL */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header — sticky para que SIEMPRE se vea, no se tape con el navbar */}
        <div className="sticky top-0 z-10 bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between shadow-lg">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              🧠 MercadoLocal Brain
            </h1>
            <p className="text-xs text-ml-muted mt-0.5">
              {agentes.filter(a => a.activo).length} agentes activos · Equipo IA
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEstudioAbierto(true)}
              className="text-sm bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-4 py-2 rounded-md font-semibold flex items-center gap-2 shadow-md text-white"
            >
              🎨 Estudio Creativo
            </button>
            <a
              href="/admin/cerebro/propuestas"
              className="relative text-sm bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-md font-semibold flex items-center gap-2 shadow-md"
            >
              📋 Propuestas
              {propuestasPendientes > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[22px] text-center leading-none">
                  {propuestasPendientes}
                </span>
              )}
            </a>
            <button
              onClick={generarReporteAhora}
              className="text-xs mlbtn ml-grad text-white px-3 py-1.5 rounded-md font-medium"
            >
              Generar reporte
            </button>
          </div>
        </div>

        {/* Canvas */}
        <CanvasAgentes
          agentes={agentes}
          slugsActivos={slugsActivos}
          onSelect={setAgenteSeleccionado}
        />

        {/* Barra inferior con métricas globales */}
        <BarraMetricas agentes={agentes} />
      </div>

      {/* PANEL CHAT LATERAL */}
      <div className="w-[420px] bg-gray-50 text-ml-ink border-l border-gray-700 flex flex-col flex-shrink-0">
        {/* Tabs de canales */}
        <div className="bg-white border-b border-ml-line flex">
          {CANALES.map(c => (
            <button
              key={c.id}
              onClick={() => setCanalActivo(c.id)}
              className={`flex-1 px-3 py-3 text-sm font-medium border-b-2 transition-colors relative ${
                canalActivo === c.id
                  ? 'border-blue-600 text-ml-blue bg-blue-50'
                  : 'border-transparent text-ml-muted hover:text-ml-ink'
              }`}
            >
              <span className="mr-1">{c.icono}</span>
              {c.nombre}
              {noLeidos[c.id] > 0 && (
                <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold min-w-[18px] text-center">
                  {noLeidos[c.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Stream de mensajes */}
        <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {mensajes.length === 0 ? (
            <div className="text-center text-ml-muted text-sm py-8">
              Sin mensajes todavía.
              <br />
              {canalActivo === 'general' && 'Mandá algo para arrancar la conversación.'}
              {canalActivo === 'reporte' && 'Esperando el primer reporte diario del CEO.'}
              {canalActivo === 'ascensos' && 'Los ascensos aparecen acá cuando el equipo crece.'}
            </div>
          ) : (
            <>
              {mensajes.map(m => (
                <Burbuja key={m._id} mensaje={m} agentesMap={agentesMap} />
              ))}
              {/* Indicador "X está escribiendo..." */}
              {[...pensando].map(slug => {
                const ag = agentesMap.get(slug)
                if (!ag) return null
                return <Escribiendo key={`p-${slug}`} agente={ag} />
              })}
            </>
          )}
        </div>

        {/* Input (solo en general) */}
        {canalActivo === 'general' && (
          <div className="bg-white border-t border-ml-line p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={textoInput}
                onChange={e => setTextoInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && enviarMensaje()}
                placeholder="Hablale al equipo... probá @diego, @sofia, @tomas o @todos"
                disabled={enviando}
                className="flex-1 px-3 py-2 border border-ml-line rounded-md text-sm focus:ring-2 focus:ring-ml-purple/30 focus:border-blue-500 disabled:opacity-50"
              />
              <button
                onClick={enviarMensaje}
                disabled={enviando || !textoInput.trim()}
                className="mlbtn ml-grad disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                {enviando ? '...' : 'Enviar'}
              </button>
            </div>
            <p className="text-[10px] text-ml-muted mt-1.5">
              Los agentes responden con su personalidad. Mencionalos con @diego, @sofia, @tomas o @todos.
            </p>
          </div>
        )}
      </div>

      {/* BOTÓN FLOTANTE: Chat privado con Diego */}
      <button
        onClick={() => {
          setChatPrivadoAbierto(true)
          cargarMensajes('privado_ceo')
          marcarLeido('privado_ceo')
        }}
        className="absolute bottom-6 right-[440px] bg-gradient-to-br from-blue-700 to-purple-700 hover:from-blue-800 hover:to-purple-800 text-white rounded-full shadow-2xl px-5 py-3 flex items-center gap-2 font-medium transition-transform hover:scale-105"
      >
        <span className="text-2xl">🎩</span>
        <div className="text-left">
          <div className="text-xs opacity-80">Chat privado con</div>
          <div className="text-sm font-bold">Diego — CEO</div>
        </div>
        {noLeidos.privado_ceo > 0 && (
          <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold min-w-[18px] text-center">
            {noLeidos.privado_ceo}
          </span>
        )}
      </button>

      {/* MODAL: Chat privado */}
      {chatPrivadoAbierto && (
        <ChatPrivadoCEO
          mensajes={mensajesPrivado}
          agentesMap={agentesMap}
          texto={textoPrivado}
          onChange={setTextoPrivado}
          onSend={enviarMensajePrivado}
          enviando={enviandoPrivado}
          onClose={() => setChatPrivadoAbierto(false)}
          refChat={chatPrivadoRef}
          pensando={pensando}
        />
      )}

      {/* MODAL: Detalle de agente */}
      {agenteSeleccionado && (
        <ModalAgente agente={agenteSeleccionado} onClose={() => setAgenteSeleccionado(null)} />
      )}

      {/* MODAL: Estudio Creativo */}
      {estudioAbierto && (
        <ModalEstudioCreativo
          agentesMap={agentesMap}
          onClose={() => setEstudioAbierto(false)}
        />
      )}
    </div>
  )
}

// ===================== CANVAS DE AGENTES =====================

function CanvasAgentes({
  agentes,
  slugsActivos,
  onSelect
}: {
  agentes: Agente[]
  slugsActivos: Set<string>
  onSelect: (a: Agente) => void
}) {
  // Layout: CEO al centro arriba, el resto debajo en hilera
  const ceo = agentes.find(a => a.slug === 'diego_ceo')
  const cLevel = agentes.filter(a => a.slug !== 'diego_ceo' && a.rango === 'director' || a.rango === 'c_level' && a.slug !== 'diego_ceo')
  const otros = agentes.filter(a => a.rango !== 'director' && a.rango !== 'c_level')

  const subordinados = [...cLevel, ...otros].filter(a => a.slug !== 'diego_ceo')

  // Coordenadas
  const W = 1000
  const H = 600
  const ceoX = W / 2
  const ceoY = 100
  const filaSubY = 320
  const subSpacing = Math.min(280, (W - 200) / Math.max(subordinados.length, 1))

  return (
    <div className="flex-1 bg-gray-900 overflow-hidden relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid de fondo */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1f2937" strokeWidth="1" />
          </pattern>
          <radialGradient id="pulse" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />

        {/* Líneas de jerarquía */}
        {ceo && subordinados.map((sub, i) => {
          const x = 100 + i * subSpacing + subSpacing / 2
          return (
            <line
              key={`line-${sub.slug}`}
              x1={ceoX}
              y1={ceoY + 50}
              x2={x}
              y2={filaSubY - 40}
              stroke="#374151"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          )
        })}

        {/* Nodo CEO */}
        {ceo && (
          <NodoAgente
            agente={ceo}
            x={ceoX}
            y={ceoY}
            activo={slugsActivos.has(ceo.slug)}
            onClick={() => onSelect(ceo)}
            esCEO
          />
        )}

        {/* Nodos subordinados */}
        {subordinados.map((sub, i) => {
          const x = 100 + i * subSpacing + subSpacing / 2
          return (
            <NodoAgente
              key={sub.slug}
              agente={sub}
              x={x}
              y={filaSubY}
              activo={slugsActivos.has(sub.slug)}
              onClick={() => onSelect(sub)}
            />
          )
        })}
      </svg>

      {/* Leyenda */}
      <div className="absolute bottom-4 left-4 bg-gray-800/80 backdrop-blur-sm rounded-lg p-3 text-xs text-ml-line">
        <div className="font-semibold text-gray-100 mb-1">Leyenda</div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
          <span>Hablando ahora</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-500" />
          <span>Inactivo</span>
        </div>
      </div>
    </div>
  )
}

function NodoAgente({
  agente,
  x,
  y,
  activo,
  onClick,
  esCEO = false
}: {
  agente: Agente
  x: number
  y: number
  activo: boolean
  onClick: () => void
  esCEO?: boolean
}) {
  const r = esCEO ? 50 : 42

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Anillo de pulso si está activo */}
      {activo && (
        <circle r={r + 12} fill="url(#pulse)">
          <animate attributeName="r" from={r + 4} to={r + 24} dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.8" to="0" dur="1.5s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Anillo de rango */}
      <circle r={r + 3} fill="none" stroke={RANGO_COLOR[agente.rango]} strokeWidth="3" />

      {/* Cuerpo del nodo */}
      <circle r={r} fill={agente.color} opacity={agente.activo ? 1 : 0.4} />

      {/* Avatar emoji */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: esCEO ? '38px' : '32px', userSelect: 'none' }}
      >
        {agente.avatar}
      </text>

      {/* Indicador de activo (dot verde) */}
      {activo && (
        <circle cx={r - 5} cy={-r + 5} r="6" fill="#10b981">
          <animate attributeName="opacity" from="1" to="0.3" dur="1s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Nombre debajo */}
      <text
        y={r + 22}
        textAnchor="middle"
        fill="#f3f4f6"
        style={{ fontSize: '14px', fontWeight: 'bold', userSelect: 'none' }}
      >
        {agente.nombre}
      </text>
      <text
        y={r + 38}
        textAnchor="middle"
        fill="#9ca3af"
        style={{ fontSize: '11px', userSelect: 'none' }}
      >
        {agente.titulo}
      </text>

      {/* Badge de rango */}
      <rect
        x={-30}
        y={r + 44}
        width={60}
        height={16}
        rx={8}
        fill={RANGO_COLOR[agente.rango]}
        opacity={0.9}
      />
      <text
        y={r + 55}
        textAnchor="middle"
        fill="white"
        style={{ fontSize: '10px', fontWeight: 'bold', userSelect: 'none' }}
      >
        {RANGO_LABEL[agente.rango]}
      </text>

      {/* XP arriba a la derecha */}
      <text
        x={r + 8}
        y={-r + 5}
        fill="#fbbf24"
        style={{ fontSize: '11px', fontWeight: 'bold', userSelect: 'none' }}
      >
        {agente.metricas.xp} XP
      </text>
    </g>
  )
}

// ===================== BARRA MÉTRICAS =====================

function BarraMetricas({ agentes }: { agentes: Agente[] }) {
  const activos = agentes.filter(a => a.activo).length
  const xpTotal = agentes.reduce((sum, a) => sum + a.metricas.xp, 0)
  const decisionesTotales = agentes.reduce((sum, a) => sum + a.metricas.decisionesTotales, 0)
  const ahorroTotal = agentes.reduce((sum, a) => sum + a.metricas.ahorroGenerado, 0)

  return (
    <div className="bg-gray-800 border-t border-gray-700 px-6 py-3 flex items-center gap-8 text-sm">
      <Metrica label="Agentes activos" valor={`${activos}`} color="text-green-400" />
      <Metrica label="XP del equipo" valor={xpTotal.toLocaleString('es-AR')} color="text-yellow-400" />
      <Metrica label="Decisiones tomadas" valor={decisionesTotales.toLocaleString('es-AR')} color="text-blue-400" />
      <Metrica label="Ahorro generado" valor={`$${ahorroTotal.toLocaleString('es-AR')}`} color="text-purple-400" />
    </div>
  )
}

function Metrica({ label, valor, color }: { label: string; valor: string; color: string }) {
  return (
    <div>
      <div className="text-xs text-ml-muted uppercase tracking-wide">{label}</div>
      <div className={`font-bold ${color}`}>{valor}</div>
    </div>
  )
}

// ===================== BURBUJA DE MENSAJE =====================

function Burbuja({ mensaje, agentesMap }: { mensaje: MensajeOrg; agentesMap: Map<string, Agente> }) {
  const esAdmin = mensaje.autorTipo === 'admin'
  const agente = !esAdmin ? agentesMap.get(mensaje.autorSlug) : null
  const esSistema = mensaje.autorTipo === 'sistema'

  if (esSistema) {
    return (
      <div className="text-center my-2">
        <span className="inline-block bg-ml-bg text-ml-soft text-xs px-3 py-1 rounded-full">
          {mensaje.contenido}
        </span>
      </div>
    )
  }

  // Estilo especial para reportes
  if (mensaje.tipo === 'reporte_diario') {
    return (
      <div className="bg-white border-2 border-blue-200 rounded-xl shadow-md overflow-hidden">
        <div className="ml-grad px-3 py-2 text-white">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-lg">🎩</span>
            <span>Reporte diario de Diego</span>
          </div>
          <div className="text-[10px] opacity-90">
            {new Date(mensaje.createdAt).toLocaleString('es-AR')}
          </div>
        </div>
        <div className="p-3 text-sm whitespace-pre-wrap text-ml-ink">
          {renderConMenciones(mensaje.contenido, agentesMap)}
        </div>
      </div>
    )
  }

  // Estilo especial para ascensos
  if (mensaje.tipo === 'ascenso') {
    return (
      <div className="bg-gradient-to-br from-amber-100 to-yellow-100 border border-amber-300 rounded-xl p-3 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 mb-1">
          🎖️ ASCENSO
        </div>
        <div className="text-sm text-ml-ink">
          {renderConMenciones(mensaje.contenido, agentesMap)}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${esAdmin ? 'justify-end' : 'justify-start'} items-end gap-2`}>
      {!esAdmin && agente && (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: agente.color + '30' }}
        >
          {agente.avatar}
        </div>
      )}
      <div className={`max-w-[78%] ${esAdmin ? 'items-end' : 'items-start'} flex flex-col`}>
        {!esAdmin && agente && (
          <div className="text-[11px] text-ml-muted mb-0.5 px-2">
            <span className="font-semibold" style={{ color: agente.color }}>{agente.nombre}</span>
            <span className="text-ml-muted"> · {agente.titulo}</span>
          </div>
        )}
        <div
          className={`px-3 py-2 rounded-2xl text-sm ${
            esAdmin
              ? 'bg-ml-blue text-white rounded-br-sm'
              : 'bg-white text-ml-ink rounded-bl-sm border border-ml-line'
          }`}
        >
          {renderConMenciones(mensaje.contenido, agentesMap)}
        </div>
        <div className="text-[10px] text-ml-muted mt-0.5 px-2">
          {tiempoRelativo(mensaje.createdAt)}
        </div>
      </div>
    </div>
  )
}

// ===================== CHAT PRIVADO CON CEO =====================

function ChatPrivadoCEO({
  mensajes,
  agentesMap,
  texto,
  onChange,
  onSend,
  enviando,
  onClose,
  refChat,
  pensando
}: {
  mensajes: MensajeOrg[]
  agentesMap: Map<string, Agente>
  texto: string
  onChange: (v: string) => void
  onSend: () => void
  enviando: boolean
  onClose: () => void
  refChat: React.RefObject<HTMLDivElement>
  pensando: Set<string>
}) {
  // Cerrar con tecla ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose} // click en el fondo cierra
    >
      <div
        className="bg-white rounded-xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-purple-700 text-white px-4 py-3 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
            🎩
          </div>
          <div className="flex-1">
            <div className="font-bold">Diego — CEO de MercadoLocal</div>
            <div className="text-xs opacity-80">Conversación privada · solo vos y él</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar chat"
            className="bg-white/20 hover:bg-white/30 text-white rounded-full w-9 h-9 flex items-center justify-center text-2xl leading-none flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Mensajes */}
        <div ref={refChat} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {mensajes.length === 0 ? (
            <div className="text-center text-ml-muted text-sm py-8">
              Esta es tu sala privada con Diego.
              <br />
              Pedile reportes, dale órdenes estratégicas, recibí su opinión sin filtros.
            </div>
          ) : (
            <>
              {mensajes.map(m => (
                <Burbuja key={m._id} mensaje={m} agentesMap={agentesMap} />
              ))}
              {[...pensando].map(slug => {
                const ag = agentesMap.get(slug)
                if (!ag) return null
                return <Escribiendo key={`p-${slug}`} agente={ag} />
              })}
            </>
          )}
        </div>

        {/* Input */}
        <div className="bg-white border-t border-ml-line p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={texto}
              onChange={e => onChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSend()}
              placeholder="Hablale a Diego..."
              disabled={enviando}
              className="flex-1 px-3 py-2 border border-ml-line rounded-md text-sm focus:ring-2 focus:ring-ml-purple/30 focus:border-blue-500 disabled:opacity-50"
            />
            <button
              onClick={onSend}
              disabled={enviando || !texto.trim()}
              className="mlbtn ml-grad disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              {enviando ? '...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===================== MODAL DETALLE AGENTE =====================

function ModalAgente({ agente, onClose }: { agente: Agente; onClose: () => void }) {
  // Cerrar con tecla ESC (UX estándar de modales)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose} // click fuera = cerrar
    >
      <div
        className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto text-ml-ink relative"
        onClick={e => e.stopPropagation()} // click adentro NO cierra
      >
        {/* Botón cerrar fijo arriba a la derecha, siempre visible (sticky) */}
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 z-10 bg-white/90 hover:bg-white text-ml-ink hover:text-ml-ink rounded-full w-9 h-9 flex items-center justify-center text-2xl leading-none shadow-md"
        >
          ×
        </button>

        {/* Header */}
        <div
          className="px-6 py-4 pr-14 text-white flex items-center gap-4"
          style={{ background: `linear-gradient(135deg, ${agente.color}, ${agente.color}dd)` }}
        >
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-4xl">
            {agente.avatar}
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold">{agente.nombre}</div>
            <div className="text-sm opacity-90">{agente.titulo}</div>
            <div className="flex gap-2 mt-1">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: RANGO_COLOR[agente.rango], color: 'white' }}
              >
                {RANGO_LABEL[agente.rango]}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/20">
                {agente.metricas.xp.toLocaleString('es-AR')} XP
              </span>
            </div>
          </div>
        </div>

        {/* Métricas */}
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-ml-line">
          <MetricaCard label="XP" valor={agente.metricas.xp.toString()} />
          <MetricaCard label="Reputación" valor={`${agente.metricas.reputacion}/100`} />
          <MetricaCard label="Decisiones" valor={agente.metricas.decisionesTotales.toString()} />
          <MetricaCard label="Ahorro" valor={`$${agente.metricas.ahorroGenerado.toLocaleString('es-AR')}`} />
          <MetricaCard label="Salario" valor={`$${agente.salarioARS.toLocaleString('es-AR')}`} />
          <MetricaCard label="Acertadas" valor={agente.metricas.decisionesAcertadas.toString()} />
          <MetricaCard label="Revocadas" valor={agente.metricas.decisionesRevocadas.toString()} />
          <MetricaCard label="Menciones" valor={agente.metricas.mencionesRecibidas.toString()} />
        </div>

        {/* Manifiesto */}
        <div className="p-6 space-y-4">
          <section>
            <h3 className="font-bold text-ml-ink mb-2">Manifiesto</h3>
            <p className="text-sm text-ml-ink whitespace-pre-wrap leading-relaxed">{agente.manifiesto}</p>
          </section>

          {agente.trasfondo && (
            <section>
              <h3 className="font-bold text-ml-ink mb-2">Trasfondo</h3>
              <p className="text-sm text-ml-ink leading-relaxed">{agente.trasfondo}</p>
            </section>
          )}

          <section>
            <h3 className="font-bold text-ml-ink mb-2">Personalidad</h3>
            <p className="text-sm text-ml-ink mb-2">{agente.personalidad.descripcion}</p>

            {agente.personalidad.muletillas.length > 0 && (
              <div className="mt-2">
                <div className="text-xs font-semibold text-ml-soft uppercase mb-1">Muletillas</div>
                <div className="flex flex-wrap gap-1">
                  {agente.personalidad.muletillas.map((m, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-ml-ink px-2 py-1 rounded-full italic">
                      "{m}"
                    </span>
                  ))}
                </div>
              </div>
            )}

            {agente.personalidad.fortalezas.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-green-700 uppercase mb-1">Fortalezas</div>
                <ul className="text-sm text-ml-ink list-disc list-inside space-y-0.5">
                  {agente.personalidad.fortalezas.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            )}

            {agente.personalidad.debilidades.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-orange-700 uppercase mb-1">A mejorar</div>
                <ul className="text-sm text-ml-ink list-disc list-inside space-y-0.5">
                  {agente.personalidad.debilidades.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function MetricaCard({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className="text-[10px] text-ml-muted uppercase tracking-wide">{label}</div>
      <div className="font-bold text-ml-ink text-sm mt-0.5">{valor}</div>
    </div>
  )
}

// ===================== ESTUDIO CREATIVO =====================

interface CapaScore {
  score: number
  problemas: string[]
  porque: string
}

interface PromptCreativo {
  _id: string
  caso: string
  ciudadSlug: string
  titulo: string
  prompt: string
  escena: string
  armado: string
  movimiento: string
  negativo: string
  scorecard: {
    marca: CapaScore
    localia: CapaScore
    funcion: CapaScore
    promedio: number
  }
  iteraciones: number
  feedback: { usado: boolean; funciono: boolean | null; nota: string }
}

interface CasoCreativo { clave: string; descripcion: string }

const CASO_ICONO: Record<string, string> = {
  awareness: '📣', usados: '♻️', envio: '🛵', confianza: '🛡️',
  comprar_local: '🏪', sumar_comercio: '🤝', tile_categoria: '🏷️', empty_state: '🫙'
}

const ESFUERZOS: { id: string; label: string; sub: string }[] = [
  { id: 'rapido', label: 'Rápido', sub: '3 variantes · 1 refine' },
  { id: 'normal', label: 'Normal', sub: '4 variantes · 2 refines' },
  { id: 'alto', label: 'Máximo', sub: '5 variantes · 2 refines · para la pauta' }
]

function colorScore(n: number): string {
  if (n >= 8) return '#16a34a'   // verde
  if (n >= 6) return '#d97706'   // ámbar
  return '#dc2626'               // rojo
}

function ModalEstudioCreativo({
  agentesMap,
  onClose
}: {
  agentesMap: Map<string, Agente>
  onClose: () => void
}) {
  const toast = useToast()
  const [casos, setCasos] = useState<CasoCreativo[]>([])
  const [caso, setCaso] = useState<string>('usados')
  const [esfuerzo, setEsfuerzo] = useState<string>('normal')
  const [brief, setBrief] = useState('')
  const [generando, setGenerando] = useState(false)
  const [resultado, setResultado] = useState<{ aprobados: PromptCreativo[]; descripcionCaso: string; meta: any } | null>(null)

  const valentina = agentesMap.get('valentina_cgo')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !generando) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, generando])

  useEffect(() => {
    api.get('/cerebro/creativa/casos')
      .then(({ data }) => { if (Array.isArray(data)) setCasos(data) })
      .catch(() => {})
  }, [])

  const generar = async () => {
    setGenerando(true)
    setResultado(null)
    try {
      const { data } = await api.post('/cerebro/creativa/generar', { caso, esfuerzo, brief: brief.trim() || undefined })
      setResultado({ aprobados: data.aprobados || [], descripcionCaso: data.descripcionCaso, meta: data.meta })
      toast.exito(`${(data.aprobados || []).length} prompts listos`)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'No se pudo generar el set')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => !generando && onClose()}>
      <div
        className="bg-white rounded-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto text-ml-ink relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => !generando && onClose()}
          aria-label="Cerrar"
          className="absolute top-3 right-3 z-10 bg-white/90 hover:bg-white rounded-full w-9 h-9 flex items-center justify-center text-2xl leading-none shadow-md disabled:opacity-40"
          disabled={generando}
        >
          ×
        </button>

        {/* Header */}
        <div className="px-6 py-4 pr-14 text-white bg-gradient-to-r from-blue-700 to-purple-700 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-3xl">
            {valentina?.avatar || '🎨'}
          </div>
          <div>
            <div className="text-xl font-bold">Estudio Creativo</div>
            <div className="text-sm opacity-90">
              {valentina?.nombre || 'Valentina'} genera · Mati y Diego verifican en 3 capas · con datos reales de la app
            </div>
          </div>
        </div>

        {/* Controles */}
        <div className="p-6 space-y-5 border-b border-ml-line">
          {/* Caso / función */}
          <div>
            <div className="text-xs font-semibold text-ml-soft uppercase mb-2">¿Qué función tiene que cumplir la pieza?</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {casos.map(c => (
                <button
                  key={c.clave}
                  onClick={() => setCaso(c.clave)}
                  className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                    caso === c.clave
                      ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-300'
                      : 'border-ml-line hover:border-blue-300'
                  }`}
                  title={c.descripcion}
                >
                  <div className="font-semibold flex items-center gap-1">
                    <span>{CASO_ICONO[c.clave] || '✨'}</span>
                    {c.clave}
                  </div>
                  <div className="text-[11px] text-ml-muted line-clamp-2">{c.descripcion}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Esfuerzo + brief */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-ml-soft uppercase mb-2">Esfuerzo</div>
              <div className="flex flex-col gap-2">
                {ESFUERZOS.map(e => (
                  <button
                    key={e.id}
                    onClick={() => setEsfuerzo(e.id)}
                    className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                      esfuerzo === e.id ? 'border-purple-600 bg-purple-50 ring-1 ring-purple-300' : 'border-ml-line hover:border-purple-300'
                    }`}
                  >
                    <div className="font-semibold">{e.label}</div>
                    <div className="text-[11px] text-ml-muted">{e.sub}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col">
              <div className="text-xs font-semibold text-ml-soft uppercase mb-2">Indicación extra (opcional)</div>
              <textarea
                value={brief}
                onChange={e => setBrief(e.target.value)}
                placeholder="Ej: enfocá en heladeras usadas para el Día del Padre, tono cálido de domingo..."
                className="flex-1 min-h-[120px] px-3 py-2 border border-ml-line rounded-lg text-sm resize-none focus:ring-2 focus:ring-ml-purple/30 focus:border-blue-500"
              />
            </div>
          </div>

          <button
            onClick={generar}
            disabled={generando || !caso}
            className="w-full mlbtn ml-grad text-white py-3 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generando ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Generando y verificando (puede tardar ~30-60s)...
              </>
            ) : (
              <>🎬 Generar set creativo</>
            )}
          </button>
          {generando && (
            <p className="text-[11px] text-ml-muted text-center -mt-2">
              Valentina genera variantes → Mati y Diego las puntúan en 3 capas → se refinan las flojas → sobreviven las que pasan el torneo.
            </p>
          )}
        </div>

        {/* Resultados */}
        {resultado && (
          <div className="p-6 space-y-4">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <h3 className="font-bold text-ml-ink">
                {resultado.aprobados.length} prompts · {resultado.descripcionCaso}
              </h3>
              {resultado.meta && (
                <span className="text-[11px] text-ml-muted">
                  {resultado.meta.generadas} generadas · {resultado.meta.aprobadosEstrictos} pasaron el umbral (≥{resultado.meta.umbral}) · {Math.round((resultado.meta.duracionMs || 0) / 1000)}s
                </span>
              )}
            </div>
            {resultado.aprobados.length === 0 && (
              <p className="text-sm text-ml-muted">No se aprobó ninguna pieza. Probá con más esfuerzo o ajustá la indicación.</p>
            )}
            {resultado.aprobados.map(p => (
              <TarjetaPrompt key={p._id} prompt={p} toast={toast} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TarjetaPrompt({ prompt, toast }: { prompt: PromptCreativo; toast: ReturnType<typeof useToast> }) {
  const [verPorque, setVerPorque] = useState(false)
  const [fb, setFb] = useState(prompt.feedback)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(prompt.prompt)
      toast.exito('Prompt copiado — pegalo en nano banana')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const marcar = async (campo: 'usado' | 'funciono') => {
    try {
      const body = campo === 'usado' ? { usado: true } : { funciono: true }
      const { data } = await api.post(`/cerebro/creativa/feedback/${prompt._id}`, body)
      setFb(data.prompt.feedback)
      toast.exito(campo === 'usado' ? 'Marcado como usado' : '¡Marcado como ganador! El motor aprende de esto')
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'No se pudo guardar el feedback')
    }
  }

  const sc = prompt.scorecard
  const capas = [
    { k: 'Marca', d: sc.marca },
    { k: 'Localía/Técnica', d: sc.localia },
    { k: 'Función', d: sc.funcion }
  ]

  return (
    <div className="border border-ml-line rounded-xl overflow-hidden">
      {/* Header de la tarjeta */}
      <div className="px-4 py-3 bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
        <div className="font-semibold text-ml-ink flex items-center gap-2">
          {prompt.titulo}
          {prompt.iteraciones > 0 && (
            <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
              {prompt.iteraciones} refine{prompt.iteraciones > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {capas.map(c => (
            <span key={c.k} className="text-[11px] flex items-center gap-1" title={c.k}>
              <span className="text-ml-muted">{c.k}</span>
              <span className="font-bold px-1.5 py-0.5 rounded text-white" style={{ background: colorScore(c.d.score) }}>
                {c.d.score}
              </span>
            </span>
          ))}
          <span className="text-[11px] text-ml-muted">prom.</span>
          <span className="font-bold text-sm" style={{ color: colorScore(sc.promedio) }}>{sc.promedio}</span>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="p-4 space-y-3">
        <pre className="text-xs whitespace-pre-wrap bg-gray-900 text-gray-100 p-3 rounded-lg max-h-56 overflow-y-auto font-mono leading-relaxed">
          {prompt.prompt}
        </pre>

        {(prompt.escena || prompt.armado) && (
          <div className="grid md:grid-cols-2 gap-3 text-xs">
            {prompt.escena && (
              <div><span className="font-semibold text-ml-soft uppercase text-[10px]">Escena</span><p className="text-ml-ink mt-0.5">{prompt.escena}</p></div>
            )}
            {prompt.armado && (
              <div><span className="font-semibold text-ml-soft uppercase text-[10px]">Armado (logo + copy)</span><p className="text-ml-ink mt-0.5">{prompt.armado}</p></div>
            )}
          </div>
        )}

        {/* Por qué (razonamiento de los críticos) */}
        <button onClick={() => setVerPorque(v => !v)} className="text-xs text-ml-blue font-medium hover:underline">
          {verPorque ? '▾ Ocultar el porqué de los críticos' : '▸ Ver el porqué de los críticos'}
        </button>
        {verPorque && (
          <div className="space-y-2 bg-blue-50/50 rounded-lg p-3">
            {capas.map(c => (
              <div key={c.k} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold px-1.5 py-0.5 rounded text-white text-[10px]" style={{ background: colorScore(c.d.score) }}>{c.d.score}</span>
                  <span className="font-semibold text-ml-ink">{c.k}</span>
                </div>
                {c.d.porque && <p className="text-ml-soft mt-0.5 ml-1">{c.d.porque}</p>}
                {c.d.problemas?.length > 0 && (
                  <ul className="list-disc list-inside text-orange-700 mt-0.5 ml-1">
                    {c.d.problemas.map((pr, i) => <li key={i}>{pr}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <button onClick={copiar} className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-md font-medium hover:bg-gray-800">
            📋 Copiar prompt
          </button>
          <button
            onClick={() => marcar('usado')}
            className={`text-xs px-3 py-1.5 rounded-md font-medium border ${fb.usado ? 'bg-blue-600 text-white border-blue-600' : 'border-ml-line text-ml-ink hover:bg-gray-50'}`}
          >
            {fb.usado ? '✅ Lo usé' : 'Marcar como usado'}
          </button>
          <button
            onClick={() => marcar('funciono')}
            className={`text-xs px-3 py-1.5 rounded-md font-medium border ${fb.funciono ? 'bg-green-600 text-white border-green-600' : 'border-ml-line text-ml-ink hover:bg-gray-50'}`}
          >
            {fb.funciono ? '🚀 Funcionó' : 'Funcionó en la pauta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ===================== INDICADOR "ESCRIBIENDO..." =====================

function Escribiendo({ agente }: { agente: Agente }) {
  return (
    <div className="flex items-end gap-2">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-lg flex-shrink-0"
        style={{ background: agente.color + '30' }}
      >
        {agente.avatar}
      </div>
      <div className="flex flex-col items-start">
        <div className="text-[11px] text-ml-muted mb-0.5 px-2">
          <span className="font-semibold" style={{ color: agente.color }}>{agente.nombre}</span>
          <span className="text-ml-muted"> está escribiendo</span>
        </div>
        <div className="bg-white border border-ml-line rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
        </div>
      </div>
    </div>
  )
}
