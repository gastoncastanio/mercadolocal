import mercadopago from 'mercadopago'

// Configuración de MercadoPago para pagos prepago en Radar del Centro
export function configurarMercadoPago() {
  const accessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error('MP_ACCESS_TOKEN o MERCADOPAGO_ACCESS_TOKEN no configurado en env')
  }
  mercadopago.configure({ access_token: accessToken })
}

/**
 * Crea una preferencia de pago en MercadoPago para una oferta flash.
 * Devuelve URL para redirigir al usuario.
 */
export async function crearPreferenciaOferta(oferta, usuario, canjeId) {
  try {
    const preference = {
      items: [
        {
          id: oferta._id.toString(),
          title: oferta.titulo,
          quantity: 1,
          unit_price: oferta.precioFinal,
          description: `Oferta ${oferta.bloqueHorario} - ${oferta.descripcion || 'sin descripción'}`
        }
      ],
      payer: {
        email: usuario.email,
        name: usuario.nombre || 'Usuario'
      },
      back_urls: {
        success: `${process.env.FRONTEND_URL}/radar?pago=ok&canje=${canjeId}`,
        failure: `${process.env.FRONTEND_URL}/radar?pago=error&canje=${canjeId}`,
        pending: `${process.env.FRONTEND_URL}/radar?pago=pendiente&canje=${canjeId}`
      },
      // Webhook: MP notifica al servidor cuando el pago se completa
      notification_url: `${process.env.API_URL}/api/centro/webhook/mercadopago`,
      external_reference: canjeId.toString(),
      auto_return: 'approved',
      expires: false
    }

    const response = await mercadopago.preferences.create(preference)
    return {
      preferenceId: response.body.id,
      initPoint: response.body.init_point, // URL para redirigir al usuario
      sandboxInitPoint: response.body.sandbox_init_point // Para testing
    }
  } catch (error) {
    console.error('Error creando preferencia MercadoPago:', error)
    throw error
  }
}

/**
 * Obtiene el estado de un pago desde MercadoPago (por si el webhook no llega).
 */
export async function obtenerEstadoPago(mercadopagoPreferenceId) {
  try {
    const preference = await mercadopago.preferences.findById(mercadopagoPreferenceId)
    return preference.body
  } catch (error) {
    console.error('Error obteniendo estado de pago:', error)
    throw error
  }
}

/**
 * Reembolsa un pago (si el usuario cancela o hay error).
 */
export async function reembolsarPago(mercadopagoPaymentId) {
  try {
    const refund = await mercadopago.refunds.create(mercadopagoPaymentId)
    return refund.body
  } catch (error) {
    console.error('Error reembolsando pago:', error)
    throw error
  }
}

export default { configurarMercadoPago, crearPreferenciaOferta, obtenerEstadoPago, reembolsarPago }
