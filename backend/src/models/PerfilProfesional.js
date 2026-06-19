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
  // Nombre comercial / cómo se presenta (ej: "Plomería González"). Si está vacío
  // se usa el nombre del usuario.
  nombreNegocio: {
    type: String,
    default: '',
    trim: true
  },
  descripcion: {
    type: String,
    default: ''
  },
  // Presentación tipo CV: experiencia, trayectoria, especialidades
  experiencia: {
    type: String,
    default: ''
  },
  // Habilidades / especialidades como tags (ej: ['Destapaciones', 'Termotanques'])
  habilidades: [String],
  añosExperiencia: {
    type: Number,
    default: 0,
    min: 0
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
  // Teléfono de contacto visible en el perfil (opcional)
  telefonoContacto: {
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

// Método para obtener el perfil público (sin datos sensibles).
// Si usuarioId fue poblado (.populate('usuarioId', 'nombre avatar')) se exponen
// el nombre y avatar del usuario para mostrarlos en el perfil tipo Instagram.
perfilProfesionalSchema.methods.toPublic = function () {
  const usuarioPoblado = this.usuarioId && typeof this.usuarioId === 'object' && this.usuarioId.nombre
    ? { _id: this.usuarioId._id, nombre: this.usuarioId.nombre, avatar: this.usuarioId.avatar || '' }
    : null

  return {
    _id: this._id,
    usuarioId: usuarioPoblado ? usuarioPoblado._id : this.usuarioId,
    usuario: usuarioPoblado,
    nombreNegocio: this.nombreNegocio,
    rubro: this.rubro,
    descripcion: this.descripcion,
    experiencia: this.experiencia,
    habilidades: this.habilidades || [],
    añosExperiencia: this.añosExperiencia,
    localidad: this.localidad,
    zonasCobertura: this.zonasCobertura,
    telefonoContacto: this.telefonoContacto,
    matricula: this.matricula,
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
