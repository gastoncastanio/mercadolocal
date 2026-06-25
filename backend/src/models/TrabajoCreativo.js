import mongoose from 'mongoose'

/**
 * TRABAJO CREATIVO — un "job" asíncrono del Estudio Creativo.
 *
 * El pipeline (generar N → 3 capas → refinar → torneo) encadena muchas
 * llamadas a Gemini, serializadas por la cola con rate-limit (geminiQueue).
 * Eso puede tardar 1-2 minutos: MUCHO más que el timeout HTTP del front (30s).
 *
 * Por eso la generación NO se resuelve en la request: se crea este trabajo,
 * el pipeline corre en segundo plano y va actualizando `paso` (progreso) y al
 * terminar guarda `resultado` (o `error`). El front arranca el trabajo, recibe
 * el `_id` al toque y POLLEA este documento hasta que `estado` sea 'listo'.
 *
 * Es efímero por naturaleza: un índice TTL lo borra a las 24h.
 */

const trabajoCreativoSchema = new mongoose.Schema({
  estado: {
    type: String,
    enum: ['procesando', 'listo', 'error'],
    default: 'procesando',
    index: true
  },
  // Parámetros con que se lanzó (para mostrar/retomar)
  caso: { type: String, required: true },
  ciudadSlug: { type: String, default: 'lobos' },
  esfuerzo: { type: String, default: 'normal' },
  brief: { type: String, default: '' },
  // Texto de progreso visible en la UI ("Verificando 3 capas...", etc.)
  paso: { type: String, default: 'Arrancando...' },
  // Resultado final (plain object: { aprobados, descartados, descripcionCaso, meta })
  resultado: { type: mongoose.Schema.Types.Mixed, default: null },
  // Mensaje de error si falló
  error: { type: String, default: '' },
  // Quién lo pidió (admin)
  lanzadoPor: { type: String, default: 'admin' }
}, { timestamps: true })

// TTL: los trabajos se autodestruyen 24h después de creados (son efímeros).
trabajoCreativoSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 })

const TrabajoCreativo = mongoose.model('TrabajoCreativo', trabajoCreativoSchema)

export default TrabajoCreativo
