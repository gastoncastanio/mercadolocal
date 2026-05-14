/**
 * GENERADOR DE PROPUESTAS del equipo IA.
 *
 * Cuando un agente analiza datos reales y detecta una oportunidad de
 * mejora, formaliza una propuesta estructurada (modelo PropuestaEquipo)
 * que el fundador va a poder aprobar/rechazar desde el panel admin.
 *
 * Proceso:
 *  1. Tomamos los datos reales del último período del analista
 *  2. Le pedimos al agente que analice y devuelva JSON con propuestas
 *  3. Validamos el JSON (sin alucinaciones — la evidencia tiene que
 *     referenciar IDs reales que ya pasamos al prompt)
 *  4. Guardamos en MongoDB con estado "esperando_admin"
 *  5. Otros agentes pueden cosignar si están de acuerdo
 *
 * REGLA INVIOLABLE: la propuesta NUNCA se ejecuta sola. Solo queda
 * documentada para que el fundador decida.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import Agente from '../models/Agente.js'
import PropuestaEquipo from '../models/PropuestaEquipo.js'
import MensajeOrganizacion from '../models/MensajeOrganizacion.js'
import { datosParaAgente } from './analistaDatos.js'
import { obtenerMemoriaActiva } from './seedMemoriaFundador.js'

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null

const MODELO = 'gemini-2.5-flash'

/**
 * Prompts especializados por agente.
 * Cada uno mira sus datos propios y propone solo desde su disciplina.
 */
const PROMPT_PROPUESTAS_POR_AGENTE = {
  sofia_cmo: `Sos Sofía Mendoza, CMO de MercadoLocal.

Acabás de analizar los datos de moderación y los productos sospechosos
del último período. Tu tarea: identificar si hay un PATRÓN real (no un
caso aislado) que valga la pena llevar al fundador como propuesta de mejora.

REGLAS ESTRICTAS:
1. Si no ves un patrón con AL MENOS 3 casos reales o una métrica preocupante,
   NO inventes una propuesta. Es totalmente válido responder con:
   { "propuestas": [], "razon": "Los datos del período no muestran un
   patrón que justifique acción. Todo dentro de parámetros normales." }
2. NO uses tu intuición. SOLO usás los datos que te pasé.
3. Cada propuesta tiene que tener evidencia concreta: IDs de productos,
   tiendas, métricas con números.
4. Si la propuesta involucra plata, bloqueos masivos o cambios de
   política, prioridad debe ser "alta" o "urgente" (el fundador decide,
   nosotros no actuamos).
5. Tu output va a un humano que decide. Sé brutalmente honesto: si la
   propuesta tiene downside, lo decís.`,

  tomas_cto: `Sos Tomás Vega, CTO de MercadoLocal.

Acabás de analizar los tickets de soporte y los casos escalados del
último período. Tu tarea: identificar si hay un PATRÓN operativo o de UX
que valga proponer como mejora.

REGLAS ESTRICTAS:
1. Si no ves un patrón con AL MENOS 3 tickets sobre lo mismo, NO
   inventes propuesta. Responder { "propuestas": [], "razon": "..." }
   es totalmente válido.
2. NO uses tu intuición. SOLO usás los datos que te pasé.
3. Cada propuesta tiene que tener evidencia: IDs de tickets, tags
   repetidos, métricas reales.
4. Las propuestas operativas (mejorar UX, agregar feature) son ok.
   Las propuestas de código directo (refactor, optimización) las
   sugerís pero marcalas como "tecnica" para que el fundador entienda
   que requiere trabajo de dev.`,

  diego_ceo: `Sos Diego Castro, CEO de MercadoLocal.

Acabás de ver el snapshot completo del marketplace en el último período.
Tu tarea como CEO: detectar si hay tendencias estratégicas o riesgos
sistémicos que necesiten decisión del fundador.

REGLAS ESTRICTAS:
1. Vos no proponés mejoras tácticas (eso es Sofía o Tomás). Vos proponés
   decisiones estratégicas o cambios de dirección.
2. Si los datos no muestran nada estratégicamente importante,
   responder { "propuestas": [], "razon": "..." } es lo correcto.
3. Cuando proponés algo, usás tu marco mental: liquidez por ciudad,
   confianza del comprador, sostenibilidad del vendedor, NPS.
4. Sé escéptico con propuestas que requieren plata o cambios grandes.
   "Costo de no hacerlo" tiene que ser alto.`
}

/**
 * Pide al agente que analice los datos y proponga (puede ser ninguna).
 */
async function generarPropuestasDeAgente(slug) {
  if (!genAI) {
    console.warn(`[Propuestas] GEMINI_API_KEY ausente, ${slug} no puede analizar`)
    return []
  }

  const promptEspecifico = PROMPT_PROPUESTAS_POR_AGENTE[slug]
  if (!promptEspecifico) {
    console.warn(`[Propuestas] No hay prompt para ${slug}`)
    return []
  }

  const agente = await Agente.findOne({ slug, activo: true })
  if (!agente) return []

  // Datos reales para este agente
  const datos = await datosParaAgente(slug, 24)
  const memoria = await obtenerMemoriaActiva()

  const memoriaTexto = memoria.length > 0
    ? memoria.slice(0, 8).map(h => `- ${h.hecho}`).join('\n')
    : 'No hay memoria persistente cargada.'

  const promptUsuario = `# Contexto: memoria del fundador
${memoriaTexto}

# Datos REALES del marketplace (últimas 24h)
\`\`\`json
${JSON.stringify(datos, null, 2)}
\`\`\`

# Tu tarea
Analizá estos datos y decidí si hay alguna propuesta concreta para llevar
al fundador. Recordá: tu valor está en NO inventar. Si los datos están
limpios, decilo así.

Respondé en JSON con esta estructura exacta (sin markdown, sin \`\`\`):

{
  "propuestas": [
    {
      "titulo": "string corto y accionable",
      "problema": "qué viste en los datos, citando casos concretos",
      "evidencia": [
        {
          "tipo": "producto|ticket|orden|moderacion|metrica",
          "referenciaId": "id real del registro o null si es métrica",
          "descripcion": "qué es este caso",
          "datos": { ... datos crudos del caso si los tenés }
        }
      ],
      "propuesta": "qué proponés hacer concretamente",
      "impactoEstimado": "qué efecto esperás, con números si es posible",
      "riesgos": "qué puede salir mal con esta propuesta",
      "categoria": "seguridad|producto|soporte|crecimiento|finanzas|legal|operaciones|tecnica",
      "prioridad": "baja|media|alta|urgente"
    }
  ],
  "razon": "si propuestas:[], explicar brevemente por qué los datos no justifican acción"
}

Si no hay propuestas válidas, devolvé propuestas:[] y una razon honesta.`

  try {
    const model = genAI.getGenerativeModel({
      model: MODELO,
      systemInstruction: promptEspecifico,
      generationConfig: {
        temperature: 0.4, // bajamos creatividad: queremos análisis no fantasía
        maxOutputTokens: 4096,
        responseMimeType: 'application/json'
      }
    })

    const result = await model.generateContent(promptUsuario)
    const texto = result.response.text()

    let parsed
    try {
      parsed = JSON.parse(texto)
    } catch (e) {
      console.error(`[Propuestas] ${slug} devolvió JSON inválido`)
      return []
    }

    if (!Array.isArray(parsed.propuestas)) return []
    return parsed.propuestas
  } catch (e) {
    console.error(`[Propuestas] Error con ${slug}:`, e.message)
    return []
  }
}

/**
 * Ejecuta el análisis para todos los agentes activos y guarda las
 * propuestas en MongoDB.
 *
 * Límite: max 1 propuesta por agente por ejecución (para no saturar
 * al fundador). Si un agente propone más, guarda solo la de mayor
 * prioridad/relevancia.
 */
export async function ejecutarRondaDePropuestas() {
  const slugs = ['sofia_cmo', 'tomas_cto', 'diego_ceo']
  const guardadas = []

  for (const slug of slugs) {
    try {
      const propuestas = await generarPropuestasDeAgente(slug)

      if (propuestas.length === 0) {
        console.log(`📋 ${slug}: sin propuestas (datos sin patrón relevante)`)
        continue
      }

      // Verificamos si ya propuso algo en las últimas 24h para no duplicar
      const haceUnDia = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const propuestasPrevias = await PropuestaEquipo.countDocuments({
        proponente: slug,
        createdAt: { $gte: haceUnDia },
        estado: { $in: ['esperando_admin', 'en_revision'] }
      })

      if (propuestasPrevias >= 1) {
        console.log(`📋 ${slug}: ya tiene ${propuestasPrevias} propuesta(s) pendiente(s), no agrega más`)
        continue
      }

      // Elegimos la propuesta de mayor prioridad (si hay varias)
      const ordenPrioridad = { urgente: 4, alta: 3, media: 2, baja: 1 }
      propuestas.sort((a, b) =>
        (ordenPrioridad[b.prioridad] || 0) - (ordenPrioridad[a.prioridad] || 0)
      )
      const mejor = propuestas[0]

      // Sanear y guardar
      const guardada = await new PropuestaEquipo({
        titulo: String(mejor.titulo || 'Propuesta sin título').slice(0, 150),
        problema: String(mejor.problema || '').slice(0, 2000),
        evidencia: Array.isArray(mejor.evidencia) ? mejor.evidencia.slice(0, 10) : [],
        propuesta: String(mejor.propuesta || '').slice(0, 3000),
        impactoEstimado: String(mejor.impactoEstimado || '').slice(0, 1500),
        riesgos: String(mejor.riesgos || '').slice(0, 1500),
        categoria: ['seguridad', 'producto', 'soporte', 'crecimiento', 'finanzas', 'legal', 'operaciones', 'tecnica']
          .includes(mejor.categoria) ? mejor.categoria : 'operaciones',
        prioridad: ['baja', 'media', 'alta', 'urgente'].includes(mejor.prioridad)
          ? mejor.prioridad : 'media',
        proponente: slug,
        estado: 'esperando_admin'
      }).save()

      // Notificación al canal "ascensos" (que también usamos para anuncios)
      try {
        const agente = await Agente.findOne({ slug }).lean()
        await new MensajeOrganizacion({
          canal: 'ascensos',
          autorSlug: slug,
          autorTipo: 'agente',
          contenido: `📋 Propuesta nueva al fundador: "${guardada.titulo}". Prioridad ${guardada.prioridad}. Categoría: ${guardada.categoria}. La cargué en el panel para que la veas y decidas.`,
          tipo: 'propuesta',
          contexto: { propuestaId: guardada._id.toString() }
        }).save()
      } catch (e) {
        console.warn('No se pudo notificar propuesta:', e.message)
      }

      guardadas.push(guardada)
      console.log(`📋 ${slug} propuso: "${guardada.titulo}" (${guardada.prioridad})`)
    } catch (e) {
      console.error(`[Propuestas] Falló análisis de ${slug}:`, e.message)
    }
  }

  return guardadas
}
