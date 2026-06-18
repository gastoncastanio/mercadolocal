import mongoose from 'mongoose'

/**
 * CONTADOR atómico de secuencias.
 *
 * Se usa para numerar comprobantes de forma correlativa y sin huecos ni
 * colisiones (la numeración fiscal exige correlatividad). El $inc atómico de
 * Mongo garantiza que dos emisiones simultáneas nunca tomen el mismo número.
 *
 * La `clave` identifica la secuencia, por ejemplo:
 *   "comprobante:C:1"  → Factura C, punto de venta 1
 */
const contadorSchema = new mongoose.Schema({
  clave: { type: String, required: true, unique: true },
  valor: { type: Number, default: 0 }
}, { timestamps: true })

/**
 * Devuelve el siguiente número de la secuencia `clave` de forma atómica.
 */
contadorSchema.statics.siguiente = async function (clave) {
  const doc = await this.findOneAndUpdate(
    { clave },
    { $inc: { valor: 1 } },
    { new: true, upsert: true }
  )
  return doc.valor
}

export default mongoose.model('Contador', contadorSchema)
