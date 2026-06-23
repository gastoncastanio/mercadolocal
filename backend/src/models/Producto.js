import mongoose from 'mongoose'

const productoSchema = new mongoose.Schema({
  tiendaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tienda',
    required: true
  },
  nombre: {
    type: String,
    required: [true, 'El nombre del producto es obligatorio'],
    trim: true
  },
  descripcion: {
    type: String,
    default: ''
  },
  precio: {
    type: Number,
    required: [true, 'El precio es obligatorio'],
    min: [0, 'El precio no puede ser negativo']
  },
  // Precio anterior (tachado). Si es mayor que `precio`, el producto está en
  // oferta. Lo setea el vendedor de forma opcional. 0/null = sin oferta.
  precioAnterior: {
    type: Number,
    default: null,
    min: [0, 'El precio anterior no puede ser negativo']
  },
  stock: {
    type: Number,
    default: 1,
    min: [0, 'El stock no puede ser negativo']
  },
  imagenes: {
    type: [String],
    default: []
  },
  categorias: {
    type: [String],
    default: []
  },
  ciudad: {
    type: String,
    default: ''
  },
  calificacion: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalVentas: {
    type: Number,
    default: 0
  },
  peso: {
    type: Number,
    default: 0,
    min: 0
  },
  alto: {
    type: Number,
    default: 0,
    min: 0
  },
  ancho: {
    type: Number,
    default: 0,
    min: 0
  },
  largo: {
    type: Number,
    default: 0,
    min: 0
  },
  envioGratis: {
    type: Boolean,
    default: false
  },
  condicion: {
    type: String,
    enum: ['nuevo', 'usado', 'reacondicionado'],
    default: 'nuevo'
  },
  garantia: {
    type: String,
    default: ''
  },
  caracteristicas: {
    type: [{ clave: String, valor: String }],
    default: []
  },
  // ===== Identificación del producto (para catálogo central y verificación) =====
  // Código de barras universal (EAN-13, UPC-A, GTIN-12/14).
  // Opcional en general, pero obligatorio en categorías de alto riesgo (electrónica nueva,
  // alimentos envasados, cosmética). Si se pone, permite agrupar productos idénticos
  // de distintos vendedores en el catálogo y mostrar comparación de precios.
  codigoBarras: {
    type: String,
    default: '',
    trim: true,
    index: true // para búsqueda rápida cuando agrupamos productos iguales
  },
  // Marca del producto (Samsung, Apple, Dia, etc.) — útil para filtrado y SEO.
  // Distinto de la tienda que lo vende.
  marca: {
    type: String,
    default: '',
    trim: true
  },
  // ===== Modalidades de entrega que ofrece el vendedor =====
  // El costo del envío NO se procesa dentro de la app: se coordina aparte
  // entre comprador y vendedor por WhatsApp/chat. Más adelante integraremos
  // API de Andreani para cotización automática.
  // Al menos una modalidad debe estar activa para publicar.
  entrega: {
    retiroEnLocal: {
      activo: { type: Boolean, default: false },
      direccion: { type: String, default: '', trim: true, maxlength: 200 },
      horarios: { type: String, default: '', trim: true, maxlength: 200 }
    },
    envioPropio: {
      activo: { type: Boolean, default: false },
      // Zonas que el vendedor cubre con su propia logística
      zonas: { type: String, default: '', trim: true, maxlength: 300 },
      // Notas adicionales: tiempos, costos aproximados, etc.
      notas: { type: String, default: '', trim: true, maxlength: 300 }
    },
    envioCorreo: {
      // Por correo/encomienda: el comprador coordina y paga directo con la empresa
      activo: { type: Boolean, default: false },
      // Empresas que el vendedor maneja habitualmente (informativo)
      empresas: { type: String, default: '', trim: true, maxlength: 200 }
    }
  },
  // ===== Cuotas sin interés =====
  // Cantidad MÁXIMA de cuotas SIN interés que ofrece el vendedor. El vendedor
  // absorbe el costo de financiación de Mercado Pago metiéndolo en el precio,
  // así que el comprador paga el MISMO total (el precio publicado) en 1 pago o
  // en hasta N cuotas: cada cuota = precio / N, sin recargo.
  //   1      => no ofrece cuotas (solo 1 pago)
  //   3/6/12 => hasta esa cantidad de cuotas sin interés
  // El vendedor calcula el precio correcto con el simulador del form de publicar.
  cuotasSinInteres: {
    type: Number,
    enum: [1, 3, 6, 12],
    default: 1
  },
  activo: {
    type: Boolean,
    default: true
  },
  // ===== Estado de moderación (AGENTE-MODERACIÓN) =====
  // Estado del producto en el flujo de moderación automática.
  //   - aprobado: el agente IA lo aprobó, visible al público
  //   - revision: pendiente de revisión humana (visible PERO marcado en admin)
  //   - rechazado: bloqueado por el agente IA, NO visible al público
  // Los productos viejos (anteriores a este sistema) son "aprobado" por default
  // para no romper el catálogo existente.
  moderacion: {
    estado: {
      type: String,
      enum: ['aprobado', 'revision', 'rechazado'],
      default: 'aprobado',
      index: true
    },
    // Razón visible al vendedor si fue rechazado o pasó a revisión
    motivo: {
      type: String,
      default: ''
    },
    // Confianza del agente IA (0-100)
    confianza: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    // Fecha de la última moderación
    fecha: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true
})

// ============================================================
// ÍNDICES — diseñados para las consultas reales del catálogo
// ============================================================
//
// MongoDB recorre índices en orden, así que el ORDEN de los campos
// importa. Patrón típico de catálogo:
//   1. Filtrar por activo:true (siempre primero)
//   2. Filtrar por ciudad y/o categoría
//   3. Ordenar por relevancia (ventas / calificación / fecha / precio)
//
// Cada índice cubre un patrón de búsqueda específico.

// 1. Búsqueda por texto (search bar)
productoSchema.index({ nombre: 'text', descripcion: 'text', categorias: 'text' })

// 2. Productos de UNA tienda (vendedor viendo sus propios productos)
productoSchema.index({ tiendaId: 1, activo: 1, createdAt: -1 })

// 3. Catálogo por ciudad + categoría (la query más común)
productoSchema.index({ activo: 1, ciudad: 1, categorias: 1, createdAt: -1 })

// 4. Más vendidos en categoría
productoSchema.index({ activo: 1, categorias: 1, totalVentas: -1 })

// 5. Filtros de precio
productoSchema.index({ activo: 1, categorias: 1, precio: 1 })

// 6. Filtros por marca + categoría (cuando integremos comparación)
productoSchema.index({ activo: 1, marca: 1, categorias: 1 })

// 6b. Sección Usados (filtra por condición)
productoSchema.index({ activo: 1, condicion: 1, createdAt: -1 })

// 7. Productos por código de barras (para agrupar duplicados en catálogo)
productoSchema.index({ codigoBarras: 1, activo: 1 }, {
  // sparse: solo indexa documentos que tienen el campo (no todos)
  // Reduce mucho el tamaño del índice porque la mayoría de productos
  // no van a tener código de barras al inicio.
  sparse: true
})

// 8. Novedades globales
productoSchema.index({ activo: 1, createdAt: -1 })

// 9. Productos destacados de la home
productoSchema.index({ activo: 1, calificacion: -1, totalVentas: -1 })

// 10. Catálogo público: solo aprobados por moderación (incluye 'revision' por default)
//     Los rechazados NO aparecen en el catálogo público.
productoSchema.index({ activo: 1, 'moderacion.estado': 1, createdAt: -1 })

// 11. Panel admin: productos que necesitan revisión humana
productoSchema.index({ 'moderacion.estado': 1, 'moderacion.fecha': -1 })

const Producto = mongoose.model('Producto', productoSchema)

export default Producto
