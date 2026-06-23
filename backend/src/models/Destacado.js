import mongoose from 'mongoose'

/**
 * Productos destacados / promovidos por vendedores.
 * El vendedor paga para que su producto aparezca con prioridad
 * en el cat\u00e1logo, banners y espacios publicitarios.
 */
const destacadoSchema = new mongoose.Schema({
  // Tipo de anuncio:
  //  - 'producto': destaca un producto puntual (catálogo, búsquedas, banner…).
  //  - 'tienda':   destaca la MARCA de la tienda (logo + nombre) en banner, home
  //                y vidriera de marcas, linkeando a la tienda. No tiene producto.
  tipo: {
    type: String,
    enum: ['producto', 'tienda'],
    default: 'producto'
  },
  // Obligatorio solo para anuncios de producto. En los de tienda queda vacío.
  productoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producto',
    required: function () { return this.tipo !== 'tienda' }
  },
  tiendaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tienda',
    required: true
  },
  vendedorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  plan: {
    type: String,
    enum: ['basico', 'premium', 'elite', 'marca'],
    required: true
  },
  ubicacion: {
    type: [String],
    default: ['catalogo'],
    enum: ['catalogo', 'banner', 'publicidad', 'busqueda', 'home', 'marcas']
  },
  // Segmentación opcional (formatos premium): si se setea, el anuncio
  // solo se prioriza para compradores que filtran por esa ciudad/categoría.
  segmentoCiudad: {
    type: String,
    default: ''
  },
  segmentoCategoria: {
    type: String,
    default: ''
  },
  duracionDias: {
    type: Number,
    required: true
  },
  precioTotal: {
    type: Number,
    required: true
  },
  // Puja opcional (ARS) — modelo HÍBRIDO: el plan es la entrada; la puja te sube
  // MÁS ALTO en los espacios premium (banner, home, primeros puestos) donde hay
  // competencia. Funciona estilo "Ad Rank": el ranking = puja × calidad
  // (relevancia × CTR real), así una puja alta no garantiza el puesto si el
  // anuncio no le interesa a nadie. Se cobra junto con el plan (va en precioTotal).
  puja: {
    type: Number,
    default: 0,
    min: 0
  },
  // Cómo pagó el vendedor la pauta:
  //  - 'saldo': se descontó de las ganancias acumuladas en la plataforma
  //  - 'neteo': se descuenta de las PRÓXIMAS ventas (la deuda puede dejar las
  //    ganancias en negativo, hasta el tope de crédito). No pasa por MP → fee $0.
  //  - 'mercadopago': pagó con dinero real a la cuenta de la plataforma (ingreso fresco)
  metodoPago: {
    type: String,
    enum: ['saldo', 'neteo', 'mercadopago'],
    default: 'saldo'
  },
  // Datos del pago con Mercado Pago (solo cuando metodoPago === 'mercadopago')
  mpPreferenceId: {
    type: String,
    default: ''
  },
  mpPaymentId: {
    type: String,
    default: ''
  },
  mpStatus: {
    type: String,
    default: ''
  },
  fechaInicio: {
    type: Date,
    default: Date.now
  },
  fechaFin: {
    type: Date,
    required: true
  },
  activo: {
    type: Boolean,
    default: true
  },
  impresiones: {
    type: Number,
    default: 0
  },
  clicks: {
    type: Number,
    default: 0
  },
  // Audiencia agregada de quienes hicieron clic (para métricas del vendedor).
  // Solo a nivel categoría/ciudad — nunca quién es la persona.
  audiencia: {
    categorias: { type: Map, of: Number, default: {} },
    ciudades: { type: Map, of: Number, default: {} }
  },
  // Cuántas veces este anuncio se mostró por relevancia (match con el perfil)
  // vs. relleno. Sirve para medir qué tan "inteligente" fue la entrega.
  impresionesRelevantes: {
    type: Number,
    default: 0
  },
  estado: {
    type: String,
    enum: ['pendiente', 'activo', 'pausado', 'finalizado', 'cancelado'],
    default: 'activo'
  }
}, {
  timestamps: true
})

destacadoSchema.index({ fechaFin: 1, activo: 1, estado: 1 })
destacadoSchema.index({ productoId: 1, activo: 1 })
// Para activar la pauta cuando llega el webhook de Mercado Pago
destacadoSchema.index({ mpPreferenceId: 1 })
destacadoSchema.index({ mpPaymentId: 1 })

const Destacado = mongoose.model('Destacado', destacadoSchema)

export default Destacado
