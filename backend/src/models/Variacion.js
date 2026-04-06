import mongoose from 'mongoose'

const variacionSchema = new mongoose.Schema(
  {
    logoOriginalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Logo',
      required: true,
    },
    cambios: mongoose.Schema.Types.Mixed,
    url: {
      type: String,
      required: true,
    },
    usuarioId: String,
    fechaCreacion: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

export default mongoose.model('Variacion', variacionSchema)
