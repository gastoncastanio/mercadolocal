import mongoose from 'mongoose'

/**
 * ComercioCentro — comercio físico del programa "Radar del Centro" (cafeterías,
 * librerías, indumentaria, etc.). Es un concepto SEPARADO del marketplace de Tiendas:
 * acá lo que importa es la ubicación física y la cercanía al usuario.
 *
 * Privacidad: estas coordenadas son del LOCAL (dato público), no del usuario.
 * La ubicación del usuario nunca se guarda; el cálculo de distancia es client-side.
 */
const comercioCentroSchema = new mongoose.Schema({
  // Usuario dueño del comercio (gestiona sus ofertas desde su panel)
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  nombre: {
    type: String,
    required: [true, 'El nombre del comercio es obligatorio'],
    trim: true
  },
  rubro: {
    type: String,
    enum: ['cafeteria', 'libreria', 'indumentaria', 'gastronomia', 'belleza', 'otro'],
    default: 'cafeteria'
  },
  descripcion: { type: String, default: '' },

  // Ubicación PÚBLICA del local. Coordenadas aproximadas (~4 decimales / ~11 m).
  ubicacion: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    direccion: { type: String, default: '' },
    ciudad: { type: String, required: true, trim: true, index: true }
  },

  // Estado dentro del programa
  estadoPrograma: {
    type: String,
    enum: ['fundador', 'beta', 'activo', 'pausado'],
    default: 'beta'
  },
  // Verificación otorgada por el admin: muestra el badge "✓ Verificado" y el logo
  // del comercio como portada en el feed del Radar (confianza para el comprador).
  verificado: { type: Boolean, default: false },
  // Bloque horario donde el comercio quiere priorizarse en el feed (Radar Camaleón).
  // Incluye los modos temáticos nuevos + los legacy (retrocompat con datos viejos).
  bloqueHorarioPrioritario: {
    type: String,
    enum: ['desayuno', 'almuerzo', 'siesta', 'merienda', 'cena', 'manana', 'tarde', 'noche', 'todos'],
    default: 'todos'
  },

  // Feed micro-contenido (Fase 4)
  media: {
    // Logo redondo del comercio (portada en las tarjetas del Radar).
    logo: { type: String, default: '' },
    videoLoopUrl: { type: String, default: '' },
    posterUrl: { type: String, default: '' },
    fotos: { type: [String], default: [] }
  },

  // Para el bloque "Fast-Track Urbano" de la mañana
  tiempoPrepEstimado: { type: Number, default: null }, // minutos

  // Vínculo opcional con una tienda del marketplace (si además vende online)
  tiendaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tienda', default: null },

  contacto: {
    whatsapp: { type: String, default: '' },
    instagram: { type: String, default: '' }
  },

  // Secreto para validar canjes en el mostrador (Fase 2). Se guarda hasheado.
  secretoCanje: { type: String, default: '' },

  activo: { type: Boolean, default: true }
}, { timestamps: true })

// Listado público del radar: comercios activos por ciudad
comercioCentroSchema.index({ activo: 1, 'ubicacion.ciudad': 1 })

/**
 * Versión pública y segura para el cliente: solo lo necesario para pintar el
 * feed y calcular distancia. NUNCA expone el secretoCanje.
 */
comercioCentroSchema.methods.toPublic = function () {
  return {
    _id: this._id,
    nombre: this.nombre,
    rubro: this.rubro,
    descripcion: this.descripcion,
    ubicacion: {
      lat: this.ubicacion.lat,
      lng: this.ubicacion.lng,
      direccion: this.ubicacion.direccion,
      ciudad: this.ubicacion.ciudad
    },
    estadoPrograma: this.estadoPrograma,
    verificado: this.verificado,
    bloqueHorarioPrioritario: this.bloqueHorarioPrioritario,
    media: this.media,
    tiempoPrepEstimado: this.tiempoPrepEstimado,
    contacto: this.contacto
  }
}

const ComercioCentro = mongoose.model('ComercioCentro', comercioCentroSchema)
export default ComercioCentro
