import mongoose from 'mongoose'

/**
 * PERFIL DE INTERÉS de un cliente (logueado o anónimo).
 *
 * Es la base de la "Pauta Inteligente": a partir de lo que cada cliente mira,
 * busca, marca como favorito y compra, inferimos qué está buscando. Con eso la
 * publicidad no aparece "primera y ya", sino frente a quien tiene más chance de
 * comprar — y podemos avisarle por notificación cuando aparece algo ideal.
 *
 * Privacidad: solo guardamos señales a nivel CATEGORÍA / CIUDAD / RANGO DE PRECIO.
 * Nunca ubicación exacta ni datos personales. El visitante anónimo se identifica
 * con un id aleatorio generado en su navegador (sin relación con su identidad).
 */
const perfilInteresSchema = new mongoose.Schema({
  // Identidad: uno de los dos. Logueado => usuarioId; visitante => anonId.
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    default: null
  },
  anonId: {
    type: String,
    default: null
  },

  // Puntaje de interés por categoría. Map: categoria -> score acumulado.
  categorias: {
    type: Map,
    of: Number,
    default: {}
  },
  // Ciudades de los productos que mira (para afinidad geográfica respetando privacidad).
  ciudades: {
    type: Map,
    of: Number,
    default: {}
  },

  // Historial reciente de productos vistos (capado a 50). Es lo que pidió el
  // fundador: "a través del historial de publicaciones que observa cada cliente
  // nos daremos cuenta del producto que está buscando".
  vistasRecientes: {
    type: [{
      productoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto' },
      categoria: String,
      precio: Number,
      ts: { type: Date, default: Date.now }
    }],
    default: []
  },

  // Búsquedas recientes (capado a 30)
  busquedasRecientes: {
    type: [{
      termino: String,
      categoria: String,
      ts: { type: Date, default: Date.now }
    }],
    default: []
  },

  // Afinidad de precio (promedio incremental de lo que mira/compra)
  precioSum: { type: Number, default: 0 },
  precioCount: { type: Number, default: 0 },

  // Contadores globales
  totalVistas: { type: Number, default: 0 },
  totalBusquedas: { type: Number, default: 0 },
  totalFavoritos: { type: Number, default: 0 },
  totalCompras: { type: Number, default: 0 },

  ultimaActividad: { type: Date, default: Date.now },

  // Throttle de notificaciones de pauta: cuándo se le mandó la última.
  // Sirve para el "timer" que pidió el fundador: no molestar al cliente.
  ultimaNotifPublicidad: { type: Date, default: null }
}, { timestamps: true })

// Una identidad = un perfil. Sparse para permitir el campo nulo del otro tipo.
perfilInteresSchema.index({ usuarioId: 1 }, { unique: true, sparse: true })
perfilInteresSchema.index({ anonId: 1 }, { unique: true, sparse: true })

const PerfilInteres = mongoose.model('PerfilInteres', perfilInteresSchema)

export default PerfilInteres
