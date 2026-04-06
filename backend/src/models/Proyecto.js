import mongoose from 'mongoose'

const proyectoSchema = new mongoose.Schema(
  {
    nombreMarca: {
      type: String,
      required: true,
      trim: true,
    },
    descripcion: {
      type: String,
      required: true,
    },
    valores: [String],
    estilo: String,
    parametros: {
      coloresPrimarios: [String],
      coloresSecundarios: [String],
      tipografia: String,
      elementos: [String],
      complejidad: {
        type: String,
        enum: ['simple', 'medio', 'complejo'],
      },
      orientacion: {
        type: String,
        enum: ['horizontal', 'vertical', 'cuadrado'],
      },
    },
    logos: [
      {
        url: String,
        estilo: String,
        parametros: mongoose.Schema.Types.Mixed,
        favorito: { type: Boolean, default: false },
        fechaCreacion: { type: Date, default: Date.now },
      },
    ],
    usuarioId: String,
    fechaCreacion: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

export default mongoose.model('Proyecto', proyectoSchema)
