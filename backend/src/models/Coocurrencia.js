import mongoose from 'mongoose'

/**
 * COOCURRENCIA de categorías — el filtrado colaborativo de Mercado Local.
 *
 * Idea (estilo "quien compró esto también compró aquello" de Amazon): cuando un
 * mismo cliente muestra interés fuerte en dos categorías (favorito/compra),
 * sumamos 1 al par. Con el tiempo emerge un mapa de afinidades de TODA la
 * comunidad: "quien mira cunas también mira cochecitos", "quien mira PlayStation
 * también mira TVs".
 *
 * Esto permite que la pauta llegue a un cliente ideal aunque NUNCA haya buscado
 * ese producto puntual: basta con que su patrón se parezca al de quienes sí lo
 * compran. Es la diferencia entre "aparecer primero" y "vender de verdad".
 *
 * Privacidad: solo agregados categoría↔categoría. Nada de personas.
 */
const coocurrenciaSchema = new mongoose.Schema({
  // Categoría ancla
  categoria: {
    type: String,
    required: true,
    unique: true
  },
  // Categorías relacionadas con su fuerza de co-ocurrencia. Map: categoria -> score.
  relacionadas: {
    type: Map,
    of: Number,
    default: {}
  },
  // Cuántas señales fuertes aportaron a esta ancla (para normalizar).
  total: {
    type: Number,
    default: 0
  }
}, { timestamps: true })

const Coocurrencia = mongoose.model('Coocurrencia', coocurrenciaSchema)

export default Coocurrencia
