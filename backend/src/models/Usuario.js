import mongoose from 'mongoose'
import bcrypt from 'bcrypt'

const usuarioSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'El email es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Por favor ingresa un email válido']
  },
  contraseña: {
    type: String,
    required: [true, 'La contraseña es obligatoria'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres']
  },
  nombre: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    trim: true
  },
  rol: {
    type: String,
    enum: ['comprador', 'vendedor', 'admin'],
    default: 'comprador'
  },
  avatar: {
    type: String,
    default: ''
  },
  direccion: {
    type: String,
    default: ''
  },
  telefono: {
    type: String,
    default: ''
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

// Hash de contraseña antes de guardar
usuarioSchema.pre('save', async function(next) {
  if (!this.isModified('contraseña')) return next()

  try {
    const salt = await bcrypt.genSalt(10)
    this.contraseña = await bcrypt.hash(this.contraseña, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// Método para comparar contraseñas
usuarioSchema.methods.compararContraseña = async function(contraseñaIngresada) {
  return await bcrypt.compare(contraseñaIngresada, this.contraseña)
}

// No devolver la contraseña en JSON
usuarioSchema.methods.toJSON = function() {
  const usuario = this.toObject()
  delete usuario.contraseña
  return usuario
}

const Usuario = mongoose.model('Usuario', usuarioSchema)

export default Usuario
