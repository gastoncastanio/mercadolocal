import mongoose from 'mongoose'

const logoSchema = new mongoose.Schema(
  {
    proyectoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Proyecto',
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    estilo: String,
    parametros: mongoose.Schema.Types.Mixed,
    favorito: { type: Boolean, default: false },
    usuarioId: String,
    fechaCreacion: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

export default mongoose.model('Logo', logoSchema)
