import mongoose from 'mongoose'

/**
 * PROPUESTA DEL EQUIPO IA al fundador.
 *
 * Cuando los agentes detectan una oportunidad de mejora basada en
 * DATOS REALES de la base (productos, tickets, moderaciones, métricas),
 * la formalizan como una propuesta estructurada.
 *
 * Las propuestas se acumulan en el panel admin. El fundador las revisa
 * y decide: APROBAR, RECHAZAR, MODIFICAR, POSPONER.
 *
 * Cuando aprueba, queda lista para que Claude (en la próxima sesión)
 * la ejecute como instrucción de desarrollo.
 *
 * REGLA INVIOLABLE: el modelo solo guarda lo que los agentes proponen.
 * Los agentes NUNCA pueden ejecutar la propuesta por sí mismos. Toda
 * acción que afecte código, configuración, finanzas o usuarios requiere
 * autorización explícita del fundador + ejecución del programador
 * (Claude).
 */
const propuestaSchema = new mongoose.Schema({
  // Título corto, accionable (máx 100 chars)
  titulo: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  // El problema detectado (con datos reales que lo respaldan)
  problema: {
    type: String,
    required: true,
    maxlength: 2000
  },
  // Evidencia concreta: IDs de productos, tickets, métricas, casos reales
  // que demuestran que el problema existe (no son intuiciones).
  evidencia: {
    type: [{
      tipo: { type: String, enum: ['producto', 'ticket', 'orden', 'moderacion', 'metrica', 'usuario', 'otro'], default: 'otro' },
      referenciaId: String, // ObjectId como string, o null si es una métrica agregada
      descripcion: String,  // Resumen humano del caso
      datos: mongoose.Schema.Types.Mixed // datos crudos del caso (precio, fecha, etc.)
    }],
    default: []
  },
  // La propuesta concreta: qué cambiar, agregar o quitar
  propuesta: {
    type: String,
    required: true,
    maxlength: 3000
  },
  // Impacto estimado (en datos reales, no opiniones)
  impactoEstimado: {
    type: String,
    default: '',
    maxlength: 1500
  },
  // Riesgos identificados (honestidad sobre el downside)
  riesgos: {
    type: String,
    default: '',
    maxlength: 1500
  },
  // Categoría para filtrar
  categoria: {
    type: String,
    enum: [
      'seguridad',     // anti-fraude, anti-estafa
      'producto',      // mejoras al UX/feature
      'soporte',       // mejoras al servicio al cliente
      'crecimiento',   // adquisición, retención
      'finanzas',      // comisiones, costos, monetización
      'legal',         // cumplimiento normativo
      'operaciones',   // procesos internos
      'tecnica'        // arquitectura, performance
    ],
    default: 'operaciones',
    index: true
  },
  // Prioridad sugerida por el equipo
  prioridad: {
    type: String,
    enum: ['baja', 'media', 'alta', 'urgente'],
    default: 'media',
    index: true
  },
  // Quién propuso (slug del agente)
  proponente: {
    type: String,
    required: true,
    index: true
  },
  // Otros agentes que cosignan la propuesta (la apoyan)
  cosignan: {
    type: [String],
    default: []
  },
  // Estado de la propuesta
  estado: {
    type: String,
    enum: [
      'esperando_admin',  // recién creada, esperando que el fundador la vea
      'en_revision',      // el fundador la marcó como en revisión
      'aprobada',         // fundador OK, esperando ejecución
      'en_ejecucion',     // Claude la está implementando
      'completada',       // ejecutada y verificada
      'rechazada',        // fundador dijo NO
      'pospuesta',        // fundador la deja para más adelante
      'modificada'        // el fundador la editó (se crea una nueva con los cambios)
    ],
    default: 'esperando_admin',
    index: true
  },
  // Comentario del fundador al decidir
  decisionFundador: {
    decidida: { type: Boolean, default: false },
    fecha: Date,
    comentario: { type: String, default: '' }
  },
  // Si fue ejecutada, link al commit/PR
  ejecucion: {
    completada: { type: Boolean, default: false },
    fecha: Date,
    commitHash: String,
    notas: String
  }
}, {
  timestamps: true
})

// Índices compuestos para queries del panel admin
propuestaSchema.index({ estado: 1, prioridad: -1, createdAt: -1 })
propuestaSchema.index({ proponente: 1, createdAt: -1 })
propuestaSchema.index({ categoria: 1, estado: 1 })

const PropuestaEquipo = mongoose.model('PropuestaEquipo', propuestaSchema)

export default PropuestaEquipo
