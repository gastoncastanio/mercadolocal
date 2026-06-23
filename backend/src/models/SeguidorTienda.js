import mongoose from 'mongoose'

/**
 * Seguimiento de tiendas: un usuario "sigue" una tienda (como en las tiendas
 * oficiales). Sirve para el contador de seguidores del storefront y, más
 * adelante, para avisarle de novedades/ofertas de las marcas que sigue.
 */
const seguidorTiendaSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  tiendaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tienda',
    required: true
  }
}, {
  timestamps: true
})

// Un seguimiento único por (usuario, tienda)
seguidorTiendaSchema.index({ usuarioId: 1, tiendaId: 1 }, { unique: true })
// Para contar seguidores de una tienda rápido
seguidorTiendaSchema.index({ tiendaId: 1 })

const SeguidorTienda = mongoose.model('SeguidorTienda', seguidorTiendaSchema)

export default SeguidorTienda
