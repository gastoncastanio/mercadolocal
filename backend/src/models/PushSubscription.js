import mongoose from 'mongoose'

// Suscripción de Web Push de un dispositivo/navegador.
// Un usuario puede tener varias (celular, compu, etc.). El endpoint es único.
const pushSubscriptionSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  endpoint: {
    type: String,
    required: true,
    unique: true
  },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  }
}, {
  timestamps: true
})

const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema)

export default PushSubscription
