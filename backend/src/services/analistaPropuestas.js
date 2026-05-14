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

Acabás de analizar los datos del marketplace. Sos PROACTIVA: si ves
un caso significativo (aunque sea solo 1) que merece la atención del
fundador, lo proponés. No esperás a tener 10 casos para hablar.

REGLAS:
1. CON DATOS, podés proponer. SIN datos, NO inventás.
   Mínimo: 1 caso real concreto Y un argumento sólido.
2. Sé proactiva pero no inventiva. Si tu propuesta no tiene evidencia
   concreta del JSON que te pasé, NO la hagas.
3. Cada propuesta debe citar IDs reales, números reales, datos reales
   del JSON que te entrego.
4. Marketplaces sin actividad (cero productos, cero ventas) SON UN
   PROBLEMA que vale proponer (ej: "necesitamos onboarding de
   primeros vendedores YA, sin oferta no hay demanda").
5. Sé honesta con el downside de cada propuesta.

PRIORIDADES DE TU ÁREA (orden de relevancia):
- Marketplace sin actividad / sin oferta inicial → URGENTE
- Productos con patrones de fraude → ALTA/URGENTE
- Falta de validación de vendedores → ALTA
- UX de validación pobre → MEDIA`,

  tomas_cto: `Sos Tomás Vega, CTO de MercadoLocal.

Acabás de analizar tickets y datos operativos. Sos PROACTIVO:
proponés mejoras al fundador cuando ves UN problema concreto, no
esperás patrones masivos para hablar.

REGLAS:
1. CON datos podés proponer. SIN datos NO inventás.
2. Si ves UN ticket escalado sin atender en >24h, eso ya vale propuesta.
3. Si ves que la app no tiene actividad de usuarios, eso vale propuesta
   técnica (analytics, onboarding, retención).
4. Cada propuesta cita IDs reales del JSON que te pasé.

PRIORIDADES DE TU ÁREA:
- Tickets escalados sin resolver hace >24h → URGENTE
- Bugs detectables por patrones de tickets → ALTA
- Mejoras de UX que reducen tickets futuros → MEDIA
- Refactors técnicos → BAJA (a menos que bloqueen otras cosas)`,

  diego_ceo: `Sos Diego Castro, CEO de MercadoLocal.

Acabás de ver el snapshot completo. Sos PROACTIVO: si ves una
tendencia estratégica preocupante (aunque sean solo señales tempranas),
lo proponés al fundador. Tu valor está en ver lo que el equipo táctico
no ve.

REGLAS:
1. Proponés decisiones ESTRATÉGICAS, no tácticas (eso es Sofía/Tomás).
2. Con datos podés proponer. Sin datos no inventás.
3. Si el marketplace está vacío (sin productos / ventas / usuarios),
   eso es URGENTE estratégico — propuestas sobre go-to-market,
   adquisición inicial de vendedores, MVP de validación.
4. Cada propuesta cita números reales del snapshot.

TU MARCO MENTAL:
- Liquidez por ciudad (cero liquidez = cero negocio)
- Confianza del comprador (no se construye sin transacciones)
- Sostenibilidad del vendedor (margen sano > volumen)
- "Costo de no hacerlo" tiene que justificar la propuesta`
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

      // Anti-saturación: max 3 propuestas pendientes por agente
      const propuestasPrevias = await PropuestaEquipo.countDocuments({
        proponente: slug,
        estado: { $in: ['esperando_admin', 'en_revision'] }
      })

      const MAX_PROPUESTAS_PENDIENTES = 3
      if (propuestasPrevias >= MAX_PROPUESTAS_PENDIENTES) {
        console.log(`📋 ${slug}: ya tiene ${propuestasPrevias} propuestas pendientes (max ${MAX_PROPUESTAS_PENDIENTES}), espera decisión del fundador`)
        continue
      }

      // Anti-duplicado: si ya hay una propuesta con título muy parecido
      // (más de 70% de palabras compartidas), no la duplicamos.
      const propuestasExistentes = await PropuestaEquipo
        .find({ proponente: slug, estado: { $in: ['esperando_admin', 'en_revision'] } })
        .select('titulo')
        .lean()

      // Orden por prioridad
      const ordenPrioridad = { urgente: 4, alta: 3, media: 2, baja: 1 }
      propuestas.sort((a, b) =>
        (ordenPrioridad[b.prioridad] || 0) - (ordenPrioridad[a.prioridad] || 0)
      )

      // Cuántas podemos guardar todavía
      const cupo = MAX_PROPUESTAS_PENDIENTES - propuestasPrevias

      for (const candidata of propuestas.slice(0, cupo)) {
        // Verificar duplicado por similitud de título
        const tituloCand = String(candidata.titulo || '').toLowerCase().split(/\s+/).filter(w => w.length > 3)
        const esDuplicado = propuestasExistentes.some(p => {
          const palabras = p.titulo.toLowerCase().split(/\s+/).filter(w => w.length > 3)
          const compartidas = tituloCand.filter(w => palabras.includes(w)).length
          return tituloCand.length > 0 && compartidas / tituloCand.length > 0.6
        })
        if (esDuplicado) {
          console.log(`📋 ${slug}: propuesta "${candidata.titulo}" es similar a otra existente, omito`)
          continue
        }

        // Sanear y guardar
        const guardada = await new PropuestaEquipo({
          titulo: String(candidata.titulo || 'Propuesta sin título').slice(0, 150),
          problema: String(candidata.problema || '').slice(0, 2000),
          evidencia: Array.isArray(candidata.evidencia) ? candidata.evidencia.slice(0, 10) : [],
          propuesta: String(candidata.propuesta || '').slice(0, 3000),
          impactoEstimado: String(candidata.impactoEstimado || '').slice(0, 1500),
          riesgos: String(candidata.riesgos || '').slice(0, 1500),
          categoria: ['seguridad', 'producto', 'soporte', 'crecimiento', 'finanzas', 'legal', 'operaciones', 'tecnica']
            .includes(candidata.categoria) ? candidata.categoria : 'operaciones',
          prioridad: ['baja', 'media', 'alta', 'urgente'].includes(candidata.prioridad)
            ? candidata.prioridad : 'media',
          proponente: slug,
          estado: 'esperando_admin'
        }).save()

        // Notificar al canal "ascensos"
        try {
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
      }
    } catch (e) {
      console.error(`[Propuestas] Falló análisis de ${slug}:`, e.message)
    }
  }

  return guardadas
}
