import mongoose from 'mongoose'

/**
 * Registro de moderaciones del AGENTE-MODERACIÓN.
 *
 * Por cada producto que se publica (o se edita en campos sensibles),
 * el agente IA decide: aprobar / rechazar / pasar a revisión humana.
 *
 * Guardamos TODA decisión (no solo las rechazadas) para:
 * 1. Auditoría: poder revisar qué decidió el agente
 * 2. Mejora del agente: feedback humano si el admin corrige una decisión
 * 3. Estadísticas: ¿cuántos productos rechaza por día? ¿qué categorías?
 * 4. Trazabilidad legal: si vendieron algo prohibido, ¿qué se decidió?
 */
const moderacionSchema = new mongoose.Schema({
  productoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producto',
    required: true,
    index: true
  },
  tiendaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tienda',
    required: true,
    index: true
  },
  // Decisión del agente IA
  decision: {
    type: String,
    enum: ['aprobado', 'rechazado', 'revision'],
    required: true,
    index: true
  },
  // Score de confianza del agente (0-100)
  // - alto + aprobado → publicar sin revisión humana
  // - alto + rechazado → bloqueo automático
  // - medio (40-70) → pasar a revisión humana siempre
  confianza: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  // Motivos en lenguaje natural (lo que se le muestra al vendedor)
  motivos: {
    type: [String],
    default: []
  },
  // Categorías de problemas detectados (para estadísticas)
  // Ej: ['producto_prohibido', 'precio_sospechoso', 'descripcion_pobre',
  //      'imagen_inapropiada', 'contacto_evasion', 'spam']
  banderas: {
    type: [String],
    default: [],
    index: true
  },
  // Snapshot del producto al momento de la moderación (por si después se edita)
  snapshot: {
    nombre: String,
    descripcion: String,
    precio: Number,
    categorias: [String],
    cantidadImagenes: Number,
    marca: String
  },
  // Tokens usados por el agente (para tracking de costos)
  tokens: {
    entrada: { type: Number, default: 0 },
    salida: { type: Number, default: 0 },
    entradaCached: { type: Number, default: 0 }
  },
  // Tiempo que tardó el agente en responder (ms)
  duracionMs: {
    type: Number,
    default: 0
  },
  // Si un admin revisó la decisión del agente
  revisionAdmin: {
    realizada: { type: Boolean, default: false },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
    fecha: Date,
    // Si el admin cambió la decisión del agente
    decisionFinal: { type: String, enum: ['aprobado', 'rechazado', null], default: null },
    comentario: String
  }
}, {
  timestamps: true
})

// Índices compuestos para queries del panel admin
// 1. Productos en revisión, ordenados por fecha
moderacionSchema.index({ decision: 1, createdAt: -1 })
// 2. Productos de una tienda específica (auditoría de un vendedor)
moderacionSchema.index({ tiendaId: 1, createdAt: -1 })
// 3. Decisiones que aún no fueron revisadas por admin
moderacionSchema.index({ 'revisionAdmin.realizada': 1, decision: 1 })

const Moderacion = mongoose.model('Moderacion', moderacionSchema)

export default Moderacion
