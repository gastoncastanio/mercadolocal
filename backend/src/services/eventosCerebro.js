/**
 * EVENTOS QUE DISPARAN DIÁLOGOS AUTOMÁTICOS DEL EQUIPO IA.
 *
 * Cuando pasa algo importante en la base (un producto se marca para
 * revisión, un ticket se escala, etc.), un agente del equipo postea
 * en la sala común mencionando al colega relevante.
 *
 * Ejemplo de flujo automático:
 *   1. Sofía marca un producto con bandera "fraude_potencial"
 *   2. Hook detecta el evento y dispara:
 *      "@tomas_cto Marqué este producto a revisión. Si el vendedor
 *       te abre ticket, avisame para coordinar."
 *   3. Si Tomás recibe un ticket del mismo vendedor, postea:
 *      "@sofia_cmo Recibí ticket de ese vendedor que marcaste,
 *       te paso lo que dijo."
 *   4. Diego (silencioso) los observa. Solo interviene si hay desacuerdo
 *      o si la situación escala más allá de lo táctico.
 *
 * REGLAS:
 * - Estos diálogos NO consumen tokens de Gemini todo el tiempo.
 *   Solo cuando hay un evento real disparado por una acción real.
 * - Las menciones cruzadas suben el contador `mencionesRecibidas` del
 *   agente mencionado (parte de su métrica de XP).
 * - Cooldown: no se dispara más de 1 evento del mismo tipo cada 30 min
 *   para no saturar el canal.
 */

import MensajeOrganizacion from '../models/MensajeOrganizacion.js'
import { hablarComoAgente } from './cerebro.js'

// Memoria en proceso del último evento por tipo (para cooldown)
const ultimoEventoPorTipo = new Map()
const COOLDOWN_MS = 30 * 60 * 1000 // 30 minutos

function puedeDispararEvento(tipo) {
  const ahora = Date.now()
  const ultimo = ultimoEventoPorTipo.get(tipo) || 0
  if (ahora - ultimo < COOLDOWN_MS) return false
  ultimoEventoPorTipo.set(tipo, ahora)
  return true
}

/**
 * Sofía detectó un producto que requiere revisión humana o fue rechazado.
 * Postea en sala común mencionando a Tomás si la moderación tiene bandera
 * relevante (ej: "producto_prohibido", "precio_sospechoso").
 *
 * @param {object} producto - documento Producto
 * @param {object} moderacion - documento Moderacion (con banderas)
 */
export async function disparoSofiaModeracionAlerta(producto, moderacion) {
  if (!puedeDispararEvento('sofia_moderacion_alerta')) return null

  // Solo disparamos si la moderación tiene confianza alta de problema
  if (!moderacion || moderacion.decision === 'aprobado') return null
  if (moderacion.confianza < 70) return null

  const banderasRelevantes = ['producto_prohibido', 'precio_sospechoso', 'contacto_evasion', 'promesa_enganhosa']
  const tieneBanderaRelevante = (moderacion.banderas || []).some(b => banderasRelevantes.includes(b))
  if (!tieneBanderaRelevante) return null

  try {
    const gatillo = `Acabás de marcar un producto a ${moderacion.decision === 'rechazado' ? 'rechazado' : 'revisión'}:
- Producto: "${producto.nombre}"
- Precio: $${(producto.precio || 0).toLocaleString('es-AR')}
- Tienda: ${producto.tiendaId?.toString().slice(-8) || 'desconocida'}
- Banderas detectadas: ${(moderacion.banderas || []).join(', ')}
- Confianza: ${moderacion.confianza}%

Posteá en sala común UN SOLO mensaje corto (max 3 oraciones) avisando al equipo lo que viste.
Si te parece que Tomás (soporte) debería estar atento por si el vendedor reclama, mencionalo con @tomas_cto.
NO inventes datos. Solo usá lo que te pasé acá.`

    return await hablarComoAgente('sofia_cmo', 'general', {
      gatillo,
      tipo: 'alerta',
      contexto: { productoId: producto._id, banderas: moderacion.banderas }
    })
  } catch (e) {
    console.error('Error disparoSofiaModeracionAlerta:', e.message)
    return null
  }
}

/**
 * Tomás detectó un ticket escalado importante. Postea en sala común y
 * menciona a Sofía si el ticket es sobre un vendedor (caso de potencial
 * problema de moderación que escaló).
 */
export async function disparoTomasTicketEscalado(ticket, usuario) {
  if (!puedeDispararEvento('tomas_ticket_escalado')) return null

  // Solo escalados con prioridad alta o urgente
  if (!ticket || !['alta', 'urgente'].includes(ticket.prioridad)) return null

  try {
    const esVendedor = usuario?.rol === 'vendedor'
    const ultimoMensajeUsuario = ticket.mensajes?.find(m => m.rol === 'usuario')?.texto || '(sin mensaje)'

    const gatillo = `Acabás de escalar un ticket de soporte:
- Asunto: ${ticket.asunto || 'sin clasificar'}
- Prioridad: ${ticket.prioridad}
- Tipo de usuario: ${usuario?.rol || 'desconocido'}
- Su consulta original: "${ultimoMensajeUsuario.slice(0, 300)}"
- Motivo del escalado: ${ticket.motivoEscalado || 'no especificado'}

Posteá en sala común UN SOLO mensaje corto (max 3 oraciones) avisando lo que pasó.
${esVendedor ? 'Como es un vendedor, mencioná a @sofia_cmo por si está relacionado con un caso de moderación.' : 'No es necesario mencionar a otro agente, esto lo manejás vos.'}
NO inventes datos. Solo usá lo que te pasé acá.`

    return await hablarComoAgente('tomas_cto', 'general', {
      gatillo,
      tipo: 'alerta',
      contexto: { ticketId: ticket._id, prioridad: ticket.prioridad }
    })
  } catch (e) {
    console.error('Error disparoTomasTicketEscalado:', e.message)
    return null
  }
}

/**
 * Diego interviene si detecta un desacuerdo fuerte entre Sofía y Tomás
 * en los últimos N mensajes del canal general. Esta función se llama
 * desde el cron cada cierto tiempo para "supervisar".
 */
export async function disparoDiegoSupervision() {
  if (!puedeDispararEvento('diego_supervision')) return null

  try {
    // Buscamos los últimos 20 mensajes del canal general
    const mensajes = await MensajeOrganizacion
      .find({ canal: 'general' })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()

    if (mensajes.length < 6) return null // poca actividad, no interviene

    // Si Diego ya habló recientemente (en los últimos 5 mensajes), no interviene
    const ultimos5 = mensajes.slice(0, 5)
    const diegoYaHablo = ultimos5.some(m => m.autorSlug === 'diego_ceo')
    if (diegoYaHablo) return null

    // Solo interviene si hay actividad de Sofía Y Tomás en los últimos 30 min
    const haceMedia = Date.now() - 30 * 60 * 1000
    const hayActividad = mensajes
      .filter(m => new Date(m.createdAt).getTime() > haceMedia)
      .filter(m => ['sofia_cmo', 'tomas_cto'].includes(m.autorSlug))

    if (hayActividad.length < 3) return null // poca actividad reciente

    const gatillo = `Estás observando una conversación entre Sofía y Tomás en sala común.
Como CEO, tu rol es SUPERVISAR sin entrar en cada tema táctico.

Reglas para intervenir:
- Solo posteá si ves un desacuerdo fuerte entre ellos, una decisión estratégica
  pendiente, o algo que necesite tu nivel.
- Si la conversación es normal/operativa, MEJOR NO INTERVENGAS.
- Si decidís hablar: 1-2 oraciones máximo. Hacé una pregunta clave o pedí datos.

Mirá el historial reciente del canal y decidí. Si no hay nada que ameriten tu voz,
respondé EXACTAMENTE con el texto "SIN_INTERVENCION" (sin nada más) y el sistema
no postea nada.`

    const mensaje = await hablarComoAgente('diego_ceo', 'general', {
      gatillo,
      tipo: 'conversacion',
      contexto: { tipo: 'supervision_diego' }
    })

    // Si Diego respondió "SIN_INTERVENCION", borramos el mensaje
    if (mensaje && mensaje.contenido?.trim().toUpperCase().includes('SIN_INTERVENCION')) {
      await MensajeOrganizacion.findByIdAndDelete(mensaje._id)
      return null
    }

    return mensaje
  } catch (e) {
    console.error('Error disparoDiegoSupervision:', e.message)
    return null
  }
}
