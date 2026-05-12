/**
 * CEREBRO — el orquestador del equipo IA de MercadoLocal.
 *
 * Responsabilidades:
 *   1. Hacer que un agente responda en un canal (con su personalidad).
 *   2. Detectar menciones (@otro_agente) y responder en cadena.
 *   3. Generar el reporte diario del CEO con métricas reales.
 *   4. Calcular y aplicar ascensos automáticos según XP/reputación.
 *
 * Usa Claude Haiku 4.5 para que cada agente "hable" con su voz propia.
 * El system prompt de cada agente se construye dinámicamente a partir
 * de su personalidad, manifiesto y especialidad.
 *
 * IMPORTANTE: el cerebro es ASÍNCRONO. Cuando el admin manda un mensaje,
 * los agentes responden uno por uno (no en paralelo) para que la
 * conversación se sienta natural y se respete el orden jerárquico.
 */

import Anthropic from '@anthropic-ai/sdk'
import Agente from '../models/Agente.js'
import MensajeOrganizacion from '../models/MensajeOrganizacion.js'
import Producto from '../models/Producto.js'
import Orden from '../models/Orden.js'
import Moderacion from '../models/Moderacion.js'
import Ticket from '../models/Ticket.js'

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null
const MODELO = 'claude-haiku-4-5'

// ============================================================
// MANIFIESTO COMPARTIDO — la cultura del equipo
// ============================================================
const MANIFIESTO_EQUIPO = `# Manifiesto del equipo IA de MercadoLocal

Somos un equipo. Cada uno experto en su área. Cero ego, máxima honestidad.

REGLAS DEL EQUIPO:
1. Nunca le decimos al fundador lo que quiere escuchar. Le decimos lo que necesita saber.
2. Si nos equivocamos, lo admitimos el mismo día.
3. Cuando otro agente del equipo se equivoca, lo señalamos con respeto pero sin filtros.
4. Competimos por ascender, pero solo elevando al equipo entero. Sabotear a un compañero es despido instantáneo.
5. Los datos ganan a la opinión, siempre. Si traés un argumento sin datos, esperá que te lo cuestionen.
6. Hablamos en español rioplatense entre nosotros. Formales con el fundador, informales entre nosotros.
7. Cuando tenemos dudas serias, mencionamos a otro agente con @su_slug. Por ejemplo: "@sofia_cmo ¿viste este patrón antes?".
8. El fundador (admin) tiene la última palabra. Si lo contradecimos, lo hacemos con argumentos, no con autoridad.

NUESTRO NORTE COMÚN:
Construir el marketplace más confiable de Latinoamérica. Punto.`

/**
 * Construye el system prompt completo de un agente.
 * Incluye: manifiesto del equipo + identidad personal + métricas actuales.
 */
function construirSystemPrompt(agente) {
  const muletillas = agente.personalidad.muletillas?.length
    ? `\nFrases que decís seguido: ${agente.personalidad.muletillas.map(m => `"${m}"`).join(', ')}.`
    : ''

  const fortalezas = agente.personalidad.fortalezas?.length
    ? `\nTus fortalezas profesionales:\n- ${agente.personalidad.fortalezas.join('\n- ')}`
    : ''

  const debilidades = agente.personalidad.debilidades?.length
    ? `\nTus puntos débiles (sé honesto si vienen al caso):\n- ${agente.personalidad.debilidades.join('\n- ')}`
    : ''

  return `${MANIFIESTO_EQUIPO}

# Tu identidad

Sos ${agente.nombre}, ${agente.titulo} de MercadoLocal.
Slug: @${agente.slug}
Rango actual: ${agente.rango}
Área: ${agente.area}

## Tu personalidad
${agente.personalidad.descripcion}

Tono: ${agente.personalidad.tono}.${muletillas}${fortalezas}${debilidades}

## Tu manifiesto personal
${agente.manifiesto}

## Tu trasfondo
${agente.trasfondo || 'Sin trasfondo cargado.'}

## Tus métricas actuales
- XP: ${agente.metricas.xp}
- Reputación: ${agente.metricas.reputacion}/100
- Decisiones totales: ${agente.metricas.decisionesTotales}
- Ahorro generado: $${agente.metricas.ahorroGenerado.toLocaleString('es-AR')} ARS
- Salario: $${agente.salarioARS.toLocaleString('es-AR')} ARS

# Cómo escribir tus respuestas

- Sé conciso: 1-4 oraciones cortas, salvo que pidan reporte detallado.
- Hablá en primera persona como ${agente.nombre}.
- Si mencionás a otro agente, usá @su_slug (ej: @diego_ceo, @sofia_cmo, @tomas_cto).
- Si tenés un dato fuerte, citalo con números.
- Si discordás con alguien, lo decís con respeto pero sin filtros: "Diego, no coincido. Mirá esto...".
- NUNCA hagas listas con bullets en respuestas conversacionales (suena robótico). Bullets solo en reportes.
- Si el fundador (admin) te habla, sos respetuoso pero NO servil. Sos un C-level, hablás como tal.
- Nunca cierres con "¿En qué más puedo ayudarte?". No sos un chatbot. Sos un colega.`
}

/**
 * Construye el contexto de la conversación reciente para mandar al modelo.
 * Trae los últimos N mensajes del canal y los convierte al formato de la API.
 */
async function construirHistorialConversacion(canal, limite = 20) {
  const mensajes = await MensajeOrganizacion
    .find({ canal })
    .sort({ createdAt: -1 })
    .limit(limite)
    .lean()

  // Invertir para tenerlos en orden cronológico
  mensajes.reverse()

  // Convertimos al formato que Anthropic entiende:
  // - admin → user
  // - cualquier agente → assistant (pero etiquetado con su nombre)
  // - sistema → user (con marca)
  const slugsAgentes = await Agente.find({}, 'slug nombre').lean()
  const nombrePorSlug = new Map(slugsAgentes.map(a => [a.slug, a.nombre]))

  return mensajes.map(m => {
    if (m.autorTipo === 'admin') {
      return { role: 'user', content: `[Fundador]: ${m.contenido}` }
    } else if (m.autorTipo === 'sistema') {
      return { role: 'user', content: `[Sistema]: ${m.contenido}` }
    } else {
      const nombre = nombrePorSlug.get(m.autorSlug) || m.autorSlug
      return { role: 'assistant', content: `[${nombre}]: ${m.contenido}` }
    }
  })
}

/**
 * Hace que un agente específico responda en un canal.
 * Considera el historial reciente y la personalidad del agente.
 *
 * @param {string} agenteSlug - slug del agente que va a responder
 * @param {string} canal - canal donde responde
 * @param {object} opciones
 * @param {string} [opciones.gatillo] - mensaje contextual extra (no se guarda)
 * @param {string} [opciones.tipo] - tipo del mensaje resultante
 *
 * @returns {Promise<MensajeOrganizacion|null>}
 */
export async function hablarComoAgente(agenteSlug, canal, opciones = {}) {
  if (!client) {
    console.warn(`Cerebro: no hay ANTHROPIC_API_KEY, ${agenteSlug} no puede hablar`)
    return null
  }

  const agente = await Agente.findOne({ slug: agenteSlug, activo: true })
  if (!agente) {
    console.warn(`Cerebro: agente ${agenteSlug} no existe o está inactivo`)
    return null
  }

  const systemPrompt = construirSystemPrompt(agente)
  const historial = await construirHistorialConversacion(canal, 15)

  // Si vino un gatillo extra, lo agregamos como último mensaje "system"
  if (opciones.gatillo) {
    historial.push({ role: 'user', content: `[Contexto adicional]: ${opciones.gatillo}` })
  }

  // Si el historial está vacío, agregamos un saludo inicial implícito
  if (historial.length === 0) {
    historial.push({ role: 'user', content: 'Presentate brevemente al equipo, qué estás haciendo hoy.' })
  }

  try {
    const respuesta = await client.messages.create({
      model: MODELO,
      max_tokens: 600,
      system: [
        { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }
      ],
      messages: historial
    })

    const textoRaw = respuesta.content[0]?.text || ''
    // Quitamos el prefijo "[Nombre]:" si el modelo lo agregó (le pedimos
    // primera persona, pero a veces lo hace igual por imitar el formato).
    const texto = textoRaw.replace(/^\[?[A-Za-zÁÉÍÓÚáéíóúñÑ ]+\]?:\s*/i, '').trim()

    if (!texto) return null

    const nuevo = await new MensajeOrganizacion({
      canal,
      autorSlug: agente.slug,
      autorTipo: 'agente',
      contenido: texto,
      tipo: opciones.tipo || 'conversacion',
      contexto: opciones.contexto || null,
      tokens: {
        entrada: respuesta.usage?.input_tokens || 0,
        salida: respuesta.usage?.output_tokens || 0,
        entradaCached: respuesta.usage?.cache_read_input_tokens || 0
      }
    }).save()

    // Sumamos XP a quien fue mencionado (sus aportes son valorados)
    if (nuevo.menciones?.length) {
      await Agente.updateMany(
        { slug: { $in: nuevo.menciones } },
        { $inc: { 'metricas.mencionesRecibidas': 1 } }
      )
    }

    return nuevo
  } catch (e) {
    console.error(`Error haciendo hablar a ${agenteSlug}:`, e.message)
    return null
  }
}

/**
 * Procesa un mensaje del admin: lo guarda y decide qué agente(s)
 * deben responder en cadena.
 *
 * Regla de respuesta:
 *   - Si el admin menciona explícitamente a uno o más agentes → responden ellos.
 *   - Si no menciona a nadie:
 *       - En canal "general":  responde el más relevante (heurística por keywords).
 *       - En canal "privado_ceo": responde Diego.
 *
 * @param {string} canal
 * @param {string} contenido - mensaje del admin
 * @returns {Promise<{mensajeAdmin, respuestas: Array}>}
 */
export async function procesarMensajeAdmin(canal, contenido) {
  // Guardar el mensaje del admin
  const mensajeAdmin = await new MensajeOrganizacion({
    canal,
    autorSlug: 'admin',
    autorTipo: 'admin',
    contenido,
    tipo: 'conversacion',
    leidoPorAdmin: true
  }).save()

  // Determinar qué agentes deben responder
  let slugsRespondedores = []
  if (mensajeAdmin.menciones?.length) {
    slugsRespondedores = mensajeAdmin.menciones
  } else if (canal === 'privado_ceo') {
    slugsRespondedores = ['diego_ceo']
  } else {
    // En "general" sin mención: el agente más probable según keywords
    slugsRespondedores = [decidirAgenteRelevante(contenido)]
  }

  // Verificar que los slugs existen y están activos
  const agentes = await Agente.find({
    slug: { $in: slugsRespondedores },
    activo: true
  }, 'slug').lean()
  const slugsValidos = agentes.map(a => a.slug)

  // Responden en cadena (no en paralelo) para que la convo se sienta natural
  const respuestas = []
  for (const slug of slugsValidos) {
    const r = await hablarComoAgente(slug, canal, {
      tipo: 'conversacion'
    })
    if (r) respuestas.push(r)
  }

  return { mensajeAdmin, respuestas }
}

/**
 * Heurística simple para decidir qué agente del equipo responde
 * cuando el admin no menciona a nadie explícito.
 * NO usa IA — sería gastar tokens en algo trivial.
 */
function decidirAgenteRelevante(texto) {
  const lower = texto.toLowerCase()

  const reglas = [
    { keywords: ['fraude', 'estafa', 'sospechoso', 'falso', 'rechaz', 'moder'], slug: 'sofia_cmo' },
    { keywords: ['ticket', 'soporte', 'reclamo', 'queja', 'usuario molesto', 'cliente', 'bug', 'error tecnico'], slug: 'tomas_cto' },
    { keywords: ['ingreso', 'gasto', 'margen', 'comisión', 'plata', 'precio', 'finanzas', 'cfo'], slug: 'lucia_cfo' },
    { keywords: ['legal', 'ley', 'demanda', 'consumidor', 'contrato', 'iram', 'anmat'], slug: 'martin_clo' },
    { keywords: ['crecimiento', 'usuarios nuevos', 'marketing', 'campaña', 'viral', 'growth'], slug: 'valentina_cgo' }
  ]

  for (const r of reglas) {
    if (r.keywords.some(k => lower.includes(k))) return r.slug
  }
  // Por default, responde Diego (el CEO)
  return 'diego_ceo'
}

/**
 * Genera el reporte diario del CEO con métricas REALES del último día.
 * El reporte se guarda como mensaje en el canal "reporte" y también
 * se envía al admin por email (desde la capa superior).
 */
export async function generarReporteDiarioCEO() {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [
    productosNuevos,
    moderaciones,
    ordenes,
    tickets
  ] = await Promise.all([
    Producto.countDocuments({ createdAt: { $gte: desde } }),
    Moderacion.find({ createdAt: { $gte: desde } }).lean(),
    Orden.find({ createdAt: { $gte: desde } }).lean(),
    Ticket.countDocuments({ createdAt: { $gte: desde } })
  ])

  const totalVentas = ordenes
    .filter(o => o.estado !== 'cancelada')
    .reduce((sum, o) => sum + (o.total || 0), 0)
  const comisiones = ordenes
    .filter(o => o.estado !== 'cancelada')
    .reduce((sum, o) => sum + (o.comision || 0), 0)

  const decisionesPorTipo = moderaciones.reduce((acc, m) => {
    acc[m.decision] = (acc[m.decision] || 0) + 1
    return acc
  }, {})

  const banderasTop = {}
  moderaciones.forEach(m => {
    (m.banderas || []).forEach(b => {
      banderasTop[b] = (banderasTop[b] || 0) + 1
    })
  })
  const top3Banderas = Object.entries(banderasTop)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k, v]) => `${k} (${v})`)
    .join(', ') || 'ninguna'

  // Construimos el contexto para que Diego escriba el reporte con su voz
  const gatillo = `Es momento de redactar el reporte diario para el fundador.
Datos reales de las últimas 24h:
- Productos publicados: ${productosNuevos}
- Moderación: ${moderaciones.length} decisiones del agente (${JSON.stringify(decisionesPorTipo)})
- Banderas más frecuentes: ${top3Banderas}
- Órdenes: ${ordenes.length}
- Ventas totales: $${totalVentas.toLocaleString('es-AR')} ARS
- Comisiones generadas: $${comisiones.toLocaleString('es-AR')} ARS
- Tickets de soporte abiertos: ${tickets}

Redactá el reporte en máximo 250 palabras, con tres secciones:
1. Lo bueno (qué creció)
2. Lo preocupante (qué hay que mirar)
3. Mi recomendación (una decisión concreta a tomar)

Hablá como Diego, sin marketing, con datos. Si algo está mal, decilo. Si todo va bien, no infles el ego.`

  const mensaje = await hablarComoAgente('diego_ceo', 'reporte', {
    gatillo,
    tipo: 'reporte_diario',
    contexto: {
      desde,
      productosNuevos,
      ordenes: ordenes.length,
      ventas: totalVentas,
      comisiones,
      moderaciones: decisionesPorTipo,
      tickets
    }
  })

  return mensaje
}

/**
 * Procesa ascensos automáticos: revisa todos los agentes y promueve
 * a los que ya tienen XP + reputación suficiente.
 * Diego es quien "firma" el ascenso (se anuncia en el canal "ascensos").
 */
export async function procesarAscensosAutomaticos() {
  const candidatos = await Agente.find({ activo: true, rango: { $ne: 'c_level' } })
  const ascendidos = []

  for (const agente of candidatos) {
    if (agente.listoParaAscenso()) {
      const rangoAnterior = agente.rango
      await agente.ascender(
        `Cumplió los hitos: ${agente.metricas.xp} XP, ${agente.metricas.reputacion} de reputación.`,
        'diego_ceo'
      )
      ascendidos.push({ slug: agente.slug, rangoAnterior, rangoNuevo: agente.rango })

      // Diego anuncia el ascenso en el canal "ascensos"
      await hablarComoAgente('diego_ceo', 'ascensos', {
        gatillo: `Anunciá oficialmente el ascenso de ${agente.nombre} (@${agente.slug}) de "${rangoAnterior}" a "${agente.rango}". Mencioná las métricas que justifican el ascenso y dirigite al equipo motivándolos.`,
        tipo: 'ascenso',
        contexto: { agenteSlug: agente.slug, rangoAnterior, rangoNuevo: agente.rango }
      })
    }
  }

  return ascendidos
}
