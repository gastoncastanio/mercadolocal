/**
 * ESTUDIO CREATIVO — el motor creativo del cerebro de MercadoLocal.
 *
 * No es "un generador de prompts". Es una MINI-AGENCIA con proceso:
 *
 *   0. ADN de marca (fuente única, adnMarca.js) — todos lo leen.
 *   1. BRIEF: función del embudo + datos REALES de la app + lista negra de
 *      fallas aprendidas (M2) + piezas que ya funcionaron (M1 liviano).
 *   2. GENERACIÓN DIVERSA (Valentina, CGO): best-of-N — varias variantes con
 *      ángulos distintos, no una sola.
 *   3. TRES CAPAS DE VERIFICACIÓN (críticos independientes, puntúan 0-10):
 *        · Capa 1 · Marca & Coherencia   (Mati, Dir. de Arte)
 *        · Capa 2 · Localía & Técnica     (Mati con sombrero técnico)
 *        · Capa 3 · Función & Conversión  (Diego, CEO)
 *   4. REFINAMIENTO + TORNEO: Valentina reescribe las flojas con los problemas
 *      concretos; se rankean; sobreviven solo las que pasan las 3 capas.
 *   5. SALIDA: prompts aprobados con scorecard + el "porqué" de cada crítico.
 *
 * APRENDIZAJE (M2): cada problema que marca un crítico se acumula en la lista
 * negra (AprendizajeCreativo) y se inyecta preventivamente en la próxima
 * generación. El sistema mejora solo, sin tocar código.
 *
 * Reusa el cliente Gemini y la cola con rate-limit (geminiQueue) del cerebro.
 * REGLA: este servicio produce TEXTO (prompts). No genera imágenes ni gasta
 * billing de imagen — eso es una capa futura que toma estos prompts aprobados.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import Agente from '../models/Agente.js'
import PromptCreativo from '../models/PromptCreativo.js'
import AprendizajeCreativo from '../models/AprendizajeCreativo.js'
import TrabajoCreativo from '../models/TrabajoCreativo.js'
import { encolar, PRIORIDAD } from './geminiQueue.js'
import { datosCreativaComoTexto } from './analistaDatos.js'
import {
  adnComoTexto,
  descripcionCaso,
  CASOS,
  EVITAR,
  VERSION_ADN,
  CIUDAD_DEFECTO
} from '../config/adnMarca.js'

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null
const MODELO = 'gemini-2.5-flash'

// Umbral de aprobación por capa (0-10). Una variante pasa el torneo solo si
// las TRES capas la puntúan >= UMBRAL.
const UMBRAL = 8

// "Gobernador de esfuerzo": cuánto invertimos según la apuesta.
//   alto   → creativos para la pauta de $1M (máximo esfuerzo)
//   normal → campañas comunes
//   rapido → tiles de categoría, cosas internas
const PERFILES_ESFUERZO = {
  alto: { variantes: 5, maxIteraciones: 2, temperatura: 1.0 },
  normal: { variantes: 4, maxIteraciones: 2, temperatura: 0.95 },
  rapido: { variantes: 3, maxIteraciones: 1, temperatura: 0.9 }
}

// ============================================================
// Helpers de LLM (Gemini en modo JSON)
// ============================================================

/** Extrae el primer bloque JSON válido de un texto (tolera fences ```json). */
function parsearJSON(texto, fallback) {
  if (!texto) return fallback
  let t = texto.trim()
  // Quitar fences de markdown si vinieron
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    return JSON.parse(t)
  } catch {
    // Buscar el primer [ ... ] o { ... } balanceado de forma simple
    const inicioArr = t.indexOf('[')
    const inicioObj = t.indexOf('{')
    const inicio = inicioArr === -1 ? inicioObj
      : inicioObj === -1 ? inicioArr
      : Math.min(inicioArr, inicioObj)
    if (inicio === -1) return fallback
    const cierre = t[inicio] === '[' ? t.lastIndexOf(']') : t.lastIndexOf('}')
    if (cierre <= inicio) return fallback
    try {
      return JSON.parse(t.slice(inicio, cierre + 1))
    } catch {
      return fallback
    }
  }
}

/**
 * Llama a Gemini en modo JSON con un system prompt y un prompt de usuario.
 * Devuelve el objeto/array parseado (o `fallback` si algo falla).
 */
async function llamarJSON(systemPrompt, userPrompt, opciones = {}) {
  if (!genAI) throw new Error('No hay GEMINI_API_KEY configurada')
  const {
    temperatura = 0.9,
    descripcion = 'estudio_creativo',
    prioridad = PRIORIDAD.NORMAL,
    fallback = null,
    maxTokens = 8192
  } = opciones

  const model = genAI.getGenerativeModel({
    model: MODELO,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: temperatura,
      maxOutputTokens: maxTokens,
      responseMimeType: 'application/json'
    }
  })

  const result = await encolar(
    () => model.generateContent(userPrompt),
    { prioridad, descripcion, timeoutMs: 60_000 }
  )
  const texto = result.response.text() || ''
  return parsearJSON(texto, fallback)
}

// ============================================================
// System prompts por rol (anclados a la persona del agente)
// ============================================================

function systemValentina(agente) {
  const voz = agente?.manifiesto ? `\n\n## Tu manifiesto\n${agente.manifiesto}` : ''
  return `Sos Valentina Ríos, Directora Creativa (CGO) de MercadoLocal y experta MUNDIAL en prompts para modelos de imagen/video (nano banana / Gemini). Escribís prompts que son INSTRUCCIONES DE INGENIERÍA, no descripciones: el modelo no lee tu intención, ejecuta tus sustantivos.${voz}

# Cómo construís CADA prompt (no negociable)
1. ANCLAJE LOCAL: la escena vive en la ciudad real del ADN (pampa llana, casas bajas, calles anchas, los landmarks indicados). SIEMPRE incluís el bloque EVITAR textual, porque sin él el modelo se va a una villa europea.
2. MARCA: gradiente azul→violeta, el carrito, la caja/mochila de envío violeta. Todo pertenece al mismo mundo.
3. FUNCIÓN: la pieza cumple un trabajo del embudo. "Linda" no es objetivo.
4. ESCENA + ARMADO: la IA genera la FOTO (sin texto ni logo quemado, que el modelo los deforma); el logo y el copy van en una capa de ARMADO encima. Describís ambas por separado.
5. TÉCNICA: 9:16 vertical, fotografía ultrarrealista, un lado despejado para texto, nada de manos imposibles, multitudes ni texto legible dentro de la imagen.

# Diversidad
Cuando te pidan N variantes, cada una tiene que atacar la función desde un ÁNGULO distinto (héroe del producto, gente real usándolo, detalle macro, escena de pueblo, antes/después, etc.). Nada de N veces lo mismo.

# Salida
Respondés SIEMPRE en JSON válido, sin texto fuera del JSON.`
}

function systemMatiMarca(agente) {
  const voz = agente?.manifiesto ? `\n\n## Tu manifiesto\n${agente.manifiesto}` : ''
  return `Sos Mati Ferro, Director de Arte de MercadoLocal. Sos el ojo crítico: auditás prompts antes de que se gaste un crédito. No creás, protegés.${voz}

# CAPA 1 — MARCA & COHERENCIA
Tu única pregunta: ¿esta pieza es INCONFUNDIBLEMENTE MercadoLocal? Puntuás 0-10 mirando:
- ¿Está el gradiente azul (#2563eb) → violeta (#7c3aed) presente y bien usado?
- ¿Aparece el carrito y/o la caja/mochila de envío VIOLETA como objeto de marca?
- ¿El armado (logo + copy) está separado de la imagen, NO quemado en la foto?
- ¿Se siente premium y propio, o genérico/"de stock"/"de juguete"?
Sé filoso y concreto. "No me gusta" no es feedback; "no veo el violeta de marca, está en 6, sumando la caja de envío violeta sube a 9" sí.
Respondés SIEMPRE en JSON válido, sin texto fuera del JSON.`
}

function systemMatiLocalia() {
  return `Sos Mati Ferro con el sombrero TÉCNICO y de LOCALÍA. Auditás si la pieza va a salir bien y si parece el pueblo real.

# CAPA 2 — LOCALÍA & TÉCNICA
Puntuás 0-10 mirando DOS cosas:
- LOCALÍA: ¿la escena es la pampa bonaerense real (terreno llano, cielo amplio, casas bajas, calles anchas/de tierra) o se va a ir a una postal europea (empedrado, piedra, balcones de hierro, colinas)? ¿Está el bloque EVITAR presente y completo?
- TÉCNICA: ¿el modelo lo va a poder generar SIN romperlo? Castigá: texto legible dentro de la imagen, logos quemados, manos en primer plano, multitudes, objetos imposibles. ¿Es 9:16 con un lado despejado? ¿Es fotorrealista, no ilustración de juguete?
Tu "esto se va a ver europeo, te lo firmo" tiene que tener fundamento.
Respondés SIEMPRE en JSON válido, sin texto fuera del JSON.`
}

function systemDiegoFuncion(agente) {
  const voz = agente?.manifiesto ? `\n\n## Tu manifiesto\n${agente.manifiesto}` : ''
  return `Sos Diego, CEO de MercadoLocal. Mirás cada pieza con UNA pregunta de negocio: ¿cumple su función del embudo y para el scroll?${voz}

# CAPA 3 — FUNCIÓN & CONVERSIÓN
Puntuás 0-10:
- ¿La pieza cumple EXACTAMENTE la función que se le pidió (awareness, activar usados, comunicar envío hoy, bajar el miedo a comprar, etc.)?
- ¿Para el scroll en 1 segundo SIN depender del texto? (la foto sola tiene que comunicar)
- ¿Es oportuna con los datos reales (rubro/estación/usados) que se pasaron?
- ¿Le habla al comprador local de Lobos, no a un público genérico?
Cero marketing vacío. Si no convierte, no sirve por más linda que sea.
Respondés SIEMPRE en JSON válido, sin texto fuera del JSON.`
}

// ============================================================
// Pasos del pipeline
// ============================================================

/** Trae la lista negra de fallas (M2) como texto para inyectar. */
async function listaNegraComoTexto(caso) {
  const fallas = await AprendizajeCreativo
    .find({ activo: true, $or: [{ casos: caso }, { casos: { $size: 0 } }] })
    .sort({ conteo: -1 })
    .limit(8)
    .lean()
  if (fallas.length === 0) return ''
  const items = fallas.map(f => `- ${f.descripcion} (visto ${f.conteo}x)`).join('\n')
  return `\n\n# ⛔ ERRORES FRECUENTES QUE NO PODÉS COMETER (aprendidos de rechazos previos)\n${items}\nEstos son los errores que más rechazó el equipo. Prevenilos en el prompt desde el arranque.`
}

/** Trae piezas que ya funcionaron (M1 liviano) como referencia. */
async function referenciasGanadorasComoTexto(caso) {
  const ganadoras = await PromptCreativo
    .find({ caso, 'feedback.funciono': true })
    .sort({ 'scorecard.promedio': -1 })
    .limit(2)
    .lean()
  if (ganadoras.length === 0) return ''
  const items = ganadoras.map(g => `- "${g.titulo}": ${g.escena.slice(0, 220)}`).join('\n')
  return `\n\n# ✅ PIEZAS QUE YA FUNCIONARON para esta función (inspirate en lo que convirtió, sin copiar)\n${items}`
}

/** Paso 2 — Valentina genera N variantes diversas. */
async function generarVariantes({ caso, cantidad, ciudadSlug, temperatura, contextoDatos, brief, valentina }) {
  const listaNegra = await listaNegraComoTexto(caso)
  const referencias = await referenciasGanadorasComoTexto(caso)

  const userPrompt = `${adnComoTexto(ciudadSlug)}

${contextoDatos}
${listaNegra}${referencias}

# 🎯 FUNCIÓN DE ESTE SET
Caso: "${caso}" → ${descripcionCaso(caso)}
${brief ? `Brief extra del fundador: ${brief}` : ''}

# TAREA
Generá ${cantidad} variantes DISTINTAS de prompt para nano banana, cada una atacando esta función desde un ángulo diferente. Cada prompt tiene que estar listo para pegar y generar una imagen vertical 9:16 inconfundiblemente MercadoLocal y de la pampa real.

Devolvé un JSON array con exactamente ${cantidad} objetos, cada uno con estas claves:
{
  "titulo": "nombre corto y humano de la pieza (qué es y su ángulo)",
  "angulo": "el ángulo creativo en una frase",
  "escena": "descripción detallada de la FOTO que genera la IA (sin texto ni logo quemado)",
  "armado": "qué se monta encima en el layout: logo MercadoLocal (gradiente azul→violeta), copy sugerido, dónde va",
  "movimiento": "si fuera video, qué movimiento sutil (zoom in lento, paneo, etc.)",
  "prompt": "EL PROMPT COMPLETO final en español, ultra detallado, que incluye: la escena anclada a la ciudad real, el estilo fotográfico 9:16, los colores/objeto de marca, y el bloque EVITAR textual al final"
}
Solo el JSON array, sin texto afuera.`

  const variantes = await llamarJSON(systemValentina(valentina), userPrompt, {
    temperatura,
    descripcion: `creativa:generar:${caso}`,
    prioridad: PRIORIDAD.NORMAL,
    fallback: []
  })
  return Array.isArray(variantes) ? variantes.slice(0, cantidad) : []
}

/** Construye el texto compacto de las variantes para pasárselo a un crítico. */
function variantesParaCritico(variantes) {
  return variantes.map((v, i) =>
    `### Variante ${i}\nTítulo: ${v.titulo || '(sin título)'}\nÁngulo: ${v.angulo || ''}\nEscena: ${v.escena || ''}\nArmado: ${v.armado || ''}\nPrompt: ${v.prompt || ''}`
  ).join('\n\n')
}

/** Ejecuta UNA capa de verificación sobre TODAS las variantes (1 sola llamada). */
async function verificarCapa({ systemPrompt, capa, caso, variantes, descripcion }) {
  const userPrompt = `Función de las piezas — caso "${caso}": ${descripcionCaso(caso)}

Acá están las ${variantes.length} variantes a auditar:

${variantesParaCritico(variantes)}

Puntuá CADA variante de 0 a 10 según tu capa. Devolvé un JSON array con un objeto por variante, en orden:
{
  "indice": <número de la variante>,
  "score": <0-10>,
  "problemas": ["problema concreto 1", "problema concreto 2"],
  "porque": "1-2 frases justificando el puntaje y qué subiría el score"
}
Solo el JSON array.`

  const evals = await llamarJSON(systemPrompt, userPrompt, {
    temperatura: 0.3,
    descripcion: `creativa:verif:${capa}:${descripcion}`,
    prioridad: PRIORIDAD.NORMAL,
    fallback: []
  })
  // Normalizamos: aseguramos un eval por variante
  const porIndice = new Map()
  if (Array.isArray(evals)) {
    evals.forEach((e, pos) => {
      const idx = Number.isInteger(e?.indice) ? e.indice : pos
      porIndice.set(idx, {
        score: Math.max(0, Math.min(10, Number(e?.score) || 0)),
        problemas: Array.isArray(e?.problemas) ? e.problemas.filter(Boolean).slice(0, 4) : [],
        porque: String(e?.porque || '').slice(0, 400)
      })
    })
  }
  return variantes.map((_, i) => porIndice.get(i) || { score: 0, problemas: ['el crítico no devolvió evaluación'], porque: '' })
}

/** Corre las 3 capas y arma el scorecard de cada variante. */
async function verificarTodas({ variantes, caso, criticos }) {
  const [evMarca, evLocalia, evFuncion] = await Promise.all([
    verificarCapa({ systemPrompt: systemMatiMarca(criticos.mati), capa: 'marca', caso, variantes, descripcion: 'r' }),
    verificarCapa({ systemPrompt: systemMatiLocalia(), capa: 'localia', caso, variantes, descripcion: 'r' }),
    verificarCapa({ systemPrompt: systemDiegoFuncion(criticos.diego), capa: 'funcion', caso, variantes, descripcion: 'r' })
  ])

  return variantes.map((v, i) => {
    const marca = evMarca[i]
    const localia = evLocalia[i]
    const funcion = evFuncion[i]
    const promedio = Math.round(((marca.score + localia.score + funcion.score) / 3) * 10) / 10
    const aprobada = marca.score >= UMBRAL && localia.score >= UMBRAL && funcion.score >= UMBRAL
    return { ...v, scorecard: { marca, localia, funcion, promedio }, aprobada }
  })
}

/**
 * Paso 4 — Valentina reescribe TODAS las variantes flojas en UNA sola llamada.
 * Batchear el refinamiento (en vez de 1 llamada por variante) reduce mucho la
 * cantidad de requests a Gemini → el set se arma mucho más rápido y barato.
 */
async function refinarVariantes({ flojas, caso, ciudadSlug, contextoDatos, valentina }) {
  if (flojas.length === 0) return []

  const bloques = flojas.map((v, i) => {
    const sc = v.scorecard
    const problemas = [
      ...sc.marca.problemas.map(p => `[Marca] ${p}`),
      ...sc.localia.problemas.map(p => `[Localía/Técnica] ${p}`),
      ...sc.funcion.problemas.map(p => `[Función] ${p}`)
    ].join('; ')
    return `### Variante ${i} (puntajes: marca ${sc.marca.score}, localía/técnica ${sc.localia.score}, función ${sc.funcion.score})
Título: ${v.titulo}
Escena: ${v.escena}
Armado: ${v.armado}
Prompt actual: ${v.prompt}
Problemas a corregir: ${problemas || '(sin problemas explícitos; subí el nivel general)'}`
  }).join('\n\n')

  const userPrompt = `${adnComoTexto(ciudadSlug)}

${contextoDatos}

# 🎯 FUNCIÓN — caso "${caso}": ${descripcionCaso(caso)}

# VARIANTES A CORREGIR (${flojas.length})
Cada una tiene los problemas que marcaron los críticos. Corregí TODOS los problemas de cada una sin perder lo que ya estaba bien. El objetivo es que cada una supere los 8 en las tres capas.

${bloques}

Devolvé un JSON array con exactamente ${flojas.length} objetos, en el MISMO orden que las variantes de arriba, cada uno con las claves: titulo, angulo, escena, armado, movimiento, prompt. Solo el JSON array.`

  const refinadas = await llamarJSON(systemValentina(valentina), userPrompt, {
    temperatura: 0.85,
    descripcion: `creativa:refinar:${caso}`,
    prioridad: PRIORIDAD.NORMAL,
    fallback: []
  })

  // Mapeamos por orden; si el modelo no devolvió una, dejamos la original.
  return flojas.map((v, i) => {
    const r = Array.isArray(refinadas) ? refinadas[i] : null
    return r && r.prompt ? r : v
  })
}

/** Paso M2 — acumula los problemas de los críticos en la lista negra. */
async function aprenderDeFallas(evaluadas, caso) {
  const aMapear = [
    { capa: 'marca', problemas: [] },
    { capa: 'localia', problemas: [] },
    { capa: 'funcion', problemas: [] }
  ]
  for (const v of evaluadas) {
    if (v.scorecard.marca.score < UMBRAL) aMapear[0].problemas.push(...v.scorecard.marca.problemas)
    if (v.scorecard.localia.score < UMBRAL) aMapear[1].problemas.push(...v.scorecard.localia.problemas)
    if (v.scorecard.funcion.score < UMBRAL) aMapear[2].problemas.push(...v.scorecard.funcion.problemas)
  }

  for (const { capa, problemas } of aMapear) {
    for (const problema of problemas) {
      const limpio = String(problema || '').trim()
      if (limpio.length < 8) continue
      // Clave normalizada: minúsculas, sin tildes, primeras ~80 chars
      const patron = limpio.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .slice(0, 80)
      try {
        await AprendizajeCreativo.findOneAndUpdate(
          { patron },
          {
            $setOnInsert: { patron, capa },
            $set: { descripcion: limpio.slice(0, 280), ultimaVez: new Date(), activo: true },
            $inc: { conteo: 1 },
            $addToSet: { casos: caso }
          },
          { upsert: true, new: true }
        )
      } catch (e) {
        // Una falla de aprendizaje no debe romper la generación
        console.warn('No se pudo registrar falla creativa:', e.message)
      }
    }
  }
}

// ============================================================
// API pública
// ============================================================

/**
 * Genera un set creativo completo para una función del embudo.
 *
 * @param {object} opts
 * @param {string} opts.caso        - clave de CASOS (ej. 'usados', 'envio')
 * @param {number} [opts.cantidad]  - cuántos prompts aprobados querés (default según esfuerzo)
 * @param {string} [opts.ciudadSlug]- ciudad del ADN (default 'lobos')
 * @param {string} [opts.esfuerzo]  - 'alto' | 'normal' | 'rapido'
 * @param {string} [opts.brief]     - indicación libre extra del fundador
 * @param {function} [opts.onPaso]  - callback(texto) para reportar progreso (job async)
 * @returns {Promise<{caso, ciudadSlug, aprobados:Array, descartados:Array, meta}>}
 */
export async function generarSetCreativo(opts = {}) {
  if (!genAI) throw new Error('No hay GEMINI_API_KEY configurada — el Estudio Creativo no puede generar')

  const caso = opts.caso
  if (!caso || !CASOS[caso]) {
    throw new Error(`Caso inválido. Casos válidos: ${Object.keys(CASOS).join(', ')}`)
  }
  const ciudadSlug = opts.ciudadSlug || CIUDAD_DEFECTO
  const perfil = PERFILES_ESFUERZO[opts.esfuerzo] || PERFILES_ESFUERZO.normal
  const cantidadObjetivo = Math.max(1, Math.min(opts.cantidad || perfil.variantes, 6))
  const inicio = Date.now()
  const onPaso = typeof opts.onPaso === 'function' ? opts.onPaso : () => {}

  // Cargamos los agentes (para la voz/persona). Si falta alguno, seguimos igual.
  const [valentina, mati, diego] = await Promise.all([
    Agente.findOne({ slug: 'valentina_cgo' }).lean(),
    Agente.findOne({ slug: 'mati_arte' }).lean(),
    Agente.findOne({ slug: 'diego_ceo' }).lean()
  ])
  const criticos = { mati, diego }

  // Brief: datos reales de la app
  onPaso('Leyendo los datos reales de la app...')
  const contextoDatos = await datosCreativaComoTexto()

  // Paso 2 — generación diversa (best-of-N)
  onPaso(`Valentina genera variantes (esfuerzo ${opts.esfuerzo || 'normal'})...`)
  let variantes = await generarVariantes({
    caso,
    cantidad: Math.max(cantidadObjetivo + 1, perfil.variantes), // generamos de más para el torneo
    ciudadSlug,
    temperatura: perfil.temperatura,
    contextoDatos,
    brief: opts.brief,
    valentina
  })

  if (variantes.length === 0) {
    throw new Error('La generación no devolvió variantes (revisá la cuota de Gemini)')
  }

  // Marcamos iteraciones por variante
  variantes = variantes.map(v => ({ ...v, _iteraciones: 0 }))

  // Paso 3 — verificación inicial
  onPaso(`Mati y Diego verifican ${variantes.length} variantes en 3 capas...`)
  let evaluadas = await verificarTodas({ variantes, caso, criticos })

  // M2 — aprender de las fallas de esta ronda
  await aprenderDeFallas(evaluadas, caso)

  // Paso 4 — refinamiento + torneo (hasta maxIteraciones)
  for (let ronda = 0; ronda < perfil.maxIteraciones; ronda++) {
    const flojas = evaluadas.filter(v => !v.aprobada)
    if (flojas.length === 0) break // todas pasaron, no hace falta refinar

    // Refinamos TODAS las flojas en UNA sola llamada (batch) → menos requests.
    onPaso(`Refinando ${flojas.length} variantes flojas (ronda ${ronda + 1})...`)
    const refinadasRaw = await refinarVariantes({ flojas, caso, ciudadSlug, contextoDatos, valentina })
    const refinadas = refinadasRaw.map((r, i) => ({ ...r, _iteraciones: (flojas[i]._iteraciones || 0) + 1 }))

    // Re-verificamos las refinadas
    onPaso(`Re-verificando las refinadas (ronda ${ronda + 1})...`)
    const reEval = await verificarTodas({ variantes: refinadas, caso, criticos })
    await aprenderDeFallas(reEval, caso)

    // Reemplazamos las flojas por sus versiones refinadas (nos quedamos con la mejor)
    const noFlojas = evaluadas.filter(v => v.aprobada)
    const mejoradas = reEval.map((nuevo, i) => {
      const viejo = flojas[i]
      return nuevo.scorecard.promedio >= viejo.scorecard.promedio ? nuevo : viejo
    })
    evaluadas = [...noFlojas, ...mejoradas]
  }

  onPaso('Armando el set final y guardando...')
  // Torneo: ranking por promedio
  evaluadas.sort((a, b) => b.scorecard.promedio - a.scorecard.promedio)

  // Aprobados estrictos (3 capas >= UMBRAL). Si no hay suficientes, completamos
  // con los mejores por promedio para no devolver un set vacío (siempre con su
  // scorecard honesto, así el fundador ve por qué cada uno está donde está).
  const estrictos = evaluadas.filter(v => v.aprobada)
  let aprobados = estrictos.slice(0, cantidadObjetivo)
  if (aprobados.length < cantidadObjetivo) {
    const resto = evaluadas.filter(v => !aprobados.includes(v))
    aprobados = [...aprobados, ...resto].slice(0, cantidadObjetivo)
  }
  const descartados = evaluadas.filter(v => !aprobados.includes(v))

  // Persistimos los aprobados como entregable
  const docs = await Promise.all(aprobados.map(v => new PromptCreativo({
    caso,
    ciudadSlug,
    titulo: String(v.titulo || `Pieza ${caso}`).slice(0, 160),
    prompt: String(v.prompt || '').slice(0, 6000),
    escena: String(v.escena || '').slice(0, 4000),
    armado: String(v.armado || '').slice(0, 2000),
    movimiento: String(v.movimiento || '').slice(0, 1000),
    negativo: EVITAR,
    scorecard: {
      marca: v.scorecard.marca,
      localia: v.scorecard.localia,
      funcion: v.scorecard.funcion,
      promedio: v.scorecard.promedio
    },
    iteraciones: v._iteraciones || 0,
    versionAdn: VERSION_ADN,
    // Siempre se entrega como 'aprobado' (pasó el torneo o es el mejor del set);
    // el scorecard cuenta la verdad real de cada capa, sin maquillaje.
    estado: 'aprobado',
    generadoPor: 'valentina_cgo'
  }).save()))

  return {
    caso,
    ciudadSlug,
    descripcionCaso: descripcionCaso(caso),
    aprobados: docs,
    descartados: descartados.map(v => ({
      titulo: v.titulo,
      scorecard: v.scorecard,
      motivo: 'no superó el torneo de las 3 capas'
    })),
    meta: {
      generadas: variantes.length,
      aprobadosEstrictos: estrictos.length,
      umbral: UMBRAL,
      esfuerzo: opts.esfuerzo || 'normal',
      versionAdn: VERSION_ADN,
      duracionMs: Date.now() - inicio
    }
  }
}

/**
 * Registra el feedback del fundador sobre un prompt (cierre de loop M1/M3).
 * @param {string} promptId
 * @param {object} feedback - { usado?:bool, funciono?:bool, nota?:string }
 */
export async function registrarFeedbackCreativo(promptId, feedback = {}) {
  const doc = await PromptCreativo.findById(promptId)
  if (!doc) throw new Error('Prompt no encontrado')
  if (feedback.usado !== undefined) doc.feedback.usado = !!feedback.usado
  if (feedback.funciono !== undefined) doc.feedback.funciono = feedback.funciono === null ? null : !!feedback.funciono
  if (feedback.nota !== undefined) doc.feedback.nota = String(feedback.nota).slice(0, 500)
  doc.feedback.fecha = new Date()
  await doc.save()
  return doc
}

/** Lista los casos disponibles (para poblar la UI). */
export function listarCasos() {
  return Object.entries(CASOS).map(([clave, descripcion]) => ({ clave, descripcion }))
}

// ============================================================
// TRABAJOS ASÍNCRONOS — el pipeline tarda 1-2 min (cola de Gemini), MUCHO
// más que el timeout HTTP del front. Por eso la generación corre en segundo
// plano: se crea un TrabajoCreativo, se devuelve su id, y el front pollea.
// ============================================================

/**
 * Crea un trabajo y dispara el pipeline en segundo plano (fire-and-forget).
 * Devuelve el documento del trabajo (estado 'procesando') de inmediato.
 */
export async function crearTrabajoCreativo(opts = {}) {
  if (!genAI) throw new Error('No hay GEMINI_API_KEY configurada — el Estudio Creativo no puede generar')
  const caso = opts.caso
  if (!caso || !CASOS[caso]) {
    throw new Error(`Caso inválido. Casos válidos: ${Object.keys(CASOS).join(', ')}`)
  }

  const trabajo = await new TrabajoCreativo({
    caso,
    ciudadSlug: opts.ciudadSlug || CIUDAD_DEFECTO,
    esfuerzo: opts.esfuerzo || 'normal',
    brief: opts.brief || '',
    estado: 'procesando',
    paso: 'En cola...'
  }).save()

  // Disparamos el pipeline SIN await: corre en background y actualiza el doc.
  setImmediate(() => ejecutarTrabajo(trabajo._id, opts))

  return trabajo
}

/** Ejecuta el pipeline de un trabajo y guarda el resultado/error en el doc. */
async function ejecutarTrabajo(trabajoId, opts) {
  // Actualizador de progreso "throttleado" por estado (no spamea la DB).
  const onPaso = (texto) => {
    TrabajoCreativo.findByIdAndUpdate(trabajoId, { $set: { paso: texto } }).catch(() => {})
  }

  try {
    const resultado = await generarSetCreativo({ ...opts, onPaso })
    // Guardamos un snapshot plano (los docs Mongoose se serializan a JSON).
    const plano = JSON.parse(JSON.stringify(resultado))
    await TrabajoCreativo.findByIdAndUpdate(trabajoId, {
      $set: { estado: 'listo', resultado: plano, paso: 'Listo', error: '' }
    })
    console.log(`🎨 [CREATIVA] trabajo ${trabajoId} listo (${plano.aprobados?.length || 0} prompts)`)
  } catch (e) {
    console.error(`❌ [CREATIVA] trabajo ${trabajoId} falló:`, e.message)
    await TrabajoCreativo.findByIdAndUpdate(trabajoId, {
      $set: { estado: 'error', error: e.message || 'Error desconocido', paso: 'Error' }
    }).catch(() => {})
  }
}

/** Devuelve el estado/resultado de un trabajo (para el polling del front). */
export async function obtenerTrabajoCreativo(id) {
  return TrabajoCreativo.findById(id).lean()
}
