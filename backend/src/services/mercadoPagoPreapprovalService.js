import { MercadoPagoConfig, Preapproval } from 'mercadopago'

if (!process.env.MP_ACCESS_TOKEN) {
  console.warn('⚠️ MP_ACCESS_TOKEN no configurado - los pagos recurrentes no funcionarán')
}

// Cliente principal del marketplace (tu cuenta)
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || ''
})

// Crear preapproval para suscripción mensual
export async function crearPreapproval(suscripcion, usuarioEmail) {
  const preapproval = new Preapproval(client)

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, '')
  const rawBackendUrl = (process.env.BACKEND_URL || '').trim().replace(/\/+$/, '')

  const preapprovalBody = {
    payer_email: usuarioEmail,
    back_url: `${frontendUrl}/servicios/suscripcion-confirmada`,
    reason: `Suscripción ${suscripcion.plan} - MercadoLocal`,
    external_reference: suscripcion._id.toString(),
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: suscripcion.precioMensual,
      currency_id: 'ARS'
    }
  }

  // Agregar webhook si está configurado
  if (rawBackendUrl) {
    try {
      const webhookUrl = `${rawBackendUrl}/api/pagos/webhook/preapproval`
      new URL(webhookUrl) // Validar URL
      preapprovalBody.notification_url = webhookUrl
    } catch (error) {
      console.warn('⚠️ URL de webhook inválida para preapproval:', error.message)
    }
  }

  try {
    const response = await preapproval.create(preapprovalBody)
    return response
  } catch (error) {
    console.error('❌ Error creando preapproval en MP:', error)
    throw new Error(`Error al crear preapproval: ${error.message}`)
  }
}

// Obtener estado de preapproval
export async function obtenerPreapproval(preapprovalId) {
  try {
    const preapproval = new Preapproval(client)
    // MP SDK v2 requiere hacer GET manual a la API
    const response = await client.makeRequest({
      method: 'GET',
      url: `/preapprovals/${preapprovalId}`
    })
    return response
  } catch (error) {
    console.error('❌ Error obteniendo preapproval:', error)
    throw new Error(`Error al obtener preapproval: ${error.message}`)
  }
}

// Cancelar preapproval
export async function cancelarPreapproval(preapprovalId) {
  try {
    const response = await client.makeRequest({
      method: 'PUT',
      url: `/preapprovals/${preapprovalId}`,
      data: {
        status: 'cancelled'
      }
    })
    return response
  } catch (error) {
    console.error('❌ Error cancelando preapproval:', error)
    throw new Error(`Error al cancelar preapproval: ${error.message}`)
  }
}

export default {
  crearPreapproval,
  obtenerPreapproval,
  cancelarPreapproval
}
