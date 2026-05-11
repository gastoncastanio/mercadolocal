/**
 * Ticket de soporte.
 *
 * Cada vez que un usuario abre el chat de soporte, se crea un Ticket.
 * Los mensajes se acumulan dentro (turno usuario ↔ agente IA).
 *
 * Si el AGENTE-SOPORTE no puede resolver, marca el ticket como ESCALADO
 * y aparece en el panel del admin para revisión humana.
 */

import mongoose from 'mongoose'

const mensajeTicketSchema = new mongoose.Schema({
  // 'usuario' = lo escribió el usuario
  // 'agente' = lo escribió la IA
  // 'admin' = lo escribió un admin humano (cuando el ticket fue escalado)
  rol: {
    type: String,
    enum: ['usuario', 'agente', 'admin'],
    required: true
  },
  texto: {
    type: String,
    required: true,
    maxlength: 4000
  },
  fecha: {
    type: Date,
    default: Date.now
  }
}, { _id: false })

const ticketSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  // Clasificación temática del ticket (asignada por la IA en el primer mensaje)
  asunto: {
    type: String,
    enum: ['compra', 'venta', 'pago', 'envio', 'cuenta', 'producto', 'otro'],
    default: 'otro'
  },
  // Resumen corto del problema (generado por la IA tras los primeros mensajes)
  resumen: {
    type: String,
    default: '',
    maxlength: 300
  },
  estado: {
    type: String,
    enum: ['abierto', 'resuelto', 'escalado', 'cerrado'],
    default: 'abierto',
    index: true
  },
  prioridad: {
    type: String,
    enum: ['baja', 'media', 'alta', 'urgente'],
    default: 'media',
    index: true
  },
  resueltoPorIA: {
    type: Boolean,
    default: false
  },
  // Cuándo fue escalado a un humano (si aplica)
  fechaEscalado: {
    type: Date,
    default: null
  },
  // Motivo por el cual la IA escaló (lo dice ella misma)
  motivoEscalado: {
    type: String,
    default: '',
    maxlength: 500
  },
  // Tags para análisis de patrones (ej: ["devolucion", "andreani", "no_llego"])
  tags: {
    type: [String],
    default: []
  },
  // Mensajes de la conversación
  mensajes: {
    type: [mensajeTicketSchema],
    default: []
  },
  // Última actividad (para ordenar tickets)
  ultimaActividad: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
})

// ===== Índices =====
// Tickets del usuario, más recientes primero
ticketSchema.index({ usuarioId: 1, ultimaActividad: -1 })
// Panel admin: tickets escalados / urgentes
ticketSchema.index({ estado: 1, prioridad: 1, ultimaActividad: -1 })
// Estadísticas por asunto
ticketSchema.index({ asunto: 1, createdAt: -1 })

// Actualizar ultimaActividad cuando se modifica
ticketSchema.pre('save', function (next) {
  if (this.isModified('mensajes')) {
    this.ultimaActividad = new Date()
  }
  next()
})

const Ticket = mongoose.model('Ticket', ticketSchema)

export default Ticket
