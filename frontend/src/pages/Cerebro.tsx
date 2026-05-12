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
      if (canal === 'privado_ceo') setMensajesPrivado(data)
      else setMensajes(data)
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

  // Marca un canal como leído cuando lo abro
  const marcarLeido = useCallback(async (canal: Canal) => {
    try {
      await api.post(`/cerebro/marcar-leido/${canal}`)
      setNoLeidos(prev => ({ ...prev, [canal]: 0 }))
    } catch {}
  }, [])

  // Polling cada 5s para mensajes y no leídos
  useEffect(() => {
    cargarAgentes()
    cargarMensajes(canalActivo)
    cargarNoLeidos()

    const t = setInterval(() => {
      cargarMensajes(canalActivo)
      if (chatPrivadoAbierto) cargarMensajes('privado_ceo')
      cargarNoLeidos()
    }, 5000)
    return () => clearInterval(t)
  }, [canalActivo, chatPrivadoAbierto, cargarAgentes, cargarMensajes, cargarNoLeidos])

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

  // ===== Enviar mensaje =====
  async function enviarMensaje() {
    const texto = textoInput.trim()
    if (!texto || enviando) return

    setEnviando(true)
    setTextoInput('')

    // Optimistic UI: agregamos el mensaje del admin ya
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

    try {
      await api.post(`/cerebro/mensajes/${canalActivo}`, { contenido: texto })
      await cargarMensajes(canalActivo)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'No se pudo enviar el mensaje')
      // Volvemos a poner el texto en el input
      setTextoInput(texto)
    } finally {
      setEnviando(false)
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

    try {
      await api.post('/cerebro/mensajes/privado_ceo', { contenido: texto })
      await cargarMensajes('privado_ceo')
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'No se pudo enviar el mensaje')
      setTextoPrivado(texto)
    } finally {
      setEnviandoPrivado(false)
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
    <div className="fixed inset-0 top-16 bg-gray-900 text-gray-100 flex overflow-hidden">
      {/* CANVAS CENTRAL */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              🧠 MercadoLocal Brain
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {agentes.filter(a => a.activo).length} agentes activos · Equipo IA
            </p>
          </div>
          <button
            onClick={generarReporteAhora}
            className="text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md font-medium"
          >
            Generar reporte ahora
          </button>
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
      <div className="w-[420px] bg-gray-50 text-gray-900 border-l border-gray-700 flex flex-col flex-shrink-0">
        {/* Tabs de canales */}
        <div className="bg-white border-b border-gray-200 flex">
          {CANALES.map(c => (
            <button
              key={c.id}
              onClick={() => setCanalActivo(c.id)}
              className={`flex-1 px-3 py-3 text-sm font-medium border-b-2 transition-colors relative ${
                canalActivo === c.id
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
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
            <div className="text-center text-gray-400 text-sm py-8">
              Sin mensajes todavía.
              <br />
              {canalActivo === 'general' && 'Mandá algo para arrancar la conversación.'}
              {canalActivo === 'reporte' && 'Esperando el primer reporte diario del CEO.'}
              {canalActivo === 'ascensos' && 'Los ascensos aparecen acá cuando el equipo crece.'}
            </div>
          ) : (
            mensajes.map(m => (
              <Burbuja key={m._id} mensaje={m} agentesMap={agentesMap} />
            ))
          )}
        </div>

        {/* Input (solo en general) */}
        {canalActivo === 'general' && (
          <div className="bg-white border-t border-gray-200 p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={textoInput}
                onChange={e => setTextoInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && enviarMensaje()}
                placeholder="Hablale al equipo... usá @sofia_cmo o @tomas_cto"
                disabled={enviando}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              />
              <button
                onClick={enviarMensaje}
                disabled={enviando || !textoInput.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                {enviando ? '...' : 'Enviar'}
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5">
              Los agentes responden con su personalidad. Mencionalos con @slug para que respondan ellos.
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
        />
      )}

      {/* MODAL: Detalle de agente */}
      {agenteSeleccionado && (
        <ModalAgente agente={agenteSeleccionado} onClose={() => setAgenteSeleccionado(null)} />
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
      <div className="absolute bottom-4 left-4 bg-gray-800/80 backdrop-blur-sm rounded-lg p-3 text-xs text-gray-300">
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
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
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
        <span className="inline-block bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
          {mensaje.contenido}
        </span>
      </div>
    )
  }

  // Estilo especial para reportes
  if (mensaje.tipo === 'reporte_diario') {
    return (
      <div className="bg-white border-2 border-blue-200 rounded-xl shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-2 text-white">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-lg">🎩</span>
            <span>Reporte diario de Diego</span>
          </div>
          <div className="text-[10px] opacity-90">
            {new Date(mensaje.createdAt).toLocaleString('es-AR')}
          </div>
        </div>
        <div className="p-3 text-sm whitespace-pre-wrap text-gray-800">
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
        <div className="text-sm text-gray-800">
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
          <div className="text-[11px] text-gray-500 mb-0.5 px-2">
            <span className="font-semibold" style={{ color: agente.color }}>{agente.nombre}</span>
            <span className="text-gray-400"> · {agente.titulo}</span>
          </div>
        )}
        <div
          className={`px-3 py-2 rounded-2xl text-sm ${
            esAdmin
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-white text-gray-800 rounded-bl-sm border border-gray-200'
          }`}
        >
          {renderConMenciones(mensaje.contenido, agentesMap)}
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5 px-2">
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
  refChat
}: {
  mensajes: MensajeOrg[]
  agentesMap: Map<string, Agente>
  texto: string
  onChange: (v: string) => void
  onSend: () => void
  enviando: boolean
  onClose: () => void
  refChat: React.RefObject<HTMLDivElement>
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden shadow-2xl">
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
            className="text-white/80 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Mensajes */}
        <div ref={refChat} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {mensajes.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-8">
              Esta es tu sala privada con Diego.
              <br />
              Pedile reportes, dale órdenes estratégicas, recibí su opinión sin filtros.
            </div>
          ) : (
            mensajes.map(m => (
              <Burbuja key={m._id} mensaje={m} agentesMap={agentesMap} />
            ))
          )}
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-200 p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={texto}
              onChange={e => onChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSend()}
              placeholder="Hablale a Diego..."
              disabled={enviando}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
            />
            <button
              onClick={onSend}
              disabled={enviando || !texto.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium"
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
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto text-gray-900">
        {/* Header */}
        <div
          className="px-6 py-4 text-white flex items-center gap-4"
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
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">×</button>
        </div>

        {/* Métricas */}
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-gray-200">
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
            <h3 className="font-bold text-gray-900 mb-2">Manifiesto</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{agente.manifiesto}</p>
          </section>

          {agente.trasfondo && (
            <section>
              <h3 className="font-bold text-gray-900 mb-2">Trasfondo</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{agente.trasfondo}</p>
            </section>
          )}

          <section>
            <h3 className="font-bold text-gray-900 mb-2">Personalidad</h3>
            <p className="text-sm text-gray-700 mb-2">{agente.personalidad.descripcion}</p>

            {agente.personalidad.muletillas.length > 0 && (
              <div className="mt-2">
                <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Muletillas</div>
                <div className="flex flex-wrap gap-1">
                  {agente.personalidad.muletillas.map((m, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full italic">
                      "{m}"
                    </span>
                  ))}
                </div>
              </div>
            )}

            {agente.personalidad.fortalezas.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-green-700 uppercase mb-1">Fortalezas</div>
                <ul className="text-sm text-gray-700 list-disc list-inside space-y-0.5">
                  {agente.personalidad.fortalezas.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            )}

            {agente.personalidad.debilidades.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-orange-700 uppercase mb-1">A mejorar</div>
                <ul className="text-sm text-gray-700 list-disc list-inside space-y-0.5">
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
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="font-bold text-gray-900 text-sm mt-0.5">{valor}</div>
    </div>
  )
}
