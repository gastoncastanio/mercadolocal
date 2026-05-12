import mongoose from 'mongoose'

/**
 * MENSAJE ORGANIZACIÓN — un mensaje en cualquiera de los canales
 * de la organización IA de MercadoLocal.
 *
 * Canales soportados:
 *   - "general":      sala común. Acá hablan todos los agentes + el admin.
 *   - "privado_ceo":  chat exclusivo entre el admin y el CEO (Diego).
 *   - "reporte":      mensajes auto-generados (reportes diarios del CEO, etc.).
 *   - "ascensos":     anuncios de promociones, despidos, etc.
 *
 * Quien manda el mensaje puede ser:
 *   - un agente IA  (autorSlug = "diego_ceo", "sofia_cmo", etc.)
 *   - el admin humano (autorSlug = "admin")
 *   - el sistema (autorSlug = "sistema", para eventos automáticos)
 *
 * Mensajes pueden contener menciones a otros agentes ("@sofia_cmo")
 * y pueden ser respuesta a otro mensaje (replyA).
 */

const mensajeOrgSchema = new mongoose.Schema({
  // Canal donde se envió el mensaje
  canal: {
    type: String,
    enum: ['general', 'privado_ceo', 'reporte', 'ascensos'],
    required: true,
    index: true
  },
  // Quién lo envió. Si es un agente, este slug coincide con Agente.slug.
  // Si es "admin" → fue el humano fundador. Si es "sistema" → automatizado.
  autorSlug: {
    type: String,
    required: true,
    index: true
  },
  // Tipo de autor (para que el frontend renderice distinto)
  autorTipo: {
    type: String,
    enum: ['agente', 'admin', 'sistema'],
    required: true
  },
  // Cuerpo del mensaje. Puede contener menciones (@slug) y markdown básico.
  contenido: {
    type: String,
    required: true,
    maxlength: 8000
  },
  // Agentes mencionados (extraídos del contenido al guardar)
  menciones: {
    type: [String],
    default: [],
    index: true
  },
  // Si es respuesta a otro mensaje
  replyA: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MensajeOrganizacion',
    default: null
  },
  // Categoría del mensaje (para colorear/filtrar en UI)
  tipo: {
    type: String,
    enum: [
      'conversacion',      // charla normal
      'reporte_diario',    // reporte CEO
      'alerta',            // algo crítico (ej: fraude detectado)
      'propuesta',         // idea para mejorar el marketplace
      'consulta',          // un agente pide opinión a otro
      'decision',          // alguien resolvió algo
      'ascenso',           // promoción
      'despido',           // baja del equipo
      'admision'           // alta al equipo
    ],
    default: 'conversacion',
    index: true
  },
  // Datos opcionales (ej: link a un producto moderado, métricas, etc.)
  contexto: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  // Tokens usados (si el mensaje vino de una llamada IA)
  tokens: {
    entrada: { type: Number, default: 0 },
    salida: { type: Number, default: 0 },
    entradaCached: { type: Number, default: 0 }
  },
  // Reacciones de otros agentes (👍, 💡, 🔥, ⚠️)
  reacciones: [{
    agenteSlug: String,
    emoji: String,
    fecha: { type: Date, default: Date.now }
  }],
  // Si fue leído por el admin (relevante para chat privado y alertas)
  leidoPorAdmin: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true
})

// Pre-save: extraer menciones del contenido automáticamente
mensajeOrgSchema.pre('save', function (next) {
  if (this.isModified('contenido')) {
    const matches = this.contenido.match(/@([a-z][a-z0-9_]+)/gi) || []
    this.menciones = [...new Set(matches.map(m => m.slice(1).toLowerCase()))]
  }
  next()
})

// Índice compuesto: feed cronológico por canal (la query más común)
mensajeOrgSchema.index({ canal: 1, createdAt: -1 })
// No leídos por admin (badge en la UI)
mensajeOrgSchema.index({ canal: 1, leidoPorAdmin: 1, createdAt: -1 })
// Conversaciones de un agente específico
mensajeOrgSchema.index({ autorSlug: 1, createdAt: -1 })

const MensajeOrganizacion = mongoose.model('MensajeOrganizacion', mensajeOrgSchema)

export default MensajeOrganizacion
