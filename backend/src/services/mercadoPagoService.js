import { MercadoPagoConfig, Preference } from 'mercadopago'
import Tienda from '../models/Tienda.js'
import { refrescarTokenVendedor, refrescarTokenComisionista } from '../routes/mpOauth.js'
import * as configService from './configService.js'

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
    // description + category_id mejoran la tasa de aprobación y reducen rechazos
    // del motor antifraude de MP (acción recomendada del reporte de integración).
    description: (item.nombre || 'Producto').slice(0, 250),
    category_id: 'others',
    quantity: item.cantidad,
    unit_price: item.precioUnitario,
    currency_id: 'ARS'
  }))

  // Calcular el marketplace_fee (tu comisión)
  const porcentajeComision = await configService.obtenerPorcentajeComision('venta')
  let marketplaceFee = Math.round(orden.total * porcentajeComision / 100 * 100) / 100

  // Oferta Compartida: si algún item está en una oferta co-financiada, la
  // plataforma absorbe su aporte reduciendo el fee (con piso mínimo para no
  // terminar con margen negativo).
  try {
    const { calcularAportePlataformaOrden } = await import('./ofertaCompartidaService.js')
    const { aporteTotal } = await calcularAportePlataformaOrden(orden)
    if (aporteTotal > 0) {
      const comisionMinima = await configService.obtenerComisionMinima()
      marketplaceFee = Math.max(Math.round((marketplaceFee - aporteTotal) * 100) / 100, comisionMinima)
    }
  } catch (e) {
    console.error('Error calculando aporte de oferta compartida:', e.message)
  }

  // Agrupar items por tienda para determinar el vendedor
  const tiendaIds = [...new Set(orden.items.map(i => i.tiendaId.toString()))]

  // Para Split Payment: necesitamos el access_token del vendedor
  // Si hay un solo vendedor y tiene MP vinculado, usamos split
  let usarSplit = false
  let vendedorAccessToken = null

  if (tiendaIds.length === 1) {
    const tienda = await Tienda.findById(tiendaIds[0])
    if (tienda && tienda.mpVinculado && tienda.mpAccessToken) {
      try {
        vendedorAccessToken = tienda.getMpAccessToken()
        if (vendedorAccessToken) {
          usarSplit = true
        } else {
          console.warn('⚠️ Token de vendedor vacío o inválido para tienda:', tienda._id)
        }
      } catch (decryptError) {
        console.error('⚠️ Error desencriptando token de vendedor:', decryptError.message)
        // Si falla la desencriptación, continuar sin split
      }
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

/**
 * Crea una preferencia de pago para el TRASLADO de un comisionista (split).
 *
 * El comprador paga el monto cotizado; la plataforma retiene un marketplace_fee
 * y el resto va a la cuenta MP del comisionista. external_reference se prefija
 * con "cotizacion:" para que el webhook lo distinga.
 *
 * @param {Object} args
 * @param {Object} args.solicitud - SolicitudCotizacion (tiene _id, cotizacion.monto)
 * @param {Object} args.perfilComisionista - PerfilComisionista con MP vinculado
 * @param {String} args.compradorEmail
 */
export async function crearPreferenciaTraslado({ solicitud, perfilComisionista, compradorEmail }) {
  const monto = Math.round(solicitud.cotizacion.monto)
  if (!monto || monto <= 0) throw new Error('La cotización no tiene un monto válido')
  if (!perfilComisionista?.mpVinculado) {
    throw new Error('El comisionista todavía no vinculó su cuenta de Mercado Pago')
  }

  let comisionistaToken
  try {
    comisionistaToken = perfilComisionista.getMpAccessToken()
  } catch {
    comisionistaToken = null
  }
  if (!comisionistaToken) throw new Error('No se pudo acceder a la cuenta de Mercado Pago del comisionista')

  const porcentajeComisionTraslado = await configService.obtenerPorcentajeComision('traslado')
  const marketplaceFee = Math.round(monto * porcentajeComisionTraslado / 100 * 100) / 100
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, '')

  const preferenceBody = {
    items: [{
      id: solicitud._id.toString(),
      title: `Traslado ${solicitud.ciudadOrigen || ''} → ${solicitud.ciudadDestino || ''}`.slice(0, 250),
      description: 'Servicio de traslado por comisionista (MercadoLocal solo conecta)',
      quantity: 1,
      unit_price: monto,
      currency_id: 'ARS'
    }],
    payer: { email: compradorEmail },
    external_reference: `cotizacion:${solicitud._id.toString()}`,
    marketplace_fee: marketplaceFee,
    back_urls: {
      success: `${frontendUrl}/comisionistas/mis-cotizaciones?pago=ok`,
      failure: `${frontendUrl}/comisionistas/mis-cotizaciones?pago=error`,
      pending: `${frontendUrl}/comisionistas/mis-cotizaciones?pago=pendiente`
    },
    auto_return: 'approved',
    statement_descriptor: 'MERCADOLOCAL ENVIO'
  }

  const rawBackendUrl = (process.env.BACKEND_URL || '').trim().replace(/\/+$/, '')
  if (rawBackendUrl) {
    try {
      const webhookUrl = `${rawBackendUrl}/api/pagos/webhook`
      const parsed = new URL(webhookUrl)
      if (parsed.protocol === 'https:' && parsed.hostname.includes('.')) {
        preferenceBody.notification_url = webhookUrl
      }
    } catch { /* URL inválida: se omite */ }
  }

  let result
  try {
    const comisionistaClient = new MercadoPagoConfig({ accessToken: comisionistaToken })
    try {
      result = await new Preference(comisionistaClient).create({ body: preferenceBody })
    } catch (splitError) {
      // Token expirado: intentar refresh una vez.
      if (splitError?.status === 401 || splitError?.message?.includes('token')) {
        const nuevoToken = await refrescarTokenComisionista(perfilComisionista)
        if (nuevoToken) {
          const refreshed = new MercadoPagoConfig({ accessToken: nuevoToken })
          result = await new Preference(refreshed).create({ body: preferenceBody })
        } else {
          throw splitError
        }
      } else {
        throw splitError
      }
    }
  } catch (mpError) {
    console.error('❌ Error MP al crear preferencia de traslado:', mpError?.message || mpError)
    throw new Error(`Mercado Pago rechazó la solicitud: ${mpError?.message || 'error desconocido'}`)
  }

  const esProduccion = process.env.NODE_ENV === 'production'
  const initPoint = esProduccion
    ? (result.init_point || result.sandbox_init_point)
    : (result.sandbox_init_point || result.init_point)

  if (!initPoint) throw new Error('Mercado Pago no devolvió una URL de pago válida. Intentá de nuevo.')

  console.log(`🚚 Preferencia de traslado creada: cotización ${solicitud._id} | $${monto} | Fee: $${marketplaceFee}`)
  return { preferenceId: result.id, initPoint, sandboxInitPoint: result.sandbox_init_point, marketplaceFee }
}

/**
 * Crea una preferencia de pago para PAUTA PUBLICITARIA.
 *
 * A diferencia de una compra, acá el dinero va ENTERO a la cuenta de la
 * plataforma (no hay split ni marketplace_fee): es ingreso propio por el
 * servicio de publicidad. El external_reference se prefija con "pauta:" para
 * que el webhook lo distinga de una orden de compra.
 *
 * @param {Object} args
 * @param {Object} args.destacado - documento Destacado pendiente (tiene _id, plan, duracionDias, precioTotal)
 * @param {Object} args.producto - producto que se promociona (para el título)
 * @param {Object} args.planInfo - info del plan (nombre)
 */
export async function crearPreferenciaPauta({ destacado, producto, planInfo }) {
  const preference = new Preference(client)

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, '')

  const preferenceBody = {
    items: [{
      id: destacado._id.toString(),
      title: `Pauta ${planInfo?.nombre || destacado.plan} · ${producto.nombre}`.slice(0, 250),
      description: `Promoción por ${destacado.duracionDias} días en MercadoLocal`,
      quantity: 1,
      unit_price: Math.round(destacado.precioTotal),
      currency_id: 'ARS'
    }],
    external_reference: `pauta:${destacado._id.toString()}`,
    back_urls: {
      success: `${frontendUrl}/promover?pago=ok`,
      failure: `${frontendUrl}/promover?pago=error`,
      pending: `${frontendUrl}/promover?pago=pendiente`
    },
    auto_return: 'approved',
    statement_descriptor: 'MERCADOLOCAL ADS'
  }

  // notification_url (mismo webhook que las compras; el handler distingue por external_reference)
  const rawBackendUrl = (process.env.BACKEND_URL || '').trim().replace(/\/+$/, '')
  if (rawBackendUrl) {
    try {
      const webhookUrl = `${rawBackendUrl}/api/pagos/webhook`
      const parsed = new URL(webhookUrl)
      if (parsed.protocol === 'https:' && parsed.hostname.includes('.')) {
        preferenceBody.notification_url = webhookUrl
      }
    } catch { /* URL inválida: se omite */ }
  }

  let result
  try {
    result = await preference.create({ body: preferenceBody })
  } catch (mpError) {
    console.error('❌ Error MP al crear preferencia de pauta:', mpError?.message || mpError)
    throw new Error(`Mercado Pago rechazó la solicitud: ${mpError?.message || 'error desconocido'}`)
  }

  const esProduccion = process.env.NODE_ENV === 'production'
  const initPoint = esProduccion
    ? (result.init_point || result.sandbox_init_point)
    : (result.sandbox_init_point || result.init_point)

  if (!initPoint) {
    throw new Error('Mercado Pago no devolvió una URL de pago válida. Intentá de nuevo.')
  }

  console.log(`📢 Preferencia de pauta creada: destacado ${destacado._id} | $${destacado.precioTotal}`)

  return { preferenceId: result.id, initPoint, sandboxInitPoint: result.sandbox_init_point }
}
