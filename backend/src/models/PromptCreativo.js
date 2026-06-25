import mongoose from 'mongoose'

/**
 * PROMPT CREATIVO — el ENTREGABLE del Estudio Creativo del cerebro.
 *
 * Cada documento es un prompt para nano banana (Gemini image/video) que ya
 * pasó por todo el pipeline: lo generó Valentina (CGO), lo verificaron 3
 * críticos independientes (Marca, Localía&Técnica, Función) y sobrevivió al
 * torneo. Guarda el prompt final + su scorecard + el "porqué" de cada crítico,
 * para que el fundador entienda por qué la pieza es buena, no solo que existe.
 *
 * El feedback ("funcionó" / "lo usé") cierra el loop de aprendizaje (M1/M3):
 * las piezas que funcionaron se vuelven referencia para las próximas.
 */

const subScoreSchema = new mongoose.Schema({
  score: { type: Number, min: 0, max: 10, default: 0 },
  problemas: { type: [String], default: [] },
  porque: { type: String, default: '' }
}, { _id: false })

const promptCreativoSchema = new mongoose.Schema({
  // Función del embudo que cumple (clave de CASOS en adnMarca.js)
  caso: { type: String, required: true, index: true },
  // Ciudad para la que se ancló (slug de CIUDADES en adnMarca.js)
  ciudadSlug: { type: String, default: 'lobos', index: true },
  // Título corto y humano de lo que es la pieza
  titulo: { type: String, required: true, maxlength: 160 },
  // El prompt completo, listo para pegar en nano banana
  prompt: { type: String, required: true, maxlength: 6000 },
  // Desglose (para que el fundador entienda la pieza y pueda editarla)
  escena: { type: String, default: '' },     // qué genera la IA
  armado: { type: String, default: '' },      // cómo se monta el logo/texto encima
  movimiento: { type: String, default: '' },  // sugerencia de movimiento (para video)
  negativo: { type: String, default: '' },    // bloque EVITAR aplicado
  // Scorecard de las 3 capas de verificación
  scorecard: {
    marca: { type: subScoreSchema, default: () => ({}) },
    localia: { type: subScoreSchema, default: () => ({}) },
    funcion: { type: subScoreSchema, default: () => ({}) },
    promedio: { type: Number, min: 0, max: 10, default: 0, index: true }
  },
  // Cuántas rondas de refinamiento necesitó (0 = pasó a la primera)
  iteraciones: { type: Number, default: 0 },
  // Versión del ADN de marca con que se generó (trazabilidad)
  versionAdn: { type: String, default: '' },
  // Estado en el torneo
  estado: {
    type: String,
    enum: ['aprobado', 'descartado'],
    default: 'aprobado',
    index: true
  },
  generadoPor: { type: String, default: 'valentina_cgo' },
  // Cierre del loop: el fundador marca si lo usó y si funcionó en la pauta
  feedback: {
    usado: { type: Boolean, default: false },
    funciono: { type: Boolean, default: null },
    nota: { type: String, default: '' },
    fecha: { type: Date, default: null }
  }
}, { timestamps: true })

// Feed: últimos prompts aprobados por caso
promptCreativoSchema.index({ caso: 1, estado: 1, createdAt: -1 })
// Piezas ganadoras (para el banco de referencias / M1)
promptCreativoSchema.index({ 'feedback.funciono': 1, 'scorecard.promedio': -1 })

const PromptCreativo = mongoose.model('PromptCreativo', promptCreativoSchema)

export default PromptCreativo
