import mongoose from 'mongoose'

const itemCarritoSchema = new mongoose.Schema({
  productoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producto',
    required: true
  },
  tiendaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tienda',
    required: true
  },
  nombre: {
    type: String,
    required: true
  },
  precio: {
    type: Number,
    required: true
  },
  cantidad: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  imagen: {
    type: String,
    default: ''
  }
}, { _id: true })

const carritoSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    unique: true
  },
  items: [itemCarritoSchema],
  // Recuperación de carrito abandonado: cuántos recordatorios mandamos y cuándo,
  // para escalonarlos (suave → con gancho) y NO spamear. El contador se reinicia
  // cuando el cliente vuelve a tocar el carrito (ver agregar/actualizar).
  recordatorios: {
    enviados: { type: Number, default: 0 },
    ultimo: { type: Date, default: null }
  }
}, {
  timestamps: true
})

// Índice para el cron de recuperación: barrer carritos por antigüedad.
carritoSchema.index({ updatedAt: 1 })

const Carrito = mongoose.model('Carrito', carritoSchema)

export default Carrito
