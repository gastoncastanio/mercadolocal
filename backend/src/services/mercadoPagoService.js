import { MercadoPagoConfig, Preference } from 'mercadopago'
import Tienda from '../models/Tienda.js'

const PORCENTAJE_COMISION = 10

// Cliente principal del marketplace (tu cuenta)
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
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
      vendedorAccessToken = tienda.mpAccessToken
    }
  }

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001'
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

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
    notification_url: `${backendUrl}/api/pagos/webhook`,
    statement_descriptor: 'MERCADOLOCAL'
  }

  let result

  if (usarSplit) {
    // Split Payment: marketplace_fee solo se usa con el token del vendedor
    preferenceBody.marketplace_fee = marketplaceFee
    const vendedorClient = new MercadoPagoConfig({
      accessToken: vendedorAccessToken
    })
    const vendedorPreference = new Preference(vendedorClient)
    result = await vendedorPreference.create({ body: preferenceBody })

    console.log(`💰 Preferencia Split creada: orden ${orden._id} | Fee marketplace: $${marketplaceFee}`)
  } else {
    // Sin split: todo va a tu cuenta (flujo anterior)
    result = await preference.create({ body: preferenceBody })

    console.log(`💰 Preferencia estándar creada: orden ${orden._id} (vendedor sin MP vinculado)`)
  }

  return {
    preferenceId: result.id,
    initPoint: result.init_point,
    sandboxInitPoint: result.sandbox_init_point,
    usaSplit: usarSplit,
    marketplaceFee
  }
}
