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
  },
  // Preferencias de privacidad (Ley 25.326 — derecho de oposición).
  preferencias: {
    // Si es false, el usuario se opuso al perfilado de comportamiento para
    // publicidad: dejamos de registrar señales y no usamos su actividad.
    perfilarPublicidad: { type: Boolean, default: true },
    // Fecha en que aceptó la política de privacidad / consintió el tratamiento.
    consentimientoFecha: { type: Date, default: null }
  },
  // Anonimización por baja de cuenta (derecho de supresión). Cuando el usuario
  // pide la baja, anonimizamos sus datos personales pero conservamos lo que la
  // ley fiscal/contable obliga (órdenes, facturas) de forma desvinculada.
  anonimizado: {
    type: Boolean,
    default: false
  },
  anonimizadoEn: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
})

// Hash de contraseña antes de guardar
usuarioSchema.pre('save', async function(next) {
  if (!this.isModified('contraseña')) return next()

  // Defensa anti doble-hash: si la contraseña ya es un hash bcrypt
  // ($2a$/$2b$/$2y$ + 60 chars), NO la vuelvas a hashear. Evita que un re-save
  // accidental del documento convierta el hash en hash(hash) y rompa el login.
  if (/^\$2[aby]\$\d{2}\$.{53}$/.test(String(this.contraseña))) {
    console.warn(`⚠️  pre-save: la contraseña ya es un hash bcrypt, se omite el rehash para ${this.email}`)
    return next()
  }

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
