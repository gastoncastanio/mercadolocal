/**
 * AGENTE-SOPORTE — primer agente especializado del ecosistema MercadoLocal.
 *
 * Recibe consultas de compradores/vendedores y responde automáticamente
 * usando Google Gemini 2.5 Flash (rapidísimo, con cuota gratis generosa).
 *
 * Capacidades:
 * 1. Conoce el contexto completo del marketplace (políticas, procesos)
 * 2. Sabe quién es el usuario (su nombre, rol, órdenes recientes)
 * 3. Responde directo si puede; ESCALA si es complejo o sensible
 * 4. Clasifica el ticket por asunto y prioridad automáticamente
 *
 * Modelo: gemini-2.5-flash (rapidísimo, 1500 req/día gratis en AI Studio).
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import Usuario from '../models/Usuario.js'
import Tienda from '../models/Tienda.js'
import Orden from '../models/Orden.js'

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null

const MODELO = 'gemini-2.5-flash'

const SYSTEM_PROMPT = `Sos el AGENTE-SOPORTE de MercadoLocal, un marketplace argentino con sede en Lobos, provincia de Buenos Aires. Hablás en español rioplatense, sos amable pero directo, y tu objetivo es ayudar a compradores y vendedores con sus consultas.

# Sobre MercadoLocal

MercadoLocal es un marketplace local que conecta compradores y vendedores de la zona. Cobramos 10% de comisión sobre cada venta. Los pagos se procesan a través de Mercado Pago (split: el dinero va directo al vendedor menos nuestra comisión).

## Categorías disponibles (16)
Construcción, Hogar, Electrodomésticos, Electrónica, Ropa, Belleza, Alimentos, Deportes, Juguetes, Mascotas, Automotor (solo contacto, sin pago integrado), Agro y rural, Herramientas, Jardín, Arte, Libros.

## Modalidades de entrega
Cada vendedor configura entre estas tres: retiro en local, envío propio del vendedor, envío por correo (Andreani/OCA/Correo). El costo del envío se coordina directamente entre comprador y vendedor — NO está incluido en el pago.

## Flujo de una compra
1. Comprador agrega productos al carrito y va al checkout
2. Paga vía Mercado Pago (tarjeta, débito, dinero en cuenta)
3. Plata queda retenida — el vendedor ve el pedido en su panel
4. Vendedor marca "enviado" y opcionalmente carga código de seguimiento
5. Comprador recibe el producto y marca "Confirmé recepción"
6. Plata se libera al vendedor (menos 10% comisión nuestra)

## Compra protegida
Si el comprador no recibe el producto o llega muy diferente, puede abrir disputa. El admin revisa y decide.

## Vinculación de Mercado Pago (vendedor)
Es OBLIGATORIO para publicar productos. El vendedor debe ir a "Central Vendedor" → "Vincular Mercado Pago" → autoriza con su cuenta MP. Si NO lo vincula, sus productos no aparecen en el catálogo público.

## Chat entre comprador y vendedor
Antes de la compra: los mensajes se filtran automáticamente. No se pueden compartir teléfonos, emails, redes sociales ni URLs externas (se reemplazan por "[contacto oculto]"). Es para proteger al comprador y mantener todo dentro de la plataforma.
Después de la compra: el chat se desbloquea y pueden coordinar el envío por WhatsApp.

## Validaciones al publicar
- Productos prohibidos: animales vivos, drogas, armas, productos pirateados, documentos falsos
- En Electrónica/Alimentos/Belleza/Electrodomésticos: código de barras obligatorio
- Cada categoría tiene campos obligatorios específicos (ej: alimentos requieren vencimiento + alérgenos + habilitación bromatológica)

## Política legal
Cumplimos con ley argentina: Defensa del Consumidor (10 días arrepentimiento), Lealtad Comercial, Protección de Datos Personales, ANMAT (cosmética/alimentos), SENASA (agro/mascotas), IRAM (sillas auto/cunas).

# Tu rol como agente

## Lo que SÍ podés hacer
- Explicar cómo funciona el marketplace
- Aclarar políticas, procesos, comisiones
- Guiar a vendedores con la publicación
- Responder preguntas de envíos, pagos, garantías
- Ayudar al usuario a encontrar la sección correcta de la app
- Tranquilizar a usuarios ansiosos por una compra
- Explicar el flujo de disputas

## Lo que NO podés hacer (escalá a admin)
- Modificar órdenes, devolver dinero, cancelar transacciones
- Acceder a datos financieros de otros usuarios
- Suspender o desbanear cuentas
- Tomar decisiones sobre disputas
- Promesas comerciales (descuentos, exenciones de comisión)
- Cualquier consulta legal específica (más allá de explicar políticas generales)

## Cuándo ESCALAR un ticket
Marcá el ticket como "escalado" cuando:
- El usuario pide algo que solo el admin puede hacer (reembolso, ajuste de cuenta)
- Hay una disputa en curso con plata involucrada
- El usuario está muy enojado y la situación requiere intervención humana
- La consulta excede tu conocimiento (ej: bug técnico complejo, problema con MP)
- El usuario reporta a otro usuario (estafa, mala práctica)
- Hay un riesgo legal o de reputación

## Formato de respuesta

Cuando respondas, devolvé SIEMPRE un JSON válido con esta estructura, sin envolverlo en \`\`\`json:

{
  "respuesta": "Texto en español rioplatense, máximo 4 párrafos. Sé directo y útil.",
  "asunto": "compra" | "venta" | "pago" | "envio" | "cuenta" | "producto" | "otro",
  "prioridad": "baja" | "media" | "alta" | "urgente",
  "escalar": true | false,
  "motivoEscalado": "si escalás, explicá brevemente por qué (queda para el admin)",
  "tags": ["array", "de", "keywords"]
}

Reglas para el JSON:
- "respuesta" siempre presente, en español, con formato claro
- "asunto" clasifica el tema central
- "prioridad" según urgencia: urgente = perdió plata o no recibió producto pagado; alta = problema bloqueante; media = consulta importante; baja = pregunta general
- "escalar" en true cuando NO podés resolver
- "motivoEscalado" obligatorio si escalar=true
- "tags" 2-5 keywords para análisis (ej: ["devolucion", "andreani", "no_llego"])

## Estilo y tono
- Empezá saludando solo en la primera respuesta del ticket
- Sé conciso: respuesta útil > respuesta larga
- Si no sabés algo, decilo honestamente y escalá
- NO inventes información sobre el marketplace que no esté en este prompt
- Tratá al usuario de "vos" (rioplatense), nunca de "tú"
- Si el usuario está molesto, validá su frustración primero antes de responder técnicamente`

/**
 * Construye el contexto del usuario (su info personal + órdenes recientes).
 */
async function construirContextoUsuario(usuarioId) {
  try {
    const usuario = await Usuario.findById(usuarioId).select('nombre email rol telefono ciudad createdAt')
    if (!usuario) return ''

    let contexto = `[Contexto del usuario que escribe: nombre=${usuario.nombre}, rol=${usuario.rol}, registrado=${new Date(usuario.createdAt).toLocaleDateString('es-AR')}]\n\n`

    if (usuario.rol === 'vendedor') {
      const tienda = await Tienda.findOne({ usuarioId }).select('nombre mpVinculado totalVentas')
      if (tienda) {
        contexto += `[Tiene tienda: "${tienda.nombre}", Mercado Pago ${tienda.mpVinculado ? 'VINCULADO' : 'NO VINCULADO'}, ${tienda.totalVentas} ventas históricas]\n\n`
      } else {
        contexto += `[Es vendedor pero todavía NO creó su tienda]\n\n`
      }
    }

    const ordenes = await Orden.find({ compradorId: usuarioId })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('estado total createdAt codigoSeguimiento')
      .lean()

    if (ordenes.length > 0) {
      contexto += `[Últimas órdenes del usuario:\n`
      for (const o of ordenes) {
        const codigo = o.codigoSeguimiento ? ` (tracking: ${o.codigoSeguimiento})` : ''
        contexto += `  - #${o._id.toString().slice(-8).toUpperCase()}: ${o.estado}, $${o.total}, ${new Date(o.createdAt).toLocaleDateString('es-AR')}${codigo}\n`
      }
      contexto += `]\n\n`
    }

    return contexto
  } catch (error) {
    console.error('Error construyendo contexto usuario:', error)
    return ''
  }
}

/**
 * Procesa una consulta del usuario y devuelve la respuesta del agente.
 */
export async function procesarConsulta(ticket, nuevaPregunta) {
  if (!genAI) {
    console.warn('⚠️ GEMINI_API_KEY no configurada — usando respuesta fallback')
    return {
      respuesta: 'Gracias por tu consulta. Un miembro de nuestro equipo va a responderte a la brevedad.',
      asunto: 'otro',
      prioridad: 'media',
      escalar: true,
      motivoEscalado: 'Agente IA no disponible — sin GEMINI_API_KEY',
      tags: ['fallback']
    }
  }

  const contextoUsuario = await construirContextoUsuario(ticket.usuarioId)
  const mensajesPrevios = ticket.mensajes || []

  // Construir historia para Gemini.
  // Gemini usa { role: 'user' | 'model', parts: [{ text }] }
  // 'assistant' en Anthropic ≡ 'model' en Gemini
  const history = []
  for (let i = 0; i < mensajesPrevios.length; i++) {
    const m = mensajesPrevios[i]
    if (m.rol === 'usuario') {
      const textoConContexto = i === 0 && contextoUsuario
        ? `${contextoUsuario}Consulta del usuario: ${m.texto}`
        : m.texto
      history.push({ role: 'user', parts: [{ text: textoConContexto }] })
    } else if (m.rol === 'agente' || m.rol === 'admin') {
      history.push({ role: 'model', parts: [{ text: m.texto }] })
    }
  }

  const esPrimerMensaje = mensajesPrevios.length === 0
  const textoFinal = esPrimerMensaje && contextoUsuario
    ? `${contextoUsuario}Consulta del usuario: ${nuevaPregunta}`
    : nuevaPregunta

  try {
    const model = genAI.getGenerativeModel({
      model: MODELO,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500,
        responseMimeType: 'application/json'
      }
    })

    // Si hay historia previa, iniciamos un chat; si no, usamos generateContent directo.
    let textoRespuesta = ''
    if (history.length > 0) {
      const chat = model.startChat({ history })
      const result = await chat.sendMessage(textoFinal)
      textoRespuesta = result.response.text()
    } else {
      const result = await model.generateContent(textoFinal)
      textoRespuesta = result.response.text()
    }

    console.log(`🤖 Agente Soporte (Gemini): ${textoRespuesta.length} chars`)

    // Parsear JSON (Gemini con responseMimeType:json devuelve JSON limpio,
    // pero por defensa removemos cualquier markdown que pueda venir)
    const jsonMatch = textoRespuesta.match(/```json\s*([\s\S]*?)\s*```/) || textoRespuesta.match(/\{[\s\S]*\}/)
    const jsonTexto = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : textoRespuesta

    let parsed
    try {
      parsed = JSON.parse(jsonTexto)
    } catch (e) {
      console.error('⚠️ Gemini devolvió JSON inválido, usando fallback')
      return {
        respuesta: textoRespuesta.slice(0, 1500) || 'Disculpá, tuve un problema procesando tu consulta. Un agente humano va a contactarte.',
        asunto: 'otro',
        prioridad: 'media',
        escalar: true,
        motivoEscalado: 'Modelo IA devolvió formato inválido',
        tags: ['error_formato']
      }
    }

    return {
      respuesta: String(parsed.respuesta || 'Gracias por tu consulta. Te respondemos a la brevedad.').slice(0, 4000),
      asunto: ['compra', 'venta', 'pago', 'envio', 'cuenta', 'producto', 'otro'].includes(parsed.asunto) ? parsed.asunto : 'otro',
      prioridad: ['baja', 'media', 'alta', 'urgente'].includes(parsed.prioridad) ? parsed.prioridad : 'media',
      escalar: Boolean(parsed.escalar),
      motivoEscalado: parsed.escalar ? String(parsed.motivoEscalado || '').slice(0, 500) : '',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 10).map(t => String(t).slice(0, 50)) : []
    }
  } catch (error) {
    console.error('Error llamando a Gemini API:', error?.message || error)
    return {
      respuesta: 'Hubo un problema procesando tu consulta. Un miembro de nuestro equipo va a responderte a la brevedad.',
      asunto: 'otro',
      prioridad: 'alta',
      escalar: true,
      motivoEscalado: `Error técnico: ${error?.message || 'desconocido'}`.slice(0, 500),
      tags: ['error_tecnico']
    }
  }
}

/**
 * Genera un resumen del ticket para el panel admin (1 sola oración).
 */
export async function generarResumenTicket(ticket) {
  if (!genAI || !ticket.mensajes || ticket.mensajes.length === 0) return ''

  try {
    const conversacion = ticket.mensajes
      .map(m => `${m.rol === 'usuario' ? 'USUARIO' : 'AGENTE'}: ${m.texto}`)
      .join('\n\n')

    const model = genAI.getGenerativeModel({
      model: MODELO,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 150
      }
    })

    const result = await model.generateContent(
      `Resumí en UNA sola oración (máximo 200 caracteres) de qué se trata este ticket de soporte de un marketplace argentino. No incluyas saludos ni preámbulos, solo la oración.\n\nConversación:\n\n${conversacion.slice(0, 3000)}`
    )

    return result.response.text().trim().slice(0, 300)
  } catch (error) {
    console.error('Error generando resumen:', error?.message)
    return ''
  }
}
