import mongoose from 'mongoose'
import { encriptar, desencriptar, estaEncriptado } from '../utils/crypto.js'

/**
 * PerfilComisionista — perfil de un "viajero" que transporta bultos entre
 * localidades (vertical Comisionistas/Viajeros). Espejo de PerfilProfesional.
 *
 * Convenciones: capability flag esComisionista en Usuario (no toca el enum rol);
 * URLs nunca binarios; toPublic() sin datos sensibles; denormaliza calificacion.
 */
const perfilComisionistaSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    unique: true
  },
  // Cómo se presenta (ej: "Envíos Express del Valle"). Si vacío, usa nombre del usuario.
  nombreServicio: {
    type: String,
    default: '',
    trim: true
  },
  descripcion: {
    type: String,
    default: ''
  },
  vehiculo: {
    tipo: {
      type: String,
      enum: ['auto', 'camioneta', 'utilitario', 'camion', 'moto', 'otro'],
      default: 'auto'
    },
    patente: { type: String, default: '' },
    // Capacidad referencial de bultos del vehículo (cada Viaje define la suya real).
    capacidadBultos: { type: Number, default: 0, min: 0 }
  },
  // Ciudades que suele recorrer (ej: ['Bariloche', 'Neuquén', 'Cipolletti'])
  zonasHabituales: [String],
  telefonoContacto: {
    type: String,
    default: ''
  },
  // Verificación de identidad (badge otorgado por admin tras revisar DNI).
  dniVerificado: {
    type: Boolean,
    default: false
  },
  calificacion: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalViajes: {
    type: Number,
    default: 0
  },
  conteoResenas: {
    type: Number,
    default: 0
  },
  activo: {
    type: Boolean,
    default: true
  },
  // Integración con checkout del marketplace
  documentoVehiculo: {
    url: { type: String, default: '' }, // URL del documento en Cloudinary
    tipoDocumento: {
      type: String,
      enum: ['titulo_propiedad', 'cédula_estacionamiento', 'licencia_conducir'],
      default: 'titulo_propiedad'
    },
    nombreArchivo: { type: String, default: '' }
  },
  estadoDocumento: {
    type: String,
    enum: ['pendiente', 'verificado', 'rechazado'],
    default: 'pendiente'
  },
  // Horarios de disponibilidad (ej: {lunes: {desde: '08:00', hasta: '20:00'}, martes: {...}})
  // NULL/undefined = no tiene horarios activos en estos momentos
  horariosActivos: {
    lunes: { desde: String, hasta: String },
    martes: { desde: String, hasta: String },
    miercoles: { desde: String, hasta: String },
    jueves: { desde: String, hasta: String },
    viernes: { desde: String, hasta: String },
    sabado: { desde: String, hasta: String },
    domingo: { desde: String, hasta: String }
  },
  // Control rápido: hoy estoy trabajando? (button toggle)
  estaTrabajandoHoy: {
    type: Boolean,
    default: false
  },
  // ===== Remis / traslado de personas (vertical "MercadoLocal Remis") =====
  // El mismo conductor verificado puede ofrecer traslado de personas estilo app:
  // el pasajero pide desde el teléfono, sin llamadas ni mensajes. Reemplaza a los
  // remises tradicionales que mueren por falta de conexión digital.
  ofreceRemis: {
    type: Boolean,
    default: false
  },
  // Tarifas de remis configurables por el conductor (ARS).
  tarifasRemis: {
    // "Bajada de bandera": costo base fijo de cualquier viaje.
    banderita: { type: Number, default: 0, min: 0 },
    // Costo por kilómetro recorrido.
    porKm: { type: Number, default: 0, min: 0 },
    // Costo por hora de espera/acompañamiento (clave para el "día de compras":
    // el conductor lleva, espera mientras hacés las compras y devuelve a casa).
    porHoraEspera: { type: Number, default: 0, min: 0 },
    // Tarifa mínima: ningún viaje cobra menos que esto.
    minimo: { type: Number, default: 0, min: 0 }
  },
  // Mercado Pago — OAuth del comisionista (para cobrar el traslado con split).
  // Mismo patrón que Tienda: tokens encriptados en reposo.
  mpAccessToken: { type: String, default: '' },
  mpRefreshToken: { type: String, default: '' },
  mpUserId: { type: String, default: '' },
  mpVinculado: { type: Boolean, default: false },
  mpVinculadoEn: { type: Date, default: null },
  mpCsrfToken: { type: String, default: null }
}, {
  timestamps: true
})

// Encriptar tokens de MP antes de guardar (idéntico a Tienda).
perfilComisionistaSchema.pre('save', function (next) {
  try {
    if (this.isModified('mpAccessToken') && this.mpAccessToken && !estaEncriptado(this.mpAccessToken)) {
      this.mpAccessToken = encriptar(this.mpAccessToken)
    }
    if (this.isModified('mpRefreshToken') && this.mpRefreshToken && !estaEncriptado(this.mpRefreshToken)) {
      this.mpRefreshToken = encriptar(this.mpRefreshToken)
    }
    next()
  } catch (error) {
    console.error('❌ Error al encriptar tokens de MP del comisionista:', error.message)
    next(error)
  }
})

perfilComisionistaSchema.methods.getMpAccessToken = function () {
  return desencriptar(this.mpAccessToken)
}
perfilComisionistaSchema.methods.getMpRefreshToken = function () {
  return desencriptar(this.mpRefreshToken)
}

// Búsqueda de comisionistas activos disponibles ahora
perfilComisionistaSchema.index({ activo: 1, estaTrabajandoHoy: 1, calificacion: -1 })
// Búsqueda de remiseros disponibles ahora (ofreceRemis + trabajando)
perfilComisionistaSchema.index({ ofreceRemis: 1, estaTrabajandoHoy: 1, activo: 1, calificacion: -1 })
// Búsqueda por estado de documento (para admin panel)
perfilComisionistaSchema.index({ estadoDocumento: 1 })

// Perfil público (sin datos sensibles). Expone nombre/avatar del usuario si fue poblado.
perfilComisionistaSchema.methods.toPublic = function () {
  const usuarioPoblado = this.usuarioId && typeof this.usuarioId === 'object' && this.usuarioId.nombre
    ? { _id: this.usuarioId._id, nombre: this.usuarioId.nombre, avatar: this.usuarioId.avatar || '' }
    : null

  return {
    _id: this._id,
    usuarioId: usuarioPoblado ? usuarioPoblado._id : this.usuarioId,
    usuario: usuarioPoblado,
    nombreServicio: this.nombreServicio,
    descripcion: this.descripcion,
    vehiculo: this.vehiculo,
    zonasHabituales: this.zonasHabituales,
    telefonoContacto: this.telefonoContacto,
    dniVerificado: this.dniVerificado,
    calificacion: this.calificacion,
    totalViajes: this.totalViajes,
    conteoResenas: this.conteoResenas,
    activo: this.activo,
    documentoVehiculo: this.estadoDocumento === 'verificado' ? { verificado: true } : { verificado: false },
    estadoDocumento: this.estadoDocumento,
    estaTrabajandoHoy: this.estaTrabajandoHoy,
    horariosActivos: this.horariosActivos,
    ofreceRemis: this.ofreceRemis,
    tarifasRemis: this.tarifasRemis,
    mpVinculado: this.mpVinculado,
    createdAt: this.createdAt
  }
}

const PerfilComisionista = mongoose.model('PerfilComisionista', perfilComisionistaSchema)
export default PerfilComisionista
