import mongoose from 'mongoose'

/**
 * MEMORIA PERSISTENTE DEL FUNDADOR.
 *
 * Hechos importantes que Gastón compartió con el equipo IA y que TODOS
 * los agentes deben recordar SIEMPRE, en cada respuesta.
 *
 * Ejemplos:
 *  - "El fundador vive en Lobos, BA"
 *  - "Su empresa principal es Green Garden Lobos (alambrados)"
 *  - "MercadoLocal va a expandirse rubro por rubro, NO categoría por categoría"
 *  - "El fundador prefiere que las respuestas sean breves y directas"
 *
 * Estos hechos se cargan en TODOS los system prompts y se mantienen en
 * la "memoria a largo plazo" del equipo. No expiran. Solo el admin los
 * puede agregar/editar/borrar.
 *
 * Diferencia con MensajeOrganizacion: los mensajes son la conversación
 * (memoria corta); esta es la memoria larga que no se pierde nunca.
 */
const memoriaFundadorSchema = new mongoose.Schema({
  // El hecho concreto que hay que recordar
  hecho: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  // Categoría para organizar
  categoria: {
    type: String,
    enum: [
      'identidad',      // quién es el fundador, dónde vive, etc.
      'vision',         // visión a largo plazo del proyecto
      'negocio',        // info del negocio (otras empresas, recursos)
      'preferencia',    // cómo le gusta que respondamos
      'restriccion',    // cosas que NO debemos hacer
      'historico'       // eventos pasados importantes
    ],
    default: 'identidad',
    index: true
  },
  // Importancia: 1-10. Los hechos con alta importancia van primero en el prompt.
  importancia: {
    type: Number,
    default: 5,
    min: 1,
    max: 10
  },
  // Si está activo (se podría "archivar" un hecho sin borrarlo)
  activo: {
    type: Boolean,
    default: true,
    index: true
  },
  // Origen del hecho (de qué conversación salió, opcional)
  origenMsgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MensajeOrganizacion',
    default: null
  },
  // Quién lo creó (slug del agente que lo detectó, o "admin" si lo cargó el fundador)
  creadoPor: {
    type: String,
    default: 'admin'
  }
}, {
  timestamps: true
})

// Índices
memoriaFundadorSchema.index({ activo: 1, importancia: -1 })
memoriaFundadorSchema.index({ categoria: 1, activo: 1 })

const MemoriaFundador = mongoose.model('MemoriaFundador', memoriaFundadorSchema)

export default MemoriaFundador
