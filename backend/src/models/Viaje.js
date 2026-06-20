import mongoose from 'mongoose'

/**
 * Viaje — un trayecto programado por un comisionista entre dos ciudades, con
 * capacidad de bultos y tarifas por tamaño. Los contratantes reservan cupo
 * creando un EnvioComisionista contra este viaje.
 *
 * Máquina de estados:
 *   programado → en_curso → completado
 *   programado/en_curso → cancelado
 *
 * Capacidad: capacidadDisponible se decrementa ATÓMICAMENTE al contratar
 * (findOneAndUpdate con guarda $gte), igual que cupoUsado en OfertaFlash. La
 * fuente de verdad del cupo es el servidor: si dice que quedan 3, quedan 3.
 */
const viajeSchema = new mongoose.Schema({
  // Comisionista dueño del viaje. Ref a Usuario (consistente con el desbloqueo
  // de chat, que compara ids de usuario sin populate).
  comisionistaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  origen: {
    ciudad: { type: String, required: true, trim: true }
  },
  destino: {
    ciudad: { type: String, required: true, trim: true }
  },
  fechaSalida: {
    type: Date,
    required: true
  },
  // Hora de salida como texto libre (ej: "14:30"). La fecha lleva el día.
  horaSalida: {
    type: String,
    default: ''
  },
  // Tarifas por bulto según tamaño (ARS).
  tarifas: {
    bultoChico: { type: Number, default: 0, min: 0 },
    bultoMediano: { type: Number, default: 0, min: 0 },
    bultoGrande: { type: Number, default: 0, min: 0 }
  },
  // Capacidad en cantidad de bultos.
  capacidadTotal: { type: Number, required: true, min: 1 },
  capacidadDisponible: { type: Number, required: true, min: 0 },
  notas: {
    type: String,
    default: ''
  },
  estado: {
    type: String,
    enum: ['programado', 'en_curso', 'completado', 'cancelado'],
    default: 'programado',
    index: true
  }
}, {
  timestamps: true
})

// Búsqueda por ruta + fecha (el caso de uso principal del contratante).
viajeSchema.index({ 'origen.ciudad': 1, 'destino.ciudad': 1, fechaSalida: 1, estado: 1 })

/** ¿Tiene cupo para N bultos y sigue abierto a reservas? */
viajeSchema.methods.tieneCupo = function (cantidad = 1) {
  return this.estado === 'programado' && this.capacidadDisponible >= cantidad
}

/** Precio para una reserva de `cantidad` bultos de un `tamano` dado. */
viajeSchema.methods.precioPara = function (tamano, cantidad = 1) {
  const tarifa = {
    chico: this.tarifas.bultoChico,
    mediano: this.tarifas.bultoMediano,
    grande: this.tarifas.bultoGrande
  }[tamano]
  if (tarifa == null) return null
  return tarifa * cantidad
}

viajeSchema.methods.toPublic = function () {
  const comisionistaPoblado = this.comisionistaId && typeof this.comisionistaId === 'object' && this.comisionistaId.nombre
    ? { _id: this.comisionistaId._id, nombre: this.comisionistaId.nombre, avatar: this.comisionistaId.avatar || '' }
    : null

  return {
    _id: this._id,
    comisionistaId: comisionistaPoblado ? comisionistaPoblado._id : this.comisionistaId,
    comisionista: comisionistaPoblado,
    origen: this.origen,
    destino: this.destino,
    fechaSalida: this.fechaSalida,
    horaSalida: this.horaSalida,
    tarifas: this.tarifas,
    capacidadTotal: this.capacidadTotal,
    capacidadDisponible: this.capacidadDisponible,
    notas: this.notas,
    estado: this.estado,
    createdAt: this.createdAt
  }
}

const Viaje = mongoose.model('Viaje', viajeSchema)
export default Viaje
