import mongoose from 'mongoose'

/**
 * SOLICITUD LEGAL — registro auditable de los ejercicios de derechos del usuario.
 *
 * La ley no sólo exige permitir estos derechos, sino poder DEMOSTRAR que se
 * cumplieron (ante la AAIP por datos personales, o Defensa del Consumidor).
 * Cada vez que un usuario ejerce un derecho, queda asentado acá con fecha.
 *
 * Tipos:
 *   acceso        → pidió/descargó sus datos (Ley 25.326, art. 14).
 *   supresion     → pidió la baja/eliminación de su cuenta (art. 16).
 *   oposicion     → activó/desactivó el perfilado para publicidad.
 *   rectificacion → corrigió sus datos.
 *   arrepentimiento → botón de arrepentimiento de una compra (Ley 24.240, art. 34).
 *   queja         → libro de quejas online (Defensa del Consumidor).
 */
const solicitudLegalSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    default: null,
    index: true
  },
  // Guardamos email aparte: si el usuario se anonimiza, el registro de auditoría
  // debe sobrevivir, pero con un identificador de contacto del momento.
  emailContacto: { type: String, default: '' },

  tipo: {
    type: String,
    enum: ['acceso', 'supresion', 'oposicion', 'rectificacion', 'arrepentimiento', 'queja'],
    required: true,
    index: true
  },

  estado: {
    type: String,
    enum: ['recibida', 'resuelta', 'rechazada', 'en_proceso'],
    default: 'resuelta'
  },

  // Detalle libre (motivo del arrepentimiento, texto de la queja, etc.)
  detalle: { type: String, default: '' },

  // Referencias opcionales según el tipo
  ordenId: { type: mongoose.Schema.Types.ObjectId, ref: 'Orden', default: null },

  // Respuesta/observación del equipo (para quejas y arrepentimientos)
  respuesta: { type: String, default: '' },
  resueltaEn: { type: Date, default: null }
}, { timestamps: true })

solicitudLegalSchema.index({ tipo: 1, estado: 1, createdAt: -1 })

export default mongoose.model('SolicitudLegal', solicitudLegalSchema)
