import { MercadoPagoConfig, Preference } from 'mercadopago'
import Tienda from '../models/Tienda.js'
import { refrescarTokenVendedor } from '../routes/mpOauth.js'

const PORCENTAJE_COMISION = 10

if (!process.env.MP_ACCESS_TOKEN) {
  console.warn('⚠️ MP_ACCESS_TOKEN no configurado - los pagos no funcionarán')
}

// Cliente principal del marketplace (tu cuenta)
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || ''
})

// Crear preferencia de pago con Split Payment (Marketplace)
export async function crearPreferencia(orden, compradorEmail) {
  const preference = new Preference(client)

  const items = orden.items.map(item => ({
    id: item.productoId.toString(),
    title: item.nombre,
    quantity: item.cantidad,
    unit_price: item.precioUnitario,
    currency_id: 'ARS'
  }))

  // Calcular el marketplace_fee (tu comisión)
  const marketplaceFee = Math.round(orden.total * PORCENTAJE_COMISION / 100 * 100) / 100

  // Agrupar items por tienda para determinar el vendedor
  const tiendaIds = [...new Set(orden.items.map(i => i.tiendaId.toString()))]

  // Para Split Payment: necesitamos el access_token del vendedor
  // Si hay un solo vendedor y tiene MP vinculado, usamos split
  let usarSplit = false
  let vendedorAccessToken = null

  if (tiendaIds.length === 1) {
    const tienda = await Tienda.findById(tiendaIds[0])
    if (tienda && tienda.mpVinculado && tienda.mpAccessToken) {
      usarSplit = true
      vendedorAccessToken = tienda.getMpAccessToken()
    }
  }

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, '')

  const preferenceBody = {
    items,
    payer: {
      email: compradorEmail
    },
    external_reference: orden._id.toString(),
    back_urls: {
      success: `${frontendUrl}/pago-exitoso`,
      failure: `${frontendUrl}/pago-fallido`,
      pending: `${frontendUrl}/pago-pendiente`
    },
    auto_return: 'approved',
    statement_descriptor: 'MERCADOLOCAL'
  }

  // notification_url: validar que sea una URL HTTPS bien formada
  // MP la rechaza si tiene formato inválido, espacios, caracteres raros, etc.
  const rawBackendUrl = (process.env.BACKEND_URL || '').trim().replace(/\/+$/, '')
  if (rawBackendUrl) {
    try {
      const webhookUrl = `${rawBackendUrl}/api/pagos/webhook`
      const parsed = new URL(webhookUrl)
      if (parsed.protocol === 'https:' && parsed.hostname.includes('.')) {
        preferenceBody.notification_url = webhookUrl
        console.log('🔔 Webhook URL:', webhookUrl)
      } else {
        console.warn('⚠️ notification_url no es HTTPS válida, se omite:', webhookUrl)
      }
    } catch (urlErr) {
      console.error('❌ BACKEND_URL mal formada, se omite notification_url. Valor raw:', JSON.stringify(rawBackendUrl))
    }
  }

  let result

  try {
    if (usarSplit) {
      preferenceBody.marketplace_fee = marketplaceFee
      const vendedorClient = new MercadoPagoConfig({
        accessToken: vendedorAccessToken
      })
      const vendedorPreference = new Preference(vendedorClient)
      try {
        result = await vendedorPreference.create({ body: preferenceBody })
      } catch (splitError) {
        // Si falla por token expirado, intentar refresh
        if (splitError?.status === 401 || splitError?.message?.includes('token')) {
          console.log('🔄 Token MP expirado, intentando refresh...')
          const tienda = await Tienda.findById(tiendaIds[0])
          const nuevoToken = await refrescarTokenVendedor(tienda)
          if (nuevoToken) {
            const refreshedClient = new MercadoPagoConfig({ accessToken: nuevoToken })
            result = await new Preference(refreshedClient).create({ body: preferenceBody })
            console.log('✅ Token refrescado y preferencia creada')
          } else {
            throw splitError
          }
        } else {
          throw splitError
        }
      }
      console.log(`💰 Preferencia Split creada: orden ${orden._id} | Fee marketplace: $${marketplaceFee}`)
    } else {
      result = await preference.create({ body: preferenceBody })
      console.log(`💰 Preferencia estándar creada: orden ${orden._id} (vendedor sin MP vinculado)`)
    }
  } catch (mpError) {
    console.error('❌ Error MP al crear preferencia:', mpError?.message || mpError)
    console.error('❌ Detalles:', JSON.stringify(mpError?.cause || mpError, null, 2))
    throw new Error(`Mercado Pago rechazó la solicitud: ${mpError?.message || 'error desconocido'}`)
  }

  // En producción usar init_point, en test usar sandbox_init_point
  const esProduccion = process.env.NODE_ENV === 'production'
  const initPoint = esProduccion
    ? (result.init_point || result.sandbox_init_point)
    : (result.sandbox_init_point || result.init_point)

  if (!initPoint) {
    throw new Error('Mercado Pago no devolvió una URL de pago válida. Intentá de nuevo.')
  }

  console.log(`🔗 URL de pago generada: ${initPoint.substring(0, 60)}...`)

  return {
    preferenceId: result.id,
    initPoint,
    sandboxInitPoint: result.sandbox_init_point,
    usaSplit: usarSplit,
    marketplaceFee
  }
}
