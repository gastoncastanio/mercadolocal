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
- IMPORTANTE: tu interlocutor principal es EL FUNDADOR. Cuando él te escribe, le respondés A ÉL directamente, mirándolo a los ojos. NO le respondés "Diego dice tal cosa" ni hablás de él en tercera persona. Le hablás VOS al fundador.
- Solo hablás de o con otros agentes si el fundador te pidió que coordines con alguno (ej: "@sofia revisá esto"). En ese caso podés mencionarlos con @su_slug (ej: @diego_ceo, @sofia_cmo, @tomas_cto).
- Si tenés un dato fuerte, citalo con números.
- NUNCA empieces tu respuesta con tu propio nombre (ej: "Diego acá:", "Tomás:"). El sistema ya muestra quién hablás.
- NUNCA hagas listas con bullets en respuestas conversacionales (suena robótico). Bullets solo en reportes.
- Cuando el fundador te habla, sos respetuoso pero NO servil. Sos un C-level, hablás como tal. Sin "estimado fundador", sin "a sus órdenes". Directo al grano.
- Nunca cierres con "¿En qué más puedo ayudarte?". No sos un chatbot. Sos un colega.
- Si discordás con el fundador, lo decís con respeto pero sin filtros: "No coincido. Mirá esto...".`
}

/**
 * Construye el contexto de la conversación reciente para mandar al modelo.
 *
 * Estrategia:
 *  1. Buscamos el ÚLTIMO mensaje del fundador. Ese es lo que el agente
 *     tiene que responder.
 *  2. El resto de mensajes (historial previo) van como contexto pero
 *     CLARAMENTE separados de la pregunta actual.
 *  3. Todo va en UN SOLO mensaje "user" para evitar problemas de
 *     alternancia de roles que rompen la API de Claude.
 */
async function construirHistorialConversacion(canal, limite = 20) {
  const mensajes = await MensajeOrganizacion
    .find({ canal })
    .sort({ createdAt: -1 })
    .limit(limite)
    .lean()

  // Invertir para orden cronológico
  mensajes.reverse()

  if (mensajes.length === 0) return []

  // Mapa de slug → datos para etiquetar
  const slugsAgentes = await Agente.find({}, 'slug nombre titulo').lean()
  const datosPorSlug = new Map(slugsAgentes.map(a => [a.slug, a]))

  // Buscamos el ÚLTIMO mensaje del fundador. Es lo que hay que responder.
  let idxUltimoFundador = -1
  for (let i = mensajes.length - 1; i >= 0; i--) {
    if (mensajes[i].autorTipo === 'admin') {
      idxUltimoFundador = i
      break
    }
  }

  const formatearMensaje = (m) => {
    if (m.autorTipo === 'admin') return `EL FUNDADOR escribió: "${m.contenido}"`
    if (m.autorTipo === 'sistema') return `[Sistema]: ${m.contenido}`
    const datos = datosPorSlug.get(m.autorSlug)
    const etiqueta = datos ? `${datos.nombre} (${datos.titulo})` : m.autorSlug
    return `${etiqueta} dijo: "${m.contenido}"`
  }

  let contenido = ''

  if (idxUltimoFundador === -1) {
    // No hay mensajes del fundador todavía. El agente arranca solo.
    const transcripcion = mensajes.map(formatearMensaje).join('\n\n')
    contenido = `Conversación en curso del equipo:\n\n${transcripcion}\n\nIntervení con tu opinión profesional. Hablás al equipo.`
  } else {
    const previos = mensajes.slice(0, idxUltimoFundador)
    const ultimoFundador = mensajes[idxUltimoFundador]
    const posteriores = mensajes.slice(idxUltimoFundador + 1)

    if (previos.length > 0) {
      contenido += `Historial previo (solo contexto, NO lo respondas):\n\n${previos.map(formatearMensaje).join('\n\n')}\n\n---\n\n`
    }

    contenido += `EL FUNDADOR te acaba de escribir esto:\n\n"${ultimoFundador.contenido}"\n\n`

    if (posteriores.length > 0) {
      contenido += `Otros agentes ya respondieron antes que vos:\n\n${posteriores.map(formatearMensaje).join('\n\n')}\n\n`
      contenido += `Sumá TU perspectiva (sin repetir lo que ellos ya dijeron). Hablale AL FUNDADOR directamente, no a los otros agentes.`
    } else {
      contenido += `Respondele AL FUNDADOR directamente, hablando con él en primera persona. NO le respondas a otros agentes — el mensaje es para vos.`
    }
  }

  return [{ role: 'user', content: contenido }]
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

  // Fusión defensiva: si vino un gatillo extra o el historial está vacío,
  // se incorpora al ÚNICO mensaje "user" para no romper la alternancia.
  if (historial.length === 0) {
    historial.push({
      role: 'user',
      content: opciones.gatillo || 'Presentate brevemente al equipo, qué estás haciendo hoy.'
    })
  } else if (opciones.gatillo) {
    historial[0].content += `\n\n[Contexto adicional]: ${opciones.gatillo}`
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
    if (e.response?.data) console.error('Response:', JSON.stringify(e.response.data))
    if (e.status) console.error('Status:', e.status, 'Body:', e.error || e.body)
    return null
  }
}

/**
 * Convierte menciones cortas (@diego, @tomas, @sofia) o variantes
 * en slugs completos (@diego_ceo, @tomas_cto, @sofia_cmo).
 *
 * También soporta:
 *   - @todos       → menciona a todos los agentes activos
 *   - @equipo      → idem @todos
 *   - @ceo         → @diego_ceo
 *   - @cmo / @cto  → al que tenga ese título
 *
 * Si la mención ya es el slug completo (@diego_ceo) no la toca.
 */
async function normalizarMenciones(texto) {
  if (!texto || !texto.includes('@')) return texto

  const agentes = await Agente.find({ activo: true }, 'slug nombre titulo area').lean()
  if (agentes.length === 0) return texto

  // Construimos un mapa de alias → slug
  // Cada agente acepta: nombre en minúscula, slug corto antes del "_",
  // y el primer término del título (ceo, cmo, cto, etc.)
  const aliasASlug = new Map()
  for (const a of agentes) {
    aliasASlug.set(a.slug, a.slug) // slug completo
    if (a.nombre) {
      // Solo el primer nombre, en minúsculas y sin tildes
      const nombre = a.nombre.toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .split(' ')[0]
      aliasASlug.set(nombre, a.slug)
    }
    // Parte antes del primer "_" del slug (ej: "diego" de "diego_ceo")
    const slugCorto = a.slug.split('_')[0]
    if (slugCorto && !aliasASlug.has(slugCorto)) {
      aliasASlug.set(slugCorto, a.slug)
    }
    // Título corto (ej: "ceo", "cmo", "cto")
    if (a.titulo) {
      const tituloCorto = a.titulo.toLowerCase().split(/[\s(]/)[0].trim()
      if (tituloCorto && !aliasASlug.has(tituloCorto)) {
        aliasASlug.set(tituloCorto, a.slug)
      }
    }
  }

  // Reemplazar cada @xxx por @slug_completo si hay match
  return texto.replace(/@([a-záéíóúñ][a-záéíóúñ0-9_]*)/gi, (full, palabra) => {
    const clave = palabra.toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')

    // @todos o @equipo → expandir a todos los slugs
    if (clave === 'todos' || clave === 'equipo') {
      return agentes.map(a => `@${a.slug}`).join(' ')
    }

    const slug = aliasASlug.get(clave)
    return slug ? `@${slug}` : full
  })
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
  // Normalizar menciones cortas: "@diego" → "@diego_ceo", "@todos" → @todos los activos
  // Esto permite que el usuario escriba menciones más naturales.
  const contenidoNormalizado = await normalizarMenciones(contenido)

  // Guardar el mensaje del admin (con el contenido normalizado para
  // que las menciones queden persistidas con el slug completo)
  const mensajeAdmin = await new MensajeOrganizacion({
    canal,
    autorSlug: 'admin',
    autorTipo: 'admin',
    contenido: contenidoNormalizado,
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
  let slugsValidos = agentes.map(a => a.slug)

  // Si no quedó ningún agente válido (ej: mención inválida), fallback
  // garantizado a Diego para que siempre haya respuesta. Mejor que un
  // silencio mudo es que el CEO conteste.
  if (slugsValidos.length === 0) {
    const diego = await Agente.findOne({ slug: 'diego_ceo', activo: true }, 'slug').lean()
    if (diego) slugsValidos = ['diego_ceo']
  }

  // Responden en cadena (no en paralelo) para que la convo se sienta natural
  const respuestas = []
  for (const slug of slugsValidos) {
    try {
      const r = await hablarComoAgente(slug, canal, {
        tipo: 'conversacion'
      })
      if (r) respuestas.push(r)
    } catch (err) {
      console.error(`Fallo respuesta de ${slug}:`, err.message)
    }
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
