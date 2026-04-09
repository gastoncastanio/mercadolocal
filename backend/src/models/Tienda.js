import mongoose from 'mongoose'

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
  }
}, {
  timestamps: true
})

const Tienda = mongoose.model('Tienda', tiendaSchema)

export default Tienda
