import mongoose from 'mongoose'
import { encriptar, desencriptar, estaEncriptado } from '../utils/crypto.js'

const tiendaSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    unique: true
  },
  nombre: {
    type: String,
    required: [true, 'El nombre de la tienda es obligatorio'],
    trim: true
  },
  descripcion: {
    type: String,
    default: ''
  },
  logo: {
    type: String,
    default: ''
  },
  ciudad: {
    type: String,
    required: [true, 'La ciudad es obligatoria'],
    trim: true
  },
  tipo: {
    type: String,
    enum: ['fisica', 'online', 'ambas'],
    default: 'online'
  },
  telefono: {
    type: String,
    default: ''
  },
  codigoPostal: {
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
  ganancias: {
    type: Number,
    default: 0
  },
  activo: {
    type: Boolean,
    default: true
  },
  // Mercado Pago Marketplace - OAuth del vendedor
  mpAccessToken: {
    type: String,
    default: ''
  },
  mpRefreshToken: {
    type: String,
    default: ''
  },
  mpUserId: {
    type: String,
    default: ''
  },
  mpVinculado: {
    type: Boolean,
    default: false
  },
  mpVinculadoEn: {
    type: Date,
    default: null
  },
  // Token CSRF temporal usado durante el flujo OAuth con Mercado Pago.
  // Se setea al pedir auth-url y se valida en el callback.
  mpCsrfToken: {
    type: String,
    default: null
  },
  // Datos fiscales del vendedor. Se usan como RECEPTOR de las facturas que la
  // plataforma le emite (pauta/comisión) y como EMISOR cuando el vendedor
  // factura a su comprador. La condición define el tipo de factura que emite:
  // Monotributo → C; Responsable Inscripto → A/B.
  datosFiscales: {
    razonSocial: { type: String, default: '' },
    cuit: { type: String, default: '' },
    condicionIVA: {
      type: String,
      enum: ['', 'Monotributo', 'Responsable Inscripto', 'Exento', 'Consumidor Final'],
      default: ''
    },
    domicilio: { type: String, default: '' }
  }
}, {
  timestamps: true
})

// ===== Índices =====
// Búsqueda de tiendas por ciudad y activas (listado público)
tiendaSchema.index({ activo: 1, ciudad: 1, calificacion: -1 })
// Tiendas con MP vinculado (para listar las que pueden vender)
tiendaSchema.index({ mpVinculado: 1, activo: 1 })
// Búsqueda por nombre
tiendaSchema.index({ nombre: 'text', descripcion: 'text' })

// Encriptar tokens de MP antes de guardar
tiendaSchema.pre('save', function (next) {
  try {
    if (this.isModified('mpAccessToken') && this.mpAccessToken && !estaEncriptado(this.mpAccessToken)) {
      this.mpAccessToken = encriptar(this.mpAccessToken)
    }
    if (this.isModified('mpRefreshToken') && this.mpRefreshToken && !estaEncriptado(this.mpRefreshToken)) {
      this.mpRefreshToken = encriptar(this.mpRefreshToken)
    }
    next()
  } catch (error) {
    console.error('❌ Error al encriptar tokens de MP:', error.message)
    next(error)
  }
})

// Método para obtener el access token desencriptado
tiendaSchema.methods.getMpAccessToken = function () {
  return desencriptar(this.mpAccessToken)
}

tiendaSchema.methods.getMpRefreshToken = function () {
  return desencriptar(this.mpRefreshToken)
}

const Tienda = mongoose.model('Tienda', tiendaSchema)

export default Tienda
