import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'

// Configuración de MercadoPago para pagos prepago del "Radar del Centro" (Fase 3).
//
// IMPORTANTE: se usa la API v2 del SDK (`MercadoPagoConfig` + `Preference` + `Payment`),
// la misma que el marketplace en services/mercadoPagoService.js. La API legacy v1
// (`mercadopago.configure()` / `mercadopago.preferences.create()`) NO existe en
// mercadopago@2.x — por eso el prepago "no cambiaba nada": la preferencia nunca se creaba.

function tokenPlataforma() {
  return process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN || ''
}

// Cliente del marketplace (cuenta de la plataforma). Se crea de forma perezosa para
// tomar el token actualizado del entorno.
function clientePlataforma() {
  return new MercadoPagoConfig({ accessToken: tokenPlataforma() })
}

/**
 * Valida que MercadoPago esté configurado. Se llama al arrancar el server.
 * En v2 no hay un "configure" global: cada operación usa su propio cliente.
 */
export function configurarMercadoPago() {
  if (!tokenPlataforma()) {
    throw new Error('MP_ACCESS_TOKEN (o MERCADOPAGO_ACCESS_TOKEN) no configurado en env')
  }
}

/**
 * Crea una preferencia de pago para una OfertaFlash prepago.
 * El dinero entra a la cuenta de la plataforma (sin split por ahora: ComercioCentro
 * todavía no vincula su MP). external_reference = canjeId para que el webhook lo ubique.
 *
 * @returns {{ preferenceId, initPoint, sandboxInitPoint }}
 */
export async function crearPreferenciaOferta(oferta, usuario, canjeId) {
  const preference = new Preference(clientePlataforma())

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, '')

  const preferenceBody = {
    items: [
      {
        id: oferta._id.toString(),
        title: oferta.titulo,
        description: (oferta.descripcion || `Oferta ${oferta.bloqueHorario}`).slice(0, 250),
        quantity: 1,
        unit_price: Math.round(Number(oferta.precioFinal)),
        currency_id: 'ARS'
      }
    ],
    payer: { email: usuario.email },
    external_reference: canjeId.toString(),
    back_urls: {
      success: `${frontendUrl}/radar?pago=ok&canje=${canjeId}`,
      failure: `${frontendUrl}/radar?pago=error&canje=${canjeId}`,
      pending: `${frontendUrl}/radar?pago=pendiente&canje=${canjeId}`
    },
    auto_return: 'approved',
    statement_descriptor: 'MERCADOLOCAL'
  }

  // notification_url: solo si BACKEND_URL es una URL HTTPS bien formada (MP la rechaza si no).
  const rawBackendUrl = (process.env.BACKEND_URL || '').trim().replace(/\/+$/, '')
  if (rawBackendUrl) {
    try {
      const webhookUrl = `${rawBackendUrl}/api/centro/webhook/mercadopago`
      const parsed = new URL(webhookUrl)
      if (parsed.protocol === 'https:' && parsed.hostname.includes('.')) {
        preferenceBody.notification_url = webhookUrl
      }
    } catch {
      /* URL inválida: se omite (el polling de estado-pago cubre la confirmación) */
    }
  }

  let result
  try {
    result = await preference.create({ body: preferenceBody })
  } catch (mpError) {
    console.error('❌ Error MP al crear preferencia de oferta:', mpError?.message || mpError)
    throw new Error(`Mercado Pago rechazó la solicitud: ${mpError?.message || 'error desconocido'}`)
  }

  // En producción usar init_point; en test, sandbox_init_point.
  const esProduccion = process.env.NODE_ENV === 'production'
  const initPoint = esProduccion
    ? (result.init_point || result.sandbox_init_point)
    : (result.sandbox_init_point || result.init_point)

  if (!initPoint) {
    throw new Error('Mercado Pago no devolvió una URL de pago válida. Intentá de nuevo.')
  }

  console.log(`🎟️ Preferencia de oferta creada: canje ${canjeId} | $${oferta.precioFinal}`)

  return {
    preferenceId: result.id,
    initPoint,
    sandboxInitPoint: result.sandbox_init_point
  }
}

/**
 * Consulta un pago en MercadoPago por su ID (usado por el webhook y el polling).
 * @returns el objeto Payment de MP, o null si no se encuentra.
 */
export async function obtenerPago(paymentId) {
  try {
    const payment = new Payment(clientePlataforma())
    return await payment.get({ id: paymentId })
  } catch (error) {
    console.error('Error obteniendo pago MercadoPago:', error?.message || error)
    return null
  }
}

/**
 * Busca el último pago asociado a una preferencia (external_reference = canjeId).
 * Útil para el polling cuando el webhook todavía no llegó.
 * @returns el Payment aprobado más reciente, o null.
 */
export async function buscarPagoPorReferencia(externalReference) {
  try {
    const payment = new Payment(clientePlataforma())
    const res = await payment.search({ options: { external_reference: externalReference } })
    const resultados = res?.results || []
    // Priorizar un pago aprobado
    return resultados.find(p => p.status === 'approved') || resultados[0] || null
  } catch (error) {
    console.error('Error buscando pago por referencia:', error?.message || error)
    return null
  }
}

/**
 * Reembolsa un pago (si el usuario cancela o hay un error).
 * En el SDK v2 los reembolsos viven en la clase PaymentRefund. Usamos import
 * dinámico para no romper la carga del módulo si el export cambiara.
 */
export async function reembolsarPago(paymentId) {
  try {
    const { PaymentRefund } = await import('mercadopago')
    const refund = new PaymentRefund(clientePlataforma())
    return await refund.create({ payment_id: paymentId })
  } catch (error) {
    console.error('Error reembolsando pago:', error?.message || error)
    throw error
  }
}

export default {
  configurarMercadoPago,
  crearPreferenciaOferta,
  obtenerPago,
  buscarPagoPorReferencia,
  reembolsarPago
}
