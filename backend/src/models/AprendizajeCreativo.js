import mongoose from 'mongoose'

/**
 * APRENDIZAJE CREATIVO (M2) — la memoria de fallas del Estudio Creativo.
 *
 * Cada vez que un crítico rechaza o castiga una variante por un problema
 * concreto ("se fue a estética europea", "metió texto quemado en la imagen",
 * "manos imposibles"), ese problema se ACUMULA acá con su conteo.
 *
 * Antes de generar, el motor inyecta los patrones más frecuentes como
 * "errores que NO podés cometer" en el prompt de Valentina. Así el sistema
 * mejora solo: cuanto más se usa, menos repite sus propios errores. No hay
 * que tocar código para que aprenda — la verificación ES el motor de mejora.
 */

const aprendizajeCreativoSchema = new mongoose.Schema({
  // Patrón de falla, normalizado (clave única para deduplicar)
  patron: { type: String, required: true, unique: true, index: true },
  // Texto legible del patrón (cómo se le muestra a Valentina)
  descripcion: { type: String, required: true, maxlength: 300 },
  // Qué capa lo suele detectar: 'marca' | 'localia' | 'funcion'
  capa: { type: String, default: 'localia', index: true },
  // Cuántas veces se detectó (peso del patrón)
  conteo: { type: Number, default: 1, index: true },
  // Casos donde más aparece (para inyección contextual)
  casos: { type: [String], default: [] },
  // Ejemplos cortos del error (para que Valentina entienda qué evitar)
  ejemplos: { type: [String], default: [] },
  activo: { type: Boolean, default: true, index: true },
  ultimaVez: { type: Date, default: Date.now }
}, { timestamps: true })

// Los patrones más frecuentes primero (los que más hay que prevenir)
aprendizajeCreativoSchema.index({ activo: 1, conteo: -1 })

const AprendizajeCreativo = mongoose.model('AprendizajeCreativo', aprendizajeCreativoSchema)

export default AprendizajeCreativo
