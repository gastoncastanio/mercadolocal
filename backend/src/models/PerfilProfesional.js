import mongoose from 'mongoose'

const perfilProfesionalSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    unique: true
  },
  rubro: {
    type: String,
    enum: ['sanitarios', 'electricista', 'gasista', 'carpintero', 'plomero', 'pintor', 'limpieza', 'otros'],
    required: true
  },
  descripcion: {
    type: String,
    default: ''
  },
  localidad: {
    type: String,
    required: [true, 'La localidad es obligatoria'],
    trim: true
  },
  zonasCobertura: [String], // ej: ['Zona norte', 'Centro', 'Zona sur']
  matricula: {
    type: String,
    default: ''
  },
  verificado: {
    type: Boolean,
    default: false
  },
  calificacion: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalTrabajos: {
    type: Number,
    default: 0
  },
  conteoResenas: {
    type: Number,
    default: 0
  },
  media: {
    fotos: [String], // URLs, nunca binarios
    logo: String
  },
  destacadoHasta: {
    type: Date,
    default: null
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

// ===== Índices =====
// Búsqueda por localidad + rubro, destacados arriba
perfilProfesionalSchema.index({ localidad: 1, rubro: 1, destacadoHasta: -1, activo: 1 })
// Búsqueda por usuario (perfil personal)
perfilProfesionalSchema.index({ usuarioId: 1 })
// Texto para búsqueda libre
perfilProfesionalSchema.index({ descripcion: 'text', rubro: 'text' })

// Método para obtener el perfil público (sin datos sensibles)
perfilProfesionalSchema.methods.toPublic = function () {
  return {
    _id: this._id,
    usuarioId: this.usuarioId,
    rubro: this.rubro,
    descripcion: this.descripcion,
    localidad: this.localidad,
    zonasCobertura: this.zonasCobertura,
    verificado: this.verificado,
    calificacion: this.calificacion,
    totalTrabajos: this.totalTrabajos,
    conteoResenas: this.conteoResenas,
    media: this.media,
    destacadoHasta: this.destacadoHasta,
    activo: this.activo,
    createdAt: this.createdAt
  }
}

const PerfilProfesional = mongoose.model('PerfilProfesional', perfilProfesionalSchema)

export default PerfilProfesional
