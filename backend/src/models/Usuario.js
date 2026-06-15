import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import { validarDNI } from '../utils/dniValidator.js'

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
    minlength: [8, 'La contraseña debe tener al menos 8 caracteres']
  },
  nombre: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    trim: true
  },
  rol: {
    type: String,
    // 'vendedor' se mantiene por compatibilidad con usuarios previos a la
    // migración a cuenta unificada (la capacidad de vender ahora vive en
    // tieneVendedor). No se asigna a usuarios nuevos.
    enum: ['comprador', 'vendedor', 'admin'],
    default: 'comprador'
  },
  tieneVendedor: {
    type: Boolean,
    default: false
  },
  avatar: {
    type: String,
    default: ''
  },
  direccion: {
    type: String,
    default: ''
  },
  dni: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true
        return validarDNI(v)
      },
      message: 'El DNI debe tener 7 u 8 dígitos'
    }
  },
  telefono: {
    type: String,
    default: ''
  },
  activo: {
    type: Boolean,
    default: true
  },
  resetToken: {
    type: String,
    default: null
  },
  resetTokenExpira: {
    type: Date,
    default: null
  },
  // Refresh tokens persistentes (sesiones largas)
  refreshTokens: {
    type: [{
      token: { type: String, required: true },
      creadoEn: { type: Date, default: Date.now },
      expiraEn: { type: Date, required: true }
    }],
    default: []
  },
  // Marca del último login exitoso
  ultimoLogin: {
    type: Date,
    default: null
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

// No devolver la contraseña ni datos sensibles en JSON
usuarioSchema.methods.toJSON = function() {
  const usuario = this.toObject()
  delete usuario.contraseña
  delete usuario.refreshTokens
  delete usuario.resetToken
  delete usuario.resetTokenExpira
  // DNI es PII: no se envía al cliente en respuestas normales ni en populates.
  // Si en el futuro el admin necesita verlo, usar un endpoint dedicado que lo
  // seleccione explícitamente (defensa en profundidad / minimización de datos).
  delete usuario.dni
  return usuario
}

const Usuario = mongoose.model('Usuario', usuarioSchema)

export default Usuario
