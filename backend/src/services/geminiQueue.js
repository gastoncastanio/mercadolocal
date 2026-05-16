/**
 * COLA DE GEMINI con rate limit local y prioridades.
 *
 * Resuelve el escenario crítico: 150 usuarios simultáneos sábado a la noche,
 * 15 comercios subiendo productos, cron del cerebro corriendo. Sin esto,
 * Gemini tira 429 Too Many Requests y se cae moderación, soporte y filtros.
 *
 * Cómo funciona:
 * - TODA llamada a Gemini pasa por esta cola
 * - La cola throttle-a a N requests/segundo (configurable)
 * - Las llamadas tienen prioridad: critical > normal > background
 * - Si hay 429 del API, hace exponential backoff con jitter
 * - Si la cola está saturada, las tareas de background se descartan
 *   antes de tareas críticas (ej: respuesta de soporte a un usuario real
 *   tiene prioridad sobre el cron de propuestas)
 *
 * Tiers de Gemini (a mayo 2026):
 *   - gemini-2.5-flash free tier: 15 RPM, 1500 RPD
 *   - gemini-2.5-flash paid tier 1: 1000 RPM, sin límite RPD
 *
 * Configuramos para 12 RPM (margen 20% bajo del free tier) por defecto.
 * Si el fundador upgradea a paid, subir GEMINI_RPM en env.
 */

const RPM = parseInt(process.env.GEMINI_RPM || '12', 10)
const INTERVALO_MS = Math.ceil(60_000 / RPM)
const MAX_COLA_BACKGROUND = parseInt(process.env.GEMINI_MAX_QUEUE_BG || '50', 10)
const MAX_RETRIES = 3
const BACKOFF_BASE_MS = 2000

// Niveles de prioridad
export const PRIORIDAD = {
  CRITICA: 0,      // Soporte a usuario real, moderación de producto en publicación
  NORMAL: 1,       // Respuesta del cerebro a mensaje del fundador
  BACKGROUND: 2    // Propuestas autónomas, supervisión Diego, resúmenes
}

// Estado de la cola
const colas = {
  [PRIORIDAD.CRITICA]: [],
  [PRIORIDAD.NORMAL]: [],
  [PRIORIDAD.BACKGROUND]: []
}

let procesando = false
let ultimaEjecucion = 0
let totalProcesado = 0
let totalRechazado = 0
let total429 = 0

/**
 * Encola una llamada a Gemini.
 *
 * @param {Function} ejecutor - función async que hace la llamada real a Gemini
 * @param {object} opts
 * @param {number} opts.prioridad - PRIORIDAD.CRITICA | NORMAL | BACKGROUND
 * @param {string} opts.descripcion - para logs (ej: "sofia_modera_X")
 * @param {number} opts.timeoutMs - default 30000
 * @returns {Promise} resuelve con el resultado de ejecutor() o rechaza
 */
export function encolar(ejecutor, opts = {}) {
  const {
    prioridad = PRIORIDAD.NORMAL,
    descripcion = 'gemini_call',
    timeoutMs = 30_000
  } = opts

  return new Promise((resolve, reject) => {
    // Rechazo inmediato si la cola de background está llena y esto es BG.
    // Tareas críticas SIEMPRE entran (aunque la cola crezca).
    if (prioridad === PRIORIDAD.BACKGROUND && colas[PRIORIDAD.BACKGROUND].length >= MAX_COLA_BACKGROUND) {
      totalRechazado++
      console.warn(`🚫 [GeminiQueue] descartado por saturación: ${descripcion}`)
      return reject(new Error('Cola de Gemini saturada (background). Reintentá luego.'))
    }

    const tarea = {
      ejecutor,
      resolve,
      reject,
      prioridad,
      descripcion,
      timeoutMs,
      intentos: 0,
      encoladoEn: Date.now()
    }
    colas[prioridad].push(tarea)
    procesarCola()
  })
}

/**
 * Procesa la próxima tarea respetando el rate limit local.
 */
async function procesarCola() {
  if (procesando) return

  // Buscar próxima tarea, priorizando por nivel
  const niveles = [PRIORIDAD.CRITICA, PRIORIDAD.NORMAL, PRIORIDAD.BACKGROUND]
  let tarea = null
  let nivelTarea = null
  for (const n of niveles) {
    if (colas[n].length > 0) {
      tarea = colas[n].shift()
      nivelTarea = n
      break
    }
  }
  if (!tarea) return

  procesando = true

  // Respetar intervalo mínimo entre llamadas
  const ahora = Date.now()
  const espera = Math.max(0, INTERVALO_MS - (ahora - ultimaEjecucion))
  if (espera > 0) {
    await new Promise(r => setTimeout(r, espera))
  }
  ultimaEjecucion = Date.now()

  const tiempoEsperado = ultimaEjecucion - tarea.encoladoEn
  if (tiempoEsperado > 5000) {
    console.log(`⏱️ [GeminiQueue] tarea ${tarea.descripcion} esperó ${tiempoEsperado}ms (prioridad ${nivelTarea})`)
  }

  // Ejecutar con timeout
  let timeoutHandle
  const timeoutPromise = new Promise((_, rej) => {
    timeoutHandle = setTimeout(() => rej(new Error(`Gemini timeout tras ${tarea.timeoutMs}ms (${tarea.descripcion})`)), tarea.timeoutMs)
  })

  try {
    const resultado = await Promise.race([tarea.ejecutor(), timeoutPromise])
    clearTimeout(timeoutHandle)
    totalProcesado++
    tarea.resolve(resultado)
  } catch (err) {
    clearTimeout(timeoutHandle)

    // ¿Es un 429 o un error de rate limit?
    const es429 = err?.status === 429 ||
                  err?.response?.status === 429 ||
                  /rate.?limit|too many requests|quota|resource_exhausted/i.test(err?.message || '')

    if (es429 && tarea.intentos < MAX_RETRIES) {
      total429++
      tarea.intentos++
      const backoff = BACKOFF_BASE_MS * Math.pow(2, tarea.intentos - 1) + Math.random() * 1000
      console.warn(`🔁 [GeminiQueue] 429 en ${tarea.descripcion}, reintento ${tarea.intentos}/${MAX_RETRIES} en ${Math.round(backoff)}ms`)
      // Re-encolar al final (la cola seguirá procesando otras tareas)
      setTimeout(() => {
        colas[tarea.prioridad].push(tarea)
        procesarCola()
      }, backoff)
    } else {
      tarea.reject(err)
    }
  } finally {
    procesando = false
    // Continuar con la próxima tarea si hay más
    if (colas[PRIORIDAD.CRITICA].length || colas[PRIORIDAD.NORMAL].length || colas[PRIORIDAD.BACKGROUND].length) {
      setImmediate(procesarCola)
    }
  }
}

/**
 * Métricas de la cola para debug y monitoreo
 */
export function obtenerMetricasCola() {
  return {
    rpm: RPM,
    intervaloMs: INTERVALO_MS,
    enCola: {
      critica: colas[PRIORIDAD.CRITICA].length,
      normal: colas[PRIORIDAD.NORMAL].length,
      background: colas[PRIORIDAD.BACKGROUND].length
    },
    totales: {
      procesadas: totalProcesado,
      rechazadas: totalRechazado,
      errores429: total429
    },
    procesando
  }
}
