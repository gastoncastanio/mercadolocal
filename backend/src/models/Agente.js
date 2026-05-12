import mongoose from 'mongoose'

/**
 * AGENTE — un miembro del equipo IA de MercadoLocal.
 *
 * No es un usuario humano: es un personaje IA con personalidad, rango,
 * historia y métricas reales. Cada agente vive su propia carrera dentro
 * de la organización, gana XP por decisiones acertadas, y puede ascender
 * (o bajar) según sus resultados.
 *
 * La idea es que el equipo IA tenga la sinergia que los equipos humanos
 * pocas veces logran: especialización profunda, cero ego, honestidad
 * brutal y competencia sana basada solo en datos.
 *
 * RANGOS (en orden ascendente):
 *   - trainee      → recién creado, todavía aprendiendo
 *   - junior       → autónomo en tareas simples
 *   - senior       → maneja casos complejos solo
 *   - manager      → puede coordinar a otros agentes
 *   - director     → toma decisiones estratégicas en su área
 *   - c_level      → reporta directo al fundador
 */

const ASCENSO = {
  trainee: 100,    // XP para pasar a junior
  junior: 500,
  senior: 2000,
  manager: 5000,
  director: 15000,
  c_level: Infinity // tope
}

const agenteSchema = new mongoose.Schema({
  // Identificador único legible (ej: "diego_ceo", "sofia_cmo")
  slug: {
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true,
    trim: true
  },
  // Nombre del personaje (Diego, Sofía, etc.)
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  // Título oficial (CEO, CMO, CTO, CFO, CLO, CGO)
  titulo: {
    type: String,
    required: true,
    trim: true
  },
  // Área funcional
  area: {
    type: String,
    enum: ['ejecutivo', 'moderacion', 'soporte', 'finanzas', 'legal', 'growth', 'producto', 'datos'],
    required: true,
    index: true
  },
  // Rango actual en la organización
  rango: {
    type: String,
    enum: ['trainee', 'junior', 'senior', 'manager', 'director', 'c_level'],
    default: 'junior',
    index: true
  },
  // Si reporta a otro agente (jerarquía)
  reportaA: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agente',
    default: null
  },
  // ===== Personalidad =====
  // Cómo habla, qué le importa, sus muletillas. Va al system prompt
  // cuando el agente conversa, lo que le da personalidad distintiva.
  personalidad: {
    descripcion: { type: String, required: true }, // 2-3 oraciones
    tono: { type: String, default: 'profesional' }, // formal, informal, técnico
    muletillas: { type: [String], default: [] },    // frases que repite
    fortalezas: { type: [String], default: [] },     // qué hace mejor que nadie
    debilidades: { type: [String], default: [] }     // áreas a mejorar (lo humaniza)
  },
  // Manifiesto personal — lo que defiende este agente en toda decisión
  manifiesto: {
    type: String,
    required: true,
    maxlength: 1500
  },
  // Trasfondo / historia del agente (de dónde viene su expertise)
  trasfondo: {
    type: String,
    default: '',
    maxlength: 2000
  },
  // ===== Métricas de desempeño =====
  metricas: {
    xp: { type: Number, default: 0, min: 0, index: true },
    reputacion: { type: Number, default: 50, min: 0, max: 100 }, // 0-100
    decisionesTotales: { type: Number, default: 0 },
    decisionesAcertadas: { type: Number, default: 0 },
    decisionesRevocadas: { type: Number, default: 0 }, // las que admin desautorizó
    ahorroGenerado: { type: Number, default: 0 },       // pesos ARS que ahorró/generó
    mencionesRecibidas: { type: Number, default: 0 },   // cuántas veces lo citaron otros agentes
    propuestasAceptadas: { type: Number, default: 0 }
  },
  // ===== Salario simulado (para el ego del agente) =====
  // Es ficticio, solo se usa en conversaciones cuando piden aumento.
  salarioARS: {
    type: Number,
    default: 200000
  },
  // ===== Estado del agente =====
  activo: {
    type: Boolean,
    default: true
  },
  // Si está en modo "vacaciones" o "suspendido" (admin lo apagó)
  estado: {
    type: String,
    enum: ['activo', 'vacaciones', 'suspendido', 'despedido'],
    default: 'activo'
  },
  // Color hexadecimal para distinguirlo en el chat (estilo WhatsApp)
  color: {
    type: String,
    default: '#3b82f6'
  },
  // Emoji que lo representa visualmente
  avatar: {
    type: String,
    default: '👤'
  },
  // ===== Historial de ascensos =====
  historialAscensos: [{
    rangoAnterior: String,
    rangoNuevo: String,
    fecha: Date,
    motivo: String,
    decisorSlug: String // qué agente lo ascendió (en general, el CEO)
  }]
}, {
  timestamps: true
})

// Devuelve cuánto XP necesita para el siguiente rango
agenteSchema.methods.xpParaAscenso = function () {
  return ASCENSO[this.rango] - this.metricas.xp
}

// Calcula si está listo para ascender
agenteSchema.methods.listoParaAscenso = function () {
  if (this.rango === 'c_level') return false
  return this.metricas.xp >= ASCENSO[this.rango] && this.metricas.reputacion >= 60
}

// Suma XP y registra si pasó al próximo nivel
agenteSchema.methods.sumarXP = async function (puntos, motivo = '') {
  this.metricas.xp += puntos
  this.metricas.decisionesTotales += 1
  if (puntos > 0) this.metricas.decisionesAcertadas += 1
  await this.save()
  return this.listoParaAscenso()
}

// Ascender al siguiente rango (solo CEO o sistema puede hacerlo)
agenteSchema.methods.ascender = async function (motivo = '', decisorSlug = 'sistema') {
  const ordenRangos = ['trainee', 'junior', 'senior', 'manager', 'director', 'c_level']
  const idx = ordenRangos.indexOf(this.rango)
  if (idx === -1 || idx === ordenRangos.length - 1) return false

  const rangoNuevo = ordenRangos[idx + 1]
  this.historialAscensos.push({
    rangoAnterior: this.rango,
    rangoNuevo,
    fecha: new Date(),
    motivo,
    decisorSlug
  })
  this.rango = rangoNuevo
  // Aumento simulado de salario (+ 35% por ascenso)
  this.salarioARS = Math.round(this.salarioARS * 1.35)
  await this.save()
  return true
}

// Índice compuesto: agentes activos por rango (para listado de "top performers")
agenteSchema.index({ activo: 1, rango: 1, 'metricas.xp': -1 })
// Agentes por área
agenteSchema.index({ area: 1, activo: 1 })

const Agente = mongoose.model('Agente', agenteSchema)

export default Agente
export { ASCENSO }
