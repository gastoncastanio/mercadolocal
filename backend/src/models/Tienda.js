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
  }
}, {
  timestamps: true
})

// Encriptar tokens de MP antes de guardar
tiendaSchema.pre('save', function (next) {
  if (this.isModified('mpAccessToken') && this.mpAccessToken && !estaEncriptado(this.mpAccessToken)) {
    this.mpAccessToken = encriptar(this.mpAccessToken)
  }
  if (this.isModified('mpRefreshToken') && this.mpRefreshToken && !estaEncriptado(this.mpRefreshToken)) {
    this.mpRefreshToken = encriptar(this.mpRefreshToken)
  }
  next()
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
